#!/usr/bin/env node
// WO-7.1 — San Francisco permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/sf.mjs
//
// Pulls San Francisco's "Building Permits" dataset from data.sfgov.org (Socrata),
// filters to new-construction permit types, computes the median and 80th-
// percentile filing -> issuance time in months, and WOULD merge the result into
// netlify/functions/lib/data/permitStats.json under sf.newConstruction.
//
// ⚠️ IT DOES NOT, AND CANNOT. Read the halt section below before changing
// anything here. This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why this script writes nothing (measured 2026-08-09) ──────────
// SF was published for part of one session and WITHDRAWN 2026-08-06. Until today
// nothing in this file enforced that: the withdrawal lived in permitStats.json
// (by absence) and in a test, so re-running the script merged the disqualified
// figure straight back into production data. The refusal is now STRUCTURAL —
// see refuseUnlessQuantilesAreObserved(), which every write path runs downstream
// of — rather than a comment describing a decision.
//
// THE DISQUALIFIER, and it is recomputed from the feed on every run: most of the
// cohort carries NO ISSUE DATE, so the quantiles this script publishes do not
// exist. Measured 2026-08-09 against the live feed, through this script's own
// filters (permit_type 1,2 + primary_address_flag='Y' + the building allowlist):
//
//     351 filings since 2022-01-01, of which 132 carry an issue date = 37.61%
//
// which reproduces the 37.7% recorded on 2026-08-06 and the 37.0% re-measured on
// 2026-08-08 (the drift is denominator growth on a live feed — the numerator was
// unchanged at 145 pre-gate — not a contradiction).
//
// WHY THAT KILLS THE MEDIAN, stated as arithmetic rather than as caution. Sort
// every filing in the cohort by time-to-issuance and the ones with no issue date
// sort ABOVE every observed value — whatever their eventual duration, it is
// longer than the longest we have seen. With 37.61% observed, the 50th percentile
// of that ordering lands inside the unobserved 62.39%: it is past the last
// observation. The median does not exist. It is not imprecise, not a floor, not
// "biased low" — there is no number there. A label cannot rescue it; a "floor"
// label makes an absent number look cautious, which is worse than none (rule 7).
//
// The same argument disqualifies the p80 a fortiori, and every per-tier figure.
// Over this same window, measured 2026-08-09: single 39.4% (50/127), multi 30.1%
// (34/113), apartment 43.2% (48/111) — no tier clears 50% either, and the gate
// re-runs per tier so a future aggregate cannot carry a thin tier over the line.
// (The 2026-08-06 record reports the MATURED 2022 cohort instead — single 32.4%,
// multi 23.4%, apartment 44.4%. Different subpopulation, same conclusion; do not
// read the two sets of numbers as a disagreement.)
//
// ⚠️ STATE THE SHARE, NOT THE FATE. This feed does not distinguish a not-yet from
// a never. Of SF's non-issued rows, 173 sit at `filed`, 36 `approved`, 21
// `withdrawn`, 16 `reinstated`, 1 `cancelled` — so "37.6% ever issue" is
// unsupported phrasing and is retracted. What is measured is the share carrying
// an issue date AT EXTRACT, and the undefinedness above does not depend on fate:
// a median past the last observation is undefined under either reading.
//
// ── Two defects CORRECTED 2026-08-06 ────────────────────────────────────────
// An audit of the published figure (n=165, median 11.8) found the sampled
// population was BOTH duplicated and contaminated. Both corrections push the
// median UP, so the shipped number was too LOW. Measurements below are against
// the live window pulled 2026-08-06 (177 rows under the old filter).
//
// (1) ADDRESS FAN-OUT — 18.1% of rows were not permits.
//     This dataset emits ONE ROW PER ADDRESS, not one row per permit. A permit
//     covering a corner lot or a two-address building appears 2-3 times, and
//     `permit_number`, `filed_date` and `issued_date` are IDENTICAL on every
//     copy. 177 rows carried only 145 distinct permit numbers.
//
//     DIAGNOSIS MATTERS — this is a join-style fan-out, NOT the Austin pattern
//     of one project filing many permits. The discriminator is the date legs: in
//     all 30 duplicated groups the copies share the same filed_date AND the same
//     issued_date (0 groups differ), so they are re-emissions of one permit
//     rather than distinct filings, and the correction is a DEDUPE, not a
//     re-weighting. (SF does also show a little of the Austin pattern — "bldg
//     a"/"bldg b" pairs on one lot — but those carry DIFFERENT permit numbers
//     and are genuinely separate permits, so they are left alone.)
//
//     Fix: `primary_address_flag = 'Y'`. Verified dataset-wide, not just in the
//     window: over the whole permit_type 1,2 slice that predicate yields 12,836
//     rows carrying 12,836 distinct permit numbers — exactly one row per permit.
//
//     SIGN: the duplicate rows were FAST. Removed set n=32, median 9.1 mo,
//     against 11.8 for the retained permits — multi-address permits run 9.1 mo
//     vs 12.0 for single-address ones, so the duplication was over-weighting the
//     quick end of the distribution. Deduping alone moves 11.5 -> 11.8.
//
// (2) NON-BUILDING CONTAMINATION — 9.0% (13 of the 145 deduped permits).
//     `permit_type` 1/2 says the WORK is new construction. It says nothing about
//     whether the thing is a BUILDING. The admitted set included two greenhouses,
//     two storage sheds, two detached garages, a play structure's footings, two
//     bare modular-foundation permits, an accessory office/gym shed, and two
//     "accessory to dwelling" outbuildings ($25k and $85k).
//
//     SIGN: the contamination was FAST. Removed set n=13, median 7.7 mo, against
//     12.5 for the retained buildings.
//
// NET: median 11.5 -> 12.5, p80 24.0 -> 25.3, n 177 -> 132. Both corrections
// point the same way; the published 11.8 was biased LOW.
//
// ⚠️ NOT corrected here: right-censoring. This median is conditional on eventual
// issuance — permits filed and never issued are absent from the sample entirely,
// which biases the figure DOWN for recent cohorts. That is a separate pass (see
// docs/VERIFICATION-LEDGER.md), and applying it on top of this correction is the
// right order, not the reverse.
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

// ── The building gate — ALLOWLIST, never a denylist ─────────────────────────
// A `proposed_use` we have never seen is EXCLUDED rather than admitted, so a new
// SF category cannot quietly re-contaminate this. The vocabulary was read off the
// portal (79 distinct values under permit_type 1,2), not guessed.
//
// Two kinds of admitted use, because they need different tests:
//
//   DWELLING_UNIT_USES — uses whose NAME asserts a dwelling count. For these,
//   `proposed_units >= 1` is REQUIRED. This is what catches the two "accessory to
//   dwelling" outbuildings: they carry proposed_use = '1 family dwelling' but
//   proposed_units = 0, i.e. the use field describes the parcel's dwelling, not
//   the structure being built. A residential use proposing zero dwellings is an
//   accessory structure.
//
//   OTHER_BUILDING_USES — occupiable buildings with no per-unit count, where
//   proposed_units is legitimately 0/null (schools, warehouses, rec centres). A
//   units test here would wrongly drop them; it wrongly dropped a residential
//   care facility ('misc group residns.', 23.4 mo) on the first pass.
//
// Deliberately EXCLUDED, with what each cost in the current window: greenhouse
// (2), storage shed (2), prkng garage/private (1), and null use (6). The
// vocabulary's other non-buildings — parking lot, fence/retaining wall, swimming
// pool, tower, antenna, storage tanks, vacant lot, not applicable — do not occur
// in the window but are excluded by the same allowlist.
//
// KNOWN COST, stated rather than hidden: the null-use exclusion also drops two
// legitimate buildings ("site permit 2 of 4" and "3 of 4" of a fire-department
// training facility, 5.6 and 7.7 mo). An allowlist cannot admit a row with no
// category without becoming a denylist, and rule 5 says a missing lookup must not
// render as an answer. Their sibling "4 of 4" carries a real use and is retained.
const DWELLING_UNIT_USES = new Set([
  '1 family dwelling',
  '2 family dwelling',
  'apartments',
  // Present in the portal's vocabulary but not in the current window, so adding
  // them changes today's output by exactly ZERO rows (verified). They are listed
  // so a future refresh does not silently drop real housing.
  'artist live/work',
  'residential hotel',
  'accessory cottage',
])

const OTHER_BUILDING_USES = new Set([
  'misc group residns.',
  'school',
  'day care center',
  'recreation bldg',
  'office',
  'sfpd or sffd station',
  'warehouse,no frnitur',
  'warehouse, furniture',
  'moving & storage',
  'food/beverage hndlng',
])

/** Proposed dwelling count as a number, or null when absent/unparseable. */
function proposedUnits(row) {
  const n = Number(row.proposed_units)
  return Number.isFinite(n) ? n : null
}

/** The subset of rows that are buildings. */
function selectBuildings(rows) {
  return rows.filter(isBuilding)
}

/** Is this permit for a BUILDING (as opposed to a shed, garage, greenhouse…)? */
function isBuilding(row) {
  const use = String(row.proposed_use)
  if (DWELLING_UNIT_USES.has(use)) {
    const n = proposedUnits(row)
    return n !== null && n >= 1
  }
  return OTHER_BUILDING_USES.has(use)
}

// Which building tier a row belongs to. Mirrors buildingTier() in
// netlify/functions/lib/timeline.ts: single = 1 unit, multi = 2-4, apartment =
// 5+ AND all commercial/institutional.
function tierOf(row) {
  if (!DWELLING_UNIT_USES.has(String(row.proposed_use))) return 'apartment'
  const n = proposedUnits(row)
  if (n >= 5) return 'apartment'
  if (n >= 2) return 'multi'
  return 'single'
}

// Filter to permits FILED on/after this date (keeps the vintage recent). If the
// resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2018-01-01'

// ── The quantiles this script publishes, and therefore the gate ─────────────
// Every quantile written into permitStats.json is listed here, and the gate
// below requires each one to be OBSERVED before anything is written. Adding a
// figure to `stats` without adding its quantile here is the way to break this,
// so keep the two together.
//
// WHY THESE NUMBERS AND NOT OTHERS: they are not thresholds anyone chose. The
// threshold for a quantile IS THE QUANTILE. Order the cohort by time-to-issuance
// and every filing without an issue date sorts above every observed one, so the
// p-th quantile is identified only when the observed share exceeds p; at or
// below p it lies inside the unobserved mass, i.e. past the last observation.
// The comparison is strict — at exactly p the quantile sits on the boundary
// between the last observed value and the censored mass and is not identified.
//
// NO SAFETY MARGIN IS ADDED, deliberately. Padding these to (say) 0.6 and 0.9
// would look conservative and would be an invented number (rule 4). More
// importantly it would misrepresent what the gate checks: this is an EXISTENCE
// condition, NOT a quality one. Clearing it does not make the estimate good —
// a cohort 55% observed still needs Kaplan-Meier, not a median-of-issued — which
// is why the halt message says so rather than implying the opposite.
const PUBLISHED_QUANTILES = [
  { q: 0.5, name: 'medianMonths' },
  { q: 0.8, name: 'p80Months' },
]

// Required date columns. If either is missing from the live schema we refuse to
// fabricate a latency figure and leave the artifact untouched (the Boston lesson).
const FILED_DATE_FIELD = 'filed_date'
const ISSUED_DATE_FIELD = 'issued_date'
const TYPE_FIELD = 'permit_type'
const PERMIT_NUMBER_FIELD = 'permit_number'
const PRIMARY_ADDRESS_FIELD = 'primary_address_flag'
const PROPOSED_USE_FIELD = 'proposed_use'
const PROPOSED_UNITS_FIELD = 'proposed_units'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'data.sfgov.org Building Permits (permit_type 1,2 = new construction; ' +
  'primary_address_flag = Y to collapse the one-row-per-address fan-out; ' +
  'proposed_use allowlist = buildings only)'

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'

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

// Column names from the dataset METADATA, not from a sample row. A `$limit=1`
// probe omits any field that happens to be null on that row, so it reports a
// present column as missing — measuring the probe rather than the schema.
async function fieldNames() {
  const url = new URL(`https://${HOST}/api/views/${RESOURCE_ID}.json`)
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${HOST} metadata returned HTTP ${res.status} ${res.statusText}`)
  const meta = await res.json()
  return new Set((meta.columns ?? []).map((c) => c.fieldName))
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
 * Returns only if every quantile this script publishes is identified by the
 * observed share; otherwise throws a ComputabilityHalt naming the limbs that
 * fail and the measured share behind them. Every path that could write
 * permitStats.json runs downstream of this call, so the script cannot emit an SF
 * figure without clearing it — the refusal is a property of the file rather than
 * an accident of ordering, which is the distinction Boston's previous pipeline
 * failed to make (it halted for the right reason by luck, on a missing column,
 * while its filter was 58% contaminated underneath).
 *
 * There is deliberately no flag, env var or `--force` that reaches past this. A
 * boolean someone can flip is a comment with a type; the only thing that opens
 * the gate is SF's feed reporting a different share.
 */
class ComputabilityHalt extends Error {}

function refuseUnlessQuantilesAreObserved(observedN, cohortN) {
  if (cohortN === 0) {
    throw new ComputabilityHalt(
      `The cohort is empty, so no share can be computed. Refusing to write.`,
    )
  }
  const share = observedN / cohortN
  const failing = PUBLISHED_QUANTILES.filter(({ q }) => !(share > q))
  if (failing.length === 0) return share
  const pct = (x) => `${(x * 100).toFixed(2)}%`
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
      `\n\n  This is a GAP, not a finding that SF is slow, and NOT a floor. A "floor" label\n` +
      `  claims the true value is higher and we have bounded it from below; nothing here\n` +
      `  bounds anything. Labelling an undefined statistic only makes an absent number\n` +
      `  look cautious (rule 7). Do not substitute the median of the issued rows, an\n` +
      `  older cohort, or a caveat string — restricting to a matured cohort reduces\n` +
      `  right-truncation but does NOT remove selection on the outcome, so it buys a\n` +
      `  better CONDITIONAL median, never an unconditional one.\n\n` +
      `  STATE THE SHARE, NOT THE FATE: this feed does not distinguish a not-yet from a\n` +
      `  never, so do not rewrite the above as "${pct(1 - share)} never issue".\n\n` +
      `  And note what clearing this gate would and would not mean. It is an EXISTENCE\n` +
      `  condition. A cohort just over ${pct(0.5)} observed yields a median that exists and\n` +
      `  is still badly biased by censoring — that needs Kaplan-Meier, not this script.\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

// Pull the in-window cohort for new-construction permits filed since `since`.
//
// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `issued_date IS NOT NULL`. It used
// to be, and that is precisely why this script could not see its own
// disqualifier — a query that selects on the outcome cannot measure how often
// the outcome occurs. It reported n=132 issued permits and had no idea they were
// 37.61% of the filings. The denominator has to come back from the server or
// there is no gate. (Rule 11: measure the pipeline, not your probe.)
//
// Every other predicate is FILING-TIME, which is what makes the share a valid
// denominator: permit_type and primary_address_flag are set at intake, and
// `proposed_use` — the field the building allowlist reads — is populated on 98%
// of non-issued rows (5 of 248 null, against 6 of 145 issued), so gating the
// cohort does not preferentially drop unissued filings. main() re-measures that
// on every run rather than trusting this comment.
async function pull(since) {
  const typeList = NEW_CONSTRUCTION_TYPES.map((t) => `'${t}'`).join(',')
  // `primary_address_flag = 'Y'` collapses the one-row-per-address fan-out
  // server-side — see the header. The client-side dedupe below is a guard, not
  // the mechanism.
  const where =
    `${TYPE_FIELD} IN (${typeList}) ` +
    `AND ${PRIMARY_ADDRESS_FIELD} = 'Y' ` +
    `AND ${FILED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${FILED_DATE_FIELD} IS NOT NULL`
  const rows = await socrata('json', {
    $select:
      `${FILED_DATE_FIELD} AS filed, ${ISSUED_DATE_FIELD} AS issued, ` +
      `${PERMIT_NUMBER_FIELD} AS permit, ${PROPOSED_USE_FIELD} AS proposed_use, ` +
      `${PROPOSED_UNITS_FIELD} AS proposed_units`,
    $where: where,
    $limit: '50000',
  })
  return rows
}

async function main() {
  console.log(`SF permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm every field we depend on exists in the live schema.
  const fieldIds = await fieldNames()
  for (const f of [
    FILED_DATE_FIELD,
    ISSUED_DATE_FIELD,
    TYPE_FIELD,
    PERMIT_NUMBER_FIELD,
    PRIMARY_ADDRESS_FIELD,
    PROPOSED_USE_FIELD,
    PROPOSED_UNITS_FIELD,
  ]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the sample. Widen the window if the usable slice is thin (< 50).
  //    The threshold is checked on the count that SURVIVES the building gate AND
  //    carries an issue date — that is the n the figure would rest on. Checking
  //    it on the raw row count, or on the whole cohort, measures a window that is
  //    only wide enough before filtering.
  const issuedBuildings = (rows) => selectBuildings(rows).filter((r) => r.issued != null)
  let since = SINCE
  let rows = await pull(since)
  if (issuedBuildings(rows).length < 50) {
    console.warn(
      `  Only ${issuedBuildings(rows).length} issued buildings (of ${rows.length} rows) ` +
        `since ${SINCE}; widening to ${SINCE_WIDE}.`,
    )
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. Dedupe guard. `primary_address_flag = 'Y'` is verified to be one row per
  //    permit across the whole permit_type 1,2 slice (12,836 rows / 12,836
  //    permit numbers), so this should never fire — it exists so that if SF ever
  //    changes the flag's semantics, the fan-out cannot silently return.
  const seen = new Set()
  const unique = []
  for (const row of rows) {
    if (row.permit != null && seen.has(row.permit)) continue
    if (row.permit != null) seen.add(row.permit)
    unique.push(row)
  }
  if (unique.length !== rows.length) {
    console.warn(
      `  ${rows.length - unique.length} duplicate permit_number rows survived ` +
        `${PRIMARY_ADDRESS_FIELD}='Y' — the flag's meaning may have changed. Deduped.`,
    )
  }

  // 4. The building gate. Anything not on the allowlist is DROPPED, never
  //    bucketed — an unrecognised category must not fall through into the
  //    aggregate. Excluded uses are logged BY NAME so a legitimate new category
  //    surfaces loudly instead of vanishing.
  const kept = selectBuildings(unique)
  const excluded = unique.filter((r) => !isBuilding(r))
  if (excluded.length > 0) {
    const byUse = {}
    for (const r of excluded) {
      const label = r.proposed_use == null ? '(no proposed_use)' : String(r.proposed_use)
      byUse[label] = (byUse[label] ?? 0) + 1
    }
    const pct = ((excluded.length / unique.length) * 100).toFixed(1)
    console.log(`  excluded ${excluded.length} non-building permits (${pct}%):`)
    for (const [use, n] of Object.entries(byUse).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(4)}  ${use}`)
    }
  }

  // 5. THE ISSUANCE SHARE, and the halt. Printed before it is judged, so the
  //    refusal is inspectable and so a future reader can see the number move.
  const issued = kept.filter((r) => r.issued != null)

  // The gate's own validity check (rule 11 — measure the pipeline, not the
  // probe). The share is computed AFTER the building allowlist, which is only
  // legitimate while `proposed_use` is populated at FILING time. If SF ever
  // starts assigning it during review, the allowlist would drop unissued rows
  // preferentially and the denominator would be the instrument measuring itself
  // — Raleigh's `proposeduse` does exactly that (blank on 26.8% of not-yet-issued
  // rows), which is why its rate is computed BEFORE its building gate.
  const nullUseUnissued = unique.filter((r) => r.issued == null && r.proposed_use == null).length
  const nullUseIssued = unique.filter((r) => r.issued != null && r.proposed_use == null).length
  const unissuedTotal = unique.filter((r) => r.issued == null).length
  const issuedTotal = unique.length - unissuedTotal
  console.log(
    `  ${PROPOSED_USE_FIELD} null on ${nullUseUnissued}/${unissuedTotal} non-issued vs ` +
      `${nullUseIssued}/${issuedTotal} issued — a filing-time field, so the post-gate ` +
      `denominator is sound`,
  )

  const byTierCohort = { single: [], multi: [], apartment: [] }
  for (const row of kept) byTierCohort[tierOf(row)].push(row)
  console.log(`  cohort ${kept.length} filings, ${issued.length} with an issue date:`)
  for (const [tier, rowsOfTier] of Object.entries(byTierCohort)) {
    const obs = rowsOfTier.filter((r) => r.issued != null).length
    const share = rowsOfTier.length ? ((obs / rowsOfTier.length) * 100).toFixed(1) : '—'
    console.log(`     ${tier.padEnd(10)} ${String(obs).padStart(4)}/${String(rowsOfTier.length).padEnd(5)} ${share}%`)
  }

  refuseUnlessQuantilesAreObserved(issued.length, kept.length)

  // ── Nothing below here has run since the gate was added. ───────────────────
  // It is written to be correct on the day SF's observed share clears every
  // published quantile, and it is deliberately NOT reachable by a caveat, a flag
  // or an env var: there is no way to talk this script into publishing a
  // quantile that is not identified. Treat its first run as new code.

  // 6. Compute durations, dropping negatives and absurd outliers (> 120 months).
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  for (const row of issued) {
    const a = Date.parse(row.filed)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) {
      days.push(d)
      byTier[tierOf(row)].push(d)
    }
  }

  if (days.length === 0) {
    console.warn('  No usable filed/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 7. Sanity gate. A median under half a month or a tiny n is not trustworthy.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); ` +
        `not writing. Investigate the dataset before trusting this.`,
    )
    return
  }

  // The observed share travels WITH the figure, not just through the gate. It is
  // the one number censoring cannot bias, and a reader of permitStats.json has
  // to be able to see how far from undefined this median was.
  const observedPct = ((issued.length / kept.length) * 100).toFixed(1)
  const vintage =
    `filed ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}. ` +
    `${issued.length}/${kept.length} (${observedPct}%) of the in-window cohort carries an issue ` +
    `date at extract; this is a median over the observed subset and is still subject to ` +
    `right-censoring.`

  // 8. Per-tier figures. The aggregate is kept for compatibility but is the
  //    WEAKER number — a consumer that knows the project's tier should always
  //    prefer byTier (see measuredFor()).
  //
  //    SF does NOT reproduce Austin's monotonic ordering. Measured 2026-08-06:
  //    single 13.1 (n=50), multi 17.9 (n=34), apartment 10.5 (n=48) — the 2-4
  //    unit tier is the SLOWEST and the 5+/commercial tier the fastest, so an
  //    aggregate median is doubly misleading here. No mechanism is asserted for
  //    that inversion: the obvious candidate (expedited 100%-affordable and
  //    mayoral-directive projects dominating the apartment tier) was tested and
  //    does NOT explain it — flagged 10.5 (n=30) vs unflagged 10.8 (n=18).
  // The n<30 publication floor and the RECORD of every tier it withholds come out
  // of one call, so a tier can no longer be dropped silently — see
  // scripts/permits/lib/tierFloor.mjs. `tierBreakdown` is written beside `byTier`
  // and is what tells measuredFor() to fail closed rather than serve the
  // aggregate for a withheld tier.
  //
  // The gate runs AGAIN, per tier. A tier's quantiles are identified by ITS OWN
  // observed share, not the city's — measured 2026-08-09 over this same window,
  // single 39.4% (50/127), multi 30.1% (34/113) and apartment 43.2% (48/111)
  // straddle an aggregate of 37.61%, so an aggregate that cleared 50% would say
  // nothing about whether `multi` had. This halts the
  // whole city rather than suppressing one tier, deliberately: every SF tier
  // fails today, so a partial-publish path would be a branch that has never run
  // and could not be checked (rule 18's corollary — code that did not run is not
  // code that works). Build it when a real case needs it.
  for (const [tier, rowsOfTier] of Object.entries(byTierCohort)) {
    const obs = rowsOfTier.filter((r) => r.issued != null).length
    try {
      refuseUnlessQuantilesAreObserved(obs, rowsOfTier.length)
    } catch (err) {
      if (err instanceof ComputabilityHalt) {
        throw new ComputabilityHalt(`tier "${tier}" — ${err.message}`)
      }
      throw err
    }
  }

  const { tiers, tierBreakdown } = splitTiersAtFloor(byTier, (rows) => ({
    medianMonths: daysToMonths(quantile(rows, 0.5)),
    p80Months: daysToMonths(quantile(rows, 0.8)),
    n: rows.length,
    vintage,
  }))
  console.log(
    '  by tier:',
    Object.fromEntries(
      Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
    ),
  )

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 9. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    sf: { ...(existing.sf ?? {}), newConstruction: stats, byTier: tiers, tierBreakdown },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote sf.newConstruction:', stats)
}

main().catch((err) => {
  if (err instanceof ComputabilityHalt) {
    // A refusal BY DESIGN, and it exits NON-ZERO — unlike boston.mjs, which
    // exits 0 for its halt. The difference is deliberate and worth stating:
    // Boston's gap is structural and permanent (a column that does not exist;
    // no re-run can change it), so a zero exit stops a batch runner crying wolf
    // over a known-forever gap. SF's is a LIVE-DATA condition that every run
    // genuinely re-tests, on a city whose figure was published and then
    // retracted. A silent exit 0 there is exactly rule 18's failure — the run
    // would look like success. milwaukee.mjs refuses non-zero for the same
    // reason.
    console.error(`\nsf.mjs — NOT COMPUTABLE, by design:\n    ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\nsf.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
