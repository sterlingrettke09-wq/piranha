import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchParcelSnap, fetchFeaturesXYSnap } from './arcgis'

afterEach(() => vi.restoreAllMocks())

// A click that lands inside a parcel returns on the exact-point query; a click
// that lands on a street/boundary returns nothing exact, so the helper must
// retry with a distance buffer to snap to the nearest parcel.
describe('fetchParcelSnap', () => {
  it('returns the exact hit without a buffered retry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ features: [{ attributes: { PID: '1' } }] })),
    )
    const fs = await fetchParcelSnap('https://x/MapServer/0', 42, -71, ['PID'])
    expect(fs.features).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // no retry needed
  })

  it('retries with a distance buffer when the exact point misses', async () => {
    let call = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      return new Response(JSON.stringify({ features: call === 1 ? [] : [{ attributes: { PID: '9' } }] }))
    })
    const fs = await fetchParcelSnap('https://x/MapServer/0', 42, -71, ['PID'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fs.features?.[0]?.attributes.PID).toBe('9')
    // the second request carries the buffer params
    expect(String(fetchSpy.mock.calls[1][0])).toContain('distance=30')
    expect(String(fetchSpy.mock.calls[1][0])).toContain('esriSRUnit_Meter')
  })
})

// Same snap behavior, but for projected-SR servers (Hennepin County / EPSG:26915)
// that won't reproject 4326 — the geometry stays in the projected coordinates.
describe('fetchFeaturesXYSnap', () => {
  it('returns the exact hit without a buffered retry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ features: [{ attributes: { PID: '1' } }] })),
    )
    const fs = await fetchFeaturesXYSnap('https://x/MapServer/1', 480000, 4980000, 26915, ['PID'])
    expect(fs.features).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('snaps to the nearest parcel when the exact point misses', async () => {
    let call = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      return new Response(JSON.stringify({ features: call === 1 ? [] : [{ attributes: { PID: '9' } }] }))
    })
    const fs = await fetchFeaturesXYSnap('https://x/MapServer/1', 480000, 4980000, 26915, ['PID'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fs.features?.[0]?.attributes.PID).toBe('9')
    // the buffered retry keeps the projected SR (26915), not 4326
    const retryUrl = String(fetchSpy.mock.calls[1][0])
    expect(retryUrl).toContain('distance=30')
    expect(retryUrl).toContain('26915')
  })
})

// Regression guard: a buffered query can match several parcels in arbitrary
// server order. The helper must deterministically return the one nearest the
// click, not features[0].
describe('snap picks the nearest parcel (deterministic), not an arbitrary one', () => {
  it('fetchParcelSnap returns the nearest by centroid', async () => {
    let call = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      if (call === 1) return new Response(JSON.stringify({ features: [] }))
      return new Response(
        JSON.stringify({
          features: [
            { attributes: { PID: 'far' }, geometry: { rings: [[[-71.1, 42.4], [-71.1, 42.41], [-71.11, 42.4], [-71.1, 42.4]]] } },
            { attributes: { PID: 'near' }, geometry: { rings: [[[-71.06, 42.36], [-71.06, 42.361], [-71.061, 42.36], [-71.06, 42.36]]] } },
          ],
        }),
      )
    })
    const fs = await fetchParcelSnap('https://x/MapServer/0', 42.36, -71.06, ['PID'])
    expect(fs.features?.[0]?.attributes.PID).toBe('near')
  })

  it('fetchFeaturesXYSnap returns the nearest in projected coordinates', async () => {
    let call = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      if (call === 1) return new Response(JSON.stringify({ features: [] }))
      return new Response(
        JSON.stringify({
          features: [
            { attributes: { PID: 'far' }, geometry: { rings: [[[490000, 4990000], [490010, 4990000], [490000, 4990010], [490000, 4990000]]] } },
            { attributes: { PID: 'near' }, geometry: { rings: [[[480000, 4980000], [480010, 4980000], [480000, 4980010], [480000, 4980000]]] } },
          ],
        }),
      )
    })
    const fs = await fetchFeaturesXYSnap('https://x/MapServer/1', 480005, 4980005, 26915, ['PID'])
    expect(fs.features?.[0]?.attributes.PID).toBe('near')
  })
})
