// Phoenix curated district table — City of Phoenix ZONING ORDINANCE
// (a separate instrument from the Phoenix City Code).
//
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE AND PROVENANCE. Read 2026-08-09.
//
// The City does not self-host the ordinance text. Its electronic code of record
// is published by General Code at phoenix.municipal.codes, and every figure
// below was transcribed from that publisher's own section pages, reached from
// the ordinance's own table of contents rather than guessed paths (rule 8):
//
//   index — https://phoenix.municipal.codes/ZO/contents
//   text  — one page per section, e.g.
//           https://phoenix.municipal.codes/ZO/613   (R1-6)
//           https://phoenix.municipal.codes/ZO/626   (Commerce Park)
//   amendment history — https://phoenix.municipal.codes/ZO/OT
//
// ⚠️ HOW IT WAS READ, because it bears on what is checkable. The host sits
// behind a Cloudflare bot challenge that returns HTTP 403 to curl and to any
// plain fetch, so the pages were opened in a real browser and their rendered
// text read. Two consequences, stated rather than buried: (a) the citation
// checker cannot fetch these URLs, so this file will report UNCHECKED; (b) a
// first bulk read silently returned the challenge page for 30 of 48 sections
// with a plausible-looking zero "floor area ratio" count on every one of them.
// That was caught only because all 30 came back at *byte-identical length*
// (3,685 chars) — the instrument describing itself, CLAUDE.md rule 11. Every
// count in this header was recomputed against the re-fetched real text.
//
// CURRENCY, from the ordinance's own amendment table (/ZO/OT), last two rows:
//   · Ord. No. G-7446 (Z-TA-1-25-Y, "middle housing") — adopted 11-19-25,
//     effective 12-19-25 — amended §§202, 608, 609.B, 610.B, 611.B, 612.B,
//     613.B, 614, 615, 616, 617, 618, 619, 622, 623, 624, 632, 701.A.3, 702,
//     703.B, 710, 1203, 1205.A, 1303.A, 1306, 1307.B. That is nearly every
//     section this table draws on, so the text read is post-amendment; §613's
//     own history line ends "Ord. No. G-7446, § 8, 2025", which is how that was
//     confirmed rather than assumed.
//   · Ord. No. G-7461 (Z-TA-8-25-Y) — adopted 12-3-25, effective 1-2-26 —
//     amended §1203 (Downtown Code land use matrix), a chapter this table does
//     not curate.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — PHOENIX STATES HEIGHT AS STORIES **AND** FEET, IN ONE CELL, AND THE
// TWO ARE INDEPENDENT LIMITS. Table 613.1 row (10), verbatim: "Building height
// (maximum) | 2 stories and 30 feet | 3 stories and 30 feet". Both bind; the
// conjunction is the code's own.
//
// The document therefore carries its own disproof of a feet-per-storey constant,
// and more sharply than Raleigh's did — R1-6 prints the SAME 30 feet against
// TWO different storey counts:
//
//     district  option     stated          implied ft/storey
//     R1-6      standard   2 st & 30 ft    15.00
//     R1-6      PRD        3 st & 30 ft    10.00
//     R-4       standard   3 st & 40 ft    13.33
//     R-3A      PRD (max)  4 st & 48 ft    12.00
//
// No constant reproduces those, and no constant could: two rows of the same
// district disagree at identical feet. This module has NO feet-per-storey
// constant and NO constructor that accepts one of the pair alone — `storeyed()`
// takes feet and storeys together, each explicitly, or null where the code
// prints nothing. A test pins the disproof (CLAUDE.md rules 12 and 14).
//
// Where the code prints ONLY feet it is carried as only feet. §619.B.6 (R-4A):
// "No building shall exceed a height of 48 feet." — no storey count, so
// `stories: null`, next to R-5's "4 stories and 48 feet" at the same 48 feet.
// The pair is deliberate: it is the same height with and without a storey cap,
// and it is what makes a later "just divide by twelve" impossible to defend.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — FLOOR AREA RATIO IS NOT THE INSTRUMENT IN THESE DISTRICTS, AND THAT
// IS AN ANSWER (rule 5), ESTABLISHED BY THE SLOT TEST.
//
// Two independent readings, and the second is what makes the first evidence:
//
//   (a) STRUCTURE. Every table-form district has the same fourteen numbered
//       categories — (1) lot width, (2) lot depth, (3) development density,
//       (4) subdivided lots, (5) individual lot setbacks, (6) garage entry
//       setback, (7) projections, (8) development perimeter setback,
//       (9) perimeter street landscape setback, (10) building height,
//       (11) lot coverage, (12) common open space, (13) street frontage,
//       (14) other applicable regulations. There is NO floor-area-ratio row.
//       The list-form districts (§§603–607, 619–624) enumerate lot area, width,
//       depth, setbacks, lot coverage and height and stop. Floor area is
//       governed by height, lot coverage, setbacks and DENSITY.
//
//   (b) THE ORDINANCE USES FAR WHERE IT MEANS TO. §202 defines it — "Floor Area
//       Ratio (FAR): The ratio of the gross floor area of the building to net
//       site area" — and §626.H.1's Commerce Park table carries an explicit
//       "FAR" ROW (0.5 Single User / 1.0 Research Park). So the instrument
//       exists, is defined, and is printed as a table row in the one chapter
//       that uses it. Its absence elsewhere is a drafting choice, not a gap in
//       our reading.
//
// Full-text scan of every section read (§§603–642, 649, 657, 671, 701, 1207,
// 1209, 1303): "floor area ratio" / "FAR" occurs in exactly four places —
// §202 (the definition), §626.H.1 (the Commerce Park table), §636.D (a City
// Council power to condition a Planned Community rezoning on "maximum intensity
// (ex. maximum F.A.R.)"), and §657.C.6 (an FH flood-hazard TRANSFER: "non-
// residential intensity at a floor area ratio of 0.1 on the portion covered by
// this district may be transferred to the adjoining non-residential district").
// None of the four is a district cap on the districts marked unconstrained.
//
// ⚠️ AND THE MODULE REFUSES THE CLAIM WHERE THE SLOT EXISTS. CP/BP and CP/GCP —
// the two Commerce Park options that are actually mapped — sit in that same
// §626.H.1 table with an EM DASH in the FAR row. An em dash in a cell whose
// neighbours hold numbers is not a stated absence; it is a blank, and this
// repo's own rule is that a blank cell is not the slot test. So both carry
// `farUnconstrained: false` and `maxFAR: null`, and a test pins it. The
// distinction between "the table has no FAR row" and "the FAR row is empty" is
// the whole content of rule 5 here.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — THE STANDARD OPTION IS THE HEADLINE; PRD IS A PROGRAM (rule 6).
// Every residential table has two columns: "(A) Standard Option" and
// "(B) Planned Residential Development (PRD)". PRD is elected, and it buys its
// extra storey with common open space (row (12): "None" vs "5% of gross area"),
// perimeter setbacks and design review. Publishing the larger figure would
// assume a programme the user has not chosen — the Austin 0.40/0.65 defect. The
// PRD column therefore rides in `heightAlternatives` and never in `height`.
//
// The same call is made on three other alternative limbs, and for the same
// reason each time:
//   · C-1/C-2/C-3 §§622–624.E.3 allow 4 storeys / 56 ft, but ONLY for structures
//     in a General-Plan "core area", abutting Central Avenue between Camelback
//     and Harrison, or under a pre-1988 stipulated site plan. Which of those a
//     parcel satisfies is a location question this tool has not measured, so the
//     limb is disclosed and never resolved.
//   · §638.C.c lets a "major regional retail shopping building" exceed 56 ft up
//     to 4 storeys / 70 ft with graduated setbacks.
//   · A-1 §627 and A-2 §628 allow 80 ft "with use permit with a specific plan of
//     development" and 110 ft for a warehouse by Council action. Those are
//     DISCRETIONARY approvals, not alternatives an applicant may simply elect,
//     and they are not published at all — the same call Raleigh made on the R-1
//     treatment-plant figure. The identical exclusion applies to every
//     "Request to exceed the above height limits may be granted by the City
//     Council…" sentence in §§622–624, §641 and §649.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — C-O IS TWO REGIMES AND THE DATA CANNOT SAY WHICH. §621.B governs
// "property zoned C-O pursuant to an application filed PRIOR TO January 8,
// 1986" (56 ft, 50% coverage); §621.C governs applications filed after, and
// splits again into a General Office and a Major Office option (25 ft / 40%,
// and a 25 ft plane rising to 4 storeys / 56 ft / 50%). The zoning layer maps
// 'C-O/G-O' and 'C-O/M-O' separately — those two resolve — but bare 'C-O' on
// 966 acres does not say which regime applies, and the deciding fact (the date
// the rezoning application was filed) is in no dataset.
//
// So bare C-O carries `height: null` with `heightConditional` populated. That is
// deliberately NOT the same state as an unread district: the limit is known, it
// is simply conditional on a fact we do not have. Publishing 56 ft would assume
// the most permissive regime; publishing 25 ft would impose a limit the code may
// not impose. Rule 1: an unmeasured discriminator earns no direction at all.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — THE ASSESSOR'S `CITY_ZONING` IS NOT THIS ORDINANCE'S ZONING, AND
// USING IT WOULD BE THE MIAMI `FLR` MISTAKE. The Maricopa County supplemental
// table publishes a `CITY_ZONING` column that looks authoritative. Measured
// 2026-08-09 over 60 Phoenix parcels sampled by APN, point-queried against the
// City's own Zoning layer: 56 agreed and 4 did not, and the disagreements are
// not near-misses — 'C-3' vs S-1, 'CP/GCP' vs S-1, 'R1-8' vs R-2. The same
// column also carries OTHER cities' vocabularies ('S-R' on a Scottsdale
// parcel), so a resolver fed `CITY_ZONING` would happily apply Phoenix limits to
// a Scottsdale district code. The provider reads the City's zoning polygon and
// nothing else; a test pins that `CITY_ZONING` never reaches the output.
//
// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE, measured 2026-08-09 by running THIS module's exported
// `resolvePhoenix` over every ZONING value the live layer serves — the entry
// point, not the table literal (rule 11):
//
//     distinct ZONING values ..... 75    over 9,649 polygons / 359,403 acres
//     curated .................... 36    321,416 ac = 89.43%
//     plan-governed .............. 16    27,437 ac =  7.63%  (PUD, PCD, PAD-2…15)
//     county island ..............  1     1,853 ac =  0.52%  (ZONING = 'COUNTY')
//     unresolved ................. 22     8,697 ac =  2.42%
//
// The 22 unresolved are: the 17 Downtown Code districts (DTC-*, 1,249 ac) and WU
// (364 ac, Chapter 13 Walkable Urban) —
//
// ⚠️ RE-TESTED 2026-08-17, AND THE REASON RECORDED HERE WAS WRONG TWICE OVER.
// It said Chapter 12's per-frontage tables "run together when flattened to
// text", which is the DC MU-column shape. Both halves fail:
//
//   1. THE EXTRACTION CLAIM IS DEAD. phoenix.municipal.codes serves real HTML
//      tables. § 1209's frontage table is 50 rows x 7 addressable columns
//      (Street Section | Minimum Setback | Frontage Zone Depth | Minimum
//      Building Frontage | Allowed Frontage Elements | Minimum Sidewalk Width |
//      Minimum Streetscape Zone Depth). Cell-by-cell reading is available and is
//      stronger than any text flattening. That claim was about a TOOL, was true
//      when written, and expired silently.
//
//   2. THE TABLE WAS NEVER WHERE THE HEIGHT LIVES. It states setbacks and
//      streetscape. § 1209 and § 1217 both read "Maximum height: … governed by
//      the height map, Section 1202.B, and height transition standards of
//      Section 1207.E", and § 1217 adds "Maximum density: governed by the
//      density map, Section 1202.C". Confirmed on two districts rather than one.
//
// So DTC is MAP-KEYED, the same class as Denver's Exhibit 8.1 height areas and
// San Diego's Centre City Figure H: the limit is real, published, and a function
// of WHERE the parcel is rather than of its zone code. Not uncurated, and not
// plan-governed — a layer would resolve it.
//
// Phoenix does not publish one. All 178 services on maps.phoenix.gov were
// listed; the only match is Public/WalkableUrbanCode, whose single layer carries
// APPLICABILITY_AREAS — whether the WU code applies, not what height it sets.
//
// ⚠️ AND THE SECTIONS DO STATE FIGURES, WHICH IS THE TRAP. § 1217 gives
// "Accessory structures, including accessory dwelling units: 30 feet" and
// "Maximum lot coverage: 75 percent". Publishing the 30 as this district's
// height would answer a different question than the one asked, in the direction
// that flatters — the main building is the map's business.
// IND.PK. (6,553 ac) and GCP (6 ac), which have NO section in the
// ordinance's table of contents at all and are therefore not guessable; PSCOD
// (45 ac, the §659 Planned Shopping Center OVERLAY, not a base district); and 3
// polygons with an empty ZONING string (480 ac).
//
// Every one of them resolves to UNRESOLVED, which asserts nothing — no height,
// no FAR, and specifically NOT `farUnconstrained`. An unread district must never
// render as one whose code affirmatively imposes no limit.

/** A height limit exactly as the ordinance prints it.
 *
 *  Both members are stated independently and NEITHER is ever derived from the
 *  other (FACT 1). `null` means the code prints nothing in that unit — it does
 *  NOT mean "convert from the other one". */
export interface PhoenixHeight {
  /** Maximum height in feet, where the code states feet. */
  ft: number | null
  /** Maximum height in storeys, where the code states storeys. */
  stories: number | null
  source: string
}

/** A limb of the code that yields a different height under a programme the
 *  applicant elects, or in a location we have not measured. Never the headline
 *  (FACT 3). */
export interface PhoenixHeightAlternative {
  label: string
  ft: number | null
  stories: number | null
  source: string
}

/** The C-O case (FACT 4): the ordinance states a height, but which one applies
 *  turns on a fact absent from every dataset. Distinct from both an answer and
 *  a gap. */
export interface PhoenixHeightConditional {
  /** What decides between the limbs, in the code's own terms. */
  discriminator: string
  limbs: PhoenixHeightAlternative[]
}

export interface PhoenixLimits {
  /** The ordinance's own name for the district; null when unresolved. */
  name: string | null
  /** The by-right ceiling under the district's STANDARD option. Null means one
   *  of three different things, disambiguated by the two fields below:
   *    heightConditional != null → stated, but conditional (FACT 4)
   *    noPrincipalBuilding       → the district permits no principal building
   *    all absent                → we did not resolve it (a GAP) */
  height: PhoenixHeight | null
  /** Elected programmes and location-conditional limbs. Disclosure only. */
  heightAlternatives: PhoenixHeightAlternative[] | null
  /** Height stated by the code but conditional on a fact not in any dataset. */
  heightConditional: PhoenixHeightConditional | null
  /** Maximum lot coverage, percent of net lot area, standard option. */
  maxLotCoveragePct: number | null
  /** TRUE only where the ordinance affirmatively states no coverage maximum
   *  (UR §642.G). False everywhere else, including everywhere unresolved. */
  lotCoverageUnconstrained: boolean
  lotCoverageSource: string | null
  /** Maximum dwelling units per GROSS acre, where the code tabulates density. */
  maxUnitsPerGrossAcre: number | null
  /** Minimum lot area per dwelling unit in square feet, where the code states
   *  density that way instead (R-4A §619.B.1). */
  minLotAreaPerUnitSqFt: number | null
  densitySource: string | null
  /** Floor area ratio, where the ordinance states one. Null everywhere in
   *  Phoenix's mapped districts — see FACT 2 and the em-dash note. */
  maxFAR: number | null
  farSource: string | null
  /** TRUE only where the district's own standards enumeration has NO
   *  floor-area-ratio item at all (FACT 2a). Explicitly FALSE on CP/BP and
   *  CP/GCP, where the slot exists and holds an em dash, and FALSE on every
   *  unresolved code. */
  farUnconstrained: boolean
  /** An approved plan or council ordinance sets the standards, not a district
   *  table (PUD §671, PC §636, PAD §635). Not an absence — a value we cannot
   *  read. */
  planGoverned: boolean
  /** The polygon is a county island: Maricopa County zoning governs and the
   *  Phoenix ordinance does not apply. Also not an absence. */
  countyJurisdiction: boolean
  /** The district permits no principal habitable building (P-1 §639). */
  noPrincipalBuilding: boolean
  /** Development is restricted for reasons other than a dimensional cap
   *  (FH §657). Carries the sentence; asserts no numbers. */
  restrictedNote: string | null
  /** Section(s) transcribed from. Empty only on UNRESOLVED. */
  source: string
}

// ── Constructors ─────────────────────────────────────────────────────────────
// Rule 14: make the caught error an impossible state rather than a comment.
//
// There is DELIBERATELY no constructor that takes feet alone, none that takes
// storeys alone, and no feet-per-storey constant anywhere in this file.
// `storeyed()` requires BOTH members explicitly — pass `null` for the one the
// code does not print. Reintroducing the Miami-21 round trip would mean writing
// a new constructor, which is a visible, reviewable act rather than an edit to
// a table row.

const storeyed = (ft: number | null, stories: number | null, source: string): PhoenixHeight => ({
  ft,
  stories,
  source,
})

const alt = (
  label: string,
  ft: number | null,
  stories: number | null,
  source: string,
): PhoenixHeightAlternative => ({ label, ft, stories, source })

const base = (name: string, source: string): PhoenixLimits => ({
  name,
  height: null,
  heightAlternatives: null,
  heightConditional: null,
  maxLotCoveragePct: null,
  lotCoverageUnconstrained: false,
  lotCoverageSource: null,
  maxUnitsPerGrossAcre: null,
  minLotAreaPerUnitSqFt: null,
  densitySource: null,
  maxFAR: null,
  farSource: null,
  farUnconstrained: false,
  planGoverned: false,
  countyJurisdiction: false,
  noPrincipalBuilding: false,
  restrictedNote: null,
  source,
})

/** The eleven table-form residential districts (§§609–618) share one shape:
 *  Table N.1 row (10) height, row (11) lot coverage, row (3) development
 *  density in PDU per GROSS acre, column (A) standard and column (B) PRD.
 *  Built through one helper so a row cannot silently lose its PRD limb or its
 *  density — every argument is required. */
function tableDistrict(args: {
  name: string
  section: string
  table: string
  ft: number
  stories: number
  prdLabel: string
  prdFt: number
  prdStories: number
  prdNote?: string
  coveragePct: number
  coverageText: string
  densityPerAcre: number
}): PhoenixLimits {
  const heightSrc = `§${args.section} ${args.table} row (10) Building height (maximum), column (A) Standard Option: "${args.stories} stories and ${args.ft} feet"`
  return {
    ...base(
      args.name,
      `Phoenix Zoning Ordinance §${args.section}, ${args.table}: row (3) density ${args.densityPerAcre} PDU/AC gross; row (10) height ${args.stories} stories and ${args.ft} feet; row (11) lot coverage ${args.coverageText}`,
    ),
    height: storeyed(args.ft, args.stories, heightSrc),
    heightAlternatives: [
      alt(
        args.prdLabel,
        args.prdFt,
        args.prdStories,
        `§${args.section} ${args.table} row (10), column (B) Planned Residential Development${args.prdNote ? ` — ${args.prdNote}` : ''}`,
      ),
    ],
    maxLotCoveragePct: args.coveragePct,
    lotCoverageSource: `§${args.section} ${args.table} row (11) Lot coverage (maximum): "${args.coverageText}"`,
    maxUnitsPerGrossAcre: args.densityPerAcre,
    densitySource: `§${args.section} ${args.table} row (3) Development density (maximum): "${args.densityPerAcre} PDU/AC (gross)"`,
    farUnconstrained: true,
  }
}

/** The five list-form suburban/estate districts (§§603–607), whose standards are
 *  a lettered "Yard, height and area requirements" list rather than a table. */
function listDistrict(args: {
  name: string
  section: string
  heightItem: string
  heightQuote: string
  ft: number
  stories: number
  coveragePct: number
  coverageItem: string
  coverageText: string
}): PhoenixLimits {
  return {
    ...base(
      args.name,
      `Phoenix Zoning Ordinance §${args.section}: ${args.heightItem} height (${args.stories} stories / ${args.ft} ft); ${args.coverageItem} lot coverage ${args.coverageText}`,
    ),
    height: storeyed(args.ft, args.stories, `${args.heightItem} ("${args.heightQuote}")`),
    maxLotCoveragePct: args.coveragePct,
    lotCoverageSource: `${args.coverageItem}: ${args.coverageText}`,
    farUnconstrained: true,
  }
}

// The PRD footnote that R-2, R-3, R-3A and R-4 all carry on row (10). Quoted
// once and shared because it is the same sentence in all four tables.
const PRD_PERIMETER =
  'the column reads "3 stories and 30 feet for first 150 feet from development perimeter; one foot height increase for each five feet in setback increase to maximum 4 stories and 48 feet high", with a footnote capping height at 15 feet within ten feet of a single-family zoned district'

// ── The table ────────────────────────────────────────────────────────────────

const DISTRICTS: Record<string, PhoenixLimits> = {
  // ── Suburban and estate, list form (§§603–607) ──────────────────────────
  'S-1': {
    ...listDistrict({
      name: 'S-1 Suburban — Ranch or Farm Residence',
      section: '603',
      heightItem: '§603.B.5',
      heightQuote: 'No building shall exceed a height of two stories, not to exceed 30 feet.',
      ft: 30,
      stories: 2,
      // §603.B.4 is lot-size conditional: 20% at or under two acres, 10% above.
      // The lower figure is NOT published as the headline, because it applies
      // only to the larger lots; the conditional is stated in `lotCoverageSource`
      // in full so neither limb is presented as unconditional.
      coveragePct: 20,
      coverageItem: '§603.B.4',
      coverageText:
        '20% for lots two acres or less in net area and 10% for lots greater than two acres, in both cases "with an additional five percent permitted for accessory dwelling units and/or attached shade structures"',
    }),
  },
  'S-2': listDistrict({
    name: 'S-2 Suburban — Ranch or Farm Commercial',
    section: '604',
    heightItem: '§604.B.5',
    heightQuote: 'No building shall exceed a height of two stories, not to exceed 30 feet.',
    ft: 30,
    stories: 2,
    coveragePct: 10,
    coverageItem: '§604.B.4',
    coverageText:
      '"The permitted lot coverage is ten percent, with an additional five percent permitted for accessory dwelling units and/or attached shade structures."',
  }),
  'RE-43': listDistrict({
    name: 'RE-43 Residential Estate — One-Family Residence',
    section: '605',
    heightItem: '§605.B.6',
    heightQuote:
      'No building shall exceed the height of two stories, not to exceed 30 feet, and no dwelling shall be erected to a height of less than one story.',
    ft: 30,
    stories: 2,
    coveragePct: 20,
    coverageItem: '§605.B.5',
    coverageText:
      '"not … more than 20 percent of the net lot area, except if all structures are less than 20 feet and one story in height then a maximum of 40 percent lot coverage is allowed"',
  }),
  'RE-24': listDistrict({
    name: 'RE-24 Residential Estate — One-Family Residence',
    section: '606',
    heightItem: '§606.B.6',
    heightQuote:
      'No building shall exceed the height of two stories, not to exceed 30 feet, and no dwelling structure shall be erected to a height of less than one story.',
    ft: 30,
    stories: 2,
    coveragePct: 25,
    coverageItem: '§606.B.5',
    coverageText:
      '"not … more than 25 percent of the net lot area, except if all structures are less than 20 feet and one story in height then a maximum of 40 percent lot coverage is allowed"',
  }),
  'R1-14': listDistrict({
    name: 'R1-14 Residential — One-Family Residence',
    section: '607',
    heightItem: '§607.B.6',
    heightQuote:
      'No building shall exceed the height of two stories, not to exceed 30 feet, and no dwelling structure shall be erected to a height of less than one story.',
    ft: 30,
    stories: 2,
    coveragePct: 25,
    coverageItem: '§607.B.5',
    coverageText:
      '"not … more than 25 percent of the net lot area, except if all structures are less than 20 feet and one story in height then a maximum of 40 percent lot coverage is allowed"',
  }),

  // ── Table-form residential (§§609–618) ──────────────────────────────────
  'RE-35': tableDistrict({
    name: 'RE-35 Single-Family Residence District',
    section: '609',
    table: 'Table 609.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 30,
    prdStories: 2,
    coveragePct: 25,
    coverageText:
      '25%, except if all structures are less than 20 feet and 1 story in height then a maximum of 40% lot coverage is allowed',
    densityPerAcre: 1.2,
  }),
  'R1-18': tableDistrict({
    name: 'R1-18 Single-Family Residence District',
    section: '610',
    table: 'Table 610.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 30,
    prdStories: 2,
    coveragePct: 30,
    coverageText: '30%, plus an additional 10% for an ADU and/or attached shade structures — Total: 40%',
    densityPerAcre: 2.0,
  }),
  'R1-10': tableDistrict({
    name: 'R1-10 Single-Family Residence District',
    section: '611',
    table: 'Table 611.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 30,
    prdStories: 3,
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 3.5,
  }),
  'R1-8': tableDistrict({
    name: 'R1-8 Single-Family Residence District',
    section: '612',
    table: 'Table 612.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 30,
    prdStories: 3,
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 4.5,
  }),
  'R1-6': tableDistrict({
    name: 'R1-6 Single-Family Residence District',
    section: '613',
    table: 'Table 613.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 30,
    prdStories: 3,
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 5.5,
  }),
  'R-2': tableDistrict({
    name: 'R-2 Multi-Family Residence District',
    section: '614',
    table: 'Table 614.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 48,
    prdStories: 4,
    prdNote: PRD_PERIMETER,
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 10.0,
  }),
  'R-3': tableDistrict({
    name: 'R-3 Multi-Family Residence District',
    section: '615',
    table: 'Table 615.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 48,
    prdStories: 4,
    prdNote: PRD_PERIMETER,
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 14.5,
  }),
  'R-3A': tableDistrict({
    name: 'R-3A Multi-Family Residence District',
    section: '616',
    table: 'Table 616.1',
    ft: 30,
    stories: 2,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 48,
    prdStories: 4,
    // R-3A's PRD first limb is 3 stories and FORTY feet, not thirty — the one
    // place the four multi-family PRD footnotes differ. Quoted rather than
    // folded into PRD_PERIMETER, because a shared constant that is wrong for one
    // of its users is how a plausible number gets published.
    prdNote:
      'the column reads "3 stories and 40 feet for first 150 feet from development perimeter; One foot height increase for each five feet in setback increase to maximum 4 stories and 48 feet high"',
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 22.0,
  }),
  'R-4': tableDistrict({
    name: 'R-4 Multi-Family Residence District',
    section: '617',
    table: 'Table 617.1',
    ft: 40,
    stories: 3,
    prdLabel: 'Planned Residential Development (PRD)',
    prdFt: 48,
    prdStories: 4,
    prdNote:
      'the column reads "3 stories and 40 feet for first 150 feet from development perimeter; One foot height increase for each five feet in setback increase to maximum 4 stories and 48 feet high"',
    coveragePct: 50,
    coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
    densityPerAcre: 29.0,
  }),
  'R-5': {
    ...tableDistrict({
      name: 'R-5 Multi-Family Residence District — Restricted Commercial',
      section: '618',
      table: 'Table 618.1',
      ft: 48,
      stories: 4,
      prdLabel: 'Planned Residential Development (PRD)',
      prdFt: 48,
      prdStories: 4,
      coveragePct: 50,
      coverageText: '50%, plus an additional 10% for an ADU and/or attached shade structures — Total: 60%',
      densityPerAcre: 43.5,
    }),
    // §618.C, verbatim: "Development regulations for nonresidential and mixed
    // uses shall be in accordance with C-1 standards (Sections 622.E.3 and
    // E.4)." Recorded in `source` rather than as a second height, because
    // C-1's own standard limb is 2 storeys / 30 ft — LOWER than R-5's 4/48 —
    // and publishing the larger for a mixed-use programme would be the rule-6
    // collapse in the direction that overstates.
    source:
      'Phoenix Zoning Ordinance §618, Table 618.1: row (3) density 43.5 PDU/AC gross; row (10) height 4 stories and 48 feet; row (11) lot coverage 50% + 10%. §618.C sends nonresidential and mixed uses to C-1 standards (§§622.E.3 and E.4), whose standard limb is the LOWER 2 stories / 30 feet',
  },

  // ── R-4A, the one residential district stated in feet alone ─────────────
  // §619.B.6, verbatim: "No building shall exceed a height of 48 feet." No
  // storey count anywhere in the section. Sits deliberately beside R-5's
  // "4 stories and 48 feet": same feet, and the code caps storeys in one and
  // not the other. `stories: null` here is the code's silence, not ours.
  'R-4A': {
    ...base(
      'R-4A Residential — Multi-Family Residence, General',
      'Phoenix Zoning Ordinance §619.B: .1 density (1,000 sq ft of lot area per dwelling unit); .5 lot coverage 50%; .6 height 48 feet (no storey cap stated)',
    ),
    height: storeyed(48, null, '§619.B.6 ("No building shall exceed a height of 48 feet.")'),
    maxLotCoveragePct: 50,
    lotCoverageSource:
      '§619.B.5 ("The main building and all accessory buildings on a lot shall not occupy more than 50 percent of the total area of the lot.")',
    minLotAreaPerUnitSqFt: 1000,
    densitySource:
      '§619.B.1 ("There shall be a lot area of not less than 1,000 square feet for each dwelling unit, 500 square feet for each efficiency apartment or rooming unit, and 250 square feet for each guestroom.")',
    farUnconstrained: true,
  },

  // ── Office and commercial (§§620–624) ───────────────────────────────────
  'R-O': {
    ...base(
      'R-O Residential Office District — Restricted Commercial',
      'Phoenix Zoning Ordinance §620.C: .6 lot coverage 30%; .7 height (15 ft at the minimum rear and side yard setbacks, rising with setback to a maximum of 25 ft)',
    ),
    height: storeyed(
      25,
      null,
      '§620.C.7 ("Building height is limited to fifteen feet at the minimum rear and side yard setbacks… Such height may be increased with additional setback by providing one-foot additional setback for each one foot in height to a maximum building height of twenty-five feet.")',
    ),
    maxLotCoveragePct: 30,
    lotCoverageSource:
      '§620.C.6 ("Lot coverage exclusive of carports shall not exceed thirty percent of the net lot area.")',
    farUnconstrained: true,
  },

  // FACT 4: bare C-O cannot be resolved, and says so.
  'C-O': {
    ...base(
      'C-O Commercial Office District — Restricted Commercial',
      'Phoenix Zoning Ordinance §621.B (applications filed before 1986-01-08) and §621.C (after) state DIFFERENT heights; the filing date is in no dataset',
    ),
    heightConditional: {
      discriminator:
        'the date the rezoning application was filed (before or after January 8, 1986) and, after that date, whether the site is a General Office or a Major Office development — §621.B vs §621.C',
      limbs: [
        alt(
          'Application filed before January 8, 1986',
          56,
          null,
          '§621.B.2.f(1) ("No building shall exceed a height of fifty-six feet."); lot coverage §621.B.2.e (50%)',
        ),
        alt(
          'General Office (G-O) option, application filed after January 8, 1986',
          25,
          null,
          '§621.C.3.a(7) ("Building height is limited to twenty-five feet."); lot coverage §621.C.3.a(6) (40% exclusive of carports)',
        ),
        alt(
          'Major Office (M-O) option, application filed after January 8, 1986',
          56,
          4,
          '§621.C.3.b(7) (25 ft at the minimum rear and side yard setbacks within 75 ft of a single-family residential district, rising three feet of setback per foot of height "to a maximum building height of four stories not to exceed fifty-six feet"); lot coverage §621.C.3.b(6) (50%)',
        ),
      ],
    },
    farUnconstrained: true,
  },
  'C-O/G-O': {
    ...base(
      'C-O Commercial Office District — General Office (G-O) option',
      'Phoenix Zoning Ordinance §621.C.3.a: (6) lot coverage 40%; (7) height 25 feet',
    ),
    height: storeyed(25, null, '§621.C.3.a(7) ("Building height is limited to twenty-five feet.")'),
    maxLotCoveragePct: 40,
    lotCoverageSource:
      '§621.C.3.a(6) ("Lot coverage exclusive of carports shall not exceed forty percent of the net lot area.")',
    farUnconstrained: true,
  },
  'C-O/M-O': {
    ...base(
      'C-O Commercial Office District — Major Office (M-O) option',
      'Phoenix Zoning Ordinance §621.C.3.b: (6) lot coverage 50%; (7) height, maximum four stories not to exceed 56 feet',
    ),
    height: storeyed(
      56,
      4,
      '§621.C.3.b(7) ("…to a maximum building height of four stories not to exceed fifty-six feet. A maximum building height of four stories not to exceed fifty-six feet is permitted adjacent to all other zoning districts."). Within 75 feet of a single-family residential district the limit is 25 feet at the minimum rear and side yard setbacks, rising three feet of setback per foot of height.',
    ),
    maxLotCoveragePct: 50,
    lotCoverageSource: '§621.C.3.b(6) ("Lot coverage shall not exceed fifty percent of the net lot areas.")',
    farUnconstrained: true,
  },

  // C-1, C-2 and C-3 print the SAME standard limb, the same coverage sentence
  // and the same core-area limb; only the permitted-use lists differ between
  // them. Each is written out with its own section numbers rather than shared,
  // because a citation that is right for one district and wrong for the next is
  // exactly the copied-disclosure failure rule 9's corollary describes.
  'C-1': commercialDistrict('C-1 Commercial District — Neighborhood Retail', '622', 'f'),
  'C-2': commercialDistrict('C-2 Commercial District — Intermediate Commercial', '623', 'd'),
  'C-3': commercialDistrict('C-3 Commercial District — General Commercial', '624', 'g'),

  // ── Resort, shopping centre, mixed-use agricultural, golf, urban ────────
  RH: {
    ...base(
      'RH Resort District',
      'Phoenix Zoning Ordinance §629.B: .4 lot coverage 20%; .5 height (20 ft within 100 ft of a residential district or perimeter street, rising to a maximum of four stories / 48 feet)',
    ),
    height: storeyed(
      48,
      4,
      '§629.B.5.b ("In no event shall any such building exceed a height of four stories not to exceed forty-eight feet."), with §629.B.5.a limiting buildings within one hundred feet of any residential district or perimeter street to twenty feet',
    ),
    maxLotCoveragePct: 20,
    lotCoverageSource:
      '§629.B.4 ("The main building and all accessory buildings shall not occupy more than twenty percent of the total lot area.")',
    farUnconstrained: true,
  },
  PSC: {
    ...base(
      'PSC Planned Shopping Center District',
      'Phoenix Zoning Ordinance §637.C.1 (height 25 feet within 75 feet of a residential district, rising to a maximum of 56 feet / four stories); §637.C.2 (site coverage 25%)',
    ),
    height: storeyed(
      56,
      4,
      '§637.C.1 ("The maximum building height shall be twenty-five (25) feet for any structure seventy-five (75) feet from a residential district. Such height may be increased by one (1) foot for each additional three (3) feet from the residence district beyond seventy-five (75) feet to a maximum of fifty-six (56) feet. Except for centers located in primary village cores as designated in the General Plan, no structure shall contain more than two stories at a building height of twenty-five (25) feet or less and not more than four stories at a height between twenty-five (25) feet and fifty-six (56) feet.")',
    ),
    // Found by the "a resolved district carries an intensity control" invariant
    // in this module's test file, which failed on PSC and sent someone back to
    // §637. It was a real omission, not a bad test.
    maxLotCoveragePct: 25,
    lotCoverageSource:
      '§637.C.2 ("All buildings on a site as shown on the site plan thereof, as provided in Paragraph E of this Section shall not cover an aggregate area of more than twenty-five percent (25%) of the area of such site.")',
    farUnconstrained: true,
  },
  RSC: {
    ...base(
      'RSC Regional Shopping Center District',
      'Phoenix Zoning Ordinance §638.B.2 (56 feet); §638.C.c (major regional retail shopping buildings, up to four stories / 70 feet with graduated setbacks)',
    ),
    height: storeyed(
      56,
      null,
      '§638.B.2 ("No building shall exceed a height of fifty-six (56) feet, excluding elevator shafts, mechanical units or other like uses, except as provided in C below.")',
    ),
    heightAlternatives: [
      alt(
        'Major regional retail shopping building with graduated setbacks',
        70,
        4,
        '§638.C.c ("Major regional retail shopping buildings may exceed fifty-six (56) feet in height provided such buildings be setback from the nearest dedicated street four (4) feet for each one (1) foot of height when located adjacent to a commercial or industrial zoning district and six (6) feet for each one (1) foot of height when located adjacent to a residential district… In no event shall any such building exceed a height of four (4) stories not to exceed seventy (70) feet.")',
      ),
    ],
    farUnconstrained: true,
  },
  MUA: {
    ...base(
      'MUA Mixed Use Agricultural District',
      'Phoenix Zoning Ordinance §649: height one story / 20 feet; lot coverage 35%; density 2 units per acre',
    ),
    height: storeyed(
      20,
      1,
      '§649 ("A maximum building height of one story (1) not to exceed twenty (20) feet shall be permitted.")',
    ),
    maxLotCoveragePct: 35,
    lotCoverageSource: '§649, LOT COVERAGE table row "Maximum lot coverage" = 35%',
    maxUnitsPerGrossAcre: 2,
    densitySource: '§649, DENSITY table row "Maximum density" = 2 units per acre',
    farUnconstrained: true,
  },
  GC: {
    ...base(
      'GC Golf Course District',
      'Phoenix Zoning Ordinance §641: height two stories or thirty feet; lot coverage 5%',
    ),
    // ⚠️ The conjunction here is "OR", not the "AND" that FACT 1 describes for
    // the residential tables. Quoted verbatim rather than normalised, because
    // the two words are different rules and the difference is the code's.
    height: storeyed(
      30,
      2,
      '§641 ("Maximum building height shall not exceed two stories or thirty feet.") — note this district says "or", where the residential tables say "and"',
    ),
    maxLotCoveragePct: 5,
    lotCoverageSource: '§641 ("Maximum lot coverage shall not exceed five percent.")',
    farUnconstrained: true,
  },
  UR: {
    ...base(
      'UR Urban Residential District',
      'Phoenix Zoning Ordinance §642: D height 75 feet; E minimum density 40 dwelling units per gross acre and NO maximum density; G no maximum lot coverage',
    ),
    height: storeyed(75, null, '§642.D ("The maximum building height shall not exceed 75 feet.")'),
    // A stated absence of a lot-coverage maximum — the same kind of claim as
    // farUnconstrained, and made only because the code says it in words.
    lotCoverageUnconstrained: true,
    lotCoverageSource: '§642.G ("Lot Coverage—There shall be no maximum lot coverage requirements.")',
    densitySource:
      '§642.E ("There shall be a minimum density of 40 dwelling units per gross acre, and no maximum density.") — a density FLOOR, not a cap, which is why maxUnitsPerGrossAcre stays null',
    farUnconstrained: true,
  },

  // ── Parking districts ───────────────────────────────────────────────────
  // §639 permits surface parking lots, carports and public utility buildings,
  // and nothing else — "There shall be no accessory uses except trash dumpsters
  // and trash enclosures." The section states no building height because the
  // district contemplates no principal building. That is neither a height
  // answer nor a missing lookup, so it gets its own flag.
  'P-1': {
    ...base(
      'P-1 Parking District — Passenger Automobile Parking, Limited',
      'Phoenix Zoning Ordinance §639.A (surface parking lots, carports and public utility buildings only); §639.B states no height or coverage limit',
    ),
    noPrincipalBuilding: true,
    farUnconstrained: true,
  },
  'P-2': {
    ...base('P-2 Parking District', 'Phoenix Zoning Ordinance §640 (56 feet)'),
    height: storeyed(56, null, '§640 ("No structure shall exceed a height of fifty-six (56) feet.")'),
    farUnconstrained: true,
  },

  // ── Industrial (§§627, 628) ─────────────────────────────────────────────
  // The 80 ft "with use permit with a specific plan of development" and the
  // 110 ft warehouse figure the Council "may grant" are DISCRETIONARY, not
  // by-right, and are recorded in `source` only — never as an alternative the
  // applicant may elect (FACT 3).
  'A-1': {
    ...base(
      'A-1 Light Industrial District',
      'Phoenix Zoning Ordinance §627 ("Building height: Fifty-six (56) foot maximum height; up to eighty (80) feet allowable with use permit with a specific plan of development" — the 80 ft and the 110 ft warehouse figure both require a discretionary approval and are not published here)',
    ),
    height: storeyed(56, null, '§627 ("Building height: Fifty-six (56) foot maximum height")'),
    farUnconstrained: true,
  },
  'A-2': {
    ...base(
      'A-2 Industrial District',
      'Phoenix Zoning Ordinance §628 ("Building height. Fifty-six-foot maximum height; up to eighty feet allowable with a use permit with a specific plan of development" — the 80 ft and the 110 ft warehouse figure both require a discretionary approval and are not published here)',
    ),
    height: storeyed(56, null, '§628 ("Building height. Fifty-six-foot maximum height")'),
    farUnconstrained: true,
  },

  // ── Commerce Park (§626) — where the FAR slot EXISTS ────────────────────
  // §626.H.1's table has a "FAR" row: Single User 0.5, Research Park 1.0,
  // Business Park "—", General Commerce "—". Only the last two are mapped.
  //
  // farUnconstrained is FALSE on both, and that is the point of including them.
  // An em dash in a cell whose neighbours hold numbers is a BLANK, not a stated
  // absence, and this repo's rule is that a blank cell does not pass the slot
  // test. Every other district in this table earns `farUnconstrained: true`
  // because its standards enumeration has no FAR item at all; these two have
  // one, unfilled. Publishing them as "no FAR applies" would be the same class
  // of claim as an assumed FAR of 1.0, one step politer.
  'CP/BP': {
    ...base(
      'Commerce Park District — Business Park option',
      'Phoenix Zoning Ordinance §626.H.1, Commerce Park District Standards, "Business Park" column: maximum building height 18\' within 30\' of a perimeter lot line rising 1\' per 3\' of additional setback to a maximum of 56\'; lot coverage 40% plus 10% for parking canopies or structures; FAR "—"',
    ),
    height: storeyed(
      56,
      null,
      '§626.H.1 table, "Business Park" column, "Maximum building height" row: "18\' within 30\' of perimeter lot line; 1\' increase per 3\' additional setback, maximum 56\'"',
    ),
    maxLotCoveragePct: 40,
    lotCoverageSource:
      '§626.H.1 table, "Business Park" column, "Lot coverage" row: "40% plus 10% for parking canopies or structure"',
    farSource:
      '§626.H.1 table, "Business Park" column, "FAR" row: an em dash. The Single User and Research Park columns of the same row hold 0.5 and 1.0, so the slot exists here and is simply empty — which is a blank cell, not a stated absence.',
    farUnconstrained: false,
  },
  'CP/GCP': {
    ...base(
      'Commerce Park District — General Commerce option',
      'Phoenix Zoning Ordinance §626.H.1, Commerce Park District Standards, "General Commerce" column: maximum building height 18\' within 30\' of a perimeter lot line rising 1\' per 3\' of additional setback to a maximum of 56\' (80\' with use permit and site plan, a discretionary approval not published here); lot coverage 50%; FAR "—"',
    ),
    height: storeyed(
      56,
      null,
      '§626.H.1 table, "General Commerce" column, "Maximum building height" row: "18\' within 30\' of perimeter lot line; 1\' increase per 3\' additional setback, maximum 56\' to 80\' with use permit and site plan" — the 80\' limb requires a use permit and is not published as by-right',
    ),
    maxLotCoveragePct: 50,
    lotCoverageSource: '§626.H.1 table, "General Commerce" column, "Lot coverage" row: "50%"',
    farSource:
      '§626.H.1 table, "General Commerce" column, "FAR" row: an em dash. The Single User and Research Park columns of the same row hold 0.5 and 1.0, so the slot exists here and is simply empty — which is a blank cell, not a stated absence.',
    farUnconstrained: false,
  },

  // ── Flood hazard (§657) ─────────────────────────────────────────────────
  // Not a dimensional district. It carries the ordinance's ONLY numeric FAR
  // outside Commerce Park, and that figure is a TRANSFER credit off this land,
  // not a cap on building on it — so `farUnconstrained` is false and `maxFAR`
  // stays null rather than 0.1. The layer's own GEN_ZONE for these polygons is
  // 'Non-Developable'.
  FH: {
    ...base(
      'FH Flood Hazard and Erosion Management District',
      'Phoenix Zoning Ordinance §657',
    ),
    restrictedNote:
      '§657.C.6, verbatim: "When a lot or parcel that is partially covered by this zoning district also includes land that is non-residentially zoned, then non-residential intensity at a floor area ratio of 0.1 on the portion covered by this district may be transferred to the adjoining non-residential district. In addition, all structures, parking, and accessory uses, except as otherwise permitted by this district shall be transferred to the adjoining non-residential districts." §657.C.5 does the same for residential use at one dwelling unit per acre. The 0.1 is a transfer credit off this land, NOT a floor-area cap on building here, and is deliberately not published as a maxFAR.',
    farUnconstrained: false,
  },

  // ── Plan-governed (§§635, 636, 671) ─────────────────────────────────────
  // A GAP, and specifically not an absence. In all three the standards exist —
  // they are simply fixed in an instrument that is not published as data.
  PUD: {
    ...base(
      'PUD Planned Unit Development',
      'Phoenix Zoning Ordinance §671.A ("an applicant authors and proposes standards and guidelines that are tailored to the context of a site on a case by case basis"); §671.B.2 ("Where the approved PUD narrative is silent on a requirement, the applicable Zoning Ordinance standard applies")',
    ),
    planGoverned: true,
  },
  PCD: {
    ...base(
      'PC Planned Community District',
      'Phoenix Zoning Ordinance §636.D.3 (the City Council may condition the rezoning on "maximum densities, maximum building heights, maximum lot coverage, maximum intensity (ex. maximum F.A.R.), and greater setback requirements than might be otherwise permitted"); §636.E.1.b (the district boundary alone goes on the zoning map, and the Master Plan is filed separately)',
    ),
    planGoverned: true,
  },
  COUNTY: {
    ...base(
      'County island — Maricopa County zoning',
      "Mapped by the City of Phoenix zoning layer as ZONING='COUNTY' on nine polygons totalling 1,853 acres. Land inside the city's mapped area that the Phoenix Zoning Ordinance does not govern; the Maricopa County zoning ordinance does, and it is not read by this module.",
    ),
    countyJurisdiction: true,
  },
}

/** C-1 / C-2 / C-3 share a standards shape. `coreItem` is the letter of the
 *  core-area height item in that section's own E.3 list, which differs between
 *  the three (622.E.3.f, 623.E.3.d, 624.E.3.g) — passed in rather than assumed,
 *  because a citation that is right for one and wrong for the next is the
 *  copied-disclosure failure. */
function commercialDistrict(name: string, section: string, coreItem: string): PhoenixLimits {
  return {
    ...base(
      name,
      `Phoenix Zoning Ordinance §${section}.E.4.a (2 stories / 30 feet for non-residential uses); §${section}.E.4.h (lot coverage 50%); §${section}.E.1 (multi-family residential follows the R-3 district's yard, height, area and density requirements)`,
    ),
    height: storeyed(
      30,
      2,
      `§${section}.E.4.a ("A maximum building height of two (2) stories not to exceed thirty (30) feet shall be permitted.")`,
    ),
    heightAlternatives: [
      alt(
        'Core-area / Central Avenue limb (location-conditional, not resolved here)',
        56,
        4,
        `§${section}.E.3.${coreItem} ("A maximum building height of four (4) stories not to exceed fifty-six (56) feet shall be permitted."), which §${section}.E.3 applies only to structures in a core area as defined in the General Plan, structures on property abutting Central Avenue between Camelback Road and Harrison Street, and structures rezoned before June 15, 1988 under a Council-stipulated site plan. Which of those a parcel satisfies has not been measured, so this is disclosed and never published as the district's height.`,
      ),
    ],
    maxLotCoveragePct: 50,
    lotCoverageSource: `§${section}.E.4.h ("Lot Coverage: Lot coverage shall not exceed 50 percent (50%) of the net lot area exclusive of the first six (6) feet of roof overhang, open carports, covered patios or covered walkways.")`,
    // §{section}.E.1 sends multi-family residential to R-3's density, which is
    // 14.5 PDU/AC gross. Recorded as the residential density because it is the
    // only density the chapter states; non-residential intensity is governed by
    // height and coverage.
    maxUnitsPerGrossAcre: 14.5,
    densitySource: `§${section}.E.1 ("Any multi-family residential use shall conform to the yard, height, area and density requirements set forth for the R-3 district") → §615 Table 615.1 row (3), 14.5 PDU/AC (gross)`,
    farUnconstrained: true,
  }
}

// The Planned Area Development districts are mapped as PAD-2 … PAD-15. §635
// governs all of them and none states a dimensional standard of its own — the
// approved development plan does. Generated rather than hand-written so a new
// PAD number cannot arrive as a silent gap while looking like a curated entry.
for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  DISTRICTS[`PAD-${n}`] = {
    ...base(
      `PAD-${n} Planned Area Development`,
      'Phoenix Zoning Ordinance §635 (Planned Area Development). The dimensional standards are those of the approved development plan and the ordinance that adopted it, which are not published as data.',
    ),
    planGoverned: true,
  }
}

/** Unresolved. Asserts NOTHING — not a height, not a coverage, not a density,
 *  and specifically NOT `farUnconstrained`. A district nobody has read must
 *  never render as one whose code affirmatively imposes no limit. */
const UNRESOLVED: PhoenixLimits = Object.freeze({
  name: null,
  height: null,
  heightAlternatives: null,
  heightConditional: null,
  maxLotCoveragePct: null,
  lotCoverageUnconstrained: false,
  lotCoverageSource: null,
  maxUnitsPerGrossAcre: null,
  minLotAreaPerUnitSqFt: null,
  densitySource: null,
  maxFAR: null,
  farSource: null,
  farUnconstrained: false,
  planGoverned: false,
  countyJurisdiction: false,
  noPrincipalBuilding: false,
  restrictedNote: null,
  source: '',
})

/** Every district code this module resolves. Exported so a coverage test can
 *  compare it against the live layer's own vocabulary rather than a copy. */
export const PHOENIX_DISTRICT_CODES: readonly string[] = Object.freeze(Object.keys(DISTRICTS))

/**
 * Normalise a Phoenix ZONING string.
 *
 * Measured 2026-08-09 across the 75 distinct values the live layer serves: they
 * are clean base-district codes with no conditional suffixes — the historic
 * ('HP' / 'HP-L') and transit-overlay designations live in the layer's SEPARATE
 * `HISTORIC` and `TOD` columns, not in `ZONING`. So normalisation is whitespace
 * collapse plus upper-casing, and deliberately nothing else: there is no suffix
 * stripping here, because there is no suffix to strip and a speculative strip is
 * how 'R-LC' became 'R-L' in another city's provider.
 *
 * One value is whitespace-only on 3 polygons; it normalises to '' and resolves
 * to UNRESOLVED.
 */
export function normalizePhoenixZone(code: string | null | undefined): string {
  if (!code) return ''
  return code.replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * Resolve what the Phoenix Zoning Ordinance states for a mapped ZONING value.
 *
 * Every resolved result carries a section citation. An unrecognised code returns
 * UNRESOLVED, which asserts nothing — see the COVERAGE note in the header for
 * what is and is not in the table, and why the remainder is a gap rather than a
 * finding.
 *
 * NEVER derives feet from storeys or storeys from feet (FACT 1) — this module
 * has no feet-per-storey constant at all — and never returns a figure that
 * requires a use permit, a Council finding or a Board of Adjustment variance.
 */
export function resolvePhoenix(code: string | null | undefined): PhoenixLimits {
  const key = normalizePhoenixZone(code)
  if (!key) return UNRESOLVED
  return DISTRICTS[key] ?? UNRESOLVED
}

/**
 * Coarse use vocabulary for a Phoenix district.
 *
 * Read from each district's own permitted-use section, and `null` wherever that
 * section was NOT read — which is most of the commercial and industrial side.
 * A guess here is worse than a null: `allowedUses` feeds the feasibility
 * verdict, so asserting "residential" on a district that does not permit
 * dwellings would flip an answer, and Atlanta's I-1 (a FAR that applies to all
 * uses, but dwellings permitted only in a 50-year-old converted building) is
 * the recorded case of a name-based guess getting it wrong.
 *
 * ⚠️ A-1 and A-2 cover 32,722 acres between them and return `null` here. Their
 * §627.A / §628.A use lists were not read in this build; the districts' names
 * say "industrial", the four-token vocabulary has no industrial token, and
 * inferring "commercial" from the name is exactly the move that produced the
 * Atlanta defect. Null is the honest state until someone reads the lists.
 */
export function usesForZone(code: string | null | undefined): string[] | null {
  const key = normalizePhoenixZone(code)
  if (!key) return null

  // §603.A (S-1) and §§605–619 permit one-family and multi-family dwellings and
  // the customary residential accessory uses; the single- and multi-family
  // tables in §608's Residential Districts Land Use Matrix govern all of them.
  if (key === 'S-1') return ['residential']
  if (/^RE-(24|35|43)$/.test(key)) return ['residential']
  if (/^R1-(6|8|10|14|18)$/.test(key)) return ['residential']
  if (/^R-(2|3|3A|4|4A)$/.test(key)) return ['residential']
  // R-5 is "Multi-Family Residence—Restricted Commercial": §618.C sets
  // development regulations for nonresidential and mixed uses by reference to
  // C-1, which is only meaningful because the district permits them.
  if (key === 'R-5') return ['residential', 'commercial', 'mixed']
  // R-O §620.B is a residential-office district: dwellings plus offices.
  if (key === 'R-O') return ['residential', 'commercial']
  // C-O §621.C.3.a(1) lists "All uses listed in Residential Office District,
  // EXCEPT residential uses" — so the office districts are not residential.
  if (key === 'C-O' || key === 'C-O/G-O' || key === 'C-O/M-O') return ['commercial']
  // C-1/C-2/C-3 each carry a "Permitted Uses—Residential" subsection (§§622.C,
  // 623.C, 624.C) alongside their non-residential lists, and §§622–624.E.1
  // give multi-family residential the R-3 standards.
  if (key === 'C-1' || key === 'C-2' || key === 'C-3') return ['commercial', 'mixed', 'residential']
  // UR §642.E states a minimum residential density, so the district is
  // residential by construction.
  if (key === 'UR') return ['residential']

  // Everything else — S-2, RH, PSC, RSC, MUA, GC, P-1, P-2, A-1, A-2, the
  // Commerce Park options, FH, the plan-governed districts and every
  // unresolved code — returns null. Not because they permit nothing, but
  // because their use sections were not read in this build.
  return null
}
