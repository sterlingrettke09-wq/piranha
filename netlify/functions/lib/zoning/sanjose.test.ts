import { describe, it, expect } from 'vitest'
import {
  resolveSanJose,
  sanJoseZoneKey,
  SAN_JOSE_ZONE_CODES,
  SFH_PERMIT_FAR_THRESHOLD,
  SFH_PERMIT_HEIGHT_FT,
  SFH_PERMIT_STORIES,
} from './sanjose'

describe('inventory', () => {
  it('pins the districts read from four chapters (rule 20)', () => {
    expect(SAN_JOSE_ZONE_CODES.length).toBe(20)
    expect([...SAN_JOSE_ZONE_CODES].sort()).toEqual(
      [
        // § 20.30.200 residential
        'R-1-1', 'R-1-2', 'R-1-5', 'R-1-8', 'R-1-RR', 'R-2', 'R-M', 'R-MH',
        // § 20.20.200 Table 20-40
        'OS', 'A',
        // § 20.50.200 Table 20-120 industrial
        'CIC', 'TEC', 'IP', 'LI', 'HI',
        // § 20.40.200 Table 20-100 commercial
        'CO', 'CP', 'CN', 'CG', 'PQP',
      ].sort(),
    )
  })
})

describe('the FAR finding', () => {
  // § 20.30.200's "Floor area ratio" row holds a cross-reference, and the
  // referenced clause is a permit-exemption test, not a cap. So every district
  // this module knows reports a KNOWN ABSENCE rather than a number.
  const RESIDENTIAL = ['R-1-1', 'R-1-2', 'R-1-5', 'R-1-8', 'R-1-RR', 'R-2', 'R-M', 'R-MH'] as const
  it.each(RESIDENTIAL)('%s reports no by-right FAR as an answer', (code) => {
    const r = resolveSanJose(code)
    expect(r.farUnconstrained).toBe(true)
    expect(r.maxFAR).toBeNull()
    expect(r.source).toContain('20.30.200')
  })

  // THE REGRESSION THIS MODULE EXISTS TO PREVENT. 0.45 is one disjunct of
  // § 20.100.1030(C)(1) — "…floor area ratio equal to or less than forty-five
  // hundredths OR height equal to or less than thirty feet…". It caps nothing
  // on its own. If it ever appears as maxFAR, a discretionary permit trigger
  // has been published as a by-right envelope ceiling.
  it('never publishes the 0.45 permit threshold as a maximum FAR', () => {
    for (const code of SAN_JOSE_ZONE_CODES) {
      expect(resolveSanJose(code).maxFAR).not.toBe(SFH_PERMIT_FAR_THRESHOLD)
    }
  })

  it('keeps the permit thresholds available for the hurdles path', () => {
    expect(SFH_PERMIT_FAR_THRESHOLD).toBe(0.45)
    expect(SFH_PERMIT_HEIGHT_FT).toBe(30)
    expect(SFH_PERMIT_STORIES).toBe(2)
  })
})

describe('height and storeys, carried not derived (rule 12)', () => {
  it.each([
    ['R-1-8', 35, 2.5],
    ['R-1-5', 35, 2.5],
    ['R-1-RR', 35, 2.5],
    ['R-2', 35, 2.5],
    ['R-MH', 45, 3],
  ])('%s = %i ft, %s storeys', (code, ft, stories) => {
    const r = resolveSanJose(code)
    expect(r.maxHeightFt).toBe(ft)
    expect(r.maxStories).toBe(stories)
  })

  it('R-M carries 45 ft and no storey count, because the table says "Not applicable"', () => {
    const r = resolveSanJose('R-M')
    expect(r.maxHeightFt).toBe(45)
    expect(r.maxStories).toBeNull()
  })

  // The column order in § 20.30.200 is NOT by lot size: R-1-8's minimum lot
  // area is 5,445 sq ft and R-1-5's is 8,000. Reading the header in size order
  // transposes the first two districts, and both would still look plausible.
  it('does not transpose R-1-8 and R-1-5', () => {
    expect(resolveSanJose('R-1-8').maxHeightFt).toBe(35)
    expect(resolveSanJose('R-1-5').maxHeightFt).toBe(35)
    // Both are 35 ft, so height cannot catch a transposition — the guard is
    // that both districts exist as distinct keys and neither absorbs the other.
    expect(sanJoseZoneKey('R-1-8')).toBe('R-1-8')
    expect(sanJoseZoneKey('R-1-5')).toBe('R-1-5')
  })
})

describe('scope (rule 23)', () => {
  // A planned-development parcel is governed by its approved permit
  // (§ 20.100.1030(C)(2)), never by the § 20.30.200 table — even when the base
  // code looks residential.
  it.each(['A(PD)', 'R-1-8(PD)', 'CO(PD)', 'CIC(PD)', 'PD'])('%s is not resolved from the base table', (code) => {
    expect(sanJoseZoneKey(code)).toBeNull()
    expect(resolveSanJose(code).farUnconstrained).toBe(false)
  })

  it.each(['DC', 'DC-NT1', 'MS-G', 'MS-C', 'UV', 'MUC', 'UR', 'TR', 'UVC', 'MUN'])(
    'leaves the out-of-scope district %s unresolved',
    (code) => {
      expect(sanJoseZoneKey(code)).toBeNull()
      const r = resolveSanJose(code)
      expect(r.farUnconstrained).toBe(false)
      expect(r.maxHeightFt).toBeNull()
      expect(r.source).toBeNull()
    },
  )

  // The distinction the whole module turns on: an unknown district and a known
  // one must not look the same. Both have maxFAR null; only one is an answer.
  it('separates a known absence from an unknown district', () => {
    // CN was the example here until 2026-08-14, when Table 20-100 was read and
    // CN became a known absence. DC is still genuinely unread, which is the
    // point of the test: both return maxFAR null and only one is an answer.
    expect(resolveSanJose('R-1-8').maxFAR).toBeNull()
    expect(resolveSanJose('DC').maxFAR).toBeNull()
    expect(resolveSanJose('R-1-8').farUnconstrained).toBe(true)
    expect(resolveSanJose('DC').farUnconstrained).toBe(false)
  })

  it('returns null for absent or malformed input', () => {
    for (const bad of [null, undefined, '', '   ', 'Unknown']) {
      expect(sanJoseZoneKey(bad)).toBeNull()
      expect(resolveSanJose(bad).farUnconstrained).toBe(false)
    }
  })

  it('normalises case and whitespace', () => {
    expect(sanJoseZoneKey('r-1-8')).toBe('R-1-8')
    expect(sanJoseZoneKey(' R-MH ')).toBe('R-MH')
  })
})

describe('the three tables read on 2026-08-14', () => {
  // Table 20-40's FAR row is ['Maximum Floor Area Ratio', 'none', '.80'] — the
  // two cells DISAGREE, and flattened page text drops the second one. Reading
  // it flat would have published a fabricated absence for A.
  it('A agricultural states a real FAR of 0.80', () => {
    const r = resolveSanJose('A')
    expect(r.maxFAR).toBe(0.8)
    expect(r.farUnconstrained).toBe(false)
    expect(r.source).toContain('20-40')
  })

  it('OS open space states "none" in the same row', () => {
    const r = resolveSanJose('OS')
    expect(r.maxFAR).toBeNull()
    expect(r.farUnconstrained).toBe(true)
    expect(r.source).toContain('20-40')
  })

  // Tables 20-120 and 20-100 have NO FAR row — not a blank cell, no row. That
  // is the slot test answering from the table's own structure.
  it.each(['CIC', 'TEC', 'IP', 'LI', 'HI'])('industrial %s reports no FAR as an answer', (code) => {
    const r = resolveSanJose(code)
    expect(r.farUnconstrained).toBe(true)
    expect(r.maxFAR).toBeNull()
    expect(r.source).toContain('20-120')
  })

  it.each(['CO', 'CP', 'CN', 'CG', 'PQP'])('commercial %s reports no FAR as an answer', (code) => {
    const r = resolveSanJose(code)
    expect(r.farUnconstrained).toBe(true)
    expect(r.maxFAR).toBeNull()
    expect(r.source).toContain('20-100')
  })

  it('never turns the A district into an absence', () => {
    // The regression the flattened-text read would have caused.
    expect(resolveSanJose('A').farUnconstrained).toBe(false)
    expect(resolveSanJose('A').maxFAR).not.toBeNull()
  })
})
