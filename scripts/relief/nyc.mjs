#!/usr/bin/env node
// WO-7.3 — NYC relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/nyc.mjs
//
// Pulls the NYC Board of Standards & Appeals "Applications Status" dataset from
// data.cityofnewyork.us (Socrata yvxd-uipr), filters to the BZ calendar (zoning
// relief: variances and special permits) ACTED ON since 2022, computes the grant
// rate (granted ÷ decided, excluding withdrawn/dismissed), and MERGES the result
// into netlify/functions/lib/data/reliefStats.json under nyc.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── FRAME ON THE ACTION DATE (`date`), NEVER THE FILING DATE (`filed`) ──────
// This feed has NO pending status value at all. The all-time `status` vocabulary
// is Granted / Withdrawn / Denied / Dismissed / Decision (plus one stray
// 'Approved' outside BZ) — pending cases are not null rows, they are ABSENT
// rows. A filing-framed denominator therefore cannot be audited: you cannot
// count what is not there. The tell, measured 2026-08-10: of 36 BZ cases filed
// in 2025, 31 already show Granted — implausible for a board with a 12–24-month
// cycle, i.e. recent filing cohorts are incomplete in a way that is invisible.
// Framing on the action date (Boston's structure) makes the cohort "cases the
// board acted on in the window", which a pending case cannot enter.
//
// ── THE TRACK DECISION, STATED HONESTLY ─────────────────────────────────────
// The `application` column mixes unrelated bodies of law: SOC is construction-
// extension rubber-stamps (335 granted / 1 denied all-time — including it would
// launder a formality into a relief rate), Appeal is a separate administrative
// track, BZY/LNO/Compliance are tiny others. This script publishes the BZ
// calendar WHOLE — and labels it as what it is.
//
//   · Strict §72-21 variances alone: 91 granted / 2 denied in-window, n=93 —
//     FAILS the MIN_N=100 gate.
//   · Widening the filter to compound cites ('72-21 & 73-19', '& 73-134',
//     '& 79-19') and the literal 'Variance' label reaches n=102 — a pass by
//     two, decided by which strings a regex admits. A gate cleared by a
//     string-matching choice is not cleared (the Philadelphia parseMaxFAR
//     lesson: a well-argued filter is still an interpretation).
//   · The BZ whole track: n=210 in the coded window — clears the gate with no
//     filter judgment at all, and is published under the label
//     "variance and special-permit applications", which is what BZ is.
// Measured composition of the 210 decided (2026-08-10): 91 strict §72-21 +
// 5 compound §72-21 cites + 4 labelled 'Variance'; ~95 §73-xx special permits
// (73-622 34, 73-311 15, 73-66 7, …); 12 §11-41 reinstatements/amendments of
// previously approved variances; 1 labelled 'Special Permit'. Nothing else.
//
// ── THE 'Decision' STATUS IS TRANSIENT, AND THE WINDOW END IS MEASURED ──────
// A handful of rows carry status 'Decision' — an action recorded before its
// outcome is coded. Measured 2026-08-10: all 6 such rows table-wide sit on the
// two most recent BSA sessions (2026-07-13 / 2026-07-27) and the value never
// appears historically (BZ all-time: Granted 3,433 / Withdrawn 538 / Dismissed
// 118 / Denied 88 / Decision 5). Scoring a partially-coded session would drop
// its uncoded rows from the denominator — right-censoring by another name. So
// the window END is measured on every run: min(`date`) over in-window 'Decision'
// rows, and the scored cohort stops just before it. Every row inside is then
// fully coded, verified by refuseUnlessWindowIsCoded() below, which fails
// closed: ANY status outside the recognised vocabulary halts the run.
//
// Dismissed (10 in-window) is a procedural termination, not a board ruling on
// the merits — excluded from the denominator alongside Withdrawn, the same
// treatment boston.mjs gives withdrawn/deferred. Grant rate = granted ÷ decided.
//
// Unlike boston.mjs (which warns and exits 0 on a thin sample), every refusal
// here EXITS 1 without writing: these gates re-test live conditions, and a
// silent success-looking exit on a refusal is how a gap gets read as an answer
// (rule 18).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 for "BSA Applications Status" on data.cityofnewyork.us. Verify
// the schema by reading the COLUMN LIST, not a sample row (Socrata omits null
// fields per row):
//   curl -s "https://data.cityofnewyork.us/api/views/yvxd-uipr.json" | jq '.columns[].fieldName'
const RESOURCE_ID = 'yvxd-uipr'
const HOST = 'data.cityofnewyork.us'

// The BSA zoning calendar: §72-21 variances and §73 special permits (plus §11-41
// reinstatements/amendments of prior variances). See the track decision above.
const TRACK = 'BZ'

// Status vocabulary, verified against the live distinct-`status` histogram for
// application='BZ' (all-time AND in-window). Fails closed: a value outside these
// four buckets halts the run.
const GRANTED = ['Granted']
const DENIED = ['Denied']
// Terminal but not a ruling on the merits — excluded from the denominator.
const NOT_ON_MERITS = ['Withdrawn', 'Dismissed']
// Transient "acted on, outcome not yet coded" — defines the window end; must
// never appear INSIDE the scored window.
const UNCODED = ['Decision']

// Only actions on/after this date count. The published line reads
// "(2022–<current>)".
const SINCE = '2022-01-01'

// Required columns.
const STATUS_FIELD = 'status'
const TRACK_FIELD = 'application'
const ACTION_DATE_FIELD = 'date'

// Gate: a grant rate computed off fewer than this many decided applications
// isn't a trustworthy base rate.
const MIN_N = 100

// Denominator label rendered by the UI (realityCheck card). The internal JSON
// slot is `variance` for schema-compat with relief.ts, but the BZ track is NOT
// variances alone — this label is the published claim, so it says what the
// denominator is.
const LABEL = 'variance and special-permit applications'

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME = 'data.cityofnewyork.us BSA Applications Status (application BZ)'

import { readFile, writeFile } from 'node:fs/promises'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

/** Refusal that means "the data cannot support this figure", as distinct from a
 *  transport or schema failure. Mirrors sf.mjs's CensoringHalt. */
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

const RECOGNISED = [...GRANTED, ...DENIED, ...NOT_ON_MERITS, ...UNCODED]

// ── THE GATE ────────────────────────────────────────────────────────────────
// Every row inside the scored window must carry a coded, recognised status.
// The threshold is ZERO and is the claim itself: one uncoded or unrecognised
// row inside the window means the cohort "acted on in the window" contains a
// member whose outcome the denominator silently drops — the exact censoring
// the action-date frame exists to rule out.
function refuseUnlessWindowIsCoded(offending, windowEnd) {
  if (offending.length === 0) return
  const total = offending.reduce((a, r) => a + Number(r.c), 0)
  throw new CensoringHalt(
    `${total} row(s) inside the scored window (${SINCE} … ${windowEnd ?? 'open'}) carry a ` +
      `status this script cannot score:\n` +
      offending.map((r) => `    · ${r.s} — ${r.c}`).join('\n') +
      `\n\n  If it is a new disposition code, add it to the vocabulary and decide\n` +
      `  explicitly whether it is a ruling on the merits. If it is 'Decision'\n` +
      `  (acted on, outcome not yet coded) inside the window, the window-end\n` +
      `  measurement is broken. reliefStats.json left UNCHANGED.`,
  )
}

async function main() {
  console.log(`NYC relief pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the SCHEMA — the column list, not one row (a sample row omits its
  //    null fields; the SF close_date lesson).
  const meta = await (async () => {
    const res = await fetch(`https://${HOST}/api/views/${RESOURCE_ID}.json`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`${HOST} metadata returned HTTP ${res.status} ${res.statusText}`)
    return res.json()
  })()
  const fieldIds = new Set((meta.columns ?? []).map((c) => c.fieldName))
  for (const f of [STATUS_FIELD, TRACK_FIELD, ACTION_DATE_FIELD]) {
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

  const inTrackSince =
    `${TRACK_FIELD} = ${quote(TRACK)} ` +
    `AND ${ACTION_DATE_FIELD} >= '${SINCE}T00:00:00.000'`

  // 2. MEASURE THE WINDOW END: the earliest in-window action whose outcome is
  //    not yet coded. Everything from that session on is excluded — a partially
  //    coded session must not be scored (its uncoded rows would silently leave
  //    the denominator). No uncoded rows → the window is open-ended.
  const uncodedMin = await socrata({
    $select: `min(${ACTION_DATE_FIELD}) AS m`,
    $where:
      `${inTrackSince} AND ${STATUS_FIELD} IN (${UNCODED.map(quote).join(',')})`,
  })
  const windowEnd = uncodedMin?.[0]?.m ?? null

  // 3. THE GATE INPUT: the full status roster for the scored window — not just
  //    the statuses we intend to score (rule 11: a query that selects on the
  //    outcome cannot measure how often the outcome is missing).
  const where = windowEnd
    ? `${inTrackSince} AND ${ACTION_DATE_FIELD} < '${windowEnd}'`
    : inTrackSince
  const roster = await socrata({
    $select: `${STATUS_FIELD} AS s, count(*) AS c`,
    $where: where,
    $group: STATUS_FIELD,
    $order: 'c DESC',
    $limit: '200',
  })
  const cohortN = roster.reduce((a, r) => a + Number(r.c), 0)
  logCohortRows(
    cohortN,
    `${TRACK_FIELD}=${TRACK}, ${ACTION_DATE_FIELD} in [${SINCE}, ${windowEnd ?? 'open'}), every status`,
  )
  refuseUnlessWindowIsCoded(
    roster.filter((r) => !RECOGNISED.includes(r.s) || UNCODED.includes(r.s)),
    windowEnd,
  )

  // 4. Score the coded cohort.
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

  // 5. Sanity gates — refusals EXIT 1 (see header).
  if (decided === 0) {
    throw new CensoringHalt(
      'No decided BZ applications matched the outcome buckets; the vocabulary or ' +
        'the feed has changed. reliefStats.json left UNCHANGED.',
    )
  }
  if (decided < MIN_N) {
    throw new CensoringHalt(
      `Only ${decided} decided BZ applications acted on since ${SINCE} (need ≥ ${MIN_N}). ` +
        `The base rate isn't trustworthy at this sample size. reliefStats.json left UNCHANGED.`,
    )
  }

  const grantRate = Math.round((granted / decided) * 1000) / 1000
  const currentYear = new Date().getFullYear()
  const stats = {
    grantRate,
    n: decided,
    window: `2022–${currentYear}`,
    label: LABEL,
    vintage:
      `BSA acted ${SINCE} onward` +
      (windowEnd ? ` and before ${windowEnd.slice(0, 10)} (earliest not-yet-coded session, measured at run time)` : '') +
      `; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}; ` +
      `framed on the action date — the feed has no pending value (pending cases are absent rows), ` +
      `so a filing frame cannot be audited; BZ calendar whole-track: §72-21 variances, §73 special ` +
      `permits, and §11-41 reinstatements/amendments of prior variances (strict §72-21 alone is ` +
      `n=93 < ${MIN_N} and was NOT widened by regex to pass); granted ÷ decided, excludes ` +
      `withdrawn/dismissed; ${granted} granted, ${denied} denied`,
  }

  // 6. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    nyc: {
      ...(existing.nyc ?? {}),
      variance: stats,
      feed: feedCounts({
        totals,
        cohortRows: cohortN,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. cohortRows: ` +
          `${TRACK_FIELD}=${TRACK} AND ${ACTION_DATE_FIELD} inside the scored window ` +
          `[${SINCE}, ${windowEnd ?? 'open'}), across EVERY status — not just the ones scored, ` +
          `because a roster that selects on the outcome cannot measure how often the outcome ` +
          `is missing. The published n is smaller: it is the ${decided} rows decided on the ` +
          `merits, excluding ${notOnMerits} withdrawn/dismissed. NOTE the window end is ` +
          `measured at run time, so cohortRows moves with it as well as with the feed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(
    `  Cohort acted on since ${SINCE}${windowEnd ? ` (before ${windowEnd.slice(0, 10)})` : ''}: ` +
      `${cohortN} rows, all coded (${decided} decided on the merits, ${notOnMerits} withdrawn/dismissed).`,
  )
  console.log('  Wrote nyc.variance:', stats)
}

main().catch((err) => {
  if (err instanceof CensoringHalt) {
    console.error(`\nnyc.mjs REFUSED TO WRITE:\n\n  ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\nnyc.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
