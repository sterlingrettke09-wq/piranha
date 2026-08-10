#!/usr/bin/env node
// WO-7.1 — Chicago permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/chicago.mjs
//
// Pulls Chicago's "Building Permits" dataset from data.cityofchicago.org
// (Socrata), filters to new-construction permits, computes the median and 80th-
// percentile application -> issuance time in months, and WOULD merge the result
// into netlify/functions/lib/data/permitStats.json under
// chicago.newConstruction.
//
// ⚠️ IT DOES NOT. Read the halt section below before changing anything here.
// This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why this script writes nothing (measured 2026-08-09) ──────────
// Chicago was published for part of one session and WITHDRAWN 2026-08-05. Until
// today nothing in this file enforced that: the withdrawal lived in
// permitStats.json (by absence) and in a test, so re-running the script merged
// the disqualified figure straight back into production data. The refusal is now
// STRUCTURAL — see refuseUnlessReviewIsObserved(), which every write path runs
// downstream of — rather than a comment describing a decision.
//
// THE DISQUALIFIER, recomputed from the feed on every run: A FIFTH OF THE SAMPLE
// RECORDS NO ELAPSED REVIEW AT ALL, and it is what sets the median. A row where
// application_start_date == issue_date did not take zero days to review; both
// legs were written in one transaction. Measured 2026-08-09 through this
// script's own filters (permit_type = 'PERMIT - NEW CONSTRUCTION', applied
// 2022-01-01 onward, n=6,206):
//
//     same-day (applied == issued)        1,331 rows = 21.45%
//     pooled median                        1.0 mo      <- the withdrawn figure
//     median with those rows removed       1.7 mo      <- +0.7, seven reporting units
//
// and it is not a property of Chicago's process, it is a property of the 2022-23
// RECORDS. Same-day share by application year:
//
//     2022  n=1612   51.61%   median 0.0
//     2023  n=1254   31.18%   median 0.8
//     2024  n=1285    2.57%   median 1.5
//     2025  n=1408    3.20%   median 1.8
//     2026  n= 647    4.64%   median 0.9
//
// A plan-review process does not become twenty times slower in one year; a data
// migration does. The pooled sample mixes a backfilled cohort with a recorded
// one, and the MIXTURE sets the published median — 2024-25 pooled gives 1.71 mo,
// reproducing the figure the 2026-08-05 audit reported. The instrument
// reconciles against the known-good case before the aggregate is believed
// (rule 16): this script's own pooled median is 1.0, exactly the number that was
// withdrawn.
//
// ── A SECOND, INDEPENDENT LIMITATION (would survive the fix above) ──────────
// `APPLICATION_START_DATE` is documented by the publisher as *"Date when City
// began reviewing permit application"* — NOT the date it was filed. So even a
// window containing only clean cohorts measures review-start -> issuance, and
// the UI's "Median filing→permit" label would still be wrong about which
// interval it names. That is a documentation fact, not something computable from
// the rows, so the gate below cannot test it. **Clearing the gate does not clear
// this.** Narrowing SINCE to 2024-01-01 would pass the gate and would still
// publish the wrong interval under the wrong name.
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

// ── The structural gate: two limbs, both measured, both calibrated ──────────
// A row is "same-day" when |issued - applied| < 0.5 days. The generic OTC guard
// further down asks a different and much weaker question — "is the WHOLE feed an
// artifact?", at 50% — and Chicago passes it comfortably at 21.45%, which is why
// it never fired. These limbs ask the question that actually disqualifies the
// figure: is the artifact big enough to have produced the number?
//
// CALIBRATION. Both thresholds are set against measured comparators rather than
// picked, and the same two queries were run against three other Socrata
// new-construction feeds on 2026-08-09 using each city's committed filter:
//
//     city       same-day    median        median excl. same-day
//     chicago      21.45%     1.0            1.7   (+0.7)
//     seattle       3.29%     6.2            6.3   (+0.1)
//     austin        1.35%     2.2            2.2   (+0.0)
//     la            1.13%     6.0            6.0   (+0.0)
//
// Three plan-review cities that DO publish sit at 1.13-3.29% and move their
// median by 0.0-0.1 months. Chicago sits 6.5x above the worst of them on the
// share and 7x above on the shift. There is a real gap to put a line in.
//
// SAME_DAY_MAX_SHARE = 0.10 — not the midpoint of 3.29 and 21.45, which would be
// a number chosen to split a difference. It is 3x the highest clean comparator,
// so a comparator drifting upward does not start tripping it, and still less
// than half of Chicago's, so Chicago does not sneak under it if the backfill
// dilutes as later cohorts accumulate. A tenth of ground-up permits recording no
// elapsed review is a stamping artifact whatever it does to the median.
//
// MEDIAN_SHIFT_MAX_MONTHS = 0.2 — the perturbation limb, and the stronger of the
// two (rule 2: perturbation beats a ratio beats a sum). It predicts the median
// under each competing structure — "the same-day rows are real fast permits" vs
// "the same-day rows are recording artifacts" — changes one input, and reads the
// answer off. 0.2 is one reporting unit above the worst clean comparator
// (Seattle's 0.1) and 3.5x below Chicago's 0.7. Below that the artifact cannot
// move the published figure, and a difference invisible in the output cannot be
// what produced the output.
//
// Both limbs are evaluated; ANY failure halts, and the message names every limb
// that failed rather than the first.
const SAME_DAY_MAX_SHARE = 0.1
const MEDIAN_SHIFT_MAX_MONTHS = 0.2

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = "data.cityofchicago.org Building Permits (permit_type = 'PERMIT - NEW CONSTRUCTION')"

import { readFile, writeFile } from 'node:fs/promises'
import { noTierBreakdown } from './lib/tierFloor.mjs'

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

/**
 * THE STRUCTURAL HALT (evidence rule 14: convert a caught error into an
 * impossible state, not a comment).
 *
 * Returns only if the sample's same-day mass is small enough to be review rather
 * than recording, AND small enough that removing it does not move the published
 * median. Otherwise throws with every failing limb and its measured value.
 *
 * This exists as a function, and is called before any write, so that the refusal
 * is a property of the script rather than an accident of ordering — the
 * distinction boston.mjs's previous pipeline failed to make, halting for the
 * right reason by luck on a missing column while its filter was 58%
 * contaminated underneath.
 *
 * There is deliberately no flag, env var or `--force` that reaches past this. A
 * boolean someone can flip is a comment with a type; the only thing that opens
 * the gate is Chicago's feed reporting different rows.
 *
 * @param {number[]} allDays ascending durations, every admitted row
 * @param {number[]} cleanDays ascending durations, same-day rows removed
 * @param {Record<string, {n: number, sameDay: number, median: number}>} byYear
 *        per-application-year profile, printed as the diagnosis
 */
function refuseUnlessReviewIsObserved(allDays, cleanDays, byYear) {
  const sameDayN = allDays.length - cleanDays.length
  const share = allDays.length ? sameDayN / allDays.length : 0
  const pooled = daysToMonths(quantile(allDays, 0.5))
  const clean = cleanDays.length ? daysToMonths(quantile(cleanDays, 0.5)) : null
  const shift = clean == null ? 0 : Math.abs(clean - pooled)

  const failing = []
  if (share > SAME_DAY_MAX_SHARE) {
    failing.push(
      `${(share * 100).toFixed(2)}% of admitted rows are same-day (applied == issued), ` +
        `${sameDayN} of ${allDays.length} — limit ${(SAME_DAY_MAX_SHARE * 100).toFixed(0)}%.\n` +
        `      A ground-up new-construction permit issued the day review began did not take\n` +
        `      zero days; both legs were written in one transaction.`,
    )
  }
  if (shift > MEDIAN_SHIFT_MAX_MONTHS) {
    failing.push(
      `removing the same-day rows moves the median ${pooled} -> ${clean} mo, a shift of ` +
        `${shift.toFixed(1)} — limit ${MEDIAN_SHIFT_MAX_MONTHS}.\n` +
        `      So the published figure is not a measurement of Chicago's review time; it is\n` +
        `      an average of a review time and a recording artifact, weighted by how much of\n` +
        `      the window happens to be backfilled.`,
    )
  }
  if (failing.length === 0) return

  const profile = Object.entries(byYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([y, v]) =>
        `      ${y}  n=${String(v.n).padStart(5)}  same-day ${(v.sameDay * 100).toFixed(2).padStart(6)}%  ` +
        `median ${v.median}`,
    )
    .join('\n')

  throw new Error(
    `The applied==issued cohort disqualifies this sample:\n` +
      failing.map((f) => `    · ${f}`).join('\n') +
      `\n\n  THE DIAGNOSIS — the same-day mass is a property of the RECORDS, not of the\n` +
      `  process. Same-day share by application year:\n\n${profile}\n\n` +
      `  A plan-review process does not become twenty times slower in a year; a data\n` +
      `  migration does. Backfilled cohorts and recorded cohorts are being pooled, and\n` +
      `  the mixture is what sets the median.\n\n` +
      `  DO NOT "fix" this by dropping the same-day rows and publishing the remainder.\n` +
      `  They are not outliers to be trimmed — their presence is evidence about how the\n` +
      `  whole cohort was recorded, and the rows around them in the same backfill carry\n` +
      `  no guarantee of being real either. The 0.8-month 2023 median sits between a\n` +
      `  31% same-day cohort and a 2.6% one; nothing here says which side it belongs to.\n\n` +
      `  AND CLEARING THIS GATE IS NOT SUFFICIENT. "${APPLIED_DATE_FIELD}" is documented\n` +
      `  as the date the City BEGAN REVIEWING, not the date of filing, so even a clean\n` +
      `  window measures review-start -> issuance while the UI says "filing -> permit".\n` +
      `  That limitation is not computable from the rows and this gate does not test it.\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

// Pull the in-window COHORT of new-construction permits applied since `since`.
//
// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `issue_date IS NOT NULL`. It was
// here until 2026-08-09, and it is the same defect sf.mjs and la.mjs carried — a
// query that selects on the outcome cannot measure how often the outcome occurs
// (rule 11: measure the pipeline, not your probe). With it in place the server
// returned only issued permits, so "every application issued" and "we asked only
// about issued applications" came back as the same row set with opposite
// meanings, and the script had no denominator with which to tell them apart.
//
// Every remaining predicate is APPLICATION-TIME — `permit_type` is set at intake
// and the window is on `application_start_date` — which is what makes the
// returned row count a valid denominator.
//
// What consumes it today: NOTHING but the printed line in main(). The gate below
// (refuseUnlessReviewIsObserved) judges the same-day mass, not the issuance
// share, and adding a share limb would mean choosing a threshold — see "Choosing
// a threshold for a new gate" in README.md. The share is printed so it is
// OBSERVABLE rather than assumed; do not read the printed number as a gate.
//
// ⚠️ AND READ THE 100.00% AS A MISSING LOOKUP, NOT AS AN ANSWER (rule 5). With
// the predicate gone the cohort came back 6,206 of 6,206 issued. That is NOT a
// finding that every Chicago new-construction application is permitted — it is
// LA's `pi9x-tg5x` shape, and it was established the way la.mjs established its
// own, by asking the feed rather than the query:
//
//     issue_date IS NULL, WHOLE feed                     0 of 843,703   (2026-08-09,
//     issue_date IS NULL, permit_type = NEW CONSTRUCTION 0              two isolated
//                                                                        passes, rule 10)
//
// and the publisher agrees in words: `ydr8-5enu` is described as "building
// permits ISSUED by the City of Chicago ... excluding permits that have been
// voided or revoked after issuance". The population is issued permits BY
// DEFINITION, so this feed cannot report an issuance rate at any share and the
// denominator is unavailable from it — not equal to one.
//
// The predicate still had to go. It is exactly why that was not knowable from
// this script before: a query filtered on `issue_date` returns 100% observed
// whether the feed is issued-only or the city permits everything, and those are
// the same row set with opposite meanings. Removing it is what turned an
// assumption into a measurement, even though the measurement's answer is "this
// feed cannot say". NOT DONE: no search for a Chicago *applications* feed (LA's
// counterpart was `gwh9-jnip`). Until someone reads the portal catalogue — the
// index, not a guessed 4x4 (rule 8) — the absence of one is unestablished.
async function pull(since) {
  const where =
    `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPE}' ` +
    `AND ${APPLIED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL`
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
  //    Rows are kept alongside their application YEAR, because the same-day mass
  //    turns out to be a cohort property and the year is what shows it.
  const days = []
  const cleanDays = []
  const cohorts = new Map()
  let sameDay = 0
  let observedIssued = 0
  for (const row of rows) {
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    observedIssued++
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) {
      days.push(d)
      if (Math.abs(d) >= 0.5) cleanDays.push(d)
      const year = String(row.applied).slice(0, 4)
      if (!cohorts.has(year)) cohorts.set(year, [])
      cohorts.get(year).push(d)
    }
  }

  // The denominator the outcome-selecting predicate used to hide. It is REPORTED,
  // not judged: no limb of the gate below reads it, and a share printed here is
  // not a share that has been ruled on.
  console.log(
    `  cohort ${rows.length} applications in window; ${observedIssued} carry an issue date ` +
      `(${rows.length ? ((observedIssued / rows.length) * 100).toFixed(2) : '—'}%) — reported, not gated.`,
  )

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  // OTC artifact guard (the NYC lesson): a feed that stamps both legs at issuance
  // produces a meaningless ~0-month latency. Skip if the majority are same-day.
  //
  // ⚠️ THIS GUARD DOES NOT PROTECT CHICAGO, and that is why it is worth leaving
  // above the real one rather than deleting. It asks whether the WHOLE feed is an
  // artifact; Chicago's answer is no (21.45% < 50%) while its MEDIAN is one
  // anyway. A guard that a defect passes is not a guard against that defect.
  //
  // Denominator note (2026-08-09): this is a share OF THE ISSUED ROWS — the NYC
  // figure it was calibrated against (74.5% of issued NB permits stamped
  // filing == issuance) is the same quantity. It divided by `rows.length` when
  // `rows` was issued-only and the two were identical; now that the cohort pull
  // returns non-issued applications too, dividing by `rows.length` would silently
  // dilute the guard by the un-issued share. Same question, denominator restated.
  const sameDayPct = (sameDay / observedIssued) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing chicago.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  cleanDays.sort((x, y) => x - y)

  // 4. THE HALT. Everything it judges is printed first, so the refusal is
  //    inspectable and a future reader can watch the numbers move.
  const byYear = {}
  for (const [year, ds] of cohorts) {
    const sorted = [...ds].sort((x, y) => x - y)
    byYear[year] = {
      n: sorted.length,
      sameDay: sorted.filter((d) => Math.abs(d) < 0.5).length / sorted.length,
      median: daysToMonths(quantile(sorted, 0.5)),
    }
  }
  console.log(
    `  n=${days.length}; same-day ${((days.length - cleanDays.length) / days.length * 100).toFixed(2)}%; ` +
      `median ${daysToMonths(quantile(days, 0.5))} mo, ` +
      `${cleanDays.length ? daysToMonths(quantile(cleanDays, 0.5)) : '—'} mo without the same-day rows`,
  )
  for (const [year, v] of Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `     ${year}  n=${String(v.n).padStart(5)}  same-day ${(v.sameDay * 100).toFixed(2).padStart(6)}%  median ${v.median}`,
    )
  }

  refuseUnlessReviewIsObserved(days, cleanDays, byYear)

  // ── Nothing below here has run since the gate was added. ───────────────────
  // It is written to be correct on the day Chicago's feed stops pooling a
  // backfilled cohort with a recorded one, and it is deliberately NOT reachable
  // by a caveat, a flag or an env var. Treat its first run as new code — and
  // re-read the SECOND limitation in the header first, because the gate above
  // does not test it.

  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 5. Sanity gate. A median under half a month or a tiny n is not trustworthy.
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

  // 6. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    chicago: {
      ...(existing.chicago ?? {}),
      newConstruction: stats,
      // Declared, not omitted: a reader of permitStats.json must be able to tell
      // "no breakdown was ever computed, so the aggregate IS the answer" from
      // "a breakdown exists and this tier was withheld" (rule 5).
      tierBreakdown: noTierBreakdown(
        'scripts/permits/chicago.mjs computes no tier split. Its query filters on permit_type = \'PERMIT - NEW CONSTRUCTION\' only, with no size restriction. (Chicago is WITHDRAWN and this script writes nothing today — see src/config/cities.ts.)',
      ),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote chicago.newConstruction:', stats)
}

// Exits NON-ZERO on the refusal, matching milwaukee.mjs rather than boston.mjs.
// Boston exits 0 because its gap is structural and permanent — a column that
// does not exist, which no re-run can change — so a zero exit stops a batch
// runner crying wolf. Chicago's is a LIVE-DATA condition that every run genuinely
// re-tests, on a city whose figure was published and then retracted. A silent
// exit 0 there is exactly rule 18's failure: the run would look like success.
main().catch((err) => {
  console.error(`\nchicago.mjs halted: ${err.message}\n`)
  process.exitCode = 1
})
