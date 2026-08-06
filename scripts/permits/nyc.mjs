#!/usr/bin/env node
// WO-7.1 — New York City permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/nyc.mjs
//
// Pulls NYC DOB permit data from data.cityofnewyork.us (Socrata), filters to
// New Building (job_type NB) permits, computes the median and 80th-percentile
// filing -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under nyc.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset choice — CORRECTED 2026-08-05 ───────────────────────────────────
// This script used the LEGACY BIS feed (ipu4-2q9a, job_type 'NB', sliced by
// ISSUANCE year) while the committed permitStats.json figure came from DOB NOW.
// The two disagreed, so **the script did not reproduce its own output** — anyone
// re-running it got a different number with no way to know which was right. A
// committed figure whose generator contradicts it is worse than an unsourced one:
// it carries the appearance of reproducibility.
//
// An audit found the BIS query was also 63.9% contaminated — job_type='NB' alone
// admits foundation/earthwork (41.2%), plumbing (19.9%) and equipment/fence
// sub-permits filed under the same job. And BIS is winding down: NB seq-01 rows
// fall from 670 (2022) to 41 (2026), too thin and unrepresentative of the current
// system.
//
// NOW USES: DOB NOW: Build – Job Application Filings (w9ak-ipjd).
//   · `filing_date` and `first_permit_date` are real calendar_date columns, so a
//     server-side `>=` comparison is correct (the BIS feed's MM/DD/YYYY TEXT
//     columns compared lexicographically — the gotcha this file used to document).
//   · `job_type = 'New Building'` excludes Alteration, Alteration-CO, No Work,
//     Full Demolition, and "ALT-CO - New Building with Existing Elements to
//     Remain" (not ground-up).
//   · `job_filing_number LIKE '%-I1'` keeps INITIAL filings only. This is the
//     load-bearing filter: of 19,319 permitted NB filings just 4,394 are -I1;
//     the other 14,029 are -S* subsequent per-work-type filings (plumbing,
//     sprinkler, structural) — the sub-permits that contaminated the old query.
//     Cross-check: all 4,394 carry general_construction_work_type_='YES', and
//     that alternative discriminator yields the identical 8.3 / 17.0.
//
// ⚠️ KNOWN LIMITATION, not fixed here. This median is conditional on eventual
// issuance: 45% of initial NB filings since 2022 have never issued, and the
// permitted share falls by cohort (1461/1960 in 2022 → 764/1764 in 2025), so
// recent cohorts are right-censored and the pooled figure sits BELOW the mature
// 2022 cohort's 10.1 months. Kaplan-Meier over all 8,039 filings gives ~15.9
// months. Correcting that is a separate pass — see docs/VERIFICATION-LEDGER.md.
//
// Verify the schema by probing:
//   curl -s "https://data.cityofnewyork.us/api/views/w9ak-ipjd.json"  (columns)
const RESOURCE_ID = 'w9ak-ipjd'
const HOST = 'data.cityofnewyork.us'

// New Building job type (verified against the distinct job_type histogram:
// NB ~571k records). DM = demolition, A1/A2/A3 = alterations, SG = sign.
const NEW_CONSTRUCTION_JOBTYPE = 'New Building'
const JOBTYPE_FIELD = 'job_type'

// Earliest FILING date in the window. A real timestamp column, so the server-side
// comparison is a true date compare (see the header — the old feed's text dates
// silently compared lexicographically).
const SINCE = '2022-01-01T00:00:00.000'

const FILING_DATE_FIELD = 'filing_date'
const ISSUANCE_DATE_FIELD = 'first_permit_date'
const FILING_NUMBER_FIELD = 'job_filing_number'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  "data.cityofnewyork.us DOB NOW: Build – Job Application Filings w9ak-ipjd " +
  "(job_type = 'New Building'; initial -I1 filings only)"

// Real ISO timestamps in this dataset — no MM/DD/YYYY parsing needed.
function parseIso(s) {
  const t = Date.parse(String(s))
  return Number.isNaN(t) ? null : t
}

import { readFile, writeFile } from 'node:fs/promises'

async function socrata(resourceId, path, params) {
  const url = new URL(`https://${HOST}/resource/${resourceId}.${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching ${HOST}: ${err.message}. ` +
      `Check connectivity; the dataset may also be temporarily offline.`)
  }
  if (res.status === 429) {
    throw new Error(`${HOST} returned HTTP 429 (rate limited). NYC's portal throttles ` +
      `aggressively for anonymous callers — wait a minute and re-run, or supply an ` +
      `app token. permitStats.json left UNCHANGED.`)
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

async function fieldNames(resourceId) {
  const url = new URL(`https://${HOST}/api/views/${resourceId}.json`)
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${HOST} metadata returned HTTP ${res.status} ${res.statusText}`)
  const meta = await res.json()
  return new Set((meta.columns ?? []).map((c) => c.fieldName))
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

async function pull() {
  // INITIAL New Building filings that reached a permit, filed since SINCE.
  // The `-I1` suffix is what excludes the -S* subsequent per-work-type filings
  // (plumbing, sprinkler, structural) that made the previous query 63.9%
  // sub-permits. Duration is measured to FIRST permit, not to any later one.
  const where =
    `${JOBTYPE_FIELD} = '${NEW_CONSTRUCTION_JOBTYPE}' ` +
    `AND ${FILING_NUMBER_FIELD} LIKE '%-I1' ` +
    `AND ${FILING_DATE_FIELD} >= '${SINCE}' ` +
    `AND ${ISSUANCE_DATE_FIELD} IS NOT NULL`
  return socrata(RESOURCE_ID, 'json', {
    $select: `${FILING_DATE_FIELD} AS filed, ${ISSUANCE_DATE_FIELD} AS issued`,
    $where: where,
    $limit: '50000',
  })
}

async function main() {
  console.log(`NYC permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm both date legs + job_type exist in the live schema. (If they ever
  //    vanish, fail loudly rather than fabricate.)
  const fields = await fieldNames(RESOURCE_ID)
  for (const f of [FILING_DATE_FIELD, ISSUANCE_DATE_FIELD, JOBTYPE_FIELD, FILING_NUMBER_FIELD]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in ${RESOURCE_ID} schema; the resource may ` +
          `have changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull. No year-widening: filing_date is a real timestamp, so one
  //    server-side `>=` gets the whole window in a single request.
  const rows = await pull()

  // 3. Durations, dropping negatives and > 120-month outliers.
  const days = []
  for (const row of rows) {
    const a = parseIso(row.filed)
    const i = parseIso(row.issued)
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  if (days.length === 0) {
    console.warn('  No usable filing/issuance pairs returned; leaving permitStats.json unchanged.')
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 4. Sanity gate.
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
    vintage:
      `filed ${SINCE.slice(0, 10)} onward; computed ${new Date().toISOString().slice(0, 10)}; ` +
      `${DATASET_NAME}`,
  }

  // 5. Idempotent merge.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, nyc: { ...(existing.nyc ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote nyc.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nnyc.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
