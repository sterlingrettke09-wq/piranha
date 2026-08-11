import { describe, it, expect } from 'vitest'
import { cacheControlFor, CACHE_OK, CACHE_DEGRADED } from './parcel'
import type { ParcelInfo } from '../../../src/types/parcel'

// Regression for the Chicago cache-poisoning incident (2026-06-10): a
// transient gisapps.chicago.gov failure produced districtCode 'Unknown',
// and the 24h CDN TTL froze that degraded answer for every visitor.

function info(over: Partial<{ districtCode: string; address: string }> = {}): ParcelInfo {
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
    overlays: { historicDistrict: null, floodZone: null },
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

  it("zoning lookup failed (districtCode 'Unknown') → 5-minute TTL", () => {
    expect(cacheControlFor(info({ districtCode: 'Unknown' }))).toBe(CACHE_DEGRADED)
    expect(CACHE_DEGRADED).toMatch(/s-maxage=300/)
    expect(CACHE_DEGRADED).not.toMatch(/stale-while-revalidate/)
  })

  it("geocoder failed (address 'Selected location') → 5-minute TTL", () => {
    expect(cacheControlFor(info({ address: 'Selected location' }))).toBe(CACHE_DEGRADED)
  })

  it('a real district named like the fallback is NOT degraded (sanity)', () => {
    // No city uses the literal string 'Unknown' as a district code — only our
    // own providers' fallback does. This pins that assumption visibly.
    expect(cacheControlFor(info({ districtCode: 'UNKNOWN ZONE X' }))).toBe(CACHE_OK)
  })
})
