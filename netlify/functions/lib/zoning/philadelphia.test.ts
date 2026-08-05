import { describe, it, expect } from 'vitest'
import { parseMaxHeightFt, parseMaxFAR } from './philadelphia'

// Philadelphia publishes MaxHeight/MaxFAR in ZoningCodeCharacteristics as FREE
// TEXT, not numbers. The parser returns a number ONLY for unambiguous forms;
// anything conditional, percent-of-lot-area, or prose degrades to null so the UI
// reports "not in public data" rather than a fabricated limit.
// Raw strings below are verbatim from the live layer (recon 2026-08-01).

describe('parseMaxHeightFt', () => {
  it('parses a plain height in feet', () => {
    expect(parseMaxHeightFt('38 ft.')).toBe(38)
    expect(parseMaxHeightFt('55 ft.')).toBe(55)
    expect(parseMaxHeightFt('  100 ft  ')).toBe(100)
    expect(parseMaxHeightFt('45 feet')).toBe(45)
    expect(parseMaxHeightFt('38')).toBe(38)
  })

  it('returns null for CONDITIONAL heights — must not report a flat number', () => {
    // I-1/I-2/I-3: reporting a flat 60 here would be wrong for most lots.
    expect(parseMaxHeightFt('60 if abutting a\r\nResidential or SP-PO\r\ndistrict;\r\notherwise no limit;')).toBeNull()
    expect(parseMaxHeightFt('35 ft. if adjacent to a residential district')).toBeNull()
    expect(parseMaxHeightFt('varies by lot width')).toBeNull()
    expect(parseMaxHeightFt('determined by the Zoning Board')).toBeNull()
  })

  it('returns null for "no limit" and prose (unknown ≠ unlimited, but never fabricate)', () => {
    expect(parseMaxHeightFt('no limit')).toBeNull()
    expect(parseMaxHeightFt('based on the requirements of adjacent residential zoning districts')).toBeNull()
  })

  it('returns null for empty / missing values', () => {
    expect(parseMaxHeightFt('')).toBeNull()
    expect(parseMaxHeightFt('   ')).toBeNull()
    expect(parseMaxHeightFt(null)).toBeNull()
    expect(parseMaxHeightFt(undefined)).toBeNull()
    expect(parseMaxHeightFt('n/a')).toBeNull()
  })
})

describe('parseMaxFAR', () => {
  it('parses a bare percentage as FAR (1200% = FAR 12.0)', () => {
    expect(parseMaxFAR('500%')).toBe(5)
    expect(parseMaxFAR('1200%')).toBe(12)
    expect(parseMaxFAR('250%')).toBe(2.5)
  })

  it('takes the BASE figure when a bonus tier follows (conservative floor)', () => {
    // CMX-5: 1200% base; 1600% only for certain Center City/University City lots.
    // The by-right floor is 12.0 — never quote the bonus as if it were by-right.
    expect(parseMaxFAR('1200%;\n1600% for certain lots within Center City/University City FAR Map*')).toBe(12)
  })

  it('returns null when the percentage has a DIFFERENT denominator', () => {
    // ⚠️ CORRECTED 2026-08-05. This test previously asserted that
    // "70% of Lot Area" is lot coverage and must return null. That was wrong:
    // floor area as a percentage of LOT AREA is the definition of a
    // floor-area ratio, and Philadelphia's Zoning Quick Guide (PCPC, Feb 2026)
    // labels the RM diagrams "FAR = 70% of Lot Area". The test was pinning the
    // defect. See the "% of Lot Area IS the FAR expression" block below.
    //
    // RMX-1/2 measure across a whole DISTRICT — that genuinely cannot be
    // applied to one parcel, and stays rejected.
    expect(parseMaxFAR('% of District Area (excluding streets)')).toBeNull()
    expect(parseMaxFAR('60% of District Area (excluding streets)')).toBeNull()
    // Lot COVERAGE is footprint, not floor area — also still rejected.
    expect(parseMaxFAR('60% lot coverage')).toBeNull()
  })

  it('returns null for prose / conditional / empty', () => {
    expect(parseMaxFAR('based on the requirements of adjacent residential zoning districts')).toBeNull()
    expect(parseMaxFAR('none')).toBeNull()
    expect(parseMaxFAR('')).toBeNull()
    expect(parseMaxFAR(null)).toBeNull()
    expect(parseMaxFAR(undefined)).toBeNull()
  })

  it('rejects absurd values rather than trusting a malformed row', () => {
    expect(parseMaxFAR('0%')).toBeNull()
    expect(parseMaxFAR('99999%')).toBeNull() // FAR 999 — data error, not a real limit
  })
})

// Regression guard: verbatim values from a full sweep of the live
// ZoningCodeCharacteristics layer (all 36 rows, fetched 2026-08-03). If the city
// re-authors these strings, this is what tells us before users see it.
describe('real Philadelphia districts (live sweep 2026-08-03)', () => {
  const CASES: [district: string, rawHeight: string | null, rawFar: string | null, height: number | null, far: number | null][] = [
    ['RSA-5', '38 ft.', null, 38, null], // the classic rowhouse district
    ['RM-1', '38 ft.', null, 38, null],
    ['CMX-2', '38 ft.', null, 38, null],
    ['CMX-2.5', '55 ft.', null, 55, null],
    ['IRMX', '60 ft.', '500%', 60, 5],
    ['ICMX', '60 ft.', '500%', 60, 5],
    // Height is conditional on abutting a residential district → null; FAR is flat.
    ['I-1', '60 if abutting a  Residential or SP-PO  district;  otherwise no limit;', '500%', null, 5],
    ['CMX-3', null, '500%*', null, 5], // trailing footnote marker is fine
    ['CMX-4', null, '500%*', null, 5],
    ['CMX-5', null, '1200%; 1600% for certain lots within Center City/University City FAR Map*', null, 12],
    ['RMX-3', null, '500%*', null, 5],
    // Percentages against a different denominator must NOT become FAR.
    // FAR now resolves — see the correction note above. Heights stay null:
    // the RM districts publish height as a diagram/table reference, not a figure.
    ['RM-2', null, '70% of Lot Area', null, 0.7],
    ['RM-3', null, '150% of Lot Area', null, 1.5],
    ['RM-4', null, '350% of Lot Area', null, 3.5],
    ['RMX-1', null, '150% of District Area  (excluding streets)', null, null],
    ['RMX-2', null, '250% of District Area  (excluding streets)', null, null],
    // Prose / conditional / dual-expression forms.
    ['CMX-1', 'CMX-1 Occupied Area, Building Dimensions, and Height', 'CMX-1 Occupied Area, Building Dimensions', null, null],
    ['SP-ENT', '300 feet or 30 stories', null, null, null],
    ['SP-STA', '38 ft. to 150 ft. depending on use', null, null, null],
    ['SP-INS', 'N/A or 20 ft. above max. height of  adjacent residential', null, null, null],
    ['SP-AIR', 'Varies under the Airport Hazard Control Overlay', null, null, null],
  ]
  it.each(CASES)('%s → height %s, FAR %s', (_district, rawHeight, rawFar, height, far) => {
    expect(parseMaxHeightFt(rawHeight)).toBe(height)
    expect(parseMaxFAR(rawFar)).toBe(far)
  })
})

// ── The enumeration check found this (2026-08-05) ──
// Enumerating the live distinct values of the field the parser consumes — not
// the forms we expected — showed 6 of 9 MaxFAR values unhandled. Three of them
// were Philadelphia's higher-density residential districts, whose FAR the code
// publishes as a percentage OF LOT AREA. That is the definition of a
// floor-area ratio; the parser was rejecting it as a foreign denominator.
//
// Source: Philadelphia Zoning Quick Guide (PCPC, Feb 2026), RM district
// diagrams: "FAR = 70% of Lot Area" / "= 150% of Lot Area" / "= 350% of Lot
// Area", under a row headed "Max. Height / FAR (Floor Area Ratio)".
describe('Philadelphia MaxFAR — "% of Lot Area" IS the FAR expression', () => {
  it.each([
    ['70% of Lot Area', 0.7],   // RM-2
    ['150% of Lot Area', 1.5],  // RM-3
    ['350% of Lot Area', 3.5],  // RM-4
  ])('%s → %s', (raw, far) => {
    expect(parseMaxFAR(raw as string)).toBe(far)
  })

  it('still rejects DISTRICT area — that one cannot be applied to one parcel', () => {
    // RMX-1 / RMX-2 measure across a whole district, not per lot.
    expect(parseMaxFAR('150% of District Area\r (excluding streets)')).toBeNull()
    expect(parseMaxFAR('250% of District Area\r (excluding streets)')).toBeNull()
  })

  it('still rejects lot COVERAGE — footprint, not floor area', () => {
    expect(parseMaxFAR('60% lot coverage')).toBeNull()
  })

  it('handles every non-empty MaxFAR value the source actually publishes', () => {
    // Enumerated live 2026-08-05 from ZoningCodeCharacteristics.
    const published: [string, number | null][] = [
      ['500%*', 5], ['500%', 5],
      ['1200%; 1600% for certain lots within Center City/University City FAR Map*', 12],
      ['70% of Lot Area', 0.7], ['150% of Lot Area', 1.5], ['350% of Lot Area', 3.5],
      ['150% of District Area\r (excluding streets)', null],
      ['250% of District Area\r (excluding streets)', null],
    ]
    for (const [raw, exp] of published) expect(parseMaxFAR(raw), raw).toBe(exp)
  })
})
