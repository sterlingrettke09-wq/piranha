#!/usr/bin/env node
// WO-7.1 — Dallas permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/dallas.mjs
//
// ── STATUS: COMPUTES, THEN REFUSES — exits 1, by design ─────────────────────
// Dallas is the first city where BOTH the task's qualifying questions answer
// yes — a feed carrying an application date AND an issue date exists, and the
// new-construction filter is a closed vocabulary — and the figure still cannot
// ship, for two independent reasons measured 2026-08-10:
//
//   1. IDENTIFICATION. 8,509 of 11,587 gated in-window filings carry an issue
//      date at extract — 73.44%. Under the quantile-existence rule (a p-th
//      quantile is identified only when the observed share strictly exceeds p;
//      see seattle.mjs for the derivation), that identifies the p50 and does
//      NOT identify the p80 this repo publishes beside it. No matured cohort
//      rescues it: the 2022 cohort, with ~34 months of follow-up inside the
//      snapshot, sits at 80.30% gated (79.8% at the workclass level) — which
//      clears the pooled p80 by 0.30 points but leaves multi (74.58%) and
//      apartment (71.69%) unidentified inside it, and a single fully-lapsed
//      year of a retired system is a different product — and the apartment
//      tier over the standard window is at 47.76%, below even the median.
//      refuseUnlessQuantilesAreObserved() throws before any write.
//
//   2. THE FEED IS A TERMINAL SNAPSHOT, NOT A LIVE DATASET. The layer's own
//      description: "pulled from the Posse system on November, 2024 …
//      no updates planned." Max CREATED_DATE and ISSUE_DATE are both
//      2024-11-12 and will not advance: Dallas moved active permit tracking to
//      Accela Citizen Access, which is a lookup portal, not open data, and the
//      Socrata dataset (e7gq-4sah) is flagged "historical and no longer
//      updated" — rows frozen 2020-08-30, and it never carried an application
//      date at all (issued_date only, as TEXT). So even if the share cleared,
//      the vintage could only ever describe filings through late 2024, and the
//      quarterly-refresh contract every published city carries is impossible
//      here. This script probes the max date on every run and reports if the
//      snapshot ever comes back to life.
//
// ── Dataset ────────────────────────────────────────────────────────────────
// "New Permits 1971-2024", City of Dallas GIS Services (ArcGIS org
// rwnOSbfKSwyTBcwN), item a1b64b21a2ec4397a88347d51ce97393 — found by
// enumerating the org's feature services and the Socrata catalogue, not by
// guessing URLs. 1,798,425 rows on 2026-08-10; CREATED_DATE null on 0 of them,
// ISSUE_DATE null on 153,915 (8.6%) — the feed carries NON-ISSUED
// applications, so the denominator is real. Both date fields are true
// esriFieldTypeDate. maxRecordCount 2000 — paginate.
//
// CREATED_DATE is the Posse application-record creation date, not a GIS/ETL
// stamp (the DC trap, checked rather than assumed): the in-window cohort's
// values spread over 754 distinct days with a maximum of 88 rows on any one
// day, and ISSUE_DATE >= CREATED_DATE on all but 7 of 152k+ all-time
// new-construction pairs. An ETL stamp would cluster on load dates; this
// does not.
const LAYER =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/' +
  'NewPermit_2008_2024/FeatureServer/0'

const APPLIED_DATE_FIELD = 'CREATED_DATE'
const ISSUED_DATE_FIELD = 'ISSUE_DATE'
const TYPE_FIELD = 'PERMIT_TYPE'
const ACTIVITY_FIELD = 'ACTIVITY'
const USE_FIELD = 'LAND_USE'
const UNITS_FIELD = 'UNITS'
const COMMERCIAL_FLAG_FIELD = 'COMMERCIAL'

// The snapshot's recorded end. The freshness probe compares the live max
// CREATED_DATE against this on every run; if it ever advances, the "terminal
// snapshot" limb of the refusal has LAPSED and the header must be re-argued.
const SNAPSHOT_MAX_CREATED = '2024-11-12'

// Applications filed on/after this date — the repo-standard window.
const SINCE = '2022-01-01'

// ── The new-construction filter is a CLOSED vocabulary, measured 2026-08-10 ─
// PERMIT_TYPE over the window has 27 values; 'Building (BU)' is the building
// trade (the rest are Plumbing/Electrical/Mechanical/Fence/Sign/…-class trade
// permits). ACTIVITY within Building (BU) has exactly 7 values:
//   (A) New Construction 11,777   (B) Renovation 16,179   (B) Alteration 12,580
//   (G) Addition 4,553   (B) Finish Out 287   (B) Reconstruction 209   null 136
// One value names ground-up new construction and it is the one used — no
// free-text parsing, no 'workclassmapped'-style trap visible (Raleigh's
// failure mode was an aggregated mapping column; Dallas's ACTIVITY is the
// primary column itself).
const PERMIT_TYPE_VALUE = 'Building (BU)'
const ACTIVITY_VALUE = '(A) New Construction'

// ── LAND_USE building gate — ALLOWLIST, same criterion as raleigh.mjs ──────
// ACTIVITY says the work is NEW; it does not say the thing is a BUILDING. 192
// of 11,777 in-window rows are not one: parks and golf courses (30), the
// merged 'COMMERCIAL PARKING LOT OR GARAGE' class (24 — a lot and a garage
// BUILDING share one value, unsplittable without free text, so excluded the
// way Raleigh excluded its ADU-mixed class), 'VACANT FLOOR SPACE' (46),
// undeveloped land, cell towers, substations, surface parking, a cemetery.
// LAND_USE is populated at FILING, unlike Raleigh's proposeduse: null on only
// 7 of 3,185 non-issued rows (0.2%) and 1 of 8,592 issued (0.0%), so gating
// the cohort on it does not select on the outcome.
//
// Admission criterion, stated once (Raleigh/Nashville wording, deliberately):
// a permit is admitted iff it authorises a ROOFED STRUCTURE INTENDED FOR HUMAN
// OCCUPANCY OR THE STORAGE OF GOODS.
const BUILDING_USES = new Set([
  'SINGLE FAMILY DWELLING', 'TWO FAMILY DWELLING', 'MULTI-FAMILY DWELLING',
  'MIXED INCOME MULTI-FAMILY', 'SHELL BUILDING', 'PUBLIC OR PRIVATE SCHOOL',
  'OFFICE BUILDING', 'HOTEL', 'CONVALESCENT & NURSING HOMES & RELATED INSTITUTI',
  'RETIREMENT HOUSING', 'RESTAURANT WITH DRIVE-IN SERVICE',
  'RESTAURANT WITHOUT DRIVE-IN SERVICE', 'OFFICE SHOWROOM/WAREHOUSE', 'HOSPITAL',
  'GEN MERCHANDISE OR FOOD STORE > 3500 SQ. FT.',
  'GEN MERCHANDISE OR FOOD STORE < 3500 SQ. FT.',
  'GEN MERCHANDISE OR FOOD STORE>=100000 SQ FT',
  'GEN MERCHANDISE (NO FOOD) STORE < 3500 SQ. FT', 'WAREHOUSE', 'COMMERCIAL',
  'AUTO SERVICE CENTER', 'CAR WASH', 'CHURCH, SYNAGOGUE, TEMPLE, MOSQUE',
  'OVERNIGHT GENERAL PURPOSE SHELTER',
  'MACHINERY, HEAVY EQUIP. OR TRUCK SALES & SERVICE',
  'VEHICLE OR ENGINE REPAIR OR MAINTENANCE', 'VEHICLE DISPLAY,SALES AND SERVICE',
  'COLLEGE, UNIVERSITY, OR SEMINARY', 'FINANCIAL INSTITUTION WITH DRIVE-IN WINDOW',
  'PRIVATE RECREATION CENTER, CLUB OR AREA', 'INDUSTRIAL (INSIDE)',
  'COMMUNITY SERVICE CENTER', 'DRY CLEANING OR LAUNDRY STORE', 'FIRE STATION',
  'PERSONAL SERVICE USE', 'MEDICAL CLINIC OR AMBULATORY SURGICAL CENTER',
  'CHILD CARE FACILITY', 'HOME IMPROVEMENT CENTER/ BLDG MATERIALS SALES YA',
  'COMMERCIAL AMUSEMENT (INSIDE)', 'COLLEGE DORMITORY', 'GROCERIES-RETAIL',
  'MACHINE OR WELDING SHOP', 'Motor Vehicle Fueling Station',
  // Surfaced by the allowlist's own novel-value warning on the 2026-08-10 run
  // (one row each) and classified against the stated criterion: a
  // mini-warehouse and a light-manufacturing building are roofed structures
  // for the storage of goods / occupancy. 'TEMP SALES OFFICE - REAL ESTATE'
  // went to KNOWN_NON_BUILDING instead — a temporary structure, the class
  // Raleigh excluded as Temporary Trailer.
  'MINI-WAREHOUSE', 'INDUSTRIAL (INSIDE) FOR LIGHT MANUFACTURING',
])

// Non-building classes seen when the allowlist was built (window counts in the
// header). A dropped value NOT on this list is a NEW Dallas category — surfaced
// loudly, because silence is how an allowlist rots.
const KNOWN_NON_BUILDING = new Set([
  'VACANT FLOOR SPACE', 'PUBLIC PARK, PLAYGROUND, OR GOLF COURSE',
  'COMMERCIAL PARKING LOT OR GARAGE', 'UNDEVELOPED LAND AREA',
  'AIRPORT OR LANDING FIELD', '', 'LOCAL UTILITIES',
  'COMMERCIAL MOTOR VEHICLE PARKING', 'UTILITY OR GOVERNMENTAL INSTALLATION (OTHER)',
  'TOWER/ANTENNA FOR CELLULAR COMMUNICATION', 'ELECTRICAL SUBSTATION',
  'VEHICLE STORAGE LOT', 'OUTSIDE STORAGE', 'OTHER TRNSP,CONMUN & UTILITIES',
  'DEPARTMENT STORES-RETAIL', 'BUSINESS SCHOOL', 'WATER TREATMENT PLANT',
  'MANUFACTURED BUILDING SALES LOT', 'CROP PRODUCTION', 'FLOOD CONTROL PUMP STATION',
  'Alternative Financial Institutions', 'FREIGHT TERMINAL',
  'MORTUARY, FUNERAL HOME, OR COMM. WEDDING CHAPEL', 'SURFACE PARKING',
  'PETROLEUM PRODUCT STORAGE AND WHOLESALE', 'LODGING OR BOARDING HOUSE',
  'INDUSTRIAL (OUTSIDE)', 'ACCESSORY BUILDING TO SINGLE FAMILY DWELLING',
  'AUTO AUCTION', 'CEMETERY OR MAUSOLEUM', 'TEMP SALES OFFICE - REAL ESTATE',
])

// ── RESULTS (measured 2026-08-10, the run that wrote this file) ─────────────
// Cohort: CREATED_DATE >= 2022-01-01, Building (BU), (A) New Construction,
// LAND_USE allowlist. 11,587 filings, 8,509 with an issue date = 73.44%.
//   per tier (COMMERCIAL flag + UNITS; flags populated on 11,769/11,777 rows,
//   so per-tier shares are POINT-VALUED here, unlike Seattle's bounds):
//     single     5,366/5,769 = 93.01%   (obs median 0.6 mo, p80 2.5)
//     multi        365/  516 = 70.74%   (obs median 1.9 mo, p80 6.1)
//     apartment  1,639/3,432 = 47.76%   (obs median 7.0 mo, p80 12.2)
//     untiered   1,139/1,870 = 60.91%   (UNITS null or 0, non-commercial)
//   per filing year (gated): 2022 80.30%, 2023 74.79%, 2024 61.36%
//   same-day: 8.20% pooled — but rising 3.03% (2022) → 10.60% (2023) → 14.98%
//   (2024), worth re-reading against the Posse→Accela migration before any
//   future publish; Chicago's refusal was exactly a same-day cohort gradient.
// The observed medians above are CONDITIONAL on issuance and are recorded for
// reconciliation only (rule 16) — they are not publishable figures.
//
// WHAT WOULD IT TAKE TO PUBLISH? Either a live feed with both dates from the
// Accela era (none exists on any Dallas portal as of 2026-08-10), or a product
// decision to publish a differently-shaped figure (a single-family-only pair —
// that tier's 93.01% identifies both quantiles — or a median-only city figure
// at 73.45%). Both are the Milwaukee situation: the condition would need a UI
// surface that renders it, and deciding that is a person's call, not a
// pipeline's.

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'City of Dallas GIS Services "New Permits 1971-2024" ArcGIS layer 0, a terminal ' +
  'Posse-system snapshot pulled 2024-11 (PERMIT_TYPE Building (BU), ACTIVITY (A) New ' +
  'Construction, gated to building LAND_USE only)'

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'

const norm = (s) => String(s ?? '').trim()

async function arcgis(params) {
  const url = new URL(`${LAYER}/query`)
  const body = new URLSearchParams({ f: 'json', ...params })
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    })
  } catch (err) {
    throw new Error(
      `Network error reaching services2.arcgis.com: ${err.message}. ` +
        `permitStats.json left UNCHANGED.`,
    )
  }
  if (!res.ok) throw new Error(`ArcGIS returned HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  // ArcGIS answers errors with HTTP 200 and an {error} body — a failed fetch
  // must never silently become a substantive answer (rule 5).
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
const pctStr = (a, b) => (b ? `${((a / b) * 100).toFixed(2)}%` : '—')

// FILING-TIME predicates only. The pull must not carry any limb that selects on
// the outcome it measures — see scripts/permits/outcome-selection.ts, which
// scans every script in this directory.
const WHERE =
  `${APPLIED_DATE_FIELD} >= DATE '${SINCE}' AND ` +
  `${TYPE_FIELD} = '${PERMIT_TYPE_VALUE}' AND ${ACTIVITY_FIELD} = '${ACTIVITY_VALUE}'`

async function pullAll() {
  const outFields = [
    'OBJECTID', APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, USE_FIELD, UNITS_FIELD,
    COMMERCIAL_FLAG_FIELD,
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

// Which tier a permit belongs to. Mirrors buildingTier() in
// netlify/functions/lib/timeline.ts: single = 1 unit, multi = 2-4, apartment =
// 5+ AND all commercial/institutional. Dallas states UNITS directly and flags
// COMMERCIAL rows; a non-commercial row with UNITS null or 0 is a GAP, not an
// answer — kept in the aggregate, assigned to no tier (Raleigh's townhouse
// treatment).
function tierOf(row) {
  if (norm(row[COMMERCIAL_FLAG_FIELD]) === 'Y') return 'apartment'
  const u = row[UNITS_FIELD]
  if (u == null || u === 0) return null
  if (u === 1) return 'single'
  if (u <= 4) return 'multi'
  return 'apartment'
}

// ── THE STRUCTURAL HALT (rule 14) ───────────────────────────────────────────
// Same rule and same shape as seattle.mjs/nyc.mjs/sf.mjs: order the cohort by
// time-to-issuance and every filing with no issue date sorts above every
// observed one, so the p-th quantile is identified only when the observed share
// STRICTLY exceeds p. No safety margin is added and none may be (rule 4) —
// this is an existence condition, not a quality one. The condition is
// recomputed from the live layer on every run; there is no flag past it.
const PUBLISHED_QUANTILES = [
  { q: 0.5, name: 'medianMonths' },
  { q: 0.8, name: 'p80Months' },
]

class ComputabilityHalt extends Error {}

function refuseUnlessQuantilesAreObserved(observedN, cohortN, arms, byYearLines) {
  if (cohortN === 0) {
    throw new ComputabilityHalt('The cohort is empty, so no share can be computed. Refusing to write.')
  }
  const share = observedN / cohortN
  const failing = PUBLISHED_QUANTILES.filter(({ q }) => !(share > q))
  if (failing.length === 0) return share
  const armLines = arms
    .map((a) => `    · ${a.name}: ${a.observed} of ${a.cohort} observed (${pctStr(a.observed, a.cohort)})`)
    .join('\n')
  throw new ComputabilityHalt(
    `${observedN} of ${cohortN} gated filings carry an issue date at extract — ${pctStr(observedN, cohortN)}.\n` +
      failing
        .map(
          ({ q, name }) =>
            `    · ${name} (p${q * 100}) is NOT IDENTIFIED: it needs more than ${(q * 100).toFixed(0)}% of the\n` +
            `      cohort observed. Filings with no issue date sort above every observed\n` +
            `      duration, so the p${q * 100} lands inside the unobserved mass — past the last\n` +
            `      observation. There is no number there to publish.`,
        )
        .join('\n') +
      `\n\n  PER TIER (point-valued here — the COMMERCIAL/UNITS fields are populated on\n` +
      `  non-issued rows, unlike Seattle's bounds):\n${armLines}\n` +
      `  By filing year: ${byYearLines}. A window narrowed to the matured 2022\n` +
      `  cohort would clear the pooled p80 by 0.30 points (80.30%) — and inside that\n` +
      `  same year multi is 74.58% and apartment 71.69%, so its byTier p80s stay\n` +
      `  unidentified, and a figure computed from one fully-lapsed year of a retired\n` +
      `  permitting system is a different product, not this one. Over the standard\n` +
      `  window the apartment tier does not even clear the MEDIAN.\n\n` +
      `  AND THE FEED CANNOT MATURE FURTHER: this layer is a terminal snapshot of the\n` +
      `  retired Posse system ("no updates planned", max dates ${SNAPSHOT_MAX_CREATED}).\n` +
      `  Dallas's live permitting (Accela Citizen Access) publishes no open-data feed,\n` +
      `  and the Socrata dataset is frozen at 2020-08-30 with no application date.\n\n` +
      `  The single-family tier's 93.01% identifies both quantiles, and the pooled\n` +
      `  share identifies the median alone — publishing either differently-shaped\n` +
      `  figure is a PRODUCT DECISION for a person (the Milwaukee reason: the\n` +
      `  condition needs a UI surface that renders it). Do not narrow the filter or\n` +
      `  the window to get past this gate.\n\n` +
      `  permitStats.json left UNCHANGED.`,
  )
}

async function main() {
  console.log('Dallas permit pipeline — "New Permits 1971-2024" (terminal Posse snapshot)')

  // 1. Schema probe: every field this script reads must exist, or we refuse to
  //    fabricate a latency figure (the Boston lesson).
  const meta = await arcgis({ where: '1=1', resultRecordCount: '1', outFields: '*' })
  const fieldIds = new Set((meta.fields ?? []).map((f) => f.name))
  for (const f of [
    APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, TYPE_FIELD, ACTIVITY_FIELD, USE_FIELD,
    UNITS_FIELD, COMMERCIAL_FLAG_FIELD,
  ]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the layer schema; the service may have changed. ` +
          `Found: ${[...fieldIds].join(', ')}. permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Freshness probe. The refusal's second limb rests on the snapshot being
  //    terminal; measure that on every run rather than assert it once.
  const maxStat = await arcgis({
    where: '1=1',
    outStatistics: JSON.stringify([
      { statisticType: 'max', onStatisticField: APPLIED_DATE_FIELD, outStatisticFieldName: 'maxCreated' },
    ]),
  })
  const maxCreated = maxStat.features?.[0]?.attributes?.maxCreated
  const maxCreatedDay = maxCreated ? new Date(maxCreated).toISOString().slice(0, 10) : null
  if (maxCreatedDay && maxCreatedDay > SNAPSHOT_MAX_CREATED) {
    console.warn(
      `  ⚠ The layer's max ${APPLIED_DATE_FIELD} is now ${maxCreatedDay}, past the recorded ` +
        `snapshot end ${SNAPSHOT_MAX_CREATED}. The "terminal snapshot" limb of this script's ` +
        `refusal has LAPSED — re-read the header before trusting anything below.`,
    )
  } else {
    console.log(`  snapshot end confirmed: max ${APPLIED_DATE_FIELD} = ${maxCreatedDay}`)
  }

  const rows = await pullAll()
  console.log(`  pulled ${rows.length} rows: ${WHERE}`)

  // 3. The LAND_USE building gate — a FILING-TIME gate here (populated on 99.8%
  //    of non-issued rows), so applying it before the share does not select on
  //    the outcome. Anything dropped that is not a known non-building class is
  //    surfaced loudly.
  const cohort = []
  const unknownUses = new Map()
  let notABuilding = 0
  for (const row of rows) {
    const use = norm(row[USE_FIELD])
    if (!BUILDING_USES.has(use)) {
      notABuilding++
      unknownUses.set(use, (unknownUses.get(use) ?? 0) + 1)
      continue
    }
    if (row[APPLIED_DATE_FIELD] == null) continue
    cohort.push(row)
  }
  console.log(`  excluded ${notABuilding} non-building rows (parks, parking, towers, vacant…)`)
  const novel = [...unknownUses].filter(([u]) => !KNOWN_NON_BUILDING.has(u))
  if (novel.length) {
    console.warn(
      `  ⚠ ${novel.length} LAND_USE value(s) not seen when this allowlist was built, ` +
        `EXCLUDED pending classification: ${novel.map(([u, n]) => `${u} (${n})`).join(', ')}`,
    )
  }

  // 4. The issuance share, per tier and pooled, printed before it is judged so
  //    the refusal is inspectable.
  const issued = cohort.filter((r) => r[ISSUED_DATE_FIELD] != null)
  const armNames = ['single', 'multi', 'apartment', 'untiered']
  const arms = armNames.map((name) => {
    const inArm = (r) => (tierOf(r) ?? 'untiered') === name
    return { name, cohort: cohort.filter(inArm).length, observed: issued.filter(inArm).length }
  })
  console.log(
    `  cohort ${cohort.length} filings, ${issued.length} with an issue date ` +
      `(${pctStr(issued.length, cohort.length)})`,
  )
  for (const a of arms) console.log(`     ${a.name}: ${a.observed}/${a.cohort} (${pctStr(a.observed, a.cohort)})`)

  const byYear = {}
  for (const r of cohort) {
    const y = new Date(r[APPLIED_DATE_FIELD]).getUTCFullYear()
    byYear[y] ??= { n: 0, obs: 0 }
    byYear[y].n += 1
    if (r[ISSUED_DATE_FIELD] != null) byYear[y].obs += 1
  }
  const byYearLines = Object.keys(byYear)
    .sort()
    .map((y) => `${y} ${pctStr(byYear[y].obs, byYear[y].n)}`)
    .join(', ')
  console.log(`     by filing year: ${byYearLines}`)

  refuseUnlessQuantilesAreObserved(issued.length, cohort.length, arms, byYearLines)

  // ── Nothing below here has ever run. ────────────────────────────────────────
  // It is written to be correct on the day the gate clears — which, for this
  // terminal snapshot, requires the feed itself to change (see the freshness
  // probe). Treat its first run as new code and re-read the header first:
  // clearing the POOLED gate identifies the pooled quantiles only. Each byTier
  // entry needs its own share to clear each published quantile — the per-tier
  // shares printed above are point-valued, so check them directly — and the
  // same-day gradient (3% → 15% across 2022-24) needs re-reading against the
  // Posse→Accela migration before the distribution is trusted.

  // 5. Durations over the issued subset.
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let untiered = 0
  let negative = 0
  for (const row of issued) {
    const a = row[APPLIED_DATE_FIELD]
    const i = row[ISSUED_DATE_FIELD]
    const d = (i - a) / 86_400_000
    if (Number.isNaN(d)) continue
    if (d < 0) {
      negative++
      continue
    }
    if (d > 120 * 30.44) continue
    days.push(d)
    const tier = tierOf(row)
    if (tier === null) untiered++
    else byTier[tier].push(d)
  }
  if (negative) console.log(`  dropped ${negative} row(s) issued before they were applied for`)
  console.log(`  ${untiered} rows carry no usable unit count — in the aggregate, in no tier`)

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs; leaving permitStats.json unchanged.')
    return
  }

  // 6. Distribution gate (Chicago's backfill signature).
  const zeroDay = days.filter((d) => d < 0.5).length
  console.log(`  distribution: ${zeroDay} same-day (${pctStr(zeroDay, days.length)})`)
  if (zeroDay / days.length > 0.5) {
    console.warn('  >50% same-day — a recording artifact, not review time. Not writing dallas.')
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(`  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing.`)
    return
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const observedPct = ((issued.length / cohort.length) * 100).toFixed(1)
  const vintage =
    `applied ${SINCE} onward; computed ${stamp}; ${DATASET_NAME}. ` +
    `${issued.length}/${cohort.length} (${observedPct}%) of the in-window cohort carries an ` +
    `issue date at extract; the feed is a terminal snapshot ending ${SNAPSHOT_MAX_CREATED}.`

  const { tiers, tierBreakdown } = splitTiersAtFloor(byTier, (tierRows) => ({
    medianMonths: daysToMonths(quantile(tierRows, 0.5)),
    p80Months: daysToMonths(quantile(tierRows, 0.8)),
    n: tierRows.length,
    vintage,
  }))
  console.log('  by tier:', Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo p80 ${v.p80Months} n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    dallas: { ...(existing.dallas ?? {}), newConstruction: stats, byTier: tiers, tierBreakdown },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')
  console.log('  Wrote dallas.newConstruction:', stats)
}

main().catch((err) => {
  if (err instanceof ComputabilityHalt || err?.constructor?.name === 'ComputabilityHalt') {
    console.error(`\ndallas.mjs REFUSES TO WRITE (by design):\n\n  ${err.message}\n`)
  } else {
    console.error(`\ndallas.mjs failed: ${err.message}\n`)
  }
  process.exitCode = 1
})
