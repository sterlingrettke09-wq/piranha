#!/usr/bin/env node
// WO-7.1 — Seattle permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/seattle.mjs
//
// Pulls Seattle's "Building Permits" dataset from data.seattle.gov (Socrata),
// filters to new-construction permits, computes the median and 80th-percentile
// applied -> issued time in months, and WOULD merge the result into
// netlify/functions/lib/data/permitStats.json under seattle.newConstruction
// (aggregate) and seattle.byTier (single / multi / apartment).
//
// ⚠️ IT DOES NOT. Read the halt section below before changing anything here.
// This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why this script writes nothing (measured 2026-08-09) ──────────
// Seattle published 5.7 mo / p80 10.0 / n=4,996 from 2026-08-06 and is WITHDRAWN
// 2026-08-09, hours after NYC and for the same defect class. What makes this
// case worth reading is HOW it was found: nobody was auditing Seattle. The
// outcome-selection guard (scripts/permits/outcome-selection.ts) was built to
// stop city 24 inheriting the issued-only predicate by clone, and its registry
// refuses a `known-defect` exemption without a MEASURED share attached — so
// measuring Seattle's predicate was the price of exempting it, and the
// measurement disqualified the figure. The guard built to stop city 24 caught
// city 5.
//
// THE BLINDFOLD, removed first: `pull()` used to end
// `AND ${ISSUED_DATE_FIELD} IS NOT NULL`. A query that selects on the outcome
// cannot measure how often the outcome occurs (rule 11), so main() reproduced
// 5.7 exactly while this file's own RESULTS block below recorded a 74.1%
// issuance share four screens up from the query that could not see it — NYC's
// shape to the paragraph. The predicate is gone; the denominator now comes back
// from the server, which is the only thing that makes a gate possible.
//
// THE DISQUALIFIER. Measured 2026-08-09 against the live feed, through this
// script's own server-side cohort filter (both arms, applied since 2022-01-01),
// run with and without the limb:
//
//     6,980 in-window applications, 5,215 with an issue date = 74.71%
//
// (Server-side counts; the client-side STFI/DADU gates took the published n to
// 4,996. The RESULTS block below had already recorded the same fact client-side:
// 4,996 issued of 6,746 filings = 74.1%.)
//
// NOTE WHICH LIMB BINDS — LA's and NYC's shape, not SF's. 74.71% clears p50 and
// does not clear p80, so the median exists and the published p80 of 10.0 does
// not: the 80th percentile lands inside the unobserved 25.29%, past the last
// observation. The gate below therefore refuses on the p80 while the p50
// passes, and because this script publishes both, it writes nothing.
//
// ⚠️ THE MEDIAN IS NOT REPUBLISHED ALONE, for the Milwaukee reason. 5.7 at
// 74.71% observed is a CONDITIONAL median — time to issuance GIVEN issuance —
// and the only field that could state the condition is `vintage`, which no UI
// surface renders (src/lib/realityCheck.ts renders medianMonths / p80Months / n
// and never vintage). A conditional figure whose condition nobody can see is
// the exact reason Milwaukee's cleanly measured residential pair is withheld;
// Seattle's higher observed share does not exempt it. Publishing the median
// alone is a decision about where the condition is SHOWN, which is a product
// decision for a person, not an edit.
//
// ⚠️ THE TWO ARMS DO NOT AVERAGE. This pull is a union of a 'New' arm and a
// detached-ADU arm, and their observed shares differ (the 2026-08-06 RESULTS
// below: New arm 3,988/5,600 = 71.2%, DADU arm 1,008/1,146 = 88.0%). The gate
// reports each arm's share separately, because a pooled 74.71% reads as "the
// cohort is three-quarters observed" when the arm that dominates the published
// number — 'New', 83% of the union — sits at 71.2%. The DADU arm's high share
// cannot rescue the New arm's p80, and averaging them would claim it does.
// Both arms' shares are measurable at all only because both gates are
// FILING-TIME (`permittypedesc` and `description`; description is populated on
// 2001/2001 non-issued filings — the (A2) fix below). The pre-(A2) ADU gate on
// `dwellingunittype` was null for 100% of non-issued filings — issued-only BY
// CONSTRUCTION — and an arm gated that way has no denominator and cannot even
// state its own condition. Never reintroduce an issuance-time column as a gate.
//
// ⚠️ AND THE TIERS ARE WORSE THAN THE AGGREGATE. The withdrawn artifact carried
// byTier p50/p80s, and those cannot be re-identified even at a higher aggregate
// share: per-tier observed shares are only BOUNDED (housingunitsadded is 58.2%
// populated on non-issued rows, so 720 non-issued filings assign to no tier —
// see WHY BOUNDS below). On the recorded bounds every tier's lower bound is
// under 80 (single 71.1–88.4, multi 59.9–80.8, apartment 29.6–59.6), and
// apartment's interval straddles 50, so whether an apartment-tier MEDIAN even
// exists is indeterminate on this dataset. Republishing byTier needs that
// interval settled per tier, not just the aggregate gate cleared.
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Building Permits" on data.seattle.gov.
// Verify the schema by probing:
//   curl -s "https://data.seattle.gov/resource/76t5-zqzr.json?\$limit=1"
//   curl -s "https://data.seattle.gov/api/views/76t5-zqzr.json"  (full column list)
// Note: Socrata omits null fields from row JSON, so applieddate/issueddate won't
// appear in every probe row — confirm via the /api/views column list instead.
const RESOURCE_ID = '76t5-zqzr'
const HOST = 'data.seattle.gov'

// ── Which records count as new construction — REVISED 2026-08-06 ─────────────
//
// The old filter was `permittypedesc = 'New'`, full stop. Two defects, pulling
// in OPPOSITE directions. Both were measured against the retained set before
// either was acted on; a count alone would have told us the size of each
// correction and nothing about its sign.
//
// (A) UNDER-INCLUSION — a detached ADU is filed under either type. SDCI does not
//     use `permittypedesc` to separate ground-up from alteration for detached
//     accessory dwellings. Over applications since 2022-01-01 with both dates,
//     rows carrying `dwellingunittype` "Accessory Dwelling Detached" split
//     almost evenly across the two buckets:
//
//       permittypedesc = 'Addition/Alteration'   719   <- was EXCLUDED
//       permittypedesc = 'New'                   664   <- was included
//       Change of Use Only - No Construction      12    (correctly excluded)
//       Demolition                                 5    (correctly excluded)
//
//     A coin flip decided whether a backyard cottage was in our sample. That the
//     719 are real ground-up dwellings, not paperwork on someone else's project,
//     was checked four ways: 702/719 record `housingunitsadded = 1`; only 4/719
//     share a street address with any row in the 'New' set (so they are not
//     duplicates of a record we already had); all 719 are `permittypemapped =
//     'Building'` on the same -CN construction-permit series; and their median
//     estimated project cost is $166k, the price of a cottage, against $406k for
//     the 'New' set. Descriptions read "Construct new detached accessory
//     dwelling unit (DADU) ... per plan", with 2-4 plan-review cycles recorded.
//
//     TIMING — this is the part that sets the sign. The added set is FAST:
//
//       added   (Add/Alt detached-ADU)   n=714   median 2.8 mo   p80 5.4
//       retained ('New', STFI removed)   n=3988  median 6.3 mo   p80 10.9
//
//     Excluding a fast set biases the published figure UP. Seattle's correction
//     therefore runs the OTHER WAY from Austin's and Nashville's, where the
//     excluded records were the slow tail. The direction is a property of what
//     the criterion selects on, and does not carry between cities.
//
//     (A2) THE GATE ABOVE WAS ITSELF A CENSORING DEFECT — fixed 2026-08-06, same
//     day it shipped. The arm originally gated on `dwellingunittype LIKE
//     '%Accessory Dwelling Detached%'`. That column is written AT ISSUANCE, so
//     the gate selected only issued permits BY CONSTRUCTION. Measured on the
//     live feed, Addition/Alteration Building filings applied since 2022-01-01:
//
//       dwellingunittype non-null, NON-ISSUED filings      0 / 2001   (0.0%)
//       dwellingunittype non-null, issued filings       1204 / 17007  (7.1%)
//
//     `standardplan` and `zoning` show the identical 0% / 7.1% split — the same
//     fill-at-issuance cluster, which is what identifies the mechanism rather
//     than a coincidence. The consequence is not a biased number, it is an
//     UNINTERPRETABLE one: the tier this arm feeds had no denominator, so no
//     issuance rate could be computed for it and the 5.8-month figure could not
//     be read as a wait.
//
//     Note the second, independent censoring in the same column: all 308 of the
//     issued DADU rows the replacement finds that the old gate missed are
//     `housingcategory = 'Single-Family Add/Alt'`, a category where
//     `dwellingunittype` is populated for 4 of 11,623 rows. The old gate was
//     therefore censoring twice — by issuance AND by housing category — and the
//     n=714 above is BOTH right-censored and category-censored.
//
//     REPLACEMENT: `description`, gated client-side. Non-null on 2001/2001
//     (100.0%) non-issued filings, and 100% at every pre-issuance status
//     including 'Ready for Intake', the earliest — it is written by the
//     applicant at intake, which is the whole point of the change.
//
//     Fields evaluated and rejected, all measured on the same 2001 non-issued
//     filings rather than assumed:
//       · housingunitsadded / housingunitsremoved — 55.9% non-null. Sparse, and
//         sparse in the issuance-correlated direction (62.1% on issued). Same
//         defect class, smaller.
//       · permitclass / permitclassmapped / estprojectcost — 100% non-null but
//         they do not IDENTIFY a detached ADU; no value of any of them is
//         specific to one.
//       · housingcategory — 100% non-null, and it has DADU-bearing values, but
//         neither is usable alone: 'Pre-Approved DADU Plans' is 98.9% precise
//         and finds only 26.1% of them, while 'Middle Housing' mixes 518
//         detached ADUs with 379 ATTACHED ones, which this pipeline
//         deliberately excludes (see below).
//
//     The description gate was scored against `dwellingunittype` as ground truth
//     on the 1204 issued rows that carry it — the label exists only there, which
//     is exactly why the label cannot be the filter:
//
//       detached-mention only                  precision 92.7%  recall 97.5%
//       detached-mention AND NOT attached      precision 96.1%  recall 93.7%   <- used
//       'construct'-verb adjacent to DADU      precision 91.0%  recall 37.8%
//
//     The rejected false positives are one failure mode, not scatter: AADU
//     permits carrying the land-use clause "allow new attached and detached
//     accessory dwelling units". Excluding on the attached mention also drops 27
//     genuine mixed AADU+DADU projects, so this is a trade, and PERTURBATION
//     says the trade does not matter: the 28 false positives run a 4.1-month
//     median and the 27 true positives lost run 4.4, and the arm's median moves
//     3.1 -> 3.0 between the two rules. The choice is not load-bearing; it is
//     made on precision.
//
//     WHAT THE REPLACEMENT ARM MEASURES (vs the 714 the old gate found):
//
//       old gate (dwellingunittype)   714 issued,    0 non-issued,  714 filings
//                                     median 2.8 mo, issuance rate NOT COMPUTABLE
//       new gate (description)       1008 issued,  138 non-issued, 1146 filings
//                                     median 3.0 mo, issuance rate 88.0%
//
//     The replacement recovers 294 MORE issued detached ADUs than the old gate
//     (1008 vs 714) while running only 0.2 months slower, and it is the arm
//     acquiring a denominator — not the count — that is the point of the change.
//
// (B) OVER-INCLUSION — STFI permits are not plan-reviewed construction.
//     "Subject-to-Field-Inspection" is a distinct SDCI product: no code review
//     before issuance, compliance verified in the field by the inspector
//     (seattle.gov/construction-and-inspections, Tip #316). It covers pergolas,
//     detached garages, carports, parking pads, in-kind window replacement.
//     Applied-to-issued for these is a counter transaction, not a review time:
//
//       STFI                             n=135   median 0.1 mo   p80 0.6
//
//     Removing a set that fast biases the figure UP — the opposite of (A), and
//     smaller, so (A) wins the net. SDCI tags these in `description` ("STFI" /
//     "subject to field inspection"); the tag cross-checks against two
//     independent columns — 129/130 carry `numberreviewcycles = 0` and 130/130
//     carry a null `totaldaysplanreview`.
//
//     We match on the description tag and NOT on `totaldaysplanreview IS NULL`,
//     which looks like the cleaner structural gate and is wrong. That column is
//     null for 225 rows, of which only 130 are STFI; the other 95 are phased
//     high-rises and sibling permits of multi-building projects (median 3.1 mo,
//     p80 12.7, including a 30.6-month residential/retail tower). A null there
//     is a missing lookup, not a recorded absence of review — dropping on it
//     would have deleted the largest projects in the city.
//
// NOT CHANGED, and why:
//   · `permitclass = 'Vacant Land'` (33 rows, median 10.2) LOOKS like Austin's
//     non-building contamination and is not. Reading the descriptions: new
//     one- and two-family dwellings on unaddressed lots, a mixed-use apartment
//     building, park facilities. Two retaining walls ride along. Kept.
//   · No non-building denylist beyond STFI. The residue that carries no building
//     noun at all is 32 rows (median 3.8) and is mostly legitimate — a stadium,
//     a floating home, a gymnasium. A regex tuned to remove the rest would be
//     guessing, and 0.8% of the population does not move a median.
//   · Attached ADUs under 'Addition/Alteration' (380 rows) stay excluded: an
//     AADU is carved out of the existing house, which is an alteration.
//   · Right-censoring is NOT corrected here. Permits applied for but never
//     issued are absent from the sample entirely, so both figures understate
//     the true wait. That is a separate pass; a censoring correction applied to
//     a contaminated population is a precise wrong number. What (A2) buys is
//     that the censoring is now MEASURABLE for every arm — the correction still
//     has to be done.
//
// ── RESULTS after the (A2) re-specification, measured 2026-08-06 ─────────────
// ⚠️ WITHDRAWN 2026-08-09 — kept as the record of what shipped, not as figures
// to republish. Note that the 74.1% on the first line is the disqualifier: it
// was recorded HERE, beside the p80 it unidentifies, and restrained nothing —
// which is why the restraint is now refuseUnlessQuantilesAreObserved() below
// and not a comment (rule 14). See THE HALT at the top.
//
// Applied 2022-01-01 onward, STFI removed. Medians are over ISSUED rows; the
// issuance rate is issued / all filings.
//
//   aggregate      6746 filings, 4996 issued (74.1%)   median 5.7 mo   p80 10.0
//   New arm alone  5600 filings, 3988 issued (71.2%)   median 6.3 mo   p80 10.9
//   DADU arm       1146 filings, 1008 issued (88.0%)   median 3.0 mo
//
// The aggregate moves 5.8 -> 5.7 against the old gate. That the number barely
// moved is not evidence the old gate was fine: it was uninterpretable, not
// wrong by much.
//
// PER TIER — medians publish, issuance rates DO NOT. This is a real limit, not
// an omission:
//
//   tier        issued   median   p80    issuance rate
//   single        2623    5.0     8.5    71.1% - 88.4%   (bounded, not a point)
//   multi         1667    6.3    10.3    59.9% - 80.8%   (bounded, not a point)
//   apartment      424   10.4    18.5    29.6% - 59.6%   (bounded, not a point)
//
// WHY BOUNDS. tierOf() keys on `housingunitsadded`, and that column is subject
// to the SAME issuance censoring this pass was sent to remove — 97.0% populated
// on issued filings, 58.2% on non-issued. So 720 non-issued filings cannot be
// assigned to any tier. The naive per-tier rate silently drops all 720 from the
// denominators and is therefore biased HIGH; it is the upper bound above. The
// lower bound assigns all 720 to the tier in question. The true rate is inside
// the interval and nothing in this dataset narrows it further.
//
// `permitclass` is 100% populated and looks like the fix, and is not: within the
// issued rows, 'Single Family/Duplex' splits 2557 single / 1419 multi / 81
// apartment and 'Multifamily' splits 242 multi / 206 apartment / 50 single. It
// straddles both tier boundaries, so tiering the 720 by it would be a guess
// wearing a 100%-populated column. Publishing a point per-tier issuance rate
// here would repeat, one level down, the exact defect (A2) fixed — so the
// interval is the honest output and the point estimate is withheld.
//
// KNOWN LIMITATION, disclosed rather than silently fixed: within the 714 added
// rows, ~99 use conversion/remodel wording, and a minority of those are genuine
// garage-to-DADU conversions rather than ground-up builds. They are not
// separable by any structural column — the wording regex over-captures badly
// ("existing garage to be removed" is a teardown-and-build). That subset runs at
// median 3.7 mo, still far below the retained 6.3, so it cannot reverse the sign
// of the correction; it can only slightly overstate its size.
const TYPE_FIELD = 'permittypedesc'
const TYPE_MAPPED_FIELD = 'permittypemapped'
const PERMITCLASS_FIELD = 'permitclass'
const UNITS_ADDED_FIELD = 'housingunitsadded'
const DESCRIPTION_FIELD = 'description'

// SDCI's own tag for a no-plan-review permit. Case-insensitive; Socrata's LIKE
// is not, so this is applied client-side where it can also be counted.
const STFI_RE = /\bstfi\b|subject to field inspection/i

// The detached-ADU gate for the Addition/Alteration arm — see (A2) above. Read
// off `description`, which is populated at intake, and NOT off
// `dwellingunittype`, which is written at issuance and would re-censor the arm.
// DADU_RE selects; AADU_RE vetoes, because an attached ADU is an alteration to
// the existing house and is deliberately out of scope, and because the AADU
// land-use clause "allow new attached and detached accessory dwelling units" is
// the single source of this gate's false positives.
const DADU_RE = /\bDADU\b|detached\s+accessory\s+dwelling/i
const AADU_RE = /\bAADU\b|attached\s+accessory\s+dwelling/i

// Server-side prefilter for the same arm. Socrata's LIKE is case-sensitive, so
// this lowercases first; it is deliberately LOOSER than DADU_RE (bare substring,
// single space) so the exact gate above can run client-side where it is
// countable. Verified a strict superset on the live feed: 1231 rows prefiltered,
// all 1146 of the final selection inside it, 0 lost.
const DADU_SQL =
  `(lower(${DESCRIPTION_FIELD}) LIKE '%dadu%' ` +
  `OR lower(${DESCRIPTION_FIELD}) LIKE '%detached accessory dwelling%')`

// Filter to permits APPLIED on/after this date. Widen if the recent slice is thin.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2018-01-01'

const APPLIED_DATE_FIELD = 'applieddate'
const ISSUED_DATE_FIELD = 'issueddate'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'data.seattle.gov Building Permits (permittypedesc = New, plus ' +
  'Addition/Alteration rows whose filing-time description states a detached ADU ' +
  'and not an attached one; STFI excluded)'

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'
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
    throw new Error(`${HOST} returned HTTP 429 (rate limited). Wait a minute and re-run.`)
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

// The schema lives behind the /api/views metadata endpoint (row JSON drops nulls,
// so probing a single row can't prove a date column exists or is absent).
// Every row the resource holds, UNFILTERED — the grew-vs-shrank number. Goes
// through this script's own Socrata client so the count travels the same
// transport and error handling as the rows (rule 11). Best-effort: a failed
// count is recorded as an unknown and never aborts the run.
async function feedTotal() {
  return probeFeedTotal(`${HOST}/resource/${RESOURCE_ID}`, async () => {
    const rows = await socrata('json', { $select: 'count(1) AS n' })
    return rows[0]?.n
  })
}

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

// ── The quantiles this script publishes, and therefore the gate ─────────────
// Every quantile written into permitStats.json is listed here, and the gate below
// requires each one to be OBSERVED before anything is written. Adding a figure to
// `stats` without adding its quantile here is the way to break this, so keep the
// two together. Mirrors PUBLISHED_QUANTILES in sf.mjs, la.mjs and nyc.mjs.
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
// gate checks. This is an EXISTENCE condition, NOT a quality one: Seattle's
// 74.71% identifies the median and the median is still censoring-biased —
// identification says a p50 exists, not that 5.7 was it unconditionally.
// Clearing this gate would not make the pair publishable either: the byTier
// quantiles this script also writes need per-tier identification, and per-tier
// shares are only BOUNDED here (see WHY BOUNDS in the header).
const PUBLISHED_QUANTILES = [
  { q: 0.5, name: 'medianMonths' },
  { q: 0.8, name: 'p80Months' },
]

/**
 * THE STRUCTURAL HALT (evidence rule 14: convert a caught error into an
 * impossible state, not a comment).
 *
 * Returns the pooled observed share only if every quantile this script publishes
 * is identified by it; otherwise throws a ComputabilityHalt naming the limbs
 * that fail and the measured share behind them. Every path that could write
 * permitStats.json runs downstream of this call, so the script cannot emit a
 * Seattle figure without clearing it.
 *
 * The condition is MEASURED, not declared: every count comes back from the
 * server on every run, through the same filing-time gates that define the
 * published cohort. There is deliberately no flag, env var or `--force` that
 * reaches past it — a boolean someone can flip is a comment with a type, and
 * this file already proved a comment restrains nothing: the 74.1% sat in the
 * RESULTS block while 5.7 / p80 10.0 shipped.
 *
 * `arms` is reported per arm ('New' and DADU), never pooled away: the two arms'
 * shares differ by ~17 points and the arm that dominates the published number is
 * the LOWER one, so the pooled share alone would flatter it. The gate still
 * REFUSES on the pooled share — the artifact it protects is the pooled figure —
 * but the message must let a reader see which arm is dragging.
 *
 * @param {number} observedN filings carrying an issue date at extract
 * @param {number} cohortN   in-window filings passing the filing-time gates
 * @param {Array<{name: string, observed: number, cohort: number}>} arms
 */
class ComputabilityHalt extends Error {}

function refuseUnlessQuantilesAreObserved(observedN, cohortN, arms = []) {
  if (cohortN === 0) {
    throw new ComputabilityHalt(
      `The cohort is empty, so no share can be computed. Refusing to write.`,
    )
  }
  const share = observedN / cohortN
  const failing = PUBLISHED_QUANTILES.filter(({ q }) => !(share > q))
  if (failing.length === 0) return share
  const pct = (x) => `${(x * 100).toFixed(2)}%`
  const armLines = arms
    .map(
      (a) =>
        `    · ${a.name}: ${a.observed} of ${a.cohort} observed (${
          a.cohort ? pct(a.observed / a.cohort) : '—'
        })`,
    )
    .join('\n')
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
      `\n\n  PER ARM, because this cohort is a union and the arms do not average:\n` +
      `${armLines}\n` +
      `  The refusal is on the POOLED share (the published figure pools them), but the\n` +
      `  'New' arm is ~83% of the union and carries the lower share — a high DADU share\n` +
      `  cannot rescue the New arm's p80, and pooling must not be read as if it could.\n\n` +
      `  WHAT THE PASSING LIMBS DO NOT BUY YOU. Any quantile not listed above is\n` +
      `  IDENTIFIED, not GOOD: identification is an existence condition, and the\n` +
      `  identified median is still a median over the observed subset, i.e.\n` +
      `  conditional on issuance. That condition can only live in \`vintage\`, which\n` +
      `  no UI surface renders — the Milwaukee reason. Do not publish the median\n` +
      `  alone to get past this; deciding where the condition is SHOWN is a product\n` +
      `  decision for a person.\n\n` +
      `  AND THE TIERS ARE FURTHER AWAY, not closer. byTier p50/p80s need per-tier\n` +
      `  identification, and per-tier shares are only BOUNDED on this dataset\n` +
      `  (housingunitsadded is 58.2% populated on non-issued rows). On the recorded\n` +
      `  bounds no tier's lower bound clears 80, and apartment's straddles 50.\n\n` +
      `  WHAT WAS PUBLISHED AND WHY IT WAS PULLED: 5.7 mo / p80 10.0 / n=4,996\n` +
      `  shipped 2026-08-06 and was withdrawn 2026-08-09. The 74.1% observed share\n` +
      `  was recorded in this file's own RESULTS block while the query selected on\n` +
      `  the issue date being present and so could not see it (rule 11). Found by\n` +
      `  the outcome-selection guard's exemption measurement, not by an audit of\n` +
      `  Seattle.\n\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

// Which tier a permit belongs to. Mirrors buildingTier() in
// netlify/functions/lib/timeline.ts: single = 1 unit, multi = 2-4, apartment =
// 5+ AND all commercial/institutional.
//
// Seattle needs BOTH columns to answer this, and neither alone can.
// `permitclass` is complete but its "Single Family/Duplex" bucket straddles the
// single/multi boundary and "Multifamily" straddles multi/apartment;
// `housingunitsadded` gives the unit count buildingTier() actually keys on but
// is null-or-zero for ~5% of rows.
//
// That ~5% is measured on ISSUED rows and does not generalise: `housingunitsadded`
// is 97.0% populated on issued filings but only 58.2% on non-issued ones. Every
// row this function tiers is issued, so the medians it feeds are unaffected — but
// it is why no per-tier ISSUANCE RATE is published, only an interval. See the
// RESULTS block at the top before adding one.
//
// Returns null when the tier is UNKNOWN — such a row is counted in the aggregate
// but assigned to no tier. A row with no recorded unit count is a GAP, and
// defaulting it into 'single' (the shape a missing count most resembles) would
// manufacture an answer out of an absence.
function tierOf(row) {
  const pc = row.pclass
  // buildingTier() routes every commercial and institutional project to
  // 'apartment' regardless of unit count; industrial follows the same path.
  if (pc === 'Commercial' || pc === 'Institutional' || pc === 'Industrial') return 'apartment'
  const raw = row.units
  if (raw == null) return null
  const units = Number(raw)
  if (!Number.isFinite(units) || units < 1) return null
  if (units >= 5) return 'apartment'
  if (units >= 2) return 'multi'
  return 'single'
}

// Pull the in-window COHORT of new-construction filings, issued or not.
//
// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `issueddate IS NOT NULL`. It was
// here, and it is exactly why this script could not see its own disqualifier —
// a query that selects on the outcome cannot measure how often the outcome
// occurs (rule 11: measure the pipeline, not your probe). With it, main()
// reproduced 5.7 faithfully while the 74.1% issuance share sat in this file's
// own RESULTS block. The denominator has to come back from the server or there
// is no gate.
//
// Every remaining predicate is FILING-TIME, which is what makes the share a
// valid denominator: `permittypemapped`, `permittypedesc` and `applieddate` are
// assigned at intake, and the DADU prefilter reads `description`, which (A2)
// established is populated by the applicant at intake (2001/2001 non-issued
// filings) — so gating the cohort cannot preferentially drop unissued filings.
async function pull(since) {
  // See the block comment at the top for why the Addition/Alteration arm exists
  // and why it is limited to detached ADUs. DADU_SQL is only the loose server-side
  // prefilter; the exact gate (DADU_RE / AADU_RE) runs in main() so its rejects
  // can be counted. `permittypemapped = 'Building'`
  // keeps the union on building permits — it is redundant for the 'New' arm
  // (all 31,941 'New' rows are Building) but is the gate that stops the
  // Addition/Alteration arm from ever reaching a non-building permit type.
  const where =
    `${TYPE_MAPPED_FIELD} = 'Building' ` +
    `AND (${TYPE_FIELD} = 'New' ` +
    `     OR (${TYPE_FIELD} = 'Addition/Alteration' AND ${DADU_SQL})) ` +
    `AND ${APPLIED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL`
  return socrata('json', {
    $select:
      `${APPLIED_DATE_FIELD} AS applied, ${ISSUED_DATE_FIELD} AS issued, ` +
      `${PERMITCLASS_FIELD} AS pclass, ${UNITS_ADDED_FIELD} AS units, ` +
      `${DESCRIPTION_FIELD} AS descr, ${TYPE_FIELD} AS ptype`,
    $where: where,
    $limit: '50000',
  })
}

async function main() {
  console.log(`Seattle permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm every column the filter reads exists in the live schema. A
  //    missing one must halt the run, not silently narrow the population:
  //    dropping `description` would quietly delete the entire detached-ADU arm
  //    and re-publish the old under-inclusive figure with no warning.
  //    `dwellingunittype` is deliberately NOT checked — the pipeline no longer
  //    reads it (see (A2)), and requiring a column nothing reads would make a
  //    schema change halt a run it cannot affect.
  const fields = await fieldNames()
  for (const f of [
    APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD, TYPE_MAPPED_FIELD,
    PERMITCLASS_FIELD, UNITS_ADDED_FIELD, DESCRIPTION_FIELD,
  ]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged BEFORE the halt below. Seattle refuses to write —
  //     its figure was published and then WITHDRAWN — so these two lines are what
  //     a run here leaves behind, and they are what answers "has the feed changed
  //     since the last extract?" without a re-derivation.
  const totals = [await feedTotal()]
  logFeedTotals(totals)

  // 2. Pull the sample; widen the window if the recent slice is thin.
  let since = SINCE
  let rows = await pull(since)
  if (rows.length < 50) {
    console.warn(`  Only ${rows.length} rows since ${SINCE}; widening to ${SINCE_WIDE}.`)
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. The client-side FILING-TIME gates define the cohort — issued or not.
  //    Both gates read `description`, populated at intake (see (A2)), so a row's
  //    membership cannot depend on whether it later issued. The cohort this loop
  //    keeps is the population the published figure would describe, which is why
  //    the observed share is computed AFTER these gates and not before.
  const cohort = []
  let stfi = 0
  let notDadu = 0
  for (const row of rows) {
    // The STFI gate. A no-plan-review counter permit is not a new-construction
    // review time; its applied->issued span is a transaction, not a wait.
    if (STFI_RE.test(String(row.descr ?? ''))) {
      stfi++
      continue
    }
    // The exact detached-ADU gate for the Addition/Alteration arm. The 'New' arm
    // is not subject to it. DADU_RE must hit and AADU_RE must not — see (A2).
    if (row.ptype !== 'New') {
      const descr = String(row.descr ?? '')
      if (!DADU_RE.test(descr) || AADU_RE.test(descr)) {
        notDadu++
        continue
      }
    }
    cohort.push(row)
  }
  logCohortRows(
    cohort.length,
    `permittypemapped='Building' AND (New OR detached-ADU Add/Alt), applied >= ${since}, after the STFI and DADU gates`,
  )
  console.log(`  excluded ${stfi} STFI rows (no-plan-review field-inspection permits)`)
  console.log(`  excluded ${notDadu} prefiltered Add/Alt rows the exact DADU gate rejected`)

  // 4. THE ISSUANCE SHARE, per arm and pooled, and the halt. Printed before it
  //    is judged, so the refusal is inspectable and a future reader can watch
  //    the number move. Socrata omits null fields from row JSON, so a missing
  //    `issued` key IS the null issue date.
  const issued = cohort.filter((r) => r.issued != null)
  const arms = ['New', 'detached-ADU (Add/Alt)'].map((name, idx) => {
    const inArm = (r) => (idx === 0 ? r.ptype === 'New' : r.ptype !== 'New')
    return {
      name,
      cohort: cohort.filter(inArm).length,
      observed: issued.filter(inArm).length,
    }
  })
  const pct = (obs, n) => (n ? `${((obs / n) * 100).toFixed(2)}%` : '—')
  console.log(
    `  cohort ${cohort.length} filings, ${issued.length} with an issue date (${pct(issued.length, cohort.length)})`,
  )
  for (const a of arms) {
    console.log(`     ${a.name}: ${a.observed}/${a.cohort} (${pct(a.observed, a.cohort)})`)
  }

  // By application year, because the pooled share hides the censoring gradient:
  // recent cohorts have had less time to issue, and it is that slope — not the
  // pooled number — that shows a pooled median is dragged down by immature
  // filings.
  const byYear = {}
  for (const r of cohort) {
    const t = Date.parse(r.applied)
    if (Number.isNaN(t)) continue
    const y = new Date(t).getUTCFullYear()
    byYear[y] ??= { n: 0, obs: 0 }
    byYear[y].n += 1
    if (r.issued != null) byYear[y].obs += 1
  }
  for (const y of Object.keys(byYear).sort()) {
    const { n, obs } = byYear[y]
    console.log(`     ${y}  ${String(obs).padStart(5)}/${String(n).padEnd(5)} ${((obs / n) * 100).toFixed(1)}%`)
  }

  refuseUnlessQuantilesAreObserved(issued.length, cohort.length, arms)

  // ── Nothing below here has run since the gate was added. ───────────────────
  // It is written to be correct on the day Seattle's observed share clears every
  // published quantile, and it is deliberately NOT reachable by a caveat, a flag
  // or an env var. Treat its first run as new code — and re-read the header
  // first, because clearing the aggregate gate resolves IDENTIFICATION of the
  // pooled quantiles only. It does NOT license byTier: per-tier shares are only
  // BOUNDED on this dataset (housingunitsadded is 58.2% populated on non-issued
  // rows, so the non-issued residue assigns to no tier), and a tier's quantile
  // is identified only when its LOWER-bound share clears it. Settle that per
  // tier before a byTier block ships again, or ship without one the way
  // philadelphia.mjs does.

  // 5. Durations over the ISSUED subset, dropping negatives and > 120-month
  //    outliers.
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let untiered = 0
  let dadusAdded = 0
  for (const row of issued) {
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d < 0 || d > 120 * 30.44) continue
    days.push(d)
    if (row.ptype !== 'New') dadusAdded++
    const tier = tierOf(row)
    if (tier === null) untiered++
    else byTier[tier].push(d)
  }
  console.log(`  included ${dadusAdded} detached-ADU rows SDCI typed as Addition/Alteration`)
  console.log(`  ${untiered} rows carry no usable unit count — in the aggregate, in no tier`)

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 6. Sanity gate.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing.`,
    )
    return
  }

  // The observed share travels WITH the figure, not just through the gate. It is
  // the one number censoring cannot bias, and it is the condition under which the
  // median is true — which is precisely what the withdrawn 5.7 failed to carry
  // anywhere a reader could see. Note that putting it in `vintage` is NOT
  // sufficient on its own: src/lib/realityCheck.ts does not render `vintage`, so
  // republishing Seattle also requires deciding where the condition is SHOWN.
  const stamp = new Date().toISOString().slice(0, 10)
  const observedPct = ((issued.length / cohort.length) * 100).toFixed(1)
  const vintage =
    `applied ${since} onward; computed ${stamp}; ${DATASET_NAME}. ` +
    `${issued.length}/${cohort.length} (${observedPct}%) of the in-window cohort carries an ` +
    `issue date at extract; this is a median over the observed subset and is still subject ` +
    `to right-censoring.`

  // Per-tier figures. ⚠️ IDENTIFICATION FIRST: this split must not ship again
  // until each published tier's LOWER-bound observed share clears each published
  // quantile — the aggregate gate above does not check this, because per-tier
  // shares are only bounded (see the header). The 2026-08-06 figures failed it
  // for every tier at p80.
  // The aggregate is kept for compatibility but is the WEAKER
  // number: of the 4996 issued rows, 52.5% were single-tier at 5.0 months and
  // 8.5% apartment-tier at 10.4, so the 5.7-month headline understated a
  // 5+-unit project by nearly 2x. A consumer that knows the tier should always
  // prefer byTier (see measuredFor()).
  // The n<30 publication floor and the RECORD of every tier it withholds come out
  // of one call, so a tier can no longer be dropped silently — see
  // scripts/permits/lib/tierFloor.mjs. `tierBreakdown` is written beside `byTier`
  // and is what tells measuredFor() to fail closed rather than serve the
  // aggregate for a withheld tier.
  const { tiers, tierBreakdown } = splitTiersAtFloor(byTier, (rows) => ({
    medianMonths: daysToMonths(quantile(rows, 0.5)),
    p80Months: daysToMonths(quantile(rows, 0.8)),
    n: rows.length,
    vintage,
  }))
  console.log('  by tier:', Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 7. Idempotent merge.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    seattle: {
      ...(existing.seattle ?? {}),
      newConstruction: stats,
      byTier: tiers,
      tierBreakdown,
      feed: feedCounts({
        totals,
        cohortRows: cohort.length,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. ` +
          `cohortRows: ${TYPE_MAPPED_FIELD}='Building' AND (${TYPE_FIELD}='New' OR the ` +
          `detached-ADU Addition/Alteration arm) AND ${APPLIED_DATE_FIELD} >= ${since}, after ` +
          `the client-side STFI and exact-DADU gates — issued and not, since both gates read ` +
          `fields populated at intake. The published n is smaller: it keeps only the ` +
          `${issued.length} rows carrying an issue date, then drops durations that are ` +
          `negative or over 120 months. Like everything else below the halt, this has never ` +
          `executed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote seattle.newConstruction:', stats)
}

main().catch((err) => {
  if (err instanceof ComputabilityHalt) {
    // A refusal BY DESIGN, and it exits NON-ZERO — the same choice sf.mjs,
    // nyc.mjs and milwaukee.mjs make, and for the same reason. This is a
    // LIVE-DATA condition that every run genuinely re-tests, on a city whose
    // figure was published and then retracted. A silent exit 0 here is rule 18's
    // failure exactly: the run would look like success. (boston.mjs exits 0
    // because its gap is a column that does not exist and no re-run can change
    // it.)
    console.error(`\nseattle.mjs — NOT COMPUTABLE, by design:\n    ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\nseattle.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
