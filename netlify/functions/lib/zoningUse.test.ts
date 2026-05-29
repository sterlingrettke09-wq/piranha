import { describe, it, expect } from 'vitest'
import { mapZoningUse } from './zoningUse'

describe('mapZoningUse — BPDA Use_ category → use vocabulary', () => {
  it('maps Mixed-Use to mixed + residential + commercial', () => {
    expect(mapZoningUse('Mixed-Use')).toEqual(['mixed', 'residential', 'commercial'])
  })

  it('maps residential categories to residential', () => {
    expect(mapZoningUse('Residential')).toEqual(['residential'])
    expect(mapZoningUse('Multifamily Residential')).toEqual(['residential'])
    expect(mapZoningUse('Two-Family Dwelling')).toEqual(['residential'])
  })

  it('maps commercial/business categories to commercial + mixed', () => {
    expect(mapZoningUse('Commercial')).toEqual(['commercial', 'mixed'])
    expect(mapZoningUse('Business')).toEqual(['commercial', 'mixed'])
    expect(mapZoningUse('Neighborhood Shopping')).toEqual(['commercial', 'mixed'])
  })

  it('maps institutional/community categories to institutional', () => {
    expect(mapZoningUse('Community/Institutional')).toEqual(['institutional'])
    expect(mapZoningUse('Open Space')).toEqual(['institutional'])
  })

  it('maps industrial to commercial + institutional', () => {
    expect(mapZoningUse('Industrial')).toEqual(['commercial', 'institutional'])
  })

  it('is case-insensitive and trims', () => {
    expect(mapZoningUse('  mixed-use  ')).toEqual(['mixed', 'residential', 'commercial'])
  })

  it('returns null for null/empty/unmappable input (falls back to heuristics)', () => {
    expect(mapZoningUse(null)).toBeNull()
    expect(mapZoningUse(undefined)).toBeNull()
    expect(mapZoningUse('')).toBeNull()
    expect(mapZoningUse('Greenway Overlay')).toBeNull()
  })
})
