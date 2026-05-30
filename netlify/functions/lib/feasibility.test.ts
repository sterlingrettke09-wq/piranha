import { describe, it, expect } from 'vitest'
import { assessFeasibility } from './feasibility'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'

const parcel = (over: Partial<ParcelInfo['zoning']> = {}, lotSize: number | null = 10000): ParcelInfo => ({
  address: '1 Test St', parcelId: 'p1', coordinates: [-71.06, 42.36],
  zoning: { districtCode: 'B-2-65', subdistrict: null, article: null, maxHeightFt: null, maxFAR: null, allowedUses: null, ...over },
  lot: { sizeSqFt: lotSize, lotType: null },
  overlays: { historicDistrict: null, floodZone: null },
  sources: {}, fetchedAt: '2026-05-28T00:00:00Z',
})
const project = (over: Partial<AnalysisInput> = {}): AnalysisInput =>
  ({ parcelId: 'p1', lat: 42.36, lng: -71.06, use: 'commercial', gfa: 15000, heightFt: 50, ...over })

describe('assessFeasibility', () => {
  it('is as-of-right when use allowed, FAR and height within limits', () => {
    // B-2-65 -> maxFAR 2.0, maxHeight 65, uses include commercial. 15000/10000 = FAR 1.5, 50ft.
    const r = assessFeasibility(parcel(), project())
    expect(r.overall).toBe('AS_OF_RIGHT')
    expect(r.path).toBe('as_of_right')
  })

  it('prohibits demolishing an established multifamily building for fewer units', () => {
    const p: ParcelInfo = {
      ...parcel(),
      existing: { landUse: 'Multi-family elevator buildings', units: 49 },
    }
    const r = assessFeasibility(
      p,
      project({ use: 'residential', gfa: 4000, units: 1, projectType: 'new', heightFt: 30 }),
    )
    expect(r.checks.find((c) => c.dimension === 'housing')?.status).toBe('PROHIBITED')
    expect(r.overall).toBe('PROHIBITED')
  })

  it('does not flag housing loss on a vacant lot', () => {
    const r = assessFeasibility(
      parcel(),
      project({ use: 'residential', gfa: 4000, units: 1, projectType: 'new', heightFt: 30 }),
    )
    expect(r.checks.find((c) => c.dimension === 'housing')).toBeUndefined()
  })

  it('marks the envelope unknown when FAR and height cannot be evaluated', () => {
    const r = assessFeasibility(parcel({ districtCode: 'Unknown' }), project())
    expect(r.envelopeKnown).toBe(false)
  })

  it('marks the envelope known when FAR or height is decisive', () => {
    const r = assessFeasibility(parcel(), project())
    expect(r.envelopeKnown).toBe(true)
  })

  it('needs relief when FAR exceeds the district limit', () => {
    const r = assessFeasibility(parcel(), project({ gfa: 30000 })) // FAR 3.0 > 2.0
    expect(r.overall).toBe('NEEDS_RELIEF')
    expect(r.path).toBe('variance')
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('NEEDS_RELIEF')
  })

  it('needs relief when height exceeds the district limit', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: 90 })) // > 65
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('NEEDS_RELIEF')
    expect(r.overall).toBe('NEEDS_RELIEF')
  })

  it('is PROHIBITED when FAR grossly exceeds the limit (beyond a variance)', () => {
    // lot 10000, maxFAR 2.0 → max ~20000 sf. 100000 sf = FAR 10 = 5× the limit.
    const r = assessFeasibility(parcel(), project({ gfa: 100000 }))
    const far = r.checks.find((c) => c.dimension === 'far')
    expect(far?.status).toBe('PROHIBITED')
    expect(r.overall).toBe('PROHIBITED')
    expect(r.path).toBe('prohibited')
  })

  it('is PROHIBITED when height grossly exceeds the limit', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: 200 })) // 200 vs 65 = ~3×
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('PROHIBITED')
    expect(r.overall).toBe('PROHIBITED')
  })

  it('still only needs relief at a modest overage (≤1.5×)', () => {
    const r = assessFeasibility(parcel(), project({ gfa: 28000 })) // FAR 2.8 = 1.4× of 2.0
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('NEEDS_RELIEF')
  })

  it('flags use needing relief when not in the allowed list', () => {
    const r = assessFeasibility(parcel({ districtCode: 'R-1' }), project({ use: 'commercial', gfa: 5000, heightFt: 30 }))
    expect(r.checks.find((c) => c.dimension === 'use')?.status).toBe('NEEDS_RELIEF')
  })

  it('is indeterminate when district is unknown', () => {
    const r = assessFeasibility(parcel({ districtCode: 'Unknown' }), project())
    expect(r.overall).toBe('INDETERMINATE')
    expect(r.path).toBe('as_of_right')
  })

  it('derives height from stories when heightFt is absent', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: undefined, stories: 7 })) // 7*11=77 > 65
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('NEEDS_RELIEF')
  })

  it('is indeterminate on FAR when lot size is missing', () => {
    const r = assessFeasibility(parcel({}, null), project())
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('INDETERMINATE')
  })
})
