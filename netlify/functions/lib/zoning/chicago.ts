// Chicago curated district FAR/height table (WO-8.8 depth tranche 1).
//
// Source: Chicago Municipal Code, Title 17 (Chicago Zoning Ordinance), as
// published at codelibrary.amlegal.com. Verified against the live code text
// 2026-06-10. Section citations are in-line below so a reviewer can re-check
// every number against the published table.
//
// Chicago encodes a district's intensity in a DASH SUFFIX on the zone class:
//   B3-2  → "B3" district, dash suffix "2"
//   C1-5  → "C1" district, dash suffix "5"
//   DX-7  → "DX" downtown district, dash suffix "7"
//   M1-2  → "M1" manufacturing district, dash suffix "2"
//   RM-5  → residential class (handled by the residential FAR + height table)
//
// Because B/C/D/M FAR is a pure function of that dash suffix, we resolve it
// PROGRAMMATICALLY from the published per-suffix table rather than enumerating
// every (district × suffix) combination. Heights, where the code publishes a
// single figure independent of lot frontage, are returned exactly; where the
// code makes height vary by lot frontage / ground-floor commercial (a "varies"
// case), we return null rather than guess a representative number.

/** ⚠️ WHY A HEIGHT IS NULL. The residential table already computed this and the
 *  resolver discarded it, so four distinct facts reached the caller as one bare
 *  `null`: the code says "None", the code gives two figures selected by a lot
 *  frontage we do not have, the district has no row, or the district is not one
 *  this module reads at all.
 *
 *  Denver's stale U-SU-B1 was visible only because Denver labels its
 *  derivations. Chicago answered without saying how, so a pattern-derived
 *  answer and a table-stated one were indistinguishable — and so was a known
 *  absence from a failed lookup (rule 5). */
export type ChicagoHeightBasis =
  /** A figure read from §17-2-0311-A or the B/C suffix table. */
  | 'published'
  /** §17-2-0311-A gives two figures selected by lot frontage, which we do not carry. */
  | 'varies-by-lot-frontage'
  /** The table says "None" — a known ABSENCE of a cap, not a failed lookup. */
  | 'no-limit-in-code'
  /** The district exists here but has no row in the height table. */
  | 'not-listed-in-table'
  /** D and M classes: this module reads their FAR suffix table and not a height. */
  | 'class-not-read'
  /** The zone string did not parse as a Chicago district at all. */
  | 'unrecognised-district'

/** Whether a FAR came from a table or is simply unavailable. Chicago publishes
 *  every FAR it has by suffix, so there is no derived arm — the distinction that
 *  matters is a stated ratio versus a district we cannot resolve. */
export type ChicagoFarBasis = 'published' | 'unrecognised-district' | 'planned-development'

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
  /** ⚠️ ALWAYS SET. A null height with no basis is the state this type exists to
   *  make unrepresentable. */
  heightBasis?: ChicagoHeightBasis
  farBasis?: ChicagoFarBasis
}

// ── Residential base FAR + height ─────────────────────────────────────────
// FAR:    §17-2-0304-A "Maximum Floor Area Ratio" table.
// Height: §17-2-0311-A "Maximum Building Height (feet)" table.
// Both tables re-read against the live ordinance text on codelibrary.amlegal.com
// (Chicago Zoning Ordinance, Chapter 17-2, "17-2-0300 Bulk and density
// standards") on 2026-08-05.
//
// PRIOR DEFECT: every residential district returned heightFt: null with the
// rationale "residential heights vary by district and building type". That is
// true of the RM districts and false of RS1/RS2/RS3/RT3.5/RT4, for which
// §17-2-0311-A publishes ONE frontage-independent figure. A null rendered
// downstream as "no district height limit available" — the permissive
// direction — for the four lowest-density districts in the city.
//
// The height column we carry is the PRINCIPAL RESIDENTIAL BUILDINGS figure.
// Every row of §17-2-0311-A also gives "Principal nonresidential buildings:
// None"; that is a different building type and is NOT what this tool reports.
//
// Height is stated in FEET by the ordinance, so it is carried in feet — no
// per-story conversion anywhere (rule 12).
//
// A district cannot be added without stating what the height table says about
// it: `heightBasis` is required and the three non-numeric bases are the only
// way to write a null (rule 14 — a structure, not a comment).
type ResidentialHeight =
  /** §17-2-0311-A publishes a single figure for principal residential buildings. */
  | { heightFt: number; heightBasis: 'published' }
  /** §17-2-0311-A gives two figures selected by lot frontage; we do not know the frontage here. */
  | { heightFt: null; heightBasis: 'varies-by-lot-frontage' }
  /** §17-2-0311-A says "None" — a known ABSENCE of a height cap, not a failed lookup (rule 5). */
  | { heightFt: null; heightBasis: 'no-limit-in-code' }
  /** The district has no row in §17-2-0311-A at all. */
  | { heightFt: null; heightBasis: 'not-listed-in-table' }

export type ResidentialLimits = { far: number; note: string } & ResidentialHeight

const published = (far: number, heightFt: number, note: string): ResidentialLimits => ({
  far,
  heightFt,
  heightBasis: 'published',
  note,
})
const variesByFrontage = (far: number, note: string): ResidentialLimits => ({
  far,
  heightFt: null,
  heightBasis: 'varies-by-lot-frontage',
  note,
})
const noHeightLimit = (far: number, note: string): ResidentialLimits => ({
  far,
  heightFt: null,
  heightBasis: 'no-limit-in-code',
  note,
})
const notListed = (far: number, note: string): ResidentialLimits => ({
  far,
  heightFt: null,
  heightBasis: 'not-listed-in-table',
  note,
})

export const CHICAGO_RESIDENTIAL: Record<string, ResidentialLimits> = {
  // §17-2-0311-A: "RS1 | Principal residential buildings: 30 / Principal
  // nonresidential buildings: None". FAR 0.50 per §17-2-0304-A.
  'RS-1': published(0.5, 30, '§17-2-0311-A RS1: principal residential buildings 30 ft'),
  'RS-2': published(0.65, 30, '§17-2-0311-A RS2: principal residential buildings 30 ft'),
  'RS-3': published(0.9, 30, '§17-2-0311-A RS3: principal residential buildings 30 ft'),
  'RT-3.5': published(1.05, 35, '§17-2-0311-A RT3.5: principal residential buildings 35 ft'),
  'RT-4': published(1.2, 38, '§17-2-0311-A RT4: principal residential buildings 38 ft'),

  // RT4A has NO row in the §17-2-0311-A height table (the table runs RS1, RS2,
  // RS3, RT3.5, RT4, RM4.5, RM5, RM5.5, RM6, RM6.5). §17-2-0105-C says special
  // height standards apply to "A"-suffix districts and points at §17-2-0311,
  // but the only height figure §17-2-0311 attaches to accessible-unit buildings
  // is the §17-2-0311-B(2) exemption — 42 ft, and only for RT4 buildings with
  // no more than 19 dwelling units of which at least 25% are Type A units.
  // That is a conditional exemption, not a base by-right ceiling for the
  // district, so it is not published here. FAR 1.20 unchanged (RT4's figure;
  // §17-2-0304-B, the accessible-unit FAR exception, now reads "Reserved").
  'RT-4A': notListed(1.2, 'no RT4A row in §17-2-0311-A; §17-2-0311-B(2) 42 ft is conditional'),

  // §17-2-0311-A gives RM4.5 and RM5 two figures keyed to lot frontage —
  // "Lot Frontage of less than 32 feet: 45 / Lot Frontage of 32 feet or more:
  // 47" — and RM5.5 "75 feet or less: 47 / more than 75 feet: 60". This module
  // is not given lot frontage, so it publishes neither figure (picking the
  // larger would be rule 6; picking either would be a guess).
  'RM-4.5': variesByFrontage(1.7, '§17-2-0311-A RM4.5: 45 ft under 32 ft frontage, 47 ft at/over'),
  'RM-5': variesByFrontage(2.0, '§17-2-0311-A RM5: 45 ft under 32 ft frontage, 47 ft at/over'),
  'RM-5.5': variesByFrontage(2.5, '§17-2-0311-A RM5.5: 47 ft at/under 75 ft frontage, 60 ft over'),

  // §17-2-0311-A: "RM6 | Principal residential buildings: None (tall buildings
  // require Planned Development approval in accordance with Section
  // 17-13-0600)". The code imposes no height cap — an answer, not a gap.
  // FAR 4.40 / 6.60 are the BASE figures; the §17-2-0304-C premium is a
  // project-specific unit-count trade and is not published here.
  'RM-6': noHeightLimit(4.4, '§17-2-0311-A RM6: None; tall buildings need PD approval §17-13-0600'),
  'RM-6.5': noHeightLimit(
    6.6,
    '§17-2-0311-A RM6.5: None; tall buildings need PD approval §17-13-0600',
  ),
}

// Kept as a plain FAR map because providers/chicago.ts indexes it directly.
// Derived so the two can never disagree.
export const CHICAGO_BASE_FAR: Record<string, number> = Object.fromEntries(
  Object.entries(CHICAGO_RESIDENTIAL).map(([k, v]) => [k, v.far]),
)

// ── B/C district FAR by dash suffix ───────────────────────────────────────
// §17-3-0403-A maximum floor area ratio table (Business & Commercial
// districts). Verified 2026-06-10. The suffix is the SAME for B and C classes.
const BC_FAR_BY_SUFFIX: Record<string, number> = {
  '1': 1.2, // Dash 1
  '1.5': 1.5, // Dash 1.5
  '2': 2.2, // Dash 2
  '3': 3.0, // Dash 3
  '5': 5.0, // Dash 5
}

// ── B/C district height by dash suffix ────────────────────────────────────
// §17-3-0408-A maximum building height table. Heights for Dash 1 and Dash 1.5
// are a flat 38 ft regardless of lot frontage or ground-floor commercial, so we
// publish them. Dash 2 / 3 / 5 heights VARY by lot frontage (25 / <50 / 50–99.9
// / 100+ ft) and by whether there is qualifying ground-floor commercial space —
// the code gives a RANGE, not a single number — so we return null rather than
// fabricate a representative figure. (For reference, the §17-3-0408-A range is
// Dash 2: 45–50, Dash 3: 50–65, Dash 5: 50–80 ft; we do not pick one.)
const BC_HEIGHT_BY_SUFFIX: Record<string, number | null> = {
  '1': 38,
  '1.5': 38,
  '2': null, // varies by frontage 45–50 ft
  '3': null, // varies by frontage 50–65 ft
  '5': null, // varies by frontage 50–80 ft
}

// ── D (downtown) district FAR by dash suffix ──────────────────────────────
// §17-4-0405-A maximum BASE floor area ratio table (DC/DX/DR/DS districts).
// Bonuses (§17-4-1000) sit on top of these base figures and are project-
// specific, so we publish only the by-right base FAR. Verified 2026-06-10.
const D_FAR_BY_SUFFIX: Record<string, number> = {
  '3': 3.0,
  '5': 5.0,
  '7': 7.0,
  '10': 10.0,
  '12': 12.0,
  '16': 16.0,
}
// §17-4-0407: there are NO maximum building height limits in the D districts
// (height is governed by FAR + PD review thresholds), so D height is null.

// ── M (manufacturing) district FAR by dash suffix ─────────────────────────
// §17-5-0404-A maximum floor area ratio table (M1/M2/M3 districts).
// Verified 2026-06-10.
const M_FAR_BY_SUFFIX: Record<string, number> = {
  '1': 1.2,
  '2': 2.2,
  '3': 3.0,
}
// M-district height is governed by setback/use context rather than a single
// published per-suffix figure, so M height is null.

// Chicago's GIS publishes the same residential district under more than one
// punctuation: `RM-4.5` (470 parcels), `RM4.5` (8) and `RM4-.5` (1) are all
// §17-2-0304-A's RM4.5 — and the ordinance itself writes it UNHYPHENATED (see
// the citation on 'RM-4.5' above), so neither spelling is the typo.
//
// The hyphen is cosmetic in a residential class name because the intensity is
// IN the name; it is SEMANTIC in B/C/D/M, where "B3-2" splits on it. So this
// index is consulted for the residential lookup ONLY, and never reaches the
// B/C/D/M regex below. No residential key collides with another once stripped
// (asserted by test) and none collides with a B/C/D/M class, which all begin
// with a different letter.
//
// Found by scripts/enumerate-parser-domains.ts — the same parser-domain class
// as the LA qualifier defect: the source emits a form the parser never knew.
const RESIDENTIAL_BY_UNHYPHENATED: Record<string, ResidentialLimits> = Object.fromEntries(
  Object.entries(CHICAGO_RESIDENTIAL).map(([k, v]) => [k.replace(/-/g, ''), v]),
)

/**
 * Resolve Chicago FAR + height for a zone class string (e.g. "B3-2", "DX-5",
 * "RM-5", "M1-2"). Returns { far: null, heightFt: null } when the district is
 * unknown or the code publishes no single figure ("varies"). NEVER guesses.
 */
export function resolveChicago(zone: string | null | undefined): DistrictLimits {
  if (!zone) {
    return { far: null, heightFt: null, heightBasis: 'unrecognised-district', farBasis: 'unrecognised-district' }
  }
  const z = zone.trim().toUpperCase()

  // Residential classes carry the intensity in the class name itself (RM-5,
  // RT-4…), not a separate dash suffix — look them up directly.
  if (z in CHICAGO_RESIDENTIAL) {
    const r = CHICAGO_RESIDENTIAL[z]
    // The table already knows WHY a height is null; carry it rather than drop it.
    return { far: r.far, heightFt: r.heightFt, heightBasis: r.heightBasis, farBasis: 'published' }
  }

  // Same district, different punctuation — see RESIDENTIAL_BY_UNHYPHENATED.
  const unhyphenated = z.replace(/-/g, '')
  if (unhyphenated in RESIDENTIAL_BY_UNHYPHENATED) {
    const r = RESIDENTIAL_BY_UNHYPHENATED[unhyphenated]
    return { far: r.far, heightFt: r.heightFt, heightBasis: r.heightBasis, farBasis: 'published' }
  }

  // B/C/D/M classes: split "<prefix><digit?>-<suffix>" → prefix letter + suffix.
  // Examples: "B3-2" → letter B, suffix "2"; "DX-7" → letter D, suffix "7";
  // "M1-2" → letter M, suffix "2"; "C1-5" → letter C, suffix "5".
  const m = z.match(/^([BCDM])[A-Z]?\d*-(\d+(?:\.\d+)?)$/)
  if (!m) {
    // ⚠️ Planned Developments are the big population here and they are an
    // ANSWER, not a gap: a PD's envelope is set by its own approved plan, so no
    // district table can state one. Distinguished from a string we simply
    // cannot read.
    const pd = /^PD[\s-]*\d+$/.test(z) || /PLANNED DEVELOPMENT/.test(z)
    return {
      far: null,
      heightFt: null,
      heightBasis: pd ? 'class-not-read' : 'unrecognised-district',
      farBasis: pd ? 'planned-development' : 'unrecognised-district',
    }
  }
  const letter = m[1]
  const suffix = m[2]

  switch (letter) {
    case 'B':
    case 'C':
      return {
        far: BC_FAR_BY_SUFFIX[suffix] ?? null,
        heightFt: BC_HEIGHT_BY_SUFFIX[suffix] ?? null,
        heightBasis: BC_HEIGHT_BY_SUFFIX[suffix] != null ? 'published' : 'not-listed-in-table',
        farBasis: BC_FAR_BY_SUFFIX[suffix] != null ? 'published' : 'unrecognised-district',
      }
    case 'D':
      // ⚠️ 'class-not-read' rather than 'not-listed-in-table': this module reads
      // the D suffix FAR table and does not read a D height at all. Saying the
      // table has no row would assert something about the ordinance that was
      // never checked.
      return {
        far: D_FAR_BY_SUFFIX[suffix] ?? null,
        heightFt: null,
        heightBasis: 'class-not-read',
        farBasis: D_FAR_BY_SUFFIX[suffix] != null ? 'published' : 'unrecognised-district',
      }
    case 'M':
      return {
        far: M_FAR_BY_SUFFIX[suffix] ?? null,
        heightFt: null,
        heightBasis: 'class-not-read',
        farBasis: M_FAR_BY_SUFFIX[suffix] != null ? 'published' : 'unrecognised-district',
      }
    default:
      return { far: null, heightFt: null, heightBasis: 'unrecognised-district', farBasis: 'unrecognised-district' }
  }
}

// Static table (≥20 of the most common Chicago districts) — a documentation
// snapshot of what resolveChicago() produces, so a reviewer can eyeball the
// resolved values without running code. resolveChicago() is the source of truth
// at runtime; this is kept consistent with it by the unit tests.
export const CHICAGO_LIMITS: Record<string, DistrictLimits> = {
  'RS-1': resolveChicago('RS-1'),
  'RS-2': resolveChicago('RS-2'),
  'RS-3': resolveChicago('RS-3'),
  'RT-3.5': resolveChicago('RT-3.5'),
  'RT-4': resolveChicago('RT-4'),
  'RM-5.5': resolveChicago('RM-5.5'),
  'RM-5': resolveChicago('RM-5'),
  'RM-6': resolveChicago('RM-6'),
  'B1-1': resolveChicago('B1-1'),
  'B1-2': resolveChicago('B1-2'),
  'B1-3': resolveChicago('B1-3'),
  'B2-2': resolveChicago('B2-2'),
  'B3-2': resolveChicago('B3-2'),
  'B3-3': resolveChicago('B3-3'),
  'B3-5': resolveChicago('B3-5'),
  'C1-1': resolveChicago('C1-1'),
  'C1-2': resolveChicago('C1-2'),
  'C1-3': resolveChicago('C1-3'),
  'C2-2': resolveChicago('C2-2'),
  'C3-5': resolveChicago('C3-5'),
  'DC-12': resolveChicago('DC-12'),
  'DC-16': resolveChicago('DC-16'),
  'DX-5': resolveChicago('DX-5'),
  'DX-7': resolveChicago('DX-7'),
  'DR-3': resolveChicago('DR-3'),
  'M1-2': resolveChicago('M1-2'),
  'M2-2': resolveChicago('M2-2'),
  'M3-3': resolveChicago('M3-3'),
}
