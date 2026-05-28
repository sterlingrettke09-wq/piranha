import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../analyze'

const call = (qs: Record<string, string> = {}) =>
  handler({ queryStringParameters: qs } as unknown as Parameters<typeof handler>[0])

const baseParams = { lat: '42.3601', lng: '-71.0589', use: 'commercial', gfa: '15000', heightFt: '50' }

const mockParcel = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
    if (u.includes('BPDA_Parcels')) return new Response(JSON.stringify({ features: [{ attributes: { pid: '99', full_addre: '1 Test St', lot_size: 10000 } }] }))
    return new Response(JSON.stringify({ features: [] }))
  })

describe('analyze handler', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('validation', () => {
    beforeEach(() => mockParcel())
    it('rejects out-of-bbox coords with 400 OUT_OF_BBOX', async () => {
      const res = await call({ ...baseParams, lat: '38.89', lng: '-77.03' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
    })
    it('rejects missing gfa with 400 BAD_INPUT', async () => {
      const res = await call({ lat: baseParams.lat, lng: baseParams.lng, use: 'commercial' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
    })
    it('rejects an unknown use with 400 BAD_INPUT', async () => {
      const res = await call({ ...baseParams, use: 'spaceport' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
    })
  })

  describe('success', () => {
    beforeEach(() => mockParcel())
    it('returns 200 AS_OF_RIGHT with costs and narrative', async () => {
      const res = await call(baseParams)
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('AS_OF_RIGHT')
      expect(body.costs.total).toBeGreaterThan(0)
      expect(typeof body.narrative).toBe('string')
      expect(body.parcel.districtCode).toBe('B-2-65')
      expect(body.disclaimers.length).toBeGreaterThan(0)
    })
    it('returns NEEDS_RELIEF when the project exceeds FAR', async () => {
      const res = await call({ ...baseParams, gfa: '40000' })
      expect(JSON.parse(res.body).feasibility.overall).toBe('NEEDS_RELIEF')
    })
  })

  describe('parcel failures propagate', () => {
    it('returns 502 when zoning upstream rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('Zoning')) throw new Error('down')
        return new Response(JSON.stringify({ features: [{ attributes: { pid: '1', full_addre: 'x' } }] }))
      })
      const res = await call(baseParams)
      expect(res.statusCode).toBe(502)
      expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
    })
    it('returns 404 when no parcel at the point', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
        return new Response(JSON.stringify({ features: [] }))
      })
      const res = await call(baseParams)
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).code).toBe('NO_PARCEL')
    })
  })
})
