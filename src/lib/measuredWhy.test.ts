import { describe, it, expect } from 'vitest'
import { estimatedWhy } from '../lib/measuredWhy'
import { CITIES, hasCitySpecificHurdles } from '../config/cities'
import type { AnalysisResult } from '../types/analysis'

const withTimeline = (t: Partial<AnalysisResult['timeline']>): AnalysisResult =>
  ({ timeline: { months: 24, path: 'as_of_right', ...t } }) as AnalysisResult

describe('⚠️ Compare marks permit timing by PROJECT, not by city', () => {
  it('⚠️ the reason is derived from the engine’s own reason code', () => {
    // The old copy named exactly two causes and joined them "either … or". That
    // closed disjunction was already wrong: Milwaukee's 5+ unit tier is absent
    // because the feed cannot separate it, which is neither of the two.
    const thin = estimatedWhy(
      withTimeline({
        measuredTierWithheld: { tier: 'multi', basis: 'thin-sample', n: 12, minPublishableN: 30 },
      }),
    )
    expect(thin).toMatch(/2–4 unit buildings/)
    expect(thin).toMatch(/only n=12/)
    expect(thin).toMatch(/under the n=30 floor/)

    const unenum = estimatedWhy(
      withTimeline({
        measuredTierWithheld: {
          tier: 'apartment',
          basis: 'unenumerable',
          reason: 'every 5+ unit building is filed as commercial new construction.',
        },
      }),
    )
    expect(unenum).toMatch(/5\+ unit buildings/)
    expect(unenum).toMatch(/cannot be separated at all/)
    expect(unenum).toMatch(/commercial new construction/)

    // ⚠️ The three must not share copy — a sentence true of one basis is false
    // of the next, which is how the original single sentence went wrong.
    const generic = estimatedWhy(withTimeline({}))
    expect(new Set([thin, unenum, generic]).size).toBe(3)
  })

  it('⚠️ the fallback stays OPEN — it never enumerates the causes', () => {
    // A closed list of reasons is a completeness claim about our own pipeline,
    // and it goes stale the first time a withholding reason is added. Milwaukee
    // was the third cause; there may be a fourth.
    const generic = estimatedWhy(withTimeline({}))
    expect(generic).not.toMatch(/either/i)
    expect(generic).not.toMatch(/no application date/i)
    expect(generic).not.toMatch(/withdrawn/i)
    expect(generic).toMatch(/No filing-to-issuance figure is published for this city and this building size/)
  })

  it('every arm says the figure is not comparable to a measured one', () => {
    for (const t of [
      withTimeline({}),
      withTimeline({ measuredTierWithheld: { tier: 'multi', basis: 'thin-sample', n: null, minPublishableN: 30 } }),
      withTimeline({ measuredTierWithheld: { tier: 'apartment', basis: 'unenumerable', reason: 'x' } }),
    ]) {
      expect(estimatedWhy(t)).toMatch(/not comparable to a city showing a measured figure/)
    }
  })

  it('⚠️ an unrecorded suppressed sample says so instead of guessing a number', () => {
    const s = estimatedWhy(
      withTimeline({ measuredTierWithheld: { tier: 'multi', basis: 'thin-sample', n: null, minPublishableN: 30 } }),
    )
    expect(s).toMatch(/too small a sample/)
    expect(s).not.toMatch(/n=null|n=0\b/)
  })
})

describe('⚠️ the deleted “partial” branch — its precondition is pinned', () => {
  it('every registry city has city-specific hurdles encoded', () => {
    // Compare used to render "City-specific requirements are not yet encoded for
    // this city" for a city outside the list. All 23 registry cities are now in
    // it, so that branch could not fire for any real parcel — and an unreachable
    // branch is a claim nobody re-checks. It was deleted rather than left.
    //
    // This is what makes the deletion safe: if a city is ever added WITHOUT
    // hurdles, the suite goes red here rather than the product silently showing
    // an unmarked floor as if it were a complete count.
    const missing = CITIES.map((c) => c.slug).filter((s) => !hasCitySpecificHurdles(s))
    expect(
      missing,
      'A city has no city-specific hurdles. Compare no longer marks that state — ' +
        'restore a marker there before adding the city, or the count renders as complete.',
    ).toEqual([])
    // rule 20: pinned over a non-empty registry, so this cannot pass by there
    // being no cities.
    expect(CITIES.length).toBe(23)
  })
})
