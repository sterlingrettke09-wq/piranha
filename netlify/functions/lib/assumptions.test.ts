import { describe, it, expect } from 'vitest'
import { costPerSqFtByUse, softCostPct, timelineMonthsByPath, assumptionsSummary, FT_PER_STORY } from './assumptions'

describe('assumptions', () => {
  it('has positive hard-cost rates for every use', () => {
    for (const v of Object.values(costPerSqFtByUse)) expect(v).toBeGreaterThan(0)
  })
  it('soft cost is a fraction between 0 and 1', () => {
    expect(softCostPct).toBeGreaterThan(0)
    expect(softCostPct).toBeLessThan(1)
  })
  it('variance timeline is longer than as-of-right', () => {
    expect(timelineMonthsByPath.variance).toBeGreaterThan(timelineMonthsByPath.as_of_right)
  })
  it('feet-per-story is a sane positive number', () => {
    expect(FT_PER_STORY).toBeGreaterThan(5)
  })
  it('summary returns human-readable strings', () => {
    const s = assumptionsSummary()
    expect(typeof s.softCost).toBe('string')
    expect(Object.keys(s).length).toBeGreaterThan(3)
  })
})
