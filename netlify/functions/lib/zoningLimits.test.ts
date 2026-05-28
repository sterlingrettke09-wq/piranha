import { describe, it, expect } from 'vitest'
import { resolveZoningLimits } from './zoningLimits'

const z = (districtCode: string) => ({ districtCode, maxFAR: null, maxHeightFt: null, allowedUses: null })

describe('resolveZoningLimits', () => {
  it('parses trailing height from a coded district like B-2-65', () => {
    const r = resolveZoningLimits(z('B-2-65'))
    expect(r.maxHeightFt).toBe(65)
    expect(r.maxFAR).toBe(2.0)
    expect(r.allowedUses).toContain('commercial')
  })

  it('treats an OS district as open-space family with no parsed height', () => {
    const r = resolveZoningLimits(z('OS-UP'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(0.1)
    expect(r.allowedUses).toEqual(['institutional'])
  })

  it('handles a residential district with a single-digit suffix (no height parse)', () => {
    const r = resolveZoningLimits(z('R-1'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(1.0)
    expect(r.allowedUses).toEqual(['residential'])
  })

  it('returns all nulls for an unknown district', () => {
    const r = resolveZoningLimits(z('Unknown'))
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
    expect(r.allowedUses).toBeNull()
  })

  it('prefers explicit non-null values from the parcel feed', () => {
    const r = resolveZoningLimits({ districtCode: 'B-2-65', maxFAR: 5, maxHeightFt: 200, allowedUses: ['residential'] })
    expect(r.maxFAR).toBe(5)
    expect(r.maxHeightFt).toBe(200)
    expect(r.allowedUses).toEqual(['residential'])
  })
})
