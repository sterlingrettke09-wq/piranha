import { describe, it, expect } from 'vitest'
import { resolveNyc, NYC_LIMITS, NYC_CONTEXTUAL_HEIGHTS, NYC_COMMERCIAL_EQUIVALENT } from './nyc'

// Every height below is pinned to ZR 23-662(a) Table 1 ("Basic building
// heights" — the conservative no-qualifying-ground-floor column) cited in
// nyc.ts. These tests are the guard against silently changing a sourced figure
// and against the contextual-vs-sky-exposure distinction drifting.
describe('resolveNyc — contextual R-district max building height (ZR 23-662(a) Table 1)', () => {
  it.each([
    ['R6A', 70],
    ['R6B', 50],
    ['R7A', 80],
    ['R7B', 75],
    ['R7D', 100],
    ['R7X', 120], // outside Manhattan Core (conservative lower)
    ['R8A', 120],
    ['R8B', 75],
    ['R8X', 150],
    ['R9A', 135], // non-wide-street (R9A²), the conservative bound
    ['R9X', 160], // non-wide-street (R9X²)
    ['R10A', 185], // non-wide-street (R10A²)
  ])('%s → max building height %i ft, far null (FAR comes from PLUTO)', (zone, ft) => {
    const r = resolveNyc(zone)
    expect(r.heightFt).toBe(ft)
    expect(r.far).toBeNull() // FAR always from provider farByUse, never this table
  })
})

describe('resolveNyc — commercial districts mapped to a contextual equivalent (ZR 34-112)', () => {
  it.each([
    ['C4-2A', 70], // → R6A
    ['C1-6A', 80], // → R7A
    ['C4-4A', 80], // → R7A
    ['C4-5D', 100], // → R7D
    ['C4-5X', 120], // → R7X
    ['C6-2A', 120], // → R8A
    ['C6-3A', 135], // → R9A
    ['C2-7X', 160], // → R9X
    ['C6-4A', 185], // → R10A
  ])('%s → equivalent contextual height %i ft', (zone, ft) => {
    expect(resolveNyc(zone).heightFt).toBe(ft)
  })
})

describe('resolveNyc — NON-contextual districts are sky-exposure-plane governed → null (honest)', () => {
  it.each([
    'R6', // no letter → height-factor / sky-exposure plane, not a flat cap
    'R7-1',
    'R7-2',
    'R8',
    'R10',
  ])('%s → height null (no flat cap published)', (zone) => {
    expect(resolveNyc(zone).heightFt).toBeNull()
  })

  it('C6-7 (downtown, residential equivalent bare R10) → null height', () => {
    // C6-7 maps to R10 (no letter) in ZR 34-112 → sky-exposure governed → null.
    // This is exactly the parcel.test.ts NYC fixture: maxHeightFt must stay null.
    expect(resolveNyc('C6-7').heightFt).toBeNull()
  })

  it('R9D and R10X are intentionally absent (Table-1 max height is N/A → tower regs) → null', () => {
    expect(resolveNyc('R9D').heightFt).toBeNull()
    expect(resolveNyc('R10X').heightFt).toBeNull()
    expect('R9D' in NYC_CONTEXTUAL_HEIGHTS).toBe(false)
    expect('R10X' in NYC_CONTEXTUAL_HEIGHTS).toBe(false)
  })
})

describe('resolveNyc — unknown / empty / garbage → null (never fabricated)', () => {
  it.each([null, undefined, '', 'not-a-zone', 'M1-1', 'PARK'])('%s → both null', (zone) => {
    expect(resolveNyc(zone)).toEqual({ far: null, heightFt: null })
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveNyc('  r7a  ').heightFt).toBe(80)
  })
  it('strips a commercial-overlay tail ("R7A/C2-4" → R7A)', () => {
    expect(resolveNyc('R7A/C2-4').heightFt).toBe(80)
  })
})

describe('NYC_LIMITS static table stays in lock-step with resolveNyc', () => {
  it('covers the 12 contextual districts + C-equivalents + non-contextual examples', () => {
    expect(Object.keys(NYC_LIMITS).length).toBeGreaterThanOrEqual(12)
  })
  it('each stored entry equals the resolver output for that district', () => {
    for (const [district, limits] of Object.entries(NYC_LIMITS)) {
      expect(limits).toEqual(resolveNyc(district))
    }
  })
  it('every contextual-height entry has a null FAR (FAR is PLUTO-sourced)', () => {
    for (const limits of Object.values(NYC_LIMITS)) {
      expect(limits.far).toBeNull()
    }
  })
})

describe('NYC_COMMERCIAL_EQUIVALENT only maps to districts present in the height table', () => {
  it('every commercial equivalent resolves to a known contextual height', () => {
    for (const equiv of Object.values(NYC_COMMERCIAL_EQUIVALENT)) {
      expect(equiv in NYC_CONTEXTUAL_HEIGHTS).toBe(true)
    }
  })
})
