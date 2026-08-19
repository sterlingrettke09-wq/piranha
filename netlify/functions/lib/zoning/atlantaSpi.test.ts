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

  it('SPI-7 SA2C does NOT resolve to a stripped "SPI-7 SA2"', () => {
    // THE HAZARD, PINNED. SPI-7 carries SA2A, SA2B and SA2C — a lettered subarea
    // series, not conditional variants. A "strip a C after a digit" rule would
    // turn Subarea 2C into Subarea 2. It is not enough that this returns null
    // today because SPI-7 is unencoded: assert the PARSER never claims a base for
    // it, so the trap cannot arm itself when SPI-7 is encoded later.
    expect(parseAtlantaZone('SPI-7 SA2C').base).toBeNull()
    expect(resolveAtlanta('SPI-7 SA2C').name).toBeNull()
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
