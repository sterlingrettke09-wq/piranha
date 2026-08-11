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
// city/projectType/funding are REQUIRED by AnalysisInput and were absent here —
// the factory's return annotation was the only thing claiming otherwise, and
// nothing typechecked this file. They are stated at the values the omission was
// silently relying on: resolveZoningLimits defaults its `city` parameter to
// 'boston' (zoningLimits.ts:62), which is what made the B-2-65 family
// heuristics fire, and assessFeasibility's housing/historic branches test
// `projectType === 'new'`.
const project = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  parcelId: 'p1',
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  lat: 42.36,
  lng: -71.06,
  use: 'commercial',
  gfa: 15000,
  heightFt: 50,
  ...over,
})

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

  it('needs relief to demolish in a historic district (existing building + new construction)', () => {
    const p: ParcelInfo = {
      ...parcel(),
      overlays: { historicDistrict: 'Historic Beacon Hill District', floodZone: null },
      existing: { landUse: 'Single-family residential', yearBuilt: 1899 },
    }
    const r = assessFeasibility(p, project({ use: 'residential', gfa: 5000, units: 4, projectType: 'new', heightFt: 40 }))
    const historic = r.checks.find((c) => c.dimension === 'historic')
    expect(historic?.status).toBe('NEEDS_RELIEF')
    expect(r.overall).toBe('NEEDS_RELIEF')
  })

  it('does not fire the historic check on a vacant lot in a historic district', () => {
    const p: ParcelInfo = {
      ...parcel(),
      overlays: { historicDistrict: 'Historic Beacon Hill District', floodZone: null },
    }
    const r = assessFeasibility(p, project({ use: 'residential', gfa: 5000, units: 4, projectType: 'new', heightFt: 40 }))
    expect(r.checks.find((c) => c.dimension === 'historic')).toBeUndefined()
  })

  it('does not fire the historic check for an addition (renovation review is lighter)', () => {
    const p: ParcelInfo = {
      ...parcel(),
      overlays: { historicDistrict: 'Historic Beacon Hill District', floodZone: null },
      existing: { landUse: 'Single-family residential', yearBuilt: 1899 },
    }
    const r = assessFeasibility(p, project({ use: 'residential', gfa: 5000, units: 4, projectType: 'addition', heightFt: 40 }))
    expect(r.checks.find((c) => c.dimension === 'historic')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Districts whose code states a STORY count and no height in feet.
//
// Raleigh's mixed-use designations -7 and above are the live case (UDO
// Sec. 3.3.2: row A1 states 7/12/20/30/40 stories, row A2 — feet — is blank
// from -7 up). Before these branches existed, DX-7-SH and DX-40-SH printed
// "No district height limit is available in public data", asserting the city
// publishes nothing about height for a district whose limit the ordinance
// states outright, and reported envelopeKnown:false alongside it.
describe('assessFeasibility — districts regulated in stories, not feet', () => {
  const storiesOnly = (maxStories: number) =>
    parcel({ districtCode: 'DX-7-SH', maxHeightFt: null, maxFAR: null, maxStories, allowedUses: ['residential', 'commercial', 'mixed'] })

  it('checks stories against stories when the code states stories', () => {
    const r = assessFeasibility(storiesOnly(7), project({ heightFt: undefined, stories: 6 }))
    const h = r.checks.find((c) => c.dimension === 'height')!
    expect(h.status).toBe('AS_OF_RIGHT')
    expect(h.proposed).toBe('6 stories')
    expect(h.allowed).toBe('max 7 stories')
  })

  it('carries the STORY count through untouched — no ft/story conversion anywhere', () => {
    // The regression this pins is CLAUDE.md rule 12: Miami published 87 stories
    // for a district whose code says 80, because one constant multiplied and a
    // different one divided. If anyone reintroduces a conversion to reuse the
    // feet branch, the numbers below stop being 40 and 40.
    const r = assessFeasibility(storiesOnly(40), project({ heightFt: undefined, stories: 40 }))
    const h = r.checks.find((c) => c.dimension === 'height')!
    expect(h.status).toBe('AS_OF_RIGHT') // exactly at the limit, not over
    expect(h.proposed).toBe('40 stories')
    expect(h.allowed).toBe('max 40 stories')
    // And nothing in the rendered check may be denominated in feet.
    expect(`${h.proposed} ${h.allowed} ${h.note ?? ''}`).not.toMatch(/\bft\b|feet/)
  })

  it('needs relief modestly over the story limit, and is prohibited far over', () => {
    expect(
      assessFeasibility(storiesOnly(7), project({ heightFt: undefined, stories: 10 })).checks
        .find((c) => c.dimension === 'height')?.status,
    ).toBe('NEEDS_RELIEF')
    expect(
      assessFeasibility(storiesOnly(7), project({ heightFt: undefined, stories: 30 })).checks
        .find((c) => c.dimension === 'height')?.status,
    ).toBe('PROHIBITED')
  })

  it('does NOT claim the city publishes no limit when it publishes stories', () => {
    // Proposal in feet, limit in stories: undecidable, but for a stated reason.
    // The old copy said the data was missing. It is not — it is in another unit.
    const r = assessFeasibility(storiesOnly(7), project({ heightFt: 120, stories: undefined }))
    const h = r.checks.find((c) => c.dimension === 'height')!
    expect(h.status).toBe('INDETERMINATE')
    expect(h.allowed).toBe('max 7 stories')
    expect(h.note).not.toMatch(/No district height limit is available/)
    expect(h.note).toMatch(/stated in STORIES/)
  })

  it('still reports a genuine gap as a gap when nothing is on record', () => {
    const r = assessFeasibility(
      parcel({ districtCode: 'Unknown', maxHeightFt: null, maxFAR: null }),
      project({ heightFt: 120 }),
    )
    const h = r.checks.find((c) => c.dimension === 'height')!
    expect(h.allowed).toBe('not derivable')
    expect(h.note).toMatch(/No district height limit is available/)
  })

  it('counts a stated story limit as a known envelope', () => {
    // FAR unconstrained + no feet + 7 stories stated is still a published limit.
    expect(assessFeasibility(storiesOnly(7), project({ heightFt: undefined, stories: 6 })).envelopeKnown).toBe(true)
  })
})
