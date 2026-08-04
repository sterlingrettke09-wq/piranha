import { describe, it, expect } from 'vitest'
import { resolveMiami, miamiUsesForZone, MIAMI_FT_PER_STORY } from './miami'

// Zone codes and Bldg_Height values below are verbatim from a full sweep of the
// live Miami 21 Primary Zoning layer (36 distinct zones, 2026-08-03).
describe('resolveMiami — T6 (Urban Core), the only zones with published heights', () => {
  it('reads max stories from the layer and converts to feet', () => {
    expect(resolveMiami('T6-48A-O', '48')).toEqual({ heightFt: 48 * MIAMI_FT_PER_STORY, stories: 48, maxFAR: null })
    expect(resolveMiami('T6-8-L', '8').stories).toBe(8)
    expect(resolveMiami('T6-80-O', '80').stories).toBe(80)
    expect(resolveMiami('T6-12-R', '12').stories).toBe(12)
  })
  it('falls back to the story count embedded in the zone code when the field is blank', () => {
    expect(resolveMiami('T6-24A-O', ' ').stories).toBe(24)
    expect(resolveMiami('T6-36B-L', '').stories).toBe(36)
  })
})

describe('resolveMiami — T3 is exact (Article 5 §5.3.2(e): two stories, 25 ft)', () => {
  it('returns 25 ft for every T3 intensity', () => {
    for (const z of ['T3-R', 'T3-L', 'T3-O']) {
      expect(resolveMiami(z, ' ')).toEqual({ heightFt: 25, stories: 2, maxFAR: null })
    }
  })
})

describe('resolveMiami — zones whose limits are not in public data', () => {
  it('returns nulls for T4/T5/T1/D/CI/CS rather than guessing', () => {
    // Article 5 defers these to Article 4 Table 2, which the GIS layer omits.
    for (const z of ['T4-R', 'T4-L', 'T4-O', 'T5-R', 'T5-L', 'T5-O', 'T1', 'D1', 'D2', 'D3', 'CI', 'CI-HD', 'CS']) {
      expect(resolveMiami(z, ' ')).toEqual({ heightFt: null, stories: null, maxFAR: null })
    }
  })
  it('never invents a FAR — the layer FLR field is a letter suffix, not a ratio', () => {
    expect(resolveMiami('T6-48A-O', '48').maxFAR).toBeNull()
    expect(resolveMiami('T6-24B-O', '24').maxFAR).toBeNull()
  })
  it('handles missing / empty input', () => {
    expect(resolveMiami(null)).toEqual({ heightFt: null, stories: null, maxFAR: null })
    expect(resolveMiami('')).toEqual({ heightFt: null, stories: null, maxFAR: null })
    expect(resolveMiami(undefined)).toEqual({ heightFt: null, stories: null, maxFAR: null })
  })
})

describe('miamiUsesForZone', () => {
  it('maps transect families to use vocabulary', () => {
    expect(miamiUsesForZone('T3-R')).toEqual(['residential'])
    expect(miamiUsesForZone('T4-L')).toContain('mixed')
    expect(miamiUsesForZone('T6-48A-O')).toContain('commercial')
    expect(miamiUsesForZone('CS')).toEqual(['institutional'])
    expect(miamiUsesForZone('CI-HD')).toEqual(['institutional'])
    expect(miamiUsesForZone('D3')).toContain('commercial')
    expect(miamiUsesForZone(null)).toBeNull()
  })
})
