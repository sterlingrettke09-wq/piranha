#!/usr/bin/env node
// WO-7.3 — Charlotte, NC relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/charlotte.mjs
//
// Pulls the "Zoning Variances and Appeals" layer published by the City of
// Charlotte on ArcGIS Online, filters to UDO Board of Adjustment VARIANCES,
// dedupes rows to distinct cases, scores the cohort framed on the written
// decision's clerk-filing date, and MERGES the result into
// netlify/functions/lib/data/reliefStats.json under charlotte.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ═══════════════════════════════════════════════════════════════════════════
// 1. THE LABEL IS "Board of Adjustment variances", NOT "variances".
// ═══════════════════════════════════════════════════════════════════════════
// Charlotte runs TWO tracks for the same underlying dimensional relief, split
// by magnitude. UDO 37.4.A.2.a: "Standards may be adjusted by up to 10% by the
// designated administrator… Any changes that exceed the 10% threshold are not
// eligible for an administrative adjustment." So a small setback shave goes to
// staff and a large one goes to the Board.
//
// The staff track is NOT a lenient board — it is the CONSENT-FILTERED residue,
// and UDO 37.4.A.4.b is what makes that true by construction:
//
//   "If any person with standing objects to the administrative adjustment with
//    a stated reason before the written decision, THE ADMINISTRATIVE ADJUSTMENT
//    SHALL BE DENIED AND THE APPLICANT MAY FILE FOR A VARIANCE or alternative
//    compliance, if applicable."
//
// One objection ejects a case from the staff track and routes it to the Board.
// The tests differ in kind too: 37.4.A.4.c is a DISJUNCTIVE five-condition test
// ("shall meet any one of the following"), while 37.8.A applies the CONJUNCTIVE
// four-part N.C.G.S. §160D-705(d) hardship test the city's own application
// packet prints as "all four criteria must be met".
//
// The staff track is therefore DELIBERATELY EXCLUDED, and the exclusion is
// measured every run rather than asserted: measureAdminTrack() below computes
// the administrative-adjustment/deviation rate over the same window (measured
// 2026-08-10: 234 granted / 2 denied = 99.2%) and the pooled rate that including
// it would publish (measured 96.4% against the Board's 92.3%). Pooling would
// move the rendered figure by ~4 points toward a process the user is NOT in —
// this line only renders on a NEEDS_RELIEF verdict, i.e. relief the BOARD must
// grant. A pooled rate under an unpooled label is a false claim on the rendered
// surface, so LABEL says which board and which track. relief.test.ts fails if
// the label is ever dropped, exactly as it does for NYC and DC.
//
// Also excluded, and why: `Appeal` (UDO 37.8.B — an alleged error by the
// Administrator; the outcome vocabulary is Upheld/Overturned, a ruling on staff
// error rather than on relief) and `Alternative Compliance Review` (a third
// body, the ACRB). Both are separate statistics, not a wider version of this one.
//
// ═══════════════════════════════════════════════════════════════════════════
// 2. `Decision_Date` IS THE CLERK-FILING DATE, NOT THE DECISION DATE.
// ═══════════════════════════════════════════════════════════════════════════
// UDO 37.8.A.15: "A quasi-judicial decision is effective upon filing the written
// decision with the clerk of UDO Board of Adjustment." External validation
// against the Board's own signed minutes (2026-08 survey) found the field runs
// 9–98 days AFTER the hearing: the November 18th 2025 session's cases carry
// 12-04-2025, 12-06-2025 and 02-24-2026, and not one of the 17 distinct 2025
// dates in the feed equals a Board meeting date.
//
// This is SF's `close_date` situation exactly. The field is SOUND for cohort
// MEMBERSHIP — a case with no written decision has no date, so pending cases
// cannot enter — and it is NOT a decision date and NOT a duration endpoint.
// The vintage string must never call it one, and nothing downstream may
// subtract from it. Practical consequence: the window's trailing edge sits
// roughly one quarter behind run time. That truncates recency, not the
// denominator.
//
// Field mechanics that must be handled explicitly, not by a permissive regex:
//   · `Decision_Date` is an esriFieldTypeString (schema read live, length 4000),
//     NOT a date field. There is no server-side range filter — a `>=` on it is
//     a lexicographic comparison on "MM-DD-YYYY" and is wrong. So the layer is
//     paged in full and the window is applied client-side.
//   · It carries junk years. Measured table-wide: '12-30-1899' ×7,
//     '09-07-0202' ×1, '09-25-2912' ×1. parseFilingDate() REJECTS these
//     (returns null) and never coerces them — a coerced 0202 becomes a silent
//     out-of-window row, a rejected one is countable.
//   · `Decision` is a 30-CHARACTER field, so compound dispositions truncate at
//     source (the pre-2022 value 'GRANTED FOR DEPTH, DENIED FOR*' is the proof).
//     See the QUALIFIED bucket below.
//   · `Request_Type` has four typo/case variants ('Adminsitrative Adjustment',
//     'Administrative Agjustment', 'Variance extension', 'Extension of
//     Variance'). They are enumerated as literals, never matched by prefix: a
//     `startsWith('Variance')` filter would silently swallow 'Variance
//     Withdrawn' and the three extension spellings.
//
// ═══════════════════════════════════════════════════════════════════════════
// 3. THE BOUND AND THE RESIDUAL SHIP AS A MEASURED REFUSAL GATE.
// ═══════════════════════════════════════════════════════════════════════════
// One defect here was invisible from inside the data and took reading the
// Board's own minutes: the FEBRUARY 25th 2025 SESSION decided three cases —
// VAR-2024-00063 (801 E Arrowood Rd), VAR-2025-00003 (938 Sewickley Dr),
// VAR-2025-00004 (2253 Westminster Pl). All three sit in the feed marked
// `Granted`, all three with a BLANK `Decision_Date`, and the feed contains no
// February-2025 batch at all. A whole session's letter dates were never
// entered, and 18 months later they are still null. A date-framed cohort
// silently drops every one of them.
//
// So the frame is audited against a universe the frame itself cannot see. The
// AUDIT UNIVERSE is the union of (a) the published cohort — cases with a
// parseable in-window filing date — and (b) every case whose CASE NUMBER year
// is in-window, which is independent of the date field and therefore sees the
// cases the date frame dropped. Measured 2026-08-10: 157 ∪ 159 = 164 cases.
//   · 155 decided on the merits and dated   → the published denominator
//   ·   2 qualified/compound dispositions   → excluded, disclosed (see below)
//   ·   4 decided (all Granted) but UNDATED → the Feb-2025 defect
//   ·   3 with no terminal disposition      → the residual
// Residual 3/164 = 1.8%; date-entry gap 4/164 = 2.4%.
//
// Both are gated, both refusals EXIT 1 without writing, and the adversarial
// floor is recomputed and written into the vintage on EVERY run. Over the
// 155 + 4 + 3 = 162 cases whose outcome is at stake, with the 4 undated grants
// restored: floor (all 3 unresolved counted denied) 147/162 = 90.7%, ceiling
// (all 3 granted) 150/162 = 92.6%. THE PUBLISHED 92.3% SITS INSIDE ITS OWN
// BOUND WITH ROOM ON BOTH SIDES — that is the difference from SF's retracted
// 97.6%, which sat at its ceiling. The leakage is also DIRECTIONAL (all four
// undated cases are grants), so the published figure understates slightly.
//
// Unlike boston.mjs (which warns and exits 0 on a thin sample), every refusal
// here EXITS 1 without writing: these gates re-test live conditions, and a
// silent success-looking exit on a refusal is how a gap gets read as an answer
// (rule 18).
//
// ── Layer ────────────────────────────────────────────────────────────────────
// City of Charlotte, "Zoning Variances and Appeals" (portal item on
// data.charlottenc.gov). Anonymous, no key. Verify the schema by reading the
// layer's field list (`?f=json` → fields[]), not a sample feature.
const LAYER =
  'https://services.arcgis.com/9Nl857LBlQVyzq54/arcgis/rest/services/ZoningVarianceAppeal/FeatureServer/0'

// EXACT `Request_Type` value for the Board track. Exact match, never a prefix —
// see the typo-variant note above.
const TRACK = 'Variance'

// The staff track, measured for disclosure only and never pooled into the
// published rate. Includes the two misspellings that exist in the live domain
// and the pre-UDO legacy term.
const ADMIN_TRACK = [
  'Administrative Adjustment',
  'Adminsitrative Adjustment', // sic — live domain value
  'Administrative Agjustment', // sic — live domain value
  'Administrative Deviation', // pre-UDO legacy equivalent
]

// `Decision` vocabulary. Verified against the live case-level histogram for the
// in-window Variance cohort (2026-08-10: Granted 143 · Denied 12 ·
// 'Granted-Appeal Pending' 1 · 'Granted (3)' 1). FAILS CLOSED — any value not
// listed in one of these buckets halts the run. In particular the historical
// split-outcome vocabulary ('GRANTED (1) DENIED (2)', 'Granted 1st/ Denied
// 2nd', 'GRANTED AND DENIED', 'GRANTED FOR DEPTH, DENIED FOR*') is all pre-2022
// today; if any of it reappears in-window a human decides its bucket rather
// than a fallback swallowing it.
const GRANTED = ['Granted']
const DENIED = ['Denied']

// Dispositions that are NOT single-valued, and are therefore excluded from the
// published denominator rather than bucketed:
//   · 'Granted (3)'            — one case, three variance requests. The field
//                                CAN express a split ('GRANTED (1) DENIED (2)')
//                                and truncates at 30 chars, so "(3)" cannot be
//                                verified as all-granted from this field alone.
//   · 'Granted-Appeal Pending' — the Board granted; a superior-court petition
//                                under §160D-1402 is pending, so the disposition
//                                is not final.
// This is a DISCLOSED SCORING EXCLUSION, not censoring: the outcomes are
// published, they just are not one value. Counting both as grants gives
// 145/157 = 92.4% against the published 143/155 = 92.3%; the script measures
// that alternative every run and states it in the vintage, so the choice is
// visible rather than buried. They are NOT part of the adversarial bound — that
// bound measures the date-entry defect, and folding a known exclusion into it
// would blur two different things.
const QUALIFIED = ['Granted (3)', 'Granted-Appeal Pending']

// Terminal but not a Board ruling on the merits. Measured ZERO in-window — the
// modern encoding moved withdrawals to Request_Type='Variance Withdrawn' (2
// rows, both with a blank Decision_Date), so they leave the cohort BY
// CONSTRUCTION rather than by a scoring choice. The vintage says so, which
// makes it a claim: assertWithdrawalsLeaveByConstruction() re-measures it every
// run and halts if the encoding changes, rather than assuming it.
const NOT_ON_MERITS = [
  'WITHDRAWN',
  'Withdrawn',
  'WITHDRAWN BY APPLICANT',
  'Withdrawn Violation Corrected',
  'DISMISSED',
]

// Non-terminal: the case has no fate yet. Blank is included deliberately — a
// case-year-in-window case with no `Decision` at all is unresolved, not absent.
const UNRESOLVED = ['', 'Undecided', 'PENDING', 'Continued']

// Cohort: variances whose written decision was filed with the clerk on/after
// this date. 2022 is not a tuning knob — historic coverage collapses before it
// (`Decision` is blank on 1,698 pre-2005 rows; in 2020 alone 29 of 63 variance
// rows carry no disposition), and 2022 is the LOW year for the grant rate
// (86.5%), so the window start is not cherry-picked upward.
const SINCE_YEAR = 2022

// Fail-closed year band for parseFilingDate(). Outside it the string is
// REJECTED, never coerced — see the junk-year note in the header.
const MIN_YEAR = 1980
const MAX_YEAR = 2030

// ── The two gates ───────────────────────────────────────────────────────────
// CALIBRATION, so both numbers are traceable rather than invented. Charlotte's
// leakage arrives in SESSION-SIZED lumps: the known Feb-25-2025 defect is 3
// cases, and today's audit universe is 164. One more entirely un-entered
// session moves the date-entry gap from 4/164 = 2.4% to ~7/167 = 4.2% and the
// residual from 3/164 = 1.8% to ~6/167 = 3.6%. A 4% ceiling therefore fires on
// the SECOND occurrence of the known defect class and not on the first — the
// smallest ceiling that does not refuse today's measured state.
//
// It is deliberately TIGHTER than DC's 5% (which ships at 1.5%) for a reason
// specific to Charlotte: DC's unresolved cases are of unknown direction, while
// every one of Charlotte's undated cases measured so far is a GRANT. Directional
// leakage does more damage per point of residual, so the same share buys less
// tolerance here. At 4% the adversarial floor falls to roughly 89%, and the
// published point estimate would no longer sit comfortably inside its bound —
// which is the whole claim this city ships on.
const MAX_UNRESOLVED_SHARE = 0.04
const MAX_UNDATED_DECIDED_SHARE = 0.04

// Gate: a grant rate computed off fewer than this many decided cases isn't a
// trustworthy base rate.
const MIN_N = 100

// Baseline row count reconciled by the 2026-08-10 survey via returnCountOnly /
// returnIdsOnly. Drift from it is EXPECTED (the city adds cases) and is only
// logged; what is HALTED on is the reconciliation itself — see
// reconcileRowCount().
const BASELINE_ROWS = 3142

// Denominator label rendered by the UI (realityCheck card). The internal JSON
// slot is `variance` for schema-compat with relief.ts; this string is the
// PUBLISHED CLAIM and it carries the track exclusion. See header §1.
const LABEL = 'Board of Adjustment variances'

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME =
  "City of Charlotte ZoningVarianceAppeal FeatureServer/0 (Request_Type 'Variance', deduped to distinct cases)"

import { readFile, writeFile } from 'node:fs/promises'

/** Refusal that means "the data cannot support this figure", as distinct from a
 *  transport or schema failure. Mirrors sf.mjs / dc.mjs's CensoringHalt. */
class CensoringHalt extends Error {
  constructor(message) {
    super(message)
    this.name = 'CensoringHalt'
  }
}

async function arcgis(path, params) {
  const url = new URL(`${LAYER}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching services.arcgis.com: ${err.message}. ` +
        `Check connectivity; the service may also be temporarily offline.`,
    )
  }
  if (!res.ok) throw new Error(`services.arcgis.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(`ArcGIS error: ${JSON.stringify(body.error)}`)
  return body
}

const trim = (s) => (s == null ? '' : String(s).trim())

/**
 * `Decision_Date` is a STRING in MM-DD-YYYY. Returns { year, month, day } or
 * null. FAILS CLOSED: anything that is not exactly MM-DD-YYYY with a calendar-
 * plausible month/day and a year inside [MIN_YEAR, MAX_YEAR] returns null. It
 * never coerces — the live junk values '12-30-1899', '09-07-0202' and
 * '09-25-2912' must come back null, because a coerced year is an invisible
 * out-of-window row while a rejected one is countable.
 */
export function parseFilingDate(raw) {
  const s = trim(raw)
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  return { year, month, day }
}

/** Case numbers in this cohort are bare `YYYY-NNNNN`. Returns the year or null. */
export function caseYear(caseNumber) {
  const m = /^(\d{4})-\d{3,6}$/.exec(trim(caseNumber))
  if (!m) return null
  const y = Number(m[1])
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null
}

/**
 * Three-way reconciliation of the layer. What is asserted is the RECONCILIATION
 * (server count === id count === rows actually paged, and ids unique), not the
 * literal 3,142 — hardcoding today's total would refuse the moment Charlotte
 * files another variance, which is a stale-data trap rather than a check. Drift
 * from BASELINE_ROWS is logged so a *collapse* is still visible to a reader.
 */
function reconcileRowCount(serverCount, ids, pagedRows) {
  const uniqueIds = new Set(ids).size
  if (serverCount !== ids.length || serverCount !== pagedRows || uniqueIds !== ids.length) {
    throw new CensoringHalt(
      `Row-count reconciliation FAILED: returnCountOnly=${serverCount}, ` +
        `returnIdsOnly=${ids.length} (${uniqueIds} unique), paged=${pagedRows}. ` +
        `These must agree or the extract is partial, and a grant rate over a partial ` +
        `extract is a rate over whatever the pager happened to return. ` +
        `reliefStats.json left UNCHANGED.`,
    )
  }
}

/** The vintage claims withdrawals leave the cohort BY CONSTRUCTION. That is a
 *  claim about the live encoding, so it is re-measured, not assumed. */
function assertWithdrawalsLeaveByConstruction(withdrawnInUniverse, withdrawnTypeInWindow) {
  if (withdrawnInUniverse === 0 && withdrawnTypeInWindow === 0) return
  throw new CensoringHalt(
    `Withdrawal encoding has CHANGED: ${withdrawnInUniverse} case(s) in the audit ` +
      `universe carry a withdrawn/dismissed Decision and ${withdrawnTypeInWindow} ` +
      `'Variance Withdrawn' row(s) now carry an in-window filing date. The vintage ` +
      `states that withdrawals leave the cohort by construction (via ` +
      `Request_Type='Variance Withdrawn' with no date) — that sentence would now be ` +
      `FALSE, and the published statistic would silently become "of requests the ` +
      `Board decided OR that were pulled". Decide the bucket and fix the vintage ` +
      `wording together. reliefStats.json left UNCHANGED.`,
  )
}

function refuseUnlessResidualIsSmall(unresolved, universe) {
  const share = unresolved / universe
  if (share <= MAX_UNRESOLVED_SHARE) return
  throw new CensoringHalt(
    `${unresolved} of ${universe} cases in the audit universe (${(share * 100).toFixed(1)}%) ` +
      `carry no terminal disposition — over the ${MAX_UNRESOLVED_SHARE * 100}% ceiling. ` +
      `At this level the decided-cases share is being selected by what has not resolved ` +
      `(the SF filing-frame defect), and a caveat string cannot fix a shaped denominator. ` +
      `reliefStats.json left UNCHANGED.`,
  )
}

function refuseUnlessDateEntryGapIsSmall(undatedDecided, universe, examples) {
  const share = undatedDecided / universe
  if (share <= MAX_UNDATED_DECIDED_SHARE) return
  throw new CensoringHalt(
    `${undatedDecided} of ${universe} cases (${(share * 100).toFixed(1)}%) carry a Board ` +
      `disposition but NO parseable Decision_Date, so the date-framed cohort drops them — ` +
      `over the ${MAX_UNDATED_DECIDED_SHARE * 100}% ceiling.\n` +
      `    affected: ${examples.slice(0, 10).join(', ')}${examples.length > 10 ? ', …' : ''}\n\n` +
      `  This is the FEBRUARY 25th 2025 SESSION defect recurring. That session decided\n` +
      `  VAR-2024-00063, VAR-2025-00003 and VAR-2025-00004 — all three sit in the feed\n` +
      `  marked Granted with a blank Decision_Date, the feed has no February-2025 batch\n` +
      `  at all, and 18 months on they are still null. One un-entered session is a\n` +
      `  disclosed bound; two is a feed that has stopped stamping written decisions, and\n` +
      `  the leakage is DIRECTIONAL (every undated case measured so far is a grant), so\n` +
      `  the published rate would understate by an amount this script can no longer\n` +
      `  bound honestly. reliefStats.json left UNCHANGED.`,
  )
}

/** Score a map of case → single Decision value into merits buckets. */
function scoreCases(cases) {
  let granted = 0
  let denied = 0
  let qualified = 0
  let notOnMerits = 0
  let unresolved = 0
  const unrecognised = new Map()
  for (const s of cases.values()) {
    if (GRANTED.includes(s)) granted++
    else if (DENIED.includes(s)) denied++
    else if (QUALIFIED.includes(s)) qualified++
    else if (NOT_ON_MERITS.includes(s)) notOnMerits++
    else if (UNRESOLVED.includes(s)) unresolved++
    else unrecognised.set(s, (unrecognised.get(s) ?? 0) + 1)
  }
  return { granted, denied, qualified, notOnMerits, unresolved, unrecognised }
}

function refuseUnlessVocabularyIsKnown(unrecognised, where) {
  if (unrecognised.size === 0) return
  throw new CensoringHalt(
    `Unrecognised Decision value(s) ${where}:\n` +
      [...unrecognised].map(([s, c]) => `    · ${JSON.stringify(s)} — ${c}`).join('\n') +
      `\n\n  Decide each bucket explicitly (merits grant? denial? qualified/compound?\n` +
      `  procedural? unresolved?) before any figure ships. Note Decision is a\n` +
      `  30-CHARACTER field, so a split outcome can arrive truncated — check the\n` +
      `  case's Hearing_Request before bucketing. reliefStats.json left UNCHANGED.`,
  )
}

/** Collapse rows to cases, halting if one case's rows disagree. */
function dedupeToCases(rows) {
  const cases = new Map()
  const conflicts = []
  for (const r of rows) {
    const k = trim(r.Case_Number)
    const s = trim(r.Decision)
    if (!cases.has(k)) cases.set(k, s)
    else if (cases.get(k) !== s) conflicts.push(`${k} (${cases.get(k)} vs ${s})`)
  }
  if (conflicts.length > 0) {
    throw new CensoringHalt(
      `${conflicts.length} case(s) carry CONFLICTING Decision values across their rows ` +
        `(e.g. ${conflicts.slice(0, 5).join('; ')}). Charlotte files one row per PARCEL on ` +
        `multi-parcel applications, so a case's rows must agree for "the case's outcome" to ` +
        `be well-defined — and no dedup rule short of reading the decision letters can fix ` +
        `it if they don't. reliefStats.json left UNCHANGED.`,
    )
  }
  return cases
}

/** The staff track, measured for disclosure. Never pooled — see header §1. */
function measureAdminTrack(rows) {
  const inWindow = rows.filter(
    (r) =>
      ADMIN_TRACK.includes(trim(r.Request_Type)) &&
      (parseFilingDate(r.Decision_Date)?.year ?? 0) >= SINCE_YEAR,
  )
  const cases = dedupeToCases(inWindow)
  const { granted, denied } = scoreCases(cases)
  return { granted, denied, decided: granted + denied }
}

async function main() {
  console.log(`Charlotte relief pipeline — ${LAYER}`)

  // 1. Probe the SCHEMA — the layer's field list, not a sample feature.
  const meta = await arcgis('', { f: 'json' })
  const fieldIds = new Set((meta.fields ?? []).map((f) => f.name))
  for (const f of ['Case_Number', 'Request_Type', 'Decision', 'Decision_Date']) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in layer schema; the service may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a grant rate; reliefStats.json left UNCHANGED.`,
      )
    }
  }
  // Decision_Date must still be a STRING. If Charlotte ever republishes it as a
  // real esriFieldTypeDate the whole client-side parse is wrong in a way that
  // would silently produce numbers, so stop rather than guess.
  const dateField = (meta.fields ?? []).find((f) => f.name === 'Decision_Date')
  if (dateField?.type !== 'esriFieldTypeString') {
    throw new Error(
      `Decision_Date is now ${dateField?.type} (expected esriFieldTypeString). ` +
        `This script parses it as an MM-DD-YYYY STRING; a typed date field means the ` +
        `parse, the window filter and the junk-year rejection are all wrong. ` +
        `reliefStats.json left UNCHANGED.`,
    )
  }

  // 2. Reconcile the extract three ways BEFORE computing anything on it.
  const countRes = await arcgis('/query', { where: '1=1', returnCountOnly: 'true', f: 'json' })
  const serverCount = countRes.count
  const idRes = await arcgis('/query', { where: '1=1', returnIdsOnly: 'true', f: 'json' })
  const ids = idRes.objectIds ?? []

  const rows = []
  for (let offset = 0; ; ) {
    const page = await arcgis('/query', {
      where: '1=1',
      outFields: 'OBJECTID,Case_Number,Request_Type,Decision,Decision_Date',
      returnGeometry: 'false',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: '2000',
      f: 'json',
    })
    const feats = page.features ?? []
    for (const f of feats) rows.push(f.attributes)
    offset += feats.length
    if (feats.length === 0) break
    if (!page.exceededTransferLimit && feats.length < 2000) break
  }
  reconcileRowCount(serverCount, ids, rows.length)
  console.log(
    `  Reconciled ${rows.length} rows (count = ids = paged, ids unique)` +
      (rows.length === BASELINE_ROWS ? '' : `; baseline was ${BASELINE_ROWS}`) +
      '.',
  )

  // 3. The published cohort: Board variances whose written decision was filed
  //    with the clerk in-window. EXACT Request_Type match (see typo note).
  const variances = rows.filter((r) => trim(r.Request_Type) === TRACK)
  const inWindow = variances.filter(
    (r) => (parseFilingDate(r.Decision_Date)?.year ?? 0) >= SINCE_YEAR,
  )

  // 3a. Case numbers must be bare YYYY-NNNNN. This is not cosmetic: dedup keys
  //     on Case_Number, so two rows sharing a placeholder like '<Null>' would
  //     merge into one fictitious case. It also asserts the track agreement —
  //     no UDOAA- (administrative adjustment), ACRB- or APL- prefixed case is
  //     inside the Board cohort. The prefix is corroboration, never a substitute
  //     for the Request_Type filter (37 staff rows also carry bare numbers).
  const badCaseNumbers = [...new Set(inWindow.map((r) => trim(r.Case_Number)).filter((c) => caseYear(c) === null))]
  if (badCaseNumbers.length > 0) {
    throw new CensoringHalt(
      `${badCaseNumbers.length} in-window case number(s) are not bare YYYY-NNNNN: ` +
        `${badCaseNumbers.slice(0, 10).map((c) => JSON.stringify(c)).join(', ')}. ` +
        `Dedup keys on Case_Number, so a placeholder would merge unrelated cases into one; ` +
        `a UDOAA-/ACRB-/APL- prefix would mean a foreign track has leaked into the Board ` +
        `cohort. reliefStats.json left UNCHANGED.`,
    )
  }

  const cohort = dedupeToCases(inWindow)
  const cohortScore = scoreCases(cohort)
  refuseUnlessVocabularyIsKnown(cohortScore.unrecognised, `in the in-window ${TRACK} cohort`)

  const granted = cohortScore.granted
  const denied = cohortScore.denied
  const decided = granted + denied

  // 4. THE AUDIT UNIVERSE — built so the frame is checked against something the
  //    frame cannot see (header §3). Union of the dated cohort and every case
  //    whose CASE-NUMBER year is in-window.
  const byCase = new Map()
  for (const r of variances) {
    const k = trim(r.Case_Number)
    if (!byCase.has(k)) byCase.set(k, [])
    byCase.get(k).push(r)
  }
  const universe = new Set(cohort.keys())
  for (const k of byCase.keys()) if ((caseYear(k) ?? 0) >= SINCE_YEAR) universe.add(k)

  const outside = [...universe].filter((k) => !cohort.has(k))
  const outsideCases = new Map()
  for (const k of outside) {
    const values = [...new Set((byCase.get(k) ?? []).map((r) => trim(r.Decision)))]
    // A case's rows must agree here too; reuse the same halt.
    if (values.length > 1) {
      throw new CensoringHalt(
        `Case ${k} carries CONFLICTING Decision values across its rows (${values.join(' vs ')}). ` +
          `reliefStats.json left UNCHANGED.`,
      )
    }
    outsideCases.set(k, values[0] ?? '')
  }
  const outsideScore = scoreCases(outsideCases)
  refuseUnlessVocabularyIsKnown(
    outsideScore.unrecognised,
    `in the audit universe (case-year ≥ ${SINCE_YEAR}, outside the dated cohort)`,
  )

  // Decided-but-undated: a Board disposition with no parseable filing date.
  // Qualified counts here too — it is a disposition the date frame dropped.
  const undatedDecided = outsideScore.granted + outsideScore.denied + outsideScore.qualified
  const undatedGranted = outsideScore.granted
  const undatedExamples = outside.filter((k) => {
    const v = outsideCases.get(k)
    return GRANTED.includes(v) || DENIED.includes(v) || QUALIFIED.includes(v)
  })
  const unresolved = outsideScore.unresolved + cohortScore.unresolved
  const universeN = universe.size

  // 5. Withdrawals — assert, don't assume (see NOT_ON_MERITS).
  const withdrawnTypeInWindow = rows.filter(
    (r) =>
      trim(r.Request_Type) === 'Variance Withdrawn' &&
      (parseFilingDate(r.Decision_Date)?.year ?? 0) >= SINCE_YEAR,
  ).length
  assertWithdrawalsLeaveByConstruction(
    cohortScore.notOnMerits + outsideScore.notOnMerits,
    withdrawnTypeInWindow,
  )

  // 6. Gates — refusals EXIT 1 (see header).
  refuseUnlessDateEntryGapIsSmall(undatedDecided, universeN, undatedExamples)
  refuseUnlessResidualIsSmall(unresolved, universeN)
  if (decided === 0) {
    throw new CensoringHalt(
      `No decided ${TRACK} cases matched the outcome buckets; the vocabulary or the ` +
        `feed has changed. reliefStats.json left UNCHANGED.`,
    )
  }
  if (decided < MIN_N) {
    throw new CensoringHalt(
      `Only ${decided} decided ${TRACK} cases in the window (need ≥ ${MIN_N}). ` +
        `The base rate isn't trustworthy at this sample size. reliefStats.json left UNCHANGED.`,
    )
  }

  // 7. The published figure, its alternatives and its bound — all measured.
  const grantRate = Math.round((granted / decided) * 1000) / 1000
  const boundDen = decided + undatedDecided + unresolved
  const floorPct = (((granted + undatedGranted) / boundDen) * 100).toFixed(1)
  const ceilPct = (((granted + undatedGranted + unresolved) / boundDen) * 100).toFixed(1)
  const withQualified =
    cohortScore.qualified > 0
      ? `${((granted + cohortScore.qualified) / (decided + cohortScore.qualified) * 100).toFixed(1)}%`
      : null

  const admin = measureAdminTrack(rows)
  const adminPct = admin.decided > 0 ? ((admin.granted / admin.decided) * 100).toFixed(1) : 'n/a'
  const pooledPct =
    admin.decided > 0
      ? (((granted + admin.granted) / (decided + admin.decided)) * 100).toFixed(1)
      : 'n/a'

  const maxYear = Math.max(
    ...inWindow.map((r) => parseFilingDate(r.Decision_Date)?.year ?? SINCE_YEAR),
  )

  const stats = {
    grantRate,
    n: decided,
    window: `${SINCE_YEAR}–${maxYear}`,
    label: LABEL,
    vintage:
      `UDO Board of Adjustment variances whose WRITTEN DECISION WAS FILED WITH THE CLERK ` +
      `${SINCE_YEAR} onward — Decision_Date is the clerk-filing/effective date per UDO ` +
      `37.8.A.15 ("a quasi-judicial decision is effective upon filing the written decision ` +
      `with the clerk"), measured 9–98 days AFTER the hearing, so it is NOT the decision ` +
      `date and is used for cohort membership only, never as a duration endpoint; ` +
      `computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}; ` +
      `${inWindow.length} rows deduped to ${cohort.size} cases (0 outcome conflicts); ` +
      `EXCLUDES the staff administrative-adjustment track (UDO 37.4) — measured ` +
      `${admin.granted}/${admin.decided} = ${adminPct}% over the same window, but ` +
      `37.4.A.4.b makes it the consent-filtered residue ("if any person with standing ` +
      `objects… the administrative adjustment shall be denied and the applicant may file ` +
      `for a variance"), so pooling would publish ${pooledPct}% for a process the user is ` +
      `not in; also excludes appeals (Upheld/Overturned, a different statistic) and ` +
      `withdrawals (encoded as Request_Type='Variance Withdrawn', undated — they leave the ` +
      `cohort by construction, re-asserted each run); granted ÷ decided cases; ` +
      `${granted} granted, ${denied} denied` +
      (cohortScore.qualified > 0
        ? `; ${cohortScore.qualified} qualified/compound disposition(s) ` +
          `(${QUALIFIED.join(', ')}) excluded as not single-valued — counting them as ` +
          `grants would publish ${withQualified}`
        : '') +
      `; audited against ${universeN} case-year-${SINCE_YEAR}+ cases the date frame cannot ` +
      `see: ${undatedDecided} decided but UNDATED (the un-entered 2025-02-25 session) and ` +
      `${unresolved} unresolved (${((unresolved / universeN) * 100).toFixed(1)}%, gated ≤ ` +
      `${MAX_UNRESOLVED_SHARE * 100}%) — restoring the undated grants and counting every ` +
      `unresolved case as a denial puts the adversarial floor at ${floorPct}% and the ` +
      `ceiling at ${ceilPct}%`,
  }

  // 8. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, charlotte: { ...(existing.charlotte ?? {}), variance: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(
    `  Cohort (clerk-filed ${SINCE_YEAR}+): ${inWindow.length} rows → ${cohort.size} cases — ` +
      `${granted} granted, ${denied} denied, ${cohortScore.qualified} qualified/compound.`,
  )
  console.log(
    `  Audit universe ${universeN} cases: ${undatedDecided} decided-but-undated ` +
      `(${((undatedDecided / universeN) * 100).toFixed(1)}%, gated ≤ ${MAX_UNDATED_DECIDED_SHARE * 100}%), ` +
      `${unresolved} unresolved (${((unresolved / universeN) * 100).toFixed(1)}%, gated ≤ ${MAX_UNRESOLVED_SHARE * 100}%).`,
  )
  console.log(`  Adversarial bound [${floorPct}%, ${ceilPct}%] around ${(grantRate * 100).toFixed(1)}%.`)
  console.log(
    `  Staff track (NOT pooled): ${admin.granted}/${admin.decided} = ${adminPct}%; pooling would publish ${pooledPct}%.`,
  )
  console.log('  Wrote charlotte.variance:', stats)
}

// Only run when invoked directly, so the parser helpers can be imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    if (err instanceof CensoringHalt) {
      console.error(`\ncharlotte.mjs REFUSED TO WRITE:\n\n  ${err.message}\n`)
      process.exitCode = 1
      return
    }
    console.error(`\ncharlotte.mjs failed: ${err.message}\n`)
    process.exitCode = 1
  })
}
