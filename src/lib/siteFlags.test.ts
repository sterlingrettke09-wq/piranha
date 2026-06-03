import { describe, it, expect } from 'vitest'
import { assessSiteAdvisory } from './siteFlags'

describe('assessSiteAdvisory — land-use signals', () => {
  it('flags stadiums / sport facilities', () => {
    expect(assessSiteAdvisory({ landUse: 'Sport Facility' })?.category).toBe('venue')
    expect(assessSiteAdvisory({ landUse: 'Stadium' })?.category).toBe('venue')
    expect(assessSiteAdvisory({ landUse: 'Athletic & Amusement Facilities' })?.category).toBe('venue')
    expect(assessSiteAdvisory({ landUse: 'Auditorium//Assembly Bldg' })?.category).toBe('venue')
  })
  it('flags hospitals (incl. the plural "Hospitals") but not "Hospitality"', () => {
    expect(assessSiteAdvisory({ landUse: 'Hospital' })?.category).toBe('hospital')
    expect(assessSiteAdvisory({ landUse: 'Hospitals' })?.category).toBe('hospital') // LA's plural label
    expect(assessSiteAdvisory({ landUse: 'Medical Center' })?.category).toBe('hospital')
    expect(assessSiteAdvisory({ landUse: 'Hospitality / Hotel' })).toBeNull() // a hotel is a normal lot
  })
  it('flags universities / schools', () => {
    expect(assessSiteAdvisory({ landUse: 'Colleges, Universities (Private)' })?.category).toBe('university')
    expect(assessSiteAdvisory({ landUse: 'School(Public)' })?.category).toBe('university')
  })
  it('flags museums', () => {
    expect(assessSiteAdvisory({ landUse: 'Art Museum' })?.category).toBe('museum')
  })
  it('flags NYC PLUTO categories', () => {
    expect(assessSiteAdvisory({ landUse: 'Public facilities & institutions' })?.category).toBe('civic')
    expect(assessSiteAdvisory({ landUse: 'Transportation & utility' })?.category).toBe('transit')
  })
  it('does NOT flag ordinary uses', () => {
    expect(assessSiteAdvisory({ landUse: 'Residential building' })).toBeNull()
    expect(assessSiteAdvisory({ landUse: 'Commercial & office buildings' })).toBeNull()
    expect(assessSiteAdvisory({ landUse: 'Parking Lots (Commercial Use)' })).toBeNull() // "park" must not match
    expect(assessSiteAdvisory({ landUse: 'Commercial-medical office' })).toBeNull() // a doctor's office is a normal lot
    expect(assessSiteAdvisory({ landUse: 'Vacant land' })).toBeNull()
  })
})

describe('assessSiteAdvisory — institutional zoning codes', () => {
  it('flags Seattle MIO, Denver CMP-, LA PF', () => {
    expect(assessSiteAdvisory({ districtCode: 'MIO-240-HR (M)' })?.category).toBe('civic')
    expect(assessSiteAdvisory({ districtCode: 'CMP-H' })?.category).toBe('university')
    expect(assessSiteAdvisory({ districtCode: 'PF-1-SN' })?.category).toBe('civic')
  })
  it('does NOT flag ordinary zoning codes', () => {
    expect(assessSiteAdvisory({ districtCode: 'R7-2' })).toBeNull()
    expect(assessSiteAdvisory({ districtCode: 'DT1' })).toBeNull()
    expect(assessSiteAdvisory({ districtCode: 'C-MX-5' })).toBeNull()
    expect(assessSiteAdvisory({ districtCode: 'CM4' })).toBeNull()
  })
})

describe('assessSiteAdvisory — curated landmark proximity', () => {
  it('flags a click on US Bank Stadium (Minneapolis, no data signal)', () => {
    const a = assessSiteAdvisory({ city: 'minneapolis', districtCode: 'DT1', landUse: null, lat: 44.974, lng: -93.2575 })
    expect(a?.category).toBe('venue')
    expect(a?.label).toContain('US Bank Stadium')
  })
  it('flags a click on the Chase Center (SF, reads as vacant)', () => {
    const a = assessSiteAdvisory({ city: 'sf', districtCode: 'MB-RA', landUse: 'Vacant land', lat: 37.768, lng: -122.3877 })
    expect(a?.label).toContain('Chase Center')
  })
  it('does NOT flag a normal parcel a few blocks from a landmark', () => {
    // Uptown Minneapolis, ~7 km from US Bank Stadium
    expect(assessSiteAdvisory({ city: 'minneapolis', districtCode: 'CM4', landUse: null, lat: 44.9483, lng: -93.298 })).toBeNull()
  })
  it('does not match a landmark in a different city', () => {
    // Same coordinates as US Bank Stadium but city=chicago → no match
    expect(assessSiteAdvisory({ city: 'chicago', districtCode: 'DT1', landUse: null, lat: 44.974, lng: -93.2575 })).toBeNull()
  })
})
