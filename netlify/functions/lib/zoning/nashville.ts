// Nashville / Davidson County FAR — Metro Code Title 17, Chapter 17.12
// (District Bulk Regulations), § 17.12.020 District Bulk Tables.
// Source: https://nashville-tn.elaws.us/code/coor_title17_ch17.12_sec17.12.020
//
// WHY THIS MODULE EXISTS
// Nashville's zoning service publishes ZONE_DESC and nothing dimensional. The
// 2026-08-11 sample returned 24 developable parcels and 24 gaps — the worst
// coverage of any wired city — because nothing mapped a district to a number.
// The numbers are public and have been all along.
//
// FOUR TABLES, AND THE FAR COLUMN IS NOT IN THE SAME PLACE IN EACH.
//   · Table 17.12.020A — single-family and two-family dwellings.
//     **HAS NO FAR COLUMN AT ALL.** Its columns are lot area, building
//     coverage, setbacks, height. This is a rule-5 absence established from the
//     table's own structure: single-family bulk in Nashville is governed by
//     COVERAGE, not by floor-area ratio.
//   · Table 17.12.020B — multifamily, mobile homes, nonresidential. FAR at
//     column index 3.
//   · Table 17.12.020C — all structures in the MU/O/C/SC/I districts. FAR at
//     column index **2**.
//   · Table 17.12.020D — the urban "-A" districts. FAR at column index 3.
//
// ⚠️ THE COLUMN INDEX IS THE WHOLE RISK HERE. A first pass read column 3 from
// every table and produced Table C values that were silently the Max. ISR
// column — MUN 0.80 instead of 0.60, CN 0.80 instead of 0.25, CF 1.00 instead
// of 5.00. Every one of those is a plausible FAR and none would have looked
// wrong downstream. This repo has shipped that defect once already (DC's MU
// columns). **Derive the column from the table's own header, never from its
// position in a sibling table.**
//
// FOOTNOTE NUMBERING IS PER-TABLE. Table B's "Note 2" and Table D's "Note 2"
// are different sentences. A global search for "Note 2:" returns whichever
// block appears first in the document and attributes it to the wrong table.
// Every note below was taken from the block that physically follows its own
// table.
//
// SCOPE READ (rule 23): § 17.12.020 only. NOT read, and therefore gaps:
//   · DTC — Table B and Table C both say "See Chapter 17.37". The downtown
//     form-based code is a separate chapter that has not been read. DTC is the
//     district the null inventory probes, so Nashville's headline probe stays a
//     gap until 17.37 is read. That is the honest state, not an oversight.
//   · SP — "Development standards shall be as specifically listed in the site
//     specific SP ordinance" (Table C, Note 5). Per-parcel by design.
//   · MHP — "See Ch. 17.16".
//   · Floor-area BONUSES under § 17.12.060 and the urban zoning overlay
//     modifiers (Table C Note 1: the I district becomes 1.50 inside the UZO).

/** How a district's floor area is regulated. */
export type NashvilleFarKind =
  /** A stated maximum FAR applies. */
  | 'stated'
  /** The code affirmatively states that no maximum FAR applies to a
   *  multifamily development here — a KNOWN ABSENCE, not a missing lookup. */
  | 'unconstrained'
  /** Standards live in another chapter or a site-specific ordinance. A GAP. */
  | 'elsewhere'

export interface NashvilleLimits {
  maxFAR: number | null
  farUnconstrained: boolean
  kind: NashvilleFarKind | null
  source: string | null
}

const T_B = 'Metro Code § 17.12.020, Table 17.12.020B (multifamily, mobile homes and nonresidential uses)'
const T_C = 'Metro Code § 17.12.020, Table 17.12.020C (all structures)'
const T_D = 'Metro Code § 17.12.020, Table 17.12.020D (urban "-A" districts)'
const NOTE_B2 =
  'Metro Code § 17.12.020, Table 17.12.020B Note 2: "No maximum FAR applies to multifamily developments in the RM15, RM20, RM40, RM60, OR20 or OR40 districts."'
const NOTE_D1 =
  'Metro Code § 17.12.020, Table 17.12.020D Note 1: no maximum FAR applies to multi-family developments in the RM9-A through RM40-A, OR20-A and OR40-A districts.'

interface Row {
  far: number | null
  kind: NashvilleFarKind
  source: string
}

const stated = (far: number, source: string): Row => ({ far, kind: 'stated', source })
const none = (source: string): Row => ({ far: null, kind: 'unconstrained', source })
const elsewhere = (source: string): Row => ({ far: null, kind: 'elsewhere', source })

/**
 * Every district § 17.12.020 assigns a floor-area rule to.
 *
 * THE MODELLED PROGRAM IS A MULTI-UNIT RESIDENTIAL BUILDING, which is what
 * `buildDefaultSpec` proposes. That choice decides which table governs, and it
 * is why the RM15/RM20/RM40/RM60/OR20/OR40 rows below are 'unconstrained'
 * rather than the 0.75/0.80/1.00/1.25 their own cells state: those figures bind
 * NON-multifamily development in those districts, and Note 2 removes the cap
 * for the multifamily case. Reporting the number would impose a cap the code
 * does not apply to the building being modelled.
 */
const DISTRICTS: Readonly<Record<string, Row>> = Object.freeze({
  // ── Table B. Agricultural and single-unit districts. The FAR here governs
  // multifamily and NONRESIDENTIAL development; a single- or two-family
  // dwelling in the same district is governed by Table A, which states no FAR.
  AG: stated(0.4, T_B),
  AR2A: stated(0.4, T_B),
  RS80: stated(0.4, T_B), R80: stated(0.4, T_B),
  RS40: stated(0.4, T_B), R40: stated(0.4, T_B),
  RS30: stated(0.4, T_B), R30: stated(0.4, T_B),
  RS20: stated(0.4, T_B), R20: stated(0.4, T_B),
  RS15: stated(0.4, T_B), R15: stated(0.4, T_B),
  RS10: stated(0.4, T_B), R10: stated(0.4, T_B),
  R8: stated(0.5, T_B), 'R8-A': stated(0.5, T_B),
  'RS7.5': stated(0.5, T_B), 'RS7.5-A': stated(0.5, T_B),
  R6: stated(0.6, T_B), 'R6-A': stated(0.6, T_B),
  RS5: stated(0.6, T_B), 'RS5-A': stated(0.6, T_B),
  'RS3.75': stated(0.6, T_B), 'RS3.75-A': stated(0.6, T_B),

  // ── Table B, multifamily districts. RM2/RM4/RM6/RM9 state a cap; RM15 and up
  // carry Note 2 and are uncapped for the multifamily case.
  RM2: stated(0.4, T_B),
  RM4: stated(0.4, T_B),
  RM6: stated(0.6, T_B),
  RM9: stated(0.6, T_B),
  RM15: none(NOTE_B2),
  RM20: none(NOTE_B2), OR20: none(NOTE_B2),
  RM40: none(NOTE_B2), OR40: none(NOTE_B2),
  RM60: none(NOTE_B2),

  // ── Table C. Mixed-use, office, commercial, shopping-centre, industrial.
  // Note 2 on the MU rows is a floor-area BONUS (§ 17.12.060), not an absence:
  // "Floor area bonuses are available…". A bonus is a discretionary addition on
  // top of the base, so the base stays the headline (rule 6).
  MUN: stated(0.6, T_C),
  MUL: stated(1.0, T_C),
  MUG: stated(3.0, T_C),
  MUI: stated(5.0, T_C),
  ON: stated(0.4, T_C),
  OL: stated(0.75, T_C),
  OG: stated(1.5, T_C),
  ORI: stated(3.0, T_C),
  CN: stated(0.25, T_C),
  CL: stated(0.6, T_C),
  CS: stated(0.6, T_C),
  CA: stated(0.6, T_C),
  CF: stated(5.0, T_C),
  SCN: stated(0.25, T_C),
  SCC: stated(0.5, T_C),
  SCR: stated(1.0, T_C),
  IWD: stated(0.8, T_C),
  IR: stated(0.6, T_C),
  IG: stated(0.6, T_C),

  // ── Table D, the urban "-A" districts.
  'MUN-A': stated(0.6, T_D),
  'MUL-A': stated(1.0, T_D),
  'MUG-A': stated(3.0, T_D),
  'MUI-A': stated(5.0, T_D),
  'ORI-A': stated(3.0, T_D),
  'CN-A': stated(0.25, T_D),
  'CL-A': stated(0.6, T_D),
  'CS-A': stated(0.6, T_D),
  // Note 1 removes the multifamily cap across RM9-A…RM40-A, OR20-A, OR40-A.
  'RM9-A': none(NOTE_D1),
  'RM15-A': none(NOTE_D1),
  'RM20-A': none(NOTE_D1), 'OR20-A': none(NOTE_D1),
  'RM40-A': none(NOTE_D1), 'OR40-A': none(NOTE_D1),
  // These three state "None" in the FAR cell itself — the table's own word.
  'RM60-A': none(T_D),
  'RM80-A': none(T_D),
  'RM100-A': none(T_D),

  // ── Cross-references. Recorded so the reason is legible, but they resolve to
  // NOTHING: an unread chapter is a gap, not an absence (rule 23).
  DTC: elsewhere('Metro Code § 17.12.020 Tables B and C: "See Chapter 17.37" — the Downtown Code, not read'),
  MHP: elsewhere('Metro Code § 17.12.020, Table 17.12.020B: "See Ch. 17.16"'),
  SP: elsewhere(
    'Metro Code § 17.12.020, Table 17.12.020C Note 5: "Development standards shall be as specifically listed in the site specific SP ordinance."',
  ),
})

export const NASHVILLE_DISTRICT_CODES: readonly string[] = Object.freeze(Object.keys(DISTRICTS))

const UNRESOLVED: NashvilleLimits = Object.freeze({
  maxFAR: null,
  farUnconstrained: false,
  kind: null,
  source: null,
})

/**
 * Normalise a Metro `ZONE_DESC` to a table key.
 *
 * ZONE_DESC carries the bare district for base zones ("RM20-A", "CL"). An SP
 * district arrives as "SP" possibly followed by an ordinance number, and the
 * satellite-city polygons arrive as prose ("Satellite City") which the provider
 * already refuses upstream.
 */
export function nashvilleZoneKey(code: string | null | undefined): string | null {
  if (!code) return null
  const z = String(code).trim().toUpperCase().replace(/\s+/g, '')
  if (!z) return null
  if (z in DISTRICTS) return z
  // "SP-2019-123" and friends all resolve to the SP row, which is itself a gap.
  if (/^SP\b|^SP-/.test(z)) return 'SP'
  // The "-NS" overlay suffix — RM40-A-NS, RM20-A-NS. NS is a USE restriction,
  // not a bulk one: BL2019-111 prohibits "Short Term Rental Property - Owner
  // Occupied and Short Term Rental Property - Not Owner Occupied" in NS
  // districts, and says nothing about floor area, height or setbacks. So the
  // base district's dimensional standards apply unchanged and the suffix is
  // dropped for the FAR lookup.
  //
  // Deliberately the ONLY suffix stripped here. Nashville hangs several
  // overlays off a base code and the others have not been read; stripping an
  // unknown suffix would resolve a district by discarding the part that might
  // change the answer, which is worse than the gap it closes.
  const withoutNs = z.replace(/-NS$/, '')
  if (withoutNs !== z && withoutNs in DISTRICTS) return withoutNs
  return null
}

/**
 * Resolve a Nashville district to its floor-area rule.
 *
 * Returns three distinguishable states, and the distinction is the point:
 *   · `kind: 'stated'`        — maxFAR is a number the code states.
 *   · `kind: 'unconstrained'` — the code says no FAR applies. An ANSWER.
 *   · `kind: 'elsewhere'` / null — a GAP. Standards exist somewhere unread.
 */
export function resolveNashville(code: string | null | undefined): NashvilleLimits {
  const key = nashvilleZoneKey(code)
  if (!key) return UNRESOLVED
  const row = DISTRICTS[key]
  if (row.kind === 'elsewhere') {
    // Deliberately reports NO limit and NO absence — the source string exists
    // to explain the gap, not to license an answer.
    return { maxFAR: null, farUnconstrained: false, kind: 'elsewhere', source: row.source }
  }
  return {
    maxFAR: row.far,
    farUnconstrained: row.kind === 'unconstrained',
    kind: row.kind,
    source: row.source,
  }
}
