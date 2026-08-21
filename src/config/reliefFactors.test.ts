import { describe, it, expect } from 'vitest'
import { RELIEF_FACTOR_HEIGHT, RELIEF_FACTOR_FAR } from './reliefFactors'
import { FT_PER_STORY, ftPerStory } from './estimates'
// Vite-native `?raw` rather than node:fs — `src` is typechecked without
// @types/node, and this is the mechanism cities.test.ts already uses to read
// its own source.
import METHODOLOGY_SRC from '../routes/Methodology.tsx?raw'
import FEASIBILITY_SRC from '../../netlify/functions/lib/feasibility.ts?raw'

describe('⚠️ the relief thresholds are one definition, described once', () => {
  it('height and FAR are DIFFERENT, which is what the prose got wrong', () => {
    expect(RELIEF_FACTOR_HEIGHT).toBe(1.5)
    expect(RELIEF_FACTOR_FAR).toBe(1.2)
    expect(RELIEF_FACTOR_HEIGHT).not.toBe(RELIEF_FACTOR_FAR)
  })

  it('⚠️ Methodology states no relief threshold as a literal', () => {
    // The page said "up to 1.5× over" for BOTH dimensions — true of height,
    // false of FAR — while WhatWouldItTake, which reads the real constants, said
    // both correctly on another page. Two user-facing surfaces contradicting
    // each other about one rule. The prose now interpolates, so it cannot drift.
    const src = METHODOLOGY_SRC
    const prose = src.slice(src.indexOf('For FAR and height'), src.indexOf('For FAR and height') + 600)
    expect(prose).toMatch(/\{RELIEF_FACTOR_HEIGHT\}/)
    expect(prose).toMatch(/\{RELIEF_FACTOR_FAR\}/)
    // ⚠️ And no hand-typed multiplier survives in that paragraph.
    expect(prose).not.toMatch(/1\.5&times;|1\.2&times;|1\.5×|1\.2×/)
  })

  it('⚠️ Methodology states no ft-per-storey literal either', () => {
    // "stories × 11 ft" was true for residential and false for everything else:
    // ftPerStory returns 13 for commercial, mixed and institutional.
    expect(FT_PER_STORY).toBe(11)
    expect(ftPerStory('residential')).toBe(11)
    expect(ftPerStory('commercial')).toBe(13)
    expect(ftPerStory('residential')).not.toBe(ftPerStory('commercial'))

    const src = METHODOLOGY_SRC
    const i = src.indexOf('Your proposed')
    const prose = src.slice(i, i + 420)
    expect(prose).toMatch(/\{FT_PER_STORY\}/)
    expect(prose).toMatch(/\{ftPerStory\('commercial'\)\}/)
    expect(prose).not.toMatch(/&times; 11 ft|× 11 ft/)
  })

  it('⚠️ feasibility.ts re-exports rather than redefining', () => {
    // A second copy is what let the forward pass and the inverse query disagree
    // before, and what let the prose disagree with both. Pinned so a future
    // edit cannot quietly reintroduce a literal in the engine.
    const src = FEASIBILITY_SRC
    expect(src).toMatch(/export \{ RELIEF_FACTOR_HEIGHT, RELIEF_FACTOR_FAR \} from/)
    expect(src).not.toMatch(/export const RELIEF_FACTOR_(HEIGHT|FAR)\s*=/)
  })
})
