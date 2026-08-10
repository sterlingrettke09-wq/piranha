import { describe, it, expect } from 'vitest'
import {
  LAS_VEGAS_DISTRICT_CODES,
  LAS_VEGAS_UNREADABLE_CODES,
  parseLasVegasZone,
  resolveLasVegas,
  usesForZone,
} from './lasvegas'

describe('resolveLasVegas — heights, exactly as Title 19 prints them', () => {
  // LVMC 19.06.070 Table 3 BUILDING HEIGHT: "A. Stories 2 max", "B. Flat Roof -
  // Max. Height 35 feet measured to the top of the roof coping".
  it('R-1 publishes 2 stories AND 35 feet, both from the same table row', () => {
    const l = resolveLasVegas('R-1')
    expect(l.maxStories).toBe(2)
    expect(l.maxHeightFt).toBe(35)
    expect(l.heightSource).toContain('19.06.070')
  })

  it('R-TH is 3/45 and R-3 is 5/55 — the code states different pairs', () => {
    expect(resolveLasVegas('R-TH').maxStories).toBe(3)
    expect(resolveLasVegas('R-TH').maxHeightFt).toBe(45)
    expect(resolveLasVegas('R-3').maxStories).toBe(5)
    expect(resolveLasVegas('R-3').maxHeightFt).toBe(55)
  })

  it('C-PB is 5/85 — LVMC 19.08.085, not the roster pointer 19.08.090', () => {
    const l = resolveLasVegas('C-PB')
    expect(l.maxStories).toBe(5)
    expect(l.maxHeightFt).toBe(85)
    // §19.00.100(B)(2)'s roster sends C-PB to 19.08.090, which is actually C-M.
    // Citations follow the chapter's own section headings.
    expect(l.heightSource).toContain('19.08.085')
    expect(l.heightSource).not.toContain('19.08.090')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE MIAMI-21 / DENVER CASE, made arithmetically impossible
  // ══════════════════════════════════════════════════════════════════════════

  // Title 19 states four story/foot pairs. If a single feet-per-story constant
  // existed, one number would reproduce all four. None does — 2/35 implies
  // 17.50, 3/45 implies 15.00, 5/55 implies 11.00 and 5/85 implies 17.00. The
  // source document carries its own disproof, exactly as Raleigh's did, and this
  // test is what stops anyone re-deriving one figure from the other.
  it('no feet-per-story constant reproduces the pairs the code states', () => {
    const pairs = [
      ['R-1', 2, 35],
      ['R-TH', 3, 45],
      ['R-3', 5, 55],
      ['C-PB', 5, 85],
    ] as const
    for (const [code, stories, feet] of pairs) {
      const l = resolveLasVegas(code)
      expect(l.maxStories).toBe(stories)
      expect(l.maxHeightFt).toBe(feet)
    }
    // Sweep every plausible convention at 0.01 ft resolution.
    for (let ftPerStory = 8; ftPerStory <= 20; ftPerStory += 0.01) {
      const reproduced = pairs.filter(([, stories, feet]) => Math.abs(stories * ftPerStory - feet) < 0.5)
      expect(reproduced.length).toBeLessThan(pairs.length)
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // The Form-Based Code: stories only, and no feet may be invented
  // ══════════════════════════════════════════════════════════════════════════

  it('every transect zone carries stories and NO height in feet', () => {
    const fbc = ['T3-N', 'T4-N', 'T4-MS', 'T4-C', 'T5-N', 'T5-M', 'T5-MS', 'T5-C', 'T6-UG', 'T6-UC']
    for (const z of fbc) {
      const l = resolveLasVegas(z)
      expect(l.maxStories, z).toBeGreaterThan(0)
      expect(l.maxHeightFt, z).toBeNull()
    }
  })

  it('T6-UC is 5 min – 20 max stories; T4-N is 3 max', () => {
    expect(resolveLasVegas('T6-UC').minStories).toBe(5)
    expect(resolveLasVegas('T6-UC').maxStories).toBe(20)
    expect(resolveLasVegas('T4-N').minStories).toBeNull()
    expect(resolveLasVegas('T4-N').maxStories).toBe(3)
  })

  // §19.09.050.E's building-form table carries "Ground floor 13 ft min." and
  // "Upper floors 9 ft min." Those are minimum CLEAR HEIGHTS per floor. Turning
  // 20 stories into 260 ft (or 180) with them is the invented conversion rule 4
  // forbids, and the round trip rule 12 forbids. Nothing in the module may hold a
  // number that could serve as one.
  it('holds no floor-to-floor constant that a height could be derived from', () => {
    for (const z of ['T6-UC', 'T6-UG', 'T5-M', 'T3-N']) {
      const l = resolveLasVegas(z)
      const derived = [9, 10, 11, 12, 13, 13.5, 14].map((c) => (l.maxStories ?? 0) * c)
      expect(derived).not.toContain(l.maxHeightFt)
      expect(l.maxHeightFt).toBeNull()
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // "NA" is neither a ceiling nor an absence (FACT 4)
  // ══════════════════════════════════════════════════════════════════════════

  it('a district whose height table prints "NA" publishes no number and claims no absence', () => {
    for (const z of ['R-4', 'C-1', 'C-2', 'C-M', 'M']) {
      const l = resolveLasVegas(z)
      expect(l.heightTableNA, z).toBe(true)
      expect(l.maxStories, z).toBeNull()
      expect(l.maxHeightFt, z).toBeNull()
      expect(l.heightSource, z).toContain('NA')
    }
  })

  // The module must not grow a `heightUnconstrained` flag by the back door. The
  // temptation is real — C-1/C-2/R-4 footnote 2 caps only MIXED-USE development,
  // which reads as if the base were uncapped — but Title 19 nowhere says what
  // "NA" means, and rule 1 gives an argued mechanism no direction at all.
  it('never asserts that any district has no maximum height', () => {
    for (const code of ['R-1', 'R-4', 'C-2', 'M', 'T6-UC', 'P-C', 'R-A']) {
      expect(Object.keys(resolveLasVegas(code))).not.toContain('heightUnconstrained')
    }
  })

  // The mixed-use footnote is conditional on a Master Plan boundary that is
  // published as no layer, so it may be disclosed and must never be the figure.
  it('the mixed-use 10-story / 150-ft footnote is an alternative, never the headline', () => {
    for (const z of ['R-4', 'C-1', 'C-2']) {
      const l = resolveLasVegas(z)
      expect(l.maxStories, z).toBeNull()
      expect(l.maxHeightFt, z).toBeNull()
      const alt = l.heightAlternatives?.find((a) => a.stories === 10)
      expect(alt, z).toBeTruthy()
      expect(alt!.heightFt).toBe(150)
      expect(alt!.source).toContain('revitalization area')
    }
  })

  // C-PB is the rule-6 case: 5 stories / 85 ft is the table figure, but
  // footnote 3 cuts commercial and retail uses to 2 stories / 35 ft. The lower
  // limb must be carried, so the headline is never read as use-agnostic.
  it('C-PB carries the LOWER commercial/retail limb as well as the table figure', () => {
    const alts = resolveLasVegas('C-PB').heightAlternatives ?? []
    const retail = alts.find((a) => a.label.includes('commercial and retail'))
    expect(retail).toBeTruthy()
    expect(retail!.stories).toBe(2)
    expect(retail!.heightFt).toBe(35)
    expect(retail!.discretionary).toBe(false)
  })

  // T4-C's 8 stories and T5-C's 10 need a Major Site Development Plan Review and
  // a specific building type. They are not by-right and must be flagged as such.
  it('marks the Flex building-type story bonuses as discretionary', () => {
    const t4 = resolveLasVegas('T4-C').heightAlternatives ?? []
    const t5 = resolveLasVegas('T5-C').heightAlternatives ?? []
    expect(t4[0].stories).toBe(8)
    expect(t4[0].discretionary).toBe(true)
    expect(t5[0].stories).toBe(10)
    expect(t5[0].discretionary).toBe(true)
    // …and they must not have leaked into the published maximum.
    expect(resolveLasVegas('T4-C').maxStories).toBe(5)
    expect(resolveLasVegas('T5-C').maxStories).toBe(7)
  })
})

describe('resolveLasVegas — the FAR absence is an ANSWER, and it is refused where it would be a guess', () => {
  // ESTABLISHED BY THE SLOT TEST, not by failing to find a number:
  //   §19.08.040(A) enumerates the dimensional standards the district tables
  //   govern and FAR is not in the list; no district table in 19.06/19.08/19.09
  //   has a FAR row; and "floor area ratio" occurs in the whole of Title 19 only
  //   in §19.18.020 (definition), §19.18.030(A)(6) (measurement rule) and
  //   §19.18.020's "Intensity of Use" definition — never as a district limit.
  it('every district read from 19.06 / 19.08 / 19.09 sets farUnconstrained', () => {
    const read = [
      'U', 'R-E', 'R-D', 'R-1', 'R-SL', 'R-CL', 'R-TH', 'R-2', 'R-3', 'R-4', 'R-MH',
      'P-O', 'O', 'C-D', 'C-1', 'C-2', 'C-PB', 'C-M', 'M',
      'T3-N', 'T4-N', 'T4-MS', 'T4-C', 'T5-N', 'T5-M', 'T5-MS', 'T5-C', 'T6-UG', 'T6-UC',
    ]
    for (const z of read) expect(resolveLasVegas(z).farUnconstrained, z).toBe(true)
  })

  // THE REFUSAL. These six districts publish no dimensional table at all; their
  // standards live in a Planned Community Program, a Master Development Plan, a
  // Town Center Development Standards Manual, a Development Standards and Design
  // Guidelines document, or a Site Development Plan Review approval — none of
  // which is in any dataset. An unread plan may impose a floor-area limit, so
  // claiming the code imposes none would be a rule-5 violation. This is the
  // opposite call from Raleigh's PD and the same call as Atlanta's PD-H.
  it('REFUSES farUnconstrained for every plan-governed district', () => {
    for (const z of ['C-V', 'P-C', 'PD', 'R-PD3', 'R-PD7', 'T-C', 'T-D']) {
      const l = resolveLasVegas(z)
      expect(l.planGoverned, z).toBe(true)
      expect(l.farUnconstrained, z).toBe(false)
      expect(l.maxStories, z).toBeNull()
      expect(l.maxHeightFt, z).toBeNull()
      expect(l.planSource, z).toBeTruthy()
    }
  })

  it('REFUSES farUnconstrained for every code Title 19 does not establish', () => {
    for (const z of Object.keys(LAS_VEGAS_UNREADABLE_CODES)) {
      const l = resolveLasVegas(z)
      expect(l.name, z).toBeNull()
      expect(l.farUnconstrained, z).toBe(false)
      expect(l.planGoverned, z).toBe(false)
      expect(l.maxStories, z).toBeNull()
      expect(l.maxHeightFt, z).toBeNull()
      expect(l.source, z).toBe('')
    }
  })

  it('never publishes a floor-area ratio for any district, resolved or not', () => {
    const all = ['R-1', 'C-2', 'M', 'T6-UC', 'P-C', 'R-PD7', 'R-A', 'NO_ZONE', 'ZZZ']
    for (const z of all) {
      const l = resolveLasVegas(z) as unknown as Record<string, unknown>
      expect(Object.keys(l)).not.toContain('maxFAR')
      expect(Object.keys(l)).not.toContain('farByUse')
    }
  })
})

describe('parseLasVegasZone — the shapes the live layer actually serves', () => {
  // Measured 2026-08-09: the layer carries 17 U(...) variants. §19.00.100(B)(1)
  // establishes exactly ONE Undeveloped district, "U", at §19.06.050, and 19.06
  // has no sub-variants; the parenthetical is the General Plan category the
  // holding zone anticipates, which the layer's DESCRIPTION spells out
  // ("Undeveloped (Desert Rural Up To 2.49 du/ac)"). A General Plan category is
  // not a zoning district.
  it('resolves every U(...) holding zone to the one U district', () => {
    for (const z of ['U(DR)', 'U(TND)', 'U(PCD)', 'U(RC)', 'U(LI/R)', 'U(PROS)', 'U(ROW)', 'U(M)']) {
      const p = parseLasVegasZone(z)
      expect(p.base, z).toBe('U')
      expect(p.undevelopedCategory, z).toBeTruthy()
      expect(resolveLasVegas(z).maxHeightFt, z).toBe(35)
      expect(resolveLasVegas(z).maxStories, z).toBe(2)
    }
  })

  // §19.09.050.E.040 B: "T3-N-O (Open): The open sub-zone provides the same
  // building form as the T3-N Zone, with the following exceptions: 1. The
  // Side-by-Side Duplex building type is not allowed; and 2. Additional use[s]".
  // The exceptions are to building TYPE and USE, not to height.
  it('resolves the T3-N-O sub-zone to T3-N\'s building form', () => {
    const p = parseLasVegasZone('T3-N-O')
    expect(p.base).toBe('T3-N')
    expect(resolveLasVegas('T3-N-O').maxStories).toBe(2)
    expect(resolveLasVegas('T3-N-O').maxHeightFt).toBeNull()
  })

  it('reads the R-PD density numeral out of the code, and still refuses to publish limits', () => {
    const p = parseLasVegasZone('R-PD46')
    expect(p.base).toBe('R-PD')
    expect(p.rpdUnitsPerAcre).toBe(46)
    const l = resolveLasVegas('R-PD46')
    expect(l.densityNote).toContain('46 units per gross acre')
    expect(l.planGoverned).toBe(true)
    expect(l.maxStories).toBeNull()
  })

  // ⚠️ AN ABSENCE ASSERTION, and the interpretation behind it (rule 15). 'R-A'
  // is NOT an 'R-' prefix of anything and must not be pattern-matched into a
  // residential district. The check performed: §19.00.100(B) lists the
  // established districts in four tables (residential, commercial/industrial,
  // special area, overlay) and R-A is in none of them; a full-text search of
  // every Title 19 chapter export (tocid 001.001–001.015, fetched 2026-08-09)
  // finds the string "R-A" zero times. The GIS labels it "Ranch Acres".
  // §19.00.100(C) then says such a parcel is governed by the pre-UDC
  // classification — a superseded ordinance not read here.
  // R-5 is the same shape and was found by the coverage sweep rather than by
  // reading the map legend: §19.00.100(B)(1) runs R-1, R-2, R-3, R-4 and stops,
  // the string "R-5" appears nowhere in Title 19, and the GIS labels its 28
  // polygons "Apartment". The sequence invites the assumption that an R-5 exists
  // and is the next rung above R-4; it does not, and it must not inherit one.
  it('R-5 is a gap and does not inherit R-4 or R-3', () => {
    expect(resolveLasVegas('R-5').name).toBeNull()
    expect(resolveLasVegas('R-5').farUnconstrained).toBe(false)
    expect(resolveLasVegas('R-5').heightTableNA).toBe(false)
    expect(resolveLasVegas('R-4').heightTableNA).toBe(true)
    expect(resolveLasVegas('R-3').maxStories).toBe(5)
    expect(resolveLasVegas('R-5').maxStories).toBeNull()
  })

  it('legacy classifications resolve to nothing rather than to a lookalike district', () => {
    for (const z of ['R-A', 'R-5', 'R-MHP', 'P-R', 'N-S']) {
      const p = parseLasVegasZone(z)
      expect(p.base, z).toBeNull()
      expect(p.normalized, z).toBe(z)
    }
    // R-MHP must not collapse into R-MH, which IS established (§19.06.130).
    expect(resolveLasVegas('R-MHP').maxHeightFt).toBeNull()
    expect(resolveLasVegas('R-MH').maxHeightFt).toBe(35)
  })

  // T6-UGL is real — §19.17.080 Table 2 gives "T6-UG-L" its own height-bonus
  // ladder — but §19.09.050.E publishes no standards section for it, so there is
  // nothing to read. It must not be folded into T6-UG.
  it('T6-UGL is a gap and does not inherit T6-UG', () => {
    expect(resolveLasVegas('T6-UGL').maxStories).toBeNull()
    expect(resolveLasVegas('T6-UG').maxStories).toBe(12)
  })

  it('T4-M is a gap: the contents list it, the chapter publishes no standards body', () => {
    expect(resolveLasVegas('T4-M').maxStories).toBeNull()
    expect(LAS_VEGAS_UNREADABLE_CODES['T4-M']).toContain('E.026')
  })

  it('normalises case and whitespace, and handles empty input', () => {
    expect(parseLasVegasZone('  r-1 ').base).toBe('R-1')
    expect(parseLasVegasZone('t5-m').base).toBe('T5-M')
    expect(parseLasVegasZone('').base).toBeNull()
    expect(parseLasVegasZone(null).base).toBeNull()
    expect(parseLasVegasZone(undefined).normalized).toBe('')
  })
})

describe('usesForZone', () => {
  it('reads uses from the district purpose paragraphs, not the 19.12 matrix', () => {
    expect(usesForZone('R-1')).toEqual(['residential'])
    expect(usesForZone('R-4')).toEqual(['residential', 'mixed'])
    expect(usesForZone('P-O')).toEqual(['commercial'])
    expect(usesForZone('C-1')).toEqual(['commercial', 'mixed'])
    expect(usesForZone('M')).toEqual(['commercial'])
  })

  // C-1/C-2 permit multi-family only "in conjunction with an approved Mixed-Use
  // development" (§19.12.070, Residential Multi-Family conditional use
  // regulation 1), so a bare 'residential' would overstate a by-right use.
  it('does not claim standalone residential in the commercial districts', () => {
    expect(usesForZone('C-1')).not.toContain('residential')
    expect(usesForZone('C-2')).not.toContain('residential')
  })

  // Returning null asserts nothing. The FBC's permitted uses live in
  // §19.09.050.F's own tables and the plan-governed districts' uses live in an
  // approved plan; neither was read, and a wide use-by-district matrix read one
  // column off is the DC MU-column defect.
  it('says nothing about the transect zones or the plan-governed districts', () => {
    for (const z of ['T6-UC', 'T5-M', 'T3-N', 'P-C', 'PD', 'T-C', 'T-D', 'C-V', 'R-PD7']) {
      expect(usesForZone(z), z).toBeNull()
    }
  })

  it('says nothing about a code Title 19 does not establish', () => {
    for (const z of ['R-A', 'R-MHP', 'P-R', 'N-S', 'T6-UGL', 'NO_ZONE', 'QQ-9']) {
      expect(usesForZone(z), z).toBeNull()
    }
  })
})

describe('the district table itself', () => {
  it('exports the codes it resolves, and every one of them resolves', () => {
    for (const code of LAS_VEGAS_DISTRICT_CODES) {
      if (code === 'R-PD<n>') continue
      expect(resolveLasVegas(code).name, code).toBeTruthy()
    }
  })

  // Rule 14 as a structure rather than a comment: every entry that publishes a
  // height in feet must also publish the story count printed beside it in the
  // same table row, so a hand-written row cannot silently drop one — which is
  // exactly how the Denver story count was lost.
  it('no entry publishes feet without the stories the same table row states', () => {
    for (const code of LAS_VEGAS_DISTRICT_CODES) {
      if (code === 'R-PD<n>') continue
      const l = resolveLasVegas(code)
      if (l.maxHeightFt != null) expect(l.maxStories, code).not.toBeNull()
    }
  })

  it('every entry that publishes any figure carries a section citation', () => {
    for (const code of LAS_VEGAS_DISTRICT_CODES) {
      if (code === 'R-PD<n>') continue
      const l = resolveLasVegas(code)
      expect(l.source, code).not.toBe('')
      if (l.maxStories != null || l.maxHeightFt != null) {
        expect(l.heightSource, code).toMatch(/19\.0[689]/)
      }
    }
  })
})
