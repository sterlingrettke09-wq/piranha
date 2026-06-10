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

// WO-8.8 depth program: the per-city curated tables fill FAR/height ONLY where
// the provider left them null, and only for the city they belong to. They never
// override provider data and never leak into Boston's family heuristics.
describe('resolveZoningLimits — per-city curated tables (WO-8.8)', () => {
  const z = (districtCode: string, over: Partial<{ maxFAR: number | null; maxHeightFt: number | null }> = {}) => ({
    districtCode,
    maxFAR: null as number | null,
    maxHeightFt: null as number | null,
    allowedUses: null,
    ...over,
  })

  it('Chicago: a B3-2 with null provider FAR gets 2.2 from the Title 17 table', () => {
    const r = resolveZoningLimits(z('B3-2'), 'chicago')
    expect(r.maxFAR).toBe(2.2)
    expect(r.maxHeightFt).toBeNull() // §17-3-0408-A height varies by frontage → null
  })

  it('Chicago: a downtown DX-7 gets the §17-4-0405-A base FAR 7.0, no height limit', () => {
    const r = resolveZoningLimits(z('DX-7'), 'chicago')
    expect(r.maxFAR).toBe(7.0)
    expect(r.maxHeightFt).toBeNull()
  })

  it('Chicago: a B1-1 publishes the flat 38 ft height', () => {
    expect(resolveZoningLimits(z('B1-1'), 'chicago').maxHeightFt).toBe(38)
  })

  it('Chicago: provider FAR always wins over the table', () => {
    const r = resolveZoningLimits(z('B3-2', { maxFAR: 9 }), 'chicago')
    expect(r.maxFAR).toBe(9)
  })

  it('Denver: a C-MX-5 stays null FAR (form-based) and derives 60 ft', () => {
    const r = resolveZoningLimits(z('C-MX-5'), 'denver')
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBe(60)
  })

  it('Denver: provider height always wins over the table', () => {
    const r = resolveZoningLimits(z('C-MX-5', { maxHeightFt: 999 }), 'denver')
    expect(r.maxHeightFt).toBe(999)
  })

  it('the curated tables do not leak into Boston (no city match → Boston heuristics only)', () => {
    // "B3-2" is a Chicago code; under Boston it must NOT pick up the Chicago FAR.
    const r = resolveZoningLimits(z('B3-2'), 'boston')
    // Boston family heuristic for a "B" code is FAR 2.0, NOT Chicago's 2.2.
    expect(r.maxFAR).toBe(2.0)
  })

  it('a city without a table falls through to all-null (no fabrication)', () => {
    const r = resolveZoningLimits(z('B3-2'), 'seattle')
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
  })
})
