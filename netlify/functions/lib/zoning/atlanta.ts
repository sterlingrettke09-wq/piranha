// Atlanta curated district table — City of Atlanta Code of Ordinances,
// PART III (Land Development Code), PART 16 — ZONING.
//
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE AND PROVENANCE. Read 2026-08-08.
//
// Atlanta does NOT self-publish a consolidated zoning ordinance. Its electronic
// code of record is Municipal Code Corporation (Municode), and that is not an
// assumption: the City's OWN zoning GIS layer
//   https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer/0
// carries a per-district `ZONEDESC` deep link into library.municode.com on every
// one of its 2,979 polygons (81 distinct chapter nodeIds) — the city's mapped
// vocabulary points at Municode chapter-by-chapter. Every figure below was read
// from that publisher's own chapter text, reached from the code's own table of
// contents rather than a guessed chapter path (CLAUDE.md rule 8):
//
//   index — the Part 16 chapter list, walked rather than guessed:
//     https://api.municode.com/codesToc/children?jobId=494611&productId=10376&nodeId=PTIIICOORANDECO_PT16ZO
//   text — the same host's CodesContent endpoint, one chapter per nodeId taken
//     from that index. Chapter 6 (R-4) is the worked example, and is a live URL
//     rather than a template so the citation checker can actually fetch it:
//     https://api.municode.com/CodesContent?nodeId=PTIIICOORANDECO_PT16ZO_CH6SIMIREDIRE&productId=10376
//   (a request with no jobId serves the CURRENT job, which is how currency was
//   established below; the human-readable equivalent is library.municode.com,
//   which the GIS links per district.)
//
// CURRENCY, measured two ways rather than asserted:
//   1. The jobId-less CodesContent request (which serves the CURRENT job)
//      returned a byte-identical response to jobId=494611 for Chapter 6
//      (47,731 bytes both ways), and jobId=500000 404s. 494611 is current.
//   2. The code's own SUPPLEMENT HISTORY TABLE at that job ends at Supp. No. 106,
//      last included ordinance 2026-25(26-O-1312), enacted 5-27-26.
//
// ⚠️ PENDING RECODIFICATION, and it is NOT yet in force. "ATL Zoning 2.0" would
// replace Part 16 wholesale. As of this reading it is a DRAFT (Draft V2 dated
// 2025-12-19, published on atlzoning.com), and Municode is still actively
// supplementing Part 16 through an ordinance enacted 2026-05-27. The code in
// force today is Part 16 and the GIS carries its vocabulary. This table would
// need re-transcription on adoption — it is dated above for that reason.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — ATLANTA DOES IMPOSE FLOOR AREA RATIOS, AND THEY ARE PER USE. Unlike
// Raleigh, Part 16 has a FAR instrument and most chapters use it. Nearly every
// non-single-family chapter states TWO OR THREE separate ratios in one section —
// one for nonresidential, one for residential, sometimes one for a mixed-use
// program — and they are ALTERNATIVES chosen by what you build, not a range
// (CLAUDE.md rule 6). O-I §16-10.007(1) is the plain case: "For nonresidential
// uses, floor area shall not exceed an amount equal to 3.0 times net lot area.
// Residential uses shall be permitted up to the maximum ratios established for
// sector 5" (= 3.20). Reporting either as "the O-I FAR" assumes a program.
// So every entry below is keyed by use; nothing is collapsed to one number
// unless the code itself states one number for all uses (I-1, I-2, I-MIX, and
// the single-family R districts).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — THE DENOMINATOR IS NOT THE SAME ON EVERY LIMB, AND THE CODE SAYS SO
// IN THE SAME SENTENCE. C-3 §16-13.007(1): nonresidential "five times NET lot
// area"; residential "3.2 times GROSS lot area as indicated on table I". The two
// are different quantities:
//
//   · NET lot area is the lot (§16-28.006 "Lot Defined. … A lot is a parcel of
//     land"), which is what the parcel polygon measures.
//   · GROSS land area is defined at §16-28.010(1) as "all land … within district
//     boundaries plus half of adjoining permanent open space such as streets,
//     parks, lakes, cemeteries and the like; provided that dimensions of such
//     open space credited shall be limited to no more than 50 feet."
//
// GROSS ≥ NET by construction. This module therefore records `basis` on every
// FAR limb and NEVER converts between them: computing a gross land area from a
// parcel polygon would require inventing a street-frontage credit, which is
// exactly the invented conversion factor CLAUDE.md rule 4 forbids. Downstream
// the ratio is applied to the parcel's own (net) area, which for a
// gross-denominated limb UNDERSTATES the allowance. That direction is stated
// here because it was reasoned from the two definitions, not measured — and a
// disclaimer naming the wrong direction is worse than none (rule 7).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — SOME DISTRICTS AFFIRMATIVELY HAVE NO MAXIMUM HEIGHT. This is an
// ANSWER, not a failed lookup (rule 5), and the code states it as a heading with
// a one-word body. Verbatim:
//
//   §16-15.007 "Maximum height limitations.  None."                    (C-5)
//   §16-11.009 "Maximum height limitations.  None, except as required
//                in section 16-11.006."                               (C-1)
//   §16-08.009 "Maximum height.  None except as required in
//                section 16-08.006."                                  (R-G)
//
// and identically at §16-10.008 (O-I), §16-12.008 (C-2), §16-14.008 (C-4),
// §16-16.008 (I-1) and §16-17.008 (I-2). The referenced section is in every case
// the district's own TRANSITIONAL HEIGHT PLANE — a 45° plane rising from a
// neighbouring protected district's boundary, i.e. a limit on the part of the
// site near a boundary, not a district ceiling.
//
// ⚠️ `ParcelInfo['zoning']` currently has `farUnconstrained` but NO
// `heightUnconstrained`. This module records the fact in `heightUnconstrained`
// so that a consumer can render it, and the provider states it in the `article`
// string. Until the shared type gains the flag, `maxHeightFt: null` on these
// districts is rendered by the feasibility engine as "no district height limit
// is available in public data" — which is FALSE here: the limit is known and is
// "none". That is a shared-type gap, recorded rather than papered over.
//
// A NOTE ON RG-1 AND RG-2, because the exception runs the other way: §16-08.006
// opens "The following height limitations shall apply … in all RG zoning
// districts EXCEPT RG-1 and RG-2" (they are themselves protected districts). So
// in RG-1/RG-2 the chapter states no numeric cap and the transitional plane does
// not apply either. Either way `heightFt` is null and the absence is stated.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — SOME HEIGHTS ARE TIERED BY DISTANCE FROM A PROTECTED DISTRICT, AND
// THAT IS NEITHER AN ANSWER NOR AN ABSENCE. MRC-1 §16-34.026(2)b, verbatim:
// "Structures or portions of structures which are within 150 feet of any R-1
// through R-5, R-G 1, R-G 2, MR-1, MR-2, or PD-H district shall have a maximum
// height of 35 feet. Structures that are between 150 feet and 300 feet … 52 feet.
// Structures or portions of structures that are greater than 300 feet … 225
// feet." MRC-2 (52/225) and LW (35/52) are the same shape.
//
// Resolving which tier binds requires a distance measurement from this parcel to
// the nearest protected district boundary. No such measurement has been made, so
// `heightFt` stays NULL and the tiers ride in `heightTiers` for disclosure.
// Publishing the top tier would assume a location the parcel may not have;
// publishing the bottom tier would impose a limit the code may not impose. Rule
// 1: a mechanism nobody measured earns no direction at all, not a hedged one.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — ATLANTA REGULATES HEIGHT IN FEET, AND THE STORY COUNTS IN THIS CODE
// ARE NOT REGULATIONS. §16-35.003 describes the MR districts by story count in
// its STATEMENT OF INTENT ("MR-3. Eight-story, zero-lot-line multi-family
// dwellings", "MR-5A. 15-story multi-family dwellings"), while the binding
// section §16-35.011(1) states only feet. Those intent figures are the exact
// shape of the Denver/Miami defect if promoted into data, and they do not even
// agree with each other on a ratio:
//
//     district   intent (§16-35.003)   binding feet (§16-35.011)   implied ft/story
//     MR-1/MR-2  "Two- to three-story"  35 ft                      11.67 (at 3)
//     MR-3       "Eight-story"          80 ft                      10.00
//     MR-4B      "Five-story"           52 ft                      10.40
//
// Three different ratios, so no constant reproduces them — the source document
// carries its own disproof, as Raleigh's did. This module therefore has NO story
// field and NO feet-per-story constant, by construction; `maxStories` is never
// produced for Atlanta. A test pins the absence (CLAUDE.md rules 12 and 14).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 6 — THE "-C" SUFFIX MEANS THE PUBLISHED FIGURE IS NOT THIS SITE'S LIMIT.
// §16-02.003(2), verbatim: "All zoning districts as shown on the official zoning
// map with a suffix 'C' after the district designation (i.e. C-1-C) denote that
// the parcel is zoned 'conditional' under previous ordinance amendments by the
// council. Such conditions shall remain in effect, and copies of such conditional
// ordinances may be obtained from the clerk of council."
//
// Measured against the live layer 2026-08-08: 960 of 2,979 polygons carry it,
// 8,146.9 of 95,537.6 acres — 8.5% of the city. The conditions are in a council
// ordinance held by the Clerk of Council and are in NO dataset, so they cannot be
// resolved here. The base-district figures are still returned, and the provider
// labels them as a ceiling the site may not have (the Raleigh "-CU" treatment).
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 7 — BONUS FAR IS EARNED, AND IS NEVER RETURNED. MRC and LW publish a
// second "Bonus FAR" table (MRC-3: base combined 7.2, "Max. FAR with Bonuses"
// 8.20 × GROSS lot area) whose limbs are conditioned on providing open space, on
// deed-restricted affordable rental housing at 60%/80% AMI, on ground-floor
// commercial, or on civic space. Those are programs an applicant elects and pays
// for, not by-right allowances, and this module returns only the base figures —
// the same call Raleigh's `-TOD` bonus got.
//
// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE, measured against the live layer 2026-08-08 by running THIS module's
// `resolveAtlanta` over every ZONECLASS value the layer serves (rule 11 — the
// exported entry point, not the table literal):
//
//     distinct ZONECLASS values .... 245   over 2,979 polygons / 95,537.6 acres
//     resolved ..................... 72    87,500.1 acres = 91.59%
//     unresolved ................... 173    8,037.5 acres
//
// 40 table keys cover 72 mapped values because the "-C" conditional variants
// resolve to their base district. The 173 unresolved are, by family:
// SPI 6,566 ac · HC-20 884 ac · NC 298 ac · Poncey-Highland 184 ac · LD 38 ac,
// plus exactly four mapped codes that have NO chapter in Part 16 at all and are
// therefore not guessable: PD-H1 (37.2 ac), MR-4-C (16.1 ac), PD-H2 (10.1 ac),
// MR-3A-C (3.6 ac). Chapter 35 establishes MR-1, MR-2, MR-3, MR-4A, MR-4B,
// MR-5A, MR-5B, MR-6 and MR-MU — there is no MR-4 and no MR-3A — and Chapter 19
// establishes PD-H, PD-MU, PD-OC, PD-BP and PD-CS, with no PD-H1 or PD-H2.
//
// ⚠️ THAT IS A FINDING ABOUT THE CITY, NOT ABOUT THIS PARSER. Atlanta maps 67.0
// acres under four district codes its own Part 16 never created. The gap is in
// the city's instrument: a property owner on one of those parcels cannot look up
// their district in the ordinance either, because the chapter that would define
// it does not exist. We therefore cannot close this by reading harder — there is
// nothing to read — and any figure published for them would have to come from
// somewhere other than the code.
//
// The likely explanations (a site-specific ordinance never folded into Part 16, a
// legacy code surviving a renumbering) are NOT recorded as facts here, because
// neither has been checked. What is recorded is what was measured: these four
// values are mapped, and Chapter 35's and Chapter 19's district rosters do not
// contain them.
//
// All 173 resolve to UNRESOLVED, which asserts nothing: no height, no FAR, and
// specifically NOT `farUnconstrained`. A gap must never render as FACT 3's or
// FCR-3's known absence.
//
// The SPI chapters were deliberately NOT curated here rather than curated
// quickly. Each publishes a wide per-subarea grid — SPI-16's Chapter 16-18P
// carries base FAR / bonus FAR / max FAR / residential FAR / max height in one
// table, one column per subarea — which is the exact shape of the DC MU-column
// off-by-one. An unread district is a gap.
//
// ⚠️ THE ACCESS REASON EXPIRED, THE READING REASON DID NOT. Re-tested
// 2026-08-17. This note used to add that the columns "run together when
// flattened to text"; that is a claim about a TOOL and it no longer holds.
// api.municode.com returns the chapter as HTML: node
// PTIIICOORANDECO_PT16ZO_CH16-18PSPMISPPUINDIRE is 216,855 bytes carrying eight
// <table> elements, and the FAR grid is cell-addressable — its subarea columns
// separate cleanly into "Midtown Mixed Use (SA #1) | Midtown Residential (SA #2)
// | Juniper East (SA #3)" with a Non-Residential FAR row of 5.0 | 5.2 | 10.2.
//
// A "we could not extract X" blocker asserts TWO things — that extraction failed,
// and that X was there to extract. Both were checked here and the second HOLDS:
// the FAR really is in that table. (Phoenix's equivalent note failed the second
// test — its per-frontage table never contained a height at all.)
//
// So these are now a NORMAL READING TASK rather than a blocked one, and the
// reading method is worked out: scripts/municodeGrid.py expands the merges so
// every data cell carries its full header path.
//
// ⚠️ THE COLUMN-COUNT CHECK USED ON SAN DIEGO DOES NOT APPLY, and reaching for it
// here is dangerous. There the header count, the data count and the live code
// count were all six and their agreement was the proof. A merged header cell
// legitimately spans several data columns, so here the counts SHOULD differ —
// and "make the counts reconcile" can only be satisfied by misreading one side,
// which produces a grid that passes the check while publishing a neighbouring
// subarea's figure.
//
// WHAT RECONCILES INSTEAD IS THE COLUMN PATH. SPI-16 proves it: the live
// enumeration carries `SPI-16 SA2 JSTA`, and the expanded grid resolves a column
// whose path is (Midtown Residential SA #2 -> Juniper St. Transition -> FAR by
// right). JSTA *is* that sub-column. The identity is the evidence; the counts
// never had to agree.
//
// SPI-16 READ 2026-08-17 and NOT YET ENCODED — recorded here so the reading is
// not lost and so the next writer starts from figures rather than from a PDF.
// Chapter 16-18P, Table "FAR / Height" (by-right column; the bonus column is a
// programme the user has not chosen, rule 6):
//
//   live code           column path                              FAR    height
//   SPI-16 SA1          Midtown Mixed Use (SA #1)                8.2    none, except the
//                                                                       transitional height
//                                                                       plane adjacent to R
//   SPI-16 SA2 JSTA     SA #2 -> Juniper St. Transition          6.4    400'
//   SPI-16 SA2          SA #2 -> Non-Juniper St. Transition      3.2    250'
//   SPI-16 SA3          Juniper East (SA #3)                     5.2    100' (60' east of
//                                                                       Piedmont Ave.)
//   SPI-16 SA1C         "-C" conditional variant of SA1          — resolves to its base
//                        district, as the other -C codes here already do
//
// The with-bonus figures are 10.2 / 9.4 / 6.2 / 7.0 respectively and are NOT the
// headline.
//
// ⚠️⚠️ BOTH SPI-16 FAR ROWS ARE GROSS-BASIS, AND THAT BLOCKS ENCODING. The row
// labels read "Non-Residential FAR (times GROSS lot area)" and "Residential FAR
// (times GROSS lot area)". FACT 2 above defines gross for this city —
// §16-28.010(1), "all land … within district boundaries plus half of adjoining
// permanent open space such as streets, parks, lakes, cemeteries and the like;
// provided that dimensions of such open space credited shall be limited to no
// more than 50 feet."
//
// The parcel polygon measures NET lot area. So 8.2 is a correct ratio against a
// denominator nothing we fetch carries, which is the LA buildable-area shape
// exactly (rule 24): the figure is right, the multiplicand is unobtainable, and
// `far * lotSqFt` would be a number computed against the wrong area.
//
// The direction is the FLATTERING-FREE one for once — gross exceeds net, so
// net * FAR understates rather than overstates — but understating is still an
// invented conversion (rule 4), and a half-street-width credit capped at 50 feet
// is exactly the sort of factor that would look measured six months later.
//
// SO THE MAPPING DECISION IS NOT THE ONE IT LOOKED LIKE. It is not "which of the
// three rows goes in which field"; it is whether a gross-basis ratio can be
// published at all. FACT 2's own answer is that the basis is RECORDED so the
// number can be labelled and never converted — so the honest encoding is the
// figure plus `basis: 'gross'` plus a reason code on the floor-area product, the
// same shape as LA's `farBasis: 'basis-unavailable'`.
//
// Found in one command BEFORE encoding, which is the whole reason to look: the
// alternative was deciding a field mapping, applying it mechanically to twenty
// chapters, and discovering the denominator afterwards.

/** Which lot-area denominator the code's own sentence multiplies the ratio by.
 *  Never converted between (FACT 2) — recorded so the number can be labelled. */
export type AtlantaLotBasis = 'net' | 'gross'

/** One floor-area ratio as the code prints it, with its denominator and its
 *  section. A limb cannot be constructed without a citation. */
export interface AtlantaFarLimb {
  far: number
  basis: AtlantaLotBasis
  source: string
}

/** A height figure the code states only as a function of distance from a
 *  protected district (FACT 4). Disclosure only — never resolved here. */
export interface AtlantaHeightTier {
  /** e.g. "within 150 ft of a protected district" */
  label: string
  heightFt: number
}

/** The lot-size-conditional floor-area rule R-4A / R-4B / R-5 carry: a lot BELOW
 *  the district minimum is capped at "the lesser of" a fixed square footage or a
 *  higher ratio. It is a conditional branch keyed on the lot's own measured
 *  area, NOT a program the applicant elects — which is why it is resolved from
 *  the lot rather than published as an alternative. */
export interface AtlantaSmallLotRule {
  /** District minimum lot area. At or above this, the headline FAR applies. */
  minLotSqFt: number
  /** The fixed square-footage limb of the code's "lesser of either". */
  maxFloorAreaSqFt: number
  /** The ratio limb of the code's "lesser of either" (on NET lot area). */
  far: number
  /** R-5 only: a floor area the code guarantees even when the ratio is smaller
   *  ("If the floor area ratio does not allow at least 1,800 square feet …"). */
  guaranteedFloorSqFt?: number
  source: string
}

/** An alternative development program with its own FAR — the user picks one
 *  (CLAUDE.md rule 6). Never a range around the headline. */
export interface AtlantaFarAlternative {
  label: string
  far: number
  basis: AtlantaLotBasis
  source: string
}

export interface AtlantaLimits {
  /** The chapter's own name for the district; null when unresolved. */
  name: string | null
  /** Maximum height in FEET, exactly as the code prints it. Null means one of
   *  three different things, and the two booleans below disambiguate:
   *    heightUnconstrained → the code states "None" (an ANSWER, FACT 3)
   *    heightTiers != null → stated, but keyed to distance (FACT 4)
   *    both absent          → we did not resolve it (a GAP) */
  heightFt: number | null
  /** The code affirmatively imposes no maximum height in this district. */
  heightUnconstrained: boolean
  /** Height stated as distance-conditional tiers we have not measured. */
  heightTiers: AtlantaHeightTier[] | null
  /** The section the height figure (or its stated absence) came from, on its
   *  own rather than only inside `source`. It exists because the provider needs
   *  to quote it in user-facing copy, and slicing it back out of a prose string
   *  is the kind of load-bearing string surgery that breaks silently when a
   *  citation is reworded. */
  heightSource: string | null
  /** FAR for exclusively NONRESIDENTIAL development. */
  farNonresidential: AtlantaFarLimb | null
  /** FAR for RESIDENTIAL development. */
  farResidential: AtlantaFarLimb | null
  /** FAR for a development combining both, where the chapter states one. */
  farCombined: AtlantaFarLimb | null
  /** TRUE only where the code imposes NO floor-area ratio at all here — a
   *  KNOWN absence (rule 5). False everywhere a FAR exists AND everywhere the
   *  code string resolved to nothing, where we assert nothing. */
  farUnconstrained: boolean
  /** Lot-size-conditional floor-area branch (R-4A / R-4B / R-5). */
  smallLot: AtlantaSmallLotRule | null
  /** Other programs the chapter allows, each with its own ratio. */
  farAlternatives: AtlantaFarAlternative[] | null
  /** The council-approved planned-development plan sets intensity and height
   *  (PD districts). Not an absence — the code DOES impose a FAR, via a Table I
   *  sector fixed in the approving ordinance, which is not in any dataset. */
  planGoverned: boolean
  /** Section(s) the figures were transcribed from. Empty only on UNRESOLVED. */
  source: string
}

// ── Constructors ─────────────────────────────────────────────────────────────
// Rule 14: make the caught error an impossible state rather than a comment.
// Every entry below is assembled from these, and there is DELIBERATELY no
// constructor that accepts a story count, and none that accepts a height and a
// ratio without a citation string. Reintroducing the Miami/Denver ft-per-story
// round trip would require writing a new constructor — a visible, reviewable act
// — rather than editing a table row.

const base = (name: string, source: string): AtlantaLimits => ({
  name,
  heightFt: null,
  heightUnconstrained: false,
  heightTiers: null,
  heightSource: null,
  farNonresidential: null,
  farResidential: null,
  farCombined: null,
  farUnconstrained: false,
  smallLot: null,
  farAlternatives: null,
  planGoverned: false,
  source,
})

/** A ratio the code prints, with the denominator its own sentence names. */
const far = (value: number, basis: AtlantaLotBasis, source: string): AtlantaFarLimb => ({
  far: value,
  basis,
  source,
})

/** Table I, "Land Use Intensity Ratios" (§16-08.007), sector maxima —
 *  transcribed from the rendered table, whose FAR column runs in ascending steps
 *  within each sector. The operative figure is the sector MAXIMUM, per
 *  §16-08.007(3): the ratios "are allowed at the maximum ratios for each of the
 *  five sectors as so designated on the official map."
 *
 *  ⚠️ The table prints SIX sectors while §16-08.007(3) says "five". That is not
 *  a transcription error and it is not resolved here: the RG map uses RG-1…RG-5
 *  only (measured — the live layer carries no RG-6), and sector 6 is reached
 *  from OTHER chapters that cite Table I by sector, e.g. C-5 §16-15.006(1)(b)
 *  "6.4 times gross lot area as indicated on table I". Both readings are
 *  recorded; neither is invented.
 *
 *  Table I's own header reads "LUI Ratios Times Gross Land Area", so every
 *  sector figure is GROSS-denominated wherever a chapter incorporates it by
 *  sector reference. Chapters that restate a Table I number in their own words
 *  sometimes redenominate it (MR §16-35.010 restates the same ladder "times net
 *  lot area"); each entry below carries the basis ITS OWN section states. */
export const TABLE_I_SECTOR_MAX_FAR: Record<number, number> = {
  1: 0.162,
  2: 0.348,
  3: 0.696,
  4: 1.49,
  5: 3.2,
  6: 6.4,
}

const TABLE_I = '§16-08.007 Table I "Land Use Intensity Ratios" (LUI Ratios Times Gross Land Area)'

/** Sector maximum as a GROSS-denominated limb, cited to both the referring
 *  section and Table I itself, so a reader can check the hop. */
const sector = (n: 1 | 2 | 3 | 4 | 5 | 6, citingSection: string): AtlantaFarLimb =>
  far(TABLE_I_SECTOR_MAX_FAR[n], 'gross', `${citingSection} → sector ${n} maximum, ${TABLE_I}`)

// ── Single-family and two-family R districts ─────────────────────────────────
// One FAR for all uses, on NET lot area, and 35 feet everywhere.
//
// The NET denominator is stated twice over, so it is not inferred from silence:
//   · §16-29.001(37) "Floor area ratio: A number which, when multiplied by the
//     total NET LOT AREA of any lot within the R-1 through R-5 district …"
//   · §16-28.009 "For the purpose of clarifying the application of the floor
//     area ratio calculation in single-family and two-family zoning districts,
//     NET LOT AREA shall be used."
// R-4A/R-4B/R-5 also say "of the net lot area" in the operative sentence.
//
// Height is the same sentence in every chapter: "No building shall exceed 35
// feet in height." (with §16-28.022 excluding roof structures, spires, tanks and
// the like from the limit — an exclusion, not a bonus, and not modelled).

function singleFamily(
  name: string,
  farValue: number,
  chapter: string,
  farSub: string,
  heightSec: string,
): AtlantaLimits {
  return {
    ...base(name, `§${farSub} (FAR ${farValue}); §${heightSec} (35 ft)`),
    heightFt: 35,
    heightSource: `§${heightSec} ("No building shall exceed 35 feet in height")`,
    farNonresidential: far(farValue, 'net', `§${farSub}`),
    farResidential: far(farValue, 'net', `§${farSub}`),
    farCombined: far(farValue, 'net', `§${farSub}`),
    source: `Part 16 ch. ${chapter}: §${farSub} (max FAR ${farValue} of net lot area); §${heightSec} ("No building shall exceed 35 feet in height")`,
  }
}

// ── The table ────────────────────────────────────────────────────────────────

const DISTRICTS: Record<string, AtlantaLimits> = {
  // ── Single-family (Chapters 3, 4, 4A, 4B, 5, 5A, 6) ─────────────────────
  'R-1': singleFamily('R-1 Single-Family Residential', 0.25, '3', '16-03.008(5)', '16-03.009'),
  'R-2': singleFamily('R-2 Single-Family Residential', 0.3, '4', '16-04.008(5)', '16-04.009'),
  'R-2A': singleFamily('R-2A Single-Family Residential', 0.35, '4A', '16-04A.008(5)', '16-04A.009'),
  'R-2B': singleFamily('R-2B Single-Family Residential', 0.4, '4B', '16-04B.008(5)', '16-04B.009'),
  'R-3': singleFamily('R-3 Single-Family Residential', 0.4, '5', '16-05.008(5)', '16-05.009'),
  'R-3A': singleFamily('R-3A Single-Family Residential', 0.45, '5A', '16-05A.008(5)', '16-05A.009'),
  'R-4': singleFamily('R-4 Single-Family Residential', 0.5, '6', '16-06.008(5)', '16-06.009'),

  // R-4A and R-4B state the FAR twice: once for a lot that MEETS the district
  // minimum, once for a lot that does not. The second is NOT a program the
  // applicant elects — it is a branch on the lot's own measured area, and it is
  // a "lesser of" cap, so the higher ratio in it does not mean more floor area.
  // On an R-4A lot of 7,000 sf the two limbs are 3,750 sf and 0.65 × 7,000 =
  // 4,550 sf, and the code takes the smaller: 3,750 sf, i.e. an effective 0.536.
  // Publishing "0.65" for R-4A would be a rule-6 collapse in the direction that
  // overstates.
  'R-4A': {
    ...singleFamily('R-4A Single-Family Residential', 0.5, '6A', '16-06A.008(5)a', '16-06A.009'),
    smallLot: {
      minLotSqFt: 7500,
      maxFloorAreaSqFt: 3750,
      far: 0.65,
      source:
        '§16-06A.008(5)b ("the lesser of either: 3,750 square feet of floor area; or … 0.65 of the net lot area"), minimum lot area §16-06A.007(1) = 7,500 sq ft',
    },
  },
  'R-4B': {
    ...singleFamily('R-4B Single-Family Residential', 0.75, '6B', '16-06B.008(5)a', '16-06B.009'),
    smallLot: {
      minLotSqFt: 2800,
      maxFloorAreaSqFt: 2100,
      far: 0.9,
      source:
        '§16-06B.008(5)b ("the lesser of either: 2,100 square feet of floor area: or … 0.90 of the net lot area"), minimum lot area §16-06B.007(1) = 2,800 sq ft',
    },
  },

  // ── R-5 Two-Family (Chapter 7) ──────────────────────────────────────────
  // §16-07.008(5) is a FOUR-limb per-program table, and the headline is the
  // single-family detached figure — the lowest common program (rule 6):
  //   a. single-family detached on a conforming lot ......... 0.50 net
  //   b. single-family detached on a substandard lot ........ lesser of 3,750 sf
  //      or 0.65 net, with a guaranteed 1,800 sf floor
  //   c. duplex ............................................. 0.60 net
  //   d. two-family that is not a duplex .................... 0.50 net for the
  //      main unit, secondary unit ≤ 750 sq ft
  // (d) cannot be expressed as a single ratio (it is a ratio plus a per-unit
  // cap), so it is deliberately NOT published as an alternative rather than
  // being flattened into one — the same call Raleigh made on R-1's 68 ft
  // treatment-plant figure.
  'R-5': {
    ...singleFamily('R-5 Two-Family Residential', 0.5, '7', '16-07.008(5)a', '16-07.009'),
    smallLot: {
      minLotSqFt: 7500,
      maxFloorAreaSqFt: 3750,
      far: 0.65,
      guaranteedFloorSqFt: 1800,
      source:
        '§16-07.008(5)b ("the lesser of either: (i) 3,750 square feet of floor area; or (ii) a maximum floor area ratio of 0.65 of the net lot area"; and "If the floor area ratio does not allow at least 1,800 square feet of floor area, a dwelling … of such size may be built"), minimum lot area §16-07.007(2) = 7,500 sq ft',
    },
    farAlternatives: [
      {
        label: 'Duplex',
        far: 0.6,
        basis: 'net',
        source: '§16-07.008(5)c ("For a duplex: The maximum floor area ratio shall be 0.60 of the net lot area")',
      },
    ],
  },

  // ── Fulton County R-3, annexed 2006 (Chapter 6C) ────────────────────────
  // A KNOWN ABSENCE of FAR, established by the slot test on the chapter's own
  // structure rather than by failing to find one (rule 5). §16-06C.003
  // "Development standards" is a complete, self-contained, lettered enumeration
  // of every dimensional control the district has — A height, B front yard,
  // C side yard, D rear yard, E minimum lot area, F lot width, G lot frontage,
  // H MINIMUM heated floor area, I accessory structures. There is no floor-area
  // ratio item, and the chapter has only four sections in total (.001 scope,
  // .002 uses, .003 standards, .004 applicability) — there is nowhere else in it
  // for a FAR to live. Floor area here is governed by height and yards.
  //
  // Note item H is a MINIMUM heated floor area (1,200 sf / 1,320 sf), a floor
  // under the building, not a cap — it is not a FAR and is not published as one.
  'FCR-3': {
    ...base('Fulton County R-3 Single-Family Dwelling', '§16-06C.003 A ("No building shall exceed 40 feet in height"); no FAR item anywhere in ch. 6C'),
    heightFt: 40,
    heightSource: '§16-06C.003 A ("Height regulations: No building shall exceed 40 feet in height")',
    farUnconstrained: true,
  },

  // ── R-G Residential General (Chapter 8) ─────────────────────────────────
  // The district number IS the Table I sector: §16-08.007(3) allows the listed
  // residential uses "at the maximum ratios for each of the five sectors as so
  // designated on the official map", and the same paragraph speaks of "the
  // Residential General (RG) sector designation" carried by the district.
  // §16-08.006 corroborates the mapping by naming "RG-1 and RG-2" (the two
  // lowest sectors) as protected districts.
  //
  // The Table I ratios apply to the MULTI-FAMILY side only — §16-08.007(3) lists
  // "two-family dwellings, multi-family dwellings, zero-lot-line dwellings,
  // residence hotels, apartment hotels, rooming houses …, and dormitories,
  // fraternity houses, and sorority houses". Single-family detached (§16-08.007(2),
  // minimum net lot 1,000 sq ft) and "All other uses" (§16-08.007(4), minimum
  // net lot 20,000 sq ft) get a minimum lot size and NO ratio. So the
  // nonresidential limb is left null: that is not-stated, not zero.
  ...Object.fromEntries(
    ([1, 2, 3, 4, 5] as const).map((n) => [
      `RG-${n}`,
      {
        ...base(
          `R-G Residential General, sector ${n}`,
          `§16-08.007(3) + Table I sector ${n} (residential FAR ${TABLE_I_SECTOR_MAX_FAR[n]}); §16-08.009 (max height: None)`,
        ),
        heightUnconstrained: true,
        heightSource:
          '§16-08.009 ("Maximum height. None except as required in section 16-08.006") — and §16-08.006 itself applies "in all RG zoning districts except RG-1 and RG-2"',
        farResidential: sector(n, '§16-08.007(3)'),
      } satisfies AtlantaLimits,
    ]),
  ),

  // ── R-LC Residential-Limited Commercial (Chapter 9) ─────────────────────
  'R-LC': {
    ...base(
      'R-LC Residential-Limited Commercial',
      '§16-09.008 (nonresidential 0.50 × net lot area; residential Table I sector 2); §16-09.010 (35 ft)',
    ),
    heightFt: 35,
    heightSource: '§16-09.010 ("No building shall exceed 35 feet in height")',
    farNonresidential: far(
      0.5,
      'net',
      '§16-09.008 ("For nonresidential uses, floor area shall not exceed an amount equal to .50 times net lot area")',
    ),
    farResidential: sector(2, '§16-09.008 / §16-09.007(3)'),
  },

  // ── O-I Office-Institutional (Chapter 10) ───────────────────────────────
  'O-I': {
    ...base(
      'O-I Office-Institutional',
      '§16-10.007(1) (nonresidential 3.0 × net lot area; residential Table I sector 5); §16-10.008 (max height: None, except the §16-10.006 transitional plane)',
    ),
    heightUnconstrained: true,
    heightSource: '§16-10.008 ("Maximum height limitations. None, except as required in section 16-10.006")',
    farNonresidential: far(
      3.0,
      'net',
      '§16-10.007(1) ("For nonresidential uses, floor area shall not exceed an amount equal to 3.0 times net lot area")',
    ),
    farResidential: sector(5, '§16-10.007(1)'),
  },

  // ── C-1 … C-5 (Chapters 11–15) ──────────────────────────────────────────
  // C-1 and C-2 state two limbs and NO combined figure; C-3, C-4 and C-5 state a
  // third, "the sum of the nonresidential (a) and residential (b) above, but in
  // no event greater than the maximum ratios permitted for each". The sum is
  // therefore a genuine third program with sub-caps, not a headline — it rides
  // in farCombined, and the per-use limbs stay separate.
  'C-1': {
    ...base(
      'C-1 Community Business',
      '§16-11.007(1) (nonresidential/lodging 2.0 × net lot area; multi-family Table I sector 3); §16-11.009 (max height: None, except the §16-11.006 transitional plane)',
    ),
    heightUnconstrained: true,
    heightSource: '§16-11.009 ("Maximum height limitations. None, except as required in section 16-11.006")',
    farNonresidential: far(
      2.0,
      'net',
      '§16-11.007(1) ("for nonresidential uses and lodging uses, floor area shall not exceed an amount equal to 2.0 times net lot area")',
    ),
    farResidential: sector(3, '§16-11.007(1)'),
  },
  'C-2': {
    ...base(
      'C-2 Commercial Service',
      '§16-12.007(1) (nonresidential/lodging 3.0 × net lot area; multi-family Table I sector 3); §16-12.008 (max height: None, except the §16-12.006 transitional plane)',
    ),
    heightUnconstrained: true,
    heightSource: '§16-12.008 ("Maximum height limitations. None, except as required in section 16-12.006")',
    farNonresidential: far(
      3.0,
      'net',
      '§16-12.007(1) ("For nonresidential uses and lodging uses, floor area shall not exceed an amount equal to 3.0 times net lot area")',
    ),
    farResidential: sector(3, '§16-12.007(1)'),
  },
  'C-3': {
    ...base(
      'C-3 Commercial Residential',
      '§16-13.007(1) (nonresidential 5 × net; residential 3.2 × gross; mixed 8.2); §16-13.008 (225 ft)',
    ),
    heightFt: 225,
    heightSource: '§16-13.008 ("No building shall exceed a height of 225 feet")',
    farNonresidential: far(
      5.0,
      'net',
      '§16-13.007(1)(a) ("For nonresidential uses, floor area shall not exceed an amount equal to five times net lot area")',
    ),
    farResidential: far(
      3.2,
      'gross',
      '§16-13.007(1)(b) ("floor area shall not exceed an amount equal to 3.2 times gross lot area as indicated on table I")',
    ),
    farCombined: far(
      8.2,
      'net',
      '§16-13.007(1)(c) (mixed use: "the sum of nonresidential (a) and residential (b) above, but in no event greater than the maximum ratios permitted for each") = 5.0 + 3.2',
    ),
  },
  'C-4': {
    ...base(
      'C-4 Central Area Commercial-Residential',
      '§16-14.007(1) (nonresidential 7 × net; residential 3.2 × gross; mixed 10.2); §16-14.008 (max height: None, except the §16-14.006 transitional plane)',
    ),
    heightUnconstrained: true,
    heightSource: '§16-14.008 ("Maximum height. None, except as required in section 16-14.006, transitional uses and structures")',
    farNonresidential: far(
      7.0,
      'net',
      '§16-14.007(1)(a) ("For nonresidential uses, floor area shall not exceed an amount equal to seven times net lot area")',
    ),
    farResidential: far(
      3.2,
      'gross',
      '§16-14.007(1)(b) ("3.2 times gross lot area as indicated on table I")',
    ),
    farCombined: far(10.2, 'net', '§16-14.007(1)(c) (mixed use: the sum, sub-capped) = 7.0 + 3.2'),
  },
  'C-5': {
    ...base(
      'C-5 Central Business Support',
      '§16-15.006(1) (nonresidential 10 × net; residential 6.4 × gross; mixed 16.4); §16-15.007 (max height: "None.")',
    ),
    heightUnconstrained: true,
    heightSource: '§16-15.007 ("Maximum height limitations. None.")',
    farNonresidential: far(
      10.0,
      'net',
      '§16-15.006(1)(a) ("For nonresidential uses, floor area shall not exceed an amount equal to ten times net lot area")',
    ),
    farResidential: far(
      6.4,
      'gross',
      '§16-15.006(1)(b) ("6.4 times gross lot area as indicated on table I") = Table I sector 6 maximum',
    ),
    farCombined: far(16.4, 'net', '§16-15.006(1)(c) (mixed use: the sum, sub-capped) = 10.0 + 6.4'),
  },

  // ── Industrial (Chapters 16, 16A, 17) ───────────────────────────────────
  // I-1 and I-2 state ONE ratio for everything ("Floor area shall not exceed an
  // amount equal to 2.0 times net land area") with no per-use split, so all
  // three limbs carry it.
  'I-1': {
    ...base(
      'I-1 Light Industrial',
      '§16-16.007(1) (2.0 × net land area, all uses); §16-16.008 (max height: None, except the §16-16.006 transitional plane)',
    ),
    heightUnconstrained: true,
    heightSource: '§16-16.008 ("Maximum height limitations. None, except as required in section 16-16.006")',
    farNonresidential: far(2.0, 'net', '§16-16.007(1) ("Floor area shall not exceed an amount equal to 2.0 times net land area")'),
    farResidential: far(2.0, 'net', '§16-16.007(1)'),
    farCombined: far(2.0, 'net', '§16-16.007(1)'),
  },
  'I-2': {
    // §16-17.008's own cross-reference is self-referential in the published
    // text — "None, except as required in section 16-17.008" — where the
    // transitional-uses section is §16-17.006. Quoted verbatim rather than
    // silently corrected; the operative word is "None" either way.
    ...base(
      'I-2 Heavy Industrial',
      '§16-17.007(1) (2.0 × net land area, all uses); §16-17.008 (max height: "None, except as required in section 16-17.008")',
    ),
    heightUnconstrained: true,
    heightSource: '§16-17.008 ("Maximum height limitations. None, except as required in section 16-17.008" — the cross-reference is self-referential in the published text; the transitional-uses section is §16-17.006)',
    farNonresidential: far(2.0, 'net', '§16-17.007(1) ("Floor area shall not exceed an amount equal to 2.0 times net land area")'),
    farResidential: far(2.0, 'net', '§16-17.007(1)'),
    farCombined: far(2.0, 'net', '§16-17.007(1)'),
  },
  'I-MIX': {
    ...base(
      'I-MIX Industrial Mixed Use',
      '§16-16A.008 Table 1 (Maximum FAR 3.3 combined for all uses, times net lot area; Maximum Height 225 ft)',
    ),
    heightFt: 225,
    heightSource: '§16-16A.008 Table 1 ("Maximum Height: 225 ft., subject to section 16-16A.007(2) Transitional Height Planes")',
    farNonresidential: far(3.3, 'net', '§16-16A.008 Table 1 ("3.3 combined for all uses", times net lot area)'),
    farResidential: far(3.3, 'net', '§16-16A.008 Table 1'),
    farCombined: far(3.3, 'net', '§16-16A.008 Table 1'),
  },

  // ── MR Multi-Family Residential (Chapter 35) ────────────────────────────
  // §16-35.010 Table A restates the Table I ladder in the chapter's own words
  // and redenominates it: "times NET lot area", with a footnote "Residential
  // floor area may be calculated utilizing gross lot area" as an OPEN SPACE
  // BONUS (§16-35.010(1)(b)) — an election, so the base 'net' basis is what is
  // recorded. Nonresidential is capped at "5% of total floor area", which is a
  // share of the building rather than a ratio on the lot, so the nonresidential
  // limb is deliberately null rather than 0.05.
  //
  // Heights are §16-35.011(1), in feet. MR-5B and MR-6 exist in the chapter but
  // are NOT mapped (measured against the live layer: neither code appears among
  // the 245 ZONECLASS values), and MR-5B's height is itself distance-tiered, so
  // neither is entered here.
  ...Object.fromEntries(
    (
      [
        ['MR-1', 0.162, 35],
        ['MR-2', 0.348, 35],
        ['MR-3', 0.696, 80],
        ['MR-4A', 1.49, 80],
        ['MR-4B', 1.49, 52],
        ['MR-5A', 3.2, 150],
      ] as const
    ).map(([code, ratio, ft]) => [
      code,
      {
        ...base(
          `${code} Multi-Family Residential`,
          `§16-35.010 Table A (residential FAR ${ratio} × net lot area); §16-35.011(1) (${ft} ft)`,
        ),
        heightFt: ft,
        heightSource: `§16-35.011(1) (${code}: ${ft} ft)`,
        farResidential: far(ratio, 'net', `§16-35.010 Table A / §16-35.010(1)(a) (${code}: ${ratio} × net lot area)`),
        farCombined: far(ratio, 'net', `§16-35.010 Table A, "Combined" column (${code})`),
      } satisfies AtlantaLimits,
    ]),
  ),
  // MR-MU regulates by DWELLING UNITS, not by floor area: §16-35.010 Table A
  // reads "Not permitted" for nonresidential and "12 units/building" in both the
  // Residential and Combined FAR columns, and §16-35.011(5)(b) adds "An
  // individual lot may not contain less than four nor more than 12 dwelling
  // units" and "Only one principal building is permitted on a lot." The FAR slot
  // exists and the code fills it with a unit cap, so this is a stated absence of
  // a floor-area ratio (rule 5), not a lookup we failed.
  'MR-MU': {
    ...base(
      'MR-MU Multi-Family Residential (Missing Middle)',
      '§16-35.010 Table A (no FAR — "12 units/building"); §16-35.011(1)(a) (35 ft); §16-35.011(5)(b) (4–12 dwelling units per lot, one principal building)',
    ),
    heightFt: 35,
    heightSource: '§16-35.011(1)a ("MR-1, MR-2, and MR-MU: No structure shall exceed 35 feet in height")',
    farUnconstrained: true,
  },

  // ── MRC Mixed Residential Commercial (Chapter 34) ───────────────────────
  // Base FAR only. The "Max. FAR with Bonuses" column (2.696 / 3.696 / 8.20 ×
  // GROSS lot area) is earned — see FACT 7 — and is never returned.
  'MRC-1': {
    ...base(
      'MRC-1 Mixed Residential Commercial',
      '§16-34.026(1)(a) / §16-34.010 Table A (nonresidential 1.0, residential 0.696, combined 1.696 × net lot area); §16-34.026(2)b (height tiered by distance)',
    ),
    heightTiers: [
      { label: 'within 150 ft of a protected district', heightFt: 35 },
      { label: '150–300 ft from a protected district', heightFt: 52 },
      { label: 'more than 300 ft from a protected district', heightFt: 225 },
    ],
    heightSource: '§16-34.026(2)b (protected districts: R-1 through R-5, R-G 1, R-G 2, MR-1, MR-2, PD-H)',
    farNonresidential: far(1.0, 'net', '§16-34.026(1)(a)i ("one times net lot area")'),
    farResidential: far(0.696, 'net', '§16-34.026(1)(a)ii ("six hundred ninety-six thousandths times net lot area")'),
    farCombined: far(1.696, 'net', '§16-34.026(1)(a)iii ("one and six hundred ninety-six thousandths times net lot area", sub-capped)'),
  },
  'MRC-2': {
    ...base(
      'MRC-2 Mixed Residential Commercial',
      '§16-34.027(1)(a) / §16-34.010 Table A (nonresidential 2.5, residential 1.49, combined 3.196 × net lot area); §16-34.027(2)b (height tiered by distance)',
    ),
    heightTiers: [
      { label: 'within 150 ft of a protected district', heightFt: 52 },
      { label: 'more than 150 ft from a protected district', heightFt: 225 },
    ],
    heightSource: '§16-34.027(2)b (protected districts: R-1 through R-5, R-G 1, R-G 2, MR-1, MR-2, PD-H)',
    farNonresidential: far(2.5, 'net', '§16-34.027(1)(a)i ("two and one-half times net lot area")'),
    farResidential: far(1.49, 'net', '§16-34.027(1)(a)ii ("one and forty-nine hundredths times net lot area")'),
    // ⚠️ THE ORDINANCE IS INTERNALLY INCONSISTENT HERE, and the figure entered
    // is the one it states rather than the one it implies. §16-34.027(1)(a)iii
    // reads "floor area shall not exceed THREE AND ONE HUNDRED NINETY-SIX
    // THOUSANDTHS times net lot area [the sum of the nonresidential i. and
    // residential ii. above]" — but 2.5 + 1.49 = 3.99, not 3.196. (3.196 is
    // 2.5 + 0.696, MRC-1's residential ratio, which is what the sentence would
    // have summed to before MRC-2's residential limb was raised.)
    //
    // 3.196 is written out in words in the operative sentence AND printed in
    // §16-34.010 Table A, so it is stated twice and the bracketed "sum" is an
    // editorial gloss that no longer reconciles. Publishing 3.99 would mean
    // publishing a number that appears nowhere in the code, in the direction
    // that permits a quarter more building. The sub-clause "but not greater
    // than the maximum floor areas permitted for each" binds either way.
    // The same sentence in MRC-1 (1.0 + 0.696 = 1.696), MRC-3 (4.0 + 3.2 = 7.2)
    // and LW (0.5 + 0.696 = 1.196) DOES reconcile; MRC-2 is the only one that
    // does not, which is what makes it a drafting artefact rather than a
    // pattern we have misread. Pinned by a test so it cannot be "corrected".
    farCombined: far(
      3.196,
      'net',
      '§16-34.027(1)(a)iii ("three and one hundred ninety-six thousandths times net lot area") and §16-34.010 Table A — NOT the arithmetic sum 3.99, which the code does not state anywhere',
    ),
  },
  'MRC-3': {
    ...base(
      'MRC-3 Mixed Residential Commercial',
      '§16-34.028(1)(a) / §16-34.010 Table A (nonresidential 4.0, residential 3.2, combined 7.2 × net lot area); §16-34.028(2)b (225 ft)',
    ),
    // Flat, unlike MRC-1/MRC-2 — §16-34.028(2)b as amended by Ord. No.
    // 2025-15(24-O-1586), 6-11-25: "Structures or portions of structures shall
    // have a maximum height of 225 feet."
    heightFt: 225,
    heightSource:
      '§16-34.028(2)b as amended by Ord. No. 2025-15(24-O-1586), 6-11-25 ("Structures or portions of structures shall have a maximum height of 225 feet")',
    farNonresidential: far(4.0, 'net', '§16-34.028(1)(a)i ("four times net lot area")'),
    farResidential: far(3.2, 'net', '§16-34.028(1)(a)ii ("three and two-tenths times net lot area")'),
    farCombined: far(7.2, 'net', '§16-34.028(1)(a)iii ("seven and two-tenths times net lot area", sub-capped)'),
  },

  // ── LW Live Work (Chapter 33) ───────────────────────────────────────────
  LW: {
    ...base(
      'LW Live Work',
      '§16-33.009(1)(a) (nonresidential 0.50, residential 0.696, combined 1.196 × net lot area); §16-33.010(2) (height tiered by distance)',
    ),
    heightTiers: [
      { label: 'within 150 ft of a protected district', heightFt: 35 },
      { label: 'more than 150 ft from a protected district', heightFt: 52 },
    ],
    heightSource: '§16-33.010(2) (protected districts: R-1 through R-5, R-G 1, R-G 2, MR-1, MR-2, PD-H)',
    farNonresidential: far(0.5, 'net', '§16-33.009(1)(a)i ("one-half times net lot area")'),
    farResidential: far(0.696, 'net', '§16-33.009(1)(a)ii ("six hundred ninety-six thousandths times net lot area")'),
    farCombined: far(1.196, 'net', '§16-33.009(1)(a)iii ("one and one hundred ninety-six thousandths times net lot area", sub-capped)'),
  },

  // ── PD Planned Development (Chapters 19, 19A, 19B, 19C) ─────────────────
  // A GAP, and specifically NOT an absence. Each PD chapter's intensity section
  // reads the same way — §16-19A.005: "Residential intensities and parking
  // ratios shall be permitted according to the appropriate sector number maximum
  // intensities and related ratios shown on Table I … AS APPROVED BY THE COUNCIL
  // through an application filed for a Planned Development Housing (PD-H)
  // District." A Table I sector DOES bind; which one is fixed in the approving
  // ordinance and is published in no dataset. Likewise no PD chapter states a
  // numeric maximum height — only transitional height planes.
  //
  // farUnconstrained therefore stays FALSE here. This is the opposite call from
  // Raleigh's PD, and deliberately: there, no UDO chapter contained a FAR
  // instrument for a master plan to modify, so the absence was real. Here the
  // instrument exists and we simply cannot read the value.
  'PD-H': {
    ...base(
      'PD-H Planned Development — Housing',
      '§16-19A.005 (Table I sector fixed by the approving council ordinance); ch. 19A states no numeric maximum height',
    ),
    planGoverned: true,
  },
  'PD-MU': {
    ...base(
      'PD-MU Planned Development — Mixed Use',
      '§16-19B.005 (Table I sector fixed by the approving council ordinance); ch. 19B states no numeric maximum height',
    ),
    planGoverned: true,
  },
  'PD-OC': {
    ...base(
      'PD-OC Planned Development — Office-Commercial',
      '§16-19C.005 (Table I sector fixed by the approving council ordinance); ch. 19C states no numeric maximum height',
    ),
    planGoverned: true,
  },
}

/** Unresolved. Asserts NOTHING — not a height, not a ratio, and specifically
 *  NOT `farUnconstrained` or `heightUnconstrained`. A district we have not read
 *  must never render as one whose code affirmatively imposes no limit. */
const UNRESOLVED: AtlantaLimits = Object.freeze({
  name: null,
  heightFt: null,
  heightUnconstrained: false,
  heightTiers: null,
  heightSource: null,
  farNonresidential: null,
  farResidential: null,
  farCombined: null,
  farUnconstrained: false,
  smallLot: null,
  farAlternatives: null,
  planGoverned: false,
  source: '',
})

/** Every district code this module resolves. Exported so a coverage test can
 *  compare it against the live layer's own vocabulary rather than a copy. */
export const ATLANTA_DISTRICT_CODES: readonly string[] = Object.freeze(Object.keys(DISTRICTS))

export interface AtlantaZoneParts {
  /** Base district key, e.g. 'R-4A' or 'MRC-3'. Null when unrecognised. */
  base: string | null
  /** The code carries the §16-02.003 conditional "-C" suffix: a council
   *  ordinance holds site conditions that may bind BELOW the base district. */
  conditional: boolean
  /** The normalised code string, for display. */
  normalized: string
}

/**
 * Decompose an Atlanta ZONECLASS string.
 *
 * The live layer's strings are not uniform — measured 2026-08-08 across the 245
 * distinct values it carries, the same district appears as 'I-MIX-C' and
 * 'I-Mix-C', and the SPI subarea spellings vary ('SPI-22 SA1' / 'SPI-22 SA-1',
 * 'SPI-4 SA11' / 'SPI-4 SA 11'). Uppercasing and whitespace collapsing handle
 * the first; the SPI variants are unresolved either way.
 *
 * ⚠️ The conditional suffix is stripped ONLY as a fallback, after a direct
 * lookup fails. Stripping it unconditionally would turn 'R-LC' into 'R-L' —
 * a real district silently becoming a gap because its own name ends in "-LC".
 */
export function parseAtlantaZone(code: string | null | undefined): AtlantaZoneParts {
  if (!code) return { base: null, conditional: false, normalized: '' }
  const z = code.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!z) return { base: null, conditional: false, normalized: '' }

  if (Object.hasOwn(DISTRICTS, z)) return { base: z, conditional: false, normalized: z }

  if (z.endsWith('-C')) {
    const stripped = z.slice(0, -2)
    if (Object.hasOwn(DISTRICTS, stripped)) return { base: stripped, conditional: true, normalized: z }
    return { base: null, conditional: true, normalized: z }
  }

  // The suffix can also sit mid-string on SPI codes ('SPI-9-C SA1'). None of
  // those resolve, but the conditional flag is still true and still worth
  // surfacing, because it is the reason a figure would be provisional.
  return { base: null, conditional: /-C(?=\s)/.test(z), normalized: z }
}

/**
 * Resolve what Part 16 states for an Atlanta zoning code.
 *
 * Every resolved result carries a section citation. An unrecognised code returns
 * UNRESOLVED, which asserts nothing — see the COVERAGE note in the header for
 * what is and is not in the table, and why the remainder is a gap rather than a
 * finding.
 *
 * NEVER derives feet from stories or stories from feet (FACT 5) — this module
 * has no story field at all — and never returns a bonus figure (FACT 7).
 */
export function resolveAtlanta(code: string | null | undefined): AtlantaLimits {
  const { base: key } = parseAtlantaZone(code)
  if (!key) return UNRESOLVED
  return DISTRICTS[key] ?? UNRESOLVED
}

/** What the small-lot branch produces on a lot of a given size, expressed the
 *  way `ParcelInfo` can carry it. Returns null when the rule does not apply
 *  (no rule, unknown lot, or a lot at/above the district minimum).
 *
 *  The code's sentence is "the lesser of either: N square feet of floor area;
 *  or a maximum floor area ratio of R", so the effective ratio on THIS lot is
 *  min(N / lot, R) — the arithmetic the ordinance directs, on a measured lot
 *  area, not a chosen program. R-5's "if the floor area ratio does not allow at
 *  least 1,800 square feet" clause is a greater-of floor on top and maps exactly
 *  onto `farFloorSqFt`. */
export function atlantaSmallLotFar(
  rule: AtlantaSmallLotRule | null,
  lotSqFt: number | null | undefined,
): { far: number; floorSqFt: number | null } | null {
  if (!rule || lotSqFt == null || !Number.isFinite(lotSqFt) || lotSqFt <= 0) return null
  if (lotSqFt >= rule.minLotSqFt) return null
  return {
    far: Math.min(rule.maxFloorAreaSqFt / lotSqFt, rule.far),
    floorSqFt: rule.guaranteedFloorSqFt ?? null,
  }
}

/**
 * Coarse use vocabulary for an Atlanta district.
 *
 * Read from each chapter's own "Permitted principal uses and structures"
 * section (2026-08-08), not inferred from the district's name.
 *
 * ⚠️ I-1 IS NOT RESIDENTIAL, and this is the mapping a name-based or
 * bulk-limitation-based guess gets wrong. §16-16.007(1) applies one FAR to all
 * uses and §16-16.007(4) even mentions multi-family open-space ratios, which
 * reads as if housing were permitted. It is not, as new construction:
 * §16-16.003(23) permits dwellings only as "Conversion of existing industrial
 * buildings which are 50 years of age or older to one-family, two-family, or
 * multi-family dwellings." A tool about new construction must not assert a
 * residential right that exists only for a 50-year-old building.
 *
 * Returns null where the code is unrecognised, or where the district's real
 * answer cannot be said in this four-token vocabulary.
 */
export function usesForZone(code: string | null | undefined): string[] | null {
  const { base: key } = parseAtlantaZone(code)
  if (!key) return null

  // Single-family / two-family / multi-family: residential only.
  if (/^R-[1-5]/.test(key) || key === 'FCR-3' || key.startsWith('MR-')) return ['residential']
  // R-G permits multi-family, single-family, dormitories, colleges, schools and
  // places of worship (§16-08.003) — no office or retail.
  if (key.startsWith('RG-')) return ['residential', 'institutional']
  // R-LC §16-09.003: single- and multi-family dwellings AND offices, clinics,
  // personal-service establishments, small restaurants.
  if (key === 'R-LC') return ['residential', 'commercial', 'mixed']
  // O-I §16-10.003: colleges, hospitals, dormitories, places of worship, offices
  // AND multi-family dwellings.
  if (key === 'O-I') return ['commercial', 'institutional', 'residential', 'mixed']
  // C-1…C-5 §§16-11.003…16-15.003 all permit dwellings outright (C-1/C-2/C-3
  // "Multi-family dwellings, two-family dwellings and single-family dwellings";
  // C-4/C-5 multi-family and single-room-occupancy residences).
  if (/^C-[1-5]$/.test(key)) return ['commercial', 'mixed', 'residential']
  // MRC and LW are mixed by construction — both chapters define mixed-use
  // development in their own bulk-limitation sections.
  if (key.startsWith('MRC-') || key === 'LW') return ['commercial', 'mixed', 'residential']
  // I-MIX §16-16A.008(1)(b): floor area not used for the required industrial
  // component "may be used for either exclusively residential uses, or
  // exclusively non-residential uses, or any combination of the two."
  if (key === 'I-MIX') return ['commercial', 'mixed', 'residential']
  // I-1 and I-2: see the warning above. I-2's §16-17.003 permits no dwellings at
  // all; I-1's permits them only as a conversion of a 50-year-old building.
  if (key === 'I-1' || key === 'I-2') return ['commercial', 'institutional']
  // PD: the approved plan sets the uses, so the base code says nothing.
  if (key.startsWith('PD-')) return null

  return null
}
