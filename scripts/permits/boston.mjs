#!/usr/bin/env node
// WO-7.1 — Boston permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/boston.mjs
//
// Pulls Boston's "Approved Building Permits" dataset from data.boston.gov,
// filters to new-construction (ERECT) permits issued since 2023, computes the
// median and 80th-percentile application -> issuance time in months, and MERGES
// the result into netlify/functions/lib/data/permitStats.json under
// boston.newConstruction. Idempotent: safe to run repeatedly; never touches
// other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// CKAN datastore resource id for the active "Approved Building Permits" CSV.
// How to re-find it if it changes (CKAN resource ids rotate on re-upload):
//   curl -s "https://data.boston.gov/api/3/action/package_show?id=approved-building-permits" \
//     | python3 -c "import json,sys;[print(r['datastore_active'],r['id'],r['name']) for r in json.load(sys.stdin)['result']['resources']]"
// and take the resource whose datastore_active is True.
const RESOURCE_ID = '6ddcd912-32a0-43df-9908-63574f8c7e77'
const BASE = 'https://data.boston.gov/api/3/action'

// Worktype code for ground-up new construction in this dataset (verified
// against the distinct-worktype histogram: ERECT ~7.8k records).
const NEW_CONSTRUCTION_WORKTYPE = 'ERECT'

// Only permits issued on/after this date go into the sample (keeps the vintage
// recent and the n meaningful).
const SINCE = '2023-01-01'

// The dataset reliably carries `issued_date`. An application/filed date is not
// guaranteed to be published — CKAN schemas drift — so we probe a list of
// candidate column names and use whichever the live schema actually exposes.
// If none is present, we DON'T fabricate an application->issuance figure; we
// report the gap and leave the artifact untouched.
const APPLIED_DATE_CANDIDATES = ['applied_date', 'application_date', 'filed_date', 'app_date']
const ISSUED_DATE_FIELD = 'issued_date'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)

import { readFile, writeFile } from 'node:fs/promises'

async function ckan(action, params) {
  const url = new URL(`${BASE}/${action}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching data.boston.gov (${action}): ${err.message}. ` +
      `Check connectivity; the dataset may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`data.boston.gov ${action} returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (!body.success) throw new Error(`CKAN ${action} reported failure: ${JSON.stringify(body.error ?? body)}`)
  return body.result
}

function quantile(sortedDays, q) {
  // Linear-interpolation percentile over an ascending array.
  if (sortedDays.length === 0) return null
  const idx = (sortedDays.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedDays[lo]
  return sortedDays[lo] + (sortedDays[hi] - sortedDays[lo]) * (idx - lo)
}

const daysToMonths = (days) => Math.round((days / 30.44) * 10) / 10

async function main() {
  console.log(`Boston permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Discover which fields exist (one tiny request).
  const probe = await ckan('datastore_search', { resource_id: RESOURCE_ID, limit: '1' })
  const fieldIds = new Set(probe.fields.map((f) => f.id))
  if (!fieldIds.has(ISSUED_DATE_FIELD)) {
    throw new Error(`Expected field "${ISSUED_DATE_FIELD}" not found in dataset schema; ` +
      `the resource may have changed. Found: ${[...fieldIds].join(', ')}`)
  }
  const appliedField = APPLIED_DATE_CANDIDATES.find((f) => fieldIds.has(f))

  if (!appliedField) {
    console.warn(
      `\n  This dataset publishes "${ISSUED_DATE_FIELD}" but no application/filed date ` +
        `(looked for: ${APPLIED_DATE_CANDIDATES.join(', ')}).\n` +
        `  Application -> issuance latency cannot be computed without fabricating it, ` +
        `so permitStats.json is left UNCHANGED.\n` +
        `  When Boston exposes a filed-date column, add it to APPLIED_DATE_CANDIDATES and re-run.\n`,
    )
    return
  }

  // 2. Pull the application + issuance dates for new-construction permits since
  //    SINCE via the SQL endpoint (one round-trip, server-side filtered).
  const sql =
    `SELECT "${appliedField}" AS applied, "${ISSUED_DATE_FIELD}" AS issued ` +
    `FROM "${RESOURCE_ID}" ` +
    `WHERE worktype = '${NEW_CONSTRUCTION_WORKTYPE}' ` +
    `AND "${ISSUED_DATE_FIELD}" >= '${SINCE}' ` +
    `AND "${appliedField}" IS NOT NULL`
  const result = await ckan('datastore_search_sql', { sql })

  const days = []
  for (const row of result.records) {
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d < 365 * 5) days.push(d) // drop negatives / absurd outliers
  }

  if (days.length === 0) {
    console.warn('  No usable application/issuance pairs returned; leaving permitStats.json unchanged.')
    return
  }

  days.sort((x, y) => x - y)
  const stats = {
    medianMonths: daysToMonths(quantile(days, 0.5)),
    p80Months: daysToMonths(quantile(days, 0.8)),
    n: days.length,
    vintage: `issued ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}`,
    source: 'data.boston.gov approved-building-permits (worktype ERECT)',
  }

  // 3. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse(await readFile(OUT_PATH, 'utf8') || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, boston: { ...(existing.boston ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`  Wrote boston.newConstruction:`, stats)
}

main().catch((err) => {
  console.error(`\nboston.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
