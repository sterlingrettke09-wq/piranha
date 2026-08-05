import { describe, it, expect } from 'vitest'
import { storyFor } from './cityStories'
import { computeRedTapeIndex, type RankedCity } from './redTapeIndex'
import { cityName } from '../config/cities'

const ranked = computeRedTapeIndex()
const byCity = (slug: string): RankedCity => {
  const c = ranked.find((r) => r.slug === slug)
  if (!c) throw new Error(`no ranked city ${slug}`)
  return c
}

describe('storyFor', () => {
  it('produces a non-empty plain string for every city, no throws', () => {
    for (const c of ranked) {
      const story = storyFor(c, ranked)
      expect(typeof story).toBe('string')
      expect(story.length).toBeGreaterThan(40)
      // House voice: no exclamation marks anywhere.
      expect(story).not.toContain('!')
      // The city's own name leads or appears in its story.
      expect(story).toContain(cityName(c.slug))
    }
  })

  // ── Branch 1: MEASURED permit time leads ─────────────────────────────────
  it('leads with the measured permit median (Chicago — the fastest)', () => {
    const chicago = byCity('chicago')
    const story = storyFor(chicago, ranked)
    // Chicago's median is 1 month → "about a month", and it holds the floor.
    expect(chicago.measuredMedianMonths).toBe(1)
    expect(story).toContain('about a month')
    expect(story).toContain('the fastest we measure')
    // The real relief adder (3 months) is interpolated, not invented.
    expect(story).toContain('3 months')
  })

  // SF held "the slowest we measure" only because it WAS the slowest city we had
  // data for. Measuring Miami (12.1 mo) in 2026-08 took that title, and the copy
  // correctly stopped claiming it. The superlative is computed from the measured
  // set, so it moves whenever the set grows — a test asserting it belongs to one
  // named city is pinning a fact about our COVERAGE, not about San Francisco.
  it('reports SF from its measurement and no longer claims a superlative it lost', () => {
    const sf = byCity('sf')
    const story = storyFor(sf, ranked)
    // SF median 11.8 → rounds to "about 12 months".
    expect(story).toContain('about 12 months')
    expect(story).not.toContain('the slowest we measure')
    // SF relief adder is 12 months.
    expect(sf.reliefAddMonths).toBe(12)
    expect(story).toContain('12 months')
  })

  it('renders a measured median with no superlative for the middle (LA)', () => {
    const la = byCity('la')
    const story = storyFor(la, ranked)
    expect(story).toContain('about 6 months')
    expect(story).not.toContain('we measure') // not an extreme
  })

  // ── Branch 2: RELIEF grant rate (says-yes angle) ─────────────────────────
  it('uses the says-yes angle with the real grant rate (Boston, 93%)', () => {
    const boston = byCity('boston')
    // Boston has no measured permit median, so the relief branch wins.
    expect(boston.measuredMedianMonths).toBeNull()
    expect(boston.reliefGrantRate).not.toBeNull()
    const story = storyFor(boston, ranked)
    expect(story).toContain('93%')
    expect(story).toContain('says yes')
    // The real by-right lifecycle (44 months) is interpolated.
    expect(story).toContain('about 44 months')
  })

  // ── Branch 3: ABOLISHED parking (tailwind angle) ─────────────────────────
  it('uses the parking tailwind for abolished cities without measured data (Minneapolis)', () => {
    const mpls = byCity('minneapolis')
    expect(mpls.measuredMedianMonths).toBeNull()
    expect(mpls.reliefGrantRate).toBeNull()
    expect(mpls.parkingStatus).toBe('abolished')
    const story = storyFor(mpls, ranked)
    expect(story).toContain('abolished parking minimums')
    // Lifecycle (38) and lifecycle+relief (41) both interpolated.
    expect(story).toContain('about 38 months')
    expect(story).toContain('about 41 months')
  })

  // ── Branch 4: FALLBACK from lifecycle months alone ───────────────────────
  it('falls back to the lifecycle line for a city with no extras (DC)', () => {
    const dc = byCity('dc')
    // DC: no measured permit data, no relief stat, partial (not abolished) parking.
    expect(dc.measuredMedianMonths).toBeNull()
    expect(dc.reliefGrantRate).toBeNull()
    expect(dc.parkingStatus).not.toBe('abolished')
    const story = storyFor(dc, ranked)
    expect(story).toContain('about 40 months')
    expect(story).toContain('land, not the labor')
    // The real variance adder (5 months) is interpolated.
    expect(story).toContain('5 months')
  })

  // Was "falls back for NYC" and asserted the 54-month LIFECYCLE estimate, because
  // NYC had no measured permit data. It does now — median 8.3 mo over n=4,394 DOB
  // NOW initial New Building filings — so the story reports a measurement instead
  // of an estimate. The assertion changed because the underlying claim changed
  // from "we guess" to "we counted".
  it('reports NYC from measured permit data rather than the lifecycle estimate', () => {
    const nyc = byCity('nyc')
    const story = storyFor(nyc, ranked)
    expect(story).toContain('about 8 months')
    expect(story).not.toContain('about 54 months')
    expect(story).toContain('7 months')
  })

  // ── No fabrication: a synthetic bare city still works ─────────────────────
  it('handles a city with no extras at all without inventing numbers', () => {
    const bare: RankedCity = {
      ...byCity('dc'),
      slug: 'dc',
      measuredMedianMonths: null,
      measuredPermitN: null,
      reliefGrantRate: null,
      reliefN: null,
      parkingStatus: 'partial',
      lifecycleMonths: 40,
      reliefAddMonths: 5,
    }
    const story = storyFor(bare, [bare])
    expect(story).toContain('about 40 months')
    expect(story).not.toContain('NaN')
    expect(story).not.toContain('undefined')
  })

  it('never emits NaN or undefined for any real city', () => {
    for (const c of ranked) {
      const story = storyFor(c, ranked)
      expect(story).not.toContain('NaN')
      expect(story).not.toContain('undefined')
      expect(story).not.toContain('null')
    }
  })
})
