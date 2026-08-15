// Miami 21 dimensional limits.
//
// Miami's zoning layer (gis.miami.gov .../ZoningMiami21/MapServer/5) carries
// Bldg_Height, but it is expressed in STORIES, not feet, and only for the T6
// (Urban Core) zones — T1/T3/T4/T5/D1/D2/D3/CI/CS all return a blank string.
// The `FLR` field is NOT a numeric floor-lot ratio either: it is a letter suffix
// (A / B / blank) identifying which Miami 21 Article 4 row applies. The NUMBER
// lives in Article 4 Table 2 and is keyed by zone + that letter — see
// T6_BASE_FLR below, which is how the two facts fit together rather than
// conflict.
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

/** BASE Floor Lot Ratio by Transect Zone.
 *
 *  Source read directly 2026-08-05: **Miami 21 Article 4, Table 2 "Miami 21
 *  Summary", row "d. Floor Lot Ratio (FLR)"** (pp. IV.5–IV.6, as adopted
 *  January 2018 — the version the City itself publishes both at
 *  miami21.org/PDFs/Amended_Codes/Miami_21_Volume_I.pdf and, per-zone, at
 *  gis.miami.gov/Miami21Docs/<zone>.PDF alongside the very layer we query).
 *
 *  Table 2 states each cell as "<base> / <n>% additional Public Benefit". Only
 *  the base is carried here: the percentage is the Article 3 §3.14 Public
 *  Benefits bonus, which a project must buy and which is unavailable outright to
 *  a T6 lot abutting T3 (Table 2 note ***). Publishing base + bonus would report
 *  a program the user has not chosen.
 *
 *  Corroborated in three further places in the same code, all agreeing:
 *   • Article 3 §3.14.1(1)–(11) — the Public Benefits list ("T6-8: … FLR 5;
 *     T6-12: … FLR 8; T6-24a … FLR 7; T6-24b … FLR 16; T6-36a … FLR 12;
 *     T6-36b … FLR 22; T6-48a/T6-60a … FLR 11; T6-48b/T6-60b … FLR 18;
 *     T6-80 … FLR 24").
 *   • Article 5 Illustration 5.6 (one page per T6 zone) and Illustration 5.8
 *     (CI-HD).
 *   • Article 7 §7.1.2.8(a)(3), the successional-zoning table.
 *  (One cell of that §7.1.2.8 table — the successional FLR shown against T5 —
 *  reads 6 for T6-8 where every other statement in the code reads 5. Table 2
 *  governs and is what is encoded.)
 *
 *  FLR is Miami's FAR: Article 1 defines it as "the multiplier applied to the
 *  Lot Area that determines the maximum Floor Area allowed above grade". Note
 *  §5.6.3(b) — floor area entirely below base flood elevation is excluded, so
 *  this is an above-grade ratio.
 *
 *  KEYS ARE ZONE + LETTER, and a lettered district is only resolvable with its
 *  letter: T6-24a is FLR 7 while T6-24b is 16. A bare "T6-24" is therefore
 *  deliberately ABSENT from this table — reporting 16 (or 7) for it would be
 *  reporting one of two alternatives the code has not chosen. It occurs live:
 *  a 2026-08-05 distinct-value query of the Miami 21 Primary Zoning layer
 *  returns `T6-24-O` (2 features) with a blank FLR letter. That same query
 *  confirms the letter in the `FLR` field is fully redundant with the letter
 *  already inside `M21_ZONE` (A↔…A…, B↔…B…, blank↔no letter, 36/36 zones), so
 *  the zone code alone is sufficient to key this table.
 *
 *  Also deliberately absent: `T6-8A` / `T6-8B`, which exist in the layer
 *  (4 features) but NOT in the code — Table 2 gives T6-8 a single, unlettered
 *  FLR. An unexplained letter on a district the code does not letter is a gap,
 *  not an answer, so those parcels report no FAR. */
const T6_BASE_FLR: Readonly<Record<string, number>> = {
  'T6-8': 5,
  'T6-12': 8,
  'T6-24A': 7,
  'T6-24B': 16,
  'T6-36A': 12,
  'T6-36B': 22,
  'T6-48A': 11,
  'T6-48B': 18,
  'T6-60A': 11,
  'T6-60B': 18,
  'T6-80': 24,
}

/** CI-HD (Civic Institution — Health District): Article 4 Table 2 col. CI-HD
 *  gives a flat "8", with no Public Benefit percentage; Article 5 Illustration
 *  5.8 repeats "d. Floor Lot Ratio (FLR) 8". */
const CI_HD_BASE_FLR = 8

export interface MiamiLimits {
  heightFt: number | null
  stories: number | null
  maxFAR: number | null
  /** Miami 21 states "d. Floor Lot Ratio (FLR) N/A" for this zone — a KNOWN
   *  ABSENCE, not a lookup we failed. See the T4/T5/D branch below. */
  farUnconstrained: boolean
}

/**
 * Resolve Miami 21 limits from the zone code plus the layer's Bldg_Height text.
 * Returns nulls rather than guesses wherever the public data doesn't carry the
 * number — matching the conservative rule used across the other zoning modules.
 */
export function resolveMiami(zone: string | null | undefined, bldgHeight?: string | null): MiamiLimits {
  const none: MiamiLimits = { heightFt: null, stories: null, maxFAR: null, farUnconstrained: false }
  const z = (zone ?? '').trim().toUpperCase()
  if (!z) return none

  // T6: the layer states max stories directly (the trailing number in the zone
  // code agrees, e.g. T6-48A-O → 48). Prefer the field, fall back to the code.
  if (z.startsWith('T6')) {
    const fromField = Number(String(bldgHeight ?? '').trim())
    const m = /^T6-(\d+)([AB])?/.exec(z)
    const fromCode = m ? Number(m[1]) : NaN
    const stories = Number.isFinite(fromField) && fromField > 0 ? fromField : Number.isFinite(fromCode) && fromCode > 0 ? fromCode : null
    if (stories == null) return none
    // FLR comes from the ZONE CODE (Article 4 Table 2), never from the story
    // count: the story number does not determine it (T6-24a 7 vs T6-24b 16 are
    // the same 24 stories), and the trailing -R/-L/-O intensity does not either
    // (Table 2 states one FLR per T6 column). Unlisted key → null, not a guess.
    const maxFAR = m ? (T6_BASE_FLR[`T6-${m[1]}${m[2] ?? ''}`] ?? null) : null
    // Height in feet is the code-implied CEILING (stories × the 14 ft maximum
    // Story height), not a published limit. `stories` is the exact figure the
    // code states and is what downstream consumers should prefer.
    return { heightFt: Math.round(stories * MIAMI_MAX_FT_PER_STORY), stories, maxFAR, farUnconstrained: false }
  }

  // T3: exact, stated in feet by the code itself. Article 5 Illustration 5.3
  // states "d. Floor Lot Ratio (FLR) N/A" — Miami 21 imposes no FLR in T3.
  if (z.startsWith('T3')) return { heightFt: T3_MAX_HEIGHT_FT, stories: 2, maxFAR: null, farUnconstrained: true }

  // CI-HD: no published Height (Illustration 5.8 states Height by Story in a
  // separate row we do not read), but Table 2 does give a Floor Lot Ratio.
  if (z.startsWith('CI-HD')) return { heightFt: null, stories: null, maxFAR: CI_HD_BASE_FLR, farUnconstrained: false }

  // ── THE FLR ABSENCE, NOW REPORTED AS ONE ──────────────────────────────────
  //
  // This branch used to return a GAP-shaped null for T4/T5/D1/D2/D3, with a
  // comment saying the null was really a KNOWN ABSENCE and that reporting it
  // needed an `farUnconstrained` flag "outside this file". That flag now
  // exists, so the finding it recorded is finally published.
  //
  // Re-verified 2026-08-15 by rendering the primary document rather than
  // extracting it, agreeing with the earlier read on every point:
  //   · Article 5 Illustration 5.3 (T3), 5.4 (T4), 5.5 (T5), 5.9 (D1, D2) and
  //     5.10 (D3) each state "d. Floor Lot Ratio (FLR)  N/A".
  //   · Article 4 Table 2's FLR row is EMPTY for T1–T5 and for D1/D2/D3, while
  //     every other Lot Occupation row in those columns is filled — the row is
  //     populated exactly where the instrument applies, which is the slot test
  //     (rule 5) rather than a bare blank cell.
  //   · The only non-T6 column carrying a figure is CI-HD, at 8.
  //
  // HEIGHT is untouched and stays a gap: Table 2 states T4/T5/D heights in
  // STORIES and the GIS layer populates Bldg_Height only for T6.
  if (/^(T[145]|D[123])\b|^T4|^T5/.test(z)) {
    return { heightFt: null, stories: null, maxFAR: null, farUnconstrained: true }
  }

  // ⚠️ CI IS NOT ONE OF THEM, and its reason is specific. Miami 21 gives plain
  // CI no FLR row and no Table 2 column at all — § 5.7 covers CS and CI
  // together and has no FLR row, while § 5.8 (CI-HD) does. What governs instead
  // is § 5.7.2.4(b): "Development in a CI Zone shall follow the regulations of
  // the Abutting Transect Zone, except that Height restrictions shall be as
  // follows…". So a CI parcel's limits are a joint function of its NEIGHBOUR's
  // zoning (rule 13), which this provider does not read, and it must stay a GAP
  // rather than become an absence. CS is left alone for the same reason
  // (§ 5.7.1.4 defers it to "the most restrictive Abutting Transect Zone").
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
