import { describe, it, expect, vi, afterEach } from 'vitest'
import { handler } from '../parcel-shape'
import { invokeHandler, invokeWithQuery } from './testing/invokeHandler'
import { mockArcgisFetch, featureSetWithGeometry, ARCGIS_ERROR_200 } from './providers/__fixtures__'

// The handler reuses fetchParcelSnap against each city's PARCELS endpoint. We
// mock that fetch by URL substring. Boston's parcel layer is Parcels_24_detailed.
const BOSTON_PARCELS = 'Parcels_24_detailed'

// A square parcel ring (lng,lat) near Boston City Hall, returned in 4326.
const RING: number[][][] = [
  [
    [-71.0705, 42.354],
    [-71.0703, 42.354],
    [-71.0703, 42.3542],
    [-71.0705, 42.3542],
    [-71.0705, 42.354],
  ],
]

afterEach(() => vi.restoreAllMocks())

describe('parcel-shape handler', () => {
  it('returns a GeoJSON Polygon Feature with parcelId on the happy path', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        [BOSTON_PARCELS]: featureSetWithGeometry({ attributes: { pid: '0302604000' }, rings: RING }),
      }),
    )
    const res = await invokeWithQuery(handler, { city: 'boston', lat: '42.3541', lng: '-71.0704' })
    expect(res.statusCode).toBe(200)
    expect(res.headers?.['Cache-Control']).toContain('s-maxage=86400')
    const body = JSON.parse(res.body)
    expect(body.type).toBe('Feature')
    expect(body.geometry.type).toBe('Polygon')
    expect(body.geometry.coordinates).toEqual(RING)
    expect(body.properties.parcelId).toBe('0302604000')
  })

  it('returns 404 when no parcel is found (exact + buffered both empty)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ [BOSTON_PARCELS]: { features: [] } }),
    )
    const res = await invokeWithQuery(handler, { city: 'boston', lat: '42.3541', lng: '-71.0704' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for a city with no parcel-shape config (e.g. minneapolis)', async () => {
    const res = await invokeWithQuery(handler, { city: 'minneapolis', lat: '44.9778', lng: '-93.2650' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 502 when the upstream errors (200-with-error-JSON)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ [BOSTON_PARCELS]: ARCGIS_ERROR_200 }),
    )
    const res = await invokeWithQuery(handler, { city: 'boston', lat: '42.3541', lng: '-71.0704' })
    expect(res.statusCode).toBe(502)
  })

  it('returns 400 when lat/lng are missing or non-numeric', async () => {
    const res = await invokeWithQuery(handler, { city: 'boston' })
    expect(res.statusCode).toBe(400)
  })

  it('rate-limits after the per-minute cap with a 429 + RATE_LIMITED-shaped body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        [BOSTON_PARCELS]: featureSetWithGeometry({ attributes: { pid: 'x' }, rings: RING }),
      }),
    )
    // Same IP, distinct namespace 'parcel-shape', cap 60/min. Drive past it.
    const headers = { 'x-nf-client-connection-ip': '203.0.113.42' }
    // Built inline on every call rather than hoisted to a `const`: TypeScript
    // only excess-property-checks a FRESH object literal, so a hoisted event
    // would let `queryStringParamters` through against `Partial<HandlerEvent>`.
    const call = () =>
      invokeHandler(handler, {
        queryStringParameters: { city: 'boston', lat: '42.3541', lng: '-71.0704' },
        headers,
      })
    let last = await call()
    for (let i = 1; i < 62; i++) last = await call()
    expect(last.statusCode).toBe(429)
    const body = JSON.parse(last.body)
    expect(typeof body.message).toBe('string')
  })
})
