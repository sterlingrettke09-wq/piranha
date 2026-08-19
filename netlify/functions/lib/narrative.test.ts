import { describe, it, expect } from 'vitest'
import { buildNarrative } from './narrative'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

// Real fixtures, not `{ address, zoning } as ParcelInfo`. The cast made the two
// objects inert: a misspelled field was accepted silently, so nothing here was
// checked against the types it claims to be. Same move as timeline.test.ts's
// Feasibility fixture below.
const parcel: ParcelInfo = {
  address: '1 Test St',
  addressBasis: 'record',
  parcelId: 'p1',
  coordinates: [-71.06, 42.36],
  zoning: {
    districtCode: 'B-2-65',
    subdistrict: null,
    article: null,
    maxHeightFt: null,
    maxFAR: null,
    allowedUses: null,
  },
  lot: { sizeSqFt: null, lotType: null },
  overlays: { historicDistrict: null, floodZone: null },
  sources: {},
  fetchedAt: '2026-08-10T00:00:00.000Z',
}
const project: AnalysisInput = {
  parcelId: 'p1',
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  lat: 42.36,
  lng: -71.06,
  use: 'commercial',
  gfa: 15000,
}
// The `total` is SUMMED from the lines rather than hand-written. It used to be a
// hand-written 7,560,100 with no `impact` line at all — the fixture went stale
// when estimateCost grew one (cost.ts:81-88 folds impact into total) and nothing
// forced the update, because buildNarrative never reads `impact` and no
// typechecker covered this file. Deriving it makes the two impossible to
// disagree.
// Annotated rather than `as const`: the assertion pinned the literal types but
// checked nothing against CostEstimate, and the object is SPREAD into `cost`
// below — where a spread is not excess-property checked either. The annotation
// is what makes a renamed or misspelled cost line a compile error here.
const costLines: Omit<CostEstimate['costs'], 'total'> = {
  hard: 6_000_000,
  soft: 1_500_000,
  permit: 60_100,
  demolition: 0,
  impact: 0,
  currency: 'USD',
}
const cost: CostEstimate = {
  costs: {
    ...costLines,
    total: costLines.hard! + costLines.soft! + costLines.permit! + costLines.demolition + costLines.impact!,
  },
  timeline: { months: 4, path: 'as_of_right' },
}

describe('buildNarrative', () => {
  it('states the verdict and the total cost', () => {
    const f: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
    const text = buildNarrative(parcel, project, f, cost)
    expect(text).toMatch(/without special permission/i)
    expect(text).toContain('$7,560,100')
  })

  it('names blocking constraints when relief is needed', () => {
    const f: Feasibility = {
      overall: 'NEEDS_RELIEF',
      path: 'variance',
      checks: [{ dimension: 'far', status: 'NEEDS_RELIEF', proposed: 'FAR 3.00', allowed: 'max FAR 2.00', note: null }],
    }
    const text = buildNarrative(parcel, project, f, { ...cost, timeline: { months: 12, path: 'variance' } })
    expect(text).toMatch(/permission/i)
    // Friendly label, not the raw "far" enum token.
    expect(text).toMatch(/floor-area ratio \(FAR\)/)
  })

  it('reports the full life-cycle timeline, not the base permit time', () => {
    const f: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
    const demoCost: CostEstimate = {
      ...cost,
      costs: { ...cost.costs, demolition: 800_000, total: cost.costs.total! + 800_000 },
    }
    const text = buildNarrative(parcel, { ...project, projectType: 'new' }, f, demoCost, {
      timelineMonths: 26,
      includesDemolition: true,
    })
    expect(text).toContain('26 months')
    expect(text).not.toContain('4 months')
    expect(text).toMatch(/design to move-in/i)
    expect(text).toMatch(/demolish/i)
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
