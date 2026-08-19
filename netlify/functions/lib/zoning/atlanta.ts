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
// ⚠️ SPI-16 RE-READ 2026-08-18, ALL ROWS. The 2026-08-17 pass recorded a figure
// per subarea under the heading "FAR" and was complete for the "Max FAR" row
// ALONE, of three FAR rows in Chapter 16-18P's table. What it recorded is
// arithmetically correct and is the WRONG NUMBER TO PUBLISH for most projects:
//
//   by-right col   Non-Residential   Residential   Max FAR
//   SA1                       5.0           3.2    8.2  = 5.0 + 3.2
//   SA2 JSTA          (not a ratio)         6.4    6.4  = residential alone
//   SA2 non-JSTA      (not a ratio)         3.2    3.2  = residential alone
//   SA3                       2.0           3.2    5.2  = 2.0 + 3.2
//
// MAX FAR IS A COMBINED CAP ACROSS A USE MIX, NOT A CEILING FOR ANY ONE PROGRAM.
// A residential building in SPI-16 SA1 is limited to 3.2, not 8.2 — publishing
// the recorded figure would have overstated a residential envelope by 2.6x, and
// in the flattering direction. That is rule 6 (do not report a maximum across
// alternatives as a ceiling), and reading one row of three is what concealed it:
// with only "Max FAR" in hand there is nothing to reveal that 8.2 is a sum.
//
// Note also that the additive relation holds here exactly as in SPI-20 — Max FAR
// equals the sum where the non-residential cell is a ratio and equals residential
// alone where it is not. Three chapters agree and SPI-21 still breaks it, so this
// remains corroboration and not a law; it is recorded because it is what makes
// the composition of 8.2 legible.
//
// ── HOW READINGS ARE RECORDED FROM NOW ON: ROWS, NOT CHAPTERS ───────────────
// "SPI-16 read" was true of a chapter and false of a table. Any multi-row grid
// can produce the same gap, and nothing downstream can see it, because a chapter
// marked read is treated as verified. So every reading below states the rows it
// covered and the rows it did not, and a chapter is only "read" when that list is
// exhaustive.
//
//   SPI-16 Ch. 16-18P table 2 — rows READ 2026-08-18:
//     [x] Non-Residential FAR (times gross lot area)
//     [x] Residential FAR (times gross lot area)
//     [x] Max FAR
//     [x] Maximum Height
//     [ ] Minimum Façade Height        — 24' in all ten columns; not modelled
//     [ ] Side Yard Setback            — not modelled
//     [ ] Rear Yard Setback            — not modelled
//   The unticked three are DECLARED out of the envelope model, not overlooked.
//
// The figures below are the Max FAR row and are retained because they are correct
// for a mixed-use program; the per-use limbs above are what a single-use project
// needs, and BOTH must be encoded together or the district is half-answered.
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
// denominator nothing we CURRENTLY fetch, and `far * lotSqFt` would be a number
// computed against the wrong area.
//
// ⚠️ BUT THIS IS NOT LA'S SHAPE, AND THE DIFFERENCE DECIDES THE REASON CODE.
// LA's buildable area subtracts the required front yard, which is the PREVAILING
// setback — the average of what neighbouring owners already built along 40% of
// the frontage. That is an as-built fact about the street with no layer behind
// it, and no spatial query can recover it. Genuinely unobtainable.
//
// Atlanta's gross is "all land within district boundaries plus half of adjoining
// permanent open space such as streets, parks, lakes, cemeteries … limited to no
// more than 50 feet". Streets, parks, lakes and cemeteries are PUBLISHED GEOMETRY
// in most cities, and half-width-capped-at-fifty is a spatial operation, not an
// inference. So this may be the MAP-KEYED shape — the instrument is spatial and
// the only question is whether Atlanta publishes the layers — rather than the
// basis-unavailable shape.
//
// ⚠️ THAT CHECK WAS RUN 2026-08-17, against every folder on gis.atlantaga.gov/dpcd.
// The answer is MAP-KEYED-BUT-UNPUBLISHED, which is neither of the two states
// guessed at:
//
//   Street ROW width   ANNOTATION ONLY. `Row-Width` in LandUsePlanning/
//                      CadastralLots is an "Annotation SubLayer" beneath
//                      GIS.Annotation_PRD — geometryType None, capabilities Map,
//                      and /query returns 400. It is cartographic TEXT drawn on
//                      the cadastral map, not data. This is the dominant term:
//                      essentially every urban parcel adjoins a street.
//   Parks              REAL. ReferenceData/ReferenceData layer 3, polygon,
//                      Query,Map,Data.
//   Water              ANNOTATION ONLY (same service, same parent).
//   Rivers/creeks      Real but a POLYLINE — no area to take half of.
//   Cemeteries         No layer in any dpcd folder.
//
// So the denominator cannot be computed today, and the minor term is the only
// one available.
//
// ⚠️ THAT IS STILL NOT LA'S STATE, AND THE DIFFERENCE IS THE WHOLE POINT. LA's
// prevailing setback is an as-built fact about what neighbours have already
// built; no layer could exist without surveying the street. Atlanta's ROW width
// is a RECORDED, MAPPED fact — the city literally draws it on this map, as a
// label. The obstacle is that it is published as cartography rather than as a
// feature layer, which is a data-publication gap, not an epistemic one.
//
// So this is a NAMED ASK — "Atlanta ROW width as a queryable feature layer" —
// joining Denver's Exhibit 8.1, San Diego's Figure H and Phoenix's § 1202.B/C.
// It is the fifth of that class and the FIRST where the spatial dependency sits
// in the DENOMINATOR rather than in the limit, which changes what to publish:
// the ratio stays sound and stateable with its basis labelled, and only the
// floor-area PRODUCT takes the reason code.
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

// ── SPI-20 GREENBRIAR (Ch. 16-18T) READ 2026-08-18, NOT ENCODED ─────────────
// Chosen as the first chapter to verify the mapping end-to-end because all six
// of its subareas carry live codes (SPI-20 SA1..SA6 in the 2026-08-17
// enumeration), so every column of its grid can be checked against a real
// parcel class. Three findings, and the third blocks encoding.
//
// ⚠️ 1. ONE ROW, TWO DIFFERENT QUANTITIES — and the label says so outright:
//        "Nonresidential FAR (base) or Maximum Percentage of Development"
//
//   subarea        1       2       3       4       5       6
//   nonres      2.5     1.5     1.0     20%      5%    None
//   residential 0.696   0.696   0.696   2.0     0.696   0.5
//   combined    3.196   2.196   1.696   2.0     0.696   0.5     <- the disproof
//
// Within SPI-20 the "Combined Maximum FAR without bonuses" row equals nonres +
// residential in subareas 1, 2, 3 and 6, and equals the RESIDENTIAL FIGURE ALONE
// in 4 and 5. So 20% and 5% are a use-mix cap on percentage of development, not a
// ratio. Reading the row uniformly — the mechanical application this chapter was
// chosen to test — publishes SPI-20 SA4 at a nonresidential FAR of 0.20 when the
// code states no nonresidential FAR for it at all.
//
// ⚠️ CORRECTION, same day, from SPI-21: THAT ARITHMETIC IS CORROBORATION, NOT
// PROOF, and the first version of this note claimed it as proof. The pattern is
// exact across all six SPI-20 subareas, which is what made it persuasive. SPI-21
// carries the identical row and breaks it twice with PLAIN RATIOS:
//
//   SA1   nonres 2.5  residential 2.0   sum 4.5   combined STATED 3.5
//   SA8   nonres 3.0  residential 3.2   sum 6.2   combined STATED 3.2
//
// SA8's combined equals its residential figure alone — the very signature
// claimed above as distinctive of the percentage columns. So "combined =
// residential alone" does not identify a non-FAR cell, and the Combined row is
// not a derived sum at all: it is an INDEPENDENTLY STATED CAP that is sometimes
// below the sum. It must be read, never computed.
//
// WHAT ACTUALLY CARRIES THE READING is the row label, which names both
// quantities outright — "or Maximum Percentage of Development" — together with
// the '%' glyph marking which cells are the second one. That is the evidence;
// the arithmetic agrees with it in SPI-20 and is silent in SPI-21.
//
// This is still Philadelphia's rule-15 shape INVERTED — there "70% of Lot Area"
// WAS the FAR expression and a well-argued test denied it; here a percentage in
// a FAR row is not a FAR. The correction is to WHICH instrument settles it: a
// pattern that holds perfectly across one chapter's six columns is a hypothesis
// with six confirmations, and six confirmations from inside one table are still
// internal verification (rule 9). The second chapter was the outside check.
//
// ⚠️ 2. THE BONUS CAP IS EXPLICITLY GROSS. "Under no circumstances shall the
// ratio of floor area to gross lot area of any development with bonuses exceed
// the amount indicated under 'Maximum Combined FAR With Bonuses'." Same basis
// problem as SPI-16, same answer: label it, never convert it.
//
// ⚠️ 3. AND THE RESIDENTIAL DENOMINATOR IS THE APPLICANT'S CHOICE, WHICH THE
// TYPE CANNOT HOLD. "Residential uses may use net lot area or gross lot area
// when calculating maximum permitted residential floor area, provided that
// usable open space requirements are met." That is not a fact about the parcel
// to be looked up — it is an election, so `AtlantaLotBasis = 'net' | 'gross'`
// has no correct value for this limb. Recording 'gross' would report a maximum
// across alternatives as if it were a ceiling (rule 6), and in the overstating
// direction, since gross >= net.
//
// ── HOW WIDESPREAD, measured across every SPI chapter 2026-08-18 ────────────
// All 23 SPI chapters in the Part 16 index were fetched (23/23; an earlier pass
// returned 403 on all 23 because urllib's default user-agent is blocked, and
// only a fetch COUNT made that visible — an empty scan would have reported
// "SPI-20 is unique" perfectly cleanly, rule 20). 19 are substantive; SPI-8,
// SPI-14, SPI-24 and SPI-25 return ~6KB stubs and are UNREAD, not clean.
//
// Across 27 FAR-labelled rows in those 19 chapters, exactly TWO carry a bare
// percentage cell: SPI-20 and SPI-21 — under a byte-identical label,
// "Nonresidential FAR (base) or Maximum Percentage of Development".
//
// SO THE PARSER MUST DETECT THE FORM, NOT THE POSITION. The percentages sit at
// columns 4-5 of 6 in SPI-20 and at columns 5-6 of 10 in SPI-21. Any positional
// rule fitted to one chapter is wrong in the other.
//
// ⚠️⚠️ AND THE LABEL IS NOT THE FORM EITHER — established by looking for the
// NEGATIVE case rather than more positives, which is the only reason it surfaced.
// Widening the scan from bare percentages to ANY '%' in a FAR-labelled row takes
// the count from 2 to FIVE, under THREE different labels and FOUR different cell
// forms:
//
//   SPI-20, SPI-21  "… FAR (base) or Maximum Percentage of Development"
//                   cell: `20%` / `5%`                        (bare percentage)
//   SPI-16          "Non-Residential FAR (times gross lot area)"
//                   cell: `On street level & street frontage 2,500 sf,
//                          max 5% residential floor area`     (prose + percentage)
//   SPI-17          "Max Non-Residential FAR (times gross lot area)"
//                   cell: `5% of the total occupied residential floor area`
//   SPI-11          "Non-residential FAR"
//                   cell: `Max 5% of Res. FAR`; and `N/A` in its Combined row
//
// Only SPI-20 and SPI-21 announce the dual quantity in the label. The other three
// carry a plainly-named FAR row whose cells are, for some subareas, not ratios at
// all — so "label says it holds two quantities" identifies 2 of 5.
//
// ⚠️ SCOPE OF THAT FIVE, stated here because this is where the number gets USED
// rather than only where it was measured. TWO boundaries, not one.
//
// FIRST, it was five of the chapters the scan COULD SEE. The negative-case check
// that produced it read row labels from column 0 only, and some tables put the
// row label in column 1 under a merged group header. Corrected 2026-08-18: FAR
// rows 27 -> 47 and rows carrying a '%' cell 5 -> 8. The finding that the LABEL
// cannot decide a cell still holds — it is strengthened, since the extra rows are
// more of the same — but "five chapters" was never the population.
//
// SECOND, it is five of the chapters that state FAR IN A TABLE. The scan walks expanded grid rows, so a chapter stating a ratio
// in prose is invisible to it — SPI-6 does exactly that ("a maximum floor area
// ratio of 0.348", no table in the chapter at all). "Five chapters carry
// non-ratio cells" therefore means "five of the nineteen tabular chapters", and
// any conclusion drawn from it inherits that boundary, including the claim that
// cell-level refusal covers every case. It covers every case THE GRID PARSER CAN
// SEE. Prose FAR is a second, unhandled form; no live code carries SPI-6 today,
// which is the only reason that is not urgent.
//
// THE RULE THAT COVERS ALL FIVE IS CELL-LEVEL: a cell in a FAR row is a floor
// area ratio ONLY if it parses as a bare number. Anything else — a percentage, a
// prose constraint, `None`, `N/A` — is NOT a ratio and must be refused rather
// than coerced, because every one of these forms would otherwise become a number
// (`20%` -> 0.20, `Max 5% of Res. FAR` -> 5 or 0.05). The label says what the row
// MEANS; only the cell says whether THIS subarea states a ratio.
//
// That is rule 5 at cell granularity: "this subarea states no non-residential FAR
// as a ratio" is an ANSWER, and it must not render as, or be filled in from, a
// number.
//
// ⚠️ AND THIS REACHES BACK INTO SPI-16, WHICH IS RECORDED ABOVE AS READ. The Max
// FAR figures (8.2 / 6.4 / 3.2 / 5.2, bonus 10.2 / 9.4 / 6.2 / 7.0) are CONFIRMED
// correct against the expanded grid. But that reading captured the "Max FAR" row
// only, and Chapter 16-18P's table carries three: Non-Residential FAR, Residential
// FAR, and Max FAR. The Non-Residential row is non-numeric in 4 of its 10 columns.
// A reading recorded as complete was complete for one row of three — which is the
// half-a-table shape, recorded here rather than left for the encoder to hit.
//
// ⚠️ THE SURVEY ALSO ONLY SEES TABLES. SPI-6 states "a maximum floor area ratio of
// 0.348" in PROSE with no table anywhere in the chapter, so a row-based scan is
// structurally blind to it. No live code carries SPI-6, so nothing depends on it
// today; recorded because "27 FAR rows across 19 chapters" describes tabular FAR
// only, and that is a property of the instrument, not of Atlanta.
//
// ── THE FOUR SHORT CHAPTERS ARE ANSWERS, NOT GAPS ───────────────────────────
// SPI-8, SPI-14, SPI-24 and SPI-25 return ~6KB because they are SHORT, not
// truncated: 4-5 complete sections each, regulating by reference to other
// districts. Measured: zero tables, zero occurrences of "FAR" or "floor area
// ratio", and no live zone code in the enumeration. They were recorded as UNREAD
// on first pass, which was wrong in the cautious direction — they are read, and
// they answer empty. A third instance of the dual-quantity form cannot hide in
// them, because a FAR grid is exactly what they do not have.
//
// (SPI-21 would NOT have served as the first chapter: its row has 10 columns and
// the enumeration carries 9 live SPI-21 codes, so one column could not have been
// checked against a parcel class.)
//
// So SPI-16's settled shape does NOT generalise, and one chapter was enough to
// show it. That is the whole return on verifying end-to-end before applying a
// mapping mechanically to twenty chapters: the fix here is a type decision, and
// it would have been twenty encodings deep by the time anything surfaced it.
//
// WHAT IS CLEAN AND WOULD ENCODE TODAY — the height row, which states plain
// figures with no basis question and no alternatives:
//   SA1 80 ft · SA2 52 ft · SA3 52 ft · SA4 80 ft · SA5 52 ft · SA6 35 ft
//
// NOT encoded pending the basis-election decision, so that heights and ratios
// land together rather than leaving a district half-answered.

/** Which lot-area denominator the code's own sentence multiplies the ratio by.
 *  Never converted between (FACT 2) — recorded so the number can be labelled. */
export type AtlantaLotBasis =
  | 'net'
  | 'gross'
  /** THE APPLICANT ELECTS. SPI-20: "Residential uses may use net lot area or
   *  gross lot area when calculating maximum permitted residential floor area."
   *  Distinct from 'gross' and the distinction is user-facing, not pedantic:
   *    'gross'         nobody can compute the product, because the denominator
   *                    needs a layer Atlanta publishes as cartography only.
   *                    A dead end until the city republishes ROW geometry.
   *    'net-or-gross'  the DEVELOPER knows which they will use and we do not.
   *                    The ratio is complete; the choice is theirs.
   *  One is a data gap, the other is a choice the tool cannot make on someone's
   *  behalf — so they must never share a sentence (rule 9: disclosure copy is
   *  code). 'net-or-gross' is the more useful of the two: it hands the reader a
   *  ratio and tells them the denominator is theirs to pick, which is actionable
   *  in a way "we cannot compute this" is not. */
  | 'net-or-gross'
  /** THE CODE STATES A DENOMINATOR AND DOES NOT QUALIFY IT, and nothing in scope
   *  resolves which one it means. Established for SPI-20 by slot test 2026-08-18,
   *  and the result is a THIRD outcome the test's usual two do not cover:
   *
   *    §16-18T.010(1)(a) states three parallel sentences drafted together —
   *      (i)   nonresidential: "the ratio of floor area to LOT AREA"        <- bare
   *      (ii)  residential:    "the ratio of floor area to NET LOT AREA"
   *      (iii) combined:       "the ratio of floor area to NET LOT AREA"
   *      (b)   with bonuses:   "the ratio of floor area to GROSS LOT AREA"
   *
   *  So the slot EXISTS and is FILLED — this is not an absence. But:
   *    · §16-29.001(37), the citywide "Floor area ratio" definition, supplies
   *      "net lot area" and scopes ITSELF to "any lot within the R-1 through R-5
   *      district". SPI-20 is not one, so the definition does not reach it.
   *    · Chapter 29 carries 96 numbered definitions and NONE defines "lot area",
   *      "net lot area" or "gross lot area" standalone.
   *    · The section's own citation, §16-29.001(24), is the MIXED-USE definition
   *      and says nothing about area.
   *
   *  Reading "net" across from the sibling sentences is exactly the invented
   *  conversion rule 4 forbids — it would be indistinguishable from a sourced
   *  basis in six months, and gross exceeds net, so the error would run in the
   *  flattering direction. The ratio itself is stated, cited and sound; only its
   *  denominator is unidentified, which is why this is a limb with a basis rather
   *  than a missing limb (rule 5: a stated ratio and no ratio must not render the
   *  same). */
  | 'unqualified'

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

/** THE THREE FAR LIMBS AN SPI SUBAREA STATES, and why `combined` is not a field
 *  callers read.
 *
 *  SPI-16 SA1 states non-residential 5.0, residential 3.2, and Max FAR 8.2 —
 *  where 8.2 is 5.0 + 3.2. It is a cap on a MIXED programme, not a ceiling
 *  available to any project: a residential building there is limited to 3.2, and
 *  publishing 8.2 to it overstates by 2.6x. That defect existed because a reading
 *  captured the combined row alone; putting `combined` on this object as a peer
 *  of the other two would rebuild it one layer down, since nothing at a call site
 *  would say the number is conditional on mixing uses.
 *
 *  So the field is NAMED for its condition and read through `atlantaFarFor`,
 *  which cannot return it without being told the programme. The direct field is
 *  pinned to a single reader by atlantaCombinedFar.test.ts, the same structural
 *  invariant as the Denver resolver's single caller (rule 14). */
export interface AtlantaSubareaFar {
  /** null means the code states NO non-residential ratio for this subarea — an
   *  ANSWER, not a missing lookup. Several subareas state a use-mix cap or a
   *  locational rule in that cell instead; see parseAtlantaFarCell. */
  nonResidential: AtlantaFarLimb | null
  residential: AtlantaFarLimb | null
  /** ⚠️ ONLY VALID FOR A PROGRAMME THAT MIXES USES. Never read directly — call
   *  atlantaFarFor(sub, 'mixed'). Named this way so a direct read is legible as
   *  wrong at the call site rather than only in this comment. */
  combinedIfMixedUse: AtlantaFarLimb | null
}

/** The FAR a project may use, given what it is building. The ONLY sanctioned way
 *  to reach a combined cap. Returns null where the code states no ratio for that
 *  programme — which is an answer and must render as one. */
export function atlantaFarFor(
  sub: AtlantaSubareaFar,
  programme: 'residential' | 'non-residential' | 'mixed',
): AtlantaFarLimb | null {
  if (programme === 'residential') return sub.residential
  if (programme === 'non-residential') return sub.nonResidential
  return sub.combinedIfMixedUse
}

/** A FAR cell is a ratio ONLY if it is a bare number.
 *
 *  Measured across all 23 SPI chapters 2026-08-18: five FAR-labelled rows carry a
 *  cell that is not a ratio, under three different labels and four different
 *  forms — `20%` (SPI-20/21), `Max 5% of Res. FAR` (SPI-11), `5% of the total
 *  occupied residential floor area` (SPI-17), a prose locational rule (SPI-16),
 *  plus `None` and `N/A`. Coercing any of them produces a plausible, silent,
 *  order-of-magnitude error in the flattering direction: `20%` -> 0.20,
 *  `Max 5% of Res. FAR` -> 0.05.
 *
 *  So this refuses everything that is not a bare number. It deliberately does NOT
 *  try to classify what the cell means instead — that is a reading, not a parse.
 *
 *  SCOPE: this sees GRID CELLS. A chapter stating a ratio in prose with no table
 *  (SPI-6: "a maximum floor area ratio of 0.348") never reaches it. */
export function parseAtlantaFarCell(raw: string): number | null {
  const t = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
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
  // ⚠️⚠️ TO ANYONE ADDING AN SPI SUBAREA: READ THAT SUBAREA'S OWN SENTENCE.
  // There is NO unit of Atlanta's zoning code at which the lot-area basis is
  // uniform. Not the city — §16-29.001(37) scopes itself to R-1 through R-5. Not
  // the chapter — SPI-20 and SPI-21 each leave exactly one limb unqualified and
  // it is a different limb. Not the section — SPI-15 §16-18O.028 states
  // residential against GROSS for Subareas 2 and 4 and against NET for Subarea 3,
  // in the same sentence form. Only the subarea.
  //
  // So a basis copied from a sibling entry below is wrong by default, and the
  // failure is invisible: every value in AtlantaLotBasis is legal, the types
  // check, the tests pass, and the parcel gets a floor area computed against the
  // wrong denominator. Eight distinct mechanisms across eleven chapters, none
  // predictable from the last — the list is in the per-chapter notes.

  // ── SPI SUBAREAS (Chapters 16-18P / 16-18T / 16-18U) ───────────────────────
  //
  // ⚠️ THE BASIS IS ASSIGNED PER LIMB AND PER CHAPTER, AND THE CHAPTERS DISAGREE.
  // Read from each chapter's own text 2026-08-18; NOT carried across, and the
  // reason that matters is that carrying it across would have been wrong:
  //
  //             nonresidential      residential            combined
  //   SPI-16    gross               gross                  gross      (row labels only)
  //   SPI-20    UNQUALIFIED         net-or-gross           net        (§16-18T.010)
  //   SPI-21    net                 net-or-gross           net        (§16-18U.012)
  //
  // SPI-20 and SPI-21 each have EXACTLY ONE unqualified limb and it is a
  // DIFFERENT one — nonresidential in SPI-20, residential in SPI-21. Assuming
  // the second mirrored the first would have tagged the wrong limb, and nothing
  // downstream could have detected it: both chapters look identical in shape.
  // SPI-16 states no bulk-limitations sentence at all; its basis exists only in
  // the table's row labels ("times gross lot area"). Three chapters, three
  // mechanisms.
  //
  // A NON-RATIO CELL ENCODES AS null. Several subareas state a use-mix cap or a
  // locational rule where a ratio would go (see parseAtlantaFarCell). null here
  // means "this subarea states no floor-area RATIO for that use", which is what
  // the code says; the non-ratio rule itself is not an envelope input and is not
  // modelled.
  //
  // HEIGHTS CONDITIONAL ON A NAMED STREET ARE REFUSED, NOT AVERAGED. SPI-16 SA3
  // ("100', 60' east of Piedmont Ave.") and SPI-21 SA1 ("225', 72' within 150'
  // of Ralph David Abernathy Blvd") both depend on distance from a street
  // centreline — map-keyed, and Atlanta publishes no queryable ROW layer. Both
  // carry heightFt: null with the figures disclosed as tiers, because publishing
  // the larger would overstate every parcel in the restricted band (rule 6).

  // ⚠️⚠️ THE ROW-LABEL SCAN WAS READING ONE COLUMN, AND SOME LABELS ARE IN THE
  // SECOND. Corrected 2026-08-18 after the slot test on the seven chapters that
  // appeared to have no FAR rows at all — every one of them states a FAR.
  //
  // The cause: a table may carry a merged GROUP label in column 0 spanning
  // several rows, with the actual row label in column 1. SPI-9's FAR rows sit
  // under a "Bulk Limitations" group; a scan reading r[0] sees the group name and
  // never the row. This is the merged-cell hazard this file already documents for
  // HEADERS, in the ROW dimension, and it was not looked for there.
  //
  // WHAT THE CORRECTION CHANGES — two figures previously recorded here were low:
  //     FAR-labelled rows across the 23 chapters   27  ->  47
  //     rows carrying a '%' cell                    5  ->   8
  // so "five chapters carry non-ratio cells" was five of those the scan could
  // see. Chapters whose FAR rows were entirely invisible: SPI-1 (4 rows),
  // SPI-9 (2), SPI-22 (5), and SPI-16 (3 -> 12).
  //
  // ⚠️ SPI-16 IS ALREADY ENCODED AND IS UNAFFECTED — by luck, not design. Its
  // nine unseen rows are all in the bonus-amenity schedule ("2.0 FAR — New
  // street", "0.5 FAR — Professional …"), which rule 6 excludes anyway, and the
  // by-right table it was encoded from sits in column 0. The same blindness in
  // SPI-1, SPI-9 and SPI-22 hid REAL by-right rows, so the outcome differed by
  // which table happened to be laid out which way.
  //
  // ── WHAT THE THREE HIDDEN CHAPTERS ACTUALLY CONTAIN ────────────────────────
  //
  // SPI-1 DOWNTOWN — substantial by-right figures, none of them previously seen:
  //   Non-residential Maximum FAR      25 · 12 · 10 · 7 · 10
  //   Residential Maximum FAR          25 · 12 · 10 · 7 · 10   (without workforce housing)
  //   Maximum Achievable Combined FAR  35 · 19 · 17 · 11 · 20
  // Not encoded: the workforce-housing row is a programme (rule 6) and the
  // basis is not yet read.
  //
  // ⚠️ SPI-9 BUCKHEAD VILLAGE — THE BY-RIGHT FAR IS NOT IN THE CODE. Its table
  // states "Max. FAR without Bonuses: According to Map Attachment", with only the
  // WITH-BONUS figures given numerically (8.2, 5.0 …). So the base ratio is
  // map-keyed and the only published numbers are a programme the applicant has
  // not chosen. This is a SIXTH named map-layer ask, alongside Atlanta ROW width,
  // Denver Exhibit 8.1, San Diego Figure H, Phoenix §1202.B/C and Charlotte's
  // site-plan basis — and the first where the MAP carries the ratio itself.
  //
  // SPI-22 MEMORIAL DRIVE — and it settles the rendering question SPI-18 raised.
  // One row carries the same footnote marker BOTH ways: "1.0 2" with the space
  // preserved, and "2.52" / "3.02" with it lost. So a fused footnote digit is
  // demonstrably a thing this source does, within a single row. That raises the
  // prior on SPI-18's 0.505 being 0.50 + a marker — and still does not license
  // correcting it, because SPI-18's numbered footnotes 4/5/6 are about sidewalks
  // and paving and a "5" there has nothing to point at. Evidence moved; the
  // standard did not.
  //
  // NOTE THE SHAPE OF THIS WHOLE ENTRY: the survey said "no FAR rows" for seven
  // chapters and the correct reading was "my scan cannot see these rows". Rule 11
  // — measure the pipeline, not the probe — and it took running the slot test on
  // an apparent absence to expose it.

  // ── SPI-18 MECHANICSVILLE IS READ AND DELIBERATELY NOT ENCODED ─────────────
  // Two unresolved questions, either of which alone would block it.
  //
  // ⚠️ 1. TWO PUBLISHED FIGURES IN ONE TABLE CONTRADICT EACH OTHER. §16-18R's
  // Development Controls Table states, for Subarea 10, a "Non-residential FAR
  // (base)" of 0.505 — and a "Maximum Combined FAR (without bonus)" of 1.196
  // against a residential base of 0.696. Nine of the ten columns are exactly
  // additive (combined = nonresidential + residential); the tenth misses by
  // 0.005, precisely the trailing digit.
  //
  // The likely cause is a fused footnote marker: this chapter renders footnotes
  // as trailing digits ("10% or 20% 1", "None or 5% 2"), and SPI-17's height
  // cells show the same pattern with the space preserved ("45' 2", "50' 2"). In
  // SPI-18 the space is gone. But the chapter's numbered footnotes 4, 5 and 6
  // are about sidewalks, tree grates and paving, so a "5" on a FAR row has
  // nothing to point at — which is evidence AGAINST the tidy explanation.
  //
  // So: 0.50 is almost certainly the figure, and "almost certainly" is not the
  // standard. Correcting a published cell from the table's own arithmetic is
  // exactly the inference this file refuses elsewhere, and the direction happens
  // to be favourable, which is when it is least trustworthy. Left unencoded and
  // recorded, rather than silently corrected or silently published.
  //
  // ⚠️ 2. ITS BASIS IS STATED NOWHERE. The row labels read "(base)" with no
  // denominator, and the chapter carries no "ratio of floor area to … lot area"
  // sentence at all — so the SPI-20 slot test has to be run against §16-18R
  // before any figure ships. Its coverage row says "as % of NLA", which is a
  // different quantity and must not be read across.
  //
  // ── WHAT THE 2026-08-18 SURVEY ESTABLISHED ABOUT THE REST ──────────────────
  // All 23 SPI chapters fetched and scanned. Only SPI-20 and SPI-21 carry a
  // bulk-limitations basis sentence; every other chapter states its denominator
  // in row labels, or not at all. Reconciled against the known-good pair before
  // being believed (rule 16) — the first run excluded them and so had nothing to
  // check the instrument against.
  //
  // FOUR MECHANISMS IN FIVE CHAPTERS, none predictable from the last:
  //   SPI-16  row labels, gross on every limb, no prose
  //   SPI-20  prose; nonresidential UNQUALIFIED, residential elective
  //   SPI-21  prose; the mirror — nonresidential net, residential elective
  //   SPI-2   row labels; nonresidential NET and residential GROSS, split
  //   SPI-17  row labels, gross on both, no combined row at all
  // Read every chapter's own sentences. Nothing carries across.

  // ── THE "GROUP HEADER + LETTERED SUB-ROWS" CHAPTERS ────────────────────────
  // SPI-3, SPI-4, SPI-11 and SPI-19 share a NINTH structural pattern: the FAR
  // row is an EMPTY group header ("Maximum FAR" / "Base FAR") with the figures in
  // lettered sub-rows beneath it — "a) Residential", "b) Non-Residential",
  // "c) Combined". A scan matching FAR-labelled rows finds the header, reads its
  // blank cells, and reports the chapter as stating no FAR. Three chapters showed
  // that symptom together, which is what made it an instrument question rather
  // than three coincidences (rule 25).
  //
  // ⚠️ BASIS: 'unqualified' ON THE BASE LIMBS, AND FOR A CONSISTENT REASON. SPI-3
  // and SPI-19 both state a denominator for the BONUS FAR ("Bonus FAR* net lot
  // area", "a floor area bonus of one-times net lot area") and none for the base.
  // SPI-4 states none anywhere. SPI-12's only net/gross sentence governs open
  // space, not FAR. So the drafting pattern is that the incentive is specified
  // and the entitlement is not — and reading the bonus basis across to the base
  // would be an inference from a different provision in the same chapter.
  // SPI-11 is the exception: §16-18K.008 makes RESIDENTIAL elective outright.
  'SPI-3 SA1': {
    ...base('SPI-3 English Avenue (Subarea 1)', '§16-18C.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.50, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 35,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA2': {
    ...base('SPI-3 English Avenue (Subarea 2)', '§16-18C.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.696, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA3': {
    ...base('SPI-3 English Avenue (Subarea 3)', '§16-18C.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.00, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA4': {
    ...base('SPI-3 English Avenue (Subarea 4)', '§16-18C.007'),
    farNonresidential: far(0.50, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(1.00, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(1.50, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 40,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA5': {
    ...base('SPI-3 English Avenue (Subarea 5)', '§16-18C.007'),
    farNonresidential: far(2.00, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(1.30, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(3.30, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA6': {
    ...base('SPI-3 English Avenue (Subarea 6)', '§16-18C.007'),
    farNonresidential: far(2.00, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(4.00, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 75,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA7': {
    ...base('SPI-3 English Avenue (Subarea 7)', '§16-18C.007'),
    farNonresidential: far(2.00, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(4.00, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(6.00, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 105,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA8': {
    ...base('SPI-3 English Avenue (Subarea 8)', '§16-18C.007'),
    farNonresidential: far(2.00, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(1.30, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(3.30, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 45,
    heightSource: '§16-18C.007 Table, "Maximum Building Height"',
  },
  'SPI-3 SA9': {
    ...base('SPI-3 English Avenue (Subarea 9)', '§16-18C.007'),
    farNonresidential: far(1.10, 'unqualified', '§16-18C.007 Table, "b) Non-Residential"'),
    farResidential: far(1.10, 'unqualified', '§16-18C.007 Table, "a) Residential"'),
    farCombined: far(2.20, 'unqualified', '§16-18C.007 Table, "c) Combined" — stated, not derived'),
    heightSource: '§16-18C.007 Table, "Maximum Building Height Along Streets": Subarea 9 is stated as "Based on Block" — a per-block determination this project cannot resolve',
  },
  'SPI-4 SA1': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 1)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.50, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 35,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA2': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 2)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.49, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA3': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 3)', '§16-18D.008'),
    farNonresidential: far(0.50, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(1.49, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA4': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 4)', '§16-18D.008'),
    farNonresidential: far(1.00, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 55,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA5': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 5)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(2.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 105,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA6': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 6)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(2.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 55,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA7': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 7)', '§16-18D.008'),
    farNonresidential: far(0.50, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(1.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA8': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 8)', '§16-18D.008'),
    farNonresidential: far(2.00, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(1.30, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 45,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA9': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 9)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.50, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 35,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA10': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 10)', '§16-18D.008'),
    farNonresidential: far(2.00, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(4.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 105,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA11': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 11)', '§16-18D.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-4 SA12': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 12)', '§16-18D.008'),
    farNonresidential: far(3.00, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(3.20, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightUnconstrained: true,
    heightSource: '§16-18D.008 Table, "Maximum Building Height (ft)": None',
  },
  'SPI-4 SA13': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 13)', '§16-18D.008'),
    farNonresidential: far(2.00, 'unqualified', '§16-18D.008 Table, "b) Non-Residential"'),
    farResidential: far(4.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightTiers: [
      { label: 'base', heightFt: 105 },
      { label: 'alternative stated in the table footnote', heightFt: 290 },
    ],
    heightSource: '§16-18D.008 Table, "Maximum Building Height (ft)": "105\' or 290\' **" — two figures, so no single one is resolved',
  },
  // The live layer spells Subarea 11 both ways. Enumerated, not pattern-matched.
  'SPI-4 SA 11': {
    ...base('SPI-4 Ashview Heights / AUC (Subarea 11)', '§16-18D.008'),
    farNonresidential: null, // table states N/A
    farResidential: far(1.00, 'unqualified', '§16-18D.008 Table, "a) Residential"'),
    farCombined: null,
    heightFt: 40,
    heightSource: '§16-18D.008 Table, "Maximum Building Height"',
  },
  'SPI-11 SA2': {
    ...base('SPI-11 Vine City & Ashby Station (Subarea 2)', '§16-18K.008'),
    farNonresidential: far(1.00, 'unqualified', '§16-18K.008 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'net-or-gross', '§16-18K.008 Table, "a) Residential" (§16-18K.008: residential may utilise net or gross lot area)'),
    farCombined: far(3.00, 'unqualified', '§16-18K.008 Table, "c) Combined" — stated, not derived'),
    heightFt: 40,
    heightSource: '§16-18K.008 Table, "Maximum Building Height"',
  },
  'SPI-11 SA6': {
    ...base('SPI-11 Vine City & Ashby Station (Subarea 6)', '§16-18K.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.50, 'net-or-gross', '§16-18K.008 Table, "a) Residential" (§16-18K.008: residential may utilise net or gross lot area)'),
    farCombined: null, // table states N/A,
    heightFt: 35,
    heightSource: '§16-18K.008 Table, "Maximum Building Height"',
  },
  'SPI-11 SA8': {
    // Subarea 8 states "Max 5% of Res. FAR" for non-residential — a share of another limb, not a ratio on the lot
    ...base('SPI-11 Vine City & Ashby Station (Subarea 8)', '§16-18K.008'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.49, 'net-or-gross', '§16-18K.008 Table, "a) Residential" (§16-18K.008: residential may utilise net or gross lot area)'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18K.008 Table, "Maximum Building Height"',
  },
  'SPI-11 SA9': {
    ...base('SPI-11 Vine City & Ashby Station (Subarea 9)', '§16-18K.008'),
    farNonresidential: far(1.00, 'unqualified', '§16-18K.008 Table, "b) Non-Residential"'),
    farResidential: far(1.696, 'net-or-gross', '§16-18K.008 Table, "a) Residential" (§16-18K.008: residential may utilise net or gross lot area)'),
    farCombined: far(2.696, 'unqualified', '§16-18K.008 Table, "c) Combined" — stated, not derived'),
    heightFt: 35,
    heightSource: '§16-18K.008 Table, "Maximum Building Height"',
  },
  'SPI-19 SA1': {
    ...base('SPI-19 Vine City (Subarea 1)', '§16-18S.007'),
    farNonresidential: far(1.00, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(3.00, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA2': {
    ...base('SPI-19 Vine City (Subarea 2)', '§16-18S.007'),
    farNonresidential: far(1.00, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(3.00, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA3': {
    ...base('SPI-19 Vine City (Subarea 3)', '§16-18S.007'),
    farNonresidential: far(3.00, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(3.20, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(6.20, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA4': {
    ...base('SPI-19 Vine City (Subarea 4)', '§16-18S.007'),
    farNonresidential: far(4.00, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(3.20, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(7.20, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 105,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA5': {
    ...base('SPI-19 Vine City (Subarea 5)', '§16-18S.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.00, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA6': {
    ...base('SPI-19 Vine City (Subarea 6)', '§16-18S.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(0.5, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 35,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA7': {
    ...base('SPI-19 Vine City (Subarea 7)', '§16-18S.007'),
    farNonresidential: null, // table states N/A or a non-ratio rule,
    farResidential: far(1.50, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: null, // table states N/A,
    heightFt: 40,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA8': {
    ...base('SPI-19 Vine City (Subarea 8)', '§16-18S.007'),
    farNonresidential: far(2.50, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(1.48, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(3.99, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA10': {
    ...base('SPI-19 Vine City (Subarea 10)', '§16-18S.007'),
    farNonresidential: far(1, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(0.8, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(1.8, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 40,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },
  'SPI-19 SA11': {
    ...base('SPI-19 Vine City (Subarea 11)', '§16-18S.007'),
    farNonresidential: far(2.00, 'unqualified', '§16-18S.007 Table, "b) Non-Residential"'),
    farResidential: far(2.00, 'unqualified', '§16-18S.007 Table, "a) Residential"'),
    farCombined: far(4.00, 'unqualified', '§16-18S.007 Table, "c) Combined" — stated, not derived'),
    heightFt: 55,
    heightSource: '§16-18S.007 Table, "Maximum Building Height"',
  },

  // ── SPI-15 LINDBERGH — PROSE *AND* PER-SUBAREA (§16-18O.028 / §16-18O.029) ──
  // The hardest chapter so far: the ratios are written out IN WORDS ("six hundred
  // ninety-six-one thousandths times gross lot area"), there is no development
  // controls grid, and §16-18O.010 does not state figures at all — it defers with
  // "See specific regulations for each subarea at sections 16-18O.028 and
  // 16-18O.029". The roster splits nine subareas into commercial (1, 2, 3, 4, 9)
  // and residential (5, 6, 7, 8).
  //
  // ⚠️ AN EIGHTH FINDING: THE BASIS VARIES BETWEEN SUBAREAS OF ONE CHAPTER.
  // Subareas 2 and 4 state residential against GROSS lot area; Subarea 3 states
  // it against NET, in the same section, in the same sentence form. So "read the
  // chapter's basis" is not fine-grained enough either — it is per LIMB and per
  // SUBAREA, and nothing about Subarea 3 is predictable from Subarea 2.
  //
  // ⚠️ AND THE CODE'S OWN GLOSS IS WRONG FOR TWO SUBAREAS. Each mixed-use clause
  // reads "shall not exceed N times net lot area [the sum of the nonresidential
  // (i) and residential (ii) above]". For Subarea 1 that holds (1.0 + 0.696 =
  // 1.696) and for Subarea 3 it holds (4.0 + 4.2 = 8.2). For Subarea 2 the stated
  // figure is 2.0 against a sum of 4.0, and for Subarea 4 it is 3.0 against 6.0.
  // The operative words govern and the bracket is explanatory — so the stated
  // figure is encoded and the gloss is not computed from. Third chapter where a
  // combined cap must be READ rather than derived.
  //
  // NON-RESIDENTIAL IN THE RESIDENTIAL SUBAREAS IS NOT A RATIO: §16-18O.029(4)
  // caps it at "five percent of total built residential floor area" — a share of
  // the building, not of the lot — so farNonresidential is null there.
  //
  // HEIGHTS: Subarea 1 is tiered on distance from R-1..R-G / PD-H (35 ft within
  // 150 ft, 52 ft between 150 and 300 ft) — map-keyed, so no single figure.
  // Subareas 2-5 are 225 ft per §16-18O.028; the residential subareas are 225 ft
  // per §16-18O.029(3)(b). Subarea 9 states "Maximum building heights shall
  // conform to Attachment C" — a SECOND map-keyed height in Atlanta, joining
  // SPI-9's map-keyed FAR.
  'SPI-15 SA1': {
    ...base('SPI-15 Miami Circle Commercial (Subarea 1)', '§16-18O.028'),
    farNonresidential: far(1.0, 'net', '§16-18O.028, "For nonresidential uses, floor area shall not exceed an amount equal to 1.0 times net lot area"'),
    farResidential: far(0.696, 'gross', '§16-18O.028, "For residential uses, floor area shall not exceed an amount equal to 0.696 times gross lot area"'),
    farCombined: far(1.696, 'net', '§16-18O.028 mixed-use clause — the STATED figure; the bracketed "sum of" gloss does not hold for every subarea'),
    heightTiers: [
      { label: 'within 150 ft of an R-1 through R-G or PD-H district', heightFt: 35 },
      { label: 'between 150 ft and 300 ft of an R-1 through R-G or PD-H district', heightFt: 52 },
    ],
    heightSource: '§16-18O.028 — keyed to distance from R-1..R-G / PD-H districts, so no single figure is resolved',
  },
  'SPI-15 SA2': {
    ...base('SPI-15 Sydney Marcus Commercial (Subarea 2)', '§16-18O.028'),
    farNonresidential: far(2.0, 'net', '§16-18O.028, "For nonresidential uses, floor area shall not exceed an amount equal to 2.0 times net lot area"'),
    farResidential: far(2.0, 'gross', '§16-18O.028, "For residential uses, floor area shall not exceed an amount equal to 2.0 times gross lot area"'),
    farCombined: far(2.0, 'net', '§16-18O.028 mixed-use clause — the STATED figure; the bracketed "sum of" gloss does not hold for every subarea'),
    heightFt: 225,
    heightSource: '§16-18O.028 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA3': {
    ...base('SPI-15 Piedmont Commercial (Subarea 3)', '§16-18O.028'),
    farNonresidential: far(4.0, 'net', '§16-18O.028, "For nonresidential uses, floor area shall not exceed an amount equal to 4.0 times net lot area"'),
    farResidential: far(4.2, 'net', '§16-18O.028, "For residential uses, floor area shall not exceed an amount equal to 4.2 times net lot area"'),
    farCombined: far(8.2, 'net', '§16-18O.028 mixed-use clause — the STATED figure; the bracketed "sum of" gloss does not hold for every subarea'),
    heightFt: 225,
    heightSource: '§16-18O.028 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA4': {
    ...base('SPI-15 Garson Commercial (Subarea 4)', '§16-18O.028'),
    farNonresidential: far(3.0, 'net', '§16-18O.028, "For nonresidential uses, floor area shall not exceed an amount equal to 3.0 times net lot area"'),
    farResidential: far(3.0, 'gross', '§16-18O.028, "For residential uses, floor area shall not exceed an amount equal to 3.0 times gross lot area"'),
    farCombined: far(3.0, 'net', '§16-18O.028 mixed-use clause — the STATED figure; the bracketed "sum of" gloss does not hold for every subarea'),
    heightFt: 225,
    heightSource: '§16-18O.028 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA5': {
    ...base('SPI-15 Sydney Marcus West Residential (Subarea 5)', '§16-18O.029'),
    farNonresidential: null, // §16-18O.029(4) caps non-residential at 5% of built residential floor area — a share of the building, not a ratio on the lot,
    farResidential: far(3.2, 'gross', '§16-18O.029, "For residential uses, floor area shall not exceed an amount equal to 3.2 times gross lot area"'),
    heightFt: 225,
    heightSource: '§16-18O.029 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA6': {
    ...base('SPI-15 Sydney Marcus East Residential (Subarea 6)', '§16-18O.029'),
    farNonresidential: null, // §16-18O.029(4) caps non-residential at 5% of built residential floor area — a share of the building, not a ratio on the lot,
    farResidential: far(0.696, 'gross', '§16-18O.029, "For residential uses, floor area shall not exceed an amount equal to 0.696 times gross lot area"'),
    heightFt: 225,
    heightSource: '§16-18O.029 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA7': {
    ...base('SPI-15 Garson Residential (Subarea 7)', '§16-18O.029'),
    farNonresidential: null, // §16-18O.029(4) caps non-residential at 5% of built residential floor area — a share of the building, not a ratio on the lot,
    farResidential: far(1.49, 'gross', '§16-18O.029, "For residential uses, floor area shall not exceed an amount equal to 1.49 times gross lot area"'),
    heightFt: 225,
    heightSource: '§16-18O.029 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA8': {
    ...base('SPI-15 Lindbergh Residential (Subarea 8)', '§16-18O.029'),
    farNonresidential: null, // §16-18O.029(4) caps non-residential at 5% of built residential floor area — a share of the building, not a ratio on the lot,
    farResidential: far(1.15, 'gross', '§16-18O.029, "For residential uses, floor area shall not exceed an amount equal to 1.15 times gross lot area"'),
    heightFt: 225,
    heightSource: '§16-18O.029 — 225 feet along each façade visible from the public right-of-way',
  },
  'SPI-15 SA9': {
    ...base('SPI-15 MARTA Lindbergh City Center (Subarea 9)', '§16-18O.028'),
    farNonresidential: far(4.0, 'net', '§16-18O.028, "For nonresidential uses, floor area shall not exceed an amount equal to 4.0 times net lot area"'),
    farResidential: far(4.2, 'net', '§16-18O.028, "For residential uses, floor area shall not exceed an amount equal to 4.2 times net lot area"'),
    heightSource: '§16-18O.028 — Subarea 9 heights conform to Attachment C (MARTA Lindbergh City Center Station SPI-15 SA-9 Height Maximums), a map this project cannot read',
  },

  // ── PROSE-FAR CHAPTERS: SPI-5, SPI-7, SPI-26 ──────────────────────────────
  // A SEVENTH mechanism. These chapters carry NO development-controls grid at
  // all — the ratio is a sentence in the ordinance text, so every table-based
  // scan in this repo is structurally blind to them (the same shape as SPI-6,
  // which states "a maximum floor area ratio of 0.348" and has no table).
  //
  // ⚠️ AND THE SENTENCE IS SCOPED. The figure is not district-wide in SPI-5 or
  // SPI-7: it sits inside a section whose TITLE names the subareas it governs —
  // §16-18E.010 "Residential subareas" and §16-18G.009 "Residential Subareas 2
  // and 3". Reading either as the chapter's FAR would publish a residential
  // ratio onto a subarea the section never reaches. SPI-5 Subarea 1 is "Public
  // open space or park"; SPI-7 Subarea 1 is outside §16-18G.009 by its own
  // title. Both are left unresolved rather than filled from a neighbour.
  //
  // BASIS IS 'unqualified' IN ALL THREE, for the SPI-20 reason: the sentence
  // states a ratio and no denominator, and §16-29.001(37) — which would supply
  // "net" — scopes itself to R-1 through R-5 and does not reach an SPI district.
  //
  // NO HEIGHT IS ENCODED. SPI-5 and SPI-7 state only accessory-structure limits
  // (25 ft, or the height of the main structure); SPI-26's 35 ft attaches to one
  // named building (the Gresham Hall replacement), not to the district. None of
  // that is a district maximum, and none of it is a stated ABSENCE either, so
  // heightFt stays null and heightUnconstrained stays false.
  'SPI-5 SA2': {
    ...base('SPI-5 Inman Park — North Highland-Sinclair (Subarea 2)', '§16-18E.010'),
    heightSource: '§16-18E.010 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure, §16-18E.008(7)e). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18E.010(4): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  'SPI-5 SA3': {
    ...base('SPI-5 Inman Park — Freedom Park (Subarea 3)', '§16-18E.010'),
    heightSource: '§16-18E.010 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure, §16-18E.008(7)e). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18E.010(4): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  'SPI-7 SA2A': {
    ...base('SPI-7 Candler Park (Subarea 2A)', '§16-18G.009'),
    heightSource: '§16-18G.009 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18G.009(5): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  'SPI-7 SA2B': {
    ...base('SPI-7 Candler Park (Subarea 2B)', '§16-18G.009'),
    heightSource: '§16-18G.009 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18G.009(5): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  'SPI-7 SA2C': {
    ...base('SPI-7 Candler Park (Subarea 2C)', '§16-18G.009'),
    heightSource: '§16-18G.009 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18G.009(5): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  'SPI-7 SA3': {
    ...base('SPI-7 Candler Park (Subarea 3)', '§16-18G.009'),
    heightSource: '§16-18G.009 states no district maximum height — only accessory-structure limits (25 ft or the height of the main structure). Not a stated absence either, so no height is asserted',
    farResidential: far(0.5, 'unqualified', '§16-18G.009(5): "The residential, or dwelling, floor area ratio shall not exceed 0.50"'),
  },
  // SPI-26 is the one district-wide case: "The maximum floor area ratio WITHIN
  // THIS DISTRICT shall not exceed 0.50" — all uses, one ratio, one live code.
  'SPI-26': {
    ...base('SPI-26 Chastain Park Galloway School', '§16-18Z.007'),
    heightSource: '§16-18Z.008 states a 35 ft maximum for ONE named building (the Gresham Hall replacement), not for the district, so no district height is asserted',
    farNonresidential: far(0.5, 'unqualified', '§16-18Z.007(5): "The maximum floor area ratio within this district shall not exceed 0.50"'),
    farResidential: far(0.5, 'unqualified', '§16-18Z.007(5): "The maximum floor area ratio within this district shall not exceed 0.50"'),
    farCombined: far(0.5, 'unqualified', '§16-18Z.007(5): "The maximum floor area ratio within this district shall not exceed 0.50"'),
  },

  // SPI-1 Downtown — §16-18A.008. A FIFTH basis mechanism: stated in TABLE
  // FOOTNOTES, with the markers sitting on the row labels ("Non-residential
  // Maximum FAR 1"). Footnote 1: "Non-residential FAR shall be multiplied by net
  // lot area (NLA)". Footnote 2: "Residential FAR may be multiplied by net lot
  // area (NLA) or gross area of a regular lot (GLA)". So the limbs split — one
  // fixed, one elective — and neither is stated in prose or in a row label.
  //
  // ⚠️ HEIGHT IS AN ANSWER HERE, NOT A GAP. "Maximum Building Height: None" in
  // all seven columns, so heightUnconstrained is TRUE: downtown intensity is
  // governed by FAR instead. That is the FACT-3 shape — a stated absence, which
  // must not render like a district nobody read (rule 5).
  //
  // ⚠️ farCombined IS DELIBERATELY NULL, and the reason is a cross-chapter trap.
  // The row is "Maximum Achievable Combined FAR" (35/19/17/11/20/32/32) and this
  // chapter never says whether "achievable" includes bonuses. SPI-22 splits the
  // very same phrase into TWO rows — "Maximum Achievable Combined Base FAR" and
  // "Maximum Achievable Combined Bonus FAR" — so the phrase is demonstrably
  // ambiguous inside this code, and reading SPI-1's as the base is an inference
  // FROM ANOTHER CHAPTER. That is precisely the move five chapters of basis
  // findings say is unsafe. The figure is recorded here and not published.
  'SPI-1 SA1': {
    ...base('SPI-1 Downtown Core (Subarea 1)', '§16-18A.008'),
    farNonresidential: far(25, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(25, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA2': {
    ...base('SPI-1 SoNo Commercial West (Subarea 2)', '§16-18A.008'),
    farNonresidential: far(12, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(12, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA3': {
    ...base('SPI-1 SoNo Commercial East (Subarea 3)', '§16-18A.008'),
    farNonresidential: far(10, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(10, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA4': {
    ...base('SPI-1 SoNo Residential (Subarea 4)', '§16-18A.008'),
    farNonresidential: far(7, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(7, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA5': {
    ...base('SPI-1 Centennial Olympic Park (Subarea 5)', '§16-18A.008'),
    farNonresidential: far(10, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(10, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA6': {
    ...base('SPI-1 Terminus (Subarea 6)', '§16-18A.008'),
    farNonresidential: far(25, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(25, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },
  'SPI-1 SA7': {
    ...base('SPI-1 Fairlie Poplar (Subarea 7)', '§16-18A.008'),
    farNonresidential: far(25, 'net', '§16-18A.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA)'),
    farResidential: far(25, 'net-or-gross', '§16-18A.008 Table, "Residential Maximum FAR without Workforce Housing", footnote 2 (NLA or GLA)'),
    heightUnconstrained: true,
    heightSource: '§16-18A.008 Table, "Maximum Building Height": None in every subarea',
  },

  // SPI-22 Memorial Drive/Oakland Cemetery — §16-18V.008. A SIXTH mechanism:
  // footnote 1 reads "FAR shall be multiplied by NLA or GLA", applied to FAR
  // GENERALLY rather than split by use — so every limb is elective, where SPI-1
  // splits its two. Both chapters put the basis in a footnote and assign it
  // differently.
  //
  // Heights are street-distance conditional in three of four subareas (footnotes
  // 9, 10 and 11), so those publish no single figure. Subarea 2 states a flat
  // 64 ft and resolves.
  //
  // farCombined is NOT the sum in Subareas 3 and 4 (1.0 + 2.5 = 3.5 against a
  // stated 3.0) — footnote 3 requires residential and non-residential
  // requirements to be met separately. Read, never computed.
  'SPI-22 SA1': {
    ...base('SPI-22 MLK Lofts (Subarea 1)', '§16-18V.008'),
    farNonresidential: far(2.0, 'net-or-gross', '§16-18V.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farResidential: far(4.0, 'net-or-gross', '§16-18V.008 Table, "Residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farCombined: far(6.0, 'net-or-gross', '§16-18V.008 Table, "Maximum Achievable Combined Base FAR", footnote 1'),
    heightTiers: [
      { label: 'more than 200 ft from Martin Luther King Jr. Dr. or Oakland Ave.', heightFt: 200 },
      { label: 'all other areas', heightFt: 76 },
    ],
    heightSource: '§16-18V.008 Table, "Maximum Building Height" — footnote 9, map-keyed on distance from named streets, so no single figure is resolved',
  },
  // The live layer spells Subarea 1 BOTH ways. Enumerated, not pattern-matched.
  'SPI-22 SA-1': {
    ...base('SPI-22 MLK Lofts (Subarea 1)', '§16-18V.008'),
    farNonresidential: far(2.0, 'net-or-gross', '§16-18V.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farResidential: far(4.0, 'net-or-gross', '§16-18V.008 Table, "Residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farCombined: far(6.0, 'net-or-gross', '§16-18V.008 Table, "Maximum Achievable Combined Base FAR", footnote 1'),
    heightTiers: [
      { label: 'more than 200 ft from Martin Luther King Jr. Dr. or Oakland Ave.', heightFt: 200 },
      { label: 'all other areas', heightFt: 76 },
    ],
    heightSource: '§16-18V.008 Table, "Maximum Building Height" — footnote 9, map-keyed on distance from named streets, so no single figure is resolved',
  },
  'SPI-22 SA2': {
    ...base('SPI-22 Memorial Drive (Subarea 2)', '§16-18V.008'),
    farNonresidential: far(2.0, 'net-or-gross', '§16-18V.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farResidential: null, // table states "None",
    farCombined: far(2.0, 'net-or-gross', '§16-18V.008 Table, "Maximum Achievable Combined Base FAR", footnote 1'),
    heightFt: 64,
    heightSource: '§16-18V.008 Table, "Maximum Building Height"',
  },
  'SPI-22 SA3': {
    ...base('SPI-22 Capitol Gateway (Subarea 3)', '§16-18V.008'),
    farNonresidential: far(1.0, 'net-or-gross', '§16-18V.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farResidential: far(2.5, 'net-or-gross', '§16-18V.008 Table, "Residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farCombined: far(3.0, 'net-or-gross', '§16-18V.008 Table, "Maximum Achievable Combined Base FAR", footnote 1'),
    heightTiers: [
      { label: 'more than 50 ft from Memorial Dr. and west of Fraser St.', heightFt: 225 },
      { label: 'all other areas', heightFt: 66 },
    ],
    heightSource: '§16-18V.008 Table, "Maximum Building Height" — footnote 10, map-keyed on distance from named streets, so no single figure is resolved',
  },
  'SPI-22 SA4': {
    ...base('SPI-22 Grant Park North (Subarea 4)', '§16-18V.008'),
    farNonresidential: far(1.0, 'net-or-gross', '§16-18V.008 Table, "Non-residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farResidential: far(2.5, 'net-or-gross', '§16-18V.008 Table, "Residential Maximum FAR", footnote 1 (NLA or GLA)'),
    farCombined: far(3.0, 'net-or-gross', '§16-18V.008 Table, "Maximum Achievable Combined Base FAR", footnote 1'),
    heightTiers: [
      { label: 'within 200 ft of Memorial Dr., east of Cherokee Ave. or 150+ ft west of Harden St.', heightFt: 66 },
      { label: 'within 200 ft of Memorial Dr., all other areas', heightFt: 58 },
      { label: 'more than 200 ft from Memorial Dr., adjacent to Hill St., Cherokee Ave. or Boulevard', heightFt: 50 },
      { label: 'all other areas', heightFt: 35 },
    ],
    heightSource: '§16-18V.008 Table, "Maximum Building Height" — footnote 11, map-keyed on distance from named streets, so no single figure is resolved',
  },

  // SPI-2 Fort McPherson — §16-18B.008. A FOURTH basis mechanism: the two limbs
  // carry DIFFERENT denominators, stated in the row labels, and not the pairing
  // any other chapter uses — nonresidential against NET, residential against
  // GROSS. Four chapters, four mechanisms; nothing here was predictable from the
  // three before it.
  //
  // ⚠️ HEIGHT IS CONDITIONAL ON USE, so no single figure is published for
  // Subareas 1-4. The table carries two height rows — "Single-family residential
  // and Duplexes" and "all other principal structures" — and serving 120 ft to a
  // single-family project would overstate by 3.4x. Subarea 5 is the exception and
  // resolves cleanly: single-family is 'X' there (not permitted), so the 150 ft
  // row is the only one that can apply.
  'SPI-2 SA1': {
    ...base('SPI-2 Fort McPherson (Subarea 1)', '§16-18B.008'),
    farNonresidential: far(4.0, 'net', '§16-18B.008 Table, "Non-Residential FAR (times net lot area)"'),
    farResidential: far(3.2, 'gross', '§16-18B.008 Table, "Residential FAR (times gross lot area)"'),
    heightTiers: [
      { label: 'single-family residential and duplexes', heightFt: 35 },
      { label: 'all other principal structures', heightFt: 120 },
    ],
    heightSource: '§16-18B.008 Table — two height rows by use; no single figure applies',
  },
  'SPI-2 SA2': {
    ...base('SPI-2 Fort McPherson (Subarea 2)', '§16-18B.008'),
    farNonresidential: far(3.0, 'net', '§16-18B.008 Table, "Non-Residential FAR (times net lot area)"'),
    farResidential: far(2.0, 'gross', '§16-18B.008 Table, "Residential FAR (times gross lot area)"'),
    heightTiers: [
      { label: 'single-family residential and duplexes', heightFt: 35 },
      { label: 'all other principal structures', heightFt: 120 },
    ],
    heightSource: '§16-18B.008 Table — two height rows by use; a transitional height plane also applies adjacent to R and PD-H districts',
  },
  'SPI-2 SA3': {
    ...base('SPI-2 Fort McPherson (Subarea 3)', '§16-18B.008'),
    farNonresidential: far(3.0, 'net', '§16-18B.008 Table, "Non-Residential FAR (times net lot area)"'),
    farResidential: far(2.0, 'gross', '§16-18B.008 Table, "Residential FAR (times gross lot area)"'),
    heightTiers: [
      { label: 'single-family residential and duplexes', heightFt: 35 },
      { label: 'all other principal structures', heightFt: 75 },
    ],
    heightSource: '§16-18B.008 Table — two height rows by use; no single figure applies',
  },
  'SPI-2 SA4': {
    ...base('SPI-2 Fort McPherson (Subarea 4)', '§16-18B.008'),
    farNonresidential: far(3.0, 'net', '§16-18B.008 Table, "Non-Residential FAR (times net lot area)"'),
    farResidential: far(2.0, 'gross', '§16-18B.008 Table, "Residential FAR (times gross lot area)"'),
    heightTiers: [
      { label: 'single-family residential and duplexes', heightFt: 35 },
      { label: 'all other principal structures', heightFt: 75 },
    ],
    heightSource: '§16-18B.008 Table — two height rows by use; no single figure applies',
  },
  'SPI-2 SA5': {
    ...base('SPI-2 Fort McPherson (Subarea 5)', '§16-18B.008'),
    farNonresidential: far(4.0, 'net', '§16-18B.008 Table, "Non-Residential FAR (times net lot area)"'),
    farResidential: far(3.2, 'gross', '§16-18B.008 Table, "Residential FAR (times gross lot area)"'),
    heightFt: 150,
    heightSource: '§16-18B.008 Table, "Maximum Height all other principal structures" — the single-family row states X (not permitted) here, so this row is the only one that can apply',
  },

  // SPI-17 Piedmont Avenue — §16-18Q.010. Both limbs against GROSS, stated in the
  // row labels. The chapter states NO combined row, so farCombined stays null:
  // that is the code being silent, not a figure we failed to read.
  'SPI-17 SA1': {
    ...base('SPI-17 Piedmont Avenue (Subarea 1)', '§16-18Q.010'),
    farNonresidential: null, // table states "None"
    farResidential: far(0.696, 'gross', '§16-18Q.010 Table, "Max Residential FAR (times gross lot area)"'),
    heightFt: 45,
    heightSource: '§16-18Q.010 Table, "Maximum Building Height" (45 ft; a transitional height plane also applies per §16-18Q.008)',
  },
  'SPI-17 SA2': {
    ...base('SPI-17 Piedmont Avenue (Subarea 2)', '§16-18Q.010'),
    farNonresidential: null, // "5% of the total occupied residential floor area" — not a ratio
    farResidential: far(1.49, 'gross', '§16-18Q.010 Table, "Max Residential FAR (times gross lot area)"'),
    heightFt: 50,
    heightSource: '§16-18Q.010 Table, "Maximum Building Height" (50 ft; a transitional height plane also applies per §16-18Q.008)',
  },
  'SPI-17 SA3': {
    ...base('SPI-17 Piedmont Avenue (Subarea 3)', '§16-18Q.010'),
    farNonresidential: far(1.5, 'gross', '§16-18Q.010 Table, "Max Non-Residential FAR (times gross lot area)"'),
    farResidential: far(1.49, 'gross', '§16-18Q.010 Table, "Max Residential FAR (times gross lot area)"'),
    heightTiers: [
      { label: 'east of Piedmont Ave.', heightFt: 35 },
      { label: 'west of Piedmont Ave.', heightFt: 50 },
    ],
    heightSource: '§16-18Q.010 Table, "Maximum Building Height": 35 ft east of Piedmont Ave., 50 ft west — map-keyed, so no single figure is resolved',
  },
  'SPI-17 SA4': {
    ...base('SPI-17 Piedmont Avenue (Subarea 4)', '§16-18Q.010'),
    farNonresidential: null, // table states "None"
    farResidential: far(0.696, 'gross', '§16-18Q.010 Table, "Max Residential FAR (times gross lot area)"'),
    heightFt: 35,
    heightSource: '§16-18Q.010 Table, "Maximum Building Height"',
  },

  // SPI-16 Midtown — Ch. 16-18P, "FAR / Height" table, BY-RIGHT columns only.
  // The bonus columns are a programme the applicant has not chosen (rule 6).
  'SPI-16 SA1': {
    ...base('SPI-16 Midtown Mixed Use (Subarea 1)', '§16-18P.010'),
    farNonresidential: far(5.0, 'gross', '§16-18P.010 Table, "Non-Residential FAR (times gross lot area)", by-right column'),
    farResidential: far(3.2, 'gross', '§16-18P.010 Table, "Residential FAR (times gross lot area)", by-right column'),
    farCombined: far(8.2, 'gross', '§16-18P.010 Table, "Max FAR", by-right column'),
    heightSource: '§16-18P.010 Table, "Maximum Height": none stated except the transitional height plane adjacent to R districts',
  },
  'SPI-16 SA2 JSTA': {
    ...base('SPI-16 Midtown Residential (Subarea 2) — Juniper St. Transition', '§16-18P.010'),
    farNonresidential: null, // cell is a locational rule, not a ratio
    farResidential: far(6.4, 'gross', '§16-18P.010 Table, "Residential FAR (times gross lot area)", SA#2 → Juniper St. Transition'),
    farCombined: far(6.4, 'gross', '§16-18P.010 Table, "Max FAR", SA#2 → Juniper St. Transition'),
    heightFt: 400,
    heightSource: '§16-18P.010 Table, "Maximum Height", SA#2 → Juniper St. Transition',
  },
  'SPI-16 SA2': {
    ...base('SPI-16 Midtown Residential (Subarea 2) — Non-Juniper St. Transition', '§16-18P.010'),
    farNonresidential: null, // cell is a locational rule, not a ratio
    farResidential: far(3.2, 'gross', '§16-18P.010 Table, "Residential FAR (times gross lot area)", SA#2 → Non-Juniper St.'),
    farCombined: far(3.2, 'gross', '§16-18P.010 Table, "Max FAR", SA#2 → Non-Juniper St.'),
    heightFt: 250,
    heightSource: '§16-18P.010 Table, "Maximum Height", SA#2 → Non-Juniper St. Transition',
  },
  'SPI-16 SA3': {
    ...base('SPI-16 Juniper East (Subarea 3)', '§16-18P.010'),
    farNonresidential: far(2.0, 'gross', '§16-18P.010 Table, "Non-Residential FAR (times gross lot area)", Juniper East by-right'),
    farResidential: far(3.2, 'gross', '§16-18P.010 Table, "Residential FAR (times gross lot area)", Juniper East by-right'),
    farCombined: far(5.2, 'gross', '§16-18P.010 Table, "Max FAR", Juniper East by-right'),
    heightTiers: [
      { label: 'east of Piedmont Ave.', heightFt: 60 },
      { label: 'elsewhere in Subarea 3', heightFt: 100 },
    ],
    heightSource: '§16-18P.010 Table, "Maximum Height": 100 ft, 60 ft east of Piedmont Ave. — map-keyed, so no single figure is resolved',
  },

  // SPI-20 Greenbriar — Ch. 16-18T, Table "Development Controls and Site
  // Limitations". Six subareas, all six carrying live zone codes.
  'SPI-20 SA1': {
    ...base('SPI-20 Greenbriar Town Center (Subarea 1)', '§16-18T.010'),
    farNonresidential: far(2.5, 'unqualified', '§16-18T.010(1)(a)(i) — states "lot area" without qualifying it; see AtlantaLotBasis'),
    farResidential: far(0.696, 'net-or-gross', '§16-18T.010(2) — applicant may use net or gross'),
    farCombined: far(3.196, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 80,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },
  'SPI-20 SA2': {
    ...base('SPI-20 Greenbriar Neighborhood Center (Subarea 2)', '§16-18T.010'),
    farNonresidential: far(1.5, 'unqualified', '§16-18T.010(1)(a)(i)'),
    farResidential: far(0.696, 'net-or-gross', '§16-18T.010(2)'),
    farCombined: far(2.196, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 52,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },
  'SPI-20 SA3': {
    ...base('SPI-20 Campbellton Rd Mixed-Use Corridor (Subarea 3)', '§16-18T.010'),
    farNonresidential: far(1.0, 'unqualified', '§16-18T.010(1)(a)(i)'),
    farResidential: far(0.696, 'net-or-gross', '§16-18T.010(2)'),
    farCombined: far(1.696, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 52,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },
  'SPI-20 SA4': {
    ...base('SPI-20 Greenbriar Residential/Commercial (Subarea 4)', '§16-18T.010'),
    farNonresidential: null, // table states "20%" — a maximum percentage of development, not a ratio
    farResidential: far(2.0, 'net-or-gross', '§16-18T.010(2)'),
    farCombined: far(2.0, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 80,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },
  'SPI-20 SA5': {
    ...base('SPI-20 Greenbriar Medium Density Residential (Subarea 5)', '§16-18T.010'),
    farNonresidential: null, // table states "5%" — a maximum percentage of development, not a ratio
    farResidential: far(0.696, 'net-or-gross', '§16-18T.010(2)'),
    farCombined: far(0.696, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 52,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },
  'SPI-20 SA6': {
    ...base('SPI-20 Greenbriar Single-Family (Subarea 6)', '§16-18T.010'),
    farNonresidential: null, // table states "None"
    farResidential: far(0.5, 'net-or-gross', '§16-18T.010(2)'),
    farCombined: far(0.5, 'net', '§16-18T.010(1)(a)(iii)'),
    heightFt: 35,
    heightSource: '§16-18T.010 Table SPI-20, "Maximum Height"',
  },

  // SPI-21 Historic West End/Adair Park — Ch. 16-18U, ten subareas in the table.
  // ⚠️ SUBAREA 6 ("Medium Density Residential") IS DELIBERATELY ABSENT BELOW.
  // The chapter defines subareas 1–10; the 2026-08-17 live enumeration carries
  // SA1–SA5 and SA7–SA10 and NO SA6. That is not a coverage gap — no parcel
  // carries the code, so nothing renders wrong — but it cannot be VERIFIED
  // either: column-path identity is proved by mapping distinct grid columns onto
  // live zone codes, and there is no code to map column 6 onto. Encoding it would
  // publish figures whose column mapping was never checked against reality, which
  // is the DC MU-column off-by-one with nothing able to detect it. Recorded as
  // READ BUT UNVERIFIABLE, which is a different state from unread.
  'SPI-21 SA1': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 1)', '§16-18U.012'),
    farNonresidential: far(2.5, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(2.0, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(3.5, 'net', '§16-18U.012(1)(a)(iii) — STATED, not the sum of the limbs'),
    heightTiers: [
      { label: "within 150 ft of Ralph David Abernathy Blvd", heightFt: 72 },
      { label: 'elsewhere in Subarea 1', heightFt: 225 },
    ],
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height" 225 ft with the * footnote — map-keyed, so no single figure is resolved',
  },
  'SPI-21 SA2': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 2)', '§16-18U.012'),
    farNonresidential: far(2.5, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(1.0, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(3.5, 'net', '§16-18U.012(1)(a)(iii) — STATED, not the sum of the limbs'),
    heightFt: 72,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA3': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 3)', '§16-18U.012'),
    farNonresidential: far(1.5, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(0.696, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(2.196, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 46,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA4': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 4)', '§16-18U.012'),
    farNonresidential: far(1.0, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(0.696, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(1.696, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 46,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA5': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 5)', '§16-18U.012'),
    farNonresidential: null, // table states "20%" — a maximum percentage of development, not a ratio
    farResidential: far(2.3, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(2.3, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 72,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA7': {
    ...base('SPI-21 Smaller Lot Single-family (Subarea 7)', '§16-18U.012'),
    farNonresidential: null, // table states "None"
    farResidential: far(0.5, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(0.5, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 35,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA8': {
    ...base('SPI-21 Institutional/AUC (Subarea 8)', '§16-18U.012'),
    farNonresidential: far(3.0, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(3.2, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(3.2, 'net', '§16-18U.012(1)(a)(iii) — STATED, not the sum of the limbs'),
    heightFt: 72,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA9': {
    ...base('SPI-21 Adair Park Live/Work (Subarea 9)', '§16-18U.012'),
    farNonresidential: far(2.5, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(0.696, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(3.196, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 72,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },
  'SPI-21 SA10': {
    ...base('SPI-21 Historic West End/Adair Park (Subarea 10)', '§16-18U.012'),
    farNonresidential: far(5.0, 'net', '§16-18U.012(1)(a)(i)'),
    farResidential: far(3.2, 'net-or-gross', '§16-18U.012(2)'),
    farCombined: far(8.2, 'net', '§16-18U.012(1)(a)(iii)'),
    heightFt: 225,
    heightSource: '§16-18U.012 Table SPI-21, "Maximum Height"',
  },

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
/** Codes whose trailing "C" IS a conditional marker, each enumerated from the
 *  chapter that defines it. Deliberately not a pattern — see parseAtlantaZone.
 *  SPI-7's SA2A/SA2B/SA2C are subareas and are correctly absent here. */
const BARE_C_ALIASES: Record<string, string> = {
  'SPI-16 SA1C': 'SPI-16 SA1',
}

export function parseAtlantaZone(code: string | null | undefined): AtlantaZoneParts {
  if (!code) return { base: null, conditional: false, normalized: '' }
  const z = code.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!z) return { base: null, conditional: false, normalized: '' }

  if (Object.hasOwn(DISTRICTS, z)) return { base: z, conditional: false, normalized: z }

  // ⚠️ A BARE TRAILING "C" IS NOT A CONDITIONAL SUFFIX, AND THE STRING CANNOT
  // TELL YOU WHICH IT IS. Two live codes end in digit+C and they mean opposite
  // things:
  //     SPI-16 SA1C   a CONDITIONAL variant of Subarea 1 (Ch. 16-18P)
  //     SPI-7  SA2C   SUBAREA 2C itself — SPI-7 carries SA2A, SA2B and SA2C,
  //                   a lettered series (Ch. 16-18G)
  // A rule of "strip a C that follows a digit" resolves the first correctly and
  // silently turns the second into Subarea 2 — a real district becoming a
  // different real district. That is rule 27 (a prefix is not a family): test
  // membership against the SOURCE, not the spelling.
  //
  // It is not safe merely because SPI-7 is unencoded today, either. The guard
  // below would return null now and start returning the wrong district the day
  // SPI-7 SA2 is added — a trap armed by future work rather than a live bug.
  // So the aliases are enumerated from the chapters that define them, and
  // nothing is inferred from shape.
  if (Object.hasOwn(BARE_C_ALIASES, z)) {
    const target = BARE_C_ALIASES[z]
    return { base: Object.hasOwn(DISTRICTS, target) ? target : null, conditional: true, normalized: z }
  }

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
