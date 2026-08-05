// NYC contextual-district HEIGHT table (WO-8.8 depth tranche 2).
//
// Source: NYC Zoning Resolution (ZR), as published at zr.planning.nyc.gov.
// Re-verified against the live code text 2026-08-05 by parsing the published
// HTML table on BOTH official hosts (zr.planning.nyc.gov and
// zoningresolution.planning.nyc.gov). Section citations are in-line below so a
// reviewer can re-check every number against the published table.
//
// ── 2026-08-05 CORRECTION: the section this file cited was REPEALED ──────────
// This table used to cite "ZR 23-662(a) Table 1". That section no longer
// exists — https://zr.planning.nyc.gov/article-ii/chapter-3/23-662 returns 404.
// City of Yes for Housing Opportunity (last amended 12/5/2024) renumbered the
// Quality Housing height regs into ZR 23-43 ("Height and Setback Requirements
// in R6 Through R12 Districts"), whose operative table is ZR 23-432, and RAISED
// most of the figures. Every height below was re-read from that table.
//
// The stale values were NOT a base-height/building-height mix-up. Both the old
// and the new figures are MAXIMUM BUILDING HEIGHTS; the old ones were simply
// from the superseded text. For reference, 23-432's *maximum base height*
// column (the height at which the setback must occur) reads 65/45/75/85 ft for
// R6A/R6B/R7A/R7D — neither the values we shipped nor the ones we now ship, so
// the two quantities were never being confused.
//
// THE GAP THIS FILLS — height. The NYC provider is backed by MapPLUTO, which
// carries per-use FAR (ResidFAR / CommFAR / FacilFAR) but NEVER a height.
//
// WHICH COLUMN. ZR 23-432 splits every row into "Standard residences" and
// "Qualifying affordable housing or qualifying senior housing". We store the
// STANDARD RESIDENCES max building height — the base by-right figure. The
// qualifying-housing columns are an incentive program the user has not chosen
// (R6A: 75 standard vs 95 qualifying), so reporting them would overstate the
// by-right envelope. Understating height is the safe failure direction for this
// product (it can push a verdict toward NEEDS_RELIEF, never the reverse).
//
// This table fills maxHeightFt ONLY. FAR continues to come from the provider's
// farByUse (MapPLUTO), which always wins — resolveNyc never returns a far.
//
// KNOWN GAP, not an absence (see CLAUDE.md rule 5). Under the pre-12/5/2024
// text the non-contextual districts (bare R6, R7-1, R7-2, R8, R10) genuinely
// had NO flat cap — they were sky-exposure-plane / height-factor governed, and
// returning null for them was an ANSWER. That is no longer true: ZR 23-432
// applies to "R6 R7 R8 R9 R10 R11 R12" and now publishes flat maximum building
// heights for the bare districts too (e.g. R6¹ 75 / R6² 55). resolveNyc still
// returns null for them, which is now a GAP we have not closed rather than a
// property of the code. Closing it changes resolved heights for parcels that
// currently report "unknown" and is left to a scoped follow-up.

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
}

// ── Contextual R-district max building heights ──────────────────────────────
// ZR 23-432 (Height and setback requirements), last amended 12/5/2024, table
// "MINIMUM BASE HEIGHT, MAXIMUM BASE HEIGHT, AND MAXIMUM BUILDING HEIGHTS",
// column "Standard residences → Maximum height of buildings or other
// structures (in feet)".
// Verified 2026-08-05 against zr.planning.nyc.gov/article-ii/chapter-3/23-432
// (and the identical table on zoningresolution.planning.nyc.gov).
//
// The table's superscripts are defined in the footnotes of that section:
//   ¹ = zoning lots or portions thereof within 100 feet of a WIDE STREET
//   ² = zoning lots or portions thereof on a NARROW STREET beyond 100 feet of
//       a wide street (or, wide-street-frontage-only lots, beyond 100 ft of the
//       street line)
// We do not carry per-parcel wide/narrow-street frontage, so for split rows we
// store the LOWER (² narrow-street) figure — the conservative bound.
//
// ZR 23-434 (modifications for zoning lots meeting certain criteria) and 23-435
// (towers, where permitted) can exceed these; both are conditional programs, so
// the by-right base figure is what belongs here.
export const NYC_CONTEXTUAL_HEIGHTS: Record<string, number> = {
  R6A: 75, // ZR 23-432 row "R6A, R6¹, R6-1": standard-residence max bldg height 75 ft (was 70 — superseded 23-662)
  R6B: 55, // ZR 23-432 row "R6B": 55 ft (was 50 — superseded 23-662)
  R7A: 85, // ZR 23-432 row "R7A, R7-1¹, R7-2¹": 85 ft (was 80 — superseded 23-662)
  R7B: 75, // ZR 23-432 row "R7B": 75 ft (unchanged by the 12/5/2024 amendment)
  R7D: 105, // ZR 23-432 row "R7D": 105 ft (was 100 — superseded 23-662)
  R7X: 125, // ZR 23-432 row "R7X, R7-3": 125 ft (was 120; the old Manhattan-Core split no longer exists)
  R8A: 125, // ZR 23-432 row "R8A": 125 ft (was 120 — superseded 23-662)
  R8B: 75, // ZR 23-432 row "R8B": 75 ft (unchanged by the 12/5/2024 amendment)
  R8X: 155, // ZR 23-432 row "R8X": 155 ft (was 150 — superseded 23-662)
  R9A: 135, // ZR 23-432: R9A¹ 145 / R9A² 135 — store 135 (narrow-street, conservative)
  R9X: 165, // ZR 23-432: R9X¹ 175 / R9X² 165 — store 165 (narrow-street, conservative; was 160)
  R10A: 185, // ZR 23-432: R10A¹ 215 / R10A² 185 — store 185 (narrow-street, conservative)
  // R9D and R10X used to be omitted here on the rationale that their max height
  // was "N/A → governed by tower regulations". That rationale was true of the
  // repealed 23-662 and is FALSE of 23-432, which publishes a flat standard-
  // residence max building height for both. Values read from the same table.
  R9D: 175, // ZR 23-432 row "R9D, R9-1": 175 ft
  R10X: 185, // ZR 23-432: R10X¹ 215 / R10X² 185 — store 185 (narrow-street, conservative)
}

// ── Commercial-district residential equivalents (ZR 34-112, last amended
//    12/5/2024 — formerly ZR 35-23) ──────────────────────────────────────────
// In C districts the residential bulk is the bulk of the mapped "residential
// equivalent." Only the C districts whose equivalent is a CONTEXTUAL (lettered)
// R district above carry a flat Quality-Housing height; those are listed here.
// C districts whose equivalent is a bare R6/R7-2/R8/R9/R10 (e.g. C6-7 → R10) are
// sky-exposure-plane / height-factor governed and are deliberately NOT listed →
// resolveNyc returns null for them. Verified 2026-06-10 against
// zr.planning.nyc.gov/article-iii/chapter-4/34-112. (The 2026-08-05 pass
// re-read ZR 23-432 only; this mapping was not re-verified against the
// 12/5/2024 amendment.)
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
 * Returns the flat ZR 23-432 standard-residence max building height ONLY for
 * the contextual lettered R districts listed above and the C districts whose
 * residential equivalent is one of them (ZR 34-112). For every other district —
 * bare R6/R7-1/R7-2/R8/R9/R10 and their C-equivalents, special districts,
 * manufacturing, etc. — we return null. NEVER guesses.
 *
 * For the bare R districts that null is a GAP, not an answer: since the
 * 12/5/2024 amendment ZR 23-432 does publish flat heights for them. See the
 * "KNOWN GAP" note at the top of this file.
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
  R9D: resolveNyc('R9D'),
  R10A: resolveNyc('R10A'),
  R10X: resolveNyc('R10X'),
  'C4-4A': resolveNyc('C4-4A'), // → R7A
  'C6-2A': resolveNyc('C6-2A'), // → R8A
  'C6-4A': resolveNyc('C6-4A'), // → R10A
  // Non-contextual (sky-exposure-plane) → null height, kept for documentation.
  R6: resolveNyc('R6'),
  'R7-2': resolveNyc('R7-2'),
  'C6-7': resolveNyc('C6-7'), // → R10 (bare) → null
}
