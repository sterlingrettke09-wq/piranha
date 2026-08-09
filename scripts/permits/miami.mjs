#!/usr/bin/env node
// WO-7.1 — Miami permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/miami.mjs
//
// Miami publishes "Building Permits Since 2014" as an ArcGIS FeatureServer layer
// on the City of Miami's ArcGIS Online org (surfaced through
// datahub-miamigis.opendata.arcgis.com), NOT Socrata — so this script speaks the
// ArcGIS REST query protocol like denver.mjs / dc.mjs rather than Socrata's
// $where. The feed carries a genuine pre-review stamp (PlanCreatedDate) alongside
// issuance (IssuedDate), so a real filing -> issuance latency can be computed.
//
// It computes the median + 80th-percentile PlanCreatedDate -> IssuedDate time in
// months, overall AND per building tier, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under miami. Idempotent: safe to
// run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the app
// reads; this script only refreshes it (re-run quarterly).
//
// ── UNTIL 2026-08-06 THIS SCRIPT DID NOT EXIST ──────────────────────────────
// miami.newConstruction (12.1 / 20.9 / n=1085) was committed from a hand-run
// query with no generator in the repo. The NYC lesson applies with the sign
// flipped: there a generator disagreed with its own output; here there was
// nothing to disagree. Both leave a figure that cannot be re-derived. This file
// reproduces the committed query exactly (verified: n=1085, median 12.1, p80
// 20.9 on 2026-08-06) and then corrects the one defect the audit found in it.
//
// ── Dataset endpoint ────────────────────────────────────────────────────────
// Re-find via the Hub item if the service ever rotates:
//   https://www.arcgis.com/sharing/rest/content/items/1d6fc60b087c4bcaa22345f429a2ec5a?f=json
const LAYER_URL =
  'https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Building_Permits_Since_2014/FeatureServer/0'

// PlanCreatedDate is the earliest stamp on the record and precedes plan
// acceptance by a median 14.3 days (p90 61.1) — it is a filing-side date, not a
// re-stamped issuance date (the San Diego trap) and not an "review began" date
// (the Chicago trap). 0 of 991 retained rows are same-day.
const APPLIED_DATE_FIELD = 'PlanCreatedDate'
const ISSUED_DATE_FIELD = 'IssuedDate'
const SCOPE_FIELD = 'ScopeofWork'
const WORK_ITEMS_FIELD = 'WorkItems'
const PERMIT_NUMBER_FIELD = 'PermitNumber'
const PROPERTY_TYPE_FIELD = 'PropertyType'

const SINCE = '2022-01-01'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'datahub-miamigis.opendata.arcgis.com "Building Permits Since 2014" ArcGIS FeatureServer ' +
  "(ScopeofWork = 'NEW CONSTRUCTION', master building permit PermitNumber LIKE '%001B001', " +
  'WorkItems building allowlist); PlanCreatedDate -> IssuedDate'

// ── The WorkItems gate — ADDED 2026-08-06 ───────────────────────────────────
// `ScopeofWork = 'NEW CONSTRUCTION'` says the work is new. It says NOTHING about
// whether the thing is a BUILDING — that is carried by `WorkItems`. An audit
// found 8.7% of the old admitted set was not a building: 40 trellises/pergolas,
// 11 "NEW PARK ONLY", 11 pre-fabricated guardhouses / construction trailers /
// temporary sales centres, gazebos, carports, cabanas, sheds, a lone pool.
//
// Measured, so the SIGN is derived rather than assumed: the 94 excluded rows run
// a median 5.9 months (p80 11.6) against 12.6 (p80 21.4) for the 991 real
// buildings. The contamination is FAST, so it was dragging the published figure
// DOWN — 12.1 published against a corrected 12.6.
//
// ALLOWLIST, not a denylist. `WorkItems` is a pipe-delimited multi-value field
// ("SINGLE FAMILY RESIDENCE|WINDOWS / DOORS / SKYLIGHT"), so the rule is: a row
// is admitted iff AT LEAST ONE of its work items names an occupiable building.
// A work item we have never seen contributes nothing — it can never admit a row
// on its own — so a new Miami category cannot quietly re-contaminate this.
//
// The excluded neighbours are all accessory or non-habitable: TRELLIS/PERGOLA,
// GAZEBO, CABANA, CARPORT, SHED, OPEN STRUCTURES, NEW PARK ONLY, INFRASTRUCTURE
// AND UTILITIES, SURFACE PARKING LOT, CONSTRUCTION TRAILERS, TEMPORARY SALES
// CENTER, PRE-FABRICATED STRUCTURE/GUARDHOUSE, plus the component work items
// (fences, gates, driveways, pavers, pool decks, terraces, windows, waterproofing,
// trusses, railings, elevator shafts, excavation/piles) that appear ALONGSIDE a
// building on real building permits and alone on non-building ones.
const BUILDING_WORK_ITEMS = new Set([
  // Residential
  'SINGLE FAMILY RESIDENCE',
  'SINGLE FAMILY ANCILLARY DWELLING UNIT',
  'TWO-FAMILY RESIDENCE',
  'MULTI-FAMILY (RENTAL)',
  'MULTI-FAMILY (CONDO)',
  'WORK - LIVE (W-51% L-49%)',
  // Lodging
  '26 OR MORE LODGING UNITS',
  'APARTMENT HOTEL',
  'CONDO HOTEL',
  // Commercial / institutional
  'ANIMAL HOSPITAL/KENNEL/POUND',
  'BAR / TAVERN (50 OR MORE OCCUPANTS)',
  'BARBER / BEAUTY SHOP / MANICURE-PEDICURE / WAXING/SPA/MASSAGE/TATTO SHOP',
  'CAR/ TRUCK WASH',
  'CHILD DAYCARE / NURSERY SCHOOL',
  'CHURCH / RELIGIOUS FACILTY',
  'COMMERCIAL STORAGE & WAREHOUSING',
  'COMMUNITY FACILITY',
  'GAS STATION',
  'GENERAL COMMERCIAL',
  'GENERAL OFFICE',
  'GENERAL RETAIL',
  'JUICE BAR / COFFEE SHOP/BAKERY/DELI/ICE CREAM SHOP/CIGAR BAR',
  'MANUFACTURING AND PROCESSING',
  'MEDICAL OR DENTAL OFFICE',
  'MIDDLE / HIGH SCHOOL',
  'MINI STORAGE & WAREHOUSING',
  'PARKING GARAGE-MULTIPLE FLOORS',
  'PRE-SCHOOL',
  'PROFESSIONAL OFFICE / BANK / FINANCIAL INSTITUTION',
  'RECREATIONAL ESTABLISHMENT',
  'RECREATIONAL FACILITY',
  'RESEARCH FACILITY',
  'RESTAURANT (50 OR MORE OCCUPANTS)',
  'RETAIL OF GOODS:SUPERMARKET/CLOTHING/FURNITURE/BOOK STORE/ART PRODUCTS',
  'STADIUM',
])

// ── Which tier each building work item belongs to ───────────────────────────
// Mirrors buildingTier() in netlify/functions/lib/timeline.ts: single = 1 unit,
// multi = 2-4, apartment = 5+ AND all commercial/institutional.
//
// WHY THIS EXISTS: one median over Miami's new-construction population answers
// no question anyone asked. 52% of it is single-family houses at 11.3 months and
// 19% is apartment-tier at 20.2 — a 1.8x spread inside one 12.6-month headline.
//
// THE ONE ASSUMPTION, STATED: Miami's WorkItems vocabulary has no unit count.
// 'MULTI-FAMILY (RENTAL)' / '(CONDO)' means "beyond two-family" — it does not
// distinguish a triplex (tier multi) from a tower (tier apartment). Mapping it to
// apartment is supported by measurement, not assumed: those 124 rows run a median
// 42,849 sf with p10 = 7,825 sf, and only 8 of 124 are under 6,000 sf. A residual
// ~6% may be 3-4 unit buildings sitting in the apartment tier.
//
// Cross-check on that mapping, from a field this gate does not read: the tier
// split derived from WorkItems partitions Miami's own PropertyType EXACTLY —
// all 802 single+multi rows are 'Residential' and all 189 apartment rows are
// 'Commercial'. Miami itself files these buildings as commercial-scale. The run
// re-checks that agreement and warns if it ever breaks.
const TIER_BY_WORK_ITEM = {
  'SINGLE FAMILY RESIDENCE': 'single',
  // An ADU adds a second dwelling to the lot, so it is tier multi (2-4) — the
  // same call austin.mjs makes for Census class 102 "Secondary Apartment (ADU)".
  'SINGLE FAMILY ANCILLARY DWELLING UNIT': 'multi',
  'TWO-FAMILY RESIDENCE': 'multi',
  // Everything else on the allowlist is apartment tier.
}

// ── What this filter EXCLUDES, and why each exclusion is not too narrow ─────
// Rule: measure the n AND the median of every set the filter drops. A count
// gives the size of a correction; only the timing gives its sign.
//
// 1. TotalSQFT > 0 — REMOVED from the query (it was in the committed one).
//    It dropped 1,627 of the 2,712 master permits, at a median 3.8 months. But
//    ZERO of those 1,627 carry a building work item — they are pools (605),
//    fences (300+), driveways, awnings, seawalls, boat lifts. Two independent
//    criteria selecting the identical set is the reason to trust the allowlist,
//    and it makes the sqft gate redundant: with it or without it the retained
//    set is the same 991 rows. Dropping it removes a failure mode the allowlist
//    does not have — a real building recorded with TotalSQFT = 0 would have been
//    silently discarded.
//
// 2. ScopeofWork = 'NEW CONSTRUCTION' excludes:
//    · PHASED PERMIT — 391 masters, median 1.2 months. NOT a missed new-building
//      class: 0 of 391 carry a building work item (they are PHASED PERMIT-
//      ELECTRICAL / -PLUMBING / SHORING AND RE-SHORING / FOUNDATION ONLY), and 0
//      share an ApplicationNumber with a NEW CONSTRUCTION master. This is the NYC
//      foundation/earthwork contamination seen from the outside; admitting it
//      would double-count projects AND, at 1.2 months, drag the median down.
//    · ADDITION AND REMODELING — 1,014 masters, median 7.7. 673 carry a building
//      work item (median 10.0), but there the work item names the HOST building
//      being added to, not a new one; every sqft-bearing row of the 721 carries
//      AdditionSQFT/RemSQFT. Scope is the discriminator and Miami states it.
//      Sub-case checked because Seattle's DADUs are filed this way: 8 rows name
//      SINGLE FAMILY ANCILLARY DWELLING UNIT under this scope, median 17.3
//      months, and ALL 8 carry RemSQFT > 0 (existing space reconfigured, not
//      ground-up). Admitting all 8 anyway leaves the figure at 12.6 / 21.4
//      unchanged. Excluded, disclosed.
//    · COOKIE CUTTER and SHOP DRAWINGS - OTHER — 0 master permits each.
//
// 3. PermitNumber LIKE '%001B001' — process 001, trade B, sequence 001 — is the
//    master BUILDING permit. It drops 24,878 NEW CONSTRUCTION rows at a median
//    1.9 months: 15,228 non-B trade sub-permits (electrical, plumbing, mechanical,
//    public works, landscape) and 9,650 B-trade rows on a later process. Not too
//    narrow, established positively rather than by not finding anything: 0 of the
//    9,650 carry a building work item, and the 4,766 whose application has no
//    001B001 master belong to applications numbered BD12- through BD21- WITHOUT
//    EXCEPTION — later sub-permits on pre-2022 projects, not 2022+ buildings we
//    missed. It also deduplicates: the gate yields exactly one row per
//    ApplicationNumber (2,712 rows, 2,712 applications), so this city does not
//    have SF's or Austin's multi-permit re-weighting problem.
//
// ── Right-censoring: a LIMITATION, not corrected here ───────────────────────
// This feed is issued-permits-only — 39 of 228,653 rows have a null IssuedDate,
// and the NEW CONSTRUCTION master cohort has zero. Applications that never issue
// are ABSENT from the dataset rather than present-and-pending, so the issuance
// rate cannot be computed from this source at all and the median is a median of
// what issued. Every censoring mechanism biases such a figure LOW. Correcting it
// is a separate pass (Kaplan-Meier needs the pending arm this feed does not
// publish); applying one on top of a contaminated population would have produced
// a precise wrong number, which is why the filter went first.

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'

async function arcgis(params) {
  const url = new URL(`${LAYER_URL}/query`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching services1.arcgis.com: ${err.message}. ` +
      `Check connectivity; the service may also be temporarily offline.`)
  }
  if (!res.ok) throw new Error(`services1.arcgis.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  // ArcGIS returns HTTP 200 with an {error:{...}} body on failure — surface it.
  if (body.error) throw new Error(`ArcGIS query error: ${JSON.stringify(body.error)}`)
  return body
}

async function layerFields() {
  const url = new URL(LAYER_URL)
  url.searchParams.set('f', 'json')
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`services1.arcgis.com metadata returned HTTP ${res.status} ${res.statusText}`)
  const meta = await res.json()
  if (meta.error) throw new Error(`ArcGIS metadata error: ${JSON.stringify(meta.error)}`)
  return (meta.fields ?? []).map((f) => f.name)
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

/** WorkItems arrives HTML-escaped ("STORAGE &amp; WAREHOUSING") and
 *  pipe-delimited, with stray trailing spaces on some codes. */
function workItems(raw) {
  return String(raw ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The tier of a permit: the LARGEST tier among its building work items, since a
 *  permit naming both a house and a retail bay is the bigger project. */
function tierOf(items) {
  const building = items.filter((t) => BUILDING_WORK_ITEMS.has(t))
  if (building.some((t) => TIER_BY_WORK_ITEM[t] === undefined)) return 'apartment'
  if (building.some((t) => TIER_BY_WORK_ITEM[t] === 'multi')) return 'multi'
  return 'single'
}

// Master new-construction building permits filed since `since` that have issued.
async function pull(since) {
  const where =
    `${SCOPE_FIELD} = 'NEW CONSTRUCTION' ` +
    `AND ${PERMIT_NUMBER_FIELD} LIKE '%001B001' ` +
    `AND ${APPLIED_DATE_FIELD} >= DATE '${since}' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = []
  let offset = 0
  const page = 2000
  for (;;) {
    const body = await arcgis({
      where,
      outFields: [
        APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, WORK_ITEMS_FIELD,
        PERMIT_NUMBER_FIELD, PROPERTY_TYPE_FIELD,
      ].join(','),
      resultOffset: String(offset),
      resultRecordCount: String(page),
      orderByFields: 'ObjectId',
      returnGeometry: 'false',
    })
    const feats = body.features ?? []
    for (const f of feats) rows.push(f.attributes)
    if (feats.length < page) break
    offset += page
  }
  return rows
}

async function main() {
  console.log('Miami permit pipeline — Building Permits Since 2014 (ArcGIS)')

  // 1. Probe the schema and confirm the fields we need exist. If one is missing
  //    we refuse to fabricate a latency figure and leave the artifact untouched
  //    (the Boston lesson).
  const fieldSet = new Set(await layerFields())
  for (const f of [
    APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, SCOPE_FIELD,
    WORK_ITEMS_FIELD, PERMIT_NUMBER_FIELD, PROPERTY_TYPE_FIELD,
  ]) {
    if (!fieldSet.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the layer schema; the service may have ` +
          `changed. Found: ${[...fieldSet].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the master new-construction permits.
  const rows = await pull(SINCE)
  console.log(`  ${rows.length} master new-construction permits filed since ${SINCE}`)

  // 3. Apply the building gate, then compute durations. Negatives and absurd
  //    outliers (> 120 months) are dropped; same-day rows are counted because a
  //    feed that stamps both legs at issuance produces a meaningless latency.
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  const propertyTypeByTier = { single: new Set(), multi: new Set(), apartment: new Set() }
  const droppedItems = new Map()
  let sameDay = 0
  let notABuilding = 0
  for (const r of rows) {
    const items = workItems(r[WORK_ITEMS_FIELD])
    // The gate. A row naming no known building work item is DROPPED, not
    // bucketed — an unrecognised category must never fall through into the
    // aggregate. Track what was dropped so a new Miami category is visible in
    // the run log rather than silently discarded.
    if (!items.some((t) => BUILDING_WORK_ITEMS.has(t))) {
      notABuilding++
      const key = items.join('|') || '(blank)'
      droppedItems.set(key, (droppedItems.get(key) ?? 0) + 1)
      continue
    }
    // ArcGIS date fields come back as epoch millis.
    const a = r[APPLIED_DATE_FIELD]
    const i = r[ISSUED_DATE_FIELD]
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) {
      const tier = tierOf(items)
      days.push(d)
      byTier[tier].push(d)
      if (r[PROPERTY_TYPE_FIELD]) propertyTypeByTier[tier].add(r[PROPERTY_TYPE_FIELD])
    }
  }

  // Expect ~1,721 of 2,712: the 1,627 zero-sqft pools/fences/driveways the old
  // TotalSQFT gate also caught, plus the 94 sqft-bearing trellises, pergolas,
  // parks, gazebos, carports, guardhouses and sales trailers it did not.
  console.log(`  excluded ${notABuilding} rows naming no building work item ` +
    `(pools, fences, driveways, trellises/pergolas, parks, guardhouses, sales trailers…)`)
  const topDropped = [...droppedItems.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  for (const [k, v] of topDropped) console.log(`    ${String(v).padStart(4)} × ${k}`)

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  // 3b. The independent cross-check on the tier mapping (see TIER_BY_WORK_ITEM).
  //     Miami's own PropertyType should partition the tiers: single/multi
  //     Residential, apartment Commercial. A break means the WorkItems
  //     vocabulary shifted under us and the MULTI-FAMILY → apartment call needs
  //     re-deriving. Warn loudly; do not silently publish through it.
  const expectedPropertyType = { single: 'Residential', multi: 'Residential', apartment: 'Commercial' }
  for (const [tier, seen] of Object.entries(propertyTypeByTier)) {
    const unexpected = [...seen].filter((p) => p !== expectedPropertyType[tier])
    if (unexpected.length > 0) {
      console.warn(
        `  ⚠ tier ${tier} now contains PropertyType ${unexpected.join(', ')} ` +
          `(expected ${expectedPropertyType[tier]}). The WorkItems → tier mapping no ` +
          `longer agrees with Miami's own classification — re-derive it before trusting the split.`,
      )
    }
  }

  const sameDayPct = (sameDay / days.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (filed == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing miami.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 4. Sanity gate. A median under half a month or a tiny n is not trustworthy.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); ` +
        `not writing. Investigate the dataset before trusting this.`,
    )
    return
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const vintage = `filed ${SINCE} onward; computed ${stamp}; ${DATASET_NAME}`

  // 5. Per-tier figures. The aggregate is kept for compatibility but is the
  //    WEAKER number — it pools an 11.3-month house with a 20.2-month apartment
  //    building, so a consumer that knows the project's tier should always prefer
  //    byTier (see measuredFor()).
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

  // 6. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    miami: { ...(existing.miami ?? {}), newConstruction: stats, byTier: tiers, tierBreakdown },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`  ${sameDayPct.toFixed(1)}% same-day. Wrote miami.newConstruction:`, stats)
}

main().catch((err) => {
  console.error(`\nmiami.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
