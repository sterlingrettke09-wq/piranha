#!/usr/bin/env node
// WO-7.1 — Nashville / Davidson County permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/nashville.mjs
//
// Pulls the Metro Nashville "Building Permits Issued" ArcGIS feature layer,
// filters to ground-up new BUILDINGS, computes median and 80th-percentile
// application -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under nashville. Idempotent; never
// touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the app
// reads; this script only refreshes it (re-run quarterly).
//
// ── THIS SCRIPT DID NOT EXIST UNTIL 2026-08-06 ──────────────────────────────
// The nashville block in permitStats.json (1.1 mo / p80 2.7 / n=10,196) was
// committed with NO generator in the repo — the same defect nyc.mjs had, one
// step worse: there was nothing to disagree with. The filter was reconstructed
// from the committed `vintage` string (`Per_Ty IN ('CACN','CARN')`, applied
// 2023-08-01 onward) and re-run against the live layer on 2026-08-06; it
// reproduces 10,196 / 1.1 / 2.7 to the digit. That reproduction is what licenses
// the corrections below — the delta is a real change of basis, not drift.
//
// ── Dataset ────────────────────────────────────────────────────────────────
// NashvilleOpenData "Building Permits Issued", ArcGIS Online feature service.
// Probe the schema with:
//   curl -s "$LAYER?f=json" | jq '.fields[].name'
// Carries Date_Entered (application) + Date_Issued + Per_Ty (permit type) +
// Per_SubTy (permit subtype = the use/occupancy class) + Purpose (free text).
const LAYER =
  'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/' +
  'Building_Permits_Issued_2/FeatureServer/0'

const APPLIED_DATE_FIELD = 'Date_Entered'
const ISSUED_DATE_FIELD = 'Date_Issued'
const TYPE_FIELD = 'Per_Ty'
const SUBTYPE_FIELD = 'Per_SubTy'

// ── ROLLING WINDOW — why the start date differs from every other city ───────
// This feed is a rolling ~3-year window of ISSUED permits (measured 2026-08-06:
// issue dates span 2023-08-01..2026-08-04; 28,571 rows total). The 2022-01-01
// start the other cities use is therefore NOT attainable: a permit applied in
// 2022 only appears if it issued after 2023-08-01, i.e. only the SLOW half of
// the 2022 cohort survives. Starting at the window's own left edge avoids that
// left-truncation. 2023-08-01 is the earliest application cohort the window
// covers completely.
const SINCE = '2023-08-01'

// ── Permit-type ALLOWLIST ──────────────────────────────────────────────────
// CACH ADDED 2026-08-06. "Building Commercial - Shell" is ground-up commercial
// construction and was excluded outright: 104 admitted rows at median 4.6 mo /
// p80 8.2 against 1.1 / 2.8 for the retained set — retail, warehouse, office and
// 5+-unit multifamily shells, i.e. the largest projects in the sample and 4x the
// retained median. Same shape as Austin's `Shell`.
//
// Types considered and DELIBERATELY still excluded, each measured (n / median mo,
// same window and hygiene gates):
//   CACF Commercial - Foundation      40 / 2.3  ─┐ phased sub-permits of a project
//   CACG Commercial - Structural Frame 17 / 2.3  ─┤ already counted under CACN/CACH.
//   CARF Residential - Foundation       6 / 0.6  ─┘ Purpose text cites the master
//                                                   permit. Admitting them is the
//                                                   NYC failure mode (63.9% of that
//                                                   script's set was sub-permits).
//   CAUO Use & Occupancy              322 / 2.3   master-permit + CO records, no
//                                                 construction ("MASTER PERMIT NO
//                                                 CONSTRUCTION THIS PERMIT").
//   CACT Commercial - Tenant Finish Out 849 / 2.6 fit-out inside an existing shell.
//   CARS Residential New Storm Damage   21 / 0.5  named "New" but the Purpose text
//   CACS Commercial New Storm Damage     4 / 1.6  is repair ("tornado repair damage
//                                                 to garage", "rip and replace brick
//                                                 veneer"). A type NAME is not a
//                                                 measurement of what it holds.
const PERMIT_TYPES = ['CARN', 'CACN', 'CACH']

// ── Subtype ALLOWLIST — ADDED 2026-08-06 ───────────────────────────────────
// `Per_Ty` says the work is NEW. It says nothing about whether the thing is a
// BUILDING — that is carried by `Per_SubTy`. An audit found 24.6% of the old
// admitted set was not a building: 2,504 of 10,196 rows, dominated by 2,398
// swimming pools, detached garages, sheds, carports and decks.
//
// ALLOWLIST, not a denylist: a subtype absent from this map is EXCLUDED and
// logged, so a new Nashville category cannot quietly re-contaminate the sample.
//
// Admission criterion, stated once so the marginal calls are reviewable: a
// subtype is admitted iff the permit authorises a ROOFED STRUCTURE INTENDED FOR
// HUMAN OCCUPANCY OR THE STORAGE OF GOODS. That excludes, with n / median mo:
//   accessory structures  2,398 / 1.0  pools (873), garages (624), sheds (532),
//                                      carports (168), decks (90), water tank (1)
//                                      — IBC Group U, "utility and miscellaneous"
//   site work                30 / 1.1  surface parking lot, park, greenway, zoo
//   mobile / not affixed      64 / 1.3  food trucks, mobile vendors, mobile-home
//                                       placement (a factory-built unit set on a lot)
//   open structures            9 / 1.9  bleachers, grandstands, a bank ATM
//   administrative             3 / 3.6  master-permit application, home-occupation
//
// Tier mirrors buildingTier() in netlify/functions/lib/timeline.ts: single =
// 1 unit, multi = 2-4, apartment = 5+ AND all commercial/institutional.
//
// Nashville's subtype taxonomy carries the unit band IN THE LABEL — "Condominium
// 3&4 Unit Bldg", "Apt / Twnhome > 5 Unit Bldg" — so the tier is read off the
// source rather than assumed. `CAA03R301 Multifamily, Townhome` is the one class
// that has no band, and it is mapped to `null`: see UNRESOLVED_TIER below.
//
// ADU precedent: `CAA11R301` (Detached ADU) and `CAA10R301` (Accessory Apartment)
// go to `multi`, matching austin.mjs mapping class 102 (Secondary Apartment) the
// same way — an ADU is a second unit on a lot that already has one.
const RESIDENTIAL_TIER = {
  CAA01R301: 'single', //     Single Family Residence
  CAA02R302: 'multi', //      Duplex
  CAA03R298: 'multi', //      Multifamily, Condominium 3&4 Unit Bldg
  CAA03R398: 'multi', //      Multifamily, Tri-Plex, Quad, Apartments
  CAA10R301: 'multi', //      Accessory Apartment
  CAA11R301: 'multi', //      Detached Accessory Dwelling Unit
  CAA03R299: 'apartment', //  Multifamily, Condominium > 5 Unit Bldg
  CAA03R399: 'apartment', //  Multifamily, Apt / Twnhome > 5 Unit Bldg
  CAA03R301: null, //         Multifamily, Townhome — SEE UNRESOLVED_TIER
}

// ── The one class whose tier is a GAP, not an answer (rule 5) ──────────────
// `CAA03R301 Multifamily, Townhome` is 1,343 rows — 17% of the corrected sample,
// the second largest class. Its tier is genuinely indeterminate: Nashville issues
// townhomes as PER-UNIT child permits ("To construct a 2031sf townhome with 257sf
// attached garage", repeated once per unit under one master permit), so the row
// describes one dwelling inside a development of unknown size. The subtype
// taxonomy HAS a slot for the unit band and this class declines to fill it, while
// its neighbours R298/R299/R398/R399 all carry one — the source's own structure
// says the band is unrecorded here, not that it is small.
//
// Guessing is not cheap. Measured 2026-08-06, folding townhomes in either way:
//   multi      2.2 mo (n=452)  ->  1.2 mo (n=1,795)
//   apartment  3.0 mo (n=570)  ->  1.3 mo (n=1,913)
// Either assignment roughly halves the tier it lands in. So these rows stay in
// the aggregate and are OMITTED from the tier breakdown, with the count logged.
const UNRESOLVED_TIER = 'CAA03R301'

// Every commercial / institutional subtype observed in CACN + CACH on 2026-08-06
// that meets the admission criterion. All map to the `apartment` tier because
// buildingTier() routes use === 'commercial' || 'institutional' there. Frozen
// deliberately: a subtype added by Metro after this date is excluded and logged
// until someone classifies it.
const COMMERCIAL_SUBTYPES = [
  'CAB02A315', // Cultural Center, Libraries
  'CAB02A316', // Cultural Center, Museum
  'CAB03I402', // Day Care Center (Up To 75) - Child Care
  'CAB04I402', // Day Care Center (Over 75) - Child
  'CAB10A201', // Religious Institution, Banquet Hall
  'CAB10A305', // Religious Institution, Worship Space
  'CAB10A390', // Religious Institution, Fellowship Hall
  'CAC02A314', // College / University, Lecture Halls
  'CAC02A504', // College / University, Stadiums
  'CAC02B009', // College / University, Educational > 12Th
  'CAC03A313', // Community Education, Indr Tennis Court
  'CAC03A314', // Community Education, Lecture Halls
  'CAC03A504', // Community Education, Stadiums
  'CAC04R204', // Dormitories
  'CAC07A314', // Vocational School, Lecture Halls
  'CAD01B003', // Financial Institution, Banks
  'CAD02A307', // General Office, Courtrooms
  'CAD02B006', // General Office, Civic Administration
  'CAD02B016', // General Office, Professional Services
  'CAD03B000', // Leasing / Sales Office, Other
  'CAE02I002', // Hospital, Institutional I-2
  'CAE04B016', // Medical Office, Professional Services
  'CAE05B012', // Medical/Sci Lab, Labs, Testing/ Research
  'CAE09I001', // Rehabilitation Services
  'CAE10I001', // Assisted Care Living
  'CAF03S002', // Automobile Parking - Structure  (a garage BUILDING; the surface
  //               lot class CAF03Z000 is excluded — paving, no structure)
  'CAF04S001', // Automobile Repair, Storage Mod Hazard
  'CAF05M004', // Automotive Service
  'CAF06A204', // Bar Or Nightclub, Tavern And Bars
  'CAF11A301', // Funeral Home, Funeral Parlors
  'CAF14R102', // Hotel / Motel
  'CAF18B011', // Personal Care Svcs, Fitness Studio
  'CAF19A203', // Restaurant (Full Service)
  'CAF20M001', // Retail, Department / Retail Stores
  'CAF21S001', // Self Service Storage, Storage Mod Hazard
  'CAF24M003', // Automobile Convenience, Markets
  'CAF25S001', // Automobile Sales, New
  'CAF26S001', // Automobile Sales, Used
  'CAF27B005', // Car Wash
  'CAF30A203', // Restaurant (Fast Food)
  'CAF31A203', // Restaurant (Take Out)
  'CAF32B000', // Wrecker Service, Business (Other)
  'CAG03B000', // Multi-Media Production
  'CAH01M001', // Building Contractor Supply, Retail
  'CAH01S001', // Building Contractor Supply, Storage S-1
  'CAH02M005', // Distributive Bus/Wholesale, Wholesale St
  'CAH03H000', // Fuel Storage, Hazardous (H1-H5)
  'CAH04M001', // Heavy Equipment Sales
  'CAH06H000', // Manufacturing, Light Hazardous (H1-H5)
  'CAH10S001', // Warehouse, Storage S-1
  'CAH10S002', // Warehouse, Storage S-2
  'CAH11H000', // Manufacturing, Med Hazardous (H1-H5)
  'CAI01A317', // Airport/Heliport, Passngr Statn (Wait area)
  'CAI07S001', // Motor Freight, Storage S-1
  'CAJ01H000', // Power/Gas Substatn, Hazardous (H1-H5)
  'CAJ04B011', // Safety Services, Fire & Police Station
  'CAJ06H000', // Water/Sewer Pump Statn, Hazardous (H1-H5)
  'CAJ07H000', // Water Treatment Plant, Hazardous (H1-H5)
  'CAK05H000', // Recycling Facility
  'CAL02A201', // Club, Banquet Hall
  'CAL03A999', // Commercial Amusement (In), Other
  'CAL04A501', // Comm. Amusement (Out), Amusement Park
  'CAL12A303', // Recreation Center, Community Halls
  'CAL12A401', // Recreation Center, Arenas
  'CAL14A504', // Stadium/Arena/Convention Cntr, Stadiums
  'NEWCOMM', //   New Commercial Construction   (irregular legacy code)
  'SHELL', //     Commercial Shell Generic      (irregular legacy code)
]

/** subtype code -> 'single' | 'multi' | 'apartment' | null (admitted, tier unresolved) */
const TIER_BY_SUBTYPE = new Map([
  ...Object.entries(RESIDENTIAL_TIER),
  ...COMMERCIAL_SUBTYPES.map((s) => [s, 'apartment']),
])

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'NashvilleOpenData Building Permits Issued (ArcGIS Building_Permits_Issued_2 layer 0; ' +
  `Per_Ty IN (${PERMIT_TYPES.join(', ')}) = Building Residential/Commercial - New + Commercial Shell, ` +
  'gated to building Per_SubTy only)'

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'

async function arcgis(params) {
  const url = new URL(`${LAYER}/query`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching services2.arcgis.com: ${err.message}. Check connectivity; ` +
        `the layer may also be temporarily offline.`,
    )
  }
  if (!res.ok) throw new Error(`ArcGIS returned HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  // ArcGIS answers errors with HTTP 200 and an {error} body — a failed fetch must
  // never silently become a substantive answer.
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

// The layer caps a page at maxRecordCount (1000), so page explicitly rather than
// trusting one request to have returned everything.
async function pullAll() {
  const where = `${TYPE_FIELD} IN (${PERMIT_TYPES.map((t) => `'${t}'`).join(',')})`
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const page = await arcgis({
      where,
      outFields: [TYPE_FIELD, SUBTYPE_FIELD, APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, 'Permit__'].join(','),
      returnGeometry: 'false',
      orderByFields: 'ObjectId ASC',
      resultOffset: String(offset),
      resultRecordCount: '1000',
      f: 'json',
    })
    const feats = page.features ?? []
    rows.push(...feats.map((f) => f.attributes))
    if (feats.length < 1000) break
    if (rows.length > 200_000) throw new Error('Pagination did not terminate; aborting.')
  }
  return rows
}

async function main() {
  console.log('Nashville permit pipeline — Building_Permits_Issued_2 layer 0')

  // 1. Probe the schema and confirm every field we read exists. If one is
  //    missing we refuse to fabricate a latency figure and leave the artifact
  //    untouched (the Boston lesson: code that did not run is not code that works).
  const meta = await arcgis({ where: '1=1', resultRecordCount: '1', outFields: '*', f: 'json' })
  const fieldIds = new Set((meta.fields ?? []).map((f) => f.name))
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD, SUBTYPE_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the layer schema; the service may have changed. ` +
          `Found: ${[...fieldIds].join(', ')}. Refusing to fabricate a latency figure; ` +
          `permitStats.json left UNCHANGED.`,
      )
    }
  }

  const rows = await pullAll()
  console.log(`  pulled ${rows.length} rows for Per_Ty IN (${PERMIT_TYPES.join(', ')})`)

  // 2. Confirm the rolling window still starts where SINCE assumes. If Metro ever
  //    widens or narrows the feed, SINCE is wrong and the figure silently changes
  //    basis — so check rather than assume.
  const issued = rows.map((r) => r[ISSUED_DATE_FIELD]).filter((v) => v != null)
  const windowStart = new Date(Math.min(...issued)).toISOString().slice(0, 10)
  const windowEnd = new Date(Math.max(...issued)).toISOString().slice(0, 10)
  console.log(`  issued-date window: ${windowStart} .. ${windowEnd} (SINCE = ${SINCE})`)
  if (windowStart > SINCE) {
    throw new Error(
      `The feed's earliest issue date (${windowStart}) is now AFTER SINCE (${SINCE}). ` +
        `Applications filed before ${windowStart} are left-truncated — only the slow ones ` +
        `survive into the window. Raise SINCE to ${windowStart} and re-run. UNCHANGED.`,
    )
  }

  const sinceMs = Date.parse(`${SINCE}T00:00:00.000Z`)
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let notABuilding = 0
  let unresolvedTier = 0
  let sameDay = 0
  let inWindow = 0
  const unknownSubtypes = new Map()

  for (const row of rows) {
    const applied = row[APPLIED_DATE_FIELD]
    const issuedAt = row[ISSUED_DATE_FIELD]
    if (applied == null || issuedAt == null) continue
    if (applied < sinceMs) continue
    inWindow++

    // The subtype gate. A row whose subtype is absent from the allowlist is
    // DROPPED and recorded, never bucketed — an unrecognised category must not
    // fall through into the aggregate.
    const sub = row[SUBTYPE_FIELD]
    if (!TIER_BY_SUBTYPE.has(sub)) {
      notABuilding++
      unknownSubtypes.set(sub, (unknownSubtypes.get(sub) ?? 0) + 1)
      continue
    }

    const d = (issuedAt - applied) / 86_400_000
    if (Number.isNaN(d)) continue
    if (Math.abs(d) < 0.5) sameDay++
    if (d < 0 || d > 120 * 30.44) continue

    days.push(d)
    const tier = TIER_BY_SUBTYPE.get(sub)
    if (tier == null) unresolvedTier++
    else byTier[tier].push(d)
  }

  console.log(`  ${inWindow} rows applied on/after ${SINCE}`)
  console.log(`  excluded ${notABuilding} non-building rows (pools, garages, sheds, decks, food trucks, site work…)`)
  console.log(`  ${unresolvedTier} townhome rows kept in the aggregate but omitted from the tier split (unit band unrecorded)`)

  // Anything dropped that is NOT one of the categories we classified is a NEW
  // Metro subtype. Surface it loudly — silence here is how the allowlist rots.
  const classified = new Set([
    'CAA14U017', 'CAA14U009', 'CAA14U011', 'CAA14U004', 'CAA14U015', 'CAA14U018',
    'CAJ03U013', 'CAF03Z000', 'CAL10Z000', 'CAL09Z000', 'CAL17Z001', 'CAFDTRK',
    'CAZ04A001', 'CAA04R301', 'CAC03A502', 'CAC03A503', 'CAL14A503', 'CAF02B003',
    'CAZ03A001', 'CAA08R301',
  ])
  const novel = [...unknownSubtypes].filter(([s]) => !classified.has(s))
  if (novel.length) {
    console.warn(
      `  ⚠ ${novel.length} subtype(s) not seen when this allowlist was built, EXCLUDED pending ` +
        `classification: ${novel.map(([s, n]) => `${s} (${n})`).join(', ')}`,
    )
  }

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs; leaving permitStats.json unchanged.')
    return
  }

  const sameDayPct = (sameDay / days.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — an over-the-counter ` +
        `recording artifact, not a real review time. Not writing nashville.`,
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
  // (a) ISSUED-ONLY FEED. The layer contains issued permits and nothing else, so
  //     an application that never issued is not merely censored — it is absent.
  //     The issuance rate is NOT COMPUTABLE from this source, and the median is a
  //     median over survivors. That is a floor. Correcting it needs a second
  //     source (Metro's application feed); it is NOT attempted here, because a
  //     censoring correction is a separate pass and layering one on top of a
  //     filter change would leave neither checkable.
  // (b) PER-UNIT CHILD PERMITS. 24.9% of the admitted rows cite a master permit
  //     in Purpose — Nashville issues one permit per townhome/house within a
  //     development. The unit is the row, so a 40-unit project contributes 40
  //     fast child permits and the median is re-weighted toward large repetitive
  //     subdivisions. The master permit number lives only in free text, so
  //     grouping by project is a parsing job with its own failure modes and is
  //     deliberately left to a later pass rather than guessed at now.
  const vintage =
    `applied ${SINCE} onward; computed ${stamp}; ${DATASET_NAME}. ` +
    `Feed is a ROLLING ~3-YEAR window of ISSUED permits (${windowStart}..${windowEnd}), so the ` +
    `2022-01-01 start used for other cities is not attainable without left-truncation bias and ` +
    `${SINCE} is the earliest filing cohort the window covers completely. Because only issued ` +
    `permits appear, the issuance rate is not computable and this median is a FLOOR. ` +
    `Nashville also issues per-unit child permits under a master permit (24.9% of rows cite one), ` +
    `which re-weights the median toward large repetitive developments.`

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

  // ── Expected output, measured against the live layer on 2026-08-06 ────────
  // A re-run should land near these. A LARGE move means the feed rolled or the
  // subtype domain changed — reconcile before believing the new number (rule 16:
  // a result that contradicts a known-good one is the instrument's problem first).
  //   aggregate  1.2 mo / p80 2.8 / n = 7,796
  //   single     1.1 / 2.4 / n = 5,431
  //   multi      2.2 / 4.5 / n =   452
  //   apartment  3.0 / 7.0 / n =   570
  //   (+1,343 townhome rows in the aggregate, no tier)

  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    nashville: { ...(existing.nashville ?? {}), newConstruction: stats, byTier: tiers, tierBreakdown },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote nashville.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nnashville.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
