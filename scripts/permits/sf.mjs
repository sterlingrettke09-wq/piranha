#!/usr/bin/env node
// WO-7.1 — San Francisco permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/sf.mjs
//
// Pulls San Francisco's "Building Permits" dataset from data.sfgov.org (Socrata),
// filters to new-construction permit types, computes the median and 80th-
// percentile filing -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under sf.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Building Permits" on data.sfgov.org.
// Verify the schema by probing:
//   curl -s "https://data.sfgov.org/resource/i98e-djp9.json?\$limit=1"
// The dataset carries filed_date + issued_date + permit_type + the human-readable
// permit_type_definition. Re-find the id from the dataset's API docs page if it
// ever rotates.
const RESOURCE_ID = 'i98e-djp9'
const HOST = 'data.sfgov.org'

// New-construction permit types in this dataset (verified against the distinct
// permit_type / permit_type_definition histogram):
//   1 = "new construction"            (~2.5k records)
//   2 = "new construction wood frame" (~13k records)
const NEW_CONSTRUCTION_TYPES = ['1', '2']

// Filter to permits FILED on/after this date (keeps the vintage recent). If the
// resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2018-01-01'

// Required date columns. If either is missing from the live schema we refuse to
// fabricate a latency figure and leave the artifact untouched (the Boston lesson).
const FILED_DATE_FIELD = 'filed_date'
const ISSUED_DATE_FIELD = 'issued_date'
const TYPE_FIELD = 'permit_type'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = 'data.sfgov.org Building Permits (permit_type 1,2 = new construction)'

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

// Pull filed/issued pairs for new-construction permits filed since `since`.
async function pull(since) {
  const typeList = NEW_CONSTRUCTION_TYPES.map((t) => `'${t}'`).join(',')
  const where =
    `${TYPE_FIELD} IN (${typeList}) ` +
    `AND ${FILED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${FILED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = await socrata('json', {
    $select: `${FILED_DATE_FIELD} AS filed, ${ISSUED_DATE_FIELD} AS issued`,
    $where: where,
    $limit: '50000',
  })
  return rows
}

async function main() {
  console.log(`SF permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await socrata('json', { $limit: '1' })
  const fieldIds = new Set(Object.keys(probe[0] ?? {}))
  for (const f of [FILED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD]) {
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
  const days = []
  for (const row of rows) {
    const a = Date.parse(row.filed)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  if (days.length === 0) {
    console.warn('  No usable filed/issued pairs returned; leaving permitStats.json unchanged.')
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
    vintage: `filed ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, sf: { ...(existing.sf ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote sf.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nsf.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
