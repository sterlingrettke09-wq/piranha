import { describe, it, expect } from 'vitest'
import { computeEnvelope } from './envelope'
import type { ParcelInfo } from '../../src/types/parcel'

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
      ...(over.farByUse ? { farByUse: over.farByUse } : {}),
    },
    lot: { sizeSqFt: over.lotSqFt ?? null, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-06-09T00:00:00Z',
  } as ParcelInfo
}

describe('computeEnvelope — Boston family heuristics', () => {
  it('derives FAR/height/uses from a B-2-65 code and sizes the envelope', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2-65', lotSqFt: 10_000 }), 'boston')
    expect(env.maxFloorAreaSqFt).toBe(20_000) // family B FAR 2.0 × 10,000
    expect(env.maxHeightFt).toBe(65) // trailing height token
    expect(env.maxStories).toBe(5) // floor(65 / 11 ft)
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
  })
})

describe('computeEnvelope — per-use FAR pick (current behavior, see WO-5.5)', () => {
  it('headline floor area uses the RESIDENTIAL FAR when broken out, even if commercial is higher', () => {
    // NOTE: pins the documented asymmetry — the envelope headline picks
    // residential ?? mixed ?? district FAR while the feasibility check uses
    // farByUse[project.use]. WO-5.5 will label the basis; until then this is
    // the behavior the panel shows.
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
  })

  it('falls back to the district maxFAR when no per-use FAR exists', () => {
    const env = computeEnvelope(
      info({ districtCode: 'MU-4', maxFAR: 2.5, allowedUses: ['mixed'], lotSqFt: 4_000 }),
      'dc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000)
  })
})

describe('computeEnvelope — null propagation', () => {
  it('returns null floor area without a lot size, null stories without a height', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2', lotSqFt: null }), 'boston')
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.maxStories).toBeNull() // B-2 has no trailing height token
  })

  it('returns null maxUnits when residential is not an allowed use', () => {
    const env = computeEnvelope(
      info({ districtCode: 'M1', maxFAR: 2, allowedUses: ['commercial', 'institutional'], lotSqFt: 10_000 }),
      'chicago',
    )
    expect(env.maxFloorAreaSqFt).toBe(20_000)
    expect(env.maxUnits).toBeNull()
  })
})
