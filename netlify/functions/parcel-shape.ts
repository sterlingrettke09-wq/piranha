import type { Handler, HandlerEvent } from '@netlify/functions'
import { fetchParcelSnap, firstFeature } from './lib/arcgis'
import { clientIp, rateLimited } from './lib/guard'
import { quantizeCoord } from '../../src/lib/coords'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// Generous, like /api/parcel: rapid map clicking is legitimate. Distinct
// limiter namespace so the shape fetch doesn't steal /api/parcel's budget.
const RATE = { name: 'parcel-shape', windowMs: 60_000, max: 60 } as const

// Per-city PARCELS endpoint + its id field, copied verbatim from each provider
// (see netlify/functions/lib/providers/*.ts and _endpoints.ts). The selected-
// parcel highlight only needs the polygon + a parcel id; the full attribute
// fan-out lives in /api/parcel. Every endpoint here was probed 2026-06-10 and
// returns rings reprojected to outSR=4326 from a 4326 point query.
//
// Minneapolis is intentionally absent: its Hennepin County parcel server
// (gis.hennepin.us LAND_PROPERTY/1) does NOT reproject inSR=4326 — a WGS84
// point silently returns 0 features (verified 2026-06-10). It needs an
// EPSG:26915 (UTM 15N) point, which would require the lngLatToUtm15 path and a
// projected→4326 ring reprojection the simple highlight doesn't justify. The
// pin still marks the click; only the polygon outline is skipped there.
const PARCELS: Record<string, { url: string; idField: string }> = {
  boston: { url: 'https://gis.bostonplans.org/hosting/rest/services/Parcels_24_detailed/FeatureServer/112', idField: 'pid' },
  nyc: { url: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0', idField: 'BBL' },
  chicago: { url: 'https://gis.cookcountyil.gov/traditional/rest/services/parcelHistorical/MapServer/2025', idField: 'PIN10' },
  sf: { url: 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/23', idField: 'blklot' },
  seattle: { url: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Parcel_Boundary/FeatureServer/0', idField: 'PIN' },
  dc: { url: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land/MapServer/40', idField: 'SSL' },
  austin: { url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/EXTERNAL_tcad_parcel/FeatureServer/0', idField: 'PID_10' },
  la: { url: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0', idField: 'APN' },
  denver: { url: 'https://denvergov.org/maps/data/Zoning/MapServer/0', idField: 'OBJECTID' },
}

type GeoJSONGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

const fail = (status: number, message: string) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ message }),
})

// ArcGIS polygons are flat ring arrays with the exterior/hole distinction
// encoded by winding order (exterior clockwise, holes counter-clockwise). We
// keep it deliberately simple: the FIRST ring is the exterior; every later ring
// is treated as a hole of that exterior. This is correct for the common case
// (a single parcel with optional courtyard/interior holes) and only loses
// fidelity for the rare multi-part parcel (two disjoint polygons in one
// record), which a soft highlight fill doesn't need to render perfectly. If
// there are multiple clockwise (exterior) rings we still emit a single Polygon;
// the extra exterior reads as a hole — acceptable for a highlight outline.
function ringsToGeometry(rings: number[][][]): GeoJSONGeometry | null {
  if (!rings.length) return null
  return { type: 'Polygon', coordinates: rings }
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (rateLimited(clientIp(event.headers ?? {}), RATE)) {
    return fail(429, 'Too many requests — please wait a moment and try again.')
  }
  const city = event.queryStringParameters?.city ?? 'boston'
  const cfg = PARCELS[city]
  if (!cfg) return fail(404, 'No parcel shape available for this city.')

  // Quantize to match /api/parcel's cache key exactly, so the shape fetch and
  // the parcel fetch collapse onto the same coordinates (and the same CDN key).
  const lat = quantizeCoord(Number(event.queryStringParameters?.lat))
  const lng = quantizeCoord(Number(event.queryStringParameters?.lng))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(400, 'lat and lng are required.')
  }

  let feature
  try {
    const fs = await fetchParcelSnap(cfg.url, lat, lng, [cfg.idField], true, 4326)
    feature = firstFeature(fs)
  } catch {
    return fail(502, 'Could not load the parcel shape.')
  }
  const rings = feature?.geometry?.rings
  if (!feature || !rings || rings.length === 0) {
    return fail(404, 'No parcel at this location.')
  }
  const geometry = ringsToGeometry(rings)
  if (!geometry) return fail(404, 'No parcel at this location.')

  const parcelId = feature.attributes[cfg.idField]
  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify({
      type: 'Feature',
      geometry,
      properties: { parcelId: parcelId != null ? String(parcelId) : null },
    }),
  }
}
