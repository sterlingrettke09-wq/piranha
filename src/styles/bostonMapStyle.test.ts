import { describe, it, expect } from 'vitest'
import { classifyZoningFamily, ZONING_FAMILY_COLORS } from './bostonMapStyle'

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
