#!/usr/bin/env node
// WO-7.3 — San Francisco relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/sf.mjs
//
// Pulls SF's "Planning Department Records - Non-Projects" dataset from
// data.sfgov.org (Socrata, the PPTS records feed), filters to VARIANCE records
// (record_type = 'VAR') decided since 2022, computes the grant rate
// (granted ÷ decided, excluding withdrawn/cancelled/in-progress), and MERGES the
// result into netlify/functions/lib/data/reliefStats.json under sf.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 for "Planning Department Records - Non-Projects" on data.sfgov.org.
// SF Planning logs variance applications here (record_type 'VAR'), with the
// board's disposition in record_status. Verify the schema by probing:
//   curl -s "https://data.sfgov.org/resource/y673-d69b.json?\$limit=1"
// (The Socrata SoQL 2.1 `$query` endpoint now requires auth; the classic
// `$select`/`$where`/`$group` params still work anonymously — we use those.)
const RESOURCE_ID = 'y673-d69b'
const HOST = 'data.sfgov.org'

// SF Planning's variance record type (verified: upper(record_type) LIKE '%VAR%'
// resolves to the single code 'VAR', ~9.2k records all-time).
const VARIANCE_TYPE = 'VAR'

// Outcome buckets. Verified against the live distinct-`record_status` histogram
// for record_type 'VAR':
//   GRANTED:  'Closed - Approved' + 'Approved'
//   DENIED:   'Closed - Disapproved'
// Everything else — 'Closed - Withdrawn'/'Withdrawn', 'Closed - Cancelled'/
// 'Cancelled', bare 'Closed', 'Closed - Informational', and the in-progress
// statuses ('Under Review', 'Submitted', 'On Hold', …) — is NOT a board ruling
// on the merits and is EXCLUDED from the denominator. Grant rate = granted ÷ decided.
const GRANTED = ['Closed - Approved', 'Approved']
const DENIED = ['Closed - Disapproved']

// Only records opened on/after this date count (keeps the vintage recent). SF
// publishes `open_date` (application date), not a separate decision date, so the
// window is framed on filing — documented in the vintage string.
const SINCE = '2022-01-01'

// Required columns. The grant rate is meaningless without an unambiguous outcome
// field, a type field, and a date; if any is missing from the live schema we
// refuse to fabricate a figure and leave the artifact untouched (the Boston lesson).
const STATUS_FIELD = 'record_status'
const TYPE_FIELD = 'record_type'
const DATE_FIELD = 'open_date'

// Gate: a grant rate computed off fewer than this many decided records isn't a
// trustworthy base rate.
const MIN_N = 100

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME = 'data.sfgov.org Planning Department Records - Non-Projects (record_type VAR)'

import { readFile, writeFile } from 'node:fs/promises'

async function socrata(params) {
  const url = new URL(`https://${HOST}/resource/${RESOURCE_ID}.json`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching ${HOST}: ${err.message}. ` +
        `Check connectivity; the dataset may also be temporarily offline.`,
    )
  }
  if (res.status === 429) {
    throw new Error(
      `${HOST} returned HTTP 429 (rate limited). Wait a minute and re-run, ` +
        `or set an app token via the X-App-Token header to raise the throttle.`,
    )
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

async function main() {
  console.log(`SF relief pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await socrata({ $limit: '1' })
  const fieldIds = new Set(Object.keys(probe[0] ?? {}))
  for (const f of [STATUS_FIELD, TYPE_FIELD, DATE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a grant rate; reliefStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the outcome histogram for decided variance records since SINCE
  //    (server-side grouped — one round-trip, no row download).
  const ruledOn = [...GRANTED, ...DENIED].map((s) => `'${s.replace(/'/g, "''")}'`).join(',')
  const where =
    `${TYPE_FIELD} = '${VARIANCE_TYPE}' ` +
    `AND ${STATUS_FIELD} IN (${ruledOn}) ` +
    `AND ${DATE_FIELD} >= '${SINCE}T00:00:00.000'`
  const rows = await socrata({
    $select: `${STATUS_FIELD} AS status, count(*) AS c`,
    $where: where,
    $group: STATUS_FIELD,
    $limit: '100',
  })

  let granted = 0
  let denied = 0
  for (const row of rows) {
    const c = Number(row.c)
    if (Number.isNaN(c)) continue
    if (GRANTED.includes(row.status)) granted += c
    else if (DENIED.includes(row.status)) denied += c
  }
  const decided = granted + denied

  // 3. Sanity gates. An ambiguous histogram (nothing matched) or a thin sample
  //    is not trustworthy — print why and leave the artifact untouched.
  if (decided === 0) {
    console.warn('  No decided variance records matched the outcome buckets; leaving reliefStats.json unchanged.')
    return
  }
  if (decided < MIN_N) {
    console.warn(
      `  Only ${decided} decided variance records since ${SINCE} (need ≥ ${MIN_N}); ` +
        `not writing. The base rate isn't trustworthy at this sample size.`,
    )
    return
  }

  const grantRate = Math.round((granted / decided) * 1000) / 1000
  const currentYear = new Date().getFullYear()
  const stats = {
    grantRate,
    n: decided,
    window: `2022–${currentYear}`,
    vintage:
      `opened ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ` +
      `${DATASET_NAME}; granted (${GRANTED.join('/')}) ÷ decided, ` +
      `excludes withdrawn/cancelled/in-progress; ${granted} granted, ${denied} denied`,
  }

  // 4. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, sf: { ...(existing.sf ?? {}), variance: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote sf.variance:', stats)
}

main().catch((err) => {
  console.error(`\nsf.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
