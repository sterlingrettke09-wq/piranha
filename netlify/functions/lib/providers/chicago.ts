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
const HISTORIC =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/6' // Historic Districts (NAME).

// Cook County assessor class → existing use (1xx vacant, 2xx residential,
// 3xx apartments, 4xx institutional, 5xx+ commercial/industrial).
function chicagoExistingUse(cls: unknown): string | null {
  const c = String(cls ?? '').trim()
  if (!c) return null
  switch (c[0]) {
    case '1':
      return 'Vacant land'
    case '2':
      return 'Residential building'
    case '3':
      return 'Apartment building'
    case '4':
      return 'Institutional building'
    case '5':
    case '6':
    case '7':
    case '8':
      return 'Commercial / industrial building'
    default:
      return null
  }
}

// Chicago base FAR by residential district class (Chicago Zoning Ordinance,
// Title 17 — published base floor-area ratios). Commercial/downtown/manufacturing
// FARs vary by suffix and aren't reliably derivable from the class alone, so we
// leave those null (honestly "not in public data") rather than guess.
const CHICAGO_BASE_FAR: Record<string, number> = {
  'RS-1': 0.5,
  'RS-2': 0.65,
  'RS-3': 0.9,
  'RT-3.5': 1.05,
  'RT-4': 1.2,
  'RT-4A': 1.2,
  'RM-4.5': 1.7,
  'RM-5': 2.0,
  'RM-5.5': 2.5,
  'RM-6': 4.4,
  'RM-6.5': 6.6,
}
function chicagoBaseFAR(zone: string | null): number | null {
  if (!zone) return null
  return CHICAGO_BASE_FAR[zone.trim().toUpperCase()] ?? null
}

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
  const [zoningR, parcelR, floodR, addrR, histR] = await Promise.allSettled([
    fetchFeatures(ZONING, lat, lng, ['ZONE_CLASS'], false, undefined, 9000),
    fetchFeatures(PARCELS, lat, lng, ['PIN10', 'AssessorBLDGclass'], true),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    reverseGeocode(lat, lng),
    fetchFeatures(HISTORIC, lat, lng, ['NAME'], false, undefined, 9000),
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
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(pf.attributes.PIN10 ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: null,
      maxFAR: chicagoBaseFAR(zone), // residential base FAR; null for B/C/D/M (varies by suffix)
      allowedUses: usesForZone(zone),
    },
    lot: {
      sizeSqFt: polygonAreaSqFt(pf.geometry?.rings, 1), // Cook County SR is US feet.
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    existing: { landUse: chicagoExistingUse(pf.attributes.AssessorBLDGclass) },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'chicago', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
