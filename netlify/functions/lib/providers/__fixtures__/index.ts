// Test-only ArcGIS fixture harness (WO-0.2). Lets provider tests mock the
// upstream feature services with realistic canned payloads, routed by URL
// substring — the same pattern lib/parcel.test.ts uses inline, centralized.
//
// Usage in a test:
//   vi.spyOn(globalThis, 'fetch').mockImplementation(
//     mockArcgisFetch({
//       Zoning: { features: [{ attributes: { Name: 'B-2-65' } }] },
//       Parcels_24_detailed: bostonParcelFixture,
//       NFHL: ARCGIS_ERROR_200, // simulate a 200-with-error-JSON body
//       Historic: () => { throw new Error('historic down') }, // network reject
//     }),
//   )
//
// Route values:
//   - object       → returned as JSON with HTTP 200
//   - function     → called per request; may return an object, a Response, or throw
//   - a Response   → returned as-is (set custom status codes)
// Unmatched URLs throw, so a provider quietly calling an unexpected endpoint
// fails the test instead of silently passing.

/** One feature as an ArcGIS REST query returns it. `attributes` stays an open
 *  record ON PURPOSE: the field names are the upstream city service's, they
 *  differ per city, and no type in this repo enumerates them — inventing one
 *  would assert a schema nobody measured. That openness is a real hole in the
 *  guard (a mock can misspell TAXKEY and nothing objects), and it is the one
 *  place only a live field query can close. */
export interface ArcgisFeature {
  attributes: Record<string, unknown>
  /** ArcGIS geometry is a SPEC, not a per-city schema, so unlike `attributes`
   *  it can be named: rings (polygon), paths (polyline), x/y (point). */
  geometry?: {
    rings?: number[][][]
    paths?: number[][][]
    x?: number
    y?: number
    spatialReference?: Record<string, unknown>
  }
}

/** A successful ArcGIS query body. */
export interface ArcgisFeatureSet {
  features: ArcgisFeature[]
  /** Echoed by some services; every provider here ignores them. */
  fields?: Array<Record<string, unknown>>
  geometryType?: string
  spatialReference?: Record<string, unknown>
  exceededTransferLimit?: boolean
}

/** A 200-with-error-JSON body. See ARCGIS_ERROR_200. */
export interface ArcgisErrorBody {
  error: { code: number; message: string; details?: readonly string[] }
}

/** Mapbox reverse-geocode bodies travel through this same router (providers
 *  route 'api.mapbox.com' here), and Mapbox speaks GeoJSON: `properties`, not
 *  ArcGIS's `attributes`. Both are listed explicitly rather than papered over
 *  with `object` — a feature carrying NEITHER key is then still a type error. */
export interface GeoJsonFeatureCollection {
  type?: string
  features: Array<{
    type?: string
    properties: Record<string, unknown>
    geometry?: Record<string, unknown>
  }>
  attribution?: string
}

/** What a route may return as a JSON payload.
 *
 *  This was `object`, which accepts anything with a shape — so `{ featurez: [] }`
 *  compiled, and every route payload in every provider test was unchecked at the
 *  top level. Narrowing it is what makes a mistyped envelope key a compile
 *  error rather than a mysterious 404 in one test. */
/** A service's own metadata envelope — the `?f=json` on a MapServer root, not a
 *  /query. Added because Cook County's parcel LAYER LIST is now read at request
 *  time to resolve the tax-year layer, so it is a route a provider really hits.
 *  Kept as its own member rather than widening RoutePayload to `unknown`: the
 *  point of this union is that a mistyped envelope is a compile error. */
export interface ArcgisServiceMeta {
  layers: Array<{ id: number; name: string }>
}

export type RoutePayload =
  | ArcgisFeatureSet
  | ArcgisErrorBody
  | GeoJsonFeatureCollection
  | ArcgisServiceMeta

export type RouteValue =
  | RoutePayload
  | Response
  | ((url: string) => RoutePayload | Response | Promise<RoutePayload | Response>)

/**
 * The body ArcGIS REST services return with HTTP 200 when a query is
 * malformed, a field was renamed, or the service throttles. Providers must
 * treat this as an upstream failure (502), never as "no parcel here" (404).
 */
export const ARCGIS_ERROR_200 = {
  error: { code: 400, message: 'Unable to complete operation.', details: ['Unable to perform query operation.'] },
} as const

export function mockArcgisFetch(routes: Record<string, RouteValue>) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    for (const [substr, value] of Object.entries(routes)) {
      if (!url.includes(substr)) continue
      const resolved = typeof value === 'function' ? await value(url) : value
      if (resolved instanceof Response) return resolved
      return new Response(JSON.stringify(resolved), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error('mockArcgisFetch: unrouted URL: ' + url)
  }
}

/** Build a minimal FeatureSet from attribute records. */
export function featureSet(...attrs: Array<Record<string, unknown>>) {
  return { features: attrs.map((attributes) => ({ attributes })) }
}

/** A FeatureSet with geometry rings, for snap-path tests. */
export function featureSetWithGeometry(
  ...feats: Array<{ attributes: Record<string, unknown>; rings: number[][][] }>
) {
  return {
    features: feats.map((f) => ({ attributes: f.attributes, geometry: { rings: f.rings } })),
  }
}
