import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import { costPerSqFtByUse, cityCostIndex, heightCostFactor } from '../../../src/config/estimates'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

const RES = costPerSqFtByUse.residential // national $/sf, sourced

const project: AnalysisInput = { parcelId: 'p1', lat: 42.36, lng: -71.06, use: 'residential', gfa: 10000 }
const asOfRight: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
const variance: Feasibility = { overall: 'NEEDS_RELIEF', checks: [], path: 'variance' }

describe('estimateCost', () => {
  it('computes hard cost as gfa x $/sf for the use', () => {
    expect(estimateCost(project, asOfRight).costs.hard).toBe(10_000 * RES)
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
    expect(high).toBe(Math.round(10000 * RES * heightCostFactor(15)))
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
