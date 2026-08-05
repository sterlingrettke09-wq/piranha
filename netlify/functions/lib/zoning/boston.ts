// Boston base-subdistrict FAR, transcribed from the zoning code itself.
//
// SOURCE: Boston Zoning Code (Boston Redevelopment Authority), Municode
// "Update 46" — banner: "Codified through Text Amd. No. 494, effective
// January 12, 2026." Read 2026-08-05 via api.municode.com
// (productId 15398, jobId 489723); the library.municode.com HTML is a JS shell.
//
// WHY THIS EXISTS — Boston encodes the FAR in the district NAME, and the code
// says so in as many words. Article 3, Section 3-1 ("Division of City Into
// Districts", Text Amd. No. 494, § 3, 1-12-2026):
//
//   "Each of the residential, business, and industrial classes is further
//    subdivided into subdistricts, which are identified by a number specifying
//    the maximum allowed floor area ratio and some of which have a second
//    number specifying a height limit."
//
// and Article 13 — TABLES, footnote (15) to Table B:
//
//   "Except in a district designated with two numerical parts, in which case
//    the second number is the maximum height in feet. See Section 3-1A (i)."
//
// The BPDA zoning layer leaves `FARMax` null on the two-numerical-part
// subdistricts (B-1-55, H-2-55, H-2-D-65, I-2-D-65, L-2-65, M-1-55 — all six
// as of 2026-08-05). With no provider value, `resolveZoningLimits` fell through
// to the per-FAMILY-LETTER seed constants in zoningLimits.ts, which assign one
// FAR to every district sharing a leading letter (B → 2.0). That is exactly the
// number the code's own naming rule contradicts: B-1-55's base district is B-1,
// whose Table B FAR is 1.0. Measured live on Columbia Point parcel 1303448000
// (lot 752,109 sf) the envelope published 1,504,218 sf / 1,157 units — twice
// the floor area the code allows.
//
// The table below is Table B's "FLOOR AREA RATIO maximum" column, verbatim.
// Every listed district states ONE FAR across all of its "TYPE OF USE" rows
// (1-family / any-other-dwelling / other use), so there is no larger-of-two
// alternatives to pick between — see CLAUDE.md rule 6.
//
// EXTERNAL VALIDATION (CLAUDE.md rule 9): resolved against the live BPDA layer
// Zoning_Subdistricts_Urban_20240719/93 on 2026-08-05. Of the 43 distinct
// (Name, Article, District) rows this resolver matches, 37 carry a published
// `FARMax` — and it agrees with this table on all 37, exactly. The remaining 6
// are the null-FAR rows above. Zero false positives: no Article 60 R1/R2, no
// Article 26 S0–S4, no MU-*/NS-*/LI-*/1F-*/EBR-*/OS-* subdistrict resolves here.
//
// DELIBERATELY NOT HERE:
//   - Height. Table B states heights too, but the BPDA layer already publishes
//     `HeightMax` for every base district, and for the two-numerical-part names
//     footnote (15) makes the trailing number itself the limit — which
//     zoningLimits.ts already reads. Adding a second path would re-introduce the
//     round-trip this repo has shipped three times (CLAUDE.md rule 12).
//   - Neighborhood/Downtown/Harborpark subdistricts. Section 3-1 confines the
//     "number = FAR" rule to "the residential, business, and industrial
//     classes"; it says separately that neighborhood, downtown, mixed use and
//     Harborpark districts "are divided into variously titled subdistricts and
//     subareas, as set forth in the applicable articles of this code." Their
//     FARs live in each article's own table and are NOT transcribed here.
//   - Districts absent from Table B (e.g. "R-1", "B-5"). Section 3-1's general
//     rule would imply a figure; Table B does not state one. A rule-derived
//     number is not a read one, so these return null.

/** Article 3 § 3-1 district classes whose subdistrict number is the FAR. */
const CLASSES = new Set(['S', 'R', 'H', 'L', 'B', 'M', 'I', 'MER', 'W'])

/**
 * Boston Zoning Code Art. 13 — TABLES, TABLE B "DIMENSIONAL REGULATIONS",
 * column "FLOOR AREA RATIO maximum (1)". Keyed by the BASE district (class +
 * FAR number); the height suffix and any overlay letter are stripped first.
 *
 * B-3 / B-6 have no bare row — their figures are Table B's "B-3-65" (3.0) and
 * "B-6-90a"/"B-6-90b" (6.0) rows, which is the same base district under
 * footnote (15). Likewise H-1 covers Table B's "H-1", "H-1-40" and "H-1-50"
 * rows (all 1.0) and H-3 covers "H-3" and "H-3-65" (both 3.0).
 */
const TABLE_B_FAR: Record<string, number> = {
  'S-.3': 0.3,
  'S-.5': 0.5,
  'R-.5': 0.5,
  'R-.8': 0.8,
  'H-1': 1.0,
  'H-2': 2.0,
  'H-3': 3.0,
  'H-4': 4.0,
  'H-5': 5.0,
  'L-.5': 0.5,
  'L-1': 1.0,
  'L-2': 2.0,
  'B-1': 1.0,
  'B-2': 2.0,
  'B-3': 3.0,
  'B-4': 4.0,
  'B-6': 6.0,
  'B-8': 8.0,
  'B-10': 10.0,
  'M-1': 1.0,
  'M-2': 2.0,
  'M-4': 4.0,
  'M-8': 8.0,
  'I-2': 2.0,
  'MER-2': 2.0,
  'W-2': 2.0,
}

/**
 * Reduce a BPDA subdistrict name to its Table B base district, or null when the
 * name is not one of the Article 3 § 3-1 residential/business/industrial
 * subdistricts.
 *
 * Everything after the FAR number is an overlay or a height cap, and Section
 * 3-1A enumerates the overlay markers: "D" for a planned development area (a),
 * "U" for an urban renewal area (b), "E" for adult entertainment (d), an
 * asterisk for a restricted roof structure district (g), and "a second
 * numerical suffix" for a limited height district (i). Section 3-1A also states
 * that "[i]n an overlay district the regulations specified for the base
 * subdistrict or subdistricts shall apply, insofar as they are not in conflict
 * with special regulations specified for a particular overlay district" — so
 * the base district's FAR is the right base figure for all of them. (A planned
 * development area may have an Article 80 development plan setting different
 * dimensions; the base subdistrict figure is what applies absent one.)
 */
export function bostonBaseDistrict(districtCode: string): string | null {
  const parts = districtCode.toUpperCase().trim().replace(/\*+$/, '').split('-')
  if (parts.length < 2) return null
  if (!CLASSES.has(parts[0])) return null
  // The FAR part is written either as a whole number ("B-1", "B-10") or as a
  // leading-decimal fraction ("R-.8", "S-.3", "L-.5").
  if (!/^\.?\d+(\.\d+)?$/.test(parts[1])) return null
  return `${parts[0]}-${parts[1]}`
}

/**
 * Maximum FAR for a Boston subdistrict per Art. 13 Table B, or null when the
 * code states none for it here. Null is a GAP, not "no FAR applies" — most
 * Boston subdistricts are governed by a neighborhood article's own table
 * (CLAUDE.md rule 5).
 *
 * The BPDA-published `FARMax` always wins over this in the provider; this only
 * fills the null.
 */
export function resolveBostonFar(districtCode: string): number | null {
  const base = bostonBaseDistrict(districtCode)
  return base != null ? TABLE_B_FAR[base] ?? null : null
}
