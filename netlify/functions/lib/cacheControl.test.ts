import { describe, it, expect } from 'vitest'
import { cacheControlFor, CACHE_OK, CACHE_DEGRADED } from './parcel'
import type { ParcelInfo } from '../../../src/types/parcel'

// Regression for the Chicago cache-poisoning incident (2026-06-10): a
// transient gisapps.chicago.gov failure produced districtCode 'Unknown',
// and the 24h CDN TTL froze that degraded answer for every visitor.

function info(
  over: Partial<{ districtCode: string; address: string; unresolved: ParcelInfo['overlays']['unresolved'] }> = {},
): ParcelInfo {
  return {
    address: over.address ?? '123 Main St',
    parcelId: 'p1',
    coordinates: [-87.6, 41.9],
    zoning: {
      districtCode: over.districtCode ?? 'B3-2',
      subdistrict: null,
      article: null,
      maxHeightFt: null,
      maxFAR: null,
      allowedUses: null,
    },
    lot: { sizeSqFt: 3000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null, ...(over.unresolved ? { unresolved: over.unresolved } : {}) },
    existing: { landUse: null },
    sources: { zoning: 'z', parcels: 'p' },
    fetchedAt: new Date().toISOString(),
  }
}

describe('cacheControlFor — degraded responses must not stick for a day', () => {
  it('healthy response → long TTL with SWR', () => {
    expect(cacheControlFor(info())).toBe(CACHE_OK)
    expect(CACHE_OK).toMatch(/s-maxage=86400/)
  })

  // The title used to attribute this branch to a FAILED zoning lookup. That
  // route no longer exists: a failed required read refuses with UPSTREAM_ERROR
  // and never becomes a ParcelInfo, so nothing reaching cacheControlFor can be
  // an outage. `Unknown` here means the zoning service answered and no polygon
  // covers the point — a real answer, given a short TTL because it is thin.
  it("no zoning polygon at the point (districtCode 'Unknown') → 5-minute TTL", () => {
    expect(cacheControlFor(info({ districtCode: 'Unknown' }))).toBe(CACHE_DEGRADED)
    expect(CACHE_DEGRADED).toMatch(/s-maxage=300/)
    expect(CACHE_DEGRADED).not.toMatch(/stale-while-revalidate/)
  })

  it("geocoder failed (address 'Selected location') → 5-minute TTL", () => {
    expect(cacheControlFor(info({ address: 'Selected location' }))).toBe(CACHE_DEGRADED)
  })

  // Same incident, one field over. A response saying "the Coastal Zone layer did
  // not respond" is a fact about ONE REQUEST; at the long TTL a thirty-second
  // outage would tell every visitor for a day that a check could not be
  // performed, on a layer that recovered immediately.
  it('an unresolved overlay read → 5-minute TTL', () => {
    expect(cacheControlFor(info({ unresolved: ['coastal'] }))).toBe(CACHE_DEGRADED)
    expect(cacheControlFor(info({ unresolved: ['historic', 'flood'] }))).toBe(CACHE_DEGRADED)
  })

  it('an empty overlay ANSWER is not degraded', () => {
    // The whole distinction: no marks means every layer answered, and "nothing
    // covers this parcel" is a finding worth caching for a day.
    expect(cacheControlFor(info())).toBe(CACHE_OK)
    expect(cacheControlFor(info({ unresolved: [] }))).toBe(CACHE_OK)
  })

  it('a real district named like the fallback is NOT degraded (sanity)', () => {
    // No city uses the literal string 'Unknown' as a district code — only our
    // own providers' fallback does. This pins that assumption visibly.
    expect(cacheControlFor(info({ districtCode: 'UNKNOWN ZONE X' }))).toBe(CACHE_OK)
  })
})
