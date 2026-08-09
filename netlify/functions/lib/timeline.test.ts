import { describe, it, expect } from 'vitest'
import { resolveTimeline, buildingTier, measuredFor, measuredTierWithheldFor } from './timeline'
import type { Feasibility } from './feasibility'
import type { AnalysisInput } from '../../src/types/analysis'
import { CITIES_WITH_MEASURED_PERMITS, hasMeasuredPermitTiming } from '../../../src/config/cities'

const project = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  parcelId: 'T1',
  lat: 42.34,
  lng: -71.07,
  use: 'commercial',
  gfa: 15_000,
  ...over,
})

const feas = (path: Feasibility['path']) => ({ path }) as Feasibility

describe('buildingTier', () => {
  it('commercial and institutional are always apartment-tier', () => {
    expect(buildingTier(project({ use: 'commercial' }))).toBe('apartment')
    expect(buildingTier(project({ use: 'institutional' }))).toBe('apartment')
  })
  it('residential tiers by unit count; mixed defaults to multi', () => {
    expect(buildingTier(project({ use: 'residential', units: 1 }))).toBe('single')
    expect(buildingTier(project({ use: 'residential', units: 3 }))).toBe('multi')
    expect(buildingTier(project({ use: 'residential', units: 6 }))).toBe('apartment')
    expect(buildingTier(project({ use: 'mixed' }))).toBe('multi') // units default 3
  })
})

describe('resolveTimeline', () => {
  it('prohibited path → 0 months', () => {
    const t = resolveTimeline('boston', project(), feas('prohibited'), false)
    expect(t.months).toBe(0)
  })

  it('Boston apartment-tier new build on a cleared lot = the lifecycle baseline (44)', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), false)
    expect(t.months).toBe(44)
    expect(t.includesDemolition).toBe(false)
  })

  it('a teardown adds the per-city demolition phase (+3 in Boston)', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), true)
    expect(t.months).toBe(47)
    expect(t.includesDemolition).toBe(true)
  })

  it('large teardowns add scaled months above 50k sf', () => {
    // (150,000 − 50,000) / 100,000 × 3 = 3 extra
    const t = resolveTimeline('boston', project(), feas('by-right'), true, 150_000)
    expect(t.months).toBe(50)
  })

  it('the large-teardown adder caps at 18 months', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), true, 1_000_000)
    expect(t.months).toBe(44 + 3 + 18)
  })

  it('demolition months are NOT added for addition/renovation projects', () => {
    const t = resolveTimeline('boston', project({ projectType: 'addition', use: 'residential', units: 3 }), feas('by-right'), true)
    // boston multi 28 × 0.65 = 18.2 → 18; hasExistingBuilding true but projectType ≠ new
    expect(t.months).toBe(18)
    expect(t.includesDemolition).toBe(false)
  })

  it('unknown city falls back to the generic lifecycle table', () => {
    const t = resolveTimeline('atlantis', project(), feas('by-right'), false)
    expect(t.months).toBe(40) // fallback apartment tier
  })

  it('discretionary/variance time is NOT added here (analyze.ts owns it)', () => {
    const byRight = resolveTimeline('boston', project(), feas('by-right'), false)
    const variance = resolveTimeline('boston', project(), feas('variance'), false)
    expect(variance.months).toBe(byRight.months)
    expect(variance.path).toBe('variance')
  })
})

describe('measured permit timing', () => {
  // SF + Seattle landed real data from their open portals (see scripts/permits).
  // Assert SHAPE, not exact numbers — the figures refresh quarterly and the test
  // must survive a re-run of the pipeline.
  const expectMeasuredShape = (m: unknown) => {
    expect(m).toBeDefined()
    const v = m as { medianMonths: number; p80Months: number; n: number; vintage: string }
    expect(typeof v.medianMonths).toBe('number')
    expect(typeof v.p80Months).toBe('number')
    expect(v.p80Months).toBeGreaterThanOrEqual(v.medianMonths)
    expect(v.n).toBeGreaterThanOrEqual(30)
    expect(typeof v.vintage).toBe('string')
    expect(v.vintage.length).toBeGreaterThan(0)
  }

  it('a city present in permitStats → measured is populated for a new build', () => {
    const t = resolveTimeline('miami', project({ city: 'miami' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  // ⚠️ SF WITHDRAWN 2026-08-06 — only 37.7% of its new-construction filings carry
  // an issue date at extract, so an unconditional median time-to-issuance does not
  // exist: the 50th percentile is past the last observation. A floor label cannot
  // rescue an undefined statistic. Asserted so it cannot be reinstated by a stale
  // script. State the SHARE, not the FATE — the feed does not distinguish a
  // not-yet from a never, so "ever issue" is retracted phrasing (2026-08-08), and
  // the median is undefined under either reading.
  it('SF resolves to no measurement — most of its filings carry no issue date', () => {
    const t = resolveTimeline('sf', project({ city: 'sf' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('Seattle (also present) → measured is populated', () => {
    const t = resolveTimeline('seattle', project({ city: 'seattle' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  // ⚠️ WITHDRAWN 2026-08-05. Chicago and LA were measured and published, then an
  // adversarial audit disqualified both. Chicago: 46% of the sample was a 2022-23
  // cohort stamped applied==issued (51.6% zero-day), roughly halving the median.
  // LA: 45.4% of the cohort carries no issue date at extract, so only 54.6% is
  // observed and the p80 of 13.0 months is undefined, not merely imprecise. These
  // assert the ABSENCE so the old figures cannot be silently reinstated from the
  // stale scripts.
  it('Chicago is withdrawn — a backfill artifact halved its median', () => {
    const t = resolveTimeline('chicago', project({ city: 'chicago' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('Austin (landed via austin.mjs) → measured is populated', () => {
    const t = resolveTimeline('austin', project({ city: 'austin' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Los Angeles is withdrawn — 45% of its cohort has no issue date', () => {
    const t = resolveTimeline('la', project({ city: 'la' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('a city absent from permitStats → measured is undefined', () => {
    // 'atlantis' is not a real city and will never be in the artifact.
    const t = resolveTimeline('atlantis', project({ city: 'atlantis' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('an addition/renovation never gets a measured permit line, even for a present city', () => {
    const t = resolveTimeline(
      'sf',
      project({ city: 'sf', projectType: 'addition', use: 'residential', units: 3 }),
      feas('by-right'),
      false,
    )
    expect(t.measured).toBeUndefined()
  })

  it('measured is carried through on the prohibited path too (UI gates on months, not measured)', () => {
    const t = resolveTimeline('miami', project({ city: 'miami' }), feas('prohibited'), false)
    expect(t.months).toBe(0)
    // present + new → measured still resolved; the component only renders it when months > 0.
    expectMeasuredShape(t.measured)
  })

  it('measuredFor mirrors the artifact: present cities resolve, unknown cities do not', () => {
    expect(measuredFor('miami')).toBeDefined()
    expect(measuredFor('atlantis')).toBeUndefined()
  })
})

// Rule 14: the coverage claim shown to users must be impossible to falsify by
// forgetting to update it. CITIES_WITH_MEASURED_PERMITS drives Compare's
// "estimated" marker; if a twelfth city is measured and the list is not updated,
// that city keeps being labelled an estimate — and the reverse omission would
// label an unmeasured city as measured, which is worse.
describe('the published measured-permit coverage list matches the data', () => {
  it('equals exactly the cities carrying a newConstruction measurement', async () => {
    const stats = (await import('./data/permitStats.json')).default as Record<
      string,
      { newConstruction?: unknown } | undefined
    >
    const measured = Object.entries(stats)
      .filter(([, v]) => v?.newConstruction)
      .map(([k]) => k)
      .sort()
    expect(measured).toEqual([...CITIES_WITH_MEASURED_PERMITS].sort())
  })

  // These four publish only issue-side dates. If one of them ever appears in
  // permitStats.json, either the city started publishing an application date
  // (good — update the list) or something substituted a wrong pair of dates.
  it.each(['boston', 'dc', 'minneapolis', 'sanjose'])(
    '%s has no measured timing — its city publishes no application date',
    (city) => {
      expect(hasMeasuredPermitTiming(city)).toBe(false)
    },
  )
})

// Austin's new-construction population is 77% single-family houses at 1.6 months
// and 13% apartment-tier at 8.6 — a 5x spread that a single 2.1-month city median
// hid completely. Someone testing a multifamily parcel was shown the
// single-family number. These pin the tier selection so that cannot come back.
describe('measuredFor prefers the tier-specific figure over the city aggregate', () => {
  it('an apartment-tier Austin project gets the apartment measurement, not the aggregate', () => {
    const agg = measuredFor('austin')
    const apt = measuredFor('austin', 'apartment')
    expect(apt).toBeDefined()
    expect(apt!.medianMonths).toBeGreaterThan(agg!.medianMonths)
    // The whole point: they must not be the same number.
    expect(apt!.medianMonths).not.toBe(agg!.medianMonths)
  })

  it('tiers are ordered single < multi < apartment', () => {
    const s = measuredFor('austin', 'single')!
    const m = measuredFor('austin', 'multi')!
    const a = measuredFor('austin', 'apartment')!
    expect(s.medianMonths).toBeLessThan(m.medianMonths)
    expect(m.medianMonths).toBeLessThan(a.medianMonths)
  })

  // A city with no breakdown must still resolve — the aggregate is the fallback,
  // not the default. Philadelphia's script computes no tier split at all, so its
  // aggregate spans all three tiers and answering with it is disclosed.
  it('falls back to the aggregate where no tier breakdown was ATTEMPTED', () => {
    expect(measuredFor('philadelphia', 'apartment')).toEqual(measuredFor('philadelphia'))
  })

  // ⚠️ THE FAIL-OPEN THIS FILE EXISTS TO PREVENT. Denver's `multi` tier was
  // computed and withheld for a thin sample, and the old fallback answered a
  // duplex query with the 4.5-month city aggregate — 3,505 single-family rows,
  // 628 apartment rows, the untiered residential rows and the whole commercial
  // layer, fewer than 30 of which are 2–4 unit buildings.
  it('a SUPPRESSED tier resolves to nothing — never to the city aggregate', () => {
    expect(measuredFor('denver', 'multi')).toBeUndefined()
    // The city itself is still measured, and its published tiers still resolve.
    expect(measuredFor('denver')).toBeDefined()
    expect(measuredFor('denver', 'single')).toBeDefined()
    expect(measuredFor('denver', 'apartment')).toBeDefined()
  })

  it('a Denver duplex gets no measured figure but a stated reason', () => {
    const t = resolveTimeline(
      'denver',
      project({ city: 'denver', use: 'residential', units: 2 }),
      feas('by-right'),
      false,
    )
    expect(t.tier).toBe('multi')
    expect(t.measured).toBeUndefined()
    expect(t.measuredTierWithheld).toEqual({ tier: 'multi', n: null, minPublishableN: 30 })
  })

  it('a published tier carries no withheld record — the two are mutually exclusive', () => {
    const t = resolveTimeline(
      'denver',
      project({ city: 'denver', use: 'residential', units: 1 }),
      feas('by-right'),
      false,
    )
    expect(t.measured).toBeDefined()
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  it('an unmeasured city gets no withheld record either — that would imply a measurement', () => {
    const t = resolveTimeline('atlantis', project({ city: 'atlantis' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  it('an unknown city resolves to nothing under any tier', () => {
    expect(measuredFor('atlantis', 'apartment')).toBeUndefined()
  })

  // Every published tier figure must carry a real sample. The script omits any
  // tier under n=30 rather than publishing a thin median.
  it.each(['single', 'multi', 'apartment'] as const)('the %s tier carries n >= 30', (tier) => {
    expect(measuredFor('austin', tier)!.n).toBeGreaterThanOrEqual(30)
  })
})

// ── Rule 14: make the defect CLASS impossible, not just this instance ────────
// Denver's `multi` tier was suppressed for a thin sample and the suppression left
// no trace in permitStats.json, so nothing — not the type checker, not the suite,
// not a reader of the artifact — could tell it apart from a city that never
// computed a breakdown at all. Both rendered as "no byTier entry", and the
// aggregate was served for both.
//
// So every city × tier pair must now land in exactly one of three declared
// states. A future city that suppresses a tier silently fails HERE, in the suite,
// before it can serve an aggregate to a tier its population barely contains.
describe('every city × tier is measured, aggregate-covered, or explicitly suppressed', () => {
  const TIERS = ['single', 'multi', 'apartment'] as const

  type Entry = {
    newConstruction?: { n: number }
    byTier?: Partial<Record<(typeof TIERS)[number], { n: number }>>
    tierBreakdown?: {
      attempted: boolean
      minPublishableN?: number
      reason?: string
      suppressed?: Partial<Record<(typeof TIERS)[number], { n: number | null; reason: string }>>
    }
  }

  const load = async () =>
    (await import('./data/permitStats.json')).default as unknown as Record<string, Entry>

  it('every city declares whether a tier breakdown was attempted', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      expect(entry.tierBreakdown, `${city} must declare tierBreakdown`).toBeDefined()
      expect(typeof entry.tierBreakdown!.attempted, `${city}.tierBreakdown.attempted`).toBe('boolean')
    }
  })

  it('every tier of every city is measured, covered by an unattempted breakdown, or marked suppressed', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      const tb = entry.tierBreakdown!
      for (const tier of TIERS) {
        const state =
          entry.byTier?.[tier] ? 'measured'
          : !tb.attempted ? 'aggregate-covers-all-tiers'
          : tb.suppressed?.[tier] ? 'suppressed'
          : 'UNDECLARED'
        expect(
          state,
          `${city}.${tier} is undeclared: the breakdown was attempted, the tier is absent from ` +
            `byTier, and nothing in tierBreakdown.suppressed says why. Emit the suppression ` +
            `record (scripts/permits/lib/tierFloor.mjs) instead of dropping the tier silently.`,
        ).not.toBe('UNDECLARED')
      }
    }
  })

  it('a suppressed tier records a floor and a reason, and its n is a number or an explicit null', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      const tb = entry.tierBreakdown!
      for (const [tier, record] of Object.entries(tb.suppressed ?? {})) {
        expect(tb.minPublishableN, `${city}.${tier} suppressed without a floor`).toBeTypeOf('number')
        expect(record.reason.length, `${city}.${tier} suppressed without a reason`).toBeGreaterThan(0)
        // null means "never recorded" — an unknown, deliberately not filled in.
        if (record.n !== null) {
          expect(record.n, `${city}.${tier}`).toBeLessThan(tb.minPublishableN!)
        }
      }
    }
  })

  // The behavioural half: the declaration must actually govern what is served.
  it('measuredFor() serves the aggregate ONLY where no breakdown was attempted', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      for (const tier of TIERS) {
        const got = measuredFor(city, tier)
        if (entry.byTier?.[tier]) {
          expect(got, `${city}.${tier}`).toEqual(entry.byTier[tier])
        } else if (entry.tierBreakdown!.attempted) {
          expect(got, `${city}.${tier} must fail closed`).toBeUndefined()
        } else {
          expect(got, `${city}.${tier}`).toEqual(entry.newConstruction)
        }
      }
    }
  })

  // A withheld tier must be EXPLAINABLE to the user, not merely absent — the
  // result page renders "not measured for this size" off this record.
  it('every withheld tier produces a renderable reason', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      if (!entry.tierBreakdown!.attempted) continue
      for (const tier of TIERS) {
        if (entry.byTier?.[tier]) continue
        const withheld = measuredTierWithheldFor(city, tier)
        expect(withheld, `${city}.${tier}`).toBeDefined()
        expect(withheld!.minPublishableN).toBeGreaterThan(0)
      }
    }
  })
})
