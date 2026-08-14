import { describe, it, expect } from 'vitest'
import {
  resolveSanDiego,
  sanDiegoZoneKey,
  rsFarForLotArea,
  SAN_DIEGO_ZONE_CODES,
  RS_FAR_BY_LOT_AREA,
  RM_5_12_BY_HEIGHT,
} from './sandiego'

// Every figure asserted here was read from the Land Development Code, Chapter 13
// Article 1 Division 4 (7-2026 printing), extracted from the City's own PDF and
// checked against the table's four-row column header. Where a test asserts that
// something is ABSENT, the assertion is about the code's structure — a section
// that does not exist — not about a reader failing to find it (rule 15).

describe('inventory', () => {
  // Rule 20: a check that can pass by finding nothing is not a check. Pin the
  // size AND the membership, so a regex that silently stops matching goes RED
  // rather than green.
  it('covers all 33 Division 4 residential base zones', () => {
    expect(SAN_DIEGO_ZONE_CODES.length).toBe(33)
    expect(SAN_DIEGO_ZONE_CODES).toEqual(
      expect.arrayContaining([
        'RS-1-1', 'RS-1-7', 'RS-1-8', 'RS-1-14',
        'RX-1-1', 'RX-1-2',
        'RT-1-1', 'RT-1-5',
        'RM-1-1', 'RM-2-6', 'RM-3-7', 'RM-5-12',
      ]),
    )
  })

  it('pins the Table 131-04J band count', () => {
    expect(RS_FAR_BY_LOT_AREA.length).toBe(18)
    expect(RM_5_12_BY_HEIGHT.length).toBe(6)
  })
})

describe('Table 131-04J — FAR by lot area', () => {
  // The band EDGES are the whole risk in a stepped table: an off-by-one puts a
  // 8,000 sf lot in the 8,001+ band. Asserted on both sides of three edges.
  it.each([
    [2_500, 0.7],
    [3_000, 0.7],
    [3_001, 0.65],
    [7_000, 0.58],
    [7_001, 0.57],
    [8_000, 0.57],
    [8_001, 0.56],
    [19_000, 0.46],
    [19_001, 0.45],
    [250_000, 0.45],
  ])('a %i sf lot yields FAR %f', (lot, far) => {
    expect(rsFarForLotArea(lot)).toBe(far)
  })

  it('is monotonically non-increasing, as a ratio-by-lot-size table must be', () => {
    const fars = RS_FAR_BY_LOT_AREA.map((b) => b.far)
    for (let i = 1; i < fars.length; i++) expect(fars[i]).toBeLessThanOrEqual(fars[i - 1])
  })
})

describe('resolveSanDiego', () => {
  // THE KNOWN-GOOD RECONCILIATION (rule 16). RS-1-7 at 7,958 sq ft is the exact
  // parcel the null inventory probes, recorded STABLE over four isolated
  // re-probes. Before this module it returned GAP. If this assertion ever
  // disagrees with the live probe, the module is wrong, not the probe.
  it('resolves the probed RS-1-7 parcel at 7,958 sq ft to FAR 0.57', () => {
    const r = resolveSanDiego('RS-1-7', 7_958)
    expect(r.maxFAR).toBe(0.57)
    expect(r.source).toContain('131.0446')
  })

  it('resolves the flat-rate zones without needing a lot size', () => {
    expect(resolveSanDiego('RS-1-1', null).maxFAR).toBe(0.45)
    expect(resolveSanDiego('RS-1-8', null).maxFAR).toBe(0.45)
    expect(resolveSanDiego('RS-1-9', null).maxFAR).toBe(0.6)
    expect(resolveSanDiego('RM-4-11', null).maxFAR).toBe(7.2)
  })

  // A guessed band is an invented number wearing a citation (rule 4). The
  // spread across Table 131-04J is 0.70 to 0.45, so defaulting would be wrong
  // by up to 56% — and it would render as an ANSWER.
  it('REFUSES the lot-area zones when no lot size is available', () => {
    for (const z of ['RS-1-2', 'RS-1-3', 'RS-1-4', 'RS-1-5', 'RS-1-6', 'RS-1-7']) {
      expect(resolveSanDiego(z, null).maxFAR).toBeNull()
      expect(resolveSanDiego(z, 0).maxFAR).toBeNull()
      expect(resolveSanDiego(z, Number.NaN).maxFAR).toBeNull()
    }
  })

  // Rule 6: where the code allows either program A or program B, the larger
  // figure must not become the headline — that assumes a program the user has
  // not chosen, and it flows into unit counts, fees and hurdles.
  it('keeps a program-dependent FAR as an alternative, never as the headline', () => {
    const rt = resolveSanDiego('RT-1-1', 5_000)
    expect(rt.maxFAR).toBe(0.85)
    expect(rt.farAlternatives).toEqual([
      { label: '3-storey building', far: 1.2, source: expect.stringContaining('131.0431') },
    ])

    const rm = resolveSanDiego('RM-1-1', 6_000)
    expect(rm.maxFAR).toBe(0.75)
    expect(rm.farAlternatives.map((a) => a.far)).toEqual([1.0])

    const rm512 = resolveSanDiego('RM-5-12', 12_000)
    expect(rm512.maxFAR).toBe(1.8)
    expect(rm512.farAlternatives.map((a) => a.far)).toEqual([1.85, 1.9, 1.95, 2.0, 2.05, 2.1])
  })

  it('emits no alternative where the code states the same figure twice', () => {
    // RM-1-3 onward the "1 to 2" and "3 to 7" rows agree; restating the
    // headline as an alternative would imply a choice the code does not offer.
    expect(resolveSanDiego('RM-1-3', 6_000).farAlternatives).toEqual([])
    expect(resolveSanDiego('RM-2-6', 6_000).farAlternatives).toEqual([])
  })
})

describe('scope (rule 23)', () => {
  // Division 4 is residential base zones ONLY. Commercial, industrial and
  // planned-district codes are NOT in the scope that was read, so they must
  // return null and keep reading downstream as a GAP. If one of these ever
  // starts resolving, an out-of-scope table has been folded in without its
  // source being read.
  it.each(['CC-3-4', 'CN-1-3', 'IL-2-1', 'IH-2-1', 'OP-1-1', 'OC-1-1', 'CCPD-ER', 'BLPD-CT'])(
    'leaves the out-of-scope zone %s unresolved',
    (code) => {
      expect(sanDiegoZoneKey(code)).toBeNull()
      expect(resolveSanDiego(code, 6_000).maxFAR).toBeNull()
      expect(resolveSanDiego(code, 6_000).source).toBeNull()
    },
  )

  it('returns null rather than throwing on absent or malformed input', () => {
    for (const bad of [null, undefined, '', '   ', 'Unknown']) {
      expect(sanDiegoZoneKey(bad)).toBeNull()
      expect(resolveSanDiego(bad, 6_000).maxFAR).toBeNull()
    }
  })

  it('normalises case and internal whitespace', () => {
    expect(sanDiegoZoneKey('rs-1-7')).toBe('RS-1-7')
    expect(sanDiegoZoneKey(' RM-3-8 ')).toBe('RM-3-8')
    expect(sanDiegoZoneKey('RS -1- 7')).toBe('RS-1-7')
  })
})
