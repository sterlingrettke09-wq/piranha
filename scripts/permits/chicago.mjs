#!/usr/bin/env node
// WO-7.1 — Chicago permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/chicago.mjs
//
// Pulls Chicago's "Building Permits" dataset from data.cityofchicago.org
// (Socrata), filters to new-construction permits, computes the median and 80th-
// percentile application -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under chicago.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Building Permits" on data.cityofchicago.org.
// Verify the schema by probing:
//   curl -s "https://data.cityofchicago.org/resource/ydr8-5enu.json?\$limit=1"
// The dataset carries application_start_date + issue_date + permit_type. Re-find
// the id from the dataset's API docs page if it ever rotates.
const RESOURCE_ID = 'ydr8-5enu'
const HOST = 'data.cityofchicago.org'

// New-construction permits are flagged by permit_type = "PERMIT - NEW
// CONSTRUCTION" (verified against the distinct permit_type histogram; ~31k
// records overall, the only ground-up class in this taxonomy).
const NEW_CONSTRUCTION_TYPE = 'PERMIT - NEW CONSTRUCTION'
const TYPE_FIELD = 'permit_type'

// Filter to permits APPLIED on/after this date (keeps the vintage recent). If
// the resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2020-01-01'

// Required date columns. If either is missing from the live schema we refuse to
// fabricate a latency figure and leave the artifact untouched (the Boston lesson).
const APPLIED_DATE_FIELD = 'application_start_date'
const ISSUED_DATE_FIELD = 'issue_date'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = "data.cityofchicago.org Building Permits (permit_type = 'PERMIT - NEW CONSTRUCTION')"

import { readFile, writeFile } from 'node:fs/promises'

async function socrata(path, params) {
  const url = new URL(`https://${HOST}/resource/${RESOURCE_ID}.${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching ${HOST}: ${err.message}. ` +
      `Check connectivity; the dataset may also be temporarily offline.`)
  }
  if (res.status === 429) {
    throw new Error(`${HOST} returned HTTP 429 (rate limited). Wait a minute and re-run, ` +
      `or set an app token via the X-App-Token header to raise the throttle.`)
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
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

// Pull applied/issued pairs for new-construction permits applied since `since`.
async function pull(since) {
  const where =
    `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPE}' ` +
    `AND ${APPLIED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  return socrata('json', {
    $select: `${APPLIED_DATE_FIELD} AS applied, ${ISSUED_DATE_FIELD} AS issued`,
    $where: where,
    $limit: '50000',
  })
}

async function main() {
  console.log(`Chicago permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await socrata('json', { $limit: '1' })
  const fieldIds = new Set(Object.keys(probe[0] ?? {}))
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the sample. Widen the window if the recent slice is thin (< 50).
  let since = SINCE
  let rows = await pull(since)
  if (rows.length < 50) {
    console.warn(`  Only ${rows.length} rows since ${SINCE}; widening to ${SINCE_WIDE}.`)
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. Compute durations, dropping negatives and absurd outliers (> 120 months).
  //    Also watch the NYC failure mode: if most rows are same-day (applied ==
  //    issued), the feed is recording an OTC artifact, not a real review time.
  const days = []
  let sameDay = 0
  for (const row of rows) {
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  // OTC artifact guard (the NYC lesson): a feed that stamps both legs at issuance
  // produces a meaningless ~0-month latency. Skip if the majority are same-day.
  const sameDayPct = (sameDay / rows.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing chicago.`,
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
    vintage: `applied ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, chicago: { ...(existing.chicago ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote chicago.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nchicago.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
