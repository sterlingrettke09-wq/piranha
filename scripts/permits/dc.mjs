#!/usr/bin/env node
// WO-7.1 — Washington, DC permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/dc.mjs
//
// DC's open building-permit data is published as ArcGIS FeatureServer layers
// (opendata.dc.gov / maps2.dcgis.dc.gov), NOT Socrata — so this script speaks
// the ArcGIS REST query protocol rather than Socrata's $where. It probes the
// DCRA "Building Permits" layer schema, and IF it carries both an
// application/filed date and an issued date, computes the median + 80th-
// percentile filing -> issuance time and MERGES it into
// netlify/functions/lib/data/permitStats.json under dc.newConstruction.
//
// As of the WO-7.1 run, DC FAILS the schema check the same way Boston did: the
// DCRA building-permit feed exposes ONLY issuance-side dates (ISSUE_DATE, plus
// the GIS housekeeping stamps CREATED_DATE / LAST_EDITED_DATE, which carry a
// single ETL load timestamp unrelated to the permit). There is no
// application/filed date, so a filing -> issuance latency cannot be computed
// without fabricating it. The script documents the gap and writes NOTHING.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset endpoint ─────────────────────────────────────────────────────────
// DCRA "Building Permits" FeatureServer. opendata.dc.gov splits the permits into
// one layer per year under the FEEDS/DCRA FeatureServer; we probe the current
// year's layer for the schema. Re-find the layer from opendata.dc.gov's dataset
// search ("Building Permits in <year>") if the layer id ever changes.
const LAYER_URL = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/18'

// Issuance-side date we know is present.
const ISSUED_DATE_FIELD = 'ISSUE_DATE'
// Candidate application/filed-date columns. CREATED_DATE / LAST_EDITED_DATE are
// deliberately EXCLUDED: they are ArcGIS row-edit housekeeping stamps (every row
// shares the latest ETL load timestamp), not the permit's application date —
// using them would fabricate the filing leg. We look only for a genuine
// application/filed/submitted column.
const APPLIED_DATE_CANDIDATES = [
  'APPLICATION_DATE', 'APPLIED_DATE', 'FILED_DATE', 'FILE_DATE',
  'SUBMITTED_DATE', 'SUBMIT_DATE', 'APPLICATION_START_DATE', 'DATE_FILED',
]
// New-construction is flagged by PERMIT_SUBTYPE_NAME = 'NEW BUILDING'
// (PERMIT_TYPE_NAME is a workflow/document class — CONSTRUCTION / SUPPLEMENTAL /
// POST CARD — not the building-use class).
const TYPE_FIELD = 'PERMIT_SUBTYPE_NAME'
const NEW_CONSTRUCTION_TYPE = 'NEW BUILDING'

const SINCE = '2022-01-01'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = "opendata.dc.gov DCRA Building Permits (PERMIT_SUBTYPE_NAME = 'NEW BUILDING')"

import { readFile, writeFile } from 'node:fs/promises'

async function arcgis(params) {
  const url = new URL(`${LAYER_URL}/query`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching maps2.dcgis.dc.gov: ${err.message}. ` +
      `Check connectivity; the service may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`maps2.dcgis.dc.gov returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  // ArcGIS returns HTTP 200 with an {error:{...}} body on failure — surface it.
  if (body.error) {
    throw new Error(`ArcGIS query error: ${JSON.stringify(body.error)}`)
  }
  return body
}

async function layerFields() {
  const url = new URL(LAYER_URL)
  url.searchParams.set('f', 'json')
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`maps2.dcgis.dc.gov metadata returned HTTP ${res.status} ${res.statusText}`)
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

async function main() {
  console.log(`DC permit pipeline — ${LAYER_URL}`)

  // 1. Probe the live schema.
  const fields = await layerFields()
  const fieldSet = new Set(fields)
  if (!fieldSet.has(ISSUED_DATE_FIELD)) {
    throw new Error(
      `Expected issuance field "${ISSUED_DATE_FIELD}" not found; the layer schema may ` +
        `have changed. Found: ${fields.join(', ')}.`,
    )
  }
  const appliedField = APPLIED_DATE_CANDIDATES.find((f) => fieldSet.has(f))

  // 2. The Boston / honest-failure gate: no genuine application date → we cannot
  //    measure a filing -> issuance latency without inventing the filing leg.
  if (!appliedField) {
    console.warn(
      `\n  DC's DCRA building-permit feed publishes "${ISSUED_DATE_FIELD}" but NO ` +
        `application/filed date (looked for: ${APPLIED_DATE_CANDIDATES.join(', ')}).\n` +
        `  CREATED_DATE / LAST_EDITED_DATE are ArcGIS row-edit stamps (a single ETL ` +
        `load timestamp), not the permit's application date, so they are intentionally\n` +
        `  not used. A filing -> issuance latency cannot be computed without fabricating ` +
        `it, so permitStats.json is left UNCHANGED.\n` +
        `  When DC exposes a genuine application/submitted date, add it to ` +
        `APPLIED_DATE_CANDIDATES and re-run.\n`,
    )
    return
  }

  if (!fieldSet.has(TYPE_FIELD)) {
    throw new Error(
      `Expected type field "${TYPE_FIELD}" not found; the layer schema may have ` +
        `changed. Found: ${fields.join(', ')}.`,
    )
  }

  // 3. (Only reached once DC publishes an application date.) Pull the sample via
  //    ArcGIS, paging through OBJECTID since the server caps result counts.
  const where =
    `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPE}' ` +
    `AND ${appliedField} >= DATE '${SINCE}' ` +
    `AND ${appliedField} IS NOT NULL AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = []
  let offset = 0
  const page = 2000
  for (;;) {
    const body = await arcgis({
      where,
      outFields: `${appliedField},${ISSUED_DATE_FIELD}`,
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

  const days = []
  let sameDay = 0
  for (const r of rows) {
    // ArcGIS date fields come back as epoch millis.
    const a = r[appliedField]
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
        `recording artifact, not a real review time. Not writing dc.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing.`,
    )
    return
  }

  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage: `applied ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, dc: { ...(existing.dc ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote dc.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\ndc.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
