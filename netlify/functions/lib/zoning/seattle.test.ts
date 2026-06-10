import { describe, it, expect } from 'vitest'
import { resolveSeattle, SEATTLE_FAR } from './seattle'

// Every FAR below is pinned to SMC 23.47A.013 Table A (FAR limit OUTSIDE a
// Station Area Overlay District) cited in seattle.ts. These tests guard against
// silently changing a sourced figure and against the suffix parser drifting.
describe('resolveSeattle — NC/C FAR by height-limit suffix (SMC 23.47A.013 Table A)', () => {
  it.each([
    ['NC1-30', 2.5],
    ['NC2-40', 3.0], // footnote: 3.25 w/o MHA suffix — we store the conservative 3.0
    ['NC2-55', 3.75],
    ['NC3-65', 4.5],
    ['NC3-75', 5.5],
    ['NC3-85', 5.75],
    ['NC3-95', 6.25],
    ['NC3-145', 7.0],
    ['NC3-200', 8.25],
    ['C1-40', 3.0],
    ['C1-65', 4.5],
    ['C2-65', 4.5],
  ])('%s → FAR %f, height null (provider derives height)', (zone, far) => {
    const r = resolveSeattle(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull() // height stays the provider's job
  })
})

describe('resolveSeattle — MIO prefix is stripped to the NC/C base zone', () => {
  it('MIO-105-NC3-65 → NC3 base FAR 4.5 (not the MIO 105 height)', () => {
    expect(resolveSeattle('MIO-105-NC3-65').far).toBe(4.5)
  })
})

describe('resolveSeattle — non-NC/C zones have a separate/no FAR table → null (honest)', () => {
  it.each([
    'LR1', // multifamily — SMC 23.45, not replicated here
    'LR2',
    'LR3',
    'MR',
    'HR',
    'SM-U 95-320', // Seattle Mixed — SMC 23.48
    'DOC1', // downtown
    'IG1 U/85', // industrial
    'SF 5000', // single-family
  ])('%s → far null', (zone) => {
    expect(resolveSeattle(zone).far).toBeNull()
  })
})

describe('resolveSeattle — unknown height suffix stays null (never interpolated)', () => {
  it('an NC zone with a height NOT in Table A → null FAR', () => {
    // 50 ft has no published Table-A row → must not interpolate between 40 and 55.
    expect(resolveSeattle('NC2-50').far).toBeNull()
    expect(resolveSeattle('NC3-105').far).toBeNull()
  })
  it('an NC/C zone with no parseable height token → null FAR', () => {
    expect(resolveSeattle('NC3').far).toBeNull()
  })
})

describe('resolveSeattle — unknown / empty / garbage → null', () => {
  it.each([null, undefined, '', 'not-a-zone', 'PARK'])('%s → both null', (zone) => {
    expect(resolveSeattle(zone)).toEqual({ far: null, heightFt: null })
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveSeattle('  nc3-65  ').far).toBe(4.5)
  })
})

describe('SEATTLE_FAR static table stays in lock-step with resolveSeattle', () => {
  it('covers ≥10 NC/C variants', () => {
    expect(Object.keys(SEATTLE_FAR).length).toBeGreaterThanOrEqual(10)
  })
  it('each stored entry equals the resolver output for that zone', () => {
    for (const [zone, limits] of Object.entries(SEATTLE_FAR)) {
      expect(limits).toEqual(resolveSeattle(zone))
    }
  })
  it('every entry has a null height (height is provider-derived)', () => {
    for (const limits of Object.values(SEATTLE_FAR)) {
      expect(limits.heightFt).toBeNull()
    }
  })
})
