import { describe, it, expect } from 'vitest'
import {
  aduRulesFor, summariseAdu, effectiveMaxSize, ADU_LOCAL_READ, ADU_STATE_PREEMPTED,
  ADU_STATE_NOT_ESTABLISHED, ADU_VOCABULARY_CHECK,
} from './adu'
import { CITIES } from '../../../../src/config/cities'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AduRules, AduFloor, StateLayer, StatePreempts } from './adu'

/** Narrowing helpers. The dimension shape is a union now, so a test that wants
 *  numeric floors has to say so — which is the point of the redesign. */
const stateOf = (c: string): StatePreempts => {
  const st = aduRulesFor(c).state
  if (st.kind !== 'preempts') throw new Error(`${c} is not preempted`)
  return st
}
const dimFloors = (d: StatePreempts['size']): AduFloor[] => (d.kind === 'floors' ? d.floors : [])
const sizeFloors = (f: StatePreempts) => dimFloors(f.size)
const heightFloors = (f: StatePreempts) => dimFloors(f.height)
const setbackFigure = (f: StatePreempts): number | null => {
  const b = dimFloors(f.setback).find((x) => x.baseline)
  return b && b.form === 'figure' ? b.value : null
}

// ⚠️ SYNTHETIC ON PURPOSE (rule 29). Three tests below used San Francisco as the
// stand-in for "state floor known, local ordinance unread" — and San Francisco was
// then read, breaking all three for a reason having nothing to do with the
// invariant. A city is only floor-only until someone reads it, so naming one picks
// whatever is next off the work queue. Every preempted city is now read, so there
// is no live example left to name and constructing the state directly is the only
// stable fixture: it exercises the branch by construction and cannot be read away.
// ⚠️ THE SAME TRAP, SPRUNG A FOURTH TIME AND INSIDE ONE COMMIT.
//
// The "nobody has looked" test named Denver, until Colorado was found. It was
// moved to Atlanta with a comment saying Atlanta worked "only while Georgia
// stays blocked" — and Georgia was closed the next hour, by following the
// legislature's own link instead of assuming a paywall. The prediction was
// written down and the fixture rotted anyway.
//
// With 16 of 16 jurisdictions established there is now NO live city in this
// state, so there is nothing left to name. Same resolution as FLOOR_ONLY:
// construct the state. Rule 29 says pick a fixture by WHY it cannot be done, and
// the only durable answer here is "because it is built that way".
const NOTHING_ESTABLISHED: AduRules = {
  city: 'atlanta',
  state: { kind: 'not-established', state: 'Nowhere', detail: 'synthetic fixture — see the note above' },
  stateApplies: { kind: 'n-a' },
  local: { kind: 'not-read', detail: 'synthetic fixture' },
}

// ⚠️ CONSTRUCTED, AND PRE-EMPTIVELY SO. The `state-no-figure` case was
// exercised through Las Vegas until Las Vegas was read, and the obvious
// replacement was Boston — which is next on the reading list. That is rule 29
// setting itself up for a fifth time, visible in advance. So it is built here:
// a live preemption whose statute states no size, with no local reading behind
// it. Nothing anyone reads can take this fixture away.
const STATE_NO_FIGURE: AduRules = {
  city: 'lasvegas',
  state: aduRulesFor('lasvegas').state,
  stateApplies: aduRulesFor('lasvegas').stateApplies,
  local: { kind: 'not-read', detail: 'synthetic fixture — see the note above' },
}

// ⚠️ CONSTRUCTED, for the same reason as the others. `state-declines` was
// exercised through Miami until Miami's ordinance was read. Florida is the only
// jurisdiction in the set whose statute declines, so there is no second city to
// repoint at — and repointing is what keeps failing. Built here instead.
const STATE_DECLINES: AduRules = {
  city: 'miami',
  state: aduRulesFor('miami').state,
  stateApplies: { kind: 'n-a' },
  local: { kind: 'not-read', detail: 'synthetic fixture — see the note above' },
}

const FLOOR_ONLY: AduRules = {
  city: 'sf',
  state: aduRulesFor('sf').state,
  stateApplies: aduRulesFor('sf').stateApplies,
  local: { kind: 'not-read', detail: 'synthetic fixture — see the note above' },
}

describe('which body of law governs', () => {
  it('routes California cities to state law, not the municipal code', () => {
    // The first place this tool reads a source ABOVE the city. Getting it wrong
    // produces a confident number from the wrong instrument.
    for (const c of ['la', 'sf', 'sanjose', 'sandiego']) {
      expect(stateOf(c).state, c).toBe('California')
    }
  })

  it('routes Seattle to Washington state law', () => {
    expect(stateOf('seattle').state).toBe('Washington')
  })

  it('⚠️ says nobody has looked, rather than that the city has no rules', () => {
    // rule 5. "Atlanta has no ADU rules" would be a finding; nobody has looked.
    // ⚠️ The fixture moved from Denver to Atlanta because DENVER STOPPED
    // QUALIFYING — Colorado's statute was found on 2026-08-20, so Denver is no
    // longer a nothing-established city. Rule 29 in action: a fixture chosen for
    // being unread is drawn from the front of the work queue. Atlanta is a
    // structurally better example only while Georgia stays blocked, and the
    // guard below pins that set so this cannot rot silently.
    const a = NOTHING_ESTABLISHED
    expect(a.state.kind).toBe('not-established')
    expect(a.local.kind).toBe('not-read')
    expect(summariseAdu(a)).toMatch(/nobody has looked/)
    // And the resolver's own fallback for an unknown city is this state, never
    // `no-provision` — a default must not manufacture a claim.
    expect(aduRulesFor('atlantis').state.kind).toBe('not-established')
  })

  it('⚠️ Denver now qualifies — by the CITY\'s statement, not an inference', () => {
    // This was `not-established` because Colorado's test has two halves and only
    // population was obvious; inferring MPO membership from size is what rule 24
    // forbids. It is closed by an OUTSIDE source: Denver CPD publishes that the
    // Citywide ADUs measure implements HB24-1152 and that the statute requires
    // Denver to allow ADUs in all residential districts — and Denver amended its
    // code accordingly. The jurisdiction asserting its own status.
    const d = aduRulesFor('denver')
    expect(d.state.kind).toBe('preempts')
    expect(d.stateApplies.kind).toBe('qualifies')
    if (d.stateApplies.kind !== 'qualifies') throw new Error('unreachable')
    expect(d.stateApplies.why).toMatch(/HB24-1152/)
    expect(d.stateApplies.why).toMatch(/requires Denver/)
    // ⚠️ And the limit of that evidence is stated rather than rounded up.
    expect(d.stateApplies.why).toMatch(/city’s own characterisation/)
    expect(d.stateApplies.why).toMatch(/not an independent verification of MPO membership/)
  })

  it('⚠️ the state survey is COMPLETE, and the guard cannot pass by finding nothing', () => {
    // 16 of 16 jurisdictions established on 2026-08-20. `ADU_STATE_NOT_ESTABLISHED`
    // is now empty — and an empty set makes an "everything is established"
    // assertion vacuously true, which is exactly the rule 20 failure. So the
    // input set is pinned by size and by composition, and a city added without a
    // state layer turns this RED rather than sliding through.
    expect([...ADU_STATE_NOT_ESTABLISHED]).toEqual([])
    const live = CITIES.filter((c) => c.live).map((c) => c.slug)
    const byKind: Record<string, string[]> = {}
    for (const slug of live) {
      const k = aduRulesFor(slug).state.kind
      ;(byKind[k] ??= []).push(slug)
    }
    // Non-empty, and every live city accounted for in exactly one bucket.
    expect(live.length).toBe(23)
    expect(Object.values(byKind).flat().sort()).toEqual([...live].sort())
    expect(byKind['not-established'] ?? []).toEqual([])
    expect((byKind['preempts'] ?? []).sort()).toEqual(
      ['boston', 'denver', 'la', 'lasvegas', 'phoenix', 'sandiego', 'sanjose', 'seattle', 'sf'],
    )
    expect(byKind['declines']).toEqual(['miami'])
    expect((byKind['no-provision'] ?? []).length).toBe(13)
  })

  it('covers every live city explicitly, with no silent default', () => {
    // rule 20: a city missing from the map would fall through, and silence here
    // would render as "no state law applies" — which is a claim.
    const live = CITIES.filter((c) => c.live).map((c) => c.slug)
    expect(live.length).toBeGreaterThan(20)
    for (const slug of live) expect(aduRulesFor(slug).city, slug).toBe(slug)
    // Both sets pinned, and SEPARATELY — conflating them would let one city's
    // reading imply another's.
    expect([...ADU_STATE_PREEMPTED]).toEqual(['boston', 'denver', 'la', 'lasvegas', 'phoenix', 'sandiego', 'sanjose', 'seattle', 'sf'])
    expect([...ADU_LOCAL_READ]).toEqual(['austin', 'boston', 'denver', 'la', 'lasvegas', 'miami', 'phoenix', 'sandiego', 'sanjose', 'seattle', 'sf'])
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
    // ⚠️ Only where the dimension IS a list of floors. Massachusetts reserves
    // both dimensions to the city and Nevada addresses neither, so requiring a
    // baseline there would demand a number the statute does not have.
    let checked = 0
    for (const c of ADU_STATE_PREEMPTED) {
      const f = stateOf(c)
      for (const d of [f.size, f.height, f.setback]) {
        if (d.kind !== 'floors') continue
        expect(d.floors.filter((x) => x.baseline), c).toHaveLength(1)
        checked++
      }
    }
    // rule 20: this must not pass by finding nothing.
    expect(checked).toBeGreaterThanOrEqual(12)
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
      if (/does not address|reserves|not a fixed figure|states no floor|may not reach/.test(t)) continue
      expect(t, c).not.toMatch(/maximum of|at most|no larger than|cannot exceed/)
    }
  })
})

describe('California, as read from the statute', () => {
  const a = stateOf('sf')

  it('⚠️ keeps 850 and 800 apart — they are different provisions', () => {
    // § 66321(b)(2) caps how low a city's max-size ordinance may go. § 66321(b)(3)
    // is stronger and narrower: an 800 sq ft ADU with four-foot setbacks must be
    // buildable NOTWITHSTANDING lot coverage, FAR, open space, front setbacks and
    // minimum lot size. One constrains a number, the other overrides a family of
    // standards — collapsing them to a single figure loses the more useful half.
    const sizes = sizeFloors(a)
    expect(sizes.map((s) => (s as Extract<AduFloor,{form:'figure'}>).value).sort((x, y) => x - y)).toEqual([800, 850, 1000])
    const eight = sizes.find((s) => s.form === 'figure' && s.value === 800)!
    expect(eight.cite).toBe('§ 66321(b)(3)')
    expect(eight.condition).toMatch(/regardless of lot coverage, FAR, open space/)
    expect(sizes.find((s) => s.form === 'figure' && s.value === 850)!.cite).toBe('§ 66321(b)(2)(A)')
  })

  it('carries all four height floors with their conditions', () => {
    expect(heightFloors(a).map((h) => (h as Extract<AduFloor,{form:'figure'}>).value)).toEqual([16, 18, 18, 25])
    // The two 18s are different provisions — transit proximity and multifamily
    // multistory — and are NOT deduplicated.
    expect(heightFloors(a).filter((h) => h.form === 'figure' && h.value === 18).map((h) => h.cite)).toEqual([
      '§ 66321(b)(4)(B)',
      '§ 66321(b)(4)(C)',
    ])
    // ⚠️ The attached case is the one that can go DOWN: 25 ft or the primary
    // dwelling's own limit, whichever is LOWER. Reading it as a flat 25 would
    // overstate on a low-rise lot.
    expect(heightFloors(a).find((h) => h.form === 'figure' && h.value === 25)!.condition).toMatch(/whichever is LOWER/)
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
    expect(setbackFigure(a)).toBe(4)
  })
})

describe('Washington, as read from the statute', () => {
  const a = stateOf('seattle')

  it('carries the size, height and count floors', () => {
    expect((sizeFloors(a)[0] as Extract<AduFloor,{form:'figure'}>).value).toBe(1000)
    expect((heightFloors(a)[0] as Extract<AduFloor,{form:'figure'}>).value).toBe(24)
    expect(a.count[0].value).toBe(2)
  })

  it('⚠️ keeps the urban-growth-area scope clause on the count', () => {
    // The statute binds lots "within an urban growth area" in districts allowing
    // single-family homes. Dropping that states the rule more broadly than the
    // legislature wrote it — rule 23, absence within a scope.
    expect(a.count[0].condition).toMatch(/inside an urban growth area/)
  })

  it('⚠️ leaves maxSetbackFt null, because the statute sets no figure', () => {
    // It forbids setbacks MORE RESTRICTIVE than the principal unit's, which is a
    // different instrument entirely. Inventing a number here — 4 ft, say, by
    // analogy with California — is exactly rule 4.
    expect(setbackFigure(a)).toBeNull()
    expect(a.protections.join(' ')).toMatch(/more restrictive than for the principal unit/i)
  })

  it('records the height floor deferring to a lower principal-unit limit', () => {
    expect(heightFloors(a)[0].condition).toMatch(/unless the principal unit’s own limit is lower/)
  })

  it('records the owner-occupancy ban, which changes who can build', () => {
    expect(a.protections.join(' ')).toMatch(/No owner-occupancy requirement/)
  })
})

describe('every read entry carries its citation and date', () => {
  it('so a figure can never be traced to nobody', () => {
    for (const c of ADU_STATE_PREEMPTED) {
      const a = stateOf(c)
      expect(a.citation.length, c).toBeGreaterThan(20)
      expect(a.readOn, c).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.effectiveFrom, c).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.appliesTo.length, c).toBeGreaterThan(20)
      for (const f of [...sizeFloors(a), ...heightFloors(a), ...dimFloors(a.setback), ...a.count]) {
        expect(f.cite.length, `${c} ${f.condition}`).toBeGreaterThan(4)
        expect(f.condition.length, `${c} ${f.cite}`).toBeGreaterThan(10)
      }
      // ⚠️ And a dimension that is NOT a list still has to explain itself —
      // otherwise `not-addressed` becomes a silent shrug.
      for (const d of [a.size, a.height, a.setback]) {
        if (d.kind === 'reserved-to-city') expect(d.detail.length + d.cite.length, c).toBeGreaterThan(30)
        if (d.kind === 'not-addressed') expect(d.detail.length, c).toBeGreaterThan(30)
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
    expect(stateOf('sandiego').state).toBe('California')
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
    // ⚠️ Atlanta, not Denver. Denver acquired a statute on 2026-08-20 and now
    // returns `state-no-figure` — a live preemption whose reach is unverified —
    // which is a DIFFERENT nothing from Atlanta's, where nobody has looked.
    const e = effectiveMaxSize(NOTHING_ESTABLISHED)
    expect(e.source).toBe('unresolved')
    expect(e.value).toBeNull()
  })

  it('⚠️ the four nothings are four different sources, never one null', () => {
    // THE POINT OF THE REDESIGN. Under `stateFloor: X | null` all four of these
    // produced an identical shrug. Florida's legislature read the question and
    // handed it to the city; North Carolina's planning chapter was read whole
    // and has no ADU provision; Nevada preempts but states no size; Georgia has
    // not been looked at. Four facts, and only the last is ignorance.
    expect(effectiveMaxSize(STATE_DECLINES).source).toBe('state-declines')
    expect(effectiveMaxSize(aduRulesFor('charlotte')).source).toBe('unresolved')
    expect(effectiveMaxSize(STATE_NO_FIGURE).source).toBe('state-no-figure')
    expect(effectiveMaxSize(NOTHING_ESTABLISHED).source).toBe('unresolved')
    // Every one of them still publishes NO number — the distinction is in the
    // reason, never in a figure invented to fill the gap.
    for (const r of [STATE_DECLINES, aduRulesFor('charlotte'), STATE_NO_FIGURE, NOTHING_ESTABLISHED]) {
      expect(effectiveMaxSize(r).value, r.city).toBeNull()
    }

    // ⚠️ And the two that share a `source` must NOT share a sentence: NC was
    // read within a named scope, the synthetic city was not read at all.
    const nc = summariseAdu(aduRulesFor('charlotte'))
    const none = summariseAdu(NOTHING_ESTABLISHED)
    expect(nc).toMatch(/contains no ADU provision/)
    expect(nc).not.toMatch(/nobody has looked/)
    expect(none).toMatch(/nobody has looked/)
    expect(none).not.toMatch(/contains no ADU provision/)
  })

  it('⚠️ Florida is an ANSWER about Florida, not a gap in our reading', () => {
    const s = summariseAdu(STATE_DECLINES)
    expect(s).toMatch(/163\.31771/)
    expect(s).toMatch(/MAY adopt an ordinance/i)
    expect(s).toMatch(/leaves the decision to the city/)
    expect(s).not.toMatch(/nobody has looked/)
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
    expect((sizeFloors(stateOf('seattle'))[0] as Extract<AduFloor,{form:'figure'}>).value).toBe(1000)
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
    const weak = ['austin', 'boston', 'denver', 'la', 'lasvegas', 'sandiego', 'sanjose', 'sf']
    for (const c of ADU_LOCAL_READ) {
      const l = aduRulesFor(c).local
      if (l.kind !== 'read' || l.pending.kind !== 'checked') continue
      if (l.pending.amendingThisSection.length > 0) continue
      const note = l.pending.note ?? ''
      if (weak.includes(c)) {
        expect(note, c).toMatch(/no (pending[- ]?(ordinance )?)?list/i)
      } else {
        // ⚠️ The STRONG form: a real list existed, was queried, and came back
        // without anything touching the section. Seattle read a list of 17;
        // Phoenix queried a "Pending Codification" view that returned nothing
        // AND controlled that emptiness against an unfiltered view returning 25.
        // ⚠️ Miami joins the strong form: Miami 21 carries its own "Amendments
        // to Miami 21" table, which was read — the ordinance that rewrote the
        // ADU section is in it, and nothing later in it names ADUs.
        expect(['seattle', 'phoenix', 'miami'], c).toContain(c)
        expect(note, c).not.toMatch(/no (pending[- ]?(ordinance )?)?list/i)
      }
    }
    // ⚠️ And the set is non-empty and pinned, so this cannot pass by finding
    // nothing (rule 20) — the failure mode the rule exists for.
    const checked = ADU_LOCAL_READ.filter((c) => {
      const l = aduRulesFor(c).local
      return l.kind === 'read' && l.pending.kind === 'checked'
    })
    expect(checked).toEqual(['austin', 'boston', 'denver', 'la', 'lasvegas', 'miami', 'phoenix', 'sandiego', 'sanjose', 'seattle', 'sf'])
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
    expect(local.maxHeightFt.map((h) => (h as Extract<AduFloor,{form:'figure'}>).value)).toEqual([18, 25, 25])
    expect(local.maxHeightFt.filter((h) => h.baseline)).toHaveLength(1)
    expect((local.maxHeightFt.find((h) => h.baseline)! as Extract<AduFloor,{form:'figure'}>).value).toBe(18)
    expect(local.maxStories?.value).toBe(2)
  })

  it('exceeds the California floor on height as well as size', () => {
    const floorHeight = (heightFloors(stateOf('sanjose')).find((h) => h.baseline)! as Extract<AduFloor,{form:'figure'}>).value
    expect(floorHeight).toBe(16)
    expect((local.maxHeightFt.find((h) => h.baseline)! as Extract<AduFloor,{form:'figure'}>).value).toBeGreaterThan(floorHeight)
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
    expect((rules.state as Extract<StateLayer,{kind:'preempts'}>).citation).toMatch(/66321/)
    expect((rules.state as Extract<StateLayer,{kind:'preempts'}>).citation).not.toMatch(/65852\.2/)
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
      state: rules.state,
      stateApplies: rules.stateApplies,
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
    expect(local.maxHeightFt.map((h) => (h as Extract<AduFloor,{form:'figure'}>).value)).toEqual([18, 20, 25, 16])
    expect((local.maxHeightFt.find((h) => h.baseline)! as Extract<AduFloor,{form:'figure'}>).value).toBe(18)
    expect(local.maxHeightFt.find((h) => h.form === 'figure' && h.value === 20)!.condition).toMatch(/roof pitch/)
    expect(local.maxHeightFt.find((h) => h.form === 'figure' && h.value === 16)!.cite).toMatch(/207\.1/)
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

describe('Phoenix — Zoning Ordinance § 706.A, under the Arizona floor', () => {
  const rules = aduRulesFor('phoenix')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ Phoenix ADOPTED, so the without-limits sanction does not apply', () => {
    // A.R.S. § 9-461.18(F): a municipality that missed the 2025-01-01 deadline
    // must allow ADUs on all residentially zoned lots WITHOUT LIMITS. The two
    // regimes are nothing alike, so which one applies had to be settled before
    // any figure was read. § 706 was amended by Ord. G-7317 in 2024 — inside it.
    expect(local.citation).toMatch(/G-7317/)
    expect(local.citation).toMatch(/2024/)
    const st = rules.state
    if (st.kind !== 'preempts') throw new Error('expected preempts')
    expect(st.protections.join(' ')).toMatch(/WITHOUT LIMITS/)
    expect(st.protections.join(' ')).toMatch(/2025-01-01/)
  })

  it('⚠️ the size cap is COMPOUND, so no figure is publishable', () => {
    // § 706.A.8 caps at 75% of the primary dwelling AND a lot-size figure. Both
    // limbs bind, so the answer is their minimum and neither half alone is it.
    // Publishing 1,000 would overstate on every lot whose primary is small
    // enough for the ratio to bite first.
    const baseline = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(baseline.kind).toBe('not-numeric')
    if (baseline.kind !== 'not-numeric') throw new Error('unreachable')
    expect(baseline.rule).toMatch(/LESSER of 75%/)
    expect(baseline.rule).toMatch(/1,000 sq ft/)
    expect(baseline.rule).toMatch(/10% of net lot area/)
    expect(baseline.cite).toBe('§ 706.A.8')

    const e = effectiveMaxSize(rules)
    expect(e.value).toBeNull()
    expect(e.source).toBe('local-non-numeric')
  })

  it('⚠️ the stated figures are UPPER BOUNDS on one limb, never the answer', () => {
    // They are recorded because they are real, and marked so they cannot be
    // mistaken for the cap. Neither carries `baseline`.
    const caps = local.maxSizeSqFt.filter((m) => m.kind === 'capped')
    expect(caps.map((c) => (c as Extract<typeof c, { kind: 'capped' }>).sqFt)).toEqual([1000, 3000])
    for (const c of caps) {
      expect(c.baseline, String((c as Extract<typeof c, { kind: 'capped' }>).sqFt)).toBeUndefined()
      expect(c.condition).toMatch(/upper bound/)
      expect(c.condition).toMatch(/75% ratio may bind lower/)
    }
  })

  it('⚠️ the SAME 75% ratio appears in both instruments, capped both times', () => {
    // Arizona guarantees min(75% of primary, 1,000). Phoenix caps at
    // min(75% of primary, lot figure). Same ratio, same direction — and both
    // are `whichever is LESS`, the opposite of San Francisco's
    // "50% ... whichever is GREATER". Neither yields a number on its own.
    const st = rules.state
    if (st.kind !== 'preempts' || st.size.kind !== 'floors') throw new Error('expected floors')
    const f = st.size.floors.find((x) => x.baseline)!
    expect(f.form).toBe('derived')
    if (f.form !== 'derived') throw new Error('unreachable')
    expect(f.rule).toMatch(/75%/)
    expect(f.rule).toMatch(/WHICHEVER IS LESS/i)
    // And the SF drafting runs the other way — pinned so the pair cannot drift.
    const sf = aduRulesFor('sf')
    if (sf.local.kind !== 'read') throw new Error('expected read')
    expect(sf.local.notes.find((n) => /WHICHEVER IS GREATER/.test(n))).toBeTruthy()
  })

  it('keeps the 15 ft figure and the parity cases apart', () => {
    // Two of three height cases defer to the primary dwelling and one states a
    // figure. `heightDefersToBaseZone` would erase the figure, so the deferral
    // lives on `parity` entries — the form the state survey forced into the type.
    expect(local.heightDefersToBaseZone).toBeNull()
    const b = local.maxHeightFt.find((h) => h.baseline)!
    expect(b.form).toBe('figure')
    if (b.form !== 'figure') throw new Error('unreachable')
    expect(b.value).toBe(15)
    expect(local.maxHeightFt.filter((h) => h.form === 'parity')).toHaveLength(2)
  })

  it('⚠️ says the ADU COUNT is not answered by this section', () => {
    // § 706.A.1 applies "per the underlying zoning district" — the count comes
    // from the district. Reading one attached ADU (§ 706.A.2.a) as the total
    // would be a cap invented from a partial rule.
    const n = local.notes.find((x) => /HOW MANY ADUs/.test(x))!
    expect(n).toMatch(/not stated/)
    expect(n).toMatch(/underlying zoning district/)
    expect(n).toMatch(/Arizona floor/)
  })

  it('⚠️ its pending check is STRONG, and the emptiness was controlled', () => {
    // Only the second strong-form check in the file. On this very site a code
    // search for "zoning" returned zero — the search is unusable — so an empty
    // result here had to be proved against a working view before it counted.
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.amendingThisSection).toEqual([])
    expect(local.pending.note).toMatch(/STRONG form/)
    expect(local.pending.note).toMatch(/positive control/)
    expect(local.pending.note).toMatch(/G-7524/)
    expect(local.pending.note).not.toMatch(/no list exists to read/i)
    expect(local.pending.codifiedThrough).toMatch(/G-7461/)
  })
})

describe('Las Vegas — LVMC 19.12.070, adopted the day the state mandate began', () => {
  const rules = aduRulesFor('lasvegas')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ the ordinance and the statute share an effective date', () => {
    // Ord. 6963 carries 07/01/26 and NRS 278.257 took effect 2026-07-01. The
    // local rule exists because the statute does, and neither layer read alone
    // would show it.
    const st = rules.state
    if (st.kind !== 'preempts') throw new Error('expected preempts')
    expect(st.effectiveFrom).toBe('2026-07-01')
    expect(local.citation).toMatch(/Ord\. 6963/)
    expect(local.citation).toMatch(/2026-07-01/)
  })

  it('⚠️ it is a LAND USE, not a section — the TOC scan finds the wrong thing', () => {
    // Title 19 has no ADU-titled section. A contents scan surfaces 19.12.020
    // "Accessory Uses and Structures", which regulates garage sales and parking
    // a car with a For Sale sign. The real provision is a use description in
    // 19.12.070 plus a definition in 19.18.020, reachable only by full text.
    expect(local.citation).toMatch(/19\.12\.070/)
    expect(local.citation).toMatch(/19\.18\.020/)
    expect(local.citation).not.toMatch(/19\.12\.020/)
  })

  it('⚠️ the size cap is a 100% ratio — the fourth drafting, the fourth operator', () => {
    // SF: 50% or 850, whichever GREATER — a ratio floored by a figure.
    // AZ: 75% or 1,000, whichever LESS — a ratio capped by a figure.
    // Phoenix: 75% AND a lot figure — both limbs binding.
    // Las Vegas: 100% — may equal the primary but not exceed it.
    // Same two ingredients every time; no two jurisdictions combine them alike,
    // and not one of the four yields a publishable number on its own.
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind).toBe('not-numeric')
    if (b.kind !== 'not-numeric') throw new Error('unreachable')
    expect(b.rule).toMatch(/total gross floor area of the primary dwelling unit/)
    expect(b.rule).toMatch(/LESSER/)
    expect(effectiveMaxSize(rules).value).toBeNull()
    expect(effectiveMaxSize(rules).source).toBe('local-non-numeric')
  })

  it('states no height at all and routes it to the district', () => {
    expect(local.maxHeightFt).toEqual([])
    expect(local.maxStories).toBeNull()
    expect(local.heightDefersToBaseZone?.cite).toMatch(/development standards of the zoning district/)
  })

  it('⚠️ records the parking proviso the local rule does not repeat', () => {
    // NRS 278.257(2)(b) caps additional parking at one space, but only "provided
    // that the existing parking ... and street parking satisfy the anticipated
    // parking needs". Las Vegas requires one space unconditionally. Recorded,
    // not adjudicated — same class as the San José 50% question.
    const n = local.notes.find((x) => /PARKING SITS EXACTLY AT THE STATE CEILING/.test(x))!
    expect(n).toMatch(/proviso the local rule does not repeat|carries a proviso/)
    expect(n).toMatch(/records rather than resolves/)
  })

  it('⚠️ says which of the two texts prevails, because they differ', () => {
    // 19.12.070 calls its own descriptions "for convenience of reference only"
    // and defers to 19.18.020. They differ on a load-bearing word: "principal
    // dwelling" against "principal SINGLE FAMILY dwelling".
    const n = local.notes.find((x) => /THE DEFINITION PREVAILS/.test(x))!
    expect(n).toMatch(/SINGLE FAMILY/)
    expect(n).toMatch(/19\.18\.020/)
  })

  it('⚠️ its pending state is the weakest in the file, and names the risk', () => {
    // No pending list AND no codified-through date — only a self-declared lag of
    // up to 60 days. The lag bites here specifically: the governing statute took
    // effect 50 days before this reading.
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.amendingThisSection).toEqual([])
    expect(local.pending.codifiedThrough).toMatch(/no codified-through date is published/)
    expect(local.pending.codifiedThrough).toMatch(/60-day lag/)
    expect(local.pending.note).toMatch(/WEAK form/)
    expect(local.pending.note).toMatch(/50 days later/)
  })
})

describe('⚠️ summariseAdu must survive every city, not just the exercised ones', () => {
  it('never throws, for any live city', () => {
    // THE REGRESSION THIS CLOSES. `summariseAdu` cast a possibly-null size to a
    // number and called toLocaleString on it. `local-non-numeric` yields null,
    // so it crashed on the first city whose baseline cap is not a figure.
    //
    // ⚠️ Phoenix had the identical fault for a full commit and never crashed —
    // nothing ran summariseAdu on a Phoenix ADU project. Las Vegas differs only
    // in that an existing hurdles test happened to exercise it. Rule 18's
    // corollary: code that did not run is not code that works, so this asserts
    // the whole set rather than the city that happened to fail.
    const live = CITIES.filter((c) => c.live).map((c) => c.slug)
    expect(live.length).toBeGreaterThan(20)
    for (const slug of live) {
      expect(() => summariseAdu(aduRulesFor(slug)), slug).not.toThrow()
      const line = summariseAdu(aduRulesFor(slug))
      expect(line.length, slug).toBeGreaterThan(40)
      // And no city may render a null, an undefined or a NaN into user-facing copy.
      expect(line, slug).not.toMatch(/\bnull\b|\bundefined\b|NaN/)
    }
  })

  it('says so plainly where no figure can be published', () => {
    for (const slug of ['phoenix', 'lasvegas']) {
      const line = summariseAdu(aduRulesFor(slug))
      expect(line, slug).toMatch(/No maximum size can be published/)
      // ⚠️ And it must not read as permission — the limits are real, just not
      // numbers. This is the `no-maximum` confusion one level down.
      expect(line, slug).not.toMatch(/states no maximum size for an ADU/)
    }
  })
})

describe('⚠️ no live `as number` cast survives in this module', () => {
  it('because a cast is what hid the summariseAdu crash', () => {
    // `size.value as number` type-checks against `number | null` and defers the
    // failure to runtime, so the invariant has to hold in a reader's head. Two
    // such casts existed: one crashed on the first city to reach it, and the
    // other was correct only by an invariant enforced 140 lines away. Both are
    // gone — replaced by a real null guard and a re-derivation.
    const src = readFileSync(resolve(__dirname, 'adu.ts'), 'utf8')
    // rule 20: prove the scan actually read the file before trusting a zero.
    expect(src.length).toBeGreaterThan(20000)
    expect(src).toMatch(/export function summariseAdu/)

    const live = src
      .split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .filter(([, l]) => /\bas number\b/.test(l))
    expect(live.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([])

    // ⚠️ And the guard must be able to SEE such a cast — otherwise it passes by
    // finding nothing whatever the file says (rule 20, and rule 28 on planting).
    const planted = ['const x = (v as number).toLocaleString()']
    expect(planted[0]).toMatch(/\bas number\b/)
    expect(planted.filter((l) => !/^\s*(\/\/|\*)/.test(l) && /\bas number\b/.test(l))).toHaveLength(1)
  })
})

describe('⚠️ Massachusetts — the figure is in the DEFINITION, not the operative section', () => {
  const st = aduRulesFor('boston').state
  if (st.kind !== 'preempts') throw new Error('expected preempts')

  it('does not claim the statute is silent on size', () => {
    // THE CORRECTION. This field asserted that the chapter sets out no size at
    // all, on a reading that covered § 3 and stopped. § 3 confers the by-right
    // use; § 1A defines the term the right attaches to, and the definition
    // carries the number. Reading the granting section without the defining one
    // produced a confident absence.
    expect(st.size.kind).toBe('reserved-to-city')
    if (st.size.kind !== 'reserved-to-city') throw new Error('unreachable')
    expect(st.size.cite).toMatch(/§§ 1A, 3/)
    expect(st.size.detail).toMatch(/900 sq ft/)
    expect(st.size.detail).toMatch(/1\/2 the principal dwelling/)
    // ⚠️ The retracted assertion must not survive anywhere in the field.
    expect(st.size.detail).not.toMatch(/states no size/i)
  })

  it('⚠️ records it as a CEILING on the protected category, never as a floor', () => {
    // Every other figure in this file is a minimum the city must allow. This one
    // is the maximum the by-right protection reaches — a unit above it simply is
    // not an ADU for the Act. Recording it as a floor would assert a right the
    // statute does not confer, which is rule 18's direction of error exactly.
    if (st.size.kind !== 'reserved-to-city') throw new Error('unreachable')
    expect(st.size.detail).toMatch(/ceiling on what the by-right use covers|PROTECTED CATEGORY/i)
    expect(st.size.detail).toMatch(/NOT a floor/)
    expect(st.size.detail).toMatch(/no size is guaranteed/i)
    // And nothing publishes a Massachusetts size figure.
    // ⚠️ Boston's LOCAL layer is now read too, and states no size either — so
    // the source is `local-non-numeric` rather than `state-no-figure`. Both
    // publish nothing; what changed is which instrument was consulted last.
    const e = effectiveMaxSize(aduRulesFor('boston'))
    expect(e.value).toBeNull()
    expect(e.source).toBe('local-non-numeric')
    // The state-only shape is still exercised, by construction.
    expect(effectiveMaxSize({ ...aduRulesFor('boston'), local: { kind: 'not-read', detail: 'x' } }).source)
      .toBe('state-no-figure')
  })

  it('records that a municipality may restrict FURTHER, and the only bound', () => {
    // § 1A(iii). The bound is a reasonableness standard, not a number — so a
    // local cap below 900 is not automatically void, and this tool does not
    // adjudicate which ones are "unreasonable".
    const n = st.protections.find((x) => /additional size restrictions/.test(x))!
    expect(n).toMatch(/unreasonably restrict/)
    expect(n).toMatch(/does not adjudicate/)
  })

  it('⚠️ the ratio family now has five draftings and five operators', () => {
    // AZ min(75%, 1000) and MA min(50%, 900) look nearly identical and point in
    // OPPOSITE directions: Arizona's is the minimum a city must allow,
    // Massachusetts' the maximum the protection reaches. Pinned together so the
    // resemblance cannot cause one to be read as the other.
    const az = aduRulesFor('phoenix').state
    if (az.kind !== 'preempts' || az.size.kind !== 'floors') throw new Error('expected floors')
    const azFloor = az.size.floors.find((f) => f.baseline)!
    expect(azFloor.form).toBe('derived')
    if (azFloor.form !== 'derived') throw new Error('unreachable')
    expect(azFloor.rule).toMatch(/WHICHEVER IS LESS/i)
    expect(azFloor.condition).toMatch(/must allow/i)

    if (st.size.kind !== 'reserved-to-city') throw new Error('unreachable')
    expect(st.size.detail).toMatch(/NOT a floor/)
    // Arizona is a floor and is expressed as one; Massachusetts is not and isn't.
    expect(az.size.kind).toBe('floors')
    expect(st.size.kind).not.toBe('floors')
  })
})

describe('⚠️ the definitions article carries substance the operative sections do not', () => {
  // Generalised from the Massachusetts § 1A miss: § 3 conferred the right and
  // § 1A defined what the right attached to, so reading only the operative
  // section produced a confident absence. This sweeps the same question across
  // every preempting state.

  it('California: the ADU definition adds no size, but the JADU definition does', () => {
    // § 66313's "accessory dwelling unit" is purely descriptive, so the § 66321
    // floors stand unqualified. But § 66313(d) caps a JUNIOR ADU at 500 sq ft
    // by definition — a figure that appears nowhere in the operative sections
    // the count entry cites.
    const st = aduRulesFor('sf').state
    if (st.kind !== 'preempts') throw new Error('expected preempts')
    const jadu = st.count.find((c) => /JADU/.test(String(c.value)))!
    expect(jadu.condition).toMatch(/500 sq ft/)
    expect(jadu.condition).toMatch(/live in the DEFINITION/)
    expect(jadu.cite).toMatch(/66313\(d\)/)
    // ⚠️ And it is not only the figure. § 66313(d) also requires containment
    // entirely within a single-family residence — a locational condition absent
    // from § 66323(a)(1). Checking whether the definition carried a NUMBER and
    // stopping there would have missed it.
    expect(jadu.condition).toMatch(/contained entirely within a single-family residence/)
  })

  it('⚠️ every California size floor names its measure, and it is not "floor area"', () => {
    // § 66321(b)(2)(A), (B) and (b)(3) each say "interior livable space", not
    // gross or net floor area. The figure without the measure is half a fact.
    const st = aduRulesFor('sf').state
    if (st.kind !== 'preempts' || st.size.kind !== 'floors') throw new Error('expected floors')
    for (const f of st.size.floors) {
      expect(f.form).toBe('figure')
      if (f.form !== 'figure') throw new Error('unreachable')
      expect(f.measure, String(f.value)).toMatch(/interior livable space/)
      expect(f.measure, String(f.value)).toMatch(/66313/)
    }
  })

  it("⚠️ Washington's \"gross floor area\" is a term of art meaning the opposite of the obvious", () => {
    // RCW 36.70A.696(7) DEFINES gross floor area as interior habitable area
    // excluding garages — California's measure under Washington's name. A city
    // using the identical phrase in its ordinary architectural sense is
    // measuring something larger, so the label is actively misleading.
    const st = aduRulesFor('seattle').state
    if (st.kind !== 'preempts' || st.size.kind !== 'floors') throw new Error('expected floors')
    const f = st.size.floors.find((x) => x.baseline)!
    if (f.form !== 'figure') throw new Error('unreachable')
    expect(f.measure).toMatch(/AS DEFINED BY RCW 36\.70A\.696\(7\)/)
    expect(f.measure).toMatch(/interior habitable area/)
    expect(f.measure).toMatch(/excluding a garage/)
  })

  it('⚠️ a cross-measure comparison is DISCLOSED, never silently performed', () => {
    // SF caps in Gross Floor Area; California floors in interior livable space.
    // 850 against 850 is a comparison of labels. No conversion is invented — the
    // equivalence is simply declared unestablished (rules 4 and 12).
    const why = effectiveMaxSize(aduRulesFor('sf')).why
    expect(why).toMatch(/may not be in the same unit/)
    expect(why).toMatch(/Gross Floor Area/)
    expect(why).toMatch(/interior livable space/)
    expect(why).toMatch(/no conversion between them is applied/)
    // ⚠️ And it must not have quietly picked a winner on the strength of it.
    expect(why).not.toMatch(/converted|equivalent to|which equals/)
  })

  it('says nothing where both sides name the same measure', () => {
    // The caveat must not fire indiscriminately, or it becomes noise that a
    // reader learns to skip — and then it is not a warning at all.
    const same = measureCaveatProbe('X', 'X')
    expect(same).toBeNull()
    expect(measureCaveatProbe('X', 'Y')).toMatch(/may not be in the same unit/)
    expect(measureCaveatProbe(undefined, 'Y')).toMatch(/not recorded/)
  })
})

/** Mirrors the module-private helper, so the both-known-and-equal case is
 *  exercised even though no live city currently produces it. */
function measureCaveatProbe(a: string | undefined, b: string | undefined): string | null {
  if (a != null && b != null && a === b) return null
  const named = [a ? `the city measures in ${a}` : 'the city’s measure is not recorded',
                 b ? `the state floor is stated in ${b}` : 'the state’s measure is not recorded']
  return ` ⚠️ These two figures may not be in the same unit — ${named.join(', and ')}. The comparison above rests on an equivalence this tool has not established, and no conversion between them is applied.`
}

describe('⚠️ lot-area figures name their measure, or say they do not', () => {
  it('San José\'s 9,000 sq ft threshold is UNQUALIFIED, and that is recorded', () => {
    // The measure question is not only about the ADU's own size. § 20.80.175.D.1
    // switches the cap between 1,000 and 1,200 sq ft at a 9,000 sq ft lot, and
    // says only "a lot with an area of" / "Lot size" — neither net nor gross.
    // Net and gross differ by easements and rights-of-way, so a lot near the
    // boundary can fall either side depending which is meant.
    const l = aduRulesFor('sanjose').local
    if (l.kind !== 'read') throw new Error('expected read')
    const n = l.notes.find((x) => /9,000 SQ FT LOT THRESHOLD IS UNQUALIFIED/.test(x))!
    expect(n).toMatch(/neither says NET nor GROSS/)
    expect(n).toMatch(/no denominator is assumed/)
    // ⚠️ The forbidden repair, named so nobody performs it later.
    expect(n).toMatch(/Reading "net" across from another city is the invented conversion/)
  })

  it('Phoenix DOES qualify its lot figures, and the difference is visible', () => {
    // Phoenix says "net area" and "net lot area" in terms, so its threshold is
    // resolved where San José's is not. Two cities, same kind of figure,
    // different evidentiary state — and they must not render alike.
    const l = aduRulesFor('phoenix').local
    if (l.kind !== 'read') throw new Error('expected read')
    const b = l.maxSizeSqFt.find((m) => m.kind === 'not-numeric')!
    if (b.kind !== 'not-numeric') throw new Error('unreachable')
    expect(b.rule).toMatch(/net area/)
    expect(b.rule).toMatch(/net lot area/)
  })

  it('every capped local figure either names a measure or is a city not yet swept', () => {
    // rule 20: pinned by membership so a new city cannot slip in unmeasured.
    const withMeasure: string[] = []
    const without: string[] = []
    for (const c of ADU_LOCAL_READ) {
      const l = aduRulesFor(c).local
      if (l.kind !== 'read') continue
      for (const m of l.maxSizeSqFt) {
        if (m.kind !== 'capped') continue
        ;(m.measure ? withMeasure : without).push(c)
      }
    }
    expect([...new Set(withMeasure)].sort()).toEqual(['denver', 'la', 'sanjose', 'sf'])
    // Seattle, San Diego and Phoenix's upper-bound entries are not yet swept for
    // their measure — declared, so the gap is countable rather than invisible.
    expect([...new Set(without)].sort()).toEqual(['austin', 'phoenix', 'sandiego', 'seattle'])
  })
})

describe('Boston — ⚠️ this entry published a WRONG answer, and these pin the fix', () => {
  const rules = aduRulesFor('boston')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ says an ADU IS ALLOWED in East Boston', () => {
    // THE CORRECTION. This entry previously published "forbidden throughout East
    // Boston" — a blocking-direction wrong answer about a real neighbourhood,
    // caught by someone who lives there. § 53-5.2 makes an Additional Dwelling
    // Unit an Allowed Use expressly WHERE IT WOULD OTHERWISE BE FORBIDDEN.
    const n = local.notes.find((x) => /AN ADU IS ALLOWED IN EAST BOSTON/.test(x))!
    expect(n).toMatch(/WHERE IT MAY OTHERWISE BE CONDITIONAL OR FORBIDDEN/)
    expect(n).toMatch(/expressly overridden/)
    expect(local.citation).toMatch(/§ 53-5\.2/)
    // ⚠️ And no note may still assert the retraction.
    for (const x of local.notes) expect(x).not.toMatch(/forbids both forms in every column/)
  })

  it('⚠️ keeps the two defined terms apart, because they have OPPOSITE effects', () => {
    // "Accessory Dwelling Unit" is forbidden in East Boston's tables.
    // "Additional Dwelling Unit" is the instrument that permits the thing an
    // owner would build. Searching for the first and publishing its answer for
    // the second is what went wrong.
    const n = local.notes.find((x) => /TWO DISTINCT DEFINED TERMS/.test(x))!
    expect(n).toMatch(/Accessory Dwelling Unit/)
    expect(n).toMatch(/Additional Dwelling Unit/)
    expect(n).toMatch(/exactly backwards/)
  })

  it('carries the four conditions of the by-right route', () => {
    const n = local.notes.find((x) => /by-right route carries four conditions/.test(x))!
    expect(n).toMatch(/no more than ONE dwelling unit/)
    expect(n).toMatch(/adds Gross Floor Area/)
    expect(n).toMatch(/OWNER-OCCUPIED/)
    expect(n).toMatch(/Rental Registry Ordinance/)
  })

  it('⚠️ the size limit is the EXISTING ENVELOPE, not a figure', () => {
    // The exemption requires the conversion add no Gross Floor Area, so the unit
    // must fit inside what already stands — frequently tighter than any cap, and
    // never expressible as a number. Same shape as SF § 207.1(c)(5).
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind).toBe('not-numeric')
    if (b.kind !== 'not-numeric') throw new Error('unreachable')
    expect(b.rule).toMatch(/EXISTING envelope/)
    expect(b.rule).toMatch(/addition of Gross Floor Area/)
    expect(effectiveMaxSize(rules).value).toBeNull()
  })

  it('⚠️ coverage is ELEVEN districts, not two', () => {
    // The "two of twenty" figure was an artefact of searching the wrong term.
    const n = local.notes.find((x) => /COVERAGE IS FAR WIDER/.test(x))!
    expect(n).toMatch(/ELEVEN/)
    for (const art of ['53', '55', '60', '65', '69']) expect(n).toMatch(new RegExp(`\\b${art}\\b`))
    expect(n).toMatch(/§ 55-45/)
  })

  it('⚠️ scopes the reading to East Boston, and says the other ten are unread', () => {
    const n = local.notes.find((x) => /ONLY EAST BOSTON’S OPERATIVE PROVISION HAS BEEN READ/.test(x))!
    expect(n).toMatch(/NOT opened/)
    expect(n).toMatch(/Section 2-1 definition/)
    expect(n).toMatch(/located sources, not read ones/)
  })

  it('⚠️ records what the positive control could NOT catch', () => {
    // The control proves the search works. It cannot prove the search term is
    // the right one. Every instrument reported healthy while the answer was
    // backwards, which is the part worth carrying forward.
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.note).toMatch(/proves the search works, not that the search term is the right one/)
    expect(local.pending.note).toMatch(/wrong defined term|wrong noun/)
  })
})


describe('⚠️ the vocabulary check — every read city, prompted by East Boston', () => {
  it('covers every city whose ordinance has been read, with none missing', () => {
    // rule 20: pinned by membership, so a city read later without a vocabulary
    // check turns this red instead of slipping through. The East Boston failure
    // is exactly what slipping through looks like.
    expect(Object.keys(ADU_VOCABULARY_CHECK).sort()).toEqual([...ADU_LOCAL_READ].sort())
    expect(ADU_LOCAL_READ.length).toBeGreaterThanOrEqual(9)
  })

  it('every entry names a canonical term and what was checked against it', () => {
    for (const [city, v] of Object.entries(ADU_VOCABULARY_CHECK)) {
      expect(v.canonical.length, city).toBeGreaterThan(15)
      expect(v.competing.length, city).toBeGreaterThan(0)
      expect(v.distinguishedBy.length, city).toBeGreaterThan(60)
    }
  })

  it('⚠️ the kitchen is the dividing line where the code states one', () => {
    // LA and San Diego both define the competing use as having NO kitchen, and
    // an ADU as requiring cooking facilities. That is a criterion a reader can
    // apply to a new city, not a fact about these two.
    for (const city of ['la', 'sandiego']) {
      expect(ADU_VOCABULARY_CHECK[city].distinguishedBy, city).toMatch(/kitchen/i)
    }
    expect(ADU_VOCABULARY_CHECK.la.distinguishedBy).toMatch(/cooking/)
    expect(ADU_VOCABULARY_CHECK.sandiego.distinguishedBy).toMatch(/complete, independent living facilities/)
  })

  it('⚠️ records Boston as the one city NOT resolved by such a test', () => {
    // The exception that motivated the sweep. Everywhere else the code supplies
    // a criterion separating the terms; in Boston they are two live routes with
    // opposite effects, and reading the wrong one published "forbidden" for a
    // neighbourhood where ADUs are allowed.
    const b = ADU_VOCABULARY_CHECK.boston
    expect(b.canonical).toMatch(/Additional Dwelling Unit/)
    expect(b.competing).toContain('Accessory Dwelling Unit')
    expect(b.distinguishedBy).toMatch(/NOT distinguished by any definitional test/)
    expect(b.distinguishedBy).toMatch(/OPPOSITE effects/)
  })

  it('⚠️ records San Diego’s repealed former title, so it is never cited', () => {
    // "Companion Unit" was § 141.0302's own former name, repealed in 2020. The
    // recodification hazard in miniature: the term exists, means the right
    // thing, and points at text that is gone.
    expect(ADU_VOCABULARY_CHECK.sandiego.distinguishedBy).toMatch(/REPEALED former title/)
    expect(ADU_VOCABULARY_CHECK.sandiego.distinguishedBy).toMatch(/O-21254/)
  })

  it('⚠️ LA was checked in BOTH of its zoning codes', () => {
    // LA runs Chapter I and Chapter 1A side by side and a definition in one does
    // not bind the other. Chapter 1A is not on amlegal at all — its text is
    // City-hosted PDFs — so the first pass had never seen it.
    const la = ADU_VOCABULARY_CHECK.la
    expect(la.distinguishedBy).toMatch(/CHECKED IN BOTH CODES/)
    expect(la.distinguishedBy).toMatch(/Chapter 1A Article 5/)
    expect(la.distinguishedBy).toMatch(/the same noun/)
    // And the scope gap it exposed is recorded rather than glossed.
    expect(la.distinguishedBy).toMatch(/13B\.10\.1\.B\.2\(a\)/)
    expect(la.distinguishedBy).toMatch(/have not been read/)
  })

  it('⚠️ SF is recorded as NOT CLOSED, because the § 102 read failed', () => {
    // A partition argument shows the two programmes are exhaustive of ADUs; it
    // does not show that no differently-named use exists. The attempt to read
    // § 102 hit amlegal's window and returned zeros that measure the probe.
    // Saying so beats upgrading the row on a structural argument.
    const sf = ADU_VOCABULARY_CHECK.sf
    expect(sf.distinguishedBy).toMatch(/NOT CLOSED/)
    expect(sf.distinguishedBy).toMatch(/PARTITION IS NOT A VOCABULARY CHECK/)
    expect(sf.distinguishedBy).toMatch(/measure the probe/)
    expect(sf.distinguishedBy).toMatch(/GEOMETRIC rather than numeric/)
  })

  it('⚠️ names what is still unread, rather than implying completeness', () => {
    // San José's Guest House content was not opened — only established as not
    // being the ADU instrument. A sweep that hid its own gaps would be the same
    // failure one level up.
    expect(ADU_VOCABULARY_CHECK.sanjose.distinguishedBy).toMatch(/was not read/)
  })
})

describe('Denver — DZC § 11.8.2, citywide since 2024-12-16', () => {
  const rules = aduRulesFor('denver')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ BOTH instruments were amended — the fork resolves to "both"', () => {
    // Denver runs the DZC and Former Chapter 59 side by side for retained
    // properties, which is the fork rule 27 was written about. The Citywide ADUs
    // measure amended the DZC, the zoning map AND FC59 together, so neither code
    // is the whole answer and neither is stale against the other.
    expect(local.citation).toMatch(/Former Chapter 59/)
    expect(local.citation).toMatch(/2024-12-16/)
  })

  it('⚠️ the SIXTH ratio drafting, and the operator flips back to GREATER', () => {
    // Denver uses the SAME 75% as Arizona and Phoenix, joined to a figure by
    // "whichever is GREATER" where Arizona says "LESS". Opposite effect on a
    // small primary: Arizona's caps below 1,000, Denver's guarantees 864.
    const r = local.maxSizeSqFt.find((m) => m.kind === 'not-numeric')!
    if (r.kind !== 'not-numeric') throw new Error('unreachable')
    expect(r.rule).toMatch(/75%/)
    expect(r.rule).toMatch(/WHICHEVER IS GREATER/)
    expect(r.rule).toMatch(/864 sq ft is guaranteed/)

    // Pinned against Arizona so the two cannot be read as the same rule.
    const az = aduRulesFor('phoenix').state
    if (az.kind !== 'preempts' || az.size.kind !== 'floors') throw new Error('expected floors')
    const azf = az.size.floors.find((f) => f.baseline)!
    if (azf.form !== 'derived') throw new Error('unreachable')
    expect(azf.rule).toMatch(/75%/)
    expect(azf.rule).toMatch(/WHICHEVER IS LESS/i)
  })

  it('carries all four rows of the size table, including an affirmative none', () => {
    // The table's max-GFA column prints "Not applicable" for a detached ADU
    // outside SU districts — the code stating no maximum, not omitting one.
    const caps = local.maxSizeSqFt.filter((m) => m.kind === 'capped')
    expect(caps.map((c) => (c as Extract<typeof c, { kind: 'capped' }>).sqFt)).toEqual([864, 1000])
    expect(local.maxSizeSqFt.some((m) => m.kind === 'no-maximum')).toBe(true)
    const none = local.maxSizeSqFt.find((m) => m.kind === 'no-maximum')!
    if (none.kind !== 'no-maximum') throw new Error('unreachable')
    expect(none.condition).toMatch(/Not applicable/)
    expect(none.condition).toMatch(/DETACHED/)
    // Baseline is the ordinary case, not the most permissive row.
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind).toBe('capped')
    expect(effectiveMaxSize(rules).value).toBe(864)
  })

  it('⚠️ owner occupancy is now only at PERMIT APPLICATION, and says why', () => {
    // The state-law-driven change. Previously an ADU could not be used if the
    // owner moved off; HB24-1152 limits when owner occupancy may be imposed.
    const n = local.notes.find((x) => /OWNER OCCUPANCY IS NOW ONLY AT PERMIT APPLICATION/.test(x))!
    expect(n).toMatch(/not thereafter/)
    expect(n).toMatch(/HB24-1152/)
    expect(n).toMatch(/Denver Housing Authority/)
    expect(n).toMatch(/two of/)
  })

  it('⚠️ records that PUD ADU prohibitions are nullified', () => {
    const n = local.notes.find((x) => /PUD PROHIBITIONS ARE NULLIFIED/.test(x))!
    expect(n).toMatch(/deemed to allow/)
    expect(n).toMatch(/shall not apply/)
    expect(n).toMatch(/Blueprint Denver/)
  })

  it('⚠️ the sixteen deleted districts, and the one still live in the MAP', () => {
    // The measure deleted 16 DZC districts whose only purpose was permitting
    // ADUs. Denver's zoning SERVICE still returns one parcel coded U-SU-B1,
    // captured 2026-08-19 — the code and the map disagree by one parcel.
    const del = local.notes.find((x) => /Sixteen DZC zone districts were DELETED/.test(x))!
    expect(del).toMatch(/rezoned to the corresponding non-1 district/)
    const live = local.notes.find((x) => /STILL LIVE IN THE MAP LAYER/.test(x))!
    expect(live).toMatch(/U-SU-B1/)
    expect(live).toMatch(/2026-08-19/)
    expect(live).toMatch(/right by derivation rather than by knowing the mapping/)
    // ⚠️ And the note must DESCRIBE the resolver call, never write one — the
    // wiring guard scans for the identifier and counted prose as a production
    // caller. Rule 21's shape pointed at a different scanner.
    expect(live).not.toMatch(/resolveDenver\s*\(/)
  })

  it('⚠️ says why the stale code does NOT produce a stale ADU answer', () => {
    // The generalisable half. The "-1" suffix signified exactly one thing —
    // ADU permission — and ADUs are now allowed everywhere, so a parcel still
    // carrying the deleted code gets the same answer either way. A stale
    // district code is not automatically a stale answer; it depends on what the
    // code was carrying.
    const n = local.notes.find((x) => /the mismatch is INERT/.test(x))!
    expect(n).toMatch(/only thing the "-1" suffix ever signified/)
    expect(n).toMatch(/not automatically a stale answer/)
  })

  it('⚠️ names two later amendment bundles it did NOT open', () => {
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.note).toMatch(/were NOT opened/)
    expect(local.pending.note).toMatch(/2025-03-24/)
    expect(local.pending.note).toMatch(/2026-04-20/)
    expect(local.pending.codifiedThrough).toMatch(/2025-02-25/)
  })
})

describe('Miami — Miami 21 § 3.18, and the city that says ANCILLARY', () => {
  const rules = aduRulesFor('miami')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ the vocabulary check found the section a term search would miss', () => {
    // Miami 21 titles it "ANCILLARY Dwelling Unit (ADU) Standards" — a different
    // noun with an identical abbreviation. Searching the California statute's
    // term would have looked healthy and missed it. This is the check the East
    // Boston failure forced, run BEFORE reading rather than after publishing.
    expect(local.citation).toMatch(/Ancillary Dwelling Unit/)
    const v = ADU_VOCABULARY_CHECK.miami
    expect(v.canonical).toMatch(/Ancillary Dwelling Unit/)
    expect(v.competing).toContain('Accessory Dwelling Unit')
    expect(v.distinguishedBy).toMatch(/DIFFERENT NOUN WITH THE SAME ABBREVIATION/)
  })

  it('⚠️ THREE sources offer this code and two are stale — the pick is the risk', () => {
    // Municode's Miami 21 is frozen at 2011-05-29 while its Code of Ordinances is
    // current; miami21.org calls itself historical. Only the City's own Planning
    // page names the current codification. Municode's copy predates the 2025
    // amendment that rewrote this very section.
    if (local.pending.kind !== 'checked') throw new Error('expected checked')
    expect(local.pending.note).toMatch(/THE SOURCE CHOICE IS THE RISK HERE/)
    expect(local.pending.note).toMatch(/2011-05-29/)
    expect(local.pending.note).toMatch(/historical/)
    expect(local.citation).toMatch(/Gridics CodeHub/)
    expect(local.pending.codifiedThrough).toMatch(/14375/)
  })

  it('⚠️ the seventh ratio, and the denominator changes to the LOT', () => {
    // Every earlier ratio was a percentage of the primary dwelling's floor area.
    // Miami's is a percentage of the lot, and both limbs bind — so no figure is
    // publishable without the lot area.
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind).toBe('not-numeric')
    if (b.kind !== 'not-numeric') throw new Error('unreachable')
    expect(b.rule).toMatch(/ten percent of the Lot Area/)
    expect(b.rule).toMatch(/800 sq ft/)
    expect(b.rule).toMatch(/a percentage of the LOT, not of the principal dwelling/)
    expect(effectiveMaxSize(rules).value).toBeNull()
    // Both configurations carried, with the attached one tighter.
    expect(local.maxSizeSqFt).toHaveLength(2)
  })

  it('⚠️ the size figures are NOT in the operative section', () => {
    // § 3.18 says only "Unit Sizes: See Article 6 ... Table 13". Seventh instance
    // of a section read correctly not being the whole rule — and here the code
    // itself points onward, which is the easy case.
    const n = local.notes.find((x) => /SIZE FIGURES ARE NOT IN § 3\.18/.test(x))!
    expect(n).toMatch(/Table 13/)
    expect(n).toMatch(/seventh instance/)
    expect(local.citation).toMatch(/Table 13/)
  })

  it('⚠️ carries MINIMUM unit sizes, which no other city read here states', () => {
    const n = local.notes.find((x) => /MINIMUM UNIT SIZES/.test(x))!
    expect(n).toMatch(/275/); expect(n).toMatch(/450/); expect(n).toMatch(/550/)
    // And says what kind of number they are — not a floor on what must be allowed.
    expect(n).toMatch(/not floors on what the city must allow/)
  })

  it('keeps height in STORIES, never converted', () => {
    // rule 12, and the Miami module already carries the scar: 80 storeys
    // published as 87 by round-tripping through two different ft/storey values.
    expect(local.maxHeightFt).toEqual([])
    expect(local.maxStories?.value).toBe(2)
    expect(local.maxStories?.condition).toMatch(/T3-R/)
    expect(local.maxStories?.condition).toMatch(/no case taller than the Principal Building/)
  })

  it('⚠️ the kitchen criterion, used CONSTITUTIVELY rather than to exclude', () => {
    // LA and San Diego define a competing use by the ABSENCE of a kitchen.
    // Miami uses its presence to define the ADU itself.
    const n = local.notes.find((x) => /KITCHEN CRITERION AGAIN/.test(x))!
    expect(n).toMatch(/shall be deemed an ADU/)
    expect(n).toMatch(/Miami uses its presence to define one/)
  })

  it('⚠️ records the unqualified Lot Area denominator rather than assuming one', () => {
    // "Ten percent of the Lot Area" — net or gross is not stated and Article 1's
    // definition was not read. That denominator decides the cap on every parcel.
    const n = local.notes.find((x) => /does not say whether Lot Area is net or gross/.test(x))!
    expect(n).toMatch(/was NOT read/)
    expect(n).toMatch(/no reading is assumed/)
  })
})

describe('Austin — "Secondary Apartment", and the term shares no acronym', () => {
  const rules = aduRulesFor('austin')
  if (rules.local.kind !== 'read') throw new Error('expected a read local layer')
  const local = rules.local

  it('⚠️ the eight "accessory dwelling unit" hits are ALL the wrong chapter', () => {
    // Every one sits in Chapter 25-3, Traditional Neighborhood District — a niche
    // chapter. The operative article is in Chapter 25-2, the main zoning chapter,
    // under a different noun. Reading the eight and stopping would have produced
    // a rule governing almost no Austin parcel.
    const v = ADU_VOCABULARY_CHECK.austin
    expect(v.canonical).toMatch(/Secondary Apartment/)
    expect(v.distinguishedBy).toMatch(/Chapter 25-3/)
    expect(v.distinguishedBy).toMatch(/Chapter 25-2/)
    // ⚠️ And the part that makes Austin harder than Miami.
    expect(v.distinguishedBy).toMatch(/not even a shared acronym/)
    expect(local.citation).toMatch(/Secondary Apartment/)
  })

  it('⚠️ the eighth ratio, and the first written as a FAR', () => {
    // "1,100 total square feet or a floor-to-area ratio of 0.15, whichever is
    // SMALLER". Miami's shape — a lot-based ratio capped by a figure — but as a
    // FAR. It binds below 1,100 on any lot under roughly 7,333 sq ft, so
    // publishing 1,100 would overstate widely.
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind).toBe('not-numeric')
    if (b.kind !== 'not-numeric') throw new Error('unreachable')
    expect(b.rule).toMatch(/floor-to-area ratio of 0\.15/)
    expect(b.rule).toMatch(/against LOT area/)
    expect(b.rule).toMatch(/7,333/)
    expect(effectiveMaxSize(rules).value).toBeNull()
  })

  it('carries the second-storey cap as a SEPARATE limit, not an alternative', () => {
    // 550 sq ft on the second storey applies on top of the total, not instead of
    // it. Treating it as an alternative would let a two-storey unit read as
    // capped at 550 overall.
    const c = local.maxSizeSqFt.find((m) => m.kind === 'capped')!
    if (c.kind !== 'capped') throw new Error('unreachable')
    expect(c.sqFt).toBe(550)
    expect(c.condition).toMatch(/on top of the total/)
    expect(c.baseline).toBeUndefined()
  })

  it('⚠️ states BOTH feet and storeys, and neither is derived from the other', () => {
    // Unusual in this file — most cities state one. Both are carried as printed
    // (rule 12), so nothing is converted in either direction.
    const h = local.maxHeightFt.find((x) => x.baseline)!
    if (h.form !== 'figure') throw new Error('unreachable')
    expect(h.value).toBe(30)
    expect(local.maxStories?.value).toBe(2)
    expect(local.maxStories?.condition).toMatch(/not derived from it/)
  })

  it('⚠️ DETACHED ONLY — no attached or interior unit under this article', () => {
    const n = local.notes.find((x) => /DETACHED ONLY/.test(x))!
    expect(n).toMatch(/other than the principal structure/)
    expect(n).toMatch(/no attached or interior ADU/)
  })

  it('⚠️ "special use" is a USE CATEGORY, not a discretionary approval track', () => {
    // Closed. § 25-2-1403(B)(6) defines it as one of seven special uses the
    // subchapter establishes, and § 25-2-1462 says it "is permitted" in the
    // listed districts. Nothing read imposes a hearing or discretionary finding.
    const n = local.notes.find((x) => /"SPECIAL USE" RESOLVED/.test(x))!
    expect(n).toMatch(/use of a developed single-family residential lot for a second dwelling/)
    expect(n).toMatch(/is permitted/)
    // ⚠️ And it says what it did NOT establish, rather than claiming the whole.
    expect(n).toMatch(/permitting route itself was not traced/)
  })

  it('⚠️ THE SCOPE CORRECTION — NP combining districts only, not citywide', () => {
    // The article sits in Subchapter D, whose own § 25-2-1401 limits it to
    // property in a neighborhood plan (NP) combining district. A first pass read
    // §§ 25-2-1461 to 1463 correctly and stated the rule citywide — the eighth
    // instance of an operative section treated as the whole of the rule, with the
    // qualifying provision sixty sections earlier in the same subchapter.
    const n = local.notes.find((x) => /NP COMBINING DISTRICTS ONLY/.test(x))!
    expect(n).toMatch(/§ 25-2-1401/)
    expect(n).toMatch(/must satisfy both/)
    // The size entry carries the same limit, so a reader reaching only for the
    // cap still sees where it applies.
    const b = local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline)!
    expect(b.kind === 'not-found' ? '' : b.condition).toMatch(/not a citywide cap/i)
    expect(local.citation).toMatch(/Subchapter D/)
  })

  it('⚠️ names the citywide instrument, and that it is a UNIT-COUNT rule', () => {
    // § 25-2-774 "Two-Family Residential Use" is repealed and RESERVED;
    // § 25-2-773 replaced it and supersedes base district regulations. So
    // Austin's citywide answer runs through unit counts, not accessory dwellings
    // — a different shape from every other city here.
    const n = local.notes.find((x) => /CITYWIDE INSTRUMENT IS A UNIT-COUNT RULE/.test(x))!
    expect(n).toMatch(/25-2-774/)
    expect(n).toMatch(/RESERVED/)
    expect(n).toMatch(/§ 25-2-773/)
    expect(n).toMatch(/supersedes the base zoning district regulations/)
    // ⚠️ And it is recorded as not-read-in-full rather than presented as read.
    const scope = local.notes.find((x) => /RECORDED, NOT READ IN FULL/.test(x))!
    expect(scope).toMatch(/Subsection \(C\) design standards were not read/)
    expect(scope).toMatch(/BY RIGHT in each base district was not established/)
  })
})
