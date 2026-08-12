// Los Angeles provider — LA County Assessor parcels + City of LA NavigateLA
// generalized zoning + Historic Preservation Overlay Zone (HPOZ). Verified live
// 2026-06-01. All accept inSR=4326. Parcel lot area is taken from the polygon
// geometry returned in State Plane feet (EPSG:2229), since the layer has no
// plain lot-area attribute.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { polygonAreaSqFt } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'

const PARCELS =
  'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0'
const ZONING = 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/71'
const HPOZ = 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/75'
// CA Coastal Commission statewide Coastal Zone polygon — inside it, a Coastal
// Development Permit is required (Venice, San Pedro, Pacific Palisades…).
const COASTAL = 'https://services9.arcgis.com/wwVnNW92ZHUIr0V0/arcgis/rest/services/Coastal_Zone_Polygon/FeatureServer/0'

// In LA, FAR + height are set by the Height District — the token after the base
// zone in ZONE_CMPLT (e.g. "C2-1" → district 1; "[Q]R4-2" → 2; "R1-1XL" → 1XL).
//
// SOURCE for every figure below: LA Municipal Code Chapter 1, Article 2,
// § 12.21.1 (HEIGHT OF BUILDING OR STRUCTURES), read verbatim on
// codelibrary.amlegal.com on 2026-08-05. LAMC current through legislation
// effective 3/31/2026; § 12.21.1 A.1 last amended by Ord. No. 181,624, Eff.
// 5/9/11, A.2–A.4 by Ord. No. 161,684, Eff. 11/3/86.
//
// ⚠️ UNIT NOTE. The code states FAR as a multiple of the BUILDABLE AREA of the
// lot ("shall not exceed three times the Buildable Area of the Lot"), i.e. the
// lot minus its required yards — while computeEnvelope multiplies maxFAR by
// LOT area. Buildable area is never larger than the lot, so the floor area we
// publish for LA is an UPPER BOUND, overstating by the yard fraction. It is not
// converted here on purpose: no sourced lot→buildable ratio exists for a
// specific parcel, and inventing one is the failure CLAUDE.md rule 4 forbids.
type HdLimit = { f: number; h: number | null; s?: number }
const LA_HD: Record<string, HdLimit> = {
  // Plain HD 1/2/3/4 carry NO height-district cap of their own in § 12.21.1 —
  // the district sets floor area only. Base-zone caps are applied separately in
  // laBaseZoneHeightFt() below.
  '1': { f: 3.0, h: null },
  // § 12.21.1 A.1: "no Building or Structure in Height District No. 1-L shall
  // exceed six Stories, nor shall it exceed 75 feet in height."
  '1L': { f: 3.0, h: 75, s: 6 },
  // § 12.21.1 A.1: "no Building or Structure in Height District No. 1-VL shall
  // exceed three Stories, nor shall it exceed 45 feet in height."
  '1VL': { f: 3.0, h: 45 },
  // § 12.21.1 A.1: "no Building or Structure in Height District No. 1-XL shall
  // exceed two Stories, nor shall the highest point of the roof of any Building
  // or Structure located in this District exceed 30 feet in height."
  '1XL': { f: 3.0, h: 30 },
  // ⚠️ CORRECTED 2026-08-05: h was null, so the city's MOST restrictive height
  // district published no height limit at all and the feasibility height check
  // was skipped entirely. § 12.21.1 A.1: "In the RA, RE, RS, and R1 Zones,
  // portions of Height District No. 1 may also be designated as being in an
  // 'SS' Single Story Limit Height District, and no Building or Structure in
  // Height District No. 1-SS shall exceed one Story, nor shall the highest
  // point of the roof of any Building or Structure located in this District
  // exceed 18 feet in height."
  '1SS': { f: 3.0, h: 18, s: 1 },
  '2': { f: 6.0, h: null }, // A.2: "shall not exceed six times the buildable area of said lot."
  '3': { f: 10.0, h: null }, // A.3: "shall not exceed ten times the buildable area of said lot."
  '4': { f: 13.0, h: null }, // A.4: "shall not exceed thirteen times the buildable area of said lot."
}

// Height caps § 12.21.1 attaches to the BASE ZONE rather than to the height
// district. These bind at the same time as the height-district cap, so the
// governing height is the lesser of the two.
//
// Deliberately absent: the caps § 12.21.1 makes conditional on Hillside Area or
// Coastal Zone — R2 33 ft; R1/RS/RE9 33 ft (28 ft at roof slope < 25%);
// RE11/15/20/40 and RA 36 ft (30 ft at slope < 25%) — all of which are prefaced
// "shall apply on a Lot that is not located in a Hillside Area or Coastal Zone".
// We do not know whether a parcel is in a Hillside Area, so those stay a GAP
// rather than an answer. RD/R3/A1/A2/RZ/RMP/RW2 are NOT conditional: the
// hillside standards of § 12.21 C.10 apply only "for any Lot zoned R1, RS, RE
// or RA and designated Hillside Area", so the 45 ft below binds unconditionally.
function laBaseZoneHeightFt(base: string, tok: string): number | null {
  // § 12.21.1 preamble: "In the RU and RW1 Zones, no Building or Structure
  // shall exceed 30 feet in height." — stated with no height-district
  // qualifier, so it binds in every height district.
  if (base === 'RU' || base === 'RW1') return 30
  const hd1 = tok.startsWith('1')
  // § 12.21.1 preamble: "In the A1, A2, RZ, RMP, and RW2 Zones, and in those
  // portions of the RD and R3 Zones, which are also in Height District No. 1,
  // no Building or Structure shall exceed 45 feet in height."
  if (hd1 && (/^(A1|A2|RMP|RW2|R3)$/.test(base) || base.startsWith('RZ') || base.startsWith('RD'))) return 45
  // § 12.21.1 preamble: "In the CR Zone and those portions of the RD, R3, and
  // RAS3 Zones, which are in Height District Nos. 2, 3 or 4, no building or
  // structure shall exceed six stories nor shall it exceed 75 feet in height."
  // (RAS4 is not in that list; note it IS in the 1-VL rule below.)
  if (!hd1 && (/^(CR|R3|RAS3)$/.test(base) || base.startsWith('RD'))) return 75
  return null
}

export function laLimits(zoneCmplt: string | null): { h: number | null; f: number | null; s: number | null } {
  if (!zoneCmplt) return { h: null, f: null, s: null }
  const z = stripLaQualifier(zoneCmplt)
  const parts = z.split('-')
  const base = (parts[0] ?? '').toUpperCase()
  const tok = (parts[1] ?? '').toUpperCase()
  if (!/^(1L|1VL|1XL|1SS|1|2|3|4)$/.test(tok)) return { h: null, f: null, s: null }
  const hd = LA_HD[tok]
  // § 12.21.1 A.1 excepts EXACTLY four zones from the height district's floor
  // area: "for a Lot in all other zones, except the RA, RE, RS, and R1 Zones,
  // the total Floor Area ... shall not exceed three times the Buildable Area".
  // In those four, floor area comes from the base zone's own Residential Floor
  // Area restrictions, which we have not read — a GAP, not an absence.
  //
  // RD/RW/R2 are withheld here TOO, and that is NOT what A.1 says: the code
  // gives them 3× buildable area. Left in place deliberately rather than
  // "corrected" upward — density in those zones is set by lot area per dwelling
  // unit, not by FAR, and computeEnvelope turns maxFAR straight into maxUnits,
  // so publishing 3.0 for an R2 lot would report ~11 units where the zone
  // allows 2. Raising it needs the density rule first; flagged, not silently
  // widened.
  const baseControlled = /^(RA|RE|RS|R1|RD|RW|R2)/.test(base) && !base.startsWith('RAS')
  let far: number | null = baseControlled ? null : hd.f
  // § 12.21.1 A.1: "The total Floor Area contained in all the main Buildings on
  // a Lot in a commercial or industrial zone in Height District No. 1 shall not
  // exceed one-and-one-half times the Buildable Area of the Lot".
  if (far === 3.0 && /^(C|M|CM|CR|CW|MR|LAX)/.test(base)) far = 1.5
  let h = hd.h
  // § 12.21.1 A.1: "Notwithstanding that limitation, portions of Height District
  // No. 1-VL that are also in the RAS3 or RAS4 Zones shall not exceed 50 feet in
  // height."
  if (tok === '1VL' && (base === 'RAS3' || base === 'RAS4')) h = 50
  const bz = laBaseZoneHeightFt(base, tok)
  if (bz != null) h = h == null ? bz : Math.min(h, bz)
  // Story counts the CODE states, carried instead of derived (CLAUDE.md rule 12).
  // Emitted only where the height district's own cap is what governs — when a
  // lower base-zone cap wins, its story count is not the height district's, and
  // asserting "6 stories" against a 45 ft cap would overstate.
  //
  // 1-VL and 1-XL deliberately carry NO story count. § 12.21.1 A.1: "EXCEPTION:
  // A Building in Height District Nos. 1-XL, 1-VL, designed and used entirely
  // for residential purposes, or a Building in the RAS3 or RAS4 Zones shall be
  // limited as to the number of feet in height, but not as to the number of
  // Stories." Their 3-/2-story limits do not bind the residential case this
  // tool is mostly asked about, so the feet govern and the count stays derived.
  const s = hd.s != null && h === hd.h ? hd.s : null
  return { h, f: far, s }
}

// Strip a leading QUALIFIER prefix from a ZONE_CMPLT string.
//
// ⚠️ CORRECTED 2026-08-04. The old pattern only knew [Q]/(Q)/[T]/(T). LA also
// publishes (F) — "Frontage"/conditional — and (WC) — Warner Center. Measured
// live: 14 of 2,128 distinct ZONE_CMPLT strings (0.7%) carry an unhandled
// prefix, and BOTH failure modes overstate:
//   (F)CM-1-CUGU → base parsed as "(F)CM", so the C/M Height-District-1
//     override never fired → FAR 3.0 published where the code says 1.5.
//   (F)RE11-1    → base parsed as "(F)RE11", so the base-controlled R-zone
//     test never fired → FAR 3.0 asserted where there should be NONE.
// Accepts any bracketed qualifier. The bare Q/T branch is preserved so existing
// behaviour for un-bracketed forms is unchanged.
//
// ⚠️ 2026-08-05: this is now ONE function. The 2026-08-04 fix was applied to the
// limits parser only, and usesForZone kept its own `^\[[QT]\]` pattern three
// functions below — so "(F)C2-1" still fell through every branch and returned
// no allowed uses at all, which zeroes maxUnits downstream. Same retraction,
// second site (CLAUDE.md rule 17). Both callers share this now.
export function stripLaQualifier(code: string): string {
  return code.replace(/^(?:[[(][A-Z]{1,4}[\])]|[QT])-?/i, '').trim()
}

// LA zoning code (ZONE_CMPLT, e.g. "R1-1", "C2-1", "[Q]R3-1", "RE9-1-HPOZ") →
// use vocabulary, keyed on the base class letter.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = stripLaQualifier(code).toUpperCase()
  if (z.startsWith('R') || z.startsWith('RD') || z.startsWith('RAS')) return ['residential', 'mixed']
  if (z.startsWith('C') || z.startsWith('HB') || z.startsWith('LAS')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('M') || z.startsWith('MR')) return ['commercial', 'institutional']
  if (z.startsWith('P') || z.startsWith('PF') || z.startsWith('OS') || z.startsWith('A')) return ['institutional']
  return null
}

export async function getLaParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) =>
        fetchParcelSnap(PARCELS, lat, lng, ['SitusFullAddress', 'APN', 'UseType', 'UseDescription'], true, 2229, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) =>
        fetchParcelSnap(ZONING, lat, lng, ['ZONE_CMPLT', 'ZONE_CLASS', 'ZONING_DESCRIPTION'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchFeatures(HPOZ, lat, lng, ['NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      fetchFeatures(COASTAL, lat, lng, ['FID']),
    ]),
  ])
  const [hpozR, floodR, coastalR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  // LA's parcel layer is the COUNTY's and the zoning layer is the CITY's, so an
  // empty zoning answer is the real "Manhattan Beach" case the coverage copy is
  // written for. A timeout is not that.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('la', 'Los Angeles', [parcelR, zoningR], t0)
  }

  const feature = firstFeature(parcelR.value)
  const parcel = feature?.attributes ?? null
  warnIfMissing(parcel, ['APN'], 'la')
  warnIfMissing(firstAttrs(zoningR.value), ['ZONE_CMPLT'], 'la')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const hpoz = hpozR.status === 'fulfilled' ? firstAttrs(hpozR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const inCoastalZone = coastalR.status === 'fulfilled' && (coastalR.value.features?.length ?? 0) > 0

  const rawAddr = parcel.SitusFullAddress ? String(parcel.SitusFullAddress).replace(/\s+/g, ' ').trim() : ''
  const address = rawAddr.split(/\s+LOS ANGELES\s+CA/i)[0].trim() || 'Selected location'
  // Geometry is in EPSG:2229 (US survey feet); shoelace gives square feet directly.
  const lotSqFt = polygonAreaSqFt(feature?.geometry?.rings, 1)
  const code = zoning?.ZONE_CMPLT ? String(zoning.ZONE_CMPLT) : null
  const lim = laLimits(code)
  const useDesc = parcel.UseDescription
    ? String(parcel.UseDescription).trim()
    : parcel.UseType
      ? String(parcel.UseType).trim()
      : null

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.APN ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? (zoning?.ZONE_CLASS ? String(zoning.ZONE_CLASS) : 'Unknown'),
      subdistrict: null,
      article: zoning?.ZONING_DESCRIPTION ? String(zoning.ZONING_DESCRIPTION) : null,
      maxHeightFt: lim.h,
      maxFAR: lim.f,
      ...(lim.s != null ? { maxStories: lim.s } : {}),
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: lotSqFt,
      lotType: null,
    },
    overlays: {
      coastalZone: inCoastalZone || undefined,
      historicDistrict: hpoz?.NAME ? `${String(hpoz.NAME)} HPOZ` : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // ⚠️ `coastalZone` IS THE EXPENSIVE ONE. The Coastal Development Permit is
      // `serial: true, addsMonths: 9`, and serial hurdles add IN FULL, so a
      // failed read does not shade the timeline — it removes nine months of it.
      // Measured 2026-08-12 at the analyze handler with only this layer faulted,
      // 1126 Abbot Kinney Blvd (C2-1-O-CA, live `coastalZone: true`): the permit
      // row vanished and the estimate went 57 mo → 48 mo, with nothing in the
      // response saying a check had been skipped. See `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        coastal: !inCoastalZone && readFailed(coastalR),
        historic: !hpoz?.NAME && readFailed(hpozR),
        flood: readFailed(floodR),
      }),
    },
    existing: useDesc ? { landUse: useDesc } : undefined,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HPOZ, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'la', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
