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
  // These eleven built-form districts sat here asserting null until 2026-08-15,
  // on the stated grounds that Table 540-2 was unread. It was not unread — it
  // had been read in the HANDBOOK, whose multi-column layout does not
  // linearise. The ordinance's own Table 540-2 states each district as a plain
  // two-value row and extracts cleanly. Rule 15 again: the assertion encoded an
  // interpretation ("this cannot be read"), stayed green, and was wrong. Their
  // figures are now asserted in the block at the foot of this file.
  //
  // The describe block is kept because its POINT still holds — an overlay this
  // module does not know must return null rather than a zero — and the test
  // below is the one that enforces it.

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

describe('Table 540-2 — Corridor, Transit, Core 50, Production, Parks', () => {
  // Read 2026-08-15 from the ADOPTED Chapter 540 PDF (minneapolis2040.com
  // media/1972). media/1906 is the DRAFT — it opens with the word "DRAFT" and
  // differs in length. Encoding it would publish proposed figures as current.
  it.each([
    ['BFC3', 1.5, 1.9],
    ['BFC4', 2.0, 2.4],
    ['BFC6', 3.0, 3.4],
    ['BFT10', 5.0, 5.4],
    ['BFT15', 6.0, 6.4],
    ['BFT20', 7.0, 7.4],
    ['BFT30A', 10.0, 10.4],
    ['BFT30B', 10.0, 10.4],
  ])('%s: UN/RM %f, all other districts %f', (bf, unRm, other) => {
    expect(resolveMinneapolisFar(bf, 'UN2').maxFAR).toBe(unRm)
    expect(resolveMinneapolisFar(bf, 'RM1').maxFAR).toBe(unRm)
    expect(resolveMinneapolisFar(bf, 'CM2').maxFAR).toBe(other)
    expect(resolveMinneapolisFar(bf, 'I2').maxFAR).toBe(other)
  })

  it('Transit 30 is ONE row in the table despite two mapped abbreviations', () => {
    expect(resolveMinneapolisFar('BFT30A', 'UN1')).toEqual(resolveMinneapolisFar('BFT30B', 'UN1'))
    expect(resolveMinneapolisFar('BFT30A', 'CM4')).toEqual(resolveMinneapolisFar('BFT30B', 'CM4'))
  })

  it('Core 50 and Production read "All primary districts" — no UN/RM split', () => {
    for (const z of ['UN1', 'RM2', 'CM2', 'I3', null]) {
      expect(resolveMinneapolisFar('BFC50', z).maxFAR).toBe(16.0)
      expect(resolveMinneapolisFar('BFPR', z).maxFAR).toBe(3.0)
    }
  })

  // ⚠️ THE ROW THAT BREAKS THE PATTERN. Parks groups on "UN" ALONE; every other
  // row groups "UN, RM". Reusing the UN/RM test here would put an RM parcel on
  // the 0.5 row when the table puts it under "All other districts" at 2.0 — a
  // fourfold understatement.
  it('Parks groups on UN alone, so RM takes the all-other 2.0', () => {
    expect(resolveMinneapolisFar('BFPA', 'UN3').maxFAR).toBe(0.5)
    expect(resolveMinneapolisFar('BFPA', 'RM1').maxFAR).toBe(2.0)
    expect(resolveMinneapolisFar('BFPA', 'CM2').maxFAR).toBe(2.0)
  })

  it('Parks UN offers the other-uses figure as an alternative, not the headline', () => {
    const r = resolveMinneapolisFar('BFPA', 'UN1')
    expect(r.maxFAR).toBe(0.5)
    expect(r.alternatives.find((a) => a.label === 'Other uses')?.far).toBe(0.8)
  })

  it('every newly read district carries the 0.7 cluster figure (Table 540-3)', () => {
    for (const bf of ['BFC3', 'BFC6', 'BFT10', 'BFT30A', 'BFC50', 'BFPR', 'BFPA']) {
      const r = resolveMinneapolisFar(bf, 'CM2')
      expect(r.alternatives.some((a) => a.label === 'Cluster development' && a.far === 0.7)).toBe(true)
    }
  })

  it('an unknown overlay abbreviation is still a gap, never a zero', () => {
    for (const bf of ['BFX9', 'ZZZ', '', null, undefined]) {
      expect(resolveMinneapolisFar(bf, 'UN1').maxFAR).toBeNull()
    }
  })

  // Rule 6: a premium is EARNED, not by-right. If Article III is ever encoded
  // it belongs in alternatives — the headline must stay the base figure.
  it('publishes no premium in the headline', () => {
    expect(resolveMinneapolisFar('BFT30A', 'CM2').maxFAR).toBe(10.4)
    expect(resolveMinneapolisFar('BFC50', 'CM2').maxFAR).toBe(16.0)
  })
})
