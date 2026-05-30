import { describe, it, expect } from 'vitest'
import { assessHurdles } from './hurdles'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'

function parcel(over: Partial<ParcelInfo>): ParcelInfo {
  return {
    address: '1 Test St',
    parcelId: '1',
    coordinates: [-71.07, 42.358],
    zoning: { districtCode: 'H-2-65', subdistrict: null, article: null, maxHeightFt: 65, maxFAR: 2, allowedUses: ['residential'] },
    lot: { sizeSqFt: 2000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-05-29T00:00:00Z',
    ...over,
  }
}

function project(over: Partial<AnalysisInput>): AnalysisInput {
  return { parcelId: '1', city: 'boston', lat: 42.358, lng: -71.07, use: 'residential', gfa: 8000, ...over }
}

const cats = (hs: ReturnType<typeof assessHurdles>) => hs.map((h) => h.category)

describe('assessHurdles — Boston', () => {
  it('flags historic design review when in a historic district', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: 'Historic Beacon Hill District', floodZone: null } }), project({}))
    expect(cats(hs)).toContain('historic')
    expect(hs.find((h) => h.category === 'historic')?.status).toBe('required')
  })

  it('flags IDP inclusionary for 10+ residential units', () => {
    const hs = assessHurdles('boston', parcel({}), project({ use: 'residential', units: 40 }))
    expect(cats(hs)).toContain('affordability')
  })

  it('does NOT flag IDP for a small (under-10-unit) project', () => {
    const hs = assessHurdles('boston', parcel({}), project({ use: 'residential', units: 4 }))
    expect(cats(hs)).not.toContain('affordability')
  })

  it('flags Article 80 large-project review at 50k+ sf', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 60000 }))
    expect(cats(hs)).toContain('review')
  })

  it('always includes a private deed/HOA info note', () => {
    const hs = assessHurdles('boston', parcel({}), project({}))
    expect(cats(hs)).toContain('private')
  })

  it('escalates the private note to "likely" at Louisburg Square', () => {
    const hs = assessHurdles('boston', parcel({ coordinates: [-71.0699, 42.3586] }), project({ lat: 42.3586, lng: -71.0699 }))
    const priv = hs.find((h) => h.category === 'private')
    expect(priv?.status).toBe('likely')
    expect(priv?.label.toLowerCase()).toContain('square')
  })

  it('flags FEMA flood when in a real flood zone', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: null, floodZone: 'AE' } }), project({}))
    expect(cats(hs)).toContain('flood')
  })

  it('does not flag flood for minimal-hazard zone X', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: null, floodZone: 'X' } }), project({}))
    expect(cats(hs)).not.toContain('flood')
  })
})

describe('assessHurdles — other cities', () => {
  it('NYC: MIH for 10+ units, ULURP + CEQR for large projects', () => {
    const hs = assessHurdles('nyc', parcel({}), project({ city: 'nyc', units: 40, gfa: 60000 }))
    const labels = hs.map((h) => h.label).join(' | ')
    expect(labels).toMatch(/Mandatory Inclusionary/)
    expect(labels).toMatch(/ULURP/)
    expect(cats(hs)).toContain('environmental')
  })

  it('SF: inclusionary + CEQA always flagged', () => {
    const hs = assessHurdles('sf', parcel({}), project({ city: 'sf', units: 20 }))
    expect(cats(hs)).toContain('affordability')
    expect(hs.some((h) => /CEQA/.test(h.label))).toBe(true)
  })

  it('Chicago: ARO for 10+ residential units', () => {
    const hs = assessHurdles('chicago', parcel({}), project({ city: 'chicago', units: 30 }))
    expect(hs.some((h) => /ARO/.test(h.label))).toBe(true)
  })

  it('Seattle: MHA + SEPA over threshold', () => {
    const hs = assessHurdles('seattle', parcel({}), project({ city: 'seattle', units: 30, gfa: 40000 }))
    expect(hs.some((h) => /MHA/.test(h.label))).toBe(true)
    expect(hs.some((h) => /SEPA/.test(h.label))).toBe(true)
  })
})
