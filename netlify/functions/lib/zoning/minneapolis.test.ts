import { describe, it, expect } from 'vitest'
import { resolveMinneapolisFar } from './minneapolis'

// Source of record: Minneapolis Code of Ordinances, Title 20 — Zoning Code,
// effective July 1, 2023, §540.110, Table 540-2 (pp.127-128) and Table 540-3
// (p.128). Read from rendered page images of the ordinance PDF 2026-08-05.
//
// NOT the Built Form Districts Handbook (Oct 2023) — its Interior 2 page
// transposes the "Cluster Developments" and "Institutional and Civic Uses"
// columns, and that transposition is what shipped here.

describe('Minneapolis cluster developments — Table 540-3, ONE column', () => {
  // §540.110(a) applies Table 540-2 to "principal structures, except cluster
  // developments"; §540.110(b) sends cluster developments to Table 540-3:
  //   Interior 1 / Interior 2 (merged cell) .... 0.5
  //   All other districts ...................... 0.7

  it('BFI2 cluster is 0.5 — NOT the 0.8 (UN/RM) / 1.4 (other) we used to publish', () => {
    // Regression: the old values came from the handbook's transposed Interior 2
    // row. If either 0.8 or 1.4 reappears here, the handbook won the argument.
    for (const primary of ['UN1', 'UN2', 'UN3', 'RM1', 'RM2', 'CM2', 'DT1', 'PR1', 'TR1']) {
      const far = resolveMinneapolisFar('BFI2', primary).alternatives.find(
        (a) => a.label === 'Cluster development',
      )?.far
      expect(far, primary).toBe(0.5)
      expect(far, primary).not.toBe(0.8)
      expect(far, primary).not.toBe(1.4)
    }
  })

  it('Table 540-3 has no primary-zoning column, so cluster FAR cannot vary by it', () => {
    // The whole defect was a UN/RM split applied to a table that has none.
    for (const bf of ['BFI1', 'BFI2', 'BFI3']) {
      const unRm = resolveMinneapolisFar(bf, 'UN1').alternatives.find(
        (a) => a.label === 'Cluster development',
      )?.far
      const other = resolveMinneapolisFar(bf, 'CM4').alternatives.find(
        (a) => a.label === 'Cluster development',
      )?.far
      expect(unRm, bf).toBe(other)
      expect(unRm, bf).toBeTypeOf('number')
    }
  })

  it('pins each Interior district to its Table 540-3 row', () => {
    const cluster = (bf: string) =>
      resolveMinneapolisFar(bf, 'UN1').alternatives.find((a) => a.label === 'Cluster development')
        ?.far
    expect(cluster('BFI1')).toBe(0.5) // Table 540-3, Interior 1/Interior 2 merged cell
    expect(cluster('BFI2')).toBe(0.5) // Table 540-3, same merged cell
    expect(cluster('BFI3')).toBe(0.7) // Table 540-3, "All other districts"
  })

  it('cluster development stays an ALTERNATIVE and never becomes the headline', () => {
    // Rule 6: a program the user has not chosen. It is smaller than the BFI2
    // "other uses" figure and larger than nothing — either way maxFAR is the
    // Table 540-2 base for a 1-3 unit dwelling.
    for (const bf of ['BFI1', 'BFI2', 'BFI3']) {
      expect(resolveMinneapolisFar(bf, 'UN1').maxFAR, bf).toBe(0.5)
    }
  })
})

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
