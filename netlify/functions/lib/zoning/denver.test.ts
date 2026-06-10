import { describe, it, expect } from 'vitest'
import { resolveDenver, DENVER_LIMITS, DENVER_FT_PER_STORY } from './denver'

// Denver is a FORM-BASED code: the common districts are height-governed (stories
// × ft/story) with NO floor-area ratio. So every assertion checks far === null
// and a stories-derived height. The null FAR here is DEPTH, not a gap.
describe('resolveDenver — form-based FAR is always null', () => {
  it.each(['C-MX-5', 'G-MU-3', 'U-RH-2.5', 'U-SU-A', 'C-MX-8', 'S-MX-3'])(
    '%s → far null (Denver has no FAR for form-based districts)',
    (zone) => {
      expect(resolveDenver(zone).far).toBeNull()
    },
  )
})

describe('resolveDenver — height from the trailing stories token (×12 ft)', () => {
  it.each([
    ['C-MX-5', 60],
    ['G-MU-3', 36],
    ['C-MX-8', 96],
    ['C-MX-12', 144],
    ['U-MX-2', 24],
    ['U-MS-5', 60],
    ['U-RH-2.5', 30], // 2.5 stories → 30 ft
    ['S-MX-8', 96],
  ])('%s → %i ft', (zone, ft) => {
    expect(resolveDenver(zone).heightFt).toBe(ft)
  })

  it('uses DENVER_FT_PER_STORY = 12 as the floor-to-floor estimate', () => {
    expect(DENVER_FT_PER_STORY).toBe(12)
    expect(resolveDenver('C-MX-5').heightFt).toBe(5 * DENVER_FT_PER_STORY)
  })
})

describe('resolveDenver — single/two-unit + row-house letter suffixes cap at 30 ft', () => {
  it.each(['U-SU-A', 'U-SU-B', 'U-TU-B'])('%s → 30 ft', (zone) => {
    expect(resolveDenver(zone).heightFt).toBe(30)
  })
  it('a code not in the table but matching the SU/TU/RH pattern → 30 ft', () => {
    expect(resolveDenver('E-SU-G').heightFt).toBe(30) // not in table; pattern caps at 30
  })
})

describe('resolveDenver — Former Chapter 59 guard', () => {
  it('suppresses the stories read when formerChapter59 is set (trailing number is a class)', () => {
    expect(resolveDenver('B-3', { formerChapter59: true })).toEqual({ far: null, heightFt: null })
  })
  it('without the flag, a legacy-looking code still parses its trailing token', () => {
    expect(resolveDenver('B-3').heightFt).toBe(36) // 3 × 12
  })
})

describe('resolveDenver — unknown / empty → null', () => {
  it.each([null, undefined, '', 'not-a-zone', 'D-C'])('%s → both null', (zone) => {
    // "D-C" (Downtown Core) has no trailing stories token → height not derivable.
    expect(resolveDenver(zone)).toEqual({ far: null, heightFt: null })
  })
})

describe('DENVER_LIMITS static table', () => {
  it('covers ≥20 common districts', () => {
    expect(Object.keys(DENVER_LIMITS).length).toBeGreaterThanOrEqual(20)
  })
  it('every entry has a null FAR and a known height (height-governed depth)', () => {
    for (const limits of Object.values(DENVER_LIMITS)) {
      expect(limits.far).toBeNull()
      expect(limits.heightFt).not.toBeNull()
    }
  })
  it('table entries match the resolver exactly', () => {
    for (const [district, limits] of Object.entries(DENVER_LIMITS)) {
      expect(resolveDenver(district)).toEqual(limits)
    }
  })
})
