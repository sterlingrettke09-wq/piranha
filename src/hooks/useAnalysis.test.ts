import { describe, it, expect } from 'vitest'
import { toQuery } from './useAnalysis'
import { ESTIMATES_VERSION } from '../config/estimates'
import type { AnalysisInput } from '../types/analysis'

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
