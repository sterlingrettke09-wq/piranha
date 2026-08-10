// Dallas curated district table — City of Dallas Code of Ordinances, VOLUME III,
// CHAPTER 51A "DALLAS DEVELOPMENT CODE: ORDINANCE NO. 19455, AS AMENDED",
// ARTICLE IV "ZONING REGULATIONS".
//
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE AND PROVENANCE. Read 2026-08-09.
//
// Dallas does not self-publish a consolidated development code; its electronic
// code of record is American Legal Publishing. The city's own zoning-districts
// page says so in its own words — "See 51A-4.100 of the Dallas Development Code
// for specific details" — and every figure below was transcribed from the
// publisher's chapter text, reached by walking the code's own table of contents
// rather than guessing chapter paths (CLAUDE.md rule 8): Chapter 51A → Article
// IV → Division 51A-4.110 (Residential District Regulations) and Division
// 51A-4.120 (Nonresidential District Regulations), then each SEC. node the
// division's index listed.
//
// CURRENCY: the publisher's own version selector reads "4/2026 Code (S-32)
// (current)" on every page read. That is the supplement this table reflects.
//
// ⚠️ WHY THE PUBLISHER'S DEEP LINKS ARE NOT IN THESE COMMENTS. They are real and
// they work in a browser, and they are carried in `sources.zoningCode` in
// ../providers/dallas.ts so a reader can click through. They are deliberately
// NOT written as citations here: measured 2026-08-09, codelibrary.amlegal.com
// returns HTTP 403 (a Cloudflare interstitial) to curl under three different
// header profiles, so `scripts/check-citations.ts` would score a live section as
// DEAD. A WAF block is not a repeal, and a checker that cannot tell them apart
// must not be fed the difference. Section-style citations below are therefore
// countable but not fetchable, and this file will report UNCHECKED — which is
// the honest state, not a pass.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — THE SLOT TEST ANSWERS ITSELF HERE, AND IT ANSWERS BOTH WAYS.
//
// Every district's dimensional subsection in Article IV is built from the same
// eight lettered slots:
//
//   (A) Front yard  (B) Side and rear yard  (C) Dwelling unit density
//   (D) Floor area ratio  (E) Height  (F) Lot coverage  (G) Lot size  (H) Stories
//
// Slot (D) EXISTS in every district, and it is filled two different ways:
//
//   §51A-4.112(f)(4)(D)  R-7.5(A)  "Floor area ratio. No maximum floor area ratio."
//   §51A-4.116(c)(4)(D)  MF-3(A)   "Floor area ratio. Maximum floor area ratio is 2.0."
//
// So a Dallas residential district's absence of a FAR is a STATED ANSWER, not a
// failed lookup (CLAUDE.md rule 5) — the code has the slot and writes "No
// maximum" into it — and the very next chapter proves the slot is not decorative
// by putting a number in it. `farUnconstrained: true` is set on the districts
// that say "No maximum floor area ratio" and NOWHERE else; MF-3(A), MF-4(A) and
// every nonresidential district REFUSE the claim, and an unrecognised code
// asserts nothing at all.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — DALLAS STATES HEIGHT IN FEET *AND* STORIES, IN TWO SEPARATE SLOTS,
// AND NEITHER IS DERIVED FROM THE OTHER. Slot (E) is feet; slot (H) is "Maximum
// number of stories above grade". Both are code figures, so both are carried and
// NOTHING is converted (rule 12). The source contains its own disproof that a
// feet-per-story constant exists — these are adjacent rows of the same article:
//
//     district   (E) feet   (H) stories   implied ft/story
//     LO-1        70          5            14.00
//     LO-2        95          7            13.57
//     LO-3       115          9            12.78
//     MO-1       135         10            13.50
//     NO(A)       30          2            15.00
//     CR          54          4            13.50
//     IR         200         15            13.33
//
// Seven districts, five different ratios. That disproves a single GLOBAL
// constant and NOTHING MORE — and this header said more than that until
// 2026-08-09, when the claim "the Miami-21 round trip cannot be reintroduced
// here by arithmetic" was corrected. A PER-DISTRICT constant reproduces any one
// pair exactly (70/5 by 14.0, 54/4 by 13.5), so no comparison of returned
// VALUES can tell a conversion from a transcription; over the 22 dimensioned
// rows below, feet in fact determine stories uniquely, so there is not even a
// counterexample to point at in that direction.
//
// The invariant is therefore enforced STRUCTURALLY in dallas.test.ts, over all
// 46 curated rows rather than a sample: every row states slot (E) and slot (H)
// as bare literals — no expression, no call, no helper — and `row()`, the one
// constructor they pass through, contains no arithmetic operator at all. The
// 10–18 ft/story sweep is kept, and is true, but it is not what holds this up.
//
// Slot (H) also has its own stated absence — "Stories. No maximum number of
// stories." on the A/R/D/TH/CH/MF/MH and CA districts — recorded as
// `storiesUnconstrained` rather than as a null, for the same reason as FACT 1.
//
// ⚠️ AND IT HAS A THIRD STATE, which is neither. MU-1's §51A-4.125(d)(4)(H)
// reads: "Maximum number of stories above grade is: (aa) seven when the maximum
// structure height is 90 feet; and (bb) nine when the maximum structure height
// is 120 feet." Those two heights are the *mixed-use-project* heights. At the
// base height of 80 feet neither limb applies, so for a base MU-1 project the
// code states no story figure and does not say there is none. That is a GAP
// inside a filled slot: `stories: null`, `storiesUnconstrained: false`. Pinned
// by a test, because "no maximum" and "not stated" are one keystroke apart and
// render identically if either is written as a bare null.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — TWO DISTRICTS STATE THAT THERE IS NO HEIGHT LIMIT AT ALL.
// §51A-4.124(a)(4)(E) and §51A-4.124(b)(4)(E), verbatim: "Height. Maximum
// structure height is any legal height." That is the CBD (CA-1(A), 686.7 mapped
// acres) and CA-2(A). It is an ANSWER; `heightUnconstrained` carries it and the
// provider says so in words, because `ParcelInfo['zoning']` has no flag for it
// and a bare `maxHeightFt: null` renders as "no district height limit is
// available in public data" — the tool disclaiming knowledge it has.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — FAR IS PER-PROGRAM IN THE COMMERCIAL AND INDUSTRIAL DISTRICTS, AND
// THE NARROWER LIMB IS THE ONE THAT BINDS AN OFFICE OR RETAIL BUILDING.
// §51A-4.122(b)(4)(D), verbatim: "Maximum floor area ratio is: (i) 0.5 for
// office uses; and (ii) 0.75 for all uses combined." The 0.75 is the overall
// ceiling and is what `far` carries; the 0.5 is a sub-cap on a program the user
// may well be proposing, and it rides in `farSubCaps` so the provider can state
// it. Publishing 0.75 alone would overstate a pure office building by 50%.
// LI and IR/IM carry three limbs each, all recorded.
//
// This is the mirror image of the Austin trap (rule 6): there the error was
// reporting the LARGER of two alternatives as a ceiling. Here the largest figure
// really is the ceiling — but only for a program that mixes uses, and the code
// says which.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — BONUSES ARE EARNED, AND THE LINE IS DRAWN AT AFFORDABILITY.
// Two different mechanisms raise the figures above, and they are treated
// differently on purpose:
//
//   · MIXED USE PROJECT (MUP, §51A-4.125) and MULTIPLE COMMERCIAL PROJECT (MCP,
//     §51A-4.126) are use-mix programs: provide two or more use categories above
//     stated floor-area percentages and file a project plan with the building
//     official. Nothing is bought and nothing is deed-restricted, so these are
//     ALTERNATIVES the applicant elects, like Austin's HOME option — they ride
//     in `farAlternatives`, never in the headline.
//   · The mixed-income development bonuses (Division 51A-4.1100, the "Income
//     band"/"MVA category" tables) and the SAH density ladders (Division
//     51A-4.900) are conditioned on deed-restricted affordable units. They are
//     NEVER returned, in either field — the same call Raleigh's `-TOD` bonus and
//     Atlanta's MRC bonus FAR got.
//   · CA-1(A)'s FAR 24 is likewise absent: §51A-4.124(a)(4)(D)(iii) grants it
//     only "in the CA-1(A)-CP and CA-1(A)-SP districts" and only "by the use of
//     the building setback bonus". The mapped layer carries no -CP/-SP suffix, so
//     the condition cannot even be evaluated here.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 6 — THE "RESIDENTIAL USES" HEADING IS PRESENT IN EVERY DISTRICT AND MEANS
// NOTHING BY ITSELF. This is the Atlanta I-1 trap, and Dallas walks straight
// into it: NO(A), LO-1/2/3, MO-1/2, NS(A), CR, RR, CS and MC-1…MC-4 all print
// "(I) Residential uses." in their main-use list, and the only item under it is
// "College dormitory, fraternity, or sorority house." No dwelling of any kind is
// a permitted main use in those districts. LI, IR and IM are blunter still —
// their entire residential list reads "None permitted."
//
// GO(A) is the sharpest case and the one a name-based guess gets exactly
// backwards: its list does include dwellings, qualified in the same line —
// "Single family, duplex, and multifamily uses may occupy up to five percent of
// the total floor area of any building", restated at §51A-4.121(d)(8)(F). A
// five-percent component of someone else's office building is not a residential
// right, so 'residential' is withheld there too.
//
// Every `uses` value below was read from that district's own "(I) Residential
// uses" list on 2026-08-09; none was inferred from the district's name.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 7 — WHAT IS *NOT* IN THIS TABLE, AND WHY EACH IS A GAP RATHER THAN AN
// ABSENCE.
//
//   · PD — Planned Development, 999 distinct districts, 43,940 mapped acres
//     (18.03% of the city). §51A-4.702(a)(4): "The ordinance establishing a PD
//     must specify regulations governing building height, floor area, lot area,
//     lot coverage, density, yards …", and (a)(5): "The regulations of each PD
//     ordinance shall be codified in Chapter 51P." A FAR and a height DO bind a
//     PD parcel — they are simply in a different chapter, one ordinance per
//     district. `planGoverned: true` says exactly that, and `farUnconstrained`
//     stays false.
//   · CD — Conservation District, 18 mapped districts, 1,978 acres.
//     §51A-4.505(a)(4) defines "CD ORDINANCE" as "the ordinance establishing or
//     amending a particular conservation district". Same shape; recorded as
//     `ordinanceGoverned`.
//   · WMU-3/5/8, WR-3/5/20 (form districts, Article XIII), UC-1/2/3 (urban
//     corridor, §51A-4.127), P(A) (parking district) and PFD-1: 254.6 acres,
//     0.10% of the city, deliberately not read. An unread district is a gap.
//   · "GR Chap 51", "O-2 Chap 51", "MF-2 Chap 51" — three polygons, 4.4 acres,
//     still under CHAPTER 51, the FORMER Dallas Development Code, which is a
//     separate chapter of the city code. Chapter 51A establishes no GR, no O-2
//     and no MF-2 district (§51A-4.101 lists CR/RR/NS(A) for retail and
//     MF-1…MF-4 for multifamily), so a 51A lookup on those strings must resolve
//     to nothing. A test pins that — this is the Minneapolis Chapter 546 shape,
//     except the superseded codes are still live in the data.
//
// COVERAGE, measured 2026-08-09 by running the exported `resolveDallas` over
// every (LONG_ZONE_DIST, ZONE_DIST) pair the live Base Zoning layer serves
// (rule 11 — the entry point, not the table literal):
//
//     polygons ......... 3,815      243,768.9 acres
//     curated .......... 197,580.4 ac   81.05%
//     PD (plan) ........  43,955.8 ac   18.03%
//     CD (ordinance) ...   1,978.1 ac    0.81%
//     gap ..............     254.6 ac    0.10%
//
// The four add to 243,768.9 exactly. For scale, shoelacing the city-limits
// polygon in EPSG:2276 gives 245,474 acres, so 99.3% of Dallas is zoned by this
// layer — the check that says the coverage denominator is the city and not a
// subset of it.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 8 — RESOLVING A DISTRICT NEEDS BOTH ZONING FIELDS, NOT ONE (rule 13).
// The layer publishes `LONG_ZONE_DIST` (the mapped label: "R-7.5(A)", "PD-269",
// "CD-7") and `ZONE_DIST` (the family: "R-7.5(A)", "PD", "CD"). Measured over
// all 3,815 polygons: 3,728 resolve identically from either field, 86 resolve
// from neither (the gaps above), and exactly ONE resolves only from `ZONE_DIST`
// — a polygon whose LONG_ZONE_DIST is the typo "MU=1" while ZONE_DIST reads
// "MU-1" (2.5 acres). One polygon is not much; a resolver that reads one field
// and a dataset that needs two is the defect, and it is invisible to any test
// that feeds the resolver a clean code. `resolveDallas` takes both.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS MODULE DELIBERATELY DOES NOT CARRY. Slots (A), (B), (F) and (G) —
// yards, lot coverage and minimum lot size — were read and are not published,
// because `ParcelInfo` has no field for them and inventing one here would put a
// number in front of a user with nowhere to say what it constrains. They are
// omitted, not unknown. Slot (C), dwelling-unit density, IS carried, because on
// TH-1(A) (six units per acre) it binds a residential program far harder than
// the floor area does.
import type { Use } from '../../../../src/types/analysis'

/** A floor-area ratio that binds a NARROWER program than the district ceiling
 *  (FACT 4). Never a range around the headline, and never larger than it. */
export interface DallasFarSubCap {
  /** The code's own words for the program, e.g. "office uses". */
  label: string
  far: number
}

/** A development program the applicant may elect, with its own ratio — the MUP
 *  and MCP tables (FACT 5). Alternatives, not a range. */
export interface DallasFarAlternative {
  label: string
  far: number
  source: string
}

/** A height the code states for an elected building form — NO(A) and NS(A) put
 *  a taller figure on a gable/hip/gambrel roof, and the MU districts put taller
 *  figures on a qualifying mixed-use project. The headline is always the form
 *  that needs nothing elected (rule 6). */
export interface DallasHeightAlternative {
  label: string
  heightFt: number
  source: string
}

export interface DallasLimits {
  /** The district's name as §51A-4.101 states it. Null when unresolved. */
  name: string | null

  /** Slot (E), in FEET, exactly as the code prints it. Null means one of three
   *  things and the flag below disambiguates two of them:
   *    heightUnconstrained → "Maximum structure height is any legal height"
   *    otherwise            → not resolved (a GAP) */
  heightFt: number | null
  heightUnconstrained: boolean
  heightSource: string | null
  heightAlternatives: DallasHeightAlternative[] | null

  /** Slot (H), "Maximum number of stories above grade". NEVER derived from
   *  `heightFt` and never used to derive it (FACT 2). */
  stories: number | null
  /** The code states "No maximum number of stories" here. An ANSWER. */
  storiesUnconstrained: boolean
  storiesSource: string | null

  /** Slot (D) — the ceiling on ALL uses combined. */
  far: number | null
  /** The code states "No maximum floor area ratio" here. An ANSWER (FACT 1). */
  farUnconstrained: boolean
  farSubCaps: DallasFarSubCap[] | null
  farSource: string | null
  farAlternatives: DallasFarAlternative[] | null

  /** Slot (C), maximum dwelling units per net acre where the code states one. */
  densityDuPerAcre: number | null
  /** The code states "No maximum dwelling unit density" here. An ANSWER. */
  densityUnconstrained: boolean
  densitySource: string | null

  /** PD: the establishing ordinance sets the figures, codified in Chapter 51P.
   *  NOT an absence — a FAR and a height bind, from another chapter (FACT 7). */
  planGoverned: boolean
  /** CD: the conservation-district ordinance sets the figures (FACT 7). */
  ordinanceGoverned: boolean

  /** Read from the district's own "(I) Residential uses" list plus the code's
   *  own name for the district (FACT 6). Null where nothing was read. */
  uses: Use[] | null

  /** The section(s) this row was transcribed from. Empty only on UNRESOLVED. */
  source: string
}

// ── Constructors ─────────────────────────────────────────────────────────────
// Rule 14: turn each caught error into a state that cannot be written by
// accident. Height, stories, FAR and density each take a SLOT VALUE that is
// either a number or one of the code's two stated non-numbers, so a row cannot
// silently drop a slot and cannot express "no maximum" and "not stated" as the
// same bare null. There is deliberately no constructor that accepts a height
// without also being told what the story slot says, and none that accepts any
// figure without its section string.

/** What the code wrote into a slot. `'none'` is the code saying there is no
 *  maximum; `'not-stated'` is the code not reaching this case (FACT 2's MU-1). */
type Slot = number | 'none' | 'not-stated'

interface Row {
  name: string
  /** §…(4)(E) */
  height: Slot
  heightSource: string
  heightAlternatives?: DallasHeightAlternative[]
  /** §…(4)(H) */
  stories: Slot
  storiesSource: string
  /** §…(4)(D), the "all uses combined" figure */
  far: Slot
  farSource: string
  farSubCaps?: DallasFarSubCap[]
  farAlternatives?: DallasFarAlternative[]
  /** §…(4)(C) */
  density: Slot
  densitySource: string
  uses: Use[]
}

const num = (s: Slot): number | null => (typeof s === 'number' ? s : null)
const isNone = (s: Slot): boolean => s === 'none'

function row(r: Row): DallasLimits {
  return {
    name: r.name,
    heightFt: num(r.height),
    heightUnconstrained: isNone(r.height),
    heightSource: r.heightSource,
    heightAlternatives: r.heightAlternatives ?? null,
    stories: num(r.stories),
    storiesUnconstrained: isNone(r.stories),
    storiesSource: r.storiesSource,
    far: num(r.far),
    farUnconstrained: isNone(r.far),
    farSubCaps: r.farSubCaps ?? null,
    farSource: r.farSource,
    farAlternatives: r.farAlternatives ?? null,
    densityDuPerAcre: num(r.density),
    densityUnconstrained: isNone(r.density),
    densitySource: r.densitySource,
    planGoverned: false,
    ordinanceGoverned: false,
    uses: r.uses,
    source: [r.heightSource, r.storiesSource, r.farSource, r.densitySource]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' · '),
  }
}

/** A district whose figures live in an ordinance outside Chapter 51A. Asserts
 *  no absence of anything — the point is that the limits exist elsewhere. */
function governed(
  name: string,
  kind: 'plan' | 'ordinance',
  source: string,
): DallasLimits {
  return {
    name,
    heightFt: null,
    heightUnconstrained: false,
    heightSource: null,
    heightAlternatives: null,
    stories: null,
    storiesUnconstrained: false,
    storiesSource: null,
    far: null,
    farUnconstrained: false,
    farSubCaps: null,
    farSource: null,
    farAlternatives: null,
    densityDuPerAcre: null,
    densityUnconstrained: false,
    densitySource: null,
    planGoverned: kind === 'plan',
    ordinanceGoverned: kind === 'ordinance',
    uses: null,
    source,
  }
}

/** The value for a code this table has not read. Asserts NOTHING — no height,
 *  no FAR, and above all no `farUnconstrained`. */
export const UNRESOLVED_DALLAS: DallasLimits = Object.freeze({
  name: null,
  heightFt: null,
  heightUnconstrained: false,
  heightSource: null,
  heightAlternatives: null,
  stories: null,
  storiesUnconstrained: false,
  storiesSource: null,
  far: null,
  farUnconstrained: false,
  farSubCaps: null,
  farSource: null,
  farAlternatives: null,
  densityDuPerAcre: null,
  densityUnconstrained: false,
  densitySource: null,
  planGoverned: false,
  ordinanceGoverned: false,
  uses: null,
  source: '',
})

// Common section-string builders, so a citation is never retyped.
const S = (sec: string, slot: 'C' | 'D' | 'E' | 'H') => `§ ${sec}(4)(${slot})`

// Reused use vocabularies, each traceable to a read list (FACT 6).
const SFR: Use[] = ['residential']
const RES_INST: Use[] = ['residential', 'institutional']
/** Office / retail / commercial-service / industrial / multiple-commercial:
 *  the only residential main use is a college dormitory or fraternity house, so
 *  'residential' is withheld and 'institutional' carries the dormitory. */
const COMM_INST: Use[] = ['commercial', 'institutional']
/** LI, IR, IM — "(I) Residential uses. None permitted." Nothing to carry. */
const COMM_ONLY: Use[] = ['commercial']
/** CA and MU: dwellings and commerce are both permitted main uses. */
const FULL_MIX: Use[] = ['residential', 'commercial', 'mixed', 'institutional']

// ── The table ────────────────────────────────────────────────────────────────
// One value per line, each with the section it came from. Keys are the exact
// strings the live Base Zoning layer serves in LONG_ZONE_DIST / ZONE_DIST.

const DISTRICTS: Record<string, DallasLimits> = {
  // ══ Division 51A-4.110 · Residential districts ═════════════════════════════
  // Every one of these writes "No maximum floor area ratio" into slot (D) and
  // "No maximum number of stories" into slot (H). Both are answers (FACT 1).
  'A(A)': row({
    name: 'Agricultural district',
    height: 24,
    heightSource: S('51A-4.111', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.111', 'H'),
    far: 'none',
    farSource: S('51A-4.111', 'D'),
    density: 'none',
    densitySource: S('51A-4.111', 'C'),
    uses: RES_INST,
  }),
  'R-1ac(A)': row({
    name: 'Single family district 1 acre',
    height: 36,
    heightSource: S('51A-4.112(a)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(a)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(a)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(a)', 'C'),
    uses: SFR,
  }),
  'R-1/2ac(A)': row({
    name: 'Single family district 1/2 acre',
    height: 36,
    heightSource: S('51A-4.112(b)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(b)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(b)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(b)', 'C'),
    uses: SFR,
  }),
  'R-16(A)': row({
    name: 'Single family district 16,000 square feet',
    height: 30,
    heightSource: S('51A-4.112(c)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(c)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(c)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(c)', 'C'),
    uses: SFR,
  }),
  'R-13(A)': row({
    name: 'Single family district 13,000 square feet',
    height: 30,
    heightSource: S('51A-4.112(d)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(d)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(d)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(d)', 'C'),
    uses: SFR,
  }),
  'R-10(A)': row({
    name: 'Single family district 10,000 square feet',
    height: 30,
    heightSource: S('51A-4.112(e)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(e)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(e)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(e)', 'C'),
    uses: SFR,
  }),
  'R-7.5(A)': row({
    name: 'Single family district 7,500 square feet',
    height: 30,
    heightSource: S('51A-4.112(f)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(f)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(f)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(f)', 'C'),
    uses: SFR,
  }),
  'R-5(A)': row({
    name: 'Single family district 5,000 square feet',
    height: 30,
    heightSource: S('51A-4.112(g)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.112(g)', 'H'),
    far: 'none',
    farSource: S('51A-4.112(g)', 'D'),
    density: 'none',
    densitySource: S('51A-4.112(g)', 'C'),
    uses: SFR,
  }),
  'D(A)': row({
    name: 'Duplex district',
    height: 36,
    heightSource: S('51A-4.113', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.113', 'H'),
    far: 'none',
    farSource: S('51A-4.113', 'D'),
    density: 'none',
    densitySource: S('51A-4.113', 'C'),
    uses: SFR,
  }),
  // The three townhouse districts share one dimensional subsection and differ
  // ONLY in slot (C): "six / nine / 12 dwelling units for each acre".
  'TH-1(A)': row({
    name: 'Townhouse district 1',
    height: 36,
    heightSource: S('51A-4.114', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.114', 'H'),
    far: 'none',
    farSource: S('51A-4.114', 'D'),
    density: 6,
    densitySource: `${S('51A-4.114', 'C')}(i)`,
    uses: SFR,
  }),
  'TH-2(A)': row({
    name: 'Townhouse district 2',
    height: 36,
    heightSource: S('51A-4.114', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.114', 'H'),
    far: 'none',
    farSource: S('51A-4.114', 'D'),
    density: 9,
    densitySource: `${S('51A-4.114', 'C')}(ii)`,
    uses: SFR,
  }),
  'TH-3(A)': row({
    name: 'Townhouse district 3',
    height: 36,
    heightSource: S('51A-4.114', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.114', 'H'),
    far: 'none',
    farSource: S('51A-4.114', 'D'),
    density: 12,
    densitySource: `${S('51A-4.114', 'C')}(iii)`,
    uses: SFR,
  }),
  CH: row({
    name: 'Clustered housing district',
    height: 36,
    heightSource: `${S('51A-4.115', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.115', 'H'),
    far: 'none',
    farSource: S('51A-4.115', 'D'),
    density: 18,
    densitySource: S('51A-4.115', 'C'),
    uses: SFR,
  }),
  'MF-1(A)': row({
    name: 'Multifamily district 1',
    height: 36,
    heightSource: `${S('51A-4.116(a)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(a)', 'H'),
    far: 'none',
    farSource: S('51A-4.116(a)', 'D'),
    density: 'none',
    densitySource: `${S('51A-4.116(a)', 'C')}(i)`,
    uses: RES_INST,
  }),
  // The (SAH) variant shares the whole dimensional subsection and differs only
  // in slot (C), where the density ladder starts at 15 units per net acre with
  // NO affordable units provided. The 16/17/20/30 rows are earned with 5/10/15/20
  // percent SAH units and are never returned (FACT 5).
  'MF-1(SAH)': row({
    name: 'Multifamily district 1 affordable',
    height: 36,
    heightSource: `${S('51A-4.116(a)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(a)', 'H'),
    far: 'none',
    farSource: S('51A-4.116(a)', 'D'),
    density: 15,
    densitySource: `${S('51A-4.116(a)', 'C')}(ii)`,
    uses: RES_INST,
  }),
  'MF-2(A)': row({
    name: 'Multifamily district 2',
    height: 36,
    heightSource: `${S('51A-4.116(b)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(b)', 'H'),
    far: 'none',
    farSource: S('51A-4.116(b)', 'D'),
    density: 'none',
    densitySource: `${S('51A-4.116(b)', 'C')}(i)`,
    uses: RES_INST,
  }),
  'MF-2(SAH)': row({
    name: 'Multifamily district 2 affordable',
    height: 36,
    heightSource: `${S('51A-4.116(b)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(b)', 'H'),
    far: 'none',
    farSource: S('51A-4.116(b)', 'D'),
    density: 20,
    densitySource: `${S('51A-4.116(b)', 'C')}(ii)`,
    uses: RES_INST,
  }),
  // ⚠️ The FIRST district in the code's own order where slot (D) holds a number.
  // "Maximum floor area ratio is 2.0" — three chapters after R-7.5(A) writes
  // "No maximum floor area ratio" into the same slot.
  'MF-3(A)': row({
    name: 'Multifamily district 3',
    height: 90,
    heightSource: `${S('51A-4.116(c)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(c)', 'H'),
    far: 2.0,
    farSource: S('51A-4.116(c)', 'D'),
    density: 90,
    densitySource: S('51A-4.116(c)', 'C'),
    uses: RES_INST,
  }),
  'MF-4(A)': row({
    name: 'Multifamily district 4',
    height: 240,
    heightSource: `${S('51A-4.116(d)', 'E')}(ii)`,
    stories: 'none',
    storiesSource: S('51A-4.116(d)', 'H'),
    far: 4.0,
    farSource: S('51A-4.116(d)', 'D'),
    density: 160,
    densitySource: S('51A-4.116(d)', 'C'),
    uses: RES_INST,
  }),
  'MH(A)': row({
    name: 'Manufactured home district',
    height: 24,
    heightSource: S('51A-4.117', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.117', 'H'),
    far: 'none',
    farSource: S('51A-4.117', 'D'),
    density: 'none',
    densitySource: S('51A-4.117', 'C'),
    uses: RES_INST,
  }),

  // ══ Division 51A-4.120 · Nonresidential districts ══════════════════════════
  // ⚠️ NO(A) and NS(A) state height twice: "(aa) 35 feet for a structure with a
  // gable, hip, or gambrel roof; and (bb) 30 feet for any other structure." The
  // headline is the form that needs nothing elected — 30 ft — and the 35 ft
  // figure rides in `heightAlternatives` (rule 6). Publishing 35 would assume a
  // roof the applicant has not chosen.
  'NO(A)': row({
    name: 'Neighborhood office district',
    height: 30,
    heightSource: `${S('51A-4.121(a)', 'E')}(ii)(bb)`,
    heightAlternatives: [
      {
        label: 'Structure with a gable, hip, or gambrel roof',
        heightFt: 35,
        source: `${S('51A-4.121(a)', 'E')}(ii)(aa)`,
      },
    ],
    stories: 2,
    storiesSource: S('51A-4.121(a)', 'H'),
    far: 0.5,
    farSource: S('51A-4.121(a)', 'D'),
    density: 'none',
    densitySource: S('51A-4.121(a)', 'C'),
    uses: COMM_INST,
  }),
  'LO-1': row({
    name: 'Limited office district 1',
    height: 70,
    heightSource: `${S('51A-4.121(b)', 'E')}(ii)(aa)`,
    stories: 5,
    storiesSource: `${S('51A-4.121(b)', 'H')}(i)(aa)`,
    far: 1.0,
    farSource: `${S('51A-4.121(b)', 'D')}(i)`,
    density: 'none',
    densitySource: S('51A-4.121(b)', 'C'),
    uses: COMM_INST,
  }),
  'LO-2': row({
    name: 'Limited office district 2',
    height: 95,
    heightSource: `${S('51A-4.121(b)', 'E')}(ii)(bb)`,
    stories: 7,
    storiesSource: `${S('51A-4.121(b)', 'H')}(i)(bb)`,
    far: 1.5,
    farSource: `${S('51A-4.121(b)', 'D')}(ii)`,
    density: 'none',
    densitySource: S('51A-4.121(b)', 'C'),
    uses: COMM_INST,
  }),
  'LO-3': row({
    name: 'Limited office district 3',
    height: 115,
    heightSource: `${S('51A-4.121(b)', 'E')}(ii)(cc)`,
    stories: 9,
    storiesSource: `${S('51A-4.121(b)', 'H')}(i)(cc)`,
    far: 1.75,
    farSource: `${S('51A-4.121(b)', 'D')}(iii)`,
    density: 'none',
    densitySource: S('51A-4.121(b)', 'C'),
    uses: COMM_INST,
  }),
  // MO-1 and MO-2's slot (C) reads "Not applicable." rather than "No maximum",
  // so neither the number nor the stated absence is available — 'not-stated'.
  'MO-1': row({
    name: 'Mid-range office district 1',
    height: 135,
    heightSource: `${S('51A-4.121(c)', 'E')}(ii)(aa)`,
    stories: 10,
    storiesSource: `${S('51A-4.121(c)', 'H')}(i)(aa)`,
    far: 2.0,
    farSource: `${S('51A-4.121(c)', 'D')}(i)`,
    density: 'not-stated',
    densitySource: S('51A-4.121(c)', 'C'),
    uses: COMM_INST,
  }),
  'MO-2': row({
    name: 'Mid-range office district 2',
    height: 160,
    heightSource: `${S('51A-4.121(c)', 'E')}(ii)(bb)`,
    stories: 12,
    storiesSource: `${S('51A-4.121(c)', 'H')}(i)(bb)`,
    far: 3.0,
    farSource: `${S('51A-4.121(c)', 'D')}(ii)`,
    density: 'not-stated',
    densitySource: S('51A-4.121(c)', 'C'),
    uses: COMM_INST,
  }),
  // GO(A) permits dwellings only as "up to five percent of the total floor area
  // of any building" (§51A-4.121(d)(8)(F)) — see FACT 6. Not a residential right.
  'GO(A)': row({
    name: 'General office district',
    height: 270,
    heightSource: `${S('51A-4.121(d)', 'E')}(ii)`,
    stories: 20,
    storiesSource: S('51A-4.121(d)', 'H'),
    far: 4.0,
    farSource: S('51A-4.121(d)', 'D'),
    density: 'none',
    densitySource: S('51A-4.121(d)', 'C'),
    uses: COMM_INST,
  }),
  'NS(A)': row({
    name: 'Neighborhood service district',
    height: 30,
    heightSource: `${S('51A-4.122(a)', 'E')}(ii)(bb)`,
    heightAlternatives: [
      {
        label: 'Structure with a gable, hip, or gambrel roof',
        heightFt: 35,
        source: `${S('51A-4.122(a)', 'E')}(ii)(aa)`,
      },
    ],
    stories: 2,
    storiesSource: S('51A-4.122(a)', 'H'),
    far: 0.5,
    farSource: S('51A-4.122(a)', 'D'),
    density: 'none',
    densitySource: S('51A-4.122(a)', 'C'),
    uses: COMM_INST,
  }),
  CR: row({
    name: 'Community retail district',
    height: 54,
    heightSource: `${S('51A-4.122(b)', 'E')}(ii)`,
    stories: 4,
    storiesSource: S('51A-4.122(b)', 'H'),
    far: 0.75,
    farSource: `${S('51A-4.122(b)', 'D')}(ii)`,
    farSubCaps: [{ label: 'office uses', far: 0.5 }],
    density: 'none',
    densitySource: S('51A-4.122(b)', 'C'),
    uses: COMM_INST,
  }),
  RR: row({
    name: 'Regional retail district',
    height: 70,
    heightSource: `${S('51A-4.122(c)', 'E')}(ii)`,
    stories: 5,
    storiesSource: S('51A-4.122(c)', 'H'),
    far: 1.5,
    farSource: `${S('51A-4.122(c)', 'D')}(ii)`,
    farSubCaps: [{ label: 'office uses', far: 0.5 }],
    density: 'none',
    densitySource: S('51A-4.122(c)', 'C'),
    uses: COMM_INST,
  }),
  CS: row({
    name: 'Commercial service district',
    height: 45,
    heightSource: `${S('51A-4.123(a)', 'E')}(ii)`,
    stories: 3,
    storiesSource: S('51A-4.123(a)', 'H'),
    far: 0.75,
    farSource: `${S('51A-4.123(a)', 'D')}(ii)`,
    farSubCaps: [
      { label: 'any combination of lodging, office, and retail and personal service uses', far: 0.5 },
    ],
    density: 'not-stated',
    densitySource: S('51A-4.123(a)', 'C'),
    uses: COMM_INST,
  }),
  LI: row({
    name: 'Light industrial district',
    height: 70,
    heightSource: `${S('51A-4.123(b)', 'E')}(ii)`,
    stories: 5,
    storiesSource: S('51A-4.123(b)', 'H'),
    far: 1.0,
    farSource: `${S('51A-4.123(b)', 'D')}(iii)`,
    farSubCaps: [
      { label: 'retail and personal service uses', far: 0.5 },
      { label: 'any combination of lodging, office, and retail and personal service uses', far: 0.75 },
    ],
    density: 'none',
    densitySource: S('51A-4.123(b)', 'C'),
    uses: COMM_ONLY,
  }),
  IR: row({
    name: 'Industrial/research district',
    height: 200,
    heightSource: `${S('51A-4.123(c)', 'E')}(ii)`,
    stories: 15,
    storiesSource: S('51A-4.123(c)', 'H'),
    far: 2.0,
    farSource: `${S('51A-4.123(c)', 'D')}(iii)`,
    farSubCaps: [
      { label: 'retail and personal service uses', far: 0.5 },
      { label: 'any combination of lodging, office, and retail and personal service uses', far: 0.75 },
    ],
    density: 'none',
    densitySource: S('51A-4.123(c)', 'C'),
    uses: COMM_ONLY,
  }),
  IM: row({
    name: 'Industrial/manufacturing district',
    height: 110,
    heightSource: `${S('51A-4.123(d)', 'E')}(ii)`,
    stories: 8,
    storiesSource: S('51A-4.123(d)', 'H'),
    far: 2.0,
    farSource: `${S('51A-4.123(d)', 'D')}(iii)`,
    farSubCaps: [
      { label: 'retail and personal service uses', far: 0.5 },
      { label: 'any combination of lodging, office, and retail and personal service uses', far: 0.75 },
    ],
    density: 'none',
    densitySource: S('51A-4.123(d)', 'C'),
    uses: COMM_ONLY,
  }),
  // ⚠️ FACT 3 lives here: "Maximum structure height is any legal height."
  'CA-1(A)': row({
    name: 'Central area district 1',
    height: 'none',
    heightSource: S('51A-4.124(a)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.124(a)', 'H'),
    far: 20.0,
    farSource: `${S('51A-4.124(a)', 'D')}(i)`,
    density: 'none',
    densitySource: S('51A-4.124(a)', 'C'),
    uses: FULL_MIX,
  }),
  'CA-2(A)': row({
    name: 'Central area district 2',
    height: 'none',
    heightSource: S('51A-4.124(b)', 'E'),
    stories: 'none',
    storiesSource: S('51A-4.124(b)', 'H'),
    far: 20.0,
    farSource: S('51A-4.124(b)', 'D'),
    density: 'none',
    densitySource: S('51A-4.124(b)', 'C'),
    uses: FULL_MIX,
  }),
  // ══ Mixed use · §51A-4.125 ════════════════════════════════════════════════
  // Headline = the "Base (no MUP)" column of each table. The MUP columns are
  // elected programs (FACT 5) and ride in `farAlternatives`.
  'MU-1': row({
    name: 'Mixed use district 1',
    height: 80,
    heightSource: `${S('51A-4.125(d)', 'E')}(ii)`,
    heightAlternatives: [
      {
        label: 'Mixed use project with no retail and personal service category',
        heightFt: 90,
        source: `${S('51A-4.125(d)', 'E')}(ii)`,
      },
      {
        label: 'Mixed use project including retail and personal service',
        heightFt: 120,
        source: `${S('51A-4.125(d)', 'E')}(ii)`,
      },
    ],
    // See FACT 2: slot (H) here states 7 stories at 90 ft and 9 at 120 ft, and
    // says nothing at the 80 ft base. Not "no maximum" — not stated.
    stories: 'not-stated',
    storiesSource: S('51A-4.125(d)', 'H'),
    far: 0.8,
    farSource: `${S('51A-4.125(d)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.4 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 0.9, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 1.0, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 1.0, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 1.1, source: S('51A-4.125(d)', 'D') },
    ],
    density: 15,
    densitySource: `${S('51A-4.125(d)', 'C')}(i), Base (no MUP)`,
    uses: FULL_MIX,
  }),
  'MU-1(SAH)': row({
    name: 'Mixed use district 1 affordable',
    height: 80,
    heightSource: `${S('51A-4.125(d)', 'E')}(ii)`,
    heightAlternatives: [
      {
        label: 'Mixed use project with no retail and personal service category',
        heightFt: 90,
        source: `${S('51A-4.125(d)', 'E')}(ii)`,
      },
      {
        label: 'Mixed use project including retail and personal service',
        heightFt: 120,
        source: `${S('51A-4.125(d)', 'E')}(ii)`,
      },
    ],
    stories: 'not-stated',
    storiesSource: S('51A-4.125(d)', 'H'),
    far: 0.8,
    farSource: `${S('51A-4.125(d)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.4 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 0.9, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 1.0, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 1.0, source: S('51A-4.125(d)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 1.1, source: S('51A-4.125(d)', 'D') },
    ],
    // 10 units per net acre at 0% SAH units and no MUP. The 15/20/25 rows are
    // earned with deed-restricted units and are never returned.
    density: 10,
    densitySource: `${S('51A-4.125(d)', 'C')}(ii), 0% SAH, Base (no MUP)`,
    uses: FULL_MIX,
  }),
  'MU-2': row({
    name: 'Mixed use district 2',
    height: 135,
    heightSource: `${S('51A-4.125(e)', 'E')}(ii)`,
    heightAlternatives: [
      {
        label: 'Mixed use project including retail and personal service',
        heightFt: 180,
        source: `${S('51A-4.125(e)', 'E')}(ii)`,
      },
    ],
    stories: 10,
    storiesSource: `${S('51A-4.125(e)', 'H')}(i)(aa)`,
    far: 1.6,
    farSource: `${S('51A-4.125(e)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.6 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 1.8, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 2.0, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 2.0, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 2.25, source: S('51A-4.125(e)', 'D') },
    ],
    density: 50,
    densitySource: `${S('51A-4.125(e)', 'C')}(i), Base (no MUP)`,
    uses: FULL_MIX,
  }),
  'MU-2(SAH)': row({
    name: 'Mixed use district 2 affordable',
    height: 135,
    heightSource: `${S('51A-4.125(e)', 'E')}(ii)`,
    heightAlternatives: [
      {
        label: 'Mixed use project including retail and personal service',
        heightFt: 180,
        source: `${S('51A-4.125(e)', 'E')}(ii)`,
      },
    ],
    stories: 10,
    storiesSource: `${S('51A-4.125(e)', 'H')}(i)(aa)`,
    far: 1.6,
    farSource: `${S('51A-4.125(e)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.6 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 1.8, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 2.0, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 2.0, source: S('51A-4.125(e)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 2.25, source: S('51A-4.125(e)', 'D') },
    ],
    density: 30,
    densitySource: `${S('51A-4.125(e)', 'C')}(ii), 0% SAH, Base (no MUP)`,
    uses: FULL_MIX,
  }),
  'MU-3': row({
    name: 'Mixed use district 3',
    height: 270,
    heightSource: `${S('51A-4.125(f)', 'E')}(ii)`,
    stories: 20,
    storiesSource: S('51A-4.125(f)', 'H'),
    far: 3.2,
    farSource: `${S('51A-4.125(f)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 2.0 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 3.6, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 4.0, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 4.0, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 4.5, source: S('51A-4.125(f)', 'D') },
    ],
    density: 'none',
    densitySource: `${S('51A-4.125(f)', 'C')}(i)`,
    uses: FULL_MIX,
  }),
  'MU-3(SAH)': row({
    name: 'Mixed use district 3 affordable',
    height: 270,
    heightSource: `${S('51A-4.125(f)', 'E')}(ii)`,
    stories: 20,
    storiesSource: S('51A-4.125(f)', 'H'),
    far: 3.2,
    farSource: `${S('51A-4.125(f)', 'D')} TOTAL DEVELOPMENT, Base (no MUP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 2.0 }],
    farAlternatives: [
      { label: 'Mixed use project, two categories, no residential', far: 3.6, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, residential plus one other category', far: 4.0, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, three or more categories, no residential', far: 4.0, source: S('51A-4.125(f)', 'D') },
      { label: 'Mixed use project, residential plus two or more others', far: 4.5, source: S('51A-4.125(f)', 'D') },
    ],
    density: 50,
    densitySource: `${S('51A-4.125(f)', 'C')}(ii), 0% SAH, Base (no MUP)`,
    uses: FULL_MIX,
  }),
  // ══ Multiple commercial · §51A-4.126 ══════════════════════════════════════
  // Same MCP mechanism as the MU districts, but the MC use-mix categories are
  // lodging / office / retail ONLY — residential is not one of them, and no
  // dwelling is a permitted main use (FACT 6).
  'MC-1': row({
    name: 'Multiple commercial district 1',
    height: 70,
    heightSource: `${S('51A-4.126(d)', 'E')}(ii)`,
    stories: 5,
    storiesSource: S('51A-4.126(d)', 'H'),
    far: 0.8,
    farSource: `${S('51A-4.126(d)', 'D')} TOTAL DEVELOPMENT, Base (No MCP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.3 }],
    farAlternatives: [
      { label: 'Multiple commercial project, two categories', far: 0.9, source: S('51A-4.126(d)', 'D') },
      { label: 'Multiple commercial project, three categories', far: 1.0, source: S('51A-4.126(d)', 'D') },
    ],
    density: 'not-stated',
    densitySource: S('51A-4.126(d)', 'C'),
    uses: COMM_INST,
  }),
  'MC-2': row({
    name: 'Multiple commercial district 2',
    height: 90,
    heightSource: `${S('51A-4.126(e)', 'E')}(ii)`,
    stories: 7,
    storiesSource: S('51A-4.126(e)', 'H'),
    far: 0.8,
    farSource: `${S('51A-4.126(e)', 'D')} TOTAL DEVELOPMENT, Base (No MCP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.5 }],
    farAlternatives: [
      { label: 'Multiple commercial project, two categories', far: 0.9, source: S('51A-4.126(e)', 'D') },
      { label: 'Multiple commercial project, three categories', far: 1.0, source: S('51A-4.126(e)', 'D') },
    ],
    density: 'not-stated',
    densitySource: S('51A-4.126(e)', 'C'),
    uses: COMM_INST,
  }),
  'MC-3': row({
    name: 'Multiple commercial district 3',
    height: 115,
    heightSource: `${S('51A-4.126(f)', 'E')}(ii)(aa)`,
    stories: 9,
    storiesSource: `${S('51A-4.126(f)', 'H')}(i)(aa)`,
    far: 1.2,
    farSource: `${S('51A-4.126(f)', 'D')} MC-3 TOTAL DEVELOPMENT, Base (No MCP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.6 }],
    farAlternatives: [
      { label: 'Multiple commercial project, two categories', far: 1.35, source: S('51A-4.126(f)', 'D') },
      { label: 'Multiple commercial project, three categories', far: 1.5, source: S('51A-4.126(f)', 'D') },
    ],
    density: 'not-stated',
    densitySource: S('51A-4.126(f)', 'C'),
    uses: COMM_INST,
  }),
  'MC-4': row({
    name: 'Multiple commercial district 4',
    height: 135,
    heightSource: `${S('51A-4.126(f)', 'E')}(ii)(bb)`,
    stories: 10,
    storiesSource: `${S('51A-4.126(f)', 'H')}(i)(bb)`,
    far: 1.6,
    farSource: `${S('51A-4.126(f)', 'D')} MC-4 TOTAL DEVELOPMENT, Base (No MCP)`,
    farSubCaps: [{ label: 'retail and personal service uses', far: 0.75 }],
    farAlternatives: [
      { label: 'Multiple commercial project, two categories', far: 1.8, source: S('51A-4.126(f)', 'D') },
      { label: 'Multiple commercial project, three categories', far: 2.0, source: S('51A-4.126(f)', 'D') },
    ],
    density: 'not-stated',
    densitySource: S('51A-4.126(f)', 'C'),
    uses: COMM_INST,
  }),

  // ══ Governed elsewhere in the code (FACT 7) ═══════════════════════════════
  PD: governed(
    'Planned development district',
    'plan',
    '§ 51A-4.702(a)(4) and (a)(5) — the establishing ordinance sets height, floor area, lot area, lot coverage, density and yards, codified in Chapter 51P',
  ),
  CD: governed(
    'Conservation district',
    'ordinance',
    '§ 51A-4.505(a)(4) — the conservation-district ordinance sets the standards for the particular district',
  ),
}

/** Every key this table resolves. Exported so a test can enumerate it rather
 *  than re-typing it. */
export const DALLAS_DISTRICT_CODES: readonly string[] = Object.freeze(Object.keys(DISTRICTS))

/** Collapse the whitespace the layer pads its string columns with (`PD_NUM` and
 *  `ZONE_DIST` arrive as `' '` on rows that have no value, and `COMMON_NAME`
 *  carries trailing spaces). Returns null for whitespace-only. */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/**
 * Labels the MAP uses that the CODE does not. §51A-4.101(1)(O) and (Q) name the
 * affordable multifamily districts `MF-1(SAH)` and `MF-2(SAH)`, and the section
 * headings at §51A-4.116(a) and (b) read "MF-1(A) and MF-1(SAH) districts". The
 * live Base Zoning layer writes them as `MF-1(A)(SAH)` and `MF-2(A)(SAH)` — 4
 * and 5 polygons, 143.1 acres between them, measured 2026-08-09.
 *
 * This is an ALIAS, not a guess: the map's string is a concatenation of the two
 * labels the same section heading joins, and both point at one dimensional
 * subsection. It is written here rather than as a second table row so the table
 * stays keyed on the code's own names — a duplicate row is where two figures
 * drift apart. The mixed-use `(SAH)` labels need no alias: the layer and
 * §51A-4.101(6) agree on `MU-1(SAH)`, `MU-2(SAH)`, `MU-3(SAH)`.
 */
const MAP_LABEL_ALIASES: Record<string, string> = {
  'MF-1(A)(SAH)': 'MF-1(SAH)',
  'MF-2(A)(SAH)': 'MF-2(SAH)',
}

/**
 * Reduce a mapped label to the key this table uses. `PD-269`, `PD 1135` and a
 * bare `PD` all key on `PD`; `CD-7` keys on `CD`. Everything else is used as-is
 * apart from the two map-label aliases above, so a Chapter 51 stray like
 * "GR Chap 51" — and its ZONE_DIST "GR" — misses the table and stays a gap,
 * which is the correct answer for a Chapter 51A lookup.
 */
export function dallasZoneKey(code: string | null | undefined): string | null {
  const s = clean(code)
  if (!s) return null
  if (/^PD([-\s]|$)/i.test(s)) return 'PD'
  if (/^CD([-\s]|$)/i.test(s)) return 'CD'
  return MAP_LABEL_ALIASES[s] ?? s
}

/**
 * Resolve a Dallas district from BOTH zoning fields (FACT 8).
 *
 * `longCode` is the layer's `LONG_ZONE_DIST` (the mapped label) and `zoneDist`
 * its `ZONE_DIST` (the family). The long label is tried first because it is the
 * more specific of the two; the family is the fallback, and it is not
 * decorative — one live polygon carries the typo `MU=1` in LONG_ZONE_DIST and
 * the correct `MU-1` in ZONE_DIST, and reads as a gap without it.
 *
 * Returns UNRESOLVED_DALLAS for anything not in the table. That value asserts
 * nothing: no height, no FAR, and specifically NOT `farUnconstrained`, so a
 * district nobody has read can never render as "the code imposes no FAR here".
 */
export function resolveDallas(
  longCode: string | null | undefined,
  zoneDist?: string | null | undefined,
): DallasLimits {
  for (const candidate of [longCode, zoneDist]) {
    const key = dallasZoneKey(candidate)
    if (key && Object.prototype.hasOwnProperty.call(DISTRICTS, key)) return DISTRICTS[key]
  }
  return UNRESOLVED_DALLAS
}

/**
 * The permitted-use vocabulary for a district, read from its own "(I)
 * Residential uses" list (FACT 6) rather than from its name.
 *
 * Returns null where nothing was read — including for PD and CD, whose
 * permitted uses come from the establishing ordinance ("The uses permitted in a
 * PD must be listed in the ordinance establishing the district", § 51A-4.702(a)(2)).
 */
export function usesForZone(
  longCode: string | null | undefined,
  zoneDist?: string | null | undefined,
): string[] | null {
  const limits = resolveDallas(longCode, zoneDist)
  return limits.uses ? [...limits.uses] : null
}

/**
 * The narrowest FAR that binds a given program, or null when the district's own
 * ceiling is the only figure. Exported so a caller can ask the question rather
 * than re-deriving it from `farSubCaps`.
 */
export function narrowestFarSubCap(limits: DallasLimits): DallasFarSubCap | null {
  if (!limits.farSubCaps || limits.farSubCaps.length === 0) return null
  return limits.farSubCaps.reduce((a, b) => (b.far < a.far ? b : a))
}
