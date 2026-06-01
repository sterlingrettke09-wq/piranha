// Los Angeles provider — LA County Assessor parcels + City of LA NavigateLA
// generalized zoning + Historic Preservation Overlay Zone (HPOZ). Verified live
// 2026-06-01. All accept inSR=4326. Parcel lot area is taken from the polygon
// geometry returned in State Plane feet (EPSG:2229), since the layer has no
// plain lot-area attribute.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt } from '../geo'

const PARCELS =
  'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0'
const ZONING = 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/71'
const HPOZ = 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/75'

// In LA, FAR + height are set by the Height District — the token after the base
// zone in ZONE_CMPLT (e.g. "C2-1" → district 1; "[Q]R4-2" → 2; "R1-1XL" → 1XL).
// FAR: HD1 3:1 (1.5:1 in commercial/industrial), HD2 6:1, HD3 10:1, HD4 13:1;
// L/VL/XL/SS suffixes cap height. Source: LAMC §12.21.1-A.1.
const LA_HD: Record<string, { f: number; h: number | null }> = {
  '1': { f: 3.0, h: null }, '1L': { f: 3.0, h: 75 }, '1VL': { f: 3.0, h: 45 },
  '1XL': { f: 3.0, h: 30 }, '1SS': { f: 3.0, h: null },
  '2': { f: 6.0, h: null }, '3': { f: 10.0, h: null }, '4': { f: 13.0, h: null },
}
function laLimits(zoneCmplt: string | null): { h: number | null; f: number | null } {
  if (!zoneCmplt) return { h: null, f: null }
  // Strip [Q]/[T]/(Q)/(T) prefixes, then split base-zone / height-district.
  const z = zoneCmplt.replace(/^[[(]?[QT][\])]?-?/i, '').trim()
  const parts = z.split('-')
  const base = (parts[0] ?? '').toUpperCase()
  const tok = (parts[1] ?? '').toUpperCase()
  if (!/^(1L|1VL|1XL|1SS|1|2|3|4)$/.test(tok)) return { h: null, f: null }
  const hd = LA_HD[tok]
  // Low-density R zones (RA/RE/RS/R1) take FAR/height from the base zone, not the
  // height district, so we don't assert FAR there — but the height cap still holds.
  const baseControlled = /^(RA|RE|RS|R1|RD|RW|R2)/.test(base) && !base.startsWith('RAS')
  let far: number | null = baseControlled ? null : hd.f
  // Commercial/industrial in Height District 1 is 1.5:1, not 3:1.
  if (far === 3.0 && /^(C|M|CM|CR|CW|MR|LAX)/.test(base)) far = 1.5
  return { h: hd.h, f: far }
}

// LA zoning code (ZONE_CMPLT, e.g. "R1-1", "C2-1", "[Q]R3-1", "RE9-1-HPOZ") →
// use vocabulary, keyed on the base class letter.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  // Strip leading [Q]/[T] qualifiers and read the base class.
  const z = code.replace(/^\[[QT]\]/i, '').trim().toUpperCase()
  if (z.startsWith('R') || z.startsWith('RD') || z.startsWith('RAS')) return ['residential', 'mixed']
  if (z.startsWith('C') || z.startsWith('HB') || z.startsWith('LAS')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('M') || z.startsWith('MR')) return ['commercial', 'institutional']
  if (z.startsWith('P') || z.startsWith('PF') || z.startsWith('OS') || z.startsWith('A')) return ['institutional']
  return null
}

export async function getLaParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [parcelR, zoningR, hpozR, floodR] = await Promise.allSettled([
    fetchFeatures(PARCELS, lat, lng, ['SitusFullAddress', 'APN', 'UseType', 'UseDescription'], true, 2229),
    fetchFeatures(ZONING, lat, lng, ['ZONE_CMPLT', 'ZONE_CLASS', 'ZONING_DESCRIPTION']),
    fetchFeatures(HPOZ, lat, lng, ['NAME']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'la', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const feature = firstFeature(parcelR.value)
  const parcel = feature?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hpoz = hpozR.status === 'fulfilled' ? firstAttrs(hpozR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

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
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: lotSqFt,
      lotType: null,
    },
    overlays: {
      historicDistrict: hpoz?.NAME ? `${String(hpoz.NAME)} HPOZ` : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    existing: useDesc ? { landUse: useDesc } : undefined,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HPOZ, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'la', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
