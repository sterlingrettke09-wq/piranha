// Austin provider — TCAD parcels (via the City of Austin's ArcGIS Online
// mirror) + City of Austin zoning. Endpoints verified live 2026-06-01.
//
// GOTCHA: the original TCAD host (gis.traviscountytx.gov) is reachable only over
// IPv6 — its IPv4 endpoint hangs. Netlify's functions run on IPv4-only AWS, so
// they could never reach it (every Austin lookup failed in production). We use
// COA's "EXTERNAL_tcad_parcel" mirror on services.arcgis.com instead, which is
// IPv4-reachable. Its SITUS field is house-number-only, so we reverse-geocode
// the street address (as the SF provider does). Shape__Area is already sq ft.
//
// NOTE: the COA "Current_Zoning" layer is a 2019 snapshot, predating the 2023–24
// HOME reforms. Base zone CODES remain valid (surfaced to users via an Austin
// disclaimer in analyze.ts). No point-in-polygon historic layer is published, so
// historic is left null.
//
// ⚠️ The disclaimer used to say limits "may understate today's buildable
// envelope". For units and minimum lot size that is right. FOR FLOOR AREA IT
// WAS BACKWARDS, and that is worse than saying nothing: it told the reader
// which way to correct, and the correction ran into the error. SF-1/2/3 carried
// `f: null`, which made defaultSpec assume FAR 1.0 — an OVERSTATEMENT on any
// lot above ~6,700 sf (7,000 sf lot: 7,000 claimed vs 2,800 actual
// single-family). Fixed below via the Subchapter F two-branch resolution.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { reverseGeocode } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { geocodedAddress } from '../address'

const PARCELS =
  'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/EXTERNAL_tcad_parcel/FeatureServer/0'
const ZONING =
  'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0'
// Subchapter F ("McMansion") area of applicability. Verified live 2026-08-04:
// returns ZONING_OVERLAY_NAME 'RESIDENTIAL DESIGN STANDARDS',
// SOURCE_DOCUMENT 'LDC/25-2-Subchapter F', ZONING_STATUS 'APPROVED'. Confirmed
// to DISCRIMINATE rather than blanket the city — Hyde Park and Downtown return
// 1; far north, far southwest and the northeast edge return 0.
// (A duplicate `McMansion` layer exists with identical geometry; this one is
// canonically named, so prefer it.)
const SUBCHAPTER_F =
  'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/PLANNINGCADASTRE_residential_design_standards/FeatureServer/0'

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// The parcel layer is TCAD's (Travis County); the zoning layer is the CITY's.
// Measured 2026-08-12 at the real entry point: West Lake Hills, Rollingwood and
// Sunset Valley addresses inside AUSTIN_BBOX all returned ok:true with a real lot
// area and `districtCode: 'Unknown'`.
//
// ⚠️ The gate accepts FULL **and LTD** jurisdiction, which is a measurement:
// Austin zones inside its limited-purpose annexations. See ../jurisdiction.ts.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const AUSTIN_GATE = cityLimitsGate('austin')!


// Max height + FAR by base zone. Verified value-by-value 2026-08-05 against the
// PRIMARY source: Austin Land Development Code § 25-2-492 (SITE DEVELOPMENT
// REGULATIONS), Subsection (D) "Site development regulation table" — Municode
// Supplement No. 173, "Codified through Ordinance No. 20260122-059, effective
// February 2, 2026". § 25-2-492(A): "The table in Subsection (D) establishes the
// principal site development regulations for each zoning district."
//
// The table's 37 district columns run LA, RR, SF-1, SF-2, SF-3, SF-4A, SF-4B,
// SF-5, SF-6, MF-1…MF-6, MH, NO, LO, GO, CR, LR, GR, L, CBD, DMU, W/LO, CS,
// CS-1, CH, IP, MI, LI, R&D, DR, AV, AG, P. Every row carries exactly 37 value
// cells, so the columns are positionally unambiguous — that alignment is what
// was checked, since a one-column slip is the failure mode that publishes a
// neighbouring district's number under this district's name.
//
// `h` is the code's own MAXIMUM HEIGHT figure in FEET. Where the code states a
// STORY count instead, `s` carries it and `h` stays null — never convert
// between the two with a per-story constant.
//
// Residential zones have a BLANK FAR cell (f: null → a gap, not "no FAR"; the
// SF-1/2/3 branch below resolves those properly). PUD/DR/AV/P vary case-by-case
// → absent. W/LO and CH are deliberately absent: their table cells are footnote
// pointers to regulations we have not resolved (CH's height is a function of
// impervious cover, § 25-2-582(B)), and a gap is the honest state.
const AUSTIN_LIMITS: Record<string, { h: number | null; f: number | null; s?: number }> = {
  RR: { h: 35, f: null }, 'SF-1': { h: 35, f: null }, 'SF-2': { h: 35, f: null }, 'SF-3': { h: 35, f: null },
  // SF-4A: the § 25-2-492(D) height cell is footnote 4, which points at
  // § 25-2-779 (Small Lot Single-Family Residential Use). § 25-2-779(D)(3), for
  // "property zoned single-family residence small lot (SF-4A) district or less
  // restrictive": "The maximum height for a structure is 35 feet." Confirmed.
  'SF-4A': { h: 35, f: null },
  // SF-4B: was `h: 30` — a FOOT figure the code never states. The § 25-2-492(D)
  // height cell is footnote 5 → § 25-2-558 (Single-Family Residence Condominium
  // Site (SF-4B) District Regulations), whose § 25-2-558(G) reads: "Except as
  // provided in Subsection (H), the maximum height of a building is two stories.
  // A story may not exceed a plate height of 10 feet." The code regulates SF-4B
  // in STORIES. 30 ft is not derivable from it (two stories at a 10 ft plate is
  // not 30), and § 25-2-558 is the only place in Chapter 25-2 that sets an SF-4B
  // height. Carry the stated 2 stories; leave feet unresolved rather than
  // multiplying by an invented ft/story.
  'SF-4B': { h: null, f: null, s: 2 },
  'SF-5': { h: 35, f: null }, 'SF-6': { h: 35, f: null },
  // MH: every MH cell in the § 25-2-492(D) table is an em dash, so the 35 does
  // NOT come from there. It is § 25-2-1205 (Site Development Regulations for
  // Mobile Home Parks), item (15): "The maximum height of a structure shall be
  // 35 feet." § 25-2-1206 routes mobile home SUBDIVISIONS to the SF-2
  // regulations, which are also 35 ft — both paths agree. Confirmed.
  MH: { h: 35, f: null },
  'MF-1': { h: 40, f: null }, 'MF-2': { h: 40, f: null }, 'MF-3': { h: 40, f: 0.75 },
  'MF-4': { h: 60, f: 0.75 }, 'MF-5': { h: 60, f: 1.0 }, 'MF-6': { h: 90, f: null },
  NO: { h: 35, f: 0.35 }, LO: { h: 40, f: 0.7 }, GO: { h: 60, f: 1.0 }, CR: { h: 40, f: 0.25 },
  LR: { h: 40, f: 0.5 }, GR: { h: 60, f: 1.0 }, L: { h: 200, f: 8.0 }, CS: { h: 60, f: 2.0 }, 'CS-1': { h: 60, f: 2.0 },
  // CBD: was `h: null`, which rendered downtown as "height unknown". The
  // § 25-2-492(D) MAXIMUM HEIGHT cell for CBD now reads 350 — added by Ord. No.
  // 20251023-063, Pt. 1, 11-3-25 (listed in the table's own Source line, which
  // ends "Ord. 20100819-064; Ord. No. 20251023-063, Pt. 1, 11-3-25"). This is a
  // BASE entitlement, not a bonus: § 25-2-581 (Central Business District (CBD)
  // District Regulations) imposes no height at all, and the Downtown Density
  // Bonus Program treats 350 ft as the threshold ABOVE which bonus area is
  // measured (§ 25-2-586(B)(2): participation "only for floor-to-area ratio that
  // exceeds 8:1 or height above 350 feet").
  CBD: { h: 350, f: 8.0 }, DMU: { h: 120, f: 5.0 },
  IP: { h: 60, f: 1.0 }, LI: { h: 60, f: 1.0 }, MI: { h: 120, f: 1.0 },
  // R&D height 45 ft is § 25-2-603(F): "The maximum height is 45 feet, except
  // that the height of a building may exceed 45 feet by one foot for each
  // additional two feet that the building is set back … up to a maximum height
  // of 90 feet." 45 is the base; the 90 is a setback-earned increase, not a
  // ceiling to publish.
  //
  // R&D FAR was 0.25 applied to every R&D parcel. The § 25-2-492(D) FAR cell for
  // R&D is footnote 14 → § 25-2-603, and § 25-2-603(E) is GEOGRAPHICALLY
  // CONDITIONED: "The maximum floor to area ratio is .25 to 1 in the following
  // areas: (1) the Barton Creek watershed…; (2) the aquifer-related Williamson
  // Creek watershed…; (3) the Lake Austin watershed…; (4) the Lake Austin
  // watershed…; and (5) the Northwest Area…". We do not resolve watershed
  // geometry, so for an arbitrary R&D parcel the FAR is UNRESOLVED (null → a
  // gap), not 0.25. It is also not `farUnconstrained`: the slot exists and is
  // filled for five named areas, so an absence has not been established.
  'R&D': { h: 45, f: null },
}
function austinLimits(base: string | null): { h: number | null; f: number | null; s?: number } {
  if (!base) return { h: null, f: null }
  return AUSTIN_LIMITS[base.toUpperCase().trim()] ?? { h: null, f: null }
}

// ---- Subchapter F / HOME resolution for SF-1, SF-2, SF-3 ----
//
// Sourced 2026-08-04. HOME Phase 1 (Ord. 20231207-001, adopted 2023-12-07,
// applications from 2024-02-05) and Phase 2 (adopted 2024-05-16, citywide from
// 2024-11-24) are BOTH IN EFFECT — City of Austin DSD "HOME Amendments" status
// page, no injunction or suspension. Re-check before relying on it: Austin's
// LDC has been invalidated on protest-rights grounds before (14th Court of
// Appeals, 2022), so this is a fact that changes by litigation, not schedule.
//
// The regime is TWO-BRANCH and the branch is geographic:
//
//   INSIDE the Subchapter F boundary
//     · single-family use  → 0.40 FAR, 32 ft (Subchapter F; HOME left this
//       untouched — the ordinance FAQ is explicit: "What changes do I need to
//       make if I'm designing or building a single-family home under
//       Subchapter F? Nothing at all. Proceed as before.")
//     · 2-unit / 3-unit use → Subchapter F ENTIRELY WAIVED ("No tent, no
//       additional documentation and review time, no extra Gross Floor Area
//       definition, no exemption calculations, no sidewalk articulation"),
//       replaced by the HOME FAR gradient below, at the 35 ft base-zone height.
//
//   OUTSIDE the boundary
//     · NO FAR limit at all, and the 2–3 units are still allowed. Floor area is
//       governed by height, setbacks, coverage and impervious cover instead.
//       This is why the parcel is marked `farUnconstrained` rather than given a
//       number: applying the gradient citywide would impose a cap the code does
//       not impose, and it would read as a citation.
//
// HOME FAR maxima are "the greater of the ratio or the floor value", which is
// what `farFloorSqFt` exists to carry — on small lots the floor governs.
export const AUSTIN_HOME_FAR = {
  singleFamily: { far: 0.4, floorSqFt: null, heightFt: 32 },
  twoUnit: { far: 0.55, floorSqFt: 3200, heightFt: 35 },
  threeUnit: { far: 0.65, floorSqFt: 4350, heightFt: 35 },
} as const

const AUSTIN_SF_ZONES = new Set(['SF-1', 'SF-2', 'SF-3'])
export const isAustinSubchapterFZone = (base: string | null): boolean =>
  !!base && AUSTIN_SF_ZONES.has(base.toUpperCase().trim())

export interface AustinSfLimits {
  maxHeightFt: number | null
  maxFAR: number | null
  farFloorSqFt: number | null
  farUnconstrained: boolean
}

// ⚠️ HEADLINE REGIME — INTERIM, PENDING A PRODUCT RULING.
// Inside the boundary this reports the SINGLE-FAMILY base case (0.40 / 32 ft),
// not the 3-unit maximum. Reporting the 3-unit gradient would silently assume a
// program the user has not chosen: on a 7,000 sf lot it claims 4,550 sf where a
// single-family build allows 2,800. 0.40 vs 0.65 are ALTERNATIVES, not a floor
// and a ceiling. The base case is the conservative read and strictly improves on
// the previous behaviour (see below); switching to a chosen-program envelope is
// a product decision, and AUSTIN_HOME_FAR above is ready for it.
//
// PREVIOUS BEHAVIOUR WAS A DEFECT: SF-1/2/3 returned `f: null`, so envelope.ts
// produced maxFloorAreaSqFt: null and defaultSpec.ts fell through to
// `lot.sizeSqFt * 1.0` — an unsourced FAR-1.0 assumption on Austin's most
// common residential zones. On a 7,000 sf lot that claimed 7,000 sf buildable
// against a real single-family 2,800.
export function austinSfLimits(base: string | null, insideSubchapterF: boolean): AustinSfLimits | null {
  if (!isAustinSubchapterFZone(base)) return null
  if (!insideSubchapterF) {
    // Known absence, not a missing lookup. Height stays the 35 ft base zone.
    return { maxHeightFt: 35, maxFAR: null, farFloorSqFt: null, farUnconstrained: true }
  }
  const r = AUSTIN_HOME_FAR.singleFamily
  return { maxHeightFt: r.heightFt, maxFAR: r.far, farFloorSqFt: r.floorSqFt, farUnconstrained: false }
}

/**
 * The limits Austin actually publishes for a base zone — the COMPOSITION, not
 * either half of it.
 *
 * ⚠️ THE SWEEP WAS MEASURING ONE BRANCH. Austin resolves in two: the Subchapter
 * F / HOME resolver applies to SF-1/2/3 only and returns null for everything
 * else, and the provider then falls back to the § 25-2-492(D) base table. The
 * parser-domain sweep called `austinSfLimits` alone and read its null as "no
 * answer", so it reported 41 of 44 live codes unhandled and its scope note said
 * "Subchapter F single-family zones only" — while production publishes a height
 * for most of the 37 districts in that table, SF-4A at 35 ft (§ 25-2-779(D)(3))
 * and SF-4B at 2 storeys (§ 25-2-558(G)) among them.
 *
 * That is rule 11: the sweep measured a layer, and the answer depended on which
 * one it called. `austinLimits` was module-private, so the sweep could not have
 * called the real path even had it tried.
 *
 * Exported and used by BOTH the provider and the sweep, deliberately. Having the
 * sweep re-implement `sf ?? lim` would put the composition in two places, which
 * is the duplicate-parse shape that let Seattle's MIO overlay height drift out
 * of agreement with itself.
 */
export function austinResolvedLimits(
  base: string | null,
  insideSubchapterF: boolean,
  /** False when the Subchapter F fetch FAILED. A failed fetch must not read as
   *  "outside the boundary" — that flips the parcel into the unconstrained
   *  branch and reports "no FAR limit" on the strength of a network error. */
  subchapterFResolved = true,
): { maxHeightFt: number | null; maxFAR: number | null; maxStories?: number; farFloorSqFt: number | null; farUnconstrained: boolean } {
  const sf = subchapterFResolved ? austinSfLimits(base, insideSubchapterF) : null
  if (sf) {
    return {
      maxHeightFt: sf.maxHeightFt,
      maxFAR: sf.maxFAR,
      farFloorSqFt: sf.farFloorSqFt,
      farUnconstrained: sf.farUnconstrained,
    }
  }
  const lim = austinLimits(base)
  return {
    maxHeightFt: lim.h,
    maxFAR: lim.f,
    ...(lim.s != null ? { maxStories: lim.s } : {}),
    farFloorSqFt: null,
    farUnconstrained: false,
  }
}

/**
 * The HOME programs available ALONGSIDE the single-family base case, as
 * floor-area alternatives. Only inside the Subchapter F boundary, where the
 * gradient applies; outside it there is no FAR limit and no alternative to
 * express. Each is `max(ratio * lot, floorSqFt)`, per "the greater of the ratio
 * or the floor value".
 *
 * These are ALTERNATIVES to the 0.40 base case, not a ceiling above it — the
 * user picks one program. Surfacing them is what keeps the conservative
 * headline from making Austin look more restrictive than it is.
 */
export function austinHomeAlternatives(
  base: string | null,
  insideSubchapterF: boolean,
): NonNullable<ParcelInfo['zoning']['farAlternatives']> | undefined {
  if (!isAustinSubchapterFZone(base) || !insideSubchapterF) return undefined
  const SRC = 'Austin HOME Phase 1, Ord. 20231207-001'
  return [
    { label: '2 units (HOME)', far: AUSTIN_HOME_FAR.twoUnit.far, floorSqFt: AUSTIN_HOME_FAR.twoUnit.floorSqFt, source: SRC },
    { label: '3 units (HOME)', far: AUSTIN_HOME_FAR.threeUnit.far, floorSqFt: AUSTIN_HOME_FAR.threeUnit.floorSqFt, source: SRC },
  ]
}

// Austin base-zone prefix → use vocabulary.
function usesForZone(base: string | null): string[] | null {
  if (!base) return null
  const z = base.trim().toUpperCase()
  if (z.startsWith('SF') || z.startsWith('RR') || z.startsWith('LA')) return ['residential']
  if (z.startsWith('MF')) return ['residential', 'mixed']
  if (z.startsWith('MU')) return ['mixed', 'residential', 'commercial']
  if (z.startsWith('CS') || z.startsWith('GR') || z.startsWith('LR') || z.startsWith('CBD') || z.startsWith('DMU') || z.startsWith('CH') || z.startsWith('GO') || z.startsWith('LO') || z.startsWith('NO'))
    return ['commercial', 'mixed', 'residential']
  if (z.startsWith('IP') || z.startsWith('LI') || z.startsWith('MI') || z.startsWith('W/LO')) return ['commercial', 'institutional']
  if (z.startsWith('P') || z.startsWith('PUD')) return ['institutional']
  return null
}

export async function getAustinParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // reverseGeocode runs inside the fan-out: awaiting it after the parcel
  // fetch made its latency ADD to the slowest upstream instead of running
  // alongside it (and pushed worst-case toward the 10s function ceiling).
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, ['SITUS', 'PID_10', 'Shape__Area'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, ['BASE_ZONE', 'ZONE_NAME', 'ZONING_ZTYPE'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchCityLimits(AUSTIN_GATE, lat, lng),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      reverseGeocode(lat, lng),
      fetchFeatures(SUBCHAPTER_F, lat, lng, ['ZONING_OVERLAY_NAME']),
    ]),
  ])
  const [gateR, floodR, geocodeR, subFR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('austin', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('austin', 'Austin', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PID_10', 'Shape__Area'], 'austin')
  warnIfMissing(firstAttrs(zoningR.value), ['BASE_ZONE'], 'austin')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // The mirror's SITUS field holds only a house number (no street), so derive a
  // proper street address by reverse-geocoding the click point.
  const addressed = geocodedAddress(geocodeR.status === 'fulfilled' ? geocodeR.value : null)
  const areaSqFt = Number(parcel.Shape__Area) // already in square feet
  const base = parcel != null && zoning?.BASE_ZONE ? String(zoning.BASE_ZONE) : null
  // Subchapter F applicability. A FAILED fetch is NOT treated as "outside" —
  // that would silently flip a parcel into the unconstrained branch and report
  // "no FAR limit" on the strength of a network error. On failure we fall back
  // to the base-zone limits and leave FAR unresolved (null, not
  // farUnconstrained), which reads as a gap rather than an answer.
  const subFOk = subFR.status === 'fulfilled'
  const insideSubchapterF = subFOk && (subFR.value.features ?? []).length > 0
  // ONE composition, shared with the parser-domain sweep — see
  // austinResolvedLimits() for what measuring only half of it cost.
  const res = austinResolvedLimits(base, insideSubchapterF, subFOk)
  const sf = subFOk ? austinSfLimits(base, insideSubchapterF) : null

  const info: ParcelInfo = {
    ...addressed,
    parcelId: String(parcel.PID_10 ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: base ?? 'Unknown',
      subdistrict: zoning?.ZONING_ZTYPE ? String(zoning.ZONING_ZTYPE) : null,
      article: zoning?.ZONE_NAME ? String(zoning.ZONE_NAME) : null,
      maxHeightFt: res.maxHeightFt,
      maxFAR: res.maxFAR,
      allowedUses: usesForZone(base),
      // Only where the CODE states a story count (SF-4B, § 25-2-558(G)). The
      // envelope prefers a stated count over one derived by dividing a height by
      // a floor-to-floor convention, and labels which it used.
      ...(res.maxStories != null ? { maxStories: res.maxStories } : {}),
      ...(sf?.farFloorSqFt != null ? { farFloorSqFt: sf.farFloorSqFt } : {}),
      ...(sf?.farUnconstrained ? { farUnconstrained: true } : {}),
      ...(subFOk && austinHomeAlternatives(base, insideSubchapterF)
        ? { farAlternatives: austinHomeAlternatives(base, insideSubchapterF) }
        : {}),
    },
    lot: {
      sizeSqFt: Number.isFinite(areaSqFt) && areaSqFt > 0 ? Math.round(areaSqFt) : null,
      lotType: null,
    },
    overlays: {
      // ⚠️ NOT MARKED `unresolved: ['historic']` ON ANY RUN, and that is not an
      // oversight to copy: this provider queries NO historic layer at all, so
      // there is no read here that can fail. Austin's (H)/(HD) designations are
      // a real gap in this provider — `HISTORIC_BODY.austin` in `hurdles.ts`
      // describes a review that can never fire — but a gap in coverage is a
      // different defect from a fetch failure publishing an absence, and
      // marking it here would report a transport failure that did not happen.
      historicDistrict: null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      ...unresolvedOverlays({ flood: readFailed(floodR) }),
    },
    sources: { parcels: PARCELS, zoning: ZONING, ...cityLimitsSource('austin'), flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'austin', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'PID_10' } as const
