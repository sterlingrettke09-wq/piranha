import { describe, it, expect } from 'vitest'
import { resolveSfFar } from './sf'

// SF Planning Code §124, supplement 2026 S-96, read from the primary text
// 2026-08-04. §124(b) verbatim: "In R, RC, NC, and Mixed Use Districts, Floor
// Area Ratio limits shall not apply to Residential Uses."

describe('SF §124(b) — residential FAR exemption is a KNOWN ABSENCE', () => {
  it.each(['RH-1', 'RH-1(D)', 'RH-2', 'RM-1', 'RM-4', 'RTO', 'RED', 'RED-MX'])(
    'R district %s exempts residential',
    (z) => {
      const r = resolveSfFar(z)
      expect(r.residentialExempt).toBe(true)
      expect(r.maxFAR).toBeNull() // no FAR binds the residential headline
    },
  )

  it.each(['RC-3', 'RC-4'])('RC district %s exempts residential', (z) => {
    expect(resolveSfFar(z).residentialExempt).toBe(true)
  })

  it.each(['NC-1', 'NC-2', 'NC-3', 'NC-S', 'NCT-2', 'NCD-CASTRO', 'NCT-24TH-MISSION'])(
    'NC district %s exempts residential',
    (z) => {
      expect(resolveSfFar(z).residentialExempt).toBe(true)
    },
  )

  it.each(['MUG', 'MUO', 'MUR', 'UMU', 'WMUG', 'WMUO'])(
    'Mixed Use district %s exempts residential',
    (z) => {
      expect(resolveSfFar(z).residentialExempt).toBe(true)
    },
  )
})

describe('SF — districts OUTSIDE §124(b) keep a FAR that binds every use', () => {
  it.each([
    ['C-2', 3.6], ['C-3-S', 5.0], ['C-3-G', 6.0], ['C-3-R', 6.0],
    ['C-3-O(SD)', 6.0], ['C-3-O', 9.0], ['M-1', 5.0], ['M-2', 5.0],
  ])('%s → maxFAR %s', (z, far) => {
    const r = resolveSfFar(z as string)
    expect(r.residentialExempt).toBe(false)
    expect(r.maxFAR).toBe(far)
  })
})

describe('SF — the exemption is per-USE, not per-district', () => {
  it('RH-1 has no residential FAR but a 1.8 non-residential FAR (Table 124)', () => {
    const r = resolveSfFar('RH-1')
    expect(r.maxFAR).toBeNull()
    expect(r.residentialExempt).toBe(true)
    expect(r.nonResidentialFAR).toBe(1.8)
  })

  it.each([['NC-2', 2.5], ['NC-3', 3.6], ['RM-4', 4.8], ['CRNC', 1.0], ['CVR', 2.0], ['CCB', 2.8]])(
    '%s non-residential FAR %s',
    (z, far) => {
      expect(resolveSfFar(z as string).nonResidentialFAR).toBe(far)
    },
  )
})

describe('SF — never guesses', () => {
  it('a named NCD carries the exemption but no inferred Table 124 number', () => {
    // Named neighbourhood districts have their own published figure that is not
    // keyed on the family prefix, so we must not infer one from "NCD".
    const r = resolveSfFar('NCD-HAIGHT')
    expect(r.residentialExempt).toBe(true)
    expect(r.nonResidentialFAR).toBeNull()
  })

  it('returns all-null for unmatched or missing codes', () => {
    for (const z of ['PDR-1-G', 'HP-RA', 'Job Corps', 'NOT-A-ZONE', '', null, undefined]) {
      const r = resolveSfFar(z as string | null | undefined)
      expect(r.maxFAR, String(z)).toBeNull()
      expect(r.nonResidentialFAR, String(z)).toBeNull()
    }
  })

  it('does NOT treat SALI as an exempt Mixed Use district', () => {
    // Table 124 groups SALI with the MU rows, but §124(b) names "Mixed Use
    // Districts" and SALI is Service/Arts/Light Industrial. Asserting the
    // exemption would claim more than the text gives.
    expect(resolveSfFar('SALI').residentialExempt).toBe(false)
  })
})
