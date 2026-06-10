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

  it('needs relief when FAR modestly exceeds the district limit (≤1.2×)', () => {
    const r = assessFeasibility(parcel(), project({ gfa: 22000 })) // FAR 2.2 = 1.1× of 2.0
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

  it('is PROHIBITED when FAR exceeds ~1.2× (a density bump beyond variance reach)', () => {
    const r = assessFeasibility(parcel(), project({ gfa: 28000 })) // FAR 2.8 = 1.4× of 2.0
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('PROHIBITED')
  })

  it('still allows a height variance up to ~1.5×', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: 90 })) // 90 vs 65 = ~1.38×
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('NEEDS_RELIEF')
  })

  it('PROHIBITS a use with no adjacency to anything allowed (commercial in pure residential)', () => {
    // WO-5.4: use variances are the hardest relief to get (banned in several
    // states) — a flat-out use conflict must score WORSE than a FAR overage,
    // not the old blanket NEEDS_RELIEF.
    const r = assessFeasibility(parcel({ districtCode: 'R-1' }), project({ use: 'commercial', gfa: 5000, heightFt: 30 }))
    expect(r.checks.find((c) => c.dimension === 'use')?.status).toBe('PROHIBITED')
  })

  it('keeps an ADJACENT use at NEEDS_RELIEF (mixed proposed where residential is allowed)', () => {
    const r = assessFeasibility(parcel({ districtCode: 'R-1' }), project({ use: 'mixed', gfa: 5000, heightFt: 30, units: 4 }))
    expect(r.checks.find((c) => c.dimension === 'use')?.status).toBe('NEEDS_RELIEF')
  })

  it('caps the verdict at INDETERMINATE for a tall proposal with no height limit on record (WO-5.2)', () => {
    // B-2 resolves FAR/uses from the family letter but has no height token:
    // use + FAR pass, height is unknown, and the proposal is 600 ft.
    const r = assessFeasibility(parcel({ districtCode: 'B-2' }), project({ gfa: 5000, heightFt: 600 }))
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('INDETERMINATE')
    expect(r.overall).toBe('INDETERMINATE')
  })

  it('does NOT punish modest heights when the limit is unknown (WO-5.2)', () => {
    const r = assessFeasibility(parcel({ districtCode: 'B-2' }), project({ gfa: 5000, heightFt: 30 }))
    expect(r.overall).toBe('AS_OF_RIGHT')
  })

  it('asks for a unit count instead of firing no-net-loss off a blank field (WO-5.3)', () => {
    const p: ParcelInfo = { ...parcel(), existing: { landUse: 'Apartment building', units: 12 } }
    const r = assessFeasibility(p, project({ use: 'residential', gfa: 20000, units: undefined, projectType: 'new', heightFt: 30 }))
    const housing = r.checks.find((c) => c.dimension === 'housing')
    expect(housing?.status).toBe('INDETERMINATE')
    expect(r.overall).not.toBe('PROHIBITED')
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
