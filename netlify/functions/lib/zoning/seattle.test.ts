import { describe, it, expect } from 'vitest'
import { NR_FAR_BASE, NR_SMALL_LOT_FLOOR_SQFT, NR_SMALL_LOT_THRESHOLD_SQFT, resolveSeattle, SEATTLE_FAR } from './seattle'

// Every FAR below is pinned to SMC 23.47A.013 Table A (FAR limit OUTSIDE a
// Station Area Overlay District) cited in seattle.ts, re-read verbatim from the
// codified text 2026-08-05 (current through Ord. 127376 §50, 2025). These tests
// guard against silently changing a sourced figure and against the suffix parser
// drifting.
describe('resolveSeattle — NC/C FAR by height-limit suffix (SMC 23.47A.013 Table A)', () => {
  it.each([
    ['NC1-30', 2.5],
    ['NC2-40 (M)', 3.0], // MHA-suffixed → the printed 40-ft row
    ['NC2-55', 3.75],
    ['NC3-65', 4.5],
    ['NC3-75', 5.5],
    ['NC3-85', 5.75],
    ['NC3-95', 6.25],
    ['NC3-145', 7.0],
    ['NC3-200', 8.25],
    ['C1-40 (M)', 3.0],
    ['C1-65', 4.5],
    ['C2-65', 4.5],
  ])('%s → FAR %f, height null (provider derives height)', (zone, far) => {
    const r = resolveSeattle(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull() // height stays the provider's job
  })
})

// ── Table A footnote 1 — the 40-foot row is TWO figures, not one ──────────────
// Footnote 1 to Table A for 23.47A.013, verbatim: "Except that zones without a
// mandatory housing affordability suffix have a maximum FAR of 3.25". The MHA
// suffixes are (M), (M1), (M2) per SMC 23.30.010.B.
//
// REGRESSION MARKER: this module previously returned 3.0 for EVERY 40-foot NC/C
// zone, on a stated (and wrong) assumption that MHA status could not be read from
// the zone string. The Seattle GeoData zoning feed spells the suffix out and the
// provider passes the raw string through, so an unsuffixed 40-foot zone was being
// published ~7.7% low. If any assertion below flips back to 3.0, that is the old
// defect returning — not a rounding change.
describe('resolveSeattle — 40 ft without an MHA suffix is 3.25, not the old 3.0 (Table A fn.1)', () => {
  it.each([
    'NC1-40',
    'NC2-40',
    'NC3-40',
    'C1-40',
    'C2-40',
    'NC2P-40',
    'NC3P-40',
  ])('%s (no MHA suffix) → FAR 3.25 — WAS wrongly 3.0', (zone) => {
    expect(resolveSeattle(zone).far).toBe(3.25)
  })

  it.each([
    'NC1-40 (M)',
    'NC1-40 (M1)',
    'NC1-40 (M2)',
    'NC2-40 (M)',
    'C1-40 (M)',
    'C1P-40 (M)',
    'NC2P-40 (M1)',
  ])('%s (MHA-suffixed) → FAR 3.0, the figure printed in the 40 ft row', (zone) => {
    expect(resolveSeattle(zone).far).toBe(3.0)
  })

  it('the MHA suffix changes NO other row — footnote 1 is on the 40 ft row only', () => {
    for (const [bare, suffixed, far] of [
      ['NC1-30', 'NC1-30 (M)', 2.5],
      ['NC2-55', 'NC2-55 (M1)', 3.75],
      ['NC3-65', 'NC3-65 (M1)', 4.5],
      ['NC3-75', 'NC3-75 (M2)', 5.5],
      ['NC3-95', 'NC3-95 (M)', 6.25],
      ['NC3-145', 'NC3-145 (M)', 7],
      ['NC3-200', 'NC3-200 (M)', 8.25],
    ] as const) {
      expect(resolveSeattle(bare).far, bare).toBe(far)
      expect(resolveSeattle(suffixed).far, suffixed).toBe(far)
    }
  })

  it('an incentive-zoning parenthetical is not an MHA suffix (SMC 23.30.010.B lists (M)/(M1)/(M2))', () => {
    // SMC 23.47A.002.B contemplates NC/C zones "having an incentive zoning
    // suffix"; SMC 23.30.010.B describes those as numerical suffixes in
    // parentheses ("LR2 (0.75)" is the live-feed spelling). Such a zone is NOT
    // MHA-suffixed → 3.25, and the parenthetical's digits must not be mistaken
    // for the height limit.
    expect(resolveSeattle('NC2-40 (0.75)').far).toBe(3.25)
    expect(resolveSeattle('NC3-65 (0.75)').far).toBe(4.5)
  })
})

// ── Pedestrian-designated zones are NC/C zones ────────────────────────────────
// REGRESSION MARKER: NC1P/NC2P/NC3P/C1P/C2P used to fall through the prefix match
// and resolve to far: null — roughly 28% of the NC/C polygons in a live sample of
// the Seattle GeoData zoning feed (2026-08-05). Authority that the P designation
// does not remove the district from 23.47A.013:
//   * SMC 23.30.010.B — a reference to a designation "without a suffix ...
//     includes any zoning classifications created by the addition ... of one or
//     more suffixes", so "NC zones and C zones" in 23.47A.013.A reaches NC3P.
//   * SMC 23.47A.013.F.2 names "a NC3-200 or NC3P-200 zoned area" together.
//   * SMC 23.47A.013.E.1.a applies the Table C minimum FAR to pedestrian-
//     designated zones — they are squarely inside this section.
// If any of these goes back to null, the parser-domain hole has reopened.
describe('resolveSeattle — pedestrian-designated P zones resolve (were wrongly null)', () => {
  it.each([
    ['NC1P-55 (M)', 3.75],
    ['NC1P-65 (M1)', 4.5],
    ['NC2P-30 (M1)', 2.5],
    ['NC2P-55 (M2)', 3.75],
    ['NC2P-65', 4.5],
    ['NC2P-75 (M)', 5.5],
    ['NC3P-95 (M2)', 6.25],
    ['NC3P-200 (M)', 8.25],
    ['C1P-55 (M)', 3.75],
    ['C1P-75 (M)', 5.5],
    ['C2P-55 (M)', 3.75],
  ])('%s → FAR %f (same Table A row as the non-P twin)', (zone, far) => {
    expect(resolveSeattle(zone).far).toBe(far)
  })

  it('a P zone resolves to exactly its non-P twin', () => {
    for (const [p, twin] of [
      ['NC3P-65', 'NC3-65'],
      ['NC2P-40', 'NC2-40'],
      ['NC3P-75 (M)', 'NC3-75 (M)'],
      ['C1P-40 (M)', 'C1-40 (M)'],
    ] as const) {
      expect(resolveSeattle(p).far, p).toBe(resolveSeattle(twin).far)
      expect(resolveSeattle(p).far, p).not.toBeNull()
    }
  })
})

describe('resolveSeattle — MIO prefix is stripped to the NC/C base zone', () => {
  it('MIO-105-NC3-65 → NC3 base FAR 4.5 (not the MIO 105 height)', () => {
    expect(resolveSeattle('MIO-105-NC3-65').far).toBe(4.5)
  })
  it('MIO over a pedestrian-designated zone still resolves', () => {
    expect(resolveSeattle('MIO-105-NC3P-75 (M)').far).toBe(5.5)
    expect(resolveSeattle('MIO-65-NC2P-55 (M)').far).toBe(3.75)
    expect(resolveSeattle('MIO-240-NC3P-200 (M)').far).toBe(8.25)
  })
})

describe('resolveSeattle — non-NC/C zones have a separate/no FAR table → null (honest)', () => {
  it.each([
    'LR1', // multifamily — SMC 23.45, not replicated here
    'LR2',
    'LR2 (0.75)',
    'LR3 RC (M1)',
    'MR',
    'HR (M)',
    'SM-U 95-320', // Seattle Mixed — SMC 23.48
    'SM-UP 65 (M)',
    'DOC1 U/450-U', // downtown
    'IG1 U/85', // industrial
    'IC-45',
    'II U/125',
    'UI U/65',
    'MML U/45',
    // 'NR' was in this list until 2026-08-15. That was an INTERPRETATION —
    // that Seattle states no FAR for Neighborhood Residential — and it was
    // wrong: SMC § 23.44.050 is titled "Floor area" and Table A for 23.44.050
    // states the ratio by density band. NR was 15 of Seattle's 17 developable
    // gaps while this assertion was green (rule 15: a test defends an
    // interpretation, and a green one is evidence the code matches it, never
    // evidence the interpretation is right).
    'MPC-YT',
    'SF 5000', // the superseded single-family code, correctly unresolved
  ])('%s → far null', (zone) => {
    expect(resolveSeattle(zone).far).toBeNull()
  })
})

describe('resolveSeattle — unknown height suffix stays null (never interpolated)', () => {
  it('an NC zone with a height NOT in Table A → null FAR', () => {
    // 50 ft has no published Table-A row → must not interpolate between 40 and 55.
    expect(resolveSeattle('NC2-50').far).toBeNull()
    expect(resolveSeattle('NC3-105').far).toBeNull()
    expect(resolveSeattle('NC3P-105').far).toBeNull()
  })
  it('an NC/C zone with no parseable height token → null FAR', () => {
    expect(resolveSeattle('NC3').far).toBeNull()
    expect(resolveSeattle('NC3P').far).toBeNull()
  })
})

describe('resolveSeattle — unknown / empty / garbage → null', () => {
  it.each([null, undefined, '', 'not-a-zone', 'PARK'])('%s → both null', (zone) => {
    expect(resolveSeattle(zone)).toEqual({ far: null, heightFt: null })
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveSeattle('  nc3-65  ').far).toBe(4.5)
    expect(resolveSeattle('  nc3p-65  ').far).toBe(4.5)
    expect(resolveSeattle('nc2-40 (m1)').far).toBe(3.0)
  })
})

describe('SEATTLE_FAR static table stays in lock-step with resolveSeattle', () => {
  it('covers ≥10 NC/C variants', () => {
    expect(Object.keys(SEATTLE_FAR).length).toBeGreaterThanOrEqual(10)
  })
  it('each stored entry equals the resolver output for that zone', () => {
    for (const [zone, limits] of Object.entries(SEATTLE_FAR)) {
      expect(limits).toEqual(resolveSeattle(zone))
    }
  })
  it('every entry has a null height (height is provider-derived)', () => {
    for (const limits of Object.values(SEATTLE_FAR)) {
      expect(limits.heightFt).toBeNull()
    }
  })
  it('includes at least one pedestrian-designated zone and it is not null', () => {
    const p = Object.entries(SEATTLE_FAR).filter(([z]) => /^(NC[123]|C[12])P/.test(z))
    expect(p.length).toBeGreaterThan(0)
    for (const [z, limits] of p) expect(limits.far, z).not.toBeNull()
  })
  it('the two 40-foot forms are stored as different numbers', () => {
    expect(SEATTLE_FAR['NC1-40'].far).toBe(3.25)
    expect(SEATTLE_FAR['NC1-40 (M)'].far).toBe(3.0)
  })
})

// The parcel response must carry the same sourced FAR the envelope was built
// from. Previously the provider hard-coded maxFAR: null while
// resolveZoningLimits layered the table in behind it, so /api/parcel reported
// "no FAR" for a lot whose floor area came from FAR 4.5.
describe('Seattle NC/C FAR — values match SMC 23.47A.013 Table A', () => {
  it.each([
    ['NC3-30', 2.5], ['NC2-40 (M)', 3.0], ['NC2-40', 3.25], ['NC1-55', 3.75], ['NC3-65', 4.5],
    ['C1-75', 5.5], ['C2-85', 5.75], ['NC3-95', 6.25], ['C1-145', 7], ['NC3-200', 8.25],
  ])('%s → FAR %s', (zone, far) => {
    expect(resolveSeattle(zone as string).far).toBe(far)
  })

  it('returns null outside NC/C (LR/MR/HR and SM have their own tables)', () => {
    for (const z of ['LR2', 'MR', 'HR', 'SM-U-85', 'IG1 U/85', 'SF 5000']) {
      expect(resolveSeattle(z).far, z).toBeNull()
    }
  })
})

describe('NR — Neighborhood Residential (SMC 23.44.050)', () => {
  // Table A for 23.44.050 keys the FAR to the DENSITY of the proposed
  // development, not to the district. The least dense row is the headline; the
  // denser rows are programme choices the applicant has not made (rule 6).
  it('resolves the least-dense row as the headline', () => {
    const r = resolveSeattle('NR')
    expect(r.far).toBe(NR_FAR_BASE)
    expect(r.far).toBe(0.6)
  })

  it('carries the denser rows as alternatives, never as the headline', () => {
    const r = resolveSeattle('NR')
    expect(r.farAlternatives?.map((a) => a.far)).toEqual([0.8, 1.0, 1.0, 1.2, 1.6, 2.0])
    // The largest figure must never become the published ratio.
    for (const a of r.farAlternatives ?? []) expect(r.far).toBeLessThanOrEqual(a.far)
  })

  it('carries the § 23.44.050.B small-lot floor', () => {
    expect(resolveSeattle('NR').farFloorSqFt).toBe(NR_SMALL_LOT_FLOOR_SQFT)
    // The floor can only bind below the code's own 5,000 sq ft threshold: at
    // FAR 0.6 the ratio already yields 2,500 sq ft on a 4,167 sq ft lot.
    expect(NR_SMALL_LOT_FLOOR_SQFT / NR_FAR_BASE).toBeLessThan(NR_SMALL_LOT_THRESHOLD_SQFT)
  })

  it('labels the affordable-housing election as elective', () => {
    const alt = resolveSeattle('NR').farAlternatives?.find((a) => a.far === 2.0)
    expect(alt?.source).toContain('23.44.170')
    expect(alt?.label).toMatch(/affordable/i)
  })

  it.each(['NR', 'NR (M)', 'NR-1', 'nr'])('matches the live-feed variant %s', (z) => {
    expect(resolveSeattle(z).far).toBe(NR_FAR_BASE)
  })

  // The NR branch must not swallow anything else beginning with N.
  it.each(['NC1-30', 'NC3-65 (M)', 'C1-40', 'NCTOD', 'NORTHGATE'])('does not capture %s', (z) => {
    const r = resolveSeattle(z)
    expect(r.farAlternatives).toBeUndefined()
  })
})
