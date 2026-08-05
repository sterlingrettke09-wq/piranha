// San Francisco FAR — Planning Code Article 1.2 §124 "Basic Floor Area Ratio".
//
// Source read from the primary text 2026-08-04: American Legal / eCode ALP,
// San Francisco Planning Code, supplement **2026 S-96 (current)**.
//
// ── THE GOVERNING FACT ──────────────────────────────────────────────────────
// §124(b), verbatim:
//
//   "In R, RC, NC, and Mixed Use Districts, Floor Area Ratio limits shall not
//    apply to Residential Uses."
//
// That is a KNOWN ABSENCE for the tool's dominant case. The sf.ts provider
// previously carried the comment "SF residential is largely form-based
// (height/bulk), not FAR" — correct in substance but unsourced, and it left
// maxFAR null WITHOUT the farUnconstrained flag, so a residential SF parcel
// rendered as "not in public data" (a gap) rather than "no FAR limit applies"
// (an answer), and defaultSpec fell through to its FAR-1.0 guess.
//
// The exemption is per-USE, not per-district: the same RH-1 lot has NO
// residential FAR but a 1.8 non-residential FAR from Table 124. Districts
// OUTSIDE the (b) list — C-2, the C-3 family, M-1/M-2 — carry a FAR that binds
// every use, residential included.
//
// (b) continues with a Chinatown proviso and a §207.10 dwelling-unit-size
// conditional-use trigger; neither changes the FAR limit itself, so neither is
// modelled here. The named NCD/NCT districts each carry their own Table 124
// non-residential figure; only the codes matched below are encoded, and
// anything unmatched returns null — unresolved, never guessed.
//
// ── RE-VERIFIED 2026-08-05, against the ENACTING ORDINANCE ──────────────────
// codelibrary.amlegal.com returned HTTP 403 to every fetch on this date, so the
// consolidated text could not be re-read. Verified instead against the primary
// legislative source: **Ord. 245-25** (San Francisco Family Zoning Plan
// Planning Code amendments, Board File 250701; signed 12/12/2025, EFFECTIVE
// 1/12/2026), sfbos.archive.sf.gov/sites/default/files/o0245-25.pdf, § 124 at
// ordinance p. 85 — read as a page image, not OCR prose.
//
// That redline CONFIRMS the § 124(b) quote above rather than changing it: the
// ordinance strikes "dwellings or to other" and capitalises, so (b) now ends
// "...shall not apply to Residential Uses." The quote at the top of this file
// is the post-amendment text and stands as written.
//
// Ord. 245-25 makes exactly ONE change to Table 124 — the RTO row (see below).
// Ord. 124-25 (Eff. 9/1/2025) left Table 124 as "* * * *" (unchanged) and added
// (m), a narrow C-3 ground-floor change-of-use exclusion that does not alter any
// district's basic FAR. Every other figure below therefore still traces to the
// Table 124 text captured 2025-02-18 (Internet Archive copy of the same amlegal
// section, whose amendment history ends at Ord. 33-24, Eff. 3/23/2024), and
// each was independently corroborated against its Article 2 Zoning Control
// Table as reprinted in Ord. 245-25: RH 1.8 (p. 60), RM-1/2 1.8, RM-3 3.6,
// RM-4 4.8 (p. 68), RC-3 3.6, RC-4 4.8 (p. 76), C-2 3.6, C-3-O 9.0,
// C-3-O(SD)/C-3-R/C-3-G 6.0, C-3-S 5.0, M-1/M-2 5.0. Two structurally
// independent tables, no disagreement.
//
// ── NOT MODELLED (known, and named in the correct direction) ────────────────
// § 124(a) yields to subsections (c), (d) and (e), none of which are resolvable
// from a district code alone. Text as captured 2025-02-18 and untouched by
// Ord. 124-25 / Ord. 245-25:
//   · (c) C-2 — "4.8 to 1 for a lot which is nearer to an RM-4 or RC-4 District
//     than to any other R District, and 10.0 to 1 for a lot which is nearer to a
//     C-3 District than to any R District." Needs a proximity measurement we do
//     not perform, so C-2 below carries the Table 124 base of 3.6. For those
//     lots the true limit is HIGHER — this errs toward under-stating, never over.
//   · (d) Van Ness SUD (§ 243) and (e) Waterfront SUDs (§§ 240–240.3) — (e)
//     verbatim: "the basic floor area ratio limit in any C District shall be 5.0
//     to 1." Needs a special-use-district layer the provider does not fetch. For
//     a C-3 lot inside a Waterfront SUD the figure below is HIGHER than the code
//     allows (9.0 or 6.0 published against a 5.0 limit). This is the one
//     direction that over-states, and it is why this note exists rather than a
//     silent assumption that a district code settles the question.

export interface SfFar {
  /** Basic FAR that binds ALL uses (districts outside the §124(b) exemption). */
  maxFAR: number | null
  /** TRUE where §124(b) exempts Residential Uses from any FAR limit. */
  residentialExempt: boolean
  /** Table 124 basic FAR, which still governs NON-residential uses in an
   *  exempt district. Null when not matched. */
  nonResidentialFAR: number | null
}

const NONE: SfFar = { maxFAR: null, residentialExempt: false, nonResidentialFAR: null }

// Table 124 basic FAR by district code, as published. Exact-match keys only.
const TABLE_124: Record<string, number> = {
  'RED': 1.0, 'RED-MX': 1.0,
  'RH-1': 1.8, 'RH-1(D)': 1.8, 'RH-1(S)': 1.8, 'RH-2': 1.8, 'RH-3': 1.8,
  'RM-1': 1.8, 'RM-2': 1.8, 'SPD': 1.8,
  // RTO: keyed on the THREE district codes the map actually carries, not the
  // family name. Table 124's row is the defined term "RTO" (Ord. 245-25 struck
  // the separate "RTO-M" from that row), and § 201 as amended supplies the
  // definition, verbatim: "'RTO District' shall mean any RTO-1, RTO-C, or
  // RTO-M District" (Ord. 245-25 p. 95). Confirmed independently by Table 209.4
  // ZONING CONTROL TABLE FOR RTO DISTRICTS, row "Floor Area Ratio" (§§ 102,
  // 123, 124, 207.9), which prints per column: RTO-1 "1.8 to 1", RTO-M "1.8 to
  // 1", RTO-C "1.8 to 1. For Office Uses minimum intensities may apply pursuant
  // to § 207.9." (Ord. 245-25 p. 109.) That trailing clause is a MINIMUM
  // intensity for office use, not a higher cap — the ceiling stays 1.8.
  'RTO-1': 1.8, 'RTO-M': 1.8, 'RTO-C': 1.8,
  'NC-1': 1.8, 'NCT-1': 1.8, 'NC-S': 1.8,
  'NC-2': 2.5, 'NCT-2': 2.5, 'RCD': 2.5,
  'RM-3': 3.6, 'RC-3': 3.6, 'C-2': 3.6, 'NC-3': 3.6, 'NCT-3': 3.6,
  'RM-4': 4.8, 'RC-4': 4.8,
  // Chinatown (GIS emits CRNC / CVR / CCB).
  'CRNC': 1.0, 'CVR': 2.0, 'CCB': 2.8,
  'C-3-S': 5.0, 'M-1': 5.0, 'M-2': 5.0,
  'C-3-O(SD)': 6.0, 'C-3-R': 6.0, 'C-3-G': 6.0,
  'C-3-O': 9.0,
}

// §124(b) exemption families: R, RC, NC, and Mixed Use Districts.
// R  → RH-*, RM-*, RTO*, RED*   ·   RC → RC-*   ·   NC → NC-*, NCT-*, NCD-*
// Mixed Use → MUG, MUO, MUR, UMU, WMUG, WMUO
// SALI is deliberately EXCLUDED: Table 124 groups it with the Mixed Use rows,
// but §124(b) names "Mixed Use Districts" and SALI is Service/Arts/Light
// Industrial. Treating it as exempt would assert an exemption the text does not
// clearly give, so it falls through unresolved.
function isResidentialExempt(z: string): boolean {
  return (
    /^RH-/.test(z) || /^RM-/.test(z) || /^RTO/.test(z) || /^RED/.test(z) ||
    /^RC-/.test(z) ||
    /^NC-/.test(z) || /^NCT/.test(z) || /^NCD/.test(z) || z === 'NC-S' ||
    /^(MUG|MUO|MUR|UMU|WMUG|WMUO)$/.test(z)
  )
}

/**
 * Resolve SF FAR for a zoning code (the GIS `zoning` field, e.g. "RH-2",
 * "NCD-CASTRO", "C-3-O"). Never guesses: an unmatched code yields all-null.
 */
export function resolveSfFar(zone: string | null | undefined): SfFar {
  if (!zone) return NONE
  const z = zone.trim().toUpperCase()
  const exempt = isResidentialExempt(z)
  // Named neighbourhood districts (NCD-CASTRO, NCT-24TH-MISSION…) carry their
  // own Table 124 figure that is NOT keyed on the family prefix, so we do not
  // infer one. The residential exemption still applies — it is granted to the
  // whole NC family by (b), independent of the per-district number.
  const table = TABLE_124[z] ?? null
  if (exempt) {
    return { maxFAR: null, residentialExempt: true, nonResidentialFAR: table }
  }
  // Outside the exemption the basic FAR binds every use, residential included.
  return { maxFAR: table, residentialExempt: false, nonResidentialFAR: table }
}
