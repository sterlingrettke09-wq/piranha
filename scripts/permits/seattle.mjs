#!/usr/bin/env node
// WO-7.1 — Seattle permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/seattle.mjs
//
// Pulls Seattle's "Building Permits" dataset from data.seattle.gov (Socrata),
// filters to new-construction permits, computes the median and 80th-percentile
// applied -> issued time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under seattle.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Building Permits" on data.seattle.gov.
// Verify the schema by probing:
//   curl -s "https://data.seattle.gov/resource/76t5-zqzr.json?\$limit=1"
//   curl -s "https://data.seattle.gov/api/views/76t5-zqzr.json"  (full column list)
// The dataset carries applieddate + issueddate + permittypedesc + permitclassmapped.
// Note: Socrata omits null fields from row JSON, so applieddate/issueddate won't
// appear in every probe row — confirm via the /api/views column list instead.
const RESOURCE_ID = '76t5-zqzr'
const HOST = 'data.seattle.gov'

// New-construction permits in this dataset are flagged by permittypedesc = "New"
// (verified against the distinct permittypedesc histogram; "New" is SDCI's
// ground-up construction class).
const NEW_CONSTRUCTION_TYPEDESC = 'New'
const TYPE_FIELD = 'permittypedesc'

// Filter to permits APPLIED on/after this date. Widen if the recent slice is thin.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2018-01-01'

const APPLIED_DATE_FIELD = 'applieddate'
const ISSUED_DATE_FIELD = 'issueddate'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = 'data.seattle.gov Building Permits (permittypedesc = New)'

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
    throw new Error(`${HOST} returned HTTP 429 (rate limited). Wait a minute and re-run.`)
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

// The schema lives behind the /api/views metadata endpoint (row JSON drops nulls,
// so probing a single row can't prove a date column exists or is absent).
async function fieldNames() {
  const url = new URL(`https://${HOST}/api/views/${RESOURCE_ID}.json`)
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

async function pull(since) {
  const where =
    `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPEDESC}' ` +
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
  console.log(`Seattle permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm the date + type columns exist in the live schema.
  const fields = await fieldNames()
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the sample; widen the window if the recent slice is thin.
  let since = SINCE
  let rows = await pull(since)
  if (rows.length < 50) {
    console.warn(`  Only ${rows.length} rows since ${SINCE}; widening to ${SINCE_WIDE}.`)
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. Durations, dropping negatives and > 120-month outliers.
  const days = []
  for (const row of rows) {
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
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
    vintage: `applied ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  // 5. Idempotent merge.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, seattle: { ...(existing.seattle ?? {}), newConstruction: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote seattle.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nseattle.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
