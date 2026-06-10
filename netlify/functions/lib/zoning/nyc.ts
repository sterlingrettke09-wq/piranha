// NYC contextual-district HEIGHT table (WO-8.8 depth tranche 2).
//
// Source: NYC Zoning Resolution (ZR), as published at zr.planning.nyc.gov.
// Verified against the live code text 2026-06-10. Section citations are in-line
// below so a reviewer can re-check every number against the published table.
//
// THE GAP THIS FILLS — height. The NYC provider is backed by MapPLUTO, which
// carries per-use FAR (ResidFAR / CommFAR / FacilFAR) but NEVER a height: NYC
// encodes height differently depending on the district.
//
//   • CONTEXTUAL districts — the lettered R districts (R6A, R7A, R8B …) and the
//     "Quality Housing" program — have a FLAT max building height fixed by ZR
//     23-662 Table 1. Those are the rows below.
//   • NON-CONTEXTUAL districts (R6, R7-1, R7-2, R8, R10 without a letter, and
//     the C6-x downtown districts whose residential equivalent is a bare R6/R8/
//     R10) are governed by the SKY EXPOSURE PLANE / height-factor envelope, NOT
//     a flat cap. There is no single published height to look up, so resolveNyc
//     returns null for them (honest — see resolveNyc()).
//
// We store the MAXIMUM BUILDING HEIGHT *WITHOUT* a qualifying ground floor — the
// LOWER, conservative number from ZR 23-662 paragraph (a) Table 1 ("Basic
// building heights"). The taller "qualifying ground floor" figures in Table 2
// are an optional bonus, so using them would overstate the by-right envelope.
// Understating height is the safe failure direction for this product (it can
// push a verdict toward NEEDS_RELIEF, never the reverse).
//
// This table fills maxHeightFt ONLY. FAR continues to come from the provider's
// farByUse (MapPLUTO), which always wins — resolveNyc never returns a far.

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
}

// ── Contextual R-district max building heights (ZR 23-662 paragraph (a),
//    Table 1 "Basic building heights" — the conservative no-qualifying-ground-
//    floor column) ──────────────────────────────────────────────────────────
// Verified 2026-06-10 against zr.planning.nyc.gov/article-ii/chapter-3/23-662.
//
// Districts whose Table-1 "Maximum Height of Buildings" varies by proximity to a
// wide street (R9A, R9X, R10A — taller within 100 ft of a wide street) are
// stored at the LOWER (non-wide-street) figure, the conservative bound. R9D and
// R10X are intentionally omitted: their Table-1 max height is "N/A" (governed by
// tower regulations in ZR 23-663, not a flat cap) → must stay null, not guessed.
export const NYC_CONTEXTUAL_HEIGHTS: Record<string, number> = {
  R6A: 70, // ZR 23-662(a) Table 1: max building height 70 ft
  R6B: 50, // ZR 23-662(a) Table 1: 50 ft
  R7A: 80, // ZR 23-662(a) Table 1: 80 ft
  R7B: 75, // ZR 23-662(a) Table 1: 75 ft
  R7D: 100, // ZR 23-662(a) Table 1: 100 ft
  R7X: 120, // ZR 23-662(a) Table 1: 120 ft (outside Manhattan Core; 125 inside — lower is conservative)
  R8A: 120, // ZR 23-662(a) Table 1: 120 ft
  R8B: 75, // ZR 23-662(a) Table 1: 75 ft
  R8X: 150, // ZR 23-662(a) Table 1: 150 ft
  R9A: 135, // ZR 23-662(a) Table 1: R9A¹ 145 / R9A² 135 — store 135 (non-wide-street, conservative)
  R9X: 160, // ZR 23-662(a) Table 1: R9X¹ 170 / R9X² 160 — store 160 (non-wide-street, conservative)
  R10A: 185, // ZR 23-662(a) Table 1: R10A¹ 210 / R10A² 185 — store 185 (non-wide-street, conservative)
}

// ── Commercial-district residential equivalents (ZR 34-112, last amended
//    12/5/2024 — formerly ZR 35-23) ──────────────────────────────────────────
// In C districts the residential bulk is the bulk of the mapped "residential
// equivalent." Only the C districts whose equivalent is a CONTEXTUAL (lettered)
// R district above carry a flat Quality-Housing height; those are listed here.
// C districts whose equivalent is a bare R6/R7-2/R8/R9/R10 (e.g. C6-7 → R10) are
// sky-exposure-plane / height-factor governed and are deliberately NOT listed →
// resolveNyc returns null for them. Verified 2026-06-10 against
// zr.planning.nyc.gov/article-iii/chapter-4/34-112.
export const NYC_COMMERCIAL_EQUIVALENT: Record<string, string> = {
  // → R6A
  'C4-2A': 'R6A',
  'C4-3A': 'R6A',
  // → R7A
  'C1-6A': 'R7A',
  'C2-6A': 'R7A',
  'C4-4A': 'R7A',
  'C4-4L': 'R7A',
  'C4-5A': 'R7A',
  // → R7D
  'C4-5D': 'R7D',
  // → R7X
  'C4-5X': 'R7X',
  // → R8A
  'C1-7A': 'R8A',
  'C4-4D': 'R8A',
  'C6-2A': 'R8A',
  // → R9A
  'C1-8A': 'R9A',
  'C2-7A': 'R9A',
  'C6-3A': 'R9A',
  // → R9X
  'C1-8X': 'R9X',
  'C2-7X': 'R9X',
  'C6-3X': 'R9X',
  // → R10A
  'C1-9A': 'R10A',
  'C2-8A': 'R10A',
  'C4-6A': 'R10A',
  'C4-7A': 'R10A',
  'C5-1A': 'R10A',
  'C5-2A': 'R10A',
  'C6-4A': 'R10A',
}

/**
 * Resolve the NYC by-right max building height for a zoning district string
 * (e.g. "R7A", "C4-4A", "R6", "C6-7").
 *
 * Returns the flat ZR 23-662 Table-1 height ONLY for contextual lettered R
 * districts and the C districts whose residential equivalent is one of them
 * (ZR 34-112). For every other district — non-contextual R6/R7-1/R7-2/R8/R9/R10
 * and their C-equivalents, special districts, manufacturing, etc. — height is
 * governed by the sky-exposure plane / height-factor envelope (no flat cap), so
 * we return null. NEVER guesses.
 *
 * FAR is ALWAYS null here: NYC FAR comes from the provider's MapPLUTO farByUse,
 * which wins in resolveZoningLimits. This table only contributes maxHeightFt.
 */
export function resolveNyc(zone: string | null | undefined): DistrictLimits {
  if (!zone) return { far: null, heightFt: null }
  // Strip optional commercial-overlay tail ("R7A/C2-4" → "R7A") and whitespace;
  // PLUTO ZoneDist1 is the primary district, but be defensive about overlays.
  const z = zone.trim().toUpperCase().split('/')[0].trim()

  // Direct contextual R-district hit.
  if (z in NYC_CONTEXTUAL_HEIGHTS) {
    return { far: null, heightFt: NYC_CONTEXTUAL_HEIGHTS[z] }
  }

  // Commercial district mapped to a contextual residential equivalent.
  const equiv = NYC_COMMERCIAL_EQUIVALENT[z]
  if (equiv && equiv in NYC_CONTEXTUAL_HEIGHTS) {
    return { far: null, heightFt: NYC_CONTEXTUAL_HEIGHTS[equiv] }
  }

  // Non-contextual district (sky-exposure-plane governed) or unknown → null.
  return { far: null, heightFt: null }
}

// Static documentation snapshot of resolveNyc() output for the common districts,
// so a reviewer can eyeball resolved heights without running code. resolveNyc()
// is the runtime source of truth; the unit tests keep this in lock-step.
export const NYC_LIMITS: Record<string, DistrictLimits> = {
  R6A: resolveNyc('R6A'),
  R6B: resolveNyc('R6B'),
  R7A: resolveNyc('R7A'),
  R7B: resolveNyc('R7B'),
  R7D: resolveNyc('R7D'),
  R7X: resolveNyc('R7X'),
  R8A: resolveNyc('R8A'),
  R8B: resolveNyc('R8B'),
  R8X: resolveNyc('R8X'),
  R9A: resolveNyc('R9A'),
  R9X: resolveNyc('R9X'),
  R10A: resolveNyc('R10A'),
  'C4-4A': resolveNyc('C4-4A'), // → R7A
  'C6-2A': resolveNyc('C6-2A'), // → R8A
  'C6-4A': resolveNyc('C6-4A'), // → R10A
  // Non-contextual (sky-exposure-plane) → null height, kept for documentation.
  R6: resolveNyc('R6'),
  'R7-2': resolveNyc('R7-2'),
  'C6-7': resolveNyc('C6-7'), // → R10 (bare) → null
}
