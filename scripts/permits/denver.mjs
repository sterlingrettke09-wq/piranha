#!/usr/bin/env node
// WO-7.1 — Denver permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/denver.mjs
//
// Denver publishes its construction permits through the city's open-data
// geospatial catalog as ArcGIS FeatureServer layers (the denvergov ArcGIS Online
// org, services1.arcgis.com/zdB7qR0BtYrg0Xpl), NOT Socrata — so this script
// speaks the ArcGIS REST query protocol like dc.mjs rather than Socrata's
// $where. Unlike DC, Denver's permit feed DOES carry a genuine application date
// (DATE_RECEIVED) alongside the issuance date (DATE_ISSUED), so a real
// filing -> issuance latency can be computed.
//
// New-construction permits live across two sibling layers — residential and
// commercial — both keyed by CLASS = 'NEW BUILDING'. We pull both and pool them
// (the reference project is "new construction" regardless of use), compute the
// median + 80th-percentile DATE_RECEIVED -> DATE_ISSUED time in months, and MERGE
// the result into netlify/functions/lib/data/permitStats.json under
// denver.newConstruction. Idempotent: safe to run repeatedly; never touches
// other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset endpoints ────────────────────────────────────────────────────────
// Two FeatureServer layers on the denvergov ArcGIS Online org. The numeric layer
// ids (316 / 317) are stable within the service but re-find them from the
// service's `?f=json` listing if they ever rotate.
const RESIDENTIAL_URL =
  'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_DEV_RESIDENTIALCONSTPERMIT_P/FeatureServer/316'
const COMMERCIAL_URL =
  'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_DEV_COMMERCIALCONSTPERMIT_P/FeatureServer/317'

// Required date columns. DATE_RECEIVED is the genuine application/filed date;
// DATE_ISSUED is issuance. If either is missing from the live schema we refuse
// to fabricate a latency figure and leave the artifact untouched (Boston lesson).
const APPLIED_DATE_FIELD = 'DATE_RECEIVED'
const ISSUED_DATE_FIELD = 'DATE_ISSUED'
// New construction is flagged by CLASS = 'NEW BUILDING' (the dominant ground-up
// class in both layers; ALTERATION / ADDITION / REPAIR etc. are excluded).
const TYPE_FIELD = 'CLASS'
const NEW_CONSTRUCTION_TYPE = 'NEW BUILDING'

const SINCE = '2022-01-01'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  "opendata-geospatial.denvergov.org Construction Permits (residential + commercial; CLASS = 'NEW BUILDING')"

import { readFile, writeFile } from 'node:fs/promises'

async function arcgis(layerUrl, params) {
  const url = new URL(`${layerUrl}/query`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching services1.arcgis.com: ${err.message}. ` +
      `Check connectivity; the service may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`services1.arcgis.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  // ArcGIS returns HTTP 200 with an {error:{...}} body on failure — surface it.
  if (body.error) throw new Error(`ArcGIS query error: ${JSON.stringify(body.error)}`)
  return body
}

async function layerFields(layerUrl) {
  const url = new URL(layerUrl)
  url.searchParams.set('f', 'json')
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`services1.arcgis.com metadata returned HTTP ${res.status} ${res.statusText}`)
  const meta = await res.json()
  if (meta.error) throw new Error(`ArcGIS metadata error: ${JSON.stringify(meta.error)}`)
  return (meta.fields ?? []).map((f) => f.name)
}

function quantile(sortedDays, q) {
  if (sortedDays.length === 0) return null
  const idx = (sortedDays.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedDays[lo]
  return sortedDays[lo] + (sortedDays[hi] - sortedDays[lo]) * (idx - lo)
}

const daysToMonths = (days) => Math.round((days / 30.44) * 10) / 10

// Pull all NEW BUILDING applied/issued pairs from one layer, paging through
// OBJECTID since the server caps result counts.
async function pullLayer(layerUrl) {
  const where =
    `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPE}' ` +
    `AND ${APPLIED_DATE_FIELD} >= DATE '${SINCE}' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = []
  let offset = 0
  const page = 2000
  for (;;) {
    const body = await arcgis(layerUrl, {
      where,
      outFields: `${APPLIED_DATE_FIELD},${ISSUED_DATE_FIELD}`,
      resultOffset: String(offset),
      resultRecordCount: String(page),
      orderByFields: 'OBJECTID',
      returnGeometry: 'false',
    })
    const feats = body.features ?? []
    for (const f of feats) rows.push(f.attributes)
    if (feats.length < page) break
    offset += page
  }
  return rows
}

async function main() {
  console.log(`Denver permit pipeline — residential + commercial NEW BUILDING`)

  // 1. Probe BOTH layer schemas and confirm the fields we need exist.
  for (const [name, url] of [['residential', RESIDENTIAL_URL], ['commercial', COMMERCIAL_URL]]) {
    const fieldSet = new Set(await layerFields(url))
    for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD]) {
      if (!fieldSet.has(f)) {
        throw new Error(
          `Expected field "${f}" not found in the ${name} layer schema; the service may ` +
            `have changed. Found: ${[...fieldSet].join(', ')}. ` +
            `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
        )
      }
    }
  }

  // 2. Pull and pool both layers.
  const rows = [...(await pullLayer(RESIDENTIAL_URL)), ...(await pullLayer(COMMERCIAL_URL))]

  // 3. Compute durations, dropping negatives and absurd outliers (> 120 months).
  //    Also watch the NYC failure mode: a feed that stamps both legs at issuance
  //    produces a meaningless ~0-month latency.
  const days = []
  let sameDay = 0
  for (const r of rows) {
    // ArcGIS date fields come back as epoch millis.
    const a = r[APPLIED_DATE_FIELD]
    const i = r[ISSUED_DATE_FIELD]
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  const sameDayPct = (sameDay / rows.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing denver.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 4. Sanity gate. A median under half a month or a tiny n is not trustworthy.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); ` +
        `not writing. Investigate the dataset before trusting this.`,
    )
    return
  }

  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage: `applied ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, denver: { ...(existing.denver ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`  ${sameDayPct.toFixed(1)}% same-day. Wrote denver.newConstruction:`, stats)
}

main().catch((err) => {
  console.error(`\ndenver.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
