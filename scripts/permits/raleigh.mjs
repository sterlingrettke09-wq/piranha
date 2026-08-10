#!/usr/bin/env node
// WO-7.1 — Raleigh permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/raleigh.mjs
//
// Pulls the City of Raleigh "Building Permits" ArcGIS feature layer, filters to
// ground-up new BUILDINGS, computes the median and 80th-percentile
// application -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under raleigh. Idempotent; never
// touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the app
// reads; this script only refreshes it (re-run quarterly).
//
// ── WHAT THIS FIGURE IS, IN ONE PARAGRAPH (read before quoting it) ──────────
// A median filing -> issuance time over new-construction BUILDING permits filed
// 2022-01-01 onward. Raleigh's feed carries NON-ISSUED rows, so the issuance
// rate IS computable here and is reported below (90.7% overall; 97.3% / 97.4%
// for the matured 2022 / 2023 cohorts). That makes this one of the few city
// figures in this repo that is NOT merely a floor over survivors. The real
// caveat is different and is stated in the vintage: Raleigh issues PER-UNIT and
// PER-BUILDING child permits, so the row is not the project.
//
// ── Dataset ────────────────────────────────────────────────────────────────
// City of Raleigh ArcGIS Online, "Building Permits" (org v400IkDOw1ad7Yad).
// Probe the schema with:
//   curl -s "$LAYER?f=json" | python3 -c "import json,sys;[print(f['name'],f['type']) for f in json.load(sys.stdin)['fields']]"
// 183,456 rows on 2026-08-08, applied dates 2000-02-22..2026-08-06.
// maxRecordCount 2000 — paginate; do not trust one request to be complete.
const LAYER =
  'https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/' +
  'Building_Permits/FeatureServer/0'

const APPLIED_DATE_FIELD = 'applieddate'
const ISSUED_DATE_FIELD = 'issueddate'
const WORKCLASS_FIELD = 'workclass'
const USE_FIELD = 'proposeduse'

// Applications filed on/after this date. `applieddate` is a real esriFieldTypeDate,
// so the server-side comparison is a true date compare (no lexicographic trap).
const SINCE = '2022-01-01'

// ── Filter on `workclass`, NOT `workclassmapped` ───────────────────────────
// `workclassmapped = 'New'` admits Addition, Accessory Structure, Temporary
// Trailer and Manufactured Home while EXCLUDING `New Residential Dwelling`
// (7,174 rows) — wrong in both directions, and the excluded class is the single
// largest source of Raleigh houses.
//
// The vocabulary MIGRATED mid-2019. Every value below is a current one; the
// legacy equivalents ('New Single Family Dwelling' 2009..2022-05, 'Building
// Shell' ..2019-05, 'Mobile Home Original' 2000) are dead by the start of the
// window — 1 legacy row falls inside it, so nothing is lost by naming only the
// live vocabulary, and naming only the live vocabulary is what keeps a
// resurrected legacy code from entering silently.
//
// Before 2019 'New Building' also carried houses (≈2,600/yr); after the
// migration it is the non-residential class (≈200/yr) and residences split into
// 'New Residential Dwelling' + 'Townhouse'. That is why the window's mix looks
// nothing like the all-time histogram.
//
// DELIBERATELY EXCLUDED, each measured over the same window and hygiene gates:
//   Foundation Only   n=189 / 1.0 mo   an earlier PHASE of a project already
//                                      counted under New Building (the NYC
//                                      sub-permit failure mode).
//   Manufactured Home n= 45 / 1.4 mo   factory-built, set on a lot. Not site
//                                      construction. Nashville excluded the same.
const WORKCLASSES = ['New Building', 'New Residential Dwelling', 'Townhouse', 'Shell Building']

// ── The layer's SQL collation is case- and trailing-space-INSENSITIVE ───────
// Verified 2026-08-08: `workclass = 'New Building'`, `= 'New Building '` and
// `= 'NEW BUILDING'` each return exactly 47,074. The stored values are in fact
// inconsistent ('New Building' vs 'New Building ', 'Change Of Use' vs 'Change of
// Use') and a group-by returns an arbitrary member's spelling — so an exact-match
// WHERE is safe here, but any CLIENT-side comparison must trim. All client-side
// comparisons in this file go through norm().
const norm = (s) => String(s ?? '').trim()

// ── `proposeduse` is the building gate, and it is CURRENT ───────────────────
// A prior pass recorded "do NOT use proposeduse; it went stale at the 2020
// system migration". That is false for this window and was checked rather than
// inherited: populated on 99.1% / 99.2% / 98.5% / 98.0% of rows applied in
// 2022 / 2023 / 2024 / 2025, and on 100.0% of ISSUED rows. (The 2026 figure of
// 89.4% is not decay — see the issuance-rate note below.) `permitclass`, the
// Census-code field, IS stale: 56% null inside the window. `landusedescription`,
// `totalsqft` and `occupancyclass` are 100% / 100% / 99.8% empty here — dead
// fields that look alive in the schema.
//
// WHY THE GATE IS NEEDED: `workclass` says the work is NEW. It says nothing
// about whether the thing is a BUILDING. 685 of 8,685 rows in the window are not
// one — 123 sheds/boathouses, 47 signs, pergolas, ATMs, pedestrian bridges and a
// mausoleum, 19 residential garages/carports.
//
// ALLOWLIST, not a denylist: a `proposeduse` absent from this map is EXCLUDED
// and logged, so a category Raleigh adds later cannot quietly re-contaminate the
// sample.
//
// Admission criterion, stated once so the marginal calls are reviewable (same
// wording as nashville.mjs, deliberately): a permit is admitted iff it
// authorises a ROOFED STRUCTURE INTENDED FOR HUMAN OCCUPANCY OR THE STORAGE OF
// GOODS.
//
// Tier mirrors buildingTier() in netlify/functions/lib/timeline.ts: single =
// 1 unit, multi = 2-4, apartment = 5+ AND all commercial/institutional.
const TIER_BY_USE = {
  'DETACHED SINGLE FAMILY DWELLING': 'single',
  'TWO FAMILY BUILDING (DUPLEX)': 'multi',
  'THREE OR FOUR FAMILY BUILDING': 'multi',
  'FIVE OR MORE FAMILY BUILDING': 'apartment',
  'RESIDENTIAL CONDOMINIUM': 'apartment',
  'HOTEL, MOTEL AND TOURIST CABIN': 'apartment',
  'OFFICE, BANK, AND PROFESSIONAL BUILDING': 'apartment',
  'STORE AND MERCANTILE BUILDING': 'apartment',
  'INDUSTRIAL BUILDING': 'apartment',
  'SCHOOL AND OTHER EDUCATIONAL BUILDING': 'apartment',
  'CHURCH OR OTHER RELIGIOUS BUILDING': 'apartment',
  'SERVICE STATION OR REPAIR GARAGE': 'apartment',
  'PUBLIC WORKS & UTILITIES BUILDINGS': 'apartment',
  'HOSPITAL AND INSTITUTIONAL BUILDING': 'apartment',
  // A garage BUILDING, not a surface lot. Nashville admits the same class
  // (CAF03S002) and excludes its surface-lot neighbour for the same reason.
  'PARKING GARAGE (BLDGS & OPEN DECKED)': 'apartment',
  // 61 rows. Contains ~17 clubhouses/amenity buildings accessory to apartment
  // developments, which meet the occupancy criterion on their own terms. Kept,
  // and the choice is recorded because it is marginal — measured both ways it
  // moves nothing: apartment tier is 4.5 mo either way (p80 8.3 with, 8.4
  // without). Recorded so the next reader does not have to re-measure it.
  'AMUSEMENT & RECREATIONAL BUILDING': 'apartment',
  // Per-unit child permits. Tier is a GAP, not an answer — see UNRESOLVED_TIER.
  'RESIDENTIAL TOWNHOUSE': null,
}

// ── The one class whose tier is a GAP, not an answer (rule 5) ──────────────
// 'RESIDENTIAL TOWNHOUSE' is 3,803 issued rows — 51% of the sample and the
// largest single class. Its tier is genuinely indeterminate: Raleigh issues
// townhomes as PER-UNIT child permits, and 96.9% of these rows share their
// `proposedworkdescription` verbatim with at least one other row ("NEW 7 UNIT
// TOWNHOME LOTS 3138-3144", filed seven times). The row describes one dwelling
// inside a development whose size the feed does not record — `housingunitstotal`
// is null on 56% of them and reads 1 on most of the rest, and `devplanid`, the
// field that would group them, is null on 100% of the window.
//
// buildingTier() would call a 2-4-unit building 'multi' and a 5+ 'apartment';
// the source does not say which. Guessing is not cheap — measured 2026-08-08,
// folding townhomes in either way:
//   multi      3.5 mo (n=  166)  ->  2.0 mo (n=3,969)
//   apartment  4.5 mo (n=  501)  ->  2.2 mo (n=4,304)
// Either assignment roughly halves the tier it lands in. So these rows stay in
// the AGGREGATE and are OMITTED from the tier breakdown, with the count logged.
// Same treatment as Nashville's CAA03R301, for the same reason.
const UNRESOLVED_TIER_USE = 'RESIDENTIAL TOWNHOUSE'

// Non-building classes seen when this allowlist was built. Anything dropped that
// is NOT on this list is a NEW Raleigh category — surfaced loudly, because
// silence is how an allowlist rots. Measured over the window:
//   SHEDS, BOATHOUSES, ACCESSORY BUILDINGS   n=97 / 3.7 mo   mail kiosks, pool
//                                                            and maintenance
//                                                            buildings, dog wash
//   MISCELLANEOUS SUCH AS FENCES             n=32 / 3.8 mo   signs, pergolas,
//                                                            ATMs, pedestrian
//                                                            bridges, a mausoleum
//   RESIDENTIAL GARAGE OR CARPORT            n=15 / 3.1 mo
//   ADDITION/ALTERATION RESIDENTIAL BLDG     n=251 / 2.4 mo  MIXED: mostly
//     detached ADUs filed against a primary dwelling's permit number, but also
//     some genuine new single-family. The class cannot be split without parsing
//     free text, so it is dropped rather than guessed — 251 rows against 7,475.
//   ADDITION/ALTERATION NONRESIDENTIAL BLDG  n=7  / 2.9 mo
//   MANUFACTURED HOME                        n=1
//   '' (empty)                               n=216, none issued — see below
const KNOWN_NON_BUILDING = new Set([
  'SHEDS, BOATHOUSES, ACCESSORY BUILDINGS',
  'MISCELLANEOUS SUCH AS FENCES',
  'RESIDENTIAL GARAGE OR CARPORT',
  'ADDITION/ALTERATION RESIDENTIAL BLDG',
  'ADDITION/ALTERATION NONRESIDENTIAL BLDG',
  'MANUFACTURED HOME',
  '',
])

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'City of Raleigh ArcGIS Building_Permits layer 0 ' +
  `(workclass IN (${WORKCLASSES.join(', ')}), gated to building proposeduse only)`

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

async function arcgis(params) {
  const url = new URL(`${LAYER}/query`)
  const body = new URLSearchParams({ f: 'json', ...params })
  let res
  try {
    // POST: the WHERE clause plus the outFields list overruns some proxies' URL
    // length limits, and a truncated query is answered, not rejected.
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    })
  } catch (err) {
    throw new Error(
      `Network error reaching services.arcgis.com: ${err.message}. Check connectivity; ` +
        `the layer may also be temporarily offline. permitStats.json left UNCHANGED.`,
    )
  }
  if (!res.ok) throw new Error(`ArcGIS returned HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  // ArcGIS answers errors with HTTP 200 and an {error} body — a failed fetch must
  // never silently become a substantive answer (rule 5).
  if (json.error) throw new Error(`ArcGIS error ${json.error.code}: ${json.error.message}`)
  return json
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
const pct = (a, b) => (b === 0 ? 0 : (a / b) * 100)

const WHERE =
  `${APPLIED_DATE_FIELD} >= DATE '${SINCE}' AND ` +
  `${WORKCLASS_FIELD} IN (${WORKCLASSES.map((w) => `'${w}'`).join(',')})`

// Every row the layer holds, UNFILTERED — the grew-vs-shrank number. Goes
// through this script's own ArcGIS client so the count travels the same
// transport and error handling as the rows (rule 11). Best-effort: a failed
// count is recorded as an unknown and never aborts the run.
async function feedTotal() {
  return probeFeedTotal(LAYER, async () => {
    const json = await arcgis({ where: '1=1', returnCountOnly: 'true' })
    return json.count
  })
}

// maxRecordCount is 2000, so page explicitly rather than trusting one request to
// have returned everything.
async function pullAll() {
  const outFields = [
    'OBJECTID', WORKCLASS_FIELD, USE_FIELD, APPLIED_DATE_FIELD, ISSUED_DATE_FIELD,
  ].join(',')
  const rows = []
  for (let offset = 0; ; offset += 2000) {
    const page = await arcgis({
      where: WHERE,
      outFields,
      returnGeometry: 'false',
      orderByFields: 'OBJECTID ASC',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    const feats = page.features ?? []
    rows.push(...feats.map((f) => f.attributes))
    if (feats.length < 2000) break
    if (rows.length > 200_000) throw new Error('Pagination did not terminate; aborting.')
  }
  return rows
}

async function main() {
  console.log('Raleigh permit pipeline — Building_Permits layer 0')

  // 1. Probe the schema and confirm every field we read exists. If one is
  //    missing we refuse to fabricate a latency figure and leave the artifact
  //    untouched (the Boston lesson: code that did not run is not code that works).
  const meta = await arcgis({ where: '1=1', resultRecordCount: '1', outFields: '*' })
  const fieldIds = new Set((meta.fields ?? []).map((f) => f.name))
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, WORKCLASS_FIELD, USE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the layer schema; the service may have changed. ` +
          `Found: ${[...fieldIds].join(', ')}. Refusing to fabricate a latency figure; ` +
          `permitStats.json left UNCHANGED.`,
      )
    }
  }

  const totals = [await feedTotal()]
  logFeedTotals(totals)

  const rows = await pullAll()
  console.log(`  pulled ${rows.length} rows: applied >= ${SINCE} AND ${WORKCLASS_FIELD} IN (…)`)

  // 2. ISSUANCE RATE — computed over the WORKCLASS filter alone, before the
  //    `proposeduse` gate, and that ordering is the whole point.
  //
  //    `proposeduse` is assigned DURING REVIEW, not at filing: it is populated on
  //    100.0% of issued rows and blank on 26.8% of not-yet-issued ones. Computing
  //    the rate after the use gate would therefore drop mostly-unissued rows from
  //    the denominator and report ~93.5% instead of the true 90.7% — the
  //    instrument measuring itself (rule 11). `workclass` is present at filing, so
  //    it is the only filter the denominator may use.
  const applied = rows.filter((r) => r[APPLIED_DATE_FIELD] != null)
  const issuedRows = applied.filter((r) => r[ISSUED_DATE_FIELD] != null)
  console.log(
    `  issuance rate (workclass filter only): ${issuedRows.length}/${applied.length} = ` +
      `${pct(issuedRows.length, applied.length).toFixed(1)}%`,
  )
  const cohorts = new Map()
  for (const r of applied) {
    const y = new Date(r[APPLIED_DATE_FIELD]).getUTCFullYear()
    const c = cohorts.get(y) ?? { n: 0, issued: 0 }
    c.n++
    if (r[ISSUED_DATE_FIELD] != null) c.issued++
    cohorts.set(y, c)
  }
  for (const y of [...cohorts.keys()].sort()) {
    const c = cohorts.get(y)
    console.log(`    cohort ${y}: ${c.issued}/${c.n} = ${pct(c.issued, c.n).toFixed(1)}%`)
  }

  // 3. The `proposeduse` gate, then durations.
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let notABuilding = 0
  let unresolvedTier = 0
  let negative = 0
  const unknownUses = new Map()

  for (const row of rows) {
    const use = norm(row[USE_FIELD])
    if (!(use in TIER_BY_USE)) {
      notABuilding++
      unknownUses.set(use, (unknownUses.get(use) ?? 0) + 1)
      continue
    }
    const a = row[APPLIED_DATE_FIELD]
    const i = row[ISSUED_DATE_FIELD]
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (Number.isNaN(d)) continue
    if (d < 0) {
      negative++
      continue
    }
    if (d > 120 * 30.44) continue
    days.push(d)
    const tier = TIER_BY_USE[use]
    if (tier == null) unresolvedTier++
    else byTier[tier].push(d)
  }

  const cohortRows = rows.length - notABuilding
  console.log(`  excluded ${notABuilding} non-building rows (sheds, signs, ADU-mixed, garages…)`)
  logCohortRows(cohortRows, `${WHERE}, gated to the ${USE_FIELD} building allowlist`)
  console.log(
    `  ${unresolvedTier} townhouse rows kept in the aggregate but omitted from the tier split ` +
      `(per-unit child permits; development size unrecorded)`,
  )
  if (negative) console.log(`  dropped ${negative} row(s) issued before they were applied for`)

  // Anything dropped that is NOT one of the categories classified above is a NEW
  // Raleigh value. Surface it loudly.
  const novel = [...unknownUses].filter(([u]) => !KNOWN_NON_BUILDING.has(u))
  if (novel.length) {
    console.warn(
      `  ⚠ ${novel.length} proposeduse value(s) not seen when this allowlist was built, ` +
        `EXCLUDED pending classification: ${novel.map(([u, n]) => `${u} (${n})`).join(', ')}`,
    )
  }

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs; leaving permitStats.json unchanged.')
    return
  }

  // 4. DISTRIBUTION GATE. A large zero-day mass means both dates are stamped in
  //    one transaction and the interval is a recording artifact, not review time
  //    (Chicago's 2022-23 backfill halved that city's median before it was caught).
  const zeroDay = days.filter((d) => d < 0.5).length
  const within7 = days.filter((d) => d <= 7).length
  console.log(
    `  distribution: ${zeroDay} same-day (${pct(zeroDay, days.length).toFixed(2)}%), ` +
      `${within7} within 7 days (${pct(within7, days.length).toFixed(2)}%)`,
  )
  if (pct(zeroDay, days.length) > 50) {
    console.warn(
      `  ${pct(zeroDay, days.length).toFixed(1)}% of rows are same-day — an over-the-counter or ` +
        `backfill recording artifact, not a real review time. Not writing raleigh.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing. ` +
        `Investigate the dataset before trusting this.`,
    )
    return
  }

  const stamp = new Date().toISOString().slice(0, 10)
  // ── LIMITATIONS, carried in the vintage so they travel with the number ─────
  // (a) THE ROW IS NOT THE PROJECT. Raleigh issues per-unit child permits for
  //     townhomes (96.9% of townhouse rows repeat another row's description
  //     verbatim) and per-building child permits inside larger developments
  //     (15.8% of apartment-tier rows cite a main case or read "Building X of
  //     …"). A 40-unit townhome development contributes 40 fast rows. The
  //     grouping key exists only in free text — `devplanid` is null on 100% of
  //     the window — so grouping by project is a parsing job with its own
  //     failure modes and is deliberately left to a later pass rather than
  //     guessed at now.
  // (b) NOT A FLOOR, unusually. The feed carries non-issued rows, so the
  //     issuance rate is measured rather than assumed. Right-censoring of the
  //     2026 cohort is real but small: matured 2022-23 pooled gives 1.8 mo
  //     against 1.8 pooled over everything.
  const issuanceRate = pct(issuedRows.length, applied.length).toFixed(1)
  const vintage =
    `applied ${SINCE} onward; computed ${stamp}; ${DATASET_NAME}. ` +
    `The feed carries NON-ISSUED applications, so this is close to an unconditional median ` +
    `rather than a floor: ${issuanceRate}% of filings in the window have issued, and the ` +
    `matured 2022 and 2023 cohorts are at 97.3% and 97.4%. ` +
    `THE ROW IS NOT THE PROJECT — Raleigh issues per-unit child permits for townhomes ` +
    `(51% of the sample; 96.9% of those rows duplicate another row's description) and ` +
    `per-building child permits within larger developments (15.8% of apartment-tier rows cite ` +
    `a main case), which re-weights the median toward large repetitive developments. ` +
    `Townhouse rows are in the aggregate but carry no tier: the feed records neither the ` +
    `development's unit count nor a development id, so 'multi' vs 'apartment' is a GAP.`

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
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo p80 ${v.p80Months} n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // ── Expected output, measured against the live layer on 2026-08-08 ────────
  // A re-run should land near these. A LARGE move means the workclass vocabulary
  // migrated again or the proposeduse domain changed — reconcile against these
  // before believing the new number (rule 16: a result that contradicts a
  // known-good one is the instrument's problem first).
  //   aggregate  1.8 mo / p80 3.2 / n = 7,475   issuance 90.7%, same-day 0.09%
  //   single     1.4 / 2.7 / n = 3,005
  //   multi      3.5 / 7.1 / n =   166
  //   apartment  4.5 / 8.3 / n =   501
  //   (+3,803 townhouse rows in the aggregate, no tier)
  //   cohort medians 2022..2025: 1.78 / 1.81 / 1.75 / 1.88 — flat, so the pooled
  //   figure is not being carried by one year.

  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    raleigh: {
      ...(existing.raleigh ?? {}),
      newConstruction: stats,
      byTier: tiers,
      tierBreakdown,
      feed: feedCounts({
        totals,
        cohortRows,
        basis:
          `totalRows: every row the Building_Permits layer holds, unfiltered. cohortRows: ` +
          `${APPLIED_DATE_FIELD} >= ${SINCE} AND ${WORKCLASS_FIELD} on the new-construction ` +
          `allowlist, then gated to the ${USE_FIELD} building allowlist — issued and not, ` +
          `because this feed carries non-issued applications. The published n is smaller: it ` +
          `keeps only rows with both dates present and a duration that is non-negative and ` +
          `under 120 months.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote raleigh.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nraleigh.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
