import { describe, it, expect } from 'vitest'
import {
  resolveMilwaukee,
  normalizeMilwaukeeZone,
  usesForZone,
  MILWAUKEE_RESIDENTIAL,
  MILWAUKEE_COMMERCIAL,
  MILWAUKEE_INDUSTRIAL,
  MILWAUKEE_DOWNTOWN,
  MILWAUKEE_SPECIAL,
  MILWAUKEE_DISTRICT_CODES,
  MILWAUKEE_DISTRICT_NAMES,
  type MilwaukeeLimits,
} from './milwaukee'

/**
 * The 52 distinct values the live zoning layer publishes, measured 2026-08-08:
 *   .../planning/zoning/MapServer/12/query
 *     ?where=1=1&outFields=Zoning&returnDistinctValues=true&orderByFields=Zoning
 * Written down here verbatim so the curated table is checked against what the
 * MAP actually carries, not against itself — the Minneapolis Chapter 546 trap
 * was an encoded chapter that matched zero parcels.
 */
const LIVE_ZONING_VALUES = [
  'C9A(A)', 'C9A(B)', 'C9B(A)', 'C9B(B)', 'C9C', 'C9D(A)', 'C9D(B)', 'C9E',
  'C9F(A)', 'C9F(B)', 'C9F(C)', 'C9G', 'C9H', 'CS', 'IC', 'IH', 'IL1', 'IL2',
  'IM', 'IO1', 'IO2', 'LB1', 'LB2', 'LB3', 'NS1', 'NS2', 'PD', 'PK', 'RB1',
  'RB2', 'RED', 'RM1', 'RM2', 'RM3', 'RM4', 'RM5', 'RM6', 'RM7', 'RO1', 'RO2',
  'RS1', 'RS2', 'RS3', 'RS4', 'RS5', 'RS6', 'RT1', 'RT2', 'RT3', 'RT4', 'TL', 'X',
] as const

/** The four values that are deliberately a GAP, and why. Everything else must
 *  produce a substantive answer. */
const DELIBERATE_GAPS = new Set(['PK', 'PD', 'RED', 'X'])

const ALL_TABLES: Array<Record<string, MilwaukeeLimits>> = [
  MILWAUKEE_RESIDENTIAL,
  MILWAUKEE_COMMERCIAL,
  MILWAUKEE_INDUSTRIAL,
  MILWAUKEE_DOWNTOWN,
  MILWAUKEE_SPECIAL,
]

const everyEntry = (): Array<[string, MilwaukeeLimits]> =>
  ALL_TABLES.flatMap((t) => Object.entries(t))

describe('Milwaukee zoning table — coverage against the live map', () => {
  it('resolves every district code the zoning layer actually publishes', () => {
    const unresolved = LIVE_ZONING_VALUES.filter(
      (z) => !DELIBERATE_GAPS.has(z) && resolveMilwaukee(z).source === '',
    )
    expect(unresolved).toEqual([])
  })

  it('the curated table adds exactly RT5 to the live vocabulary, and nothing else', () => {
    const live = new Set<string>(LIVE_ZONING_VALUES)
    const extra = MILWAUKEE_DISTRICT_CODES.filter((c) => !live.has(c))
    // RT5 was created by ordinance on 2025-04-22 and must be applied
    // parcel-by-parcel by rezoning; none has been, so the GIS has no RT5
    // polygon. A curated entry the map does not know about is normally a
    // Minneapolis-Chapter-546 smell — this is the one justified case, and it is
    // enumerated rather than tolerated in bulk.
    expect(extra).toEqual(['RT5'])
  })

  it('RT5 resolves to 48 ft even though no parcel is mapped RT5 today', () => {
    const rt5 = resolveMilwaukee('RT5')
    expect(rt5.heightFt).toBe(48)
    expect(rt5.source).not.toBe('')
    // It shares RT4's figure, which is what the code's eleventh column states.
    expect(rt5.heightFt).toBe(resolveMilwaukee('RT4').heightFt)
  })

  it('an unrecognised code asserts NOTHING — not a height, not a FAR absence', () => {
    for (const bogus of ['', '  ', 'RS9', 'C9Z', 'B-3', 'RM8', 'C9F(D)', null, undefined]) {
      const r = resolveMilwaukee(bogus)
      expect(r.heightFt).toBeNull()
      expect(r.heightUnconstrained).toBe(false)
      expect(r.farUnconstrained).toBe(false)
      expect(r.heightByUse).toEqual([])
      expect(r.source).toBe('')
    }
  })

  it('normalises whitespace and case but keeps the downtown subdistrict', () => {
    expect(normalizeMilwaukeeZone(' c9f(b) ')).toBe('C9F(B)')
    expect(resolveMilwaukee(' c9f(c) ').heightFt).toBe(50)
    // C9F(B) and C9F(C) are different districts with different limits —
    // stripping the subdistrict would publish "none" for a 50 ft district.
    expect(resolveMilwaukee('C9F(B)').heightFt).toBeNull()
    expect(resolveMilwaukee('C9F(C)').heightFt).toBe(50)
  })
})

describe('Milwaukee zoning table — every value carries a citation', () => {
  it('no resolved district exists without a source, and no height rule either', () => {
    for (const [code, limits] of everyEntry()) {
      if (DELIBERATE_GAPS.has(code)) continue
      expect(limits.source, `${code} has no citation`).not.toBe('')
      for (const rule of limits.heightByUse) {
        expect(rule.source, `${code}/${rule.useLabel} has no citation`).toMatch(/295-/)
        expect(rule.useLabel).not.toBe('')
      }
    }
  })
})

describe('Milwaukee heights are FEET the code prints — never derived (rule 12)', () => {
  // Chapter 295 prints exactly these figures in its height cells. Pinning the
  // set is what makes a derived number impossible to slip in: 3 storeys x 11 ft
  // = 33 and x 12 = 36 are not in it, and neither is any other product.
  const PRINTED_FIGURES = new Set([40, 45, 48, 50, 60, 75, 85])

  it('every published height is one of the figures Chapter 295 actually prints', () => {
    for (const [code, limits] of everyEntry()) {
      if (limits.heightFt == null) continue
      expect(PRINTED_FIGURES.has(limits.heightFt), `${code} publishes ${limits.heightFt}`).toBe(true)
      for (const rule of limits.heightByUse) {
        if (rule.heightFt == null) continue
        expect(PRINTED_FIGURES.has(rule.heightFt), `${code}/${rule.useLabel} = ${rule.heightFt}`).toBe(true)
      }
    }
  })

  it('no district carries a story count anywhere in its resolved limits', () => {
    // Milwaukee states no story cap. Table 295-505-2 DOES carry a row headed
    // "Max. no. of stories without side or rear setback adjustment" (RS1 2,
    // RS4 3, RT4 4, RM5 6, RM6 8, RO2 8), and it is a SETBACK trigger, not a
    // height limit — a building may exceed it by adjusting its setbacks. This
    // asserts that none of those numbers, and no key resembling a story count,
    // ever appears in a resolved district. It is the Denver "B-3" failure in
    // advance: a number that is not a storey count being read as one.
    const SETBACK_TRIGGER_STORY_COUNTS = [2, 3, 4, 6, 8]
    for (const [code, limits] of everyEntry()) {
      const json = JSON.stringify(limits)
      expect(json, `${code} mentions stories`).not.toMatch(/"stories"|"maxStories"|storey/i)
      for (const n of SETBACK_TRIGGER_STORY_COUNTS) {
        expect(limits.heightFt, `${code} published the setback-trigger story count ${n}`).not.toBe(n)
      }
    }
  })

  it('no feet-per-story constant can reproduce the published set', () => {
    // Belt and braces on the above: if someone reintroduced "height = stories x
    // C", the published figures would be multiples of a single C. 45 and 48
    // are adjacent districts (RT3 and RT4) and share no plausible common
    // per-storey factor, so this cannot be satisfied by accident.
    for (let c = 8; c <= 20; c += 0.5) {
      const reproduces = [45, 48, 75, 85].every((h) => Number.isInteger(h / c))
      expect(reproduces, `constant ${c} reproduces the table`).toBe(false)
    }
  })
})

describe('Milwaukee FAR — a stated absence, a formula, and a gap are three things', () => {
  it('residential, commercial, industrial and institutional districts are farUnconstrained', () => {
    for (const table of [
      MILWAUKEE_RESIDENTIAL,
      MILWAUKEE_COMMERCIAL,
      MILWAUKEE_INDUSTRIAL,
    ]) {
      for (const [code, limits] of Object.entries(table)) {
        expect(limits.farUnconstrained, `${code}`).toBe(true)
        expect(limits.floorAreaFormulas).toBeUndefined()
      }
    }
    expect(MILWAUKEE_SPECIAL.TL.farUnconstrained).toBe(true)
  })

  it('the downtown districts are NOT farUnconstrained — their floor area is regulated', () => {
    // Table 295-705-1 HAS a floor-area slot and it is filled, so this is a GAP
    // (we decline to collapse a formula), not the known absence of FACT 1.
    // Rendering it as an absence would claim the code lets you build any floor
    // area you like downtown, which it does not.
    for (const [code, limits] of Object.entries(MILWAUKEE_DOWNTOWN)) {
      expect(limits.farUnconstrained, `${code}`).toBe(false)
      expect(limits.floorAreaFormulas, `${code}`).toHaveLength(3)
    }
  })

  it('the three downtown floor-area tiers are alternatives and are never collapsed', () => {
    const c9fB = MILWAUKEE_DOWNTOWN['C9F(B)']
    expect(c9fB.floorAreaFormulas?.map((t) => t.openSpaceCondition)).toEqual([
      'atMost40Percent',
      'between40And80Percent',
      'atLeast80Percent',
    ])
    // Transcribed verbatim from Table 295-705-1.
    expect(c9fB.floorAreaFormulas?.map((t) => t.formula)).toEqual([
      '8(W)+20(X)+10(Y)+0.2(Z)',
      '9(W)+10(X)+5(Y)+0.2(Z)',
      '12(W)+0.2(Z)',
    ])
    // The same district's W coefficient differs across the three rows (8, 9,
    // 12), which is precisely why "publish W as the base FAR" — the reading the
    // scouting notes proposed — has no well-defined answer.
    expect(new Set(['8', '9', '12']).size).toBe(3)
  })

  it('no district resolves to a numeric FAR at all', () => {
    // There is no `far` field on MilwaukeeLimits by construction, so this is a
    // structural assertion rather than a value one: nothing in the module can
    // hand a ratio to the provider, and the provider therefore cannot publish
    // one that would then be compared against an assumed 1.0.
    for (const [code, limits] of everyEntry()) {
      expect(JSON.stringify(limits), `${code}`).not.toMatch(/"(far|maxFAR)"\s*:/)
    }
  })

  it('a gap district claims neither a FAR absence nor a floor-area formula', () => {
    for (const code of ['PK', 'X']) {
      const r = resolveMilwaukee(code)
      expect(r.farUnconstrained).toBe(false)
      expect(r.floorAreaFormulas).toBeUndefined()
      expect(r.heightFt).toBeNull()
    }
  })
})

describe('Milwaukee per-use height tables are not collapsed (rule 6)', () => {
  it('RB1 headlines 45 ft — the single/two-family figure — never 85', () => {
    // Table 295-605-2: the non-residential and multi-family panel says 85 ft,
    // and the single-family/two-family panel points at RM2, which Table
    // 295-505-2 caps at 45. Publishing 85 as the district ceiling assumes a
    // program the user has not chosen.
    const rb1 = MILWAUKEE_COMMERCIAL.RB1
    expect(rb1.heightFt).toBe(45)
    expect(rb1.heightByUse.map((r) => r.heightFt).sort((a, b) => Number(a) - Number(b))).toEqual([45, 85])
  })

  it('the headline is never the maximum across building types', () => {
    for (const [code, limits] of everyEntry()) {
      const stated = limits.heightByUse.map((r) => r.heightFt).filter((h): h is number => h != null)
      if (stated.length < 2) continue
      const max = Math.max(...stated)
      const min = Math.min(...stated)
      expect(limits.heightFt, `${code}`).toBe(min)
      if (max !== min) expect(limits.heightFt, `${code} published its maximum`).not.toBe(max)
    }
  })

  it('LB3 and RB2 also differ between panels, and both take the lower figure', () => {
    expect(MILWAUKEE_COMMERCIAL.LB3.heightFt).toBe(60) // panel A says 75
    expect(MILWAUKEE_COMMERCIAL.RB2.heightFt).toBe(60) // panel A says 85
    expect(MILWAUKEE_COMMERCIAL.LB3.heightByUse.some((r) => r.heightFt === 75)).toBe(true)
    expect(MILWAUKEE_COMMERCIAL.RB2.heightByUse.some((r) => r.heightFt === 85)).toBe(true)
  })

  it('every commercial and industrial district states more than one figure', () => {
    // The scouting notes reported ONE number per district for both chapters.
    // If a future edit collapses a table back to one row, this fails.
    for (const [code, limits] of [
      ...Object.entries(MILWAUKEE_COMMERCIAL),
      ...Object.entries(MILWAUKEE_INDUSTRIAL),
    ]) {
      expect(limits.heightByUse.length, `${code}`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('Milwaukee "none" is an answer, not a missing lookup (rule 5)', () => {
  it('11 of the 13 downtown subdistricts state no maximum height; 2 bind', () => {
    const bound = Object.entries(MILWAUKEE_DOWNTOWN).filter(([, l]) => l.heightFt != null)
    expect(bound.map(([c, l]) => [c, l.heightFt])).toEqual([
      ['C9A(B)', 40],
      ['C9F(C)', 50],
    ])
    const unbound = Object.entries(MILWAUKEE_DOWNTOWN).filter(([, l]) => l.heightUnconstrained)
    expect(unbound).toHaveLength(11)
  })

  it('a downtown "none" is heightUnconstrained, while a gap district is not', () => {
    expect(resolveMilwaukee('C9G').heightUnconstrained).toBe(true)
    expect(resolveMilwaukee('C9G').heightFt).toBeNull()
    // Both carry heightFt null. Only one of them is a claim.
    expect(resolveMilwaukee('PK').heightUnconstrained).toBe(false)
    expect(resolveMilwaukee('X').heightUnconstrained).toBe(false)
  })

  it('an industrial district never headlines "none" — its other panels bind', () => {
    // The scouting notes said IO1/IO2/IL1/IL2/IH have no height limit. That is
    // true only of an INDUSTRIAL building (Table 295-805-2, first panel); a
    // non-industrial one is capped by the referenced LB district and a
    // single/two-family dwelling by the referenced RT district.
    for (const code of ['IO1', 'IO2', 'IL1', 'IL2', 'IH']) {
      const l = resolveMilwaukee(code)
      expect(l.heightUnconstrained, `${code}`).toBe(false)
      expect(l.heightFt, `${code}`).not.toBeNull()
      expect(l.heightByUse.some((r) => r.heightUnconstrained), `${code}`).toBe(true)
    }
    expect(resolveMilwaukee('IO1').heightFt).toBe(45)
    expect(resolveMilwaukee('IH').heightFt).toBe(48)
  })

  it("IC and IM's 85 ft figure keeps its 'new construction only' qualifier", () => {
    for (const code of ['IC', 'IM']) {
      const rule = resolveMilwaukee(code).heightByUse.find((r) => r.heightFt === 85)
      expect(rule?.qualifier, code).toMatch(/new construction only/i)
    }
  })
})

describe('Milwaukee RM7 — a FAR-conditioned height exception, not a FAR cap', () => {
  it('headlines 85 ft and carries the unlimited-height option as an alternative', () => {
    const rm7 = resolveMilwaukee('RM7')
    expect(rm7.heightFt).toBe(85)
    // Table 295-505-2's RM7 cell reads "85; no limit if floor area ratio is
    // less than 4:1". Publishing "no limit" as the district height would assume
    // a program (holding floor area below 4:1) the user has not chosen.
    const alt = rm7.heightByUse.find((r) => r.heightUnconstrained)
    expect(alt?.useLabel).toMatch(/floor area ratio of less than 4:1/)
    expect(alt?.qualifier).toMatch(/Elective/)
    expect(alt?.source).toMatch(/295-505-2-h-2-h/)
  })

  it('is still farUnconstrained — the 4:1 test caps height, not floor area', () => {
    expect(resolveMilwaukee('RM7').farUnconstrained).toBe(true)
    expect(resolveMilwaukee('RM7').floorAreaFormulas).toBeUndefined()
  })
})

describe('Milwaukee special districts', () => {
  it('TL RESOLVES — the scouting note that it has no bulk table was wrong', () => {
    // Table 295-905-3-b is a per-use referral table: institutional and
    // residential buildings follow RM6 (85 ft), commercial follows LB2 (60 ft).
    const tl = resolveMilwaukee('TL')
    expect(tl.source).not.toBe('')
    expect(tl.heightFt).toBe(60)
    expect(tl.heightByUse).toHaveLength(3)
    expect(tl.heightByUse.filter((r) => r.heightFt === 85)).toHaveLength(2)
  })

  it('PD and RED are plan-governed: an answer about the base code, not a height', () => {
    for (const code of ['PD', 'RED']) {
      const r = resolveMilwaukee(code)
      expect(r.planGoverned, code).toBe(true)
      expect(r.heightFt, code).toBeNull()
      expect(r.heightUnconstrained, code).toBe(false)
      expect(r.source, code).not.toBe('')
      // Unlike Raleigh's PD, this does NOT claim the code imposes no FAR: a
      // Milwaukee planned-development plan must state total non-residential
      // square footage (s. 295-907-2-b-1-e), so the plan can itself carry a
      // floor-area cap this module has not read.
      expect(r.farUnconstrained, code).toBe(false)
    }
  })

  it('PK is an honest gap, and the reason is that there is no table to read', () => {
    // s. 295-903-3 gives the Parks district setback standards and no height
    // paragraph and no dimensional table. That is NOT the DC/Philadelphia slot
    // test — those worked because a table existed whose ROW STRUCTURE had no
    // FAR row. With no table there is nothing whose emptiness is evidence, so
    // "no height limit in a park" would be a reader failing to find something.
    const pk = resolveMilwaukee('PK')
    expect(pk.source).toBe('')
    expect(pk.heightFt).toBeNull()
    expect(pk.heightUnconstrained).toBe(false)
    expect(pk.farUnconstrained).toBe(false)
    expect(pk.planGoverned).toBeUndefined()
  })

  it("X is the City's own defect flag and resolves to nothing at all", () => {
    const x = resolveMilwaukee('X')
    expect(x.dataDefect).toBe(true)
    expect(x.heightFt).toBeNull()
    expect(x.farUnconstrained).toBe(false)
    expect(x.source).toBe('')
  })
})

describe('Milwaukee use vocabulary — read off the chapter use tables', () => {
  it('industrial districts do not grant housing (Table 295-803-1)', () => {
    // Multi-family dwelling reads N | N | N | L | N across IO1/IO2, IL1/IL2,
    // IC, IM, IH. Only IM admits it, and then as a limited use.
    for (const code of ['IO1', 'IO2', 'IL1', 'IL2', 'IC', 'IH']) {
      expect(usesForZone(code), code).not.toContain('residential')
      expect(usesForZone(code), code).toContain('commercial')
    }
    expect(usesForZone('IM')).toContain('residential')
  })

  it('C9H is the one downtown district that prohibits housing outright', () => {
    expect(usesForZone('C9H')).not.toContain('residential')
    for (const code of ['C9A(A)', 'C9B(B)', 'C9D(A)', 'C9F(C)', 'C9G']) {
      expect(usesForZone(code), code).toContain('residential')
    }
  })

  it('RS/RT/RM are residential only; RO adds office (Table 295-503-1)', () => {
    expect(usesForZone('RS5')).toEqual(['residential'])
    expect(usesForZone('RT4')).toEqual(['residential'])
    expect(usesForZone('RM7')).toEqual(['residential'])
    // General office reads N in RS1-RS5 and RM1-RM2, L in the middle columns,
    // and Y only in R01 and R02 — so only the RO districts get 'commercial'.
    expect(usesForZone('RO2')).toContain('commercial')
  })

  it('gap districts return null rather than a guess', () => {
    for (const code of ['PK', 'PD', 'RED', 'X', 'NOT-A-ZONE', null, undefined]) {
      expect(usesForZone(code)).toBeNull()
    }
    // TL states institutional, commercial and residential BUILDINGS in its
    // referral table, but this module has not read its use classifications, so
    // only the token the referral table itself names is asserted.
    expect(usesForZone('TL')).toEqual(['institutional'])
  })
})

describe('Milwaukee district names', () => {
  it('names every live district code', () => {
    for (const z of LIVE_ZONING_VALUES) {
      expect(MILWAUKEE_DISTRICT_NAMES[z], z).toBeTruthy()
    }
  })
})
