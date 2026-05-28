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

  it('computes soft cost as a fraction of hard', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.soft).toBe(Math.round(c.hard * 0.25))
  })

  it('total is hard + soft + permit', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.total).toBe(c.hard + c.soft + c.permit)
  })

  it('adds a variance filing fee and a longer timeline on the variance path', () => {
    const aor = estimateCost(project, asOfRight)
    const v = estimateCost(project, variance)
    expect(v.costs.permit).toBeGreaterThan(aor.costs.permit)
    expect(v.timeline.months).toBeGreaterThan(aor.timeline.months)
    expect(v.timeline.path).toBe('variance')
  })
})
