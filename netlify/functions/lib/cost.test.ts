import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

const project: AnalysisInput = { parcelId: 'p1', lat: 42.36, lng: -71.06, use: 'residential', gfa: 10000 }
const asOfRight: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
const variance: Feasibility = { overall: 'NEEDS_RELIEF', checks: [], path: 'variance' }

describe('estimateCost', () => {
  it('computes hard cost as gfa x $/sf for the use', () => {
    // residential seed = $350/sf -> 10000*350 = 3,500,000
    expect(estimateCost(project, asOfRight).costs.hard).toBe(3_500_000)
  })

  it('scales hard cost by the city construction index', () => {
    const bos = estimateCost({ ...project, city: 'boston' }, asOfRight).costs.hard
    const nyc = estimateCost({ ...project, city: 'nyc' }, asOfRight).costs.hard
    const chi = estimateCost({ ...project, city: 'chicago' }, asOfRight).costs.hard
    expect(nyc).toBeGreaterThan(bos)
    expect(bos).toBeGreaterThan(chi)
    expect(nyc).toBe(Math.round(10000 * 350 * 1.18))
  })

  it('applies a height premium to taller buildings', () => {
    const low = estimateCost({ ...project, stories: 3 }, asOfRight).costs.hard
    const high = estimateCost({ ...project, stories: 15 }, asOfRight).costs.hard
    expect(high).toBeGreaterThan(low)
    expect(high).toBe(Math.round(10000 * 350 * 1.35))
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

  it('adds a variance filing fee and a longer timeline on the variance path', () => {
    const aor = estimateCost(project, asOfRight)
    const v = estimateCost(project, variance)
    expect(v.costs.permit).toBeGreaterThan(aor.costs.permit)
    expect(v.timeline.months).toBeGreaterThan(aor.timeline.months)
    expect(v.timeline.path).toBe('variance')
  })
})
