import { describe, it, expect } from 'vitest'
import {
  aduRulesFor, summariseAdu, effectiveMaxSize, ADU_LOCAL_READ, ADU_STATE_PREEMPTED,
} from './adu'
import { CITIES } from '../../../../src/config/cities'

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
    expect([...ADU_LOCAL_READ]).toEqual(['sandiego'])
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
    const s = summariseAdu(aduRulesFor('sf'))
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
    const s = summariseAdu(aduRulesFor('sf'))
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
    expect(e.source).toBe('local-no-maximum')
    expect(e.value).toBeNull()
    expect(e.why).toMatch(/§ 141\.0302\(a\)\(7\)\(C\)/)
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
    const e = effectiveMaxSize(aduRulesFor('sf'))
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
    const e = effectiveMaxSize(sd)
    expect(e.source).toBe('local-no-maximum')
  })
})
