import { describe, it, expect } from 'vitest'
import { austinSfLimits, isAustinSubchapterFZone, AUSTIN_HOME_FAR } from './austin'
import { computeEnvelope } from '../envelope'
import type { ParcelInfo } from '../../../../src/types/parcel'

describe('Austin Subchapter F zone detection', () => {
  it('matches only SF-1/SF-2/SF-3', () => {
    expect(isAustinSubchapterFZone('SF-3')).toBe(true)
    expect(isAustinSubchapterFZone('sf-1')).toBe(true)
    expect(isAustinSubchapterFZone(' SF-2 ')).toBe(true)
    // SF-4A/5/6 are outside Subchapter F's area of applicability.
    expect(isAustinSubchapterFZone('SF-4A')).toBe(false)
    expect(isAustinSubchapterFZone('SF-6')).toBe(false)
    expect(isAustinSubchapterFZone('MF-3')).toBe(false)
    expect(isAustinSubchapterFZone(null)).toBe(false)
  })
})

describe('Austin two-branch Subchapter F resolution', () => {
  it('INSIDE the boundary: single-family base case — 0.40 FAR, 32 ft', () => {
    expect(austinSfLimits('SF-3', true)).toEqual({
      maxHeightFt: 32,
      maxFAR: 0.4,
      farFloorSqFt: null,
      farUnconstrained: false,
    })
  })

  it('OUTSIDE the boundary: no FAR limit — marked unconstrained, NOT given a number', () => {
    const r = austinSfLimits('SF-3', false)
    expect(r?.farUnconstrained).toBe(true)
    expect(r?.maxFAR).toBeNull()
    // Base-zone height still applies outside Subchapter F.
    expect(r?.maxHeightFt).toBe(35)
  })

  it('does not apply to non-Subchapter-F zones', () => {
    expect(austinSfLimits('MF-3', true)).toBeNull()
  })

  it('carries the HOME gradient constants as sourced from Ord. 20231207-001', () => {
    expect(AUSTIN_HOME_FAR.twoUnit).toEqual({ far: 0.55, floorSqFt: 3200, heightFt: 35 })
    expect(AUSTIN_HOME_FAR.threeUnit).toEqual({ far: 0.65, floorSqFt: 4350, heightFt: 35 })
  })
})

function parcel(zoning: Partial<ParcelInfo['zoning']>, lotSqFt: number | null): ParcelInfo {
  return {
    address: 'test',
    parcelId: 'test',
    coordinates: [-97.73, 30.307],
    zoning: {
      districtCode: 'SF-3',
      subdistrict: null,
      article: null,
      maxHeightFt: 32,
      maxFAR: 0.4,
      allowedUses: ['residential'],
      ...zoning,
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-08-04T00:00:00.000Z',
  } as ParcelInfo
}

describe('envelope — floor-area allowance ("the greater of the ratio or the floor value")', () => {
  it('uses the RATIO when it exceeds the allowance (large lot)', () => {
    // 3-unit gradient, 7,000 sf lot: 0.65 * 7000 = 4,550 > 4,350 floor.
    const env = computeEnvelope(parcel({ maxFAR: 0.65, farFloorSqFt: 4350 }, 7000), 'austin')
    expect(env.maxFloorAreaSqFt).toBe(4550)
    expect(env.floorAreaFromAllowance).toBeUndefined()
  })

  it('uses the ALLOWANCE when it exceeds the ratio (small lot)', () => {
    // 0.65 * 3000 = 1,950 < 4,350 floor, so the floor governs.
    const env = computeEnvelope(parcel({ maxFAR: 0.65, farFloorSqFt: 4350 }, 3000), 'austin')
    expect(env.maxFloorAreaSqFt).toBe(4350)
    expect(env.floorAreaFromAllowance).toBe(true)
  })

  it('an allowance NEVER manufactures a cap on an unconstrained parcel', () => {
    // An allowance is a floor under a cap, not a cap of its own.
    const env = computeEnvelope(
      parcel({ maxFAR: null, farFloorSqFt: 4350, farUnconstrained: true }, 7000),
      'austin',
    )
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.farBasis).toBe('unconstrained')
  })
})

describe('envelope — "unconstrained" is an ANSWER, null is a GAP', () => {
  it('marks farBasis unconstrained when the code imposes no FAR', () => {
    const env = computeEnvelope(parcel({ maxFAR: null, farUnconstrained: true }, 7000), 'austin')
    expect(env.farBasis).toBe('unconstrained')
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('leaves farBasis null when the FAR is merely unknown', () => {
    const env = computeEnvelope(parcel({ maxFAR: null }, 7000), 'austin')
    expect(env.farBasis).toBeNull()
  })

  it('the two states stay distinguishable despite sharing a null floor area', () => {
    const unconstrained = computeEnvelope(parcel({ maxFAR: null, farUnconstrained: true }, 7000), 'austin')
    const unknown = computeEnvelope(parcel({ maxFAR: null }, 7000), 'austin')
    expect(unconstrained.maxFloorAreaSqFt).toBe(unknown.maxFloorAreaSqFt)
    expect(unconstrained.farBasis).not.toBe(unknown.farBasis)
  })
})

describe('envelope — the defect this replaces', () => {
  it('a 7,000 sf SF-3 lot inside Subchapter F no longer reads as FAR 1.0', () => {
    const sf = austinSfLimits('SF-3', true)!
    const env = computeEnvelope(
      parcel({ maxFAR: sf.maxFAR, farFloorSqFt: sf.farFloorSqFt, maxHeightFt: sf.maxHeightFt }, 7000),
      'austin',
    )
    // Previously f:null → envelope null → defaultSpec fell back to lot * 1.0 = 7,000.
    expect(env.maxFloorAreaSqFt).toBe(2800)
  })
})
