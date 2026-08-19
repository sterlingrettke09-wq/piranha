import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { resolveAtlanta, parseAtlantaZone } from './atlanta'

const ROOT = resolve(__dirname, '../../../..')
const LIVE: string[] = JSON.parse(
  readFileSync(join(ROOT, 'scripts/__fixtures__/zoneEnumerations/atlanta.json'), 'utf8'),
).codes.map((c: string) => String(c).trim().toUpperCase())

// ── THE BASIS IS PER LIMB AND PER CHAPTER, AND THE CHAPTERS DISAGREE ─────────
//
// SPI-20 and SPI-21 each state exactly ONE unqualified limb, and it is a
// DIFFERENT limb in each — nonresidential in SPI-20, residential in SPI-21. Both
// chapters look identical in shape, so carrying the first across to the second
// would have tagged the wrong limb with nothing downstream able to see it. These
// assertions exist so that a later edit cannot quietly make them agree.
describe('SPI basis assignment matches each chapter, not its neighbour', () => {
  it('SPI-20 leaves NONRESIDENTIAL unqualified and elects the residential', () => {
    const r = resolveAtlanta('SPI-20 SA1')
    expect(r.farNonresidential).toEqual(
      expect.objectContaining({ far: 2.5, basis: 'unqualified' }),
    )
    expect(r.farResidential).toEqual(
      expect.objectContaining({ far: 0.696, basis: 'net-or-gross' }),
    )
    expect(r.farCombined).toEqual(expect.objectContaining({ far: 3.196, basis: 'net' }))
  })

  it('SPI-21 is the MIRROR IMAGE — nonresidential is net, residential elects', () => {
    const r = resolveAtlanta('SPI-21 SA1')
    expect(r.farNonresidential).toEqual(expect.objectContaining({ far: 2.5, basis: 'net' }))
    expect(r.farResidential).toEqual(expect.objectContaining({ far: 2.0, basis: 'net-or-gross' }))
    // The specific thing that would break if SPI-20's mapping were copied.
    expect(r.farNonresidential!.basis, 'SPI-21 states "net lot area" for this limb').not.toBe(
      'unqualified',
    )
    expect(resolveAtlanta('SPI-20 SA1').farNonresidential!.basis).not.toBe('net')
  })

  it('SPI-16 is gross on every limb, from its row labels', () => {
    const r = resolveAtlanta('SPI-16 SA1')
    for (const limb of [r.farNonresidential, r.farResidential, r.farCombined]) {
      expect(limb!.basis).toBe('gross')
    }
  })
})

describe('a non-ratio cell encodes as null, never as a number', () => {
  it.each([
    ['SPI-20 SA4', '20% — a maximum percentage of development'],
    ['SPI-20 SA5', '5%'],
    ['SPI-20 SA6', 'None'],
    ['SPI-21 SA5', '20%'],
    ['SPI-21 SA7', 'None'],
    ['SPI-16 SA2', 'a locational rule, not a ratio'],
    ['SPI-16 SA2 JSTA', 'a locational rule, not a ratio'],
  ])('%s has no nonresidential ratio (%s)', (code) => {
    expect(resolveAtlanta(code).farNonresidential).toBeNull()
    // and the district itself still resolved — a null limb is an answer about
    // that use, not a failure to read the district.
    expect(resolveAtlanta(code).name).toBeTruthy()
  })

  it('and 20% never became 0.20', () => {
    for (const c of ['SPI-20 SA4', 'SPI-21 SA5']) {
      expect(resolveAtlanta(c).farNonresidential?.far).not.toBe(0.2)
    }
  })
})

describe('a street-conditional height is refused, not averaged', () => {
  it.each(['SPI-16 SA3', 'SPI-21 SA1'])('%s publishes no single figure', (code) => {
    const r = resolveAtlanta(code)
    expect(r.heightFt, 'publishing the larger overstates the restricted band').toBeNull()
    expect(r.heightTiers).not.toBeNull()
    expect(r.heightTiers!.length).toBeGreaterThanOrEqual(2)
  })
})

// ── RULE 27: A BARE TRAILING "C" IS NOT A CONDITIONAL SUFFIX ────────────────
describe('the bare-C alias is enumerated, never inferred from the string', () => {
  it('SPI-16 SA1C resolves to Subarea 1', () => {
    const r = resolveAtlanta('SPI-16 SA1C')
    expect(r.farCombined?.far).toBe(8.2)
    expect(parseAtlantaZone('SPI-16 SA1C').conditional).toBe(true)
  })

  it('SPI-7 SA2C resolves to SUBAREA 2C, not to a stripped "SPI-7 SA2"', () => {
    // THE HAZARD, PINNED — and now pinned in its stronger form. SPI-7 carries
    // SA2A, SA2B and SA2C: a lettered subarea series, not conditional variants.
    // A "strip a C after a digit" rule would turn Subarea 2C into Subarea 2.
    //
    // The original assertion was that this resolves to NOTHING, which held only
    // while SPI-7 was unencoded — the same "true until the work happens" shape as
    // the fixture above. SPI-7 was encoded on 2026-08-18, so the invariant is now
    // stated positively: it resolves to its OWN entry, and no 'SPI-7 SA2' entry
    // exists for it to have collapsed into.
    expect(parseAtlantaZone('SPI-7 SA2C').base).toBe('SPI-7 SA2C')
    expect(parseAtlantaZone('SPI-7 SA2C').conditional).toBe(false)
    expect(resolveAtlanta('SPI-7 SA2C').name).toMatch(/Subarea 2C/)
    expect(resolveAtlanta('SPI-7 SA2').name, 'no bare Subarea 2 exists to collapse into').toBeNull()
  })

  it('both spellings exist live, which is why the string cannot decide', () => {
    // rule 20 — if the fixture stopped carrying these the tests above would be
    // asserting things about codes no parcel has.
    expect(LIVE).toContain('SPI-16 SA1C')
    expect(LIVE).toContain('SPI-7 SA2C')
  })
})

// ── SPI-21 SUBAREA 6: READ BUT UNVERIFIABLE ─────────────────────────────────
describe('SPI-21 Subarea 6 is deliberately unencoded', () => {
  it('has no live code, so its grid column cannot be checked against a parcel', () => {
    const spi21 = LIVE.filter((c) => c.startsWith('SPI-21'))
    expect(spi21.length).toBeGreaterThan(5)
    expect(spi21, 'if SA6 ever appears live, encode it — the reason to omit it is gone').not.toContain(
      'SPI-21 SA6',
    )
  })

  it('and resolves to nothing rather than to a neighbouring subarea', () => {
    expect(resolveAtlanta('SPI-21 SA6').name).toBeNull()
    expect(resolveAtlanta('SPI-21 SA6').farResidential).toBeNull()
  })

  it('while every subarea that DOES have a live code resolves', () => {
    const live21 = LIVE.filter((c) => c.startsWith('SPI-21 SA'))
    const unresolved = live21.filter((c) => resolveAtlanta(c).name == null)
    expect(unresolved, 'a live SPI-21 code that resolves to nothing is a gap, not a decision').toEqual([])
    expect(live21.length).toBe(9)
  })
})

describe('every live SPI-16 and SPI-20 code resolves', () => {
  it.each(['SPI-16', 'SPI-20'])('%s', (prefix) => {
    const live = LIVE.filter((c) => c.startsWith(prefix + ' '))
    expect(live.length).toBeGreaterThan(3)
    expect(live.filter((c) => resolveAtlanta(c).name == null)).toEqual([])
  })
})

// ── SPI-2 AND SPI-17: TWO MORE MECHANISMS ──────────────────────────────────
describe('SPI-2 splits its denominators between the limbs', () => {
  it('nonresidential is NET and residential is GROSS — the pairing no other chapter uses', () => {
    const r = resolveAtlanta('SPI-2 SA1')
    expect(r.farNonresidential).toEqual(expect.objectContaining({ far: 4.0, basis: 'net' }))
    expect(r.farResidential).toEqual(expect.objectContaining({ far: 3.2, basis: 'gross' }))
    // The specific thing a carried-across assumption would produce.
    expect(r.farNonresidential!.basis).not.toBe(r.farResidential!.basis)
  })

  it('publishes no single height where the table states one per use', () => {
    for (const code of ['SPI-2 SA1', 'SPI-2 SA2', 'SPI-2 SA3', 'SPI-2 SA4']) {
      const r = resolveAtlanta(code)
      expect(r.heightFt, `${code}: 120ft to a single-family project overstates by 3.4x`).toBeNull()
      expect(r.heightTiers!.map((t) => t.label).join(' ')).toMatch(/single-family/)
    }
  })

  it('except Subarea 5, where single-family is not permitted so one row applies', () => {
    expect(resolveAtlanta('SPI-2 SA5').heightFt).toBe(150)
  })
})

describe('SPI-17 states no combined row, and that is the code being silent', () => {
  it('both limbs are gross and farCombined is null', () => {
    const r = resolveAtlanta('SPI-17 SA3')
    expect(r.farNonresidential!.basis).toBe('gross')
    expect(r.farResidential!.basis).toBe('gross')
    expect(r.farCombined, 'the chapter publishes no combined row').toBeNull()
  })

  it('the "5% of residential floor area" cell is not a ratio', () => {
    expect(resolveAtlanta('SPI-17 SA2').farNonresidential).toBeNull()
    expect(resolveAtlanta('SPI-17 SA2').farResidential!.far).toBe(1.49)
  })

  it('and the Piedmont Ave split refuses a single height', () => {
    const r = resolveAtlanta('SPI-17 SA3')
    expect(r.heightFt).toBeNull()
    expect(r.heightTiers!.map((t) => t.heightFt).sort()).toEqual([35, 50])
  })
})

describe('SPI-18 is read and deliberately unencoded', () => {
  it('resolves to nothing while its table contradicts itself', () => {
    // Subarea 10 states a non-residential base of 0.505 against a combined of
    // 1.196 and a residential of 0.696 — nine of ten columns are exactly
    // additive and this one misses by the trailing digit. Correcting a published
    // cell from the table's own arithmetic is the inference this module refuses,
    // and the direction is favourable, which is when it is least trustworthy.
    for (const c of ['SPI-18 SA1', 'SPI-18 SA10']) {
      expect(resolveAtlanta(c).name, `${c} must not ship while the table disagrees with itself`).toBeNull()
    }
  })
})

describe('every live SPI-2 and SPI-17 code resolves', () => {
  it.each(['SPI-2', 'SPI-17'])('%s', (prefix) => {
    const live = LIVE.filter((c) => c.startsWith(prefix + ' '))
    expect(live.length).toBeGreaterThan(3)
    expect(live.filter((c) => resolveAtlanta(c).name == null)).toEqual([])
  })
})

// ── SPI-1 AND SPI-22: THE BASIS IN TABLE FOOTNOTES ─────────────────────────
describe('SPI-1 splits its footnote-stated bases; SPI-22 applies one to all', () => {
  it('SPI-1 nonresidential is fixed net, residential elective (footnotes 1 and 2)', () => {
    const r = resolveAtlanta('SPI-1 SA1')
    expect(r.farNonresidential).toEqual(expect.objectContaining({ far: 25, basis: 'net' }))
    expect(r.farResidential).toEqual(expect.objectContaining({ far: 25, basis: 'net-or-gross' }))
  })

  it('SPI-22 applies ONE elective basis to every limb (footnote 1)', () => {
    const r = resolveAtlanta('SPI-22 SA1')
    for (const limb of [r.farNonresidential, r.farResidential, r.farCombined]) {
      expect(limb!.basis).toBe('net-or-gross')
    }
    // The discrimination: SPI-1 splits, SPI-22 does not. Both put it in a
    // footnote, and neither could be read off the other.
    expect(resolveAtlanta('SPI-1 SA1').farNonresidential!.basis).not.toBe(
      resolveAtlanta('SPI-22 SA1').farNonresidential!.basis,
    )
  })

  it('SPI-1 states NO height limit — an answer, not a gap', () => {
    for (const c of ['SPI-1 SA1', 'SPI-1 SA4', 'SPI-1 SA7']) {
      const r = resolveAtlanta(c)
      expect(r.heightUnconstrained, `${c}`).toBe(true)
      expect(r.heightFt).toBeNull()
    }
  })

  it('SPI-1 publishes no combined cap, because the phrase is ambiguous in this code', () => {
    // "Maximum Achievable Combined FAR" — SPI-22 splits the SAME phrase into
    // Base and Bonus rows, so reading SPI-1's as the base would be an inference
    // from another chapter.
    expect(resolveAtlanta('SPI-1 SA1').farCombined).toBeNull()
    expect(resolveAtlanta('SPI-22 SA1').farCombined!.far).toBe(6.0)
  })

  it('both spellings of SPI-22 Subarea 1 resolve identically', () => {
    const a = resolveAtlanta('SPI-22 SA1')
    const b = resolveAtlanta('SPI-22 SA-1')
    expect(b.farCombined).toEqual(a.farCombined)
    expect(b.heightTiers).toEqual(a.heightTiers)
    expect(LIVE).toContain('SPI-22 SA-1')
    expect(LIVE).toContain('SPI-22 SA1')
  })

  it('SPI-22 refuses a single height where the footnotes key it to streets', () => {
    expect(resolveAtlanta('SPI-22 SA2').heightFt).toBe(64)
    for (const c of ['SPI-22 SA1', 'SPI-22 SA3', 'SPI-22 SA4']) {
      expect(resolveAtlanta(c).heightFt, c).toBeNull()
      expect(resolveAtlanta(c).heightTiers!.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('and every live SPI-1 and SPI-22 code resolves', () => {
    for (const p of ['SPI-1 ', 'SPI-22 ']) {
      const live = LIVE.filter((c) => c.startsWith(p))
      expect(live.length).toBeGreaterThan(3)
      expect(live.filter((c) => resolveAtlanta(c).name == null)).toEqual([])
    }
  })
})

describe('SPI-9 is a map-layer ask, not an encode target', () => {
  it('stays unresolved because its base FAR is on a map attachment', () => {
    // "Max. FAR without Bonuses: According to Map Attachment" — the only numeric
    // figures in that chapter are with-bonus, which rule 6 excludes.
    expect(resolveAtlanta('SPI-9 SA1').name).toBeNull()
    expect(resolveAtlanta('SPI-9 SA1').farNonresidential).toBeNull()
  })
})

// ── PROSE-FAR CHAPTERS: NO GRID AT ALL, AND THE SENTENCE IS SCOPED ─────────
describe('SPI-5, SPI-7 and SPI-26 state their FAR in prose', () => {
  it('the residential-only sentence encodes only the residential limb', () => {
    for (const c of ['SPI-5 SA2', 'SPI-5 SA3', 'SPI-7 SA2A', 'SPI-7 SA3']) {
      const r = resolveAtlanta(c)
      expect(r.farResidential, c).toEqual(
        expect.objectContaining({ far: 0.5, basis: 'unqualified' }),
      )
      // "The RESIDENTIAL, or dwelling, floor area ratio" — the sentence says
      // nothing about non-residential, so nothing is asserted about it.
      expect(r.farNonresidential, c).toBeNull()
      expect(r.farCombined, c).toBeNull()
    }
  })

  it('and the subareas the section does NOT reach stay unresolved', () => {
    // §16-18E.010 is titled "Residential subareas" and SPI-5 Subarea 1 is
    // "Public open space or park"; §16-18G.009 is titled "Residential Subareas 2
    // and 3", so SPI-7 Subarea 1 is outside it. Filling either from a neighbour
    // would publish a residential ratio onto a subarea the code never gave one.
    expect(resolveAtlanta('SPI-5 SA1').name).toBeNull()
    expect(resolveAtlanta('SPI-7 SA1').name).toBeNull()
  })

  it('SPI-26 is district-wide, so every limb carries the same ratio', () => {
    const r = resolveAtlanta('SPI-26')
    for (const limb of [r.farNonresidential, r.farResidential, r.farCombined]) {
      expect(limb).toEqual(expect.objectContaining({ far: 0.5, basis: 'unqualified' }))
    }
  })

  it('none of the three claims a height, and none claims height is absent', () => {
    for (const c of ['SPI-5 SA2', 'SPI-7 SA3', 'SPI-26']) {
      const r = resolveAtlanta(c)
      expect(r.heightFt, c).toBeNull()
      // Accessory-structure limits and one named building are not district
      // maxima — and not stated absences either (rule 5).
      expect(r.heightUnconstrained, c).toBe(false)
    }
  })
})
