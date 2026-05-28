import { isInBostonBbox, type ParcelError, type ParcelInfo } from '../../../src/types/parcel'
import { ENDPOINTS, FIELDS } from '../_endpoints'

export type ParcelResult =
  | { ok: true; info: ParcelInfo }
  | { ok: false; code: ParcelError['code']; message: string; status: number }

const buildQuery = (url: string, lat: number, lng: number, fields: readonly string[]) => {
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', '4326')
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('outFields', fields.join(','))
  u.searchParams.set('returnGeometry', 'false')
  u.searchParams.set('f', 'json')
  return u.toString()
}

type FeatureSet = { features?: Array<{ attributes: Record<string, unknown> }> }

const fetchFeatures = async (url: string, lat: number, lng: number, fields: readonly string[]): Promise<FeatureSet> => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(buildQuery(url, lat, lng, fields), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Upstream ${url} returned ${res.status}`)
    return await res.json() as FeatureSet
  } finally {
    clearTimeout(timer)
  }
}

const firstAttrs = (fs: FeatureSet) => fs.features?.[0]?.attributes ?? null

export async function getParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return { ok: false, code: 'OUT_OF_BBOX', message: 'lat/lng missing, invalid, or outside Boston bbox.', status: 400 }
  }

  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchFeatures(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchFeatures(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const historic = historicR.status === 'fulfilled' ? firstAttrs(historicR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const info: ParcelInfo = {
    address: String(parcel.full_addre ?? 'Unknown address'),
    parcelId: String(parcel.pid ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: String(zoning?.Name ?? 'Unknown'),
      subdistrict: zoning?.District ? String(zoning.District) : null,
      article: zoning?.Article ? String(zoning.Article) : null,
      maxHeightFt: null,
      maxFAR: null,
      allowedUses: null,
    },
    lot: {
      sizeSqFt: typeof parcel.lot_size === 'number' ? parcel.lot_size : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: historic?.HIST_NAME ? String(historic.HIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: ENDPOINTS,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
