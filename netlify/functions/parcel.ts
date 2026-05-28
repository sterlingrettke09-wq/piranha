import type { Handler, HandlerEvent } from '@netlify/functions'
import { isInBostonBbox, type ParcelError, type ParcelInfo } from '../../src/types/parcel'
import { ENDPOINTS, FIELDS } from './_endpoints'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

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

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return fail('OUT_OF_BBOX', 'lat/lng missing, invalid, or outside Boston bbox.', 400)
  }

  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchFeatures(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchFeatures(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  // Critical: zoning + parcels must succeed
  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return fail('UPSTREAM_ERROR', 'A required upstream dataset is unavailable. Try again shortly.', 502)
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)

  if (!parcel) {
    return fail('NO_PARCEL', 'No parcel found at this location.', 404)
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

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(info),
  }
}
