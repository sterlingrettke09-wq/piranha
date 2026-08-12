// Las Vegas provider — City of Las Vegas GIS (mapdata.lasvegasnevada.gov/clvgis)
// + FEMA NFHL.
//
// Verified live 2026-08-09. Every endpoint below was point-queried at real Las
// Vegas locations before this file was written, and the load-bearing results
// were re-probed in isolation (CLAUDE.md rule 10).
//
// Modelled on atlanta.ts — one parcel layer carrying assessor attributes and
// owner, one separate parcel-level zoning layer, no second-hop join. Las Vegas
// is easier than Atlanta in one way and harder in three, and all four were
// MEASURED rather than inferred from field names:
//
// ─────────────────────────────────────────────────────────────────────────────
//  1. ⚠️ `LOTSQFT` IS NOT THE LOT. IT IS THE RESIDENTIAL BUILDING FLOOR AREA.
//     This is the Miami `FLR` trap, freshly caught, and it is the single most
//     damaging thing this build could have got wrong: reading it as lot area
//     would have understated every house's lot by roughly 2.3x AND returned a
//     lot of ZERO for essentially every commercial parcel in the city.
//
//     Three independent measurements, taken 2026-08-09 against the live layer:
//
//     (a) RATIO, not sum (rule 2). Over 100 consecutive City-of-Las-Vegas
//         single-family parcels, geometry area ÷ LOTSQFT has a median of 2.320
//         and a range of 1.272 to 4.806. NOT ONE of the 100 lands within 2% of
//         1.0. A unit conversion would be a constant; this is not one.
//     (b) A CONDITIONAL that only a building field satisfies. Of the 291,830
//         parcels with STRCITY='LV', 262,392 have LOTSQFT > 0 — and the count
//         with `LOTSQFT > 0 AND CONSTYR = 0` is **exactly zero**. Every parcel
//         with a positive LOTSQFT has a construction year. A lot-area field is
//         positive on vacant land; a building-floor-area field is zero when
//         nothing is built.
//     (c) LAND-USE CONFINEMENT. 262,381 of those 262,392 rows (99.996%) carry a
//         residential LUCODE (< 200). The field is the Assessor's residential
//         building square footage.
//
//     The values also read like building models rather than lots: within one
//     subdivision the same figures repeat (2,013 / 2,438 / 2,217 / 1,821) across
//     parcels whose polygons differ by thousands of square feet.
//
//     `LOTSQFT` is therefore read ONLY into `existing.buildingAreaSqFt`, and the
//     lot comes from geometry. A test pins both directions.
//
//  2. THE LOT AREA IS `SHAPE_Area`, AND IT IS ALREADY SQUARE FEET — measured
//     against the geometry, not inferred. The layer's native spatial reference
//     is wkid 102707 / latestWkid 3421 (NAD83 / Nevada East, US survey feet).
//     Shoelacing the returned rings in that SR reproduces `SHAPE_Area` exactly,
//     and an independent geodesic computation on the SAME polygons returned in
//     EPSG:4326 agrees to 0.02% (the residual is the flat-earth approximation in
//     the check, not error in the field):
//
//         parcel 12508120004   SHAPE_Area 13,998.01   geodesic 14,000.7
//         parcel 12505411052   SHAPE_Area  8,995.12   geodesic  8,996.8
//         parcel 12505411078   SHAPE_Area  8,996.90   geodesic  8,998.6
//
//     There is no usable fallback and none is faked: `ASSR_ACRES` is populated on
//     15,123 of 291,830 city parcels and `CALC_ACRES` on 60,056, so a missing
//     `SHAPE_Area` is a null lot, not an estimated one. `ACRES`, `SQ_MILES` and
//     `PERIMETER` on this layer are junk inherited from a source layer (`ACRES`
//     reads 8,235.23 on a suburban house lot) and are never read.
//
//  3. ⚠️ `ADDRESS1` IS THE OWNER'S MAILING ADDRESS, NOT THE SITE ADDRESS, and it
//     frequently contains a PERSON'S NAME. Measured: parcel 14029601001 has
//     ADDRESS1 '1580 S JONES BLVD' while the site is '1395 N NELLIS BLVD';
//     parcel 13920310025's ADDRESS1 is 'RODRIGUEZ PABLO CESAR'; others read
//     'C/O WESTLAND REAL ESTATE GROUP' or 'PO BOX 271273'. ADDRESS1–ADDRESS5 are
//     the mailing block (ADDR_OWN concatenates OWNER + ADDRESS1 + ADDRESS2).
//     Reading ADDRESS1 as the site address would publish an owner's home address
//     — and sometimes their name — under a stranger's parcel. It is never read.
//
//     The site address is composed from the atomic components
//     STRNO / STRFRAC / STRDIR / STRNAME / STRTYPE rather than from the `ADDRESS`
//     column, which is a fixed-width concatenation with a zero-padded house
//     number and column padding ('004617     PROVIDENCE            LN').
//
//  4. `CAPACITY` IS A DWELLING-UNIT COUNT ONLY ON RESIDENTIAL LAND USES. Grouped
//     by LUCODE over the 291,830 city parcels, its mean is 1.00 on LUCODE 110
//     (single family), 1.98 on 120, 3.99 on 140 and 32.02 on 150 (apartments,
//     max 754) — an exact match to what each residential class implies, which is
//     the measurement that establishes the semantics. On non-residential codes it
//     does not behave like units at all (335 offices mean 1.79, 240 industrial
//     mean 0.98, 370 mean 0.92), so it is read into `existing.units` ONLY where
//     LUCODE < 200. A '1' on an industrial parcel would flow into the
//     no-net-loss check as a dwelling that is not there.
//
// ─────────────────────────────────────────────────────────────────────────────
// JURISDICTION. This is the Raleigh mismatch, not the Atlanta match. The PARCEL
// layer is the Clark County fabric republished by the City and is COUNTY-WIDE —
// 834,987 rows, of which 291,830 carry STRCITY='LV'; the rest are Henderson,
// North Las Vegas, Paradise, Summerlin South, Mesquite and unincorporated Clark
// County. The ZONING layer is the City's own (207,834 polygons, 76,943 acres)
// and stops at the city limits. The bbox in src/types/parcel.ts is scoped to the
// ZONING layer's measured extent for the same reason.
//
// ⚠️ A ZONING GAP IS NOT ENOUGH, AND `STRCITY` IS NOT THE GATE. A North Las Vegas
// parcel with no zoning still returned a real address, a real lot area and a
// real assessed value — an answer-shaped result for land this tool does not
// cover, and a lot area is all the cost engine needs to print a dollar figure.
// So the Jurisdictions layer is fetched as a GATE and a point outside the City
// of Las Vegas polygon is REFUSED.
//
// `STRCITY = 'LV'` was the obvious alternative and it was rejected on a
// measurement, not a preference. Cross-tabbed against the zoning layer over 120
// random in-bbox points that returned a parcel (2026-08-09), it called an
// in-city parcel OUT once; a hand probe found a second the same day. Both run
// the same way, and both were re-queried in isolation to confirm:
//
//   36.14220, -115.29031  parcel 16308115000  STRCITY ' '  → ZONE R-PD12
//   36.19000, -115.32000  parcel 13724817000  STRCITY ' '  → ZONE P-C
//
// (the first from the random sample, the second hand-picked — said plainly,
// because a hand-picked case is weaker evidence of RATE and equal evidence of
// EXISTENCE, and existence is what decides this). The Jurisdictions layer places
// both inside "City of Las Vegas".
//
// `STRCITY` is the SITE ADDRESS's city and is blank on every unaddressed parcel
// (STRNO 0, STRNAME ' '), which is most vacant land — i.e. exactly the parcels a
// feasibility tool is asked about. Refusing those is an answer rendered as a gap
// (rule 5), and it fires hardest on the use case. The Jurisdictions polygon has
// no such hole: it placed both of the above inside "City of Las Vegas".
//
// The gate degrades OPEN on a fetch failure; see the call site.
//
// NO HISTORIC-DISTRICT LAYER EXISTS FOR THIS CITY, and that is a checked absence
// of DATA rather than of designations. LVMC 19.10.150 establishes an HD-O
// Historic Designation Overlay and a Historic Preservation Commission, but no
// layer on mapdata.lasvegasnevada.gov publishes it: all 19 service folders were
// enumerated 2026-08-09 and none carries a historic, overlay or preservation
// layer. Clark County's own GIS has a lookalike — OpenData/PlanningandZoning
// layer 6, "Historic Neighborhood Overlay District", 43 polygons — and it was
// TESTED rather than adopted: eight of its polygon centroids were point-queried
// against both City layers, and every one returned NO City of Las Vegas zoning
// polygon and a parcel whose STRCITY reads 'PAR' (Paradise, unincorporated
// Clark County). It is the County's overlay over County land. Using it would
// have attached another jurisdiction's historic districts to City parcels.
// `overlays.historicDistrict` is therefore null for every Las Vegas parcel, and
// that means "not published here", not "this parcel is not in one".
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import {
  LAS_VEGAS_UNREADABLE_CODES,
  parseLasVegasZone,
  resolveLasVegas,
  usesForZone,
} from '../zoning/lasvegas'

const CLV = 'https://mapdata.lasvegasnevada.gov/clvgis/rest/services'
// Layer ids read from the service's own directory 2026-08-09, not guessed
// (CLAUDE.md rule 8). Parcel_Info/MapServer layer 0 is "Parcels"; the sibling
// AdministrativeBoundaries/Parcels service carries the same fabric with a
// slightly different field order and is not used, so only one is a dependency.
const PARCELS = `${CLV}/AdministrativeBoundaries/Parcel_Info/MapServer/0`
// DevelopmentServices/Zoning/MapServer layer 0 is "Zoning". Layers 1 (DZ_ROIS),
// 2 (ROIS) and 3 (DZ_Zoning) are not read: ROIZONE is already a column on layer
// 0 and is populated on 49 of 207,834 polygons.
const ZONING = `${CLV}/DevelopmentServices/Zoning/MapServer/0`
// THE JURISDICTION GATE. Seven polygons, enumerated live 2026-08-09 with
// returnDistinctValues: "City of Las Vegas", "City of North Las Vegas", "City of
// Henderson", "City of Mesquite", "Boulder City", "Nellis AFB", and one named
// ' ' (unincorporated Clark County — the Strip and most of the valley). Because
// the layer holds OTHER jurisdictions too, presence is not the signal here the
// way it is in Dallas and Phoenix: the NAME must be compared.
const JURISDICTIONS = `${CLV}/AdministrativeBoundaries/Jurisdictions/MapServer/0`
const CITY_OF_LAS_VEGAS = 'City of Las Vegas'

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** The layer pads empty strings with a single space rather than nulling them —
 *  STRFRAC, STRDIR, STRCITY, OWNER, ORD, EXP_DATE, USE_1…USE_10, VAR_1…VAR_5 and
 *  ROIZONE all arrive as `' '` when unset. Collapse and trim, and treat
 *  whitespace-only as absent. */
const clean = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/**
 * Compose the SITE address from the parcel row's atomic street components.
 *
 * NEVER from `ADDRESS1`, which is the owner's MAILING address and often a
 * person's name (see header note 3), and not from `ADDRESS`, which is a
 * fixed-width string with a zero-padded house number.
 */
function siteAddress(p: Record<string, unknown>): string | null {
  const no = posInt(p.STRNO)
  const parts = [
    no != null ? String(no) : null,
    clean(p.STRFRAC),
    clean(p.STRDIR),
    clean(p.STRNAME),
    clean(p.STRTYPE),
  ].filter((s): s is string => !!s)
  // A road / right-of-way parcel has STRNO 0 and blank name columns. Do not
  // emit a lone street type ("LN") as if it were an address.
  if (no == null || parts.length < 2) return null
  return parts.join(' ')
}

/**
 * Build the `article` label: the district's name plus every statement without
 * which the published figures would read as something they are not.
 *
 * These are not decoration. `ParcelInfo['zoning']` has no field for most of
 * them, and each sentence below exists because dropping it turns a fact into a
 * different fact:
 *
 *   · The FAR absence is an ANSWER (zoning/lasvegas.ts FACT 1). `maxFAR: null`
 *     plus `farUnconstrained: true` is how the engine knows, but the user needs
 *     to be told WHAT governs instead — here, maximum lot coverage — or the
 *     absence reads as missing data.
 *   · A district whose height table prints "NA" (FACT 4) is neither an answer
 *     nor a gap. Without this sentence, `maxHeightFt: null` renders as "no
 *     district height limit is available in public data", which is false: the
 *     limit rows are published, they just do not carry a number.
 *   · A Form-Based Code zone states STORIES and no feet (FACT 3). Saying so is
 *     what stops a reader assuming we failed to find a height in feet.
 *   · A plan-governed district (FACT 5) is incomplete, not unconstrained.
 *   · Entitlement case numbers on the parcel's own zoning row mean the base
 *     figures may not be this site's.
 */
function buildArticle(code: string | null): string | null {
  const parts = parseLasVegasZone(code)
  // No zoning polygon at this point at all. There is no code to describe, and
  // any sentence here would be a statement about a district the parcel has not
  // been shown to be in — the parcel layer is county-wide and the zoning layer
  // is not, so this is the Henderson / Paradise case as much as the road case.
  if (!parts.normalized) return null
  const limits = resolveLasVegas(code)
  const bits: string[] = []

  if (limits.name) bits.push(limits.name)

  if (parts.undevelopedCategory) {
    bits.push(
      `Mapped as U(${parts.undevelopedCategory}). LVMC §19.00.100(B)(1) establishes exactly one Undeveloped district, "U", with district purpose §19.06.050; the parenthetical is the General Plan category the holding zone anticipates, not a separate zoning district, so the U standards below are what applies today.`,
    )
  }

  if (limits.planGoverned) {
    bits.push(
      `Plan-governed district: the height, bulk and density standards for this parcel are not in the zoning code at all — they are fixed in a plan, manual or site-plan approval that is not published as data. ${limits.planSource} The figures here are therefore INCOMPLETE, not absent: this is a gap in what can be read, not a statement that nothing binds.`,
    )
  }

  if (limits.heightTableNA) {
    bits.push(
      `This district's own height table prints "NA" in every row (${limits.heightSource}). That is what the code shows — it is not a gap in our data — but Title 19 nowhere defines what "NA" means here, so no maximum is published either way and none is assumed.`,
    )
  }

  if (limits.maxStories != null && limits.maxHeightFt == null) {
    bits.push(
      `The Form-Based Code regulates this zone in STORIES and states no maximum height in feet (${limits.heightSource}). No height in feet is published here, and none is derived: the only feet in that table are floor-to-floor minima, and multiplying a story count by one would invent a conversion the code does not make.`,
    )
  } else if (limits.maxStories != null && limits.maxHeightFt != null) {
    bits.push(`Maximum height: ${limits.maxStories} stories and ${limits.maxHeightFt} ft (${limits.heightSource}).`)
  }

  if (limits.farUnconstrained) {
    const cov = limits.maxLotCoverage
      ? `Bulk here is governed by maximum lot coverage (${limits.maxLotCoverage}, ${limits.lotCoverageSource}), setbacks and height instead.`
      : 'Bulk here is governed by lot coverage, setbacks and height instead.'
    bits.push(
      `Title 19 imposes NO floor-area ratio in any zoning district — that is what the code says, not a gap in our data. §19.08.040(A) lists exactly which dimensional standards the district tables govern ("the minimum lot size, minimum lot width, minimum building setbacks, maximum lot coverage, minimum building separation and maximum building height") and floor-area ratio is not among them; no district table in 19.06, 19.08 or 19.09 has a FAR row; and the phrase "floor area ratio" occurs in the whole of Title 19 only in §19.18's definitions and measurement rules. ${cov}`,
    )
  }

  if (limits.densityNote) bits.push(limits.densityNote)

  for (const alt of limits.heightAlternatives ?? []) {
    const fig = [
      alt.stories != null ? `${alt.stories} stories` : null,
      alt.heightFt != null ? `${alt.heightFt} ft` : null,
    ]
      .filter(Boolean)
      .join(' / ')
    const how = alt.discretionary
      ? 'Available only by discretionary approval, not by right'
      : 'A separate limb of the code, not a range around the figure above'
    bits.push(`${alt.label}: ${fig}. ${how} — ${alt.source}.`)
  }

  // The unresolved branch, and it has to distinguish THREE things that all
  // arrive as "no limits" (rule 5, one notch finer than usual):
  //   · no zoning polygon at all — handled by the early return above; there is
  //     no code to say anything about, and inventing a sentence here would tell
  //     a Henderson user something about a Las Vegas ordinance.
  //   · a code we have READ ABOUT and know Title 19 does not establish — say
  //     what governs instead, in the code's own words.
  //   · a code nobody has looked at — say only that, and assert nothing.
  if (!limits.name) {
    const known = LAS_VEGAS_UNREADABLE_CODES[parts.normalized]
    if (known) {
      bits.push(
        `Zoning code "${parts.normalized}" is not a district Title 19 establishes, so nothing is published about it here. ${known} §19.00.100(C): "Property which, on the effective date of this Title, was classified under a zoning classification which no longer exists under this Title will be reclassified by the City to an existing classification by subsequent Rezoning action. Until that action occurs, such property shall be governed by the requirements and limitations applicable to the zoning classification in effect just before the adoption of this Title."`,
      )
    } else {
      bits.push(
        `Zoning code "${parts.normalized}" was not resolved against Title 19 by this build. No height, coverage or floor-area statement is made about it — that is a gap in what has been read, not a finding that nothing binds.`,
      )
    }
  }

  if (limits.source) bits.push(`Source: Las Vegas Municipal Code Title 19 — ${limits.source}`)

  return bits.length > 0 ? bits.join(' · ') : null
}

/** Entitlement case numbers carried on the parcel's own zoning row. The layer
 *  holds up to ten Special Use Permits (USE_1…USE_10), five Variances
 *  (VAR_1…VAR_5), a rezoning ordinance number (ORD) and an expiry (EXP_DATE);
 *  only the first of each is fetched, because the point of the string is to tell
 *  the reader that site-specific conditions EXIST, not to enumerate them. */
function entitlementNote(z: Record<string, unknown> | null): string | null {
  if (!z) return null
  const ord = clean(z.ORD)
  const sup = clean(z.USE_1)
  const vari = clean(z.VAR_1)
  const roi = clean(z.ROIZONE)
  const bits: string[] = []
  if (ord) bits.push(`rezoning ordinance ${ord}`)
  if (sup) bits.push(`Special Use Permit ${sup}`)
  if (vari) bits.push(`Variance ${vari}`)
  // ROIZONE is populated on 49 of 207,834 polygons and the layer publishes no
  // expansion of the acronym; it is surfaced under the field's own name rather
  // than glossed, because a plausible expansion would be an invented fact.
  if (roi) bits.push(`a second zoning value in its ROIZONE column (${roi})`)
  if (bits.length === 0) return null
  return `The City's zoning record for this parcel carries ${bits.join(', ')}. Case-specific conditions can limit height, density or use BELOW the base district and are held in the case file rather than in this dataset, so the district figures above are a ceiling this site may not have.`
}

export async function getLasVegasParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts. maxAttempts 2, not 3:
  // fetchParcelSnap already retries its exact query internally, so three outer
  // attempts would be up to six queries.
  const [parcelR, zoningR, optional] = await Promise.all([
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, [
      'PARCEL',
      'STRNO',
      'STRFRAC',
      'STRDIR',
      'STRNAME',
      'STRTYPE',
      'STRCITY',
      'OWNER',
      'SHAPE_Area',
      'LOTSQFT',
      'CONSTYR',
      'LUCODE',
      'CAPACITY',
      'LANDVAL1',
      'IMPVAL',
      'ASSDYR',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, [
      'ZONE',
      'DESCRIPTION',
      'PARCEL',
      'ORD',
      'EXP_DATE',
      'MULTI_ZONE',
      'ROIZONE',
      'USE_1',
      'VAR_1',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      // Exact point, never a snap: a buffered retry on a boundary layer reaches
      // 30 m across the line and hands the neighbouring city's land a Las Vegas
      // answer — the defect phoenix.ts records against its own zoning fetch.
      fetchFeatures(JURISDICTIONS, lat, lng, ['NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [jurisR, floodR] = optional


  // ── Jurisdiction gate ────────────────────────────────────────────────────
  // Run BEFORE the parcel is read, so nothing about an out-of-city parcel can
  // reach the response.
  //
  // It degrades OPEN on a fetch failure, matching columbus.ts and dallas.ts:
  // refusing a real Las Vegas address because an optional layer timed out is a
  // worse failure than the one this prevents, and an out-of-city point still
  // surfaces as a zoning gap without it. Note that "fulfilled with zero
  // features" is a real answer and closes the gate, while a rejection does not —
  // a failed fetch must never become a substantive answer in either direction.
  if (jurisR.status === 'fulfilled') {
    const names = (jurisR.value.features ?? []).map((f) => String(f.attributes?.NAME ?? '').trim())
    if (!names.includes(CITY_OF_LAS_VEGAS)) {
      console.log({ event: 'parcel.outside_city', city: 'lasvegas', durationMs: Date.now() - t0 })
      return {
        ok: false,
        code: 'OUT_OF_BBOX',
        message:
          'That point is in the Las Vegas valley but outside the City of Las Vegas — North Las Vegas, Henderson and unincorporated Clark County (including the Strip) write their own zoning, and City of Las Vegas zoning is the only zoning this tool has here.',
        status: 400,
      }
    }
  }


  // THE STATE SPLIT, and it sits AFTER the gate on purpose. The jurisdictions
  // layer answers independently of the zoning layer, so when it says the point is
  // outside the city that is a complete answer and the more useful one — no
  // reason to trade it for "we couldn't reach the service" just because zoning
  // also timed out. Past this line, "the service did not answer" refuses and
  // "the service answered and found nothing" becomes the `Unknown` the
  // no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('lasvegas', 'Las Vegas', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PARCEL', 'SHAPE_Area', 'STRNO', 'LOTSQFT', 'CAPACITY'], 'lasvegas')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['ZONE'], 'lasvegas')
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // ── Zoning ───────────────────────────────────────────────────────────────
  // ZONE is the district code. UDC_ZONE looks like a newer, better field and is
  // a DECOY: measured 2026-08-09 with returnDistinctValues, it is `' '` on
  // 207,828 of 207,834 polygons and carries a value on FIVE. It is not read.
  // DESCRIPTION is the layer's plain-English label and pairs 1:1 with ZONE.
  const code = clean(zoning?.ZONE)
  const limits = resolveLasVegas(code)

  // ── Lot area ─────────────────────────────────────────────────────────────
  // SHAPE_Area, in EPSG:3421 US survey feet — i.e. already square feet, measured
  // against the geometry (see header note 2). NOT LOTSQFT (header note 1).
  const shapeArea = Number(parcel.SHAPE_Area)
  const lotSqFt = Number.isFinite(shapeArea) && shapeArea > 0 ? Math.round(shapeArea) : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // historicDistrict is deliberately and permanently null for Las Vegas — see
  // the header. It is a data gap, not a finding about the parcel.
  const historicDistrict = null

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNER is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned. On this layer it is very often
  // a private individual's name.
  const ownerPublic = isGovernmentOwner(clean(parcel.OWNER))
  const lucode = posInt(parcel.LUCODE)
  const isResidentialUse = lucode != null && lucode < 200

  // Nevada assesses at 35% of taxable value (NRS 361.225), and these columns are
  // the ASSESSED figures rather than the taxable ones — established
  // arithmetically rather than from memory of Nevada law. Over 800 sampled
  // City-of-Las-Vegas rows, LANDVAL1 ÷ 0.35 is a whole multiple of $100 on 766
  // (95.8%), while the same test on IMPVAL passes on 20 of 756 (2.6%, the base
  // rate you would expect by chance on a depreciated figure). Land is carried
  // at a round taxable value and published here at 35% of it.
  //
  // The 35% is NOT divided out. Doing so would publish a derived number, and
  // `assessedValueBasis` says what the figure is instead so nobody reads it as
  // market value. No claim is made about which way it lags the market — none has
  // been measured, and a disclaimer naming the wrong direction is worse than
  // none (CLAUDE.md rule 7).
  const land = posInt(parcel.LANDVAL1)
  const improvements = posInt(parcel.IMPVAL)
  const assessedTotal = land != null || improvements != null ? (land ?? 0) + (improvements ?? 0) : null
  const taxYear = posInt(parcel.ASSDYR)

  const existingBase = {
    yearBuilt: posInt(parcel.CONSTYR),
    // LOTSQFT — the Assessor's residential BUILDING floor area. See header
    // note 1 for the three measurements that establish this, and note that it
    // is 0 (→ null) on essentially every non-residential parcel.
    buildingAreaSqFt: posInt(parcel.LOTSQFT),
    // CAPACITY behaves as a dwelling-unit count only on residential land uses
    // (header note 4). Elsewhere it is left null rather than published as 1.
    units: isResidentialUse ? posInt(parcel.CAPACITY) : null,
    assessedValue: assessedTotal,
    assessedValueBasis: `Clark County Assessor land + improvement value${taxYear != null ? `, assessment year ${taxYear}` : ''} — the Nevada 35%-OF-TAXABLE ASSESSED value (NRS 361.225), not taxable value and not market value. Measured, not assumed: LANDVAL1 ÷ 0.35 is a whole multiple of $100 on 766 of 800 sampled City parcels.`,
  }
  const hasAnyExisting = Object.entries(existingBase).some(
    ([k, v]) => k !== 'assessedValueBasis' && v != null,
  )
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasAnyExisting
      ? existingBase
      : undefined

  const sources: Record<string, string> = {
    parcels: PARCELS,
    zoning: ZONING,
    jurisdictions: JURISDICTIONS,
    flood: ENDPOINTS.flood,
    // The publisher the City's own Zoning Code page links for Title 19.
    zoningCode: 'https://online.encodeplus.com/regs/lasvegas-nv/doc-viewer.aspx',
  }

  const article = [buildArticle(code), entitlementNote(zoning)].filter(Boolean).join(' · ') || null

  const info: ParcelInfo = {
    address: siteAddress(parcel) ?? 'Selected location',
    parcelId: clean(parcel.PARCEL) ?? '',
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      // The layer's own plain-English district label. Null on NO_ZONE polygons,
      // where it arrives as `' '`.
      subdistrict: clean(zoning?.DESCRIPTION),
      article,
      // Feet where Title 19 prints feet, null where it does not — including
      // every Form-Based Code transect zone, where the code prints stories only
      // (zoning/lasvegas.ts FACT 3). NEVER derived from a story count.
      maxHeightFt: limits.maxHeightFt,
      // Stories where Title 19 prints stories. NEVER derived from feet. Both are
      // published together where the code states both, which is most of 19.06
      // and 19.08 — the two figures come from the same table row and neither is
      // computed from the other.
      ...(limits.maxStories != null ? { maxStories: limits.maxStories } : {}),
      // Title 19 has no floor-area ratio instrument pointed at any district, so
      // there is never a number here. The KNOWN absence rides in
      // `farUnconstrained` and is set ONLY for districts actually read out of
      // 19.06, 19.08 and 19.09 — never for a plan-governed district and never
      // for an unrecognised code, so a gap can never render as "FAR does not
      // bind here" and can never fall back to an assumed FAR of 1.0.
      maxFAR: null,
      allowedUses: usesForZone(code),
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict,
      floodZone: clean(flood?.FLD_ZONE),
    },
    existing,
    assessedValue: assessedTotal,
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'lasvegas', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
