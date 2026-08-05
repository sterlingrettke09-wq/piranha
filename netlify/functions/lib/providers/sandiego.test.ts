import { describe, it, expect } from 'vitest'
import { COASTAL_HEIGHT_LIMIT_FT, usesForZone } from './sandiego'

// Sources read in full 2026-08-05 (primary, not summaries):
//   docs.sandiego.gov/municode/municodechapter13/ch13art02division05.pdf (7-2024)
//   docs.sandiego.gov/municode/municodechapter13/ch13art01division04.pdf (3-2026)
//   .../ch13art01division03.pdf, division05.pdf, division06.pdf
// Zone-name inventory from a live query of the DSD Zoning_Base layer
// (webmaps.sandiego.gov/.../DSD/Zoning_Base/MapServer/0), 183 distinct values.

describe('San Diego coastal height limit — SDMC §132.0505(a)', () => {
  // VERBATIM §132.0505(a): "Notwithstanding any section to the contrary, no
  // building or addition to a building shall be constructed with a height in
  // excess of thirty feet within the Coastal Zone of the City of San Diego."
  //
  // No prior value shipped wrong here — 30 was already correct. This pins it
  // because it is the ONLY number this provider publishes, and it is stated in
  // feet by the code, so it must never be re-derived from a story count.
  it('is thirty feet, the figure the code states, in feet', () => {
    expect(COASTAL_HEIGHT_LIMIT_FT).toBe(30)
  })

  // Guards the "stories x 12" defect class: 30 ft must not drift to any of the
  // values a per-story conversion would produce from 2, 2.5 or 3 stories.
  it('is not a converted story count', () => {
    expect([24, 33, 35, 36]).not.toContain(COASTAL_HEIGHT_LIMIT_FT)
  })

  // Chapter 13 Article 1 lowest max-structure-height per division, read 2026-08-05:
  //   Div 3 (open space)  30 ft   Div 4 (residential) 30 ft
  //   Div 5 (commercial)  30 ft   Div 6 (industrial)  no limit — §131.0644
  // Because no base zone caps below 30, publishing the coastal cap as the
  // parcel's max height can never overstate the base zone's own ceiling.
  it('never exceeds the lowest base-zone ceiling in Chapter 13', () => {
    const LOWEST_BASE_ZONE_CEILING_FT = 30
    expect(COASTAL_HEIGHT_LIMIT_FT).toBeLessThanOrEqual(LOWEST_BASE_ZONE_CEILING_FT)
  })
})

describe('usesForZone — base-zone prefixes, SDMC Chapter 13 Article 1', () => {
  it('maps residential base zones (Div 4)', () => {
    expect(usesForZone('RS-1-7')).toEqual(['residential'])
    expect(usesForZone('RM-1-1')).toEqual(['residential'])
    expect(usesForZone('RX-1-1')).toEqual(['residential'])
    expect(usesForZone('RT-1-1')).toEqual(['residential'])
  })

  it('maps commercial base zones (Div 5): CN, CR, CO, CC, CV', () => {
    for (const z of ['CN-1-1', 'CR-1-1', 'CO-1-1', 'CC-1-1', 'CV-1-1']) {
      expect(usesForZone(z)).toContain('commercial')
    }
  })

  it('maps industrial base zones (Div 6): IP, IL, IH, IS', () => {
    for (const z of ['IP-1-1', 'IL-1-1', 'IH-1-1', 'IS-1-1']) {
      expect(usesForZone(z)).toContain('commercial')
    }
  })

  it('is case- and whitespace-insensitive', () => {
    expect(usesForZone('  rs-1-7 ')).toEqual(['residential'])
  })

  it('returns null rather than guessing for an unknown or absent zone', () => {
    expect(usesForZone(null)).toBeNull()
    expect(usesForZone('UNZONED')).toBeNull()
  })

  // Live-layer reconciliation. These 26 of the 183 distinct ZONE_NAME values
  // match no prefix rule and therefore yield null (a GAP — "we did not resolve
  // the use"), which is the honest render. Pinned so that a future broadening
  // of the regexes is a deliberate, reviewed act rather than an accident: an
  // over-broad prefix here would silently assert uses the code never granted.
  const UNMATCHED_LIVE_ZONES = [
    'CP-1-1',
    'EMX-1', 'EMX-2', 'EMX-3',
    'IBT-1-1',
    'OR-1-1', 'OR-1-2',
    'OTCC-1-1', 'OTCC-2-1', 'OTCC-2-2', 'OTCC-2-3', 'OTCC-3-1', 'OTCC-3-2',
    'OTMCR-1-1', 'OTMCR-1-2', 'OTMCR-1-3',
    'OTOP-1-1', 'OTOP-2-1',
    'OTRM-1-1', 'OTRM-2-1', 'OTRM-2-2',
    'OTRS-1-1',
    'RMX-1', 'RMX-2', 'RMX-3',
    'UNZONED',
  ]

  it.each(UNMATCHED_LIVE_ZONES)('%s is unresolved (null), not mis-assigned', (zone) => {
    expect(usesForZone(zone)).toBeNull()
  })

  // The near-misses that a sloppier regex would swallow. RMX/EMX must NOT be
  // read as RM/…; IBT must NOT be read as an I[LHPS] industrial zone; OR must
  // NOT be read as the commercial CR/CO family or the O[CPF] open-space family.
  it('does not let mixed-use and IBT zones fall through to a neighbouring family', () => {
    expect(usesForZone('RMX-1')).not.toEqual(['residential'])
    expect(usesForZone('IBT-1-1')).toBeNull()
    expect(usesForZone('OR-1-1')).toBeNull()
  })
})
