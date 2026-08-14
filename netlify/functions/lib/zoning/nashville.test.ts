import { describe, it, expect } from 'vitest'
import { resolveNashville, nashvilleZoneKey, NASHVILLE_DISTRICT_CODES } from './nashville'

// Every figure here was read from Metro Code § 17.12.020 via the table's OWN
// header row, not by cell position. A first pass that assumed the FAR column
// sat at the same index in all four tables produced Max. ISR values for Table
// C — MUN 0.80, CN 0.80, CF 1.00 — each a plausible FAR that nothing
// downstream would have flagged.

describe('inventory', () => {
  it('pins the district set (rule 20 — a check that can pass on an empty set is not a check)', () => {
    expect(NASHVILLE_DISTRICT_CODES.length).toBe(73)
    expect(NASHVILLE_DISTRICT_CODES).toEqual(
      expect.arrayContaining(['AG', 'RS10', 'RM2', 'RM60', 'MUG', 'CN', 'IWD', 'RM100-A', 'DTC', 'SP']),
    )
  })
})

describe('Table C column alignment — the regression this module nearly shipped', () => {
  // These four are the exact cells an off-by-one turns into the ISR column.
  // If any of them ever reads 0.80 / 0.80 / 1.00 / 0.90, the FAR index has
  // drifted back to a sibling table's position.
  it.each([
    ['MUN', 0.6],
    ['CN', 0.25],
    ['CF', 5.0],
    ['ORI', 3.0],
  ])('%s resolves to the FAR column value %f, not the ISR one', (code, far) => {
    expect(resolveNashville(code).maxFAR).toBe(far)
  })
})

describe('stated FARs', () => {
  it.each([
    ['AG', 0.4],
    ['RS10', 0.4],
    ['R10', 0.4],
    ['R8', 0.5],
    ['RS7.5', 0.5],
    ['R6', 0.6],
    ['RS3.75', 0.6],
    ['RM2', 0.4],
    ['RM4', 0.4],
    ['RM6', 0.6],
    ['RM9', 0.6],
    ['MUL', 1.0],
    ['MUI', 5.0],
    ['OL', 0.75],
    ['OG', 1.5],
    ['SCC', 0.5],
    ['IWD', 0.8],
    ['MUG-A', 3.0],
    ['CL-A', 0.6],
  ])('%s = FAR %f', (code, far) => {
    const r = resolveNashville(code)
    expect(r.maxFAR).toBe(far)
    expect(r.kind).toBe('stated')
    expect(r.farUnconstrained).toBe(false)
  })
})

describe('affirmative absences (rule 5)', () => {
  // Table B Note 2 and Table D Note 1 both state that no maximum FAR applies to
  // MULTIFAMILY development in these districts. That is an ANSWER — floor area
  // is governed by ISR, setbacks and the height control plane instead — and it
  // must not render the same as a district nobody has looked up.
  it.each(['RM15', 'RM20', 'OR20', 'RM40', 'OR40', 'RM60', 'RM9-A', 'RM15-A', 'RM20-A', 'OR40-A'])(
    '%s reports no FAR as a known absence, not a null',
    (code) => {
      const r = resolveNashville(code)
      expect(r.farUnconstrained).toBe(true)
      expect(r.kind).toBe('unconstrained')
      expect(r.maxFAR).toBeNull()
      expect(r.source).toMatch(/No maximum FAR applies|Table 17\.12\.020D/)
    },
  )

  it('RM60-A, RM80-A and RM100-A take their absence from the cell, which reads "None"', () => {
    for (const c of ['RM60-A', 'RM80-A', 'RM100-A']) {
      expect(resolveNashville(c).farUnconstrained).toBe(true)
    }
  })

  // The districts whose OWN cell states a number must never be converted to an
  // absence — Note 2 lifts the cap only for the multifamily case, and RM2/RM4/
  // RM6/RM9 are not in its list.
  it('does not spread Note 2 to the RM districts it does not name', () => {
    for (const c of ['RM2', 'RM4', 'RM6', 'RM9']) {
      expect(resolveNashville(c).farUnconstrained).toBe(false)
      expect(resolveNashville(c).maxFAR).not.toBeNull()
    }
  })
})

describe('gaps stay gaps (rule 23)', () => {
  // A cross-reference to an unread chapter is NOT an absence. Each of these
  // must report no limit AND no absence, so the pipeline withholds a verdict.
  it.each(['DTC', 'MHP', 'SP', 'SP-2019-123'])('%s resolves to a gap, not an answer', (code) => {
    const r = resolveNashville(code)
    expect(r.maxFAR).toBeNull()
    expect(r.farUnconstrained).toBe(false)
    expect(r.kind).toBe('elsewhere')
    // The source explains the gap; it does not license an answer.
    expect(r.source).toBeTruthy()
  })

  it('DTC — the district the null inventory probes — is still a gap until Ch. 17.37 is read', () => {
    // If this ever starts resolving without 17.37 having been read, something
    // has invented a downtown FAR.
    expect(resolveNashville('DTC').maxFAR).toBeNull()
    expect(resolveNashville('DTC').source).toContain('17.37')
  })

  it('returns null for unknown, absent or malformed districts', () => {
    for (const bad of [null, undefined, '', '  ', 'Satellite City', 'ZZZ-9']) {
      expect(nashvilleZoneKey(bad)).toBeNull()
      expect(resolveNashville(bad).kind).toBeNull()
    }
  })

  it('normalises case and whitespace', () => {
    expect(nashvilleZoneKey('rm20-a')).toBe('RM20-A')
    expect(nashvilleZoneKey(' CL ')).toBe('CL')
    expect(nashvilleZoneKey('RS 7.5')).toBe('RS7.5')
  })
})

describe('single-family bulk is a structural absence in Table A', () => {
  // Table 17.12.020A has NO FAR column: its columns are lot area, building
  // coverage, setbacks and height. The FARs this module carries for RS/R
  // districts come from Table B and govern multifamily and NONRESIDENTIAL
  // development. This test documents that the module never claims a
  // single-family FAR, because the code states none.
  it('carries no separate single-family FAR entry', () => {
    expect(NASHVILLE_DISTRICT_CODES.filter((c) => /-SF$|SINGLE/i.test(c))).toEqual([])
  })
})

describe('the -NS short-term-rental overlay', () => {
  // RM40-A-NS was the single remaining developable gap in Nashville's
  // 2026-08-14 sample. NS is a USE overlay — BL2019-111 prohibits short-term
  // rental property in NS districts — so it changes nothing dimensional and the
  // base district's floor-area rule applies unchanged.
  it.each([
    ['RM40-A-NS', 'RM40-A'],
    ['RM20-A-NS', 'RM20-A'],
    ['RM15-A-NS', 'RM15-A'],
    ['RM60-A-NS', 'RM60-A'],
  ])('%s resolves as its base district %s', (suffixed, base) => {
    expect(nashvilleZoneKey(suffixed)).toBe(base)
    expect(resolveNashville(suffixed)).toEqual(resolveNashville(base))
  })

  it('does not alter the base district FAR in either direction', () => {
    // RM40-A is an affirmative absence via Table D Note 1. Stripping the
    // overlay must not turn that into a number, nor into a gap.
    const r = resolveNashville('RM40-A-NS')
    expect(r.farUnconstrained).toBe(true)
    expect(r.maxFAR).toBeNull()
    expect(r.kind).toBe('unconstrained')
  })

  it('strips ONLY -NS, never an unread suffix', () => {
    // Resolving a district by discarding the part that might change the answer
    // is worse than the gap it closes. Any other suffix stays unresolved.
    for (const code of ['RM40-A-XX', 'RM40-A-UZO', 'RS10-HP', 'MUG-CN', 'CL-ZZ']) {
      expect(nashvilleZoneKey(code), `${code} must not be stripped`).toBeNull()
    }
  })

  it('does not invent a base district that does not exist', () => {
    // "-NS" hung off something not in the table stays a gap.
    expect(nashvilleZoneKey('ZZZ-NS')).toBeNull()
    expect(nashvilleZoneKey('-NS')).toBeNull()
  })
})
