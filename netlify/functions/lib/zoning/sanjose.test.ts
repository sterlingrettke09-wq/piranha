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
  it('pins the eight districts of § 20.30.200 (rule 20)', () => {
    expect(SAN_JOSE_ZONE_CODES.length).toBe(8)
    expect([...SAN_JOSE_ZONE_CODES].sort()).toEqual(
      ['R-1-1', 'R-1-2', 'R-1-5', 'R-1-8', 'R-1-RR', 'R-2', 'R-M', 'R-MH'].sort(),
    )
  })
})

describe('the FAR finding', () => {
  // § 20.30.200's "Floor area ratio" row holds a cross-reference, and the
  // referenced clause is a permit-exemption test, not a cap. So every district
  // this module knows reports a KNOWN ABSENCE rather than a number.
  it.each(SAN_JOSE_ZONE_CODES)('%s reports no by-right FAR as an answer', (code) => {
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
      expect(resolveSanJose(code).maxFAR).toBeNull()
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

  it.each(['CN', 'CG', 'CP', 'IP', 'LI', 'HI', 'DC', 'MS-G', 'MS-C', 'PQP', 'OS'])(
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
    expect(resolveSanJose('R-1-8').maxFAR).toBeNull()
    expect(resolveSanJose('CN').maxFAR).toBeNull()
    expect(resolveSanJose('R-1-8').farUnconstrained).toBe(true)
    expect(resolveSanJose('CN').farUnconstrained).toBe(false)
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
