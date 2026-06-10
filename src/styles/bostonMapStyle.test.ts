import { describe, it, expect } from 'vitest'
import {
  classifyZoningFamily,
  ZONING_FAMILY_COLORS,
  BRAND_OVERRIDES,
  BRAND,
} from './bostonMapStyle'

describe('classifyZoningFamily', () => {
  it('maps residential prefixes to the residential family', () => {
    for (const c of ['R1', 'RS-5', 'RM', 'RH-2', 'SF-3', 'R-2', 'RR', 'UN1']) {
      expect(classifyZoningFamily(c)).toBe('residential')
    }
  })

  it('maps commercial / mixed / downtown prefixes to the commercial family', () => {
    for (const c of ['B-2-65', 'C2', 'MU-4A', 'NC3', 'MX', 'D', 'GB', 'CC', 'PD 851', 'C6-2']) {
      expect(classifyZoningFamily(c)).toBe('commercial')
    }
  })

  it('maps industrial prefixes to the industrial family', () => {
    for (const c of ['M1', 'M2-2', 'IG1', 'IH', 'IL', 'PDR-1', 'I-2', 'Industrial']) {
      expect(classifyZoningFamily(c)).toBe('industrial')
    }
  })

  it('falls back to other for unknown or empty codes (never guesses)', () => {
    for (const c of [null, undefined, '', '   ', 'UNZONED', 'OS-UP', '???']) {
      expect(classifyZoningFamily(c)).toBe('other')
    }
  })

  it('exposes a color for every family so the legend and map cannot drift', () => {
    expect(Object.keys(ZONING_FAMILY_COLORS).sort()).toEqual([
      'commercial',
      'industrial',
      'other',
      'residential',
    ])
  })
})

describe('BRAND_OVERRIDES (basemap legibility)', () => {
  const byLayer = (id: string) => BRAND_OVERRIDES.filter((o) => o.layerId === id)

  it('every override is a well-formed {layerId, property, value} triple', () => {
    for (const o of BRAND_OVERRIDES) {
      expect(typeof o.layerId).toBe('string')
      expect(o.layerId.length).toBeGreaterThan(0)
      expect(typeof o.property).toBe('string')
      expect(o.property.length).toBeGreaterThan(0)
      expect(['string', 'number']).toContain(typeof o.value)
    }
  })

  it('keeps the warm bone land canvas', () => {
    expect(byLayer('land')[0]?.value).toBe(BRAND.bone)
    expect(byLayer('background')[0]?.value).toBe(BRAND.bone)
  })

  it('paints water clearly distinct from the land so the city is legible', () => {
    const water = byLayer('water').find((o) => o.property === 'fill-color')
    expect(water).toBeDefined()
    // Regression guard: water must NOT collapse to the bone land tone (the old
    // bug that rendered a featureless beige void).
    expect(water?.value).not.toBe(BRAND.bone)
  })

  it('renders a visible road hierarchy (streets through primaries)', () => {
    for (const road of [
      'road-minor',
      'road-street',
      'road-secondary-tertiary',
      'road-primary',
    ]) {
      const o = byLayer(road).find((x) => x.property === 'line-color')
      expect(o, `missing line-color override for ${road}`).toBeDefined()
    }
  })
})
