// Shared helpers for querying ArcGIS REST Feature Services by point.
// Used by the per-city parcel providers.
import type { ParcelError, ParcelInfo } from '../../../src/types/parcel'

export type ParcelResult =
  | { ok: true; info: ParcelInfo }
  | { ok: false; code: ParcelError['code']; message: string; status: number }

export type FeatureSet = { features?: Array<{ attributes: Record<string, unknown> }> }

export const buildQuery = (
  url: string,
  lat: number,
  lng: number,
  fields: readonly string[],
  returnGeometry = false,
  outSR?: number,
) => {
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', '4326')
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('outFields', fields.join(','))
  u.searchParams.set('returnGeometry', returnGeometry ? 'true' : 'false')
  if (outSR != null) u.searchParams.set('outSR', String(outSR))
  u.searchParams.set('f', 'json')
  return u.toString()
}

type RawFeature = { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }

export const fetchFeatures = async (
  url: string,
  lat: number,
  lng: number,
  fields: readonly string[],
  returnGeometry = false,
  outSR?: number,
  timeoutMs = 6000,
): Promise<FeatureSet> => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(buildQuery(url, lat, lng, fields, returnGeometry, outSR), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Upstream ${url} returned ${res.status}`)
    return (await res.json()) as FeatureSet
  } finally {
    clearTimeout(timer)
  }
}

// Like fetchFeatures, but for servers that require the input geometry already
// in a projected SR (e.g. Hennepin County wants EPSG:26915, not 4326). Pass the
// projected x/y and its wkid.
export const fetchFeaturesXY = async (
  url: string,
  x: number,
  y: number,
  inSR: number,
  fields: readonly string[],
  timeoutMs = 6000,
): Promise<FeatureSet> => {
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x, y, spatialReference: { wkid: inSR } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', String(inSR))
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('outFields', fields.join(','))
  u.searchParams.set('returnGeometry', 'false')
  u.searchParams.set('f', 'json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Upstream ${url} returned ${res.status}`)
    return (await res.json()) as FeatureSet
  } finally {
    clearTimeout(timer)
  }
}

export const firstAttrs = (fs: FeatureSet) => fs.features?.[0]?.attributes ?? null
export const firstFeature = (fs: FeatureSet) => (fs.features?.[0] as RawFeature | undefined) ?? null
