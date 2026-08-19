import { describe, it, expect } from 'vitest'
import { aduAuthorityFor, summariseAdu, ADU_CITIES_READ } from './adu'
import { CITIES } from '../../../../src/config/cities'

describe('which body of law governs', () => {
  it('routes California cities to state law, not the municipal code', () => {
    // The first place this tool reads a source ABOVE the city. Getting it wrong
    // produces a confident number from the wrong instrument.
    for (const c of ['la', 'sf', 'sanjose', 'sandiego']) {
      const a = aduAuthorityFor(c)
      expect(a.kind, c).toBe('state-floor')
      if (a.kind !== 'state-floor') continue
      expect(a.state).toBe('California')
    }
  })

  it('routes Seattle to Washington state law', () => {
    const a = aduAuthorityFor('seattle')
    expect(a.kind).toBe('state-floor')
    if (a.kind === 'state-floor') expect(a.state).toBe('Washington')
  })

  it('⚠️ says nobody has looked, rather than that the city has no rules', () => {
    // rule 5. "Denver has no ADU rules" would be a finding; nobody has looked.
    const a = aduAuthorityFor('denver')
    expect(a.kind).toBe('not-established')
    if (a.kind !== 'not-established') return
    expect(a.detail).toMatch(/not a finding that Denver has no ADU rules/)
    expect(a.detail).toMatch(/nobody has looked/)
  })

  it('covers every live city explicitly, with no silent default', () => {
    // rule 20: a city missing from the map would fall through, and silence here
    // would render as "no state law applies" — which is a claim.
    const live = CITIES.filter((c) => c.live).map((c) => c.slug)
    expect(live.length).toBeGreaterThan(20)
    for (const slug of live) {
      const a = aduAuthorityFor(slug)
      expect(['state-floor', 'local', 'not-established'], slug).toContain(a.kind)
    }
    // And the read set is pinned, so coverage is a measurement.
    expect([...ADU_CITIES_READ]).toEqual(['la', 'sandiego', 'sanjose', 'seattle', 'sf'])
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
    const s = summariseAdu(aduAuthorityFor('sf'))
    expect(s).toMatch(/Unconditionally: a 850 sq ft ADU at 16 ft/)
    expect(s).not.toMatch(/1,000 sq ft ADU at 25 ft/)
    // The conditioned floors are still surfaced, not dropped.
    expect(s).toMatch(/further floors apply in specific cases/)
  })

  it('every dimension list has exactly one baseline, or summarising throws', () => {
    // A list with no baseline used to fall back to the largest entry, silently.
    for (const c of ADU_CITIES_READ) {
      const a = aduAuthorityFor(c)
      if (a.kind === 'not-established') continue
      expect(a.floors.sizeSqFt.filter((f) => f.baseline), c).toHaveLength(1)
      expect(a.floors.heightFt.filter((f) => f.baseline), c).toHaveLength(1)
    }
  })

  it('says so in the summary, in the same sentence as the numbers', () => {
    // The distinction this feature most easily gets wrong. California forbids a
    // city capping an ADU below 850 sq ft; it does not stop the city allowing
    // 1,200. Reporting 850 as "the answer" UNDERSTATES what is buildable, and an
    // understatement in the right units reads as authoritative (rule 18).
    const s = summariseAdu(aduAuthorityFor('sf'))
    expect(s).toMatch(/FLOORS rather than limits/)
    expect(s).toMatch(/the city may permit more/)
    expect(s).toMatch(/has not read whether it does/)
  })

  it('never phrases a floor as a maximum', () => {
    for (const c of ADU_CITIES_READ) {
      const s = summariseAdu(aduAuthorityFor(c))
      expect(s, c).not.toMatch(/maximum of|at most|no larger than|cannot exceed/)
    }
  })
})

describe('California, as read from the statute', () => {
  const a = aduAuthorityFor('sf')
  if (a.kind !== 'state-floor') throw new Error('setup')

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
  const a = aduAuthorityFor('seattle')
  if (a.kind !== 'state-floor') throw new Error('setup')

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
    for (const c of ADU_CITIES_READ) {
      const a = aduAuthorityFor(c)
      if (a.kind === 'not-established') throw new Error(`${c} should be read`)
      expect(a.citation.length, c).toBeGreaterThan(20)
      expect(a.readOn, c).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const f of [...a.floors.sizeSqFt, ...a.floors.heightFt, ...a.floors.count]) {
        expect(f.cite.length, `${c} ${String(f.value)}`).toBeGreaterThan(4)
        expect(f.condition.length, `${c} ${String(f.value)}`).toBeGreaterThan(10)
      }
    }
  })
})
