// Chicago provider — city zoning (ZONE_CLASS) + Cook County parcel geometry
// (lot area) + Mapbox reverse-geocoded address. Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt, reverseGeocode } from '../geo'

const ZONING =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/15'
const PARCELS =
  'https://gis.cookcountyil.gov/traditional/rest/services/parcelHistorical/MapServer/2025'

// Chicago zoning class prefix → use vocabulary.
function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const c = zone.trim().toUpperCase()[0]
  if (c === 'R') return ['residential', 'institutional']
  if (c === 'B' || c === 'C') return ['commercial', 'mixed', 'residential']
  if (c === 'D') return ['commercial', 'mixed', 'residential', 'institutional']
  if (c === 'M') return ['commercial', 'institutional']
  return null // PD (planned development), POS (open space), etc. — indeterminate.
}

export async function getChicagoParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [zoningR, parcelR, floodR, addrR] = await Promise.allSettled([
    fetchFeatures(ZONING, lat, lng, ['ZONE_CLASS'], false, undefined, 9000),
    fetchFeatures(PARCELS, lat, lng, ['PIN10'], true),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    reverseGeocode(lat, lng),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'chicago', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const pf = firstFeature(parcelR.value)
  if (!pf) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const address = addrR.status === 'fulfilled' && addrR.value ? addrR.value : 'Selected location'
  const zone = zoning?.ZONE_CLASS ? String(zoning.ZONE_CLASS) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(pf.attributes.PIN10 ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: null,
      maxFAR: null, // Chicago FAR is district-specific and not in the open zoning layer.
      allowedUses: usesForZone(zone),
    },
    lot: {
      sizeSqFt: polygonAreaSqFt(pf.geometry?.rings, 1), // Cook County SR is US feet.
      lotType: null,
    },
    overlays: {
      historicDistrict: null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'chicago', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
