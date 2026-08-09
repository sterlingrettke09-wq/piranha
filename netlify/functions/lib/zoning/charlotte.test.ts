import { describe, it, expect } from 'vitest'
import {
  resolveCharlotte,
  parseCharlotteZone,
  heightFtFor,
  coverageFractionFor,
  usesForZone,
  CHARLOTTE_DISTRICTS,
  CHARLOTTE_TRANSLATIONS,
  CHARLOTTE_DISTRICT_NAMES,
  type CharlotteBaseDistrict,
} from './charlotte'

// Every zoning-module test below encodes an INTERPRETATION of the ordinance,
// and CLAUDE.md rule 15 says a well-explained wrong one is the hardest kind to
// overturn. So each absence assertion names the section it was checked against,
// and quotes it where the quote is what settles the question.

const ALL_DISTRICTS = Object.keys(CHARLOTTE_DISTRICTS) as CharlotteBaseDistrict[]

describe('Charlotte UDO district table', () => {
  it('covers exactly the 30 base districts UDO Sec. 3.3 establishes', () => {
    // Sec. 3.3 "UDO ZONING DISTRICTS" is the ordinance's own exhaustive roster:
    // 6 Neighborhood 1 + 3 Neighborhood 2 + 2 Commercial + 5 Campus +
    // 2 Manufacturing/Logistics + 1 IMU + 1 NC + 2 CAC + 3 RAC/UE/UC +
    // 4 TOD + MHP. The seven items in its Special Purpose and Overlay list that
    // are OVERLAYS (HDO, HDO-S, NCO, RIO, CCO, MHO, ANDO) are not base
    // districts and carry no height table of their own.
    expect(ALL_DISTRICTS).toHaveLength(30)
    expect(new Set(ALL_DISTRICTS)).toEqual(
      new Set([
        'N1-A', 'N1-B', 'N1-C', 'N1-D', 'N1-E', 'N1-F',
        'N2-A', 'N2-B', 'N2-C',
        'CG', 'CR',
        'IC-1', 'IC-2', 'OFC', 'OG', 'RC',
        'ML-1', 'ML-2',
        'IMU', 'NC',
        'CAC-1', 'CAC-2',
        'RAC', 'UE', 'UC',
        'TOD-UC', 'TOD-NC', 'TOD-CC', 'TOD-TR',
        'MHP',
      ]),
    )
    for (const d of ALL_DISTRICTS) expect(CHARLOTTE_DISTRICT_NAMES[d]).toBeTruthy()
  })

  it('every district carries a UDO citation and the FAR known-absence', () => {
    for (const d of ALL_DISTRICTS) {
      const l = CHARLOTTE_DISTRICTS[d]
      expect(l.source, `${d} has no citation`).toMatch(/UDO Sec\./)
      expect(l.source, `${d} cites no table`).toMatch(/Table \d+-\d+/)
      // FACT 1: zero occurrences of "floor area ratio" / "FAR" / "F.A.R." in
      // 1,780,151 characters across all 39 articles, and no FAR row in any
      // district table — where a FAR row would sit, the Lot Standards table
      // carries maximum building COVERAGE instead.
      expect(l.farUnconstrained, `${d} must assert the FAR absence`).toBe(true)
    }
  })

  it('states height in FEET only — no story count anywhere, and none derivable', () => {
    // FACT 2 / CLAUDE.md rule 12. Charlotte has no "stories" row in any
    // Building Height Standards table (4-3, 5-3, 6-3, 7-3, 8-3, 9-2, 10-2,
    // 11-2, 12-2, 13-2), so there is no figure to round-trip and no
    // feet-per-storey constant may ever appear in this module. This asserts the
    // shape structurally: nothing in the resolved object is a story count.
    for (const d of ALL_DISTRICTS) {
      const l = CHARLOTTE_DISTRICTS[d] as unknown as Record<string, unknown>
      expect(Object.keys(l)).not.toContain('stories')
      expect(Object.keys(l)).not.toContain('maxStories')
      expect(Object.keys(l)).not.toContain('storiesFt')
    }
  })
})

describe('per-use height (CLAUDE.md rule 6)', () => {
  it('N1-C states 40 ft residential and 48 ft nonresidential — and does not collapse to 48', () => {
    // Table 4-3 row A "Maximum Building Height – Residential (feet)" and row B
    // "Maximum Building Height – Nonresidential and Mixed-Use (feet)". Reading
    // the larger as "the" limit assumes a programme the user has not chosen.
    const l = resolveCharlotte('N1-C')
    expect(l.residentialFt).toBe(40)
    expect(l.nonresidentialFt).toBe(48)
    expect(heightFtFor(l, 'residential')).toBe(40)
    expect(heightFtFor(l, 'nonresidential')).toBe(48)
  })

  it('the three N1 districts where the two rows differ are exactly N1-C, N1-D, N1-E', () => {
    const split = ALL_DISTRICTS.filter((d) => {
      const l = CHARLOTTE_DISTRICTS[d]
      return l.residentialFt != null && l.nonresidentialFt != null && l.residentialFt !== l.nonresidentialFt
    })
    expect(split).toEqual(['N1-C', 'N1-D', 'N1-E'])
  })

  it('reads Table 4-3 row A across all six N1 columns', () => {
    expect(ALL_DISTRICTS.filter((d) => d.startsWith('N1-')).map((d) => CHARLOTTE_DISTRICTS[d].residentialFt))
      .toEqual([48, 48, 40, 40, 40, 48])
  })

  it('MHP states 24 ft for a manufactured home and NOTHING for other structures', () => {
    // Table 14-2's only height row is "Maximum Manufactured Home Height 24'".
    // MHP is the one base district with no Building Height Standards table at
    // all, so the nonresidential figure is a real absence rather than a lookup
    // that was skipped.
    const l = resolveCharlotte('MHP')
    expect(l.residentialFt).toBe(24)
    expect(l.nonresidentialFt).toBeNull()
    expect(l.heightAppliesTo).toBe('manufactured home')
  })
})

describe('the Section 16.3 bonus is EARNED and is never the headline', () => {
  // FACT 4. Sec. 16.3: "Additional building height … shall be allowed through a
  // VOLUNTARY bonus system. In order to obtain a development bonus, one or more
  // actions in Table 16-1 are required" — on-site affordable housing at stated
  // AMI averages for a 30-year period, and similar. That is a programme the
  // user has not chosen, so per rule 6 it may not be published as a limit.
  it('no district ever reports its bonus figure as a height', () => {
    for (const d of ALL_DISTRICTS) {
      const l = CHARLOTTE_DISTRICTS[d]
      if (l.bonusHeightFt == null) continue
      expect(l.residentialFt, `${d} published its bonus as the residential height`).not.toBe(l.bonusHeightFt)
      expect(l.nonresidentialFt, `${d} published its bonus as the nonresidential height`).not.toBe(l.bonusHeightFt)
      expect(l.bonusHeightFt).toBeGreaterThan(l.residentialFt ?? 0)
    }
  })

  it('TOD-NC is 75 ft by right and 100 ft only with the bonus', () => {
    const l = resolveCharlotte('TOD-NC')
    expect(l.residentialFt).toBe(75)
    expect(l.bonusHeightFt).toBe(100)
  })

  it('the bonus row is BLANK for N2-A and N2-B and reads 100 only for N2-C', () => {
    // Table 5-3 row C. This is the cell that flattening the HTML mis-assigns:
    // a text dump reads the row as a single "100" and slides it onto N2-A.
    expect(resolveCharlotte('N2-A').bonusHeightFt).toBeNull()
    expect(resolveCharlotte('N2-B').bonusHeightFt).toBeNull()
    expect(resolveCharlotte('N2-C').bonusHeightFt).toBe(100)
  })

  it('TOD-UC carries the 300 ft bonus and the conditional "unlimited" note, but 130 ft by right', () => {
    // Table 13-2 note 4: "The height limit is 300 feet. If located within 1/4
    // mile walking distance of a rapid transit station, the maximum height with
    // bonus is unlimited." Both parts are bonus figures.
    const l = resolveCharlotte('TOD-UC')
    expect(l.residentialFt).toBe(130)
    expect(l.bonusHeightFt).toBe(300)
    expect(l.bonusUnlimitedNearRapidTransit).toBe(true)
    expect(l.heightUnconstrained).toBe(false)
  })

  it('ML-1 and ML-2 have no bonus row at all — Table 8-3 has only row A', () => {
    // Checked in the table markup, not assumed from the neighbouring articles
    // (6, 7, 9-13) which all do carry one.
    expect(resolveCharlotte('ML-1').bonusHeightFt).toBeNull()
    expect(resolveCharlotte('ML-2').bonusHeightFt).toBeNull()
  })
})

describe('UC: "Unlimited" is an ANSWER, not a missing height (CLAUDE.md rule 5)', () => {
  it('sets heightUnconstrained and leaves both feet figures null', () => {
    // Table 12-2 row B reads the word "Unlimited" for UC, and row C (bonus) is
    // blank, which is consistent — there is nothing for a bonus to add to.
    const l = resolveCharlotte('UC')
    expect(l.heightUnconstrained).toBe(true)
    expect(l.residentialFt).toBeNull()
    expect(l.nonresidentialFt).toBeNull()
    expect(l.basis).toBe('udo')
    expect(l.bonusHeightFt).toBeNull()
  })

  it('UC is the ONLY district with an unconstrained height', () => {
    expect(ALL_DISTRICTS.filter((d) => CHARLOTTE_DISTRICTS[d].heightUnconstrained)).toEqual(['UC'])
  })

  it('an unconstrained height is distinguishable from a gap', () => {
    // Both carry null feet; only one asserts an answer. Confusing them is the
    // failure rule 5 exists to prevent.
    const uc = resolveCharlotte('UC')
    const gap = resolveCharlotte('MX-2')
    expect(uc.residentialFt).toBeNull()
    expect(gap.residentialFt).toBeNull()
    expect(uc.heightUnconstrained).not.toBe(gap.heightUnconstrained)
    expect(uc.basis).not.toBe(gap.basis)
  })
})

describe('overlays change no district height (FACT 6)', () => {
  it('the Cottage Court Overlay does NOT cap height at 24 ft', () => {
    // ⚠️ THE TRAP. Sec. 14.6.E.1.b reads "All residential buildings shall not
    // exceed 24 feet in height" — but it sits under "E. Small Unit Bonus /
    // 1. Eligibility", so it is a condition for electing a VOLUNTARY bonus that
    // adds buildings, not a cap on the overlay.
    //
    // What settles it is Sec. 14.6.D.1: "All standards of the base zoning
    // district apply, with the following exceptions:" — and the exceptions
    // enumerated are minimum lot area, lot width, setbacks and building
    // coverage. HEIGHT IS NOT AMONG THEM. Reading 14.6.E as a cap would have
    // published 24 ft against a code that says 48.
    expect(resolveCharlotte('N1-A(CCO)').residentialFt).toBe(48)
    expect(resolveCharlotte('N1-A(CCO)').residentialFt).not.toBe(24)
    expect(resolveCharlotte('N1-D(CCO)').residentialFt).toBe(40)
  })

  it('HDO and ANDO leave the district height untouched', () => {
    // Sec. 14.2 is design review by Certificate of Appropriateness and states
    // no numeric height standard; Sec. 14.9 ANDO is a disclosure overlay.
    // Sec. 14.1, covering all of them: overlays "may grant additional uses or
    // ADD development requirements upon the underlying zoning."
    expect(resolveCharlotte('N1-C(HDO)').residentialFt).toBe(resolveCharlotte('N1-C').residentialFt)
    expect(resolveCharlotte('ML-1(ANDO)').residentialFt).toBe(resolveCharlotte('ML-1').residentialFt)
    expect(resolveCharlotte('CG(ANDO)').basis).toBe('udo')
  })

  it('an Exception (EX) district cannot move the maximum height', () => {
    // Sec. 37.2.C.3.b.i(A), verbatim: "No modifications shall be made to
    // maximum height regulations, with the exception of the height transition
    // limitations when adjacent to the Neighborhood 1 Place Type."
    const base = resolveCharlotte('CAC-1')
    const ex = resolveCharlotte('CAC-1(EX)')
    expect(ex.residentialFt).toBe(base.residentialFt)
    expect(ex.basis).toBe('udo')
    expect(ex.exception).toBe(true)
  })
})

describe('conditional and optional districts (UDO Sec. 1.4.C)', () => {
  // Sec. 1.4.C.1: a conditional district in place before 2023-06-01 is governed
  // by "the regulations of all development ordinances in effect on the date of
  // such conditional zoning district approval, as well as the conditional
  // zoning site plan and site-specific conditions". Sec. 1.4.C.4: "The above
  // shall include any optional and EX zoning districts."
  //
  // These are ~26% of Charlotte's mapped zoning area. A fallback that reached
  // for the nearest UDO district would emit a confident height for Uptown,
  // South End and most mixed-use corridors, and nothing else in the codebase
  // would flag it — so they are pinned to nothing here, the same move as the
  // test pinning the superseded Minneapolis Chapter 546 codes.
  const legacyConditional = [
    'UMUD-O', 'MUDD-O', 'MUDD(O)', 'MUDD-O(CD)', 'MUDD(CD)',
    'UR-2(CD)', 'UR-1(CD)', 'UR-3(CD)', 'UR-C(CD)',
    'B-1(CD)', 'B-2(CD)', 'B-D(CD)', 'BP(CD)',
    'R-12MF(CD)', 'R-17MF(CD)', 'R-8MF(CD)', 'R-43MF(CD)',
    'INST(CD)', 'I-1(CD)', 'I-2(CD)', 'O-1(CD)', 'O-2(CD)', 'RE-1(CD)',
    'B-1(CD) SPA', 'B-2(CD)(HDO)', 'CG(CD)ANDO'.replace('CG', 'B-1'),
  ]

  it.each(legacyConditional)('%s resolves to NO by-right height', (code) => {
    const l = resolveCharlotte(code)
    expect(l.residentialFt).toBeNull()
    expect(l.nonresidentialFt).toBeNull()
    expect(l.heightUnconstrained).toBe(false)
    expect(l.basis).toBe('site-plan')
  })

  it('a site-plan-governed parcel asserts NOTHING about FAR', () => {
    // FACT 1 is a claim about the UDO. A legacy conditional district is
    // governed by the superseded 1992 ordinance, which has not been read here,
    // so `farUnconstrained` must stay false — an absence we have not
    // established is not an absence.
    for (const code of legacyConditional) {
      expect(resolveCharlotte(code).farUnconstrained, code).toBe(false)
    }
  })

  it('cites Sec. 1.4.C as the REASON there is no number', () => {
    const l = resolveCharlotte('UMUD-O')
    expect(l.source).toContain('Sec. 1.4.C')
    expect(l.basis).toBe('site-plan')
    // Distinguishable from an unrecognised code, which cites nothing at all.
    expect(resolveCharlotte('ZZZ-9').source).toBe('')
  })

  it('a UDO-coded conditional district DOES get the UDO figures, flagged (Sec. 1.4.C.3)', () => {
    // "A conditional zoning district approved after the effective date … and
    // under the regulations of this UDO shall meet the regulations of this UDO
    // as well as the conditional zoning site plan and site-specific
    // conditions." Sec. 37.2.C.2 makes the conditions additive, so the district
    // figure is a ceiling the site may not actually have.
    const l = resolveCharlotte('N2-A(CD)')
    expect(l.residentialFt).toBe(48)
    expect(l.basis).toBe('udo')
    expect(l.conditional).toBe(true)
    expect(resolveCharlotte('CG(CD)ANDO').residentialFt).toBe(50)
    expect(resolveCharlotte('IMU(CD)').residentialFt).toBe(80)
  })

  it('RezoneDate could not have discriminated these, and the vocabulary can', () => {
    // Measured live 2026-08-08 on the zoning layer: UR-2(CD) polygons run to
    // 2024-12-16 and B-1(CD) to 2025-09-15 — both AFTER the UDO took effect,
    // which is exactly Sec. 1.4.C.2 (approved since the UDO but under the prior
    // ordinance). Meanwhile every N2-A(CD), CG(CD) and N1-A(CD) polygon is
    // dated on or after 2023-06-01. The district CODE is the discriminator; the
    // date is not, and using it would have mislabelled 265 UR-2(CD) polygons.
    expect(resolveCharlotte('UR-2(CD)').basis).toBe('site-plan')
    expect(resolveCharlotte('N2-A(CD)').basis).toBe('udo')
  })
})

describe('UDO Table 3-1 translation (Sec. 3.2)', () => {
  // "The conventional zoning district classifications in effect before the
  // effective date of June 1, 2023 of this Ordinance are translated as shown in
  // Table 3-1 … The new standards set forth in this Ordinance for these zoning
  // districts shall apply to all properties within such zoning districts."
  it.each([
    ['R-3', 'N1-A', 48],
    ['R-5', 'N1-C', 40],
    ['R-17MF', 'N2-B', 48],
    ['R-MH', 'MHP', 24],
    ['UMUD', 'UC', null],
    ['INST', 'IC-1', 50],
  ])('%s is governed as %s', (code, target, ft) => {
    const l = resolveCharlotte(code)
    expect(l.basis).toBe('udo-translated')
    expect(l.district).toBe(target)
    expect(l.translatedFrom).toBe(code)
    expect(l.residentialFt).toBe(ft)
    expect(l.source).toContain('Table 3-1')
  })

  it('the TS overlay is eliminated, so the base district keeps its own translation', () => {
    // Table 3-1, TS row: "District eliminated", exception "Translation does not
    // apply where TS Overlay is in conjunction with a conditional or optional
    // district". I-1 is conventional, so I-1(TS-O) is governed as ML-1.
    const l = resolveCharlotte('I-1(TS-O)')
    expect(l.district).toBe('ML-1')
    expect(l.residentialFt).toBe(80)
  })

  it('the PED overlay redirects the translation, per Table 3-1s three-clause cell', () => {
    // "All districts except R-3, R-4, R-5, R-6, R-8, R-8MF, R-12MF, R-17MF,
    //  R-22MF, R-43MF, TOD-TR, TOD-NC, TOD-CC, TOD-UC, and MUDD Zoning
    //  Districts: NC / R-8MF, R-12MF, R-17MF, R-22MF, and R-43MF Zoning
    //  Districts: N2-C / R-3, R-4, R-5, R-6, R-8, TOD-TR, TOD-NC, TOD-CC,
    //  TOD-UC, and MUDD Zoning Districts: The zoning translation for the
    //  district applies"
    // B-2 is in none of the exception lists, so it lands on NC (65 ft), NOT on
    // B-2's own CG translation (50 ft). R-8MF is in the second clause.
    expect(resolveCharlotte('B-2(PED-O)').district).toBe('NC')
    expect(resolveCharlotte('B-2(PED-O)').residentialFt).toBe(65)
    expect(resolveCharlotte('R-8MF(PED-O)').district).toBe('N2-C')
    expect(resolveCharlotte('UR-C(PED-O)').district).toBe('NC')
    // Third clause: R-5 keeps its own translation rather than going to NC.
    expect(resolveCharlotte('R-5(PED-O)').district).toBe('N1-C')
  })

  it('translation does NOT reach a conditional or optional variant', () => {
    // Sec. 3.2 says CONVENTIONAL classifications, and Sec. 1.4.C sends
    // conditional ones the other way. This is why the live map still carries
    // B-1(CD) while every bare 'B-1' has gone.
    expect(resolveCharlotte('B-1').district).toBe('CG')
    expect(resolveCharlotte('B-1(CD)').district).toBeNull()
    expect(resolveCharlotte('B-1(CD)').basis).toBe('site-plan')
    expect(resolveCharlotte('MUDD').district).toBe('CAC-2')
    expect(resolveCharlotte('MUDD-O').district).toBeNull()
  })

  it('every Table 3-1 target is a district this module actually holds', () => {
    for (const [from, to] of Object.entries(CHARLOTTE_TRANSLATIONS)) {
      expect(CHARLOTTE_DISTRICTS[to], `${from} -> ${to}`).toBeDefined()
    }
  })
})

describe('codes that are in neither Sec. 3.3 nor Table 3-1 are GAPS', () => {
  // Verified by searching all 39 articles: MX-1/MX-2/MX-3 appear only in
  // Article 20's tree-preservation table (a list of legacy districts), never in
  // Article 3; CC, NS, R-20MF, TOC-NC, R-I and RE-3 appear nowhere at all.
  // TOC-NC in particular LOOKS like a typo for TOD-NC — the UDO's own Sec.
  // 37.2 has a "TOC-CC" typo for TOD-CC — but a plausible mechanism is not a
  // measurement (CLAUDE.md rule 1), so it stays a gap.
  const gaps = [
    'MX-1', 'MX-2', 'MX-3', 'MX-2 INNOV', 'MX-1(INNOV)',
    'CC', 'CC SPA', 'NS', 'NS(HDO)',
    'R-20MF', 'TOC-NC', 'R-I', 'RE-3', 'R/W',
    'R-9PUD', 'R-15PUD', 'R-PUD', 'R-RPUD', 'B-1SCD', 'RR-CD',
    'TOD-MO', 'TOD-RO',
  ]

  it.each(gaps)('%s asserts nothing at all', (code) => {
    const l = resolveCharlotte(code)
    expect(l.basis).toBe('unresolved')
    expect(l.residentialFt).toBeNull()
    expect(l.nonresidentialFt).toBeNull()
    expect(l.heightUnconstrained).toBe(false)
    // A GAP must never render as FACT 1's known absence.
    expect(l.farUnconstrained).toBe(false)
    expect(l.source).toBe('')
    expect(usesForZone(code)).toBeNull()
  })

  it('an unexplained suffix makes the whole code unresolved (fail closed)', () => {
    // 'BVO' and 'INNOV' are live in the layer and appear NOWHERE in the UDO's
    // 39 articles, so nothing is known about whether they cap height.
    // Publishing CAC-1's 80 ft next to an unexplained suffix is precisely the
    // plausible-looking answer rule 18 is about.
    expect(resolveCharlotte('CAC-1').residentialFt).toBe(80)
    expect(resolveCharlotte('CAC-1 BVO').basis).toBe('unresolved')
    expect(resolveCharlotte('CAC-1 BVO').residentialFt).toBeNull()
    expect(resolveCharlotte('N2-B BVO').basis).toBe('unresolved')
    expect(parseCharlotteZone('CAC-1 BVO').unknownTokens).toEqual(['BVO'])
  })
})

describe('parsing the live ZoneDes vocabulary', () => {
  it('handles the compound-string shapes the layer actually contains', () => {
    // All measured 2026-08-08 across the 218 distinct values.
    expect(parseCharlotteZone('N2-A (CD)').code).toBe('N2-A') // stray space
    expect(parseCharlotteZone('N2-A (CD)').conditional).toBe(true)
    expect(parseCharlotteZone('CG(CD)ANDO').markers).toEqual(['CD', 'ANDO']) // no parens
    expect(parseCharlotteZone('RC(CD)EX').exception).toBe(true)
    expect(parseCharlotteZone('NC(EX) HDO').markers).toEqual(['EX', 'HDO']) // space-separated
    expect(parseCharlotteZone('MUDD-O').optional).toBe(true) // trailing -O suffix
    expect(parseCharlotteZone('MUDD-O').code).toBe('MUDD')
    expect(parseCharlotteZone('MUDD(O)').optional).toBe(true)
  })

  it('accepts the one malformed value live in the layer', () => {
    // ZoneDes 'N2-B(CD0' — an unclosed '(CD' with a zero for the paren. Exactly
    // one polygon carries it (returnCountOnly = 1, measured 2026-08-08).
    // Accepted explicitly so it resolves as the conditional N2-B it plainly is,
    // rather than falling into the unresolved bucket where it would look like
    // an unknown district.
    const l = resolveCharlotte('N2-B(CD0')
    expect(l.district).toBe('N2-B')
    expect(l.conditional).toBe(true)
    expect(l.residentialFt).toBe(48)
  })

  it('the -O stripper cannot eat a real district name', () => {
    // No UDO Sec. 3.3 district and no Table 3-1 left-column code ends in '-O'.
    for (const code of [...ALL_DISTRICTS, ...Object.keys(CHARLOTTE_TRANSLATIONS)]) {
      expect(code.endsWith('-O'), code).toBe(false)
    }
    // And the districts that DO end in a hyphenated letter survive intact.
    expect(parseCharlotteZone('N1-A').code).toBe('N1-A')
    expect(resolveCharlotte('N1-A').district).toBe('N1-A')
  })

  it('null, empty and whitespace resolve to a gap rather than throwing', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(resolveCharlotte(v).basis).toBe('unresolved')
    }
  })
})

describe('every live ZoneDes value classifies, and into the expected buckets', () => {
  // The full distinct list from the live layer, measured 2026-08-08:
  // `returnDistinctValues=true` over 5,680 polygons returned 218 values and
  // zero nulls. (The scouting note that preceded this build said 219; the live
  // count is 218 — recorded because a district list that drifts by one is
  // exactly how a code silently stops resolving.)
  const LIVE_ZONEDES = [
    'B-1(CD)', 'B-1(CD) SPA', 'B-1(CD)(ANDO)', 'B-1(CD)(HDO)', 'B-1SCD', 'B-2(CD)', 'B-2(CD)(ANDO)',
    'B-2(CD)(HDO)', 'B-2(PED-O)', 'B-D(CD)', 'B-D(CD)(ANDO)', 'BP(CD)', 'BP(CD)(ANDO)', 'CAC-1',
    'CAC-1 BVO', 'CAC-1 EX(CD)', 'CAC-1(CD)', 'CAC-1(EX)', 'CAC-2', 'CAC-2(CD)', 'CAC-2(HDO)', 'CC',
    'CC SPA', 'CC(ANDO)', 'CC(CD)', 'CG', 'CG(ANDO)', 'CG(CD)', 'CG(CD)ANDO', 'CG(HDO)', 'CR(CD)',
    'I-1(CD)', 'I-1(CD)(ANDO)', 'I-1(TS-O)', 'I-2(CD)', 'I-2(CD)(ANDO)', 'I-2(CD)(TS)', 'IC-1',
    'IC-1(ANDO)', 'IC-2', 'IC-2(CD)', 'IC-2(EX)', 'IMU', 'IMU(CD)', 'IMU(CD)ANDO', 'INST(CD)',
    'INST(CD)(ANDO)', 'MHP', 'ML-1', 'ML-1(ANDO)', 'ML-1(CD)', 'ML-1(CD)ANDO', 'ML-2', 'ML-2(ANDO)',
    'ML-2(CD)', 'ML-2(CD)(ANDO)', 'ML-2(CD)ANDO', 'MUDD(CD)', 'MUDD(CD)(HDO)', 'MUDD(O)', 'MUDD-O',
    'MUDD-O(ANDO)', 'MUDD-O(CD)', 'MUDD-O(HDO)', 'MX-1', 'MX-1(INNOV)', 'MX-2', 'MX-2 INNOV',
    'MX-2(ANDO)', 'MX-2(INNOV)', 'MX-2(INNOV) SPA', 'MX-3', 'MX-3(INNOV)', 'N1-A', 'N1-A(ANDO)',
    'N1-A(CCO)', 'N1-A(CD)', 'N1-A(HDO)', 'N1-B', 'N1-B(HDO)', 'N1-C', 'N1-C(ANDO)', 'N1-C(CD)',
    'N1-C(HDO)', 'N1-D', 'N1-D(CCO)', 'N1-D(CD)', 'N1-D(HDO)', 'N1-E', 'N1-E(CD)', 'N1-E(HDO)',
    'N1-F', 'N1-F(CD)', 'N2-A', 'N2-A (CD)', 'N2-A(CD)', 'N2-A(CD)ANDO', 'N2-A(HDO)', 'N2-B',
    'N2-B BVO', 'N2-B(ANDO)', 'N2-B(CD)', 'N2-B(CD0', 'N2-B(HDO)', 'N2-C', 'N2-C(CD)', 'N2-C(CD)ANDO',
    'N2-C(EX)', 'N2-C(HDO)', 'NC', 'NC(CD)', 'NC(EX) HDO', 'NC(HDO)', 'NS', 'NS(ANDO)', 'NS(HDO)',
    'NS(SPA)', 'O-1(CD)', 'O-1(CD)(ANDO)', 'O-15(CD)', 'O-15(CD)(ANDO)', 'O-2(CD)', 'O-2(CD)(ANDO)',
    'O-3(CD)', 'O-6(CD)', 'O-9(CD)', 'OFC', 'OFC(ANDO)', 'OFC(HDO)', 'OG', 'OG(CD)', 'R-12(CD)',
    'R-12MF(CD)', 'R-12PUD', 'R-15(CD)', 'R-15MF(CD)', 'R-15PUD', 'R-17MF', 'R-17MF(CD)',
    'R-17MF(CD)ANDO', 'R-20MF', 'R-20MF(CD)', 'R-22MF(CD)', 'R-3', 'R-3(CD)', 'R-3(CD)(ANDO)',
    'R-4(CD)', 'R-4(CD)(ANDO)', 'R-43MF(CD)', 'R-5', 'R-5(CD)', 'R-6(CD)', 'R-6MF(CD)',
    'R-6MF(CD)(HDO)', 'R-6MFH(CD)', 'R-6PUD', 'R-8(CD)', 'R-8MF(CD)', 'R-8MF(PED-O)', 'R-9(CD)',
    'R-9MF(CD)', 'R-9MF(CD)(HDO)', 'R-9PUD', 'R-I', 'R-MH', 'R-PUD', 'R-RPUD', 'R/W', 'RAC',
    'RAC(CD)', 'RAC(EX)', 'RC', 'RC(CD)EX', 'RE-1(CD)', 'RE-3', 'RE-3(O)', 'RR-CD', 'TOC-NC',
    'TOD-CC', 'TOD-CC(EX)', 'TOD-M(CD)', 'TOD-M(CD)(HDO)', 'TOD-M(O)', 'TOD-MO', 'TOD-MO SPA',
    'TOD-MO(HDO)', 'TOD-NC', 'TOD-NC(CD)', 'TOD-NC(HDO)', 'TOD-R(CD)', 'TOD-R(CD)(HDO)', 'TOD-R(O)',
    'TOD-RO', 'TOD-RO(HDO)', 'TOD-TR', 'TOD-TR(CD)', 'TOD-UC', 'TOD-UC(CD)', 'TOD-UC(EX)',
    'TOD-UC(HDO)', 'UC', 'UC(EX)', 'UC(HDO)', 'UE', 'UE(EX)', 'UMUD(CD)', 'UMUD-O', 'UMUD-O(HDO)',
    'UR-1(CD)', 'UR-1(CD)(HDO)', 'UR-2(CD)', 'UR-2(CD)(ANDO)', 'UR-2(CD)(HDO)', 'UR-3(CD)',
    'UR-3(CD)(HDO)', 'UR-C(CD)', 'UR-C(CD)(HDO)', 'UR-C(PED-O)',
  ]

  it('the captured vocabulary is the 218 distinct values measured on the layer', () => {
    expect(LIVE_ZONEDES).toHaveLength(218)
    expect(new Set(LIVE_ZONEDES).size).toBe(218)
  })

  it('every value resolves without throwing, into exactly one of four bases', () => {
    const bases = new Set<string>()
    for (const z of LIVE_ZONEDES) bases.add(resolveCharlotte(z).basis)
    expect([...bases].sort()).toEqual(['site-plan', 'udo', 'udo-translated', 'unresolved'])
  })

  it('a resolved height implies a citation, and a citation implies a resolved district', () => {
    // The invariant that makes an accidental fallback visible: no code may ever
    // carry a number without a UDO section beside it.
    for (const z of LIVE_ZONEDES) {
      const l = resolveCharlotte(z)
      const hasNumber = l.residentialFt != null || l.nonresidentialFt != null || l.heightUnconstrained
      if (hasNumber) {
        expect(l.source, `${z} published a figure with no citation`).toMatch(/UDO Sec\./)
        expect(l.district, `${z} published a figure with no district`).not.toBeNull()
      }
      if (l.district) expect(['udo', 'udo-translated']).toContain(l.basis)
    }
  })

  it('resolves 104 of the 218 values, and withholds a verdict on the rest', () => {
    // Recorded as a MEASUREMENT, not a target — these four numbers were read
    // off the module after it was written, not predicted before. If any of them
    // moves, either the layer's vocabulary changed or this module did, and both
    // are worth knowing. Area-weighted over the layer's own polygon areas the
    // same four buckets are 74.59% / 0.30% / 14.48% / 10.62% of Charlotte's
    // mapped zoning area (measured 2026-08-08 by summing SHAPE.STArea() grouped
    // by ZoneDes), so roughly three quarters of the city has a by-right UDO
    // envelope and a quarter does not.
    const counts: Record<string, number> = { udo: 0, 'udo-translated': 0, 'site-plan': 0, unresolved: 0 }
    for (const z of LIVE_ZONEDES) counts[resolveCharlotte(z).basis] += 1
    expect(counts).toEqual({ udo: 96, 'udo-translated': 8, 'site-plan': 78, unresolved: 36 })
    expect(counts.udo + counts['udo-translated']).toBe(104)
  })

  it('the two spellings of the legacy optional TOD districts both yield no height', () => {
    // The layer spells the same thing two ways: 'TOD-M(O)' marks the optional
    // instrument explicitly, while 'TOD-MO' is one opaque token. They land in
    // different buckets for a good reason — the first says "optional district",
    // which Sec. 1.4.C answers, and the second says nothing the parser can
    // account for — but neither may ever publish a figure, which is what
    // actually matters.
    for (const z of ['TOD-M(O)', 'TOD-MO', 'TOD-R(O)', 'TOD-RO', 'RE-3(O)', 'RE-3']) {
      const l = resolveCharlotte(z)
      expect(l.residentialFt, z).toBeNull()
      expect(l.nonresidentialFt, z).toBeNull()
      expect(l.farUnconstrained, z).toBe(false)
      expect(l.district, z).toBeNull()
    }
    expect(resolveCharlotte('TOD-M(O)').basis).toBe('site-plan')
    expect(resolveCharlotte('TOD-MO').basis).toBe('unresolved')
  })
})

describe('building coverage — the instrument that binds floor area here', () => {
  it('N1 coverage depends on lot size and is not flattened to one percentage', () => {
    // Table 4-1 row E, verbatim: "Lots 10,000 square feet and greater: 40 /
    // Lots Less than 10,000 square feet: 50". One cell, spanning all six N1
    // columns.
    const l = resolveCharlotte('N1-C')
    expect(coverageFractionFor(l, 12000)).toBeCloseTo(0.4)
    expect(coverageFractionFor(l, 10000)).toBeCloseTo(0.4)
    expect(coverageFractionFor(l, 9999)).toBeCloseTo(0.5)
    // With no lot size there is no answer — and picking one of the two would be
    // inventing a number.
    expect(coverageFractionFor(l, null)).toBeNull()
  })

  it('reads Table 5-1 row E and Table 7-1 row C without sliding a value sideways', () => {
    expect(coverageFractionFor(resolveCharlotte('N2-A'), 20000)).toBeCloseTo(0.5)
    expect(coverageFractionFor(resolveCharlotte('N2-B'), 20000)).toBeCloseTo(0.6)
    // Table 5-1's N2-C coverage cell is blank.
    expect(coverageFractionFor(resolveCharlotte('N2-C'), 20000)).toBeNull()
    // Table 7-1 row C states 60 for IC-1 and OFC only; IC-2, OG and RC blank.
    // Flattening that row to text yields "60 60" and reassigns a value.
    expect(coverageFractionFor(resolveCharlotte('IC-1'), 20000)).toBeCloseTo(0.6)
    expect(coverageFractionFor(resolveCharlotte('OFC'), 20000)).toBeCloseTo(0.6)
    expect(coverageFractionFor(resolveCharlotte('IC-2'), 20000)).toBeNull()
    expect(coverageFractionFor(resolveCharlotte('OG'), 20000)).toBeNull()
    expect(coverageFractionFor(resolveCharlotte('RC'), 20000)).toBeNull()
  })

  it('Articles 9-13 have no Lot Standards table at all, so no coverage cap', () => {
    // Checked in the markup: IMU, NC, CAC, RAC/UE/UC and TOD articles jump
    // straight from Building Siting to Building Height. No minimum lot area, no
    // lot width, no coverage. Floor area there is bound by height, setbacks and
    // open space only — an absence in the code, not a missing lookup.
    for (const d of ['IMU', 'NC', 'CAC-1', 'CAC-2', 'RAC', 'UE', 'UC', 'TOD-UC', 'TOD-NC', 'TOD-CC', 'TOD-TR']) {
      expect(coverageFractionFor(resolveCharlotte(d), 20000), d).toBeNull()
    }
  })
})

describe('use vocabulary (UDO Table 15-1)', () => {
  it('N1 and N2 are NOT commercial districts', () => {
    // Office, retail, restaurant/bar, personal service, art gallery, arts or
    // fitness studio and medical/dental office all read "PC" in the N1/N2
    // columns — but Sec. 15.4's prescribed condition for each says, verbatim,
    // that in a Neighborhood 1 or Neighborhood 2 zoning district the use "is
    // only permitted as a Neighborhood Commercial Establishment per the
    // prescribed conditions for that use." A corner-store carve-out is not
    // general commercial, and reporting it as such would flatter the district.
    for (const d of ['N1-A', 'N1-C', 'N1-F', 'N2-A', 'N2-B', 'N2-C']) {
      expect(usesForZone(d), d).toEqual(['residential', 'institutional'])
    }
  })

  it('ML-1 and ML-2 permit NO dwelling at all', () => {
    // Every one of the nine residential rows in Table 15-1 is blank in both
    // columns. Asserting residential here would grant a housing right the code
    // does not.
    expect(usesForZone('ML-1')).toEqual(['commercial', 'institutional'])
    expect(usesForZone('ML-2')).toEqual(['commercial', 'institutional'])
    expect(usesForZone('ML-1')).not.toContain('residential')
  })

  it('MHP is residential and institutional, never commercial', () => {
    expect(usesForZone('MHP')).toEqual(['residential', 'institutional'])
    expect(usesForZone('R-MH')).toEqual(['residential', 'institutional'])
  })

  it('the genuinely mixed districts report mixed', () => {
    for (const d of ['CG', 'CR', 'IC-1', 'NC', 'CAC-2', 'RAC', 'UC', 'TOD-UC']) {
      expect(usesForZone(d), d).toEqual(['commercial', 'mixed', 'residential', 'institutional'])
    }
  })

  it('a site-plan-governed district reports no uses', () => {
    // Its permitted uses come from the approved site plan and the superseded
    // ordinance, not from Table 15-1.
    expect(usesForZone('UMUD-O')).toBeNull()
    expect(usesForZone('UR-2(CD)')).toBeNull()
  })
})
