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

// ── Article 7 heights come from the DZC's printed "Feet (max)" row ──────────
// Read 2026-08-05 from DZC Article 7 (Urban Center), Division 7.3, Sec. 7.3.3
// "Building Form Standards for Primary Structures":
//   §7.3.3.3.D "General",   printed page 7.3-13  (C-MX, C-RX)
//   §7.3.3.3.I "Shopfront", printed page 7.3-23  (C-MS)
// Republished February 25, 2025 edition.
//
// EACH CASE NAMES THE NUMBER THAT USED TO SHIP. This module derived height as
// stories × 12 and published feet that were 10-17% short of the code's own
// figure. If any of these regress to the "was" value, the ×12 derivation is
// back. Do NOT "fix" these by dividing heightFt by a floor-to-floor constant —
// that round-trip is CLAUDE.md rule 12.
describe('Article 7 heights are the DZC printed feet, NOT stories × 12', () => {
  it.each([
    // zone,      code feet, code stories, old wrong feet, citation
    ['C-MX-5', 70, 5, 60, '§7.3.3.3.D General, p. 7.3-13'],
    ['C-MX-8', 110, 8, 96, '§7.3.3.3.D General, p. 7.3-13'],
    ['C-MX-12', 150, 12, 144, '§7.3.3.3.D General, p. 7.3-13'],
    ['C-RX-5', 70, 5, 60, '§7.3.3.3.D General, p. 7.3-13 (shares the C-MX-5 column)'],
    ['C-MS-5', 70, 5, 60, '§7.3.3.3.I Shopfront, p. 7.3-23'],
  ])(
    '%s → %i ft / %i stories per DZC (was %i ft = stories × 12) — %s',
    (zone, codeFeet, codeStories, oldWrongFeet) => {
      const r = resolveDenver(zone as string)
      expect(r.heightFt).toBe(codeFeet)
      expect(r.heightFt).not.toBe(oldWrongFeet)
      // The story count was already correct and must survive the feet fix.
      expect(r.stories).toBe(codeStories)
      expect(r.heightBasis).toBe('code-stated')
    },
  )

  // The rest of the same two tables, read in the same pass.
  it.each([
    ['C-MX-3', 45, 3],
    ['C-MX-16', 200, 16],
    ['C-MX-20', 250, 20],
    ['C-RX-8', 110, 8],
    ['C-RX-12', 150, 12],
    ['C-MS-8', 110, 8],
    ['C-MS-12', 150, 12],
  ])('%s → %i ft / %i stories (same DZC tables)', (zone, feet, stories) => {
    const r = resolveDenver(zone as string)
    expect(r.heightFt).toBe(feet)
    expect(r.stories).toBe(stories)
    expect(r.heightBasis).toBe('code-stated')
  })

  it('never publishes the Sec. 10.12.1 incentive heights (earned, not by-right)', () => {
    // DZC prints "Stories/Feet, with incentives (max)" directly under the
    // by-right row. Those are bonus tiers — CLAUDE.md rule 6.
    const incentive: Record<string, [number, number]> = {
      'C-MX-5': [7, 95],
      'C-MX-8': [12, 150],
      'C-MX-12': [16, 200],
      'C-MX-16': [22, 275],
      'C-MX-20': [30, 375],
    }
    for (const [zone, [stories, feet]] of Object.entries(incentive)) {
      const r = resolveDenver(zone)
      expect(r.stories, zone).not.toBe(stories)
      // C-MX-8's incentive height (150') equals C-MX-12's by-right height, so
      // assert per-district rather than globally.
      expect(r.heightFt, zone).toBeLessThan(feet)
    }
  })
})

describe('resolveDenver — unverified districts keep the labelled ×12 estimate', () => {
  it.each([
    ['G-MU-3', 36],
    ['U-MX-2', 24],
    ['U-MS-5', 60],
    ['U-RH-2.5', 30], // 2.5 stories → 30 ft
    ['S-MX-8', 96],
  ])('%s → %i ft, flagged derived-estimate', (zone, ft) => {
    const r = resolveDenver(zone as string)
    expect(r.heightFt).toBe(ft)
    expect(r.heightBasis).toBe('derived-estimate')
  })

  it('DENVER_FT_PER_STORY stays 12 and is NOT applied to code-stated districts', () => {
    expect(DENVER_FT_PER_STORY).toBe(12)
    // The assertion this replaced was `heightFt === 5 * DENVER_FT_PER_STORY`
    // for C-MX-5. It passed, and it was defending a 10-ft understatement.
    expect(resolveDenver('C-MX-5').heightFt).not.toBe(5 * DENVER_FT_PER_STORY)
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

describe('special-purpose suffix variants resolve to the base tier', () => {
  // DZC Article 2 § 2.3.1.2.B: the third number is "Maximum Building Height in
  // stories"; a trailing letter is "an indicator of special regulations —
  // x = Special provisions tailored to that zone district. A = Special
  // provisions, especially design standards or allowed building forms".
  //
  // ⚠️ VERIFIED AGAINST ARTICLE 3's TABLES, not inferred from that sentence.
  // "Allowed building forms" could plausibly move height, and 23 plausible wrong
  // heights is the expensive direction. The suffixed rows carry the SAME stories
  // and feet as the base at every tier.

  it.each([
    ['S-MX-2A', 2], ['S-MX-3A', 3], ['S-MX-5A', 5], ['S-MX-8A', 8], ['S-MX-12A', 12],
    ['E-MX-2A', 2], ['E-MX-3A', 3], ['M-RX-5A', 5],
    ['E-MX-2X', 2], ['E-MS-2X', 2], ['U-MX-2X', 2], ['U-MS-2X', 2],
    ['E-CC-3X', 3], ['S-CC-3X', 3], ['S-CC-5X', 5],
  ])('%s resolves to %i stories', (code, stories) => {
    expect(resolveDenver(code).stories).toBe(stories)
  })

  it('a suffixed code matches its unsuffixed base exactly', () => {
    // Article 3, HEIGHT rows: S-MX-2x 2 st/30', S-MX-2 2 st/30', S-MX-2A 2 st/30'.
    for (const [suffixed, base] of [['S-MX-2A', 'S-MX-2'], ['S-MX-5A', 'S-MX-5'], ['E-MX-3A', 'E-MX-3']]) {
      expect(resolveDenver(suffixed).stories, `${suffixed} vs ${base}`).toBe(resolveDenver(base).stories)
    }
  })

  it('does NOT invent a height for a former Chapter 59 letter code', () => {
    // THE OVER-MATCH GUARD. `R-2-A`, `B-8-A`, `R-3-X` end in a letter too, but
    // their trailing segment carries no digits, so the widened pattern cannot
    // reach them. Chapter 59 numbers are CLASS codes, never story counts —
    // reading one as a height is the defect this module already carries a
    // warning about.
    for (const legacy of ['R-2-A', 'R-2-B', 'B-8-A', 'B-8-G', 'R-3-X', 'R-4-X', 'R-X', 'OS-A']) {
      // `?? null` because an unresolved DistrictLimits omits `stories`
      // entirely — undefined and null both mean 'no story count', and the
      // assertion is about the absence, not which flavour of empty it is.
      expect(resolveDenver(legacy).stories ?? null, legacy).toBeNull()
    }
  })

  it('still refuses a bare unrecognised code', () => {
    expect(resolveDenver('CMP-H').stories ?? null).toBeNull()
    expect(resolveDenver('D-C').stories ?? null).toBeNull()
  })
})

describe('Downtown: the number in the district name is NOT a story count', () => {
  // ⚠️ THE TRAP THIS PINS. Articles 3–7 name the maximum building height in the
  // third number — S-MX-2A is 2 storeys — and the suffix-variant fix above
  // relies on that. DOWNTOWN DOES NOT WORK THAT WAY, and DZC Article 2 § 2.3.2
  // says so outright: "The Downtown Neighborhood Context is organized
  // differently than Articles 3 through 7… The first letter is 'D'… The second
  // letters are abbreviations for the specific neighborhood within Downtown."
  //
  // Read from Article 8 (June 25, 2010 | Republished February 25, 2025),
  // Division 8.8, GENERAL building form:
  //     HEIGHT              D-AS-12+     D-AS-20+
  //     Stories (max)          8            12
  //     Feet (max)           110'         150'
  //
  // So D-AS-12+ is an EIGHT storey district. Anyone extending the story-number
  // heuristic to downtown would publish 12 — a 50% overstatement — and it would
  // look right, because every other Denver context reads that way.
  //
  // These must stay UNRESOLVED until Article 8's per-building-form tables are
  // curated. Each district carries several forms with different heights, which
  // is the wide-grid shape that produced DC's MU-column off-by-one and the
  // reason zoning/atlanta.ts left SPI uncurated rather than curating it quickly.

  it.each(['D-AS-12+', 'D-AS-20+', 'D-AS', 'D-C', 'D-CV', 'D-GT', 'D-LD', 'D-TD', 'DIA', 'D-CPV-C', 'D-CPV-R', 'D-CPV-T'])(
    '%s resolves to nothing rather than guessing',
    (code) => {
      const r = resolveDenver(code)
      expect(r.stories ?? null, `${code} invented a story count`).toBeNull()
      expect(r.heightFt ?? null, `${code} invented a height`).toBeNull()
    },
  )

  it('specifically: D-AS-12+ must never report 12 storeys', () => {
    // The single assertion that would catch the plausible wrong fix.
    expect(resolveDenver('D-AS-12+').stories ?? null).not.toBe(12)
    expect(resolveDenver('D-AS-20+').stories ?? null).not.toBe(20)
  })

  it('and the trailing "+" is what keeps them out of the story parse', () => {
    // The widened suffix pattern accepts an optional trailing LETTER. A trailing
    // "+" is not a letter, so downtown cannot fall into it by accident — but the
    // protection is incidental, which is why it is pinned here.
    expect(/-(\d+(?:\.\d+)?)[A-Z]?$/.test('D-AS-12+')).toBe(false)
    expect(/-(\d+(?:\.\d+)?)[A-Z]?$/.test('S-MX-12A')).toBe(true)
  })
})
