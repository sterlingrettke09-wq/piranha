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
import { reverseGeocode } from '../geo'

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

// Max height (ft) + FAR by base zone, from Austin LDC §25-2-492 site-development
// regulations (City of Austin Zoning Guide tables). Residential zones are
// height-governed with no FAR (f: null). PUD/DR/AV/P vary case-by-case → null.
const AUSTIN_LIMITS: Record<string, { h: number | null; f: number | null }> = {
  RR: { h: 35, f: null }, 'SF-1': { h: 35, f: null }, 'SF-2': { h: 35, f: null }, 'SF-3': { h: 35, f: null },
  'SF-4A': { h: 35, f: null }, 'SF-4B': { h: 30, f: null }, 'SF-5': { h: 35, f: null }, 'SF-6': { h: 35, f: null },
  MH: { h: 35, f: null },
  'MF-1': { h: 40, f: null }, 'MF-2': { h: 40, f: null }, 'MF-3': { h: 40, f: 0.75 },
  'MF-4': { h: 60, f: 0.75 }, 'MF-5': { h: 60, f: 1.0 }, 'MF-6': { h: 90, f: null },
  NO: { h: 35, f: 0.35 }, LO: { h: 40, f: 0.7 }, GO: { h: 60, f: 1.0 }, CR: { h: 40, f: 0.25 },
  LR: { h: 40, f: 0.5 }, GR: { h: 60, f: 1.0 }, L: { h: 200, f: 8.0 }, CS: { h: 60, f: 2.0 }, 'CS-1': { h: 60, f: 2.0 },
  CBD: { h: null, f: 8.0 }, DMU: { h: 120, f: 5.0 },
  IP: { h: 60, f: 1.0 }, LI: { h: 60, f: 1.0 }, MI: { h: 120, f: 1.0 }, 'R&D': { h: 45, f: 0.25 },
}
function austinLimits(base: string | null): { h: number | null; f: number | null } {
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
  const [parcelR, zoningR, floodR, geocodeR, subFR] = await Promise.allSettled([
    fetchParcelSnap(PARCELS, lat, lng, ['SITUS', 'PID_10', 'Shape__Area']),
    fetchParcelSnap(ZONING, lat, lng, ['BASE_ZONE', 'ZONE_NAME', 'ZONING_ZTYPE']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    reverseGeocode(lat, lng),
    fetchFeatures(SUBCHAPTER_F, lat, lng, ['ZONING_OVERLAY_NAME']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'austin', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PID_10', 'Shape__Area'], 'austin')
  warnIfMissing(zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null, ['BASE_ZONE'], 'austin')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // The mirror's SITUS field holds only a house number (no street), so derive a
  // proper street address by reverse-geocoding the click point.
  const address = (geocodeR.status === 'fulfilled' ? geocodeR.value : null) ?? 'Selected location'
  const areaSqFt = Number(parcel.Shape__Area) // already in square feet
  const base = parcel != null && zoning?.BASE_ZONE ? String(zoning.BASE_ZONE) : null
  const lim = austinLimits(base)

  // Subchapter F applicability. A FAILED fetch is NOT treated as "outside" —
  // that would silently flip a parcel into the unconstrained branch and report
  // "no FAR limit" on the strength of a network error. On failure we fall back
  // to the base-zone limits and leave FAR unresolved (null, not
  // farUnconstrained), which reads as a gap rather than an answer.
  const subFOk = subFR.status === 'fulfilled'
  const insideSubchapterF = subFOk && (subFR.value.features ?? []).length > 0
  const sf = subFOk ? austinSfLimits(base, insideSubchapterF) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.PID_10 ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: base ?? 'Unknown',
      subdistrict: zoning?.ZONING_ZTYPE ? String(zoning.ZONING_ZTYPE) : null,
      article: zoning?.ZONE_NAME ? String(zoning.ZONE_NAME) : null,
      maxHeightFt: sf ? sf.maxHeightFt : lim.h,
      maxFAR: sf ? sf.maxFAR : lim.f,
      allowedUses: usesForZone(base),
      ...(sf?.farFloorSqFt != null ? { farFloorSqFt: sf.farFloorSqFt } : {}),
      ...(sf?.farUnconstrained ? { farUnconstrained: true } : {}),
    },
    lot: {
      sizeSqFt: Number.isFinite(areaSqFt) && areaSqFt > 0 ? Math.round(areaSqFt) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { parcels: PARCELS, zoning: ZONING, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'austin', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
