#!/usr/bin/env node
// WO-7.3 — Boston relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/boston.mjs
//
// Pulls Boston's "Zoning Board of Appeal Tracker" dataset from data.boston.gov
// (CKAN), filters to decided appeals since 2022, computes the grant rate
// (granted ÷ decided, excluding withdrawn/deferred), and MERGES the result into
// netlify/functions/lib/data/reliefStats.json under boston.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// CKAN datastore resource id for the "Zoning Board of Appeal Tracker" CSV.
// How to re-find it if it changes (CKAN resource ids rotate on re-upload):
//   curl -s "https://data.boston.gov/api/3/action/package_search?q=zoning+board+appeal" \
//     | python3 -c "import json,sys;[print(r['id'],r['name']) for p in json.load(sys.stdin)['result']['results'] for r in p['resources'] if r.get('datastore_active')]"
// and take the resource on the "Zoning Board of Appeal Tracker" package.
const RESOURCE_ID = '0f0fa8c2-87ba-45d6-a876-0d177dd02512'
const BASE = 'https://data.boston.gov/api/3/action'

// Outcome buckets. Verified against the live distinct-`decision` histogram for
// rows decided since 2022 (decision IN these, final_decision_date >= 2022):
//   GRANTED:  'AppProv' (approved with provisos) + 'Approved'
//   DENIED:   'DeniedPrej' (denied with prejudice) + 'Denied'
// Everything else — 'Withdrawn'/'Withdraw', ' ', NULL — is NOT a board ruling on
// the merits and is EXCLUDED from the denominator (the spec's
// "excluding withdrawn/deferred" rule). The grant rate is granted ÷ decided.
const GRANTED = ['AppProv', 'Approved']
const DENIED = ['DeniedPrej', 'Denied']

// Only appeals with a final decision on/after this date count (keeps the vintage
// recent and the window honest). The published line reads "(2022–<current>)".
const SINCE = '2022-01-01'

// Required columns. The grant rate is meaningless without an unambiguous outcome
// field AND a decision date; if either is missing from the live schema we refuse
// to fabricate a figure and leave the artifact untouched (the Boston permit lesson).
const DECISION_FIELD = 'decision'
const DECISION_DATE_FIELD = 'final_decision_date'

// Gate: a grant rate computed off fewer than this many decided appeals isn't a
// trustworthy base rate.
const MIN_N = 100

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME = 'data.boston.gov Zoning Board of Appeal Tracker (decision field)'

import { readFile, writeFile } from 'node:fs/promises'
import { feedCounts, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

async function ckan(action, params) {
  const url = new URL(`${BASE}/${action}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching data.boston.gov (${action}): ${err.message}. ` +
        `Check connectivity; the dataset may also be temporarily offline.`,
    )
  }
  if (!res.ok) throw new Error(`data.boston.gov ${action} returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (!body.success) throw new Error(`CKAN ${action} reported failure: ${JSON.stringify(body.error ?? body)}`)
  return body.result
}

async function main() {
  console.log(`Boston relief pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await ckan('datastore_search', { resource_id: RESOURCE_ID, limit: '1' })
  const fieldIds = new Set(probe.fields.map((f) => f.id))
  for (const f of [DECISION_FIELD, DECISION_DATE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a grant rate; reliefStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged before anything is computed. CKAN's
  //     datastore_search already reports the resource's total on the schema probe
  //     above, so this costs no extra request and comes back through the
  //     pipeline's own client (rule 11).
  const totals = [
    await probeFeedTotal(`data.boston.gov datastore ${RESOURCE_ID}`, async () => probe.total),
  ]
  logFeedTotals(totals)

  // 2. Pull the outcome histogram for decided appeals since SINCE (server-side
  //    grouped — one round-trip, no row download).
  const ruledOn = [...GRANTED, ...DENIED].map((d) => `'${d.replace(/'/g, "''")}'`).join(',')
  const sql =
    `SELECT "${DECISION_FIELD}" AS decision, count(*) AS c ` +
    `FROM "${RESOURCE_ID}" ` +
    `WHERE "${DECISION_FIELD}" IN (${ruledOn}) ` +
    `AND "${DECISION_DATE_FIELD}" >= '${SINCE}' ` +
    `GROUP BY "${DECISION_FIELD}"`
  const result = await ckan('datastore_search_sql', { sql })

  let granted = 0
  let denied = 0
  for (const row of result.records) {
    const c = Number(row.c)
    if (Number.isNaN(c)) continue
    if (GRANTED.includes(row.decision)) granted += c
    else if (DENIED.includes(row.decision)) denied += c
  }
  const decided = granted + denied

  // 3. Sanity gates. An ambiguous histogram (nothing matched) or a thin sample
  //    is not trustworthy — print why and leave the artifact untouched.
  if (decided === 0) {
    console.warn('  No decided appeals matched the outcome buckets; leaving reliefStats.json unchanged.')
    return
  }
  if (decided < MIN_N) {
    console.warn(
      `  Only ${decided} decided appeals since ${SINCE} (need ≥ ${MIN_N}); ` +
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
      `decided ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ` +
      `${DATASET_NAME}; granted (${GRANTED.join('/')}) ÷ decided, ` +
      `excludes withdrawn/deferred; ${granted} granted, ${denied} denied`,
  }

  // 4. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    boston: {
      ...(existing.boston ?? {}),
      variance: stats,
      feed: feedCounts({
        totals,
        cohortRows: decided,
        basis:
          `totalRows: every row CKAN resource ${RESOURCE_ID} holds, unfiltered. cohortRows: ` +
          `appeals with ${DECISION_DATE_FIELD} >= ${SINCE} whose ${DECISION_FIELD} is on the ` +
          `granted/denied list. NOTE the degenerate case: this script asks the server for an ` +
          `outcome histogram, so its cohort selection already filters on the decision value ` +
          `and cohortRows EQUALS the published n. Elsewhere the two differ; here they cannot, ` +
          `and reading this pair as evidence of a clean cohort would be reading the query.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote boston.variance:', stats)
}

main().catch((err) => {
  console.error(`\nboston.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
