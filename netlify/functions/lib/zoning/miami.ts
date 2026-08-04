// Miami 21 dimensional limits.
//
// Miami's zoning layer (gis.miami.gov .../ZoningMiami21/MapServer/5) carries
// Bldg_Height, but it is expressed in STORIES, not feet, and only for the T6
// (Urban Core) zones — T1/T3/T4/T5/D1/D2/D3/CI/CS all return a blank string.
// The `FLR` field is NOT a numeric floor-lot ratio either: it is a letter suffix
// (A / B / blank) identifying which Miami 21 Article 4 row applies.
//
// Sources:
//  • Live layer sweep 2026-08-03 — 36 distinct M21_ZONE values; Bldg_Height
//    populated only for T6 ('8','12','24','36','48','60','80').
//  • Miami 21 Article 5 §5.3.2(e) (As Adopted May 2010): in T3, "A flat roof
//    shall be a maximum of two Stories and twenty-five (25) feet." That is the
//    one zone where the code states a height in FEET directly, so T3 is exact.
//  • Article 5 §5.4.2(f) / §5.5.2 defer T4 and T5 heights to Article 4 Table 2,
//    which is a separate document and states stories only. Until those values are
//    read from the primary table, T4/T5/D/CI/CS return null → "not in public
//    data" rather than a guessed limit.

/** Maximum floor-to-floor feet per Story, from Miami 21 itself.
 *
 *  Article 1 (Definitions): "A Story is a Habitable level within a Building of a
 *  maximum fourteen (14) feet in Height from finished floor to finished floor."
 *  Article 1 also defines Building Height as "the vertical extent of a Building
 *  measured in Stories" — the code regulates STORIES, and a height in feet is
 *  therefore a DERIVED ceiling, not a published limit.
 *
 *  ⚠️ CORRECTED 2026-08-04. This was 12, described in its own comment as "the
 *  same mid-range convention the Denver module uses" — i.e. a constant borrowed
 *  from a different city's code and applied to Miami parcels. Unsourced, and
 *  wrong: Miami 21 states 14. The error scaled with story count, so it was
 *  largest exactly where the tool is most visible (T6-80 → an 80-story tower). */
export const MIAMI_MAX_FT_PER_STORY = 14

/** T3 (Sub-Urban) flat-roof maximum, stated in feet by Article 5 §5.3.2(e). */
const T3_MAX_HEIGHT_FT = 25

export interface MiamiLimits {
  heightFt: number | null
  stories: number | null
  maxFAR: number | null
}

/**
 * Resolve Miami 21 limits from the zone code plus the layer's Bldg_Height text.
 * Returns nulls rather than guesses wherever the public data doesn't carry the
 * number — matching the conservative rule used across the other zoning modules.
 */
export function resolveMiami(zone: string | null | undefined, bldgHeight?: string | null): MiamiLimits {
  const none: MiamiLimits = { heightFt: null, stories: null, maxFAR: null }
  const z = (zone ?? '').trim().toUpperCase()
  if (!z) return none

  // T6: the layer states max stories directly (the trailing number in the zone
  // code agrees, e.g. T6-48A-O → 48). Prefer the field, fall back to the code.
  if (z.startsWith('T6')) {
    const fromField = Number(String(bldgHeight ?? '').trim())
    const m = /^T6-(\d+)/.exec(z)
    const fromCode = m ? Number(m[1]) : NaN
    const stories = Number.isFinite(fromField) && fromField > 0 ? fromField : Number.isFinite(fromCode) && fromCode > 0 ? fromCode : null
    if (stories == null) return none
    // Height in feet is the code-implied CEILING (stories × the 14 ft maximum
    // Story height), not a published limit. `stories` is the exact figure the
    // code states and is what downstream consumers should prefer.
    return { heightFt: Math.round(stories * MIAMI_MAX_FT_PER_STORY), stories, maxFAR: null }
  }

  // T3: exact, stated in feet by the code itself.
  if (z.startsWith('T3')) return { heightFt: T3_MAX_HEIGHT_FT, stories: 2, maxFAR: null }

  // T4 / T5 / T1 / D1 / D2 / D3 / CI / CI-HD / CS — heights live in Article 4
  // Table 2 (stories), which is not in the GIS layer and not yet read from the
  // primary table. Report unknown rather than fabricate.
  return none
}

/** Miami 21 zone → allowed use vocabulary (Article 4 Table 3 families). */
export function miamiUsesForZone(zone: string | null | undefined): string[] | null {
  const z = (zone ?? '').trim().toUpperCase()
  if (!z) return null
  if (z.startsWith('T1')) return ['institutional'] // Natural — conservation
  if (z.startsWith('T3')) return ['residential']
  if (z.startsWith('T4') || z.startsWith('T5')) return ['residential', 'mixed', 'commercial']
  if (z.startsWith('T6')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('CI')) return ['institutional']
  if (z.startsWith('CS')) return ['institutional'] // Civic Space / parks
  if (z.startsWith('D1') || z.startsWith('D2')) return ['commercial', 'institutional']
  if (z.startsWith('D3')) return ['commercial', 'institutional'] // Waterfront industrial
  return null
}
