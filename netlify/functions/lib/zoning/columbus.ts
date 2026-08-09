// Columbus, OH — curated district limits.
//
// ═════════════════════════════════════════════════════════════════════════════
// SOURCE AND CURRENCY
// ═════════════════════════════════════════════════════════════════════════════
// Columbus City Codes, published by the city's own codifier (Municipal Code
// Corporation) at library.municode.com/oh/columbus. Read 2026-08-08 through the
// publisher's API at the CURRENT job, reached from the code's own table of
// contents rather than a guessed chapter path (CLAUDE.md rule 8):
//
//   https://api.municode.com/Jobs/latest/16219
//     → { Id: 487713, Name: "Supplement 85", ProductId: 16219,
//         BannerText: "COLUMBUS CITY CODES / Codified through
//                      Ordinance No. 0923-2026, enacted April 20, 2026.
//                      (Supp. No. 85, 6/26)" }
//   https://api.municode.com/codesToc?jobId=487713&productId=16219
//   https://api.municode.com/CodesContent?jobId=487713&productId=16219&nodeId=<node>
//
// Title 33 was read in full — all 71 chapter nodes, 1,214,841 characters of
// extracted text. Title 34 is carried in the code as a single attached PDF,
// fetched from the same supplement's blob and confirmed byte-identical
// (Content-MD5 xo0HOvGN0kBWLVoPIdbR7w==) to the copy attached to the previous
// supplement, i.e. unamended between them:
//
//   https://mcclibrary.blob.core.usgovcloudapi.net/codecontent/16219/487713/Title%2034%202024%20Zoning%20Code.pdf
//   (5,887,295 bytes, page footer "July 2025"). NOTE: the URL must stay on ONE
//   line — split across two, scripts/check-citations.ts extracts the directory
//   prefix, gets a 404, and reports a live document as dead.
//
// ═════════════════════════════════════════════════════════════════════════════
// FACT 0 — COLUMBUS IS RUNNING TWO ZONING CODES AT ONCE, AND WHICH ONE APPLIES
//          IS A JOINT DEPENDENCY (CLAUDE.md rule 13).
// ═════════════════════════════════════════════════════════════════════════════
// The "Zone In" rewrite (Title 34, the 2024 Zoning Code) did NOT repeal Title
// 33. Both titles are live in the current Code of Ordinances, and Title 33 has
// two chapters that exist only to govern the coexistence:
//
//   C.C. 3304.01: "Parcels that have not been rezoned in accordance with the
//   Zone In Initiative to 2024 Zoning Code district designations will continue
//   to be governed by this Zoning Code."
//   C.C. 3304.04 then lists the Title 33 chapters that do NOT apply to the 2024
//   code — including every base-district chapter (3332 Residential, 3333
//   Apartment, 3356 C-4, 3359 Downtown, 3363/3365/3367 Manufacturing, 3374
//   University-College Research Park…).
//
// So a Columbus parcel is governed by exactly one of two disjoint district
// vocabularies, and the district string alone CANNOT tell you which. Measured
// live 2026-08-08 against the city's Base Zoning layer (18,804 polygons):
//
//     UCR    = Title 34 "Urban Core"                    173 polygons
//     UCRPD  = Title 33 "University-College Research    10  polygons
//     LUCRPD   Park" + a limited overlay                36  polygons
//
// A prefix match on "UCR" sends 46 research-park polygons — mapped H-35 or
// H-60, i.e. 35 or 60 feet — through the Urban Core table and publishes 12
// stories / 150 feet. The discriminator is the SECOND field the layer carries:
// `GENERAL_ZONING_CATEGORY === 'Mixed-Use'` selects Title 34, and nothing else
// does. Verified as a biconditional, not a heuristic: 1,619 polygons carry
// GENERAL_ZONING_CATEGORY 'Mixed-Use' and exactly the same 1,619 carry
// HEIGHT_DISTRICT 'H-N/A' (UGN-1 545, UCT 511, CAC 269, UCR 173, RAC 48,
// UGN-2 42, UCR-R 31). `selectColumbusCode()` below is the ONLY way this module
// chooses, and both resolvers refuse to answer outside their own code — a
// structure rather than a comment (CLAUDE.md rule 14), pinned by tests in both
// directions.
//
// The layer is current, and it dates itself: max EFFECTIVE_DATE across the
// 18,804 polygons is 2026-07-29 (queried 2026-08-08), and ZONING_STATUS is
// 'Passed' on every row. Zone In Phase 2 (~43% of the city) is not in the map
// yet; EFFECTIVE_DATE is the drift signal to watch.
//
// ═════════════════════════════════════════════════════════════════════════════
// FACT 1 — TITLE 34 IMPOSES NO FLOOR AREA RATIO. An ANSWER, not a lookup
//          failure (CLAUDE.md rule 5), and it survives the slot test.
// ═════════════════════════════════════════════════════════════════════════════
//   · The strings "floor area ratio" and "FAR" occur ZERO times in the whole
//     adopted title (7,177 lines of extracted text).
//   · Structure, not a failed search: Division D "Building Form" IS the
//     intensity table for every district, and its rows are Stories / Height /
//     Height Allowed with Bonus / Roof Access-Parapet / Ground Floor
//     (Floor-to-Floor) / Depth Ground-Floor Space / Accessory Building Height /
//     Adjacency Requirements. There is no FAR row. There is no density row and
//     no minimum-lot-area row either — the word "Density" does not appear in
//     the title at all. Title 34 regulates form and nothing else.
//
// ═════════════════════════════════════════════════════════════════════════════
// FACT 2 — TITLE 33 IMPOSES NO FLOOR AREA RATIO IN ITS BASE DISTRICTS, WITH ONE
//          REAL AND MAPPABLE EXCEPTION.
// ═════════════════════════════════════════════════════════════════════════════
// Searched all 71 chapters. "Floor area ratio" appears in exactly five section
// TITLES, and all five are inside Chapter 3325, the University District Zoning
// Overlay: 3325.025, 3325.211, 3325.311, 3325.805, 3325.913. The bare token
// "FAR" appears only in 3325 (44 times) and 3384 Airport Environs Overlay (2).
// No base-district chapter mentions either.
//
// The structural tells:
//   · Chapter 3397 "SUMMARIES OF DISTRICT REGULATIONS" — the natural home for a
//     dimensional table — is empty. Verbatim editor's note: "Former Chapter
//     3397, consisting of Sections 3397.01 to 3397.31 was repealed by Ordinance
//     No. 1284-04."
//   · Each base-district chapter carries an explicit "Height district" section
//     (3332.29, 3333.26, 3363.27, 3349.04) and explicit area-district
//     requirements, and no FAR section. Intensity is governed by the height
//     district + maximum lot coverage (3332.18(C): 50% for dwellings; 3349.04(b):
//     60% in the Institutional district) + minimum lot area per dwelling unit
//     (3332.06–3332.15, 3333.10–3333.14). The slot for FAR does not exist.
//
// THE EXCEPTION IS NOT HYPOTHETICAL AND IT IS MAPPED. Chapter 3325 imposes real
// floor-area ratios inside the University District Zoning Overlay — 3325.213
// (Neighborhood Commercial subarea, 0.8 max), 3325.313 (Regional Commercial,
// no maximum / 1.0 minimum), 3325.805 (residential districts, 0.40) and
// 3325.913 (apartment-residential: the LESSER of a project-type-dependent ratio
// and a figure derived from the average originally-platted lot size within 200
// feet on the same street). That last one is not resolvable from mapped data at
// all, and the whole chapter is a per-district × per-project-type table that
// rule 6 forbids collapsing to one number.
//
// And it reaches BOTH codes: C.C. 3304.03(H) puts Chapter 3325 on the list that
// applies to the 2024 Zoning Code. Confirmed live — 1494 N High St is UCR
// (Title 34) and sits inside the mapped `University/Impact` overlay polygon.
//
// So inside that overlay, `farUnconstrained: true` is not merely unproven, it
// is FALSE. The provider passes overlay presence in, and this module downgrades
// FAR to an explicit GAP there. Never a number, and never "unconstrained".
//
// ═════════════════════════════════════════════════════════════════════════════
// FACT 3 — HEIGHT. Two instruments, both stated by the code, neither converted.
// ═════════════════════════════════════════════════════════════════════════════
// TITLE 33 regulates height by MAPPED HEIGHT DISTRICT, and the code says to
// read the map: C.C. 3363.27(a) "Height Limit: As shown on the Zoning Map and
// as provided in C.C. 3309.14 and 3309.141." C.C. 3309.14 establishes FOUR
// height districts and states the feet for each, verbatim:
//
//     "35-foot height district .....H-35        A. ... in excess of 35 feet;
//      60-foot height district .....H-60        B. ... in excess of 60 feet;
//      110-foot height district ....H-110       C. ... in excess of 110 feet;
//      200-foot height district ....H-200       D. ... in excess of 200 feet."
//
// The digits in those four symbols ARE feet, stated by the code. Title 33
// states NO story count anywhere, so `stories` stays null for all of it —
// there is no ft/story constant in this file and none may be added (rule 12).
//
// ⚠️ THE FOUR ARE THE ONLY ONES THIS MODULE WILL PARSE, AND THAT IS A
// MEASUREMENT, NOT CAUTION. The live layer also carries H-40, H-41, H-45, H-50,
// H-65, H-66, H-90, H-100, H-120 and H-UNLTD — 23 polygons in total, none of
// them established anywhere in Title 33 (the strings H-35/H-60/H-110/H-200 are
// the only "H-nn" tokens in the entire title). They come from site-specific
// rezoning ordinances. The obvious inference is that they follow the same
// convention. Checked against the establishing ordinances on 2026-08-08, the
// inference is WRONG about as often as it is right:
//
//   symbol  ordinance   what the ordinance says            verdict
//   H-35    1386-99     "Thirty-five (35) feet ... on the   ✓ agrees
//                        L-SR ... L-R-2"
//   H-60    1966-2022   "sixty (60) feet ... on the AR-3"   ✓ agrees
//   H-110   1960-2025   "The height district shall be       ✓ agrees
//                        H-110, allowing for a 110-foot
//                        height limitation"
//   H-200   0289-2022   "two hundred (200) feet"            ✓ agrees
//   H-45    1386-99     "Forty-five (45) feet ... on the    ✓ agrees
//                        L-AR-12 ... and L-C-4"
//   H-65    0538-2025   "a Height District of sixty (60)    ✗ CONTRADICTS
//                        feet is hereby established"          (layer says 65)
//   H-100   1401-2009   "a Height District of One-hundred-  ✗ CONTRADICTS
//                        ten (110) feet"                      (layer says 100)
//
// Each mismatched polygon was located by its own geometry centroid and the
// parcel underneath it matched the ordinance's stated address (H-65 → 1505-1509
// Gerrard Ave, against Ord. 0538-2025's "1501 Gerrard Ave. and seven others";
// H-100 → 1280 Gemini Pl). Four of four code-established symbols agree with
// their ordinances; one of three off-schedule symbols does. So the four the
// code names are carried, everything else is a GAP with the reason attached.
// That is 17,161 of the 17,185 Title 33 polygons (99.86%).
//
// H-UNLTD gets the same treatment and it is worth naming, because it covers the
// downtown core (2 polygons, "Zone A" and "Zone B", Ord. 1532-2013). Reading it
// as "no height limit" is very likely right and is NOT shippable: the symbol
// appears nowhere in Title 33, and Chapter 3359 — which is what Ord. 1532-2013
// enacted — contains the word "height" ZERO times. An unsourced absence is
// still an invention, so it renders as a gap, not `heightUnconstrained`.
//
// TITLE 34 states BOTH units in print, on separate rows, so nothing is
// converted here either. Chapter E.20, Division D "Building Form", one section
// per district. And the six rows carry their own disproof of a ft/story
// constant — 48/4 = 12.0, 60/5 = 12.0, 150/12 = 12.5, 85/7 = 12.14 — which a
// test pins so the Miami-21 round-trip cannot be reintroduced.
//
// ═════════════════════════════════════════════════════════════════════════════

/** Which of Columbus's two live codes governs a parcel. */
export type ColumbusCode = 'title-34' | 'title-33'

/** A program the code allows but does NOT grant by right. Never the ceiling
 *  (CLAUDE.md rule 6) — Title 34's "Height Allowed with Bonus" row is earned
 *  under Chapter G.30 (Height Bonus Program), which G.30.030 makes available
 *  only "to an Affordable Housing Height Bonus applicant that agrees to be
 *  bound by the affordability requirements described in the City Residential
 *  CRA Program", and G.30.030(D) confirms participation is voluntary. */
export interface ColumbusAlternative {
  label: string
  stories: number | null
  heightFt: number | null
  source: string
}

export interface ColumbusLimits {
  /** Which code governs. Null when the layer gave us no category to decide on. */
  code: ColumbusCode | null
  /** Max height in FEET where the code states feet. Never derived from stories. */
  heightFt: number | null
  /** Max height in STORIES where the code states stories. Title 33 states none,
   *  anywhere, so this is null for all of it — an absence, not a conversion
   *  opportunity. */
  stories: number | null
  /** Present only where a figure was resolved. The only value is 'code-stated';
   *  there is deliberately no 'derived-estimate' escape hatch in this module. */
  heightBasis?: 'code-stated'
  /** Why height is null, when it is. A GAP carries a reason; an absence would
   *  carry a flag. They must never render the same (rule 5). */
  heightGap?: string
  /** TRUE where the code affirmatively imposes NO floor-area ratio here. */
  farUnconstrained?: boolean
  /** Why FAR was not resolved, when it wasn't. Mutually exclusive with the flag
   *  above — enforced by a test, in both directions. */
  farGap?: string
  /** Earned programs, never by-right. */
  alternatives?: ColumbusAlternative[]
  /** TRUE where a site-specific ordinance (limited overlay, planned district)
   *  governs alongside the base district and may cap height, units or use BELOW
   *  the figures here. The base figure is then a ceiling the site may not have. */
  siteSpecific?: boolean
  /** Plain-language district name from the code's own establishing section. */
  districtName?: string
}

// ── Title 33 height districts ────────────────────────────────────────────────
/** C.C. 3309.14. The four symbols the Zoning Code establishes, and the feet it
 *  states for each. NOT a parser over "H-(\d+)" — see FACT 3 for the two
 *  measured contradictions that rules a general parser out. */
export const COLUMBUS_HEIGHT_DISTRICT_FT: Record<string, number> = {
  'H-35': 35, // C.C. 3309.14(A)
  'H-60': 60, // C.C. 3309.14(B)
  'H-110': 110, // C.C. 3309.14(C)
  'H-200': 200, // C.C. 3309.14(D)
}

/**
 * Feet for a mapped Title 33 height-district symbol, or null.
 *
 * ⚠️ THIS ABSENCE ASSERTION ENCODES AN INTERPRETATION, so here is the source
 * (CLAUDE.md rule 15). Returning null for `H-65` is NOT "we couldn't be
 * bothered to parse the digits" — Ord. 0538-2025 § 2, the ordinance that placed
 * the H-65 polygon at 1501 Gerrard Ave, reads "That a Height District of sixty
 * (60) feet is hereby established", and Ord. 1401-2009 § 2, which placed the
 * H-100 polygon at 1280 Gemini Pl, reads "One-hundred-ten (110) feet". The
 * symbol and the ordinance disagree on 2 of the 3 off-schedule symbols whose
 * ordinances were readable. C.C. 3309.14 establishes four height districts and
 * these are not among them.
 */
export function title33HeightFt(symbol: string | null | undefined): number | null {
  if (symbol == null) return null
  const s = String(symbol).trim().toUpperCase()
  return COLUMBUS_HEIGHT_DISTRICT_FT[s] ?? null
}

// ── Title 34 building form ───────────────────────────────────────────────────
/**
 * A Title 34 district. BOTH numbers are required arguments, read off the code's
 * own "Stories" and "Height" rows in Division D. It is deliberately impossible
 * to construct an entry from one of them: computing feet from stories (or the
 * reverse) is the Miami-21 defect, and Title 34's own table disproves any
 * constant that would do it — 48/4 = 12.0 but 150/12 = 12.5 and 85/7 ≈ 12.14.
 */
function buildingForm(
  section: string,
  districtName: string,
  stories: number,
  heightFt: number,
  bonus: { stories: number; heightFt: number } | null,
): ColumbusLimits {
  return {
    code: 'title-34',
    districtName,
    stories,
    heightFt,
    heightBasis: 'code-stated',
    // FACT 1: no FAR row, no density row, no lot-area row in the whole title.
    farUnconstrained: true,
    ...(bonus
      ? {
          alternatives: [
            {
              label: 'Affordable-housing height bonus',
              stories: bonus.stories,
              heightFt: bonus.heightFt,
              source: `C.C. Title 34 ${section} "Height Allowed with Bonus"; earned under Chapter G.30 (Height Bonus Program) in conjunction with the City Residential CRA Program — voluntary, not by-right (G.30.030(A), (D))`,
            },
          ],
        }
      : {}),
  }
}

/**
 * Title 34 Chapter E.20 (Mixed-Use Zoning Districts), Division D "Building
 * Form", per district. Transcribed 2026-08-08 from the adopted PDF attached to
 * Supplement 85; each row cites its own section. The "Height Allowed with
 * Bonus" row rides in `alternatives` and never in `heightFt`/`stories`.
 */
export const COLUMBUS_TITLE34_LIMITS: Record<string, ColumbusLimits> = {
  // E.20.040 D: Stories 4 max | Height 48' max | Bonus "Not Applicable"
  'UGN-1': buildingForm('E.20.040', 'Urban General 1', 4, 48, null),
  // E.20.050 D: Stories 4 max | Height 48' max | Bonus "Not Applicable"
  'UGN-2': buildingForm('E.20.050', 'Urban General 2', 4, 48, null),
  // E.20.060 D: Stories 5 max | Height 60' max | Bonus 7 stories/85' max
  UCT: buildingForm('E.20.060', 'Urban Center', 5, 60, { stories: 7, heightFt: 85 }),
  // E.20.070 D: Stories 12 max | Height 150' max | Bonus 16 stories/200' max
  UCR: buildingForm('E.20.070', 'Urban Core', 12, 150, { stories: 16, heightFt: 200 }),
  // UCR-R is the RESTRICTED SUB-DISTRICT of UCR, not a seventh district, and it
  // takes UCR's Building Form. E.20.070 B names it ("Sub-District(s):
  // Restricted (UCR-R)"), it appears as its own column only in the USE table
  // (Table E.20.100.A), and E.20.020.C.1 states what a restricted sub-district
  // does: "To allow less uses than the base district allows in specific areas
  // within the same form and character of the base district". The only form
  // difference E.20.020.C.1.b names is a contextual front setback. Nothing in
  // Chapter E.20 gives UCR-R a Building Form table of its own.
  'UCR-R': {
    ...buildingForm('E.20.070', 'Urban Core (Restricted sub-district)', 12, 150, {
      stories: 16,
      heightFt: 200,
    }),
  },
  // E.20.080 D: Stories 5 max | Height 60' max | Bonus 7 stories/85' max
  CAC: buildingForm('E.20.080', 'Community Activity Center', 5, 60, { stories: 7, heightFt: 85 }),
  // E.20.090 D: Stories 7 max | Height 85' max | Bonus 10 stories/125' max
  RAC: buildingForm('E.20.090', 'Regional Activity Center', 7, 85, { stories: 10, heightFt: 125 }),
}

// ── Title 33 base districts ──────────────────────────────────────────────────
/**
 * The Title 33 base districts whose governing chapter was read, keyed by the
 * symbol the live layer uses (which drops the code's hyphens: `R-2F` → `R2F`).
 * The value names the chapter and what actually governs intensity there —
 * because "no FAR" is only an answer when you can say what the answer is
 * instead (rule 5).
 *
 * Roster from the establishing sections: C.C. 3309.04 (multiple use), 3309.05
 * (residential), 3309.06 (apartment residential), 3309.07 (manufactured home
 * park), 3309.09 (institutional), 3309.10 (commercial), 3309.11 (manufacturing),
 * 3309.13 (parking).
 *
 * ⚠️ C.C. 3309.05 as codified lists the symbol "RR" TWICE — once against
 * "Restricted Rural Residential District" and once against "Rural Residential
 * District". Chapter 3332 resolves it: 3332.025 is the "RRR restricted rural
 * residential district" and 3332.027 the "RR rural residential district", and
 * the live layer carries RRR (134 polygons) and RR (154) as distinct values.
 * The chapter-3332 reading is used; 3309.05's duplication is a codification
 * slip, not two districts sharing a symbol.
 *
 * DELIBERATELY NOT INCLUDED — see COLUMBUS_SITE_SPECIFIC_CLASSES. An absence is
 * only an answer once someone has looked, and nobody has read the individual
 * ordinances that govern the limited and planned districts.
 */
export const COLUMBUS_TITLE33_NO_FAR: Record<string, string> = {
  // Residential — Ch. 3332. Height 35' (3332.29), lot coverage 50% (3332.18(C)),
  // minimum lot area per dwelling unit (3332.06–3332.15). No FAR section.
  RURAL: 'Ch. 3332 (R-rural, C.C. 3309.05) — no FAR section; 35 ft, 50% lot coverage, area-district minimum lot area',
  RRR: 'Ch. 3332.025 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  RR: 'Ch. 3332.027 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  SR: 'Ch. 3332.029 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  R1: 'Ch. 3332.03 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  R2: 'Ch. 3332.033 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  R3: 'Ch. 3332.035 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  R2F: 'Ch. 3332.037 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  R4: 'Ch. 3332.039 — no FAR section; 35 ft (3332.29), 50% lot coverage, area-district minimum lot area',
  MHD: 'Ch. 3332.036 — no FAR section; 35 ft (3332.29), 3332.135 area-district requirements',
  // Apartment residential — Ch. 3333. Height by mapped district (3333.26),
  // coverage 3333.15, minimum lot area per unit 3333.10–3333.14. No FAR section.
  AR12: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.10',
  ARLD: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.11',
  AR1: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.12',
  AR2: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.13',
  AR3: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.14',
  AR4: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.12',
  ARO: 'Ch. 3333 — no FAR section; height per 3333.26, lot coverage 3333.15, minimum lot area per dwelling unit 3333.14',
  // Manufactured home park — Ch. 3343.
  MHP: 'Ch. 3343 — no FAR section; 35 ft height district, chapter site standards',
  // Institutional — Ch. 3349. 3349.04 states all three instruments explicitly.
  I: 'Ch. 3349.04 — no FAR section; 35 ft, 60% maximum lot coverage, 1-acre minimum lot area',
  // Commercial — Ch. 3351/3353/3355/3356/3357.
  C1: 'Ch. 3351 — no FAR section; height per the mapped height district (3309.14), chapter setback and site standards',
  C2: 'Ch. 3353 — no FAR section; height per the mapped height district (3309.14), chapter setback and site standards',
  C3: 'Ch. 3355 — no FAR section; height per the mapped height district (3309.14), chapter setback and site standards',
  C4: 'Ch. 3356 — no FAR section; height per the mapped height district (3309.14), 3356.11 setback lines',
  C5: 'Ch. 3357 — no FAR section; height per the mapped height district (3309.14), chapter setback and site standards',
  // Manufacturing / excavation — Ch. 3363/3365/3367/3369. 3363.27(a) is the
  // section that sends you to the map for height.
  M: 'Ch. 3363.27 — no FAR section; "Height Limit: As shown on the Zoning Map and as provided in C.C. 3309.14 and 3309.141"',
  M1: 'Ch. 3365 — no FAR section; height per the mapped height district (3309.14)',
  M2: 'Ch. 3367 — no FAR section; height per the mapped height district (3309.14)',
  EQ: 'Ch. 3369 — no FAR section; height per the mapped height district (3309.14)',
  // Parking — Ch. 3371/3373.
  P1: 'Ch. 3371 — no FAR section; height per the mapped height district (3309.14)',
  P2: 'Ch. 3373 — no FAR section; height per the mapped height district (3309.14)',
  // Multiple-use districts, C.C. 3309.04.
  DD: 'Ch. 3359 — no FAR section (and no height section either: the chapter is the Downtown Commission and certificate-of-appropriateness process); height per the mapped height district',
  EFD: 'Ch. 3323 — no FAR section; 3323.21(K) states maximum building height per sub-district in stories or feet',
  NE: 'Ch. 3320.05 — no FAR section; Traditional Neighborhood Development transect, 3320.19 private-building standards',
  NG: 'Ch. 3320.07 — no FAR section; Traditional Neighborhood Development transect, 3320.19 private-building standards',
  NC: 'Ch. 3320.09 — no FAR section; Traditional Neighborhood Development transect, 3320.19 private-building standards',
  TC: 'Ch. 3320.11 — no FAR section; Traditional Neighborhood Development transect, 3320.19 private-building standards',
}

/**
 * Title 33 classifications where a SITE-SPECIFIC ordinance governs alongside
 * (or instead of) the base district's minimum standards, so neither
 * `farUnconstrained` nor a base-district figure can be asserted for the site.
 *
 * This is not caution for its own sake. C.C. 3370.03 (Limited Overlay): "The
 * minimum standards of the underlying zoning district shall govern unless the
 * development plan approved by council specifically stipulates a more stringent
 * standard." A more stringent standard can be a floor-area limit the Zoning
 * Code itself does not impose — and one was found while checking something
 * else: Ord. 1386-99, which placed the L-C-4 and L-AR-12 polygons on N Hamilton
 * Rd, commits that "The permitted maximum density within Subarea 35 shall not
 * exceed the ratio of 12,000 square feet of building per net acre of site"
 * (= a floor-area ratio of 0.28). Publishing `farUnconstrained: true` there
 * would be a false statement about what binds the parcel.
 *
 * Matching is by PREFIX for the "L" limited-overlay families and by exact
 * symbol otherwise — see `isSiteSpecificClass`.
 */
export const COLUMBUS_SITE_SPECIFIC_CLASSES: Record<string, string> = {
  CPD: 'Commercial Planned Development (C.C. 3309.10) — the approved CPD text governs',
  PUD2: 'Planned Unit Development-2 (C.C. 3309.08, Ch. 3345) — the approved plan governs',
  PUD4: 'Planned Unit Development-4 (C.C. 3309.08, Ch. 3345) — the approved plan governs',
  PUD6: 'Planned Unit Development-6 (C.C. 3309.08, Ch. 3345) — the approved plan governs',
  PUD8: 'Planned Unit Development-8 (C.C. 3309.08, Ch. 3345) — the approved plan governs',
  PC: 'Planned Community District (C.C. 3309.04/3309.08, Ch. 3347) — the approved plan governs',
  UCRPD:
    'University-College Research Park (C.C. 3309.115, Ch. 3374) — 3374.04 applies "the most restrictive standards required by a residential, commercial or industrial district … which permits such use", plus any P-UCRPD standards from the rezoning',
  LUCRPD:
    'University-College Research Park with a limited overlay (Ch. 3374 + Ch. 3370) — the approved development plan governs',
}

/** Symbols that are ambiguous in the mapped vocabulary and must not be resolved
 *  either way. `LRR` is BOTH a base district symbol (C.C. 3309.05, "Limited
 *  Rural Residential District .....LRR", Ch. 3332.023) and what the layer's
 *  "L" + underlying-district convention would produce for a limited overlay on
 *  RR. `LR` has the same problem against the R-rural district. 44 polygons. */
export const COLUMBUS_AMBIGUOUS_CLASSES: Record<string, string> = {
  LRR: 'ambiguous symbol: C.C. 3309.05 establishes "LRR" as the Limited Rural Residential base district, and the map also spells a limited overlay on RR as "LRR"',
  LR: 'ambiguous symbol: reads as a limited overlay on the R-rural district, whose own symbol C.C. 3309.05 gives as "R"',
}

/** TRUE where a site-specific ordinance governs. The "L" prefix is Chapter 3370
 *  (Limited Overlay) — C.C. 3309.135: "Upon the establishment of a Limited
 *  Overlay on a lot or premises by ordinance of Council, a designation of that
 *  overlay shall be included with the designation of the underlying zoning". */
export function isSiteSpecificClass(classification: string | null | undefined): boolean {
  if (!classification) return false
  const c = String(classification).trim().toUpperCase()
  if (c in COLUMBUS_SITE_SPECIFIC_CLASSES) return true
  if (c in COLUMBUS_AMBIGUOUS_CLASSES) return true
  // A limited-overlay spelling: "L" + a symbol the base roster recognises.
  return c.startsWith('L') && c.slice(1) in COLUMBUS_TITLE33_NO_FAR
}

/**
 * WHICH CODE GOVERNS. The single decision point (CLAUDE.md rule 13 + 14).
 *
 * Keyed on `GENERAL_ZONING_CATEGORY`, never on the district string. Measured
 * live 2026-08-08: 'Mixed-Use' ⇔ HEIGHT_DISTRICT 'H-N/A' is an exact
 * biconditional across all 18,804 polygons (1,619 each way), and the seven
 * Mixed-Use classifications are exactly Title 34's six districts plus the UCR-R
 * restricted sub-district. Keying on the string instead sends UCRPD/LUCRPD —
 * 46 polygons mapped H-35 or H-60 — into the Urban Core table.
 */
export function selectColumbusCode(
  generalZoningCategory: string | null | undefined,
): ColumbusCode | null {
  if (generalZoningCategory == null) return null
  const c = String(generalZoningCategory).trim()
  if (!c) return null
  return c.toLowerCase() === 'mixed-use' ? 'title-34' : 'title-33'
}

const UNRESOLVED: ColumbusLimits = {
  code: null,
  heightFt: null,
  stories: null,
  heightGap: 'no zoning district was returned for this location',
  farGap: 'no zoning district was returned for this location',
}

export interface ColumbusZoneInput {
  /** The layer's CLASSIFICATION value, e.g. 'R3', 'UCT', 'LUCRPD'. */
  classification: string | null | undefined
  /** The layer's GENERAL_ZONING_CATEGORY value — the code discriminator. */
  generalZoningCategory: string | null | undefined
  /** The layer's HEIGHT_DISTRICT value, e.g. 'H-35', 'H-N/A', 'H-UNLTD'. */
  heightDistrict: string | null | undefined
  /** TRUE when the parcel falls inside a mapped University District overlay
   *  polygon, where C.C. Ch. 3325 imposes a real FAR on BOTH codes
   *  (C.C. 3304.03(H)) and no `farUnconstrained` claim may be made. */
  inUniversityOverlay?: boolean
}

/**
 * Resolve Columbus height + FAR for one mapped parcel.
 *
 * Never guesses. Every null carries either `heightGap`/`farGap` (we could not
 * resolve it) or the `farUnconstrained` flag (the code imposes none) — and the
 * two are mutually exclusive, so a gap can never be read as an answer.
 */
export function resolveColumbus(input: ColumbusZoneInput): ColumbusLimits {
  const code = selectColumbusCode(input.generalZoningCategory)
  const cls = input.classification == null ? '' : String(input.classification).trim().toUpperCase()
  if (!code || !cls) return UNRESOLVED

  const university = input.inUniversityOverlay === true
  const universityGap =
    'inside the University District Zoning Overlay, where C.C. Ch. 3325 imposes a floor-area ratio (3325.213 / 3325.313 / 3325.805 / 3325.913) that varies by subarea and project type and, for apartment-residential lots, on the average originally-platted lot size within 200 ft — not resolvable from mapped data'

  if (code === 'title-34') {
    const entry = COLUMBUS_TITLE34_LIMITS[cls]
    if (!entry) {
      // A Mixed-Use polygon carrying a district Title 34 does not charter.
      return {
        code,
        heightFt: null,
        stories: null,
        heightGap: `'${cls}' is mapped as a 2024 Zoning Code (Title 34) district but is not one of the districts C.C. Title 34 E.20.020.A establishes`,
        farGap: `'${cls}' is not a district C.C. Title 34 E.20.020.A establishes`,
      }
    }
    if (university) {
      // Drop the flag rather than overwrite it: `farUnconstrained: false` and
      // "absent" read differently downstream, and only "absent + farGap" is the
      // honest render of a FAR that applies but was not resolved.
      const withoutFlag: ColumbusLimits = { ...entry }
      delete withoutFlag.farUnconstrained
      return { ...withoutFlag, farGap: universityGap }
    }
    return entry
  }

  // ── Title 33 ───────────────────────────────────────────────────────────────
  const symbol = input.heightDistrict == null ? '' : String(input.heightDistrict).trim().toUpperCase()
  const heightFt = title33HeightFt(symbol)
  const height: Pick<ColumbusLimits, 'heightFt' | 'heightBasis' | 'heightGap'> =
    heightFt != null
      ? { heightFt, heightBasis: 'code-stated' }
      : {
          heightFt: null,
          heightGap: !symbol
            ? 'the zoning layer carries no height district for this polygon'
            : symbol === 'H-UNLTD'
              ? "the map assigns 'H-UNLTD', a symbol that appears nowhere in Title 33; C.C. 3309.14 establishes only H-35/H-60/H-110/H-200 and Ch. 3359 (the Downtown District chapter these polygons carry) states no height at all"
              : symbol === 'H-N/A'
                ? "the map assigns 'H-N/A', which the layer uses for 2024 Zoning Code parcels — but this polygon is not categorised Mixed-Use, so no Title 34 building form applies either"
                : `'${symbol}' is not one of the four height districts C.C. 3309.14 establishes; it comes from a site-specific rezoning ordinance, and on the off-schedule symbols whose ordinances were checked the map and the ordinance disagreed 2 times in 3 (H-65 against Ord. 0538-2025's "sixty (60) feet"; H-100 against Ord. 1401-2009's "One-hundred-ten (110) feet")`,
        }

  const siteSpecific = isSiteSpecificClass(cls)
  const districtName = COLUMBUS_TITLE33_NAMES[cls]

  if (university) {
    return { code, ...height, stories: null, farGap: universityGap, ...(siteSpecific ? { siteSpecific: true } : {}), ...(districtName ? { districtName } : {}) }
  }
  if (siteSpecific) {
    const why =
      COLUMBUS_SITE_SPECIFIC_CLASSES[cls] ??
      COLUMBUS_AMBIGUOUS_CLASSES[cls] ??
      `limited overlay on ${cls.slice(1)} (C.C. 3309.135, Ch. 3370) — the approved development plan governs`
    return {
      code,
      ...height,
      stories: null,
      siteSpecific: true,
      farGap: `${why}; C.C. 3370.03 lets that plan stipulate standards more stringent than the Zoning Code's, including floor-area limits the Code itself does not impose`,
      ...(districtName ? { districtName } : {}),
    }
  }
  const noFar = COLUMBUS_TITLE33_NO_FAR[cls]
  if (noFar) {
    return {
      code,
      ...height,
      // Title 33 states height in feet only. It states no story count anywhere,
      // and this module will not manufacture one (rule 12).
      stories: null,
      farUnconstrained: true,
      ...(districtName ? { districtName } : {}),
    }
  }
  return {
    code,
    ...height,
    stories: null,
    farGap: `'${cls}' is not a Title 33 base district whose chapter has been read`,
    ...(districtName ? { districtName } : {}),
  }
}

/** Plain-language names, from the code's own establishing sections
 *  (C.C. 3309.04–3309.13) and chapter headings. */
export const COLUMBUS_TITLE33_NAMES: Record<string, string> = {
  RURAL: 'Rural District', // 3309.05
  LRR: 'Limited Rural Residential District', // 3309.05
  RRR: 'Restricted Rural Residential District', // 3332.025
  RR: 'Rural Residential District', // 3332.027
  SR: 'Suburban Residential District', // 3332.029
  R1: 'R-1 Residential District',
  R2: 'R-2 Residential District',
  R3: 'R-3 Residential District',
  R2F: 'R-2F Residential District',
  R4: 'R-4 Residential District',
  MHD: 'MHD Manufactured Home Development District',
  AR12: 'AR-12 Apartment Residential-12 District', // 3309.06
  ARLD: 'ARLD Apartment Residential Low Density District',
  AR1: 'AR-1 Apartment Residential District',
  AR2: 'AR-2 Apartment Residential District',
  AR3: 'AR-3 Apartment Residential District',
  AR4: 'AR-4 Apartment Residential District',
  ARO: 'AR-O Apartment Residential District',
  MHP: 'Manufactured Home Park District', // 3309.07
  PUD2: 'Planned Unit Development-2 District', // 3309.08
  PUD4: 'Planned Unit Development-4 District',
  PUD6: 'Planned Unit Development-6 District',
  PUD8: 'Planned Unit Development-8 District',
  PC: 'Planned Community District',
  I: 'Institutional District', // 3309.09
  C1: 'C-1 Commercial District', // 3309.10
  C2: 'C-2 Commercial District',
  C3: 'C-3 Commercial District',
  C4: 'C-4 Commercial District',
  C5: 'C-5 Commercial District',
  CPD: 'Commercial Planned Development District',
  M: 'M Manufacturing District', // 3309.11
  M1: 'M-1 Manufacturing District',
  M2: 'M-2 Manufacturing District',
  EQ: 'Excavating & Quarrying District',
  UCRPD: 'University-College Research Park District', // 3309.115
  LUCRPD: 'University-College Research Park District (limited overlay)',
  P1: 'P-1 Private Parking District', // 3309.13
  P2: 'P-2 Public Parking District',
  DD: 'Downtown District', // 3309.04
  EFD: 'East Franklinton District',
  NE: 'Neighborhood Edge District', // 3320.05
  NG: 'Neighborhood General District', // 3320.07
  NC: 'Neighborhood Center District', // 3320.09
  TC: 'Town Center District', // 3320.11
}

/**
 * Allowed uses, keyed on the city's own `GENERAL_ZONING_CATEGORY` rather than a
 * regex over district strings — the city has already normalised 78
 * classifications into 16 categories, and its normalisation is the one that
 * survives Zone In Phase 2 renaming everything underneath it.
 *
 * Returns null (→ INDETERMINATE, not a guess) for the categories whose use
 * chapters have not been read.
 *
 * The commercial mapping is the one worth explaining, because it is a rule-6
 * distinction rather than a rounding: Columbus's commercial districts permit
 * dwellings only VERTICALLY. C.C. 3351.05(B), 3353.05(B), 3355.05(C) and
 * 3356.05(C) each read "Dwelling units only when located above uses permitted
 * in this district". That is 'mixed', not 'residential', and publishing
 * 'residential' would tell a user a standalone apartment building is
 * as-of-right on a C-2 lot when the code says it is not.
 */
export function usesForZone(
  generalZoningCategory: string | null | undefined,
): string[] | null {
  if (generalZoningCategory == null) return null
  switch (String(generalZoningCategory).trim().toLowerCase()) {
    // Title 34, Table E.20.100.A — every district lists Multiple Unit
    // Residential and a commercial range; the districts are mixed-use by intent
    // (E.20.010: "the range of zoning districts … for Columbus' mixed-use areas").
    case 'mixed-use':
      return ['residential', 'commercial', 'mixed']
    // Ch. 3332 residential and Ch. 3333 apartment residential.
    case 'residential':
    case 'multi-family':
    case 'manufactured home':
      return ['residential']
    // Ch. 3351/3353/3355/3356/3357 — dwellings only above permitted uses.
    case 'commercial':
      return ['commercial', 'mixed']
    // Ch. 3363/3365/3367/3369 — C.C. 3363.01 permits residential only for a
    // resident security person or in a halfway house/hospital, so residential
    // is deliberately absent.
    case 'manufacturing':
    case 'excavation/quarrying':
      return ['commercial']
    // Ch. 3349.03 — schools, hospitals, churches, homes for the aging, parks.
    case 'institutional':
      return ['institutional']
    // Research Park, Downtown District, East Franklinton District, Parking,
    // Neighborhood Edge/General/Center, Town Center: their use chapters have
    // not been read. A gap, not a guess.
    default:
      return null
  }
}
