#!/usr/bin/env node
// WO-7.3 — Washington, DC relief-approval-odds pipeline (OFFLINE, run by hand).
//
//   node scripts/relief/dc.mjs
//
// Pulls the DC "Zoning Cases" layer from DCGIS (MapServer/34), filters to Board
// of Zoning Adjustment cases (CASE_TYPE='BZA' — mandatory: ZC rezoning rows are
// ~79k of the layer's ~105k), DEDUPES rows to distinct cases, scores the mature
// filing cohort, and MERGES the result into
// netlify/functions/lib/data/reliefStats.json under dc.variance.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THIS IS THE CAVEATED CITY. THE CAVEATS, IN THE OPEN: ────────────────────
//
// 1. ROWS ARE NOT CASES. The layer carries one row per case POINT, not per
//    case: measured 2026-08-10, CASE_TYPE='BZA' filed 2022+ is 2,003 rows over
//    1,121 distinct CASE_NUMBERs. A row-level rate would weight multi-lot cases
//    by their lot count — biased by an unmeasured amount. This script scores
//    DISTINCT CASES, and halts if any case carries conflicting ACTION_TAKEN
//    values across its rows (measured: 0 of 1,121 conflict, so "the case's
//    outcome" is well-defined; if that ever breaks, dedup is ill-defined and no
//    rate is computable).
//
// 2. THE RATE IS WHOLE-BOARD. DC's BZA hears variances AND special exceptions
//    (and administrative appeals), and special exceptions are granted more
//    readily. Every field that could split them — RELIEFSOUGHT,
//    CASE_TYPE_RELIEF, BZAPURSUANTTO, BZARELIEFOF — is 0/2,003 populated in the
//    2022+ window (checked as a slot that exists but is empty: a known absence
//    in this vintage, not a missed lookup). So a variance-only rate does not
//    exist in this data. The published label says so — see LABEL below, which
//    the UI renders verbatim in the user-facing line. A caveat only in this
//    comment or in the vintage JSON string would be the exact defect that got
//    five permit figures withdrawn.
//
// 3. THE FRAME IS A FILING COHORT — DC PUBLISHES NO DECISION DATE. DATEFILED is
//    the only date field on the layer (schema read 2026-08-10), so Boston's
//    decision-date frame is unavailable BY CONSTRUCTION, and a filing cohort
//    scored over its decided members is the structure that got SF restated.
//    Two things make this publishable anyway, both enforced below:
//      a. MATURITY: the cohort is cut at filings ≥ MATURITY_YEARS (2) old, so
//         cases have had time to resolve. Unlike SF's old defect the censoring
//         here is VISIBLE — 'Pending' is a real value — and in the matured
//         cohort it is small: measured 2026-08-10, 10 of 688 matured cases
//         (1.45%) are unresolved ('Pending' 7, 'Closed' 3), versus 72 of 114 in
//         the raw 2026 cohort. (For contrast: SF's retracted figure hid 21.7%.)
//      b. THE PUBLISHED RATE IS A DECIDED-CASES SHARE, and is labelled as one.
//         601/617 is an exact count over decided cases, not an estimate of any
//         pending case's fate. The residual unresolved share bounds how far the
//         decided-share can sit from the full matured-cohort rate; that bound
//         (adversarial floor: all unresolved counted as denials) is recomputed
//         and written into the vintage on every run.
//    refuseUnlessResidualIsSmall() gates (a): if the unresolved share of the
//    matured cohort exceeds MAX_UNRESOLVED_SHARE the decided-share is being
//    selected by censoring, and the script refuses. See the threshold's
//    calibration note at its definition.
//
// Withdrawn / Dismissed are terminal but not rulings on the merits — excluded
// from the denominator, boston.mjs's treatment. 'Closed' names a terminal state
// with UNKNOWN direction and '--Select--' is an unfilled form value: both are
// counted as UNRESOLVED (they join the adversarial bound), never silently
// dropped. 'Grant in Part <tally>' is a merits grant of partial relief →
// granted (Boston counts 'AppProv', approved-with-provisos, the same way);
// matched on the 'Grant in Part' prefix because the string embeds a vote tally.
// Any other ACTION_TAKEN value halts the run (fail closed) — in particular the
// historical conditional vocabulary ('Conditionally Granted', 'Approved in
// Part, Denied in Part') does not appear in the 2022+ window today, and if it
// returns, a human decides its bucket rather than a fallback.
//
// Unlike boston.mjs (which warns and exits 0 on a thin sample), every refusal
// here EXITS 1 without writing: these gates re-test live conditions, and a
// silent success-looking exit on a refusal is how a gap gets read as an answer
// (rule 18).
//
// ── Layer ────────────────────────────────────────────────────────────────────
// DCGIS "Zoning Cases":
//   https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/34
// Verify the schema by reading the layer's field list (`?f=json` → fields[]),
// not a sample feature.
const LAYER =
  'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/34'

const CASE_TYPE = 'BZA'

// Outcome vocabulary, verified against the live grouped ACTION_TAKEN histogram
// for BZA 2022+ (rows: Approved 1,654 · Pending 149 · Withdrawn 115 · Denied 41
// · Dismissed 17 · '--Select--  -  - ' 16 · Closed 9 · 'Grant in Part 3 - 0 - 2'
// 2). Fails closed: any value outside these buckets halts the run.
const GRANTED = ['Approved']
const GRANTED_PREFIXES = ['Grant in Part'] // embeds a vote tally; see header
const DENIED = ['Denied']
const NOT_ON_MERITS = ['Withdrawn', 'Dismissed']
const UNRESOLVED = ['Pending', 'Closed', '--Select--  -  - ']

// Cohort: BZA cases FILED on/after SINCE and at least MATURITY_YEARS before the
// run date (DC publishes no decision date; see header caveat 3).
const SINCE = '2022-01-01'
const MATURITY_YEARS = 2

// Gate on caveat 3a: refuse if more than this share of the matured cohort is
// unresolved. CALIBRATION, so the number is traceable rather than invented:
// the clean decision-framed pipelines (boston, sf, nyc) run at exactly 0 by
// construction; SF's RETRACTED filing-framed figure hid 21.7%; DC's matured
// cohort measures 1.45% today (10 of 688). 5% is ~3.4× today's residual and
// ~4× under the retracted case — beyond it, the decided-cases share is being
// shaped by what has not resolved, and no caveat string fixes that. Whatever
// the residual is, its exact value AND the adversarial floor it implies are
// written into the vintage on every run — the gate bounds the defect, the
// vintage discloses it.
const MAX_UNRESOLVED_SHARE = 0.05

// Gate: a grant rate computed off fewer than this many decided cases isn't a
// trustworthy base rate.
const MIN_N = 100

// Denominator label rendered by the UI (realityCheck card). The internal JSON
// slot is `variance` for schema-compat with relief.ts, but this is a
// WHOLE-BOARD rate — the label is the published claim and carries caveat 2.
const LABEL = 'zoning relief requests (variances and special exceptions combined)'

const OUT_PATH = new URL('../../netlify/functions/lib/data/reliefStats.json', import.meta.url)
const DATASET_NAME = "DCGIS Zoning Cases MapServer/34 (CASE_TYPE 'BZA', deduped to distinct cases)"

import { readFile, writeFile } from 'node:fs/promises'

/** Refusal that means "the data cannot support this figure", as distinct from a
 *  transport or schema failure. Mirrors sf.mjs's CensoringHalt. */
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
      `Network error reaching maps2.dcgis.dc.gov: ${err.message}. ` +
        `Check connectivity; the service may also be temporarily offline.`,
    )
  }
  if (!res.ok) throw new Error(`maps2.dcgis.dc.gov returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(`ArcGIS error: ${JSON.stringify(body.error)}`)
  return body
}

const isGranted = (s) => GRANTED.includes(s) || GRANTED_PREFIXES.some((p) => s.startsWith(p))

function refuseUnlessResidualIsSmall(unresolvedCases, decided) {
  const share = unresolvedCases / (decided + unresolvedCases)
  if (share <= MAX_UNRESOLVED_SHARE) return
  throw new CensoringHalt(
    `${unresolvedCases} of ${decided + unresolvedCases} matured cases ` +
      `(${(share * 100).toFixed(1)}%) are unresolved — over the ` +
      `${MAX_UNRESOLVED_SHARE * 100}% ceiling. At this level the decided-cases ` +
      `share is selected by what has not resolved (the SF filing-frame defect), ` +
      `and a caveat string cannot fix a shaped denominator. Either DC's feed has ` +
      `stopped updating outcomes or the maturity window is too short. ` +
      `reliefStats.json left UNCHANGED.`,
  )
}

async function main() {
  console.log(`DC relief pipeline — ${LAYER}`)

  // 1. Probe the SCHEMA — the layer's field list, not a sample feature.
  const meta = await arcgis('', { f: 'json' })
  const fieldIds = new Set((meta.fields ?? []).map((f) => f.name))
  for (const f of ['CASE_TYPE', 'CASE_NUMBER', 'ACTION_TAKEN', 'DATEFILED']) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in layer schema; the service may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a grant rate; reliefStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. The matured filing window: [SINCE, runDate − MATURITY_YEARS).
  const now = new Date()
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - MATURITY_YEARS, now.getUTCMonth(), now.getUTCDate()))
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  const where =
    `CASE_TYPE='${CASE_TYPE}' AND DATEFILED >= DATE '${SINCE}' AND DATEFILED < DATE '${cutoffIso}'`

  // 3. Pull EVERY row in the window (paged), then dedupe to cases locally.
  //    Row-level grouped stats cannot dedupe, and a rate over rows is a rate
  //    over lots, not cases (caveat 1).
  const rows = []
  for (let offset = 0; ; ) {
    const page = await arcgis('/query', {
      where,
      outFields: 'CASE_NUMBER,ACTION_TAKEN',
      returnGeometry: 'false',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'json',
    })
    const feats = page.features ?? []
    for (const f of feats) rows.push(f.attributes)
    offset += feats.length
    if (!page.exceededTransferLimit && feats.length < 1000) break
    if (feats.length === 0) break
  }

  // 4. Dedupe. A case's outcome is well-defined only if its rows agree.
  const cases = new Map()
  const conflicts = []
  for (const r of rows) {
    const k = r.CASE_NUMBER
    const s = r.ACTION_TAKEN ?? '<null>'
    if (!cases.has(k)) cases.set(k, s)
    else if (cases.get(k) !== s) conflicts.push(k)
  }
  if (conflicts.length > 0) {
    throw new CensoringHalt(
      `${conflicts.length} case(s) carry CONFLICTING ACTION_TAKEN values across their rows ` +
        `(e.g. ${conflicts.slice(0, 5).join(', ')}). "The case's outcome" is no longer ` +
        `well-defined and no dedup rule short of reading the orders can fix that. ` +
        `reliefStats.json left UNCHANGED.`,
    )
  }

  // 5. Score cases — fail closed on any unrecognised value.
  let granted = 0
  let denied = 0
  let notOnMerits = 0
  let unresolved = 0
  const unrecognised = new Map()
  for (const s of cases.values()) {
    if (isGranted(s)) granted++
    else if (DENIED.includes(s)) denied++
    else if (NOT_ON_MERITS.includes(s)) notOnMerits++
    else if (UNRESOLVED.includes(s)) unresolved++
    else unrecognised.set(s, (unrecognised.get(s) ?? 0) + 1)
  }
  if (unrecognised.size > 0) {
    throw new CensoringHalt(
      `Unrecognised ACTION_TAKEN value(s) in the matured window:\n` +
        [...unrecognised].map(([s, c]) => `    · ${s} — ${c}`).join('\n') +
        `\n\n  Decide each bucket explicitly (merits grant? denial? procedural? unresolved?)\n` +
        `  before any figure ships. reliefStats.json left UNCHANGED.`,
    )
  }
  const decided = granted + denied

  // 6. Gates — refusals EXIT 1 (see header).
  refuseUnlessResidualIsSmall(unresolved, decided)
  if (decided === 0) {
    throw new CensoringHalt(
      'No decided BZA cases matched the outcome buckets; the vocabulary or the feed ' +
        'has changed. reliefStats.json left UNCHANGED.',
    )
  }
  if (decided < MIN_N) {
    throw new CensoringHalt(
      `Only ${decided} decided BZA cases in the matured window (need ≥ ${MIN_N}). ` +
        `The base rate isn't trustworthy at this sample size. reliefStats.json left UNCHANGED.`,
    )
  }

  const grantRate = Math.round((granted / decided) * 1000) / 1000
  // Adversarial floor: every unresolved case counted as a denial (caveat 3b).
  const floorPct = ((granted / (decided + unresolved)) * 100).toFixed(1)
  const stats = {
    grantRate,
    n: decided,
    window: `2022–${cutoff.getUTCFullYear()}`,
    label: LABEL,
    vintage:
      `BZA cases FILED ${SINCE} … ${cutoffIso} (≥ ${MATURITY_YEARS}y before run — DC publishes ` +
      `no decision date, so the frame is a matured filing cohort, not Boston's decision frame); ` +
      `computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}; ${rows.length} rows ` +
      `deduped to ${cases.size} cases (0 outcome conflicts); WHOLE-BOARD rate — variances and ` +
      `special exceptions cannot be separated (every relief field is unpopulated 2022+); ` +
      `decided-cases share: granted (Approved/Grant in Part) ÷ decided, excludes ` +
      `withdrawn/dismissed; ${granted} granted, ${denied} denied; ${unresolved} cases ` +
      `(${((unresolved / (decided + unresolved)) * 100).toFixed(1)}% of decided+unresolved) remain ` +
      `unresolved (Pending/Closed/blank) — if every one resolved to denial the cohort rate ` +
      `floor is ${floorPct}%`,
  }

  // 7. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = { ...existing, dc: { ...(existing.dc ?? {}), variance: stats } }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(
    `  Matured cohort filed ${SINCE} … ${cutoffIso}: ${cases.size} cases ` +
      `(${decided} decided on the merits, ${notOnMerits} withdrawn/dismissed, ${unresolved} unresolved).`,
  )
  console.log('  Wrote dc.variance:', stats)
}

main().catch((err) => {
  if (err instanceof CensoringHalt) {
    console.error(`\ndc.mjs REFUSED TO WRITE:\n\n  ${err.message}\n`)
    process.exitCode = 1
    return
  }
  console.error(`\ndc.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
