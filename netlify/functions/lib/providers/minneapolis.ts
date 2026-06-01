// Minneapolis provider — Hennepin County parcels (LAND_PROPERTY) + City of
// Minneapolis Primary Zoning + HPC historic districts. Verified live
// 2026-06-01.
//
// GOTCHA: the Hennepin County server does NOT reproject inSR=4326 — it silently
// returns no features for a WGS84 point. We must hand it geometry already in
// UTM zone 15N (EPSG:26915). Zoning + historic are ArcGIS Online layers and
// reproject 4326 normally.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchFeaturesXY, firstAttrs, type ParcelResult } from '../arcgis'
import { lngLatToUtm15 } from '../geo'

const PARCELS = 'https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1'
const ZONING =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Primary_Zoning/FeatureServer/0'
const HISTORIC =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/HPC_Districts/FeatureServer/0'

// Minneapolis 2024 zoning code (Land_Use_Code) → use vocabulary.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.startsWith('UN')) return ['residential']
  if (z.startsWith('RM')) return ['residential', 'mixed', 'institutional']
  if (z.startsWith('CM') || z.startsWith('DT')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('PR')) return ['commercial', 'institutional']
  if (z.startsWith('TR')) return ['institutional']
  return null
}

export async function getMinneapolisParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const { x, y } = lngLatToUtm15(lng, lat)
  const [parcelR, zoningR, histR, floodR] = await Promise.allSettled([
    fetchFeaturesXY(PARCELS, x, y, 26915, ['HOUSE_NO', 'STREET_NM', 'MUNIC_NM', 'ZIP_CD', 'PARCEL_AREA', 'PID']),
    fetchFeatures(ZONING, lat, lng, ['Land_Use_Code', 'Land_Use']),
    fetchFeatures(HISTORIC, lat, lng, ['DISTRICT']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'minneapolis', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const houseNo = parcel.HOUSE_NO != null ? String(parcel.HOUSE_NO).trim() : ''
  const streetNm = parcel.STREET_NM != null ? String(parcel.STREET_NM).replace(/\s+/g, ' ').trim() : ''
  const address = [houseNo, streetNm].filter(Boolean).join(' ') || 'Selected location'
  const area = Number(parcel.PARCEL_AREA)
  const code = zoning?.Land_Use_Code ? String(zoning.Land_Use_Code) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.PID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: zoning?.Land_Use ? String(zoning.Land_Use) : null,
      maxHeightFt: null,
      maxFAR: null,
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(area) && area > 0 ? Math.round(area) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DISTRICT ? String(hist.DISTRICT) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'minneapolis', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
