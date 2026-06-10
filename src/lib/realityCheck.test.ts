import { describe, it, expect } from 'vitest'
import { buildRealityCards } from './realityCheck'
import type { AnalysisResult } from '../types/analysis'

// Minimal AnalysisResult factory — only the fields buildRealityCards reads
// matter; everything else is filled with inert defaults.
function makeResult(over: {
  city?: string
  months?: number
  measured?: AnalysisResult['timeline']['measured']
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
    expect(cards[0].soWhat).toContain('usually yes')
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
