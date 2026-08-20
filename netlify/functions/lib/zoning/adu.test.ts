import { describe, it, expect } from 'vitest'
import {
  aduRulesFor, summariseAdu, effectiveMaxSize, ADU_LOCAL_READ, ADU_STATE_PREEMPTED,
} from './adu'
import { CITIES } from '../../../../src/config/cities'
import type { AduRules } from './adu'

// ⚠️ SYNTHETIC ON PURPOSE (rule 29). Three tests below used San Francisco as the
// stand-in for "state floor known, local ordinance unread" — and San Francisco was
// then read, breaking all three for a reason having nothing to do with the
// invariant. A city is only floor-only until someone reads it, so naming one picks
// whatever is next off the work queue. Every preempted city is now read, so there
// is no live example left to name and constructing the state directly is the only
// stable fixture: it exercises the branch by construction and cannot be read away.
const FLOOR_ONLY: AduRules = {
  city: 'sf',
  stateFloor: aduRulesFor('sf').stateFloor,
  local: { kind: 'not-read', detail: 'synthetic fixture — see the note above' },
}

describe('which body of law governs', () => {
  it('routes California cities to state law, not the municipal code', () => {
    // The first place this tool reads a source ABOVE the city. Getting it wrong
    // produces a confident number from the wrong instrument.
    for (const c of ['la', 'sf', 'sanjose', 'sandiego']) {
      expect(aduRulesFor(c).stateFloor?.state, c).toBe('California')
    }
  })

  it('routes Seattle to Washington state law', () => {
    expect(aduRulesFor('seattle').stateFloor?.state).toBe('Washington')
  })

  it('⚠️ says nobody has looked, rather than that the city has no rules', () => {
    // rule 5. "Denver has no ADU rules" would be a finding; nobody has looked.
    const a = aduRulesFor('denver')
    // TWO different absences, kept apart: no state statute preempts (a finding
    // about the state) and the local ordinance is unread (nobody looked).
    expect(a.stateFloor).toBeNull()
    expect(a.local.kind).toBe('not-read')
    expect(summariseAdu(a)).toMatch(/nobody has looked/)
  })

  it('covers every live city explicitly, with no silent default', () => {
    // rule 20: a city missing from the map would fall through, and silence here
    // would render as "no state law applies" — which is a claim.
    const live = CITIES.filter((c) => c.live).map((c) => c.slug)
    expect(live.length).toBeGreaterThan(20)
    for (const slug of live) expect(aduRulesFor(slug).city, slug).toBe(slug)
    // Both sets pinned, and SEPARATELY — conflating them would let one city's
    // reading imply another's.
    expect([...ADU_STATE_PREEMPTED]).toEqual(['la', 'sandiego', 'sanjose', 'seattle', 'sf'])
    expect([...ADU_LOCAL_READ]).toEqual(['la', 'sandiego', 'sanjose', 'seattle', 'sf'])
  })
})

describe('⚠️ a state floor is a floor, not an envelope', () => {
  it('⚠️ summarises from the UNCONDITIONAL floor, not the largest one', () => {
    // Caught by running it. California's biggest size floor is 1,000 sq ft — but
    // only with more than one bedroom — and its tallest height is 25 ft, only for
    // an ATTACHED unit and only "whichever is LOWER" against the primary's own
    // limit. Both are the most conditioned entries in their lists, and leading
    // with them reads as an entitlement when neither is unconditional. Rule 6 in
    // mirror image.
    const s = summariseAdu(FLOOR_ONLY)
    expect(s).toMatch(/Unconditionally: a 850 sq ft ADU at 16 ft/)
    expect(s).not.toMatch(/1,000 sq ft ADU at 25 ft/)
  })

  it('every dimension list has exactly one baseline, or summarising throws', () => {
    // A list with no baseline used to fall back to the largest entry, silently.
    for (const c of ADU_STATE_PREEMPTED) {
      const f = aduRulesFor(c).stateFloor!
      expect(f.floors.sizeSqFt.filter((x) => x.baseline), c).toHaveLength(1)
      expect(f.floors.heightFt.filter((x) => x.baseline), c).toHaveLength(1)
    }
  })

  it('says so in the summary, in the same sentence as the numbers', () => {
    // The distinction this feature most easily gets wrong. California forbids a
    // city capping an ADU below 850 sq ft; it does not stop the city allowing
    // 1,200. Reporting 850 as "the answer" UNDERSTATES what is buildable, and an
    // understatement in the right units reads as authoritative (rule 18).
    const s = summariseAdu(FLOOR_ONLY)
    expect(s).toMatch(/FLOORS rather than limits/)
    expect(s).toMatch(/the city may permit more/)
    expect(s).toMatch(/its own ordinance has not been read/)
  })

  it('never phrases a floor as a maximum', () => {
    for (const c of ADU_STATE_PREEMPTED) {
      if (aduRulesFor(c).local.kind === 'read') continue // a local cap IS a maximum
      const t = summariseAdu(aduRulesFor(c))
      expect(t, c).not.toMatch(/maximum of|at most|no larger than|cannot exceed/)
    }
  })
})

describe('California, as read from the statute', () => {
  const a = aduRulesFor('sf').stateFloor!

  it('⚠️ keeps 850 and 800 apart — they are different provisions', () => {
    // § 66321(b)(2) caps how low a city's max-size ordinance may go. § 66321(b)(3)
    // is stronger and narrower: an 800 sq ft ADU with four-foot setbacks must be
    // buildable NOTWITHSTANDING lot coverage, FAR, open space, front setbacks and
    // minimum lot size. One constrains a number, the other overrides a family of
    // standards — collapsing them to a single figure loses the more useful half.
    const sizes = a.floors.sizeSqFt
    expect(sizes.map((s) => s.value).sort((x, y) => x - y)).toEqual([800, 850, 1000])
    const eight = sizes.find((s) => s.value === 800)!
    expect(eight.cite).toBe('§ 66321(b)(3)')
    expect(eight.condition).toMatch(/regardless of lot coverage, FAR, open space/)
    expect(sizes.find((s) => s.value === 850)!.cite).toBe('§ 66321(b)(2)(A)')
  })

  it('carries all four height floors with their conditions', () => {
    expect(a.floors.heightFt.map((h) => h.value)).toEqual([16, 18, 18, 25])
    // The two 18s are different provisions — transit proximity and multifamily
    // multistory — and are NOT deduplicated.
    expect(a.floors.heightFt.filter((h) => h.value === 18).map((h) => h.cite)).toEqual([
      '§ 66321(b)(4)(B)',
      '§ 66321(b)(4)(C)',
    ])
    // ⚠️ The attached case is the one that can go DOWN: 25 ft or the primary
    // dwelling's own limit, whichever is LOWER. Reading it as a flat 25 would
    // overstate on a low-rise lot.
    expect(a.floors.heightFt.find((h) => h.value === 25)!.condition).toMatch(/whichever is LOWER/)
  })

  it('cites the recodified chapter, not the repealed section', () => {
    // ADU law moved out of Gov. Code § 65852.2 into ch. 13 (§ 66310–66342). The
    // old citation looks right and points at a repealed provision.
    expect(a.citation).toMatch(/66321/)
    expect(a.citation).toMatch(/66323/)
    expect(a.citation).not.toMatch(/65852/)
    expect(a.citation).toMatch(/Stats\. 2024, Ch\. 7/)
    expect(a.readOn).toBe('2026-08-19')
  })

  it('records ministerial approval, which is what makes it an entitlement', () => {
    expect(a.protections.join(' ')).toMatch(/MINISTERIALLY/)
    expect(a.floors.maxSetbackFt?.value).toBe(4)
  })
})

describe('Washington, as read from the statute', () => {
  const a = aduRulesFor('seattle').stateFloor!

  it('carries the size, height and count floors', () => {
    expect(a.floors.sizeSqFt[0].value).toBe(1000)
    expect(a.floors.heightFt[0].value).toBe(24)
    expect(a.floors.count[0].value).toBe(2)
  })

  it('⚠️ keeps the urban-growth-area scope clause on the count', () => {
    // The statute binds lots "within an urban growth area" in districts allowing
    // single-family homes. Dropping that states the rule more broadly than the
    // legislature wrote it — rule 23, absence within a scope.
    expect(a.floors.count[0].condition).toMatch(/inside an urban growth area/)
  })

  it('⚠️ leaves maxSetbackFt null, because the statute sets no figure', () => {
    // It forbids setbacks MORE RESTRICTIVE than the principal unit's, which is a
    // different instrument entirely. Inventing a number here — 4 ft, say, by
    // analogy with California — is exactly rule 4.
    expect(a.floors.maxSetbackFt).toBeNull()
    expect(a.protections.join(' ')).toMatch(/more restrictive than for the principal unit/i)
  })

  it('records the height floor deferring to a lower principal-unit limit', () => {
    expect(a.floors.heightFt[0].condition).toMatch(/unless the principal unit’s own limit is lower/)
  })

  it('records the owner-occupancy ban, which changes who can build', () => {
    expect(a.protections.join(' ')).toMatch(/No owner-occupancy requirement/)
  })
})

describe('every read entry carries its citation and date', () => {
  it('so a figure can never be traced to nobody', () => {
    for (const c of ADU_STATE_PREEMPTED) {
      const a = aduRulesFor(c).stateFloor!
      expect(a.citation.length, c).toBeGreaterThan(20)
      expect(a.readOn, c).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const f of [...a.floors.sizeSqFt, ...a.floors.heightFt, ...a.floors.count]) {
        expect(f.cite.length, `${c} ${String(f.value)}`).toBeGreaterThan(4)
        expect(f.condition.length, `${c} ${String(f.value)}`).toBeGreaterThan(10)
      }
    }
  })
})

describe('⚠️ two layers, and the buildable figure is max(local, floor)', () => {
  it('San Diego allows MORE than the state floor, and the local figure governs', () => {
    // The proof that this layer was worth reading. State law forbids a cap under
    // 850 sq ft; SDMC § 141.0302(a)(7)(B) allows 1,200. Reporting the floor as
    // the answer understates by 41%, in the direction that reads as
    // authoritative (rule 18).
    const r = aduRulesFor('sandiego')
    expect(r.stateFloor?.state).toBe('California')
    expect(r.local.kind).toBe('read')
    const e = effectiveMaxSize(r)
    // ⚠️ `local-no-maximum` wins over any number: a conversion inside the
    // existing house has NO cap (§ 141.0302(a)(7)(C)), which is an answer and
    // beats 1,200 as well as 850.
    // The baseline is the purpose-built 1,200 case; the unlimited conversions are
    // conditioned and are surfaced in the list rather than as the headline.
    expect(e.source).toBe('local')
    expect(e.value).toBe(1200)
    expect(e.why).toMatch(/§ 141\.0302\(a\)\(7\)\(B\)/)
  })

  it('and the capped configurations still carry the larger local figure', () => {
    const local = aduRulesFor('sandiego').local
    if (local.kind !== 'read') throw new Error('setup')
    const capped = local.maxSizeSqFt.find((m) => m.kind === 'capped')!
    if (capped.kind !== 'capped') throw new Error('setup')
    expect(capped.sqFt).toBe(1200)
    expect(capped.sqFt).toBeGreaterThan(850) // the state floor it exceeds
  })

  it('a city with only the floor says so, and calls it a MINIMUM', () => {
    const e = effectiveMaxSize(FLOOR_ONLY)
    expect(e.source).toBe('floor-only')
    expect(e.value).toBe(850)
    expect(e.why).toMatch(/MINIMUM the city cannot refuse, not what it allows/)
  })

  it('a city with neither is unresolved, not zero and not permissive', () => {
    const e = effectiveMaxSize(aduRulesFor('denver'))
    expect(e.source).toBe('unresolved')
    expect(e.value).toBeNull()
  })

  it('⚠️ a local cap BELOW the floor would be overridden, not published', () => {
    // The other direction, and the one no city currently exercises — so it is
    // asserted against a constructed case rather than left untested. A local cap
    // beneath the state floor is void to that extent; publishing it would state
    // a limit the legislature has already struck down.
    const r = aduRulesFor('sandiego')
    const stingy = {
      ...r,
      local: {
        ...(r.local as Extract<typeof r.local, { kind: 'read' }>),
        maxSizeSqFt: [{ kind: 'capped' as const, sqFt: 600, condition: 'hypothetical', cite: '§ test' }],
      },
    }
    const e = effectiveMaxSize(stingy)
    expect(e.source).toBe('state-floor')
    expect(e.value).toBe(850)
    expect(e.why).toMatch(/void to that extent/)
  })

  it('San Diego states no ADU height in feet, and none is invented', () => {
    // § 141.0302(a)(8)(C) defers to the base zone. Storeys ARE stated (two), and
    // the two are never converted — rule 12.
    const local = aduRulesFor('sandiego').local
    if (local.kind !== 'read') throw new Error('setup')
    expect(local.maxStories?.value).toBe(2)
    expect(local.heightDefersToBaseZone?.cite).toBe('§ 141.0302(a)(8)(C)')
    expect(summariseAdu(aduRulesFor('sandiego'))).toMatch(/no height in feet for ADUs — it defers to the base zone/)
  })
})

describe('⚠️ "the code states no maximum" vs "we did not find one"', () => {
  // The distinction the user flagged, and it is `not-read` one level down: there
  // the whole ordinance is unread, here a single configuration inside a section
  // we DID read. Both render as an absent number and only one is a permission.
  const sd = aduRulesFor('sandiego')
  const local = sd.local as Extract<typeof sd.local, { kind: 'read' }>

  it("San Diego's unlimited cases are `no-maximum`, each with the provision that says so", () => {
    const none = local.maxSizeSqFt.filter((m) => m.kind === 'no-maximum')
    expect(none).toHaveLength(3)
    for (const m of none) {
      if (m.kind !== 'no-maximum') throw new Error('narrow')
      // ⚠️ A cite is REQUIRED on this arm. You may only claim the code states
      // none if you read the provision saying so.
      expect(m.cite).toMatch(/§ 141\.0302/)
    }
  })

  it('a not-found entry can carry no citation at all — enforced by the type', () => {
    // There is no source for a thing you did not find. The union makes the
    // mistake uncompilable rather than commenting on it (rule 14).
    const gap = { kind: 'not-found' as const, condition: 'some configuration nobody read' }
    expect('cite' in gap).toBe(false)
  })

  it('⚠️ a not-found NEVER counts as permission, and falls back to the floor', () => {
    // The failure this prevents: a hole in our reading rendering as "the city
    // sets no maximum", which is the most permissive statement the tool can make.
    const holed = {
      ...sd,
      local: { ...local, maxSizeSqFt: [{ kind: 'not-found' as const, condition: 'unread configuration' }] },
    }
    const e = effectiveMaxSize(holed)
    expect(e.source).toBe('floor-only')
    expect(e.value).toBe(850)
    expect(e.why).toMatch(/no size rule was located in it/)
    expect(e.why).toMatch(/MINIMUM, not what the city allows/)
  })

  it('and a no-maximum still wins over every capped figure', () => {
    // ⚠️ NO LONGER: San Diego's no-maximum entries are all CONVERSIONS, so the
    // baseline is the 1,200 sq ft purpose-built case. Leading with "no maximum"
    // described a configuration most projects are not.
    const e = effectiveMaxSize(sd)
    expect(e.source).toBe('local')
    expect(e.value).toBe(1200)
  })
})

describe('Seattle, as read from the ordinance', () => {
  const r = aduRulesFor('seattle')
  const local = r.local as Extract<typeof r.local, { kind: 'read' }>

  it('⚠️ is SMC 23.42.022, not 23.44.041 — the chapter itself was the wrong guess', () => {
    // Seattle keeps ADUs in Chapter 23.42 (General Use Provisions), not in the
    // neighbourhood-residential chapter. Two guessed node ids missed by CHAPTER,
    // which is why the fix was to read the index rather than construct a better id.
    expect(local.citation).toMatch(/23\.42\.022/)
    expect(local.citation).not.toMatch(/23\.44/)
  })

  it('carries all three size caps, including the unusual third limb verbatim', () => {
    const caps = local.maxSizeSqFt.filter((m) => m.kind === 'capped')
    expect(caps.map((c) => (c.kind === 'capped' ? c.sqFt : 0))).toEqual([1000, 1200, 1500])
    const top = caps.find((c) => c.kind === 'capped' && c.sqFt === 1500)!
    // Paraphrasing this would read as a transcription error. It is not.
    expect(top.condition).toMatch(/not been purchased for more than \$1,000 in the past 20 years/)
    expect(top.condition).toMatch(/ALL THREE/)
  })

  it('states no ADU height, and none is invented', () => {
    // § 23.42.022.E sends ADUs to the principal dwelling's standards and the
    // section provides no height — the same shape San Diego has, reached by a
    // different route.
    expect(local.maxStories).toBeNull()
    expect(local.heightDefersToBaseZone?.cite).toBe('§ 23.42.022.E')
  })

  it('⚠️ headlines the BASELINE 1,000, not the 1,500 nobody qualifies for', () => {
    // Caught by running it, and the same failure as the state floors one layer
    // down: 1,500 needs an LR zone AND frequent transit AND a lot not purchased
    // for more than $1,000 in twenty years. "Up to 1,500 sq ft" was the headline.
    const e = effectiveMaxSize(r)
    expect(e.source).toBe('local')
    expect(e.value).toBe(1000)
    expect(e.why).toMatch(/up to two bedrooms/)
    // The larger figures are surfaced, not dropped.
    expect(e.why).toMatch(/2 other configurations/)
  })

  it('and 1,000 meets the Washington floor exactly, so local still governs', () => {
    // A boundary worth pinning: the state forbids a cap BELOW 1,000 and Seattle's
    // baseline IS 1,000. That must read as the city allowing it, not the state
    // overriding the city.
    expect(r.stateFloor!.floors.sizeSqFt[0].value).toBe(1000)
    expect(effectiveMaxSize(r).source).toBe('local')
  })
})

describe('⚠️ the pending-ordinance check is structural, not a habit', () => {
  it('every read local ordinance carries one', () => {
    // Required on the type, so an ordinance cannot be encoded without recording
    // whether its currency was checked. Municode showed Seattle codified through
    // one ordinance while listing seventeen pending — reading the codified text
    // and stopping is how superseded law ships looking current.
    for (const c of ADU_LOCAL_READ) {
      const l = aduRulesFor(c).local
      if (l.kind !== 'read') throw new Error(`${c} should be read`)
      expect(['checked', 'not-checked'], c).toContain(l.pending.kind)
    }
  })

  it('Seattle was checked and came back CLEAN — a result, not an absence of effort', () => {
    const l = aduRulesFor('seattle').local as Extract<ReturnType<typeof aduRulesFor>['local'], { kind: 'read' }>
    if (l.pending.kind !== 'checked') throw new Error('expected checked')
    expect(l.pending.amendingThisSection).toEqual([])
    expect(l.pending.codifiedThrough).toMatch(/127423/)
    expect(l.pending.note).toMatch(/23\.42\.054/)
  })

  it('⚠️ San Diego, backfilled — closed by the PDF\'s own amendment history', () => {
    // Was `not-checked`, which was honest but open-ended, and an admission left
    // in place indefinitely becomes furniture. Closed by the thing nobody had
    // looked at: § 141.0302 carries inline amendment notes, and the latest inside
    // its own span is O-22109, effective 2026-07-15 — a month before the reading,
    // and the latest anywhere in the division.
    const l = aduRulesFor('sandiego').local as Extract<ReturnType<typeof aduRulesFor>['local'], { kind: 'read' }>
    if (l.pending.kind !== 'checked') throw new Error('expected checked')
    expect(l.pending.codifiedThrough).toMatch(/O-22109/)
    expect(l.pending.codifiedThrough).toMatch(/2026-07-15/)
    expect(l.pending.note).toMatch(/NO LIST EXISTS TO READ/)
  })

  it('⚠️ an empty amendingThisSection means something different in every city', () => {
    // rule 20 inside the instrument: `[]` is vacuously true wherever no list
    // exists, and green would read as "nothing pending" when it means "nothing to
    // read". Only Seattle earned the strong form — a list of 17 existed and was
    // read. Every other city must say so in its note, and this asserts the
    // distinction structurally rather than trusting four separate notes to keep
    // saying it. Pinned by membership so a city added without a note goes RED.
    // Only Seattle earned the strong form. The other four each disclose, in
    // their own wording, that no list was available — so the assertion matches
    // the DISCLOSURE, not one city's phrasing.
    const weak = ['la', 'sandiego', 'sanjose', 'sf']
    for (const c of ADU_LOCAL_READ) {
      const l = aduRulesFor(c).local
      if (l.kind !== 'read' || l.pending.kind !== 'checked') continue
      if (l.pending.amendingThisSection.length > 0) continue
      const note = l.pending.note ?? ''
      if (weak.includes(c)) {
        expect(note, c).toMatch(/no (pending-ordinance )?list/i)
      } else {
        // Seattle: a real list was read and found not to touch the section.
        expect(c).toBe('seattle')
        expect(note, c).not.toMatch(/no (pending-ordinance )?list/i)
      }
    }
    // ⚠️ And the set is non-empty and pinned, so this cannot pass by finding
    // nothing (rule 20) — the failure mode the rule exists for.
    const checked = ADU_LOCAL_READ.filter((c) => {
      const l = aduRulesFor(c).local
      return l.kind === 'read' && l.pending.kind === 'checked'
    })
    expect(checked).toEqual(['la', 'sandiego', 'sanjose', 'seattle', 'sf'])
  })
})

describe('⚠️ every read ordinance declares its baseline', () => {
  it('or the summary silently falls back to the largest, most-conditioned figure', () => {
    // The fallback still exists for safety, but nothing may rely on it. Twice now
    // the biggest number in a list of alternatives has been the one with the most
    // conditions attached — that is the pattern, not an incident.
    for (const c of ADU_LOCAL_READ) {
      const l = aduRulesFor(c).local
      if (l.kind !== 'read') throw new Error(`${c} should be read`)
      const marked = l.maxSizeSqFt.filter((m) => m.kind !== 'not-found' && m.baseline === true)
      expect(marked, c).toHaveLength(1)
    }
  })
})

describe('San José, as read from the ordinance', () => {
  const r = aduRulesFor('sanjose')
  const local = r.local as Extract<typeof r.local, { kind: 'read' }>

  it('is § 20.80.175, and the ordinance itself cites the recodified chapter', () => {
    // The section opens "Pursuant to Section 66314 of the Government Code" and
    // "Pursuant to Section 66321" — the city adopting the recodified chapter by
    // reference, which independently confirms § 65852.2 is the wrong citation.
    expect(local.citation).toMatch(/20\.80\.175/)
  })

  it('headlines 1,000 on the common lot size, not the 1,200 large-lot figure', () => {
    const e = effectiveMaxSize(r)
    expect(e.source).toBe('local')
    expect(e.value).toBe(1000)
    expect(e.why).toMatch(/up to 9,000 sq ft/)
  })

  it('⚠️ STATES heights in feet, unlike the first two cities read', () => {
    // San Diego and Seattle both defer height to the base zone, so two cities in
    // a row needed no figure and the type quietly implied none exists. San José
    // states four. Each city read has exposed a shape its predecessors did not.
    expect(local.heightDefersToBaseZone).toBeNull()
    expect(local.maxHeightFt.map((h) => h.value)).toEqual([18, 25, 25])
    expect(local.maxHeightFt.filter((h) => h.baseline)).toHaveLength(1)
    expect(local.maxHeightFt.find((h) => h.baseline)!.value).toBe(18)
    expect(local.maxStories?.value).toBe(2)
  })

  it('exceeds the California floor on height as well as size', () => {
    const floorHeight = r.stateFloor!.floors.heightFt.find((h) => h.baseline)!.value
    expect(floorHeight).toBe(16)
    expect(local.maxHeightFt.find((h) => h.baseline)!.value).toBeGreaterThan(floorHeight)
  })

  it('⚠️ records the 50%-of-primary rule as a ratio the model cannot hold', () => {
    // A ratio, not a figure. On a 1,400 sq ft primary it caps an attached ADU at
    // 700 sq ft — BELOW California's 850 floor. Whether § 66321(b)(2) voids it to
    // that extent is a question about the statute's reach, and this tool records
    // the tension rather than adjudicating it.
    const note = local.notes.find((n) => /50%/.test(n))!
    expect(note).toMatch(/ratio, not a figure/)
    expect(note).toMatch(/not computed here/)
    expect(note).toMatch(/below the 850 sq ft state floor/)
    expect(note).toMatch(/question for the city/)
  })

  it('⚠️ its pending check is weaker than Seattle\'s, and says which', () => {
    // Seattle displayed 17 pending ordinances that could be read and found not to
    // touch the section. San José displays no list at all — the absence of a list
    // is not the same as a list containing nothing.
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.amendingThisSection).toEqual([])
    expect(local.pending.note).toMatch(/no pending-ordinance list at all/)
    expect(local.pending.note).toMatch(/weaker than Seattle/)
  })
})

describe('Los Angeles — LAMC § 12.22 A.33', () => {
  const rules = aduRulesFor('la')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('reads the LEGACY chapter, and the citation says which instrument', () => {
    // ⚠️ LA runs two zoning codes side by side under `lapz`: Chapter I (the
    // legacy § 12.x code) and Chapter 1A, both current through the same date.
    // "Which instrument governs" had to be settled before a figure was read, and
    // a citation that does not name the chapter cannot be checked by a reader.
    expect(local.citation).toMatch(/§ 12\.22 A\.33/)
    expect(local.citation).toMatch(/Ch\. I Art\. 2/)
    expect(local.citation).toMatch(/Ord\. No\. 186,481/)
  })

  it('caps a detached ADU at 1,200 sq ft, above the 850 state floor', () => {
    const size = effectiveMaxSize(rules)
    expect(size.source).toBe('local')
    expect(size.value).toBe(1200)
    expect(size.why).toMatch(/850/)
  })

  it('carries the two-storey limit as STOREYS, never converted to feet', () => {
    // rule 12: § 12.22 A.33(d)(2) regulates in stories. Multiplying by an
    // invented ft/storey is how Miami published 87 stories for an 80-storey
    // district.
    expect(local.maxStories).toEqual({
      value: 2,
      condition: 'structures containing a detached ADU',
      cite: '§ 12.22 A.33(d)(2)',
    })
    expect(local.maxHeightFt).toEqual([])
  })

  it('⚠️ an empty maxHeightFt is the READING, not a missing lookup', () => {
    // The only height in feet in the subdivision is 16 ft at (c)(1)(iii), and it
    // is a FLOOR the city may not build below — not a cap. Listing it as a cap
    // would invert its meaning. Height defers to the base zone instead, and that
    // deferral is cited, so an absence here is answered rather than unresolved
    // (rule 5).
    expect(local.heightDefersToBaseZone).toEqual({ cite: '§ 12.22 A.33(c)(1)' })
    expect(summariseAdu(rules)).toMatch(/defers to the base zone/)
  })

  it("⚠️ LA's own text bounds its 50% ratio, where San José's did not", () => {
    // The durable finding of this read. Both cities cap an attached ADU at 50%
    // of the primary. San José stops there, so whether the 850 sq ft state floor
    // overrides it on a small primary is left as a question for the city. LA's
    // § 12.22 A.33(e)(3) says NOTHING IN THIS SUBDIVISION shall prohibit an
    // attached ADU below 850 (or 1,000 with more than one bedroom) — and
    // "nothing in this subdivision" reaches (e)(1). The source resolves it, not
    // us, which is why LA may state the resolution and San José may not.
    const la = local.notes.find((n) => /50%/.test(n))!
    expect(la).toMatch(/ratio, not a figure/)
    expect(la).toMatch(/\(e\)\(3\)/)
    expect(la).toMatch(/cannot cut below/)

    const sj = aduRulesFor('sanjose')
    if (sj.local.kind !== 'read') throw new Error('expected a read local layer')
    const sjNote = sj.local.notes.find((n) => /50%/.test(n))!
    expect(sjNote).toMatch(/question for the city/)
    expect(sjNote).not.toMatch(/cannot cut below/)
  })

  it('⚠️ records that the ordinance delegates to a REPEALED state section', () => {
    // The recodification hazard, this time inside a city ordinance rather than
    // in our own citation. § 12.22 A.33 was added in 2019, carries no later
    // amendment note, and (b)(4)–(6) make compliance with Gov. Code § 65852.2 the
    // approval standard — a section replaced by ch. 13 (§ 66310 et seq., Stats.
    // 2024 Ch. 7).
    //
    // ⚠️ STATED AS A FINDING, and the test enforces that. The first draft called
    // it "a question for the city", which reads as an open item in OUR reading
    // when every element is established and cited. A settled finding that is
    // hedged and a genuine gap render alike, and only one of them is true here.
    const note = local.notes.find((n) => /65852\.2/.test(n))!
    expect(note).toMatch(/^⚠️ FINDING:/)
    expect(note).toMatch(/delegates entire categories/i)
    expect(note).toMatch(/66310/)
    expect(note).toMatch(/established defect in the city's code/)
    // ⚠️ And it must NOT be hedged into an open question about our own encoding.
    expect(note).not.toMatch(/question for the city/)
    expect(note).toMatch(/not an uncertainty in this tool's reading/)
    // And our OWN citation still points at the live chapter.
    expect(rules.stateFloor!.citation).toMatch(/66321/)
    expect(rules.stateFloor!.citation).not.toMatch(/65852\.2/)
  })

  it('⚠️ its pending check is the weakest of the three, and says so', () => {
    // Seattle: a list of 17 existed and was read. San José: no list displayed.
    // amlegal: no list EXISTS for Chapter I at all — the only amending table is
    // scoped to Chapter 1A, a different instrument — and the codified-through
    // date is five months stale. An empty `amendingThisSection` must not read
    // the same across all three (rule 20).
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.amendingThisSection).toEqual([])
    expect(local.pending.note).toMatch(/NO LIST EXISTS TO READ/)
    expect(local.pending.note).toMatch(/Chapter 1A, a different instrument/)
    expect(local.pending.note).toMatch(/five months/)
    expect(local.pending.codifiedThrough).toMatch(/March 31, 2026/)
  })
})

describe('San Francisco — Planning Code §§ 207.1 and 207.2', () => {
  const rules = aduRulesFor('sf')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('carries BOTH programmes, because the city codifies the split itself', () => {
    // Every other city has one ADU section with the state floor underneath it.
    // SF has two parallel sections — this module's own state/local split written
    // into the Planning Code.
    expect(local.citation).toMatch(/§§ 207\.1 .*and 207\.2/)
    expect(local.maxSizeSqFt.some((m) => /§ 207\.1/.test(m.kind === 'not-found' ? '' : m.cite))).toBe(true)
    expect(local.maxSizeSqFt.some((m) => m.kind !== 'not-found' && /§ 207\.2/.test(m.cite))).toBe(true)
  })

  it('⚠️ says the two programmes are mutually exclusive, not a menu', () => {
    // rule 6. § 207.1(b) applies citywide EXCEPT to ADUs regulated by § 207.2, so
    // which governs follows from how the unit is built. Merging the two into one
    // envelope would report a maximum across alternatives as a ceiling.
    const n = local.notes.find((x) => /mutually exclusive/i.test(x))!
    expect(n).toMatch(/§ 207\.1\(b\)/)
    expect(n).toMatch(/not from the applicant choosing/)
  })

  it("⚠️ the local programme's size rule is not-numeric, never no-maximum", () => {
    // The trap this state exists for. § 207.1 states no square-foot cap in any of
    // its nine subsections; the binding limit is geometric and often TIGHTER than
    // 850 sq ft. `no-maximum` would read as permission and overstate.
    const localProg = local.maxSizeSqFt.find(
      (m) => m.kind !== 'not-found' && /207\.1/.test(m.cite),
    )!
    expect(localProg.kind).toBe('not-numeric')
    if (localProg.kind !== 'not-numeric') throw new Error('unreachable')
    expect(localProg.cite).toBe('§ 207.1(c)(5)')
    expect(localProg.rule).toMatch(/buildable area of the existing lot/)
    expect(localProg.rule).toMatch(/no vertical addition/)
    // And it must not be the thing that gets summarised as the city's allowance.
    expect(localProg.baseline).toBeUndefined()
  })

  it('a not-numeric baseline reports the floor and says the limit is not a number', () => {
    // Exercised directly, because no live city has a not-numeric BASELINE and a
    // branch nothing reaches is a branch nothing checks (rule 20).
    const synthetic: AduRules = {
      city: 'sf',
      stateFloor: rules.stateFloor,
      local: {
        ...local,
        maxSizeSqFt: [
          { kind: 'not-numeric', rule: 'it must fit the existing envelope', condition: 'all ADUs', cite: '§ 207.1(c)(5)', baseline: true },
        ],
      },
    }
    const e = effectiveMaxSize(synthetic)
    expect(e.source).toBe('local-non-numeric')
    expect(e.value).toBe(850) // the floor still applies as a minimum
    expect(e.why).toMatch(/not a square-foot figure/)
    // ⚠️ The half that matters: it must not read as headroom.
    expect(e.why).toMatch(/TIGHTER than the state floor rather than looser/)
    expect(e.why).not.toMatch(/no maximum size for an ADU|states no maximum\./)
  })

  it('summarises from the state-mandated 850, the least-conditioned case', () => {
    const e = effectiveMaxSize(rules)
    expect(e.source).toBe('local')
    expect(e.value).toBe(850)
    expect(e.why).toMatch(/single-family dwelling/)
  })

  it('carries the four heights, with the roof-pitch bonus as its own entry', () => {
    // 18 + 2 for an aligned roof pitch is a CONDITIONAL 20, not a flat one, and
    // the 16 ft belongs to the local rear-yard exception rather than to § 207.2.
    expect(local.maxHeightFt.map((h) => h.value)).toEqual([18, 20, 25, 16])
    expect(local.maxHeightFt.find((h) => h.baseline)!.value).toBe(18)
    expect(local.maxHeightFt.find((h) => h.value === 20)!.condition).toMatch(/roof pitch/)
    expect(local.maxHeightFt.find((h) => h.value === 16)!.cite).toMatch(/207\.1/)
  })

  it('⚠️ records the local programme allowing UNLIMITED ADUs above four units', () => {
    const n = local.notes.find((x) => /NO LIMIT on the number/.test(x))!
    expect(n).toMatch(/§ 207\.1\(c\)\(1\)/)
    expect(n).toMatch(/seismic retrofitting/)
  })

  it('⚠️ the 50% rule, drafted three ways — and only SF settles it in-sentence', () => {
    // The durable comparative finding of these four reads. Same substantive rule,
    // three degrees of self-resolution: San José silent, LA resolved by a separate
    // paragraph, SF resolved by "whichever is greater" in the same sentence.
    const sf = local.notes.find((x) => /WHICHEVER IS GREATER/.test(x))!
    expect(sf).toMatch(/850 sq ft/)
    expect(sf).toMatch(/Compare LA.*San José/s)

    const sj = aduRulesFor('sanjose')
    const la = aduRulesFor('la')
    if (sj.local.kind !== 'read' || la.local.kind !== 'read') throw new Error('expected read')
    expect(sj.local.notes.find((x) => /50%/.test(x))!).toMatch(/question for the city/)
    expect(la.local.notes.find((x) => /50%/.test(x))!).toMatch(/\(e\)\(3\)/)
  })

  it('⚠️ the recodification check PASSES here and fails in LA — both recorded', () => {
    // rule 9's corollary about unrecorded negatives: a clean sweep that is not
    // written down gets re-asked, and next time someone assumes it was never run.
    // Two cities in the same state, same check, opposite results.
    const ok = local.notes.find((x) => /Recodification check/.test(x))!
    expect(ok).toMatch(/66314–66333/)
    expect(ok).toMatch(/LIVE chapter 13/)
    expect(ok).toMatch(/Los Angeles.*did not/)

    const la = aduRulesFor('la')
    if (la.local.kind !== 'read') throw new Error('expected read')
    expect(la.local.notes.find((x) => /65852\.2/.test(x))!).toMatch(/delegates entire categories/i)
  })

  it('names Director Bulletin No. 3 as a source it did NOT reach', () => {
    // rule 5: an unread source must be visible as unread, not silently absent.
    expect(local.notes.find((x) => /Bulletin No\. 3/.test(x))!).toMatch(/has NOT been read/)
  })

  it('⚠️ has the strongest vintage of the four, and still no pending list', () => {
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.codifiedThrough).toMatch(/effective August 10, 2026/)
    expect(local.pending.amendingThisSection).toEqual([])
    // The empty array means something different in every city, so each says which.
    expect(local.pending.note).toMatch(/no list exists to read/i)
    expect(local.pending.note).toMatch(/nine days before this reading/)
  })
})
