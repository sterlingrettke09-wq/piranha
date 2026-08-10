#!/usr/bin/env node
// WO-7.1 — Boston permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/boston.mjs
//
// Pulls Boston's "Approved Building Permits" dataset from data.boston.gov and
// WOULD compute the median / 80th-percentile application -> issuance time for
// ground-up new construction, merging it into
// netlify/functions/lib/data/permitStats.json under boston.newConstruction.
//
// ⚠️ IT DOES NOT, AND CANNOT. Read the halt section below before changing
// anything here. This script's correct output today is *no output*.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why this script writes nothing (verified 2026-08-06) ──────────
// Boston's Approved Building Permits dataset publishes ONE usable date per
// record: `issued_date`. There is no application / filed / received date, and
// no such column exists anywhere in the schema (25 columns; the only other
// timestamp is `expiration_date`, which is derived from issuance). Verified
// against the live schema, not guessed:
//   curl -s "https://data.boston.gov/api/3/action/datastore_search?resource_id=6ddcd912-32a0-43df-9908-63574f8c7e77&limit=1" \
//     | python3 -c "import json,sys;[print(f['id'],f['type']) for f in json.load(sys.stdin)['result']['fields']]"
//
// An application -> issuance latency therefore has no numerator. This is a GAP,
// not an answer (evidence rule 5): we have not measured that Boston is fast, we
// have established that Boston does not publish the input. The halt is
// STRUCTURAL and deliberate — see applicationDateField(), which throws a
// ComputabilityHalt when no application-date column is present — not an
// incidental side effect of some other failure.
//
// Why that distinction is the whole point of this file: the previous version
// halted here too, but only by accident of ordering. Its actual FILTER was
// 58.0% contaminated, and nothing but the missing date column stood between
// that filter and a published number. Code that did not run is not code that
// works. The filter below is now correct on its own merits, so that if Boston
// ever adds a filed-date column the thing that starts running is right.
//
// ── The filter — CORRECTED 2026-08-06 ───────────────────────────────────────
// WAS: `worktype = 'ERECT'`. That admitted 1,606 rows since 2023, of which only
// 674 were new-construction permits. Measured breakdown of what `worktype =
// 'ERECT'` selected (issued 2023-01-01 onward):
//
//     855  Certificate of Occupancy   (53.2%)  ← project CLOSEOUT, permitnumber COO*
//      67  Foundation Permit          ( 4.2%)  ← an earlier PHASE, permitnumber FND*
//      10  Electrical Permit          ( 0.6%)  ← a sub-permit,     permitnumber E*
//     674  Erect/New Construction     (42.0%)  ← the only real one, permitnumber ERT*
//
// `worktype` is the wrong axis entirely: it records what the work touched, and
// a CO for a newly erected building carries worktype 'ERECT' exactly because the
// building was erected. The permit's KIND lives in `permittypedescr`, and the
// permitnumber prefix (COO/FND/E/ERT) corroborates it independently.
//
// These are not merely extra rows — they are the SAME PROJECTS already counted.
// Joined on `property_id` against the retained Erect/New Construction set:
//   · Certificates of Occupancy: 847 of 855 (99%) match a property that already
//     has an Erect permit, and 100% of those were issued AFTER it, median +23.7
//     months (p20 +13.8, p80 +35.2). A CO is the end of a project whose start is
//     already in the sample.
//   · Foundation Permits: 52 of 67 (78%) match, and 96% were issued BEFORE the
//     Erect permit, median -2.6 months. A foundation permit is an earlier phase
//     of the same job.
// So the old filter counted many Boston projects two or three times over. That
// re-weights any median toward whichever projects happen to be phased, on top of
// admitting the wrong milestone.
//
// ALSO ADDED — 10 rows the old filter missed. `permittypedescr =
// 'Erect/New Construction'` catches 684, ten more than worktype='ERECT'. All ten
// carry an ERT* permit number; their `worktype` records the CLIENT or the
// structure rather than the work: 7 × 'COB' (City of Boston), 1 × 'GARAGE', 2 ×
// null. They are genuine ground-up permits — 85,655 and 112,200 and 67,462 sq ft
// municipal buildings among them — that a worktype filter simply cannot see.
//
// ALLOWLIST, not a denylist: a `permittypedescr` we have never seen is EXCLUDED
// rather than admitted, so a new Boston permit category cannot quietly
// re-contaminate this. The allowlist is a SINGLETON, and that is a finding, not
// an oversight — the full permittypedescr histogram since 2023 has exactly one
// ground-up category. The other twelve are Short Form Bldg (40,989), Electrical
// (31,899), Plumbing (18,379), Gas (11,073), Long Form/Alteration (9,751),
// Electrical Low Voltage (7,493), Fire Alarms (6,251), Certificate of Occupancy
// (4,403), Electrical Temporary Service (1,443), Amendment to a Long Form
// (1,332), Use of Premises (208) and Foundation Permit (73). None is new
// construction.
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// CKAN datastore resource id for the active "Approved Building Permits" CSV.
// How to re-find it if it changes (CKAN resource ids rotate on re-upload):
//   curl -s "https://data.boston.gov/api/3/action/package_show?id=approved-building-permits" \
//     | python3 -c "import json,sys;[print(r['datastore_active'],r['id'],r['name']) for r in json.load(sys.stdin)['result']['resources']]"
// and take the resource whose datastore_active is True.
const RESOURCE_ID = '6ddcd912-32a0-43df-9908-63574f8c7e77'
const BASE = 'https://data.boston.gov/api/3/action'

// The permit-kind field, and the allowlist of kinds that are ground-up new
// construction. See the header for the measured contamination this replaced.
const PERMIT_TYPE_FIELD = 'permittypedescr'
const NEW_CONSTRUCTION_PERMIT_TYPES = ['Erect/New Construction']

// Only permits inside this window go into the sample (keeps the vintage recent
// and the n meaningful). NOTE the leg this is applied to: once an application
// date exists, the window must be sliced on the APPLICATION date, not on
// issuance. Slicing by issuance selects on the outcome — it drops exactly the
// slow applications that had not yet issued, which is the NYC censoring trap in
// a different costume. The old code here sliced on `issued_date`.
const SINCE = '2023-01-01'

// The dataset reliably carries `issued_date`. An application/filed date is NOT
// published (see THE HALT above) — but CKAN schemas drift, so we probe a list of
// candidate column names rather than hard-coding the absence. If none is
// present we do NOT fabricate an application->issuance figure: we report the gap
// and leave the artifact untouched.
const APPLIED_DATE_CANDIDATES = [
  'applied_date', 'application_date', 'filed_date', 'app_date',
  'application_received_date', 'received_date', 'filing_date', 'apply_date',
]
const ISSUED_DATE_FIELD = 'issued_date'

// A date column that is TEXT rather than timestamp cannot be compared
// server-side: 'MM/DD/YYYY' strings compare lexicographically and silently
// return the wrong window. (NYC's pipeline was bitten by exactly this.)
const DATE_TYPES = new Set(['timestamp', 'timestamptz', 'date'])

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'data.boston.gov approved-building-permits ' +
  `(${PERMIT_TYPE_FIELD} = '${NEW_CONSTRUCTION_PERMIT_TYPES.join("' | '")}')`

import { readFile, writeFile } from 'node:fs/promises'
import { noTierBreakdown } from './lib/tierFloor.mjs'
import { feedCounts, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

async function ckan(action, params) {
  const url = new URL(`${BASE}/${action}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching data.boston.gov (${action}): ${err.message}. ` +
      `Check connectivity; the dataset may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`data.boston.gov ${action} returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (!body.success) throw new Error(`CKAN ${action} reported failure: ${JSON.stringify(body.error ?? body)}`)
  return body.result
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

const sqlList = (values) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')

/**
 * THE STRUCTURAL HALT (evidence rule 14: make the caught error an impossible
 * state, not a comment).
 *
 * Returns the name of a usable application-date column, or throws a
 * ComputabilityHalt describing precisely why no timing can be produced. Every
 * path that could write permitStats.json runs downstream of this call, so the
 * script cannot emit a Boston figure without one — the refusal is not something
 * a later edit can step around by accident, which is exactly how the previous
 * version came to be "safe".
 */
class ComputabilityHalt extends Error {}

function applicationDateField(fields) {
  const found = APPLIED_DATE_CANDIDATES.filter((f) => fields.has(f))
  if (found.length === 0) {
    throw new ComputabilityHalt(
      `Boston publishes no application/filed date.\n` +
        `    Probed: ${APPLIED_DATE_CANDIDATES.join(', ')}\n` +
        `    Schema has: ${[...fields].join(', ')}\n` +
        `    An application -> issuance latency has no numerator, so there is NOTHING\n` +
        `    to compute. This is a GAP, not a finding that Boston is fast. Do not\n` +
        `    substitute expiration_date, a permit-number sequence, or any other\n` +
        `    proxy — inventing the missing leg is the failure this halt exists to\n` +
        `    prevent. permitStats.json left UNCHANGED.`,
    )
  }
  const name = found[0]
  const type = fields.get(name)
  if (!DATE_TYPES.has(type)) {
    throw new ComputabilityHalt(
      `Found candidate application-date column "${name}" but its type is "${type}",\n` +
        `    not a timestamp. Text dates compare LEXICOGRAPHICALLY server-side, which\n` +
        `    silently returns the wrong window rather than an error. Parse it\n` +
        `    client-side and filter in JS before trusting any figure.\n` +
        `    permitStats.json left UNCHANGED.`,
    )
  }
  return name
}

async function main() {
  console.log(`Boston permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Discover which fields exist, and their types (one tiny request).
  const probe = await ckan('datastore_search', { resource_id: RESOURCE_ID, limit: '1' })
  const fields = new Map(probe.fields.map((f) => [f.id, f.type]))
  if (!fields.has(ISSUED_DATE_FIELD)) {
    throw new Error(`Expected field "${ISSUED_DATE_FIELD}" not found in dataset schema; ` +
      `the resource may have changed. Found: ${[...fields.keys()].join(', ')}`)
  }
  if (!fields.has(PERMIT_TYPE_FIELD)) {
    throw new Error(`Expected field "${PERMIT_TYPE_FIELD}" not found in dataset schema; ` +
      `the permit-kind allowlist cannot be applied and a worktype fallback is NOT\n` +
      `acceptable (it was 58.0% contaminated — see header). ` +
      `Found: ${[...fields.keys()].join(', ')}`)
  }

  // 1b. Feed row count, logged BEFORE the halt. Boston refuses to write and has
  //     always refused, so this line is the only thing a future investigator
  //     gets from a run here — and "was there nothing to find, or has the feed
  //     changed?" is exactly the question they will be asking. CKAN's
  //     datastore_search already returns the resource's total row count on the
  //     schema probe above, so this costs no extra request and comes back
  //     through the pipeline's own client (rule 11).
  const totals = [
    await probeFeedTotal(`data.boston.gov datastore ${RESOURCE_ID}`, async () => probe.total),
  ]
  logFeedTotals(totals)

  // 2. The halt. Throws unless a real application-date column exists.
  const appliedField = applicationDateField(fields)

  // ── Everything below this line has never executed. ─────────────────────────
  // It is written to be correct on the day Boston adds a filed-date column, but
  // it is UNVERIFIED against live data by definition, so treat its first run as
  // new code: check the n against the counts in the header (684 rows since
  // 2023-01-01) before believing any median it prints.

  // 3. Pull application + issuance dates for new-construction permits, windowed
  //    on the APPLICATION date (not issuance — see SINCE).
  const sql =
    `SELECT "${appliedField}" AS applied, "${ISSUED_DATE_FIELD}" AS issued, ` +
    `"${PERMIT_TYPE_FIELD}" AS ptype, occupancytype ` +
    `FROM "${RESOURCE_ID}" ` +
    `WHERE "${PERMIT_TYPE_FIELD}" IN (${sqlList(NEW_CONSTRUCTION_PERMIT_TYPES)}) ` +
    `AND "${appliedField}" >= '${SINCE}' ` +
    `AND "${appliedField}" IS NOT NULL ` +
    `AND "${ISSUED_DATE_FIELD}" IS NOT NULL`
  const result = await ckan('datastore_search_sql', { sql })

  // 4. Durations. The allowlist is enforced again client-side: CKAN's IN clause
  //    already did it, but a row whose ptype is not on the list must never fall
  //    through into the aggregate regardless of how it arrived.
  const days = []
  let offAllowlist = 0
  for (const row of result.records) {
    if (!NEW_CONSTRUCTION_PERMIT_TYPES.includes(row.ptype)) {
      offAllowlist++
      continue
    }
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) days.push(d) // drop negatives / absurd outliers
  }
  if (offAllowlist > 0) console.warn(`  dropped ${offAllowlist} rows off the permit-type allowlist`)

  if (days.length === 0) {
    console.warn('  No usable application/issuance pairs returned; leaving permitStats.json unchanged.')
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

  // ── NO byTier BREAKDOWN, and that is a measured gap ──────────────────────
  // Austin publishes a Census use code, so its rows map cleanly onto
  // buildingTier() in netlify/functions/lib/timeline.ts (single = 1 unit,
  // multi = 2-4, apartment = 5+ and all commercial). Boston publishes no unit
  // count at all. The nearest field is `occupancytype`, and it does not resolve
  // the tier boundaries — measured composition of the retained 684 rows:
  //
  //     219  32.0%  1-2FAM   ← straddles single AND multi
  //     167  24.4%  Multi    ← straddles multi AND apartment
  //     103  15.1%  1-3FAM   ← straddles single AND multi
  //      60   8.8%  Mixed    ← unit count unknown
  //      48   7.0%  1-4FAM   ← straddles single AND multi
  //      45   6.6%  Comm     ← maps cleanly (commercial -> apartment)
  //      24   3.5%  Other  ·  18  2.6%  VacLd
  //
  // Only 'Comm' (n=45) maps to a tier without guessing. Assigning '1-2FAM' to
  // single or to multi would be an invented conversion (evidence rule 4), and
  // deriving units from sq_feet would be the same thing with more arithmetic.
  // So the aggregate below is a MIXED-POPULATION median and must be labelled as
  // one — it is not a single-family figure and not an apartment figure.
  const stamp = new Date().toISOString().slice(0, 10)
  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage:
      `applied ${SINCE} onward; computed ${stamp}; ${DATASET_NAME}. ` +
      `Mixed-tier aggregate: Boston publishes no unit count, so this cannot be ` +
      `split into single / multi / apartment and applies to none of them specifically.`,
  }

  // 6. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse(await readFile(OUT_PATH, 'utf8') || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    boston: {
      ...(existing.boston ?? {}),
      newConstruction: stats,
      // Declared, not omitted: a reader of permitStats.json must be able to tell
      // "no breakdown was ever computed, so the aggregate IS the answer" from
      // "a breakdown exists and this tier was withheld" (rule 5).
      tierBreakdown: noTierBreakdown(
        'scripts/permits/boston.mjs computes no tier split; the feed carries no application date, so the script writes nothing at all today. If it ever does, revisit this declaration.',
      ),
      feed: feedCounts({
        totals,
        cohortRows: result.records.length,
        basis:
          `totalRows: every row CKAN resource ${RESOURCE_ID} holds, unfiltered. ` +
          `cohortRows: ${PERMIT_TYPE_FIELD} on the new-construction allowlist AND applied ` +
          `>= ${SINCE} with both dates non-null. The published n is smaller: it also drops ` +
          `rows off the allowlist client-side and durations that are negative or over 120 ` +
          `months. Like everything else below the halt, this has never executed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`  Wrote boston.newConstruction:`, stats)
}

main().catch((err) => {
  if (err instanceof ComputabilityHalt) {
    // An expected, permanent condition — not a failure. Exit 0 so a batch runner
    // does not treat Boston's known gap as a broken pipeline.
    console.warn(`\nboston.mjs — NOT COMPUTABLE, by design:\n    ${err.message}\n`)
    return
  }
  console.error(`\nboston.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
