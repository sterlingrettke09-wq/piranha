import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../parcel'

const callHandler = (qs: Record<string, string> = {}) =>
  handler({
    queryStringParameters: qs,
  } as unknown as Parameters<typeof handler>[0])

describe('parcel handler — input validation', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'B-2-65' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { PID: '0304567000', ST_NUM: '1', ST_NAME: 'City Hall Sq' } }]
        }))
      }
      if (u.includes('Historic')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      if (u.includes('NFHL')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { FLD_ZONE: 'X' } }]
        }))
      }
      throw new Error('Unexpected fetch URL: ' + u)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('rejects missing lat/lng with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({})
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.code).toBe('OUT_OF_BBOX')
  })

  it('rejects non-numeric lat with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({ lat: 'banana', lng: '-71.06' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })

  it('rejects out-of-bbox coords (DC) with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({ lat: '38.89', lng: '-77.03' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })

  it('accepts in-bbox coords (Boston City Hall) without 400', async () => {
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).not.toBe(400)
  })
})

describe('parcel handler — normalization', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      // Match each endpoint and return canned data.
      // Use ENDPOINTS constants in real code; literal substrings here.
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'B-2-65', District: 'Downtown', Article: 'Article 8' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { PID: '0304567000', ST_NUM: '1', ST_NAME: 'City Hall Sq', LAND_SF: 12450 } }]
        }))
      }
      if (u.includes('Historic')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      if (u.includes('NFHL')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { FLD_ZONE: 'X' } }]
        }))
      }
      throw new Error('Unexpected fetch URL: ' + u)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('joins all 4 datasets into ParcelInfo', async () => {
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.address).toBe('1 City Hall Sq')
    expect(body.parcelId).toBe('0304567000')
    expect(body.zoning.districtCode).toBe('B-2-65')
    expect(body.zoning.article).toBe('Article 8')
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBe('X')
    expect(body.lot.sizeSqFt).toBe(12450)
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)

    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('Zoning'))).toBe(true)
    expect(calls.some((u) => u.includes('Parcels_24_detailed'))).toBe(true)
    expect(calls.some((u) => u.includes('Historic'))).toBe(true)
    expect(calls.some((u) => u.includes('NFHL'))).toBe(true)
  })
})

describe('parcel handler — zoning dimensional limits', () => {
  afterEach(() => vi.restoreAllMocks())

  it('populates maxHeightFt/maxFAR/allowedUses from real zoning fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: '1', District: 'Stuart Street District', Article: 'Article 43', HeightMax: 155, FARMax: 10, Use_: 'Mixed-Use' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '1', ST_NUM: '1', ST_NAME: 'Stuart St', LAND_SF: 5000 } }] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3493', lng: '-71.0712' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.maxHeightFt).toBe(155)
    expect(body.zoning.maxFAR).toBe(10)
    expect(body.zoning.allowedUses).toEqual(['mixed', 'residential', 'commercial'])
  })

  it('leaves limits null when the zoning service omits them (e.g. Open Space)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'OS-UP', District: 'Open Space', HeightMax: null, FARMax: null, Use_: 'Open Space' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '2', ST_NUM: '0', ST_NAME: 'Cambridge St', LAND_SF: 1000 } }] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.maxHeightFt).toBeNull()
    expect(body.zoning.maxFAR).toBeNull()
    // Use_ "Open Space" still maps to a use list even when dimensions are null.
    expect(body.zoning.allowedUses).toEqual(['institutional'])
  })
})

describe('parcel handler — resilience', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns 200 with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({ features: [{ attributes: { Name: 'R-1' } }] }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '99', ST_NUM: '99', ST_NAME: 'Main' } }] }))
      }
      throw new Error('upstream offline')
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.districtCode).toBe('R-1')
    expect(body.address).toBe('99 Main')
    expect(body.parcelId).toBe('99')
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBeNull()
  })

  it('returns 502 when zoning upstream rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) throw new Error('zoning down')
      return new Response(JSON.stringify({ features: [{ attributes: { PID: '1', ST_NUM: '1', ST_NAME: 'x' } }] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
  })

  it('returns 404 when parcels dataset has no feature at point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({ features: [{ attributes: { Name: 'OS' } }] }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).code).toBe('NO_PARCEL')
  })
})
