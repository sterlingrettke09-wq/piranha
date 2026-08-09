// Milwaukee curated district table — Milwaukee Code of Ordinances, CHAPTER 295
// (ZONING).
//
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE, AND HOW IT WAS REACHED. Every figure below was transcribed on
// 2026-08-08 from the OFFICIAL consolidated subchapter PDFs published by the
// Milwaukee City Clerk / Legislative Reference Bureau, reached from the City
// Clerk's own "City Charter and Ordinances" table of contents at
//   https://city.milwaukee.gov/cityclerk/ordinances/tableofcontents
// and NOT from a guessed chapter path (CLAUDE.md rule 8 — a first guess at
// `/CityClerk/ORD` in fact redirected to the site's Page Not Found, which
// proved the guess wrong and nothing else). The per-subchapter documents read:
//
//   Table of contents  .../Volume-2/CH295table.pdf   rev. 11/4/2025
//   sub. 5  Residential .../Volume-2/CH295-sub5.pdf   rev. 4/22/2025 & 7/15/2025
//   sub. 6  Commercial  .../Volume-2/CH295-sub6.pdf   rev. 6/11/2024 & 7/15/2025
//   sub. 7  Downtown    .../Volume-2/CH295-sub7.pdf   rev. 4/18/2023, 6/11/2024,
//                                                          10/15/2024, 7/15/2025
//   sub. 8  Industrial  .../Volume-2/CH295-sub8.pdf   rev. 5/10/2022, 6/11/2024,
//                                                          7/15/2025
//   sub. 9  Special     .../Volume-2/CH295-sub9.pdf   rev. 12/14/2021, 6/11/2024,
//                                                          10/15/2024
//   sub. 10 Overlays    .../Volume-2/CH295-sub10.pdf  rev. 6/18/2019 & 11/4/2025
//
// (base = https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances)
//
// ⚠️ REPRODUCIBILITY WARNING FOR THE NEXT READER, so nobody concludes the source
// has moved or gone: `city.milwaukee.gov` sits behind a Cloudflare interstitial
// that answers curl / plain fetch with HTTP 403 and `cf-mitigated: challenge`.
// A **403 here is a bot check, not a missing document.** These PDFs were read
// through a real browser session against the live host; every figure below came
// out of the ordinance text itself, not out of a mirror, a summary or Municode.
//
// CURRENCY. Milwaukee has NOT recodified. "Growing MKE" (the DCD zoning
// overhaul) was not adopted; only its Housing Element passed. The district
// vocabulary in these subchapters matches the live GIS zoning layer value for
// value — 52 distinct `Zoning` values measured on the layer 2026-08-08 against
// the code's own district lists, with exactly one difference, and it runs the
// safe way: the code's residential table now carries an **RT5** column
// (added 2025-04-22) and no parcel is mapped RT5 yet. RT5 is curated anyway so
// the first rezoning does not fall through to a gap; a test pins it.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — CH. 295 IMPOSES NO FLOOR-AREA RATIO ON ITS RESIDENTIAL, COMMERCIAL,
// INDUSTRIAL OR INSTITUTIONAL DISTRICTS. This is an ANSWER (CLAUDE.md rule 5),
// and it survives the slot test on the document's own structure:
//
//   · Table 295-505-2 (residential), Table 295-605-2 (commercial) and
//     Table 295-805-2 (industrial) are each built from the same row groups —
//     Lot / Density / Height / setbacks / glazing / build-out. **There is no
//     floor-area row in any of them.** Bulk is governed by lot area per dwelling
//     unit, lot coverage, setbacks and height instead.
//   · Searched the extracted text of subchapters 5–10: the string "floor area
//     ratio" occurs **twice in the whole set**, BOTH in subchapter 5, and
//     neither is a bulk cap:
//       – Table 295-505-2, RM7 "Height, maximum (ft.)" cell:
//         "85; no limit if floor area ratio is less than 4:1"
//       – s. 295-505-2-h-2-h, in the list of exceptions to the height
//         limitations: "Buildings in the RM7 district which have a floor area
//         ratio of less than 4:1."
//     Both are a HEIGHT exception conditioned on FAR, not a FAR ceiling.
//     Subchapters 6, 7, 8, 9 and 10 return **zero** hits.
//
// So `farUnconstrained: true` on those districts. It must never fall through to
// an assumed FAR of 1.0.
//
// FACT 1b — THE DOWNTOWN DISTRICTS ARE THE EXCEPTION, AND THEY ARE A GAP, NOT AN
// ABSENCE. Table 295-705-1 has a floor-area slot and it is FILLED: three
// "Permitted floor area" rows per district, each a formula over four variables
// defined in s. 295-705-4 (W = development-site size; X = surface open space;
// Y = qualifying rooftop open space; Z = interior atrium/mall size, measured in
// CUBIC FEET). The three rows are not a range — they are selected by how much
// surface open space the applicant's own site design provides (≤40%, >40% and
// <80%, ≥80%). So a C9 parcel has no single floor-area number until somebody
// designs the building.
//
// This module therefore reports C9 districts with `farUnconstrained: false` and
// no FAR: a GAP, disclosed, with the formulas carried verbatim in
// `floorAreaFormulas` so a reader can evaluate them. It deliberately does NOT
// publish the W coefficient as "the base FAR". That reading is tempting and
// wrong in two ways: the W coefficient differs across the three tiers for the
// same district (C9A subdistrict A is 2(W), 5(W) and 25(W)−25(X)), so there is
// no single W to take; and picking one tier assumes an open-space program the
// user has not chosen (CLAUDE.md rule 6). Unpriced and disclosed is the honest
// output (rule 4).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — MILWAUKEE REGULATES HEIGHT IN FEET, NEVER IN STORIES. Every height
// cell in Tables 295-505-2, 295-605-2, 295-705-1 and 295-805-2 is in feet or
// the word "none". There is consequently NO feet-per-story constant in this
// module and none may be added — the Miami-21 round trip (80 storeys × 12 ft
// then ÷ 11 ft → 87 storeys published, CLAUDE.md rule 12) is not reproducible
// here because there is no story figure to convert.
//
// ⚠️ THERE IS A STORY COUNT IN THE RESIDENTIAL TABLE AND IT IS NOT A HEIGHT
// LIMIT. Table 295-505-2 carries a row headed "Max. no. of stories without side
// or rear setback adjustment" (RS1 2, RS4 3, RT4 4, RM5 6, RM6 8, RO2 8 …).
// That is the threshold at which the SETBACK standards change, not a cap on
// building height — a building may exceed it by adjusting its setbacks. It is
// deliberately absent from this module and pinned absent by a test, because it
// is exactly the shape of number that gets read as `maxStories` by the next
// person to open the table.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — COMMERCIAL AND INDUSTRIAL HEIGHT IS STATED PER BUILDING TYPE, SO THE
// HEADLINE MUST NOT BE THE MAXIMUM ACROSS TYPES (CLAUDE.md rule 6). This is the
// single biggest correction to the scouting notes that fed this module, which
// reported one number per district.
//
// Table 295-605-2 has TWO panels. "Design Standards for Non-residential and
// Multi-family Principal Buildings" gives NS1 45 / NS2 60 / LB1 45 / LB2 60 /
// LB3 75 / RB1 85 / RB2 85 / CS 60. "Design Standards for Single family and
// Two-family Dwellings" then says, per district, "Refer to design standards in
// subch. 5 for this residential district: RM1 | RM4 | RM2 | RM5 | RM5 | RM2 |
// RM5 | RM4" — which resolves to 45 / 60 / 45 / 60 / 60 / 45 / 60 / 60. Three
// districts differ between the panels, and they differ by a lot: **a single- or
// two-family dwelling in RB1 is capped at 45 ft against the district's headline
// 85 ft.**
//
// Table 295-805-2 has THREE panels — industrial buildings (as defined in
// s. 295-201-302), non-industrial buildings other than 1–2 family, and 1–2
// family dwellings — and only the first is the "none" the scout reported. See
// MILWAUKEE_INDUSTRIAL below for the grid.
//
// Following the Raleigh precedent, the published headline is the LOWEST figure
// the code states for any building type in the district, and every other figure
// rides in `heightByUse` labelled with the building type and its section. A
// "none" entry never becomes the headline.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — "NONE" IN A HEIGHT CELL IS A STATED ABSENCE, AND IT IS NOT THE SAME
// AS A FAILED LOOKUP. Table 295-705-1 prints "none" for the maximum building
// height of 11 of the 13 downtown subdistricts (only C9A subdistrict B at 40 ft
// and C9F subdistrict C at 50 ft bind), and Table 295-805-2 prints "none" for
// industrial buildings in IO1, IO2, IL1, IL2 and IH. Those are answers.
//
// `ParcelInfo['zoning']` has `farUnconstrained` for the FAR case but no height
// equivalent, and this module may not widen that shared type. So the flag lives
// here as `heightUnconstrained` and the provider surfaces it as text; adding the
// shared field is owed at the wiring stage. Until it exists, a "none" district
// renders as `maxHeightFt: null`, which is a gap render of an answer — the
// conflation rule 5 exists to prevent, in the direction that understates what
// we know rather than overstating what the code allows.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — WHAT CAN CUT BELOW THESE FIGURES, checked rather than inferred from
// a layer name. Each is disclosed by the provider and NONE is computed here:
//
//   · Overlay zones (s. 295-1001): "Overlay zones may add new standards over and
//     above those of any base or underlying zoning district except a planned
//     development district. They may also ALTER the standards of any base zoning
//     district except a planned development district."
//   · Development Incentive Zone (s. 295-1007-3-a): the commissioner's
//     performance standards "may include … building height, bulk, placement …
//     These standards shall supercede the standards of the underlying district."
//     26 DIZ polygons mapped.
//   · Site Plan Review Overlay (s. 295-1009-3-a): identical language, including
//     "building height", and the same supersession clause. 40 SPROZ polygons.
//   · s. 295-805-4-e-1: the maximum height of an INDUSTRIAL building adjacent to
//     or across a street or alley from a residential, institutional, parks or
//     non-industrial planned development district is "the average height of
//     residential buildings on the adjacent blockface", +1 ft per 2 ft of extra
//     setback. Site-specific; not resolvable from the parcel alone.
//   · s. 295-905-3-b-2 states the same adjacency rule for institutional (TL)
//     buildings.
//   · IM's non-industrial panel points at LB3 (75 ft) but drops to LB2 (60 ft)
//     "for new construction on a parcel that is located within 100 feet of a
//     residentially-zoned parcel". The 60 ft figure is the one carried here,
//     because it is the lower of the two and the 100-ft test is not evaluated.

/** One height figure the code states, for one building type. Feet only —
 *  Milwaukee never states a story cap (FACT 2). */
export interface MilwaukeeHeightRule {
  /** Building type / use as Ch. 295 names it. */
  useLabel: string
  /** Maximum height in FEET exactly as the code prints it, or null when the
   *  code prints "none" (in which case `heightUnconstrained` is set). */
  heightFt: number | null
  /** The code affirmatively states NO maximum height for this building type —
   *  a KNOWN absence, not a lookup we failed (FACT 4). */
  heightUnconstrained?: boolean
  /** A condition the code attaches to the figure, carried so the number is
   *  never read as unconditional. */
  qualifier?: string
  /** Section and table the figure was transcribed from. Mandatory. */
  source: string
}

/** What Ch. 295 states for a district. */
export interface MilwaukeeLimits {
  /** HEADLINE maximum height in feet: the LOWEST figure the code states for any
   *  building type in this district (FACT 3). Null when no building type has a
   *  stated figure — either because every one reads "none" (then
   *  `heightUnconstrained` is true) or because nothing resolved (a gap). */
  heightFt: number | null
  /** True only when EVERY building type in the district reads "none". */
  heightUnconstrained: boolean
  /** Every stated figure, keyed by building type. Never collapsed to one
   *  number, and never reduced to its maximum (CLAUDE.md rule 6). */
  heightByUse: MilwaukeeHeightRule[]
  /** Ch. 295 imposes no floor-area ratio here — a KNOWN absence (FACT 1).
   *  False for the downtown districts (whose floor area IS regulated, by a
   *  formula we decline to collapse — FACT 1b) and false for anything
   *  unresolved, where nothing at all is asserted. */
  farUnconstrained: boolean
  /** Downtown only: the three "Permitted floor area" alternatives of
   *  Table 295-705-1, verbatim. Alternatives selected by the applicant's own
   *  site design — never a range, never to be maximised over. */
  floorAreaFormulas?: MilwaukeeFloorAreaTier[]
  /** No by-right dimensional standards in the base code: an adopted plan
   *  governs (PD/DPD s. 295-907, RED s. 295-909). An ANSWER about the base
   *  code, distinct from a failed lookup. */
  planGoverned?: boolean
  /** The GIS itself flags this parcel's zoning as defective (`Zoning = 'X'`).
   *  Must render as a gap and never as a substantive answer. */
  dataDefect?: boolean
  /** Section(s) the figures were transcribed from. Empty only when unresolved. */
  source: string
}

/** One of Table 295-705-1's three permitted-floor-area alternatives. */
export interface MilwaukeeFloorAreaTier {
  /** Which surface-open-space condition selects this row. */
  openSpaceCondition: 'atMost40Percent' | 'between40And80Percent' | 'atLeast80Percent'
  /** The formula exactly as Table 295-705-1 prints it. Deliberately a STRING:
   *  evaluating it needs X, Y and Z, which are properties of a building nobody
   *  has designed yet. */
  formula: string
  source: string
}

// ── Constructors ────────────────────────────────────────────────────────────
// CLAUDE.md rule 14: make the caught error an impossible state, not a comment.
// Every height figure below is built by one of these two, each of which takes
// ONLY what the code prints plus a mandatory citation. There is deliberately no
// constructor that accepts a story count, and no feet-per-story constant
// anywhere in this file — reintroducing the Miami/Denver derivation would
// require writing a new constructor, which is a visible, reviewable act.

/** The code prints a height in FEET for this building type. */
function ft(useLabel: string, heightFt: number, source: string, qualifier?: string): MilwaukeeHeightRule {
  return qualifier ? { useLabel, heightFt, source, qualifier } : { useLabel, heightFt, source }
}

/** The code prints "none" for this building type — a stated absence. */
function noHeightLimit(useLabel: string, source: string, qualifier?: string): MilwaukeeHeightRule {
  return qualifier
    ? { useLabel, heightFt: null, heightUnconstrained: true, source, qualifier }
    : { useLabel, heightFt: null, heightUnconstrained: true, source }
}

/** Assemble a district from its per-building-type rules. The headline is the
 *  LOWEST stated figure; a "none" rule can never become the headline. */
function district(
  rules: MilwaukeeHeightRule[],
  opts: { farUnconstrained: boolean; source: string; floorAreaFormulas?: MilwaukeeFloorAreaTier[] },
): MilwaukeeLimits {
  const stated = rules.map((r) => r.heightFt).filter((h): h is number => h != null)
  return {
    heightFt: stated.length > 0 ? Math.min(...stated) : null,
    heightUnconstrained: rules.length > 0 && rules.every((r) => r.heightUnconstrained === true),
    heightByUse: rules,
    farUnconstrained: opts.farUnconstrained,
    ...(opts.floorAreaFormulas ? { floorAreaFormulas: opts.floorAreaFormulas } : {}),
    source: opts.source,
  }
}

/** No by-right dimensional standards: an adopted plan governs. Asserts no
 *  height and — unlike Raleigh's PD — no FAR absence either, because a
 *  Milwaukee planned-development plan must state "total square footage devoted
 *  to non-residential uses" (s. 295-907-2-b-1-e), i.e. the plan itself can
 *  carry a floor-area cap this module has not read. */
function planGoverned(source: string): MilwaukeeLimits {
  return {
    heightFt: null,
    heightUnconstrained: false,
    heightByUse: [],
    farUnconstrained: false,
    planGoverned: true,
    source,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RESIDENTIAL — Table 295-505-2, PRINCIPAL BUILDING DESIGN STANDARDS
// "Height, maximum (ft.)" row. One panel, so one figure covers every building
// type in the district. Table pages carry rev. 7/15/2025.
// ═════════════════════════════════════════════════════════════════════════════

const T505 = 'Milwaukee Code s. 295-505-2, Table 295-505-2 "Height, maximum (ft.)"'

function residential(heightFt: number, extra: MilwaukeeHeightRule[] = []): MilwaukeeLimits {
  return district([ft('All principal buildings', heightFt, T505), ...extra], {
    farUnconstrained: true,
    source: T505,
  })
}

export const MILWAUKEE_RESIDENTIAL: Record<string, MilwaukeeLimits> = {
  // Single-family districts. Eleven columns, eleven values — checked they line
  // up: RS1 45 | RS2 45 | RS3 45 | RS4 45 | RS5 45 | RS6 45 | RT1 45 | RT2 45 |
  // RT3 45 | RT4 48 | RT5 48.
  RS1: residential(45),
  RS2: residential(45),
  RS3: residential(45),
  RS4: residential(45),
  RS5: residential(45),
  RS6: residential(45),
  // Two-family districts.
  RT1: residential(45),
  RT2: residential(45),
  RT3: residential(45),
  RT4: residential(48),
  // RT5 is real code with ZERO mapped parcels today — created 2025-04-22 and
  // applied only by rezoning. Curated so the first rezoning does not discover
  // that it is missing; pinned by a test.
  RT5: residential(48),
  // Multi-family districts and Residence & Office. The code's own table
  // typesets the last two column heads as "R01"/"R02" (digit zero) under the
  // group heading "Residence & Office"; the GIS publishes "RO1"/"RO2" (letter
  // O). Same districts — noted so the discrepancy is not mistaken for drift.
  RM1: residential(45),
  RM2: residential(45),
  RM3: residential(45),
  RM4: residential(60),
  RM5: residential(60),
  RM6: residential(85),
  // The RM7 cell reads, in full: "85; no limit if floor area ratio is less than
  // 4:1", and s. 295-505-2-h-2-h repeats it in the list of exceptions to the
  // height limitations. 85 ft is the headline; the unlimited-height option is an
  // ALTERNATIVE PROGRAM the applicant elects by holding floor area below FAR 4,
  // never a ceiling (CLAUDE.md rule 6). Note this does NOT make RM7 a
  // FAR-regulated district: the 4:1 test is a condition on exceeding 85 ft, and
  // there is still no floor-area row in Table 295-505-2.
  RM7: district(
    [
      ft('All principal buildings', 85, T505),
      noHeightLimit(
        'Building with a floor area ratio of less than 4:1',
        'Milwaukee Code s. 295-505-2-h-2-h and Table 295-505-2 (RM7 height cell: "85; no limit if floor area ratio is less than 4:1")',
        'Elective: available only to a building that holds its floor area below 4:1',
      ),
    ],
    { farUnconstrained: true, source: T505 },
  ),
  RO1: residential(45),
  RO2: residential(85),
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMERCIAL — Table 295-605-2, PRINCIPAL BUILDING DESIGN STANDARDS
// TWO panels (FACT 3). Table pages carry rev. 7/15/2025 and 6/11/2024.
// ═════════════════════════════════════════════════════════════════════════════

const T605 = 'Milwaukee Code s. 295-605-2, Table 295-605-2 "Height, maximum (ft.)" (non-residential and multi-family panel)'
const T605_SF = 'Milwaukee Code s. 295-605-2, Table 295-605-2 "Design Standards for Single family and Two-family Dwellings" → subch. 5 district'

/** @param mainFt  the non-residential / multi-family figure
 *  @param sfDistrict  the subch.-5 district the 1–2 family panel points at
 *  @param sfFt  that district's Table 295-505-2 height */
function commercial(mainFt: number, sfDistrict: string, sfFt: number): MilwaukeeLimits {
  return district(
    [
      ft('Non-residential or multi-family principal building', mainFt, T605),
      ft('Single-family or two-family dwelling', sfFt, `${T605_SF} ${sfDistrict}, ${T505}`),
    ],
    { farUnconstrained: true, source: T605 },
  )
}

export const MILWAUKEE_COMMERCIAL: Record<string, MilwaukeeLimits> = {
  NS1: commercial(45, 'RM1', 45),
  NS2: commercial(60, 'RM4', 60),
  LB1: commercial(45, 'RM2', 45),
  LB2: commercial(60, 'RM5', 60),
  // The three districts where the panels disagree. Publishing 75 / 85 / 85 as
  // the district ceiling would assume a non-residential or multi-family program
  // the user has not chosen — the Austin 0.40-or-0.65 mistake.
  LB3: commercial(75, 'RM5', 60),
  RB1: commercial(85, 'RM2', 45),
  RB2: commercial(85, 'RM5', 60),
  CS: commercial(60, 'RM4', 60),
}

// ═════════════════════════════════════════════════════════════════════════════
// INDUSTRIAL — Table 295-805-2, PRINCIPAL BUILDING DESIGN STANDARDS
// THREE panels. Table pages carry rev. 7/15/2025.
//
//   district | industrial building | non-industrial, not 1–2 family | 1–2 family
//   IO1      | none                | LB1 → 45 ft                    | RT2 → 45
//   IO2      | none                | LB2 → 60 ft                    | RT3 → 45
//   IL1      | none                | LB1 → 45 ft                    | RT2 → 45
//   IL2      | none                | LB2 → 60 ft                    | RT3 → 45
//   IC       | 85 (new constr.)    | LB2 → 60 ft                    | RT4 → 48
//   IM       | 85 (new constr.)    | LB3 → 75 / LB2 → 60 *          | RT4 → 48
//   IH       | none                | LB2 → 60 ft                    | RT4 → 48
//
//   * "For new construction on a parcel that is located within 100 feet of a
//     residentially-zoned parcel, the design standards for the LB2 zoning
//     district shall apply." The lower figure (60) is carried, because the
//     100-ft test is not evaluated here.
//
// The code's own table typesets the first two column heads as "I01"/"I02"
// (digit zero); the GIS publishes "IO1"/"IO2" (letter O).
// ═════════════════════════════════════════════════════════════════════════════

const T805 = 'Milwaukee Code s. 295-805-2, Table 295-805-2 "Height, maximum" (industrial-building panel)'
const T805_NI = 'Milwaukee Code s. 295-805-2, Table 295-805-2 "Design Standards for Non-industrial Buildings except Single-family and Two-family Dwellings" → subch. 6 district'
const T805_SF = 'Milwaukee Code s. 295-805-2, Table 295-805-2 "Design Standards for Single-family and Two-family Dwellings" → subch. 5 district'

const INDUSTRIAL_ADJACENCY_QUALIFIER =
  'May be cut below this figure by s. 295-805-4-e-1 where the site adjoins, or is across a street or alley from, a residential, institutional, parks or non-industrial planned development district'

function industrial(
  industrialRule: MilwaukeeHeightRule,
  nonIndustrial: { district: string; heightFt: number; qualifier?: string },
  singleFamily: { district: string; heightFt: number },
): MilwaukeeLimits {
  return district(
    [
      industrialRule,
      ft(
        'Non-industrial building other than a single- or two-family dwelling',
        nonIndustrial.heightFt,
        `${T805_NI} ${nonIndustrial.district}, ${T605}`,
        nonIndustrial.qualifier,
      ),
      ft(
        'Single-family or two-family dwelling',
        singleFamily.heightFt,
        `${T805_SF} ${singleFamily.district}, ${T505}`,
      ),
    ],
    { farUnconstrained: true, source: T805 },
  )
}

const INDUSTRIAL_NONE = (): MilwaukeeHeightRule =>
  noHeightLimit(
    'Industrial building (as defined in s. 295-201-302)',
    T805,
    INDUSTRIAL_ADJACENCY_QUALIFIER,
  )

const INDUSTRIAL_85 = (): MilwaukeeHeightRule =>
  ft(
    'Industrial building (as defined in s. 295-201-302)',
    85,
    T805,
    `New construction only. ${INDUSTRIAL_ADJACENCY_QUALIFIER}`,
  )

export const MILWAUKEE_INDUSTRIAL: Record<string, MilwaukeeLimits> = {
  IO1: industrial(INDUSTRIAL_NONE(), { district: 'LB1', heightFt: 45 }, { district: 'RT2', heightFt: 45 }),
  IO2: industrial(INDUSTRIAL_NONE(), { district: 'LB2', heightFt: 60 }, { district: 'RT3', heightFt: 45 }),
  IL1: industrial(INDUSTRIAL_NONE(), { district: 'LB1', heightFt: 45 }, { district: 'RT2', heightFt: 45 }),
  IL2: industrial(INDUSTRIAL_NONE(), { district: 'LB2', heightFt: 60 }, { district: 'RT3', heightFt: 45 }),
  IC: industrial(INDUSTRIAL_85(), { district: 'LB2', heightFt: 60 }, { district: 'RT4', heightFt: 48 }),
  IM: industrial(
    INDUSTRIAL_85(),
    {
      district: 'LB2',
      heightFt: 60,
      qualifier:
        'The panel points at LB3 (75 ft); LB2 (60 ft) applies to new construction on a parcel within 100 feet of a residentially-zoned parcel, and 60 ft is what is published here because that test is not evaluated',
    },
    { district: 'RT4', heightFt: 48 },
  ),
  IH: industrial(INDUSTRIAL_NONE(), { district: 'LB2', heightFt: 60 }, { district: 'RT4', heightFt: 48 }),
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNTOWN — Table 295-705-1, DOWNTOWN DISTRICTS DESIGN STANDARDS
// "Building height, maximum" row, plus the three "Permitted floor area" rows.
// Table pages carry rev. 4/18/2023.
//
// The GIS publishes the subdistrict inside the code string — `C9A(A)`, `C9F(C)`
// — matching the table's own "C9A subdistrict A" / "C9F subdist. C" columns.
// ═════════════════════════════════════════════════════════════════════════════

const T705 = 'Milwaukee Code s. 295-705-1, Table 295-705-1 "Building height, maximum"'
const T705_FA = 'Milwaukee Code s. 295-705-1, Table 295-705-1 "Permitted floor area" (variables defined in s. 295-705-4)'

function floorAreaTiers(atMost40: string, between: string, atLeast80: string): MilwaukeeFloorAreaTier[] {
  return [
    { openSpaceCondition: 'atMost40Percent', formula: atMost40, source: T705_FA },
    { openSpaceCondition: 'between40And80Percent', formula: between, source: T705_FA },
    { openSpaceCondition: 'atLeast80Percent', formula: atLeast80, source: T705_FA },
  ]
}

function downtown(
  height: MilwaukeeHeightRule,
  tiers: MilwaukeeFloorAreaTier[],
): MilwaukeeLimits {
  return district([height], {
    // NOT an absence: Table 295-705-1 has a floor-area slot and it is filled
    // (FACT 1b). This is a GAP, and must render as one.
    farUnconstrained: false,
    source: T705,
    floorAreaFormulas: tiers,
  })
}

const DT_ALL = 'All principal buildings'

export const MILWAUKEE_DOWNTOWN: Record<string, MilwaukeeLimits> = {
  'C9A(A)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('2(W)+7.5(X)+4(Y)', '5(W)', '25(W)-25(X)'),
  ),
  // One of only two downtown subdistricts with a stated cap.
  'C9A(B)': downtown(
    ft(DT_ALL, 40, T705),
    floorAreaTiers('2(W)+7.5(X)+4(Y)', '5(W)', '25(W)-25(X)'),
  ),
  'C9B(A)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('6(W)+5(X)+2.5(Y)', '7(W)', '11.5(W)-11.5(X)'),
  ),
  'C9B(B)': downtown(
    noHeightLimit(DT_ALL, T705),
    // The ≥80% cell is printed "12(W+12(X)+0.3(Z)" in the ordinance — an
    // unbalanced parenthesis in the source. Transcribed as printed rather than
    // silently "corrected"; a reader must go to the table, not trust a guess.
    floorAreaTiers('7(W)+10(X)+5(Y)', '8(W)+5(X)+2.5(Y)+0.3(Z)', '12(W+12(X)+0.3(Z)'),
  ),
  C9C: downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('3(W)+7.5(X)+4(Y)', '6(W)', '30(W)-30(X)'),
  ),
  'C9D(A)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('2(W)+20(X)+10(Y)+0.05(Z)', '4(W)+10(X)+5(Y)+0.05(Z)', '8(W)+0.05(Z)'),
  ),
  'C9D(B)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('2(W)+20(X)+10(Y)+0.05(Z)', '4(W)+10(X)+5(Y)+0.05(Z)', '8(W)+0.05(Z)'),
  ),
  C9E: downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('7(W)+13(X)+6.5(Y)+0.2(Z)', '8.1(W)+2(X)+1(Y)+0.2(Z)', '8.5(W)+0.2(Z)'),
  ),
  'C9F(A)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('5.5(W)+15(X)+7.5(Y)+0.1(Z)', '7.5(W)+5(X)+2.5(Y)+0.1(Z)', '9.5(W)+0.1(Z)'),
  ),
  'C9F(B)': downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('8(W)+20(X)+10(Y)+0.2(Z)', '9(W)+10(X)+5(Y)+0.2(Z)', '12(W)+0.2(Z)'),
  ),
  // The other stated cap.
  'C9F(C)': downtown(
    ft(DT_ALL, 50, T705),
    floorAreaTiers('8(W)+20(X)+10(Y)+0.2(Z)', '9(W)+10(X)+5(Y)+0.2(Z)', '12(W)+0.2(Z)'),
  ),
  C9G: downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('5(W)+5(X)+2.5(Y)', '7(W)', '14(W)-14(X)'),
  ),
  C9H: downtown(
    noHeightLimit(DT_ALL, T705),
    floorAreaTiers('5(W)+5(X)+2.5(Y)', '7(W)', '14(W)-14(X)'),
  ),
}

// ═════════════════════════════════════════════════════════════════════════════
// SPECIAL DISTRICTS — subchapter 9
// ═════════════════════════════════════════════════════════════════════════════

/** Unresolved. Asserts NOTHING: not a height, not a FAR absence, not a plan.
 *  A gap must never render as any of the answers above. */
const UNRESOLVED: MilwaukeeLimits = {
  heightFt: null,
  heightUnconstrained: false,
  heightByUse: [],
  farUnconstrained: false,
  source: '',
}

export const MILWAUKEE_SPECIAL: Record<string, MilwaukeeLimits> = {
  // TL — Institutional. Table 295-905-3-b is a per-USE referral table:
  //   Institutional (educational, community-serving, hospitals) → RM6
  //   Commercial or other non-institutional                     → LB2
  //   Residential                                               → RM6
  // which resolves to 85 / 60 / 85. Headline 60 (the lowest), the rest keyed.
  //
  // ⚠️ The scouting notes said TL "has no dimensional bulk table in subchapter
  // 9" and must render as a gap. That is wrong: the table exists, it is at
  // s. 295-905-3-b, and it resolves for all three use classes.
  TL: district(
    [
      ft(
        'Institutional building (educational, community-serving, hospital)',
        85,
        'Milwaukee Code s. 295-905-3-b, Table 295-905-3-b → RM6, Table 295-505-2',
      ),
      ft(
        'Residential building',
        85,
        'Milwaukee Code s. 295-905-3-b, Table 295-905-3-b → RM6, Table 295-505-2',
      ),
      ft(
        'Commercial or other non-institutional building',
        60,
        'Milwaukee Code s. 295-905-3-b, Table 295-905-3-b → LB2, Table 295-605-2',
      ),
    ],
    {
      // Both referral targets (RM6 and LB2) sit in tables with no floor-area
      // row, so FACT 1's absence carries through.
      farUnconstrained: true,
      source: 'Milwaukee Code s. 295-905-3-b, Table 295-905-3-b',
    },
  ),

  // PK — Parks. UNRESOLVED, deliberately, and this is a rule-5 judgement worth
  // stating: s. 295-903-3 gives the Parks district PRINCIPAL BUILDING STANDARDS
  // consisting of setbacks only ("All principal buildings shall have setbacks of
  // at least 25 feet from all property lines, except along the front lot line…")
  // plus accessory-building and site standards. There is no dimensional table
  // and no height paragraph.
  //
  // That is NOT the slot test the DC / Philadelphia cases turned on. Those
  // worked because a TABLE existed whose row structure had no FAR row — the
  // document's own structure was positive evidence. Here there is no table at
  // all, so there is nothing whose emptiness is evidence, and "the code sets no
  // height in a park" would be a conclusion drawn from a reader not finding
  // something. The only height figure anywhere in s. 295-903 is a use-specific
  // one (s. 295-903-2-b-8-b, transmission tower ≤ 60 ft), which is not a
  // district standard. So: a gap, honestly rendered.
  PK: UNRESOLVED,

  // PD / DPD — Planned Development. s. 295-907-3 "STANDARDS" enumerates Uses,
  // Design Standards, Density, Space Between Structures, Setbacks, Screening,
  // Open Spaces, Circulation/Parking/Loading, Landscaping, Lighting, Utilities
  // and Signs — and contains NO height standard. s. 295-907-3-b: "Conceptual
  // design elements and standards shall be provided in the general plan.
  // Specific design elements and standards shall be specified in the detailed
  // plan." s. 295-1001 additionally bars every overlay zone from adding to or
  // altering a planned development district.
  PD: planGoverned(
    'Milwaukee Code s. 295-907-3-b (PD/DPD: the approved general and detailed plans set the design standards)',
  ),

  // RED — Redevelopment. s. 295-909-3: "The principal building design standards,
  // accessory building design standards and site design standards for property
  // in a redevelopment district shall be as indicated in the redevelopment plan
  // for that district." Where a plan is silent (the ordinance names the Park East
  // and Beerline districts), the defaults supplied are signage and parking-lot
  // landscaping only — no height, no floor area.
  RED: planGoverned(
    'Milwaukee Code s. 295-909-3 (RED: the adopted redevelopment plan sets the design standards)',
  ),

  // X — not a district. The zoning layer's own ZoningType for this value reads
  // "A problem has been identified with the zoning assigned to this parcel.
  // Check with the City of Milwaukee's Department of City Development for
  // details (planadmin@milwaukee.gov)." 12 polygons, measured 2026-08-08. It is
  // an explicit upstream data-defect flag and must never resolve to a figure.
  X: { ...UNRESOLVED, dataDefect: true },
}

/** Every district code Ch. 295 defines and the GIS publishes. Measured against
 *  the live layer 2026-08-08 with `returnDistinctValues` — the layer takes
 *  exactly these 52 values (51 districts plus the `X` defect flag) — and
 *  cross-read against the code's own district lists, which add RT5. */
export const MILWAUKEE_DISTRICT_CODES: readonly string[] = [
  ...Object.keys(MILWAUKEE_RESIDENTIAL),
  ...Object.keys(MILWAUKEE_COMMERCIAL),
  ...Object.keys(MILWAUKEE_INDUSTRIAL),
  ...Object.keys(MILWAUKEE_DOWNTOWN),
  ...Object.keys(MILWAUKEE_SPECIAL),
]

/**
 * Normalise a Milwaukee zoning code string as the GIS publishes it.
 * Uppercases, strips whitespace, and leaves the downtown subdistrict
 * parentheses in place because they are part of the district identity —
 * `C9F(B)` and `C9F(C)` have different height limits and different
 * permitted-floor-area formulas.
 */
export function normalizeMilwaukeeZone(code: string | null | undefined): string | null {
  if (!code) return null
  const z = code.replace(/\s+/g, '').toUpperCase()
  return z || null
}

/**
 * Resolve the limits Ch. 295 states for a Milwaukee zoning code.
 *
 * Returns `UNRESOLVED` — nulls, `farUnconstrained: false`, no citation — for
 * anything the chapter does not define, so a gap can never render as FACT 1's
 * known absence or as a stated height.
 *
 * NEVER derives feet from stories or stories from feet: there is no story
 * figure in this chapter to derive from (FACT 2).
 */
export function resolveMilwaukee(code: string | null | undefined): MilwaukeeLimits {
  const z = normalizeMilwaukeeZone(code)
  if (!z) return UNRESOLVED
  return (
    MILWAUKEE_RESIDENTIAL[z] ??
    MILWAUKEE_COMMERCIAL[z] ??
    MILWAUKEE_INDUSTRIAL[z] ??
    MILWAUKEE_DOWNTOWN[z] ??
    MILWAUKEE_SPECIAL[z] ??
    UNRESOLVED
  )
}

/**
 * Coarse use vocabulary for a Milwaukee district.
 *
 * Read 2026-08-08 off the chapter's own USE TABLES — Table 295-503-1
 * (residential), Table 295-603-1 (commercial), Table 295-703-1 (downtown) and
 * Table 295-803-1 (industrial) — not inferred from a district's name.
 *
 * WHAT THE LETTERS MEAN HERE, checked in this chapter rather than carried over
 * from another city's ordinance (disclosure copy is code, and "L" does not mean
 * the same thing everywhere). All four tables define them identically:
 *   "Y" — "a permitted use. This use is permitted as a matter of right subject
 *          to all performance standards."
 *   "L" — "a limited use. This use is permitted only when the use meets the
 *          standards of sub. 2. If the use cannot meet these standards, it shall
 *          be permitted only upon board approval of a special use permit."
 *   "S" — special use: permitted only if the board approves a permit.
 *   "N" — prohibited.
 * So BOTH Y and L are by-right paths — an L use needs no discretionary
 * approval as long as it meets the standards — and both are asserted here.
 * S and N are not.
 *
 * ⚠️ THE INDUSTRIAL DISTRICTS ARE MOSTLY NOT RESIDENTIAL, and this is the
 * mapping a name-based guess gets wrong in the direction that grants rights the
 * code withholds. Table 295-803-1's Multi-family dwelling row reads
 * N | N | N | L | N across IO1/IO2, IL1/IL2, IC, IM, IH — prohibited outright
 * in six of the seven districts. Only IM admits housing at all.
 *
 * Returns null rather than guessing where the code is unrecognised, or where
 * the district's answer cannot be expressed in this four-token vocabulary.
 */
export function usesForZone(code: string | null | undefined): string[] | null {
  const z = normalizeMilwaukeeZone(code)
  if (!z) return null

  // Table 295-503-1. Single-family dwelling Y in every column. Multi-family:
  // N in RS1-RS6, L in RT1-RT5, Y in RM1-RM7 / RO1 / RO2. General office is
  // N in RS1-RS5 and RM1-RM2, L in RS6 / RT3 / RT4-RT5 / RM3-RM7, and Y only
  // in RO1 and RO2 — so only the RO districts get 'commercial'.
  if (/^RS[1-6]$/.test(z) || /^RT[1-5]$/.test(z) || /^RM[1-7]$/.test(z)) return ['residential']
  if (/^RO[12]$/.test(z)) return ['residential', 'mixed', 'commercial']

  // Table 295-603-1. Single-family, two-family, multi-family and attached
  // single-family all Y in NS1, NS2, LB1, LB2, RB1, RB2 and CS, and L in LB3
  // (with permanent supportive housing Y in all eight). General office and
  // government office Y in all eight.
  if (/^(NS[12]|LB[123]|RB[12]|CS)$/.test(z)) return ['commercial', 'mixed', 'residential']

  // Table 295-803-1. See the warning above: N for every household-living row
  // except IM's, which is L.
  if (/^(IO[12]|IL[12]|IC|IH)$/.test(z)) return ['commercial', 'institutional']
  if (z === 'IM') return ['commercial', 'institutional', 'residential']

  // Table 295-703-1, whose columns are the bare C9A…C9H (uses do not vary by
  // subdistrict, unlike height and floor area). Single-, two- and multi-family
  // dwellings are Y in C9A, L in C9B through C9G, and N in C9H — C9H is the one
  // downtown district that prohibits housing outright.
  if (/^C9H$/.test(z)) return ['commercial', 'institutional']
  if (/^C9[A-G](\([A-C]\))?$/.test(z)) return ['commercial', 'mixed', 'residential']

  // TL — Institutional. s. 295-905 and Table 295-905-3-b recognise
  // institutional, commercial and residential buildings in the district, but
  // the use classifications are the institutional district's own and this
  // module has not read them; 'institutional' is the one token the referral
  // table itself names.
  if (z === 'TL') return ['institutional']

  // PK — Parks: not read. PD/RED: the adopted plan sets the uses
  // (s. 295-907-3-a, s. 295-909-2), so the base code says nothing.
  // X: an upstream data defect. All four: a gap render is correct.
  return null
}

/** Plain-language district names, as the live zoning layer's own
 *  `ZoningCategory` / `ZoningType` fields spell them. Measured against the
 *  layer 2026-08-08 with `returnDistinctValues` rather than transcribed by
 *  hand, so the label always matches what the map says. */
export const MILWAUKEE_DISTRICT_NAMES: Record<string, string> = {
  RS1: 'Single-family residential',
  RS2: 'Single-family residential',
  RS3: 'Single-family residential',
  RS4: 'Single-family residential',
  RS5: 'Single-family residential',
  RS6: 'Single-family residential',
  RT1: 'Two-family residential',
  RT2: 'Two-family residential',
  RT3: 'Two-family residential',
  RT4: 'Two-family residential',
  // RT5 has no mapped parcel, so the layer carries no label for it. Named from
  // the code's own subchapter-5 heading instead, and flagged as such.
  RT5: 'Two-family residential (Ch. 295 subch. 5; not yet mapped)',
  RM1: 'Multi-family residential',
  RM2: 'Multi-family residential',
  RM3: 'Multi-family residential',
  RM4: 'Multi-family residential',
  RM5: 'Multi-family residential',
  RM6: 'Multi-family residential',
  RM7: 'Multi-family residential',
  RO1: 'Residential and office',
  RO2: 'Residential and office',
  NS1: 'Neighborhood shopping',
  NS2: 'Neighborhood shopping',
  LB1: 'Local business',
  LB2: 'Local business',
  LB3: 'Local business',
  RB1: 'Regional business',
  RB2: 'Regional business',
  CS: 'Commercial service',
  IO1: 'Industrial - office',
  IO2: 'Industrial - office',
  IL1: 'Industrial - light',
  IL2: 'Industrial - light',
  IC: 'Industrial - commercial',
  IM: 'Industrial - mixed',
  IH: 'Industrial - heavy',
  'C9A(A)': 'Downtown - high-density residential',
  'C9A(B)': 'Downtown - high-density residential',
  'C9B(A)': 'Downtown - residential and specialty use',
  'C9B(B)': 'Downtown - residential and specialty use',
  C9C: 'Downtown - neighborhood retail',
  'C9D(A)': 'Downtown - civic activity',
  'C9D(B)': 'Downtown - civic activity',
  C9E: 'Downtown - major retail',
  'C9F(A)': 'Downtown - office and service',
  'C9F(B)': 'Downtown - office and service',
  'C9F(C)': 'Downtown - office and service',
  C9G: 'Downtown - mixed activity',
  C9H: 'Downtown - warehousing and light manufacturing',
  PD: 'Planned development',
  PK: 'Parks',
  TL: 'Institutional',
  RED: 'Redevelopment',
  X: 'Zoning not resolved by the City',
}
