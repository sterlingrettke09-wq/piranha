// Austin provider — Travis Central Appraisal District (TCAD) public parcels +
// City of Austin Current Zoning. Verified live 2026-06-01. Both layers accept
// inSR=4326 point queries (servers reproject). No point-in-polygon historic
// district layer is published, so historic is left null.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, type ParcelResult } from '../arcgis'

const PARCELS =
  'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0'
const ZONING =
  'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0'

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
  const [parcelR, zoningR, floodR] = await Promise.allSettled([
    fetchFeatures(PARCELS, lat, lng, ['situs_address', 'tcad_acres', 'geo_id']),
    fetchFeatures(ZONING, lat, lng, ['BASE_ZONE', 'ZONE_NAME', 'ZONING_ZTYPE']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'austin', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // situs_address has a trailing zip; strip a 5-digit zip if present.
  const rawAddr = parcel.situs_address ? String(parcel.situs_address).replace(/\s+/g, ' ').trim() : ''
  const address = rawAddr.replace(/\s+\d{5}(-\d{4})?$/, '').trim() || 'Selected location'
  const acres = Number(parcel.tcad_acres)
  const base = parcel != null && zoning?.BASE_ZONE ? String(zoning.BASE_ZONE) : null
  const lim = austinLimits(base)

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.geo_id ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: base ?? 'Unknown',
      subdistrict: zoning?.ZONING_ZTYPE ? String(zoning.ZONING_ZTYPE) : null,
      article: zoning?.ZONE_NAME ? String(zoning.ZONE_NAME) : null,
      maxHeightFt: lim.h,
      maxFAR: lim.f,
      allowedUses: usesForZone(base),
    },
    lot: {
      sizeSqFt: Number.isFinite(acres) && acres > 0 ? Math.round(acres * 43560) : null,
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
