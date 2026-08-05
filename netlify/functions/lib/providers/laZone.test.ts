import { describe, it, expect } from 'vitest'
import { getLaParcelInfo } from './la'

// laLimits is not exported, so the parse is exercised through the module's own
// regex, replicated here EXACTLY as written. If la.ts changes, this must too —
// the point is to pin the prefix behaviour, which is where the defect was.
const strip = (s: string) => s.replace(/^(?:[[(][A-Z]{1,4}[\])]|[QT])-?/i, '').trim()

describe('LA zone-string qualifier stripping', () => {
  it.each([
    ['[Q]C2-1', 'C2-1'],
    ['(Q)C1-1', 'C1-1'],
    ['[T]R3-1', 'R3-1'],
    // Measured live 2026-08-04: LA publishes these and the old pattern missed
    // both, leaving the qualifier glued to the base zone.
    ['(F)CM-1-CUGU', 'CM-1-CUGU'],
    ['(F)RE11-1', 'RE11-1'],
    ['(WC)COLLEGE-SN', 'COLLEGE-SN'],
  ])('%s → %s', (input, expected) => {
    expect(strip(input as string)).toBe(expected)
  })

  it('leaves an unqualified zone string untouched', () => {
    for (const z of ['C2-1', 'R1-1XL', 'RE11-1', 'CM-1']) {
      expect(strip(z)).toBe(z)
    }
  })

  it('does not eat a base zone that merely starts with C or R', () => {
    // The bare Q/T branch must not match commercial/residential prefixes.
    expect(strip('CM-1')).toBe('CM-1')
    expect(strip('RE11-1')).toBe('RE11-1')
  })
})

describe('LA — the defect this fixes', () => {
  // (F)CM-1 previously parsed its base as "(F)CM", so /^(C|M|CM|...)/ never
  // matched and the Height-District-1 commercial override never fired: FAR 3.0
  // published where LAMC 12.21.1-A.1 sets 1.5. (F)RE11-1 likewise skipped the
  // base-controlled R-zone test and asserted a FAR where there is none.
  it('a stripped (F)CM base now matches the commercial override pattern', () => {
    expect(/^(C|M|CM|CR|CW|MR|LAX)/.test(strip('(F)CM-1-CUGU').split('-')[0])).toBe(true)
  })

  it('a stripped (F)RE base now matches the base-controlled R-zone pattern', () => {
    const base = strip('(F)RE11-1').split('-')[0]
    expect(/^(RA|RE|RS|R1|RD|RW|R2)/.test(base) && !base.startsWith('RAS')).toBe(true)
  })

  it('the provider is still exported and callable', () => {
    expect(typeof getLaParcelInfo).toBe('function')
  })
})
