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

export type RouteValue =
  | object
  | Response
  | ((url: string) => object | Response | Promise<object | Response>)

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
