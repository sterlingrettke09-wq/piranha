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
  'RM-1': 1.8, 'RM-2': 1.8, 'RTO': 1.8, 'SPD': 1.8,
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
