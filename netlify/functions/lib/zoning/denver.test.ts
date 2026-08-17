import { describe, it, expect } from 'vitest'
import { resolveDenver, DENVER_LIMITS, DENVER_FT_PER_STORY, DENVER_PROTECTED_DISTRICTS, isDenverProtectedDistrict, denverProtectedDistrictRule, denverHeightNearProtected } from './denver'
import { isPlannedDevelopment } from './plannedDevelopment'

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
  it('the FORM-BASED entries are height-governed with no FAR', () => {
    // ⚠️ NARROWED 2026-08-17. This asserted `far === null` and `heightFt !== null`
    // for EVERY entry, under the heading "height-governed depth" — true of the
    // Articles 3-7 context-and-form districts, and asserted of the whole table.
    //
    // Article 9 disproves the universal: the INDUSTRIAL siting table carries
    // "Floor Area Ratio (FAR) (max) … I-A 2.0 · I-B 2.0", and their HEIGHT rows
    // read "na" with a 75' cap only near a Protected District. So I-A/I-B are
    // the exact inverse of the claim — a FAR and no usable height.
    //
    // A scope-limited truth asserted universally is rule 15's shape, and it was
    // green until a district outside the scope was encoded.
    // OS-A joins them: § 9.3.3.1 leaves its form standards to City Council /
    // the Manager of Parks, so it carries no height, no storeys and no FAR claim.
    const ARTICLE_9_EXCEPTIONS = new Set(['I-A', 'I-B', 'MHC', 'OS-A'])
    let formBased = 0
    for (const [district, limits] of Object.entries(DENVER_LIMITS)) {
      if (ARTICLE_9_EXCEPTIONS.has(district)) continue
      formBased++
      expect(limits.far, district).toBeNull()
      expect(limits.heightFt, district).not.toBeNull()
    }
    // Pinned so the exception set cannot quietly swallow the whole table.
    expect(formBased).toBeGreaterThanOrEqual(20)
  })

  it('and the Article 9 exceptions are exactly what the code says', () => {
    expect(DENVER_LIMITS['OS-A']).toEqual({ far: null, heightFt: null, planGoverned: true })
    expect(DENVER_LIMITS['I-A']).toEqual({ far: 2.0, heightFt: null })
    expect(DENVER_LIMITS['I-B']).toEqual({ far: 2.0, heightFt: null })
    expect(DENVER_LIMITS['MHC'].heightFt).toBe(20)
    expect(DENVER_LIMITS['MHC'].farUnconstrained).toBe(true)
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

describe('Campus (CMP) is read but deliberately unresolved', () => {
  // The hypothesis — that CMP is plan-governed and belongs in the
  // planned-development registry — was tested against Article 9 and REJECTED:
  // Division 9.2 gives each campus district a published height table. So it is a
  // curation job, and the blocker is not the code but a locational fact.
  //
  // CMP-H is 200' generally and 75' within 125' of a Protected District. We do
  // not know which applies to a given parcel, and these districts resolve to
  // NOTHING today — so encoding the base max would introduce a fresh 2.7x
  // overstatement exactly where the reduction bites. Refusing is the same call
  // zoning/seattle.ts makes for LR3 without a resolved urban-centre boundary.

  it.each(['CMP-H', 'CMP-H2', 'CMP-EI', 'CMP-EI2', 'CMP-NWC', 'CMP-NWC-C', 'CMP-NWC-G', 'CMP-NWC-F', 'CMP-NWC-R'])(
    '%s stays unresolved rather than publishing its unconditioned maximum',
    (code) => {
      const r = resolveDenver(code)
      expect(r.heightFt ?? null, `${code} published a height without knowing the Protected District distance`).toBeNull()
      expect(r.stories ?? null).toBeNull()
    },
  )

  it('specifically: CMP-H must not publish 200 feet', () => {
    // The number a naive curation would take straight from the table.
    expect(resolveDenver('CMP-H').heightFt ?? null).not.toBe(200)
    expect(resolveDenver('CMP-EI').heightFt ?? null).not.toBe(150)
  })

  it('and CMP is NOT in the planned-development registry', () => {
    // The rejected hypothesis, pinned — so nobody re-adds it on the intuition
    // that "campus" sounds plan-governed. Article 9 § 9.2 publishes the tables.
    expect(isPlannedDevelopment('denver', 'CMP-H')).toBe(false)
    expect(isPlannedDevelopment('denver', 'CMP-NWC')).toBe(false)
  })
})

describe('Article 9 industrial and manufactured-home districts', () => {
  // I-A / I-B carry a published FAR that was never encoded; MHC carries a single
  // unconditional height. Both read from Article 9 of the republished-2025 code.

  it('I-A and I-B publish FAR 2.0 from the ZONE LOT row', () => {
    // "Floor Area Ratio (FAR) (max)  I-MX-3 na · I-MX-5 na · I-MX-8 na ·
    //  I-MX-12 na · I-A 2.0 · I-B 2.0" — the I-MX columns are the slot filled
    // with an explicit absence, which is what makes the 2.0 a figure and not a
    // guess about a blank.
    expect(resolveDenver('I-A').far).toBe(2.0)
    expect(resolveDenver('I-B').far).toBe(2.0)
  })

  it('but I-A and I-B publish NO height, because it depends on a distance', () => {
    // HEIGHT: Stories na, Feet na — no general maximum — then "Feet within 175'
    // of a Protected District (max) 75'". Publishing "unlimited" would be wrong
    // for any industrial parcel near one, and these resolved to nothing before,
    // so it would be a NEW error rather than an inherited one.
    expect(resolveDenver('I-A').heightFt).toBeNull()
    expect(resolveDenver('I-B').heightFt).toBeNull()
    // And specifically NOT claimed as an established absence of a height limit.
    expect(resolveDenver('I-A').farUnconstrained ?? false).toBe(false)
  })

  it('MHC is 20 feet, code-stated', () => {
    const r = resolveDenver('MHC')
    expect(r.heightFt).toBe(20)
    expect(r.heightBasis).toBe('code-stated')
  })

  it('MHC has no FAR — established by the SLOT TEST, not by a blank', () => {
    // The industrial siting table carries a "ZONE LOT / Floor Area Ratio" row;
    // the MHC siting table has no ZONE LOT section at all. The document's own
    // structure is the evidence (rule 5), which is why this may be asserted as
    // an absence rather than left unresolved.
    expect(resolveDenver('MHC').farUnconstrained).toBe(true)
    expect(resolveDenver('MHC').far).toBeNull()
  })

  // The companion assertion — that these are not read as former Chapter 59
  // despite carrying the 999 sentinel — lives in providers/denver.test.ts,
  // where isFormerChapter59 is defined.
})

describe('Open Space (Article 9 Division 9.3) is current, not former Chapter 59', () => {
  // ⚠️ TRIAGED WRONG ON THE PREFIX. OS-A/OS-B/OS-C were grouped with the legacy
  // family because they start "OS-". Reading the Former Chapter 59 document
  // (Supplement 103, May 2010) disproved it: they have ZERO occurrences there.
  // The legacy open-space district is OS-1, which does appear.

  it('OS-B and OS-C are 3 storeys / 40 feet, code-stated', () => {
    // Division 9.3 GENERAL form: "Stories (max) 3 · Feet, pitched or Low-Slope
    // Roof (max) 40'". No Protected District row, no incentive row.
    for (const c of ['OS-B', 'OS-C']) {
      expect(resolveDenver(c).stories, c).toBe(3)
      expect(resolveDenver(c).heightFt, c).toBe(40)
      expect(resolveDenver(c).heightBasis, c).toBe('code-stated')
    }
  })

  it('OS-A publishes no form standards — an authority sets them', () => {
    // § 9.3.3.1: "In the OS-A zone district, the City Council shall have final
    // approval authority over the form of certain building according to
    // D.R.M.C., Chapter 39 (Parks). For all other buildings or structures, the
    // Manager of Parks and Recreation shall determine all applicable building
    // form standards." A limit EXISTS and is not in a table — an answer.
    const r = resolveDenver('OS-A')
    expect(r.planGoverned).toBe(true)
    expect(r.heightFt).toBeNull()
    // And specifically NOT a fabricated height from the "A" suffix.
    expect(r.stories ?? null).toBeNull()
  })

  it('OS-1 IS legacy and must not take a storey count from its class code', () => {
    // The discriminator, and the trap: OS-1's trailing "1" is a class code. The
    // stories parse reads it as one storey unless the caller passes the legacy
    // flag — which is the sweep bug this test also pins.
    expect(resolveDenver('OS-1', { formerChapter59: true }).stories ?? null).toBeNull()
    expect(resolveDenver('OS-1', { formerChapter59: true }).heightFt).toBeNull()
  })
})

describe('Protected Districts — enumerated from two codes', () => {
  // DZC Article 13 § 13.3 lists 31 districts by name, then item 32 defers to
  // Former Chapter 59 § 59-96(a), which names seven more: "RS-4, R-X, R-0, R-1,
  // R-2, R-2-A or R-2-B (hereinafter called the protected districts)".
  // The set therefore spans both codes — 38 in total.

  it('carries all 38, from both sources', () => {
    expect(DENVER_PROTECTED_DISTRICTS.size).toBe(38)
    // One from each half, so a partial edit cannot pass.
    expect(isDenverProtectedDistrict('U-SU-A')).toBe(true)   // Art 13 item 18
    expect(isDenverProtectedDistrict('R-2-A')).toBe(true)    // FC59 § 59-96(a)
  })

  it('is ENUMERATED, so a near-miss is not protected', () => {
    // ⚠️ The reason this is a list and not a regex. U-SU-A is protected;
    // U-SU-A1 is not. E-SU-Dx is; E-MX-2x is not. A pattern over "SU" or "RH"
    // would be a guess wearing a citation — rule 27's shape exactly.
    expect(isDenverProtectedDistrict('U-SU-A1')).toBe(false)
    expect(isDenverProtectedDistrict('E-MX-2X')).toBe(false)
    expect(isDenverProtectedDistrict('S-MX-3')).toBe(false)
    expect(isDenverProtectedDistrict('R-3')).toBe(false)
  })

  it('the reduction rule carries the right distance per district', () => {
    // Article 9: CMP-H/H2 are 125 feet; CMP-EI/EI2 and the NWC family 175.
    expect(denverProtectedDistrictRule('CMP-H')).toMatchObject({ withinFt: 125, maxFt: 75 })
    expect(denverProtectedDistrictRule('CMP-H2')).toMatchObject({ withinFt: 125, maxFt: 75 })
    expect(denverProtectedDistrictRule('CMP-EI')).toMatchObject({ withinFt: 175, maxFt: 75 })
    expect(denverProtectedDistrictRule('I-A')).toMatchObject({ withinFt: 175, maxFt: 75 })
  })

  it('CMP-NWC-R has NO reduction, and must not be given one', () => {
    // Its table reads 40' generally AND 40' within the buffer. Handing it a 75'
    // cap would RAISE a district the code holds at 40 — the flattering
    // direction, produced by generalising the family.
    expect(denverProtectedDistrictRule('CMP-NWC-R')).toBeNull()
  })

  it('districts with no such rule return null rather than a default', () => {
    for (const c of ['S-MX-3', 'U-SU-A', 'MHC', 'OS-B', 'D-C']) {
      expect(denverProtectedDistrictRule(c), c).toBeNull()
    }
  })
})

describe('height conditioned on Protected District proximity', () => {
  // The three-state contract. `nearProtected` is true / false / null, and the
  // third is not a formality: CMP-H is 75 ft inside the buffer and 200 ft
  // outside, so collapsing "we could not find out" into "not nearby" publishes
  // the taller figure on a parcel that may be capped at a third of it.

  it('resolves BOTH directions when the distance is known', () => {
    expect(denverHeightNearProtected('CMP-H', false)?.heightFt).toBe(200)
    expect(denverHeightNearProtected('CMP-H', true)?.heightFt).toBe(75)
    expect(denverHeightNearProtected('CMP-H2', false)?.heightFt).toBe(140)
    expect(denverHeightNearProtected('CMP-EI', false)?.heightFt).toBe(150)
    expect(denverHeightNearProtected('CMP-EI', true)?.heightFt).toBe(75)
  })

  it('REFUSES when the distance is unknown — null is not "not nearby"', () => {
    for (const c of ['CMP-H', 'CMP-H2', 'CMP-EI', 'CMP-EI2', 'CMP-NWC']) {
      expect(denverHeightNearProtected(c, null)?.heightFt, c).toBeNull()
      expect(denverHeightNearProtected(c, undefined)?.heightFt, c).toBeNull()
    }
  })

  it('and says WHY it refused, naming both figures', () => {
    const r = denverHeightNearProtected('CMP-H', null)!
    expect(r.source).toMatch(/200 ft generally/)
    expect(r.source).toMatch(/75 ft within 125 ft/)
    expect(r.source).toMatch(/unresolved/)
  })

  it('CMP-NWC-R resolves to 40 ft WITHOUT the distance, because it has no reduction', () => {
    // ⚠️ THE POSITIVE HALF of excluding it from the reduction rule. Asserting
    // only that it is absent from the rule would still pass if someone later
    // added it — this pins the figure the code actually states, 40 ft both
    // generally and within the buffer. Handing it the family's 75 ft cap would
    // RAISE a district the code holds at 40.
    expect(denverHeightNearProtected('CMP-NWC-R', null)?.heightFt).toBe(40)
    expect(denverHeightNearProtected('CMP-NWC-R', true)?.heightFt).toBe(40)
    expect(denverHeightNearProtected('CMP-NWC-R', false)?.heightFt).toBe(40)
  })

  it('is null for districts with no such conditional at all', () => {
    for (const c of ['S-MX-3', 'OS-B', 'MHC', 'D-C', 'R-2']) {
      expect(denverHeightNearProtected(c, false), c).toBeNull()
    }
  })
})
