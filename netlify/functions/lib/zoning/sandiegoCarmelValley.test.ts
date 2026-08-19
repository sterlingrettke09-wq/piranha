import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { resolveSanDiego } from './sandiego'

const ROOT = resolve(__dirname, '../../../..')
const LIVE: string[] = JSON.parse(
  readFileSync(join(ROOT, 'scripts/__fixtures__/zoneEnumerations/sandiego.json'), 'utf8'),
).codes

// ── INCORPORATION BY REFERENCE ──────────────────────────────────────────────
//
// Chapter 15's planned districts state almost no figures. They adopt a Chapter
// 13 base zone — "the use and development regulations … for the RS-1-14 zone
// shall apply" (§153.0302) — and list exceptions. That is modelled as a
// reference, not a copied number, so a correction to the base reaches every
// district adopting it and an unresolvable base leaves its dependants honestly
// unresolved instead of silently wrong.
describe('Carmel Valley adopts base zones rather than restating them', () => {
  it('SF follows RS-1-14 and MF follows RM-1-1', () => {
    for (const c of ['CVPD-SF', 'CVPD-SF1', 'CVPD-SF1A', 'CVPD-SF2', 'CVPD-SF3', 'CVPD-SF4']) {
      expect(resolveSanDiego(c, null).maxFAR, c).toBe(resolveSanDiego('RS-1-14', null).maxFAR)
    }
    for (const c of ['CVPD-MF1', 'CVPD-MF2', 'CVPD-MF3', 'CVPD-MF4', 'CVPD-MFL']) {
      expect(resolveSanDiego(c, null).maxFAR, c).toBe(resolveSanDiego('RM-1-1', null).maxFAR)
    }
  })

  it('and inherits the base zone ALTERNATIVES, not just its headline', () => {
    // RM-1-1 allows 1.0 for 3–7 dwelling units. A district adopting RM-1-1
    // adopts that too; copying only `far` would have silently dropped it.
    const mf = resolveSanDiego('CVPD-MF1', null)
    const base = resolveSanDiego('RM-1-1', null)
    expect(mf.farAlternatives).toEqual(base.farAlternatives)
    expect(mf.farAlternatives.length).toBeGreaterThan(0)
  })

  it('the citation names both the adopting section and the adopted zone', () => {
    const r = resolveSanDiego('CVPD-SF', null)
    expect(r.source).toMatch(/153\.0302/)
    expect(r.source).toMatch(/adopts RS-1-14/)
  })

  it('SF is lot-independent, so the reference is safe with no parcel facts', () => {
    // The RS lot-area bands make RS-1-2…1-7 parcel-dependent; RS-1-14 is not one
    // of them. Checked across the band edges rather than assumed.
    const fars = [null, 3000, 6000, 12000, 40000].map(
      (lot) => resolveSanDiego('CVPD-SF', lot as number | null).maxFAR,
    )
    expect(new Set(fars).size, 'CVPD-SF must not vary with lot area').toBe(1)
    expect(fars[0]).toBe(0.6)
  })

  it('a district whose base zone is unresolved stays UNRESOLVED, never guessed', () => {
    // NC adopts CN-1-2, VC adopts CV-1-1, TC and SC adopt CC-1-3 — none of which
    // this module reads yet. They must resolve to nothing rather than to a
    // neighbour's figure, and they will resolve the day those base zones land.
    for (const c of ['CVPD-NC', 'CVPD-VC', 'CVPD-TC', 'CVPD-SC']) {
      const r = resolveSanDiego(c, null)
      expect(r.maxFAR, c).toBeNull()
      expect(r.farUnconstrained, c).toBe(false)
    }
  })

  it('Employment Center OVERRIDES its incorporation with a stated ratio', () => {
    // §153.0309 adopts CC-1-3 and then states "the maximum floor area ratio
    // shall be 0.5". CC-1-3 does not resolve, so if the override were not
    // encoded flat this district would be lost to a base zone it does not
    // actually depend on for its ratio.
    expect(resolveSanDiego('CVPD-EC', null).maxFAR).toBe(0.5)
    expect(resolveSanDiego('CC-1-3', null).maxFAR).toBeNull()
  })

  it('Mixed-Use Center keeps 1.25 as an alternative, never as the headline', () => {
    const r = resolveSanDiego('CVPD-MC', null)
    expect(r.maxFAR).toBe(1.2)
    expect(r.farAlternatives.map((a) => a.far)).toContain(1.25)
    expect(r.maxFAR, 'a 4-unit building does not get the 8-to-10-unit figure').not.toBe(1.25)
  })

  it('exactly 13 of the 20 live CVPD codes resolve, and the 7 are enumerated', () => {
    const cvpd = LIVE.filter((c) => c.startsWith('CVPD')).sort()
    expect(cvpd.length).toBe(20)
    const unresolved = cvpd.filter((c) => {
      const r = resolveSanDiego(c, null)
      return r.maxFAR == null && !r.farUnconstrained
    })
    // EP states a use restriction only, OS an open-space condition, and SP
    // adopts "the RM zones" in the plural — an ambiguity in the source rather
    // than a gap in the reading. The other four await their base zones.
    expect(unresolved).toEqual([
      'CVPD-EP', 'CVPD-NC', 'CVPD-OS', 'CVPD-SC', 'CVPD-SP', 'CVPD-TC', 'CVPD-VC',
    ])
  })
})
