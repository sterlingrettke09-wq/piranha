import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../analyze'
import { invokeWithQuery } from './testing/invokeHandler'

const call = (qs: Record<string, string> = {}) => invokeWithQuery(handler, qs)

// A neutral Boston coordinate (South End) — away from civic hard-block sites
// like City Hall / the State House so the mocked parcel drives the verdict.
const baseParams = { lat: '42.3400', lng: '-71.0700', use: 'commercial', gfa: '15000', heightFt: '50' }

const mockParcel = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
    if (u.includes('Parcels_24_detailed')) return new Response(JSON.stringify({ features: [{ attributes: { PID: '99', ST_NUM: '1', ST_NAME: 'Test St', LAND_SF: 10000 } }] }))
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
    it('rejects a non-positive gfa with 400 BAD_INPUT', async () => {
      const res = await call({ ...baseParams, gfa: '0' })
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
    it('returns NEEDS_RELIEF when the project modestly exceeds FAR', async () => {
      // lot 10000, maxFAR 2.0 → 20000 max. 22000 = FAR 2.2 = 1.1× (within the ~1.2× FAR variance range).
      const res = await call({ ...baseParams, gfa: '22000' })
      expect(JSON.parse(res.body).feasibility.overall).toBe('NEEDS_RELIEF')
    })

    it('returns PROHIBITED when the project grossly exceeds FAR', async () => {
      const res = await call({ ...baseParams, gfa: '60000' }) // FAR 6.0 = 3× the limit
      expect(JSON.parse(res.body).feasibility.overall).toBe('PROHIBITED')
    })
  })

  describe('input bounds (WO-1.2 hardening)', () => {
    beforeEach(() => mockParcel())
    it('rejects an absurd gfa with 400', async () => {
      const res = await call({ ...baseParams, gfa: '5000001' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
    })
    it('rejects non-positive units with 400', async () => {
      const res = await call({ ...baseParams, units: '0' })
      expect(res.statusCode).toBe(400)
    })
    it('rejects out-of-range stories with 400', async () => {
      const res = await call({ ...baseParams, stories: '300' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('discretionary months (the max + parallel combine)', () => {
    // Boston B-2-65 (family FAR 2.0), commercial → apartment tier baseline 44.
    // Spine (variance adder) for boston = 6; Article 80 Small (20–50k sf)
    // adds 4 as a 'review' hurdle; Article 80 Large (50k+) adds 9.
    beforeEach(() => mockParcel())

    it('as-of-right small project gets the bare lifecycle baseline (44)', async () => {
      const res = await call(baseParams) // 15k sf on 10k lot, FAR 1.5 ≤ 2.0
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('AS_OF_RIGHT')
      expect(body.timeline.months).toBe(44)
    })

    it('variance path takes MAX(spine, entitlement), not their sum', async () => {
      // 22k sf → FAR 2.2 (needs relief, spine 6) AND Article 80 Small (4).
      // Current combine: max(6, 4) = 6 → 44 + 6 = 50. If this ever reads 54,
      // someone re-introduced naive addition (see WO-5.8 before changing).
      const res = await call({ ...baseParams, gfa: '22000' })
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('NEEDS_RELIEF')
      expect(body.timeline.months).toBe(50)
    })

    it('an as-of-right large project still pays its entitlement hurdle (Article 80 Large)', async () => {
      // Big lot so 55k sf stays within FAR: spine 0, entitlement max 9 → 53.
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = String(url)
        if (u.includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
        if (u.includes('Parcels_24_detailed')) return new Response(JSON.stringify({ features: [{ attributes: { PID: '99', ST_NUM: '1', ST_NAME: 'Test St', LAND_SF: 100000 } }] }))
        return new Response(JSON.stringify({ features: [] }))
      })
      const res = await call({ ...baseParams, gfa: '55000' })
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('AS_OF_RIGHT')
      expect(body.hurdles.some((h: { label: string }) => h.label.includes('Article 80 Large'))).toBe(true)
      expect(body.timeline.months).toBe(53)
    })

    it('prohibited projects get a zeroed timeline and costs', async () => {
      const res = await call({ ...baseParams, gfa: '60000' }) // FAR 6 = 3× limit
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('PROHIBITED')
      expect(body.costs.total).toBe(0)
    })
  })

  describe('parcel failures propagate', () => {
    it('returns 502 when zoning upstream rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('Zoning')) throw new Error('down')
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '1', ST_NUM: '1', ST_NAME: 'x' } }] }))
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
