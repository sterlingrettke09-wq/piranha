import { describe, it, expect } from 'vitest'
import {
  resolveColumbus,
  selectColumbusCode,
  title33HeightFt,
  usesForZone,
  isSiteSpecificClass,
  COLUMBUS_TITLE34_LIMITS,
  COLUMBUS_TITLE33_NO_FAR,
  COLUMBUS_HEIGHT_DISTRICT_FT,
  COLUMBUS_SITE_SPECIFIC_CLASSES,
  COLUMBUS_AMBIGUOUS_CLASSES,
  type ColumbusZoneInput,
} from './columbus'

// Shorthand for the shape the live Base Zoning layer returns.
const zone = (
  classification: string,
  generalZoningCategory: string,
  heightDistrict: string,
  inUniversityOverlay = false,
): ColumbusZoneInput => ({ classification, generalZoningCategory, heightDistrict, inUniversityOverlay })

describe('selectColumbusCode — the two-codes discriminator', () => {
  it("selects Title 34 on GENERAL_ZONING_CATEGORY 'Mixed-Use' and nothing else", () => {
    expect(selectColumbusCode('Mixed-Use')).toBe('title-34')
    expect(selectColumbusCode('mixed-use')).toBe('title-34')
    for (const other of [
      'Residential',
      'Multi-family',
      'Commercial',
      'Manufacturing',
      'Institutional',
      'Research Park',
      'Parking',
      'Downtown District',
      'East Franklinton District',
      'Neighborhood Edge',
      'Neighborhood General',
      'Neighborhood Center',
      'Town Center',
      'Excavation/Quarrying',
      'Manufactured Home',
    ]) {
      expect(selectColumbusCode(other)).toBe('title-33')
    }
  })

  it('refuses to decide when the layer gave no category', () => {
    expect(selectColumbusCode(null)).toBeNull()
    expect(selectColumbusCode(undefined)).toBeNull()
    expect(selectColumbusCode('  ')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// THE MINNEAPOLIS CH. 546 GUARD, BOTH WAYS.
// A vocabulary from one code must resolve to NOTHING through the other. Without
// this, the two live Columbus codes silently borrow each other's numbers.
// ════════════════════════════════════════════════════════════════════════════
describe('the two vocabularies are disjoint', () => {
  it("Title 34's six districts resolve to nothing through the Title 33 path", () => {
    for (const cls of ['UGN-1', 'UGN-2', 'UCT', 'UCR', 'UCR-R', 'CAC', 'RAC']) {
      // Same district string, but categorised as a Title 33 family.
      const r = resolveColumbus(zone(cls, 'Commercial', 'H-60'))
      expect(r.code).toBe('title-33')
      expect(r.stories).toBeNull()
      expect(r.farUnconstrained).toBeUndefined()
      expect(r.farGap).toBeTruthy()
      // It must NOT pick up the Title 34 building form.
      expect(r.heightFt).toBe(60)
    }
  })

  it("Title 33's base districts resolve to nothing through the Title 34 table", () => {
    for (const cls of ['R3', 'AR1', 'C4', 'M', 'DD', 'UCRPD', 'LUCRPD']) {
      const r = resolveColumbus(zone(cls, 'Mixed-Use', 'H-N/A'))
      expect(r.code).toBe('title-34')
      expect(r.heightFt).toBeNull()
      expect(r.stories).toBeNull()
      expect(r.heightGap).toContain('E.20.020.A')
      expect(r.farUnconstrained).toBeUndefined()
    }
  })

  // The specific collision the live data contains. 46 polygons.
  it('UCR (Title 34 Urban Core) and UCRPD/LUCRPD (Title 33 research park) never share a figure', () => {
    const urbanCore = resolveColumbus(zone('UCR', 'Mixed-Use', 'H-N/A'))
    expect(urbanCore.heightFt).toBe(150)
    expect(urbanCore.stories).toBe(12)

    // Live values, OSU campus 2026-08-08: LUCRPD / Research Park / H-110.
    const researchPark = resolveColumbus(zone('LUCRPD', 'Research Park', 'H-110'))
    expect(researchPark.heightFt).toBe(110)
    expect(researchPark.stories).toBeNull()
    expect(researchPark.heightFt).not.toBe(150)

    // And the other mapped combination: UCRPD at H-60.
    const ucrpd = resolveColumbus(zone('UCRPD', 'Research Park', 'H-60'))
    expect(ucrpd.heightFt).toBe(60)
    expect(ucrpd.heightFt).not.toBe(150)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// TITLE 34 — both units printed, neither derived
// ════════════════════════════════════════════════════════════════════════════
describe('Title 34 building form (Ch. E.20, Division D)', () => {
  const EXPECTED: Array<[string, number, number]> = [
    // district, stories (max), feet (max)
    ['UGN-1', 4, 48], // E.20.040
    ['UGN-2', 4, 48], // E.20.050
    ['UCT', 5, 60], // E.20.060
    ['UCR', 12, 150], // E.20.070
    ['UCR-R', 12, 150], // E.20.070, restricted sub-district
    ['CAC', 5, 60], // E.20.080
    ['RAC', 7, 85], // E.20.090
  ]

  it.each(EXPECTED)('%s publishes %i stories and %i ft — both code-stated', (cls, stories, feet) => {
    const r = resolveColumbus(zone(String(cls), 'Mixed-Use', 'H-N/A'))
    expect(r.stories).toBe(stories)
    expect(r.heightFt).toBe(feet)
    expect(r.heightBasis).toBe('code-stated')
  })

  // ── THE MIAMI-21 ROUND-TRIP, MADE ARITHMETICALLY IMPOSSIBLE ──────────────
  // Miami published 87 storeys for a district whose code says 80, by
  // multiplying stories into feet with one constant and dividing back with
  // another. Columbus's own table disproves that any such constant exists here.
  it('NO feet-per-story constant reproduces all six Title 34 rows', () => {
    // Sweep every plausible floor-to-floor convention, at 0.1 ft resolution.
    const reproducesAll = (k: number) =>
      EXPECTED.every(([, stories, feet]) => Math.abs(Number(stories) * k - Number(feet)) < 0.5)
    const survivors: number[] = []
    for (let k = 100; k <= 180; k++) {
      if (reproducesAll(k / 10)) survivors.push(k / 10)
    }
    expect(survivors).toEqual([])

    // And the reason, stated as data rather than prose: the implied ratios
    // differ between adjacent districts.
    expect(48 / 4).toBe(12) // UGN-1
    expect(150 / 12).toBe(12.5) // UCR
    expect(Number((85 / 7).toFixed(2))).toBe(12.14) // RAC
  })

  // ── RULE 6: THE BONUS IS EARNED, NEVER THE CEILING ──────────────────────
  it('the height bonus never appears as the by-right limit', () => {
    const ucr = resolveColumbus(zone('UCR', 'Mixed-Use', 'H-N/A'))
    expect(ucr.heightFt).not.toBe(200)
    expect(ucr.stories).not.toBe(16)
    expect(ucr.alternatives?.[0]).toMatchObject({ stories: 16, heightFt: 200 })
    expect(ucr.alternatives?.[0].source).toContain('G.30')

    const rac = resolveColumbus(zone('RAC', 'Mixed-Use', 'H-N/A'))
    expect(rac.heightFt).toBe(85)
    expect(rac.alternatives?.[0]).toMatchObject({ stories: 10, heightFt: 125 })

    const cac = resolveColumbus(zone('CAC', 'Mixed-Use', 'H-N/A'))
    expect(cac.alternatives?.[0]).toMatchObject({ stories: 7, heightFt: 85 })
  })

  // E.20.040 D and E.20.050 D both print "Not Applicable" in the bonus row.
  it('UGN-1 and UGN-2 carry no bonus at all — the code prints "Not Applicable"', () => {
    expect(resolveColumbus(zone('UGN-1', 'Mixed-Use', 'H-N/A')).alternatives).toBeUndefined()
    expect(resolveColumbus(zone('UGN-2', 'Mixed-Use', 'H-N/A')).alternatives).toBeUndefined()
  })

  it('every curated Title 34 entry carries BOTH a story count and a feet figure', () => {
    for (const [cls, e] of Object.entries(COLUMBUS_TITLE34_LIMITS)) {
      expect(typeof e.stories, cls).toBe('number')
      expect(typeof e.heightFt, cls).toBe('number')
      expect(e.heightBasis, cls).toBe('code-stated')
    }
  })

  it('Title 34 charters exactly the districts the live layer maps as Mixed-Use', () => {
    // Measured 2026-08-08 on Base Zoning: the Mixed-Use category holds exactly
    // these seven values (1,619 polygons).
    expect(Object.keys(COLUMBUS_TITLE34_LIMITS).sort()).toEqual(
      ['CAC', 'RAC', 'UCR', 'UCR-R', 'UGN-1', 'UGN-2', 'UCT'].sort(),
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// TITLE 33 HEIGHT — four symbols the code establishes, and no parser
// ════════════════════════════════════════════════════════════════════════════
describe('Title 33 height districts (C.C. 3309.14)', () => {
  it('resolves the four the code establishes, with the feet the code states', () => {
    expect(title33HeightFt('H-35')).toBe(35)
    expect(title33HeightFt('H-60')).toBe(60)
    expect(title33HeightFt('H-110')).toBe(110)
    expect(title33HeightFt('H-200')).toBe(200)
    expect(Object.keys(COLUMBUS_HEIGHT_DISTRICT_FT).sort()).toEqual(['H-110', 'H-200', 'H-35', 'H-60'])
  })

  // ⚠️ THIS ABSENCE ASSERTION ENCODES AN INTERPRETATION (CLAUDE.md rule 15), so
  // the interpretation is named and sourced rather than asserted. It is NOT
  // "the digits are unparseable"; it is that the digits have been checked
  // against the establishing ordinances and found wrong more often than right.
  //
  //   H-65  → Ord. 0538-2025 § 2 (case Z24-069, 1501 Gerrard Ave and seven
  //           others): "That a Height District of sixty (60) feet is hereby
  //           established". The layer's polygon sits on 1505-1509 Gerrard Ave.
  //   H-100 → Ord. 1401-2009 § 2 (case Z09-020, 1280 Gemini Pl): "That a Height
  //           District of One-hundred-ten (110) feet is hereby established".
  //
  // Against that, all four code-established symbols agreed with their
  // ordinances when checked (H-35 and H-45 in Ord. 1386-99, H-60 in Ord.
  // 1966-2022, H-110 in Ord. 1960-2025, H-200 in Ord. 0289-2022).
  it('returns null for every off-schedule symbol — measured, not cautious', () => {
    for (const s of ['H-40', 'H-41', 'H-45', 'H-50', 'H-65', 'H-66', 'H-90', 'H-100', 'H-120']) {
      expect(title33HeightFt(s), s).toBeNull()
    }
    // The two that would have been wrong, named explicitly so a future "just
    // parse the digits" change fails here with the reason attached.
    expect(title33HeightFt('H-65')).not.toBe(65) // ordinance says 60
    expect(title33HeightFt('H-100')).not.toBe(100) // ordinance says 110
  })

  it("H-UNLTD is a GAP, not `heightUnconstrained` — the symbol is nowhere in Title 33", () => {
    expect(title33HeightFt('H-UNLTD')).toBeNull()
    // Live values at the Ohio Statehouse block, 2026-08-08.
    const r = resolveColumbus(zone('DD', 'Downtown District', 'H-UNLTD'))
    expect(r.heightFt).toBeNull()
    expect(r.heightGap).toContain('H-UNLTD')
    expect(r.heightGap).toContain('3309.14')
    // Nothing in the module may claim the absence.
    expect(JSON.stringify(r)).not.toContain('heightUnconstrained')
  })

  it('Title 33 never publishes a story count — it states none, anywhere', () => {
    for (const [cls, cat, h] of [
      ['R3', 'Residential', 'H-35'],
      ['AR1', 'Multi-family', 'H-60'],
      ['C4', 'Commercial', 'H-110'],
      ['M', 'Manufacturing', 'H-200'],
    ] as const) {
      const r = resolveColumbus(zone(cls, cat, h))
      expect(r.stories, cls).toBeNull()
    }
  })

  // The mapped height district is a POLYGON-level fact, not a district-level
  // one: Ord. 1966-2022 put 60 ft on the AR-3 part of one site and 35 ft on the
  // CPD part. Resolving height from the district string could not express that.
  it('the same district code resolves different heights on different polygons', () => {
    expect(resolveColumbus(zone('AR3', 'Multi-family', 'H-35')).heightFt).toBe(35)
    expect(resolveColumbus(zone('AR3', 'Multi-family', 'H-60')).heightFt).toBe(60)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// FAR — an absence and a gap must never render the same (rule 5)
// ════════════════════════════════════════════════════════════════════════════
describe('FAR', () => {
  it('never returns a FAR number, and never falls back to 1.0', () => {
    const all = [
      resolveColumbus(zone('R3', 'Residential', 'H-35')),
      resolveColumbus(zone('UCT', 'Mixed-Use', 'H-N/A')),
      resolveColumbus(zone('CPD', 'Commercial', 'H-60')),
      resolveColumbus(zone('LUCRPD', 'Research Park', 'H-110')),
    ]
    for (const r of all) {
      expect(r).not.toHaveProperty('far')
      expect(r).not.toHaveProperty('maxFAR')
    }
  })

  it('`farUnconstrained` and `farGap` are mutually exclusive, in both directions', () => {
    const cases: ColumbusZoneInput[] = [
      zone('R3', 'Residential', 'H-35'),
      zone('AR12', 'Multi-family', 'H-35'),
      zone('C4', 'Commercial', 'H-110'),
      zone('M', 'Manufacturing', 'H-200'),
      zone('DD', 'Downtown District', 'H-UNLTD'),
      zone('UCT', 'Mixed-Use', 'H-N/A'),
      zone('CPD', 'Commercial', 'H-60'),
      zone('LC4', 'Commercial', 'H-45'),
      zone('PUD8', 'Multi-family', 'H-35'),
      zone('LRR', 'Residential', 'H-35'),
      zone('UCR', 'Mixed-Use', 'H-N/A', true),
      { classification: null, generalZoningCategory: null, heightDistrict: null },
    ]
    for (const c of cases) {
      const r = resolveColumbus(c)
      const answered = r.farUnconstrained === true
      const gapped = typeof r.farGap === 'string' && r.farGap.length > 0
      expect(answered !== gapped, JSON.stringify(c)).toBe(true)
    }
  })

  it('Title 33 base districts are FAR-unconstrained, with the governing instrument named', () => {
    for (const cls of ['R3', 'SR', 'AR12', 'ARO', 'I', 'C2', 'M1', 'EQ', 'P1', 'DD', 'NE', 'TC']) {
      const r = resolveColumbus(zone(cls, cls === 'DD' ? 'Downtown District' : 'Residential', 'H-35'))
      expect(r.farUnconstrained, cls).toBe(true)
      expect(r.farGap, cls).toBeUndefined()
    }
    // Every entry says what governs instead — "no FAR" is only an answer when
    // you can name the instrument that binds.
    for (const [cls, why] of Object.entries(COLUMBUS_TITLE33_NO_FAR)) {
      expect(why, cls).toMatch(/no FAR section/)
      expect(why.length, cls).toBeGreaterThan(30)
    }
  })

  it('Title 34 districts are FAR-unconstrained — the title has no FAR row at all', () => {
    for (const cls of ['UGN-1', 'UGN-2', 'UCT', 'UCR', 'UCR-R', 'CAC', 'RAC']) {
      expect(resolveColumbus(zone(cls, 'Mixed-Use', 'H-N/A')).farUnconstrained, cls).toBe(true)
    }
  })

  // ── THE UNIVERSITY DISTRICT OVERLAY OVERRIDE ─────────────────────────────
  // C.C. Ch. 3325 imposes a real FAR, and C.C. 3304.03(H) puts it on the list
  // of Title 33 chapters that apply to the 2024 Zoning Code too. So the flag is
  // affirmatively FALSE inside the overlay — on BOTH codes.
  it('the University District overlay downgrades FAR to a gap on both codes', () => {
    // Live 2026-08-08: 1494 N High St is UCR (Title 34) inside University/Impact.
    const t34 = resolveColumbus(zone('UCR', 'Mixed-Use', 'H-N/A', true))
    expect(t34.farUnconstrained).toBeUndefined()
    expect(t34.farGap).toContain('3325')
    // Height is unaffected — Ch. 3325 is a FAR/design overlay, and Title 34's
    // building form still states these numbers.
    expect(t34.heightFt).toBe(150)
    expect(t34.stories).toBe(12)

    const t33 = resolveColumbus(zone('AR3', 'Multi-family', 'H-35', true))
    expect(t33.farUnconstrained).toBeUndefined()
    expect(t33.farGap).toContain('3325')
    expect(t33.heightFt).toBe(35)
  })

  it('the same districts OUTSIDE the overlay keep the absence', () => {
    expect(resolveColumbus(zone('UCR', 'Mixed-Use', 'H-N/A', false)).farUnconstrained).toBe(true)
    expect(resolveColumbus(zone('AR3', 'Multi-family', 'H-35', false)).farUnconstrained).toBe(true)
  })

  // ── SITE-SPECIFIC ORDINANCE DISTRICTS ────────────────────────────────────
  it('limited and planned districts are a FAR gap, never an absence', () => {
    for (const cls of ['CPD', 'PUD8', 'PC', 'UCRPD', 'LUCRPD', 'LC4', 'LAR12', 'LM', 'LSR']) {
      const r = resolveColumbus(zone(cls, 'Commercial', 'H-60'))
      expect(r.farUnconstrained, cls).toBeUndefined()
      expect(r.farGap, cls).toBeTruthy()
      expect(r.siteSpecific, cls).toBe(true)
      // The base district's height still resolves — it is a ceiling the site may
      // not have, which is why `siteSpecific` rides alongside it.
      expect(r.heightFt, cls).toBe(60)
    }
  })

  it('the ambiguous symbols LRR and LR resolve to a gap, not to either reading', () => {
    for (const cls of Object.keys(COLUMBUS_AMBIGUOUS_CLASSES)) {
      const r = resolveColumbus(zone(cls, 'Residential', 'H-35'))
      expect(r.farUnconstrained, cls).toBeUndefined()
      expect(r.farGap, cls).toContain('ambiguous')
    }
    // And LRR is NOT in the answered roster even though C.C. 3309.05 does
    // establish a base district by that symbol.
    expect(COLUMBUS_TITLE33_NO_FAR).not.toHaveProperty('LRR')
  })

  it('isSiteSpecificClass catches the "L" limited-overlay families by shape', () => {
    expect(isSiteSpecificClass('LC4')).toBe(true) // L + C4
    expect(isSiteSpecificClass('LARLD')).toBe(true) // L + ARLD
    expect(isSiteSpecificClass('LM2')).toBe(true) // L + M2
    expect(isSiteSpecificClass('LP1')).toBe(true) // L + P1
    expect(isSiteSpecificClass('LRRR')).toBe(true) // L + RRR
    expect(isSiteSpecificClass('R3')).toBe(false)
    expect(isSiteSpecificClass('I')).toBe(false)
    // Not every L-word is a limited overlay — LUCRPD is listed explicitly
    // because "UCRPD" is not in the base-district roster.
    expect(isSiteSpecificClass('LUCRPD')).toBe(true)
    expect(COLUMBUS_SITE_SPECIFIC_CLASSES).toHaveProperty('LUCRPD')
  })

  it('an unrecognised district is a gap on both dimensions, never an answer', () => {
    const r = resolveColumbus(zone('ZZZ-9', 'Commercial', 'H-77'))
    expect(r.heightFt).toBeNull()
    expect(r.heightGap).toBeTruthy()
    expect(r.farUnconstrained).toBeUndefined()
    expect(r.farGap).toBeTruthy()
  })

  it('no zoning at all yields a gap on both dimensions', () => {
    const r = resolveColumbus({ classification: null, generalZoningCategory: null, heightDistrict: null })
    expect(r.code).toBeNull()
    expect(r.heightFt).toBeNull()
    expect(r.stories).toBeNull()
    expect(r.farUnconstrained).toBeUndefined()
    expect(r.heightGap).toBeTruthy()
    expect(r.farGap).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// USES
// ════════════════════════════════════════════════════════════════════════════
describe('usesForZone', () => {
  it('keys on the city\'s own category, not on the district string', () => {
    expect(usesForZone('Mixed-Use')).toEqual(['residential', 'commercial', 'mixed'])
    expect(usesForZone('Residential')).toEqual(['residential'])
    expect(usesForZone('Multi-family')).toEqual(['residential'])
    expect(usesForZone('Manufactured Home')).toEqual(['residential'])
    expect(usesForZone('Manufacturing')).toEqual(['commercial'])
    expect(usesForZone('Excavation/Quarrying')).toEqual(['commercial'])
    expect(usesForZone('Institutional')).toEqual(['institutional'])
  })

  // The rule-6 distinction: Columbus commercial districts permit dwellings only
  // ABOVE a permitted commercial use (C.C. 3351.05(B), 3353.05(B), 3355.05(C),
  // 3356.05(C)). Publishing 'residential' would say a standalone apartment
  // building is as-of-right on a C-2 lot. It is not.
  it("commercial districts are mixed-use vertically, not residential", () => {
    expect(usesForZone('Commercial')).toEqual(['commercial', 'mixed'])
    expect(usesForZone('Commercial')).not.toContain('residential')
  })

  it('returns null for the categories whose use chapters have not been read', () => {
    for (const c of [
      'Research Park',
      'Downtown District',
      'East Franklinton District',
      'Parking',
      'Neighborhood Edge',
      'Neighborhood General',
      'Neighborhood Center',
      'Town Center',
    ]) {
      expect(usesForZone(c), c).toBeNull()
    }
    expect(usesForZone(null)).toBeNull()
  })
})
