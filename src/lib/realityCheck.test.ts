import { describe, it, expect } from 'vitest'
import { buildRealityCards } from './realityCheck'
import type { AnalysisResult } from '../types/analysis'

// Minimal AnalysisResult factory — only the fields buildRealityCards reads
// matter; everything else is filled with inert defaults.
function makeResult(over: {
  city?: string
  months?: number
  measured?: AnalysisResult['timeline']['measured']
  measuredTierWithheld?: AnalysisResult['timeline']['measuredTierWithheld']
  reliefOdds?: AnalysisResult['reliefOdds']
} = {}): AnalysisResult {
  return {
    parcel: {
      address: '1 Main St',
      parcelId: 'X',
      districtCode: 'R-1',
      lotSqFt: null,
      allowedUses: null,
      maxFAR: null,
      maxHeightFt: null,
      floodZone: null,
      historicDistrict: null,
    },
    project: {
      parcelId: 'X',
      city: over.city ?? 'boston',
      projectType: 'new',
      funding: 'private',
      lat: 0,
      lng: 0,
      use: 'residential',
      gfa: 10000,
    },
    feasibility: { overall: 'AS_OF_RIGHT', checks: [] },
    ...(over.reliefOdds ? { reliefOdds: over.reliefOdds } : {}),
    hurdles: [],
    costs: { hard: 0, soft: 0, permit: 0, demolition: 0, impact: 0, total: 0, currency: 'USD' },
    timeline: {
      months: over.months ?? 24,
      path: 'as_of_right',
      ...(over.measured ? { measured: over.measured } : {}),
      ...(over.measuredTierWithheld ? { measuredTierWithheld: over.measuredTierWithheld } : {}),
    },
    narrative: '',
    assumptions: {},
    sources: {},
    disclaimers: [],
    generatedAt: '2026-06-10',
  }
}

const MEASURED = { medianMonths: 8, p80Months: 14, n: 320, vintage: '2023–2025' }
const RELIEF = { grantRate: 0.72, n: 410, window: '2022–2025', vintage: '2025' }

describe('buildRealityCards', () => {
  it('measured-only: a parking-less city with measured data yields one card', () => {
    // Use a city with NO parking rule entry so only the measured card shows.
    const cards = buildRealityCards(makeResult({ city: 'nowhere', measured: MEASURED }))
    expect(cards.map((c) => c.id)).toEqual(['measured'])
    expect(cards[0].big).toBe('8 mo')
    expect(cards[0].kicker).toBe('Measured permit time')
    expect(cards[0].sub).toContain('p80 14')
    expect(cards[0].sub).toContain('n=320')
  })

  it('relief-only: relief odds with no measured/parking yields one card', () => {
    const cards = buildRealityCards(makeResult({ city: 'nowhere', reliefOdds: RELIEF }))
    expect(cards.map((c) => c.id)).toEqual(['relief'])
    expect(cards[0].big).toBe('72%')
    expect(cards[0].kicker).toBe('Board approval rate')
    expect(cards[0].sub).toContain('n=410')
    // No label → the variance-only default. Only sound for cities whose track
    // IS variances alone (Boston, SF).
    expect(cards[0].sub).toContain('variance requests')
    expect(cards[0].soWhat).toContain('usually yes')
  })

  it("relief card renders the entry's own denominator label, not the variance default", () => {
    // NYC's BZ calendar mixes §72-21 variances with §73 special permits, and
    // DC's rate is whole-board (variances + special exceptions). For those
    // entries the pipeline ships a `label` naming the real denominator, and the
    // rendered line MUST use it — "variance requests" would be a false claim.
    const cards = buildRealityCards(
      makeResult({
        city: 'nowhere',
        reliefOdds: { ...RELIEF, label: 'variance and special-permit applications' },
      }),
    )
    expect(cards[0].sub).toContain('variance and special-permit applications')
    expect(cards[0].sub).not.toContain('variance requests')
  })

  it('parking-only (abolished): a city that abolished minimums yields a None card', () => {
    const cards = buildRealityCards(makeResult({ city: 'minneapolis' }))
    expect(cards.map((c) => c.id)).toEqual(['parking'])
    expect(cards[0].big).toBe('None')
    expect(cards[0].unit).toBe('required')
    expect(cards[0].soWhat).toContain('1950s code')
  })

  it('parking (partial): a partial city renders a Relaxed card from the detail', () => {
    const cards = buildRealityCards(makeResult({ city: 'boston' }))
    expect(cards.map((c) => c.id)).toEqual(['parking'])
    expect(cards[0].big).toBe('Relaxed')
    expect(cards[0].unit).toBeUndefined()
    // partial uses the rule.detail as the so-what
    expect(cards[0].soWhat.length).toBeGreaterThan(0)
  })

  it('all three: measured + relief + abolished parking → three cards in order', () => {
    const cards = buildRealityCards(
      makeResult({ city: 'minneapolis', measured: MEASURED, reliefOdds: RELIEF }),
    )
    expect(cards.map((c) => c.id)).toEqual(['measured', 'relief', 'parking'])
  })

  it('none: a city with no parking rule and no measured/relief → empty', () => {
    expect(buildRealityCards(makeResult({ city: 'nowhere' }))).toEqual([])
  })

  // ── A withheld tier must READ as absent, not render as nothing ─────────────
  // Denver publishes measured permit timing by building size but suppressed its
  // 2–4 unit tier (sample under the n=30 floor). Before this, the engine served
  // the city-wide 4.5-month aggregate to a duplex; the safe fix (serve nothing)
  // would have made the card silently disappear, which reads exactly like a city
  // we never measured. The card stays, and says which measurement is missing.
  it('a withheld tier renders a "not measured" card, not a blank', () => {
    const cards = buildRealityCards(
      makeResult({
        city: 'nowhere',
        measuredTierWithheld: { tier: 'multi', n: null, minPublishableN: 30 },
      }),
    )
    expect(cards.map((c) => c.id)).toEqual(['measured'])
    expect(cards[0].big).toBe('Not measured')
    expect(cards[0].unit).toContain('2–4 unit')
    expect(cards[0].sub).toContain('n=30')
    expect(cards[0].sub).toContain('not recorded')
    expect(cards[0].soWhat).toContain('different population')
  })

  it('a withheld tier with a recorded n names it', () => {
    const cards = buildRealityCards(
      makeResult({
        city: 'nowhere',
        measuredTierWithheld: { tier: 'apartment', n: 12, minPublishableN: 30 },
      }),
    )
    expect(cards[0].sub).toContain('only n=12')
    expect(cards[0].unit).toContain('5+ unit')
  })

  // ── A city that LOSES its measured figure entirely ────────────────────────
  // Checked when NYC was withdrawn 2026-08-09, and exercised again the same day
  // when Seattle followed (p80 unidentified at 74.71% observed — Seattle's
  // byTier went with it, so it must not degrade into a withheld-tier card
  // either). The two absent-measurement states are different and must stay
  // different:
  //
  //   · tier withheld — the city publishes timing BY BUILDING SIZE and this size
  //     is missing. The card stays and names the missing measurement (above).
  //   · city unmeasured — nothing is published for the city at all. The card is
  //     GONE, because a "Not measured for 5+ unit buildings" card would claim NYC
  //     publishes a per-size breakdown it has never had. Absence of the card is
  //     absence of a claim.
  //
  // The place where absence could read as SPEED is Compare, which puts cities
  // side by side; there the Timeline cell is marked "est" off
  // hasMeasuredPermitTiming(), and NYC now falls on that branch. So the degrade
  // path is: no card here, an explicit marker there — never a bare number that
  // looks measured.
  it('a city with no measurement at all drops the card rather than claiming a size gap', () => {
    const cards = buildRealityCards(makeResult({ city: 'nowhere' }))
    expect(cards.find((c) => c.id === 'measured')).toBeUndefined()
    // And specifically not a "Not measured" card, which would imply a breakdown.
    expect(cards.some((c) => c.big === 'Not measured')).toBe(false)
  })

  // Mutually exclusive by construction in resolveTimeline; asserted here so a
  // future edit can't produce a card that both states a figure and denies one.
  it('a real measurement wins over a withheld record if both ever appear', () => {
    const cards = buildRealityCards(
      makeResult({
        city: 'nowhere',
        measured: MEASURED,
        measuredTierWithheld: { tier: 'multi', n: null, minPublishableN: 30 },
      }),
    )
    expect(cards).toHaveLength(1)
    expect(cards[0].big).toBe('8 mo')
  })

  // so-what thresholds: quick (<25%), major (>50%), neutral in between.
  it('so-what: median at 24% of total reads "quick"', () => {
    const cards = buildRealityCards(
      makeResult({ city: 'nowhere', months: 100, measured: { ...MEASURED, medianMonths: 24 } }),
    )
    expect(cards[0].soWhat).toContain('Permits here are quick')
  })

  it('so-what: median at 26% of total reads neutral', () => {
    const cards = buildRealityCards(
      makeResult({ city: 'nowhere', months: 100, measured: { ...MEASURED, medianMonths: 26 } }),
    )
    expect(cards[0].soWhat).toContain('Permit queue is 26 of the ~100')
  })

  it('so-what: median at 49% of total reads neutral', () => {
    const cards = buildRealityCards(
      makeResult({ city: 'nowhere', months: 100, measured: { ...MEASURED, medianMonths: 49 } }),
    )
    expect(cards[0].soWhat).toContain('Permit queue is 49 of the ~100')
  })

  it('so-what: median at 51% of total reads "major part"', () => {
    const cards = buildRealityCards(
      makeResult({ city: 'nowhere', months: 100, measured: { ...MEASURED, medianMonths: 51 } }),
    )
    expect(cards[0].soWhat).toContain('major part of this timeline')
  })
})
