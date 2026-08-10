import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  DALLAS_DISTRICT_CODES,
  UNRESOLVED_DALLAS,
  dallasZoneKey,
  narrowestFarSubCap,
  resolveDallas,
  usesForZone,
} from './dallas'

// The distinct values the live Base Zoning layer serves in ZONE_DIST, captured
// 2026-08-09 by paging all 3,815 polygons of
// gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15.
// Hard-coded so the table's coverage claim is checked against what the CITY
// publishes, not against the table's own key list (CLAUDE.md rule 9).
const LIVE_ZONE_DIST = [
  'A(A)', 'CA-1(A)', 'CA-2(A)', 'CD', 'CH', 'CR', 'CS', 'D(A)', 'GO(A)', 'GR', 'IM', 'IR', 'LI',
  'LO-1', 'LO-2', 'LO-3', 'MC-1', 'MC-2', 'MC-3', 'MC-4', 'MF-1(A)', 'MF-1(A)(SAH)', 'MF-2',
  'MF-2(A)', 'MF-2(A)(SAH)', 'MF-3(A)', 'MF-4(A)', 'MH(A)', 'MO-1', 'MO-2', 'MU-1', 'MU-1(SAH)',
  'MU-2', 'MU-2(SAH)', 'MU-3', 'MU-3(SAH)', 'NO(A)', 'NS(A)', 'O-2', 'P(A)', 'PD', 'PFD',
  'R-1/2ac(A)', 'R-10(A)', 'R-13(A)', 'R-16(A)', 'R-1ac(A)', 'R-5(A)', 'R-7.5(A)', 'RR',
  'TH-1(A)', 'TH-2(A)', 'TH-3(A)', 'UC-2', 'WMU-3', 'WMU-5', 'WMU-8', 'WR-20', 'WR-3', 'WR-5',
] as const

/** The mapped values this build deliberately did NOT read — 254.6 acres, 0.10%
 *  of the city (module header FACT 7), plus the three Chapter 51 strays. Every
 *  one must resolve to nothing. */
const KNOWN_GAPS = [
  'P(A)', 'PFD', 'PFD-1', 'UC-2', 'WMU-3', 'WMU-5', 'WMU-8', 'WR-3', 'WR-5', 'WR-20',
  'GR', 'GR Chap 51', 'O-2', 'O-2 Chap 51', 'MF-2', 'MF-2 Chap 51',
] as const

describe('resolveDallas — the FAR slot, answered both ways', () => {
  // §51A-4.112(f)(4)(D), verbatim: "Floor area ratio. No maximum floor area
  // ratio." The slot EXISTS and the code writes "no maximum" into it, which is
  // an ANSWER (CLAUDE.md rule 5) — not a value we failed to find.
  it('R-7.5(A) — the code states there is no FAR, so farUnconstrained is set', () => {
    const l = resolveDallas('R-7.5(A)', 'R-7.5(A)')
    expect(l.far).toBeNull()
    expect(l.farUnconstrained).toBe(true)
    expect(l.farSource).toContain('51A-4.112(f)')
  })

  // The refusal, and it is what makes the claim above meaningful. Three chapters
  // later the SAME slot holds a number. A table that set farUnconstrained
  // everywhere `far` was null would get this district wrong by 100%.
  it('MF-3(A) — the same slot holds 2.0, and REFUSES the unconstrained claim', () => {
    const l = resolveDallas('MF-3(A)', 'MF-3(A)')
    expect(l.far).toBe(2.0)
    expect(l.farUnconstrained).toBe(false)
    expect(l.farSource).toContain('51A-4.116(c)')
  })

  it('MF-4(A) likewise states 4.0 and is not unconstrained', () => {
    const l = resolveDallas('MF-4(A)', 'MF-4(A)')
    expect(l.far).toBe(4.0)
    expect(l.farUnconstrained).toBe(false)
  })

  it('every district with farUnconstrained has a null far, and vice versa is NOT assumed', () => {
    const unconstrained = DALLAS_DISTRICT_CODES.filter((c) => resolveDallas(c).farUnconstrained)
    // The A/R/D/TH/CH/MF-1/MF-2/MH families — and nothing else.
    expect(unconstrained.sort()).toEqual(
      [
        'A(A)', 'CH', 'D(A)', 'MF-1(A)', 'MF-1(SAH)', 'MF-2(A)', 'MF-2(SAH)', 'MH(A)',
        'R-1/2ac(A)', 'R-10(A)', 'R-13(A)', 'R-16(A)', 'R-1ac(A)', 'R-5(A)', 'R-7.5(A)',
        'TH-1(A)', 'TH-2(A)', 'TH-3(A)',
      ].sort(),
    )
    for (const c of unconstrained) expect(resolveDallas(c).far).toBeNull()
    // The converse must NOT hold: PD and CD have a null far and are emphatically
    // not unconstrained.
    expect(resolveDallas('PD-269', 'PD').far).toBeNull()
    expect(resolveDallas('PD-269', 'PD').farUnconstrained).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE INVARIANT: DALLAS READS BOTH STATED FIGURES AND DERIVES NEITHER (rule 12).
//
// Dallas prints height in slot (E) and stories in slot (H) of each district's
// dimensional subsection. The Miami-21 defect was multiplying a story count by
// one constant and dividing by a different one; the defence has to be that no
// conversion happens at all, in either direction.
//
// WHY THIS CANNOT BE TESTED BY CALLING THE RESOLVER. Every (feet, stories) pair
// is reproducible by SOME constant — LO-1's 70/5 by 14, CR's 54/4 by 13.5 — so
// a per-district conversion produces output IDENTICAL to a transcription, and
// no assertion over returned values can tell them apart. Measured over this
// table's 22 dimensioned rows on 2026-08-09, feet even determine stories
// uniquely across every row (30→2, 70→5, 115→9, 135→10, 270→20 with no
// disagreement anywhere), so there is not so much as a counterexample to lean
// on in that direction. An enumerative test is therefore not weak here, it is
// structurally incapable: the thing to check is that the module contains no
// arithmetic path from one slot to the other, and that is a fact about the
// SOURCE TEXT, not about any value the resolver returns.
//
// So the source text is what the load-bearing tests below read. Each one guards
// its own instrument first (rule 11/16): a parse that matched nothing would
// otherwise pass silently and report an invariant it never checked.

const DALLAS_SRC = readFileSync(fileURLToPath(new URL('./dallas.ts', import.meta.url)), 'utf8')

/** The source slice starting at `openIdx`'s `{` and ending at its match. */
function balancedFrom(src: string, openIdx: number): string {
  let depth = 0
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) return src.slice(openIdx, j + 1)
    }
  }
  throw new Error(`unbalanced braces from index ${openIdx}`)
}

/** Every `row({ … })` argument object in the module, as source text. */
function curatedRowBlocks(): string[] {
  const out: string[] = []
  const marker = 'row({'
  for (let i = DALLAS_SRC.indexOf(marker); i !== -1; i = DALLAS_SRC.indexOf(marker, i + 1)) {
    out.push(balancedFrom(DALLAS_SRC, i + marker.length - 1))
  }
  return out
}

/** The right-hand side of one TOP-LEVEL key of a row block, verbatim, minus a
 *  trailing comma and any trailing line comment. Throws unless the key occurs
 *  exactly once — `heightSource`, `heightAlternatives` and the nested
 *  `heightFt` of an alternative must never be mistaken for slot (E), and a key
 *  that has silently moved or duplicated must not read as absent. */
function slotText(block: string, key: 'name' | 'height' | 'stories'): string {
  const hits = [...block.matchAll(new RegExp(`(?<![\\w$])${key}:([^\\n]*)`, 'g'))]
  if (hits.length !== 1) {
    throw new Error(`expected exactly one \`${key}:\` in a row block, found ${hits.length}`)
  }
  return hits[0][1].replace(/\/\/.*$/, '').trim().replace(/,$/, '').trim()
}

/** What a row is allowed to write into slot (E) or slot (H): a bare number, or
 *  one of the code's two stated non-numbers. Nothing else — not an expression,
 *  not a call, not an identifier. */
const BARE_LITERAL = /^(?:\d+(?:\.\d+)?|'none'|'not-stated')$/

function strippedOfComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('feet and stories: both stated, neither derived — structurally (rule 12)', () => {
  const blocks = curatedRowBlocks()

  // ESTABLISHES: the text-reading tests below see the whole table, counted
  // against the exported resolver rather than against the regex's own yield.
  // DOES NOT ESTABLISH: anything about the figures themselves.
  it('the parser sees every curated row — counted through the real entry point', () => {
    const dimensioned = DALLAS_DISTRICT_CODES.filter((c) => {
      const l = resolveDallas(c)
      return !l.planGoverned && !l.ordinanceGoverned
    })
    expect(blocks.length).toBe(dimensioned.length)
    expect(blocks.length).toBeGreaterThan(40)
  })

  // ESTABLISHES: no district's height or story figure is COMPUTED — from the
  // other slot or from anything else — because neither is an expression. This
  // is the assertion the old ft/story sweep could not make: it holds over every
  // row in the table, and it rules out a per-district constant, a rounding
  // rule, a lookup and a helper call alike.
  // DOES NOT ESTABLISH: that the literals match §51A. Only reading the code
  // does that (rule 9); the STATED sample below is the hand-checked part.
  it('every curated row writes slot (E) and slot (H) as bare literals', () => {
    for (const b of blocks) {
      const name = slotText(b, 'name')
      expect(slotText(b, 'height'), `${name} · slot (E)`).toMatch(BARE_LITERAL)
      expect(slotText(b, 'stories'), `${name} · slot (H)`).toMatch(BARE_LITERAL)
    }
  })

  // ESTABLISHES: the single constructor those literals pass through cannot
  // convert either into the other, because it performs no arithmetic at all.
  // This is the hole the value-comparison test below CANNOT close: a
  // `stories: Math.floor(num(r.height) / 14)` inside `row()` would reproduce
  // LO-1's 5 exactly and every comparison of returned values would stay green.
  // DOES NOT ESTABLISH: that nothing downstream of `row()` converts — the
  // value-comparison test covers that, for every district.
  it('the one constructor the literals pass through does no arithmetic', () => {
    const rowBody = balancedFrom(DALLAS_SRC, DALLAS_SRC.indexOf('function row(r: Row): DallasLimits {'))
    const num = DALLAS_SRC.match(/^const num = .*$/m)?.[0]
    const isNone = DALLAS_SRC.match(/^const isNone = .*$/m)?.[0]
    // Guard the instrument before trusting its silence.
    expect(rowBody, 'row() body').toContain('heightFt: num(r.height)')
    expect(rowBody, 'row() body').toContain('stories: num(r.stories)')
    expect(num, 'const num').toBeTruthy()
    expect(isNone, 'const isNone').toBeTruthy()

    const code = strippedOfComments([rowBody, num, isNone].join('\n'))
    expect(code.match(/[+\-*/%]|\bMath\b/g)).toBeNull()
  })

  // ESTABLISHES: the text audited above is the text that ships — for every row,
  // both slots and both "no maximum" flags come out of `resolveDallas` exactly
  // as the file states them, so nothing between the literal and the caller
  // rewrites them (rule 11: exercise the real entry point).
  // DOES NOT ESTABLISH: that no conversion happened, on its own. A conversion
  // that reproduced the same number would pass this and fail the two above.
  it('what the file states is what resolveDallas returns, for every row', () => {
    const named = DALLAS_DISTRICT_CODES.map((c) => [resolveDallas(c).name, c] as const)
      .filter((p): p is readonly [string, string] => p[0] != null)
    const codeByName = new Map(named)
    expect(codeByName.size, 'district names are unique').toBe(named.length)

    for (const b of blocks) {
      const name = slotText(b, 'name').replace(/^'|'$/g, '')
      const code = codeByName.get(name)
      expect(code, `no district resolves to the name ${name}`).toBeTruthy()
      const l = resolveDallas(code as string)

      for (const [slot, text, value, unconstrained] of [
        ['(E) height', slotText(b, 'height'), l.heightFt, l.heightUnconstrained],
        ['(H) stories', slotText(b, 'stories'), l.stories, l.storiesUnconstrained],
      ] as const) {
        const label = `${name} · ${slot}`
        // Restated from the literal test so a derivation reports itself here as
        // a derivation, rather than as `Number('Math.floor(70 / 14)')` → NaN.
        expect(text, `${label} is not a bare literal`).toMatch(BARE_LITERAL)
        if (text === "'none'") {
          expect(value, label).toBeNull()
          expect(unconstrained, label).toBe(true)
        } else if (text === "'not-stated'") {
          expect(value, label).toBeNull()
          expect(unconstrained, label).toBe(false)
        } else {
          expect(value, label).toBe(Number(text))
          expect(unconstrained, label).toBe(false)
        }
      }
    }
  })
})

describe('feet and stories: what the values themselves can and cannot prove', () => {
  const STATED: Array<[string, number, number]> = [
    ['NO(A)', 30, 2],
    ['LO-1', 70, 5],
    ['LO-2', 95, 7],
    ['LO-3', 115, 9],
    ['MO-1', 135, 10],
    ['MO-2', 160, 12],
    ['GO(A)', 270, 20],
    ['CR', 54, 4],
    ['RR', 70, 5],
    ['CS', 45, 3],
    ['LI', 70, 5],
    ['IR', 200, 15],
    ['IM', 110, 8],
    ['MC-1', 70, 5],
    ['MC-2', 90, 7],
    ['MC-3', 115, 9],
    ['MC-4', 135, 10],
    ['MU-2', 135, 10],
    ['MU-3', 270, 20],
  ]

  // ESTABLISHES: 19 hand-checked (E)/(H) pairs are transcribed as §51A prints
  // them — the only check here that compares the table to something OUTSIDE it
  // (rule 9), since a human read those rows out of the code.
  // DOES NOT ESTABLISH: that they were transcribed rather than computed, and it
  // covers 19 of 46 rows. The structural tests above carry both of those.
  it('carries the code\'s own feet and the code\'s own story count, unmodified', () => {
    for (const [code, ft, stories] of STATED) {
      const l = resolveDallas(code, code)
      expect(l.heightFt, code).toBe(ft)
      expect(l.stories, code).toBe(stories)
    }
  })

  // ESTABLISHES: feet cannot be produced from stories by ANY function, constant
  // or otherwise — the table states two different heights for the same story
  // count, which is a disproof rather than a failure to find one. The strongest
  // thing the values alone can say, and it says it in one direction only.
  // DOES NOT ESTABLISH: the reverse direction. Feet DO determine stories across
  // all 22 dimensioned rows, so no such disproof exists there — see the header
  // above, and the structural tests that cover it instead.
  it('no function of any kind maps stories back to feet: 7 stories is both 95 ft and 90 ft', () => {
    const lo2 = resolveDallas('LO-2', 'LO-2')
    const mc2 = resolveDallas('MC-2', 'MC-2')
    expect([lo2.stories, mc2.stories]).toEqual([7, 7])
    expect(lo2.heightFt).toBe(95)
    expect(mc2.heightFt).toBe(90)
    expect(lo2.heightFt).not.toBe(mc2.heightFt)
  })

  // ESTABLISHES: no ONE constant in the plausible band reproduces the 19 pairs,
  // so the table cannot be "simplified" into a single global conversion — the
  // shape that published 87 stories for a Miami district whose code says 80.
  // DOES NOT ESTABLISH: that no conversion exists. A PER-DISTRICT constant
  // reproduces any pair at all (70/5 by 14.0, 54/4 by 13.5), and this sweep is
  // blind to it — which is why it is no longer the load-bearing test.
  it('NO single constant in 10–18 ft/story reproduces the stated pairs', () => {
    for (let c = 10.0; c <= 18.0001; c += 0.1) {
      const reproduces = STATED.every(([, ft, stories]) => Math.floor(ft / c) === stories)
      expect(reproduces, `constant ${c.toFixed(1)} ft/story`).toBe(false)
    }
    // And show the spread rather than only asserting the negative.
    const ratios = STATED.map(([, ft, s]) => ft / s)
    expect(Math.min(...ratios)).toBeLessThan(13)
    expect(Math.max(...ratios)).toBeGreaterThan(14.9)
  })
})

describe('the story slot has three states, and they must not collapse', () => {
  // "Stories. No maximum number of stories." — an ANSWER.
  it('R-7.5(A): the code states no story maximum', () => {
    const l = resolveDallas('R-7.5(A)', 'R-7.5(A)')
    expect(l.stories).toBeNull()
    expect(l.storiesUnconstrained).toBe(true)
  })

  // §51A-4.125(d)(4)(H) states 7 stories at 90 ft and 9 at 120 ft. Both are
  // mixed-use-project heights; at the 80 ft BASE height neither limb applies, so
  // the code says nothing. "Not stated" is not "no maximum", and writing either
  // as a bare null would make them indistinguishable.
  it('MU-1: a filled slot that does not reach the base case is a GAP, not an absence', () => {
    const l = resolveDallas('MU-1', 'MU-1')
    expect(l.heightFt).toBe(80)
    expect(l.stories).toBeNull()
    expect(l.storiesUnconstrained).toBe(false)
    expect(l.storiesSource).toContain('51A-4.125(d)')
  })

  // The contrast, in one assertion: same null, different meaning.
  it('MU-1 and R-7.5(A) both have stories === null and disagree about why', () => {
    expect(resolveDallas('MU-1').stories).toBe(resolveDallas('R-7.5(A)').stories)
    expect(resolveDallas('MU-1').storiesUnconstrained).not.toBe(
      resolveDallas('R-7.5(A)').storiesUnconstrained,
    )
  })

  // MU-2 DOES reach its base case — 135 ft is both the base and the no-retail
  // MUP height, and slot (H) states 10 stories at 135 ft.
  it('MU-2 does reach its base case, so its story figure is stated', () => {
    const l = resolveDallas('MU-2', 'MU-2')
    expect(l.heightFt).toBe(135)
    expect(l.stories).toBe(10)
    expect(l.storiesUnconstrained).toBe(false)
  })
})

describe('the height slot: "any legal height" is an answer', () => {
  // §51A-4.124(a)(4)(E), verbatim: "Height. Maximum structure height is any
  // legal height." Rendered as a bare null this reads as "no district height
  // limit is available in public data" — the tool disclaiming knowledge it has.
  it('CA-1(A) and CA-2(A): the code imposes no height maximum', () => {
    for (const c of ['CA-1(A)', 'CA-2(A)']) {
      const l = resolveDallas(c, c)
      expect(l.heightFt, c).toBeNull()
      expect(l.heightUnconstrained, c).toBe(true)
      expect(l.heightSource, c).toContain('51A-4.124')
    }
  })

  it('no other curated district claims an unconstrained height', () => {
    const unconstrained = DALLAS_DISTRICT_CODES.filter((c) => resolveDallas(c).heightUnconstrained)
    expect(unconstrained.sort()).toEqual(['CA-1(A)', 'CA-2(A)'])
  })

  it('an unread district does NOT claim an unconstrained height', () => {
    expect(resolveDallas('WMU-5', 'WMU-5').heightUnconstrained).toBe(false)
    expect(resolveDallas('WMU-5', 'WMU-5').heightFt).toBeNull()
  })
})

describe('an elected building form is an alternative, never the headline (rule 6)', () => {
  // "(aa) 35 feet for a structure with a gable, hip, or gambrel roof; and
  //  (bb) 30 feet for any other structure."  Reporting 35 assumes a roof the
  // applicant has not chosen — the Austin 0.40-vs-0.65 shape, in feet.
  it('NO(A) and NS(A) publish 30 ft, with the 35 ft gabled figure as an alternative', () => {
    for (const c of ['NO(A)', 'NS(A)']) {
      const l = resolveDallas(c, c)
      expect(l.heightFt, c).toBe(30)
      expect(l.heightAlternatives, c).toHaveLength(1)
      expect(l.heightAlternatives?.[0].heightFt, c).toBe(35)
      expect(l.heightAlternatives?.[0].label, c).toMatch(/gable, hip, or gambrel/)
    }
  })

  it('the MUP heights ride as alternatives and never replace the base height', () => {
    const mu1 = resolveDallas('MU-1', 'MU-1')
    expect(mu1.heightFt).toBe(80)
    expect(mu1.heightAlternatives?.map((a) => a.heightFt)).toEqual([90, 120])
    const mu2 = resolveDallas('MU-2', 'MU-2')
    expect(mu2.heightFt).toBe(135)
    expect(mu2.heightAlternatives?.map((a) => a.heightFt)).toEqual([180])
  })

  it('every FAR alternative is strictly ABOVE the base it is an alternative to', () => {
    for (const c of DALLAS_DISTRICT_CODES) {
      const l = resolveDallas(c)
      for (const a of l.farAlternatives ?? []) {
        expect(l.far, `${c} / ${a.label}`).not.toBeNull()
        expect(a.far, `${c} / ${a.label}`).toBeGreaterThan(l.far as number)
      }
    }
  })
})

describe('per-program FAR sub-caps (FACT 4)', () => {
  // §51A-4.122(b)(4)(D): "(i) 0.5 for office uses; and (ii) 0.75 for all uses
  // combined." An office building on a CR lot is capped at 0.5, not 0.75.
  it('CR carries the office sub-cap alongside the combined ceiling', () => {
    const l = resolveDallas('CR', 'CR')
    expect(l.far).toBe(0.75)
    expect(l.farSubCaps).toEqual([{ label: 'office uses', far: 0.5 }])
    expect(narrowestFarSubCap(l)?.far).toBe(0.5)
  })

  it('LI, IR and IM each carry both intermediate limbs', () => {
    for (const [c, ceiling] of [['LI', 1.0], ['IR', 2.0], ['IM', 2.0]] as const) {
      const l = resolveDallas(c, c)
      expect(l.far, c).toBe(ceiling)
      expect(l.farSubCaps?.map((s) => s.far), c).toEqual([0.5, 0.75])
    }
  })

  // A sub-cap that is not narrower than the ceiling is a transcription error,
  // not a sub-cap — it would show a user a "restriction" that restricts nothing.
  it('every sub-cap is strictly BELOW its district ceiling', () => {
    for (const c of DALLAS_DISTRICT_CODES) {
      const l = resolveDallas(c)
      for (const s of l.farSubCaps ?? []) {
        expect(l.far, `${c} / ${s.label}`).not.toBeNull()
        expect(s.far, `${c} / ${s.label}`).toBeLessThan(l.far as number)
      }
    }
  })
})

describe('earned bonuses are never returned (FACT 5)', () => {
  // Division 51A-4.1100's mixed-income tables raise MF-1/MF-2 height to
  // 51/66/85 ft and MF-3 to 90/105/120 ft — each conditioned on reserving units
  // in a stated income band. Division 51A-4.900's SAH ladders do the same to
  // density. Both are deed-restricted programs, not by-right allowances.
  it('no mixed-income height appears anywhere in the MF rows', () => {
    const blob = JSON.stringify(['MF-1(A)', 'MF-2(A)', 'MF-3(A)'].map((c) => resolveDallas(c, c)))
    for (const n of [51, 66, 85, 105, 120]) expect(blob).not.toContain(`:${n},`)
    expect(resolveDallas('MF-1(A)').heightFt).toBe(36)
    expect(resolveDallas('MF-3(A)').heightFt).toBe(90)
  })

  it('the SAH density ladders are absent — only the 0%-affordable row is published', () => {
    expect(resolveDallas('MF-1(SAH)', 'MF-1(A)(SAH)').densityDuPerAcre).toBe(15)
    expect(resolveDallas('MF-2(SAH)', 'MF-2(A)(SAH)').densityDuPerAcre).toBe(20)
    expect(resolveDallas('MU-1(SAH)', 'MU-1(SAH)').densityDuPerAcre).toBe(10)
    const blob = JSON.stringify(['MF-1(SAH)', 'MF-2(SAH)', 'MU-1(SAH)'].map((c) => resolveDallas(c)))
    // 30/40/25 are the top rungs of those three ladders.
    expect(blob).not.toContain('"densityDuPerAcre":30')
    expect(blob).not.toContain('"densityDuPerAcre":40')
    expect(blob).not.toContain('"densityDuPerAcre":25')
  })

  // §51A-4.124(a)(4)(D)(iii) grants FAR 24 only "in the CA-1(A)-CP and
  // CA-1(A)-SP districts" and only via the building-setback bonus. The mapped
  // layer carries no -CP/-SP suffix, so the condition cannot be evaluated at all.
  it('CA-1(A) publishes 20.0 and never the 24.0 setback-bonus figure', () => {
    const l = resolveDallas('CA-1(A)', 'CA-1(A)')
    expect(l.far).toBe(20.0)
    // Check the NUMBERS, not a stringified blob: the first attempt at this
    // assertion searched the JSON for "24" and matched the section citation
    // "51A-4.124". The instrument, not the table, was wrong — and it would have
    // gone on failing for a reason that had nothing to do with the bonus.
    const figures = [l.far, ...(l.farAlternatives ?? []).map((a) => a.far), ...(l.farSubCaps ?? []).map((s) => s.far)]
    expect(figures).not.toContain(24)
    expect(l.farAlternatives).toBeNull()
  })
})

describe('permitted uses were READ, not inferred from the district name (FACT 6)', () => {
  // Every one of these prints "(I) Residential uses." in its main-use list and
  // the only item under it is a college dormitory or fraternity house. A
  // name-based or FAR-based guess reads them as housing districts; the code
  // permits no dwelling in any of them.
  it('the office, retail, commercial-service and multiple-commercial districts permit no dwelling', () => {
    for (const c of ['NO(A)', 'LO-1', 'LO-2', 'LO-3', 'MO-1', 'MO-2', 'GO(A)', 'NS(A)', 'CR', 'RR', 'CS', 'MC-1', 'MC-2', 'MC-3', 'MC-4']) {
      expect(usesForZone(c, c), c).not.toContain('residential')
      expect(usesForZone(c, c), c).toContain('commercial')
    }
  })

  // "(I) Residential uses. None permitted." — verbatim, all three.
  it('LI, IR and IM carry no residential and no institutional claim', () => {
    for (const c of ['LI', 'IR', 'IM']) {
      expect(usesForZone(c, c), c).toEqual(['commercial'])
    }
  })

  // The sharpest case. GO(A)'s residential list DOES name dwellings — qualified
  // in the same line as "up to five percent of the total floor area of any
  // building" (restated at §51A-4.121(d)(8)(F)). A five-percent component of an
  // office building is not a residential right.
  it('GO(A)\'s five-percent residential component is not a residential right', () => {
    expect(usesForZone('GO(A)', 'GO(A)')).toEqual(['commercial', 'institutional'])
  })

  it('the districts that do permit dwellings say so', () => {
    expect(usesForZone('R-7.5(A)', 'R-7.5(A)')).toEqual(['residential'])
    expect(usesForZone('MF-3(A)', 'MF-3(A)')).toEqual(['residential', 'institutional'])
    expect(usesForZone('CA-1(A)', 'CA-1(A)')).toContain('residential')
    expect(usesForZone('MU-3', 'MU-3')).toContain('mixed')
  })

  // §51A-4.702(a)(2): "The uses permitted in a PD must be listed in the
  // ordinance establishing the district." The base code says nothing.
  it('PD and CD assert no use vocabulary', () => {
    expect(usesForZone('PD-269', 'PD')).toBeNull()
    expect(usesForZone('CD-7', 'CD')).toBeNull()
  })
})

describe('districts governed by an ordinance outside Chapter 51A (FACT 7)', () => {
  it('PD is plan-governed and asserts no absence of anything', () => {
    const l = resolveDallas('PD-269', 'PD')
    expect(l.planGoverned).toBe(true)
    expect(l.ordinanceGoverned).toBe(false)
    expect(l.far).toBeNull()
    expect(l.farUnconstrained).toBe(false)
    expect(l.heightUnconstrained).toBe(false)
    expect(l.storiesUnconstrained).toBe(false)
    expect(l.source).toContain('51P')
  })

  it('a PD label written with a space instead of a hyphen still resolves', () => {
    // The live layer carries exactly one such row: LONG_ZONE_DIST 'PD 1135'.
    expect(resolveDallas('PD 1135', 'PD').planGoverned).toBe(true)
    expect(dallasZoneKey('PD 1135')).toBe('PD')
  })

  it('CD is ordinance-governed and cites the CD-ordinance definition', () => {
    const l = resolveDallas('CD-7', 'CD')
    expect(l.ordinanceGoverned).toBe(true)
    expect(l.planGoverned).toBe(false)
    expect(l.source).toContain('51A-4.505')
  })
})

describe('superseded and unread codes resolve to nothing', () => {
  // Three polygons are still labelled under CHAPTER 51, the FORMER Dallas
  // Development Code. Chapter 51A establishes no GR, no O-2 and no MF-2, so a
  // 51A lookup must miss — the Minneapolis Chapter 546 shape, with the
  // superseded codes still live in the data.
  it('the Chapter 51 strays do not resolve against the Chapter 51A table', () => {
    for (const [long, short] of [['GR Chap 51', 'GR'], ['O-2 Chap 51', 'O-2'], ['MF-2 Chap 51', 'MF-2']]) {
      const l = resolveDallas(long, short)
      expect(l, long).toEqual(UNRESOLVED_DALLAS)
    }
  })

  it('every deliberately-unread mapped value resolves to UNRESOLVED', () => {
    for (const g of KNOWN_GAPS) expect(resolveDallas(g, g), g).toEqual(UNRESOLVED_DALLAS)
  })

  it('UNRESOLVED asserts nothing at all', () => {
    expect(UNRESOLVED_DALLAS.far).toBeNull()
    expect(UNRESOLVED_DALLAS.farUnconstrained).toBe(false)
    expect(UNRESOLVED_DALLAS.heightFt).toBeNull()
    expect(UNRESOLVED_DALLAS.heightUnconstrained).toBe(false)
    expect(UNRESOLVED_DALLAS.stories).toBeNull()
    expect(UNRESOLVED_DALLAS.storiesUnconstrained).toBe(false)
    expect(UNRESOLVED_DALLAS.densityUnconstrained).toBe(false)
    expect(UNRESOLVED_DALLAS.planGoverned).toBe(false)
    expect(UNRESOLVED_DALLAS.ordinanceGoverned).toBe(false)
    expect(UNRESOLVED_DALLAS.uses).toBeNull()
    expect(UNRESOLVED_DALLAS.name).toBeNull()
  })

  it('null, empty and whitespace-only codes resolve to UNRESOLVED', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(resolveDallas(v as string | null | undefined, v as string | null | undefined)).toEqual(
        UNRESOLVED_DALLAS,
      )
    }
  })
})

describe('resolution needs BOTH zoning fields (FACT 8, rule 13)', () => {
  // Measured over all 3,815 live polygons: 3,728 resolve from either field, 86
  // from neither, and exactly ONE from ZONE_DIST alone — LONG_ZONE_DIST carries
  // the typo 'MU=1' while ZONE_DIST reads 'MU-1'. A single-field resolver
  // publishes that 2.5-acre parcel as a gap, and no test on a clean code sees it.
  it('falls back to ZONE_DIST when the mapped label is malformed', () => {
    expect(resolveDallas('MU=1', 'MU-1').name).toBe('Mixed use district 1')
    expect(resolveDallas('MU=1', 'MU-1').far).toBe(0.8)
    // …and reading only the long label loses it.
    expect(resolveDallas('MU=1')).toEqual(UNRESOLVED_DALLAS)
  })

  it('prefers the mapped label when both resolve, because it is the more specific', () => {
    // CD-7's family is 'CD'; both key to the CD row, so this is only a check that
    // the long label is consulted first and nothing throws.
    expect(resolveDallas('CD-7', 'CD').ordinanceGoverned).toBe(true)
    expect(resolveDallas('MF-1(A)', 'MF-1(A)').name).toBe('Multifamily district 1')
  })

  it('the (SAH) variants the layer serves resolve through one field or the other', () => {
    // The layer writes 'MF-1(A)(SAH)'; §51A-4.101(1)(O) names it 'MF-1(SAH)'.
    expect(resolveDallas('MF-1(A)(SAH)', 'MF-1(A)(SAH)').densityDuPerAcre).toBe(15)
    expect(resolveDallas('MF-2(A)(SAH)', 'MF-2(A)(SAH)').densityDuPerAcre).toBe(20)
  })
})

describe('coverage, measured against the values the city actually publishes', () => {
  it('every live ZONE_DIST value either resolves or is a recorded gap', () => {
    const unexplained = LIVE_ZONE_DIST.filter(
      (v) => resolveDallas(v, v) === UNRESOLVED_DALLAS && !KNOWN_GAPS.includes(v as never),
    )
    expect(unexplained).toEqual([])
  })

  it('the recorded gaps are all genuinely live values (no typo can excuse a gap)', () => {
    const live = new Set<string>(LIVE_ZONE_DIST)
    // Every KNOWN_GAPS entry is either a live ZONE_DIST value or a live
    // LONG_ZONE_DIST label whose family is one.
    const longOnly = new Set(['PFD-1', 'GR Chap 51', 'O-2 Chap 51', 'MF-2 Chap 51'])
    for (const g of KNOWN_GAPS) expect(live.has(g) || longOnly.has(g), g).toBe(true)
  })

  // The table's own integrity: no row may exist without the citations that make
  // its numbers checkable.
  it('every curated row carries a name and a source for every figure it states', () => {
    for (const c of DALLAS_DISTRICT_CODES) {
      const l = resolveDallas(c)
      expect(l.name, c).toBeTruthy()
      expect(l.source, c).toBeTruthy()
      if (l.heightFt != null || l.heightUnconstrained) expect(l.heightSource, c).toBeTruthy()
      if (l.stories != null || l.storiesUnconstrained) expect(l.storiesSource, c).toBeTruthy()
      if (l.far != null || l.farUnconstrained) expect(l.farSource, c).toBeTruthy()
      if (l.densityDuPerAcre != null || l.densityUnconstrained) expect(l.densitySource, c).toBeTruthy()
      for (const a of l.farAlternatives ?? []) expect(a.source, `${c}/${a.label}`).toBeTruthy()
      for (const a of l.heightAlternatives ?? []) expect(a.source, `${c}/${a.label}`).toBeTruthy()
    }
  })

  it('no curated row is both plan-governed and dimensioned', () => {
    for (const c of DALLAS_DISTRICT_CODES) {
      const l = resolveDallas(c)
      if (l.planGoverned || l.ordinanceGoverned) {
        expect(l.heightFt, c).toBeNull()
        expect(l.far, c).toBeNull()
        expect(l.stories, c).toBeNull()
      }
    }
  })
})
