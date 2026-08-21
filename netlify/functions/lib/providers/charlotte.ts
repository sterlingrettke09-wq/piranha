// Charlotte provider — City of Charlotte ArcGIS (gis.charlottenc.gov) + FEMA NFHL.
//
// Verified live 2026-08-08. Every endpoint below was point-queried at real
// Charlotte addresses before this file was written, and the load-bearing
// results were re-probed three times in isolation (CLAUDE.md rule 10) and came
// back identical.
//
// Modelled on nashville.ts — one consolidated county parcel layer carrying
// assessor attributes AND owner, one separate zoning layer, optional overlays —
// with one substantial addition Nashville does not need. Three differences,
// each of which removes a class of error:
//
//   1. THE PARCEL LAYER IS ONE ROW PER CAMA CARD, NOT ONE ROW PER PARCEL, and
//      `features[0]` is wrong on any condominium, campus or multi-building
//      site. Measured 2026-08-08: 1 row at 1918 Dilworth Rd, 3 at 601 S Tryon
//      St, 52 at UNC Charlotte. Within a parcel, the VALUE fields repeat per
//      tax account (`taxpid`) and the BUILDING fields vary per card, so the two
//      have to be aggregated differently — see `aggregateCards` below. Taking
//      the first row at 601 S Tryon returns $9,500,500 or $279,675,400
//      depending on which row the server happens to order first: a 29x swing
//      that a single call always looks fine for.
//   2. LOT AREA ARRIVES IN ACRES (`totalac`) and is multiplied by 43,560.
//      That is not assumed from the field name — the layer also computes
//      `SHAPE.STArea()` in its own spatial reference (EPSG:2264, NC State
//      Plane, US survey feet, read from the service metadata), and over 2,000
//      Charlotte parcels the ratio SHAPE.STArea() / (totalac x 43,560) has a
//      MEDIAN OF EXACTLY 1.000000, a 1st percentile of 0.99982 and a maximum
//      deviation of 0.28%. Two independent computations of the same area agree,
//      which is what makes `totalac` a measured square-footage rather than a
//      plausible one (CLAUDE.md rule 9).
//      ⚠️ There is a near-identical field on a DIFFERENT host that is a trap:
//      meckgis `TaxParcel_camadata.totalac` is aliased "Total acres" and is not
//      acres — it carries raw CAMA land units whose meaning changes row by row
//      per `txt_landunittype` (SQUARE FEET / LOT / ACRES). This provider does
//      not touch that host.
//   3. HEIGHT AND FAR ARE NOT IN THE GIS AT ALL. The zoning layer's entire
//      schema is ZonePetition / ZoneDes / SPA / Overlay / RezoneDate /
//      ZoneClass / Hyperlink — no height, no FAR, no density, no coverage
//      field on either host. Both come from the curated UDO table in
//      `../zoning/charlotte`, and the UDO has no floor-area-ratio instrument at
//      all (that module's FACT 1).
//
// Jurisdiction note, and it is the useful kind: the parcel layer is Mecklenburg
// County property republished by the City, so it also returns Huntersville,
// Cornelius, Matthews and Pineville parcels (`municipality` distinguishes
// them). The zoning layer does NOT — probed at Huntersville (35.4107,-80.8428)
// and Matthews (35.1174,-80.7095) it returns zero features while the parcel
// layer returns a real parcel with municipality HUNTERSVILLE / MATTHEWS. A
// click outside Charlotte therefore surfaces as districtCode 'Unknown' with
// null limits — the correct render of a gap — and that behaviour is pinned by
// a test so it cannot quietly become a substantive answer.
//
// ⚠️ THAT IS THE **EMPTY-ANSWER** CASE ONLY. A zoning fetch that FAILS is a
// different state and refuses with UPSTREAM_ERROR; the two used to produce the
// identical 'Unknown'. See ../requiredUpstream.ts.
//
// UDO CURRENCY, checked rather than assumed. The task flagged the risk that the
// GIS might still be publishing the superseded 1992 ordinance. It is not, and
// the strong evidence is negative: UDO Table 3-1 translates every pre-UDO
// CONVENTIONAL district (B-1 -> CG, MUDD -> CAC-2, R-5 -> N1-C, INST -> IC-1,
// UMUD -> UC ...), and across all 218 distinct `ZoneDes` values on the live
// layer (5,680 polygons, measured 2026-08-08) not one bare 'B-1', 'B-2',
// 'MUDD', 'UMUD', 'INST', 'O-1' or 'I-1' survives — only their conditional and
// optional variants, which UDO Sec. 1.4.C expressly leaves under the prior
// ordinance. The translation visibly ran. Spot-checks agree: 1918 Dilworth Rd
// (was R-5) reads N1-C(HDO) with RezoneDate 2023-06-01, the UDO's effective
// date; UNC Charlotte (was INST) reads IC-1, same date.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import {
  resolveCharlotte,
  parseCharlotteZone,
  usesForZone,
  coverageFractionFor,
  CHARLOTTE_DISTRICT_NAMES,
  CHARLOTTE_OVERLAY_NAMES,
  type CharlotteLimits,
} from '../zoning/charlotte'
import { recordAddress } from '../address'

// "Parcel XAPO" — parcel geometry with the county CAMA/assessor record joined.
// Layer index read from the service's own layer list, not guessed.
const PARCELS = 'https://gis.charlottenc.gov/arcgis/rest/services/Accela/Accela/MapServer/16'
// The City's own zoning layer. Mirrored byte-for-byte as Accela/Accela/
// MapServer/10; this is the canonical publication.
const ZONING = 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0'
// Local historic districts. All 8 mapped districts carry DistrictType 'Local'
// (measured 2026-08-08) — these are the UDO Sec. 14.2 HDO districts, where a
// Certificate of Appropriateness is required, not National Register listings.
const HISTORIC = 'https://gis.charlottenc.gov/arcgis/rest/services/Accela/Accela/MapServer/12'

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// The parcel layer is Mecklenburg County's; the zoning layer is the CITY's.
// Measured at the real entry point 2026-08-12: Matthews, Mint Hill and Pineville
// addresses inside CHARLOTTE_BBOX all returned ok:true with real lot areas and
// `districtCode: 'Unknown'` — a $25.3M costed report for a Matthews NC parcel.
//
// ⚠️ The gate is the county's Sphere of Influence layer, NOT its Jurisdictions
// layer: Charlotte zones inside its ETJ. See ../jurisdiction.ts. It is also the
// only gate on a host this provider does not otherwise read.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const CHARLOTTE_GATE = cityLimitsGate('charlotte')!


const SQ_FT_PER_ACRE = 43560

const PARCEL_FIELDS = [
  'pid',
  'taxpid',
  'totalac',
  'houseno',
  'houseunit',
  'stdir',
  'stname',
  'sttype',
  'stsuffix',
  'municipality',
  'landvalue',
  'totalvalue',
  'netbldgvalue',
  'yearbuilt',
  'heatedarea',
  'units',
  'descpropertyuse',
  'ownerlastname',
  'ownerfirstname',
] as const

const ZONING_FIELDS = ['ZoneDes', 'ZoneClass', 'Overlay', 'SPA', 'RezoneDate', 'ZonePetition', 'Hyperlink'] as const

const str =(v: unknown): string => (v == null ? '' : String(v).trim())

type Attrs = Record<string, unknown>

/**
 * Reduce a point query on the parcel layer to the rows belonging to ONE parcel.
 *
 * A buffered snap can straddle two parcels, and `fetchParcelSnap` already picks
 * the nearest polygon in that case; an exact hit returns every CAMA card on the
 * parcel under the click. Filtering on the first row's `pid` handles both
 * without special-casing which path we came down.
 */
function cardsForPrimaryParcel(features: Array<{ attributes: Attrs }>): Attrs[] {
  const rows = features.map((f) => f.attributes)
  if (rows.length === 0) return []
  const pid = str(rows[0].pid)
  if (!pid) return [rows[0]]
  return rows.filter((r) => str(r.pid) === pid)
}

interface Aggregated {
  /** Sum of `totalvalue` over DISTINCT tax accounts. */
  totalValue: number | null
  /** Sum of `netbldgvalue` over DISTINCT tax accounts. */
  improvementValue: number | null
  /** Sum of `heatedarea` over every card. */
  heatedAreaSqFt: number | null
  /** Sum of `units` over every card. */
  units: number | null
  /** Earliest `yearbuilt` on the parcel. */
  earliestYearBuilt: number | null
  /** Cards carrying a building. */
  buildingCount: number | null
  /** How many distinct tax accounts the figures were summed over. */
  accountCount: number
}

/**
 * Aggregate the CAMA cards on one parcel.
 *
 * The two field families have DIFFERENT grains and summing them the same way is
 * wrong in opposite directions. Measured at 601 S Tryon St on 2026-08-08: one
 * `pid` (12512C97), two `taxpid` values, three rows. `totalvalue` reads
 * 279,675,400 on BOTH rows of taxpid 12512108 and 9,500,500 on taxpid 12512109
 * — the value belongs to the tax account and is repeated per card, so summing
 * every row would double-count the $279.7M account. `heatedarea` reads 28,182 /
 * 500,133 / 766,567 — one figure per card, so summing every row is exactly
 * right. Hence: value fields deduplicated on `taxpid`, building fields summed
 * across cards.
 *
 * `yearbuilt` takes the EARLIEST card rather than the first row's. On a
 * multi-building parcel the oldest structure is what bears on demolition and
 * historic review, and "the first row the server returned" is not a fact about
 * the parcel at all.
 */
export function aggregateCards(cards: Attrs[]): Aggregated {
  const seenAccounts = new Set<string>()
  let totalValue = 0
  let improvementValue = 0
  let sawValue = false
  let heated = 0
  let sawHeated = false
  let units = 0
  let sawUnits = false
  let earliest: number | null = null
  let buildings = 0

  for (const c of cards) {
    // Fall back to `pid` when `taxpid` is absent so a missing account key
    // cannot silently collapse two real accounts into one.
    const account = str(c.taxpid) || str(c.pid) || String(seenAccounts.size)
    if (!seenAccounts.has(account)) {
      seenAccounts.add(account)
      const tv = Number(c.totalvalue)
      const nv = Number(c.netbldgvalue)
      if (Number.isFinite(tv) && tv > 0) {
        totalValue += tv
        sawValue = true
      }
      if (Number.isFinite(nv) && nv > 0) improvementValue += nv
    }
    const ha = Number(c.heatedarea)
    if (Number.isFinite(ha) && ha > 0) {
      heated += ha
      sawHeated = true
      buildings += 1
    }
    const u = Number(c.units)
    if (Number.isFinite(u) && u > 0) {
      units += u
      sawUnits = true
    }
    const yb = Number(c.yearbuilt)
    if (Number.isFinite(yb) && yb > 1000 && (earliest == null || yb < earliest)) earliest = yb
  }

  return {
    totalValue: sawValue ? Math.round(totalValue) : null,
    improvementValue: improvementValue > 0 ? Math.round(improvementValue) : null,
    heatedAreaSqFt: sawHeated ? Math.round(heated) : null,
    units: sawUnits ? Math.round(units) : null,
    earliestYearBuilt: earliest,
    buildingCount: buildings > 0 ? buildings : null,
    accountCount: seenAccounts.size,
  }
}

/** Assemble the street address from the layer's component fields. `stsuffix`
 *  is a directional WORD ("WEST"), not a repeat of `stdir` — 1918 Dilworth Rd
 *  West is a distinct street from Dilworth Rd East. */
function buildAddress(a: Attrs): string {
  const parts = [str(a.houseno), str(a.stdir), str(a.stname), str(a.sttype), str(a.stsuffix)]
    .filter(Boolean)
    .join(' ')
  const unit = str(a.houseunit)
  const full = unit ? `${parts} ${unit}` : parts
  return full.replace(/\s+/g, ' ').trim()
}

/**
 * Build the `article` label.
 *
 * `ParcelInfo` has no structured field for a per-use height split, for a known
 * "no height limit applies", for a site-plan-governed parcel, or for a
 * voluntary bonus — and this task may not widen the shared type — so those ride
 * here as text. They are not decoration; each one is a claim the numeric fields
 * cannot make, and two of them are the difference between an answer and a gap:
 *
 *   · UC's height cell reads "Unlimited". `maxHeightFt: null` alone renders
 *     that identically to "we could not find a height", which is the rule-5
 *     failure in miniature. The sentence here is the only place the answer
 *     survives. (Flagged for the wiring stage: ParcelInfo wants a
 *     `heightUnconstrained` companion to `farUnconstrained`.)
 *   · A conditional / optional / legacy district has NO by-right envelope; the
 *     approved site plan and the superseded 1992 ordinance govern. Saying so is
 *     the answer. Saying nothing would let it read as a fetch failure.
 */
function buildArticle(limits: CharlotteLimits, zoneDes: string | null, lotSqFt: number | null): string | null {
  const bits: string[] = []

  if (limits.district) {
    const name = CHARLOTTE_DISTRICT_NAMES[limits.district]
    bits.push(limits.basis === 'udo-translated' ? `${name} (${limits.district})` : name)
  }

  if (limits.basis === 'udo-translated' && limits.translatedFrom) {
    bits.push(
      `Mapped as "${limits.translatedFrom}", a pre-UDO classification. UDO Sec. 3.2 and Table 3-1 translate it to ${limits.district}, and the UDO's standards for ${limits.district} apply.`,
    )
  }

  if (limits.basis === 'site-plan') {
    bits.push(
      `No by-right dimensional standards: "${zoneDes ?? 'this district'}" is a conditional, optional or exception district carried over from before the UDO. UDO Sec. 1.4.C leaves it governed by the development ordinances in effect when it was approved plus its approved conditional-zoning site plan and site-specific conditions, so the binding height is on that site plan and not in any published district table.`,
    )
  }

  if (limits.heightUnconstrained) {
    bits.push(
      `The UDO states NO maximum building height in this district — Table 12-2 row B reads "Unlimited". Height does not bind here; that is the code's answer, not a missing figure.`,
    )
  }

  // The per-use split, stated only where the code's two rows differ. Where they
  // agree, naming both would imply a distinction the table does not draw.
  if (
    limits.residentialFt != null &&
    limits.nonresidentialFt != null &&
    limits.residentialFt !== limits.nonresidentialFt
  ) {
    bits.push(
      `Height is stated per use: ${limits.residentialFt} ft residential, ${limits.nonresidentialFt} ft nonresidential and mixed-use. The residential figure is the one reported.`,
    )
  }
  if (limits.heightAppliesTo && limits.residentialFt != null) {
    bits.push(
      `The ${limits.residentialFt} ft limit applies to a ${limits.heightAppliesTo}; the UDO states no maximum building height for other structures in this district.`,
    )
  }
  if (limits.nonresidentialFt == null && limits.residentialFt != null && !limits.heightAppliesTo) {
    bits.push('The UDO states no nonresidential height for this district.')
  }

  if (limits.minHeightFt != null) {
    bits.push(`Minimum building height ${limits.minHeightFt} ft (lots of half an acre or less, and buildings of 2,000 sq ft or less, are exempt).`)
  }

  const coverage = coverageFractionFor(limits, lotSqFt)
  if (coverage != null) {
    bits.push(
      `Maximum building coverage ${Math.round(coverage * 100)}% of lot area — with no floor-area ratio anywhere in the UDO, this is the standard that binds floor area here.`,
    )
  } else if (limits.basis === 'udo' || limits.basis === 'udo-translated') {
    bits.push('The UDO sets no floor-area ratio and this district states no maximum building coverage; floor area is governed by height, setbacks and open space.')
  }

  if (limits.bonusHeightFt != null) {
    const tail = limits.bonusUnlimitedNearRapidTransit
      ? `, and is unlimited within a quarter-mile walk of a rapid transit station`
      : ''
    bits.push(
      `A voluntary development bonus (UDO Sec. 16.3) can raise the maximum to ${limits.bonusHeightFt} ft${tail}. It must be EARNED — points come from on-site affordable housing at stated AMI averages for 30 years and similar actions — so it is not a by-right height and is not reported as one.`,
    )
  }

  if (limits.neighborhood1StepDown) {
    bits.push(
      'Within 200 ft of the lot line of residential uses or vacant land in a Neighborhood 1 Place Type, the first 100 ft of a structure is capped at 50 ft and the 100-200 ft band at 65 ft. That can bind well below the district figure; it depends on the adopted Policy Map and is not evaluated here.',
    )
  }

  if (limits.conditional) {
    bits.push(
      'Conditional or optional district: an approved conditional-zoning site plan and site-specific conditions apply on top of the UDO (Sec. 1.4.C.3, Sec. 37.2.C.2) and may limit height, units or use BELOW the district figures shown.',
    )
  }
  if (limits.exception) {
    bits.push(
      'Exception (EX) district. UDO Sec. 37.2.C.3.b.i(A): "No modifications shall be made to maximum height regulations" — so the district height above is unaffected by the exception.',
    )
  }

  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getCharlotteParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts. maxAttempts 2, not 3:
  // fetchParcelSnap already retries its exact query internally, so three outer
  // attempts would be up to six queries.
  const [parcelR, zoningR, optional] = await Promise.all([
    readRequired('parcel', (t) => fetchParcelSnap(PARCELS, lat, lng, PARCEL_FIELDS, false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ZONING_FIELDS, false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    Promise.allSettled([
      fetchCityLimits(CHARLOTTE_GATE, lat, lng),
      fetchFeatures(HISTORIC, lat, lng, ['DistrictName', 'DistrictType']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [gateR, historicR, floodR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('charlotte', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT. A service that did not answer is an error and the only legal
  // handling is to refuse. A service that ANSWERED and found nothing is a
  // different fact and survives past this line, where it becomes the `Unknown`
  // the no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('charlotte', 'Charlotte', [parcelR, zoningR], t0)
  }

  const features = parcelR.value.features ?? []
  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['pid', 'totalac', 'totalvalue', 'municipality'], 'charlotte')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const cards = cardsForPrimaryParcel(features)
  const agg = aggregateCards(cards)

  // Reached only when the zoning service ANSWERED — the Huntersville case (a
  // county parcel with no Charlotte polygon) still lands here as a null.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['ZoneDes'], 'charlotte')
  const historic = historicR.status === 'fulfilled' ? firstAttrs(historicR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const zoneDes = zoning?.ZoneDes ? str(zoning.ZoneDes) : null
  const limits = resolveCharlotte(zoneDes)

  // ── Lot area ─────────────────────────────────────────────────────────────
  // Acres x 43,560. Externally cross-checked against the layer's own
  // EPSG:2264 polygon area over 2,000 parcels (see the header); this is a
  // measured square-footage, not an inferred one.
  const acres = Number(parcel.totalac)
  const lotSqFt = Number.isFinite(acres) && acres > 0 ? Math.round(acres * SQ_FT_PER_ACRE) : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // The historic layer carries the district's NAME; `ZoneDes` carries an (HDO)
  // marker. They are two independent statements of the same fact, and the
  // layer is preferred because it names the district. All 8 mapped districts
  // are DistrictType 'Local' — a UDO Sec. 14.2 overlay with a Certificate of
  // Appropriateness requirement, which is what downstream code treats
  // historicDistrict as meaning.
  const historicName = str(historic?.DistrictName)
  const historicType = str(historic?.DistrictType)
  const historicDistrict = historicName
    ? `${historicName}${historicType ? ` — ${historicType} historic district` : ''}`
    : null

  // The zoning string's own overlay markers, named from UDO Article 14 rather
  // than guessed from the letters. None of them changes the district height.
  const overlayLabels = limits.district
    ? resolveOverlayLabels(zoneDes)
    : []
  const subdistrict = historicDistrict ?? (overlayLabels.length > 0 ? overlayLabels.join(', ') : null)

  // ── Existing structure ───────────────────────────────────────────────────
  // Owner is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned. Both name fields are checked
  // because Mecklenburg splits an institutional owner across them ("UNIVERSITY
  // OF NORTH" / "CAROLINA AT CHARLOTTE"), and testing either alone would miss
  // a name the shared heuristic would otherwise catch.
  const ownerPublic = cards.some((c) =>
    isGovernmentOwner([str(c.ownerlastname), str(c.ownerfirstname)].filter(Boolean).join(' ')),
  )

  const landUse = str(parcel.descpropertyuse)
  const existingBase = {
    landUse: landUse || null,
    yearBuilt: agg.earliestYearBuilt,
    // Mecklenburg publishes HEATED area, which excludes unheated garages,
    // porches and unfinished basements — so it UNDERSTATES gross floor area.
    // It is the only building-size figure the assessor carries. Descriptive
    // only; nothing in the envelope or cost math reads it.
    buildingAreaSqFt: agg.heatedAreaSqFt,
    units: agg.units,
    numBuildings: agg.buildingCount,
    // netbldgvalue is the improvement (building) value alone — landvalue is the
    // other half — so it is labelled and must never be presented as a total.
    assessedValue: agg.improvementValue,
    assessedValueBasis:
      agg.accountCount > 1
        ? `improvement (building) value only — Mecklenburg County, summed over ${agg.accountCount} tax accounts on this parcel`
        : 'improvement (building) value only — Mecklenburg County',
  }
  const hasAnyExisting = Object.entries(existingBase).some(
    ([k, v]) => k !== 'assessedValueBasis' && v != null,
  )
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasAnyExisting
      ? existingBase
      : undefined

  // ── Sources ──────────────────────────────────────────────────────────────
  const sources: Record<string, string> = {
    parcels: PARCELS,
    zoning: ZONING,
    ...cityLimitsSource('charlotte'),
    historic: HISTORIC,
    flood: ENDPOINTS.flood,
  }
  // The layer links the rezoning petition on a conditional/optional parcel.
  // On the ~26% of Charlotte whose binding standard IS that site plan, this is
  // the only route to the real number. Never parsed — just surfaced.
  const petitionLink = str(zoning?.Hyperlink)
  if (petitionLink) sources.zoningPetition = petitionLink

  const info: ParcelInfo = {
    ...recordAddress(buildAddress(parcel)),
    parcelId: str(parcel.pid),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zoneDes ?? 'Unknown',
      subdistrict,
      article: buildArticle(limits, zoneDes, lotSqFt),
      // The RESIDENTIAL figure, because the default spec proposes dwellings and
      // a per-use table must not be collapsed to its maximum (CLAUDE.md rule
      // 6). The nonresidential figure is named in `article` where it differs.
      // Null on UC — where the code's answer is "Unlimited" — and on every
      // site-plan-governed and unresolved code.
      maxHeightFt: limits.residentialFt,
      // UC is the case: the UDO's answer is "Unlimited", which is an answer.
      ...(limits.heightUnconstrained ? { heightUnconstrained: true } : {}),
      // The Charlotte UDO contains no floor-area-ratio instrument at all: zero
      // occurrences of "floor area ratio", "FAR" or "F.A.R." in 1,780,151
      // characters across all 39 articles (zoning module FACT 1).
      maxFAR: null,
      // The module already establishes this district as plan/site-plan
      // governed, with a citation and the disclosure text above. Carrying the
      // flag through lets the envelope report it as a planned development
      // rather than as a failure to look it up.
      // `basis === 'site-plan'`, NOT `limits.conditional`. The two mean
      // different things and only the first is plan-governed: a site-plan
      // district has NO by-right dimensional standards (UDO Sec. 1.4.C, the
      // disclosure at the top of this file), while `conditional` marks a
      // district that DOES have figures with conditions layered on top that
      // "may limit height, units or use BELOW the district figures shown".
      ...(limits.basis === 'site-plan' ? { planGoverned: true } : {}),
      allowedUses: usesForZone(zoneDes),
      // The KNOWN absence, kept strictly distinct from an unresolved lookup: a
      // site-plan-governed or unrecognised code leaves this OFF entirely, so a
      // gap can never render as "FAR does not bind here" — and can never fall
      // back to an assumed FAR of 1.0 either.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      // Deliberately no `maxStories`. Charlotte states height in feet and only
      // in feet — no Building Height Standards table in any article carries a
      // story count — so there is nothing to report and nothing to derive
      // (CLAUDE.md rule 12).
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // A failed optional read is NOT "nothing here". Left as a bare null, the
      // hurdle each field triggers silently disappears along with the months it
      // carries — see `lib/unresolvedOverlays.ts` and the "could not be checked"
      // rows in `hurdles.ts`.
      ...unresolvedOverlays({
        historic: historicDistrict == null && readFailed(historicR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // North Carolina appraises real property at fair market value, so unlike a
    // fractional-assessment state this is a market-basis figure. Summed over
    // the parcel's distinct tax accounts (see `aggregateCards`).
    //
    // ⚠️ It is FROZEN, not stale-in-a-known-direction. Mecklenburg County
    // revalues on a four-year cycle; the current values carry a valuation date
    // of January 1, 2023 and the next revaluation takes effect January 1, 2027.
    // Between those dates the assessment does not move with the market at all.
    // This deliberately does NOT tell a reader which way to correct: no
    // measurement of Charlotte's market since January 2023 has been made here,
    // and a disclaimer naming the wrong direction is worse than none
    // (CLAUDE.md rule 7).
    assessedValue: agg.totalValue,
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({
    event: 'parcel.ok',
    city: 'charlotte',
    durationMs: Date.now() - t0,
    parcelId: info.parcelId,
    cards: cards.length,
    accounts: agg.accountCount,
  })
  return { ok: true, info }
}

/** Name the UDO Article 14 overlays carried in a `ZoneDes` string. Only codes
 *  Article 14 establishes are named; anything else is left unnamed rather than
 *  guessed at. */
function resolveOverlayLabels(zoneDes: string | null): string[] {
  if (!zoneDes) return []
  // ⚠️ ONE TOKENIZER. This used to carry its own copy of the split —
  // `zoneDes.toUpperCase().split(/[()\s]+/).filter(Boolean).slice(1)` — which is
  // character-for-character what parseCharlotteZone does. Two parsers of one
  // string is the shape that produced Seattle's MIO defect, where the pair
  // agreed on every NC/C code and diverged on the family nobody probed.
  // Measured before collapsing: the two agreed on all 218 live ZoneDes values,
  // so this is removing the possibility rather than fixing a live divergence.
  const tokens = parseCharlotteZone(zoneDes).tail
  const out: string[] = []
  for (const t of tokens) {
    const name = CHARLOTTE_OVERLAY_NAMES[t]
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'pid' } as const
