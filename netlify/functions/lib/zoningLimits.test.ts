import { describe, it, expect } from 'vitest'
import { resolveZoningLimits } from './zoningLimits'

// Return type annotated, not inferred: an inferred object is not checked
// against resolveZoningLimits' parameter at any call site (only a FRESH literal
// argument is excess-property checked), so without this a renamed zoning field
// would compile everywhere in this file.
type Zoning = Parameters<typeof resolveZoningLimits>[0]

const z = (districtCode: string): Zoning => ({ districtCode, maxFAR: null, maxHeightFt: null, allowedUses: null })

describe('resolveZoningLimits', () => {
  it('parses trailing height from a coded district like B-2-65', () => {
    const r = resolveZoningLimits(z('B-2-65'))
    expect(r.maxHeightFt).toBe(65)
    expect(r.maxFAR).toBe(2.0)
    expect(r.allowedUses).toContain('commercial')
  })

  it('treats an OS district as open-space family with no parsed height', () => {
    const r = resolveZoningLimits(z('OS-UP'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(0.1)
    expect(r.allowedUses).toEqual(['institutional'])
  })

  it('handles a residential district with a single-digit suffix (no height parse)', () => {
    const r = resolveZoningLimits(z('R-1'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(1.0)
    expect(r.allowedUses).toEqual(['residential'])
  })

  it('returns all nulls for an unknown district', () => {
    const r = resolveZoningLimits(z('Unknown'))
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
    expect(r.allowedUses).toBeNull()
  })

  it('prefers explicit non-null values from the parcel feed', () => {
    const r = resolveZoningLimits({ districtCode: 'B-2-65', maxFAR: 5, maxHeightFt: 200, allowedUses: ['residential'] })
    expect(r.maxFAR).toBe(5)
    expect(r.maxHeightFt).toBe(200)
    expect(r.allowedUses).toEqual(['residential'])
  })
})

// WO-8.8 depth program: the per-city curated tables fill FAR/height ONLY where
// the provider left them null, and only for the city they belong to. They never
// override provider data and never leak into Boston's family heuristics.
describe('resolveZoningLimits — per-city curated tables (WO-8.8)', () => {
  const z = (districtCode: string, over: Partial<Zoning> = {}): Zoning => ({
    districtCode,
    maxFAR: null,
    maxHeightFt: null,
    allowedUses: null,
    ...over,
  })

  it('Chicago: a B3-2 with null provider FAR gets 2.2 from the Title 17 table', () => {
    const r = resolveZoningLimits(z('B3-2'), 'chicago')
    expect(r.maxFAR).toBe(2.2)
    expect(r.maxHeightFt).toBeNull() // §17-3-0408-A height varies by frontage → null
  })

  it('Chicago: a downtown DX-7 gets the §17-4-0405-A base FAR 7.0, no height limit', () => {
    const r = resolveZoningLimits(z('DX-7'), 'chicago')
    expect(r.maxFAR).toBe(7.0)
    expect(r.maxHeightFt).toBeNull()
  })

  it('Chicago: a B1-1 publishes the flat 38 ft height', () => {
    expect(resolveZoningLimits(z('B1-1'), 'chicago').maxHeightFt).toBe(38)
  })

  it('Chicago: provider FAR always wins over the table', () => {
    const r = resolveZoningLimits(z('B3-2', { maxFAR: 9 }), 'chicago')
    expect(r.maxFAR).toBe(9)
  })

  // SUPERSEDED 2026-08-17 — see the Denver block at the end of this file.
  //
  // This asserted that a C-MX-5 arriving with no height picks up 70 ft HERE. It
  // did, and the figure was right, but the path was the problem: reaching it
  // meant calling resolveDenver a second time without the `formerChapter59`
  // flag, which for a legacy code re-derived a height from a district CLASS
  // number and published it over the provider's deliberate refusal. Measured
  // live: C-MU-20 at 240 ft.
  //
  // The 70 ft itself is not lost and was never at risk — providers/denver.ts
  // resolves it from the same table WITH the flag, and its own test pins a
  // C-MX-5 parcel at 70 ft. What changed is that Denver now has exactly one
  // caller of that table instead of two, so the guard cannot be bypassed by
  // whichever caller forgets the argument.
  //
  // (The companion case, "provider height always wins over the table", is now
  // structurally true for Denver rather than merely asserted — the table
  // contributes nothing for this city. It is kept for the cities that still use
  // the fallback, in the Chicago assertion below.)
  it('Denver: the provider is the only source, so this layer adds nothing', () => {
    const r = resolveZoningLimits(z('C-MX-5'), 'denver')
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
  })

  it('Chicago: a provider-supplied height still wins over the table', () => {
    const r = resolveZoningLimits(z('B1-1', { maxHeightFt: 999 }), 'chicago')
    expect(r.maxHeightFt).toBe(999)
  })

  it('the curated tables do not leak into Boston (no city match → Boston heuristics only)', () => {
    // "B3-2" is a Chicago code; under Boston it must NOT pick up the Chicago FAR.
    const r = resolveZoningLimits(z('B3-2'), 'boston')
    // Boston family heuristic for a "B" code is FAR 2.0, NOT Chicago's 2.2.
    expect(r.maxFAR).toBe(2.0)
  })

  it('a city without a table falls through to all-null (no fabrication)', () => {
    const r = resolveZoningLimits(z('B3-2'), 'dc')
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
  })

  // ── NYC (depth tranche 2) — table fills HEIGHT for contextual districts only;
  //    provider farByUse still wins for FAR. ─────────────────────────────────
  it('NYC: a contextual R7A gets the ZR 23-432 height 85 ft, FAR stays provider-sourced (null here)', () => {
    const r = resolveZoningLimits(z('R7A'), 'nyc')
    expect(r.maxHeightFt).toBe(85)
    expect(r.maxFAR).toBeNull() // FAR comes from PLUTO farByUse, not this table
  })

  it('NYC: a commercial C4-4A resolves to its R7A equivalent height (85 ft)', () => {
    expect(resolveZoningLimits(z('C4-4A'), 'nyc').maxHeightFt).toBe(85)
  })

  it('NYC: a NON-contextual R6 stays null height (sky-exposure-plane governed)', () => {
    expect(resolveZoningLimits(z('R6'), 'nyc').maxHeightFt).toBeNull()
  })

  it('NYC: provider height always wins over the contextual table', () => {
    const r = resolveZoningLimits(z('R7A', { maxHeightFt: 99 }), 'nyc')
    expect(r.maxHeightFt).toBe(99)
  })

  // ── Seattle (depth tranche 2) — table fills FAR for NC/C zones; provider
  //    derives height. ────────────────────────────────────────────────────────
  it('Seattle: an NC3-65 gets the SMC 23.47A.013 Table-A FAR 4.5', () => {
    const r = resolveZoningLimits(z('NC3-65'), 'seattle')
    expect(r.maxFAR).toBe(4.5)
  })

  it('Seattle: an unknown height suffix stays null FAR (no interpolation)', () => {
    expect(resolveZoningLimits(z('NC2-50'), 'seattle').maxFAR).toBeNull()
  })

  it('Seattle: provider FAR always wins over the table', () => {
    const r = resolveZoningLimits(z('NC3-65', { maxFAR: 9 }), 'seattle')
    expect(r.maxFAR).toBe(9)
  })

  // ── Cross-city leak guards — each city's table must not fire under another. ──
  it('the NYC contextual table does NOT apply under boston (R7A → Boston "R" heuristic)', () => {
    // Under Boston, "R7A" hits the family-letter heuristic (R → FAR 1.0), and
    // must NOT pick up NYC's 80 ft contextual height.
    const r = resolveZoningLimits(z('R7A'), 'boston')
    expect(r.maxHeightFt).toBeNull() // no NYC leak
    expect(r.maxFAR).toBe(1.0) // Boston "R" family FAR, not anything NYC
  })

  it('the NYC table does not leak into Seattle, nor Seattle FAR into NYC', () => {
    expect(resolveZoningLimits(z('R7A'), 'seattle').maxHeightFt).toBeNull()
    expect(resolveZoningLimits(z('NC3-65'), 'nyc').maxFAR).toBeNull()
  })

  it('the Seattle table does not leak into Chicago', () => {
    expect(resolveZoningLimits(z('NC3-65'), 'chicago').maxFAR).toBeNull()
  })
})

describe('Denver resolves its table in ONE place — the provider', () => {
  // ⚠️ THE LIVE DEFECT THIS PINS, measured 2026-08-17 end-to-end through
  // getParcelInfo + computeEnvelope on real parcels:
  //
  //   R-2      provider withheld → envelope published  24 ft /  2 storeys
  //   B-3      provider withheld → envelope published  36 ft /  3 storeys
  //   C-MU-20  provider withheld → envelope published 240 ft / 21 storeys
  //
  // Former Chapter 59 district codes carry a CLASS number, not a storey count.
  // providers/denver.ts knows this and refuses, because it derives the
  // `formerChapter59` flag from ZONE_USE_FORM and ZONE_DESCRIPTION — fields only
  // it can see. This fallback then called the same resolver a SECOND time with
  // no flag, and filled in exactly the figures the provider had just refused.
  //
  // Note what makes it hard to see: the provider is correct, its tests are
  // correct, and `maxHeightFt: null` reaching this function is the NORMAL case
  // for most Denver districts. The bug is that null was read as "nothing known"
  // when it meant "known to be unobtainable" — rule 5, one layer down.
  //
  // The same defect was fixed in the parser-domain sweep first. The fix went to
  // the instrument; this call site kept it. A guard that lives in an argument is
  // only as strong as its callers, so the durable fix is to have one caller.
  const LEGACY = ['R-2', 'B-3', 'R-4', 'O-1', 'OS-1', 'C-MU-20', 'B-8', 'R-3-X']

  it.each(LEGACY)('%s gets NO height from this layer', (code) => {
    const r = resolveZoningLimits(z(code), 'denver')
    expect(r.maxHeightFt, `${code} republished a fabricated height`).toBeNull()
    expect(r.maxFAR, code).toBeNull()
  })

  it('and neither does a CURRENT district — the provider is the only source', () => {
    // Not a narrower fix. Every Denver figure now arrives on the ParcelInfo the
    // provider builds, so this layer contributes nothing for the city at all;
    // asserting only the legacy half would let the second call site creep back
    // for current codes, where it would be silently right until it wasn't.
    for (const c of ['C-MX-5', 'D-CV', 'D-C', 'I-A', 'MHC', 'CMP-H']) {
      const r = resolveZoningLimits(z(c), 'denver')
      expect(r.maxHeightFt, c).toBeNull()
      expect(r.maxFAR, c).toBeNull()
    }
  })

  it('while the provider-supplied values still pass through untouched', () => {
    // The other direction: this layer must not start suppressing what the
    // provider DID resolve. D-CV is 16 storeys at 200 ft; D-C carries FAR 10.0.
    const withValues: Zoning = { districtCode: 'D-CV', maxFAR: null, maxHeightFt: 200, allowedUses: null }
    expect(resolveZoningLimits(withValues, 'denver').maxHeightFt).toBe(200)
    const withFar: Zoning = { districtCode: 'D-C', maxFAR: 10.0, maxHeightFt: null, allowedUses: null }
    expect(resolveZoningLimits(withFar, 'denver').maxFAR).toBe(10.0)
  })

  it('other cities keep their table fallback', () => {
    // rule 20: this must not pass by Denver having broken the mechanism for
    // everyone. Chicago genuinely relies on it — providers/chicago.ts leaves
    // maxHeightFt null and §17-3-0408-A's flat 38 ft for Dash 1/1.5 arrives
    // here.
    expect(resolveZoningLimits(z('B1-1'), 'chicago').maxHeightFt).toBe(38)
    expect(resolveZoningLimits(z('RM-5'), 'chicago').maxFAR).not.toBeNull()
  })
})
