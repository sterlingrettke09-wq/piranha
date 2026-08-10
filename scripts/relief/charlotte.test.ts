import { describe, it, expect } from 'vitest'
// @ts-expect-error — the pipeline is plain .mjs (offline script, outside tsc's
// project); only its two pure parsers are imported here.
import { parseFilingDate, caseYear } from './charlotte.mjs'

// WHAT THIS TEST DEFENDS
//
// Charlotte's `Decision_Date` is an esriFieldTypeString, not a date field, and
// it carries junk years: measured live 2026-08-10, '12-30-1899' ×7,
// '09-07-0202' ×1, '09-25-2912' ×1. A parser that COERCES those (Date.parse
// happily takes '09-07-0202') turns a corrupt stamp into a silently
// out-of-window row — a defect that produces no error and no null, only a
// slightly different denominator. A parser that REJECTS them makes the same
// rows countable, which is what the leakage gate audits.
//
// `caseYear` is load-bearing for a different reason: the audit universe is
// built from case-number years precisely because it must see cases the date
// frame dropped, and the dedup key is the case number, so a placeholder like
// '<Null>' passing the parse would merge unrelated cases into one.

describe('parseFilingDate — fails closed on the live junk values', () => {
  it('rejects, and does not coerce, every out-of-band year in the live feed', () => {
    // These three strings exist in the published layer today.
    expect(parseFilingDate('12-30-1899')).toBeNull()
    expect(parseFilingDate('09-07-0202')).toBeNull()
    expect(parseFilingDate('09-25-2912')).toBeNull()
  })

  it('accepts a real MM-DD-YYYY stamp and returns its parts', () => {
    expect(parseFilingDate('12-04-2025')).toEqual({ year: 2025, month: 12, day: 4 })
    expect(parseFilingDate('1-5-2021')).toEqual({ year: 2021, month: 1, day: 5 })
    expect(parseFilingDate('  02-24-2026  ')).toEqual({ year: 2026, month: 2, day: 24 })
  })

  it('rejects blanks, nulls and anything that is not exactly MM-DD-YYYY', () => {
    for (const bad of [
      null,
      undefined,
      '',
      '   ',
      '2025-12-04', // ISO — the field is never this, and reading it as MM-DD would be nonsense
      '12/04/2025',
      '12-04-25',
      '13-04-2025', // month 13
      '12-32-2025', // day 32
      'Granted',
    ]) {
      expect(parseFilingDate(bad as string), `${JSON.stringify(bad)} must be rejected`).toBeNull()
    }
  })
})

describe('caseYear — the audit universe key', () => {
  it('reads the year off a bare YYYY-NNNNN case number', () => {
    expect(caseYear('2025-00043')).toBe(2025)
    expect(caseYear('2022-001')).toBe(2022)
  })

  it('rejects placeholders and foreign-track prefixes rather than guessing a year', () => {
    // '<Null>' and '2021089' both exist in the layer; UDOAA-/ACRB-/APL- are the
    // administrative-adjustment, alternative-compliance and appeal tracks.
    for (const bad of ['<Null>', '2021089', '', 'UDOAA-2025-00012', 'ACRB-2024-1', 'APL-2023-7']) {
      expect(caseYear(bad), `${JSON.stringify(bad)} must not yield a year`).toBeNull()
    }
  })
})
