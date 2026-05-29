import {
  isInBbox,
  BOSTON_BBOX,
  NYC_BBOX,
  type Bbox,
  type ParcelInfo,
} from '../../../src/types/parcel'
import { ENDPOINTS, FIELDS } from '../_endpoints'
import { mapZoningUse } from './zoningUse'
import { fetchFeatures, firstAttrs, type ParcelResult } from './arcgis'
import { getNycParcelInfo } from './providers/nyc'

export type { ParcelResult }

// ---- Boston provider (BPDA zoning + assessing parcels + historic + FEMA flood) ----
async function getBostonParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchFeatures(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchFeatures(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'boston', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const historic = historicR.status === 'fulfilled' ? firstAttrs(historicR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const stNum = parcel.ST_NUM != null ? String(parcel.ST_NUM).trim() : ''
  const stName = parcel.ST_NAME != null ? String(parcel.ST_NAME).trim() : ''
  const address = [stNum, stName].filter(Boolean).join(' ') || 'Unknown address'
  const landSf = Number(parcel.LAND_SF)

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.PID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: String(zoning?.Name ?? 'Unknown'),
      subdistrict: zoning?.District ? String(zoning.District) : null,
      article: zoning?.Article ? String(zoning.Article) : null,
      maxHeightFt: typeof zoning?.HeightMax === 'number' ? zoning.HeightMax : null,
      maxFAR: typeof zoning?.FARMax === 'number' ? zoning.FARMax : null,
      allowedUses: mapZoningUse(typeof zoning?.Use_ === 'string' ? zoning.Use_ : null),
    },
    lot: {
      sizeSqFt: Number.isFinite(landSf) && landSf > 0 ? landSf : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: historic?.HIST_NAME ? String(historic.HIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: ENDPOINTS,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'boston', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

// ---- City registry + dispatcher ----
type Provider = (lat: number, lng: number) => Promise<ParcelResult>
interface CityConfig {
  bbox: Bbox
  label: string
  provider: Provider
}

const CITIES: Record<string, CityConfig> = {
  boston: { bbox: BOSTON_BBOX, label: 'Boston', provider: getBostonParcelInfo },
  nyc: { bbox: NYC_BBOX, label: 'New York City', provider: getNycParcelInfo },
}

export const LIVE_CITIES = Object.keys(CITIES)

export async function getParcelInfo(city: string, lat: number, lng: number): Promise<ParcelResult> {
  const cfg = CITIES[city] ?? CITIES.boston
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBbox(cfg.bbox, lat, lng)) {
    return {
      ok: false,
      code: 'OUT_OF_BBOX',
      message: `lat/lng missing, invalid, or outside ${cfg.label}.`,
      status: 400,
    }
  }
  return cfg.provider(lat, lng)
}
