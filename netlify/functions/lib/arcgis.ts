// Shared helpers for querying ArcGIS REST Feature Services by point.
// Used by the per-city parcel providers.
import type { ParcelError, ParcelInfo } from '../../../src/types/parcel'

export type ParcelResult =
  | { ok: true; info: ParcelInfo }
  | { ok: false; code: ParcelError['code']; message: string; status: number }

export type FeatureSet = { features?: Array<{ attributes: Record<string, unknown> }> }

// ArcGIS REST services report failures (malformed query, renamed field,
// re-indexed layer, throttling) as HTTP **200** with `{"error":{...}}` in the
// body. Without this check, an error body has no `.features`, reads as "no
// parcel found" (404), and a citywide upstream breakage becomes invisible —
// indistinguishable from clicking open water, with nothing in the logs.
function assertNotArcgisError(data: unknown, url: string): void {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: { code?: number; message?: string } }).error
    throw new Error(
      `arcgis_error ${url}: ${JSON.stringify({ code: err?.code, message: err?.message }).slice(0, 300)}`,
    )
  }
}

/** Parse an ArcGIS JSON response, rejecting 200-with-error-JSON bodies. */
async function parseFeatureSet(res: Response, url: string): Promise<FeatureSet> {
  const data: unknown = await res.json()
  assertNotArcgisError(data, url)
  return data as FeatureSet
}

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
    return await parseFeatureSet(res, url)
  } finally {
    clearTimeout(timer)
  }
}

// Snap helpers (the REQUIRED parcel/zoning fetches) get a shared time budget
// and one retry. Rationale: Netlify kills functions at 10s; the old behavior
// let exact (6s) + buffered (6s) run sequentially = 12s worst case (Chicago's
// 9s overrides: 18s) — an opaque platform kill instead of a clean
// UPSTREAM_ERROR. Budget: exact ≤4s with one retry on transient failure,
// buffered gets whatever remains. Optional overlay fetches (plain
// fetchFeatures) keep zero retries — they already degrade gracefully.
const SNAP_BUDGET_MS = 8000
const ATTEMPT_CAP_MS = 4000
const RETRY_DELAY_MS = 250
const MIN_USEFUL_MS = 500

async function attemptWithRetry<T>(
  fn: (timeoutMs: number) => Promise<T>,
  deadline: number,
): Promise<T> {
  const remaining = () => deadline - Date.now()
  try {
    return await fn(Math.min(ATTEMPT_CAP_MS, Math.max(MIN_USEFUL_MS, remaining())))
  } catch (err) {
    // One retry on any failure (network reset, 5xx, error-JSON) if there's
    // still enough budget for the delay plus a useful attempt.
    if (remaining() < RETRY_DELAY_MS + MIN_USEFUL_MS) throw err
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    return await fn(Math.min(ATTEMPT_CAP_MS, Math.max(MIN_USEFUL_MS, remaining())))
  }
}

type GeomFeature = { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }

function ringCentroid(rings?: number[][][]): [number, number] | null {
  const r = rings?.[0]
  if (!r || r.length === 0) return null
  let sx = 0
  let sy = 0
  for (const pt of r) {
    sx += pt[0]
    sy += pt[1]
  }
  return [sx / r.length, sy / r.length]
}

// A buffered ("snap") query can return several parcels, and the ArcGIS server
// does NOT guarantee their order — so blindly taking features[0] makes the same
// click flap between adjacent parcels run-to-run. Pick the parcel whose polygon
// centroid is nearest the click point instead. Requires geometry on the
// features (px,py must be in the same SR the geometry was returned in).
function nearestFeatureSet(fs: FeatureSet, px: number, py: number): FeatureSet {
  const feats = (fs.features ?? []) as GeomFeature[]
  if (feats.length <= 1) return fs
  let best = feats[0]
  let bestD = Infinity
  for (const f of feats) {
    const c = ringCentroid(f.geometry?.rings)
    if (!c) continue
    const d = (c[0] - px) ** 2 + (c[1] - py) ** 2
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return { features: [best] }
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
    return await parseFeatureSet(res, url)
  } finally {
    clearTimeout(timer)
  }
}

// Snapping variant of fetchFeaturesXY, for servers that need a projected input
// SR (e.g. Hennepin County / EPSG:26915, which won't reproject 4326). Same
// snap-to-nearest behavior as fetchParcelSnap: exact point first, then a small
// buffered retry so a click on a street or boundary still finds the parcel.
export const fetchFeaturesXYSnap = async (
  url: string,
  x: number,
  y: number,
  inSR: number,
  fields: readonly string[],
  distanceMeters = 30,
  budgetMs = SNAP_BUDGET_MS,
): Promise<FeatureSet> => {
  const deadline = Date.now() + budgetMs
  const exact = await attemptWithRetry((t) => fetchFeaturesXY(url, x, y, inSR, fields, t), deadline)
  if (exact.features && exact.features.length > 0) return exact
  const bufferedMs = deadline - Date.now()
  if (bufferedMs < MIN_USEFUL_MS) return exact
  const timeoutMs = Math.min(ATTEMPT_CAP_MS, bufferedMs)
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x, y, spatialReference: { wkid: inSR } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', String(inSR))
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('distance', String(distanceMeters))
  u.searchParams.set('units', 'esriSRUnit_Meter')
  u.searchParams.set('outFields', fields.join(','))
  // Request geometry (in the same projected SR as the click) so we can pick the
  // nearest parcel deterministically rather than an arbitrary one.
  u.searchParams.set('returnGeometry', 'true')
  u.searchParams.set('outSR', String(inSR))
  u.searchParams.set('f', 'json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal })
    if (!res.ok) return exact
    // An error-JSON body here throws and falls back to the (valid, empty)
    // exact result — if the service were truly down, the exact query would
    // already have thrown.
    return nearestFeatureSet(await parseFeatureSet(res, url), x, y)
  } catch {
    return exact
  } finally {
    clearTimeout(timer)
  }
}

// Parcel lookup that tolerates a click landing on a street, river, or plaza:
// try the exact point first, and if no polygon contains it, retry with a small
// buffer to snap to the nearest parcel. Without this, addresses like riverside
// Wacker Drive return "no parcel" even though the building is right there.
export const fetchParcelSnap = async (
  url: string,
  lat: number,
  lng: number,
  fields: readonly string[],
  returnGeometry = false,
  outSR?: number,
  distanceMeters = 30,
  budgetMs = SNAP_BUDGET_MS,
): Promise<FeatureSet> => {
  const deadline = Date.now() + budgetMs
  const exact = await attemptWithRetry(
    (t) => fetchFeatures(url, lat, lng, fields, returnGeometry, outSR, t),
    deadline,
  )
  if (exact.features && exact.features.length > 0) return exact
  const bufferedMs = deadline - Date.now()
  if (bufferedMs < MIN_USEFUL_MS) return exact
  const timeoutMs = Math.min(ATTEMPT_CAP_MS, bufferedMs)
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', '4326')
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('distance', String(distanceMeters))
  u.searchParams.set('units', 'esriSRUnit_Meter')
  u.searchParams.set('outFields', fields.join(','))
  // When the caller doesn't need geometry, we still fetch it (in 4326) purely to
  // pick the nearest parcel deterministically — the buffered query can match
  // several and the server's ordering isn't stable. When the caller DOES want
  // geometry (e.g. SF's lot-area calc in its own SR), leave that path untouched.
  const selecting = !returnGeometry
  u.searchParams.set('returnGeometry', returnGeometry || selecting ? 'true' : 'false')
  if (outSR != null) u.searchParams.set('outSR', String(outSR))
  else if (selecting) u.searchParams.set('outSR', '4326')
  u.searchParams.set('f', 'json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal })
    if (!res.ok) return exact
    const data = await parseFeatureSet(res, url)
    return selecting ? nearestFeatureSet(data, lng, lat) : data
  } catch {
    return exact
  } finally {
    clearTimeout(timer)
  }
}

export const firstAttrs = (fs: FeatureSet) => fs.features?.[0]?.attributes ?? null
export const firstFeature = (fs: FeatureSet) => (fs.features?.[0] as RawFeature | undefined) ?? null
