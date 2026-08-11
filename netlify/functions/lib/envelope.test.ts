import { describe, it, expect } from 'vitest'
import { computeEnvelope } from './envelope'
import type { ParcelInfo } from '../../../src/types/parcel'

// Minimal ParcelInfo factory — only the fields computeEnvelope reads matter.
function info(over: {
  districtCode?: string
  maxFAR?: number | null
  maxHeightFt?: number | null
  allowedUses?: string[] | null
  farByUse?: ParcelInfo['zoning']['farByUse']
  lotSqFt?: number | null
}): ParcelInfo {
  return {
    address: '1 Test St',
    parcelId: 'T1',
    coordinates: [-71.06, 42.36],
    zoning: {
      districtCode: over.districtCode ?? 'R-1',
      subdistrict: null,
      article: null,
      maxFAR: over.maxFAR ?? null,
      maxHeightFt: over.maxHeightFt ?? null,
      allowedUses: over.allowedUses ?? null,
      farByUse: over.farByUse,
    },
    lot: { sizeSqFt: over.lotSqFt ?? null, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-06-09T00:00:00Z',
  }
}

describe('computeEnvelope — Boston family heuristics', () => {
  it('derives FAR/height/uses from a B-2-65 code and sizes the envelope', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2-65', lotSqFt: 10_000 }), 'boston')
    expect(env.maxFloorAreaSqFt).toBe(20_000) // family B FAR 2.0 × 10,000
    expect(env.maxHeightFt).toBe(65) // trailing height token
    // No per-use FAR → district basis → 13 ft/story (commercial). floor(65/13)=5.
    expect(env.farBasis).toBe('district')
    expect(env.maxStories).toBe(5)
    expect(env.allowedUses).toContain('residential')
    expect(env.maxUnits).toBe(15) // floor(20,000 / 1,300 gross sf/unit)
  })

  it('does not fabricate limits for word-named subdistricts', () => {
    const env = computeEnvelope(
      info({ districtCode: 'CHARLESTOWN NAVY YARD SUBDISTRICT', lotSqFt: 10_000 }),
      'boston',
    )
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.maxHeightFt).toBeNull()
    expect(env.maxUnits).toBeNull()
    expect(env.farBasis).toBeNull() // no FAR drove anything
  })
})

describe('computeEnvelope — per-use FAR pick and basis labeling (WO-5.5)', () => {
  it('headline floor area uses the RESIDENTIAL FAR when broken out, and labels the basis', () => {
    const env = computeEnvelope(
      info({
        districtCode: 'C6-7',
        maxFAR: 15,
        farByUse: { residential: 10, commercial: 15, mixed: 15, institutional: 15 },
        allowedUses: ['commercial', 'mixed', 'residential'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000) // residential FAR 10, not the 15 headline max
    expect(env.farBasis).toBe('residential')
  })

  it('uses the MIXED FAR (and 0.85 residential-share for units) when no residential FAR exists', () => {
    const env = computeEnvelope(
      info({
        districtCode: 'C6-7',
        farByUse: { mixed: 10, commercial: 15 },
        allowedUses: ['commercial', 'mixed'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000) // mixed FAR 10
    expect(env.farBasis).toBe('mixed')
    // Mixed envelope isn't 100% residential: floor(10,000 × 0.85 / 1,300) = 6.
    expect(env.maxUnits).toBe(6)
  })

  it('falls back to the district maxFAR (basis "district") when no per-use FAR exists', () => {
    const env = computeEnvelope(
      info({ districtCode: 'MU-4', maxFAR: 2.5, allowedUses: ['mixed'], lotSqFt: 4_000 }),
      'dc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000)
    expect(env.farBasis).toBe('district')
    // District basis → no 0.85 share applied; 10,000 / 1,300 = 7.
    expect(env.maxUnits).toBe(7)
  })

  it('uses 13 ft/story for a district basis and 11 ft/story for a residential basis', () => {
    const district = computeEnvelope(
      info({ districtCode: 'C-1', maxFAR: 4, maxHeightFt: 130, allowedUses: ['commercial'], lotSqFt: 1_000 }),
      'nyc',
    )
    expect(district.farBasis).toBe('district')
    expect(district.maxStories).toBe(10) // floor(130 / 13)

    const residential = computeEnvelope(
      info({
        districtCode: 'R-1',
        maxHeightFt: 130,
        farByUse: { residential: 4 },
        allowedUses: ['residential'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(residential.farBasis).toBe('residential')
    expect(residential.maxStories).toBe(11) // floor(130 / 11)
  })
})

describe('computeEnvelope — null propagation', () => {
  it('returns null floor area without a lot size, null stories without a height', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2', lotSqFt: null }), 'boston')
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.maxStories).toBeNull() // B-2 has no trailing height token
  })

  it('keeps the residential 11 ft default for a known height with no FAR basis', () => {
    // Height present, but no FAR anywhere → basis null → default to residential
    // 11 ft/story (the taller, conservative story count).
    const env = computeEnvelope(
      info({ districtCode: 'UNKNOWN ZONE', maxHeightFt: 55, lotSqFt: null }),
      'nyc',
    )
    expect(env.farBasis).toBeNull()
    expect(env.maxStories).toBe(5) // floor(55 / 11)
  })

  it('returns null maxUnits when residential is not an allowed use', () => {
    const env = computeEnvelope(
      info({ districtCode: 'M1', maxFAR: 2, allowedUses: ['commercial', 'institutional'], lotSqFt: 10_000 }),
      'chicago',
    )
    expect(env.maxFloorAreaSqFt).toBe(20_000)
    expect(env.maxUnits).toBeNull()
    expect(env.farBasis).toBe('district')
  })
})

// ── storiesBasis: a stated story count is a fact; a derived one is an assumption ──
describe('envelope — storiesBasis marks derived story counts', () => {
  // Annotated, not inferred: an un-annotated const is not excess-property
  // checked, and it is spread into the call below — where a spread is not
  // checked either. Without the annotation `base` accepts any misspelling and
  // this whole storiesBasis suite goes inert. (`as [number, number]` is
  // unnecessary once the annotation supplies the tuple context.)
  const base: Omit<ParcelInfo, 'zoning'> = {
    address: 'x', parcelId: 'p', coordinates: [-97.7, 30.3],
    lot: { sizeSqFt: 10000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {}, fetchedAt: '2026-08-04T00:00:00.000Z',
  }
  const z = (o: Partial<ParcelInfo['zoning']>): ParcelInfo['zoning'] => ({
    districtCode: 'X', subdistrict: null, article: null,
    maxHeightFt: null, maxFAR: null, allowedUses: ['residential'], ...o,
  })

  it("marks 'stated' when the code supplies the story count", () => {
    const env = computeEnvelope({ ...base, zoning: z({ maxStories: 80, maxHeightFt: 1120 }) }, 'miami')
    expect(env.maxStories).toBe(80)
    expect(env.storiesBasis).toBe('stated')
  })

  it("marks 'derived' when we divided a published height by the convention", () => {
    const env = computeEnvelope({ ...base, zoning: z({ maxHeightFt: 200 }) }, 'boston')
    expect(env.storiesBasis).toBe('derived')
    expect(env.maxStories).toBe(18) // 200 / 11
  })

  it('omits the basis entirely when there is no story count at all', () => {
    const env = computeEnvelope({ ...base, zoning: z({}) }, 'boston')
    expect(env.maxStories).toBeNull()
    expect(env.storiesBasis).toBeUndefined()
  })

  it('a stated count is NEVER overridden by a derivable height', () => {
    // The Miami/Denver bug: both present, the code's figure must win.
    const env = computeEnvelope({ ...base, zoning: z({ maxStories: 12, maxHeightFt: 144 }) }, 'denver')
    expect(env.maxStories).toBe(12) // not floor(144/11) = 13
  })
})
