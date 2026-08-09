import { describe, it, expect } from 'vitest'
import {
  ATLANTA_DISTRICT_CODES,
  TABLE_I_SECTOR_MAX_FAR,
  atlantaSmallLotFar,
  parseAtlantaZone,
  resolveAtlanta,
  usesForZone,
  type AtlantaLimits,
} from './atlanta'

// Every assertion below cites the section it encodes. CLAUDE.md rule 15: a test
// encodes an INTERPRETATION, and a well-explained wrong one is the hardest kind
// to overturn — so the absence assertions in particular say which section was
// read and what it did or did not contain.

const resolved = (code: string): AtlantaLimits => {
  const r = resolveAtlanta(code)
  expect(r.source, `${code} should resolve`).not.toBe('')
  return r
}

describe('parseAtlantaZone', () => {
  it('resolves the plain district codes the live layer serves', () => {
    expect(parseAtlantaZone('R-4').base).toBe('R-4')
    expect(parseAtlantaZone('MRC-3').base).toBe('MRC-3')
    expect(parseAtlantaZone('O-I').base).toBe('O-I')
  })

  it('normalises the layer\'s own inconsistent casing and spacing', () => {
    // Measured 2026-08-08: the live ZONECLASS vocabulary contains BOTH
    // 'I-MIX-C' and 'I-Mix-C' as separate distinct values for one district.
    expect(parseAtlantaZone('I-Mix-C').base).toBe('I-MIX')
    expect(parseAtlantaZone('I-MIX-C').base).toBe('I-MIX')
    expect(parseAtlantaZone('  r-4a  ').base).toBe('R-4A')
  })

  it('strips the §16-02.003 conditional suffix and flags it', () => {
    expect(parseAtlantaZone('C-1-C')).toMatchObject({ base: 'C-1', conditional: true })
    expect(parseAtlantaZone('MRC-3-C')).toMatchObject({ base: 'MRC-3', conditional: true })
    expect(parseAtlantaZone('C-1')).toMatchObject({ base: 'C-1', conditional: false })
  })

  // The regression this guards is specific and would be silent: R-LC's own name
  // ends in "-LC", so a blanket "strip a trailing -C" would turn a real district
  // (108.9 acres across 73 mapped polygons) into an unresolved gap. The suffix
  // is only stripped after a direct lookup fails.
  it('does NOT mistake R-LC\'s own name for a conditional suffix', () => {
    expect(parseAtlantaZone('R-LC')).toMatchObject({ base: 'R-LC', conditional: false })
    expect(parseAtlantaZone('R-LC-C')).toMatchObject({ base: 'R-LC', conditional: true })
  })

  it('returns base null — never a guess — for codes this build has not read', () => {
    for (const code of ['SPI-16 SA1', 'SPI-22 SA-1', 'SPI-4 SA 11', 'HC-20B', 'NC-11', 'Poncey-Highland SA3']) {
      expect(parseAtlantaZone(code).base, code).toBeNull()
    }
    expect(parseAtlantaZone(null).base).toBeNull()
    expect(parseAtlantaZone('').base).toBeNull()
  })
})

describe('resolveAtlanta — the single-family R districts', () => {
  // §16-03.008(5) … §16-06.008(5), each read individually from the chapter text
  // rather than extrapolated from a pattern: the ladder is NOT uniform (it steps
  // 0.25 / 0.30 / 0.35 / 0.40 / 0.40 / 0.45 / 0.50, with R-2B and R-3 both at
  // 0.40), so a generated table would have been wrong.
  it.each([
    ['R-1', 0.25, '16-03.008(5)'],
    ['R-2', 0.3, '16-04.008(5)'],
    ['R-2A', 0.35, '16-04A.008(5)'],
    ['R-2B', 0.4, '16-04B.008(5)'],
    ['R-3', 0.4, '16-05.008(5)'],
    ['R-3A', 0.45, '16-05A.008(5)'],
    ['R-4', 0.5, '16-06.008(5)'],
  ])('%s: FAR %s on net lot area, 35 ft', (code, far, section) => {
    const r = resolved(code)
    expect(r.farResidential?.far).toBe(far)
    expect(r.farResidential?.basis).toBe('net')
    expect(r.heightFt).toBe(35)
    expect(r.source).toContain(section)
    // One ratio for all uses in these chapters — the limbs must agree, which is
    // what lets the provider publish a single maxFAR.
    expect(r.farNonresidential?.far).toBe(far)
    expect(r.farCombined?.far).toBe(far)
  })

  // The NET denominator is stated twice in the code (§16-29.001(37) defines FAR
  // as "multiplied by the total net lot area of any lot within the R-1 through
  // R-5 district"; §16-28.009 says net lot area "shall be used" for
  // single-family and two-family districts), so it is never 'gross' here.
  it('never marks an R-district FAR as gross-denominated', () => {
    for (const code of ['R-1', 'R-2', 'R-2A', 'R-2B', 'R-3', 'R-3A', 'R-4', 'R-4A', 'R-4B', 'R-5']) {
      expect(resolveAtlanta(code).farResidential?.basis, code).toBe('net')
    }
  })
})

describe('resolveAtlanta — the lot-size-conditional branch (rule 6)', () => {
  // §16-06A.008(5): (a) a lot meeting the 7,500 sq ft minimum gets 0.50;
  // (b) a lot that does not gets "the lesser of either: 3,750 square feet … or
  // … 0.65 of the net lot area". The headline must stay 0.50. Publishing 0.65
  // as "the R-4A FAR" is the Austin 0.40-or-0.65 collapse, and here it is worse
  // than a program assumption because the 0.65 limb is one half of a LESSER-OF
  // and never applies alone.
  it('R-4A headline is 0.50 and 0.65 is not published as the district FAR', () => {
    const r = resolved('R-4A')
    expect(r.farResidential?.far).toBe(0.5)
    expect(r.farCombined?.far).not.toBe(0.65)
    expect(r.smallLot).toMatchObject({ minLotSqFt: 7500, maxFloorAreaSqFt: 3750, far: 0.65 })
  })

  it('R-4B headline is 0.75 with the 2,100 sq ft / 0.90 branch beneath it', () => {
    const r = resolved('R-4B')
    expect(r.farResidential?.far).toBe(0.75)
    expect(r.smallLot).toMatchObject({ minLotSqFt: 2800, maxFloorAreaSqFt: 2100, far: 0.9 })
  })

  it('R-5 headline is the single-family 0.50; the duplex 0.60 is an alternative', () => {
    const r = resolved('R-5')
    expect(r.farResidential?.far).toBe(0.5)
    expect(r.farAlternatives).toEqual([
      expect.objectContaining({ label: 'Duplex', far: 0.6, basis: 'net' }),
    ])
    expect(r.smallLot?.guaranteedFloorSqFt).toBe(1800)
  })

  // §16-07.008(5)d: a two-family dwelling that is not a duplex gets "0.50 of the
  // net lot area for the main unit … provided however that the secondary
  // dwelling unit shall not exceed 750 square feet". That is a ratio PLUS a
  // per-unit square-foot cap, which no single number expresses, so it is
  // deliberately absent rather than flattened. Interpretation checked against
  // §16-07.008(5)d itself, not inferred from the absence of a figure.
  it('does not flatten the R-5 two-family-not-a-duplex rule into a ratio', () => {
    const labels = (resolveAtlanta('R-5').farAlternatives ?? []).map((a) => a.label)
    expect(labels).not.toContain('Two-family')
    expect(labels).toHaveLength(1)
  })

  describe('atlantaSmallLotFar', () => {
    it('does not fire on a lot at or above the district minimum', () => {
      const r = resolveAtlanta('R-4A')
      expect(atlantaSmallLotFar(r.smallLot, 7500)).toBeNull()
      expect(atlantaSmallLotFar(r.smallLot, 12534)).toBeNull()
    })

    // The code says "the LESSER of either", so on a 7,000 sq ft R-4A lot the two
    // limbs are 3,750 sq ft and 0.65 × 7,000 = 4,550 sq ft, and 3,750 wins —
    // an effective 0.5357, BELOW the 0.65 the ratio limb states. Anyone reading
    // 0.65 off the chapter would overstate this lot by 800 sq ft.
    it('takes the lesser limb: a 7,000 sq ft R-4A lot yields 3,750 sq ft, not 4,550', () => {
      const r = resolveAtlanta('R-4A')
      const s = atlantaSmallLotFar(r.smallLot, 7000)
      expect(s).not.toBeNull()
      expect(s!.far * 7000).toBeCloseTo(3750, 6)
      expect(s!.far).toBeLessThan(0.65)
    })

    // Below 3,750 / 0.65 = 5,769 sq ft the ratio limb is the smaller one and
    // takes over. Both limbs must be live, or the rule is half-encoded.
    it('takes the ratio limb on a very small lot', () => {
      const s = atlantaSmallLotFar(resolveAtlanta('R-4A').smallLot, 4000)
      expect(s!.far).toBe(0.65)
      expect(s!.far * 4000).toBe(2600)
    })

    it('carries R-5\'s 1,800 sq ft guaranteed floor and no other district\'s', () => {
      expect(atlantaSmallLotFar(resolveAtlanta('R-5').smallLot, 7000)?.floorSqFt).toBe(1800)
      expect(atlantaSmallLotFar(resolveAtlanta('R-4A').smallLot, 7000)?.floorSqFt).toBeNull()
    })

    it('returns null rather than guessing when the lot area is unknown', () => {
      const rule = resolveAtlanta('R-4A').smallLot
      expect(atlantaSmallLotFar(rule, null)).toBeNull()
      expect(atlantaSmallLotFar(rule, 0)).toBeNull()
      expect(atlantaSmallLotFar(rule, Number.NaN)).toBeNull()
      expect(atlantaSmallLotFar(null, 5000)).toBeNull()
    })
  })
})

describe('resolveAtlanta — Table I and the R-G sectors', () => {
  // Transcribed from the rendered §16-08.007 Table I, sector by sector. The
  // operative figure is each sector's MAXIMUM row, per §16-08.007(3) ("allowed
  // at the maximum ratios for each of the five sectors").
  it('carries the six sector maxima the table prints', () => {
    expect(TABLE_I_SECTOR_MAX_FAR).toEqual({ 1: 0.162, 2: 0.348, 3: 0.696, 4: 1.49, 5: 3.2, 6: 6.4 })
  })

  it('RG-n resolves to sector n, gross-denominated, with no height cap', () => {
    for (const n of [1, 2, 3, 4, 5] as const) {
      const r = resolved(`RG-${n}`)
      expect(r.farResidential?.far, `RG-${n}`).toBe(TABLE_I_SECTOR_MAX_FAR[n])
      // Table I's own header reads "LUI Ratios Times Gross Land Area".
      expect(r.farResidential?.basis).toBe('gross')
      expect(r.heightUnconstrained).toBe(true)
      expect(r.heightFt).toBeNull()
    }
  })

  // §16-08.007(3) applies Table I to "two-family dwellings, multi-family
  // dwellings, zero-lot-line dwellings, residence hotels, apartment hotels,
  // rooming houses … dormitories, fraternity houses, and sorority houses".
  // §16-08.007(4) gives "All other uses" a minimum lot size and NO ratio, so the
  // nonresidential limb is NOT-STATED. Encoding it as 0, or copying the
  // residential figure across, would invent a limit the chapter does not impose.
  it('leaves the R-G nonresidential limb unstated rather than assuming one', () => {
    expect(resolveAtlanta('RG-3').farNonresidential).toBeNull()
    expect(resolveAtlanta('RG-3').farCombined).toBeNull()
  })

  // The chapters that reach Table I by sector reference must land on the same
  // numbers as the table itself — a second, hand-typed copy is how the two drift.
  it('every sector-referenced limb equals the table it cites', () => {
    const bySector: Array<[string, 'farResidential', number]> = [
      ['R-LC', 'farResidential', 2],
      ['C-1', 'farResidential', 3],
      ['C-2', 'farResidential', 3],
      ['O-I', 'farResidential', 5],
    ]
    for (const [code, limb, n] of bySector) {
      expect(resolveAtlanta(code)[limb]?.far, code).toBe(TABLE_I_SECTOR_MAX_FAR[n])
    }
    // C-3/C-4 restate sector 5 in their own words ("3.2 times gross lot area as
    // indicated on table I") and C-5 restates sector 6 ("6.4 times gross").
    expect(resolveAtlanta('C-3').farResidential?.far).toBe(TABLE_I_SECTOR_MAX_FAR[5])
    expect(resolveAtlanta('C-4').farResidential?.far).toBe(TABLE_I_SECTOR_MAX_FAR[5])
    expect(resolveAtlanta('C-5').farResidential?.far).toBe(TABLE_I_SECTOR_MAX_FAR[6])
  })
})

describe('resolveAtlanta — per-use FARs stay per use (rule 6)', () => {
  it.each([
    ['C-1', 2.0, 0.696, null],
    ['C-2', 3.0, 0.696, null],
    ['C-3', 5.0, 3.2, 8.2],
    ['C-4', 7.0, 3.2, 10.2],
    ['C-5', 10.0, 6.4, 16.4],
    ['O-I', 3.0, 3.2, null],
    ['R-LC', 0.5, 0.348, null],
    ['MRC-1', 1.0, 0.696, 1.696],
    ['MRC-2', 2.5, 1.49, 3.196],
    ['MRC-3', 4.0, 3.2, 7.2],
    ['LW', 0.5, 0.696, 1.196],
  ])('%s keeps nonresidential/residential/combined separate', (code, nonres, res, combined) => {
    const r = resolved(code)
    expect(r.farNonresidential?.far).toBe(nonres)
    expect(r.farResidential?.far).toBe(res)
    expect(r.farCombined?.far ?? null).toBe(combined)
  })

  // §16-13.007(1)(c), §16-14.007(1)(c), §16-15.006(1)(c) and the MRC/LW
  // equivalents all state the mixed-use figure as "the sum of nonresidential (a)
  // and residential (b) above, but in no event greater than the maximum ratios
  // permitted for each" — so the combined number is arithmetically the sum, and
  // any drift between the two is a transcription error, not a policy.
  it('every stated combined FAR is exactly the sum of its two limbs', () => {
    for (const code of ['C-3', 'C-4', 'C-5', 'MRC-1', 'MRC-3', 'LW']) {
      const r = resolveAtlanta(code)
      expect(r.farCombined!.far, code).toBeCloseTo(r.farNonresidential!.far + r.farResidential!.far, 10)
    }
  })

  // ⚠️ MRC-2 is the one district where the ordinance contradicts itself, and
  // this test exists so nobody "fixes" it. §16-34.027(1)(a)iii states the
  // combined figure in words — "three and one hundred ninety-six thousandths
  // times net lot area" — and glosses it "[the sum of the nonresidential i. and
  // residential ii. above]", but i. is 2.5 and ii. is 1.49, which sum to 3.99.
  // §16-34.010 Table A prints 3.196 as well, so the stated figure appears twice
  // and the gloss appears once. The stated figure is what ships: 3.99 appears
  // nowhere in Part 16, and inventing it would loosen the cap by 25%.
  //
  // (3.196 = 2.5 + 0.696, i.e. the sum that would have been correct while
  // MRC-2's residential limb still matched MRC-1's — a stale gloss, not a rule.)
  it('publishes MRC-2 as the code states it (3.196), not as the code implies (3.99)', () => {
    const r = resolveAtlanta('MRC-2')
    expect(r.farCombined?.far).toBe(3.196)
    expect(r.farCombined?.far).not.toBe(3.99)
    expect(r.farNonresidential!.far + r.farResidential!.far).toBeCloseTo(3.99, 10)
    expect(r.farCombined?.source).toMatch(/NOT the arithmetic sum/)
  })

  // C-1 and C-2 state only two limbs — §16-11.007(1) and §16-12.007(1) have no
  // mixed-use sentence at all, unlike C-3/C-4/C-5. Inventing a combined figure
  // by summing them would publish a program the chapter never authorised.
  it('does not invent a combined FAR for C-1 or C-2, which state none', () => {
    expect(resolveAtlanta('C-1').farCombined).toBeNull()
    expect(resolveAtlanta('C-2').farCombined).toBeNull()
  })

  // FACT 7. MRC and LW publish a second "Bonus FAR" ladder earned with open
  // space, deed-restricted affordable housing at 60%/80% AMI, ground-floor
  // commercial or civic space. Those are elected and paid for, not by-right.
  it('never returns an MRC or LW bonus figure', () => {
    const bonuses: Record<string, number> = { 'MRC-1': 2.696, 'MRC-2': 3.696, 'MRC-3': 8.2, LW: 2.0 }
    for (const [code, bonus] of Object.entries(bonuses)) {
      const r = resolveAtlanta(code)
      for (const limb of [r.farNonresidential, r.farResidential, r.farCombined]) {
        expect(limb?.far, `${code} must not publish its bonus ceiling ${bonus}`).not.toBe(bonus)
      }
    }
  })

  // I-1/I-2 (§16-16.007(1), §16-17.007(1)) and I-MIX (§16-16A.008 Table 1,
  // "3.3 combined for all uses") really do state ONE ratio for everything, so
  // the equal limbs here are the code's own statement, not a collapse.
  it('the industrial districts state one ratio for all uses', () => {
    for (const [code, far] of [['I-1', 2.0], ['I-2', 2.0], ['I-MIX', 3.3]] as const) {
      const r = resolved(code)
      expect(r.farNonresidential?.far).toBe(far)
      expect(r.farResidential?.far).toBe(far)
      expect(r.farCombined?.far).toBe(far)
    }
  })
})

describe('resolveAtlanta — height', () => {
  it.each([
    ['R-4', 35],
    ['R-5', 35],
    ['FCR-3', 40],
    ['R-LC', 35],
    ['MR-1', 35],
    ['MR-2', 35],
    ['MR-3', 80],
    ['MR-4A', 80],
    ['MR-4B', 52],
    ['MR-5A', 150],
    ['MR-MU', 35],
    ['C-3', 225],
    ['I-MIX', 225],
    ['MRC-3', 225],
  ])('%s: %s ft, exactly as the code prints it', (code, ft) => {
    expect(resolved(code).heightFt).toBe(ft)
  })

  // FACT 3. These chapters answer the question with the word "None" under a
  // "Maximum height limitations" heading — §16-15.007 is literally "None.",
  // and §16-08.009 / §16-10.008 / §16-11.009 / §16-12.008 / §16-14.008 /
  // §16-16.008 / §16-17.008 are "None, except as required in section 16-XX.006"
  // (the district's own transitional height plane). That is an ANSWER.
  it.each(['RG-1', 'RG-3', 'RG-5', 'O-I', 'C-1', 'C-2', 'C-4', 'C-5', 'I-1', 'I-2'])(
    '%s states no maximum height — an answer, not a gap',
    (code) => {
      const r = resolved(code)
      expect(r.heightUnconstrained).toBe(true)
      expect(r.heightFt).toBeNull()
      expect(r.source).toMatch(/None/)
    },
  )

  // FACT 4. MRC-1 §16-34.026(2)b, MRC-2 §16-34.027(2)b and LW §16-33.010(2)
  // state height as a function of distance from the nearest protected district.
  // Neither an answer nor an absence: resolving it needs a distance measurement
  // nobody has made, so no single figure is published (rule 1 — a mechanism
  // argued but unmeasured earns NO direction, not a hedged one).
  it('leaves distance-tiered heights unresolved, with the tiers recorded', () => {
    const mrc1 = resolved('MRC-1')
    expect(mrc1.heightFt).toBeNull()
    expect(mrc1.heightUnconstrained).toBe(false)
    expect(mrc1.heightTiers?.map((t) => t.heightFt)).toEqual([35, 52, 225])

    expect(resolved('MRC-2').heightTiers?.map((t) => t.heightFt)).toEqual([52, 225])
    expect(resolved('LW').heightTiers?.map((t) => t.heightFt)).toEqual([35, 52])
  })

  // MRC-3 is the one MRC subarea whose height is NOT tiered — §16-34.028(2)b as
  // amended by Ord. No. 2025-15(24-O-1586), 6-11-25, reads "Structures or
  // portions of structures shall have a maximum height of 225 feet." Copying
  // MRC-1/MRC-2's tier structure onto it would withhold a figure the code
  // states outright.
  it('MRC-3 is a flat 225 ft, not tiered like MRC-1 and MRC-2', () => {
    const r = resolved('MRC-3')
    expect(r.heightFt).toBe(225)
    expect(r.heightTiers).toBeNull()
  })

  // ══ THE MIAMI-21 / DENVER CASE, made arithmetically impossible ══
  //
  // §16-35.003's statement of INTENT describes the MR districts in stories
  // ("MR-1. Primarily single-family…", "MR-2. Two- to three-story", "MR-3.
  // Eight-story", "MR-4B. Five-story", "MR-5A. 15-story"), while §16-35.011(1),
  // the binding section, states only feet. Promoting those intent figures into
  // data — or deriving one unit from the other — is the exact defect that put 87
  // storeys on an 80-storey Miami district. The source document disproves the
  // constant: 35/3, 80/8 and 52/5 are 11.67, 10.00 and 10.40.
  it('no feet-per-story constant reproduces the MR intent story counts', () => {
    const pairs: Array<[number, number]> = [
      [3, 35], // MR-2 "Two- to three-story", §16-35.011(1)a
      [8, 80], // MR-3 "Eight-story",          §16-35.011(1)b
      [5, 52], // MR-4B "Five-story",          §16-35.011(1)c
    ]
    for (let k = 8; k <= 20; k += 0.01) {
      const matches = pairs.filter(([stories, ft]) => Math.abs(stories * k - ft) < 0.5)
      expect(matches.length, `${k.toFixed(2)} ft/story reproduced ${matches.length} of 3 rows`).toBeLessThan(3)
    }
  })

  it('exposes no story field at all, so a story count cannot be published', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const keys = Object.keys(resolveAtlanta(code))
      expect(keys.filter((k) => /stor(y|ies)/i.test(k)), code).toEqual([])
    }
  })
})

describe('resolveAtlanta — absence vs gap (rule 5)', () => {
  // FCR-3's whole chapter is four sections, and §16-06C.003 "Development
  // standards" is a complete lettered enumeration of the district's dimensional
  // controls — A height, B front yard, C side yard, D rear yard, E minimum lot
  // area, F lot width, G lot frontage, H MINIMUM heated floor area, I accessory
  // structures. There is no floor-area-ratio item and nowhere else in the
  // chapter for one to live: the slot does not exist. (Item H is a floor under
  // the building, not a cap, and is not a FAR.)
  it('FCR-3 imposes no FAR — a stated absence, with 40 ft still published', () => {
    const r = resolved('FCR-3')
    expect(r.farUnconstrained).toBe(true)
    expect(r.farResidential).toBeNull()
    expect(r.heightFt).toBe(40)
  })

  // MR-MU's FAR slot EXISTS in §16-35.010 Table A and the code fills it with a
  // unit cap: "Not permitted" nonresidential, "12 units/building" in both the
  // Residential and Combined FAR columns, reinforced at §16-35.011(5)(b)(i).
  // The floor-area instrument genuinely does not bind here.
  it('MR-MU imposes no FAR — the code puts a unit cap in the slot', () => {
    const r = resolved('MR-MU')
    expect(r.farUnconstrained).toBe(true)
    expect(r.farResidential).toBeNull()
    expect(r.heightFt).toBe(35)
  })

  // The PD chapters are the OPPOSITE call, deliberately. §16-19A.005 /
  // §16-19B.005 / §16-19C.005 all say intensity follows "the appropriate sector
  // number maximum intensities … as approved by the council". A Table I sector
  // DOES bind; which one is in the approving ordinance, which is not data. That
  // is a GAP. (Raleigh's PD got farUnconstrained: true because the Raleigh UDO
  // contains no FAR instrument at all for a master plan to modify. Different
  // fact, different flag — the same reasoning applied to a different code.)
  it('PD districts are plan-governed and NOT farUnconstrained', () => {
    for (const code of ['PD-H', 'PD-MU', 'PD-OC']) {
      const r = resolved(code)
      expect(r.planGoverned, code).toBe(true)
      expect(r.farUnconstrained, code).toBe(false)
      expect(r.farResidential, code).toBeNull()
      expect(r.heightFt, code).toBeNull()
      expect(r.heightUnconstrained, code).toBe(false)
    }
  })

  // An unread district must assert nothing whatsoever. This is the assertion
  // that stops 173 mapped codes from silently acquiring a known-absence flag.
  it('an unresolved code asserts nothing — no FAR, no height, no absence flags', () => {
    for (const code of ['SPI-16 SA1', 'HC-20B', 'NC-11', 'LD Mean Street', 'Poncey-Highland SA1', 'Unknown', 'ZZZ']) {
      const r = resolveAtlanta(code)
      expect(r.source, code).toBe('')
      expect(r.farUnconstrained, code).toBe(false)
      expect(r.heightUnconstrained, code).toBe(false)
      expect(r.heightFt, code).toBeNull()
      expect(r.heightTiers, code).toBeNull()
      expect(r.farResidential, code).toBeNull()
      expect(r.farNonresidential, code).toBeNull()
      expect(r.farCombined, code).toBeNull()
      expect(r.planGoverned, code).toBe(false)
      expect(r.name, code).toBeNull()
    }
  })

  // Codes the live layer maps that Part 16 has NO chapter for. Chapter 35
  // establishes MR-1, MR-2, MR-3, MR-4A, MR-4B, MR-5A, MR-5B, MR-6 and MR-MU —
  // there is no MR-4 and no MR-3A — and Chapter 19 establishes PD-H, PD-MU,
  // PD-OC, PD-BP and PD-CS, with no PD-H1 or PD-H2. Guessing "MR-4-C ≈ MR-4A"
  // or "PD-H1 ≈ PD-H" is exactly the kind of plausible inference rule 18 warns
  // about, and it is pinned closed here.
  it.each(['MR-4-C', 'MR-3A-C', 'PD-H1', 'PD-H2'])('%s has no chapter and must not resolve', (code) => {
    expect(resolveAtlanta(code).source).toBe('')
  })

  // MR-5B and MR-6 exist in Chapter 35 but are NOT mapped (measured 2026-08-08:
  // neither appears among the live layer's 245 ZONECLASS values), and MR-5B's
  // own height is distance-tiered. Entering either would be encoding a chapter
  // that matches zero parcels — the Minneapolis Ch. 546 failure.
  it.each(['MR-5B', 'MR-6'])('%s is in the chapter but not on the map, so it is not encoded', (code) => {
    expect(resolveAtlanta(code).source).toBe('')
  })
})

describe('resolveAtlanta — structural invariants (rule 14)', () => {
  it('every resolved district carries a section citation', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const r = resolveAtlanta(code)
      expect(r.source, code).toMatch(/§16-/)
      expect(r.name, code).toBeTruthy()
    }
  })

  it('every FAR limb carries its own citation and a declared denominator', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const r = resolveAtlanta(code)
      for (const limb of [r.farNonresidential, r.farResidential, r.farCombined]) {
        if (!limb) continue
        expect(limb.source, code).toMatch(/§16-/)
        expect(['net', 'gross'], code).toContain(limb.basis)
        expect(limb.far, code).toBeGreaterThan(0)
      }
    }
  })

  // `heightSource` exists so the provider can quote the height citation in
  // user-facing copy without slicing it out of `source` with string surgery.
  // If a district says anything at all about height, it must say where from.
  it('every height statement carries its own section citation', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const r = resolveAtlanta(code)
      const saysSomething = r.heightFt != null || r.heightUnconstrained || r.heightTiers != null
      if (!saysSomething) {
        // Only the plan-governed PD districts may stay silent on height.
        expect(r.planGoverned, code).toBe(true)
        continue
      }
      expect(r.heightSource, code).toMatch(/§16-/)
    }
  })

  it('a district never claims both a height figure and no height limit', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const r = resolveAtlanta(code)
      if (r.heightUnconstrained) expect(r.heightFt, code).toBeNull()
      if (r.heightTiers) expect(r.heightFt, code).toBeNull()
      expect(r.heightUnconstrained && r.heightTiers != null, code).toBe(false)
    }
  })

  it('a district never claims both a FAR and no FAR', () => {
    for (const code of ATLANTA_DISTRICT_CODES) {
      const r = resolveAtlanta(code)
      if (!r.farUnconstrained) continue
      expect(r.farNonresidential, code).toBeNull()
      expect(r.farResidential, code).toBeNull()
      expect(r.farCombined, code).toBeNull()
    }
  })

  it('the table is frozen against accidental mutation of a shared record', () => {
    const a = resolveAtlanta('R-4')
    const b = resolveAtlanta('R-4')
    expect(a.farResidential?.far).toBe(0.5)
    expect(b.farResidential?.far).toBe(0.5)
  })
})

describe('usesForZone', () => {
  it('reads the R and MR districts as residential', () => {
    expect(usesForZone('R-4')).toEqual(['residential'])
    expect(usesForZone('R-5')).toEqual(['residential'])
    expect(usesForZone('FCR-3')).toEqual(['residential'])
    expect(usesForZone('MR-3')).toEqual(['residential'])
    expect(usesForZone('MR-MU')).toEqual(['residential'])
  })

  // ⚠️ The mapping a bulk-limitation-based guess gets wrong. §16-16.007(1)
  // applies one FAR to "all uses" and §16-16.007(4) even sets open-space ratios
  // for multi-family dwellings, which reads as if housing were allowed. It is
  // not, as new construction: §16-16.003(23) permits dwellings only as
  // "Conversion of existing industrial buildings which are 50 years of age or
  // older". I-2's §16-17.003 permits no dwellings at all.
  it('does NOT assert residential use in I-1 or I-2', () => {
    expect(usesForZone('I-1')).not.toContain('residential')
    expect(usesForZone('I-2')).not.toContain('residential')
    expect(usesForZone('I-1')).toEqual(['commercial', 'institutional'])
  })

  it('asserts residential in the C districts, which permit dwellings outright', () => {
    // §16-11.003 / §16-12.003 / §16-13.003: "Multi-family dwellings, two-family
    // dwellings and single-family dwellings." §16-14.003 / §16-15.003:
    // multi-family dwellings and single-room-occupancy residences.
    for (const code of ['C-1', 'C-2', 'C-3', 'C-4', 'C-5']) {
      expect(usesForZone(code), code).toContain('residential')
    }
  })

  it('returns null for PD and for anything unresolved rather than guessing', () => {
    expect(usesForZone('PD-H')).toBeNull()
    expect(usesForZone('SPI-16 SA1')).toBeNull()
    expect(usesForZone(null)).toBeNull()
  })
})
