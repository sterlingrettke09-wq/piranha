// Las Vegas curated district table — Las Vegas Municipal Code, TITLE 19,
// UNIFIED DEVELOPMENT CODE.
//
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE AND PROVENANCE. Read 2026-08-09.
//
// Reached from the City's OWN index rather than a guessed path (CLAUDE.md rule
// 8). The City Attorney's "Laws & Codes" page links Municode for the general
// Municipal Code, but its "Zoning Codes" child page
//   https://www.lasvegasnevada.gov/Business/Planning-Zoning/Zoning-Code
// links the zoning code separately and by name:
//   <a href="http://online.encodeplus.com/regs/lasvegas-nv/index.aspx">Unified
//   Development Code</a>
//   <a href="http://online.encodeplus.com/regs/lasvegas-nv/doc-viewer.aspx#secid-2554">
//   Chapter 19.09 Form-Based Code</a>
// So enCodePlus is the publisher the City itself points at for Title 19, and
// every figure below was read from that publisher's own chapter text:
//
//   index — the Title 19 table of contents as the viewer serves it:
//     https://online.encodeplus.com/regs/lasvegas-nv/doc-viewer.aspx
//   text  — one export per chapter from the same host, by the tocid the index
//     assigns. The whole title was pulled (tocid 001.001 … 001.015) so that the
//     absence claims below could be checked against ALL of it rather than
//     against the chapters that happened to be convenient:
//       001.001 19.00 · 001.002 19.02 · 001.003 19.04 · 001.004 19.06
//       001.005 19.08 · 001.008 19.09 · 001.009 19.10 · 001.010 19.12
//       001.011 19.14 · 001.012 19.16 · 001.013 19.17 · 001.014 19.18
//       001.015 Appendices
//     e.g. https://online.encodeplus.com/regs/lasvegas-nv/export2doc.aspx?tocid=001.004
//   section-level HTML, used where a chapter's tables are graphic-heavy and the
//   PDF's columns run together — the Form-Based Code transect standards were
//   read this way rather than from flattened PDF text, because column bleed is
//   exactly the DC MU-column off-by-one:
//     https://online.encodeplus.com/regs/lasvegas-nv/doc-view.aspx?pn=0&ajax=0&secid=2610
//
// CURRENCY, from the text itself rather than asserted: the latest amending
// ordinance cited anywhere in the chapters read is Ord. 6963 §4, effective
// 07/01/26 (LVMC 19.06.060 Table 9), with Ord. 6951 §8 of 05/06/26 in 19.10.020
// and Ord. 6923 §3 of 08/20/25 in 19.18. The publisher's own banner warns that
// it "can take up to 60 days to update this document following the adoption of
// legislation by the Las Vegas City Council", so an ordinance adopted in the
// last two months may not be reflected. That is stated, not corrected for.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — TITLE 19 IMPOSES NO FLOOR AREA RATIO IN ANY ZONING DISTRICT. This is
// an ANSWER, not a failed lookup (rule 5), and it is established by the SLOT
// TEST — whether the source has a place for the value — three ways over:
//
//   (a) §19.08.040(A) enumerates exactly which dimensional standards the
//       district tables govern, verbatim: "Except as otherwise noted, the
//       minimum lot size, minimum lot width, minimum building setbacks, maximum
//       lot coverage, minimum building separation and maximum building height
//       for uses in each district shall be governed by the dimensional standards
//       in the tables listed for each district." Floor area ratio is not in that
//       list.
//   (b) Every district's standards are lettered, self-contained tables —
//       Table 1 BUILDING PLACEMENT (A minimum lot size / minimum lot width,
//       B maximum lot coverage / dwelling units, C–F setbacks, G building
//       separation) and Table 3 BUILDING HEIGHT (A stories, B flat roof,
//       C pitched roof, D accessory). There is no FAR row in any of them, in
//       either 19.06 or 19.08.
//   (c) The phrase "floor area ratio" occurs in the WHOLE of Title 19 exactly
//       three times, all of them in 19.18 (Definitions & Measures) and none of
//       them operative: §19.18.020 defines it ("The gross floor area of all
//       buildings or structures on a lot divided by the total gross lot area"),
//       §19.18.030(A)(6) supplies a measurement rule for it, and §19.18.020's
//       "Intensity of Use" definition mentions it. The one place "intensity of
//       use" is then USED (19.10, an overlay's discretionary-approval sentence)
//       is not a district cap.
//
// The code therefore owns the instrument and declines to point it at anything.
// Floor area here is governed by MAXIMUM LOT COVERAGE, setbacks and height, so
// `maxLotCoverage` is recorded per district as the thing that actually binds.
// `farUnconstrained` is set on every district read from 19.06, 19.08 and 19.09,
// and is REFUSED — left false — for the plan-governed districts and for every
// unresolved code. See FACT 5.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — HEIGHT IS STATED IN BOTH STORIES AND FEET, AND NO FEET-PER-STORY
// CONSTANT REPRODUCES IT. Table 3 states a story count and a foot figure side by
// side, and the pairs are:
//
//     R-1 / R-2 / R-E / R-D / R-SL / R-CL / R-MH / U / P-O / O / C-D   2 st / 35 ft
//     R-TH                                                             3 st / 45 ft
//     R-3                                                              5 st / 55 ft
//     C-PB                                                             5 st / 85 ft
//
// which imply 17.50, 15.00, 11.00 and 17.00 feet per story — four different
// ratios in one code. As in Raleigh, the source document carries its own
// disproof that the constant exists, and a test pins it. Both numbers are
// carried exactly as printed and NOTHING is derived from either (rule 12: the
// Miami-21 round trip published 87 stories for a code that says 80).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — THE FORM-BASED CODE REGULATES IN STORIES AND STATES NO HEIGHT IN FEET
// AT ALL. §19.09.050.E's "F. Building Form" table for each transect zone has one
// height row, "Building Height — Stories", e.g. T6-UC "5 min. - 20 max." The only
// feet in that table are FLOOR-TO-FLOOR MINIMA (ground floor 13 ft min., upper
// floors 9 ft min.), which are minimum clear heights per floor, not a building
// height and not a conversion factor. Multiplying 20 stories by 13/9 ft would be
// precisely the invented conversion rule 4 forbids and the round trip rule 12
// forbids, so these zones carry `maxStories` with `maxHeightFt: null`, and the
// module holds no ft-per-story number anywhere.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — "NA" IN A HEIGHT TABLE IS NEITHER AN ANSWER NOR A GAP, AND IS NOT
// READ AS "NO LIMIT". R-4, C-1, C-2, C-M and M print "NA" in every row of
// Table 3 BUILDING HEIGHT (A Stories, B Flat Roof, C Pitched Roof). It is
// tempting to read that as "the code imposes no maximum height", and C-1/C-2/R-4
// footnote 2 — which caps only MIXED-USE development, and only outside a
// revitalization area — reads as if it presumed exactly that.
//
// But Title 19 nowhere says what "NA" means in these tables, it uses a DIFFERENT
// token ("Unlimited") for the same idea one table up in R-4 (Table 1 B, "Max. Lot
// Coverage: Unlimited"), and rule 1 gives an argued mechanism no direction at
// all. So `heightTableNA` records the fact and `heightUnconstrained` does not
// exist in this module. `maxStories` and `maxHeightFt` stay null, the provider
// says in words that the district's own height table prints "NA", and the
// engine is never told the district is unlimited.
//
// The two qualifications that DO bind those districts are recorded as
// disclosure and never as the headline:
//   · §19.06.120 Table 3 fn.2 / §19.08.070 Table 3 fn.2 / §19.08.080 Table 3
//     fn.2, verbatim: "Except for parcels located within the revitalization area
//     described in this Footnote 2, the maximum building height for mixed-use
//     development is ten stories, or one hundred fifty feet, whichever is less.
//     For purposes of this Footnote 2, the revitalization area encompasses
//     locations that are included within the following Areas of the City, as
//     described in Chapter 2 of the Master Plan, Sections IIA through IIF:
//     Downtown Las Vegas, East Las Vegas, West Las Vegas, Downtown South,
//     Charleston, and Twin Lakes." Which side of that line a parcel is on is a
//     Master Plan boundary that is not published as a queryable layer, so the
//     cap is disclosed and never applied.
//   · Residential adjacency (§19.06.040(I) for residential districts, and
//     §19.08.040(H) for commercial and industrial) limits height near a
//     residentially zoned lot. It is a setback-and-envelope rule keyed to
//     distance from a neighbour, not a district ceiling, and no distance
//     measurement has been made here.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — THE SPECIAL-AREA DISTRICTS ARE PLAN-GOVERNED, AND THAT IS A GAP, NOT
// AN ABSENCE. C-V, P-C, PD, R-PD, T-C and T-D publish no dimensional table;
// their standards live in a document adopted by ordinance or fixed at site-plan
// review, and none of those documents is in any dataset:
//
//   C-V  §19.10.020(E)(1) "the minimum development standards for property in the
//        C-V District shall be established in connection with the approval of a
//        minor review of a site development plan review pursuant to LVMC
//        19.16.100."
//   P-C  §19.10.030(C) the approved Planned Community Program "shall establish
//        the maximum number of dwelling units per gross acre"; §19.10.030(E)(2)
//        the Program carries "densities; building height, bulk and setback
//        requirements".
//   PD   §19.10.040(F) "the City Council shall adopt a Master Development Plan
//        and Development Standards, which will thereafter govern the development
//        of property within the District."
//   R-PD §19.10.050(B)(1) "The development standards for a project, including
//        … maximum building heights … shall be as established by the approved
//        Site Development Plan Review for the development." The numeral is a
//        density: §19.10.050(A) "(Example: R-PD4 allows up to four units per
//        gross acre.)" — and the same paragraph says new R-PD development "is not
//        favored and will not be available under this Code."
//   T-C  §19.10.060(B)(2) development "shall conform to the Town Center
//        Development Standards Manual, which is hereby adopted by this
//        reference … on file in the Office of the City Clerk".
//   T-D  §19.10.070(F)(1) approval "shall include the approval and adoption of a
//        Development Standards and Design Guidelines document."
//
// So `farUnconstrained` is FALSE for all six. This is the Atlanta PD-H call and
// the OPPOSITE of Raleigh's PD: an unread plan may impose a floor-area limit,
// and a district nobody has read must never render as one whose code
// affirmatively imposes none. Measured against the live layer 2026-08-09, these
// six families cover 39,432.6 of 76,917.5 mapped acres — 51.3% of the city — so
// the refusal is not a rounding error, and reporting it as "no FAR applies"
// would have been a rule-5 violation across more than half of Las Vegas.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 6 — FOUR MAPPED DISTRICTS ARE NOT IN TITLE 19 AT ALL, AND THE CODE ITSELF
// SAYS WHAT GOVERNS THEM. §19.00.100(B) is the roster of established districts —
// residential (B)(1), commercial and industrial (B)(2), special area (B)(3),
// overlay (B)(4). R-A ("Ranch Acres" per the GIS), R-5 ("Apartment"), R-MHP,
// P-R and N-S appear in none of the four lists, and a full-text search of every
// chapter export listed above finds each of those strings ZERO times anywhere in
// Title 19. R-5 is the one to watch: the roster runs R-1, R-2, R-3, R-4 and then
// stops, so the sequence invites a reader to assume an R-5 that the code does
// not have.
// §19.00.100(C) then states what happens: "Property which, on the effective date
// of this Title, was classified under a zoning classification which no longer
// exists under this Title will be reclassified by the City to an existing
// classification by subsequent Rezoning action. Until that action occurs, such
// property shall be governed by the requirements and limitations applicable to
// the zoning classification in effect just before the adoption of this Title."
// The governing standards are therefore in a superseded ordinance this build has
// not read. That is a GAP with a named cause — not an absence.
//
// ⚠️ Note the roster is not itself reliable as a citation source: §19.00.100(B)(2)
// gives C-PB → 19.08.090, C-M → 19.08.100 and M → 19.08.110, while the chapter's
// own section headings read 19.08.085 C-PB, 19.08.090 C-M and 19.08.100 M
// (19.08.110 is "Commercial and Industrial Parking Design Standards"). The
// roster's cross-references are shifted by one slot. Every citation below is the
// section HEADING as printed above the table it cites, not the roster's pointer.
//
// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE, measured against the live layer 2026-08-09 by running THIS module's
// `resolveLasVegas` over every ZONE value the City's zoning layer serves
// (CLAUDE.md rule 11 — the exported entry point, not the table literal). The
// numbers below are the run's output, and the run is what FOUND R-5: it was not
// in this table until the sweep reported it unresolved over 32.9 acres.
//
//     distinct ZONE values ......... 92    over 207,834 polygons / 76,917.5 acres
//     resolved to figures .......... 46    34,659.3 acres = 45.06%
//     resolved as plan-governed .... 37    39,432.6 acres = 51.27%
//     unresolved ................... 9      2,825.7 acres =  3.67%
//
// The unresolved nine are FACT 6's legacy classifications — R-MHP (302.1 ac),
// P-R (171.1 ac), R-A (134.5 ac), R-5 (32.9 ac) and N-S (3.9 ac) — plus:
//   · NO_ZONE (2,120.2 ac), the layer's own token for "no zoning assigned".
//   · one polygon whose ZONE is literally null, 0.02 acres.
//   · T6-UGL (55.1 ac), which is the sharpest case: it is a real transect zone —
//     §19.17.080 Table 2 lists "T6-UG-L" with its own height-bonus ladder — but
//     §19.09.050.E has NO standards body for it. The contents list runs E.004
//     T6-UC, E.008 T6-UG, E.012 T5-M …, and there is no T6-UGL entry. The code
//     is missing the section, so nothing can be read from it.
//   · T4-M (5.8 ac) is the same shape one notch worse and is likewise
//     unresolved: §19.09.050.E's contents list DOES carry "19.09.050.E.026 T4
//     Maker Zone (T4-M)" and Table 1 (Transect Zones Overview) shows it in a
//     summary column, but the chapter publishes no E.026 body. A summary column
//     in a three-across overview table is exactly the shape of the DC MU-column
//     off-by-one, so it is not read as a standard.
//
// U(…) IS RESOLVED TO U, and that is a code-supported normalisation rather than
// a guess. The map carries U(DR), U(TND), U(PCD), U(RC), U(LI/R), U(PROS),
// U(RNP), U(R), U(ROW), U(PF), U(L), U(ML), U(SC), U(TC), U(RE), U(O) and U(M) —
// but §19.00.100(B)(1) establishes exactly ONE Undeveloped district, "U", with
// district purpose §19.06.050, and 19.06 contains no sub-variants. The layer's
// own DESCRIPTION spells the parenthetical out as a General Plan category
// ("Undeveloped (Desert Rural Up To 2.49 du/ac)"), and a General Plan category is
// not a zoning district. Pinned by a test.
//
// T3-N-O IS RESOLVED TO T3-N's FORM for the same kind of reason and by the
// chapter's own words: §19.09.050.E.040 "B. Sub-Zone — T3-N-O (Open): The open
// sub-zone provides the same building form as the T3-N Zone, with the following
// exceptions: 1. The Side-by-Side Duplex building type is not allowed; and
// 2. Additional use[s] …". The exceptions are to building TYPE and use, not to
// building height, so the 2-story maximum carries. Also pinned by a test.

/** A height limb the code states as an ALTERNATIVE or a QUALIFICATION on the
 *  headline — a different program, a different location, or a discretionary
 *  approval. Disclosure only: never returned as the district's limit
 *  (CLAUDE.md rule 6). */
export interface LasVegasHeightAlternative {
  label: string
  stories: number | null
  heightFt: number | null
  source: string
  /** True when the limb needs a discretionary approval rather than being
   *  available by right (a Major Site Development Plan Review). */
  discretionary: boolean
}

export interface LasVegasLimits {
  /** The chapter's own name for the district; null when unresolved. */
  name: string | null
  /** Maximum STORIES exactly as the code prints them. Never derived from feet. */
  maxStories: number | null
  /** Maximum height in FEET exactly as the code prints it. Never derived from
   *  stories. Null on the Form-Based Code transect zones because the code states
   *  no feet there at all (FACT 3), and null where Table 3 prints "NA". */
  maxHeightFt: number | null
  /** MINIMUM stories, where the Form-Based Code sets one. Disclosure only. */
  minStories: number | null
  /** The section the height figures came from, on its own rather than only
   *  inside `source`, because the provider quotes it in user-facing copy and
   *  slicing it back out of a prose string breaks silently on a reword. */
  heightSource: string | null
  /** The district's Table 3 BUILDING HEIGHT prints "NA" in every row. Stated by
   *  the code, but NOT read as "no maximum" — see FACT 4. */
  heightTableNA: boolean
  /** Maximum lot coverage, VERBATIM as the table prints it ('50%', 'NA',
   *  'Unlimited', '95% max.'). This is what governs bulk in a code with no FAR,
   *  so it is carried as text rather than parsed into a number we would then be
   *  tempted to multiply by something. */
  maxLotCoverage: string | null
  lotCoverageSource: string | null
  /** What the code says about density, in its own words. Null where it says
   *  nothing (the single-family districts state "Dwelling Units per Lot: 1"). */
  densityNote: string | null
  /** TRUE only where Title 19 imposes NO floor-area ratio — a KNOWN absence
   *  (FACT 1). FALSE for the plan-governed districts and for every unresolved
   *  code, where nothing is asserted. */
  farUnconstrained: boolean
  /** The district's standards come from a plan, manual or site-plan approval
   *  that is not published as data (FACT 5). */
  planGoverned: boolean
  /** The sentence that puts the standards in that document. */
  planSource: string | null
  /** Qualifications and other programs, each with its own figure. */
  heightAlternatives: LasVegasHeightAlternative[] | null
  /** Section(s) the figures were transcribed from. Empty only on UNRESOLVED. */
  source: string
}

// ── Constructors ─────────────────────────────────────────────────────────────
// Rule 14: make the caught error an impossible state rather than a comment.
//
// There is DELIBERATELY no constructor that takes a height in feet without a
// story count, or a story count without saying which of the two the code states.
// `tableHeight` demands BOTH because 19.06/19.08 Table 3 prints both; `fbcHeight`
// takes stories only and hard-codes `maxHeightFt: null` because §19.09.050.E
// prints no feet. Re-introducing a feet-per-story conversion here would require
// writing a new constructor — a visible, reviewable act — rather than editing a
// table row. The module contains no ft-per-story number at all, and a test
// asserts that no such constant could reproduce the four pairs the code states.

const blank = (name: string, source: string): LasVegasLimits => ({
  name,
  maxStories: null,
  maxHeightFt: null,
  minStories: null,
  heightSource: null,
  heightTableNA: false,
  maxLotCoverage: null,
  lotCoverageSource: null,
  densityNote: null,
  farUnconstrained: false,
  planGoverned: false,
  planSource: null,
  heightAlternatives: null,
  source,
})

/** A 19.06 / 19.08 district: Table 3 states a story count AND a foot figure,
 *  and Table 1 states a maximum lot coverage. All three are required. */
function tableDistrict(opts: {
  name: string
  stories: number
  heightFt: number
  heightSection: string
  lotCoverage: string
  placementSection: string
  densityNote?: string
  alternatives?: LasVegasHeightAlternative[]
}): LasVegasLimits {
  return {
    ...blank(
      opts.name,
      `LVMC ${opts.heightSection} Table 3 BUILDING HEIGHT (${opts.stories} stories / ${opts.heightFt} ft); ${opts.placementSection} Table 1 BUILDING PLACEMENT (max lot coverage ${opts.lotCoverage}); no floor-area ratio anywhere in Title 19`,
    ),
    maxStories: opts.stories,
    maxHeightFt: opts.heightFt,
    heightSource: `LVMC ${opts.heightSection} Table 3 BUILDING HEIGHT (A. Stories: ${opts.stories} max; B/C. Flat and Pitched Roof: ${opts.heightFt} feet)`,
    maxLotCoverage: opts.lotCoverage,
    lotCoverageSource: `LVMC ${opts.placementSection} Table 1 BUILDING PLACEMENT, row B`,
    densityNote: opts.densityNote ?? null,
    farUnconstrained: true,
    heightAlternatives: opts.alternatives ?? null,
  }
}

/** A 19.06 / 19.08 district whose Table 3 prints "NA" in every height row.
 *  Records the fact; asserts no ceiling and no absence (FACT 4). */
function naHeightDistrict(opts: {
  name: string
  heightSection: string
  lotCoverage: string
  placementSection: string
  densityNote?: string
  alternatives?: LasVegasHeightAlternative[]
}): LasVegasLimits {
  return {
    ...blank(
      opts.name,
      `LVMC ${opts.heightSection} Table 3 BUILDING HEIGHT (Stories / Flat Roof / Pitched Roof all printed "NA"); ${opts.placementSection} Table 1 BUILDING PLACEMENT (max lot coverage ${opts.lotCoverage}); no floor-area ratio anywhere in Title 19`,
    ),
    heightTableNA: true,
    heightSource: `LVMC ${opts.heightSection} Table 3 BUILDING HEIGHT — rows A (Stories), B (Flat Roof) and C (Pitched Roof) all print "NA"`,
    maxLotCoverage: opts.lotCoverage,
    lotCoverageSource: `LVMC ${opts.placementSection} Table 1 BUILDING PLACEMENT, row B`,
    densityNote: opts.densityNote ?? null,
    farUnconstrained: true,
    heightAlternatives: opts.alternatives ?? null,
  }
}

/** A Form-Based Code transect zone: §19.09.050.E "F. Building Form" states a
 *  story range and NO feet. `maxHeightFt` is hard-coded null here so a foot
 *  figure cannot be introduced by editing a table row (FACT 3). */
function fbcZone(opts: {
  name: string
  section: string
  minStories?: number
  maxStories: number
  lotCoverage: string
  alternatives?: LasVegasHeightAlternative[]
}): LasVegasLimits {
  const range =
    opts.minStories != null ? `${opts.minStories} min. - ${opts.maxStories} max.` : `${opts.maxStories} max.`
  return {
    ...blank(
      opts.name,
      `LVMC ${opts.section} F. Building Form, Building Height — Stories, Primary Building: "${range}" (the Form-Based Code states no height in feet); Footprint — Lot coverage ${opts.lotCoverage}; no floor-area ratio anywhere in Title 19`,
    ),
    maxStories: opts.maxStories,
    maxHeightFt: null,
    minStories: opts.minStories ?? null,
    heightSource: `LVMC ${opts.section} F. Building Form ("Building Height — Stories — Primary Building: ${range}"); the Form-Based Code states no maximum in feet, and the only feet in that table are floor-to-floor MINIMA`,
    maxLotCoverage: opts.lotCoverage,
    lotCoverageSource: `LVMC ${opts.section} F. Building Form, Footprint — Lot coverage`,
    farUnconstrained: true,
    heightAlternatives: opts.alternatives ?? null,
  }
}

/** A 19.10 special-area district: every dimensional standard comes from a plan,
 *  manual or site-plan approval that is not published as data. Asserts NOTHING
 *  about height, coverage or FAR (FACT 5). */
function planDistrict(name: string, planSource: string, densityNote?: string): LasVegasLimits {
  return {
    ...blank(name, planSource),
    planGoverned: true,
    planSource,
    densityNote: densityNote ?? null,
  }
}

// ── Shared qualifications ────────────────────────────────────────────────────

/** The mixed-use cap C-1, C-2 and R-4 all carry as footnote 2 to Table 3.
 *  Conditional on a Master Plan boundary that is published as no layer, so it is
 *  disclosure and never a limit. */
const mixedUseCap = (section: string): LasVegasHeightAlternative => ({
  label: 'Mixed-use development outside the Master Plan revitalization area',
  stories: 10,
  heightFt: 150,
  source: `LVMC ${section} Table 3 BUILDING HEIGHT fn.2 ("Except for parcels located within the revitalization area described in this Footnote 2, the maximum building height for mixed-use development is ten stories, or one hundred fifty feet, whichever is less"; the revitalization area is Master Plan ch. 2 §§ IIA–IIF — Downtown Las Vegas, East Las Vegas, West Las Vegas, Downtown South, Charleston and Twin Lakes — and is not published as a queryable layer)`,
  discretionary: false,
})

// ── The table ────────────────────────────────────────────────────────────────

const DISTRICTS: Record<string, LasVegasLimits> = {
  // ── Residential districts (LVMC 19.06) ──────────────────────────────────
  // §19.00.100(B)(1) roster: U, R-E, R-D, R-1, R-SL, R-CL, R-TH, R-2, R-3, R-4,
  // R-MH — and nothing else.
  U: tableDistrict({
    name: 'U Undeveloped',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.050',
    lotCoverage: 'NA',
    placementSection: '19.06.050',
    densityNote:
      'LVMC 19.06.050 Table 1: minimum lot size 20,000 sq ft, 1 dwelling unit per lot. The U District "functions as a temporary classification to be used until property is ready for development for a more intense, permanent use" (§19.06.050) — a holding zone, so its figures are a floor on what the site may eventually carry, not a forecast of it.',
  }),
  'R-E': tableDistrict({
    name: 'R-E Residence Estates',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.060',
    lotCoverage: 'NA',
    placementSection: '19.06.060',
    densityNote: 'LVMC 19.06.060 Table 1: minimum lot size 18,000 sq ft, 1 dwelling unit per lot.',
  }),
  'R-D': tableDistrict({
    name: 'R-D Single Family Residential-Restricted',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.065',
    lotCoverage: 'NA',
    placementSection: '19.06.065',
    densityNote: 'LVMC 19.06.065 Table 1: minimum lot size 10,000 sq ft, 1 dwelling unit per lot.',
  }),
  'R-1': tableDistrict({
    name: 'R-1 Single Family Residential',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.070',
    lotCoverage: '50%',
    placementSection: '19.06.070',
    densityNote: 'LVMC 19.06.070 Table 1: minimum lot size 6,500 sq ft, 1 dwelling unit per lot.',
  }),
  'R-SL': tableDistrict({
    name: 'R-SL Residential Small Lot',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.075',
    lotCoverage: '50%',
    placementSection: '19.06.075',
    densityNote: 'LVMC 19.06.075 Table 1: minimum lot size 4,500 sq ft, 1 dwelling unit per lot.',
  }),
  // R-CL's height table is Table 4, not Table 3 — the chapter inserts a
  // "Zero-lot Line Development" table ahead of it. Cited as printed.
  'R-CL': {
    ...tableDistrict({
      name: 'R-CL Single Family Compact-Lot',
      stories: 2,
      heightFt: 35,
      heightSection: '19.06.080',
      lotCoverage: '70%',
      placementSection: '19.06.080',
      densityNote: 'LVMC 19.06.080 Table 1: minimum lot size 3,000 sq ft, 1 dwelling unit per lot.',
    }),
    heightSource:
      'LVMC 19.06.080 Table 4 BUILDING HEIGHT (A. Stories: 2 max; B/C. Flat and Pitched Roof: 35 feet) — numbered Table 4 rather than Table 3 because the chapter inserts a Zero-lot Line Development table ahead of it',
  },
  'R-TH': tableDistrict({
    name: 'R-TH Single Family Attached',
    stories: 3,
    heightFt: 45,
    heightSection: '19.06.090',
    lotCoverage: '95%',
    placementSection: '19.06.090',
    densityNote: 'LVMC 19.06.090 Table 1: minimum lot size 1,600 sq ft, 1 dwelling unit per lot.',
  }),
  'R-2': tableDistrict({
    name: 'R-2 Medium-Low Density Residential',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.100',
    lotCoverage: 'NA',
    placementSection: '19.06.100',
    densityNote:
      'LVMC 19.06.100 Table 1 row B: "Dwelling Units per Acre 6-12", footnote 1 — "Maximum dwelling units per acre (DUA) is determined by the underlying General Plan Designation and may not exceed the density permitted under said designation." The binding figure therefore needs the General Plan land-use layer as well as the zoning layer, and this build reads only the zoning layer.',
  }),
  'R-3': tableDistrict({
    name: 'R-3 Medium Density Residential',
    stories: 5,
    heightFt: 55,
    heightSection: '19.06.110',
    lotCoverage: 'NA',
    placementSection: '19.06.110',
    densityNote:
      'LVMC 19.06.110 Table 1 row B: "Dwelling Units per Acre 13-50", footnote 1 — the maximum DUA "is determined by the underlying General Plan Designation and may not exceed the density permitted under said designation." Needs the General Plan layer as well as this one.',
  }),
  'R-4': naHeightDistrict({
    name: 'R-4 High Density Residential',
    heightSection: '19.06.120',
    lotCoverage: 'Unlimited',
    placementSection: '19.06.120',
    densityNote:
      'LVMC 19.06.120 Table 1 footnote 1: "The maximum density is unlimited. However, application of standards set forth in LVMC 19.06.040(I) and any height limit on development may impose a de facto limitation on density in all areas." Footnote 2 adds that maximum DUA "is determined by the underlying General Plan Designation" — again a second layer this build does not read.',
    alternatives: [mixedUseCap('19.06.120')],
  }),
  'R-MH': tableDistrict({
    name: 'R-MH Mobile/Manufactured Home Residence',
    stories: 2,
    heightFt: 35,
    heightSection: '19.06.130',
    lotCoverage: '50%',
    placementSection: '19.06.130',
    densityNote:
      'LVMC 19.06.130 Table 1: minimum lot size 6,500 sq ft (4,000 sq ft inside a Mobile Home Park or Tiny House Park), 1 dwelling unit per lot.',
  }),

  // ── Commercial and industrial districts (LVMC 19.08) ────────────────────
  // Sections cited from the chapter's own headings, NOT from the §19.00.100(B)(2)
  // roster, whose pointers for C-PB / C-M / M are shifted by one (FACT 6).
  'P-O': tableDistrict({
    name: 'P-O Professional Office',
    stories: 2,
    heightFt: 35,
    heightSection: '19.08.050',
    lotCoverage: 'NA',
    placementSection: '19.08.050',
  }),
  O: tableDistrict({
    name: 'O Office',
    stories: 2,
    heightFt: 35,
    heightSection: '19.08.060',
    lotCoverage: '30%',
    placementSection: '19.08.060',
    densityNote:
      'LVMC 19.08.060 Table 1 footnote 1: lot coverage "for mixed-use developments may be increased up to a maximum of seventy-five percent of the net lot area upon the approval of a Site Development Plan Review application" — a discretionary increase, not a by-right one.',
  }),
  'C-D': tableDistrict({
    name: 'C-D Designed Commercial',
    stories: 2,
    heightFt: 35,
    heightSection: '19.08.065',
    lotCoverage: '30%',
    placementSection: '19.08.065',
    densityNote:
      'LVMC 19.08.065 Table 1 footnote 1: lot coverage for mixed-use developments may be increased to 75% of net lot area on approval of a Site Development Plan Review — discretionary.',
  }),
  'C-1': naHeightDistrict({
    name: 'C-1 Limited Commercial',
    heightSection: '19.08.070',
    lotCoverage: '50%',
    placementSection: '19.08.070',
    densityNote:
      'LVMC 19.08.070 Table 1 footnotes 1 and 2: senior citizen apartments, and mixed-use developments (up to 75% of net lot area), may exceed the 50% coverage limit on approval of a Site Development Plan Review — discretionary.',
    alternatives: [mixedUseCap('19.08.070')],
  }),
  'C-2': naHeightDistrict({
    name: 'C-2 General Commercial',
    heightSection: '19.08.080',
    lotCoverage: '50%',
    placementSection: '19.08.080',
    densityNote:
      'LVMC 19.08.080 Table 1 footnote 1: lot coverage for mixed-use developments may be increased to 75% of net lot area on approval of a Site Development Plan Review — discretionary.',
    alternatives: [mixedUseCap('19.08.080')],
  }),
  // C-PB is the rule-6 case in this code: the table prints 5 stories / 85 feet,
  // and footnote 3 cuts that to 2 stories / 35 feet for commercial and retail
  // uses. The headline stays the table figure because the district's own purpose
  // is industrial and office-park development, but the LOWER limb is carried in
  // `heightAlternatives` and the provider states it — publishing 5/85 to someone
  // planning retail would overstate by 2.4x.
  'C-PB': tableDistrict({
    name: 'C-PB Planned Business Park',
    stories: 5,
    heightFt: 85,
    heightSection: '19.08.085',
    lotCoverage: 'NA',
    placementSection: '19.08.085',
    alternatives: [
      {
        label: 'Permitted commercial and retail uses',
        stories: 2,
        heightFt: 35,
        source:
          'LVMC 19.08.085 Table 3 BUILDING HEIGHT fn.3 ("Notwithstanding the above, in the case of permitted commercial and retail uses, the maximum building height shall be two stories or thirty-five feet, whichever is less") — a REDUCTION on the table figure, not a bonus',
        discretionary: false,
      },
      {
        label: 'Within 200 ft of a freeway or expressway',
        stories: 6,
        heightFt: 100,
        source:
          'LVMC 19.08.085 Table 3 BUILDING HEIGHT fn.2 ("For parcels of land located within a C-PB Zoning District that is contiguous to, or within two hundred feet of, a freeway or expressway, the maximum building height shall be six stories or one hundred feet, whichever is less") — conditional on a distance this build has not measured',
        discretionary: false,
      },
    ],
  }),
  'C-M': naHeightDistrict({
    name: 'C-M Commercial / Industrial',
    heightSection: '19.08.090',
    lotCoverage: 'NA',
    placementSection: '19.08.090',
  }),
  M: naHeightDistrict({
    name: 'M Industrial',
    heightSection: '19.08.100',
    lotCoverage: 'NA',
    placementSection: '19.08.100',
  }),

  // ── Form-Based Code transect zones (LVMC 19.09.050.E) ───────────────────
  // Stories only. No feet anywhere in this chapter's height row (FACT 3).
  'T6-UC': fbcZone({
    name: 'T6-UC T6 Urban Core Zone',
    section: '19.09.050.E.004',
    minStories: 5,
    maxStories: 20,
    lotCoverage: '95% max.',
  }),
  'T6-UG': fbcZone({
    name: 'T6-UG T6 Urban General Zone',
    section: '19.09.050.E.008',
    minStories: 4,
    maxStories: 12,
    lotCoverage: '90% max.',
  }),
  'T5-M': fbcZone({
    name: 'T5-M T5 Maker Zone',
    section: '19.09.050.E.012',
    maxStories: 5,
    lotCoverage: '90% max.',
  }),
  'T5-C': fbcZone({
    name: 'T5-C T5 Corridor Zone',
    section: '19.09.050.E.016',
    minStories: 2,
    maxStories: 7,
    lotCoverage: '95% max. for mixed-use with residential uses; 85% max. for all other uses',
    alternatives: [
      {
        label: 'Flex High-Rise building type, by Major Site Development Plan Review',
        stories: 10,
        heightFt: null,
        source:
          'LVMC 19.09.050.E.016 F. Building Form fn.1 ("Max. 10 stories allowed for only the Flex High-Rise Building Type subject to Major Site Development Plan Review")',
        discretionary: true,
      },
    ],
  }),
  'T5-MS': fbcZone({
    name: 'T5-MS T5 Main Street Zone',
    section: '19.09.050.E.020',
    minStories: 2,
    maxStories: 7,
    lotCoverage: '90% max.',
  }),
  'T5-N': fbcZone({
    name: 'T5-N T5 Neighborhood Zone',
    section: '19.09.050.E.024',
    minStories: 2,
    maxStories: 5,
    lotCoverage: '85% max.',
  }),
  'T4-C': fbcZone({
    name: 'T4-C T4 Corridor Zone',
    section: '19.09.050.E.028',
    minStories: 2,
    maxStories: 5,
    lotCoverage: '85% max. for mixed-use with residential uses; 75% max. for all other uses',
    alternatives: [
      {
        label: 'Flex Mid-Rise building type, by Major Site Development Plan Review',
        stories: 8,
        heightFt: null,
        source:
          'LVMC 19.09.050.E.028 F. Building Form fn.1 ("Max. 8 stories allowed for only the Flex Mid-Rise Building Type subject to Major Site Development Plan Review")',
        discretionary: true,
      },
    ],
  }),
  'T4-MS': fbcZone({
    name: 'T4-MS T4 Main Street Zone',
    section: '19.09.050.E.032',
    minStories: 2,
    maxStories: 5,
    lotCoverage: '85% max.',
  }),
  'T4-N': fbcZone({
    name: 'T4-N T4 Neighborhood Zone',
    section: '19.09.050.E.036',
    maxStories: 3,
    lotCoverage: '75% max.',
  }),
  'T3-N': fbcZone({
    name: 'T3-N T3 Neighborhood Zone',
    section: '19.09.050.E.040',
    maxStories: 2,
    lotCoverage: '65% max.',
  }),

  // ── Special area districts (LVMC 19.10) — plan-governed, FACT 5 ─────────
  'C-V': planDistrict(
    'C-V Civic',
    'LVMC 19.10.020(E)(1): "Except as otherwise provided in this Section, the minimum development standards for property in the C-V District shall be established in connection with the approval of a minor review of a site development plan review pursuant to LVMC 19.16.100."',
  ),
  'P-C': planDistrict(
    'P-C Planned Community',
    'LVMC 19.10.030(E)(2): the rezoning application must carry "Development standards that set forth: densities; building height, bulk and setback requirements", adopted with the Planned Community Program by City Council ordinance (§19.10.030(F)(1)); §19.10.030(C): "The approved Planned Community Program shall establish the maximum number of dwelling units per gross acre".',
    'Density is fixed by the approved Planned Community Program and "shall be determined at the time the Development Plan is approved" (LVMC 19.10.030(C)).',
  ),
  PD: planDistrict(
    'PD Planned Development',
    'LVMC 19.10.040(F): "In connection with the approval of a Planned Development District, the City Council shall adopt a Master Development Plan and Development Standards, which will thereafter govern the development of property within the District."',
    'LVMC 19.10.040(E)(2): "No use, type of development or development standard is presumptively permitted within the PD District unless it already has been included in the adopted plan for the District."',
  ),
  'T-C': planDistrict(
    'T-C Town Center',
    'LVMC 19.10.060(B)(2): "Development in the T-C District shall conform to the Town Center Development Standards Manual, which is hereby adopted by this reference. The Town Center Development Standards Manual shall be on file in the Office of the City Clerk and in the Department."',
  ),
  'T-D': planDistrict(
    'T-D Traditional Development',
    'LVMC 19.10.070(F)(1): approval of a T-D District "shall include the approval and adoption of a Development Standards and Design Guidelines document", which under §19.10.070(E)(1)(c) sets "Building height, bulk and setback requirements".',
    'LVMC 19.10.070(C): "The approved Development Standards and Design Guidelines document shall establish the maximum number of dwelling units per gross acre for each residential and mixed-use category."',
  ),
}

/** R-PD is mapped with a density numeral (R-PD2 … R-PD46). Every one of them
 *  resolves to the same plan-governed answer, and the numeral is a DENSITY the
 *  code names explicitly rather than anything about bulk. */
function rpd(n: number): LasVegasLimits {
  return planDistrict(
    `R-PD${n} Residential Planned Development`,
    'LVMC 19.10.050(B)(1): "The development standards for a project, including minimum front, side and rear yard setbacks, grade changes, maximum building heights, maximum fence heights and fence design, parking standards, standards for any guest houses/casitas and other design and development criteria, shall be as established by the approved Site Development Plan Review for the development."',
    `LVMC 19.10.050(A): the numeral is a density — "(Example: R-PD4 allows up to four units per gross acre.)" — so R-PD${n} allows up to ${n} units per gross acre. The same paragraph records that new R-PD development "is not favored and will not be available under this Code".`,
  )
}

/** Unresolved. Asserts NOTHING — not a height, not a coverage, and specifically
 *  NOT `farUnconstrained`. A district nobody has read must never render as one
 *  whose code affirmatively imposes no limit. */
const UNRESOLVED: LasVegasLimits = Object.freeze({
  name: null,
  maxStories: null,
  maxHeightFt: null,
  minStories: null,
  heightSource: null,
  heightTableNA: false,
  maxLotCoverage: null,
  lotCoverageSource: null,
  densityNote: null,
  farUnconstrained: false,
  planGoverned: false,
  planSource: null,
  heightAlternatives: null,
  source: '',
})

/** Mapped codes that Title 19 does not establish, with the reason each is a GAP
 *  rather than an absence. Exported so a test can assert they resolve to
 *  nothing and can never acquire `farUnconstrained` (rule 14: pin the caught
 *  error as a structure, the way the superseded Minneapolis Chapter 546 codes
 *  are pinned). */
export const LAS_VEGAS_UNREADABLE_CODES: Readonly<Record<string, string>> = Object.freeze({
  'R-A':
    'Not in the §19.00.100(B) roster and the string "R-A" appears nowhere in Title 19. The GIS labels it "Ranch Acres". Under §19.00.100(C) it is governed by the classification in effect before the UDC was adopted — a superseded ordinance this build has not read.',
  'R-5':
    'Not in the §19.00.100(B) roster — which runs R-1, R-2, R-3, R-4 and stops — and the string "R-5" appears nowhere in Title 19. The GIS labels it "Apartment". §19.00.100(C) applies. Found by the coverage sweep rather than by reading the map legend, which is the point of running the sweep.',
  'R-MHP':
    'Not in the §19.00.100(B) roster and the string "R-MHP" appears nowhere in Title 19 (R-MH, the Mobile/Manufactured Home district, is a different code and IS established, at §19.06.130). §19.00.100(C) applies.',
  'P-R':
    'Not in the §19.00.100(B) roster and the string "P-R" appears nowhere in Title 19. §19.00.100(C) applies.',
  'N-S':
    'Not in the §19.00.100(B) roster and the string "N-S" appears nowhere in Title 19. §19.00.100(C) applies.',
  'T6-UGL':
    'A real transect zone — §19.17.080 Table 2 lists "T6-UG-L" with its own affordable-housing height-bonus ladder — but §19.09.050.E publishes no standards section for it. The contents list runs E.004 T6-UC, E.008 T6-UG, E.012 T5-M and so on, with no T6-UGL entry, so there is no table to read.',
  'T4-M':
    'Listed in the §19.09.050.E contents as "19.09.050.E.026 T4 Maker Zone (T4-M)" and shown as a summary column in Table 1 (Transect Zones Overview), but the chapter publishes no E.026 standards body. A column in a three-across overview table is exactly the shape of the DC MU-column off-by-one and is not read as a standard.',
  NO_ZONE:
    "The zoning layer's own token for a polygon with no zoning assigned. It is the dataset saying it has no answer, not the code saying there is no limit.",
})

/** Every district code this module resolves. Exported so a coverage test can
 *  compare it against the live layer's own vocabulary rather than a copy. */
export const LAS_VEGAS_DISTRICT_CODES: readonly string[] = Object.freeze([
  ...Object.keys(DISTRICTS),
  'R-PD<n>',
])

export interface LasVegasZoneParts {
  /** Base district key, e.g. 'R-1', 'T5-M', 'PD'. Null when unrecognised. */
  base: string | null
  /** The normalised code string, for display. */
  normalized: string
  /** R-PD only: the density numeral the code attaches to the district name. */
  rpdUnitsPerAcre: number | null
  /** The mapped code was a U-district holding zone with a General Plan category
   *  in parentheses, e.g. 'U(DR)'. */
  undevelopedCategory: string | null
}

/**
 * Decompose a Las Vegas ZONE string.
 *
 * The live layer's vocabulary was enumerated 2026-08-09 (92 distinct values over
 * 207,834 polygons), so the shapes handled here are the shapes that actually
 * occur rather than the ones a code reader would guess:
 *
 *   · plain district codes — 'R-1', 'C-2', 'T5-M', 'P-C', 'PD', 'M'
 *   · U-district holding zones with the General Plan category in parentheses —
 *     'U(DR)', 'U(TND)', 'U(LI/R)', 'U(ROW)' … 17 variants
 *   · R-PD with a density numeral — 'R-PD2' … 'R-PD46'
 *   · 'T3-N-O', the Open sub-zone of T3-N
 *
 * Normalisation is uppercase-and-collapse-whitespace only. Nothing is stripped
 * speculatively: 'R-A' is NOT treated as an 'R-' prefix of anything, and 'N-S'
 * is not decomposed, because both are real mapped codes that Title 19 does not
 * establish and both must surface as gaps (FACT 6).
 */
export function parseLasVegasZone(code: string | null | undefined): LasVegasZoneParts {
  if (!code) return { base: null, normalized: '', rpdUnitsPerAcre: null, undevelopedCategory: null }
  const z = code.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!z) return { base: null, normalized: '', rpdUnitsPerAcre: null, undevelopedCategory: null }

  // Codes Title 19 does not establish resolve to nothing, before anything else
  // gets a chance to pattern-match them into a district that does exist.
  if (Object.hasOwn(LAS_VEGAS_UNREADABLE_CODES, z)) {
    return { base: null, normalized: z, rpdUnitsPerAcre: null, undevelopedCategory: null }
  }

  // U(DR), U(TND), … → the one Undeveloped district §19.00.100(B)(1) establishes.
  const u = /^U\(([^)]*)\)$/.exec(z)
  if (u) return { base: 'U', normalized: z, rpdUnitsPerAcre: null, undevelopedCategory: u[1] }

  // T3-N-O is a SUB-ZONE of T3-N and §19.09.050.E.040 B says it has the same
  // building form; its two exceptions are to building type and use, not height.
  if (z === 'T3-N-O') return { base: 'T3-N', normalized: z, rpdUnitsPerAcre: null, undevelopedCategory: null }

  const pd = /^R-PD(\d+)$/.exec(z)
  if (pd) {
    return { base: 'R-PD', normalized: z, rpdUnitsPerAcre: Number(pd[1]), undevelopedCategory: null }
  }

  if (Object.hasOwn(DISTRICTS, z)) {
    return { base: z, normalized: z, rpdUnitsPerAcre: null, undevelopedCategory: null }
  }
  return { base: null, normalized: z, rpdUnitsPerAcre: null, undevelopedCategory: null }
}

/**
 * Resolve what Title 19 states for a Las Vegas zoning code.
 *
 * Every resolved result carries a section citation. An unrecognised code returns
 * UNRESOLVED, which asserts nothing — see the COVERAGE note in the header for
 * what is and is not in the table, and why the remainder is a gap rather than a
 * finding.
 *
 * NEVER derives feet from stories or stories from feet (FACTS 2 and 3) — this
 * module holds no feet-per-story constant at all — and never returns a
 * discretionary or bonus figure as the headline (FACT 4, rule 6).
 */
export function resolveLasVegas(code: string | null | undefined): LasVegasLimits {
  const parts = parseLasVegasZone(code)
  if (!parts.base) return UNRESOLVED
  if (parts.base === 'R-PD') return rpd(parts.rpdUnitsPerAcre ?? 0)
  return DISTRICTS[parts.base] ?? UNRESOLVED
}

/**
 * Coarse use vocabulary for a Las Vegas district.
 *
 * Read from each district's own PURPOSE paragraph in 19.06 / 19.08 (2026-08-09),
 * which is prose, not a matrix.
 *
 * ⚠️ The obvious source — LVMC 19.12.010's Land Use Tables — is deliberately NOT
 * used. It is a wide use-by-district matrix whose columns are P / C / S per
 * district, and reading a use off the wrong column is the DC MU-column
 * off-by-one exactly. The purpose paragraphs say less, and what they say is
 * unambiguous.
 *
 * Returns null wherever the district's real answer cannot be established from a
 * paragraph — every Form-Based Code transect zone (whose permitted uses live in
 * §19.09.050.F's own tables) and every plan-governed district (whose uses are
 * fixed in an approved plan). Null asserts nothing.
 */
export function usesForZone(code: string | null | undefined): string[] | null {
  const { base } = parseLasVegasZone(code)
  if (!base) return null

  // §19.06.050 … §19.06.130: single-family, two-family and multi-family
  // districts. Each purpose paragraph speaks only of residential development.
  if (base === 'U' || /^R-(E|D|1|SL|CL|TH|2|3|MH)$/.test(base)) return ['residential']
  // R-4 §19.06.120 is "intended to allow for the development of high density
  // multi-family units within the downtown urban core", and its Table 3
  // footnote 2 sets a cap for "mixed-use development" in the district — so
  // mixed use is contemplated by the district's own text.
  if (base === 'R-4') return ['residential', 'mixed']
  // §19.08.050 P-O: "low intensity administrative and professional offices".
  if (base === 'P-O') return ['commercial']
  // §19.08.060 O: office, supporting service and low intensity commercial uses;
  // Table 1 fn.1 contemplates mixed-use developments.
  if (base === 'O') return ['commercial', 'mixed']
  // §19.08.065 C-D: "a select type of light commercial uses"; Table 1 fn.1
  // contemplates mixed-use developments.
  if (base === 'C-D') return ['commercial', 'mixed']
  // §19.08.070 C-1: "most retail shopping and personal services, and may be
  // appropriate for mixed use developments".
  // §19.08.080 C-2: "retail, service, automotive, wholesale, office and other
  // general business uses … as well as mixed-use developments".
  //
  // Neither is given a bare 'residential', and that is a decision rather than an
  // oversight: §19.12.070's "Residential, Multi-Family" entry carries the
  // Conditional Use Regulation "This use is permitted only in conjunction with
  // an approved Mixed-Use development", so housing here is a limb of mixed use.
  if (base === 'C-1' || base === 'C-2') return ['commercial', 'mixed']
  // §19.08.085 C-PB: industrial, medical and ancillary commercial uses in an
  // Industrial Office Park setting, "and mixed-use developments".
  if (base === 'C-PB') return ['commercial', 'mixed']
  // §19.08.090 C-M: "business, warehouse, wholesale, office and limited
  // industrial uses". §19.08.100 M: "heavy manufacturing industries", "intended
  // to be located away from all residential development".
  if (base === 'C-M' || base === 'M') return ['commercial']

  // Form-Based Code transect zones and every plan-governed district: not said
  // here. See the warning above.
  return null
}
