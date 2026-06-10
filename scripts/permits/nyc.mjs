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
// ── Dataset choice (the honest part) ─────────────────────────────────────────
// NYC publishes two relevant DOB permit datasets:
//
//   * DOB Permit Issuance (ipu4-2q9a) — has BOTH filing_date AND issuance_date,
//     plus job_type (NB = New Building). This is the legacy BIS feed.
//   * DOB NOW: Build – Approved Permits (rbx6-tga4) — current, but only carries
//     approved_date + issued_date. It has NO filing/applied date, so a true
//     filing -> issuance latency CANNOT be computed from it without fabricating
//     the filing leg (an approved date is not when the job was filed).
//
// Per the WO ("pick whichever exposes BOTH a filing/applied date and an issuance
// date for New Building"), we use ipu4-2q9a — it is the only one of the two that
// exposes both legs of the duration we measure.
//
// TWO SCHEMA GOTCHAS verified the hard way against the live data:
//
//  1. filing_date / issuance_date are TEXT columns in MM/DD/YYYY format, NOT
//     Socrata floating timestamps. A naive `filing_date >= '2022-01-01'` does a
//     LEXICOGRAPHIC compare and silently returns the wrong rows. So we filter the
//     recent slice server-side with `issuance_date LIKE '%/YYYY'` on the wanted
//     years and parse MM/DD/YYYY ourselves.
//  2. permit_sequence__ is zero-padded ('01', '02', ...). '1' matches NOTHING.
//     We keep '01' = the ORIGINAL permit so the span reflects the first time the
//     job was permitted (not a renewal/reissue).
//
// The BIS feed is winding down (DOB migrated to DOB NOW), but still carries real
// recent NB records: ~1.9k issued in 2022, ~0.7k in 2023, ~0.4k in 2024. That is
// plenty for a stable median, and the vintage stamps exactly which years are in.
//
// Verify the schema by probing:
//   curl -s "https://data.cityofnewyork.us/api/views/ipu4-2q9a.json"  (columns)
//   curl -s "https://data.cityofnewyork.us/resource/ipu4-2q9a.json?\$limit=1"
const RESOURCE_ID = 'ipu4-2q9a'
const HOST = 'data.cityofnewyork.us'

// New Building job type (verified against the distinct job_type histogram:
// NB ~571k records). DM = demolition, A1/A2/A3 = alterations, SG = sign.
const NEW_CONSTRUCTION_JOBTYPE = 'NB'
const JOBTYPE_FIELD = 'job_type'

// Original-permit sequence (zero-padded in this dataset).
const ORIGINAL_SEQUENCE = '01'

// Issuance years that make up the recent slice. Widened automatically (older
// years prepended) if the recent slice is thin.
const RECENT_YEARS = [2025, 2024, 2023, 2022]
const WIDE_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]

const FILING_DATE_FIELD = 'filing_date'
const ISSUANCE_DATE_FIELD = 'issuance_date'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = 'data.cityofnewyork.us DOB Permit Issuance ipu4-2q9a (job_type NB; legacy BIS feed, MM/DD/YYYY dates)'

// Parse a MM/DD/YYYY text date to epoch ms; null if it doesn't match.
function parseMdy(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s).trim())
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const t = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))
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

async function pull(years) {
  // Server-side: original NB permits whose (text) issuance_date ends in one of the
  // wanted years. We do the actual span math client-side after parsing MM/DD/YYYY.
  const yearClause = years.map((y) => `${ISSUANCE_DATE_FIELD} LIKE '%/${y}'`).join(' OR ')
  const where =
    `${JOBTYPE_FIELD} = '${NEW_CONSTRUCTION_JOBTYPE}' ` +
    `AND permit_sequence__ = '${ORIGINAL_SEQUENCE}' ` +
    `AND ${FILING_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUANCE_DATE_FIELD} IS NOT NULL ` +
    `AND (${yearClause})`
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
  for (const f of [FILING_DATE_FIELD, ISSUANCE_DATE_FIELD, JOBTYPE_FIELD]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in ${RESOURCE_ID} schema; the resource may ` +
          `have changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull; widen the year window if the recent slice is thin.
  let years = RECENT_YEARS
  let rows = await pull(years)
  if (rows.length < 50) {
    console.warn(`  Only ${rows.length} NB rows issued in ${RECENT_YEARS.join('/')}; widening.`)
    years = WIDE_YEARS
    rows = await pull(years)
  }

  // 3. Durations from the MM/DD/YYYY text dates, dropping negatives and
  //    > 120-month outliers. (Same-day OTC permits → a legitimate 0-day span.)
  const days = []
  for (const row of rows) {
    const a = parseMdy(row.filed)
    const i = parseMdy(row.issued)
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
    vintage: `issued in ${years.slice().sort().join('/')}; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
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
