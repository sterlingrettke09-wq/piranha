#!/usr/bin/env node
// WO-7.3 — San Francisco relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/sf.mjs
//
// Pulls SF's "Planning Department Records - Non-Projects" dataset from
// data.sfgov.org (Socrata, the PPTS records feed), filters to VARIANCE records
// (record_type = 'VAR') CLOSED since 2022, computes the grant rate
// (granted ÷ decided, excluding withdrawn/cancelled/informational), and MERGES
// the result into netlify/functions/lib/data/reliefStats.json under sf.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE DEFECT THIS SCRIPT WAS REBUILT TO FIX (measured 2026-08-09) ──────────
// This script used to frame the cohort on `open_date` — records FILED since
// 2022 — and then score only the members that had reached a decision. That is a
// filing cohort counted by its survivors, and it published a censored rate as if
// it were a complete one.
//
// Measured on the live feed, VAR records with open_date >= 2022-01-01:
//   · 300 decided (293 'Closed - Approved' + 7 'Closed - Disapproved')
//   ·  83 still undecided ('Under Review' 26, 'Pending Review' 17, 'Submitted'
//     15, 'Accepted' 11, 'On Hold' 9, 'Open' 3, 'Action Pending' 2)
//   · 383 total → 21.7% of the cohort had no outcome and was silently ABSENT
//     from the published denominator.
// The true rate for that cohort is therefore only bounded, [76.5%, 98.2%]
// (293/383 if every pending case is denied … 376/383 if every one is granted),
// and the figure this script published — 97.6% — sat at the very top of its own
// bound. A number that can only be wrong in one direction is not a measurement.
//
// ── THE FIX: frame on the CLOSURE date, not the filing date ─────────────────
// Boston's pipeline is clean because it frames on `final_decision_date`: a
// cohort of "appeals DECIDED in the window" cannot contain a pending member,
// because a pending appeal has no decision date. Pending cases are excluded by
// CONSTRUCTION rather than by censoring. This script now does the same thing.
//
// ⚠️ SF HAS NO EXPLICIT DECISION-DATE FIELD, AND THIS IS NOT ONE. The previous
// version of this file asserted in a comment that SF "publishes `open_date`
// (application date), not a separate decision date". That was a reader failing
// to find a field, not the field's absence (rule 8): the dataset has SEVENTEEN
// columns and TWO of them are dates — `open_date` AND `close_date`. What
// `close_date` is, in the publisher's own words, is *"Date the record was
// closed."* — a record-closure stamp, NOT a hearing/decision date like Boston's.
// It is used here for cohort MEMBERSHIP only, never as a duration endpoint, and
// the vintage string says "closed", not "decided". Do not restate it as a
// decision date.
//
// What makes it sound for membership is a measured property, not the name:
// `close_date` is populated on 100% of terminal records (7,534 of 7,536 decided
// VAR all-time; the 2 exceptions opened in 2015 and 2017, far outside any 2022+
// window) and on 0% of every in-progress status — 'Under Review' 0/33, 'On
// Hold' 0/18, 'Pending Review' 0/18, 'Submitted' 0/15, 'Open' 0/3, 'Action
// Pending' 0/2. So "closed in the window" is exactly "resolved", and the
// censored population is empty rather than small. refuseUnlessCohortIsResolved()
// below re-measures that on every run instead of trusting this paragraph.
//
// Cross-checks run before this was adopted (2026-08-09):
//   · Per-year grant rate on the closure frame is stable — 2022 95.7% (n=92),
//     2023 99.1% (n=109), 2024 98.1% (n=105), 2025 95.6% (n=68), 2026 96.9%
//     (n=32). No year drives the aggregate.
//   · Window-start sensitivity is mild: since-2021 95.49% (n=488), since-2022
//     97.29% (n=406), since-2023 97.77% (n=314), since-2024 97.07% (n=205).
//   · Closure LAG does not differ between outcomes, which is the check that
//     matters — a frame built on closure would be biased if grants closed on a
//     different clock from denials. Approved: p25 181d, p50 269d, p75 409d
//     (n=395). Disapproved: p25 204d, p50 274d, p75 392d (n=11). Near-identical.
//   · The closure-frame result, 97.29%, falls inside the [76.5%, 98.2%] bound
//     the old filing frame could support — two independent framings agree.
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 for "Planning Department Records - Non-Projects" on data.sfgov.org.
// SF Planning logs variance applications here (record_type 'VAR'), with the
// board's disposition in record_status. Verify the schema by probing:
//   curl -s "https://data.sfgov.org/resource/y673-d69b.json?\$limit=1"
// ⚠️ A single row is NOT the schema — Socrata omits null fields per row, which
// is how `close_date` went unnoticed. Read the column list instead:
//   curl -s "https://data.sfgov.org/api/views/y673-d69b.json" | jq '.columns[].fieldName'
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
const GRANTED = ['Closed - Approved', 'Approved']
const DENIED = ['Closed - Disapproved']

// Every record_status known to be TERMINAL — the record has stopped moving,
// whether or not the stop was a ruling on the merits. This list is the gate's
// vocabulary and it FAILS CLOSED: any status appearing in the window that is not
// listed here halts the run rather than being silently ignored, because an
// unrecognised value is exactly how an in-progress record would sneak into a
// cohort that is supposed to be fully resolved.
//
// Terminal but NOT a ruling on the merits — 'Closed - Withdrawn'/'Withdrawn',
// 'Closed - Cancelled'/'Cancelled', bare 'Closed', 'Closed - Informational',
// 'Closed - Issued' — are EXCLUDED from the denominator, the same treatment
// boston.mjs gives its withdrawn/deferred rows. Grant rate = granted ÷ decided.
const TERMINAL = [
  ...GRANTED,
  ...DENIED,
  'Closed',
  'Closed - Withdrawn',
  'Closed - Cancelled',
  'Closed - Informational',
  'Closed - Issued',
  'Withdrawn',
  'Cancelled',
]

// Only records CLOSED on/after this date count. Framing is on closure, not
// filing — see the header. The published line reads "(2022–<current>)".
const SINCE = '2022-01-01'

// Required columns. The grant rate is meaningless without an unambiguous outcome
// field and a closure date; if either is missing from the live schema we refuse
// to fabricate a figure and leave the artifact untouched (the Boston lesson).
const STATUS_FIELD = 'record_status'
const TYPE_FIELD = 'record_type'
const CLOSE_DATE_FIELD = 'close_date'
const OPEN_DATE_FIELD = 'open_date'

// Gate: a grant rate computed off fewer than this many decided records isn't a
// trustworthy base rate.
const MIN_N = 100

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME = 'data.sfgov.org Planning Department Records - Non-Projects (record_type VAR)'

import { readFile, writeFile } from 'node:fs/promises'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

/** Refusal that means "the data cannot support this figure", as distinct from a
 *  transport or schema failure. Mirrors the ComputabilityHalt in scripts/permits. */
class CensoringHalt extends Error {
  constructor(message) {
    super(message)
    this.name = 'CensoringHalt'
  }
}

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

const quote = (s) => `'${s.replace(/'/g, "''")}'`
const inList = (xs) => xs.map(quote).join(',')

// Every row the resource holds, UNFILTERED — the grew-vs-shrank number. Goes
// through this script's own Socrata client so the count travels the same
// transport and error handling as the rows (rule 11). Best-effort: a failed
// count is recorded as an unknown and never aborts the run.
async function feedTotal() {
  return probeFeedTotal(`${HOST}/resource/${RESOURCE_ID}`, async () => {
    const rows = await socrata({ $select: 'count(1) AS n' })
    return rows[0]?.n
  })
}

// ── THE GATE ────────────────────────────────────────────────────────────────
// Refuse unless the closure-framed cohort is genuinely free of censoring. This
// tests the MEASURED CONDITION the framing depends on, not a flag and not a
// comment: every record in the window must carry a terminal status.
//
// The threshold is ZERO, and that is not an invented margin — it is the whole
// claim. If a single in-progress record can sit inside a "closed since 2022"
// cohort, then `close_date` is not the resolution stamp this script takes it to
// be, the outcome filter starts dropping live cases from the denominator, and we
// are back to publishing a survivor rate. Measured 2026-08-09 the count is 0 of
// 628 in-window rows. Should SF ever begin stamping close_date at intake, this
// fires on the next quarterly run instead of quietly re-censoring the figure.
function refuseUnlessCohortIsResolved(unresolved) {
  if (unresolved.length === 0) return
  const total = unresolved.reduce((a, r) => a + Number(r.c), 0)
  throw new CensoringHalt(
    `${total} record(s) closed since ${SINCE} carry a status this script does not\n` +
      `  recognise as terminal:\n` +
      unresolved.map((r) => `    · ${r.s} — ${r.c}`).join('\n') +
      `\n\n  The closure frame is only census-complete while "${CLOSE_DATE_FIELD} in window"\n` +
      `  means "resolved". These rows break that: they would be dropped by the\n` +
      `  granted/denied filter while still belonging to the cohort, which is the\n` +
      `  exact right-censoring this script was rebuilt to remove — a filing cohort\n` +
      `  scored over its survivors, published at the top of its own bound.\n\n` +
      `  If the status above is genuinely terminal (a new disposition code), add it\n` +
      `  to TERMINAL and decide explicitly whether it is a ruling on the merits. If\n` +
      `  it is an in-progress state, SF has changed when close_date is stamped and\n` +
      `  this framing no longer holds — do NOT paper over it with a caveat string.\n` +
      `  reliefStats.json left UNCHANGED.`,
  )
}

async function main() {
  console.log(`SF relief pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the SCHEMA — the column list, not one row. A single row omits its
  //    null fields, which is how close_date stayed invisible for a whole cycle.
  const meta = await (async () => {
    const res = await fetch(`https://${HOST}/api/views/${RESOURCE_ID}.json`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`${HOST} metadata returned HTTP ${res.status} ${res.statusText}`)
    return res.json()
  })()
  const fieldIds = new Set((meta.columns ?? []).map((c) => c.fieldName))
  for (const f of [STATUS_FIELD, TYPE_FIELD, CLOSE_DATE_FIELD, OPEN_DATE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a grant rate; reliefStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged BEFORE the censoring halt below, so a refusing
  //     run still records what the feed held on the day it refused.
  const totals = [await feedTotal()]
  logFeedTotals(totals)

  const inWindow =
    `${TYPE_FIELD} = ${quote(VARIANCE_TYPE)} ` +
    `AND ${CLOSE_DATE_FIELD} >= '${SINCE}T00:00:00.000'`

  // 2. THE GATE INPUT. Pull the full status roster for the window — not just the
  //    statuses we intend to score. A query that selects on the outcome cannot
  //    measure how often the outcome is missing (rule 11), and that is precisely
  //    how the censored version of this script could not see its own defect.
  const roster = await socrata({
    $select: `${STATUS_FIELD} AS s, count(*) AS c`,
    $where: inWindow,
    $group: STATUS_FIELD,
    $order: 'c DESC',
    $limit: '200',
  })
  const cohortN = roster.reduce((a, r) => a + Number(r.c), 0)
  logCohortRows(cohortN, `${TYPE_FIELD}=${VARIANCE_TYPE}, ${CLOSE_DATE_FIELD} >= ${SINCE}, every status`)
  refuseUnlessCohortIsResolved(roster.filter((r) => !TERMINAL.includes(r.s)))

  // 3. Score the resolved cohort.
  let granted = 0
  let denied = 0
  let notOnMerits = 0
  for (const row of roster) {
    const c = Number(row.c)
    if (Number.isNaN(c)) continue
    if (GRANTED.includes(row.s)) granted += c
    else if (DENIED.includes(row.s)) denied += c
    else notOnMerits += c
  }
  const decided = granted + denied

  // 4. Sanity gates. An ambiguous histogram (nothing matched) or a thin sample
  //    is not trustworthy — print why and leave the artifact untouched.
  if (decided === 0) {
    console.warn('  No decided variance records matched the outcome buckets; leaving reliefStats.json unchanged.')
    return
  }
  if (decided < MIN_N) {
    console.warn(
      `  Only ${decided} decided variance records closed since ${SINCE} (need ≥ ${MIN_N}); ` +
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
      `closed ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ` +
      `${DATASET_NAME}; framed on close_date ("Date the record was closed" — a ` +
      `record-closure stamp, not a decision date; SF publishes none), so pending ` +
      `cases are excluded by construction rather than censored; granted ` +
      `(${GRANTED.join('/')}) ÷ decided, excludes withdrawn/cancelled/informational; ` +
      `${granted} granted, ${denied} denied`,
  }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    sf: {
      ...(existing.sf ?? {}),
      variance: stats,
      feed: feedCounts({
        totals,
        cohortRows: cohortN,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. cohortRows: ` +
          `${TYPE_FIELD}=${VARIANCE_TYPE} AND ${CLOSE_DATE_FIELD} >= ${SINCE}, across EVERY ` +
          `status — not just the ones scored, because a roster that selects on the outcome ` +
          `cannot measure how often the outcome is missing. The published n is smaller: it is ` +
          `the ${decided} records whose status is a ruling on the merits, excluding ` +
          `${notOnMerits} withdrawn/cancelled/informational.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(
    `  Cohort closed since ${SINCE}: ${cohortN} records, all terminal ` +
      `(${decided} decided on the merits, ${notOnMerits} withdrawn/cancelled/other).`,
  )
  console.log('  Wrote sf.variance:', stats)
}

main().catch((err) => {
  if (err instanceof CensoringHalt) {
    console.error(`\nsf.mjs REFUSED TO WRITE — the cohort is not census-complete:\n\n  ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\nsf.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
