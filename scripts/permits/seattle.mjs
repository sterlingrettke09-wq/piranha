#!/usr/bin/env node
// WO-7.1 — Seattle permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/seattle.mjs
//
// Pulls Seattle's "Building Permits" dataset from data.seattle.gov (Socrata),
// filters to new-construction permits, computes the median and 80th-percentile
// applied -> issued time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under seattle.newConstruction
// (aggregate) and seattle.byTier (single / multi / apartment).
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
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
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
  const byTier = { single: [], multi: [], apartment: [] }
  let stfi = 0
  let untiered = 0
  let dadusAdded = 0
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
  console.log(`  excluded ${stfi} STFI rows (no-plan-review field-inspection permits)`)
  console.log(`  excluded ${notDadu} prefiltered Add/Alt rows the exact DADU gate rejected`)
  console.log(`  included ${dadusAdded} detached-ADU rows SDCI typed as Addition/Alteration`)
  console.log(`  ${untiered} rows carry no usable unit count — in the aggregate, in no tier`)

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

  const stamp = new Date().toISOString().slice(0, 10)
  const vintage = `applied ${since} onward; computed ${stamp}; ${DATASET_NAME}`

  // Per-tier figures. The aggregate is kept for compatibility but is the WEAKER
  // number: of the 4996 issued rows, 52.5% are single-tier at 5.0 months and
  // 8.5% are apartment-tier at 10.4, so the 5.7-month headline understates a
  // 5+-unit project by nearly 2x. A consumer that knows the tier should always
  // prefer byTier (see measuredFor()).
  const tiers = {}
  for (const [tier, arr] of Object.entries(byTier)) {
    if (arr.length < 30) {
      console.warn(`  tier ${tier}: n=${arr.length} < 30 — omitted rather than published thin`)
      continue
    }
    arr.sort((x, y) => x - y)
    tiers[tier] = {
      medianMonths: daysToMonths(quantile(arr, 0.5)),
      p80Months: daysToMonths(quantile(arr, 0.8)),
      n: arr.length,
      vintage,
    }
  }
  console.log('  by tier:', Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 5. Idempotent merge.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    seattle: { ...(existing.seattle ?? {}), newConstruction: stats, byTier: tiers },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote seattle.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nseattle.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
