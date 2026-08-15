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
  // ── Special districts (added 2026-08-15) ──────────────────────────────────
  //
  // The original list covered general-purpose government and a few named
  // authorities, and missed the SPECIAL-DISTRICT families that own most
  // non-building public land: park boards, water and sewer districts, utility
  // and flood-control districts, and the "Port of <city>" form. A parcel owned
  // by one of these passed the block and was priced for development.
  it.each([
    ['CHICAGO PARK DISTRICT', 'park district'],
    ['MINNEAPOLIS PARK & RECREATION BOARD', 'parks & recreation'],
    ['Seattle Parks and Recreation', 'parks and recreation'],
    ['MARICOPA COUNTY PARKS AND RECREATION DEPT', 'parks and recreation'],
    ['PORT OF SEATTLE', 'port of <city>'],
    ['Port of Los Angeles', 'port of <city>'],
    ['LAS VEGAS VALLEY WATER DISTRICT', 'water district'],
    ['Metropolitan Water District of Southern California', 'metropolitan water'],
    ['SAN DIEGO COUNTY WATER AUTHORITY', 'water authority'],
    ['MILWAUKEE METROPOLITAN SEWER DISTRICT', 'sewer district'],
    ['SANITARY DISTRICT OF DECATUR', 'sanitary district'],
    ['Maricopa County Flood Control District', 'flood control district'],
    ['PUBLIC UTILITY DISTRICT NO 1', 'public utility district'],
    ['SALT RIVER IRRIGATION DISTRICT', 'irrigation district'],
    ['CUYAHOGA SOIL & WATER CONSERVATION DISTRICT', 'conservation district'],
    ['REGIONAL TRANSIT DISTRICT', 'regional transit district'],
    ['MIDPENINSULA REGIONAL OPEN SPACE DISTRICT', 'regional open space district'],
  ])('flags %s (%s)', (owner) => {
    expect(isGovernmentOwner(owner)).toBe(true)
  })

  // ⚠️ THE HALF THAT MATTERS MOST, and the reason every token above is anchored
  // to a governing noun. `ownerPublic` feeds a HARD BLOCK — a false positive
  // tells someone their own parcel cannot be developed, which is a wrong answer
  // that looks authoritative (rule 18: it produces output, not a null). A bare
  // /park/, /water/ or /port/ would catch every name below.
  //
  // CLAUDE.md: never broaden a block-regex without a test showing it cannot
  // catch a legitimate private parcel. This is that test. Anything added to
  // GOV_OWNER must add its look-alikes here.
  it.each([
    'PARK AVENUE ASSOCIATES LLC',
    'PARKVIEW PROPERTIES',
    'PARKER JOHN M',
    'PARK PLACE HOTEL LP',
    'NATIONAL PARK BANK', // "national park service" is the public one, not this
    'WATERFRONT PROPERTIES LLC',
    'WATERMARK LLC',
    'BRIDGEWATER DISTRICT PARTNERS', // no word boundary before "water"
    'PORTLAND REALTY GROUP',
    'PORTER SMITH TRUST',
    'SUPPORT OF ARTS INC', // no word boundary before "port of"
    'PASSPORT HOLDINGS LLC',
    'SEWER PIPE SUPPLY CO',
    'GREEN CONSERVATION LLC',
    'UTILITY TRAILER MFG',
  ])('does NOT flag %s', (owner) => {
    expect(isGovernmentOwner(owner)).toBe(false)
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
