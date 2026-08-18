#!/usr/bin/env node
// WO-7.1 — New York City permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/nyc.mjs
//
// Pulls NYC DOB permit data from data.cityofnewyork.us (Socrata), filters to
// New Building (job_type NB) permits, computes the median and 80th-percentile
// filing -> issuance time in months, and WOULD merge the result into
// netlify/functions/lib/data/permitStats.json under nyc.newConstruction.
//
// ⚠️ IT DOES NOT. Read the halt section below before changing anything here.
// This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — TWO INDEPENDENT DISQUALIFIERS, THE STRONGER ONE FIRST ───────
//
// 1. THE POPULATION IS NOT REPRODUCIBLE (measured 2026-08-18). Three extracts of
//    ONE unchanged query against ONE unchanged resource gave three populations:
//
//        2026-08-06   4,394 filings                    published 8.3 / 17.0
//        2026-08-09   1,040 filings, 662 issued        63.65% issued
//        2026-08-18   8,103 filings, 4,448 issued      54.89% issued
//
//    This binds FIRST and it binds ALONE. A source whose n moves in both
//    directions cannot base a published statistic no matter how the censoring
//    resolves — and it takes the censoring analysis down with it, because every
//    figure in disqualifier 2 below was computed on the 08-09 extract, which is
//    one of the three and has no better claim than the other two. Full record
//    and the reasoning against diagnosing a cause: THIRD EXTRACT, below.
//
// 2. THE PUBLISHED FIGURE WAS A CONDITIONAL MEDIAN (measured 2026-08-09). This
//    was the original and, until 08-18, the only stated reason. It remains true
//    of the extract it was measured on; it is no longer the reason that binds.
//
// NYC published 8.3 mo / p80 17.0 / n=4,403 from 2026-08-06 and is WITHDRAWN
// 2026-08-09. What makes this case worth reading is that the disqualifier was
// already written down IN THIS FILE, three paragraphs from the query that could
// not see it, and it shipped anyway.
//
// THE BLINDFOLD, removed first: `pull()` used to end
// `AND ${ISSUANCE_DATE_FIELD} IS NOT NULL`. A query that selects on the outcome
// cannot measure how often the outcome occurs (rule 11), so main() reproduced
// 8.3 exactly and had no way to reach the 45% recorded below it. The predicate
// is gone; the denominator now comes back from the server, which is the only
// thing that makes a gate possible.
//
// THE DISQUALIFIER, recomputed from the feed on every run. 8.3 was a CONDITIONAL
// median — time to issuance GIVEN issuance — and the only place that condition
// could be stated is the `vintage` string, which src/lib/realityCheck.ts never
// renders. The card read "Median filing→permit in New York City". Milwaukee's
// residential pair is measured cleanly and is still withheld for exactly this
// class of reason; being a large city is not an exemption.
//
// Measured 2026-08-09 against the live feed — i.e. against the MIDDLE of the
// three extracts above, a caveat that applies to every number in this paragraph
// and to the per-year breakdown after it — through this script's own filters
// (job_type = 'New Building' + job_filing_number LIKE '%-I1', filed since 2022):
//
//     1,040 filings, of which 662 carry an issue date = 63.65%
//
// NOTE WHICH LIMB BINDS — this is LA's shape, not SF's. 63.65% clears p50 and
// does not clear p80, so the median exists and the published p80 of 17.0 does
// not. The gate below therefore refuses on the p80 while the p50 passes, and
// because this script publishes both, it writes nothing. Per filing year:
// 2022 71.4% (272/381), 2023 63.4% (206/325), 2024 57.0% (162/284),
// 2025 46.8% (22/47). Even the matured 2022 cohort fails p80, so narrowing the
// window does not rescue it.
//
// ⚠️ WITHDRAWING IS NOT PUBLISHING 15.9. The Kaplan-Meier figure recorded below
// is not a replacement waiting to be swapped in: it rests on an assumption about
// what the non-issued filings eventually do, and that assumption has not been
// adopted here. Removing a wrong number is a finished piece of work; choosing an
// estimator is a separate decision for a person (rule: product decisions are not
// automatable).
//
// ⚠️ RETRACTION, 2026-08-09. This file used to state that "the feed does not
// distinguish a not-yet from a never". That is true of SF's and LA's feeds and
// FALSE here, and it was copied in rather than checked against NYC (rule 9's
// corollary — disclosure copy is code). `filing_status` over the 378 in-window
// -I1 rows with no issue date: Objections 155, Approved 151, Filing Withdrawn 57,
// Plan Examiner Review 7, On Hold – Administrative Action 6, QA Failed 1,
// OnHold-NoGoodCheck 1. So 57 ARE a terminal never and the rest are in-progress
// states. This does not change the withdrawal — dropping the 57 from the
// denominator gives 662/983 = 67.3%, which still fails p80 — but "state the
// SHARE, not the FATE" is a rule about not asserting fate you cannot see, not a
// licence to assert that no feed ever records it.
//
// ⚠️ SUPERSEDED FRAMING, 2026-08-18. The two lines that stood here classified
// what follows as an open instrument question and told the reader it was NOT a
// reason for the withdrawal. The third extract, nine days later, promoted it to
// the reason that binds — see disqualifier 1 in the halt section. The framing is
// removed rather than corrected in place, because a sentence telling a reader to
// discount the paragraph beneath it does its damage before any correction is
// reached (rule 17: headers and summaries are read first).
//
// ⚠️⚠️ THIRD EXTRACT, 2026-08-18, AND THE POPULATION OSCILLATES. Running this
// script unchanged today returns 8,103 in-window filings of which 4,448 carry an
// issue date — 54.89%. The three extracts, same query, same resource:
//
//     2026-08-06   4,394 -I1  (of 19,319 permitted NB)   published 8.3 / 17.0
//     2026-08-09   1,040 filings, 662 issued             63.65%
//     2026-08-18   8,103 filings, 4,448 issued           54.89%
//
// The 08-09 note below reads the drop as the feed being "roughly 3.5x smaller
// than the record", which invited a decay story — a dataset being pruned, or a
// migration in progress. Nine days later it is back up by 8x and still does not
// match 08-06. **A population that moves in both directions is not decaying; the
// query and the resource id are unchanged, so the instability is in the feed or
// in how it answers, not in what we asked.**
//
// The consequence is larger than any single figure: **no n from this source is
// reproducible**, which disqualifies it as a base for a published statistic
// regardless of censoring. The issuance rate moved too — 63.65% to 54.89% in
// nine days — so even the one quantity censoring cannot bias is unstable here.
// That is worth stating precisely because "publish the issuance rate regardless"
// is otherwise a sound rule; it assumes the denominator holds still.
//
// Not diagnosed, and deliberately not guessed at. Socrata paging, an async
// index rebuild and a genuine mid-migration republish would all produce this
// signature, and choosing between them without evidence is the mechanism-without-
// measurement move (rule 1). What IS established is that three extracts of one
// query gave three populations, so the next reader should expect a fourth.
//
// The committed n=4,403 no longer reproduces from this feed under any framing
// tried. Measured 2026-08-09: `job_type='New Building'` returns 13,353 rows of
// which 5,469 are permitted and 914 are `-I1`, against the 19,319 permitted /
// 4,394 `-I1` / 14,029 `-S*` this header recorded on 2026-08-06. The whole NB
// population in w9ak-ipjd is roughly 3.5x smaller than the record; the resource
// id, name and column set are unchanged and `rowsUpdatedAt` is current. Running
// this script's exact query and arithmetic over what the feed returns today
// gives median 12.0 / p80 22.4 / n=662, not 8.3 / 17.0 / n=4,403. Cause NOT
// diagnosed — it is a reason to distrust the old extract, never a reason to
// publish the new pair, which fails the same gate.
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
//     load-bearing filter: the -S* subsequent per-work-type filings (plumbing,
//     sprinkler, structural) are the sub-permits that contaminated the old query.
//     The 2026-08-06 counts recorded here — 4,394 of 19,319 permitted NB filings
//     are -I1, the other 14,029 -S* — DO NOT REPRODUCE against the feed today;
//     see the instrument note in the halt section above. The filter's PURPOSE is
//     unaffected: -S* rows are still 5,075 of the 12,417 in-window NB filings, so
//     admitting them would still be admitting sub-permits.
//
// ⚠️ THE KNOWN LIMITATION THAT WAS NEVER FIXED, AND IS NOW THE WITHDRAWAL. The
// median this script computes is conditional on issuance: 45% of initial NB
// filings since 2022 carried no issue date at the 2026-08-06 extract, and the
// permitted share fell by cohort (1461/1960 in 2022 → 764/1764 in 2025), so
// recent cohorts are right-censored and the pooled figure sat BELOW the mature
// 2022 cohort's 10.1 months. Kaplan-Meier over all 8,039 filings gave ~15.9
// months — roughly 2x the 8.3 that shipped.
//
// This paragraph used to end "correcting that is a separate pass". It sat here
// for three days while the uncorrected figure was served, which is the lesson:
// a limitation recorded beside a published number does not restrain it. The
// restraint is refuseUnlessQuantilesAreObserved() below, which every write path
// runs downstream of. Note that 55% observed (the 2026-08-06 record) and 63.65%
// (today) fail the same limb, so the gate would have refused on either extract.
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
// Read as a VOCABULARY, never as a filter. It is what lets this script say which
// of the non-issued rows are terminal (Filing Withdrawn) and which are still in
// review, so the halt message can state the share without asserting the fate.
const STATUS_FIELD = 'filing_status'

// ── The quantiles this script publishes, and therefore the gate ─────────────
// Every quantile written into permitStats.json is listed here, and the gate below
// requires each one to be OBSERVED before anything is written. Adding a figure to
// `stats` without adding its quantile here is the way to break this, so keep the
// two together. Mirrors PUBLISHED_QUANTILES in sf.mjs and la.mjs.
//
// WHY THESE NUMBERS AND NOT OTHERS: they are not thresholds anyone chose. The
// threshold for a quantile IS THE QUANTILE. Order the cohort by time-to-issuance
// and every filing with no issue date sorts above every observed one — whatever
// its eventual duration, it is longer than the longest we have seen — so the p-th
// quantile is identified only when the observed share exceeds p. The comparison
// is strict: at exactly p the quantile sits on the boundary between the last
// observed value and the censored mass and is not identified.
//
// NO SAFETY MARGIN IS ADDED, deliberately. Padding these would look conservative
// and would be an invented number (rule 4), and it would misrepresent what the
// gate checks. This is an EXISTENCE condition, NOT a quality one: NYC's 63.65%
// identifies the median and the median is still censoring-biased by roughly 2x
// against Kaplan-Meier. Clearing this gate would not make 8.3 publishable.
const PUBLISHED_QUANTILES = [
  { q: 0.5, name: 'medianMonths' },
  { q: 0.8, name: 'p80Months' },
]

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
import { noTierBreakdown } from './lib/tierFloor.mjs'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

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

// Every row the resource holds, UNFILTERED — the grew-vs-shrank number. Goes
// through this script's own Socrata client so the count travels the same
// transport and error handling as the rows (rule 11). Best-effort: a failed
// count is recorded as an unknown and never aborts the run.
async function feedTotal(resourceId) {
  return probeFeedTotal(`${HOST}/resource/${resourceId}`, async () => {
    const rows = await socrata(resourceId, 'json', { $select: 'count(1) AS n' })
    return rows[0]?.n
  })
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

/**
 * THE STRUCTURAL HALT (evidence rule 14: convert a caught error into an
 * impossible state, not a comment).
 *
 * Returns the observed share only if every quantile this script publishes is
 * identified by it; otherwise throws a ComputabilityHalt naming the limbs that
 * fail and the measured share behind them. Every path that could write
 * permitStats.json runs downstream of this call, so the script cannot emit an NYC
 * figure without clearing it.
 *
 * The condition is MEASURED, not declared: `observedN` and `cohortN` come back
 * from the server on every run. There is deliberately no flag, env var or
 * `--force` that reaches past it — a boolean someone can flip is a comment with a
 * type. This file already proved that comments do not restrain anything: the 45%
 * sat in the header while 8.3 shipped. The only thing that opens this gate is
 * NYC's feed reporting a different share.
 *
 * @param {number} observedN filings carrying an issue date at extract
 * @param {number} cohortN   in-window filings, issued or not
 * @param {Array<[string, number]>} statusDomain `filing_status` -> count over the
 *   non-issued rows. Reported, never used as a filter.
 */
class ComputabilityHalt extends Error {}

function refuseUnlessQuantilesAreObserved(observedN, cohortN, statusDomain = []) {
  if (cohortN === 0) {
    throw new ComputabilityHalt(
      `The cohort is empty, so no share can be computed. Refusing to write.`,
    )
  }
  const share = observedN / cohortN
  const failing = PUBLISHED_QUANTILES.filter(({ q }) => !(share > q))
  if (failing.length === 0) return share
  const pct = (x) => `${(x * 100).toFixed(2)}%`
  const vocabulary = statusDomain.length
    ? statusDomain.map(([s, n]) => `${s} (${n})`).join(', ')
    : '(not queried)'
  throw new ComputabilityHalt(
    `${observedN} of ${cohortN} filings carry an issue date at extract — ${pct(share)}.\n` +
      failing
        .map(
          ({ q, name }) =>
            `    · ${name} (p${q * 100}) is NOT IDENTIFIED: it needs more than ${pct(q)} of the\n` +
            `      cohort observed and the feed gives ${pct(share)}. Filings with no issue date\n` +
            `      sort above every observed duration, so the p${q * 100} lands inside the\n` +
            `      unobserved ${pct(1 - share)} — past the last observation. There is no number\n` +
            `      there to publish.`,
        )
        .join('\n') +
      `\n\n  WHAT THE PASSING LIMBS DO NOT BUY YOU. Any quantile not listed above is\n` +
      `  IDENTIFIED, not GOOD. NYC's median clears this test and is still roughly 2x\n` +
      `  below the Kaplan-Meier estimate over the same filings, because identification\n` +
      `  is an existence condition and censoring bias is a separate defect. Do not read\n` +
      `  a passing p50 as licence to publish a median alone.\n\n` +
      `  WHAT WAS PUBLISHED AND WHY IT WAS PULLED: 8.3 mo / p80 17.0 / n=4,403 shipped\n` +
      `  2026-08-06 and was withdrawn 2026-08-09. It was a CONDITIONAL median — time to\n` +
      `  issuance GIVEN issuance — and the condition appeared only in the vintage\n` +
      `  string, which the UI never renders. A caveat nobody can see is not a caveat.\n\n` +
      `  DO NOT substitute the Kaplan-Meier figure (~15.9 mo) to get past this. It is\n` +
      `  not a corrected version of the same measurement; it assumes something about\n` +
      `  what the non-issued filings do, and nothing here has adopted that assumption.\n` +
      `  Withdrawing is finished work. Choosing an estimator is a decision for a person.\n\n` +
      `  STATE THE SHARE, NOT THE FATE — but note that THIS feed does record some fate,\n` +
      `  unlike SF's and LA's. ${STATUS_FIELD} over the ${cohortN - observedN} non-issued rows:\n` +
      `  ${vocabulary}.\n` +
      `  Terminal and in-progress states are both in there, so the ${pct(1 - share)} is not a\n` +
      `  "never issues" share and must not be reported as one.\n\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

// Pull the in-window COHORT of INITIAL New Building filings, issued or not.
//
// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `first_permit_date IS NOT NULL`. It
// was here, and it is exactly why this script could not see its own disqualifier
// — a query that selects on the outcome cannot measure how often the outcome
// occurs (rule 11: measure the pipeline, not your probe). With it, main()
// reproduced 8.3 faithfully and had no access to the 45% written four paragraphs
// above it in this same file. The denominator has to come back from the server or
// there is no gate.
//
// Every remaining predicate is FILING-TIME, which is what makes the share a valid
// denominator: `job_type` and `job_filing_number` are both assigned at intake, so
// gating the cohort cannot preferentially drop unissued filings.
//
// The `-I1` suffix is what excludes the -S* subsequent per-work-type filings
// (plumbing, sprinkler, structural) that made the previous query 63.9%
// sub-permits. Duration is measured to FIRST permit, not to any later one.
async function pull() {
  const where =
    `${JOBTYPE_FIELD} = '${NEW_CONSTRUCTION_JOBTYPE}' ` +
    `AND ${FILING_NUMBER_FIELD} LIKE '%-I1' ` +
    `AND ${FILING_DATE_FIELD} >= '${SINCE}'`
  return socrata(RESOURCE_ID, 'json', {
    $select:
      `${FILING_DATE_FIELD} AS filed, ${ISSUANCE_DATE_FIELD} AS issued, ` +
      `${STATUS_FIELD} AS status`,
    $where: where,
    $limit: '50000',
  })
}

async function main() {
  console.log(`NYC permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm both date legs + job_type exist in the live schema. (If they ever
  //    vanish, fail loudly rather than fabricate.)
  const fields = await fieldNames(RESOURCE_ID)
  for (const f of [
    FILING_DATE_FIELD,
    ISSUANCE_DATE_FIELD,
    JOBTYPE_FIELD,
    FILING_NUMBER_FIELD,
    STATUS_FIELD,
  ]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in ${RESOURCE_ID} schema; the resource may ` +
          `have changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged BEFORE the halt below. NYC refuses to write —
  //     its figure was published and then WITHDRAWN — so these two lines are what
  //     a run here leaves behind, and they are what answers "has the feed changed
  //     since the last extract?" without a re-derivation.
  const totals = [await feedTotal(RESOURCE_ID)]
  logFeedTotals(totals)

  // 2. Pull the whole COHORT — issued and not. No year-widening: filing_date is a
  //    real timestamp, so one server-side `>=` gets the window in one request.
  const rows = await pull()
  logCohortRows(
    rows.length,
    `${JOBTYPE_FIELD}='${NEW_CONSTRUCTION_JOBTYPE}', ${FILING_NUMBER_FIELD} LIKE '%-I1', filed >= ${SINCE.slice(0, 10)}`,
  )

  // 3. THE ISSUANCE SHARE, and the halt. Printed before it is judged, so the
  //    refusal is inspectable and a future reader can watch the number move.
  const issued = rows.filter((r) => r.issued != null)
  const notIssued = rows.filter((r) => r.issued == null)

  const statusCounts = {}
  for (const r of notIssued) {
    const label = r.status == null ? '(no filing_status)' : String(r.status)
    statusCounts[label] = (statusCounts[label] ?? 0) + 1
  }
  const statusDomain = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])

  const share = rows.length ? ((issued.length / rows.length) * 100).toFixed(2) : '—'
  console.log(`  cohort ${rows.length} filings, ${issued.length} with an issue date (${share}%)`)

  // By filing year, because the pooled share hides the censoring gradient: recent
  // cohorts have had less time to issue, and it is that slope — not the pooled
  // number — that shows the pooled median is dragged down by immature filings.
  const byYear = {}
  for (const r of rows) {
    const t = parseIso(r.filed)
    if (t == null) continue
    const y = new Date(t).getUTCFullYear()
    byYear[y] ??= { n: 0, obs: 0 }
    byYear[y].n += 1
    if (r.issued != null) byYear[y].obs += 1
  }
  for (const y of Object.keys(byYear).sort()) {
    const { n, obs } = byYear[y]
    console.log(`     ${y}  ${String(obs).padStart(5)}/${String(n).padEnd(5)} ${((obs / n) * 100).toFixed(1)}%`)
  }
  console.log(`  ${STATUS_FIELD} over the ${notIssued.length} non-issued rows:`)
  for (const [s, n] of statusDomain) console.log(`     ${String(n).padStart(5)}  ${s}`)

  refuseUnlessQuantilesAreObserved(issued.length, rows.length, statusDomain)

  // ── Nothing below here has run since the gate was added. ───────────────────
  // It is written to be correct on the day NYC's observed share clears every
  // published quantile, and it is deliberately NOT reachable by a caveat, a flag
  // or an env var. Treat its first run as new code — and re-read the header
  // first, because clearing the gate resolves IDENTIFICATION and says nothing
  // about the censoring bias that put the published 8.3 roughly 2x below the
  // Kaplan-Meier estimate over the same filings.

  // 4. Durations, dropping negatives and > 120-month outliers.
  const days = []
  for (const row of issued) {
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

  // 5. Sanity gate.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing.`,
    )
    return
  }

  // The observed share travels WITH the figure, not just through the gate. It is
  // the one number censoring cannot bias, and it is the condition under which the
  // median is true — which is precisely what the withdrawn 8.3 failed to carry
  // anywhere a reader could see. Note that putting it in `vintage` is NOT
  // sufficient on its own: src/lib/realityCheck.ts does not render `vintage`, so
  // republishing NYC also requires deciding where the condition is SHOWN.
  const observedPct = ((issued.length / rows.length) * 100).toFixed(1)
  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage:
      `filed ${SINCE.slice(0, 10)} onward; computed ${new Date().toISOString().slice(0, 10)}; ` +
      `${DATASET_NAME}. ${issued.length}/${rows.length} (${observedPct}%) of the in-window ` +
      `cohort carries an issue date at extract; this is a median over the observed subset ` +
      `and is still subject to right-censoring.`,
  }

  // 6. Idempotent merge.
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
      newConstruction: stats,
      // Declared, not omitted: a reader of permitStats.json must be able to tell
      // "no breakdown was ever computed, so the aggregate IS the answer" from
      // "a breakdown exists and this tier was withheld" (rule 5).
      tierBreakdown: noTierBreakdown(
        'scripts/permits/nyc.mjs computes no tier split. Its query filters on job_type = \'New Building\' and job_filing_number LIKE \'%-I1\' — nothing in it restricts building size, so the aggregate spans all three tiers instead of standing in for one.',
      ),
      feed: feedCounts({
        totals,
        cohortRows: rows.length,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. ` +
          `cohortRows: ${JOBTYPE_FIELD}='${NEW_CONSTRUCTION_JOBTYPE}' AND ${FILING_NUMBER_FIELD} ` +
          `LIKE '%-I1' AND ${FILING_DATE_FIELD} >= ${SINCE.slice(0, 10)}, issued and not. The ` +
          `published n is smaller: it keeps only the ${issued.length} rows carrying an issue ` +
          `date, then drops durations that are negative or over 120 months. Like everything ` +
          `else below the halt, this has never executed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote nyc.newConstruction:', stats)
}

main().catch((err) => {
  if (err instanceof ComputabilityHalt) {
    // A refusal BY DESIGN, and it exits NON-ZERO — the same choice sf.mjs and
    // milwaukee.mjs make, and for the same reason. This is a LIVE-DATA condition
    // that every run genuinely re-tests, on a city whose figure was published and
    // then retracted. A silent exit 0 there is rule 18's failure exactly: the run
    // would look like success. (boston.mjs exits 0 because its gap is a column
    // that does not exist and no re-run can change it.)
    console.error(`\nnyc.mjs — NOT COMPUTABLE, by design:\n    ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\nnyc.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
