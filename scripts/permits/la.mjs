#!/usr/bin/env node
// WO-7.1 — Los Angeles permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/la.mjs
//
// Pulls LA's "Building and Safety Permit Information" dataset from
// data.lacity.org (Socrata, LADBS), filters to new-construction building
// permits, computes the median and 80th-percentile submission -> issuance time
// in months, and WOULD merge the result into
// netlify/functions/lib/data/permitStats.json under la.newConstruction.
//
// ⚠️ IT DOES NOT. Read the halt section below before changing anything here.
// This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why this script writes nothing (measured 2026-08-09) ──────────
// LA was published for part of one session and WITHDRAWN 2026-08-05. Until today
// nothing in this file enforced that: the withdrawal lived in permitStats.json
// (by absence) and in a test, so re-running the script merged the disqualified
// figure straight back into production data. The refusal is now STRUCTURAL —
// see refuseUnlessIssuanceIsMeasurable(), which every write path runs downstream
// of — rather than a comment describing a decision.
//
// THE DISQUALIFIER: **the feed THIS SCRIPT READS has no denominator.** Read that
// scope literally — LADBS *does* publish the denominator, in a companion feed
// (`gwh9-jnip`), and it measures 45.4% never-issued. See "THE RECORDED REASON IS
// CORRECT" below before concluding anything about LA from this section. What
// follows is true of `pi9x-tg5x` and only of `pi9x-tg5x`.
//
// `pi9x-tg5x` is an ISSUED-ONLY dataset, so the share of applications that reach
// a permit is NOT COMPUTABLE from it, and therefore the quantiles this script
// publishes cannot be shown to exist — nor bounded, in either direction.
// Established from the source's own structure rather than from a reader failing
// to find something (rule 5's slot test), measured 2026-08-09:
//
//   · The dataset is titled "Building and Safety - Building Permits ISSUED from
//     2020 to Present".
//   · `issue_date` is non-null on 404,414 of 404,414 rows. Not "mostly
//     populated" — there is not one row in the feed without an issue date.
//   · The `status_desc` SLOT EXISTS and its whole domain over the 25,998
//     `Bldg-New` rows is post-issuance: CofO Issued 15,114, Issued 9,624, CofO
//     in Progress 347, CofO Corrected 333, Permit Finaled 322, Permit Expired
//     117, Permit Closed 111, Refund in Progress 16, Intent to Revoke 11,
//     Re-Activate Permit 2, Ready to Issue 1. No Filed, In Review, Submitted,
//     Pending, Withdrawn or Denied value exists anywhere in it.
//   · `submitted_date` is null on 3 of those 25,998 rows (0.01%), so the filing
//     leg is not what is missing.
//
// An application that never issued is therefore ABSENT from this source, not
// censored. There are no censored observations to form a risk set, so
// Kaplan-Meier is not merely hard **against this feed** — its required input is
// not in it — and the unconditional median and p80 this script writes are
// unidentified with nothing here to bound them.
//
// ⚠️ That last sentence used to end "its required input does not exist", full
// stop. It does exist: `gwh9-jnip` holds 11,810 censored `Bldg-New` observations
// with a pre-issuance status vocabulary. The unscoped version was false about LA
// while being true about `pi9x-tg5x` — a claim that changes truth value with the
// context it is read in, which is the failure the ledger's rule 9 corollary
// names. Keep the scope on every sentence in this block.
//
// ⚠️ THE RECORDED REASON IS CORRECT — IT WAS MEASURED ON A DIFFERENT LADBS FEED.
// RESOLVED 2026-08-09; the "does not reproduce" note that stood here from earlier
// the same day is WITHDRAWN, and it was the error.
//
// The 2026-08-05 audit recorded "45.4% of the cohort carries no issue date at
// extract; only 64.1% of the matured 2022 cohort carries one". Re-probed against
// `pi9x-tg5x` that share is 100.00%, not 54.6% — every in-window `Bldg-New` row
// carries an issue date — and this file briefly recorded the figure as
// irreproducible on that basis. That conclusion was an instrument error, the
// exact shape of rule 11: `pi9x-tg5x` is the ISSUED feed, and asking an
// issued-only dataset how many applications never issued measures the query, not
// the city.
//
// LADBS publishes a COMPANION feed — `gwh9-jnip`, "Building and Safety - Building
// Permits SUBMITTED from 2020 to Present" — and against it both figures
// reconstruct exactly (measured 2026-08-09, two isolated passes, rule 10):
//
//   · `permit_type='Bldg-New'`, `submitted_date >= 2022-01-01`: n = 26,035, of
//     which 11,810 carry NO issue_date — **45.36%**, the recorded 45.4%. The
//     observed share is **54.64%**, the recorded "only 54.6% is observed".
//   · The matured 2022 cohort (`submitted_date` in 2022): n = 6,085, 3,901 with
//     an issue date — **64.11%**, the recorded 64.1%.
//
// Three independent figures matching to the decimal on the first feed tried is
// not coincidence. This is a SOURCE ATTRIBUTION, though, not a claim about who
// queried what: what is established is that the numbers reconstruct there and
// did not reconstruct here.
//
// And `gwh9-jnip` carries a real denominator, not a null artifact. Its
// no-issue_date rows have a genuine PRE-ISSUANCE `status_desc` vocabulary —
// Quality Review Completed 5,592, Verifications in Progress 2,902, PC Info
// Complete 1,215, Corrections Issued 698, PC Approved 648, Ready to Issue 286,
// Submitted 87, Plans on Hold 16 — the very values limb 1 correctly reports as
// absent from `pi9x-tg5x`. The two feeds join cleanly in both directions: 0 of 12
// sampled never-issued permit numbers appear in `pi9x-tg5x`, and 12 of 12 sampled
// issued permits appear in `gwh9-jnip` with `issue_date` populated. `gwh9-jnip`
// is the application population; `pi9x-tg5x` is its issued subset.
//
// ⚠️ SO THE WITHDRAWAL IS NOT "NO DENOMINATOR EXISTS" — IT IS STRONGER THAN THAT.
// The denominator exists, it is published by LADBS, and it DISQUALIFIES the p80.
// At 54.64% observed, the quantile-existence rule below identifies p50 (54.64 >
// 50) and does NOT identify p80 (54.64 < 80). The withdrawn figures were median
// 6.0 and **p80 13.0**, so the p80 is unidentified — precisely the 2026-08-05
// finding, now sourced rather than merely recorded.
//
// The gate still tests what THIS script can see, because this script reads
// `pi9x-tg5x` and a gate must fire on the feed it actually queries. Both roads
// reach the same place: limb 1 halts on the issued-only feed, and limb 2 would
// halt on the submitted feed's 54.64%. LA stays withdrawn either way.
//
// ── The live decision this file must NOT take unattended ────────────────────
// Repointing this script at `gwh9-jnip` is now a real option and a real product
// decision. It would supply the censored observations Kaplan-Meier needs — the
// thing the paragraph below says does not exist HERE, which remains true of
// `pi9x-tg5x` and is false of LADBS as a whole. Doing it means choosing between a
// KM estimate and a labelled conditional median, splitting by tier, and re-running
// the audit. That needs a person (see the header, and milwaukee.mjs's position on
// its residential pair). Do not let an unattended run quietly adopt the new feed.
//
// ── What would make LA publishable, and why this script cannot decide it ────
// An issued-only feed is NOT by itself a reason to withhold — austin, denver,
// miami and philadelphia all publish from one. What they publish is a CONDITIONAL
// median, time-to-issuance GIVEN issuance, labelled as such. This script does not
// do that: it writes bare `medianMonths`/`p80Months` with a `vintage` string that
// makes no conditionality claim, plus a `noTierBreakdown` record asserting that
// the aggregate IS the answer for every tier — which would serve 6.0 months for a
// 5+-unit apartment query in a cohort whose Apartment rows measure 16.4 (n=426)
// against 43.1% Accessory Dwelling Units at 5.8. Restating LA as a labelled
// conditional median, split by tier, is a live product decision that needs a
// re-run and a person; it is not this script's to take unattended (same position
// milwaukee.mjs takes on its residential pair).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for the current LADBS permit dataset on
// data.lacity.org. Verify the schema by probing:
//   curl -s "https://data.lacity.org/resource/pi9x-tg5x.json?\$limit=1"
// The dataset carries submitted_date + issue_date + permit_type +
// permit_sub_type. (The older "Building and Safety Permit Information Old"
// yv23-pmwf feed is frozen; pi9x-tg5x is the live one, current to within days.)
// Re-find the id from the dataset's API docs page if it ever rotates.
const RESOURCE_ID = 'pi9x-tg5x'
const HOST = 'data.lacity.org'

// New-construction permits are flagged by permit_type = "Bldg-New" (verified
// against the distinct permit_type histogram; LADBS's ground-up class, ~25k
// records, distinct from Bldg-Addition / Bldg-Alter/Repair / Nonbldg-New).
const NEW_CONSTRUCTION_TYPE = 'Bldg-New'
const TYPE_FIELD = 'permit_type'

// Filter to permits SUBMITTED on/after this date (keeps the vintage recent). If
// the resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2020-01-01'

// Required date columns. submitted_date is the filing leg, issue_date the
// issuance leg. If either is missing from the live schema we refuse to fabricate
// a latency figure and leave the artifact untouched (the Boston lesson).
const APPLIED_DATE_FIELD = 'submitted_date'
const ISSUED_DATE_FIELD = 'issue_date'
// The column whose DOMAIN establishes whether this feed can carry a pre-issuance
// row at all. Read as a vocabulary, not as a filter — the slot test.
const STATUS_FIELD = 'status_desc'

// ── The quantiles this script publishes, and therefore the gate ─────────────
// Every quantile written into permitStats.json is listed here, and the gate
// requires each one to be OBSERVED before anything is written. Adding a figure
// to `stats` without adding its quantile here is the way to break this, so keep
// the two together. Mirrors PUBLISHED_QUANTILES in sf.mjs, and for the same
// reason: the threshold for a quantile IS THE QUANTILE.
//
// Order the cohort by time-to-issuance and every application without an issue
// date sorts above every observed one, so the p-th quantile is identified only
// when the observed share exceeds p. The comparison is strict — at exactly p the
// quantile sits on the boundary between the last observed value and the
// unobserved mass and is not identified. No safety margin is added: this is an
// EXISTENCE condition, not a quality one, and padding it would be an invented
// number wearing the appearance of caution (rule 4).
//
// NOTE WHICH LIMB BINDS WHERE. SF fails at p50 (37.61% observed). The figure LA
// was withdrawn over was its p80, which needs >80%. Measured on LADBS's submitted
// feed `gwh9-jnip` 2026-08-09, LA's observed share is 54.64% since 2022 (64.11%
// for the matured 2022 cohort): both clear p50 and neither clears p80, so the
// published median 6.0 survives the existence test and the p80 13.0 does not.
// Both scripts apply the same rule; they fail it at different places. (That LA
// share is NOT measurable from `pi9x-tg5x`, which this script reads — see the
// header. It is recorded here because it is the actual disqualifier.)
const PUBLISHED_QUANTILES = [
  { q: 0.5, name: 'medianMonths' },
  { q: 0.8, name: 'p80Months' },
]

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME = "data.lacity.org Building & Safety Permit Information (permit_type = 'Bldg-New')"

import { readFile, writeFile } from 'node:fs/promises'
import { noTierBreakdown } from './lib/tierFloor.mjs'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

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
 * Two limbs, in order, because the first has to pass before the second means
 * anything:
 *
 *   1. IS THE DENOMINATOR PRESENT? An issued-only feed cannot report how often
 *      an application reaches a permit, so the share is a MISSING LOOKUP, not an
 *      answer of 100%. That distinction is the whole of rule 5, and getting it
 *      wrong here would publish "100% of LA filings issue" — a spectacular claim
 *      manufactured by a query that only selected issued rows.
 *   2. ARE THE PUBLISHED QUANTILES IDENTIFIED by that share?
 *
 * Called before any write, so the refusal is a property of the script rather
 * than an accident of ordering — the distinction boston.mjs's previous pipeline
 * failed to make. There is deliberately no flag, env var or `--force` past it: a
 * boolean someone can flip is a comment with a type.
 *
 * ⚠️ This used to end "and the only thing that opens this gate is LADBS
 * publishing a different feed." LADBS ALREADY publishes one — the submitted feed
 * `gwh9-jnip` (see the header). So the gate is not waiting on the city; it is
 * waiting on a decision to repoint this script, which carries a choice between
 * Kaplan-Meier and a labelled conditional median and is not automatable. Limb 1
 * still fires correctly on `pi9x-tg5x`, and limb 2 would fire on `gwh9-jnip`'s
 * 54.64% observed, so neither feed makes LA publishable as written.
 *
 * @param {number} cohortN   in-window applications the feed exposes
 * @param {number} observedN of those, the ones carrying an issue date
 * @param {number} feedNullIssued rows in the WHOLE feed with a null issue date
 * @param {Array<[string, number]>} statusDomain `status_desc` value -> count
 */
function refuseUnlessIssuanceIsMeasurable(cohortN, observedN, feedNullIssued, statusDomain) {
  const vocabulary = statusDomain.map(([s, n]) => `${s} (${n})`).join(', ')

  // LIMB 1 — the denominator. `observedN === cohortN` alone would be ambiguous:
  // it is what a perfect city and an issued-only feed both look like. The
  // feed-wide null count is what disambiguates, which is why it is queried
  // separately rather than inferred from the window.
  if (feedNullIssued === 0 && observedN === cohortN) {
    throw new Error(
      `This feed is ISSUED-ONLY, so the issuance rate is NOT COMPUTABLE from it.\n` +
        `    · ${ISSUED_DATE_FIELD} is non-null on every row in the dataset (0 nulls feed-wide).\n` +
        `    · All ${cohortN} in-window applications carry one, so the share is 100% BY\n` +
        `      CONSTRUCTION — the query cannot see an application that never issued.\n` +
        `    · ${STATUS_FIELD} domain, read as a vocabulary: ${vocabulary}\n` +
        `      No Filed / In Review / Submitted / Pending / Withdrawn / Denied value appears.\n` +
        `      The one nominally pre-issuance value, "Ready to Issue", covers a single row —\n` +
        `      and it carries an issue date too, which is why limb 1 rests on the null count\n` +
        `      rather than on reading the vocabulary. The SLOT for a pre-issuance status\n` +
        `      exists and holds no unissued application: positive evidence of an absence,\n` +
        `      not a reader failing to find something.\n\n` +
        `  So an application that never issued is ABSENT here, not censored. There are no\n` +
        `  censored observations, hence no risk set to decrement and no survival curve:\n` +
        `  Kaplan-Meier is not hard here, its required input does not exist. The\n` +
        `  unconditional median and p80 this script writes are unidentified and cannot be\n` +
        `  bounded in either direction.\n\n` +
        `  DO NOT read the 100% as an answer. It is a MISSING LOOKUP wearing the shape of\n` +
        `  one, and reporting it would publish "every LA filing issues" from a query that\n` +
        `  selected only issued rows — the instrument measuring itself.\n\n` +
        `  DO NOT resolve this by adding a caveat string either. What an issued-only feed\n` +
        `  supports is a CONDITIONAL median — time-to-issuance GIVEN issuance — published\n` +
        `  as that quantity, split by tier, the way austin/denver/miami/philadelphia are.\n` +
        `  This script publishes neither the label nor the split (see the header), so that\n` +
        `  is a restatement and a product decision, not a caveat.\n` +
        `  permitStats.json left UNCHANGED.`,
    )
  }

  // LIMB 2 — only reachable once the feed carries pre-issuance rows.
  const share = cohortN === 0 ? 0 : observedN / cohortN
  const pct = (x) => `${(x * 100).toFixed(2)}%`
  const failing = PUBLISHED_QUANTILES.filter(({ q }) => !(share > q))
  if (failing.length === 0) return share
  throw new Error(
    `${observedN} of ${cohortN} applications carry an issue date at extract — ${pct(share)}.\n` +
      failing
        .map(
          ({ q, name }) =>
            `    · ${name} (p${q * 100}) is NOT IDENTIFIED: it needs more than ${pct(q)} of the\n` +
            `      cohort observed and the feed gives ${pct(share)}. Applications with no issue\n` +
            `      date sort above every observed duration, so the p${q * 100} lands inside the\n` +
            `      unobserved ${pct(1 - share)} — past the last observation.`,
        )
        .join('\n') +
      `\n\n  STATE THE SHARE, NOT THE FATE: this feed does not distinguish a not-yet from a\n` +
      `  never, so do not rewrite the above as "${pct(1 - share)} never issue".\n` +
      `  A quantile past the last observation is undefined under either reading, and a\n` +
      `  "floor" label does not rescue it — it makes an absent number look cautious.\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

// Pull the in-window COHORT for new-construction permits submitted since `since`.
//
// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `issue_date IS NOT NULL`. It used
// to be, and that is precisely why this script could not see its own
// disqualifier — a query that selects on the outcome cannot measure how often
// the outcome occurs (rule 11: measure the pipeline, not your probe). Removing
// it is what lets the gate tell "every application issued" from "the feed only
// lists issued applications", which are the same row set and opposite findings.
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

/** Every row the resource holds, UNFILTERED — the grew-vs-shrank number. Goes
 *  through this script's own Socrata client so the count travels the same
 *  transport and error handling as the rows (rule 11). Best-effort: a failed
 *  count is recorded as an unknown and never aborts the run.
 *
 *  DISTINCT from feedWideNullIssuedCount() below, which counts a SUBSET of the
 *  feed for the halt's denominator test. This one is the feed itself. */
async function feedTotal() {
  return probeFeedTotal(`${HOST}/resource/${RESOURCE_ID}`, async () => {
    const rows = await socrata('json', { $select: 'count(1) AS n' })
    return rows[0]?.n
  })
}

/** Rows in the WHOLE feed carrying no issue date — the denominator's existence test. */
async function feedWideNullIssuedCount() {
  const rows = await socrata('json', {
    $select: 'count(1) AS n',
    $where: `${ISSUED_DATE_FIELD} IS NULL`,
  })
  return Number(rows[0]?.n ?? 0)
}

/** `status_desc` value -> count over the new-construction slice, descending. */
async function statusVocabulary() {
  const rows = await socrata('json', {
    $select: `${STATUS_FIELD}, count(1) AS n`,
    $where: `${TYPE_FIELD} = '${NEW_CONSTRUCTION_TYPE}'`,
    $group: STATUS_FIELD,
    $order: 'n DESC',
  })
  return rows.map((r) => [String(r[STATUS_FIELD]), Number(r.n)])
}

async function main() {
  console.log(`LA permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await socrata('json', { $limit: '1' })
  const fieldIds = new Set(Object.keys(probe[0] ?? {}))
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD, STATUS_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged BEFORE the halt below. LA refuses to write, so
  //     these two lines are what a run here leaves behind — and they are what
  //     answers "has the feed changed since the last extract?" without a
  //     re-derivation.
  const totals = [await feedTotal()]
  logFeedTotals(totals)

  // 2. Pull the cohort. Widen the window if the slice that would carry the
  //    figure is thin (< 50) — counted on the rows with an issue date, since
  //    those are the only ones a duration can come from.
  let since = SINCE
  let cohort = await pull(since)
  if (cohort.filter((r) => r.issued != null).length < 50) {
    console.warn(
      `  Only ${cohort.filter((r) => r.issued != null).length} rows with an issue date ` +
        `(of ${cohort.length}) since ${SINCE}; widening to ${SINCE_WIDE}.`,
    )
    since = SINCE_WIDE
    cohort = await pull(since)
  }

  // 3. THE HALT. Everything it judges is measured and printed first, so the
  //    refusal is inspectable and a future reader can see the numbers move.
  const observed = cohort.filter((r) => r.issued != null)
  logCohortRows(cohort.length, `${TYPE_FIELD}='${NEW_CONSTRUCTION_TYPE}', submitted >= ${since}`)
  const feedNullIssued = await feedWideNullIssuedCount()
  const statusDomain = await statusVocabulary()
  console.log(
    `  cohort ${cohort.length} applications submitted ${since} onward, ` +
      `${observed.length} with an issue date`,
  )
  console.log(`  ${ISSUED_DATE_FIELD} IS NULL across the WHOLE feed: ${feedNullIssued} rows`)
  console.log(`  ${STATUS_FIELD} domain: ${statusDomain.map(([s, n]) => `${s} (${n})`).join(', ')}`)

  refuseUnlessIssuanceIsMeasurable(cohort.length, observed.length, feedNullIssued, statusDomain)

  // ── Nothing below here has run since the gate was added. ───────────────────
  // It is written to be correct on the day LADBS publishes a feed carrying
  // pre-issuance applications, and it is deliberately NOT reachable by a caveat,
  // a flag or an env var. Treat its first run as new code — and re-read the
  // header first: an issued-only feed is publishable only as a LABELLED
  // CONDITIONAL median split by tier, which this block does not produce.
  const rows = observed

  // 4. Compute durations, dropping negatives and absurd outliers (> 120 months).
  //    Also watch the NYC failure mode (same-day OTC artifact).
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
    console.warn('  No usable submitted/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  const sameDayPct = (sameDay / rows.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (submitted == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing la.`,
    )
    return
  }

  days.sort((x, y) => x - y)
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

  // The observed share travels WITH the figure, not just through the gate. It is
  // the one number censoring cannot bias, and a reader of permitStats.json has
  // to be able to see how far from undefined these quantiles were.
  const observedPct = ((observed.length / cohort.length) * 100).toFixed(1)
  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage:
      `submitted ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}. ` +
      `${observed.length}/${cohort.length} (${observedPct}%) of the in-window cohort carries an ` +
      `issue date at extract.`,
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
    la: {
      ...(existing.la ?? {}),
      newConstruction: stats,
      // Declared, not omitted: a reader of permitStats.json must be able to tell
      // "no breakdown was ever computed, so the aggregate IS the answer" from
      // "a breakdown exists and this tier was withheld" (rule 5).
      tierBreakdown: noTierBreakdown(
        'scripts/permits/la.mjs computes no tier split. Its query filters on permit_type = \'Bldg-New\' only, with no size restriction. (LA is WITHDRAWN and this script writes nothing today — see src/config/cities.ts.)',
      ),
      feed: feedCounts({
        totals,
        cohortRows: cohort.length,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. ` +
          `cohortRows: ${TYPE_FIELD}='${NEW_CONSTRUCTION_TYPE}' AND ${APPLIED_DATE_FIELD} ` +
          `>= ${since}, issued and not. The published n is smaller: it keeps only the ` +
          `${observed.length} rows carrying an issue date, then drops durations that are ` +
          `negative or over 120 months. Like everything else below the halt, this has never ` +
          `executed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote la.newConstruction:', stats)
}

// Exits NON-ZERO on the refusal, matching milwaukee.mjs rather than boston.mjs.
// Boston exits 0 because its gap is structural and permanent — a column that
// does not exist, which no re-run can change — so a zero exit stops a batch
// runner crying wolf. LA's is a LIVE-DATA condition that every run genuinely
// re-tests, on a city whose figure was published and then retracted. A silent
// exit 0 there is exactly rule 18's failure: the run would look like success.
main().catch((err) => {
  console.error(`\nla.mjs halted: ${err.message}\n`)
  process.exitCode = 1
})
