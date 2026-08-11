import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import { costPerSqFtByUse, cityCostIndex, heightCostFactor, MIXED_RESIDENTIAL_SHARE } from '../../../src/config/estimates'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

const RES = costPerSqFtByUse.residential // national $/sf, sourced

// The base fixture carries a REAL city, because production always has one:
// analyze.ts resolves `city` as `q.city ?? 'boston'`, so no request reaches
// estimateCost without a slug. This fixture used to omit `city` entirely (the
// type requires it; nothing typechecked this file), which made every
// expectation below run at `cityCostIndex[undefined] ?? 1.0` — an index no
// production request can produce. Boston's 1.14 is now carried explicitly in
// the expectations rather than silently assumed away.
const CITY = 'boston'
const IDX = cityCostIndex[CITY]

const project: AnalysisInput = {
  parcelId: 'p1',
  city: CITY,
  projectType: 'new',
  funding: 'private',
  lat: 42.36,
  lng: -71.06,
  use: 'residential',
  gfa: 10000,
}
const asOfRight: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
const variance: Feasibility = { overall: 'NEEDS_RELIEF', checks: [], path: 'variance' }

describe('estimateCost', () => {
  it('computes hard cost as gfa x $/sf for the use', () => {
    expect(estimateCost(project, asOfRight).costs.hard).toBe(Math.round(10_000 * RES * IDX))
  })

  it('scales hard cost by the city construction index', () => {
    const bos = estimateCost({ ...project, city: 'boston' }, asOfRight).costs.hard
    const nyc = estimateCost({ ...project, city: 'nyc' }, asOfRight).costs.hard
    const chi = estimateCost({ ...project, city: 'chicago' }, asOfRight).costs.hard
    const dc = estimateCost({ ...project, city: 'dc' }, asOfRight).costs.hard
    // Per the RSMeans City Cost Index: NYC > Chicago (unionized trades) > Boston,
    // and DC's construction is below the national average (cheap labor pool).
    expect(nyc).toBeGreaterThan(chi)
    expect(chi).toBeGreaterThan(bos)
    expect(bos).toBeGreaterThan(dc)
    expect(nyc).toBe(Math.round(10000 * RES * cityCostIndex.nyc))
    expect(chi).toBe(Math.round(10000 * RES * cityCostIndex.chicago))
  })

  it('applies a height premium to taller buildings', () => {
    const low = estimateCost({ ...project, stories: 3 }, asOfRight).costs.hard
    const high = estimateCost({ ...project, stories: 15 }, asOfRight).costs.hard
    expect(high).toBeGreaterThan(low)
    expect(high).toBe(Math.round(10000 * RES * IDX * heightCostFactor(15)))
  })

  it('computes soft cost as a fraction of hard', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.soft).toBe(Math.round(c.hard * 0.25))
  })

  it('total is hard + soft + permit', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.demolition).toBe(0)
    expect(c.total).toBe(c.hard + c.soft + c.permit + c.demolition)
  })

  it('adds a demolition cost scaled to the existing building being torn down', () => {
    const noDemo = estimateCost(project, asOfRight)
    const withDemo = estimateCost(project, asOfRight, { demolitionSqFt: 20000 })
    expect(noDemo.costs.demolition).toBe(0)
    expect(withDemo.costs.demolition).toBeGreaterThan(0)
    expect(withDemo.costs.total).toBe(
      withDemo.costs.hard + withDemo.costs.soft + withDemo.costs.permit + withDemo.costs.demolition,
    )
    expect(withDemo.costs.total).toBeGreaterThan(noDemo.costs.total)
  })

  it('prices renovations & changes-of-use below an identical ground-up build', () => {
    const base = estimateCost({ ...project, projectType: 'new' }, asOfRight).costs.hard
    for (const pt of ['change_of_use', 'addition'] as const) {
      const scoped = estimateCost({ ...project, projectType: pt }, asOfRight).costs.hard
      expect(scoped).toBeLessThan(base)
    }
  })

  it('prices an ADU at per-sf parity with new build (NOT a discount)', () => {
    // Terner Center: ADUs run ~$250/sf — equal-or-more than a house per sf,
    // because fixed costs (foundation, utilities, kitchen/bath) hit a tiny area.
    const base = estimateCost({ ...project, projectType: 'new' }, asOfRight).costs.hard
    const adu = estimateCost({ ...project, projectType: 'adu' }, asOfRight).costs.hard
    expect(adu).toBe(base)
  })

  it('adds a variance filing fee and a longer timeline on the variance path', () => {
    const aor = estimateCost(project, asOfRight)
    const v = estimateCost(project, variance)
    expect(v.costs.permit).toBeGreaterThan(aor.costs.permit)
    expect(v.timeline.months).toBeGreaterThan(aor.timeline.months)
    expect(v.timeline.path).toBe('variance')
  })
})

// WO-5.6: the demo rate interpolates linearly between (5k sf, $10) and
// (20k sf, $18) — the old step tiers made one square foot at the 20k boundary
// worth $120,000, an instant credibility hit with any real developer.
describe('demolition rate (interpolated)', () => {
  const demoRate = (sf: number) => {
    const c = estimateCost(project, asOfRight, { demolitionSqFt: sf }).costs.demolition
    return c / sf / IDX // demolition is scaled by the city index too — divide it back out
  }
  it('small (≤5,000 sf) teardowns run $10/sf', () => {
    expect(demoRate(4_999)).toBeCloseTo(10, 2)
    expect(demoRate(5_000)).toBeCloseTo(10, 2)
  })
  it('interpolates between the bounds (12,500 sf → $14/sf)', () => {
    expect(demoRate(12_500)).toBeCloseTo(14, 2)
  })
  it('large (≥20,000 sf) runs $18/sf with no boundary cliff', () => {
    expect(demoRate(20_000)).toBeCloseTo(18, 2)
    const below = estimateCost(project, asOfRight, { demolitionSqFt: 19_999 }).costs.demolition
    const above = estimateCost(project, asOfRight, { demolitionSqFt: 20_000 }).costs.demolition
    expect(above - below).toBeLessThan(100) // continuous, not a $120k step
  })
})

describe('impact fees per city', () => {
  const at = (over: Partial<AnalysisInput>, opts?: { feeArea?: string }) =>
    estimateCost({ ...project, ...over }, asOfRight, opts ?? {})

  it('Boston: commercial ≥50k sf pays linkage; smaller and residential do not', () => {
    expect(at({ city: 'boston', use: 'commercial', gfa: 50_000 }).costs.impact).toBe(
      Math.round(23.09 * 50_000),
    )
    expect(at({ city: 'boston', use: 'commercial', gfa: 49_999 }).costs.impact).toBe(0)
    expect(at({ city: 'boston', use: 'residential', gfa: 80_000 }).costs.impact).toBe(0)
  })

  it('LA: residential always pays the Medium-tier rate; nonres only at ≥15k sf', () => {
    // AHLF flattened to the published Medium market-area rate (eff. 7/1/2025):
    // residential $12.90/sf, nonresidential $5.16/sf.
    expect(at({ city: 'la', use: 'residential', gfa: 10_000 }).costs.impact).toBe(Math.round(12.9 * 10_000))
    expect(at({ city: 'la', use: 'commercial', gfa: 15_000 }).costs.impact).toBe(Math.round(5.16 * 15_000))
    expect(at({ city: 'la', use: 'commercial', gfa: 14_999 }).costs.impact).toBe(0)
  })

  it('Denver: residential <10 units pays $5.12/sf; 10+ units pays none (inclusionary mandate); commercial varies by EHA area', () => {
    // Rates per the Denver CPD EHA schedule effective 7/1/2026 (annual CPI-U).
    expect(at({ city: 'denver', use: 'residential', gfa: 8_000, units: 4 }).costs.impact).toBe(Math.round(5.12 * 8_000))
    expect(at({ city: 'denver', use: 'residential', gfa: 80_000, units: 60 }).costs.impact).toBe(0)
    // WO-5.6: units omitted → tier unknowable → informational note, not a charge.
    const unknown = at({ city: 'denver', use: 'residential', gfa: 8_000 })
    expect(unknown.costs.impact).toBe(0)
    expect(unknown.impactNote).toMatch(/unit count needed/)
    expect(at({ city: 'denver', use: 'commercial', gfa: 10_000 }, { feeArea: 'High' }).costs.impact).toBe(Math.round(9.21 * 10_000))
    expect(at({ city: 'denver', use: 'commercial', gfa: 10_000 }, { feeArea: 'Typical' }).costs.impact).toBe(Math.round(6.14 * 10_000))
  })

  it('Philadelphia: mandatory 1% Development Impact Tax on residential construction', () => {
    // Phila. Code Ch. 19-4400 — 1% of construction cost, residential only,
    // over $15,000 of value. Asserted as a RELATIONSHIP to hard cost so the
    // expectation survives future cost-index tuning.
    const res = at({ city: 'philadelphia', use: 'residential', gfa: 6_000, units: 4 })
    expect(res.costs.impact).toBe(Math.round(res.costs.hard * 0.01))
    expect(res.impactNote).toMatch(/Development Impact Tax/i)

    // Non-residential is exempt.
    const com = at({ city: 'philadelphia', use: 'commercial', gfa: 40_000 })
    expect(com.costs.impact).toBe(0)

    // Mixed-use is taxed on the residential share only, not the whole building.
    const mix = at({ city: 'philadelphia', use: 'mixed', gfa: 40_000, units: 30 })
    expect(mix.costs.impact).toBe(Math.round(mix.costs.hard * MIXED_RESIDENTIAL_SHARE * 0.01))

    // Below the $15,000 construction-value floor, no tax.
    const tiny = at({ city: 'philadelphia', use: 'residential', gfa: 20 })
    expect(tiny.costs.impact).toBe(0)
  })

  it('Seattle and SF fees are informational (applied:false): note set, $0 in total', () => {
    const sea = at({ city: 'seattle', use: 'residential', gfa: 20_000 }, { feeArea: 'High Areas' })
    expect(sea.costs.impact).toBe(0)
    expect(sea.impactNote).toMatch(/Seattle MHA/)
    const sf = at({ city: 'sf', use: 'commercial', gfa: 60_000 })
    expect(sf.costs.impact).toBe(0)
    if (sf.impactNote) expect(sf.impactNote).toMatch(/not included/)
  })

  it('cities with no codified fee produce neither a charge nor a note', () => {
    const chi = at({ city: 'chicago', use: 'residential', gfa: 20_000 })
    expect(chi.costs.impact).toBe(0)
    expect(chi.impactNote).toBeUndefined()
  })
})
