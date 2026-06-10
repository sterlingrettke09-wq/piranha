#!/usr/bin/env node
// WO-7.1 — Minneapolis permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/minneapolis.mjs
//
// Minneapolis publishes building permits through its ArcGIS Hub open-data portal
// (opendata.minneapolismn.gov), backed by the cityoflakes ArcGIS Online org
// (services.arcgis.com/afSMGVsC7QlRK1kZ). The current permit feed is the
// "CCS Permits" FeatureServer (CCS = Construction Code Services). This script
// speaks the ArcGIS REST query protocol like dc.mjs / denver.mjs, probes the
// CCS_Permits schema, and IF it carries both an application/filed date and an
// issued date, computes the median + 80th-percentile filing -> issuance time and
// MERGES it into netlify/functions/lib/data/permitStats.json under
// minneapolis.newConstruction.
//
// As of the WO-7.1 run, Minneapolis FAILS the schema check the same way DC and
// Boston did: the CCS_Permits feed exposes ONLY issuance-side dates — issueDate
// (when the permit was issued) and completeDate (when the *project* finished,
// AFTER issuance, and frequently null). There is NO application/submitted/filed
// date, so a filing -> issuance latency cannot be computed without fabricating
// it. The script documents the gap and writes NOTHING.
//
// The legacy per-year "Minneapolis_Building_Permits_YYYY" Hub layers stop at
// 2014 (too old for a 2022+ vintage) and were checked — they are not used.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset endpoint ─────────────────────────────────────────────────────────
// CCS_Permits FeatureServer layer 0 on the cityoflakes ArcGIS Online org.
// Re-find it from opendata.minneapolismn.gov's "CCS Permits" dataset page if the
// service path ever changes.
const LAYER_URL =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/CCS_Permits/FeatureServer/0'

// Issuance-side date we know is present.
const ISSUED_DATE_FIELD = 'issueDate'
// Candidate application/filed-date columns. completeDate is deliberately
// EXCLUDED: it is the PROJECT-completion date (after issuance), not the permit's
// application date — using it would not give a filing leg at all (it's the wrong
// direction). We look only for a genuine application/filed/submitted column.
const APPLIED_DATE_CANDIDATES = [
  'applicationDate', 'appliedDate', 'applyDate', 'filedDate', 'fileDate',
  'submittedDate', 'submitDate', 'applicationStartDate', 'dateFiled',
  'dateReceived', 'receivedDate', 'intakeDate', 'createdDate',
]
// New construction is flagged by workType = 'New'.
const TYPE_FIELD = 'workType'
const NEW_CONSTRUCTION_TYPE = 'New'

const SINCE = '2022-01-01'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = "opendata.minneapolismn.gov CCS Permits (workType = 'New')"

import { readFile, writeFile } from 'node:fs/promises'

async function arcgis(params) {
  const url = new URL(`${LAYER_URL}/query`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching services.arcgis.com: ${err.message}. ` +
      `Check connectivity; the service may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`services.arcgis.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(`ArcGIS query error: ${JSON.stringify(body.error)}`)
  return body
}

async function layerFields() {
  const url = new URL(LAYER_URL)
  url.searchParams.set('f', 'json')
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`services.arcgis.com metadata returned HTTP ${res.status} ${res.statusText}`)
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
  console.log(`Minneapolis permit pipeline — ${LAYER_URL}`)

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

  // 2. The Boston / DC honest-failure gate: no genuine application date → we
  //    cannot measure a filing -> issuance latency without inventing the filing
  //    leg. (completeDate is project completion AFTER issuance, not application.)
  if (!appliedField) {
    console.warn(
      `\n  Minneapolis's CCS Permits feed publishes "${ISSUED_DATE_FIELD}" but NO ` +
        `application/filed date (looked for: ${APPLIED_DATE_CANDIDATES.join(', ')}).\n` +
        `  The only other date, completeDate, is the PROJECT-completion date (after ` +
        `issuance, often null), not the permit's application date, so it is\n` +
        `  intentionally not used. A filing -> issuance latency cannot be computed ` +
        `without fabricating it, so permitStats.json is left UNCHANGED.\n` +
        `  When Minneapolis exposes a genuine application/submitted date, add it to ` +
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

  // 3. (Only reached once Minneapolis publishes an application date.) Pull the
  //    sample via ArcGIS, paging through OBJECTID since the server caps counts.
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
        `recording artifact, not a real review time. Not writing minneapolis.`,
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
  const merged = { ...existing, minneapolis: { ...(existing.minneapolis ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote minneapolis.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nminneapolis.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
