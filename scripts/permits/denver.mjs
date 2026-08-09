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
// New-construction permits live across two sibling layers — residential (IRC
// scope) and commercial (IBC scope). We pull both and pool them, compute the
// median + 80th-percentile DATE_RECEIVED -> DATE_ISSUED time in months, split it
// by building tier, and MERGE the result into
// netlify/functions/lib/data/permitStats.json under denver.newConstruction /
// denver.byTier. Idempotent: safe to run repeatedly; never touches other
// cities' blocks.
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
const TYPE_FIELD = 'CLASS'
const UNITS_FIELD = 'UNITS'

const SINCE = '2022-01-01'

// ── CLASS gate — WIDENED 2026-08-06 ─────────────────────────────────────────
// The type taxonomy was already clean: Denver files pools, decks, signs, fences
// and retaining walls under CLASS = 'NEW NON-BUILDING STRUCTURE', which
// `CLASS = 'NEW BUILDING'` never admitted (contrast Austin, where 37% of the
// admitted set was not a building). The defect here was the opposite one — the
// filter was TOO NARROW.
//
// `CLASS = 'NEW BUILDING'` missed the COMMERCIAL layer's PHASED CONSTRUCTION
// class: 51 rows since 2022, of which 22 share no address with any admitted NEW
// BUILDING record and were absent from the sample entirely. Denver CPD policy
// ADMIN 133.4 & 135 (eff. 2023-02-22) defines these as a project "separated for
// the purposes of plan review and permitting into two or more phases (i.e.,
// foundation / superstructure; or structural only / core and shell completion)"
// — i.e. a ground-up building permit issued in parts, not a different kind of
// work. They are also the LARGEST projects in the city: median valuation
// $15.97M against $1.61M for admitted commercial NEW BUILDING, and 12 of the 51
// carry a dwelling-unit count of 23–311.
//
// ALLOWLIST, not a denylist, and PER LAYER: a CLASS we have never seen is
// EXCLUDED rather than admitted, so a new Denver category cannot quietly
// re-contaminate this. The gate is applied twice — server-side in the WHERE and
// again row-side after the fetch — so a service-side collation or LIKE quirk
// cannot widen it silently.
const ADMITTED_CLASSES = {
  residential: new Set(['NEW BUILDING']),
  commercial: new Set(['NEW BUILDING', 'PHASED CONSTRUCTION']),
}

// ── Why the RESIDENTIAL layer's PHASED CONSTRUCTION is NOT admitted ─────────
// It carries the same label and is 26× larger (1,345 rows), so the symmetric
// filter looks obviously right. It is not the same thing. ADMIN 133.4 & 135
// scopes phased permitting "exclusive of shoring, deferred submittals, tenant
// finishes, and site work" — and the residential rows are exactly that excluded
// work, filed under the phased label: median valuation $12,000 (against
// $182,508 for residential NEW BUILDING), 1,326 of 1,345 under $100k, and 409
// of them name SHORING or EXCAVATION in the address string itself
// ("1620 S OGDEN ST SHORING", "352 S High ST Shoring"). Admitting them would
// add 1,345 shoring sub-permits AND double-count 397 projects that already
// appear as a NEW BUILDING row at the same address.
//
// Same reasoning excludes FOUNDATION ONLY/EXCAVATION in both layers (res 88 rows
// at median 0.3 mo, com 49 at 2.3 mo) — partial permits for a project whose
// building permit is already in the sample, and fast enough to drag the median
// down if admitted.
//
// ── What the added set does to the figure ───────────────────────────────────
// Measured 2026-08-06 over the live layers, applied 2022-01-01 onward:
//
//   retained  NEW BUILDING (res+com)      n=6,871  median 4.5 mo  p80 11.1
//   ADDED     com PHASED CONSTRUCTION     n=   51  median 6.0 mo  p80 12.4
//   after     pooled                      n=6,922  median 4.5 mo  p80 11.1
//
// The added set is SLOWER than the retained set (6.0 vs 4.5 months), so the
// exclusion biased the published figure DOWN — the criterion selects on project
// size and phased permits are Denver's largest projects. The magnitude is below
// publication precision at the aggregate (0.7% of n; the median is 138 days
// before and after) and +0.1 mo on the apartment tier (5.2 → 5.3, p80 10.8 →
// 10.9). Direction and magnitude are separate findings: the direction is real
// and the magnitude is ~zero, and only measuring the added set's timing
// distinguishes those two.
//
// ⚠️ KNOWN LIMITATIONS, not fixed here.
//  1. RIGHT-CENSORING. Every figure below is conditional on eventual issuance —
//     permits still in review never enter the sample, so these are FLOORS.
//     Correcting that is a separate pass (see docs/VERIFICATION-LEDGER.md).
//  2. PROJECT DUPLICATION. A phased project files two or more permits by
//     definition, so it contributes two or more observations to the median; 29
//     of the 51 added rows share an address with an admitted NEW BUILDING row
//     (none shares a LOG_NUM — LOG_NUM is not a stable project key across
//     permits here, and 2,742 of the NEW BUILDING rows have none). Restricting
//     the addition to the 22 address-unique rows gives the identical 4.5 / 11.1,
//     so nothing published turns on the choice. Deduplication is a separate
//     defect class from filtering and is deliberately not attempted here.
//  3. UNTIERED RESIDENTIAL ROWS. 2,771 admitted residential rows carry no UNITS
//     value and get NO tier rather than an assumed one (median 3.2 mo — well
//     below both resolvable tiers, and 748 of them name a garage, carport, shed
//     or ADU in the address string). Absent units is a GAP, not "1 unit"; they
//     stay in the aggregate and out of byTier.

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'opendata-geospatial.denvergov.org Construction Permits (residential CLASS = ' +
  "'NEW BUILDING'; commercial CLASS IN ('NEW BUILDING','PHASED CONSTRUCTION'))"

// ── Tier assignment ─────────────────────────────────────────────────────────
// Mirrors buildingTier() in netlify/functions/lib/timeline.ts: single = 1 unit,
// multi = 2-4, apartment = 5+ AND all commercial/institutional.
//
// WHY THIS EXISTS: Denver's aggregate is 91% residential-layer rows, and it sits
// BELOW both tiers it is built from — 4.5 months published against a measured
// 5.4 for single-family and 5.3 for apartment-tier. The gap is not a tier at
// all: it is the 2,771 untiered residential rows at 3.2 months (limitation 3
// above) pulling the pooled median down. A user is currently shown a number
// that is too fast for whatever they are actually building.
//
// The commercial layer is Denver's IBC-scope layer — commercial and
// institutional buildings plus multifamily above IRC scope. buildingTier() maps
// commercial and institutional use to 'apartment' directly, so the layer itself
// carries the tier; the only exception is the 18 rows that state 2-4 dwelling
// units, which are read as 'multi' from the field rather than from the layer.
function tierOf(layer, unitsRaw) {
  const raw = String(unitsRaw ?? '').trim()
  const parsed = raw === '' || raw.toLowerCase() === 'null' ? NaN : Number(raw)
  const units = Number.isFinite(parsed) ? parsed : null
  // A stated 2-4 dwelling units is 'multi' in either layer.
  if (units != null && units >= 2 && units <= 4) return 'multi'
  // IBC-scope layer: commercial/institutional use, or 5+ dwelling units.
  if (layer === 'commercial') return 'apartment'
  if (units === 1) return 'single'
  if (units != null && units >= 5) return 'apartment'
  // UNITS absent (or '0', or the literal 'IRC'): tier UNRESOLVED. Do not guess.
  return null
}

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'

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
const upper = (s) => String(s ?? '').toUpperCase().trim()

// Pull all admitted applied/issued pairs from one layer, paging through
// OBJECTID since the server caps result counts. The two layers disagree on the
// CASE of their CLASS values — residential stores 'NEW BUILDING', commercial
// stores 'New Building' — so the comparison is made on UPPER(CLASS) rather than
// relying on the service's collation happening to be case-insensitive.
async function pullLayer(layerUrl, layer) {
  const classList = [...ADMITTED_CLASSES[layer]].map((c) => `'${c}'`).join(', ')
  const where =
    `UPPER(${TYPE_FIELD}) IN (${classList}) ` +
    `AND ${APPLIED_DATE_FIELD} >= DATE '${SINCE}' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = []
  let offset = 0
  const page = 2000
  for (;;) {
    const body = await arcgis(layerUrl, {
      where,
      outFields: `${APPLIED_DATE_FIELD},${ISSUED_DATE_FIELD},${TYPE_FIELD},${UNITS_FIELD}`,
      resultOffset: String(offset),
      resultRecordCount: String(page),
      orderByFields: 'OBJECTID',
      returnGeometry: 'false',
    })
    const feats = body.features ?? []
    for (const f of feats) rows.push({ ...f.attributes, __layer: layer })
    if (feats.length < page) break
    offset += page
  }
  return rows
}

async function main() {
  console.log(`Denver permit pipeline — residential + commercial ground-up construction`)

  // 1. Probe BOTH layer schemas and confirm the fields we need exist.
  for (const [name, url] of [['residential', RESIDENTIAL_URL], ['commercial', COMMERCIAL_URL]]) {
    const fieldSet = new Set(await layerFields(url))
    for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD, UNITS_FIELD]) {
      if (!fieldSet.has(f)) {
        throw new Error(
          `Expected field "${f}" not found in the ${name} layer schema; the service may ` +
            `have changed. Found: ${[...fieldSet].join(', ')}. ` +
            `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
        )
      }
    }
  }

  // 2. Pull and pool both layers, each under its own CLASS allowlist.
  const rows = [
    ...(await pullLayer(RESIDENTIAL_URL, 'residential')),
    ...(await pullLayer(COMMERCIAL_URL, 'commercial')),
  ]

  // 3. Compute durations, dropping negatives and absurd outliers (> 120 months).
  //    Also watch the NYC failure mode: a feed that stamps both legs at issuance
  //    produces a meaningless ~0-month latency.
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let sameDay = 0
  let notAdmitted = 0
  let untiered = 0
  for (const r of rows) {
    // Re-apply the CLASS allowlist row-side. The server already filtered, so
    // this should never fire — but an unrecognised CLASS must be DROPPED rather
    // than fall through into the aggregate, whatever the service returns.
    if (!ADMITTED_CLASSES[r.__layer].has(upper(r[TYPE_FIELD]))) {
      notAdmitted++
      continue
    }
    // ArcGIS date fields come back as epoch millis.
    const a = r[APPLIED_DATE_FIELD]
    const i = r[ISSUED_DATE_FIELD]
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) {
      days.push(d)
      const tier = tierOf(r.__layer, r[UNITS_FIELD])
      if (tier) byTier[tier].push(d)
      else untiered++
    }
  }
  if (notAdmitted > 0) {
    console.warn(`  ${notAdmitted} rows came back with a CLASS outside the allowlist and were dropped`)
  }
  console.log(`  ${untiered} admitted rows carry no UNITS value — no tier assigned (aggregate only)`)

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

  const vintage = `applied ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`

  // Per-tier figures. The aggregate is kept for compatibility but is the WEAKER
  // number here — it is dragged below both measured tiers by the untiered
  // residential rows, so a consumer that knows the project's tier should always
  // prefer byTier (see measuredFor()).
  // The n<30 publication floor and the RECORD of every tier it withholds come out
  // of one call, so a tier can no longer be dropped silently — see
  // scripts/permits/lib/tierFloor.mjs. `tierBreakdown` is written beside `byTier`
  // and is what tells measuredFor() to fail closed rather than serve the
  // aggregate for a withheld tier.
  const { tiers, tierBreakdown } = splitTiersAtFloor(byTier, (rows) => ({
    medianMonths: daysToMonths(quantile(rows, 0.5)),
    p80Months: daysToMonths(quantile(rows, 0.8)),
    n: rows.length,
    vintage,
  }))
  console.log('  by tier:', Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    denver: { ...(existing.denver ?? {}), newConstruction: stats, byTier: tiers, tierBreakdown },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`  ${sameDayPct.toFixed(1)}% same-day. Wrote denver.newConstruction:`, stats)
}

main().catch((err) => {
  console.error(`\ndenver.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
