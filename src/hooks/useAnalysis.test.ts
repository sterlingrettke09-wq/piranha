import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toQuery, logAnalysis, __resetAnalysisLogForTests } from './useAnalysis'
import { ESTIMATES_VERSION } from '../config/estimates'
import type { AnalysisInput, AnalysisResult } from '../types/analysis'

const input: AnalysisInput = {
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  parcelId: '0304567000',
  lat: 42.36014999321,
  lng: -71.05890000123,
  use: 'residential',
  gfa: 12000,
  units: 10,
  stories: undefined,
  heightFt: undefined,
}

describe('toQuery (the /api/analyze cache key)', () => {
  it('quantizes lat/lng to 6 decimals', () => {
    const qs = new URLSearchParams(toQuery(input))
    expect(qs.get('lat')).toBe('42.36015')
    expect(qs.get('lng')).toBe('-71.0589')
  })

  it('appends the estimates version as a cache-buster', () => {
    const qs = new URLSearchParams(toQuery(input))
    expect(qs.get('v')).toBe(String(ESTIMATES_VERSION))
  })

  it('produces identical keys for near-identical clicks', () => {
    expect(toQuery({ ...input, lat: 42.3601500001, lng: -71.0589000002 })).toBe(
      toQuery({ ...input, lat: 42.3601499999, lng: -71.0588999998 }),
    )
  })

  it('omits absent optional fields', () => {
    const qs = new URLSearchParams(toQuery(input))
    expect(qs.has('stories')).toBe(false)
    expect(qs.has('heightFt')).toBe(false)
    expect(qs.get('units')).toBe('10')
  })
})

describe('⚠️ the analysis beacon — the only writer of kind=analysis', () => {
  const calls: string[] = []
  beforeEach(() => {
    calls.length = 0
    __resetAnalysisLogForTests()
    vi.stubGlobal('fetch', (u: string) => {
      calls.push(u)
      return Promise.resolve(new Response(null, { status: 204 }))
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const loaded = {
    status: 'loaded' as const,
    data: {
      parcel: { address: '1 Main St', parcelId: '0304567000' },
      feasibility: { overall: 'NEEDS_RELIEF' },
      timeline: { months: 18 },
    } as unknown as AnalysisResult,
  }

  it('reports what was ASKED FOR, read back out of the request itself', () => {
    // The beacon reads `qs`, which IS the analyze request — so there is no
    // second source that could drift from what the server was actually asked.
    logAnalysis(toQuery(input), loaded)
    expect(calls).toHaveLength(1)
    const q = new URLSearchParams(calls[0].split('?')[1])
    expect(q.get('kind')).toBe('analysis')
    expect(q.get('city')).toBe('boston')
    expect(q.get('use')).toBe('residential')
    expect(q.get('projectType')).toBe('new')
    expect(q.get('gfa')).toBe('12000')
    expect(q.get('units')).toBe('10')
    expect(q.get('address')).toBe('1 Main St')
    // From the RESULT, not the request — these are the two fields the server
    // produced rather than the ones the user chose.
    expect(q.get('verdict')).toBe('NEEDS_RELIEF')
    expect(q.get('months')).toBe('18')
  })

  it('⚠️ still logs an ERRORED analysis, without inventing a verdict', () => {
    // Dropping failures would bias the log toward the cities whose pipelines
    // work — which is the opposite of what this instrument is for. The parcel
    // id stands in for the address, and no verdict is fabricated.
    logAnalysis(toQuery(input), { status: 'error', error: { code: 'INTERNAL', message: 'x' } })
    expect(calls).toHaveLength(1)
    const q = new URLSearchParams(calls[0].split('?')[1])
    expect(q.get('kind')).toBe('analysis')
    expect(q.get('address')).toBe('0304567000')
    expect(q.get('verdict')).toBeNull()
    expect(q.get('months')).toBeNull()
  })

  it('logs one beacon per distinct analysis, not per render', () => {
    logAnalysis(toQuery(input), loaded)
    logAnalysis(toQuery(input), loaded)
    expect(calls).toHaveLength(1)
    // ⚠️ And a genuinely different project DOES log — the dedupe must not pass
    // by suppressing everything (rule 20).
    logAnalysis(toQuery({ ...input, gfa: 999 }), loaded)
    expect(calls).toHaveLength(2)
  })

  it('sends nothing when the request lacks a city or parcel', () => {
    logAnalysis('city=boston', loaded)
    logAnalysis('parcelId=123', loaded)
    expect(calls).toHaveLength(0)
  })
})
