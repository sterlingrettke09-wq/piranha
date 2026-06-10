import { describe, it, expect } from 'vitest'
import { resolveChicago, CHICAGO_LIMITS, CHICAGO_BASE_FAR } from './chicago'

// Every number below is pinned to the Chicago Zoning Ordinance (Title 17) tables
// cited in chicago.ts. These tests are the guard against silently changing a
// sourced figure — and against the dash-suffix parser drifting.
describe('resolveChicago — B/C district FAR by dash suffix (§17-3-0403-A)', () => {
  it.each([
    ['B1-1', 1.2],
    ['B3-2', 2.2], // the spec's worked example: suffix 2 → 2.2
    ['B3-3', 3.0],
    ['B3-5', 5.0],
    ['C1-2', 2.2],
    ['C3-5', 5.0],
    ['B1-1.5', 1.5], // dash 1.5
  ])('%s → FAR %f', (zone, far) => {
    expect(resolveChicago(zone).far).toBe(far)
  })
})

describe('resolveChicago — B/C district height (§17-3-0408-A)', () => {
  it('dash 1 / 1.5 publish a flat 38 ft (frontage-independent)', () => {
    expect(resolveChicago('B1-1').heightFt).toBe(38)
    expect(resolveChicago('C1-1.5').heightFt).toBe(38)
  })
  it('dash 2 / 3 / 5 height VARIES by lot frontage → null (never guessed)', () => {
    expect(resolveChicago('B3-2').heightFt).toBeNull()
    expect(resolveChicago('B3-3').heightFt).toBeNull()
    expect(resolveChicago('C3-5').heightFt).toBeNull()
  })
})

describe('resolveChicago — D downtown FAR (§17-4-0405-A) with no height (§17-4-0407)', () => {
  it.each([
    ['DC-12', 12.0],
    ['DX-5', 5.0],
    ['DX-7', 7.0],
    ['DR-3', 3.0],
    ['DC-16', 16.0],
  ])('%s → base FAR %f, height null', (zone, far) => {
    const r = resolveChicago(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull() // D districts have no max height limit
  })
})

describe('resolveChicago — M manufacturing FAR (§17-5-0404-A)', () => {
  it.each([
    ['M1-2', 2.2],
    ['M2-2', 2.2],
    ['M3-3', 3.0],
    ['M1-1', 1.2],
  ])('%s → FAR %f, height null', (zone, far) => {
    const r = resolveChicago(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull()
  })
})

describe('resolveChicago — residential base FAR (§17-2)', () => {
  it.each([
    ['RS-1', 0.5],
    ['RS-3', 0.9],
    ['RM-5', 2.0],
    ['RM-6', 4.4],
    ['RT-4', 1.2],
  ])('%s → FAR %f', (zone, far) => {
    expect(resolveChicago(zone).far).toBe(far)
  })
})

describe('resolveChicago — unknown / "varies" → null (never fabricated)', () => {
  it('unknown district → both null', () => {
    expect(resolveChicago('PD-1')).toEqual({ far: null, heightFt: null })
    expect(resolveChicago('POS-1')).toEqual({ far: null, heightFt: null })
  })
  it('an out-of-range dash suffix (no published row) → null FAR', () => {
    expect(resolveChicago('B3-4').far).toBeNull() // no dash-4 in §17-3-0403-A
    expect(resolveChicago('DX-99').far).toBeNull()
  })
  it('null / empty / garbage input → null', () => {
    expect(resolveChicago(null)).toEqual({ far: null, heightFt: null })
    expect(resolveChicago(undefined)).toEqual({ far: null, heightFt: null })
    expect(resolveChicago('')).toEqual({ far: null, heightFt: null })
    expect(resolveChicago('not-a-zone')).toEqual({ far: null, heightFt: null })
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveChicago('  b3-2  ').far).toBe(2.2)
  })
})

describe('CHICAGO_LIMITS static table stays in lock-step with resolveChicago', () => {
  it('covers ≥20 common districts', () => {
    expect(Object.keys(CHICAGO_LIMITS).length).toBeGreaterThanOrEqual(20)
  })
  it('each stored entry equals the resolver output for that district', () => {
    for (const [district, limits] of Object.entries(CHICAGO_LIMITS)) {
      expect(limits).toEqual(resolveChicago(district))
    }
  })
})

describe('CHICAGO_BASE_FAR is still exported for the provider', () => {
  it('exposes the residential base FAR table', () => {
    expect(CHICAGO_BASE_FAR['RM-5']).toBe(2.0)
    expect(CHICAGO_BASE_FAR['RM-4.5']).toBe(1.7)
  })
})
