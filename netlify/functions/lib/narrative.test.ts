import { describe, it, expect } from 'vitest'
import { buildNarrative } from './narrative'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

const parcel = { address: '1 Test St', zoning: { districtCode: 'B-2-65' } } as ParcelInfo
const project = { use: 'commercial', gfa: 15000 } as AnalysisInput
const cost: CostEstimate = {
  costs: { hard: 6_000_000, soft: 1_500_000, permit: 60_100, total: 7_560_100, currency: 'USD' },
  timeline: { months: 4, path: 'as_of_right' },
}

describe('buildNarrative', () => {
  it('states the verdict and the total cost', () => {
    const f: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
    const text = buildNarrative(parcel, project, f, cost)
    expect(text).toMatch(/as-of-right/i)
    expect(text).toContain('$7,560,100')
  })

  it('names blocking constraints when relief is needed', () => {
    const f: Feasibility = {
      overall: 'NEEDS_RELIEF',
      path: 'variance',
      checks: [{ dimension: 'far', status: 'NEEDS_RELIEF', proposed: 'FAR 3.00', allowed: 'max FAR 2.00', note: null }],
    }
    const text = buildNarrative(parcel, project, f, { ...cost, timeline: { months: 12, path: 'variance' } })
    expect(text).toMatch(/relief/i)
    expect(text).toContain('far')
  })

  it('calls out indeterminate dimensions', () => {
    const f: Feasibility = {
      overall: 'INDETERMINATE',
      path: 'as_of_right',
      checks: [{ dimension: 'height', status: 'INDETERMINATE', proposed: 'unspecified', allowed: 'not derivable', note: null }],
    }
    const text = buildNarrative(parcel, project, f, cost)
    expect(text).toMatch(/could not be evaluated/i)
    expect(text).toContain('height')
  })
})
