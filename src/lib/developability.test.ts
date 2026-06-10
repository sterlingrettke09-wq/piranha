import { describe, it, expect } from 'vitest'
import { assessDevelopability, isGovernmentOwner } from './developability'

describe('isGovernmentOwner', () => {
  it('flags government / public-entity owners', () => {
    expect(isGovernmentOwner('CITY OF BOSTON')).toBe(true)
    expect(isGovernmentOwner('COMMONWEALTH OF MASSACHUSETTS')).toBe(true)
    expect(isGovernmentOwner('County of Los Angeles')).toBe(true)
    expect(isGovernmentOwner('UNITED STATES OF AMERICA')).toBe(true)
    expect(isGovernmentOwner('Boston Housing Authority')).toBe(true)
    expect(isGovernmentOwner('MBTA')).toBe(true)
    expect(isGovernmentOwner('Boston Redevelopment Authority')).toBe(true)
  })
  it('does NOT flag private owners', () => {
    expect(isGovernmentOwner('SMITH JOHN J')).toBe(false)
    expect(isGovernmentOwner('123 MAIN STREET LLC')).toBe(false)
    expect(isGovernmentOwner('FEDERAL REALTY INVESTMENT TRUST')).toBe(false) // bare "federal" must not trip
    expect(isGovernmentOwner('STATE STREET BANK')).toBe(false) // "state street" is not "state of"
    expect(isGovernmentOwner(null)).toBe(false)
    expect(isGovernmentOwner('')).toBe(false)
  })
})

describe('assessDevelopability — park/water land-use precision', () => {
  it('blocks genuine park / water land uses', () => {
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Park' }).developable).toBe(false)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Public park' }).developable).toBe(false)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Parkland' }).developable).toBe(false)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Water' }).developable).toBe(false)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Water treatment facility' }).developable).toBe(false)
  })
  it('does NOT block private uses that merely contain "park" or "water"', () => {
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Trailer park' }).developable).toBe(true)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Waterfront residential' }).developable).toBe(true)
    expect(assessDevelopability({ districtCode: 'R-1', landUse: 'Parking lot' }).developable).toBe(true)
  })
  it('does NOT block a named district that contains "Park"', () => {
    const r = assessDevelopability({ districtCode: 'Hyde Park Neighborhood', landUse: 'Two-family' })
    expect(r.developable).toBe(true)
  })
})

describe('assessDevelopability — government-owned parcels', () => {
  it('hard-blocks a government-owned parcel (e.g. Boston City Hall)', () => {
    const r = assessDevelopability({
      districtCode: 'CITY HALL MEDIUM DENSITY AREA',
      landUse: 'OFFICE /Administration',
      ownerPublic: true,
    })
    expect(r.developable).toBe(false)
    expect(r.kind).toBe('public')
    expect(r.reason).toMatch(/government-owned/i)
  })
  it('does not block an ordinary private parcel', () => {
    const r = assessDevelopability({
      districtCode: 'Multifamily Residential',
      landUse: 'Three-family',
      ownerPublic: false,
    })
    expect(r.developable).toBe(true)
    expect(r.kind).toBeNull()
  })
})
