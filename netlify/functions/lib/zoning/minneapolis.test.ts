import { describe, it, expect } from 'vitest'
import { resolveMinneapolisFar } from './minneapolis'

// City of Minneapolis Built Form Districts Handbook (Oct 2023), Interior 1/2/3
// district pages, read from the primary PDF 2026-08-04.

describe('Minneapolis FAR needs BOTH layers', () => {
  it('the UN/RM split keys on the PRIMARY zoning district, not the overlay', () => {
    // Interior 2, "all other uses": UN/RM 0.8 vs all other districts 1.4.
    const un = resolveMinneapolisFar('BFI2', 'UN1')
    const cm = resolveMinneapolisFar('BFI2', 'CM2')
    expect(un.alternatives.find((a) => a.label === 'Other uses')?.far).toBe(0.8)
    expect(cm.alternatives.find((a) => a.label === 'Other uses')?.far).toBe(1.4)
  })

  it('Interior 3 gives 2- and 3-unit dwellings MORE than a single-family house', () => {
    // The only Interior district that does, and the reform this tool exists to show.
    const r = resolveMinneapolisFar('BFI3', 'UN2')
    expect(r.maxFAR).toBe(0.5)
    expect(r.alternatives.find((a) => a.label === 'Two-family')?.far).toBe(0.6)
    expect(r.alternatives.find((a) => a.label === 'Three-family')?.far).toBe(0.7)
    expect(r.alternatives.find((a) => a.label === '4+ units')?.far).toBe(1.4)
  })

  it('Interior 1 offers no multifamily alternative — 4+ units are not allowed there', () => {
    const r = resolveMinneapolisFar('BFI1', 'UN1')
    expect(r.maxFAR).toBe(0.5)
    expect(r.alternatives.some((a) => a.label === '4+ units')).toBe(false)
  })
})

describe('Minneapolis — unread districts stay UNRESOLVED, never guessed', () => {
  it.each(['BFC3', 'BFC4', 'BFC6', 'BFC50', 'BFT10', 'BFT15', 'BFT20', 'BFT30A', 'BFT30B', 'BFPR', 'BFPA'])(
    '%s returns null (base FAR + earned premiums, Table 540-2 unread)',
    (bf) => {
      const r = resolveMinneapolisFar(bf, 'UN1')
      expect(r.maxFAR).toBeNull()
      expect(r.alternatives).toHaveLength(0)
    },
  )

  it('returns null for a missing or unknown built form', () => {
    for (const bf of [null, undefined, '', 'NOT-A-DISTRICT']) {
      expect(resolveMinneapolisFar(bf, 'UN1').maxFAR).toBeNull()
    }
  })

  it('never treats the OLD Chapter 546 districts as valid input', () => {
    // Municode publishes R1/R1A/R2/R2B/R3-R6 — a superseded code that matches
    // zero live parcels. Passing one must not resolve anything.
    for (const old of ['R1', 'R2B', 'R4', 'R6']) {
      expect(resolveMinneapolisFar(old, 'UN1').maxFAR, old).toBeNull()
    }
  })
})
