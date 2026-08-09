import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, Hurdle } from '../../../src/types/analysis'
import { PARKING_RULES } from '../../../src/config/parkingRules'
// Reused, never re-implemented. Both of these normalise a hand-maintained GIS
// string whose edge cases were measured in the zoning modules (Milwaukee keeps
// the downtown subdistrict parentheses; Charlotte's `ZoneDes` is a compound
// with markers appended in four different shapes). A second copy of either
// parser here would be a second place for the same claim to drift — the
// boundary problem ledger rule 9 describes, in miniature.
import { normalizeMilwaukeeZone } from './zoning/milwaukee'
import { parseCharlotteZone } from './zoning/charlotte'

// Curated private-governance sites (no public dataset exists for HOAs/covenants).
const PRIVATE_SITES: Array<{ bbox: [number, number, number, number]; label: string; note: string }> = [
  {
    // Louisburg Square, Beacon Hill — privately owned/governed by its proprietors since 1844.
    bbox: [-71.0706, 42.3581, -71.0692, 42.3592],
    label: 'Private square: proprietors’ approval',
    note: 'Louisburg Square is privately governed by its proprietors; private approval and easements almost certainly apply, on top of city process.',
  },
]

function inBox(lng: number, lat: number, b: [number, number, number, number]): boolean {
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]
}

const FLOOD_OK = new Set(['', 'X', 'AREA OF MINIMAL FLOOD HAZARD', 'AREA NOT INCLUDED'])

// What currently stands on the parcel, as ONE definition. The per-city
// demolition / tenant-protection hurdles below and the generic demolition block
// at the end both ask "is there a building here?" and "is it rental
// multifamily?" — two copies of those regexes would be two places for the same
// claim to drift apart (ledger rule 9's boundary problem, in miniature).
function existingStructure(parcel: ParcelInfo) {
  const ex = parcel.existing
  const exUnits = ex?.units ?? 0
  const lu = ex?.landUse ?? ''
  const vacantOrUnbuilt = /vacant|parking|open space|outdoor|undevelop/i.test(lu)
  const hasBuilding =
    !!ex && ((ex.buildingAreaSqFt ?? 0) > 0 || exUnits > 0 || (ex.numBuildings ?? 0) > 0 || (!!lu && !vacantOrUnbuilt))
  // Word-boundaried "multifamily" — NOT bare "multi", which wrongly matched
  // commercial labels like "COMM MULTI-USE" (same fix as feasibility.ts).
  const multifamilyExisting =
    !!ex && (exUnits >= 3 || /apartment|condo|multi-?family|townhouse|triplex|fourplex|housing/i.test(lu))
  // Rental-multifamily test for the tenant-protection teardown hurdles.
  // Floor is exUnits >= 2 (a duplex is already "rental multifamily" for RSO /
  // Rent-Ordinance purposes), OR the same word-boundaried landUse regex
  // feasibility.ts uses — NOT bare "multi" (would match "COMM MULTI-USE").
  const rentalMultifamily =
    !!ex && (exUnits >= 2 || /apartment|condo|multi-?family|triplex|fourplex|elevator|tenement|\bflats\b/i.test(lu))
  return { ex, exUnits, lu, hasBuilding, multifamilyExisting, rentalMultifamily }
}

// The body that reviews exterior changes / new construction in a designated district.
const HISTORIC_BODY: Record<string, string> = {
  boston:
    'Exterior work and new construction need a Certificate of Design Approval from the Boston Landmarks Commission (or the relevant local historic district commission) before permits issue.',
  nyc:
    'Exterior work and new construction need a Certificate of Appropriateness (or permit) from the NYC Landmarks Preservation Commission before the Department of Buildings will issue permits.',
  chicago:
    'Exterior work and new construction are reviewed by the Commission on Chicago Landmarks (Historic Preservation Division) before a building permit can issue.',
  sf:
    'Exterior work and new construction need a Certificate of Appropriateness from the San Francisco Historic Preservation Commission under Planning Code Article 10.',
  seattle:
    'Exterior work and new construction need a Certificate of Approval from the district’s review board (under the Seattle Landmarks Preservation Board / special-review-district process) before permits issue.',
  austin:
    'Exterior alteration, removal, or demolition of a designated historic landmark — or of a contributing building in a historic district — needs a Certificate of Appropriateness from the Historic Landmark Commission before permits issue, and so does any new standalone ground-up structure on an (H) landmark property or inside an (HD) district, whether or not a building permit is otherwise required (Austin LDC § 25-11-212(A)–(B); review standards at § 25-11-213(K)). Small work can be signed off administratively — a one-storey ground-floor addition or outbuilding under 600 sq ft, a rear second-storey addition not visible from the street, or a pool, deck or fence — but ground-up new construction is not on that list.',
  dc:
    'Any permit to construct a building or structure in a historic district, or on the site of a historic landmark, is reviewed by the Historic Preservation Review Board — or instead by the U.S. Commission of Fine Arts where the Old Georgetown Act or the Shipstead-Luce Act applies (Georgetown, and sites near the Mall, the Capitol grounds, Rock Creek Park and other federal property). The Mayor has 120 days after the Board receives the referral to make the finding. The DC standard is compatibility, not appropriateness: the permit issues unless the design and the district’s character are found incompatible (D.C. Official Code § 6-1107(b), (c), (f); alterations at § 6-1105).',
  denver:
    'Work on a designated structure for preservation, or on any property inside a designated historic district, needs written approval from the Denver Landmark Preservation Commission or its staff before permits issue — building, demolition, curb cut, encroachment and zoning construction permits alike, plus zone lot amendments (D.R.M.C. §§ 30-6(2)(b), 30-6(3), 30-6(4), 30-6(6)(d)). Staff can administratively approve work that clearly meets the adopted design guidelines; everything else goes to the commission, and demolition of a designated or contributing primary structure requires a public hearing.',
  philadelphia:
    'Alteration or demolition of a historic building, structure, site or object — and alteration, demolition OR new construction anywhere in a designated historic district, not just work on designated buildings — is reviewed by the Philadelphia Historical Commission before permits issue: the gate is the building permit itself, and L&I must forward the application to the Commission before it can issue (Phila. Code § 14-1005(1)–(3), ch. 14-1000). Where the permit involves demolition, L&I also posts a notice on every street frontage within seven days announcing that the property is historic and the application is under Commission review.',
  miami:
    'Work on a parcel inside a designated historic site, historic district or multiple property designation needs a Certificate of Appropriateness before the Building Department will issue any permit — new construction, alteration, relocation and demolition alike (City of Miami Code § 23-6.2(a)–(c)). Minor work gets a standard certificate from the preservation officer within ten calendar days; anything major — and any request to waive or except a Miami 21 requirement — becomes a SPECIAL certificate decided by the Historic and Environmental Preservation Board at a noticed public hearing, with mailed notice to owners within 500 feet. The code carries a shot clock: if the board does not act within 60 calendar days of a complete application (August excluded) the application is deemed approved. Appeals run to the City Commission within 15 days, de novo, for a $525.00 fee. A separate "certificate to dig" is required for ground-disturbing work in a designated archaeological site, zone or conservation area — which covers substantial stretches of the Miami River, Brickell and the Biscayne Bay shoreline.',
  sanjose:
    'Any work in a City Historic District or on a City Landmark — new construction, additions, paving, and demolition, removal or relocation alike — needs a Historic Preservation (HP) permit before it can proceed, and the building official will not issue a building permit until it is in hand (San José Municipal Code § 13.48.210.A, D–E). The decision sits with the Director of Planning, Building and Code Enforcement, advised by the Historic Landmarks Commission, and is appealable to the City Council (§ 13.48.270); where the HP permit is reviewed concurrently with another permit, the Planning Commission or Council decides instead. Work is judged against the design criteria at § 13.48.250.',
  nashville:
    'A parcel inside one of the historic overlay districts listed at Metro Code § 17.36.110 needs a preservation permit from the Metro Historic Zoning Commission before a certificate of zoning compliance can issue — for new construction, exterior alteration, repair, relocation, and demolition in whole or in part (Metro Nashville & Davidson County Code § 17.40.420.A–B; commission powers at § 17.40.410.B–C). Unusually, the code clocks the commission rather than the applicant: it must meet within fifteen working days of a sufficient application, and failure to act within thirty days of a sufficient application is deemed an approval unless both sides agree to extend. Budget roughly a month for the hearing; design revisions to satisfy the district’s guidelines are the real variable.',
  raleigh:
    'A parcel inside a General (-HOD-G) or Streetside (-HOD-S) historic overlay district, or a designated Historic Landmark, needs a Certificate of Appropriateness before any exterior work: "no exterior portion of any building or other structure … shall be erected, altered, restored, moved, or demolished on the landmark or within the district until after an application for a certificate of appropriateness as to exterior features has been submitted to and approved by the Historic Development Commission" (Raleigh UDO Sec. 5.4.1.C.1), and the certificate must issue before the building permit (Sec. 5.4.1.C.3). The Historic Development Commission has delegated the decision to a Certificate of Appropriateness Committee (Sec. 10.2.15.A.4). Minor works — the enumerated table at Sec. 10.2.15.D.2, running from awnings and driveways to a rear addition of 50 sq ft or less — are signed off administratively by the Planning Director; ground-up new construction is NOT on that list and goes to the Committee as a major work at a noticed quasi-judicial evidentiary hearing, where "the burden of producing substantial, competent and material evidence or testimony is upon the applicant" (Sec. 10.2.15.D.3). The only clock the code sets is an outer limit on the Committee — applications "shall be reviewed and acted upon within 180 days from the date the application for a certificate of appropriateness is filed" (Sec. 10.2.15.D.1) — which is a ceiling, not an expected duration. Where the underlying zoning\'s setbacks or height conflict with the district\'s special character as determined through the certificate, the MORE RESTRICTIVE controls (Sec. 5.4.1.E, .F) — so the by-right envelope is not the envelope here. In an -HOD-S the review reaches only the street-facing parts of the lot enumerated at Sec. 5.4.2.B.2, but "the entirety of any new principal building construction on a vacant lot" is one of them.',
  milwaukee:
    'A parcel that is a historic structure, is on a historic site, or sits inside a historic district designated by the Common Council needs a certificate of appropriateness from the Milwaukee Historic Preservation Commission before any permit issues — and the trigger expressly reaches NEW CONSTRUCTION on an otherwise unremarkable lot: no person may "construct any improvement on a historic site, on a parcel that contains a historic structure or on a parcel within a historic district, including a parcel which is to be rendered vacant or partially vacant by reason of partial or complete demolition of a structure" without one, and "The commissioner of city development or neighborhood services shall not issue a permit for any such work or demolition unless a certificate of appropriateness has been issued by the commission" (Milwaukee Code s. 320-21-11-a). Any city department receiving permit plans for exterior alteration, new construction or demolition in a district must forward them to commission staff within 5 days. The clock the code sets for non-demolition work runs on the commission, not on you: staff has 10 days to rule the application complete as to form, the commission considers it at its next regular meeting at least 10 days after that, and must decide within 30 days of the close of that meeting (s. 320-21-11-b, -c-1). No public hearing is held on an alteration or new-construction certificate unless someone files a written objection with the city clerk within 20 days of the notice of receipt — an objection converts it into a noticed hearing. New construction is judged against three stated tests: architecture "sensitive to the mass and proportions of existing structures", "Appropriately-scaled architecture that is clearly differentiated from nearby historic structures, while taking cues from them", and "Not an attempt to re-create a historic structure" (s. 320-21-11-g-2). Where the same project also needs a planned development rezoning, the commission and the plan commission are directed to review concurrently and, failing that, the Common Council committee hears both (s. 320-21-11-i).',
  columbus:
    'Any construction, alteration, exterior repainting or demolition of a listed property, or of any structure or architectural feature in a designated district, needs a certificate of appropriateness from the relevant architectural review commission (or the Historic Resources Commission) before any permit issues — the code gates the permit itself: the director of building and zoning services "shall issue no permit for the construction, reconstruction, alteration or demolition of any structure or architectural feature now or hereafter in a listed property or district … unless the application therefore shall be certified under C.C. 3116.05 as involving no architectural feature or shall be accompanied by a certificate of appropriateness issued under C.C. 3116.09", and any permit issued before the certificate is void (Columbus C.C. §§ 3116.04, 3116.18(A)–(C)). Small work can be signed off by staff, but only from a list each commission adopts and publishes annually (§ 3116.055); everything else goes to a public hearing at the commission’s regularly scheduled meeting, and an application is heard at the next meeting only if filed at least ten days beforehand and noticed in the City Bulletin (§ 3116.06(B)). A denial can be appealed, reheard within 45 days on clear and convincing evidence of unusual and compelling circumstances or substantial economic hardship, or mediated (§§ 3116.10(C), 3116.19(A), 3116.21). Demolition carries its own standard and its own submittals — an applicant seeking to remove an entire structure must file "definite plans for reuse of the site, evidence of commitment for funding of the new project, a timeframe for project initiation and completion and an assessment of the effect such plans will have on the character and integrity of the listed property or district" (§ 3116.14).',
  charlotte:
    'A parcel inside one of Charlotte’s eight local historic districts needs a Certificate of Appropriateness from the Historic District Commission, and the certificate reaches further than a building permit does: "A Certificate of Appropriateness shall be issued by the Historic District Commission prior to the issuance of a building permit … A Certificate of Appropriateness is required whether or not a building permit is required" (Charlotte UDO Sec. 14.2.D.2). The decision is quasi-judicial and taken at an evidentiary hearing (Sec. 14.2.L.6.b). The only clock the ordinance publishes is an outer limit on the Commission rather than an expected duration — applications must be acted upon within 180 days of filing (Sec. 14.2.L.6.a.i) — and a certificate once issued "shall be valid for 12 months from the date of issuance" (Sec. 14.2.L.7.a), so one obtained early can expire before financing closes. Two things here are Charlotte-specific. First, the enforcement point sits with the COUNTY: the Mecklenburg County Land Use and Environmental Services Agency "shall not issue a Certificate of Occupancy or Certificate of Compliance unless there has been compliance with any Certificate of Appropriateness issued by the Historic District Commission" (Sec. 14.2.T.1), and it may revoke a building permit on its own authority or at the Planning Director’s direction (Sec. 14.2.S.1) — a missed condition surfaces at the CO counter, which is the most expensive place to find one. Second, demolition here is a timing risk and never a veto: an application authorising demolition "may not be denied", though the Commission may delay it for up to 365 days (Sec. 14.2.J.2, .J.3).',
  atlanta:
    'Exterior work and new construction inside a Landmark or Historic District, and on any Landmark or Historic Building or Site, need a certificate of appropriateness from the Atlanta Urban Design Commission before permits issue — the code reaches "To erect a new structure or to make an addition to any structure within an Historic District" and the parallel provision for Landmark Districts, plus any request "To vary any applicable regulation" (Atlanta Code § 16-20.007(a)(3)–(4)). There are four types. Ordinary repair and maintenance is a type I signed off by the director; ground-up new construction is a type III "major alteration", which goes to a noticed public hearing with notice published on the City website and in a newspaper at least 30 days before the meeting, the property posted at least 15 days before, and mailed notice to owners within 300 feet (§ 16-20.008(c)(2)). The code clocks the commission rather than the applicant: "Hearings of the commission on type III applications shall be held within 90 days from the date on which the director receives in due form a complete application from the applicant. The commission shall make a decision on said applications within 21 days of the date of the final public hearing" (§ 16-20.008(c)(3)), and failure to decide within those limits "shall be deemed to be approval of the application" with the bureau of buildings directed to issue the dependent permit (§ 16-20.008(c)(6)). Conservation Districts are different and much lighter: no certificate is required, only an advisory written recommendation from the commission, and if it fails to provide one within 30 days of the owner\'s initial application "the bureau of buildings shall issue the permit(s) at the request of the owner without compliance with this subsection" (§ 16-20.007(b)). Where a project is also in one of the affordable-housing overlays, the more stringent of the two regimes controls (§§ 16-36A.001, 16-37.001(3), 16-41.001(3)).',
  // NOTE — no minneapolis entry on purpose. The Minneapolis research returned a
  // citywide DEMOLITION screen (§§ 599.910, 599.920, encoded below) but no
  // section for historic-district design review, so this city falls through to
  // the generic copy rather than getting an invented body and citation.
  //
  // NOTE — no sandiego entry either. San Diego's research returned a 45-year
  // screening (SDMC § 143.0212) and a Process Four Site Development Permit where
  // a historical resource is present (§ 143.0210(e)(2)) — both encoded in the
  // city branch below — but no section naming a design-review body for a
  // historic district, so it keeps the generic copy rather than an invented one.
}

// Design-review months for the historic hurdle. 3 is the module's standing
// estimate; three cities' research states a different figure — DC's HPRB /
// Commission of Fine Arts path at 4 months (D.C. Official Code § 6-1107),
// Nashville's Metro Historic Zoning Commission preservation permit at 1 month
// (Metro Code § 17.40.420.A–B), both per docs/HURDLE-PROPOSALS.md, and Atlanta's
// Urban Design Commission at 4 months (below). No other city gets an override,
// because no other city's research states one.
//
// ⚠️ Atlanta's 4 is a real claim and is written down so it can be argued down.
// § 16-20.008(c)(3) gives the commission 90 days from a complete application to
// hold the type III hearing and 21 days from the final hearing to decide — 111
// days ≈ 3.7 months — and (c)(6) makes both limits DEEMED APPROVAL: failure to
// act inside them "shall be deemed to be approval of the application". That is
// DC's and Nashville's shape (the code fixes when the thing actually resolves),
// not Raleigh's ceiling.
//
// ⚠️ Milwaukee, Columbus and Charlotte deliberately get NO override, and each
// for the Raleigh reason rather than by oversight. Milwaukee: 10 days to rule an
// application complete as to form, a meeting at least 10 days later, a decision
// within 30 days of the close of that meeting (s. 320-21-11-b, -c-1), and for
// demolition a deferral CEILING of 8 months (s. 320-21-11-f-1) — shot clocks and
// a ceiling, no duration. Columbus is a stronger case still: its code sets no
// clock on the commission at all, only a 10-day filing lead before a REGULARLY
// SCHEDULED meeting (§ 3116.06(B)), a 45-day rehearing window (§ 3116.19(A)) and
// a 90-day post-hardship negotiation period (§ 3116.20) — a submittal deadline
// and two contingent branches. Charlotte publishes a 180-day outer limit on the
// Commission (UDO Sec. 14.2.L.6.a.i), which is Raleigh's number in Raleigh's
// shape. All three fall through to the standing 3.
//
// ⚠️ Raleigh deliberately gets NO override even though its code names a number.
// Sec. 10.2.15.D.1 says certificate applications "shall be reviewed and acted
// upon within 180 days from the date the application … is filed" — that is an
// outer LIMIT on the Committee, not a duration for the review, and the same
// section lets the Committee take the matter under advisement right up to it.
// Writing 6 here would publish a ceiling as an expectation, which is rule 6's
// failure in the time dimension. DC's 4 and Nashville's 1 are different: DC's
// 120 days is the period the Mayor has to make the finding on a referral that
// has already been made, and Nashville's 30 days is a DEEMED-APPROVAL clock,
// so in both the code fixes when the thing actually resolves.
const HISTORIC_MONTHS: Record<string, number> = { dc: 4, nashville: 1, atlanta: 4 }

// Private projects that are large enough to plausibly seek a subsidy/abatement.
const SUBSIDY_NOTE =
  'If you pursue tax abatements, tax-increment financing, or city land, expect added strings: prevailing-wage requirements, minority- and women-owned business (MWBE) participation goals, and extra reporting. Large projects also commonly negotiate Community Benefit Agreements.'

// Projects that actually tap public money/land — the process is mandatory.
const PUBLIC_FUNDING_NOTE =
  'Public funding, tax credits, bonds, or city land bring a defined process: competitive public procurement and bidding, prevailing-wage requirements (federal Davis-Bacon or the state equivalent), minority- and women-owned business (MWBE) participation goals, and ongoing reporting and audits. Expect public-board approvals and a longer pre-construction timeline.'

// ─── 2026-08-08 cohort: parcel-conditional parking, per ordinance ────────────
//
// ⚠️ READ THIS BEFORE ADDING TO ANY OF THE FOUR BRANCHES BELOW, because the
// scope claim here CHANGED on 2026-08-08 and the earlier version is retracted.
//
// WHAT IT SAID, AND WHY IT IS NO LONGER TRUE. Milwaukee, Columbus, Charlotte and
// Atlanta were first encoded for their PARKING ordinance and nothing else, and
// this block said so — "treat the four as encoded for parking and unencoded for
// everything else". The non-parking research has since landed for all four, and
// each branch now also carries its inclusionary position, its review path, its
// environmental, fee and demolition rows, plus a city-specific `HISTORIC_BODY`.
// The parking-only sentence is retracted; it is recorded rather than deleted
// because it stood in this file, in `hurdles.test.ts` and in
// `src/config/cities.ts` at once, and a reader who remembers it needs to see the
// correction rather than a silent rewrite (rule 17).
//
// WHAT IS TRUE NOW, STATED NARROWLY. Each of the four is encoded across the same
// subjects as the other sixteen, from one dated read of that city's code. None
// is exhaustive, and each branch names its own residue in comments on the rows
// that carry it — Milwaukee's unread floodplain/shoreland overlays and its
// energy-benchmarking threshold; Columbus's stormwater chapter (C.C.
// 1145.80–1145.89, whose text the content API returned empty) and its BZA
// procedure; Charlotte's citywide demolition question, which cannot be closed
// because one of the 39 UDO articles failed to download; Atlanta's institutional
// DRI rung and its Part 15 sidewalk exactions. A subject encoded is not a
// subject exhausted, and the honest denominator for these four lives in the
// per-row comments below, not in a claim of completeness here.
//
// WHY THESE ROWS ARE NOT DUPLICATES OF `PARKING_RULES`. `PARKING_RULES` is a
// static per-city record with no access to the parcel, so it carries the
// citywide rule and the citation. Everything PARCEL-CONDITIONAL has to live
// here, and in all four cities the parcel is what decides the answer: which
// Milwaukee district you are in decides whether a minimum exists at all,
// Charlotte's tier is a property of the district, Atlanta's pre-1965 exemption
// is a property of the existing building. Raleigh's branch carries the opposite
// instruction — do not duplicate the parking finding — and it is right for
// Raleigh, whose rule is citywide and unconditional. These four are not.

/** Milwaukee Table 295-403-2-a, "Multi-family dwelling", "Min. ratio of parking
 *  spaces to dwelling units" — the 1:1 column, transcribed verbatim. */
const MKE_PARKING_1_PER_UNIT = new Set(['RM1', 'RM2', 'RM3', 'RM4', 'RO1', 'NS1', 'LB1', 'RB1'])
/** The same row's 2:3 column. Note C9A is here: it is the one downtown district
 *  s. 295-403-2-a excludes from the downtown exemption, and also the one whose
 *  primary product is apartments. */
const MKE_PARKING_2_PER_3_UNITS = new Set([
  'RT4', 'RT5', 'RM5', 'RM6', 'RM7', 'RO2', 'NS2', 'LB2', 'LB3', 'RB2', 'CS', 'C9A', 'IM',
])

/**
 * The three overlay phrases `providers/milwaukee.ts` writes into
 * `zoning.article` — this is a STRING COUPLING ACROSS A MODULE BOUNDARY and it
 * is named here rather than inlined so both ends can be pinned by a test
 * (ledger rule 9: the errors that survive are the ones consistent on each side
 * of a boundary and inconsistent across it).
 *
 * None of the three overlays is on `parcel.overlays`, and `zoning.subdistrict`
 * carries at most ONE of them (providers/milwaukee.ts prefers the historic
 * district, then DIZ, then SPROZ, then NC), so `article` — which lists all of
 * them — is the only field that answers "is this parcel in a Development
 * Incentive Zone AND a Neighborhood Conservation overlay?". Gate on `article`.
 *
 * A miss here is a false NEGATIVE: the row does not render. It can never assert
 * an overlay that is not mapped.
 *
 * Pinned at the provider end by `providers/milwaukee.test.ts` ("a Site Plan
 * Review overlay and an NC overlay are disclosed too"), and at this end by the
 * Milwaukee overlay tests. If you rewrite `buildArticle`, both fail.
 */
const MILWAUKEE_OVERLAY_PHRASE = {
  /** buildArticle: `Site Plan Review overlay zone (${names}): …` */
  sitePlanReview: /Site Plan Review overlay zone/i,
  /** buildArticle: `Development Incentive Zone (${names}): …` */
  developmentIncentive: /Development Incentive Zone/i,
  /** buildArticle: `Neighborhood Conservation overlay zone (${names}): …` */
  neighborhoodConservation: /Neighborhood Conservation overlay zone/i,
} as const

/**
 * Title 34 ("Zone In", the 2024 Zoning Code) district designations, transcribed
 * from C.C. Title 34 § E.20.030 — Chapter E.20 is the ONLY district chapter in
 * Title 34 (Article E contains E.10 Purpose and E.20 Mixed-Use and nothing
 * else), so this set is the whole of that code's district vocabulary.
 *
 * MEASURED, not assumed, live against the provider's own zoning layer
 * (Applications/Zoning/MapServer/20) on 2026-08-08:
 *   CLASSIFICATION IN (this set)          → 1,619 polygons
 *   GENERAL_ZONING_CATEGORY = 'Mixed-Use' → the same 1,619
 *   (UGN-1 545, UCT 511, CAC 269, UCR 173, RAC 48, UGN-2 42, UCR-R 31; no row
 *   in either set fails the other, out of 18,804 mapped polygons.)
 * A biconditional, not a heuristic.
 *
 * ⚠️ EXACT-SET MEMBERSHIP ONLY — never a prefix test. `UCRPD` and `LUCRPD` are
 * Title 33 research-park districts (46 polygons) that `/^UCR/` would sweep into
 * Title 34 and hand a "no parking minimum" answer they do not have. They are
 * distinct strings, so `has()` cannot collide with them; `startsWith` can.
 * Pinned by the UCRPD/LUCRPD test in hurdles.test.ts.
 */
const COLUMBUS_TITLE34 = new Set(['UGN-1', 'UGN-2', 'UCT', 'UCR', 'UCR-R', 'CAC', 'RAC'])

/**
 * The three mapped Atlanta overlays that carry a MANDATORY affordable set-aside
 * — BeltLine (Part 16 ch. 36A), Westside (ch. 37), Northwest Atlanta (ch. 41).
 *
 * Matched with a tolerant regex on purpose. `providers/atlanta.ts` builds
 * `subdistrict = historicDistrict ?? overlay.LABEL ?? overlay.ZONECLASS ??
 * ZONINGCODE`, and the overlay layer's own domain (enumerated 2026-08-08 via
 * `.../LandUsePlanning/MapServer/1/query?returnDistinctValues=true`, 67 distinct
 * LABEL/ZONECLASS pairs) spells the Northwest overlay TWO ways: ZONECLASS
 * `NW Atlanta Affordable WH`, LABEL misspelled `NW Atalnta AWH`. A literal match
 * on either string alone silently drops the other, so the pattern accepts both
 * spellings — `at[a-z]*nta` covers "Atlanta" and "Atalnta" alike.
 *
 * Direction of error, stated because it decides how the rows are worded: the
 * provider takes only the FIRST overlay feature (`firstAttrs`) and a mapped
 * historic district DISPLACES the overlay label entirely, while the layer can
 * return several features at one point (measured: Inman Park returns both
 * "Beltline" and "HC20LSA1"). So a miss here is a false NEGATIVE and never a
 * false positive — the same shape as Raleigh's -TOD row.
 */
const ATLANTA_AWH_OVERLAY = /beltline|westside\s*iz|nw\s*at[a-z]*nta|\bawh\b|affordable\s*w/i

/**
 * Charlotte UDO Table 19-1 tier → district map, transcribed verbatim from the
 * table's own header cells.
 *
 * Tier 1's header reads "Neighborhood 1 Zoning Districts, N2-A, MHP, ML-1,
 * ML-2, IC-1, OFC, OG Zoning Districts". Only the individually NAMED districts
 * are listed below: "Neighborhood 1 Zoning Districts" is a class the header
 * does not enumerate, and enumerating it from the curated height table in
 * `zoning/charlotte.ts` would be assembling a legal claim out of two sources
 * neither of which states it. An N1-* parcel therefore resolves to no tier and
 * gets no tier row — a false NEGATIVE, which is the safe direction: the city's
 * rule still renders from `PARKING_RULES`, and nothing asserts a minimum that
 * was not read.
 */
const CLT_PARKING_TIER: Record<string, 1 | 2 | 3> = {
  // Tier 1 — minimums, no maximums.
  'N2-A': 1, MHP: 1, 'ML-1': 1, 'ML-2': 1, 'IC-1': 1, OFC: 1, OG: 1,
  // Tier 2 — minimums AND maximums.
  'N2-B': 2, 'N2-C': 2, IMU: 2, 'IC-2': 2, RC: 2, NC: 2, 'CAC-1': 2, CG: 2, CR: 2,
  // Tier 3 — most uses have NO minimum; maximums apply.
  'CAC-2': 3, 'TOD-UC': 3, 'TOD-NC': 3, 'TOD-CC': 3, 'TOD-TR': 3, RAC: 3, UC: 3, UE: 3,
}

// Assess non-zoning regulatory hurdles for a project. Boston is fully modeled;
// other cities get the shared overlay + private-governance hurdles for now.
export interface HurdleContext {
  /** The feasibility approval path — discretionary-only hurdles (ULURP,
   *  Chicago PD) fire only on the variance path, since they apply to
   *  discretionary actions, not as-of-right buildings. */
  path?: 'as_of_right' | 'variance' | 'prohibited'
}

// FAIL-CLOSED (2026-08-05). A `required` hurdle is a regulatory claim. When the
// project's floor area (and therefore its unit count) came from `lot × 1.0`
// because no FAR could be resolved, a size-triggered hurdle would be asserting
// that a rule APPLIES on the strength of a placeholder — Boston's Article 80
// 15-unit trigger firing off `lot × 1.0 ÷ 1300` is two assumptions producing a
// legal claim.
//
// Downgraded to 'info', not removed: the rule may well apply, and saying so
// while naming the uncertainty is more useful than silence. Hurdles already
// carrying 'likely' or 'info' are left alone — their own text already hedges.
// `assumed-unconstrained` is NOT downgraded: the code affirmatively imposes no
// FAR there, so the size sits under a stated absence.
function softenSizeDependent(hurdles: Hurdle[], gfaBasis: AnalysisInput['gfaBasis']): Hurdle[] {
  if (gfaBasis !== 'assumed-far-1.0') return hurdles
  return hurdles.map((h) =>
    h.sizeDependent && h.status === 'required'
      ? {
          ...h,
          status: 'info' as const,
          note: `${h.note} ⚠️ This threshold is measured against a placeholder size — no floor-area limit could be resolved for this district, so whether the rule applies here is unconfirmed.`,
        }
      : h,
  )
}

export function assessHurdles(city: string, parcel: ParcelInfo, project: AnalysisInput, ctx: HurdleContext = {}): Hurdle[] {
  const discretionary = ctx.path === 'variance'
  const hurdles: Hurdle[] = []
  const units = project.units ?? 0
  const isResidential = project.use === 'residential' || project.use === 'mixed'
  const isCommercial = project.use === 'commercial' || project.use === 'mixed'
  const existing = existingStructure(parcel)
  const lotSqFt = parcel.lot.sizeSqFt ?? 0
  // A teardown: new construction on a parcel that already carries a building.
  const teardown = project.projectType === 'new' && existing.hasBuilding

  // Historic district — design review (applies in every city we cover).
  if (parcel.overlays.historicDistrict) {
    hurdles.push({
      category: 'historic',
      label: 'Historic district design review',
      status: 'required',
      note: `This parcel is in the ${parcel.overlays.historicDistrict}. ${HISTORIC_BODY[city] ?? 'Exterior changes and new construction require design approval from the local historic-district commission before permits issue.'}`,
      addsMonths: HISTORIC_MONTHS[city] ?? 3,
    })
  }

  // California Coastal Zone — a Coastal Development Permit is required, often with
  // its own environmental review and (in some areas) Coastal Commission appeal.
  if (parcel.overlays.coastalZone) {
    hurdles.push({
      category: 'environmental',
      label: 'Coastal Development Permit',
      serial: true, // runs IN ADDITION to CEQA/entitlement, not nested within it
      status: 'required',
      note: 'This parcel is in the California Coastal Zone. A Coastal Development Permit (city, and appealable to the Coastal Commission) is required, with its own review — this adds significant time and uncertainty.',
      addsMonths: 9,
    })
  }

  // FEMA flood zone.
  const fz = parcel.overlays.floodZone
  if (fz && !FLOOD_OK.has(fz.toUpperCase())) {
    hurdles.push({
      category: 'flood',
      label: `FEMA flood zone ${fz}`,
      status: 'likely',
      note: 'Flood-resistant construction (and possibly elevation or floodproofing) will be required, raising cost.',
    })
  }

  // ---- Project-type-specific requirements (apply in every city). ----
  if (project.projectType === 'adu') {
    hurdles.push({
      category: 'review',
      label: 'ADU-specific rules',
      status: 'likely',
      note: 'Accessory dwelling units have their own size caps, owner-occupancy, and parking rules that vary by city. Confirm the local ADU ordinance.',
    })
  } else if (project.projectType === 'change_of_use') {
    hurdles.push({
      category: 'review',
      label: 'Change-of-use code upgrades',
      status: 'likely',
      note: 'Converting to a new use commonly triggers building-code, accessibility (ADA), and fire upgrades, plus a use review, even without exterior changes.',
    })
  }

  // ---- Per-city policy. Programs are publicly documented; applicability often
  // depends on the specific area/funding, so area-dependent rules are "likely". ----
  if (city === 'boston') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary (IDP): income-restricted units',
        sizeDependent: true,
        status: 'required',
        note: 'Boston’s Inclusionary Development Policy requires roughly 17% of units be income-restricted (or a payment in lieu) for residential developments of 10+ units (raised from 13% in the 2024 zoning amendment).',
      })
    }
    // Article 80 thresholds verified against bostonplans.org (2026-06-10):
    // Large Project Review at 50,000+ sf; Small Project Review at 20,000–50,000
    // sf OR 15+ dwelling units. The BPDA's review functions moved to the city's
    // Planning Department in July 2024 — same Article 80 process, new letterhead.
    if (project.gfa >= 50000) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Large Project Review',
        status: 'required',
        note: 'Developments of 50,000+ sq ft undergo Article 80 Large Project Review by the Planning Department (formerly the BPDA), including community meetings and impact studies. For most large Boston projects this is the longest single gate.',
        addsMonths: 9,
      })
    } else if (project.gfa >= 20000 || (isResidential && units >= 15)) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Small Project Review',
        sizeDependent: true,
        status: 'required',
        note: 'Developments of 20,000–50,000 sq ft — or any project adding 15+ dwelling units — undergo Article 80 Small Project Review by the Planning Department (formerly the BPDA), covering design and climate resilience.',
        addsMonths: 4,
      })
    }
    if (isCommercial && project.gfa >= 100000) {
      hurdles.push({
        category: 'fees',
        label: 'Development impact (linkage) fees',
        status: 'required',
        note: 'Large commercial projects (100,000+ sq ft) pay linkage fees into Boston’s Neighborhood Housing and Jobs Trusts.',
      })
    }
    // Abutter appeals — the real chokepoint for Boston projects that need any
    // discretionary approval (a variance/special permit from the ZBA). Under
    // MGL c.40A §17, any aggrieved abutter may appeal a ZBA decision to the Land
    // Court or Superior Court within 20 days of the decision being filed.
    // Source: Mass. General Laws c.40A §17 (mass.gov/info-details/mass-general-
    // laws-c40a-ss-17; malegislature.gov Chapter 40A Section 17). The pending
    // appeal clouds the permit and routinely stalls financing/construction for
    // 6–18 months even when the developer ultimately prevails. NO addsMonths:
    // an appeal is a RISK, not a certainty — most approvals are never appealed,
    // so baking months into every variance timeline would overstate delay. We
    // surface it as 'info' so it informs without inflating the verdict.
    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Abutter appeal risk (MGL c.40A §17)',
        status: 'info',
        note: 'This project needs a discretionary approval from the Zoning Board of Appeal. Under Massachusetts law (MGL c.40A §17), any aggrieved abutter can appeal the ZBA’s decision to Land Court or Superior Court within 20 days — and that appeal clouds the permit while it’s litigated, routinely adding 6–18 months even when the developer wins. The board approves the large majority of variances it hears; in Boston, the courthouse — not the hearing room — is where projects actually die.',
      })
    }
  } else if (city === 'nyc') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Inclusionary Housing (MIH)',
        status: 'likely',
        note: 'In MIH areas, new residential of 10+ units must include permanently affordable units (~25–30%) or pay in lieu. Confirm whether the site sits in an MIH area.',
      })
    }
    // ULURP applies to DISCRETIONARY actions (rezonings, special permits) —
    // an as-of-right building of any size never runs it. Previously fired on
    // raw GFA alone, over-penalizing as-of-right NYC projects by 7 months.
    if (project.gfa >= 50000 && discretionary) {
      hurdles.push({
        category: 'review',
        label: 'ULURP: Uniform Land Use Review Procedure',
        status: 'likely',
        note: 'Rezonings, special permits, and large projects run the City’s ~7-month public ULURP (community board → borough president → City Planning → City Council).',
        addsMonths: 7,
      })
      hurdles.push({
        category: 'environmental',
        label: 'CEQR environmental review',
        status: 'likely',
        note: 'Discretionary approvals trigger City Environmental Quality Review, often running in parallel with ULURP.',
      })
    }
  } else if (city === 'sf') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary affordable housing',
        sizeDependent: true,
        status: 'required',
        note: 'San Francisco requires roughly 12–26% of units be affordable (or a fee) for residential projects of 10+ units.',
      })
    }
    hurdles.push({
      category: 'environmental',
      label: 'CEQA environmental review',
      status: 'likely',
      note: 'The California Environmental Quality Act applies to most discretionary approvals and is a frequent source of delay and litigation.',
      addsMonths: 6,
    })
    hurdles.push({
      category: 'review',
      label: 'Planning Commission / Discretionary Review',
      status: 'likely',
      note: 'SF projects routinely face discretionary review and Planning Commission hearings even when code-compliant.',
      addsMonths: 6,
    })
  } else if (city === 'chicago') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Affordable Requirements Ordinance (ARO)',
        status: 'likely',
        note: 'Chicago’s ARO requires ~20% affordable units (or in-lieu fees) for residential projects of 10+ units that need a zoning change, city land, or city financing.',
      })
    }
    // PD designation is a discretionary action; as-of-right projects under the
    // existing zoning don't run it (same reasoning as NYC ULURP above).
    if (project.gfa >= 50000 && discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Planned Development / City Council review',
        status: 'likely',
        note: 'Large projects often require a Planned Development and aldermanic / City Council approval.',
        addsMonths: 6,
      })
    }
  } else if (city === 'seattle') {
    if (isResidential || isCommercial) {
      // seattle.ts fetches the parcel-exact MHA fee area; when present we can
      // say "this parcel IS in an MHA zone" instead of asking the user to check.
      const feeArea = parcel.overlays.feeArea
      hurdles.push(
        feeArea
          ? {
              category: 'affordability',
              label: 'Mandatory Housing Affordability (MHA)',
              status: 'required',
              note: `This parcel is in Seattle's "${feeArea}" MHA area: new development contributes affordable units or pays the MHA fee for that area.`,
            }
          : {
              category: 'affordability',
              label: 'Mandatory Housing Affordability (MHA)',
              status: 'likely',
              note: 'In MHA zones, new development contributes affordable units or pays a fee. Confirm the site is in an MHA zone.',
            },
      )
    }
    // OVER-fire, corrected (2026-08-07) — same shape as San José's TDM gate.
    // SMC 25.05.800.A sorts the minor-new-construction exemption by USE, and it
    // gives each use its own unit of measure: "The construction or location of
    // residential or mixed-use development" is exempt up to "the number of
    // DWELLING UNITS identified in Table A", while "the construction of office,
    // school, commercial, recreational, service, or storage buildings" is exempt
    // up to "the GROSS FLOOR AREA listed in Table B". The section says so
    // explicitly for a building that is both: "residential uses are evaluated
    // according to number of dwelling units, and non-residential uses are
    // evaluated according to square footage of gross floor area." The state
    // provision Seattle's thresholds flex, WAC 197-11-800(1)(b), has the same
    // split — its unit limbs read "four attached or detached single family
    // residential units" and "four multifamily residential units", and its
    // non-residential limb is "an office, school, commercial, recreational,
    // service or storage building with 4,000 square feet of gross floor area".
    // A unit count is therefore a RESIDENTIAL measure in this code; there is no
    // limb under which a wholly commercial or institutional project is screened
    // on units. `units` arrives off the query string independent of `use`
    // (analyze.ts reads them separately), so the unguarded `units >= 20` was
    // applying Table A's residential number to non-residential projects.
    //
    // The floor-area limb is deliberately left UNGUARDED. Table B's own list of
    // buildings — "office, school, commercial, recreational, service or storage"
    // — spans both `commercial` and `institutional` (a school is institutional
    // here), so narrowing it to `isCommercial` would drop institutional projects
    // out of a limb the source plainly covers. That would be an under-fire, and
    // an under-fire never tells the user the rule applies at all.
    //
    // NOT fixed here, recorded instead (never invent a threshold): Table A is a
    // TABLE, not one number — its exempt level varies by zone and by whether the
    // site is inside an Urban Center / Urban Village, and the state limbs above
    // separate single-family from multifamily. The single `20` collapses all of
    // that, so it is right only where Table A happens to read 20. Same for
    // `12000` against Table B: SDCI's own SEPA page publishes 30,000 sq ft for
    // retail-commercial and institutional uses and 65,000 sq ft for offices,
    // lodging, storage and warehouses, so 12,000 is below both figures we can
    // actually cite. Reading the two tables is the fix; guessing at them is not.
    if ((isResidential && units >= 20) || project.gfa >= 12000) {
      hurdles.push({
        category: 'environmental',
        label: 'SEPA environmental review',
        status: 'likely',
        note: 'Washington’s State Environmental Policy Act applies above Seattle’s local exemption thresholds, adding review time. The thresholds are sorted by use: a residential or mixed-use project is screened on its number of dwelling units, and an office, school, commercial, recreational, service or storage building is screened on its gross floor area (SMC 25.05.800.A, Tables A and B). The exempt level varies by zone and by whether the site sits inside an Urban Center or Urban Village, so confirm the figure for this parcel — the numbers this tool applies are approximate.',
        addsMonths: 4,
      })
    }
    // Design review SUSPENDED — rare good news worth surfacing. Verified at
    // seattle.gov/sdci/codes/changes-to-code/2025-design-review-program-changes
    // (2026-06-10): CB 121048 (Sept 26, 2025) made design review voluntary
    // while SDCI writes permanent rules required by state HB 1293; permanent
    // legislation was expected at Council in spring 2026. Status 'info', no
    // months — this REMOVES a board rather than adding one, and the rules are
    // in flux, so we tell the user to confirm at filing.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Design review: currently suspended',
        status: 'info',
        note: 'Seattle made design review voluntary in September 2025 (Council Bill 121048) while it writes permanent rules to comply with state law HB 1293 — one less board between you and a permit, for now. Permanent replacement rules were due in 2026; confirm the current status when you file.',
      })
    }
  } else if (city === 'austin') {
    // Austin Land Development Code, read from Municode's content API at Supp.
    // No. 173 ("codified through Ordinance No. 20260122-059, effective February
    // 2, 2026"). Section cites below are to that text.

    // ABSENCE, and the headline finding for Austin: no inclusionary mandate at
    // ANY size. Affordability is bought with bonus density, not required.
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'No mandatory inclusionary requirement',
        status: 'info',
        note: 'Austin sets no affordable-unit mandate at any project size — there is no unit count or floor area at which income-restricted units become compulsory, and no fee in lieu. Affordability here is voluntary and incentive-based, traded for extra density under the Affordability Unlocked Bonus Program (LDC § 25-1-720(A)). State law is the reason: Tex. Loc. Gov’t Code § 214.905 bars a Texas city from capping the sale price of privately built housing, while expressly preserving voluntary bonus programs.',
      })
    }

    // ABSENCE: site plan approval is administrative. Size alone never buys you
    // a public hearing in Austin.
    hurdles.push({
      category: 'review',
      label: 'Site plan review is administrative — no discretionary hearing by default',
      status: 'info',
      note: 'Austin site plans are approved by staff, not by a board. Land Use Commission review — the public hearing — fires on exactly three things: a conditional use, development in a Hill Country Roadway Corridor, or where another code section requires it (LDC § 25-5-142; site plan requirement at § 25-5-1, director approval at § 25-5-112(A)). Project size is not on that list, so size alone never sends you to a hearing — there is no Austin analogue to Boston’s Article 80 or San Francisco’s Discretionary Review.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Street impact fee',
      status: 'required',
      note: 'All new development inside the city limits pays Austin’s street impact fee, assessed at final plat approval (or at building permit where no plat is required) and collected when the building permit issues — LDC §§ 25-6-657, 25-6-662, 25-6-663(B), under Tex. Loc. Gov’t Code ch. 395. There is no size threshold; small projects pay too. The code states no dollar amount — the rate per service unit is set by a separate fee ordinance, so budget from the current adopted schedule. Reductions exist for transit proximity, parking management and affordability, but you have to qualify for them.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Water and wastewater capital recovery (impact) fees',
      status: 'required',
      note: 'Any new development in the water and wastewater impact fee service area that increases the number of service units pays capital recovery fees — separate from the street impact fee — assessed at final plat and collected when the building permit issues (LDC §§ 25-9-311(A), 25-9-321, 25-9-323, 25-9-325(A)–(B), under Tex. Loc. Gov’t Code ch. 395). No tap permit is released until they are paid, and the amounts sit in a separate fee ordinance, not in the code text.',
    })

    if (isResidential) {
      hurdles.push({
        category: 'fees',
        label: 'Parkland dedication or fee in lieu',
        status: 'required',
        note: 'Any subdivision or site plan that includes residential units (or a hotel-motel use) must dedicate parkland, pay a fee in lieu, or both, with the director choosing — LDC §§ 25-1-601(C)–(D), 25-1-603(C)–(D), 25-1-608(B)–(E). There is no minimum project size: it applies from the first unit. The dedication is 0.005 acre per multifamily unit (0.004 per hotel/motel room), capped at 10% of gross site area; the fee version multiplies that same acreage by the average land value for your geographic area and divides by a density factor of 1 (suburban), 4 (urban) or 40 (central business district). Income-restricted and S.M.A.R.T. Housing units are exempt.',
      })
    }

    // Two independent limbs in § 25-11-39(C): floor area, OR (since October 1,
    // 2019) any commercial/multifamily project needing a demolition permit. Only
    // the first is size-triggered, so sizeDependent tracks the limb that fired —
    // a demolition-limb hurdle must not be softened by a placeholder GFA.
    const cdDemolitionLimb = teardown && (isCommercial || existing.multifamilyExisting || units >= 3)
    if (project.gfa > 5000 || cdDemolitionLimb) {
      hurdles.push({
        category: 'demolition',
        label: 'Construction and demolition materials diversion',
        sizeDependent: project.gfa > 5000,
        status: 'required',
        note: 'Construction projects with more than 5,000 sq ft of new, added, or remodeled floor area — and, since October 1, 2019, every commercial or multifamily project that needs a demolition permit — must run a materials diversion program and acknowledge it before the permit issues (LDC § 25-11-39(C); rates at City Code §§ 15-6-151, 15-6-152). The baseline in force since October 2016 is at least 50% of materials diverted for beneficial use, or no more than 2.5 lb of disposal per square foot. Steeper 75% and 95% tiers are written into the code but each is conditioned on City Council first approving a staff report, so confirm which tier is live before pricing haul-off.',
      })
    }

    // 50-year screen: fires on the EXISTING structure, not on project size, so
    // it is not sizeDependent. Suppressed only when the year built is KNOWN and
    // the building is younger than 50 — an unknown year must not wave it through.
    if (teardown) {
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      if (age == null || age >= 50) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic review of any building 50 years or older',
          status: 'likely',
          note:
            (age == null
              ? 'The record shows an existing building here but no year built. In Austin, a demolition, relocation, or building permit for any structure 50 years or older goes to historic review before it can issue (LDC § 25-11-213(B), (C), (F), (G)) — confirm the building’s age early, because the review sits ahead of the permit. '
              : `This parcel’s existing building dates to ${yb}, so it is 50 years or older — in Austin, a demolition, relocation, or building permit for any structure that old goes to historic review before it can issue (LDC § 25-11-213(B), (C), (F), (G)). `) +
            'A structure escapes the review only if the historic preservation officer finds all three of: under 50 years old, failing at least two landmark designation criteria, and not contributing to a historic area (HD) district — so an ordinary 1960s house is inside the net by default. Published outer bounds: a hearing within 60 days of a complete application, then a permit hold of up to 75 days after the first Commission meeting — roughly four months worst case, or 180 days for a contributing structure in a National Register district. The permit can issue sooner if the Commission declines to initiate a designation case; if it initiates one, designation becomes pending and any permit issued is void (§ 25-11-214).',
          addsMonths: 4,
        })
      }
    }

    // Triggered by the EXISTING building's tenancies, not by the new project's
    // size — so no sizeDependent tag. The statutory threshold is FIVE existing
    // residential units (§ 25-1-711(C)(2)); a known 2–4 unit building is below
    // it and gets no hurdle, but an unknown unit count must not wave it through.
    if (project.projectType === 'new' && existing.rentalMultifamily && (existing.exUnits === 0 || existing.exUnits >= 5)) {
      const known = existing.exUnits >= 5
      hurdles.push({
        category: 'review',
        label: '120-day tenant notice before applying to demolish',
        status: 'required',
        note:
          (known
            ? `The record shows ${existing.exUnits} residential units here, at or above the five-unit threshold. `
            : 'The record shows rental housing here but no unit count; the rule bites at five or more existing residential units, so confirm the count. ') +
          'Where a permit would displace a tenant at a property with at least five residential units, Austin requires notice to every affected unit at least 120 days BEFORE the demolition or building permit application is submitted, and a certification that you gave it (LDC §§ 25-1-711(C)(2), 25-1-712(A)–(B)). This is a hard pre-application waiting period, not a review that runs alongside anything else — the clock starts before the city ever sees your file, and it counts the units already on the site, not the units you propose. A mobile home park gets 270 days instead, measured from the rezone, site plan or change-of-use application.',
        addsMonths: 4,
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'Save Our Springs: impervious cover cap',
      status: 'likely',
      note: 'Development in the watersheds that contribute to Barton Springs is capped on impervious cover under the Save Our Springs Initiative: 15% across the entire recharge zone, 20% in the Barton Creek contributing zone, and 25% in the remainder of the contributing zone, measured on NET site area and reduced further where needed to hold pollutant loads flat (LDC §§ 25-8-514(A), 25-8-515; Barton Springs Zone applicability at § 25-8-481). The trigger is geographic, not size — confirm whether your parcel drains to Barton Springs, because these caps routinely bind harder than the zoning envelope. They are also not waivable: the article is expressly exempt from the code’s ordinary variance and special-exception machinery.',
    })

    // Discretionary-only: the protest right attaches to a rezoning, not to an
    // as-of-right building (same reasoning as NYC ULURP / Chicago PD above).
    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Valid petition: 20% of neighbours can force a supermajority vote',
        status: 'info',
        note: 'If you need a rezoning, owners of at least 20% of the land either inside the proposed change area or immediately adjoining it and extending 200 feet out can protest in writing — a "valid petition" — and that single filing raises the approval bar from a simple majority to three-fourths of City Council, 9 of 11 votes (LDC § 25-2-284(A), under Tex. Loc. Gov’t Code ch. 211). It costs the objectors nothing, which is why the discretionary path here carries far more risk than the as-of-right path. A PUD rezoning the Land Use Commission recommends denying needs the same three-fourths vote.',
      })
    }
  } else if (city === 'dc') {
    // Citations are to the DC Municipal Regulations (11-C DCMR, Zoning
    // Regulations of 2016; 10-B, 12-A, 21 DCMR) and the D.C. Official Code.
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Zoning (IZ) set-aside',
        sizeDependent: true,
        status: 'required',
        note: 'Residential development proposing 10 or more new dwelling units — cellar and penthouse units count toward the ten — must set aside income-restricted Inclusionary Units in any zone where Subtitle C Chapter 10 is identified as applicable (11-C DCMR § 1001.2(a)(1)). The set-aside is 10% of residential gross floor area (excluding penthouse habitable space) where the project is NOT Type I construction AND the by-right height limit is 50 ft or less, and 8% where it is Type I construction OR the height limit exceeds 50 ft (§§ 1003.1, 1003.2). Rental units go to households at or below 60% of MFI, ownership units at or below 80% (§ 1003.3). Unit counts combine across building permits over a 3-year window (§ 1001.3), and there is no in-lieu fee in the base rule — the units must be built.',
      })
    }

    // TWO limbs at 10-B DCMR § 2300.1(a): land area of 3 acres (130,680 sq ft),
    // OR a commercial / mixed-use commercial project of 50,000 sq ft or more of
    // gross floor area above grade plus cellar. A purely residential project
    // below three acres is outside it. Tagged sizeDependent per the research row;
    // the tag only ever downgrades, so it fails closed.
    const ltrLandLimb = lotSqFt >= 130680
    const ltrCommercialLimb = isCommercial && project.gfa >= 50000
    if (ltrLandLimb || ltrCommercialLimb) {
      hurdles.push({
        category: 'review',
        label: 'Large Tract Review (Office of Planning)',
        sizeDependent: true,
        status: 'required',
        note: `${
          ltrLandLimb
            ? 'A site of three acres or more (about 130,680 sq ft)'
            : 'A commercial or mixed-use commercial development of 50,000 sq ft or more of gross floor area above grade plus cellar area'
        } goes through Large Tract Review at the Office of Planning before any building permit application may be filed, on a 60-day schedule (10-B DCMR § 2300.1(a), § 2303.1). Note what this is NOT: it produces a technical report, not an approval or denial, so it is a schedule item rather than a veto point. Notice goes to the affected ANC, any known civic association and every property owner within 200 feet, and there is at least one community meeting. Exemptions at § 2304.1 include projects filed as Planned Unit Developments and sites in the former C-3-C, C-4 and C-5 downtown districts (now the D zones).`,
        addsMonths: 2,
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'DC Environmental Policy Act screening',
      status: 'likely',
      note: 'Any action requiring a District permit that costs over $1,000,000 in 1989 dollars — CPI-adjusted annually, so the live figure is roughly $2.6M today — and that may significantly affect the environment must file an Environmental Impact Screening Form; if screening shows significant impact, a full Environmental Impact Statement follows and no agency may issue the permit until review completes (D.C. Official Code §§ 8-109.02(2), 8-109.03, 8-109.06(a)(7); rules at 20 DCMR §§ 7201.1, 7202.1–7202.2). Issuing a building permit is itself an "action", so this reaches private projects. Two exemptions do most of the work: projects inside the Central Employment Area are exempt by statute (§ 8-109.06(a)(7)), and 20 DCMR § 7202.2 exempts residential projects in the former R-1 through R-5-A zones — pre-2016 zone names, so check the mapping against the current zone map.',
    })

    // DISTURBED AREA, NOT LOT AREA (2026-08-07). 21 DCMR § 599 triggers on the
    // area an activity DISTURBS; this gate used lot area as a stand-in. That
    // stand-in only holds for ground-up construction, where the whole site is
    // worked. A change of use disturbs no land at all — yet any 5,000 sq ft lot
    // was being told a Stormwater Retention Volume was REQUIRED with no site
    // work in the project. An addition or an ADU disturbs some unknown fraction
    // of the lot; we hold no footprint input, so the hurdle stays and names the
    // condition rather than asserting a requirement off a quantity the source
    // does not measure. NOT modelled, and reported rather than invented: the
    // second qualifying case in the source (a major substantial improvement
    // activity whose combined improved-building and land-disturbance footprint
    // reaches 5,000 sq ft), which can bite on a lot below 5,000 sq ft.
    const dcDisturbsLand = project.projectType !== 'change_of_use'
    const dcWholeSiteWork = project.projectType === 'new'
    if (lotSqFt >= 5000 && dcDisturbsLand) {
      hurdles.push({
        category: 'environmental',
        label: 'Stormwater Retention Volume (major land-disturbing activity)',
        status: dcWholeSiteWork ? 'required' : 'likely',
        note:
          'Disturbing 5,000 sq ft or more of land — or being part of a common plan of development that does — makes this a "major land-disturbing activity" and triggers DC’s Stormwater Retention Volume requirement: retain on site the runoff from a 1.2-inch rainfall event, with at least half of that volume retained on the site itself absent DOEE relief for extraordinarily difficult conditions (21 DCMR § 599 for the definition, §§ 520.3 and 520.4(a) for the standard). On a tight urban lot this drives real design cost — green roofs, cisterns, permeable paving — and the shortfall can be bought as Stormwater Retention Credits in a live DC market. The threshold is land disturbance, not building size, so a small building on a large site still triggers it.' +
          (dcWholeSiteWork
            ? ''
            : ' This project is not ground-up construction, so the 5,000 sq ft is measured against the area your work actually disturbs — not against the whole lot, which is all this tool can see. Confirm the disturbed footprint before pricing the retention volume.'),
      })
    }

    // ZONE RESTRICTION (2026-08-06). 11-C DCMR § 601.2 applies the Green Area
    // Ratio to "all new buildings on properties in ALL ZONES EXCEPT the R and RF
    // zones" — the house-form residential zones, which are most of DC's land
    // area. The gate asserted it on every new building in the city, while the
    // hurdle's OWN note already said "in all zones except the R and RF
    // house-form zones": the claim was true in the text and false in the gate
    // (ledger rule 9's boundary problem). Base zone only — an overlay suffix
    // (`R-3/NO`, `RF-1/CAP`) does not move the parcel out of its base zone.
    // Matches R-1A/R-2/R-3… and RF-1…RF-5; deliberately NOT RA-* (Residential
    // Apartment), NC, MU, PDR or D, all of which are inside the GAR. An
    // unresolved district code ('Unknown') keeps firing — the exemption is only
    // applied where the zone is affirmatively known to be R or RF.
    const dcBaseZone = (parcel.zoning.districtCode ?? '').toUpperCase().split('/')[0].trim()
    const dcHouseFormZone = /^RF?(-|$)/.test(dcBaseZone)
    if (project.projectType === 'new' && !dcHouseFormZone) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Area Ratio: landscape minimum',
        status: 'required',
        note: 'Every new building in DC must meet a Green Area Ratio — a minimum score for on-site landscape and stormwater elements such as trees, vegetated roofs, permeable paving and bioretention — in all zones except the R and RF house-form zones (11-C DCMR §§ 601.2, 601.3, 604.2–604.8, with exemptions at § 601.3(a)–(d) and § 601.7). The required ratio is set per zone in that zone’s development-standards chapter, so the number is zone-specific rather than citywide. A landscape plan prepared by a Certified Landscape Expert is a permit submission requirement, and no certificate of occupancy issues until a landscape checklist is accepted. It also reaches existing buildings where additions or interior renovations within any 12-month period exceed 100% of the building’s assessed value; historic resources are exempt unless an addition increases gross floor area by 50% or more.',
      })
    }

    if (project.gfa >= 10000) {
      hurdles.push({
        category: 'environmental',
        label: 'DC Green Construction Code (10,000 sq ft and up)',
        sizeDependent: true,
        status: 'required',
        note: 'New construction of 10,000 sq ft or more — including an addition of that size and its associated site development, and demolition, alteration or relocation at the same threshold — must comply with the DC Green Construction Code, a full code layer beyond the energy code covering site development, materials, water use and commissioning (12-A DCMR § 101.12.3, Exception 1; the code itself at 12-K DCMR). Below 10,000 sq ft it does not apply at all. Cost shows up in design and commissioning, not in review time.',
      })
    }

    // SCOPE CORRECTION (2026-08-06). The mandatory LEED obligation in § 6-1451.03(b)
    // is written for NONRESIDENTIAL projects and the nonresidential portion of a
    // mixed-use project — a purely residential building of any size is outside it.
    // The earlier encoding fired on any project ≥ 50,000 sq ft, residential
    // included, which is the misquote the research specifically warns against.
    if (isCommercial && project.gfa >= 50000) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Building Act: LEED certification (nonresidential portion)',
        sizeDependent: true,
        status: 'required',
        note: 'The Act reaches privately-owned projects of at least 50,000 sq ft of gross floor area, but the mandatory LEED obligation applies to NONRESIDENTIAL projects — or, in a mixed-use building, to the nonresidential portion, which must certify at LEED Certified level (D.C. Official Code § 6-1451.03(a), (b)(1)(B), (b)(2)(B), (b)(4)). A purely residential building of any size is outside it. Certification must be verified within two years of the certificate of occupancy, and financial security must be posted before occupancy — $7.50 per sq ft below 100,000 sq ft, $10 per sq ft at 100,000 sq ft and above, capped at $3 million (§ 6-1451.05) — forfeited if certification is not achieved. That security is a real carrying cost, not a paper filing.',
      })
    }

    // THERE MUST BE SOMETHING TO DEMOLISH (2026-08-06). § 6-1104(b) reaches "any
    // permit to demolish a historic landmark or a building or structure located
    // in a historic district". The gate fired on `projectType === 'new'` alone,
    // so a new building on a VACANT lot inside a historic district was told a
    // demolition permit needed a public-interest finding. `teardown` is
    // `new` AND an existing structure — the condition the source actually states.
    if (parcel.overlays.historicDistrict && teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolition in a historic district: "necessary in the public interest"',
        status: 'required',
        note: 'Demolishing a historic landmark — or any building in a historic district — requires a finding that the demolition is necessary in the public interest, or that refusing the permit would cause the owner unreasonable economic hardship; without it the permit is denied (D.C. Official Code § 6-1104(b), (c), (e)). That is a substantive test, not a formality: the applicant carries the burden, there is a public hearing, and the statute runs a 120-day clock. This is a materially harder gate than the design review that accompanies it. Where demolition is allowed only because the replacement is a "project of special merit", the demolition permit cannot issue until the new-construction permit issues simultaneously — the teardown cannot precede a fully approved replacement design.',
        addsMonths: 4,
      })
    }

    // Both of these fire on the EXISTING rental housing, not on project size.
    if (project.projectType === 'new' && existing.rentalMultifamily) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolishing occupied rental housing: 180-day notice',
        status: 'required',
        note: 'To recover possession of an occupied rental unit in order to demolish the building and replace it with new construction, DC requires that a copy of the demolition permit first be filed with the Rent Administrator, then a 180-day notice to vacate served on every tenant, plus statutory relocation assistance under subchapter VII (D.C. Official Code § 42-3505.01(g)(1)–(2)). The tenancy, not the permit, is the binding constraint: the clock cannot start before the demolition permit exists, so six months of holding costs on an already-entitled site is the realistic floor.',
        addsMonths: 6,
      })
      // NEW-CONSTRUCTION EXCLUSION (2026-08-06). § 42-3404.02b(b)(20), added by
      // the RENTAL Act of 2025, takes a multifamily building whose permanent
      // certificate of occupancy issued within the prior 15 years OUT of TOPA.
      // The gate asserted TOPA on every rental teardown, including buildings
      // finished last year. `yearBuilt` is the CO-date proxy already used for
      // Austin's 50-year screen and LA/SF rent control; suppress only when the
      // year is KNOWN and inside the window — an unknown year keeps the hurdle.
      const topaYearBuilt = existing.ex?.yearBuilt
      const topaNewConstructionExcluded =
        topaYearBuilt != null && new Date().getFullYear() - topaYearBuilt < 15
      if (!topaNewConstructionExcluded) {
        hurdles.push({
          category: 'demolition',
          label: 'TOPA: tenants get first right to buy',
          status: 'likely',
          note: 'Under the Tenant Opportunity to Purchase Act, tenants of an occupied housing accommodation must be given a bona fide opportunity to purchase before the owner can sell it OR issue a notice to vacate for demolition (D.C. Official Code § 42-3404.02(a)) — it fires on the teardown, not just on a sale. For accommodations of 5 or more units the statute sets minimum periods the owner must allow: 45 days for the tenants to register an organization, then not less than 120 days to negotiate a contract, then not less than 120 days after contracting to arrange financing (§ 42-3404.11). Tenants routinely assign those rights to a developer for a payment. No months are assigned here because the clock only runs if tenants organize, but a TOPA-encumbered site should never be underwritten on an as-of-right timeline. Since the RENTAL Act of 2025, a multifamily building whose permanent certificate of occupancy issued within the prior 15 years is excluded (§ 42-3404.02b(b)(20)).',
        })
      }
    }

    hurdles.push({
      category: 'labor',
      label: 'First Source hiring — only if the project takes government assistance',
      status: 'info',
      note: 'DC imposes no prevailing-wage or local-hire mandate on a privately financed building permit — the obligation attaches to District assistance. Between $300,000 and $5,000,000 of assistance, at least 51% of new hires must be District residents; for construction projects at $5,000,000 or more, at least 20% of journey-worker hours, 60% of apprentice hours, 51% of skilled-laborer hours and 70% of common-laborer hours must go to District residents (D.C. Official Code § 2-219.03(a), (e)(1)(A), (e)(1A)(A)). Tax abatements, land dispositions and DHCD/DCHFA financing are the usual routes in, so weigh this against the subsidy before assuming public money is free. A project that takes no District assistance is not covered.',
    })
  } else if (city === 'denver') {
    // Denver Zoning Code (June 25, 2010, republished February 25, 2025) and the
    // Denver Revised Municipal Code. The affordability rules are DRMC ch. 27
    // arts. V and X as enacted by CB22-0426 (Expanding Housing Affordability).
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Affordable Housing (10+ units)',
        sizeDependent: true,
        status: 'required',
        note: 'A residential development creating 10 or more new dwelling units at one location — by construction, alteration, or conversion of non-residential space to residential — must make a share of them income-restricted for 99 years, pay a fee-in-lieu, or negotiate an alternative (D.R.M.C. ch. 27, art. X, §§ 27-219(t), 27-221, 27-223, 27-224, enacted by the Expanding Housing Affordability ordinance CB22-0426, effective July 1, 2022). On-site percentages are set by market area: 8% (Typical) or 10% (High) at the lower-AMI option, rising to 12% / 15% at the higher-AMI option. "At one location" aggregates commonly owned adjacent parcels, and the code expressly forbids splitting an application to stay under ten units.',
      })
    }

    // CARVE-OUT (2026-08-06): § 27-154(k) exempts the gross floor area of a
    // residential development subject to art. X — you pay Mandatory Affordable
    // Housing or the linkage fee, not both. A purely residential 10+ unit project
    // therefore owes no linkage fee at all; a mixed-use one still pays on its
    // commercial floor area. The earlier encoding charged both.
    const mahExempt = project.use === 'residential' && units >= 10
    if ((project.projectType === 'new' || project.projectType === 'addition') && !mahExempt) {
      hurdles.push({
        category: 'fees',
        label: 'Affordable housing linkage fee',
        sizeDependent: true,
        status: 'required',
        note: `Denver charges an affordable-housing linkage fee on any new structure, and on any addition that increases gross floor area, when the building permit issues (D.R.M.C. §§ 27-153(a), 27-153(e), 27-154(k)). The schedule effective July 1, 2025 is $5.00/sq ft for units of 1,600 sq ft or less and $8.00/sq ft for larger units, in buildings of 9 dwelling units or fewer; commercial space pays $6.00/sq ft in a typical market area or $9.00/sq ft in a high market area. Rates are re-indexed to CPI every July 1 from 2026 onward, so confirm the current published schedule with CPD.${
          isResidential && units >= 10
            ? ' Residential floor area subject to Mandatory Affordable Housing is exempt, so on this project the fee reaches only the commercial floor area.'
            : ' Residential floor area subject to Mandatory Affordable Housing (10+ units) is exempt — you pay one or the other, not both.'
        }`,
      })
    }

    // Administrative, but universal: the exception is narrow enough to state.
    if (!(isResidential && units > 0 && units <= 2)) {
      hurdles.push({
        category: 'review',
        label: 'Site Development Plan review (administrative)',
        status: 'required',
        note: 'Nearly all development in Denver needs an approved Site Development Plan before any zoning or building permit — every zone district, every use, as "development" is defined in DZC Division 13.3. The exceptions are narrow: one single-unit or two-unit dwelling structure (or two single-unit structures) on a single zone lot, ADUs inside already-approved structures, and development under an approved detailed PUD plan (Denver Zoning Code § 12.4.3.2.A–B). Review is inter-agency staff review by Community Planning and Development — no appointed board, no public hearing, no community-benefits negotiation.',
      })
    }

    // 5 acres = 217,800 sq ft. Lot area, not project size.
    if (lotSqFt > 217800) {
      hurdles.push({
        category: 'review',
        label: 'Large Development Review (sites over 5 acres)',
        status: 'likely',
        note: 'Sites over 5 acres (about 217,800 sq ft) are commonly routed into Large Development Review; the Development Review Committee decides after the pre-application meeting, using the factors listed at Denver Zoning Code §§ 12.4.12.2.A and 12.4.12.3. Gross land area of more than 5 acres or 3 blocks — or work creating 3 or more blocks — is one listed factor, alongside an adopted plan recommending the process and any project that changes the arterial/collector street grid, regional stormwater, or public park and open space. Where it applies, an approved Large Development Framework must be in place BEFORE any rezoning, subdivision, site development plan or infrastructure master plan is finalized.',
      })
    }

    // Downtown design-board districts, verbatim from DZC § 12.2.7.2; the Cherry
    // Creek North board covers the C-CCN districts (§§ 12.2.8.2, 12.2.8.3).
    const DENVER_DESIGN_BOARD_DISTRICTS = new Set(['D-GT', 'D-AS-12+', 'D-AS-20+', 'D-CPV-T', 'D-CPV-R', 'D-CPV-C'])
    const dzDistrict = (parcel.zoning.districtCode ?? '').toUpperCase()
    const cherryCreekBoard = dzDistrict === 'C-CCN' || dzDistrict.startsWith('C-CCN-')
    if (DENVER_DESIGN_BOARD_DISTRICTS.has(dzDistrict) || cherryCreekBoard) {
      hurdles.push({
        category: 'review',
        label: 'Design Advisory Board review',
        status: 'required',
        note: cherryCreekBoard
          ? `This parcel is zoned ${parcel.zoning.districtCode}, inside Cherry Creek North, where the Cherry Creek North Design Advisory Board reviews the project and makes recommendations to the Development Review Committee or Zoning Administrator (Denver Zoning Code §§ 12.2.8.2, 12.2.8.3). Its meetings are open to the public with public comment. The board advises rather than decides, but it adds a public design step that projects elsewhere in Denver do not face.`
          : `This parcel is zoned ${parcel.zoning.districtCode}, one of the six downtown districts (D-GT, D-AS-12+, D-AS-20+, D-CPV-T, D-CPV-R, D-CPV-C) where the Downtown Design Advisory Board reviews the project and makes recommendations to the Development Review Committee or Zoning Administrator (Denver Zoning Code § 12.2.7.2). Its meetings are open to the public with public comment. The board advises rather than decides, but it adds a public design step that projects elsewhere in Denver do not face.`,
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Landmark demolition screen on every teardown',
        status: 'required',
        note: 'Every application to demolish a primary structure in Denver — designated or not, at any age — is first screened for landmark significance, as is any accessory structure of 1½ storeys or more (D.R.M.C. § 30-6(1)(b)(i)–(vi)). The executive director has 10 working days to decide whether the structure has "potential for designation". If it does, the property is posted publicly for 21 calendar days; a notice of intent to file a landmark designation lodged by day 21 extends the posting to 60 days and forces a facilitated meeting with the applicant, and a full designation application can then run up to 90 days more. A screen is not a designation, but it sits ahead of the demolition permit. An owner can buy certainty in advance with a Certificate of Demolition Eligibility (§ 30-6(1)(c)), which blocks non-consensual designation for 5 years.',
      })
    }

    // PROJECT-TYPE RESTRICTION (2026-08-06). The ordinance reaches "new buildings
    // and additions containing 25,000 square feet or more of gross floor area",
    // plus existing buildings of that size ON A ROOF REPLACEMENT. The gate fired
    // on floor area alone, so a change of use or an interior ADU conversion in a
    // 25,000 sq ft building was told a cool roof was required with no roof work
    // in the project at all. The roof-replacement limb is NOT modelled — we have
    // no roof-work input — and the note says so rather than pretending otherwise.
    const denverGboProjectLimb = project.projectType === 'new' || project.projectType === 'addition'
    if (denverGboProjectLimb && project.gfa >= 25000) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Buildings Ordinance (25,000 sq ft)',
        sizeDependent: true,
        status: 'required',
        note: 'New buildings and additions of 25,000 sq ft or more of gross floor area must provide a cool roof AND satisfy one further compliance path — green space, on-site renewable energy, an energy-efficiency package, certification, or a payment into the Green Building Fund (D.R.M.C. ch. 10, art. XIII; CPD / Office of Climate Action rules §§ 3.01 and 4.01, effective October 9, 2023). The same threshold reaches an existing building of that size on a roof replacement or recover of more than 5% of the total roof area or of an individual roof section. Price this into the roof and envelope at 25,000 sq ft rather than discovering it at permit.',
      })
    }

    hurdles.push({
      category: 'labor',
      label: 'Denver citywide minimum wage',
      status: 'info',
      note: 'Denver sets its own minimum wage, above Colorado’s, and it covers all work performed physically within the city — including construction trades on a private jobsite — whether or not the project takes public money. The exclusions are narrow: work totalling under four hours a week inside the city, and pass-through travel (D.R.M.C. ch. 58, art. II, enacted by CB19-1237; first rate effective January 1, 2020). The rate rises every January 1 with the Denver-area CPI, an escalation running since January 1, 2023, so a multi-year build faces a rising labour floor. This is not a prevailing-wage rule — Denver’s prevailing wage attaches to city contracts, not to privately funded projects.',
    })
  } else if (city === 'minneapolis') {
    // Minneapolis Code of Ordinances (Title 20 zoning; Title 22 subdivision;
    // Title 23 heritage preservation) read at Supplement 72 Update 2, plus the
    // city's Unified Housing Policy and the state EAW rules (Minn. R. 4410).
    if (isResidential && units >= 50) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Zoning: 8% affordable units',
        sizeDependent: true,
        status: 'required',
        note: 'A residential RENTAL project of 50 or more new dwelling units must set aside 8% of its units at or below 60% of Area Median Income, held affordable for at least 20 years. Two alternatives are allowed instead: 7% at 50% AMI, or 4% at 30% AMI. Cash in lieu is $15 per square foot of net residential area in buildings up to 7 stories, and $22 per square foot at 8 stories or more. In buildings under 100 units the first 15 units are excluded from the calculation (20–85-unit buildings), tapering to 1 exempt unit at 99 units. The zoning ordinance’s own trigger is 20 units, but the Unified Housing Policy currently exempts rental projects of 20–49 units, so 50 is the line that actually bites (Minneapolis Code of Ordinances § 550.810(a); Unified Housing Policy § III(A)(1), effective April 1, 2025). TENURE IS PART OF THE TRIGGER and this tool holds no tenure field: the mandate reaches RENTAL projects only, and for-sale projects — condominiums and for-sale townhomes — are exempt at any size until further notice. Confirm which you are building before treating this as binding. The requirement is set by Council policy, not the zoning text — the policy in effect the day your complete land use application is submitted governs.',
      })
    }

    // ABSENCE, and the finding that matters for most Minneapolis projects: the
    // mandate has a floor of 50 rental units, and never reaches for-sale housing.
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary zoning does not bite below 50 rental units',
        sizeDependent: true,
        status: 'info',
        note: 'Minneapolis’s 8% affordable set-aside reaches only rental projects of 50 or more units. Rental projects of 20–49 units — and all for-sale projects, including condominiums and for-sale townhomes — are exempt "until further notice" (Minneapolis Unified Housing Policy § III, Delayed Phase-In for Smaller Projects and For-Sale Projects; enabled by Minneapolis Code of Ordinances § 550.810(c)(1)). This is a policy switch the Council can flip without amending the zoning code, and CPED must bring a comprehensive review to Council every 3–5 years, so confirm the current policy before underwriting a 20–49 unit deal on it. Separately, units created inside a building originally built for non-residential use are exempt if a complete application is submitted before October 1, 2029 (§ 550.810(c)(3)).',
      })
    }

    // Unit-count trigger → sizeDependent (rule 1). The published duration for
    // this row is 2 months — Minn. Stat. § 15.99, subd. 2's 60-day rule;
    // nothing else in the Minneapolis research states one. The SECOND threshold
    // (20 units → mandatory public hearing) was lost to truncation and is
    // restored here: below 20 units the same review is administrative.
    // Administrative review is CONJUNCTIVE in Table 550-1 — it needs BOTH that
    // the project carries no other land use application requiring a public
    // hearing AND that it is under 20 units. The unit half alone was encoded,
    // so a 6-unit project that also needs a variance (itself a land use
    // application heard in public) was told its review would be administrative
    // with "no hearing, no commission" — false on the variance path.
    //
    // OVER-fire, corrected (2026-08-07). Both thresholds on this row are written
    // in RESIDENTIAL UNIT TYPES: Table 550-1 reads "four (4) or more new or
    // additional DWELLING UNITS OR ROOMING UNITS", and the administrative-review
    // limb reads "fewer than twenty (20) new or additional dwelling units or
    // rooming units". An office block or a warehouse contains none of either, so
    // this row cannot reach it. `units` arrives straight off the query string
    // independent of `use` (analyze.ts reads them separately), so an unguarded
    // `units >= 4` applied a dwelling-unit threshold to a wholly non-residential
    // project. Mixed-use still fires — its dwellings are dwelling units.
    // Table 550-1's OTHER rows (the non-residential triggers) were not read for
    // this repo, so a commercial project now gets nothing here rather than a
    // borrowed number — rule 5: a gap must not render as an answer.
    // Two collapses the source makes and this gate cannot: it counts dwelling
    // units and rooming units TOGETHER against one threshold (we carry a single
    // count), and footnote 2 aggregates additions "in any three (3) year period"
    // (we see only this project). Both are under-fires, disclosed in the note
    // rather than modelled.
    if (isResidential && units >= 4) {
      const mplsHearing = units >= 20 || discretionary
      hurdles.push({
        category: 'review',
        label: 'Site plan review',
        sizeDependent: true,
        status: 'required',
        note: !mplsHearing
          ? 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit (Minneapolis Code of Ordinances § 550.510 and Table 550-1). Administrative review is available only if BOTH conditions in Table 550-1 hold: the project includes no other land use application requiring a public hearing, AND it includes fewer than 20 new or additional dwelling units or rooming units. This project meets both, so the review is administrative — no hearing, no commission; the public-hearing requirement starts at 20 new or additional units, counting units added in any 3-year period together. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice. Conversions of non-residential floor area to housing stay administrative at any unit count.'
          : units >= 20
            ? 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit — and at 20 or more units the application is NOT eligible for administrative review: it must go to a public hearing before the City Planning Commission (Minneapolis Code of Ordinances § 550.510 and Table 550-1, incl. footnote 2). Administrative review needs BOTH conditions in Table 550-1 — no other land use application requiring a public hearing, and fewer than 20 units — and the unit half already fails here. Units added in any 3-year period are counted together. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice.'
            : 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit (Minneapolis Code of Ordinances § 550.510 and Table 550-1). This project is under 20 units, but the unit count is only HALF the test: administrative review requires BOTH that the project includes no other land use application requiring a public hearing AND that it is under 20 units. This project needs discretionary zoning relief, which is itself a land use application heard in public, so the first condition fails and the site plan is NOT eligible for administrative review — expect the City Planning Commission, not a staff sign-off. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice.',
        addsMonths: 2,
      })
    }

    // OVER-fire, corrected (2026-08-07) — the same shape as San José's TDM gate.
    // Both Table 555-10 rows encoded here are written in residential unit types:
    // "fifty (50) or more and less than two hundred fifty (250) new or additional
    // DWELLING UNITS OR ROOMING UNITS" and "two hundred fifty (250) or more new
    // or additional dwelling units or rooming units". These are the table's
    // residential rows; a commercial or institutional building has no dwelling
    // units to count against them. Table 555-10's non-residential rows were not
    // read for this repo — and the planning director's discretionary TDM power
    // over "any project not listed in the table" states no threshold at all — so
    // a non-residential project gets no TDM claim here rather than a borrowed
    // one. Mixed-use still fires on its dwellings.
    if (isResidential && units >= 50) {
      hurdles.push({
        category: 'review',
        label: 'Travel demand management plan',
        sizeDependent: true,
        status: 'required',
        note:
          units >= 250
            ? 'At 250 or more new or additional dwelling units or rooming units, Minneapolis requires a MAJOR travel demand management plan scoring at least 6 points, including a traffic study prepared to industry standards and certified by a licensed engineer (Minneapolis Code of Ordinances § 555.1310(c) and Table 555-10). The 250-unit row carries its own exception — "except as otherwise authorized in this table for building conversions" — so a building conversion may sit on a different line of Table 555-10; check the table before assuming the major plan. You pick strategies from Table 555-11 — transit passes, bike facilities, unbundled parking, car-share — until you hit the point total, and you must keep complying afterward. A written exemption request is possible.'
            : 'At 50 or more (and fewer than 250) new or additional dwelling units or rooming units, Minneapolis requires a MINOR travel demand management plan scoring at least 4 points with the application; at 250 units it becomes a major plan requiring 6 points plus a licensed engineer’s traffic study (Minneapolis Code of Ordinances § 555.1310 and Table 555-10). You pick strategies from Table 555-11 — transit passes, bike facilities, unbundled parking, car-share — until you hit the point total, and you must keep complying afterward. A written exemption request is possible. This is the practical replacement for the parking minimums Minneapolis abolished.',
      })
    }

    // § 598.370(a) fires on a NET INCREASE in residential dwelling units, not on
    // residential use — the ordinance's own exclusion list is entirely made of
    // things that add no units (tax parcel combinations and splits, minor
    // subdivisions, lot line adjustments, apartment-to-condominium conversions,
    // internal leasehold improvements). A residential job adding no units owes
    // nothing, so the zero/non-zero test is part of the trigger. NOT tagged
    // sizeDependent: the research row states sizeDependent False, and this is an
    // applicability test (any units at all), not a magnitude threshold.
    if (isResidential && units >= 1) {
      hurdles.push({
        category: 'fees',
        label: 'Parkland dedication: land or fee in lieu',
        status: 'required',
        note: 'Any development needing a building permit that produces a net increase in residential dwelling units must dedicate parkland or pay a fee in lieu (Minneapolis Code of Ordinances § 598.370(a)–(d)). There is no minimum project size — it applies from the first added unit. The land option is .0066 acres per new unit downtown (the area bounded by I-35W, I-94, Plymouth Avenue and the Mississippi River) or .01 acres per new unit outside downtown, capped at 10% of the area being platted or developed. The cash alternative is written into the ordinance at $1,500 per non-exempt unit — but that is the 2013 base figure, adjusted every April 1 by the Minneapolis–St. Paul CPI-U and never reduced, so what you will actually owe is materially higher. The current per-unit figure is published in the city’s parkland dedication fee schedule; get it from Minneapolis Development Review before you underwrite, because no current dollar amount is asserted here. Affordable housing units as defined in § 598.360 (including inclusionary units) are exempt, as are lot combinations and splits, minor subdivisions, lot line adjustments, apartment-to-condominium conversions and internal leasehold improvements.',
      })
    }

    if (isResidential) {
      // ABSENCE by threshold: state environmental review sits far above the size
      // of an ordinary Minneapolis building, so most projects never see it.
      hurdles.push({
        category: 'environmental',
        label: 'State environmental review (EAW) — the threshold is very high',
        sizeDependent: true,
        status: 'info',
        note: 'Minnesota requires a mandatory Environmental Assessment Worksheet only at 375 attached dwelling units (250 unattached) for a project consistent with the city’s adopted comprehensive plan — well above almost every project (Minn. R. 4410.4300, subp. 19, items C and D). If the project is NOT consistent with Minneapolis 2040, the trigger drops to 150 attached units (100 unattached), and that consistency call is the city’s, not yours. A mandatory Environmental Impact Statement starts higher still, at 1,500 attached units / 1,000 unattached (Minn. R. 4410.4400, subp. 14, item D). Units are counted across all contiguous land the proposer owns or holds an option on. Below those lines there is no state environmental review to clear — Minnesota has no discretionary-approval catch-all of the CEQA or SEPA kind.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Every demolition is screened for historic significance',
        status: 'required',
        note: 'Minneapolis screens every demolition of a principal building for historic significance, anywhere in the city and regardless of the building’s age or whether it is designated (Minneapolis Code of Ordinances §§ 599.910, 599.920; Chapter 599 rewritten in its entirety by Ord. No. 2025-053, adopted November 20, 2025 — this is new law). A screen is not a designation, but it sits ahead of the demolition permit. If the planning director finds the building is not a potential historic resource the permit issues with no hearing. If it is flagged, you need an approved application for demolition of a potential historic resource, decided by the Heritage Preservation Commission at a public hearing, and the HPC may approve only on one of three findings: a certified engineer’s report of a structurally unsafe condition, a finding that the property lacks significance and integrity, or a cost estimate showing rehabilitation to the Secretary of the Interior’s Standards is not economically viable. Denial either converts into a landmark nomination with interim protection or imposes a 90-day demolition delay during which anyone may file a district nomination; the HPC can also condition approval on up to 90 days’ delay plus a documentation and mitigation plan.',
      })

      // Unit-count trigger (100+) on the NEW project → sizeDependent. The
      // 50-year test is on the EXISTING units; an unknown year built must not
      // wave it through (same rule as Austin's 50-year screen).
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      // The rule counts DWELLING UNITS demolished ("will demolish units that are
      // 50 or more years old"). Tearing down a warehouse or a store demolishes
      // none, and the inclusionary requirement stays at the ordinary 8% — but
      // the gate read only `teardown`, so any old building on the site raised a
      // replacement duty. Fails closed: a positive unit count, a residential
      // land use, or an unlabelled building all still fire; only an
      // affirmatively non-residential land use with no units suppresses it.
      const exLu = existing.lu
      const luResidential = /apartment|condo|multi-?family|town ?house|triplex|fourplex|duplex|dwelling|residen|housing|\bflats\b/i.test(exLu)
      const luNonResidential = /commercial|retail|office|industrial|warehouse|storage|parking|church|school|hotel|motel|restaurant|manufactur/i.test(exLu)
      const demolishesDwellings = existing.exUnits > 0 || luResidential || !luNonResidential
      // OVER-fire, corrected (2026-08-07). The 100 is a count of the NEW
      // project's dwelling units, and what it modifies is "the Inclusionary
      // Zoning requirement" — which § 550.810(a) attaches only to "a building or
      // use containing twenty (20) or more new or additional dwelling units".
      // A commercial or institutional project has no inclusionary requirement
      // for No Net Loss to raise, so the row cannot reach it however many units
      // the query string carries. Guarded to match the IZ gate above, which is
      // already `isResidential && units >= 50`; mixed-use still fires.
      // Under-fire the source names and this gate does not model: the duty is
      // sized by the NUMBER of 50-plus-year-old units demolished, which we do
      // not carry — the note states the rule rather than computing a figure.
      if (isResidential && units >= 100 && demolishesDwellings && (age == null || age >= 50)) {
        hurdles.push({
          category: 'demolition',
          label: 'No net loss: demolishing 50-year-old units raises a replacement duty',
          sizeDependent: true,
          status: 'required',
          note:
            age == null
              ? 'A project of 100 or more units that demolishes existing dwelling units 50 or more years old owes, as its inclusionary requirement, the GREATER of 8% of the units in the project or the number of 50-plus-year-old units being demolished (Minneapolis Unified Housing Policy § III(A)(1)(viii), "No Net Loss", applied through Minneapolis Code of Ordinances § 550.810). Demolish 40 old units inside a 150-unit project and you owe 40 affordable units, not 12 — and the cash-in-lieu alternative scales up with it. The record shows no year built for the existing building here — confirm its age early, because the rule turns on it.'
              : `A project of 100 or more units that demolishes existing dwelling units 50 or more years old owes, as its inclusionary requirement, the GREATER of 8% of the units in the project or the number of 50-plus-year-old units being demolished (Minneapolis Unified Housing Policy § III(A)(1)(viii), "No Net Loss", applied through Minneapolis Code of Ordinances § 550.810). Demolish 40 old units inside a 150-unit project and you owe 40 affordable units, not 12 — and the cash-in-lieu alternative scales up with it. The building here dates to ${yb}, so it is over that line; count the old units before you price the site.`,
        })
      }
    }

    // ABSENCE: no local prevailing-wage rule reaches a privately financed job.
    hurdles.push({
      category: 'labor',
      label: 'No prevailing-wage rule for privately financed projects',
      status: 'info',
      note: 'Minneapolis imposes no prevailing-wage or living-wage requirement on privately financed construction — its living-wage ordinance reaches only City contracts for services valued at $100,000 or more and City business subsidies valued at $100,000 or more (Minneapolis Code of Ordinances §§ 38.30, 38.40). The mirror image is the thing to watch: the moment you take tax increment financing, a land write-down, a fee deferral, city bonds or any other subsidy worth $100,000 or more, the living wage and the business-subsidy agreement attach. Minneapolis’s citywide minimum wage (Ch. 40, art. IV) is a separate rule that does cover every hour worked inside city limits, though it rarely binds on skilled construction trades.',
    })

    hurdles.push({
      category: 'environmental',
      label: 'Mississippi River Corridor Critical Area overlay',
      status: 'info',
      note: 'Parcels inside the MR Mississippi River Corridor Critical Area overlay carry a second layer on top of base zoning: the MRCCA sub-districts impose their own structure height and placement limits and lot sizes (§ 535.1650), plus vegetation-management, land-alteration/stormwater and exterior-lighting standards, and a permit is required for construction of buildings or additions, sewage-system work, vegetation removal and land alteration (Minneapolis Code of Ordinances §§ 535.1610, 535.1620(a), 535.1650, adopted under Minn. Stat. ch. 116G and Minn. R. 6106.0010–6106.0180). A variance needs extra written findings — no harm to primary conservation areas, public river corridor views, or birds using the Mississippi Flyway — beyond the ordinary variance test, and subdivisions or master-planned development of five or more acres face additional design standards (§ 535.1710). The trigger is geographic, not size — check the river corridor boundary on the zoning map (§ 530.800) before assuming the base district’s height applies.',
    })
  } else if (city === 'philadelphia') {
    // The Philadelphia Code (Title 14 zoning, Title 19 taxes, Title 4 Subcode
    // "A" administrative), read on American Legal, plus the PWD manual.
    // Table 14-304-2 has TWO cases, and the truncated table carried only the
    // first. Case 1 is citywide at >100,000 sq ft / >100 units. Case 2 HALVES
    // both figures (>50,000 sq ft / >50 units) where the site "affects" a
    // property in a Residential district — shares a side or rear line, is
    // separated only by an alley, or is within 200 ft on the same or facing
    // blockface (§ 14-304(5)(b)(.2)). We hold no adjacency data, so the halved
    // band is 'likely' with the condition named, not asserted.
    //
    // Two qualifiers sit ahead of both cases and neither was implemented.
    // (a) Each case requires "new construction or an expansion" and counts only
    //     floor area / units created OUTSIDE an existing structure — Table
    //     14-304-2 excludes "any floor area within an existing structure" and
    //     "any dwelling units within an existing structure". A change of use
    //     inside an existing building creates neither, so it cannot meet either
    //     case however large the building is.
    // (b) Both cases open "located in any district, except as provided in
    //     § 14-304(5)(b)(.1)" — SP-ENT, SP-PO and SP-STA are excluded outright.
    // The industrial exclusion is "certain I-1/I-2/I-3/I-P buildings" — the
    // source qualifies it with "certain", so it stays in the note rather than
    // becoming a gate we would have to invent the boundary of.
    const phlDistrict = parcel.zoning.districtCode ?? ''
    const cdrEligible = project.projectType !== 'change_of_use' && !/^SP-(ENT|PO|STA)\b/i.test(phlDistrict)
    const cdrCase1 = cdrEligible && (project.gfa > 100000 || (isResidential && units > 100))
    const cdrCase2 = cdrEligible && (project.gfa > 50000 || (isResidential && units > 50))
    // § 14-303(12)(a)(.3) and § 18-502(2)(c) both trigger on "meets the
    // requirements for Civic Design Review in § 14-304(5)" — which is Case 1 OR
    // Case 2. Reading only Case 1 made both rows NARROWER than their source: a
    // 60-unit project in the halved band was never told RCO notice or a Project
    // Information Form might apply at all. Case 2 turns on adjacency we do not
    // hold, so that arm carries the CDR row's own 'likely', not 'required'.
    if (cdrCase1 || cdrCase2) {
      hurdles.push({
        category: 'review',
        label: 'Civic Design Review',
        sizeDependent: true,
        status: cdrCase1 ? 'required' : 'likely',
        note: cdrCase1
          ? 'New construction or expansion creating more than 100,000 sq ft of new gross floor area — or more than 100 additional dwelling units, in either case excluding anything inside an existing structure — must go through Civic Design Review, including a public meeting, before permits (Phila. Code § 14-304(5)(b) and Table 14-304-2). The threshold halves to 50,000 sq ft or 50 units where the site affects a property in a Residential district. Review is advisory (§ 14-304(5)(d)), but L&I cannot issue a final decision and the Zoning Board cannot open a hearing until it completes; the code’s only stated duration is a backstop — a good-faith applicant is deemed complete at 150 days. SP-ENT, SP-PO and SP-STA districts, certain I-1/I-2/I-3/I-P industrial buildings, and wireless facilities are excluded.'
          : 'This project is over 50,000 sq ft of new gross floor area or over 50 additional dwelling units, which is the HALVED Civic Design Review threshold that applies where the property affects a property in any Residential district — sharing a side or rear lot line, separated only by an alley, or within 200 ft on the same or facing blockface (Phila. Code § 14-304(5)(b) and Table 14-304-2, Case 2; definition at § 14-304(5)(b)(.2)). It is below the 100,000 sq ft / 100-unit citywide trigger, so whether CDR applies turns on that adjacency — confirm it. Review is advisory (§ 14-304(5)(d)), but L&I cannot issue a final decision until it completes.',
        addsMonths: 5,
      })
    }

    if (isResidential) {
      // Threshold restored: a "Residential Housing Project" is 10+ dwelling
      // units (or 20+ sleeping units), not any residential project.
      if (units >= 10) {
        hurdles.push({
          category: 'affordability',
          label: 'Mixed Income Neighborhoods (/MIN) overlay: mandatory affordable units',
          sizeDependent: true,
          status: 'likely',
          note: 'Inside the /MIN Mixed Income Neighborhoods overlay, a development of 10 or more dwelling units (or 20 or more sleeping units), alone or combined with closely related development, must make at least 15% of dwelling units affordable ON SITE, and 20% of dwelling units and 20% of sleeping units affordable overall (Phila. Code § 14-533(2), § 14-533(3)(a)–(b)). The extra 5% can be shifted off-site within a half mile, or bought out, only with a Department of Planning and Development waiver for "exceptional circumstances". The in-lieu payment is $9 per sq ft of maximum permitted gross floor area in RM-2/3/4, RMX-1/2/3, IRMX and CMX-3/4/5, or $10,900 per permitted dwelling unit in RM-1, CMX-1, CMX-2 and CMX-2.5. Exempt: developments where under 25% of gross floor area is residential, institution-owned student housing, and personal care homes. The overlay is mapped to parts of the 3rd Council District (University City / West Philadelphia) and several 7th District areas (Kensington/Fairhill, Frankford/Oxford Circle, Hunting Park), plus lots in both the /TOD overlay and the 7th District — confirm whether your parcel is inside the mapped boundaries, because outside them none of this applies.',
        })
      }

      // ABSENCE, and the headline for Philadelphia: the /MIN overlay aside,
      // affordability is bought with bonuses, never mandated.
      hurdles.push({
        category: 'affordability',
        label: 'No citywide inclusionary mandate',
        status: 'info',
        note: 'Outside the /MIN overlay, Philadelphia sets no affordable-unit mandate at any project size. Affordability is voluntary and traded for extra floor area under the Mixed Income Housing bonus (Phila. Code § 14-702(7)(a)).',
      })

      hurdles.push({
        category: 'fees',
        label: 'Development Impact Tax: 1% of construction cost',
        status: 'required',
        note: 'Philadelphia levies a Development Impact Tax of $1.00 per $100 of construction or improvement costs — a flat 1% — on any building permit for a structure for human occupancy for residential purposes (Phila. Code § 19-4402(1), ch. 19-4400, added by Bill No. 200556, effective January 1, 2022 for permit applications filed on or after that date). There is no floor-area or unit-count threshold and no small-project exemption. Half is due when the building permit issues and half at the certificate of final inspection. Non-residential construction is not taxed; in a mixed-use building the tax reaches only the costs attributable to the residential portion, including its common space. Proceeds go to the Housing Trust Fund. Exemptions are use-based (§ 19-4401(3)): improvements ineligible for real-estate tax exemption under §§ 19-1303.2/.3/.4, property exempt under 72 P.S. § 5020-204 or the Keystone Opportunity Zone Act, turn-over improvements to an existing rental unit, and certified City-funded affordable projects.',
      })
    }

    // NOT discretionary-only. § 14-303(12)(a) lists FOUR triggers and the
    // truncated table carried one: a ZBA special exception or variance, OR
    // meeting the Civic Design Review criteria of § 14-304(5), OR a /NCO
    // Commission building-permit review, OR /UCO Planning Commission approval.
    // The CDR arm makes this fire on a purely as-of-right, size-triggered
    // permit — so when it fires that way it is size-gated and tagged as such.
    if (discretionary || cdrCase1 || cdrCase2) {
      hurdles.push({
        category: 'review',
        label: 'RCO neighborhood notice and public meeting',
        status: discretionary || cdrCase1 ? 'required' : 'likely',
        ...(discretionary ? {} : { sizeDependent: true }),
        note: `${
          discretionary
            ? 'An application needing Zoning Board approval — a special exception under § 14-303(7) or a variance under § 14-303(8) — must be noticed to the Registered Community Organizations covering the parcel, and a public meeting held, before the hearing'
            : cdrCase1
              ? 'This project meets the Civic Design Review criteria of § 14-304(5), which is an independent trigger for RCO notice even on an as-of-right permit: the parcel must be noticed to the Registered Community Organizations covering it, and a public meeting held'
              : 'This project sits in the HALVED Civic Design Review band (Table 14-304-2, Case 2), which applies only where the property affects a property in a Residential district. If it does, the project meets the Civic Design Review criteria of § 14-304(5) — an independent trigger for RCO notice even on an as-of-right permit — and the parcel must be noticed to the Registered Community Organizations covering it, with a public meeting held. Confirm the adjacency, because the whole row turns on it'
        } (Phila. Code § 14-303(12)(a), (b)(.4), (e)(.1)). The Planning Commission names a Coordinating RCO, and you must mail written notice to every RCO covering the site, the district Councilmember, and every property within 250 ft plus the whole blockface and the facing blockface. The Coordinating RCO convenes the public meeting — which you or your representative must attend — within 45 days of the appeal filing or of L&I’s notice that CDR is required, and Civic Design Review will not meet on your application until you document that it happened. Practically, the district Councilmember’s involvement is the point: councilmanic prerogative means their read of that meeting often decides a project.`,
      })
    }

    // Floor-area trigger → sizeDependent (rule 1). The 2,500 sq ft figure is
    // only HALF the trigger: § 18-502(2) is conjunctive — a covered development
    // project is over 2,500 sq ft AND requires a Council ordinance/resolution,
    // a ZBA special exception or variance, or meets the CDR criteria. The
    // truncated table lost the second half, so this fired on size alone.
    const pifExemptSmallResidential = project.use === 'residential' && units >= 1 && units <= 3
    if (project.gfa > 2500 && (discretionary || cdrCase1 || cdrCase2) && !pifExemptSmallResidential) {
      hurdles.push({
        category: 'review',
        label: 'Project Information Form (Chapter 18-500)',
        sizeDependent: true,
        status: discretionary || cdrCase1 ? 'required' : 'likely',
        note: `A structure — or a resulting structure — of more than 2,500 sq ft gross floor area is a "covered development project" and must file a sworn Project Information Form when it ${
          discretionary
            ? 'requires a Zoning Board special exception or variance'
            : cdrCase1
              ? 'meets the Civic Design Review criteria of § 14-304(5)'
              : 'meets the Civic Design Review criteria of § 14-304(5) — which here depends on the halved Case 2 threshold, so it applies only if the property affects a property in a Residential district; confirm that adjacency'
        }; a Council ordinance or resolution is a third trigger (Phila. Code § 18-502(2), § 18-503, ch. 18-500). Purely residential developments of three or fewer dwelling units are exempt, as are signage-only applications. The form must state net change in units and floor area, projected construction period, parking, any bonuses sought, stormwater and remediation plans, and headcount and wage ranges for construction and permanent jobs. Civic Design Review will not meet on the project until the form is delivered, and Council cannot pass an enabling ordinance unless it is filed 10 days before the hearing and attached to the bill. It is published on the City’s website and stays there five years.`,
      })
    }

    // Earth-disturbance area, approximated by lot area. Tagged sizeDependent
    // per the research row; the tag only ever downgrades, so it fails closed.
    if (lotSqFt >= 5000) {
      hurdles.push({
        category: 'environmental',
        label: 'Water Department stormwater review',
        sizeDependent: true,
        status: 'likely',
        note: 'Disturbing 5,000 sq ft or more of earth requires an erosion-and-sediment control plan submission and Water Department stormwater review; 15,000 sq ft or more of earth disturbance triggers the full Post-Construction Stormwater Management requirements in most of the city, dropping to 5,000 sq ft in the Darby and Cobbs Creek watershed (Phila. Code § 14-704(3)(a)(.1), (b), which delegates the threshold to PWD regulation; figures from the PWD Stormwater Management Guidance Manual ch. 1 § 1.1.3). No zoning or building permit issues until PWD signs off, and the plan is deemed to comply if PWD fails to approve or disapprove within 45 days. Note the threshold is measured in EARTH DISTURBANCE area, not floor area — it turns on how much of the lot you touch, and lot size is only a proxy here. Demolition-only work is generally exempt from PCSM but still owes an E&S plan. This is the environmental gate on a Philadelphia project.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Licensed demolition contractor and 21-day posted notice',
        status: 'required',
        note: 'Demolition in Philadelphia must be carried out by a Demolition Contractor licensed under § 9-1008, and L&I issues a notice the contractor must post on EVERY street frontage; demolition cannot commence less than 21 days from the date of that initial posting (Phila. Code Title 4, Subcode "A" §§ A-303.1, A-303.2, A-303.2.1, A-303.3). The permit is valid only for the contractor named on it, so swapping contractors requires a permit amendment. A separate demolition permit is required wherever the work demolishes, moves or removes a structure greater than one story or greater than 500 sq ft (§ A-301.1). The posting — and with it the 21-day wait — has three stated exceptions: a structure L&I has declared imminently dangerous, a structure already posted under § 14-303(13), and a structure that was the subject of a Zoning Board variance. The Department also distributes an informational bulletin to every property within 250 ft, the district Councilmember, and any RCO covering the site. Plan the 21 days into the schedule — it runs before any machine moves.',
      })

      // The trigger has TWO parts: current-or-former religious use AND at least
      // 50 years old. An unknown year built must not wave it through (same rule
      // as the Minneapolis no-net-loss screen above); a building known to be
      // under 50 cannot be caught by it, so it is not raised.
      const phlYb = existing.ex?.yearBuilt
      const phlAge = phlYb == null ? null : new Date().getFullYear() - phlYb
      if (phlAge == null || phlAge >= 50) {
        hurdles.push({
          category: 'demolition',
          label: 'Demolishing a former house of worship: extra RCO review',
          status: 'info',
          note: `If the structure being demolished is currently, or was formerly, used as a church, synagogue, mosque or other religious facility AND is at least 50 years old, L&I may not issue the demolition permit until it notifies the district Councilmember and the RCO, receives confirmation that the RCO held a meeting to discuss the demolition within 30 days of that notice, and fully considers the RCO’s position (Phila. Code Title 4, Subcode "A" § A-303.5, added by Bill No. 220110, 2022). It applies on FORMER religious use, so a building long since converted to housing or offices can still be caught. ${
            phlYb == null
              ? 'The record shows no year built here — verify both the age and the use history before pricing a teardown.'
              : `The building here dates to ${phlYb}, so it clears the 50-year half of the trigger — verify the use history before pricing a teardown.`
          }`,
        })
      }

      hurdles.push({
        category: 'demolition',
        label: '/AHP overlay: no demolition without a replacement plan',
        status: 'info',
        note: 'On a lot inside the /AHP Affordable Housing Preservation overlay, no zoning or building permit issues for demolition of a principal building unless a building permit has ALREADY been issued for the construction, expansion or alteration of a principal building on the same lot (Phila. Code § 14-534(6)(b), (c)). It governs sequencing, not unit count — an anti-vacant-lot rule rather than a no-net-loss rule — and it supersedes any other demolition authorization, waived only for an L&I-declared imminently dangerous or unsafe condition. The overlay is five small areas of West Philadelphia around Market Street between roughly 39th and 46th Streets, plus a Sansom-to-Walnut block at 45th–46th; confirm whether your parcel is in it. (The separate temporary moratorium in the same section expired March 13, 2023.)',
      })
    }
  } else if (city === 'miami') {
    // City of Miami Code of Ordinances and Miami 21 (the zoning code), plus the
    // Miami-Dade County Code for the two county-wide impact fees and the 2025
    // Florida Statutes for the two state-level absences.
    // § 13-6's own exemption is a net-increase test, not a use test: a building
    // permit for "additions, remodels, rehabilitation or other improvements to
    // an existing structure and reconstruction of a demolished structure which
    // result in ... no net increase in the number of residential dwelling
    // units" pays nothing. The gate read residential use alone. Not tagged
    // sizeDependent — the research row states False, and this is a zero /
    // non-zero applicability test rather than a magnitude threshold.
    if (isResidential && units >= 1) {
      hurdles.push({
        category: 'fees',
        label: 'City of Miami development impact fees',
        status: 'required',
        note: 'Any new development producing a net increase in dwelling units pays FOUR separate City of Miami impact fees, collected before the building permit issues (City of Miami Code §§ 13-6, 13-7, 13-9, 13-10, 13-11, 13-12; Ord. No. 12750, adopted 12-15-2005 — Chapter 13 carries no CPI escalator, so these remain the operative amounts). There is no size threshold, but the per-unit rate tiers by units per building. In a building of 10 or more units ("high rise") each unit pays police $95.00 + fire-rescue $409.00 + general services $239.00 + parks and recreation $3,959.00. In a 3–9-unit building ("low rise") each unit pays $144.00 + $619.00 + $363.00 + $5,998.00. A single-family detached house pays $164.00 + $704.00 + $413.00 + $6,818.00. A remodel or addition with no net increase in dwelling units is exempt.',
      })
    }

    if (isResidential) {
      // Kept on residential use rather than a net-unit test: § 33K-5 is charged
      // per new unit BUT the same section reaches "expansions of existing
      // units", so a residential job adding floor area and no units can still
      // owe it. Narrowing this to units >= 1 would under-fire.
      hurdles.push({
        category: 'fees',
        label: 'Miami-Dade educational facilities impact fee',
        status: 'required',
        note: 'Any building permit for new residential development anywhere in Miami-Dade County pays the county’s educational facilities impact fee, on top of the city’s own fees, and the city cannot issue the permit until it is paid (Miami-Dade County Code §§ 33K-1(c), 33K-5, 33K-6; § 33K-5 amended by Ord. No. 22-26, 3-1-2022). The codified formula is: new unit size in square feet × $0.90 + a $600.00 base fee + a 2% administrative fee. The county presumes units larger than 3,800 sq ft create no additional school impact, so the square-footage component effectively tops out there. A ~900 sq ft apartment therefore carries roughly $1,400; a 2,500 sq ft house roughly $2,900. It is also charged on conversions from non-residential to residential and on expansions of existing units.',
      })

      // ABSENCE: no affordability mandate at any size anywhere in the city.
      hurdles.push({
        category: 'affordability',
        label: 'No mandatory inclusionary requirement',
        status: 'info',
        note: 'Miami sets no affordable-unit mandate and no linkage fee at any project size — no unit count or floor area triggers an affordability obligation on a base-zoned project. Miami 21’s housing provisions are all opt-in incentive programs you qualify INTO in exchange for extra height, density or parking relief: § 3.15 (Affordable and Attainable Mixed-Income Housing Special Benefit Program), § 3.14 (Public Benefits), § 3.16.A/B (Workforce Housing) and § 3.19 (Transit Station Neighborhood Development). Building at base zoning triggers none of them. Florida law is the structural reason: a municipality imposing inclusionary zoning or a linkage fee must "provide incentives to fully offset all costs to the developer" (Fla. Stat. § 166.04151(4) (2025)). A vestigial Affordable Housing Trust Fund contribution survives in City Code § 13-8.2 but cross-references section 914 of Ordinance 11000 — the code Miami 21 replaced in 2010.',
      })
    }

    hurdles.push({
      category: 'fees',
      label: 'Miami-Dade multimodal mobility impact fee',
      status: 'required',
      note: 'Every building permit application for development activity in Miami-Dade County pays the county’s multimodal mobility impact fee, and the CITY cannot issue your building permit until it is paid (Miami-Dade County Code §§ 33E-2(c), 33E-6, 33E-7.1, 33E-8; Ord. No. 23-68, adopted 9-6-2023). It is charged per dwelling unit for residential: under the adopted rate schedule in § 33E-8 a multifamily unit (mid-rise or high-rise) runs $4,465 in Context Zone 2, $4,638 in Context Zone 1 (the SMART Plan corridors), $4,901 in Context Zone 3 and $5,115 in Context Zone 4 — which of the four zones applies is set by the parcel’s location under § 33E-7.1. This is a county charge and is separate from the city’s impact fees.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Downtown DRI supplemental fee (Downtown Miami only)',
      status: 'info',
      note: 'Net new development inside the Downtown Development of Regional Impact area pays a fourth layer of fee on top of the city and county impact fees, charged per gross square foot of floor area so it scales with the building (City of Miami Code §§ 13-55, 13-56, 13-56.1). The imposing provision opens with an exception in as many words — "Except as may be provided section 13-58, no zoning permits, building permits or other development permits shall be issued for any net new development ... unless the applicant has paid the downtown development supplemental fee" — and § 13-58 was NOT read here, so treat the fee as presumptively owed but check that section before assuming it is unavoidable. The codified residential coefficient is $0.3846 per gross sq ft — transportation mitigation $0.1531 + master-plan recovery $0.156223 + DRI administration $0.07521 — but § 13-56.1 escalates every fee by CPI each March 1 since 2018, capped at 10% a year, so the amount actually collected today is materially higher than the codified figure; confirm the current published coefficient with the Planning Department rather than budgeting the codified one. It applies only downtown — confirm whether your parcel is inside the DRI boundary. A parallel supplemental fee exists for the Southeast Overtown/Park West area under §§ 13-96 et seq.',
    })

    // Floor-area trigger → sizeDependent (rule 1).
    if (project.gfa > 200000) {
      hurdles.push({
        category: 'review',
        label: 'Urban Development Review Board referral (200,000 sq ft)',
        sizeDependent: true,
        status: 'likely',
        note: 'Projects exceeding 200,000 sq ft of floor area are referred to the Urban Development Review Board — nine architects and landscape architects who review and recommend on design — as may any project the Planning Director deems necessary (Miami 21 § 7.1.1.2(10); City of Miami Code ch. 62, art. IX, §§ 62-256 to 62-259). The code frames this as a Director power rather than an automatic requirement, which is why it reads "likely" and why a smaller project can be referred at will. The same 200,000 sq ft figure also forces a Warrant or Exception application to the Coordinated Review Committee (§§ 7.1.2.4, 7.1.2.6). Otherwise Miami’s design review is light: there is no mandatory design-review board for an ordinary by-right building and Administrative Site Plan Review is explicitly optional (§ 7.1.2.10).',
      })
    }

    // ABSENCE, and the biggest single difference from the California cities:
    // Florida has no CEQA/SEPA analogue for an ordinary city project.
    hurdles.push({
      category: 'environmental',
      label: 'No state environmental review act',
      status: 'info',
      note: 'Florida has no state environmental review statute of the CEQA or SEPA kind. The absence is conditional, not flat, and § 380.06(12)(a) states the condition: a proposed development that EXCEEDS the statewide guidelines and standards of Fla. Stat. § 380.0651, and is not otherwise exempt, must still be approved by the LOCAL government under Fla. Stat. § 163.3184(4) — and only where the development is consistent with the comprehensive plan (§ 163.3194(3)(b)) does even that review drop away (Fla. Stat. § 380.06(12)(a) (2025), as rewritten by ch. 2018-158). For a Miami project consistent with the Miami Comprehensive Neighborhood Plan there is no state-level environmental or regional-impact review to run at all, which removes what is usually the largest schedule risk in the California and Washington cities — but consistency is the thing that buys it, not project type. Federal review (NEPA, Army Corps § 404) still applies where a federal permit or federal money is involved, and Miami-Dade County’s environmental code (ch. 24 — wetlands, mangroves, natural forest communities, tidal waters) is a separate permitting layer this tool does not model.',
    })

    hurdles.push({
      category: 'environmental',
      label: 'Tree removal permit and replacement / Tree Trust Fund',
      status: 'likely',
      note: 'Any tree activity on any property in the city — public or private — needs a permit before you clear a site, with replacement trees or a payment into the Tree Trust Fund (City of Miami Code §§ 17-3, 17-4, 17-6 and Chart 17.6.1.1). The applicability clause is qualified in as many words — the article applies to all public or private property in the city "unless expressly exempted by law" — and that exemption list was NOT read here, so confirm whether a particular tree is exempt rather than assuming every tree on the lot is covered. Removal is priced on a sliding scale by the summed diameter of what you take out: a single 13"–18" DBH tree requires six 2"-caliper replacement trees, or three 4"-caliper trees, or a $6,000.00 contribution to the Tree Trust Fund; 49"–60" requires 20 trees, 10 trees, or $20,000.00, and totals above 60 inches accumulate from the top of the chart down. On a mature Coconut Grove or Shenandoah lot this is a real line item. The trigger is the trees on your site, not the size of the building. Trees in an Environmental Preservation District (ch. 17, art. II) or in a Miami-Dade natural forest community or wetland carry additional county review under ch. 24 of the county code.',
    })

    if (teardown) {
      // § 23-6.2(b)(4)b.4's deferral has TWO arms and only the second is
      // citywide. The six-month arm applies to "demolition or relocation of a
      // contributing structure or landscape feature" — inside a designated
      // historic district or site, since that is what "contributing" is
      // contributing TO, and the certificate of appropriateness the deferral
      // attaches to is itself required only there (§ 23-6.2(a)). The gate read
      // `teardown` alone, so every Miami teardown in the city was told a
      // six-month historic delay was 'likely'. The 45-day archaeological arm
      // does reach any ground-disturbing work, so it keeps a row of its own
      // rather than disappearing with the district test.
      if (parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic demolition delay',
          status: 'likely',
          note: 'This parcel is in a designated historic district, so demolishing or relocating a CONTRIBUTING structure or landscape feature here can be delayed while alternatives are explored: the HEPB may approve the demolition but defer the effective date of that approval by up to six months (City of Miami Code § 23-6.2(b)(4)b.4). Ground-disturbing work touching an archaeological site, zone or conservation area can be deferred up to 45 calendar days on the same mechanism. Both are stated CEILINGS, not scheduled durations, so no fixed delay is added to the timeline here. Confirm whether the existing building is contributing — a non-contributing building in the district is not reached by the six-month arm.',
        })
      } else {
        hurdles.push({
          category: 'demolition',
          label: 'Archaeological zone: certificate to dig and possible deferral',
          status: 'info',
          note: 'This parcel is not in a designated historic district, so the six-month HEPB demolition deferral — which reaches contributing structures in a designated district or site — does not apply. The other arm of the same provision does not depend on a district: a certificate to dig is required for any ground-disturbing activity within a designated archaeological site, archaeological zone or archaeological conservation area, and the HEPB may defer the effective date of that approval by up to 45 calendar days (City of Miami Code § 23-6.2(a), (b)(4)b.4). The designated zones cover substantial stretches of the Miami River, Brickell and the Biscayne Bay shoreline, so a teardown-and-rebuild near the water should check the archaeological map before assuming clear ground. This is a stated CEILING, not a scheduled duration, so no delay is added to the timeline here.',
        })
      }

      // ABSENCE: unusual among the cities we cover, and it cuts the other way —
      // no tenant-relocation duty on a Miami teardown outside a historic
      // district. The trigger says "outside a designated historic district" in
      // as many words; inside one, demolition runs the certificate-of-
      // appropriateness process above and the absence is not the whole story.
      if (existing.rentalMultifamily && !parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'No tenant relocation or replacement-housing requirement',
          status: 'info',
          note: 'Demolishing occupied rental housing outside a designated historic district triggers no city relocation payment, no no-net-loss replacement duty, and no conditional-use hearing of the kind SF Planning Code § 317 or LA’s RSO/Ellis Act impose — the opposite of the rule in most cities we cover. Chapter 47, the code’s entire rental-housing chapter, consists of one article, and what it requires is 30 days’ written notice to terminate a month-to-month tenancy; beyond that it defers to Fla. Stat. ch. 83 (City of Miami Code ch. 47, art. I, § 47-1, read with Fla. Stat. § 166.043(1)(a) (2025)). Nor is there rent stabilization to trigger — Florida preempts local price controls on lawful business activity. A Miami teardown is a demolition-permit-and-abatement problem, not an entitlement problem.',
        })
      }
    }

    // ABSENCE: state law confines prevailing wage to public work.
    hurdles.push({
      category: 'labor',
      label: 'No local prevailing-wage rule on private projects',
      status: 'info',
      note: 'Florida forbids cities and counties from imposing wage or benefit mandates on private employers, so Miami has no local prevailing-wage or living-wage rule reaching a privately financed residential project (Fla. Stat. § 218.077(2)–(3)(a) (2025)). Three carve-outs survive: the city’s own employees, employers under contract with the city, and — the one developers hit — employees of an employer receiving a direct tax abatement or subsidy from the political subdivision, as a condition of that abatement or subsidy. So the wage strings attach only if you take city money or a city abatement. Federal Davis-Bacon still applies to federally assisted work.',
    })
  } else if (city === 'sandiego') {
    // San Diego Municipal Code, read from the city-published PDFs on
    // docs.sandiego.gov (Ch. 12 CEQA; Ch. 13 art. 2 CPIO; Ch. 14 art. 2 divs. 5,
    // 6, 13; Ch. 14 art. 3 divs. 1, 2, 8, 11, 12). The parking row is carried by
    // PARKING_RULES['sandiego'] at the bottom of this function, not here.
    const inCoastalOverlay = !!parcel.overlays.coastalZone

    // The set-aside itself, stated once — it is the same either side of the
    // coastal threshold, and only the unit trigger moves (§ 142.1304 / § 142.1306).
    const SD_INCLUSIONARY_TERMS =
      'A rental project must set aside at least 10% of its units at 30% of 60% of median income, affordable for 55 years; a for-sale project 10% at median income or 15% at moderate income (§ 142.1304(a)–(b)). The alternative is the Inclusionary In Lieu Fee, which § 142.1306(a) sets at $25.00 per square foot of net market-rate building area effective July 1, 2024, escalated annually by the ENR Los Angeles Construction Cost Index — so today’s published rate is above $25.00 and must be confirmed with the City rather than assumed. A condominium conversion triggers the division at just 2 dwelling units. One caveat on the trigger itself: § 142.1302 applies the division "except as provided in Section 142.1303", and § 142.1303 was not read here — check it before assuming the requirement attaches to your project.'

    // The inclusionary threshold is 10 units — but 5 inside the Coastal Overlay
    // Zone, which is why the trigger reads off the overlay rather than a constant.
    if (isResidential && units >= (inCoastalOverlay ? 5 : 10)) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Affordable Housing',
        sizeDependent: true,
        status: 'required',
        note: inCoastalOverlay
          ? `This parcel is in the Coastal Overlay Zone, where San Diego’s Inclusionary Affordable Housing requirement starts at 5 dwelling units instead of the citywide 10 (San Diego Municipal Code § 142.1302). ${SD_INCLUSIONARY_TERMS}`
          : `Residential development of 10 or more dwelling units is subject to San Diego’s Inclusionary Affordable Housing regulations; inside the Coastal Overlay Zone the threshold drops to 5 units (San Diego Municipal Code § 142.1302). ${SD_INCLUSIONARY_TERMS}`,
      })
    }

    // The exception is numeric, not vague: residential development of four or
    // fewer dwelling units is exempt outright, so this fires from the fifth unit.
    // Non-residential development has no unit exemption at all.
    if (!isResidential || units >= 5) {
      hurdles.push({
        category: 'fees',
        label: 'Mobility Choices (VMT) requirements',
        sizeDependent: true,
        status: 'required',
        note: 'Any development issued a building permit must satisfy San Diego’s Mobility Choices regulations, except residential development of four or fewer dwelling units — so a housing project hits this at 5 units (San Diego Municipal Code §§ 143.1102, 143.1103). You either build vehicle-miles-travelled reduction measures worth 5 points in Mobility Zone 2 or 8 points in Mobility Zone 3 (Land Development Manual Appendix T), or pay the Active Transportation In Lieu Fee if the site is in Mobility Zone 4. Sites within a half-mile walk of an existing passenger rail station, and all of Downtown (Mobility Zone 1), are exempt. Watch the parking interaction: build MORE parking than the minimum and § 143.1103(b)(6)–(7) raises the requirement to 8 points (Zone 2) or 11 points (Zone 3), and expressly switches off the transit-priority-area zero-parking rule for that calculation. Fee amounts are set by City Council resolution, not in the code.',
      })
    }

    // Fires on the EXISTING structure's age, not on project size. An unknown
    // year built must NOT wave it through (same rule as Austin's 50-year screen).
    if (existing.hasBuilding) {
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      if (age == null || age >= 45) {
        hurdles.push({
          category: 'historic',
          label: '45-year historical screening',
          status: 'required',
          note:
            age == null
              ? 'The record shows an existing building here but no year built. In San Diego, any parcel carrying a structure 45 or more years old — or flagged on the Historical Resource Sensitivity Maps — must be screened for a site-specific historical survey before a construction or development permit issues (San Diego Municipal Code § 143.0212(a), (c)). The City Manager makes that call within 10 business days of a construction-permit application, or 30 calendar days of a development-permit application; if a survey is required and finds a historical resource, the project falls into the Historical Resources Regulations and a discretionary permit. Interior-only work and in-kind roof or foundation repair are exempt. Confirm the building’s age early, because the screening sits ahead of the permit.'
              : `This parcel’s existing building dates to ${yb}, so it is 45 or more years old — San Diego screens it for a site-specific historical survey before a construction or development permit issues (San Diego Municipal Code § 143.0212(a), (c)). The City Manager decides whether a survey is needed within 10 business days of a construction-permit application, or 30 calendar days of a development-permit application; if the survey finds a historical resource, the project falls into the Historical Resources Regulations and a discretionary permit. This is not limited to designated landmarks or historic districts.`,
        })
      }
    }

    // Historical resource present. § 143.0210(e)(2)(B) reaches "Multiple dwelling
    // unit residential, COMMERCIAL, OR INDUSTRIAL development on any size lot, or
    // any subdivision on any size lot" — the residential-only gate here was
    // NARROWER than the code and left a commercial project on a historical-resource
    // parcel with no Process Four row at all. Tagged sizeDependent because the
    // residential limb reads a unit count (rule 1); the tag only ever downgrades,
    // so it fails closed.
    if (parcel.overlays.historicDistrict && ((isResidential && units >= 2) || isCommercial)) {
      hurdles.push({
        category: 'historic',
        label: 'Site Development Permit (Process Four) where a historical resource is present',
        sizeDependent: true,
        status: 'required',
        note: 'Multiple-dwelling-unit residential, commercial or industrial development on premises holding a historical resource — and any subdivision — needs a Site Development Permit decided through Process Four: a Planning Commission public hearing, appealable to the City Council (San Diego Municipal Code § 143.0210(e)(2), (e)(2)(B); Process Four defined at § 112.0507). Lot size does not matter: the code says "on any size lot". The only carve-outs on this row are capital improvement program projects, public projects and project-specific land use plans, none of which a private development is. And § 143.0210(b) applies the division to the WHOLE premises if any portion of it contains historical resources, so a resource in one corner pulls the entire site in. Separate exemptions at § 143.0220 were not read here — check them before assuming the permit is unavoidable.',
      })
    }

    // The permit assignment we actually read is Table 143-01A ROW 3, which covers
    // MULTIPLE DWELLING UNIT development. Firing this on a single-dwelling or a
    // commercial project would publish a Process Three claim off a row nobody
    // read (rule 5: a gap must not render as an answer). The site conditions
    // themselves — biological resources, steep hillsides, coastal bluffs — are
    // not in any dataset we hold, so the copy stays conditional on them.
    if (isResidential && units >= 2) {
      hurdles.push({
        category: 'environmental',
        label: 'Environmentally Sensitive Lands: Site Development Permit',
        sizeDependent: true,
        status: 'likely',
        note: 'If any portion of the premises contains sensitive biological resources, steep hillsides, coastal beaches (including V zones), sensitive coastal bluffs, or a FEMA Special Flood Hazard Area (except V zones), multiple-dwelling-unit development needs a Site Development Permit decided through Process Three — a Hearing Officer at a public hearing, appealable to the Planning Commission (San Diego Municipal Code § 143.0110(a), (b)(1), Table 143-01A row 3; Process Three at §§ 112.0505, 112.0506). Any deviation from the ESL regulations pushes the permit up to Process Four. The trigger is what is on the ground, not project size — and note that a FEMA A-zone designation here is not just a build-higher problem, it is a discretionary hearing, which is what pulls CEQA in. Row 3 is the multiple-dwelling-unit row; other development types sit on rows this analysis has not read.',
      })
    }

    // CEQA attaches to DISCRETIONARY approvals, and § 128.0202(b) says so from
    // the other direction: an activity is not subject to CEQA if it does not
    // involve the exercise of discretionary powers. An unconditional row told
    // every as-of-right San Diego project it carried environmental review.
    if (discretionary) {
      hurdles.push({
        category: 'environmental',
        label: 'CEQA environmental review',
        status: 'likely',
        note: 'The California Environmental Quality Act attaches to any private activity needing a discretionary City approval — a development permit, a use permit, a variance (San Diego Municipal Code § 128.0202(a)(3), (b)). § 128.0202(b) states the converse: an activity is not subject to CEQA if it does not involve the exercise of discretionary powers, so a project that clears entirely as-of-right carries no CEQA document. Watch what can push you off the ministerial path even when the zoning works: a Site Development Permit for environmentally sensitive lands, a historical resource on the premises, a CPIO "Type B" mapping, or any deviation from a development regulation.',
      })
    }

    if (teardown && (existing.exUnits > 0 || existing.multifamilyExisting)) {
      hurdles.push({
        category: 'demolition',
        label: 'Dwelling Unit Protection: no net loss and protected units',
        status: 'required',
        note: 'Any development with a complete application filed on or after January 1, 2020 that demolishes existing dwelling units runs San Diego’s Dwelling Unit Protection rules, and there is no unit threshold (San Diego Municipal Code §§ 143.1203, 143.1210). Before a demolition permit issues you must record a covenant guaranteeing the replacement project holds at least as many dwelling units as the most recent permitted development on the premises. On top of that, if any demolished unit is "protected" — rent-restricted, or simply rented by a very low or low income household at any point in the preceding five years (seven in Barrio Logan) — § 143.1212 requires one-for-one replacement at the same bedroom count and the same or lower income category, affordable for 55 years, plus tenant relocation benefits and a right of first refusal (definition at § 143.1207). The five-year lookback runs on who lived there, not on anything recorded against title, so an ordinary older rental building can be protected with no warning on the deed.',
      })

      // Two thresholds, not one: a single structure of 3+ units, OR 5+ units
      // where two or more structures are involved (§ 143.0815(b)(3)). With more
      // than one building on the premises, four units across them is below both.
      const coastalReplacementTrigger =
        (existing.ex?.numBuildings ?? 1) >= 2 ? existing.exUnits >= 5 : existing.exUnits >= 3
      if (inCoastalOverlay && coastalReplacementTrigger) {
        hurdles.push({
          category: 'demolition',
          label: 'Coastal Overlay Zone affordable housing replacement',
          sizeDependent: true,
          status: 'required',
          note: 'Inside the Coastal Overlay Zone, demolishing a residential structure of 3 or more dwelling units — or at least 5 dwelling units where two or more structures are involved — triggers a separate replacement-housing review under the City’s implementation of California Government Code § 65590, the Mello Act (San Diego Municipal Code § 143.0815(b)(3)). § 143.0830(a) prohibits converting or demolishing units occupied by very low, low or moderate income households unless replacement housing is provided; structures of fewer than three units, and four or fewer units on a multi-structure premises, are exempt (§ 143.0820(c)–(d)). This stacks on top of the citywide Dwelling Unit Protection Regulations rather than replacing them.',
        })
      }
    }

    // § 142.0640 exempts the FIRST TWO ADUs on a premises outright, so asserting
    // a required fee on an ADU project contradicts the ordinance for all but the
    // third-and-later ADU — a case no field on the record distinguishes.
    if (project.projectType !== 'adu') {
      hurdles.push({
        category: 'fees',
        label: 'Development Impact Fees for public facilities',
        status: 'required',
        note: 'Development in an area where the City has adopted Development Impact Fees pays them toward parks, mobility, library and fire facilities, and the final inspection will not occur until they are paid (San Diego Municipal Code § 142.0640(b)). There is no size threshold in the code, and the code states no amounts either — they are adopted separately by City Council resolution (e.g. R-313688 for the Citywide Park DIF), so no dollar figure should be taken from the ordinance. Exemptions written into the code: the first two ADUs on a premises, permanent supportive housing, low-barrier navigation centers, transitional housing, and inclusionary units provided on the same premises as the market-rate units.',
      })
    }

    hurdles.push({
      category: 'review',
      label: 'Community Plan Implementation Overlay Zone (CPIO)',
      status: 'info',
      note: 'A parcel mapped "Type B" in a Community Plan Implementation Overlay Zone needs a Site Development Permit decided through Process Three (Hearing Officer, public hearing, appealable to the Planning Commission) regardless of project size; a "Type A" parcel needs one only if the project does not comply with the community plan’s development criteria (San Diego Municipal Code § 132.1402(a)–(b), Table 132-14B rows (3) and (4)). Eighteen community plan areas carry the overlay — Uptown, Pacific Beach, Peninsula, Mission Valley, Kearny Mesa, Barrio Logan, Midway-Pacific Highway, University, Mira Mesa and Southeastern San Diego among them (Table 132-14A). Affordable, in-fill and sustainable-building projects can step down to a Neighborhood Development Permit under Process Two. The trigger is the mapping, not the project, and Type A versus Type B is on rezone maps filed with the City Clerk — confirm it per parcel.',
    })
  } else if (city === 'sanjose') {
    // San José Municipal Code, read from Municode's content API at Supp. No. 5,
    // Update 3 ("codified through Ordinance No. 31330, enacted June 16, 2026").
    // The parking row (Ch. 20.90 Part 8) is carried by PARKING_RULES['sanjose'],
    // and the Historic Preservation permit by HISTORIC_BODY['sanjose'] above.
    if (isResidential && units >= 20) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Housing Ordinance (20+ units)',
        sizeDependent: true,
        status: 'required',
        note: 'A residential development of 20 or more new, additional or modified dwelling units is subject to San José’s Inclusionary Housing Ordinance; under 20 units there is no obligation at all, and density-bonus units are excluded from the count (San José Municipal Code §§ 5.08.250.A, 5.08.320.A.2, 5.08.400.A). The on-site requirement is 15% of for-sale units affordable at up to 120% of Area Median Income, or — for rental — 5% to moderate-income households, 5% at 60% AMI and 5% at 80% AMI. Off-site construction, in-lieu fee, land dedication and acquisition/rehab options exist (§§ 5.08.510–5.08.590), but taking an off-site route raises the basis to 20% of all units. Fee amounts are set by Council resolution, not in the code.',
      })
    }

    // Universal but for a narrow exception the code states for the smallest
    // residential case; framed the way Denver's Site Development Plan row is.
    if (!(isResidential && units > 0 && units <= 1)) {
      hurdles.push({
        category: 'review',
        label: 'Site Development Permit — a discretionary approval',
        status: 'required',
        note: 'Erecting or constructing a building in San José needs a Site Development Permit before any building permit issues, and that permit is a discretionary approval rather than a staff sign-off: the Director must set a public hearing, owners and occupants within 300 feet are noticed, and the decision is appealable to the Planning Commission and then the City Council (San José Municipal Code §§ 20.100.190.A, 20.100.610.A, 20.100.620). The code exempts one one-family dwelling on a single lot and certain one- and two-family dwellings under Ch. 20.30 Parts 8/9/9.5; everything else goes through it, so there is no as-of-right path for a new apartment building outside the ministerial routes in Ch. 20.195. This — not a separate large-project review — is the discretionary gate.',
      })
    }

    // CEQA rides on the Site Development Permit, so it has to carry the SDP's
    // own exception: the single one-family dwelling that § 20.100.610.A exempts
    // takes no discretionary approval, and § 21.04.010.A attaches CEQA to
    // discretionary approvals. Firing here where the SDP row does not would be
    // an environmental-review claim with nothing discretionary under it.
    if (!(isResidential && units > 0 && units <= 1)) {
      hurdles.push({
        category: 'environmental',
        label: 'CEQA environmental review',
        status: 'likely',
        note: 'CEQA attaches to discretionary approvals (San José Municipal Code § 21.04.010.A) — and because a Site Development Permit is discretionary, an ordinary San José project carries environmental review with it rather than escaping it. The single one-family dwelling the SDP exempts, and the ministerial routes in Ch. 20.195, are the way out. Title 21 adopts CEQA wholesale, with local procedures for negative declarations (Ch. 21.06) and EIRs (Ch. 21.07) that are each separately appealable (§§ 21.06.020, 21.07.040). The code publishes no processing duration.',
      })
    }

    if (isResidential) {
      hurdles.push({
        category: 'fees',
        label: 'Stacked San José construction taxes',
        status: 'required',
        note: 'Every residential building permit in San José pays four separate construction taxes (San José Municipal Code §§ 4.46.050.A.1, 4.47.040.A.1, 4.54.050 and ch. 4.64). The two percentage taxes stack: 1.75% and 2.75%, each applied to 88% of the building official’s valuation — about 3.96% of assessed construction valuation. Both are levied on the building "or portion thereof" designed or intended for residential purposes, so on a mixed-use building the base is the residential portion, not the whole valuation; the non-residential rates sit elsewhere in §§ 4.46/4.47 and were not read here. On top of that, Ch. 4.54 charges $75–$150 per unit and Ch. 4.64 charges $90–$180 per unit, both sliding down as unit count rises. There is no size threshold; they apply from the first unit. Time-limited suspensions exist for downtown high-rises and for projects on the Council’s Multifamily Housing Incentive list, but those are programs you must qualify for, not the baseline.',
      })

      hurdles.push({
        category: 'fees',
        label: 'Park impact fee or land dedication',
        sizeDependent: true,
        status: 'required',
        note: 'No building permit issues for a residential unit until the park impact fee is paid, land is dedicated, or a parkland agreement is signed (San José Municipal Code §§ 14.25.300.A–B, 14.25.310.A–C). Chapter 14.25 catches the units that the subdivision-stage dedication under Ch. 19.38 does not, so between them every new unit is covered; only deed-restricted low- and moderate-income units are exempt (§§ 14.25.500, 14.25.510). The standard behind the fee is three acres of parkland per 1,000 residents; the schedule itself is adopted by Council resolution, so the code states no dollar amount.',
      })

      if (units >= 10) {
        hurdles.push({
          category: 'environmental',
          label: 'Green building certification (10+ units)',
          sizeDependent: true,
          status: 'required',
          note: 'A "large residential project" — 10 or more single-family or multi-family dwelling units in a non-high-rise building — must actually achieve LEED Certified or GreenPoint Rated certification, not merely file a checklist, and no building permit issues until a refundable green-building deposit (amount set by Council resolution) is paid or a Housing Department in-lieu guarantee is provided (San José Municipal Code §§ 17.84.113, 17.84.119, 17.84.121, 17.84.220.B–C, 17.84.300). Projects of 2–9 units are "tier one" and need only the completed checklist; high-rise residential must reach LEED Certified. Hardship modification is available from the Director under § 17.84.210.',
        })
      }
    }

    // 26 units for attached/multifamily; the single-family trigger is lower (16),
    // and the note says so rather than the code assuming the project's form.
    // OVER-fire, corrected: § 20.90.900.B.2's exemption list is written entirely
    // in HOME END USES — "fewer than 16 single-family detached housing units" or
    // "fewer than 26 units of all other home end uses" — so 26 is a residential
    // threshold. `units` arrives straight off the query string independent of
    // `use` (analyze.ts reads them separately), so an unguarded `units >= 26`
    // applied the home-end-use number to a wholly non-residential project. The
    // non-residential TDM thresholds sit on floor area and were not read here, so
    // there is nothing to assert for that case (rule 5: a gap must not render as
    // an answer). Mixed-use still fires — its dwellings are a home end use.
    if (isResidential && units >= 26) {
      hurdles.push({
        category: 'review',
        label: 'Transportation Demand Management (TDM) plan',
        sizeDependent: true,
        status: 'required',
        note: 'At 26 or more attached or multifamily units, San José requires a Transportation Demand Management plan filed with the initial permit application — the application is not deemed complete without it — and the plan must score at or above the point target set for the project level and use category in Table 20-255 (San José Municipal Code §§ 20.90.900.B.2, 20.90.905). A detached single-family project hits the same requirement at 16 units. A 100%-affordable project at 35 or more dwelling units per acre inside a High Quality Transit Area is exempt. Expect ongoing monitoring and enforcement obligations under §§ 20.90.915–20.90.920; this was the trade for repealing parking minimums, adopted in the same ordinance.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolition needs its own development permit',
        status: 'required',
        note: 'No demolition permit issues in San José until a development permit specifically approving the demolition has issued and become effective — it is a discretionary land-use approval, not a ministerial building-department action (San José Municipal Code §§ 20.80.440.A, 20.80.460, exemptions at § 20.80.450). The Director, or the Planning Commission or City Council on appeal, weighs benefits against impacts, expressly including whether the demolition maintains the city’s existing housing stock and whether rehabilitation would be feasible (criteria 4 and 6); where the building is a Multiple Dwelling or mobilehome park, criterion 8 requires evidence that all state and local tenant-relocation obligations have been met. The main exemption is a single-family home where building permits have already issued for a replacement single-family house.',
      })

      // Triggered by the EXISTING rental building, not by the new project's size
      // — and the ordinance reaches buildings of THREE or more units; one- and
      // two-unit buildings are outside it (§ 17.23.1150.C). exUnits === 0 means
      // the record does not state a count, so a rental-multifamily land use
      // still fires (fail-closed) rather than being waved through.
      if (existing.rentalMultifamily && (existing.exUnits >= 3 || existing.exUnits === 0)) {
        hurdles.push({
          category: 'demolition',
          label: 'Ellis Act withdrawal: 120-day notice',
          status: 'likely',
          note: 'Clearing an existing rental building of three or more units means withdrawing the WHOLE building from the rental market first — partial withdrawal is not allowed (San José Municipal Code §§ 17.23.1130.E–H, 17.23.1140.A, 17.23.1145, 17.23.1150.C). You pay the city filing fee, including relocation-specialist services, BEFORE serving notice; serve a Notice of Intent to Withdraw at least 120 days ahead; and record a memorandum encumbering the property for ten years. Where the units are rent-stabilized — a multiple dwelling with a certificate of occupancy issued on or before September 7, 1979 (§ 17.23.167.A) — you must also deposit base and qualified relocation assistance into escrow and grant tenants a right of return. Elderly, disabled and school-age-child households can extend past the 120 days. Relocation amounts are set by Council resolution and CPI-adjusted, so no figure is quoted here. The clock runs ahead of your application, so it lands at the front of the schedule; the 4 months reflects only the code’s published 120-day minimum notice.',
          addsMonths: 4,
        })
      }
    }

    if (isCommercial) {
      hurdles.push({
        category: 'fees',
        label: 'Commercial linkage fee (non-residential floor area)',
        status: 'info',
        note: 'San José charges an affordable-housing linkage fee on a non-residential project, or on the non-residential portion of a mixed project — the ground-floor retail or office component of a mixed-use building carries it (San José Municipal Code §§ 5.11.030.A, C–D, 5.11.040). It is an automatic condition of approval of the development permit whether or not the permit says so, payable before final building inspection, and escalated annually by the ENR San Francisco construction cost index. The rate varies by subarea and project type and is set by Council resolution, so the code states no dollar amount; shelter and hotel supportive housing and other uses are excepted under § 5.11.050. It is charged on the commercial floor area, not the housing.',
      })
    }

    hurdles.push({
      category: 'labor',
      label: 'Prevailing wage and 30% local hire — only if you take a City subsidy',
      status: 'info',
      note: 'San José imposes no prevailing-wage or skilled-workforce mandate on an ordinary privately financed housing project: the requirements attach to accepting a City "Subsidy" as the code defines it (San José Municipal Code §§ 14.10.110, 14.10.140, 14.10.180, 14.10.190.A–B, 14.10.200, 14.10.240–14.10.260). Read that definition carefully — it covers not only City land or money but any City reduction, permanent suspension or exemption of a fee or tax for the project, which potentially catches the downtown high-rise and Multifamily Housing Incentive construction-tax suspensions. Taking one brings Ch. 14.09 prevailing wage and apprenticeship rules, a good-faith target of 30% of total work hours performed by local residents (waived if Santa Clara County construction unemployment is at or below 4%), and a 25% underrepresented-worker apprentice target. De minimis assistance, 55-year deed-restricted affordable projects, and City housing projects under 8 units are carved out.',
    })

    // ABSENCE, and an unusual one: the ordinance exists and does nothing.
    hurdles.push({
      category: 'environmental',
      label: 'All-electric mandate: enacted but dormant',
      status: 'info',
      note: 'San José’s ban on natural-gas infrastructure in newly constructed buildings is on the books but suspended by its own operative clause: it switches on only if California Restaurant Association v. City of Berkeley, 89 F.4th 1094 (9th Cir. 2023, as amended) is overturned or disapproved by a court of competent jurisdiction, or modified by the legislature to authorize local control of natural gas infrastructure; or if the Energy Policy and Conservation Act (42 U.S.C. § 6297) or other similar legislation is clarified or modified (San José Municipal Code §§ 17.845.010.E, 17.845.030.A). So there is no all-electric requirement to design around today — state Title 24 energy rules and project-specific conditions of approval still apply, and the chapter would switch on automatically if the case law changes. Confirm its status when you file.',
    })
  } else if (city === 'nashville') {
    // Metro Nashville & Davidson County Code, read from Municode's content API
    // at Supp. No. 53 ("codified through Ord. BL2025-1141, approved December 17,
    // 2025"). The two parking rows — no minimums inside the Urban Zoning Overlay
    // or downtown, minimums under Ch. 17.20 outside it — are carried together by
    // PARKING_RULES['nashville'], and the preservation permit by
    // HISTORIC_BODY/HISTORIC_MONTHS['nashville'] above.
    if (isResidential) {
      // ABSENCE, and the headline finding for Nashville: state law forbids the
      // mandate outright, so affordability here can only ever be a trade.
      hurdles.push({
        category: 'affordability',
        label: 'State law bars mandatory inclusionary zoning',
        status: 'info',
        note: 'Tennessee law prohibits any local government from imposing a mandatory inclusionary-zoning requirement on private development (Tenn. Code Ann. § 66-35-102(b), as amended by 2018 Tenn. Pub. Ch. 685). No unit count in Nashville triggers an affordability obligation on a by-right project.',
      })

      // …with the one exception: ask for more than base zoning and affordability
      // becomes negotiable. Discretionary-only, because that is the trigger —
      // and there is a published floor under it: developments of fewer than five
      // residential units are exempt outright (§ 17.40.780(B)).
      // The five is a RESIDENTIAL unit count — § 17.40.055 reaches "all proposed
      // residential development", § 17.40.780(B) reads "For residential uses" —
      // so this gate must not fire on a commercial project carrying a unit
      // count. It cannot: the enclosing `if (isResidential)` is the guard, and
      // an added `isResidential &&` here would be redundant. Pinned by the
      // commercial-at-5-units test in hurdles.test.ts; do not unnest.
      if (discretionary && units >= 5) {
        hurdles.push({
          category: 'affordability',
          label: 'Inclusionary housing — only if you seek more than base zoning',
          sizeDependent: true,
          status: 'likely',
          note: 'A residential development asking for entitlements beyond its current base zoning — a rezoning or SP — or using Metro public money or land can be required to include affordable units as part of that grant; developments of fewer than five residential units are exempt outright (Metro Nashville & Davidson County Code §§ 17.40.055, 17.40.780(B)). Where it applies, the set-aside under § 17.40.790.A runs 7.5%–17.5% of residential floor area, lower for taller buildings, with an off-site or in-lieu cash option; the 80–100% median-household-income tiers are Urban Zoning Overlay only. Build within base zoning and it does not arise. One caution: § 17.40.820 says the article expires December 31, 2019 "unless extended by resolution of the metropolitan council" — the codifier still publishes it as live, but we could not locate the extending resolution, so confirm the program is in force before pricing it.',
        })
      }
    }

    hurdles.push({
      category: 'fees',
      label: 'Sidewalk construction or in-lieu fee — not currently in force',
      status: 'info',
      note: 'Metro’s sidewalk exaction — build the sidewalk along your whole frontage or pay into the pedestrian benefit zone fund — would otherwise apply to multi-family and non-residential development in the urban services district, in a designated center, or on a Major and Collector Street Plan street, and also to new single- or two-family construction inside the Urban Zoning Overlay or a designated center — but the code section carries an editor’s note recording that it is no longer enforced under a permanent injunction (Metro Nashville & Davidson County Code § 17.20.120, editor’s note; Agreed Entry of Judgment and Injunction entered 9/22/23 in Knight v. Metropolitan Government, M.D. Tenn. No. 3:20-cv-00922). Treat the sidewalk cost as not currently required but confirm at permit — Metro may re-adopt a compliant version, and if it does, § 17.20.120.D.1 caps the in-lieu payment at three percent of the total construction value of the permit.',
    })

    // § 17.20.140.B.2 reads "NONRESIDENTIAL developments of more than fifty
    // thousand square feet". `isCommercial` is true for use === 'mixed' too, and
    // `project.gfa` is the WHOLE building — so a mixed-use project was being
    // measured against a non-residential threshold using its residential floor
    // area. We hold no split of gfa, so the floor-area limb is restricted to a
    // wholly non-residential project; the unit limb still catches large mixed
    // programs. (Criterion 3, the 750-daily / 100-peak-hour trip test, needs a
    // trip generation figure we do not compute, so it is stated, not gated.)
    if (units > 75 || (project.use === 'commercial' && project.gfa > 50000)) {
      hurdles.push({
        category: 'review',
        label: 'Multimodal transportation analysis (NDOT)',
        sizeDependent: true,
        status: 'required',
        note: 'More than 75 dwelling units — or more than 50,000 sq ft of non-residential floor area, or a mixed program expected to generate 750 or more daily trips or 100 or more peak-hour trips — requires a multimodal transportation analysis, and NDOT can require one below those thresholds on its own judgment (Metro Nashville & Davidson County Code § 17.20.140.B, .J). NDOT sets the scope and level of analysis and must comment on or approve the scoping form within ten business days; no timeline is published for the analysis itself. The cost is the mitigation, not the study: § 17.20.140.J.2 provides that any required improvements Metro has not funded or completed must be completed by the developer before a use and occupancy permit issues, with a pro-rata contribution where the project is only a partial cause. Budget for off-site roadway and pedestrian work of unknown size at this threshold.',
      })
    }

    hurdles.push({
      category: 'review',
      label: 'Planning Commission final site plan approval (SP / PUD / UDO)',
      status: 'likely',
      note: 'In most of Nashville the final site plan is signed off administratively by the zoning administrator — no board, no hearing. But a parcel inside a Specific Plan district, a PUD overlay, an urban design overlay or an institutional overlay goes to the Metropolitan Planning Commission on a public agenda, and no zoning permit issues until the final site plan is approved (Metro Nashville & Davidson County Code § 17.40.170.B, .C; the UDO requirement also at § 17.40.130.D). In the Downtown Code district the equivalent review is by the planning department, with NDOT sign-off. The trigger is the mapping — confirm which, if any, covers your parcel.',
    })

    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Specific Plan (SP) rezoning',
        status: 'likely',
        note: 'A project needing entitlements beyond base zoning generally takes the Specific Plan route, and that is a legislative act, not a staff approval: a development plan filed with the Planning Commission, a Commission recommendation, then an ordinance through the Metropolitan Council on three readings with a public hearing, plus a Law Department liability opinion ten days before third reading (Metro Nashville & Davidson County Code §§ 17.40.075, 17.40.105, 17.40.106.C–E). An SP cannot be used to escape the inclusionary incentive — § 17.40.105 says the specific plan cannot vary § 17.40.055 — and an SP in a redevelopment district or historic overlay must first be referred to MDHA and/or the Metropolitan Historic Zoning Commission. No statutory clock is published for the overall process.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Metro Council demolition review for National Register properties',
        status: 'likely',
        note: 'Beyond the historic overlays, Tennessee’s historic-demolition statute gives Metro a second bite: the Historic Zoning Commission determines whether the structure meets the criteria of T.C.A. § 7-51-1201 (broadly, listed on or eligible for the National Register), and if it does, the commission must initiate legislation putting the demolition to the Metropolitan Council to approve or disapprove (Metro Nashville & Davidson County Code § 17.40.410.G). That converts a permit into a political decision on a Council calendar — screen the existing building’s National Register status early if you are planning a teardown of anything old.',
      })
    }

    hurdles.push({
      category: 'demolition',
      label: 'Permit moratorium while a historic overlay is pending',
      status: 'info',
      note: 'The mere filing of an ordinance to designate your parcel’s area as a historic overlay district freezes permits for demolition, relocation, new construction, exterior alteration and additions on the land recommended for designation (Metro Nashville & Davidson County Code § 17.40.430). The freeze runs until Council approves, rejects, withdraws or indefinitely defers the ordinance — or has deferred it for ninety days in total. A neighbourhood that objects can start that clock without Council ever voting, so check whether a designation ordinance is filed for the area before you count on a permit date.',
    })

    // § 17.28.020.A: "new construction on land in an UNDEVELOPED STATE where
    // natural slopes are of fifteen percent or greater." Two conditions, and the
    // first one is on the record — a parcel already carrying a building is not
    // land in an undeveloped state. The slope itself is in no dataset we hold,
    // so the copy stays conditional on it rather than the gate.
    if (project.projectType === 'new' && !existing.hasBuilding) {
      hurdles.push({
        category: 'environmental',
        label: 'Hillside development standards (15% natural slope)',
        status: 'likely',
        note: 'New construction on land in an undeveloped state with natural slopes of 15% or more must meet Metro’s hillside development standards (Metro Nashville & Davidson County Code §§ 17.28.020.A, 17.28.030.A). In residential districts, development must minimise grading and cut/fill on the portions at 20% or more natural slope; on single- or two-family lots under one acre, natural slopes of 25% or more must be platted outside the building envelope and the lot becomes a "critical lot" needing Planning Commission and Public Works sign-off. The trigger is the topography, not the size of the building — but it can materially shrink the buildable area on a hilly parcel. The standards reach land in an undeveloped state, so a parcel already carrying a building is outside them.',
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'Tree density requirement and tree-removal permit',
      status: 'required',
      note: 'Nashville enforces a tree canopy budget on the finished site, not just a protection rule: a property other than a single- or two-family subdivision must reach a tree density factor of at least 22 units per acre using retained or replacement trees, and a single/two-family subdivision must reach 14 (excluding building lots) (Metro Nashville & Davidson County Code § 17.28.065.A.3, .B.2). Separately, no retained, protected (6 inches DBH or more) or heritage tree may be removed without a permit from the zoning administrator, and trees 24 inches DBH or larger must be survey-located on the final site plan (§ 17.40.440). Replacement planting to hit the density factor is a real line item on a wooded parcel. Construction of a single- or two-family dwelling on a lot already platted when the chapter was enacted is exempt (§ 17.28.020.F.4).',
    })

    if (fz && !FLOOD_OK.has(fz.toUpperCase())) {
      hurdles.push({
        category: 'flood',
        label: 'Preserved floodplain: encroachment needs approval',
        status: 'likely',
        note: 'Metro goes beyond the federal NFIP baseline: floodplain designated as natural floodplain on a parcel is meant to stay preserved, and encroaching on it needs a variance from the Stormwater Management Commission under Metro Code ch. 15.64 (Metro Nashville & Davidson County Code § 17.28.040.A, .C.1). The variance can cover no more than twenty percent of the preserved floodplain area, and only on a finding that the encroachment reduces the flood danger or improves the floodplain’s environmental quality. Manipulated floodplain land cannot count toward the base district’s minimum lot size, and a lot containing natural floodplain becomes a "critical lot" with finished-floor elevations fixed on the final plat. When sizing the envelope, treat preserved floodplain as effectively unbuildable — and Metro maps its own floodplain, so confirm the local mapping rather than relying on the FEMA zone alone.',
      })
    }
  } else if (city === 'raleigh') {
    // Raleigh Unified Development Ordinance, read 2026-08-07 from the City's own
    // consolidated text (udo.raleighnc.gov/udo-book/print-all-chapters — the same
    // source PARKING_RULES['raleigh'] was read from), plus N.C. Gen. Stat.
    // § 42-14.1 from ncleg.gov. Two rows are carried elsewhere on purpose and
    // must NOT be duplicated here: the parking finding — Raleigh imposes no
    // vehicle-parking minimum anywhere, for any use (Sec. 7.1.1) — is
    // PARKING_RULES['raleigh'], and the Certificate of Appropriateness is
    // HISTORIC_BODY['raleigh'] above.
    //
    // ⚠️ INSTRUMENT NOTE, and it cost real errors here (rule 11). The
    // print-all-chapters export FLATTENS the heading levels: subsection titles
    // come through as bare text with their A./B./C. labels stripped, so counting
    // paragraphs off it silently invents sub-letters. Reading it that way put
    // Approval Process at 10.2.8.C (it is D), the historic demolition delay at
    // 10.2.15.F (it is E), -TOD Height at 5.5.1.G (it is H) and 5.4.1 Setbacks
    // one letter high — four wrong pointers, every one of them to a real
    // provision that says something else. Each sub-letter below was then checked
    // against the PER-SECTION page on udo.raleighnc.gov, which prints the
    // labels; where a section turned out to be numbered rather than lettered
    // (8.2.1, 8.9.1–8.9.3, 8.11.2, 9.4.6) the citation is deliberately left at
    // section level rather than given a sub-item that does not exist. If you add
    // a row here, cite from the section page, not from the consolidated export.
    const RAL_ACRE = 43560
    const ralAcres = lotSqFt / RAL_ACRE
    // A Tier 2 or Tier 3 site plan, approximated. Sec. 10.2.8.B.1.a.i puts an
    // increase of "no greater than 4,000 square feet or 10% of the existing
    // square footage, whichever is greater" in Tier 1, and Tier 1 is expressly
    // barred from carrying tree conservation, amenity, open space, drainage or
    // public-improvement conditions (Sec. 10.2.8.B.1). Anything larger is
    // Tier 2 or Tier 3. This is a proxy, not the rule — the 10% limb needs an
    // existing floor area we do not always hold — so it only ever gates rows
    // that are stated as conditional anyway.
    const ralTier23 = project.gfa > 4000

    if (isResidential) {
      // ABSENCE, and the headline for Raleigh — but a DIFFERENT absence from
      // Nashville's, and the difference is the whole point. Tennessee bans
      // mandatory inclusionary zoning by name (Tenn. Code Ann. § 66-35-102(b)).
      // North Carolina does NOT: no statute names inclusionary zoning at all,
      // and whether one is authorised here is contested. So what is recorded is
      // what can be checked — (a) the UDO's own structure, and (b) the statute's
      // actual words. Writing "state law bars mandatory inclusionary zoning" for
      // Raleigh would be a mechanism argued aloud wearing a citation (rule 1);
      // it is the one sentence this row must not contain.
      hurdles.push({
        category: 'affordability',
        label: 'No inclusionary requirement — affordability is priced into bonuses only',
        status: 'info',
        note: 'The Raleigh UDO sets no affordable-unit requirement at any project size. Every affordability obligation in the ordinance hangs off an OPTIONAL bonus the developer elects: the Frequent Transit Development Option above twelve units (Sec. 2.7.1, note G4), the three-storey height bonus in mixed-use districts (Sec. 3.7.1, note D5), and the Transit Overlay height bonus (Sec. 5.5.1.H.3), each in the same words — "A number of units equal to at least twenty percent (20%) of the residential units established in newly allowed stories shall be affordable for households earning sixty percent (60%) of the Area Median Income or less for a period of no less than 30 years from the date of issuance of a certificate of occupancy." Build within base zoning and none of it arises. On the state-law backdrop, note what is and is not settled: N.C. Gen. Stat. § 42-14.1(a) provides that "No county or city as defined by G.S. 160A-1 may enact, maintain, or enforce any ordinance or resolution which regulates the amount of rent to be charged for privately owned, single-family or multiple unit residential or commercial rental property", and § 42-14.1(c)(4) excepts ordinances "applicable to owners or operators that receive funding or financial incentives from the county or city" — which is exactly the shape Raleigh\'s requirements take. North Carolina has no statute naming inclusionary zoning, and unlike Tennessee has not prohibited it by name, so treat this as a rule Raleigh has not adopted rather than one the State has forbidden.',
      })

      // The bonus itself, stated as a trade with a published floor. Sec. 2.7.1
      // note G4 is conjunctive three ways and all three are named: the project
      // must ELECT the Frequent Transit Development Option, the option requires
      // "at least a portion of each lot within the mapped Frequent Transit Area"
      // (note G3), and the twelve-unit cap is written for "a development site
      // utilizing this option in a residential zoning district". None of those
      // three is in data we hold, so this is 'likely' with all three on the face
      // of the note — never 'required'.
      if (units > 12) {
        hurdles.push({
          category: 'affordability',
          label: 'Frequent Transit Development Option: affordability above 12 units',
          sizeDependent: true,
          status: 'likely',
          note: 'IF this project uses the Frequent Transit Development Option — which is an election, and is open only to a lot with at least a portion inside the mapped Frequent Transit Area (Raleigh UDO Sec. 2.7.1, notes G3, G4) — then the unit count is capped unless affordability is provided: "A development site utilizing this option in a residential zoning district shall contain no more than twelve (12) residential units; however, a development site may contain additional residential units provided a number of units equal to at least twenty percent (20%) of the residential units over twelve (12) established within the development site shall be affordable for households earning sixty percent (60%) of the Area Median Income or less for a period of no less than 30 years from the date of issuance of a certificate of occupancy." The set-aside is 20% of the units ABOVE twelve, not 20% of the building. It carries a recorded Affordable Housing Deed Restriction in the Wake County Register of Deeds before the certificate of occupancy, an annual compliance report, and a requirement that the affordable units be built concurrently with the market-rate ones (note 7). Confirm the Frequent Transit Area mapping before pricing this either way — outside it, the option and its cap are both unavailable.',
        })
      }
    }

    // Facility fees. No floor-area or unit threshold at all, so no sizeDependent
    // tag — the gate is that the project is new construction. The amounts are
    // NOT in the ordinance and are not invented here: Sec. 8.9.1 sends the
    // reader to the City's Fee Schedule, which Raleigh republishes each fiscal
    // year (its FY27 Development Fee Guide is the current one).
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'fees',
        label: 'Thoroughfare and open space facility fees',
        status: 'required',
        note: 'Raleigh levies two facility fees on new construction — thoroughfare/collector street and open space — and they gate the permit: "No building permit or other City permit for those improvements not requiring a building permit, shall be issued for any activity requiring the payment of a facility fee until the required facility fees have been paid in full" (Raleigh UDO Sec. 8.9.1). There is no floor-area or unit threshold and no small-project exemption. On a redevelopment the fee is charged on the NET increase only — "facility fees shall be levied based upon the net increase, if any, above that which the existing development would pay" (Sec. 8.9.3) — and replacing a building with one of the same dwelling type or non-residential use is exempt outright, but only if the structure being credited "was standing at some time in the 6 year period immediately preceding the date on which the facility fee for the new project is calculated" (Sec. 8.9.2). A change of use that raises the rate pays the difference (Sec. 8.9.3). Rates are not in the ordinance: Sec. 8.9.1 states that "Current facility fees are listed in the City of Raleigh Fee Schedule, kept on file by the City and are updated and adopted by the City Council", which Raleigh reissues each fiscal year — get the current Development Fee Guide rather than a figure from a prior year.',
      })
    }

    // Raleigh's structural advantage, and the row a reader coming from Boston or
    // Philadelphia most needs: the site plan is an ADMINISTRATIVE approval. There
    // is no design-review board, no civic-design hearing, no RCO meeting.
    hurdles.push({
      category: 'review',
      label: 'Site plan review is administrative — no board, no hearing',
      status: 'info',
      note: 'Raleigh reviews site plans over the counter, not at a public hearing: "Following site review, Development Services shall approve, approve with conditions that bring the site review plan into conformance with this UDO and other applicable technical requirements of the City or deny the site review plan" (Raleigh UDO Sec. 10.2.8.D.1). A site plan is required "for the construction, reconstruction, extension, repair, renovation or alteration of any building, structure, parking facility, change of use or use of land, not otherwise approved as a zoning permit" (Sec. 10.2.8.A), and it falls into one of three tiers that decide which standards apply — Tier 1 for an increase of 4,000 sq ft or less (or 10% of existing, whichever is greater), Tier 2 between that and 10,000 sq ft, Tier 3 for everything else, with the more restrictive tier controlling where a project meets two (Sec. 10.2.8.A, .B.1–.B.3). The tier is not cosmetic: a Tier 1 approval cannot be conditioned to require tree conservation, amenity area, open space, drainage, utility dedication, neighborhood transitions or right-of-way dedication (Sec. 10.2.8.B.1), and Tier 2 cannot be conditioned to require right-of-way dedication or improvements (Sec. 10.2.8.B.2). No building permit issues until the site review is approved (Sec. 10.2.8.D.3), and the approved plan expires three years from approval unless a building permit issues, with one two-year extension available (Sec. 10.2.8.F).',
    })

    // CONJUNCTIVE, and this is the gate most likely to be got wrong: Sec.
    // 10.2.8.C.1.d joins its two conditions with "and", not "or". Size alone
    // does not trigger the notice — the 100-foot proximity to a low-density
    // residential district must also hold, and we hold no adjacency data. So
    // the size limb gates the row and the zoning limb is stated, not asserted.
    if (project.gfa >= 25000) {
      hurdles.push({
        category: 'review',
        label: 'Post-approval mailed notice and a 30-day posted sign',
        sizeDependent: true,
        status: 'likely',
        note: 'An administratively approved site plan carries a notice obligation when BOTH of two conditions hold — the code joins them with "and", so size alone is not enough. Beginning the day the zoning or site permit issues, mailed notice under Sec. 10.2.1.C.1 is required and the owner must post a sign on the property for 30 consecutive days "Where the new building is 25,000 square feet or more in size or any addition that represents an increase of more than 10% of the building area or 25,000 square feet whichever is greater; and Where the property of the approved administrative site plan is located within 100 feet of a property that is zoned R-1, R-2, R-4, R-6 or R-10" (Raleigh UDO Sec. 10.2.8.D.1.d). This project clears the size limb; whether the second limb holds turns on what is zoned within 100 feet, which is not in the parcel record — confirm it. The mailed notice goes to owners of all property within 100 feet on all sides (Sec. 10.2.1.C.1). This is notice AFTER approval, not a hearing before it; what it starts is the appeal clock, not a review.',
      })
    }

    // Not size-gated and not discretionary-only: in Raleigh the appeal window
    // opens on an ordinary as-of-right permit. No addsMonths — an appeal is a
    // risk, not a certainty, and baking months into every Raleigh timeline
    // would overstate delay (same reasoning as Boston's MGL c.40A §17 row).
    hurdles.push({
      category: 'review',
      label: 'Third-party appeal window: 30 days from permit issuance',
      status: 'info',
      note: 'Raleigh\'s administrative approval is appealable, and the window opens at issuance rather than at a hearing: "An appeal as set forth in Sec. 10.2.11. shall be filed by persons within 30 days of permit issuance or when a permit is not issued, the decision of approval or denial; this time period is applicable to all representatives of such persons, including without limitation their tenants and option holders" (Raleigh UDO Sec. 10.2.8.D.1.f). Anyone with standing under N.C. Gen. Stat. § 160D-1402(c) may appeal to the Board of Adjustment, which must hold a quasi-judicial hearing within 90 days of a completed appeal application, and from there the route is Wake County Superior Court (Sec. 10.2.11.A, .B, .E.2, .E.5). An appeal of a decision granting a permit does not automatically stay further review, but the Board may grant a stay of a final decision on the affected permits (Sec. 10.2.11.C). Most approvals are never appealed; this is a risk to price, not a step to schedule.',
    })

    // Every subdivision plan and site plan, unconditionally — the sufficiency
    // determination is not threshold-gated. What IS threshold-gated is which of
    // the three studies you owe, and those thresholds live in the Street Design
    // Manual, not the UDO, so no number is asserted for them.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Infrastructure sufficiency and traffic study',
        status: 'required',
        note: 'Raleigh tests capacity on every plan, not only large ones: "every subdivision plan and site plan shall be subject to a determination of the sufficiency of infrastructure, as defined below according to the established levels of service in this Article" (Raleigh UDO Sec. 8.2.1), and infrastructure counts as sufficient only where it has available capacity for this development plus other approved developments and PD master plans (Sec. 8.2.1). Streets are measured in AM/PM peak trips by ITE methodology against level of service E, and there are three escalating studies — a Trip Generation Report, then a Traffic Assessment where peak-hour traffic fails LOS, then a full Traffic Impact Analysis where queueing and delay are unacceptable (Sec. 8.2.2.B–.D). The thresholds that decide which one you owe are set in the adopted Street Design Manual rather than in the UDO, so no unit or floor-area figure is stated here — ask Transportation early. Where a study shows degradation below LOS E, approval is still available but only against caps (residential density not over 50 units per acre, office FAR not over 0.5, commercial FAR not over 0.25) plus a traffic mitigation plan the Transportation Director must find reasonable and adequate before site plan approval is granted (Sec. 8.2.2.E, .F). Exceptions exist for a funded City or NCDOT project, an existing or funded transit stop within a quarter mile, a conditional district with a trip budget approved in the prior 20 years, and for property zoned DX- (Sec. 8.2.2.G). The cost here is the mitigation, not the study.',
      })
    }

    // Tree conservation — the gate is LOT AREA, which the parcel record measures
    // directly, so this is deliberately NOT tagged sizeDependent: that tag exists
    // to soften claims resting on a placeholder FLOOR AREA, and no floor area is
    // involved in the trigger. Two independent limbs both key on 2 acres:
    //   · Sec. 9.1.2 — the percentage requirement, which additionally needs a
    //     subdivision or a Tier 2/Tier 3 site plan (Tier 1 cannot be conditioned
    //     to require tree conservation at all, Sec. 10.2.8.B.1).
    //   · Sec. 9.1.10 — perimeter buffers on any 2-acre-plus site with no
    //     recorded tree conservation area, with NO tier condition.
    // Status splits at 4 acres because Sec. 5.5.1.I carves out "any site with
    // area less than 4 acres" in the -TOD. Above 4 acres that carve-out cannot
    // apply, so the requirement is unconditional; between 2 and 4 it turns on an
    // overlay that may be masked in our data, so it is stated as conditional.
    if (project.projectType === 'new' && ralAcres >= 2) {
      const ralTreePct = /^R-[12]\b/.test(parcel.zoning.districtCode ?? '') ? '15%' : '10%'
      hurdles.push({
        category: 'environmental',
        label: 'Tree conservation area and tree protection',
        status: ralAcres >= 4 ? 'required' : 'likely',
        note: `Raleigh's tree ordinance keys on lot size, and this parcel is over the 2-acre line. "Prior to approval of any subdivision of any tract 2 acres or greater in size or Tier 2 or Tier 3 site plan for a parcel 2 acres or greater, tree conservation areas must be provided in accordance with the requirements of this UDO" (Raleigh UDO Sec. 9.1.2). Eligibility is measured on gross site area and the requirement on net site area: 15% in R-1 and R-2, 10% in all other districts (Sec. 9.1.3) — ${ralTreePct} for the district mapped here. The areas are not yours to place freely: primary areas (Sec. 9.1.4.A) must be saved FIRST and in full "even if doing so exceeds the minimum required percentage", and they include champion trees and their critical root zones, Neuse River Riparian Zone 2, slopes of 45% or greater adjoining floodways, and an undisturbed strip averaging 50 feet along a Thoroughfare. Secondary areas run to 65-foot and 32-foot perimeter buffers (Sec. 9.1.4.B). A separate tree conservation permit must be obtained and protective fencing installed before any tree disturbing activity, and the areas must be recorded by metes and bounds with the Wake County Register of Deeds along with a maintenance easement and an HOA declaration before a building permit issues (Sec. 9.1.5.A). Fee-in-lieu is available only for SECONDARY areas and only on stated site conditions — "No primary tree conservation area is eligible for a fee-in-lieu payment" (Sec. 9.1.5.E). Independently, and with no tier condition, Sec. 9.1.10.A applies perimeter buffers to "Any tree disturbing activity, except a minor tree removal activity, on sites 2 acres and larger in size that do not have an established or recorded tree conservation area", inside which no tree 10 inches DBH or larger may be removed except up to five between 10 and 22 inches in a rolling five-year period, by permit (Sec. 9.1.10.C). Penalties are real money: $1,000 for the first tree plus $100 per diameter inch for each other tree or stump 3 inches and larger (Sec. 9.1.7). ${
          ralAcres >= 4
            ? 'At this size the Transit Overlay carve-out cannot apply.'
            : 'One carve-out to check before pricing this: Sec. 5.5.1.I provides that tree conservation area "shall not be required for any site with area less than 4 acres" inside a Transit Overlay District (-TOD), and this parcel is between 2 and 4 acres — confirm whether the -TOD is mapped here, because it decides whether the percentage requirement applies at all.'
        }`,
      })
    }

    // Stormwater. Applies to development, not to redevelopment or existing
    // development, so it is gated on new construction — Sec. 9.2.2.A.3.a is
    // explicit: "Existing development or redevelopment shall be exempt from the
    // provisions of this Article."
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'Stormwater control permit and the Neuse nitrogen cap',
        status: 'required',
        note: 'Raleigh drains to the Neuse, and the nutrient rule is a hard number rather than a design goal: "Any new development or expansion of existing development shall not contribute a nitrogen export load exceeding 3.6 pounds per acre per year" (Raleigh UDO Sec. 9.2.2.B.1.a). The permit gates the work — "No development, expansion of existing development or the placement of impervious area or built-upon area, may occur on a site without an issued stormwater control permit from the City" (Sec. 9.2.2.C.1) — and no such permit issues until a stormwater control plan, sealed by a North Carolina registered engineer, surveyor, soil scientist or landscape architect, has been approved (Sec. 9.2.2.C, .D.1). Projects at or under 24% built-upon area may meet the nitrogen target entirely with purchased nutrient off-set credits; above 24% built-upon area on-site treatment or a dedicated regional measure is mandatory, sized to treat the runoff from one inch of rainfall over all built-upon area (Sec. 9.2.2.B). Peak runoff for the 2-year and 10-year storms must be no greater post-development than pre-development at every point of discharge (Sec. 9.2.2.E). Budget the carry as well as the build: a surety equal to 125% of the construction cost of each stormwater device is due before permit issuance and is not returned until the first annual inspection certification is accepted (Sec. 9.2.2.D.1.e), a private drainage easement must be recorded in the Wake County Registry before the building permit (Sec. 9.2.2.D), and no certificate of occupancy issues without approved as-built plans (Sec. 9.2.2.D). Grandfathered lots recorded before May 1, 2001 in one- and two-unit use are exempt, but only up to the district impervious caps at Sec. 9.2.2.A.4.a — 20% in R-1, 25% in R-2, 38% in R-4, 51% in R-6, 65% in R-10 and all other base districts — above which the exemption falls away.',
      })
    }

    // The 12,000 sq ft figure is measured in UNCOVERED (disturbed) area, not lot
    // area and not floor area. Lot area is a proxy and is labelled as one — the
    // same treatment Philadelphia's 5,000 sq ft earth-disturbance row gets. Not
    // tagged sizeDependent for the same reason as the tree row: no floor area is
    // in the trigger.
    if (project.projectType === 'new' && lotSqFt > 12000) {
      hurdles.push({
        category: 'environmental',
        label: 'Erosion and sedimentation control plan (30-day lead time)',
        status: 'likely',
        note: 'Over 12,000 sq ft of disturbance and the erosion plan becomes a scheduling item, not a formality: no person may initiate land-disturbing activity "in any other area if more than 12,000 square feet is to be uncovered unless, 30 or more days prior to the anticipated date for initiating the activity, an erosion and sedimentation control plan for such activity is filed with and approved by the City; but this shall not restrict the initiation of land-disturbing activities when the plan is approved and the permit is issued in less than 30 days from initial submission" (Raleigh UDO Sec. 9.4.6). The table at Sec. 9.4.6 confirms the break: no plan under 12,000 sq ft, plan required and approval required before land disturbance from 12,000 sq ft up. A land disturbance grading permit is separately required from the City (Sec. 9.4.6), and no permit issues at all until buffers, watercourse natural resource buffers and tree protection limits adjoining the work site are demarcated with protective fence in the field (Sec. 9.4.6). Note the unit: the threshold is measured in the area to be UNCOVERED, not in lot area or floor area — lot size is only a proxy for it here, so a large parcel with a small footprint of disturbance may sit below the line.',
      })
    }

    // Transit infrastructure — conjunctive and un-gateable on our data. Sec.
    // 8.11.2.A says "required when ALL of the following conditions are present",
    // and neither condition (transit-route frontage; 500 daily trips by ITE) is
    // something we hold or compute. Stated as 'info' with both conditions named
    // rather than gated on a proxy that would be broader than the source.
    if (project.projectType === 'new' && ralTier23) {
      hurdles.push({
        category: 'review',
        label: 'Transit stop and shelter, or a fee in lieu',
        status: 'info',
        note: 'A Tier 2 or Tier 3 plan can be made to build a bus stop. The trigger is conjunctive — transit infrastructure "is required when all of the following conditions are present: The site has frontage along an existing public transit route operated either by a public transit agency, or the site has frontage along a planned transit route as illustrated in the City\'s adopted Comprehensive Plan; and The site will generate a minimum of 500 daily vehicular trips as calculated per the current edition of the Institute of Transportation Engineers\' Trip Generation Handbook" (Raleigh UDO Sec. 8.11.2), on top of the Tier 2/Tier 3 applicability at Sec. 8.11.1.B. Neither route frontage nor a trip-generation figure is in the parcel record, so this is stated rather than asserted — check both. Where it applies the deliverable is substantial: a permanent 15\' x 20\' transit easement dedicated to the City where the stop sits outside the right-of-way, a 30-foot minimum landing pad, a 15\' x 20\' concrete stop pad, sidewalk connectivity, a trash receptacle, seating, and a shelter (Sec. 8.11.3). At 2,500 daily trips with frontage on more than one street served by more than one route, two stops are required (Sec. 8.11.2). An existing stop within 1,320 feet on the same side of the street with the same facilities removes the requirement — except for Tier 2 and Tier 3 plans serving a hospital, senior housing, life care community or congregate care facility (Sec. 8.11.2). Where no suitable location exists, a fee in lieu is payable instead (Sec. 8.11.5).',
      })
    }

    // -TOD, read off the overlay the provider actually fetches. `subdistrict`
    // carries the Transit Overlay label only when no historic or NCOD overlay is
    // also present (providers/raleigh.ts prefers those), so a miss here is a
    // false NEGATIVE and never a false positive — the row simply does not render
    // rather than rendering a guess, which is the direction rule 5 wants.
    if (/transit overlay/i.test(parcel.zoning.subdistrict ?? '')) {
      hurdles.push({
        category: 'review',
        label: 'Transit Overlay District (-TOD) standards',
        status: 'required',
        note: 'This parcel is in a Transit Overlay District, which rewrites parts of the base zoning. Ten use categories are prohibited outright — cemetery, outdoor sports or entertainment facility over 250 seats, vehicle sales, major and commercial vehicle repair, car wash, drive-thru facilities other than pharmacies, vehicle fuel sales, self-service storage, and warehouse and distribution (Raleigh UDO Sec. 5.5.1.B). Principal buildings other than single- and two-unit living or the Open Lot type must be at least 2 storeys (Sec. 5.5.1.H). Applied to a residential district the -TOD brings the Residential Mixed Use dimensional standards across, removes the minimum lot size for the Apartment building type, permits Townhouse and Apartment types in every residential district, and allows multi-unit living in any residential base district (Sec. 5.5.1.C, .D). Frontage defaults to Urban Limited with a Main Street or Mixed Use streetscape where the underlying district has Parkway, Parking Limited, Detached or no frontage (Sec. 5.5.1.E). In mixed-use districts height in storeys may be increased by 50% where the added storeys are principal residential use and 20% of the units in those newly allowed storeys are affordable at 60% AMI for 30 years, or by 30% for a structure with no residential use at all (Sec. 5.5.1.H.3). Tree conservation area is not required on a -TOD site under 4 acres, and secondary tree conservation areas do not apply in the -TOD at all, though primary areas still must be provided where present (Sec. 5.5.1.I). One trap on an existing building: replacement, repair or renovation of a structure made nonconforming solely by the -TOD must be like for like, and that applies to involuntary demolition as well as voluntary (Sec. 5.5.1.J).',
      })
    }

    if (discretionary) {
      // The rezoning path. No addsMonths: the two clocks the code publishes are
      // DEADLINES on the two public bodies (60 days for a Planning Commission
      // recommendation, 60 days for Council to schedule its hearing), not a
      // duration for the process — nothing clocks the applicant's own steps, the
      // TIA, or the neighbourhood meetings that must precede submittal. Adding
      // two ceilings together and publishing the sum as an expectation is the
      // failure this leaves on the table rather than commits.
      hurdles.push({
        category: 'review',
        label: 'Conditional rezoning: two neighbourhood meetings, Planning Commission, City Council',
        status: 'likely',
        note: 'Asking for more than the base district means a rezoning, and in North Carolina that is a legislative act of the City Council, not a staff approval (Raleigh UDO Sec. 10.2.4.A). A pre-submittal neighbourhood meeting is mandatory for every rezoning application and must happen BEFORE the application is filed, no more than six months before, with a written report of who attended and what was raised included in the filing (Sec. 10.2.4.C.1). A SECOND neighbourhood meeting is required, at a 1,000-foot notice radius and with the property posted, if any one of these is true: the site is five acres or more; the change increases maximum building height to five storeys or more, or by five storeys or more; it increases residential density by an additional 10 dwelling units per acre; it moves from a Residential or Conservation Management district to a mixed use or special district; or it creates a PD district (Sec. 10.2.4.C.2). Conditional rezoning conditions can only make development MORE restrictive than the corresponding general use district (Sec. 10.2.4.D.2.a), and no variance is ever available from a condition once approved (Sec. 10.2.4.D.2.j). The Planning Commission holds a legislative hearing and has 60 days to recommend, after which Council may act without it; Council then acts to schedule its own legislative hearing within 60 days of receiving the recommendation, and at that hearing each side gets eight minutes (Sec. 10.2.4.E.2.d, .E.3, .E.4.b). Those are deadlines on the boards, not a schedule for the project — nothing clocks the applicant\'s side, and a TIA is required as part of a complete application wherever the change in intensity meets the Street Design Manual thresholds (Sec. 10.2.4.D.1.d). Plan for the downside too: after a withdrawal or denial the Planning Director cannot accept another application on the same property for 24 months absent a Council waiver (Sec. 10.2.4.G.1).',
      })
    }

    if (teardown) {
      // Fires only inside a mapped historic overlay — Raleigh's demolition delay
      // is an overlay power, not a citywide screen, and asserting it citywide
      // would be exactly the over-broad gate this file has had to unwind before.
      if (parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic demolition: approval cannot be refused, but can be delayed up to 365 days',
          status: 'required',
          note: 'Inside a historic overlay or on a Historic Landmark, demolition needs its own Certificate of Appropriateness, and the code trades refusal for delay: an application authorising demolition "may not be denied except as provided below for Statewide Significance. However, the effective date of such a certificate may be delayed for a period of up to 365 days from the date of approval" (Raleigh UDO Sec. 10.2.15.E.1). During the delay the Committee is required to negotiate with the owner and others to find a means of preserving the building, and it must shorten or waive the delay where it finds extreme hardship, permanent deprivation of all beneficial use, or that the building has no special significance toward the district\'s character. The exception runs the other way: where the State Historic Preservation Officer determines the building has statewide significance under National Register criteria, the certificate CAN be denied outright, subject to the same hardship finding (Sec. 10.2.15.E.3). A certificate authorising demolition expires if work has not commenced within 12 months of its effective date (Sec. 10.2.15.B). Screen the building\'s National Register standing before pricing a teardown here — it is the difference between a schedule risk and a veto.',
        })
      }

      hurdles.push({
        category: 'demolition',
        label: 'A pending historic designation freezes demolition',
        status: 'info',
        note: 'A designation that has only been recommended, not adopted, is already enough to stop a teardown in Raleigh: "The demolition of any entire building, site or structure within a pending -HOD-G or pending Historic Landmark is prohibited when conducted without an approved Certificate of Appropriateness" (Raleigh UDO Sec. 5.4.1.D.2). Where the Historic Development Commission has voted to recommend designation and the City Council has not yet acted, demolition "may be delayed by the Commission for a period of up to 180 days through the COA process or until the City Council takes final action on the designation, whichever occurs first" (Sec. 10.2.15.E.2). A neighbourhood that objects can start that clock without Council ever voting, so check whether a designation is pending over the area before counting on a demolition date. Separately, Article 11.8 lets the City act against demolition by neglect of a landmark or a contributing structure in an overlay — deferred maintenance is not a route around the certificate.',
      })
    }
  } else if (city === 'milwaukee') {
    // Milwaukee Code of Ordinances ch. 295 subch. 4, s. 295-403 "Motor Vehicle
    // Parking", read 2026-08-08. Full source note — and the Cloudflare
    // reproducibility warning that goes with it — in PARKING_RULES['milwaukee'].
    // What this branch does NOT cover is stated once above the constants.
    //
    // The GIS publishes downtown codes with the subdistrict letter attached
    // ('C9A(A)', 'C9F(B)') because the subdistrict is part of the district
    // identity for HEIGHT. Table 295-403-2-a is written at the C9x level, so
    // the parenthetical is stripped for THIS lookup only; the height resolver
    // keeps it, which is why the stripping is local rather than pushed into
    // `normalizeMilwaukeeZone`.
    const mkeZone = normalizeMilwaukeeZone(parcel.zoning.districtCode)
    const mkeBase = mkeZone ? mkeZone.replace(/\([A-Z]\)$/, '') : null
    const mkeRed = mkeBase === 'RED'
    // "Except for within the C9A district" — the exception is checked at the
    // C9A level, so C9A(A) and C9A(B) both keep their minimum while every other
    // C9 subdistrict loses it.
    const mkeDowntownExempt = !!mkeBase && /^C9/.test(mkeBase) && mkeBase !== 'C9A'
    const mkeRatio =
      mkeBase && MKE_PARKING_1_PER_UNIT.has(mkeBase)
        ? '1 space per dwelling unit'
        : mkeBase && MKE_PARKING_2_PER_3_UNITS.has(mkeBase)
          ? '2 spaces per 3 dwelling units'
          : null

    if (isResidential && (mkeRed || mkeDowntownExempt)) {
      hurdles.push({
        category: 'parking',
        label: 'No off-street parking required in this district',
        status: 'info',
        note: `This parcel is mapped ${parcel.zoning.districtCode}, and Chapter 295 removes the requirement outright here: “Except for within the C9A district, no off-street motor vehicle parking spaces shall be required for uses located in downtown zoning districts. Furthermore, no off-street motor vehicle parking spaces shall be required for uses located in a RED redevelopment district” (Milwaukee Code s. 295-403-2-a). ${
          mkeRed
            ? 'A RED redevelopment district is the second of the two limbs.'
            : 'This is a downtown district other than C9A, so the first limb applies. Note which district the exception names: C9A is “Downtown — high-density residential”, so the one downtown district that still owes parking is the one whose primary product is apartments. Do not read “downtown is exempt” off this row for a neighbouring parcel.'
        } Parking is optional here, not prohibited — the chapter still regulates the design of any spaces you do build.`,
      })
    } else if (isResidential && mkeRatio) {
      // The status splits on the PROGRAM, because Table 295-403-2-a has a
      // separate row per dwelling type and only the multi-family row carries a
      // ratio. Tagged sizeDependent because it turns on `units`, which is
      // derived from floor area when no FAR resolves — a hard "required" off a
      // placeholder unit count is exactly what softenSizeDependent exists to
      // stop.
      const mkeKnownSmall = units >= 1 && units <= 2
      hurdles.push({
        category: 'parking',
        label: `Off-street parking minimum: ${mkeRatio}`,
        sizeDependent: true,
        status: units >= 3 ? 'required' : mkeKnownSmall ? 'info' : 'likely',
        note: `${
          units >= 3
            ? `This parcel is mapped ${parcel.zoning.districtCode}, where Table 295-403-2-a sets the multi-family minimum at ${mkeRatio}. `
            : mkeKnownSmall
              ? `This parcel is mapped ${parcel.zoning.districtCode}. At ${units} unit${units === 1 ? '' : 's'} the multi-family row does not apply, and the rows that do carry no minimum. `
              : `This parcel is mapped ${parcel.zoning.districtCode}, where the multi-family minimum is ${mkeRatio} — but the unit count for this project is not established, and the requirement turns entirely on which dwelling-type row applies. `
        }The other rows are verbatim: single-family, two-family and attached single-family dwellings are all “no min.; max. of 4 spaces”, and an accessory dwelling unit is “none”. Match your program to a row before pricing this, and note the one that does not map cleanly to a unit count — “attached single-family dwelling” is a townhouse form that can run well past three units and still carries no minimum, so a 3+ unit project is not automatically on the multi-family row. Credits at s. 295-403-2-b can cut whatever minimum does apply: off-site spaces within 700 feet (1,200 in LB3), one credit per adjacent on-street space, 0.75 per shared-facility space, and one per space in a public lot within 700 feet. Those credits are expressly unavailable to one- and two-family residential, which costs nothing — those rows have no minimum to reduce.`,
      })
    }

    // The 25% reduction. Emitted only where a minimum actually exists, because
    // a reduction of nothing is noise. All THREE limbs are quoted and the
    // section is disjunctive — "one or more" — which matters because the second
    // limb is close to citywide coverage in Milwaukee and a reader who saw only
    // the first (a downtown-ish boundary) would badly under-claim it.
    if (isResidential && mkeRatio) {
      hurdles.push({
        category: 'parking',
        label: '25% parking reduction — three routes, any one of which qualifies',
        status: 'likely',
        note: 'Whatever minimum applies can be cut by a quarter on a disjunctive test: s. 295-403-2-b-4 allows “a reduction of 25% in the number of parking spaces required if the use meets one or more of the following criteria: … The use is located in the area bounded by Capitol Drive on the north, Lincoln Avenue on the south, Lake Michigan on the east and 43rd Street/Sherman Boulevard on the west. … The use is within 1,000 feet of any regularly scheduled bus stop providing local public bus service. … The use is within 1,320 feet of a bus station served by a designated bus rapid transit route offering high-frequency service.” Read the second limb carefully before assuming this is a narrow transit-oriented carve-out: within 1,000 feet of ANY local bus stop is close to citywide coverage in Milwaukee, which makes this much broader than a typical TOD reduction. None of the three limbs is in the parcel record — we hold no bus-stop or BRT-station geometry — so this is stated rather than applied; check the nearest stop before you size the lot.',
      })
    }

    // ─── Beyond parking (2026-08-08). Milwaukee Code of Ordinances chs. 119,
    // 120, 200, 218, 290, 295 and 355, plus Wis. Stat. § 66.1015, read
    // 2026-08-08 from the City Clerk / LRB consolidated PDFs and
    // docs.legis.wisconsin.gov. Same Cloudflare warning as the parking rows: a
    // 403 from city.milwaukee.gov is a bot check, not a missing document.
    //
    // Two rows are carried ELSEWHERE and must not be duplicated here: parking,
    // above and in PARKING_RULES['milwaukee'], and the certificate of
    // appropriateness, in HISTORIC_BODY['milwaukee'].
    //
    // NO `addsMonths` ON ANY ROW BELOW, deliberately. Milwaukee publishes a lot
    // of numbers — 10 days to rule an application complete, 30 days to decide,
    // 45 days to hearing, 15 days to review an erosion plan, a 30-day agency
    // comment window, plans due 5 weeks before a plan commission meeting, and
    // an 8-month demolition deferral — and not one of them is a duration for
    // the work. They are shot clocks on the city and one deferral CEILING.
    // Publishing a ceiling as an expectation is rule 6 in the time dimension.
    const mkeArticle = parcel.zoning.article ?? ''

    if (isResidential) {
      // ABSENCE, and the headline for Milwaukee — the strongest form of it in
      // this module. Tennessee bars inclusionary zoning for Nashville by name;
      // Wisconsin does the same for Milwaukee, in a section whose TITLE names
      // it, and the courts have already closed the rezoning-conditioned
      // workaround. The city-side slot test agrees: the Milwaukee Code's own
      // whole-code index has no "inclusionary" entry and no "affordable" entry.
      hurdles.push({
        category: 'affordability',
        label: 'State law bars inclusionary zoning',
        status: 'info',
        note: 'Wisconsin prohibits the mandate outright and by name, in a section headed “Municipal rent control, inclusionary zoning, prohibited”: “No city, village, town, or county may enact, impose, or enforce an inclusionary zoning requirement” (Wis. Stat. § 66.1015(3)(b), added by 2021 Wis. Acts 238 and 239). The definition is broad — § 66.1015(3)(a)1 reaches “a zoning ordinance, as defined in s. 66.10015 (1) (e), regulation, or policy that prescribes that a certain number or percentage of new or existing residential dwelling units in a land development be made available for rent or sale to an individual or family with a family income at or below a certain percentage of the median income.” A separate limb bars rent regulation: “No city, village, town or county may regulate the amount of rent or fees charged for the use of a residential rental dwelling unit” (§ 66.1015(1)). Do not read the exception at § 66.1015(2)(b) — “Entering into an agreement with a private person who regulates rent or fees charged for a residential rental dwelling unit” — as the usual rezoning-conditioned workaround: Apartment Ass’n of South Central Wisconsin v. City of Madison, 2006 WI App 192, struck down a Madison ordinance requiring 15% inclusionary units in developments of ten or more rental units conditioned on a rezoning, holding that sub. (2)(b) “plainly applies only to agreements with private persons who, on their own, choose to regulate rent.” So no unit count in Milwaukee triggers an affordability obligation, and the trade Nashville’s SP route allows is the exact thing Wisconsin case law has already rejected. Confirmed from the city side too: the Milwaukee Code’s whole-code index carries no entry for “inclusionary” and none for “affordable”.',
      })
    }

    // The one place affordability-adjacent strings DO attach — and the trigger
    // is a dollar amount we do not hold, so this is 'likely' with the threshold
    // limb quoted, never a gate on `funding === 'public'` alone pretending to
    // be the rule. Public funding of $400k attaches none of this.
    if (project.funding === 'public') {
      hurdles.push({
        category: 'labor',
        label: 'Community-participation requirements if city assistance exceeds $1 million',
        status: 'likely',
        note: 'Milwaukee attaches labor and reporting conditions to city-assisted projects, and the trigger is a dollar threshold this tool does not hold — confirm the assistance amount before pricing it. “DIRECT FINANCIAL ASSISTANCE means the value of below-market land sales, any direct subsidies to developers and city expenditures for private improvements, with a combined value of $1 million or more, as determined by the commissioner of the department, targeted specifically to a project. It includes the value of tax increment financing and below-market-rate loans provided by the city” (Milwaukee Code s. 355-1-2), and “All persons or entities receiving direct financial assistance for projects approved after August 8, 2009, shall comply with this chapter” (s. 355-3). Where it applies, the city resident participation level “shall be presumed to be 40%, unless the commissioner determines there is sufficient reason to impose a lesser requirement”, measured in worker hours excluding non-Wisconsin residents, with a required city resident utilization plan and gap analysis (s. 355-7-2-a); apprenticeship and on-the-job-trainee requirements follow (s. 355-9), as does first-source employment utilization (s. 355-11). Before any funds release you need a term sheet approved by the Common Council and an executed development agreement, plus a Comptroller/DCD analysis of the project’s financial feasibility, rate of return and jobs impact filed with the Council (s. 355-5). Below $1 million none of it attaches.',
      })
    }

    // Milwaukee's structural advantage, and the row a reader arriving from
    // Boston or San Francisco most needs — stated as 'info' and with all four
    // doors discretion enters through named, because the four rows below are
    // live exceptions and two of them are detectable only from a string in
    // `zoning.article`. "Permits are administrative" without the caveat would
    // be true of the base case and false of any parcel carrying an overlay.
    hurdles.push({
      category: 'review',
      label: 'No design-review board for a conforming project — permits are administrative',
      status: 'info',
      note: 'For a project that conforms to chapter 295 there is no site-plan hearing, no design commission and no community meeting in Milwaukee’s base process: “The administration of this chapter shall be vested in the commissioner of city development and commissioner of neighborhood services, with the commissioner of neighborhood services charged with the duty and authority to issue certificates of occupancy and construction permits. The commissioner of neighborhood services shall issue no certificate or permit for the use or development of any land or structure … if the intended use or the plans and specifications therefor are not in all respects in conformity with the provisions of this chapter” (Milwaukee Code s. 295-301). Discretion enters through exactly four doors, and each has its own row here: a mapped overlay (Site Plan Review, Development Incentive or Neighborhood Conservation), a historic designation, a special use classification for your use in your district, or a rezoning. Milwaukee will also let you start under uncertainty — a conditional construction permit valid up to 180 days is available while a variance, special use or map amendment is pending, provided the plans comply with everything except the provision under appeal (s. 295-304).',
    })

    if (MILWAUKEE_OVERLAY_PHRASE.sitePlanReview.test(mkeArticle)) {
      hurdles.push({
        category: 'review',
        label: 'Site Plan Review overlay: City Plan Commission approves the plans',
        status: 'required',
        note: 'This parcel is inside a Site Plan Review overlay zone, which moves the decision from the counter to a commission: “Once the site plan review overlay zone has been established, plans for all site work within the zone shall be submitted to the city plan commission for its approval. The approved design standards shall be used by the commission in its review of development plans within the zone” (Milwaukee Code s. 295-1009-2-d). The standards are not the base district’s — they “may include, but shall not be limited to: signage; fencing and landscaping; buffers; open space; pedestrian and vehicular access; building height, bulk, placement, façade treatment, materials and transparency”, and “These standards shall supercede the standards of the underlying district; provided, however, that where the design standards do not specify new standards, those of the underlying district shall be followed” (s. 295-1009-3-a). So treat any height or bulk figure shown for this parcel as the BASE district’s and not necessarily this site’s. Before approving, the commission must find the plan consistent with the comprehensive plan, consistent with the zone’s design standards, and not detrimental to the neighborhood (s. 295-1009-3-b); a deviation request goes to the commission, or to the commission and the Common Council, under s. 295-311-9. The ordinance publishes no timetable for any of it.',
      })
    }

    // CONJUNCTIVE, with the exemption on the face of the same sentence. The
    // exemption is the reason this gate is not just the overlay test: s.
    // 295-1007-2-e exempts "The development of single-family or 2-family
    // dwellings", so a 1- or 2-unit residential project must NOT be told it
    // needs development plan approval. It still fires on a two-unit project
    // inside a MIXED program, which is the right direction for the ambiguous
    // case — the exemption names dwellings, not floor area.
    //
    // sizeDependent because the exemption limb is a UNIT COUNT. Where `units`
    // came from `lot × 1.0 ÷ 1300`, a placeholder count decides whether the
    // exemption applies, so a hard 'required' here would rest on it. Softening
    // to 'info' is the conservative direction; the note still states the rule.
    if (
      MILWAUKEE_OVERLAY_PHRASE.developmentIncentive.test(mkeArticle) &&
      !(project.use === 'residential' && units > 0 && units <= 2)
    ) {
      hurdles.push({
        category: 'review',
        label: 'Development Incentive Zone: no permit until the development plan is approved',
        sizeDependent: true,
        status: 'required',
        note: 'This parcel is inside a Development Incentive Zone, and the permit is held until a plan is approved: “No building or grading permit for a project within a development incentive overlay zone shall be issued by the commissioner of neighborhood services until development plan approval has been granted or specified conditions have been met. The development of single-family or 2-family dwellings shall be exempt from this requirement” (Milwaukee Code s. 295-1007-2-e) — the exemption is on the face of the same sentence, so a 1- or 2-family project is outside this row entirely. The zone’s performance standards are prepared by the commissioner and adopted by the Common Council with the map amendment (s. 295-1007-2-b), and under s. 295-1007-3-a they “shall supercede the standards of the underlying district”, so the published height and bulk for this parcel are the base district’s, not necessarily this site’s. Denial for failure to meet the performance standards is appealed to the commission under s. 295-311-7. No timetable is published.',
      })
    }

    if (MILWAUKEE_OVERLAY_PHRASE.neighborhoodConservation.test(mkeArticle)) {
      // 'likely', not 'required': the binding content is in an adopted plan and
      // guidelines this tool does not hold. What can be said with certainty is
      // that the base district's use list and dimensional standards may both be
      // wrong here — which is worth saying, and is not the same as asserting a
      // requirement whose content we have not read.
      hurdles.push({
        category: 'review',
        label: 'Neighborhood Conservation overlay: an adopted plan and guidelines control',
        status: 'likely',
        note: 'This parcel is inside a Neighborhood Conservation overlay zone: “A neighborhood conservation overlay zone takes effect through adoption of a neighborhood conservation plan and a set of guidelines that will facilitate maintenance and protection of the neighborhood character and the development of vacant or underused lots. Incompatible mixes of uses will be reduced or prohibited by adding limitations to the list of permitted, limited and special uses of the base district” (Milwaukee Code s. 295-1003-1). The plan itself carries “land uses, building types and features, site development requirements, signing, circulation, off-street parking and modifications to base district standards” (s. 295-1003-2-a-3). Two consequences for a feasibility read: the use list shown for the base district may be NARROWER here, and the dimensional standards may differ. The plan is a separate document per neighbourhood and this tool does not hold it — get it before you design.',
      })
    }

    // Un-gateable by construction, and stated for that reason. The two districts
    // are defined by Common Council RESOLUTION (870501 and 110693), not by any
    // layer this tool fetches, so nothing about this parcel can be asserted —
    // but the row matters because a parcel inside one is carved OUT of the
    // historic ordinance and into a different body's certificate, which means
    // the historic row above is not the whole answer for those two areas.
    hurdles.push({
      category: 'review',
      label: 'Architectural Review Board districts: a second certificate, outside the historic system',
      status: 'info',
      note: 'Milwaukee has a design-review body SEPARATE from the Historic Preservation Commission, and a parcel inside one of its districts is expressly carved out of the historic ordinance — s. 320-21-2-a provides that historic preservation “shall not apply to any district specified in s. 200-61”, except that the city may designate the district for demolition regulation alone with the board’s concurrence. The board’s reach is broad: “No person or entity shall, with respect to the exterior of any building, structure or site in the district, alter, rehabilitate, or reconstruct all or any part of, undertake any new construction with respect to, or permit any work to be performed upon a building, structure or site, nor shall the commissioner of city development issue a permit for any such work unless a certificate of appropriateness has been issued by the board” (Milwaukee Code s. 200-61-5). The districts are “the area designated by common council resolution 870501 as business improvement district #2 or the area designated by common council resolution 110693 as the East Side architectural review district”, plus “such additional areas as may be designated by the common council”, each with its own board (s. 200-61-2-e). The board may delegate administratively approvable project types to staff under a written policy (s. 200-61-5-b-2); otherwise it reviews at its next regular meeting, must give written notice of a denial within 30 days, and a denied applicant has 30 days to demand a public hearing, which is then scheduled within 45 days with mailed notice to owners within 500 feet (s. 200-61-5-b-3, -b-4, -c-1, -c-2). THIS TOOL HOLDS NO BOUNDARY FOR EITHER DISTRICT — check whether your parcel is in the Historic Third Ward (BID #2) or the East Side district before assuming the permit is administrative.',
    })

    if (teardown && parcel.overlays.historicDistrict) {
      // No addsMonths. The 8 months is a CEILING on a deferral that may never
      // be invoked, and the 45 + 30 days are decision deadlines on the
      // commission. Publishing either as an expected delay is rule 6 in the
      // time dimension — the same reason Raleigh's 180-day outer limit gets no
      // HISTORIC_MONTHS override.
      hurdles.push({
        category: 'demolition',
        label: 'Historic demolition: a public hearing, and a deferral of up to 8 months',
        status: 'required',
        note: 'Demolition inside a designated district, or of a designated structure, is a different and slower proceeding than alteration. “The commission shall hold a public hearing on an application for a certificate of appropriateness within 45 days after commission staff determines the application to be complete as to form … Within 30 days of the conclusion of the public hearing, the commission shall render a decision that grants, grants with conditions, denies or … defers action” (Milwaukee Code s. 320-21-11-c-2). Deferral is the real risk: “The commission may defer a decision on an application for a certificate of appropriateness for demolition for up to 8 months from the date of application for the demolition permit … During the period of deferral, the commission and the applicant shall seek a mutually-agreeable method of saving the subject structure … If the commission fails to take action by the end of the deferral period, the certificate of appropriateness shall be deemed granted” (s. 320-21-11-f-1); a deferral is appealable to the Common Council within 20 days (s. 320-21-11-f-2). Two conditions can be attached that bite on financing and schedule. Where demolition is granted to allow new construction, the commission may stipulate that no demolition permit issue “until the commission determines that the applicant has provided the commission with evidence … that all debt and equity financing necessary for the new construction project has been obtained” (s. 320-21-11-c-2). And for any building designated, in a designated district, or listed on (or in a district listed on) the National Register, the commission “shall require, as a condition of the certificate, that the applicant deliver to the commission … historic building documentation prior to demolition” — comprehensive three-dimensional digital documentation of the exterior at survey-level accuracy, “a permanent digital twin” (ss. 320-21-3-g, 320-21-11-c-3). Deterioration you caused is not a way out: s. 320-21-11-h-6 bars a hardship finding where the difficulty “is self-created or a result of demolition by neglect.” The 8 months is a ceiling on a deferral that may never be invoked and the 45- and 30-day figures are deadlines on the commission, so none of them is scheduled here as an expected delay.',
      })
    }

    // The Milwaukee-specific one, and genuinely costly. Scope is the EXISTING
    // building's permitted occupancy and year from the assessor record, not the
    // project's floor area — so NOT sizeDependent (same reasoning as Raleigh's
    // lot-area tree row: the tag exists to soften claims resting on a
    // placeholder FLOOR AREA, and no floor area is in this trigger).
    //
    // `exUnits === 0` (unknown count) does NOT fire: "primary dwelling
    // structure" is defined as 1–4 units and a missing count could be a
    // 40-unit apartment block. That is a false negative and never a false
    // positive — the safe direction. `providers/milwaukee.ts` carries YR_BUILT,
    // so the year limb usually resolves.
    const mkeDeconYear = existing.ex?.yearBuilt
    const mkeDeconYearLimb = mkeDeconYear != null && mkeDeconYear <= 1929
    if (
      teardown &&
      existing.exUnits >= 1 &&
      existing.exUnits <= 4 &&
      (mkeDeconYearLimb || !!parcel.overlays.historicDistrict)
    ) {
      hurdles.push({
        category: 'demolition',
        label: 'Deconstruction required, not demolition (pre-1930 1–4 unit homes)',
        // The year limb is on the record; the historic limb alone depends on
        // the structure ALSO being a "primary dwelling structure" designated or
        // in a designated district, which the overlay field supports but does
        // not settle at the structure level.
        status: mkeDeconYearLimb ? 'required' : 'likely',
        note: `${
          mkeDeconYearLimb
            ? `The record shows the existing building here dates to ${mkeDeconYear}, in 1929 or earlier, and it carries ${existing.exUnits} dwelling unit${existing.exUnits === 1 ? '' : 's'} — both limbs of the scope test. `
            : `The record shows ${existing.exUnits} dwelling unit${existing.exUnits === 1 ? '' : 's'} here inside a designated historic district, which is the second route into this section${mkeDeconYear == null ? '; no year built is on the record, so the pre-1930 limb could not be checked' : ''}. `
        }Milwaukee bans mechanical demolition of its older small houses. Scope, verbatim: “The deconstruction requirements of this section apply to any demolition permit application under this chapter for any of the following: A primary dwelling structure that was built in 1929 or earlier according to building permit records on file with the department or, if no such permit records exist, according to records of the commissioner of assessments or the Milwaukee county register of deeds. … A primary dwelling structure that has been designated as an historic structure by the common council under s. 320-21. … A primary dwelling structure located in an historic district designated by the common council under s. 320-21” (Milwaukee Code s. 218-10-4-a). “Primary dwelling structure” is defined narrowly, and the definition is the second limb of the test: “a residential structure containing one to 4 dwelling units based on current permitted occupancy at the time of demolition permit application. This term does not include an accessory building such as a garage or shed” (s. 218-10-2-c). Where it applies: “Every deconstruction project shall achieve a documented 85% landfill diversion rate by weight”; the demolition permit application “shall not be considered complete unless it is accompanied by a completed pre-deconstruction form … including a list of targeted salvageable materials and final destinations”; the work “shall only be performed by a certified deconstruction contractor listed on the department’s website” with at least one certified employee on site; and a department-issued yard sign must be posted on each street frontage before work starts (s. 218-10-4-b-1 to -b-4). Relief is discretionary and case-by-case — the commissioner may waive the 85% “based on economic or practical infeasibilty … after consideration and inspection” (s. 218-10-4-b-1-a). Deconstruction is labour-intensive by design; the ordinance says so. Price the teardown line at deconstruction rates, not demolition rates.`,
      })
    }

    if (project.projectType === 'new') {
      // DISJUNCTIVE, and both live limbs are measured in units this tool does
      // not hold — DISTURBED area and IMPERVIOUS increase. Lot area is a proxy
      // for them and is labelled as one on the face of the note (same treatment
      // as Raleigh's 12,000 sq ft erosion row and Philadelphia's 5,000 sq ft
      // earth-disturbance row). 21,780 sq ft = half an acre, the smaller of the
      // two live thresholds. Not sizeDependent: no floor area is in the trigger.
      if (lotSqFt >= 21780) {
        hurdles.push({
          category: 'environmental',
          label: 'Stormwater management plan (1 acre disturbed, or ½ acre new impervious)',
          status: 'likely',
          note: 'This parcel is at or above half an acre, which puts it in range of Milwaukee’s stormwater plan requirement — but read the trigger before pricing it, because it is measured in units this tool does not hold. “A storm water management plan is required if any of the following criteria are met: The development or redevelopment causes a land disturbing activity of one acre or more. … causes the cumulative area of all land disturbing activities at a property to be one acre or more over a 3-year period. … causes an increase of 0.5 acres or more of impervious area. … The construction or reconstruction of a public road will increase impervious surface by one-half acre or more” (Milwaukee Code s. 120-7-2). Those are DISTURBED area and IMPERVIOUS increase; lot area is only a proxy for them here, so a large parcel with a small footprint may sit below the line. The plan is a precondition to starting: it is required “Before the development or redevelopment is permitted for commencement of construction” and “Before or concurrent with the submittal and approval of an erosion and sediment control plan as specified in ch. 290” (s. 120-7-1). What it costs depends on which limb you trip. At half an acre or more of new impervious area “the release rate and requirements shall be governed by Milwaukee metropolitan sewerage district chapter 13 - surface water and storm water rules” (s. 120-7-5-a) — an external ruleset this tool does not model. Below that, post-development peak flows must be “at least 10% less than the peak runoff rates under pre-development conditions during 2-year and 100-year, 24-hour storm events” (s. 120-7-5-b); redevelopment disturbing 3.5–5 acres takes a further 15% reduction and above 5 acres a 20% reduction (s. 120-7-5-c, -d). Water quality is 80% total suspended solids reduction for new development and 40% for redevelopment (s. 120-7-6-a). A waiver exists but only for projects that are themselves stormwater or green-infrastructure work (s. 120-7-4-c). One mapped exception worth checking: s. 120-7-1.5 excludes property in the Milwaukee River greenway site plan review overlay zone from this section entirely and routes it to s. 120-14 instead.',
        })
      }

      hurdles.push({
        category: 'environmental',
        label: 'Erosion control plan and permit before any ground is broken',
        status: 'likely',
        note: 'The threshold is low enough that most ground-up work in Milwaukee is inside it, but it is measured in disturbed surface area and excavation volume rather than in anything this tool holds, so it is stated rather than asserted. Chapter 290 applies to sites “requiring a subdivision plat approval or the construction of houses or commercial, industrial or institutional buildings on lots of approved subdivision plats”, the same for certified surveys, and to any activity “involving grading, removal of protective ground cover or vegetation, excavation, land filling or other land disturbing activity affecting a surface area of 4,000 square feet or more”, or “involving excavation, filling or storage … affecting 100 cubic yards or more of dirt, sand or other excavation or fill material” (Milwaukee Code s. 290-7-1-a to -d). The permit gates the work: “No landowner or land user may commence a land disturbing construction activity subject to this chapter without receiving prior approval of a control plan for the site and a permit from the department” (s. 290-9). At one acre or more the plan becomes a full survey package — an existing-conditions map at 1"=100\', 100-year floodplains, soil types, vegetative cover, topography at 5-foot contours, a final-conditions plan, a construction schedule and spill prevention procedures (s. 290-9-1); under an acre it is “an erosion control plan statement with simple map” (s. 290-9-2). Review is clocked on the city, not on you: “Within 15 days of receipt of the application, control plan, or control plan statement and fee, the department of city development shall review the application” and either approve and issue, or state the deficiencies, with 10 days to re-review on resubmittal (s. 290-9-3).',
      })

      // Two findings in one row, and the SECOND is the one worth reading — an
      // absence somebody actually looked for, with the scope of the look stated
      // so the next reader knows what it does and does not cover.
      hurdles.push({
        category: 'environmental',
        label: 'Landscaping and canopy trees — but no tree-preservation ordinance',
        status: 'required',
        note: 'First the requirement: “Any new building, parking lot or other site improvement shall comply with the requirements of this section. When a new principal building is added to a premises, and occupies at least 10 percent of the site area, the entire premises shall comply with the requirements of this section” (Milwaukee Code s. 295-405-1-b-1) — so a modest new building on an already-developed lot can pull the WHOLE site into compliance. Parking is where it bites: parking-lot landscaping “is required at any site with 5 or more off-street surface parking spaces”, and “A minimum of one canopy tree and 100 square feet of landscaped area is required for every 4 parking spaces or fraction thereof”, excluding structured, motorcycle and bicycle spaces (s. 295-405-3-c-2, -c-3). Canopy trees must be at least 2.5-inch caliper at planting with 100 sq ft of surface area and 150 cubic feet of planting soil each, ash and female gingko are prohibited, and no more than 50% may be ornamental (s. 295-405-2-a); screening of parking from residential districts runs to 10-foot landscaped strips or masonry walls (Table 295-405-3-b). Second, and this is an ANSWER rather than a gap: Milwaukee has NO tree-preservation ordinance on private property — no conservation area, no removal permit, no replacement schedule, nothing analogous to Raleigh’s Article 9.1 or Nashville’s tree density factor. Section 295-405 is titled “Landscaping and Screening” and its subsections run Introduction / Elements / requirements for motor-vehicle uses / outdoor storage / screening of utilitarian features / adaptations from the former landscaping code; there is no removal or preservation subsection in it. The Code’s own whole-code index has no private-tree entry, and every tree provision in ch. 116 (ss. 116-52, 116-53, 116-60, 116-63, 116-66) governs trees in the public highway and right-of-way. Chapter 295’s only preservation-flavoured provision runs the other way, as a credit: an existing canopy tree may count toward the minimum “provided it complies with the standards of this subsection and no soil within 5 feet of the tree is disturbed” (s. 295-405-2-a-4). Scope of that absence check, so the next reader knows what was looked at: s. 295-405 in full, ch. 116’s tree sections, and the code index — not every chapter.',
      })
    }

    // ABSENCE, with the scope of the check stated. Wisconsin AUTHORISES impact
    // fees by ordinance; what could not be found is a Milwaukee ordinance
    // adopting one. That is a checked absence over the code index and ch. 119,
    // not a search of every chapter — so it is written as "not adopted that
    // this check could find", and the row carries the exaction that IS there.
    hurdles.push({
      category: 'fees',
      label: 'No development impact fees — but a subdivision triggers an improvements agreement',
      status: 'info',
      note: 'Wisconsin authorises municipal impact fees by ordinance, and Milwaukee has not adopted one that this check could find: the Code’s whole-code index carries no “impact fee” entry, and the chapter that would house an exaction — ch. 119, Subdivision Regulations — sets no fee. What it sets instead is construction. “The subdivider of a subdivision plat shall enter into an agreement with the city, in recordable form, referred to on the face of the plat, to guarantee the installation at the subdivider’s own expense … of the following facilities required by the common council and the commissioner of public works” — water mains, sanitary and stormwater facilities and laterals to the lot line, street and alley surfacing, sidewalks on both sides of every street in a residentially zoned area, and street lighting with the city paying 50% of installation (s. 119-12-1-a to -d). “The charge for the work done by the subdivider shall be deemed to be special assessments, duly authorized, made and levied” (s. 119-12-2), and dedications for public streets, alleys and other ways shown on the official map must appear on the face of the plat before it can be approved (s. 119-13-1). The commissioner can waive the agreement where the public improvements already exist or are already programmed (s. 119-12-1). Crucially this attaches to a LAND DIVISION, not to a building: a division creating 4 or fewer parcels, or 8 or fewer none of which is zoned RS1–RS6, RT2–RT4, PK or TL, goes by certified survey map, and anything else needs a subdivision plat (s. 119-3-2, -3). Build on an existing lot and none of it arises. Scope of this absence check: the code index plus ch. 119, not a search of every chapter — confirm at permit.',
    })

    if (discretionary) {
      // No addsMonths for either of the two rows below: the code publishes no
      // clock for any stage of a map amendment, and the special use figures are
      // an agency comment WINDOW and a notice lead time, not a schedule.
      hurdles.push({
        category: 'review',
        label: 'Rezoning or planned development: Plan Commission hearing, then Common Council',
        status: 'likely',
        note: 'Asking for more than the base district means a zoning map amendment, and in Wisconsin that is a legislative act. The route is fixed: the department prepares the ordinance, it is referred to the City Plan Commission under s. 62.23 Wis. Stats., staff sets a public hearing and notifies affected owners at least 10 days ahead, “The commission shall hold at least one public hearing on any proposed map amendment” with notice to owners “immediately surrounding and within at least 250 feet thereof, including streets and alleys, as well as to all mailing addresses in the same area”, then the Common Council’s zoning, neighborhoods and development committee holds a class 2 public hearing on the same notice radius, then the Council acts (Milwaukee Code s. 295-307-3-a to -f). The standards are broad and discretionary — consistency with the comprehensive plan, and no adverse effect on public health, safety and general welfare (s. 295-307-4). Two state-law points cut in the applicant’s favour. The Code’s own protest-petition provision at s. 295-307-5, which would have required a three-fourths vote on a valid protest by owners of 20% of the affected or adjacent land, carries an editor’s note recording that it “is superseded by s. 66.10015(3)(a), Wis. Stats. (2023 Assembly Bill 266, effective June 23, 2023), which provides that a zoning amendment shall be approved by a simple majority of a quorum of common council members-elect” — the neighbour veto that exists in many cities does not exist here. Conversely a DOWN zoning still needs two-thirds unless the owner initiated or waived it (s. 295-307-3-f). Where flexibility rather than a different district is what you need, the planned development district (PD/DPD) is the vehicle, one-phase or two, with a general plan and detailed plans submitted to the City Plan Commission — and note the submission lead time the code itself sets: the electronic plans and narrative are due “at least 5 weeks prior to the scheduled city plan commission meeting” (s. 295-907-2-b-9). No clock is published for the process as a whole.',
      })

      hurdles.push({
        category: 'review',
        label: 'Special use permit: Board of Zoning Appeals hearing, plus a 30-day agency comment window',
        status: 'likely',
        note: 'Where chapter 295 classifies your use as a special use in your district, the decision belongs to the Board of Zoning Appeals rather than to staff — the board has “the authority to interpret this chapter, to approve, conditionally approve or deny variances and special use permits” (Milwaukee Code s. 295-311-1-a-1). The hearing is public, with mailed notice “at least 7 days prior to the hearing … to owners of property under consideration and owners of property immediately surrounding and within at least 250 feet thereof, inclusive of streets and alleys” (s. 295-311-2-b). There is a built-in floor on how fast it can move: “No special use hearing shall be held and no special use permit shall be granted unless the board or its staff has received a report of any comments, concerns or recommendations relating to the proposed special use from the department of public works, the department of city development, the department of neighborhood services and the common council member in whose district the special use would be located. The board may proceed … regardless of whether any of these parties have submitted a report, provided that 30 days have elapsed since the date on which the board’s office notified each of these parties that a completed special use permit application had been received” (s. 295-311-2-c). The findings the board must make are discretionary and neighbourhood-facing, including that “The use, value and enjoyment of other property in the neighborhood will not be substantially impaired or diminished” (s. 295-311-2-d-2). Whether YOUR use is a special use in THIS district is not something the parcel record answers — check the district’s use table before assuming the administrative path applies.',
      })
    }
  } else if (city === 'columbus') {
    // Columbus City Codes Title 33 ch. 3312 and Title 34, read 2026-08-08 via
    // the Municode API path `zoning/columbus.ts` established. Source note in
    // PARKING_RULES['columbus']; cohort caveat above the constants.
    const colCode = (parcel.zoning.districtCode ?? '').trim().toUpperCase()
    const colTitle34 = COLUMBUS_TITLE34.has(colCode)
    const colAcres = lotSqFt / 43560
    const colSub = parcel.zoning.subdistrict ?? ''
    // The three mapped design-review areas, read off what the provider actually
    // fetches (layer 14 separates these from historic designations via
    // `designReviewFrom`). `subdistrict` carries the design-review label only
    // when no historic district is also present, so a miss here is a false
    // NEGATIVE and never a false positive — the direction rule 5 wants.
    const colDesignReview =
      colCode === 'DD' ||
      colCode === 'EFD' ||
      /downtown commission|east franklinton|university impact|design review/i.test(colSub)

    if (colCode === 'DD') {
      hurdles.push({
        category: 'parking',
        label: 'Downtown District: no off-street parking required',
        status: 'info',
        note: 'This parcel is in the Downtown District (DD), which has never carried a parking minimum. Chapter 3312 hands the question off — “Downtown parking shall be as prescribed in the downtown district zoning chapter” (C.C. 3312.07) — and the downtown chapter answers it: “There are no requirements for off-street parking within the downtown district. However, the design elements of Chapter 3312, Off-street parking and loading, and the provisions of Subsection 3359.05(C)(1), Design review, apply” (C.C. 3359.27). So the count is yours to choose, but the design standards and downtown design review still bind whatever you build.',
      })
    } else {
      // ⚠️ THIS ROW IS 'likely' AND MUST STAY THERE — but HALF ITS REASONING IS
      // RETRACTED (2026-08-08), and the retraction is written here because this
      // comment is where a reader lands (rule 17).
      //
      // WHAT STANDS. Which of Columbus's two codes governs is the joint
      // dependency `zoning/columbus.ts` FACT 0 records, decided by the zoning
      // layer's GENERAL_ZONING_CATEGORY field — 'Mixed-Use' ⇔ Title 34 — and
      // that field is not on ParcelInfo. A PREFIX match on the district string
      // is still a trap: UCRPD and LUCRPD are Title 33 research-park districts
      // that `/^UCR/` would sweep into Title 34 and hand a "no minimum" answer
      // they do not have.
      //
      // WHAT IS RETRACTED. This row used to say the district string "cannot
      // stand in for it" at all, and four rows below now depend on the opposite.
      // The discriminator was run live against the provider's own layer
      // (Applications/Zoning/MapServer/20) on 2026-08-08: an EXACT-SET
      // membership test on the seven Title 34 designations returns 1,619
      // polygons, and GENERAL_ZONING_CATEGORY = 'Mixed-Use' returns the same
      // 1,619, with no row in either set failing the other across all 18,804
      // mapped polygons. Exact-set membership is therefore a measured
      // biconditional; the FACT-0 trap is a trap for `startsWith`, not for
      // `has()`. See COLUMBUS_TITLE34 above.
      //
      // WHY THE ROW IS STILL 'likely' ANYWAY. The set is a transcription of
      // Title 34 § E.20.030's district vocabulary as it stood on 2026-08-08, and
      // Zone In Phase 2 can add designations without this file hearing about it;
      // the authoritative field remains the layer's category. So the row states
      // which side the district string puts this parcel on and still tells the
      // reader to confirm the designation, rather than hardening into a
      // requirement (or into an exemption) on a transcribed list.
      hurdles.push({
        category: 'parking',
        label: 'Parking minimum depends on which of Columbus’s two zoning codes governs',
        sizeDependent: true,
        status: 'likely',
        note: `Columbus runs two codes at once and they disagree about parking, so the answer for this parcel turns on which one applies. Under the 2024 Zoning Code (Title 34, the “Zone In” rewrite) there is no minimum: “No minimum vehicular parking is required for Mixed-Use Zoning District designations outlined in this Chapter” (C.C. Title 34 § E.20.030.E.1), and Chapter E.20 is the only district chapter Title 34 has, so no district in that code carries one. Under Title 33, C.C. 3312.49 Table 2 requires 2 spaces per unit for 1, 2 or 3 dwelling units and 1.5 per unit for 4 or more — at ${units || 'an unestablished number of'} unit${units === 1 ? '' : 's'} that is ${units >= 4 ? '1.5 per unit' : units >= 1 ? '2 per unit' : 'one of the two, depending on the count'} — with accessory dwelling units “N/A”, under an opening line that reads “The number of off-street parking spaces required for various uses shall be no less than as set forth in the parking requirements tables.” ${
          colTitle34
            ? `This parcel is mapped ${colCode}, one of the seven district designations Title 34 actually has, so the Title 34 answer — no minimum — is the one that applies on the mapped district.`
            : `This parcel's district (${colCode || 'not resolved'}) is not one of the seven Title 34 designations, so the Title 33 minimums above are the ones to price.`
        } Read that with the right amount of confidence. Which code governs is set by the zoning layer's own category field, which this tool does not carry through to here; what was measured on 2026-08-08 is that an EXACT-SET test on the seven Title 34 district names is a biconditional with that field across all 18,804 mapped polygons. A PREFIX test is not: the Title 33 research-park districts UCRPD and LUCRPD would be mistaken for the Title 34 Urban Core district UCR by any prefix match. The set is a transcription of Title 34 § E.20.030 as it stood that day and Zone In Phase 2 can extend it, so confirm the parcel's code designation before pricing spaces — most of the city, roughly 17,185 of 18,804 mapped polygons, is still Title 33. One trap on the way: C.C. 3304.03(F) lists Chapter 3312 among the Title 33 chapters that apply to the 2024 code, which reads as though the minimums carry over. They do not — Title 34 § E.20.030.E.2 imports 3312's design provisions only, and 3312 agrees from its own side: “For parcels with a 2024 Zoning Code district designation, vehicular parking is not required” (C.C. 3312.55.B).`,
      })
    }

    // Geographic and un-gateable: we hold no Special Parking Area boundary. It
    // is worth stating anyway because both areas close the usual escape hatch,
    // and because both self-terminate on rezoning — a parcel can leave the area
    // without the map moving.
    hurdles.push({
      category: 'parking',
      label: 'Short North / East Franklinton Special Parking Areas halve the requirement',
      status: 'info',
      note: 'Two mapped areas cut the Title 33 requirement, and both are written identically: “Non-residential, off-street vehicle parking requirements in the [Short North / East Franklinton] Special Parking Area shall be One-Half (1/2) of the off-street parking as required in this chapter, except as follows: … Retail, Office, and Medical Office, 2,500 square feet or less - No off-street parking shall be required … Two-, Three-, and Multi-Unit Dwellings - 1 per unit” (C.C. 3312.051.C, 3312.053.C). Two things about them are easy to miss. First, they close the escape hatch rather than opening one: “no further reduction or variance to the number of required off-street parking spaces shall be granted by a variance by the Board of Zoning Adjustment or City Council”. Second, they self-terminate — “Any parcel located within the geographic boundaries of the [X] Parking Area that has been rezoned to a 2024 Zoning Code district designation is thereby excluded” (C.C. 3312.051.A, 3312.053.A) — so a rezoning takes the parcel out of the area entirely, into the code that requires no parking at all. Neither boundary is in the parcel record; check whether this site sits inside one.',
    })

    // ─── Beyond parking (2026-08-08). Columbus City Codes read via
    // api.municode.com job 487713 / product 16219, Supp. No. 85, codified
    // through Ord. No. 0923-2026; Title 34 from the supplement's attached PDF,
    // footer "July 2025"; ORC ch. 713 from codes.ohio.gov's chapter index.
    //
    // NO `addsMonths` ON ANY ROW BELOW. Columbus publishes no duration for any
    // of this: 15 days to appeal parking mitigation and 30 for the Director to
    // convene (4310.07(B), (D)); 30 days to appeal a Downtown Commission
    // certificate to Council (3359.05(E)); a 10-day filing lead before a
    // REGULARLY SCHEDULED preservation-commission meeting (3116.06(B)); 45 days
    // for a rehearing and 90 to negotiate after a hardship finding (3116.19(A),
    // 3116.20). Every one is an appeal window, a filing deadline or a contingent
    // branch — rule 6 in the time dimension.

    // ABSENCE, and the headline finding for Columbus — but a DIFFERENT absence
    // from Nashville's, and the difference is the sentence this row must not
    // contain. Tennessee bans mandatory inclusionary zoning by name (Tenn. Code
    // Ann. § 66-35-102(b)). Ohio has not been shown to. What was checked: ORC
    // Chapter 713 (Municipal Planning — the chapter that grants and bounds a
    // municipality's zoning power) was read as an INDEX from codes.ohio.gov, all
    // 32 sections, 713.01 through 713.34, and there is no section on affordable
    // housing, inclusionary zoning or set-asides in EITHER direction. That
    // establishes the enabling chapter is silent; it does not establish that no
    // Ohio statute anywhere speaks to it, and the rest of the Revised Code was
    // not searched. So this row reads as Raleigh's does — a rule this city has
    // not adopted — and says which of the two checks was actually run (rule 8).
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'No inclusionary requirement — affordability rides on a voluntary tax abatement',
        status: 'info',
        note: 'Columbus sets no affordable-unit requirement at any project size: there is no unit count and no floor area at which income-restricted units become compulsory, and no fee in lieu. Every affordability obligation in the code hangs off an incentive the developer elects. The first is the Community Reinvestment Area property-tax abatement, whose chapter exists "to establish policies, procedures, and conditions for the provision of certain Community Reinvestment Area (CRA) tax incentives … to foster investment in, and the development of, affordable housing" (C.C. 4565.01). The second is the Title 34 Affordable Housing Height Bonus, which is available only "to an Affordable Housing Height Bonus applicant that agrees to be bound by the affordability requirements described in the City Residential CRA Program" (Title 34 § G.30.030(A)) — worth 3 extra stories in RAC, 2 in CAC, 2 in UCT and 4 in UCR, and "A bonus story must not exceed 12 feet" (Table G.30.060.A). Both are optional and the code says so: "Participation in the Height Bonus Program is voluntary; Project Sponsors approved under Chapter 4565 (Affordable Housing and Community Reinvestment Area Incentive Policy) are not required to seek the Height Bonus" (§ G.30.030(D)). On the state-law backdrop, note precisely what is and is not settled here. Ohio Revised Code Chapter 713 (Municipal Planning) — the chapter that grants and bounds a municipality\'s zoning power — was read section by section, all 32 sections, and contains nothing on affordable housing, inclusionary zoning or set-asides in either direction. That establishes the enabling chapter is silent. It does not establish an absence: the rest of the Revised Code was not searched. Treat this as a rule Columbus has not adopted, not one the State has forbidden.',
      })
    }

    // CONJUNCTIVE THREE WAYS, and the row most at risk of being encoded from its
    // first clause. Only limb (b) — four or more Housing Units — is on the
    // record. Limb (a) is the applicant's own election (the whole chapter is
    // opt-in) and limb (c) is the CRA boundary and its Area Designation, which
    // Columbus publishes (Schemas/Development/MapServer/5, "Community
    // Reinvestment Areas - Residential") but `providers/columbus.ts` does not
    // fetch. Both unheld limbs go on the face of the note. NEVER 'required'.
    if (isResidential && units >= 4) {
      hurdles.push({
        category: 'affordability',
        label: 'CRA tax abatement: affordable set-aside at 4 or more units',
        sizeDependent: true,
        status: 'likely',
        note: 'A Community Reinvestment Area tax abatement carries an affordability set-aside once a project reaches four units — but all three limbs of the trigger have to hold, and only one of them is on the record here. C.C. 4565.06(A): "CRA tax incentives for Development Projects containing four (4) or more Housing Units within post-1994 CRAs designated Market Ready, Ready for Revitalization, or Ready for Opportunity require the Project Sponsor to apply for an Incentive and enter into an agreement with the City per the deadlines included in the Director\'s Rules." So: (a) the project must be seeking a CRA incentive — the chapter is entirely opt-in, and nothing compels you into it; (b) it must contain four or more Housing Units, which this one does; and (c) the parcel must lie inside a post-1994 Community Reinvestment Area carrying one of those three Area Designations. Columbus publishes the CRA boundaries and their designations, but they are not in this parcel record, so limb (c) is stated rather than checked — and limb (a) is your own decision, which is why this is not written as a requirement. Where it does apply the price is specific. A Market Ready project of four or more units "must elect one of the requirements specified below … in order to be eligible for a one hundred (100%) percent abatement of the increase in assessed value of the structure for a period of fifteen (15) years": 10% of units at or below 60% AMI PLUS a further 10% or more at or below 80% AMI; or 30% of units at or below 80% AMI; or all units sold to owner-occupants at or below 120% AMI with a Cost of Ownership no greater than 35% of gross income (C.C. 4565.07(A)(a)–(c)). Ready for Revitalization and Ready for Opportunity areas carry their own, different term sets at §§ 4565.08 and 4565.09 — do not price the Market Ready figures as the citywide answer. The obligation is not only a percentage: affordable units "shall be dispersed throughout the Development Project and shall be comparable to the design and quality of market-rate Housing Units … in terms of appearance, materials, and finish", the bedroom mix must mirror the project\'s, and they must be built "within a similar timeline as non-Affordable Housing Units" (C.C. 4565.04(A), (B), (D)). And the obvious route around it is closed: "Development Projects shall not be artificially divided to avoid the agreement requirements within this Chapter" (C.C. 4565.06(B)).',
      })
    }

    // The process Title 34 substitutes for the minimum it abolished, and the
    // reason "no parking minimum" is not the whole story on a Title 34 parcel.
    // Chapter 4310's applicability is unconditional on limb (A), but whether a
    // study is actually demanded is a second, discretionary determination and
    // whether mitigation follows is a third — hence 'likely', not 'required'.
    // Limb (B) is a variance to the PARKING minimum specifically, not any
    // variance, so it is named rather than gated on `discretionary`.
    if (colTitle34) {
      hurdles.push({
        category: 'review',
        label: 'Parking Impact Study — the price of having no parking minimum',
        status: 'likely',
        note: `This parcel is mapped ${parcel.zoning.districtCode}, a 2024 Zoning Code (Title 34) district, and Title 34 says in terms that removing the minimum does not remove the process: development proposals in these districts "are, however, subject to the provisions of Chapter 4310 (Parking Impact Study), including potential mitigation requirements" (Title 34 § E.20.030.E.1; repeated at § A.10.060). Chapter 4310 reaches "all new Developments and to the expansion or change in use of an existing Development" where either "(A) The Development is located within a parcel with a 2024 Zoning Code district designation for which there is no minimum vehicular parking requirement; or (B) Any Development for which there is a request for variance to the minimum parking requirements" (C.C. 4310.02). Limb (A) holds for every Title 34 parcel, because every Title 34 district has no minimum; limb (B) is a variance to the parking minimum specifically, not to zoning generally. What is NOT automatic is the study itself: "The Director must determine when a Parking Impact Study is required and publish guidelines in the rules and regulations" (C.C. 4310.05(A)), weighing proximity to public parking, the size and land use of the site, the on-site parking provided and the zoning classification — and mitigation is a further finding on top of that (C.C. 4310.06(A)). It is a submittal item rather than a separate hearing: the information "shall be provided by the applicant … as part of the site plan review process provided for in CC Section 4113.29" (C.C. 4310.04). Where mitigation is ordered it can be built or bought — "new services, including, but not limited to, shared parking services, public transit passes, car sharing, and shared mobility devices; and/or payment of a fee", with any fee capped at "the actual costs incurred by the City in negating the increased demand for Public Parking Systems directly caused by that development" (C.C. 4310.06(B)–(C)). No rate is stated here because none is in the code: the figures live in the Director's rules and regulations filed with the City Clerk. A mitigation determination is appealable within 15 days and the Director must convene within 30 (C.C. 4310.07(B), (D)) — an appeal window, not a schedule.`,
      })
    }

    // CONJUNCTIVE THREE WAYS and all three are gated, because all three are on
    // the record: (a) an application for REZONING — not any permit; (b) land "in
    // excess of one acre"; (c) a Title 33 parcel, because C.C. 3304.04(B) puts
    // "3318: Parkland Dedication" on the list of chapters that "do not apply to
    // the 2024 Zoning Code".
    // NOT sizeDependent: the trigger is LOT AREA, which the parcel record
    // measures directly, plus a rezoning — no floor area appears anywhere in it.
    // The tag exists to soften claims resting on a placeholder floor area. Same
    // reasoning as Raleigh's tree row.
    if (discretionary && colAcres > 1 && !colTitle34) {
      hurdles.push({
        category: 'fees',
        label: 'Parkland dedication or payment in lieu — rezonings over one acre',
        status: 'likely',
        note: `This project needs a rezoning and the parcel is about ${colAcres.toFixed(1)} acres, over the one-acre line: "Upon the submission of an application for rezoning of land in excess of one acre, the recreation and parks commission or its designee and the applicant shall determine whether a land or monetary donation shall be required" (C.C. 3318.03). The trigger is the REZONING, not the building permit — build within your existing district and this never arises. The residential formula is in the code and is not estimated here: proposed dwelling units × the U.S. Census median household size for the Columbus MSA (owner-occupied for single-family, renter-occupied for multifamily) ÷ 1,000 × 5.5 = the acreage to dedicate, the 5.5 being the city's stated goal of "5.5 acres of appropriate public parkland/open space for every 1,000 residents" (C.C. 3318.01, 3318.05). Payment in lieu is that acreage multiplied by an appraised fair market value per acre and falls due "at the time of final zoning clearance approval or plat approval" (C.C. 3318.11). Non-residential is a flat rate and it IS in the code: "For all commercial, industrial, and nonresidential institutional and ARO development, a fee shall be assessed of $400.00 per acre of land rezoned, or fraction thereof" (C.C. 3318.13). Credits run up to 50% for private outdoor recreation, with wet retention capped at 25% of the dedication (C.C. 3318.07), and two rezonings are waived outright — residential to residential with no density increase, and commercial to commercial (C.C. 3318.19(A), (B)). This chapter does not reach the 2024 Zoning Code: C.C. 3304.04(B) lists "3318: Parkland Dedication" among the Title 33 chapters that do not apply to it, which is why this row is written for Title 33 parcels only.`,
      })
    }

    // ABSENCE, unconditional, and the row a reader coming from Boston or
    // Philadelphia most needs. Same shape as Raleigh's and Austin's. It names
    // the four exceptions that DO carry a board, so it cannot be read as a
    // blanket "no review anywhere in Columbus".
    hurdles.push({
      category: 'review',
      label: 'Site plan review is administrative — no board, no hearing',
      status: 'info',
      note: 'Columbus reviews site plans through staff and the chief building official, not at a public hearing. Plans "shall be forwarded to other departments of the city for review through a site plan review process, if deemed necessary by the chief building official … These reviews include, but are not limited to, utility and stormwater management by the Department of Public Utilities; parking, traffic, and street encroachments by the Department of Public Service; and fire code compliance by the Department of Public Safety, Division of Fire. Once the chief building official is satisfied that the site plan has been approved by the chief plans official and that the work described in the application for a permit and the plans filed therewith conform to the requirements of this Building Code and other pertinent laws and ordinances, the chief building official shall issue a permit to the applicant" (C.C. 4113.29(A)). A certificate of zoning clearance is a precondition (C.C. 4113.29(C)). Project size is not on that list, so size alone never buys you a hearing — there is no Columbus analogue to Boston’s Article 80 or San Francisco’s Discretionary Review. Four things do put a board in front of you, and only four: a listed property or designated historic district (a certificate of appropriateness from the relevant architectural review commission, C.C. 3116.04), and the three mapped design-review areas — the Downtown District (C.C. 3359), the East Franklinton District (C.C. 3323) and the University Impact District (C.C. 3325; Title 34 § A.10.050). An area commission may also comment on a rezoning, variance or demolition, but its role is advisory rather than a decision.',
    })

    // CONJUNCTIVE: (a) the application is a rezoning, special permit, variance,
    // zoning appeal or DEMOLITION permit; AND (b) the property lies "wholly or
    // partly within" a commission area. Columbus has ~20 statutory commission
    // areas (C.C. 3111.02–3111.20) covering a large but not universal share of
    // the city; the boundaries are published (Schemas/Development/MapServer/12,
    // "Area Commissions") but the provider does not fetch that layer, so limb
    // (b) is stated, not gated — hence 'likely'.
    // No addsMonths: postponement is contingent, and the code sets no meeting
    // calendar for any commission.
    if (discretionary || teardown) {
      hurdles.push({
        category: 'review',
        label: 'Area commission review — advisory, but it can postpone you',
        status: 'likely',
        note: 'Rezonings, special permits, variances, zoning appeals and DEMOLITION permits are referred to the area commission for the area the property lies wholly or partly within (C.C. 3109.14, 3109.17(A)). The finding here is genuinely two-sided and both halves matter. The commission cannot stop you: "Suggestions and comments of the area commission shall be advisory only and failure of the applicant to comply therewith shall not in itself constitute grounds for denial of the application." But skipping it can cost you a cycle: "Failure of the applicant to consult the appropriate area commission in a timely manner, however, may be grounds for postponement of further action by other bodies" (C.C. 3109.15(B)), and so can the commission’s own silence — "Upon good cause shown, inability of the area commission to make a recommendation may be grounds for postponement of subsequent action by other bodies" (C.C. 3109.15(A)). Columbus has roughly twenty statutory commission areas (C.C. 3111.02 through 3111.20), covering a large but not universal share of the city; whether one covers this parcel is not in the parcel record, so check the area commission map before you set a hearing date. No months are added here because none are published — the code fixes no meeting calendar and no decision clock.',
      })
    }

    // Gated on data we actually hold, and the miss direction is safe: the
    // provider's layer 14 separates the three design-review areas from historic
    // designations (`designReviewFrom`), and `subdistrict` carries the
    // design-review label only when no historic district is also present. So a
    // parcel in BOTH renders the historic row instead of this one — a false
    // NEGATIVE, never a false positive.
    // No addsMonths: the 30-day appeal to City Council (C.C. 3359.05(E)) is a
    // third-party risk to price, not a step to schedule.
    if (colDesignReview) {
      hurdles.push({
        category: 'review',
        label: 'Design review district: certificate of appropriateness before any permit',
        status: 'required',
        note: `This parcel is in one of Columbus’s three mapped design-review areas — the Downtown District (C.C. 3359), the East Franklinton District (C.C. 3323), or the University Impact District Review Board’s jurisdiction (C.C. 3325; Title 34 § A.10.050) — where a certificate of appropriateness comes before the permit. The scope is wide: it is required for "Any exterior construction activity requiring a building permit, including new construction, reconstruction, expansion, alteration and rehabilitation of structures", for "Site work requiring a permit, such as installation of parking lots, plazas and similar improvements", for "Any activity requiring a demolition permit", and for "Any activity requiring a certificate of zoning clearance" (C.C. 3359.07(A)–(C)). The one clean exemption is interior work: "Building activity that is exclusively interior to a building does not require a certificate of appropriateness" (C.C. 3359.07(E)). The commission is not limited to saying yes or no — it "may impose reasonable requirements and conditions regarding the location, dimensions, character, access, building materials, and other features of the proposed uses or structures" (C.C. 3359.05(C)(1)). ${
          colCode === 'DD'
            ? 'In the Downtown District this is effectively the envelope, not a finish check: the DD chapter states no height limit and no FAR, so the design guidelines under C.C. 3359.15 — "building setback, height and composition, pedestrian entrances and access, screening and landscaping, graphics, parking and vehicular access" — are what actually decides how big the building is. '
            : ''
        }Budget for the third-party risk as well as the review: the commission’s decision is appealable to City Council by "any person directly affected … within 30 days after the date of the commission’s decision" (C.C. 3359.05(E)). No months are added here because Columbus publishes none — that 30 days is an appeal window, not a review duration.`,
      })
    }

    // ⚠️ AN OVERLAY POWER, NOT A CITYWIDE SCREEN. Unlike Minneapolis (§§ 599.910,
    // 599.920) or Nashville (T.C.A. § 7-51-1201), Columbus has no citywide age or
    // National-Register demolition trigger — the research looked for one across
    // Ch. 3116, Ch. 3120 and C.C. 4113.79 and did not find it. So this must
    // never be gated on `teardown` alone; every limb below is a mapped
    // condition the parcel record actually carries.
    if (
      teardown &&
      (!!parcel.overlays.historicDistrict ||
        colCode === 'DD' ||
        colCode === 'EFD' ||
        /downtown commission|east franklinton|architectural review|historic resources/i.test(colSub))
    ) {
      hurdles.push({
        category: 'demolition',
        label: 'Certificate of appropriateness before a demolition permit',
        status: 'required',
        note: 'Demolition here needs its own certificate before the permit can issue: "A certificate of appropriateness is required prior to the issuance of a demolition permit for any listed property served by the historic resources commission, or any property located in an area served by an architectural review commission as set out in Title 31, C.C. A certificate of appropriateness or a certificate of approval is required prior to the issuance of a demolition permit for any property located within the Downtown District, 3359 C.C., or the East Franklinton District, 3323 C.C." (C.C. 4113.79(B)). Removing an entire structure carries its own submittal set on top of the ordinary application — "definite plans for reuse of the site, evidence of commitment for funding of the new project, a timeframe for project initiation and completion and an assessment of the effect such plans will have on the character and integrity of the listed property or district" (C.C. 3116.14) — so the replacement project has to be financed and scheduled before the teardown is approved, not after. Two scheduling facts from the same section are unusual and worth pricing: a demolition permit in a residential area requires work to "commence within 14 calendar days after the issuance of the permit" and is "valid for a period of three calendar months renewable for no more than two additional three calendar month periods"; non-residential gets three months to commence and six months’ validity (C.C. 4113.79(A)). Utility releases are a precondition to the permit either way (C.C. 4113.79(C)). Note the limit of this row: Columbus’s demolition review is an overlay power, not a citywide screen — there is no age trigger and no National Register trigger reaching an ordinary parcel outside a designated district or the two design-review districts.',
      })
    }

    // THREE ALTERNATIVE THRESHOLDS and the code says "may". Only two are
    // gateable and one of those is narrowed:
    //  · residential 50 units — guarded by `isResidential`, because "residential:
    //    50 units" is a residential measure and `units` arrives off the query
    //    string independent of `use` (the same over-fire corrected in the
    //    Seattle SEPA and Minneapolis Table 550-1 rows).
    //  · other non-residential 30,000 sq ft — restricted to a WHOLLY
    //    non-residential project, because we hold no split of `gfa` and the
    //    section's own third limb is written for "other nonresidential
    //    (including mixed use Developments)". Same fix as Nashville's NDOT row.
    //  · retail/restaurant 20,000 sq ft — needs a use category we do not hold, so
    //    it is stated on the face of the note and not gated.
    if (project.projectType === 'new' && ((isResidential && units > 50) || (project.use === 'commercial' && project.gfa > 30000))) {
      hurdles.push({
        category: 'review',
        label: 'Off-site pedestrian infrastructure above 50 units',
        sizeDependent: true,
        status: 'likely',
        note: 'Above a published threshold Columbus can make the developer pay for sidewalk work beyond the site: "Additional off-site pedestrian infrastructure maybe required by the City if a Development exceeds any of the following thresholds: (1) residential: 50 units; (2) retail and/or restaurant uses: 20,000 square feet; or (3) other nonresidential (including mixed use Developments): 30,000 square feet" (C.C. 4309.08(B)). The three limbs are alternatives — clearing any one is enough — and the retail/restaurant limb turns on a use category not in this parcel record, so check it separately if your ground floor is retail or a restaurant. The word is "may", not "shall", which is why this is written as likely rather than required. The mechanism is the staff recommendation: "Favorable staff recommendations concerning approval of rezonings, zoning variances, or staff approval of special permit applications, preliminary subdivision plats, and Development plans are contingent, in part, upon assumption by the developer of financial responsibility for the necessary pedestrian infrastructure … The amount of pedestrian infrastructure required shall be roughly proportional to the Development’s contribution to the pedestrian traffic growth" (C.C. 4309.08(A)). What gets determined above the threshold is off-site sidewalk connections into the existing network, connections "to the nearest transit stop for each cardinal direction of travel in the vicinity of the site", and crosswalk adequacy (C.C. 4309.08(C)). The Director may waive on physical or environmental limitations or "gross inequity" (C.C. 4309.08(D)). Price the off-site construction, not the paperwork — that is where the money is.',
      })
    }

    // BOTH studies are conjunctive in ways we cannot evaluate. The Traffic
    // Impact Study keys on a trip-generation figure we do not compute; the
    // Traffic Access Study needs BOTH a site-modification criterion AND a
    // location criterion drawn from the Multimodal Thoroughfare Plan, the High
    // Crash Prioritization List / High Injury Network, or proximity to a
    // signalised intersection or roundabout — none of which we hold. So this is
    // 'info' with the numbers and the roadway limbs both named. Do NOT gate it
    // on a floor-area proxy: that is exactly the over-broad gate this file has
    // had to unwind elsewhere.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Traffic impact or access study — trip-driven, and not resolvable from the parcel record',
        status: 'info',
        note: 'Columbus screens traffic on trips and on road classification, neither of which is in this parcel record — so this is flagged rather than applied. A Traffic Impact Study is required for all new Developments, expansions, and rezoning, variance, special-permit and preliminary-plat applications "if the Memorandum of Understanding demonstrates the traffic generated by the following results in 200 or more estimated non-pass-by trip ends at the peak hour of the land use" (C.C. 4309.05(A)), and may be required at 100 or more trip ends at a single adjacent intersection (C.C. 4309.05(B)). A Traffic Access Study is separately conjunctive: it "may be required if the Development meets one or more of the following site modification criteria AND meets one or more of the following location criteria" (C.C. 4309.06(B)) — the site-modification criteria are new construction, expansion, or a change of use producing a significant trip change; the location criteria are a Columbus Multimodal Thoroughfare Plan Roadway, a road on the High Crash Prioritization List or the High Injury Network, an arterial or collector off the Thoroughfare Plan, or a collector or local road near a signalised intersection or roundabout. Get a trip-generation estimate early, because the cost is the mitigation and not the study: approval recommendations "are contingent, in part, upon assumption by the developer of financial responsibility for the necessary roadway infrastructure as defined in the Traffic Impact Study or Traffic Access Study. The amount of roadway infrastructure required shall be roughly proportional to the Development’s contribution to traffic growth within the limits of the Traffic Impact or Access Study at the study’s Design Year" (C.C. 4309.07(A)). The performance standard you are being measured against is a "Satisfactory Level of Service" — LOS D overall and LOS E per movement (C.C. 4309.03).',
      })
    }

    // CONJUNCTIVE: the lot must be RESIDENTIALLY ZONED and the parcel must be
    // Title 33 (C.C. 3304.04(D) puts "3321: General Site Development Standards"
    // on the list of chapters that do not apply to the 2024 Zoning Code).
    // ⚠️ DELIBERATELY 'likely', NOT 'required', and the reason is the gate. The
    // section reads "On a residentially zoned LOT" — a fact about the parcel's
    // zoning district, not about the proposed use. We hold `districtCode` but no
    // verified list of Columbus's Title 33 residential districts, and inventing
    // one would be a legal claim assembled here rather than read. `isResidential`
    // is the project's USE, which is a proxy: apartments in a C-4 commercial
    // district are common in Columbus and would not be on a residentially zoned
    // lot. So the limb is quoted on the face of the note and the status is
    // softened, rather than gating a 'required' on a proxy.
    // NOT sizeDependent: no threshold — one tree is required from the first
    // dwelling unit; only the count scales.
    if (isResidential && !colTitle34) {
      hurdles.push({
        category: 'environmental',
        label: 'On-lot tree requirement (Title 33 residentially zoned lots)',
        status: 'likely',
        note: 'Columbus requires trees on the lot itself, and there is no size below which it lapses: "On a residentially zoned lot, a minimum of one tree, subject to minimum size requirements in General Landscaping Standards, is required on-lot for every ten (10) dwelling units or fraction thereof. No other code-required trees may satisfy this requirement. A minimum of one tree is required on each lot containing one to ten dwelling units, a minimum of two trees are required on each lot containing 11 to 20 dwelling units, and so on" (C.C. 3321.07(B)). Read the first six words carefully: the trigger is that the LOT is residentially zoned, which is a fact about the zoning district rather than about what you intend to build — a residential project on a commercially zoned lot is outside this section, and this tool holds no verified list of Columbus’s residential districts to check it against, so confirm the district designation. Sizes are specified and are not negotiable at planting: two-inch caliper for deciduous, 1.5-inch for ornamental, four feet for conifers (C.C. 3321.13(C)), and anything that dies must be replaced (C.C. 3321.13(D)). One neighbouring standard in the same chapter is worth budgeting alongside it: where a newly-rezoned non-residential lot abuts residential zoning, screening five feet high at 75% opacity is required within twenty feet of the shared line and must be installed within nine months of occupancy (C.C. 3321.09(A)–(C)). This chapter does not reach the 2024 Zoning Code — C.C. 3304.04(D) lists "3321: General Site Development Standards" among the Title 33 chapters that do not apply to it. And note what this row does NOT say: it does not say Columbus has no tree-preservation ordinance. Chapter 3321 is a landscaping chapter, and no slot test for a preservation ordinance was run across the rest of the code, so that is an open question rather than a stated absence.',
      })
    }

    // A SECOND gate on top of the shared FEMA row, and it names a different
    // authority: the determination is the Department of Public Utilities' under
    // C.C. Chapter 1150 — the CITY's floodplain mapping, not the FEMA zone. Only
    // 4113.29(B) was read; the row asserts nothing about ch. 1150's substantive
    // standards, because ch. 1150 was not read.
    if (fz && !FLOOD_OK.has(fz.toUpperCase())) {
      hurdles.push({
        category: 'flood',
        label: 'City floodplain determination gates the permit',
        status: 'likely',
        note: `This parcel is in FEMA flood zone ${fz}, and in Columbus a flood-zone parcel needs a separate written determination before any permit can issue — the building official has no discretion to proceed without it: "The chief building official shall in no case grant any permit for the construction, alteration, or use of any building, structure or premises in the flood plain, as determined by the Department of Public Utilities under Chapter 1150 without a copy of the appropriate decision issued to the applicant, stating that said building, structure or premises, as proposed to be constructed, altered, or used, would not be in violation of Chapter 1150 or any rule or regulation established by the Department of Public Utilities to enforce Chapter 1150" (C.C. 4113.29(B)). Note who decides and against what: the determination is the Department of Public Utilities’ under Chapter 1150, which is the CITY’s own floodplain mapping and standards, not the FEMA zone — so confirm the local mapping rather than reading the federal zone as the answer. What Chapter 1150 substantively requires is not stated here; only C.C. 4113.29(B) was read for this row, and the chapter itself was not.`,
      })
    }

    // CONJUNCTIVE: (a) a certificate of zoning clearance "for newly constructed
    // parking lots or parking structures received on or after the effective date
    // of January 1, 2024" AND (b) parking is actually being built. We do not
    // model whether a project builds parking, so limb (b) is on the face of the
    // note. On a Title 34 parcel the code is explicit that (b) is the operative
    // question — 3312.55(B).
    // NOT sizeDependent: the requirement applies at every size for residential;
    // only the ratio changes across the 1–3 / 4+ unit bands, and there is no
    // threshold below which it lapses. (The table's 50-space minimum belongs to
    // the office/workplace row, not to dwellings.)
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'EV-ready and EV-charging parking',
        status: 'likely',
        note: 'If this project builds any parking, it has to be wired for electric vehicles. The requirement attaches to a certificate of zoning clearance for newly constructed parking lots or parking structures received on or after January 1, 2024 — so it turns on whether you build parking, not on how big the building is, and this tool does not model that. Removing the parking minimum does not remove this: "For parcels with a 2024 Zoning Code district designation, vehicular parking is not required; however, if vehicular parking is provided then the requirements provided for in Sections 3312.55 through 3312.58 must be followed" (C.C. 3312.55(B)). The current ratios are in the C.C. 3312.57 table: "1, 2, or 3 dwelling units … One EV Ready outlet per dwelling unit"; and for "4 or more dwelling units | Market-rate multi-unit residential buildings; standalone surface lots and parking structures", EV Capable 20% and EVSE Installed 2%. The table also notes that "Parcels within Special Parking Districts are included". Real exemptions exist and they map to a program rather than to a size: very low income housing where 50% or more of the units serve households at or below 50% AMI, permanent supportive housing, transitional housing, and detached private garages and carports serving one- to three-unit dwellings (C.C. 3312.55(C)). One scheduling note without a number attached: a second, stricter table takes effect January 1, 2028 (C.C. 3312.58) — no figures from it are quoted here, and it is not the rule in force today.',
      })
    }
  } else if (city === 'charlotte') {
    // Charlotte UDO Article 19, read 2026-08-08 from charlotteudo.org. Source
    // note and the measured column mapping for Table 19-1 are in
    // PARKING_RULES['charlotte'].
    //
    // ⚠️ THE "OPEN GAP" THIS HEADER USED TO RECORD IS CLOSED, and the old
    // sentence is retracted here rather than left to be discovered (rule 17).
    // It said a reported North Carolina statewide preemption had a session-law
    // citation that "never reached this repo". It has: per
    // research/charlotte.parking.md, read at ncleg.gov 2026-08-08, the enacted
    // vehicle is Session Law 2026-39 (House Bill 162), ratified 1 July 2026 and
    // approved 6 July 2026. Two consequences, and they point in different
    // directions:
    //   · The STORMWATER limb — G.S. 143-214.7(b3), rewritten by § 2.(a) — is
    //     effective on enactment and is encoded below in the redevelopment
    //     credit row, which is why a Charlotte hurdle now legitimately says
    //     "Session Law".
    //   · The PARKING limb — G.S. 160D-702(c)(2a), barring local minimum-space
    //     requirements — is NOT yet in force (effective 2027-01-01 on the live
    //     text), so nothing in the parking rows above is changed by it and
    //     nothing here asserts it. `PARKING_RULES['charlotte'].detail` still
    //     predates the finding and reads as though the tiered minimums are
    //     permanent; that entry is deliberately untouched by this splice rather
    //     than edited from two places at once.
    // And the bill everyone cites, House Bill 369 ("Parking Lot Reform and
    // Modernization Act"), NEVER PASSED — its last action is a re-referral to
    // Senate Rules on 6/10/2026. Cite the enacted vehicle or say nothing.
    const cltCode = parseCharlotteZone(parcel.zoning.districtCode).code
    const cltTier = cltCode ? (CLT_PARKING_TIER[cltCode] ?? null) : null
    // The erosion-control threshold is ONE ACRE of land disturbance (Sec. 28.2).
    // Lot area is an explicit proxy for it — see the note on that row.
    const CLT_ACRE = 43560

    if (isResidential && cltTier === 3) {
      hurdles.push({
        category: 'parking',
        label: 'Tier 3 district: no residential parking minimum unless within 400 feet of a Neighborhood 1 Place Type',
        status: 'info',
        note: `This parcel's district (${cltCode}) is a Tier 3 district, where the UDO says “A minimum number of off-street parking spaces are required for a limited number of uses and locations, but most uses do not have a minimum parking requirement” (Charlotte UDO Sec. 19.2.A.1.c), and “Where a cell is blank and shaded, no minimum and/or maximum parking is required” (Sec. 19.2.A.3). Measured rather than paraphrased: the Tier 3 Minimum column of Table 19-1 is blank in 99 of the 105 use rows. The six that carry a minimum are Multi-Family Attached (units not on sublots), Multi-Family Stacked, Live Performance Venue–Indoor, Micro-Production of Alcohol, Nightclub and Restaurant/Bar — so two of the six are housing types, and if your program is one of them the whole condition matters: that column's header reads “Minimum / Applies only when within 400' walking distance of a Neighborhood 1 Place Type”. Walking distance to a Place Type is not in the parcel record and is not a straight-line measurement, so this is stated rather than applied. A stacked-apartment building here owes 1 space per unit only if that 400-foot condition holds, and nothing otherwise. The maximum applies either way — 1 space per bedroom for studio and per-bedroom counting on Multi-Family Stacked, 2 per unit for residential generally.`,
      })
    } else if (isResidential && (cltTier === 1 || cltTier === 2)) {
      hurdles.push({
        category: 'parking',
        label: `Tier ${cltTier} district: 1 off-street space per dwelling unit`,
        status: 'required',
        note: `This parcel's district (${cltCode}) is a Tier ${cltTier} district under Charlotte UDO Table 19-1, and residential use carries a minimum of 1 space per dwelling unit. ${
          cltTier === 1
            ? 'Tier 1 is minimums only — “A minimum number of off-street parking spaces are required. There are no off-street parking space maximums” (Sec. 19.2.A.1.a), which the table states independently: the Tier 1 Maximum column is empty in all 105 use rows.'
            : 'Tier 2 sets both ends — “A minimum number of off-street parking spaces are required. There are also off-street parking space maximums” (Sec. 19.2.A.1.b) — with a residential maximum of 2 spaces per unit, and 1 per bedroom for Multi-Family Stacked.'
        } Multi-Family Stacked is the row to check if you are building apartments: it is ${
          cltTier === 1 ? '1.5 spaces per unit in Tier 1, dropping to 0.25 per unit for senior housing' : '1 space per unit in Tier 2'
        }, not the generic residential figure. The relief routes below can move this — in particular, a half-mile walk to rapid transit lets you elect Tier 3 outright.`,
      })
    }

    // Both relief routes, always stated: neither is gateable from the parcel
    // record, and the second is the one most likely to change the answer.
    hurdles.push({
      category: 'parking',
      label: 'Two routes out of the tier minimums (transit election; demand-management assessment)',
      status: 'info',
      note: 'Charlotte publishes two ways off the tier it maps you into, and the first is an election rather than a discretionary favour. Sec. 19.2.H: “Any property within one-half mile walking distance of an existing rapid transit station may use the Tier 3 parking standards, unless the property is located in a Neighborhood 1 Place Type. If Tier 3 parking standards are used, such standards shall be used in their entirety, including any applicable parking minimums and maximums.” Read the whole clause — it is all-or-nothing, and it brings the Tier 3 MAXIMUMS across with it, so a project that wanted a low minimum and a high space count cannot take half of it. The second route is discretionary: “Tier 3 required parking minimums may be reduced or eliminated upon Planning Director approval of a Parking Demand Management Assessment, as described in the Charlotte Streets Manual” (Sec. 19.2.A.1.c.i). Neither walking distance to a rapid transit station nor the Place Type mapping is in the parcel record, so both are stated rather than applied; both are worth checking before you size a deck.',
    })

    // ─── Beyond parking (2026-08-08). Charlotte UDO read live at
    // charlotteudo.org (article index → article page), plus ncleg.gov for
    // N.C. Gen. Stat. § 42-14.1, § 162A-213 and Session Law 2026-39.
    //
    // NO `addsMonths` ON ANY ROW BELOW. Charlotte publishes exactly three
    // durations and all three are the wrong kind: the HDC's 180-day outer limit
    // (Sec. 14.2.L.6.a.i) is a ceiling, the erosion-plan 30 days (Sec. 28.4) is
    // a decision shot clock on the Stormwater Administrator, and the Planning
    // Commission's 30 days (Sec. 37.2.K.4) is a deemed-favourable deadline on a
    // board. Same call, same reasoning, as Raleigh's refusal to write 6 for its
    // 180-day COA limit.

    // ── Affordability ──────────────────────────────────────────────────────
    // ABSENCE, and the headline for Charlotte — but a DIFFERENT absence from
    // Nashville's, and the difference is the whole point. Tennessee bans
    // mandatory inclusionary zoning by name (Tenn. Code Ann. § 66-35-102(b)).
    // North Carolina does NOT: no NC statute names inclusionary zoning at all.
    // So what is recorded is what can be checked — the UDO's own structure, and
    // § 42-14.1's actual words. "State law bars mandatory inclusionary zoning"
    // is the one sentence this row must not contain (rule 1). Identical
    // treatment to the Raleigh row, on the same statute.
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'No inclusionary requirement — affordability buys height, nothing more',
        status: 'info',
        note: 'The Charlotte UDO sets no affordable-unit requirement at any project size — there is no unit count and no floor area at which income-restricted units become compulsory, and no fee in lieu. Every affordability obligation in the ordinance hangs off something the developer elects. The first is the bonus menu: “Additional building height or a reduction in required on-site open space shall be allowed through a voluntary bonus system” (Charlotte UDO Sec. 16.3.A), available “To achieve the ‘Maximum Height with Bonus’ standard or to reduce the required open space within the UE, RAC, CAC-1, CAC-2, NC, IMU, TOD-UC, TOD-CC, TOD-NC, TOD-TR, N2-C, CG, CR, IC-1, IC-2, OFC, OG, and RC Zoning Districts” (Sec. 16.3). The exchange rate is stated: Table 16-1 gives “3 points for every 1% of gross floor area of affordable housing, up to 15 points total - Where an average of 80% Area Median Income (AMI) or less, with up to 20% of the affordable units set aside for households earning above 80% up to 110% AMI / 5 points for every 1% of gross floor area of affordable housing, up to 25 points total - Where an average of 60% Area Median Income (AMI) or less”, and “one point is required for one foot of additional building height” (Sec. 16.3.B.1.b). The second is a separate development-ALLOWANCE track with published thresholds — “1. Affordability period: 30 years / 2. Minimum units of affordable housing: Five units / 3. Percentage of development (one of the following): a. 15% at 60% AMI; or b. 30% at 80% AMI; or c. 20% at 80% AMI in areas of high housing cost per the UDO Zoning Administration Manual” (Sec. 16.4.A) — which buys the next district’s standards, street waivers, Tier 1 green-area credits and tree-mitigation relief. Build within base zoning and none of it arises. On the state-law backdrop, note carefully what is and is not settled: N.C. Gen. Stat. § 42-14.1(a) provides that “No county or city as defined by G.S. 160A-1 may enact, maintain, or enforce any ordinance or resolution which regulates the amount of rent to be charged for privately owned, single-family or multiple unit residential or commercial rental property”, and § 42-14.1(c)(4) excepts ordinances “applicable to owners or operators that receive funding or financial incentives from the county or city” — which is exactly the shape Charlotte’s bonus commitments take. North Carolina has no statute naming inclusionary zoning, and unlike Tennessee has not prohibited it by name, so treat this as a rule Charlotte has not adopted rather than one the State has forbidden.',
      })
    }

    // ── Review: the structural advantage, and the row a reader arriving from
    // Boston or Philadelphia most needs. Established by the SLOT TEST, not by a
    // failed search: Article 35 enumerates the ordinance's COMPLETE roster of
    // decision bodies (35.1 City Council, 35.2 Planning Commission, 35.3 UDO
    // Board of Adjustment, 35.4 Historic District Commission, 35.5 Alternative
    // Compliance Review Board) and there is no design-review board and no
    // site-plan-approving body in the list.
    hurdles.push({
      category: 'review',
      label: 'Plan review is administrative — no design board, no site-plan hearing',
      status: 'info',
      note: 'Charlotte approves development plans over the counter, and the ordinance’s treatment of it is two sentences long — the brevity is the finding: “Development review and approval is intended to ensure that the development meets the requirements of this Ordinance. Development review and approval shall follow procedures and practices established by the City, this Ordinance, and other ordinances as applicable” (Charlotte UDO Sec. 37.9). There is no design-review board and no site-plan-approving body anywhere in the ordinance. Article 35 lists the complete roster of decision bodies — City Council (Sec. 35.1), the Planning Commission (35.2), the UDO Board of Adjustment (35.3), the Historic District Commission (35.4) and the Alternative Compliance Review Board (35.5) — and the Planning Commission’s powers are confined “To initiate, review, and make recommendations to the City Council regarding UDO amendments and zoning map amendments” (Sec. 35.2.A.1), which says nothing about plans. The only quasi-judicial evidentiary hearings in the whole ordinance belong to the Board of Adjustment on variances and appeals (Sec. 37.8), the Historic District Commission on certificates of appropriateness (Sec. 14.2.L.6.b), and the Alternative Compliance Review Board (Sec. 37.10.D). That last one is worth knowing about because it is an OPT-IN route rather than a gate: “Alternative compliance may be used for the following standards: (1) minimum building height, (2) building articulation, (3) transparency, (4) site layout, (5) building design, (6) design of parking decks, (7) landscape and screening, and (8) surface parking” (Sec. 37.10.C). It cannot be used to get a use — the Board “has no jurisdiction with respect to alternative compliance which: (1) would allow the establishment of a use that is not otherwise permitted in the zoning district” (Sec. 37.10.B.1). There is no Charlotte analogue to Boston’s Article 80, San Francisco’s Discretionary Review or Philadelphia’s Civic Design Review: project size alone never buys you a hearing here.',
    })

    // A real two-agency handoff — City land-development approval, then COUNTY
    // building permit and CO — that no other city in this registry has in this
    // form. It is also the reason the permit-timing answer for Charlotte is
    // what it is.
    hurdles.push({
      category: 'review',
      label: 'Building permits come from Mecklenburg County, not the City',
      status: 'info',
      note: 'Zoning and land-development approval is the City’s; the building permit and the certificate of occupancy are the County’s. The UDO says so in the places where it reaches for enforcement: “The Mecklenburg County Land Use and Environmental Services Agency, on its own authority or as directed by the Planning Director, shall revoke and require the return of any building permit by notifying the permit holder in writing stating the reason for the revocation” (Charlotte UDO Sec. 14.2.S.1), and “As stated in the Mecklenburg County Building Ordinance, Certificates of Compliance and Occupancy, the Mecklenburg County Land Use and Environmental Services Agency … shall not issue a Certificate of Occupancy or Certificate of Compliance unless there has been compliance with any Certificate of Appropriateness issued by the Historic District Commission” (Sec. 14.2.T.1). Plan for two agencies with two queues and two sets of comments, and for a City-side condition that is enforced at the County counter — the certificate of occupancy is where a missed City approval surfaces, which is the most expensive place to find one.',
    })

    // ── Fees. No floor-area or unit threshold at all, so no sizeDependent tag:
    // the fee scales with METER SIZE, which is neither a unit count nor a floor
    // area. The gate is that the project is new construction (a new connection).
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'fees',
        label: 'Water and sewer system development fees',
        status: 'required',
        note: 'A new water or sewer connection carries a system development fee, and North Carolina fixes when it is collected: “For new development involving the subdivision of land, the system development fee shall be collected by a local governmental unit at the later of either of the following: (1) The time of application for a building permit. (2) When water or sewer service is committed by the local governmental unit” (N.C. Gen. Stat. § 162A-213(a)). The statute also anticipates exactly Charlotte’s split between Charlotte Water and the Mecklenburg County permit counter: where the unit charging the fee is not the unit issuing the building permit, “the local governmental unit issuing the building permit shall require proof of collection of the system development fee prior to issuance of the building permit” (§ 162A-213(c)). There is no size threshold and no small-project exemption; what the fee scales with is METER SIZE, not units or floor area. The amounts are in no ordinance and must not be treated as stable — Council resets them each fiscal year on the City’s published Rates & Fees schedule. For scale only, read live from that schedule on 2026-08-08: a 5/8" domestic meter carried a $4,407 water connection fee, a $1,453 water system development fee and a $5,066 sewer system development fee, while a 2" meter carried $11,622 water and $40,525 sewer. Get the current schedule from Charlotte Water before you underwrite rather than relying on those figures or on any prior year’s. Separately, and deliberately: no impact-fee row appears here. The phrase “impact fee” occurs nowhere in the UDO and Charlotte has no Raleigh-style facility-fee article, but the zoning ordinance is not the whole City Code — that is a gap in what has been read, not a finding that no such fee exists. Treat this row as silent on impact fees rather than as an answer in either direction.',
      })
    }

    // ── Transportation. The threshold lives in an adopted manual, not in the
    // ordinance, so no unit or square-foot figure is stated — same treatment as
    // Raleigh's Sec. 8.2.2 row, whose thresholds sit in the Street Design
    // Manual. Stating a number here would be inventing one.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Comprehensive Transportation Review (CTR)',
        status: 'likely',
        note: 'Charlotte requires a Comprehensive Transportation Review above thresholds the UDO does not contain: “The CTR, including specific thresholds and requirements, is included in the Charlotte Streets Manual (Streets Manual). A CTR is required for any development project that meets or exceeds any specified threshold. The developer shall procure the CTR at their own expense, and the CTR shall satisfy all applicable requirements” (Charlotte UDO Sec. 32.1.B). The review has three components — “Multimodal Assessments, Transportation Demand Management (TDM), and Traffic Impact Studies (TIS)” (Sec. 32.1.A). No unit count or floor area is asserted here because the ordinance states none; the trigger is in the adopted Streets Manual, so ask Charlotte Department of Transportation early rather than sizing against a guessed number. The cost is the mitigation, not the study: “Based on the results or recommendations of a CTR, the developer shall provide any required mitigation” (Sec. 32.1.C).',
      })
    }

    // CONJUNCTIVE, and the row most likely to be got wrong. Sec. 32.4.C.1.a
    // requires a NEW stop only where the project meets ALL of a route-frontage
    // limb and a daily-trip limb — we hold no transit-route frontage and compute
    // no ITE trip generation, so neither is gateable. 'info' with both limbs
    // quoted, never a gate on a proxy. The SECOND limb of the section (retain an
    // existing stop) IS resolvable on project type and is stated in the same row.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Bus stop and amenities, or retention of an existing one',
        status: 'info',
        note: 'Two different obligations live in Sec. 32.4 and only one of them is conditional on data we hold. A NEW stop is required only where the project “meets all the following: i. The development is located along a bus route as indicated on an MTC adopted Transit Service Plan, and / ii. The development will generate the minimum number of daily trips which meet a threshold in Table 32-1.1 below” (Charlotte UDO Sec. 32.4.C.1.a). Both limbs must hold, and neither is in the parcel record — we carry no bus-route frontage and compute no ITE trip generation — so this is stated rather than applied. Table 32-1.1’s own bands are “At least 50 but less than 250 Daily Trips”, “At least 250 but less than 500”, “At least 500 but less than 1,000” and “1,000 or more”, so the requirement scales with the trip figure once you clear the first band. The RETENTION duty is the one that reaches an ordinary project: it applies to “Construction of a new principal structure on a site with existing CATS bus stop(s) and amenities, either on the subject development site or in the rights-of-way adjacent to the subject development site, except for construction of a new single-family, duplex, triplex, and quadraplex structure, unless part of a multi-dwelling development” (Sec. 32.4.B.1). Read the exception twice — the small-building carve-out is itself carved back for multi-dwelling developments, so a quadraplex inside a larger scheme is caught. Where a stop is already there it must be retained and brought to ADA compliance, and “No relocation, modification, or removal of existing CATS bus stop(s) and amenities shall occur unless approved by the CATS Director” (Sec. 32.4.B.2.b) — that approval is a schedule item, not a formality.',
      })
    }

    // Unconditional on new construction — what varies is WHICH streets, and that
    // comes from the Charlotte Streets Map and Article 31, neither of which we
    // hold. NOT sizeDependent: the gate is project type, not a size. The
    // 125-unit collector limb is quoted inside rather than used as the gate,
    // because it ALSO requires an arterial intersection (conjunctive at the top,
    // disjunctive underneath).
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'New streets, dedications and off-street public paths',
        status: 'likely',
        note: 'Building a new principal structure in Charlotte can oblige you to build street: “New streets are required when either of the following occur: 1. Subdivision as defined by Section 30.3.A. 2. Construction of a new principal structure” (Charlotte UDO Sec. 32.5.A). That trigger is unconditional on new construction; what varies is which streets, and the answer comes from the Charlotte Streets Map and Article 31 rather than from anything in the parcel record — so the extent is a lookup, not a guess. The expensive limb to check is the collector: a new street must be built and dedicated as a collector where “The street directly intersects with an arterial and provides access to an area with: i. An overall density of one residential lot per acre; or ii. More than 125 residential lots; or iii. More than 125 dwelling units” (Sec. 32.5.E.2.a) — conjunctive at the top, so the arterial intersection has to hold as well as one of the three. Right-of-way for mapped limited-access roads and arterials is also reservable: it “shall be reserved for 18 months beginning when land development approval is obtained” (Sec. 32.5.C.1), and if the agency has neither contracted to purchase nor begun condemnation in that window “the developer may consider the land free of any reservation” — a hold on part of your site with a published end date. Off-street public paths ride along with all of it: they are required on “Construction of a new principal structure, except for construction of a new single-family, duplex, triplex, or quadraplex structure” (Sec. 32.6.A).',
      })
    }

    // ── Green area. sizeDependent: true because the STATUS turns on a unit
    // count, which in this codebase is derived from gfa. Charlotte's gfaBasis is
    // 'assumed-unconstrained' (the UDO imposes no FAR — zoning/charlotte.ts
    // FACT 1), so softenSizeDependent will not downgrade it; the tag is still
    // correct and is set.
    //
    // The exemption is the conjunctive part. Sec. 20.15.A.3.b exempts small
    // residential UNLESS one of three things is also true, and two of the three
    // (lot configuration, membership in a subdivision approval) are not in our
    // data. A project over four units cannot be inside the exemption at all,
    // which is where the status splits; at or below four it may or may not bite,
    // so the row stays 'likely' and says why.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'Green area: 15% of the site, plus a tree compliance plan',
        sizeDependent: true,
        status: units > 4 || !isResidential ? 'required' : 'likely',
        note: `Charlotte budgets green area on the finished site rather than merely protecting what is there: “15% or more of a development site that is subject to the applicability of this section shall be green area to be credited as provided for in Table 20-5 Green Area Credits” (Charlotte UDO Sec. 20.15.C). Applicability is broad — the requirements apply “whenever development would result in any of the following: a. New construction of a principal structure. b. Cumulative increase in built-upon area (BUA) or building coverage equal to or greater than 5% or 1,000 square feet, whichever is less. c. Approval of a standard subdivision as defined by Section 30.3.A or approval of a minor subdivision as defined by Section 30.3.D” (Sec. 20.15.A.1). The percentage is not measured on the deed area: rights-of-way, railroad rights-of-way, utility easements and existing ponds and lakes come off the site area first (Sec. 20.15.D.4.a), and the credits are multiplier-weighted by a four-tier Place Type assignment (Table 20-4), so what actually satisfies 15% depends on where you are and what you plant. Full compliance is owed by “Development activity that cumulatively impacts 75% or more of a site” (Sec. 20.15.A.2.a), with proportional compliance below that where an existing principal building is retained. ${
          units > 4 || !isResidential
            ? 'The small-residential exemption cannot reach this project: Sec. 20.15.A.3.b exempts only “Construction of a new single-family detached home, duplex, triplex, or quadraplex as a principal structure on a single lot”, and this project is outside that description.'
            : 'Whether the small-residential exemption reaches this project is not decidable from the parcel record, so treat it as conditional. Sec. 20.15.A.3.b exempts “Construction of a new single-family detached home, duplex, triplex, or quadraplex as a principal structure on a single lot, unless such construction is any of the following: i. Part of an approval of a new standard subdivision as defined by Section 30.3.A or approval of a minor subdivision as defined by Section 30.3.D, ii. Constructed on three or more contiguous/adjacent lots, or iii. Part of a multi-dwelling development.” The exception has three limbs and two of them turn on lot configuration and on whether the build sits inside a larger scheme — neither is in our data. Confirm which side of it you are on before pricing the site.'
        } Either way the paperwork gate is separate and unconditional: “All applications for land development approval subject to the applicability of Section 20.15, Section 20.16, and Section 20.17 shall be required to submit to the Planning Department a tree compliance plan which shall include a tree survey, a tree and critical root zone protection plan, and tree planting and green area plan” (Sec. 20.18.A.2). One related option rather than a separate exaction: where a district requires on-site open space, the district articles let it “be provided as land dedicated to Mecklenburg County Park and Recreation, a fee-in-lieu provided to Mecklenburg County Park and Recreation, or a combination thereof” (e.g. Sec. 4.4.A.4) — an alternative means of complying with a zoning dimensional standard, with the amount set by the County outside the UDO.`,
      })
    }

    // Note the asymmetry with green area, and that it is real: Sec. 20.14.A has
    // NO exemption for small residential construction. A single new house on a
    // single lot is inside this one.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'Heritage trees: permit, replanting and a mitigation payment',
        status: 'required',
        note: 'A heritage tree is a specific, checkable thing — “Any tree native to North Carolina per the US Department of Agriculture Natural Resource Conservation Service Plants Database with a DBH of 30 inches or greater” (Charlotte UDO Article 2, definitions) — and removing one is permitted work with a price attached: “Heritage trees may be removed when a City-issued tree work permit is requested and approved… No removal activities shall commence until such permit is issued, any applicable mitigation payments have been received, and a planting plan has been approved… For purposes of this subsection, a development plan approved by the City constitutes a tree work permit” (Sec. 20.14.B.1). The cost has two parts: “a. Required Tree Replanting — One tree shall be planted on the property in mitigation pursuant to the Charlotte Tree Manual. Trees replanted to meet this mitigation requirement shall be in addition to other trees required by this article. b. Heritage Tree Mitigation Payment — A heritage tree mitigation payment shall be required for every heritage tree removed per the fee established by City Council” (Sec. 20.14.B.3). No dollar figure is stated here because the ordinance states none — the fee is set by Council. Note the asymmetry with the green-area requirement above, because it is real and easy to miss: Sec. 20.14.A applies “whenever development would result in any of the following: 1. New construction of a principal structure. 2. Cumulative increase in built-upon area (BUA) or building coverage equal to or greater than 5% or 1,000 square feet, whichever is less. 3. Approval of a standard subdivision as defined by Section 30.3.A or approval of a minor subdivision as defined by Section 30.3.D”, and it carries NO small-residential exemption at all. One new detached house is inside it. A project taking the Sec. 16.4.A affordable-housing development allowance gets relief in kind rather than cash — Sec. 16.4.B.5 allows “planting of twice the number of required mitigation trees … in lieu of the mitigation fee.” Survey the trees before you price the site: a mature canopy is a line item here, not a landscaping preference.',
      })
    }

    // A CONJUNCTIVE EXEMPTION, which inverts to a DISJUNCTIVE requirement — and
    // neither limb is in our data. Sec. 25.2.A.1.d joins "disturbs less than one
    // acre" and "creates less than 5,000 sq ft of new BUA" with "and", so the
    // permit is owed whenever EITHER is exceeded. We hold neither disturbance
    // area nor built-upon area; lot area bounds neither. So this stays 'likely'
    // and says so on its face rather than gating on lot size.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'Stormwater management permit and the Catawba/Yadkin density standards',
        status: 'likely',
        note: 'The starting position is universal — “All development and redevelopment shall require a Stormwater Management Permit unless exempted below” (Charlotte UDO Sec. 25.2.A) — and the exemption that matters is written conjunctively: “Development and redevelopment that cumulatively disturbs less than one acre and cumulatively creates less than 5,000 square feet of new built-upon area (BUA)” (Sec. 25.2.A.1.d). Because its two limbs are joined by “and”, the permit is owed whenever EITHER an acre is disturbed OR 5,000 sq ft of new built-upon area is created — clearing one limb is not enough. Neither figure is in the parcel record: we hold lot area, which bounds neither disturbance nor built-upon area, so this row is stated rather than applied. (A second exemption at Sec. 25.2.A.1.e covers “Residential development and redevelopment on an individual lot recorded prior to July 1, 2008 and less than 20,000 square feet”.) What the permit costs you depends on which watershed district the parcel sits in, and the density break differs threefold across the city: low density is “less than or equal to 24% BUA” in the Central Catawba, “less than or equal to 12% built-upon area” in the Western Catawba, and “less than or equal to 10% BUA” in the Yadkin-Southeast Catawba (Sec. 25.3.C–F). Above the break, treatment is mandatory rather than optional. The watershed district is on the City’s Watershed Districts layer, which this tool does not fetch — look it up rather than assuming the least restrictive number, because on a compact urban parcel a 10% cap is the constraint that binds first. Two neighbours to check at the same time: Article 23 imposes water-supply-watershed BUA caps in the lake watersheds, and Six Mile Creek carries “200-foot undisturbed buffers, plus entire FEMA floodplain” on perennial streams (Sec. 25.3.F.1.b.iii).',
      })
    }

    // LOT AREA IS AN EXPLICIT PROXY here, exactly as in Raleigh's 12,000 sq ft
    // row: the ordinance measures DISTURBED area, and a large parcel with a
    // small disturbance footprint sits below the line. The note says so. NOT
    // sizeDependent — no floor area or unit count is in the trigger. And no
    // addsMonths: Sec. 28.4's 30 days is a decision clock on the reviewer.
    if (project.projectType === 'new' && lotSqFt > CLT_ACRE) {
      hurdles.push({
        category: 'environmental',
        label: 'Erosion and sedimentation control plan (one acre)',
        status: 'likely',
        note: 'At an acre of disturbance the erosion plan becomes a scheduling item: “No person shall initiate any land-disturbing activity on a tract if one acre or more is to be disturbed unless a plan for that activity has been submitted and approved in accordance with Section 28.4” (Charlotte UDO Secs. 28.2, 28.3.D.5). The reviewer is clocked, not you — “The Stormwater Administrator shall review each complete plan submitted and within 30 days of receipt thereof shall notify the applicant, that it has been approved, approved with modifications, or disapproved” (Sec. 28.4) — which is why no months are added to this project’s timeline for it. There is also a notice step at the start of work: “If one acre or more is to be uncovered, the person conducting land-disturbing activity … shall contact the Stormwater Administrator at least 48 hours before commencement” (Sec. 28.3.D.6). The same acre brings a state permit with it — an NCG01 certificate of coverage under the construction general permit (Sec. 28.5.A.1.a). Note the unit, because it decides whether this reaches you: the threshold is measured in the area to be DISTURBED, not in lot area and not in floor area. This parcel is over an acre and lot size is only a proxy for disturbance here, so a large site with a small construction footprint may sit below the line — and conversely a sub-acre parcel with off-site work may sit above it.',
      })
    }

    // Relief rather than an obligation, so 'info'. Gated on `teardown` — the
    // statute credits BUILT-UPON AREA THAT ALREADY EXISTS, so it can only help a
    // site that already carries some. Charlotte's own UDO defers to this statute
    // by name (Sec. 25.3.C.1 and parallels: "Stormwater controls shall only be
    // required on redeveloped BUA as allowed by state law (N.C.G.S § 143-214.7)"),
    // so the amendment operates directly on Charlotte teardowns.
    if (teardown) {
      hurdles.push({
        category: 'review',
        label: 'State law now credits your existing pavement, square foot for square foot',
        status: 'info',
        note: 'Redeveloping a site that already carries built-upon area got materially cheaper in July 2026, and the change is statewide rather than local. N.C. Gen. Stat. § 143-214.7(b3), as rewritten by Session Law 2026-39 (House Bill 162), Section 2.(a), now provides that “(i) the existing built-upon area shall not be included in the density calculations for additional stormwater control requirements, irrespective of whether the existing built-upon area is to be demolished, relocated, replaced, or remains in place during development activity, (ii) the existing built-upon area at the site is not subject to additional stormwater control requirements under this section, regardless of whether the existing built-upon area is demolished, relocated, replaced, or remains in place during the development activity, (iii) for purposes of determining the size of the area for which stormwater control measures are required for a development or redevelopment, built-upon area that existed before the development or redevelopment shall be applied on a square-foot-for-square-foot basis to reduce the built-upon area for which stormwater control measures are required, and (iv) stormwater control requirements cannot be applied retroactively to existing built-upon area”. It reaches Charlotte directly: “This subsection applies to all local governments regardless of the source of their regulatory authority. Local governments shall include the requirements of this subsection in their stormwater ordinances.” There is a conformance clock on the City, not on you — “Each local government that implements a stormwater management program shall amend its stormwater ordinance to conform to G.S. 143-214.7(b3) … within 12 months of the effective date of this section. Any local stormwater ordinance that is inconsistent with G.S. 143-214.7(b3) … is void and unenforceable on and after that date” (Section 2.(b)) — and the section “is effective when it becomes law” (Section 2.(c)), approved 6 July 2026. Charlotte’s UDO already defers to the statute by name, providing that “Stormwater controls shall only be required on redeveloped BUA as allowed by state law (N.C.G.S § 143-214.7)” (Sec. 25.3.C.1 and its parallels). This is relief and not an obligation, and the local text may not yet have caught up — measure the existing impervious area before demolition, because it is now a credit you can lose by not documenting it, and confirm the ordinance language in force on the day you file.',
      })
    }

    // ── Flood. Deliberately NOT gated on `fz`: the whole point is that a
    // FEMA-clear parcel can still be regulated. providers/charlotte.ts fetches
    // the FEMA NFHL only; the City's separate Community Floodplain layer is not
    // read here. That is a KNOWN GAP and must render as one — the generic
    // `FEMA flood zone ${fz}` row would otherwise imply the FEMA zone is the
    // whole answer (rule 5).
    hurdles.push({
      category: 'flood',
      label: 'Charlotte regulates a COMMUNITY floodplain wider than FEMA’s — and we only hold the FEMA layer',
      status: 'info',
      note: 'A clear FEMA zone is not a clear answer in Charlotte. Mecklenburg County maps its own community floodplain alongside the federal one — “All streams in Mecklenburg County with drainage areas of one square mile or greater have established community and FEMA base flood elevations and community encroachment areas and FEMA floodways” (Charlotte UDO Sec. 27.2.B.1) — and the elevation standard is written to the community figure plus freeboard: the Flood Protection Elevation is “The elevation to which all structures located within the community special flood hazard area FEMA special flood hazard area shall be elevated or floodproofed if nonresidential. This elevation is the community base flood elevation plus two feet of freeboard until such time as the Community Special Flood Hazard Area is mapped using new future conditions criteria. When new maps are issued, the elevation shall be the Community Base Flood Elevation plus one foot, except along the Catawba River, including Lake Wylie and Mountain Island Lake where it is the FEMA base flood elevation plus two feet of freeboard” (Article 27 definitions), and “New construction or substantial improvement of any residential structure shall have the lowest floor elevated to or above the FPE” (Sec. 27.4.A.1). This tool reads the FEMA National Flood Hazard Layer and nothing else. The City publishes the Community Floodplain as a separate layer we do not fetch, so a parcel this report shows as outside a FEMA zone can still sit inside the community floodplain and owe elevation to a community base flood elevation plus two feet. Treat the FEMA answer above as a floor, not as the whole question, and check the community mapping. The same caution covers the stream buffers, which are also mapped rather than legislated: “SWIM stream buffer requirements begin at the point where the stream drains 100 acres or greater subject to review by field survey on a site-by-site basis” (Sec. 26.3), with widths by drainage area on the SWIM Stream Buffer Map maintained by Charlotte-Mecklenburg Storm Water Services.',
    })

    // ── EV charging. NOT a duplicate of the tier rows or of PARKING_RULES: this
    // is Sec. 19.3, a separate requirement.
    //
    // ⚠️ THE INDENTATION TRAP. Read as flat text, Sec. 19.3.A appears to let the
    // unit count stand in for the provided-space count whenever no minimum
    // applies — which would let a Tier 3 apartment building be gated at
    // `units >= 26`. The article page's own <p style="padding-left:…"> levels
    // show sub-items a and b sit at 80px UNDER ITEM 2 ONLY, and i/ii at 120px
    // under b. Item 2 is "The residential component of mixed-use developments",
    // and the sub-item's own words confine it. The substitution is written for
    // MIXED-USE developments, not for a stand-alone multi-family stacked
    // building. So the threshold is in SPACES PROVIDED — a design decision we do
    // not hold — and this row is NOT sizeDependent and NOT unit-gated.
    if (project.projectType === 'new' && isResidential) {
      hurdles.push({
        category: 'parking',
        label: 'EV charging stations for multi-family and hotels',
        status: 'likely',
        note: `Charlotte requires EV infrastructure by ordinance, and it is keyed to the parking you build rather than to the building: “Electric vehicle (EV) charging stations are required per Table 19-2: Required EV Charging Stations for: 1. Multi-family stacked dwellings 2. The residential component of mixed-use developments … 3. Hotels 4. Parking lots and parking structures as a principal use” (Charlotte UDO Sec. 19.3.A). Table 19-2 keys on the “Total Number of Provided Off-Street Parking Spaces”: 0–9 spaces require none; 10–25 require 20% of spaces (rounded up) EV-capable; 26–50 require 20% EV-capable plus one EVSE-installed; more than 50 require 20% EV-capable plus 2% of spaces (rounded up) EVSE-installed. The trigger is therefore the number of spaces you PROVIDE — a design decision, not a fact about the parcel — which is why this is stated rather than applied: build fewer than ten spaces and the table asks for nothing. ${
          project.use === 'mixed'
            ? 'On a mixed-use project the substitution matters and it runs against you: “Where the number of off-street parking spaces provided is less than the number of residential units in the mixed-use development, the number of residential units shall be considered as the number of provided off-street parking spaces for the purposes of calculating the EV charging stations required per Table 19-2” (Sec. 19.3.A.2.b.i). Under-parking a mixed-use building does not shrink the EV obligation — the unit count takes over as the counting basis.'
            : 'One clause NOT to borrow from a mixed-use project: Sec. 19.3.A.2.b.i lets the residential unit count stand in for the provided-space count, but it sits under item 2 — “The residential component of mixed-use developments” — and does not reach a stand-alone multi-family stacked building. On this project the count is the spaces you provide.'
        } The interaction with the tier maximums is worth knowing before you design the deck: “EV charging stations shall only count toward a development’s parking maximum if spaces are EV-Capable. EVSE-Installed stations do not count toward parking maximums” (Sec. 19.3.D).`,
      })
    }

    // ── Demolition. Gated on the MAPPED overlay, never citywide: Charlotte's
    // demolition delay is an overlay power, and asserting it citywide would be
    // exactly the over-broad gate this file has had to unwind before.
    // providers/charlotte.ts populates overlays.historicDistrict from the City's
    // Historic Districts layer (Accela MapServer layer 12), whose header records
    // that all eight mapped districts are DistrictType 'Local' — i.e. Sec. 14.2
    // overlays. No addsMonths: 365 days is a CEILING on a delay that may be
    // waived entirely, not a scheduled duration.
    if (teardown) {
      if (parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic demolition: approval cannot be refused, but can be delayed up to 365 days',
          status: 'required',
          note: 'Inside a local historic district Charlotte trades refusal for delay, and the trade is written both ways. The delay: “If the property is determined by the Historic District Commission to have special significance and value toward maintaining the character of the district, the Historic District Commission may delay demolition or removal for no more than 365 days from the date of the approval. During this 365 day period, the Historic District Commission may negotiate with the owner and with any other parties in an effort to find a means of preserving the building” (Charlotte UDO Sec. 14.2.J.2). And the guarantee: “An application for a Certificate of Appropriateness authorizing the demolition of a building, structure, or site within the district may not be denied. The maximum period of delay authorized by this section shall be reduced by the Historic District Commission where it finds that the owner would suffer extreme hardship or be permanently deprived of all beneficial use of or return from such property by virtue of the delay” (Sec. 14.2.J.3). That is a schedule risk with a published ceiling, not a veto — and unlike Raleigh, whose Sec. 10.2.15.E.3 lets a certificate be denied outright on a Statewide Significance finding, Charlotte’s section carries no such exception. The certificate itself gates the permit whether or not a permit would otherwise be needed: “A Certificate of Appropriateness shall be issued by the Historic District Commission prior to the issuance of a building permit … A Certificate of Appropriateness is required whether or not a building permit is required” (Sec. 14.2.D.2), and once issued it “shall be valid for 12 months from the date of issuance” (Sec. 14.2.L.7.a) — so a certificate obtained early can expire before financing closes. No months are added to this project’s timeline for the delay because 365 days is a ceiling the Commission may waive entirely, not an expected duration; price it as a risk with a known worst case.',
        })
      }

      // Ungated by overlay ON PURPOSE: the whole point is that no overlay is
      // mapped yet, so a parcel with a clean overlay record is exactly the one
      // this row exists for.
      hurdles.push({
        category: 'demolition',
        label: 'A pending historic designation freezes demolition for up to 180 days',
        status: 'info',
        note: 'A designation that has only been recommended, not adopted, is already enough to stop a teardown: “If the Commission has voted to recommend designation of an area as an Historic District and final designation has not been made by City Council, the demolition or destruction of any building, site, or structure located in the proposed district may be delayed by the HDC for a period of up to 180 days or until City Council takes final action on the designation, whichever occurs first. Should City Council approve the designation prior to the expiration of the 180 day delay period, an application for a Certificate of Appropriateness for demolition shall then be filed. The maximum period of delay for a Certificate of Appropriateness for demolition shall be reduced by the HDC by the period of delay while the designation was pending” (Charlotte UDO Sec. 14.2.J.4). This one is deliberately not conditioned on a mapped overlay, because the situation it describes is precisely the one where no overlay exists yet — a neighbourhood that objects can start that clock without Council ever voting, so check whether a designation has been recommended over the area before you count on a demolition date. Waiting it out with a vacant building is not a route around any of it either: Sec. 14.2.R.2 lets the City act where a designated building or one in a district “is about to be demolished whether as the result of deliberate neglect or otherwise”.',
      })
    }

    // ── The rezoning path. No addsMonths: the two clocks Sec. 37.2.K.4 publishes
    // are deadlines on a BOARD (30 days for a Planning Commission
    // recommendation; 30 days deemed favourable), and nothing clocks the
    // applicant's community meeting, the CTR, or Council's own calendar.
    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Conditional rezoning: community meeting, legislative hearing, City Council',
        status: 'likely',
        note: 'Asking for more than the base district means a rezoning, and in North Carolina that is a legislative act of the City Council rather than a staff approval. A neighbourhood meeting comes first and it is mandatory: “A community meeting shall be required for all zoning map amendment petitions, as outlined/determined by City policy” (Charlotte UDO Sec. 37.2.F.1), and “Before a public hearing may be held on a petition, the petitioner shall file a written report with the City Clerk stating that at least one community meeting was held by the petitioner. The report shall include, among other things, a listing of those persons and organizations contacted about the meeting and the manner and date of contact, the date, time and location of the meeting, a roster of the persons in attendance at the meeting, a summary of issues discussed at the meeting, and a description of any changes to the rezoning petition made by the petitioner as a result of the meeting” (Sec. 37.2.F.2). The meeting has a shelf life — “If a public hearing has not been held within six months of a community meeting, then another community meeting shall be held” (Sec. 37.2.F.3) — so a petition that stalls pays for the meeting twice. The Planning Commission recommends and Council decides, with two clocks that run against the BOARD rather than against you: “If no written recommendation and statement of plan consistency is received from the Planning Commission within 30 days of the public hearing, the City Council may act on the amendment without the Planning Commission recommendation. If the Planning Commission does not make a recommendation within 30 days after the petition has been referred to it, then the Planning Commission shall be considered to have made a favorable recommendation, unless action was taken to defer” (Sec. 37.2.K.4). No months are added here for that reason: those are deadlines on a body, not a schedule for the project, and nothing clocks the community meeting, the transportation review or Council’s own calendar. Two structural points decide which route you take. First, a project-specific ask has to go the CONDITIONAL route: on a conventional rezoning “the City Council and Planning Commission shall not evaluate the petition based on any specific proposal for the use or development of the affected property and the petitioner shall refrain from using any graphic materials or descriptions of the proposed use or development” (Sec. 37.2.L.1) — and a conditional approval becomes a site-specific vesting plan under Sec. 37.6.B.1. Second, do not reach for the exception district to buy height: an EX district “shall only modify the following standards: i. The quantitative zoning standards… (A) No modifications shall be made to maximum height regulations, with the exception of the height transition limitations when adjacent to the Neighborhood 1 Place Type” (Sec. 37.2.C.3.b.i.(A)). Height above the base comes only from the Sec. 16.3 bonus.',
      })
    }
  } else if (city === 'atlanta') {
    // Atlanta Code of Ordinances Part 16, §§ 16-28.014 and 16-36.020, read
    // 2026-08-08 from the City's electronic code of record. Source note and the
    // measured currency check in PARKING_RULES['atlanta']; cohort caveat above.
    const atlBuiltPre1965 = existing.ex?.yearBuilt != null && existing.ex.yearBuilt < 1965
    const atlBeltLine = /beltline/i.test(parcel.zoning.subdistrict ?? '')

    // Un-gateable by design: we hold no transit geometry, and the section's own
    // measurement is a WALKING distance along a sidewalk/walkway/street, not a
    // radius — so even a stop dataset would not settle it from coordinates. The
    // whole condition is quoted, including the three excepted areas and the
    // maxima the section imposes in exchange.
    hurdles.push({
      category: 'parking',
      label: 'No parking required within 2,640 feet of high-capacity transit',
      status: 'info',
      note: 'Atlanta\'s largest parking carve-out is geographic: “The following requirements apply to all uses located on lots within 2,640 feet of a high capacity transit stop, except within the Buckhead Parking Overlay, all special public interest districts, or any historic or landmark district with parking maximums. (a) Minimum parking: No parking is required” (Atlanta Code § 16-28.014(14)). Three parts of the condition decide whether it reaches this parcel, and none is in the parcel record. The distance is a walking measurement, not a radius — “measured along a public or private sidewalk, walkway, or street from the transit station lot line, edge of stop platform, or edge of other boarding area, whichever is greatest, to the closest point of the lot” — but it is generous once it touches you: “When any portion of a lot is within the applicable distance, the entire lot shall be subject to this requirement” (sub-(h)). The transit must be “operational or under construction” (sub-(i)). And “high capacity transit” is narrowly defined at § 16-29.001: rail, a fixed overhead wire system, or bus rapid transit “using and occupying an exclusive right-of-way for at least 75 percent of the route\'s length” — an ordinary bus route does not qualify, and long-distance passenger facilities serving beyond Georgia are excluded. Where it applies it trades the minimum for a maximum: 1.25 spaces per one-bedroom unit and 2.00 per two-or-more-bedroom unit, with R-1 through R-5 exempt from the cap. One thing NOT to infer from the exceptions: the three excepted areas do not put minimums back. SPI-1 Downtown (§ 16-18A.015), SPI-16 Midtown (§ 16-18P.020 Table 7) and the Buckhead Parking Overlay (§ 16-38.003) each read “None” in the Minimum column for residential — they are excepted because they carry their own tables, not because they require parking.',
    })

    if (atlBuiltPre1965) {
      // Two different answers off the same fact, and the difference is the
      // project. § 16-28.014(13) exempts "buildings and portions thereof built
      // prior to 1965" — a replacement building is not one of those, so a
      // teardown FORFEITS the exemption. Saying only the first half would hand
      // a developer an exemption the code withdraws the moment they demolish.
      const atlYear = existing.ex?.yearBuilt
      hurdles.push({
        category: 'parking',
        label:
          project.projectType === 'new'
            ? 'Demolishing this pre-1965 building forfeits its parking exemption'
            : 'Pre-1965 building: no parking required',
        status: 'info',
        note: `The record shows the existing building here dates to ${atlYear}, before 1965. Atlanta exempts such buildings citywide: “A reduction of the generally applicable minimum off-street parking requirements shall be allowed in all zoning districts for buildings and portions thereof built prior to 1965, as follows: (a) Residential uses: No parking is required. (b) Non-residential uses: No parking is required, provided that this provision shall not apply to any business establishment larger than 1,200 square feet in floor area that holds any type of alcoholic beverage license” (Atlanta Code § 16-28.014(13)). ${
          project.projectType === 'new'
            ? 'But this project is new construction, and the exemption attaches to the BUILDING, not to the site — a replacement structure is not a building built prior to 1965, so demolishing forfeits it and the base-district minimum returns unless the transit or BeltLine rules independently apply. That is worth pricing against a renovation or an addition, which keeps it.'
            : 'The exemption runs with the existing building, so a renovation, conversion or addition keeps it — note the one carve-out, which is a licensed alcohol establishment over 1,200 square feet, not restaurants generally.'
        }`,
      })
    }

    if (atlBeltLine) {
      hurdles.push({
        category: 'parking',
        label: 'BeltLine Overlay: no minimum parking requirement',
        status: 'info',
        note: `This parcel's overlay record reads “${parcel.zoning.subdistrict}”, which puts it in the BeltLine Overlay District: “With the exception of the minimum parking requirements applicable to Commercial Food Preparation, Delivery-based commercial kitchens, and Eating and Drinking Establishments which shall be determined by the underlying zoning, there will be no minimum parking requirement within the BeltLine Overlay District” (Atlanta Code § 16-36.020(1), last amended Ord. No. 2024-06 (23-O-1003), § 1, 2-14-24). The three excepted uses fall back to the base district's ratio rather than to zero, so a ground-floor restaurant in an otherwise exempt building still carries a requirement. Note the direction this row can be wrong: the overlay label is only carried when no historic district is also mapped here, so a BeltLine parcel inside a historic district will not show this row. Its absence is not evidence the overlay is absent.`,
      })
    }

    // ─── Non-parking hurdles. Atlanta Code of Ordinances Part 16 (zoning),
    // Part 19 ch. 10 (impact fees), ch. 74 (environment) and ch. 158 (trees),
    // read 2026-08-08 from Municode job 494611 (Supp. 106, "codified through
    // Ordinance No. 2026-25(26-O-1312), enacted May 27, 2026"), reached from the
    // chapter index. DRI rules from the Georgia SOS rules site and the
    // DCA-published rule PDF. ────────────────────────────────────────────────

    if (isResidential) {
      // ABSENCE, and it is a DIFFERENT absence from both Nashville's and
      // Raleigh's — which is exactly why it cannot borrow either one's sentence.
      // Tennessee bans mandatory inclusionary zoning by name; North Carolina is
      // silent and Raleigh simply has not adopted one; Atlanta HAS adopted one,
      // in three mapped places and nowhere else. The sentence this row must not
      // contain is "state law bars it" — O.C.G.A. § 44-7-19 could only be read
      // on mirrors, so it is dropped in both directions (rules 1 and 8).
      hurdles.push({
        category: 'affordability',
        label: 'No citywide inclusionary requirement — three mapped overlays impose one',
        status: 'info',
        note: 'Atlanta imposes no affordability requirement citywide, but unlike Raleigh it is not purely a bonus either: three mapped overlay districts carry a MANDATORY set-aside, and outside them nothing applies. The three are the BeltLine Overlay District (Atlanta Code Part 16 ch. 36A), the Westside Affordable Workforce Housing Overlay District (ch. 37), and the Northwest Atlanta Workforce Housing Overlay District (ch. 41). Each reaches “all residential rental developments of ten or more new residential rental dwelling units” in its district — ch. 41 reaching for-sale units as well — so a nine-unit building, a for-sale building outside ch. 41, or any building outside all three overlays carries no obligation. On the state-law backdrop, note what is and is not established here. Georgia has not prohibited inclusionary zoning by name the way Tennessee has (Tenn. Code Ann. § 66-35-102(b)); what the record shows is the ordinances hedging themselves — all three fix the affordability term at “the greater of 20 years from the date of the issuance of the certificate of occupancy; or such longer period … as permitted by state law at the time of the issuance of the building permit” (§§ 16-36A.004, 16-37.004, 16-41.004(a)). Treat this as a rule Atlanta has adopted in three places and not elsewhere.',
      })

      // The mandate itself. THREE limbs, and only one of them is in our data.
      //   (1) inside one of the three overlays — our lookup returns ONE overlay
      //       per point and a historic district displaces it, so a match is
      //       trustworthy and a miss is not;
      //   (2) ten or more new units — this we have;
      //   (3) RENTAL tenure — ch. 36A and ch. 37 reach rental only, ch. 41 also
      //       reaches for-sale, and this tool holds no tenure field at all.
      // Limbs 1 and 3 are therefore QUOTED in the note and the status is
      // 'likely'. It must never harden to 'required'.
      if (units >= 10 && ATLANTA_AWH_OVERLAY.test(parcel.zoning.subdistrict ?? '')) {
        hurdles.push({
          category: 'affordability',
          label: 'Overlay inclusionary requirement: 15% at 80% AMI or 10% at 60% AMI',
          sizeDependent: true,
          status: 'likely',
          note: `This parcel’s overlay record reads “${parcel.zoning.subdistrict}”, which appears to put it in one of Atlanta’s three affordable-workforce-housing overlays, and at ten or more new rental units the set-aside is mandatory, not a bonus: “At least 15 percent of the total residential rental units shall be actively marketed for lease to households having an income … that does not exceed 80 percent AMI … or … At least ten percent of the total residential rental units … does not exceed 60 percent of the AMI” (Atlanta Code §§ 16-36A.004, 16-37.004; the Northwest Atlanta overlay at § 16-41.004(a) adds a third option of 5% at 30% AMI and, at § 16-41.004(b), a homeownership limb of 10% of units split evenly between 80% and 120% AMI). The term runs at least 20 years from the certificate of occupancy, the affordable units must be interspersed among market-rate units and proportionate in bedroom count, and no temporary or final certificate of occupancy issues until a Land Use Restrictive Agreement in the City’s form is recorded in the county real estate records (§§ 16-36A.004, .006). An in-lieu payment into the BeltLine Affordable Workforce Housing In-Lieu Fee Trust Fund is available instead, at rates the Department of City Planning republishes by June 1 each year effective July 1 (§ 16-36A.007) — the rates are not in the ordinance, so no figure is stated here. Compliance buys something back: a 15% floor-area-ratio increase, severable as transferable development rights (§ 16-36A.008), and priority SAP review within 21 days plus a Major Projects Meeting (§ 16-36A.010). TWO LIMBS TO CONFIRM BEFORE PRICING THIS, because neither is in the parcel record: whether the parcel is actually inside one of the three mapped overlays — our overlay lookup returns only one overlay per point and a historic district displaces it — and whether the units are RENTAL, since ch. 36A and ch. 37 reach rental only and ch. 41 is the one that also reaches for-sale.`,
        })
      }
    }

    // Impact fees. No unit or floor-area threshold exists, so no sizeDependent
    // tag — the gate is that the project is new construction. The RATES are not
    // in the ordinance and none is invented here (rule 4): each section adopts
    // a fee schedule "incorporated herein by reference".
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'fees',
        label: 'Development impact fees: transportation, parks and recreation, public safety',
        status: 'required',
        note: 'Atlanta levies three development impact fees under the Georgia Development Impact Fee Act, and they gate both ends of the job: “No building permit for any development requiring payment of a development impact fee pursuant to this chapter shall be valid unless and until the required development impact fee has been paid” (Atlanta Code § 19-1007(a)), and “No certificate of occupancy may be issued until all impact fees are paid in full” (§ 19-1007(g)). The three are transportation (§ 19-1009), parks and recreation (§ 19-1010) and public safety — fire/EMS and police (§ 19-1011); transportation and parks are charged by service area, defined by enumerated census tracts as Northside, Southside and Westside, and public safety is citywide. There is no unit or floor-area threshold and no small-project exemption. The rates are not in the ordinance — each section adopts “the … Impact Fee Schedule which is part of the impact fee study and incorporated herein by reference”, so get the current schedule from the Department of City Planning rather than a figure from a prior year. Two reductions worth asking about: the transportation fee is cut 50% for projects within 1,000 feet of a MARTA station “measured from property line to property line along a legal and practical pedestrian route”, but only if the applicant demonstrates the parking provided does not exceed any required minimum and is no more than 80 percent of any maximum (§ 19-1009(c)(2)(a)); and qualifying affordable housing or economic-development projects “may receive a 20 percent exemption … subject to available replacement funds from the City”, applied for before the fee is imposed and requiring a chief-financial-officer certification that replacement funds exist (§ 19-1016(a), (b), (e)). Applicants may instead commission an independent fee determination (§ 19-1012).',
      })
    }

    // The structural finding, and the row a reader coming from Boston or
    // Philadelphia most needs. No addsMonths: the 30 days in § 16-25.004(3)(a)
    // is a decision deadline on the director, and the NPU's 21 days is a comment
    // window inside it — neither is a scheduled duration for the project.
    hurdles.push({
      category: 'review',
      label: 'Permitting is administrative — no design-review board outside overlays',
      status: 'info',
      note: 'Atlanta has no citywide site-plan hearing. A by-right project is a building permit plus a land-disturbance permit, both decided by staff. Where a Special Public Interest district, the BeltLine Overlay, a Neighborhood Commercial district or another mapped overlay applies, a Special Administrative Permit is required first, and that is still an administrative decision with a clock: the director of the office of zoning and development “shall within 30 days (unless a longer period is mutually agreed upon) of completion of the procedural requirements herein decide on the application”, and may approve, approve with written conditions, or deny with written reasons (Atlanta Code § 16-25.004(3)(a)). Appeals run to the Board of Zoning Adjustment (§ 16-25.004(5); § 16-30.010). Two Atlanta-specific wrinkles. First, the Neighborhood Planning Unit: on a BeltLine SAP the applicant must mail the full application to the NPU chair and file a signed affidavit of that mailing, and “Said appropriate NPU shall have a period of 21 days from the date of the said certificate of mailing to provide one set of written comments to the bureau of planning prior to any SAP approval” (§ 16-36.004(2)) — comment, not consent, but it is a hard 21 days before approval. Second, the SAP is also where relief lives: the planning director may authorize variations from the overlay’s own regulations on written findings (§ 16-36.005), but variances from the UNDERLYING district — yards, height, minimum parking, signage — still require the Board of Zoning Adjustment.',
    })

    // ── Development of Regional Impact. THE ROW MOST LIKELY TO BE GOT WRONG,
    // twice over.
    //
    // (a) It reaches an ORDINARY BY-RIGHT project — the rule's own trigger is
    //     "An applicant requests an action (e.g., rezoning, special use permit,
    //     land disturbance permit, etc.)" — so there is deliberately no
    //     `discretionary` guard on it.
    //
    // (b) THE THRESHOLD IS USE-TYPED, and the research's proposed gate
    //     `(isResidential && units >= 400) || project.gfa >= 300000` is
    //     deliberately NOT used as written. `project.gfa` is the WHOLE
    //     building, and 300,000 is the COMMERCIAL rung; an unguarded floor-area
    //     limb measures a residential project's floor area against a commercial
    //     threshold, which is the exact over-fire this file has had to unwind in
    //     Seattle (SMC 25.05.800.A Tables A/B), Minneapolis (Table 550-1) and
    //     Nashville (§ 17.20.140.B.2). Housing is measured in UNITS in this
    //     rule; there is no limb under which a residential program is screened
    //     on square feet. So the floor-area limb is restricted to the use types
    //     the ladder actually names, at their own rungs: commercial 300,000,
    //     mixed use 400,000.
    //
    // Institutional gets NO limb: the ARC rule's categories read here are
    // housing, commercial, office, mixed use and hotels, and no institutional
    // rung was read — a gap must not render as an answer (rule 5). Hotels are
    // measured in ROOMS, which we do not carry. Both disclosed in the note.
    //
    // NO addsMonths, deliberately. The rule says the process “shall not last
    // more than 30 calendar days (unless process extensions are taken as
    // provided for in section 110-12-7-.02(10)(c))” — a CEILING with an escape
    // hatch — and the 90 days is a deadline on the APPLICANT. Neither is a
    // scheduled duration. Same test this module applies to Raleigh's 180 days.
    const atlDriHousingLimb = isResidential && units >= 400
    const atlDriFloorLimb =
      (project.use === 'commercial' && project.gfa >= 300000) || (project.use === 'mixed' && project.gfa >= 400000)
    if (atlDriHousingLimb || atlDriFloorLimb) {
      hurdles.push({
        category: 'review',
        label: 'Development of Regional Impact review — permitting is barred while it runs',
        sizeDependent: true,
        status: 'likely',
        note: 'A large Atlanta project is not only a City matter: Georgia requires the host local government to refer it to the Atlanta Regional Commission, and “The local government may not take final action approving the project or any other action, including but not limited to permitting, while the DRI process is ongoing” (Ga. Comp. R. & Regs. r. 110-12-7-.01(2)(b)). The trigger reaches an ordinary by-right project — the process begins when “An applicant requests an action (e.g., rezoning, special use permit, land disturbance permit, etc.) from a local government.” THE THRESHOLD IS NOT A SINGLE NUMBER AND THE STATEWIDE TABLE DOES NOT APPLY HERE. The Atlanta region runs on DCA’s alternative rules for ARC (Ch. 110-12-7, adopted 11/20/2025, effective 12/15/2025), whose thresholds step by the place-type on ARC’s Unified Growth Policy Map: housing at 400 new lots or units in Rural and Developing Rural, 500 in Maturing Neighborhoods / Established Suburbs / Developing Suburbs and anything not otherwise named, 600 in Regional Centers and Regional Employment Corridors, and 700 in the Region Core; commercial at 300,000 / 400,000 / 500,000 / 600,000 gross square feet or 10,000 trips per day; office at 400,000 / 500,000 / 600,000 / 700,000; mixed use at 400,000 / 500,000 / 600,000 / 700,000 gross square feet with residential units counted at 1,800, 1,500, 1,000 and 1,000 square feet per unit respectively; hotels at 400 / 500 / 600 / 700 rooms. The place-type is not in the parcel record, so this row fires at the LOWEST rung and names the ladder rather than asserting which rung applies — confirm the Unified Growth Policy Map designation before pricing it either way. Note which measure applies to which program: housing is counted in units and never in square feet, so a residential project’s floor area is not measured against the commercial figure. Three limbs of the rule are not modelled at all here — the 10,000-trips-per-day commercial alternative (we compute no trip generation), the hotel rungs (counted in rooms), and any category the rules set for institutional uses, which was not read. Where it does apply the cost is the study, not the referral: the applicant must submit the GRTA-required transportation and traffic analysis to both ARC and GRTA within 90 days of the pre-review meeting or the DRI may be withdrawn, and the outcome is an advisory report — the City keeps the final decision.',
      })
    }

    // ── Trees. Atlanta's signature cost, and the one row here carrying a
    // published dollar figure.
    //
    // ⚠️ addsMonths DELIBERATELY OMITTED, and this is the most challengeable
    // call in the branch, so the argument is written down rather than left
    // implicit. The two postings are 10 + 7 = 17 BUSINESS days (~24 calendar
    // days) that must elapse before the permit issues, and the second cannot
    // begin until preliminary approval, so it is sequential to the arborist
    // review rather than concurrent with it. That is a published FLOOR the code
    // fixes, not a ceiling — the same shape as Nashville's 30-day
    // deemed-approval clock, which this module does honour with a number, and
    // `addsMonths: 1` would be defensible on that reasoning. The counter-
    // argument is that the first 10 days run "and until the city Arborist has
    // issued preliminary approval", i.e. concurrently with review, so only the
    // 7-day second posting is strictly additive (~1.5 weeks, which rounds to 0).
    // A month of schedule is a real claim and the concurrency question is not
    // settled by the text, so the number is not published. The postings are
    // stated in the note instead.
    hurdles.push({
      category: 'environmental',
      label: 'Tree recompense, tree density, and a two-stage posting before any removal permit',
      status: 'required',
      note: 'Atlanta regulates every non-pine tree 6 inches DBH or larger and every pine 12 inches or larger on private property (Atlanta Code § 158-29(a)(2)), and the ordinance was rewritten in 2025 and amended again this year (Ord. No. 2025-19(24-O-1691), § 1, 6-24-25; Ord. No. 2026-03(26-O-1015), 2-11-26). Any construction, demolition or land-disturbance permit application must be accompanied by a site plan and a survey of all regulated trees (§ 158-52(a)), and a tree is only “saved” if at least 80 percent of its critical root zone is protected at natural grade with the structural root plate fully protected. Removal is priced: “The DBH of all healthy trees approved for removal by the city arborist must be replaced by planting an equivalent number of caliper-inches on or off-site”, and where they cannot be planted, “The established recompense value is $140.00, effective January 1, 2026”, adjusted annually for Atlanta-MSA CPI-U and republished by January 15 each year (§ 158-69(a), (b)(1)). Planted replacement trees are credited at 1.25 times their caliper inches (§ 158-69(b)(3)(a)). For new subdivisions, new lots of record and vacant lots there is a per-acre cap, but only if a minimum share of existing DBH inches is retained — 65% retained / $35,000 per acre in R-1, 50% / $35,000 in R-2, 40% / $25,000 in R-3 and R-3A, 35% / $15,000 in R-4, R-4A, R-G and R-LC, 10% / $25,000 in MR, MRC and I-MIX, 25% / $35,000 in O&I, C-1 through C-5 and I-1/I-2, with PD and SPI districts treated according to underlying zoning (§ 158-69(b)(4)). Recompense is not a way out of the density standard: commercial developments must reach 90 DBH inches per acre before a certificate of occupancy, and “Recompense payment may not be made in lieu of meeting tree density requirements” (§§ 158-60(a)(1), 158-72(b)); street trees are separately required at 40-foot maximum spacing. Affordable-housing projects get significant recompense reductions (§§ 158-88, 158-89). Budget the schedule as well as the money: before a permit issues to remove healthy trees from private property the site must be posted twice on six-square-foot signs every 100 feet of frontage — the first “shall remain posted for a minimum of ten business days and until the city Arborist has issued preliminary approval”, and the second, announcing the right to appeal, “shall remain in place for seven business days, during which time the city will accept appeals” (§ 158-75(c)(1)). That is 17 business days of posting before the permit, and the second cannot start until preliminary approval; no month figure is published for it here because the first posting may run concurrently with the arborist’s review. Any person who lives, owns property or runs a business in the same NPU, or owns property within 500 feet, may appeal to the tree conservation commission (§ 158-77(a)(1)).',
    })

    if (project.projectType === 'new') {
      hurdles.push({
        category: 'environmental',
        label: 'Stormwater control permit and the 1.0-inch runoff-reduction standard',
        status: 'required',
        note: 'Atlanta’s post-development stormwater rule has an unusually low floor — it applies to “New development that creates 500 square feet or more of any impervious surface”, to “New development or redevelopment that involves one disturbed acre or more”, to redevelopment that “creates, adds, or demolishes and replaces 500 square feet or more of impervious surface”, and to demolition that leaves more than 500 square feet of impervious surface in place with no replacement application pending (Atlanta Code § 74-504(a)). Essentially every ground-up project is in. The standard is a retention volume, not a treatment goal: “The runoff volume generated by the first 1.0” of rainfall shall be retained on-site” using green infrastructure per the Georgia Stormwater Management Manual, with a prioritised order — vegetated infiltration first, then permeable pavement, then green roofs and rainwater harvesting, then underground infiltration (§ 74-513(a)). On top of that: 80 percent removal of average annual post-development total suspended solids for a 1.2-inch event (§ 74-513(b)); 24-hour extended detention of the one-year, 24-hour storm plus stream-buffer preservation for channel protection (§ 74-513(c)); post-development peak discharge attenuated to pre-development up to the 25-year, 24-hour storm (§ 74-513(d)); and safe conveyance of the 100-year, 24-hour storm with no increase in peak discharge (§ 74-513(e)). A pre-application consultation meeting with the Department of Watershed Management is mandatory before a permit application is submitted, and the department must schedule it within five business days of a written request — failing which the requirement is waived and the written request itself satisfies the submittal (§ 74-510(b)). Single-family development creating less than 5,000 square feet of impervious surface, and not part of a larger common plan, is on a reduced track under § 74-515; note that a single-family house on a site that crosses 5,000 square feet of impervious surface falls back under the full rule (§ 74-504(b)).',
      })
    }

    // The threshold is measured in DISTURBED area, not lot area and not floor
    // area. Lot size is a proxy and the note says so — same treatment as
    // Raleigh's 12,000 sq ft erosion row and Philadelphia's 5,000 sq ft row.
    // NOT tagged sizeDependent for the same reason: no floor area is in the
    // trigger, so a placeholder GFA cannot corrupt it.
    if (project.projectType === 'new' && lotSqFt >= 43560) {
      hurdles.push({
        category: 'environmental',
        label: 'Land-disturbance permit and erosion control (one-acre threshold)',
        status: 'likely',
        note: 'Atlanta is the local issuing authority for Georgia’s Erosion and Sedimentation Act, and a land-disturbing activity permit is applied for as part of the building permit (Atlanta Code § 74-39(a)). The exemption most projects test is narrow and CONJUNCTIVE: “The construction of single-family residences, when such construction disturbs less than one acre and is not a part of a larger common plan or development or sale with a planned disturbance of equal to or greater than one acre and not otherwise exempted under this paragraph” (§ 74-38(4)) — all three limbs must hold, and even then the minimum best-management practices of § 74-43 still apply and a trout-stream buffer still applies. Note the unit: the threshold is measured in the area to be DISTURBED, not in lot area and not in floor area; lot size is only a proxy for it here, so a large parcel with a small footprint of disturbance may sit below the line and a small parcel inside a larger common plan may sit above it. The plan must be certified by a preparer who visited the site, is referred to the soil and water conservation district for review, and carries a state-mandated fee of $40.00 per disturbed acre on top of city fees (§§ 74-39(b), 74-47(b)).',
      })
    }

    // Un-gateable: we hold no hydrography. Stated, not gated — the whole point
    // of the row is that it can remove a large share of a lot from play.
    hurdles.push({
      category: 'environmental',
      label: '75-foot stream buffer — triple the state minimum',
      status: 'info',
      note: 'If any stream touches the site, Atlanta takes far more land out of play than the State does: “Streams shall have a 75-foot, natural, undisturbed, vegetative buffer measured perpendicularly and horizontally on both sides of the stream from the point of wrested vegetation” (Atlanta Code § 74-303(a)), against the 25 feet that O.C.G.A. § 12-7-6 requires for waters of the state generally (carried at § 74-303(d)). Wetlands take a 25-foot buffer of their own and stack on top of a stream buffer where they overlap (§ 74-303(b)). Inside the Water Supply Watershed Buffer the numbers are 100 feet undisturbed and no impervious surface within 150 feet (§ 74-303(c)). Where the bank has been armoured and there is no wrested vegetation, the buffer is measured from the top of the structure (§ 74-303(e)). Encroachment is possible but is its own process — an application to a technical panel with public notice, technical review and a right of appeal (§§ 74-306 through 74-313). We hold no hydrography for this parcel, so this is stated rather than gated: check whether a stream or wetland is mapped on or adjoining the site before assuming the whole lot is buildable.',
    })

    // ── Demolition. Two rows, and they are different regimes, not two halves of
    // one: inside a district it is a VETO, outside it a 45-day screen plus a
    // sequencing condition.
    if (teardown) {
      if (parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'Demolition in a Landmark or Historic District can be refused outright',
          status: 'required',
          note: 'Atlanta does not trade refusal for delay the way Raleigh does. Demolition of a Landmark Building or Site, of anything in a Landmark District, or of a contributing building in a Historic District requires a type IV certificate of appropriateness, and “Type IV certificates of appropriateness shall be issued by the commission only when one (1) or both of the following two (2) conditions have been established … a. The demolition is required to alleviate a threat to public health and safety; and/or b. The demolition is required to rectify a condition of unreasonable economic return” (Atlanta Code § 16-20.008(d)(1)). Nothing else will do. The public-health limb requires independent analyses showing a major and imminent threat and an analysis of every reasonable alternative; the economic limb puts the burden on the applicant to show the property is incapable of earning a reasonable economic return without demolition. The commission must hold an initial public hearing within 45 days of a completed application, on the same 30-day published notice and 15-day posting as a type III, and decides the health-and-safety branch within 21 days of that hearing (§ 16-20.008(d)(3)). Screen the building’s designation status before pricing a teardown here — inside a district this is a veto, not a schedule risk.',
        })
      }

      // Gated only on the teardown because designation of an INDIVIDUAL
      // building outside a district is not in the parcel record — the provider
      // populates `historicDistrict` from the district layer only. So the limb
      // that decides applicability is named in the note and the status is
      // 'likely'.
      hurdles.push({
        category: 'demolition',
        label: 'Historic Building or Site: 45-day review, then no demolition permit without a foundation permit',
        status: 'likely',
        note: 'A designated Historic Building or Site outside a district is handled the other way round — no certificate of appropriateness is required to demolish it, but a 45-day screen and a hard sequencing condition apply. The applicant must file with both the bureau of buildings and the Urban Design Commission on the same day, and must submit a site plan and elevations for the REPLACEMENT building, “provided that such building has a total square footage at least equal to the square footage of the footprint of the building or site proposed to be demolished or moved.” The commission then “shall have 45 days … to review the application and provide to the applicant written comments”, during which “the bureau of buildings shall process and review the application in accordance with its usual procedures, but shall issue no permit prior to the expiration of said 45-day period.” At the end, whether or not the comments are favourable, the applicant gets a written certificate that the application is in order — and then “a demolition permit will be issued when the applicant is issued a foundation permit for the building which is to be placed on the site”, with that certificate good for 18 months or until the City designates the site as a Landmark, whichever comes first (Atlanta Code § 16-20.007(c)(1)–(5)). The stated purpose is to ensure no historic building comes down unless the owner has the intent and financial ability to build the replacement. This row is gated only on the teardown because the designation status of an individual building is not in the parcel record — confirm it.',
      })
    }

    // The BeltLine overlay's NON-parking limb. `atlBeltLine` is the same const
    // the parking row above uses — one overlay test, not two.
    if (atlBeltLine) {
      hurdles.push({
        category: 'review',
        label: 'BeltLine Overlay District: special administrative permit and design review',
        status: 'required',
        note: 'This parcel is in the BeltLine Overlay District, which adds a permit step, a design review and a demolition condition on top of the base zoning. “All exterior demolition, new construction (including additions to existing buildings), expansions of outdoor dining or any construction which results in increased lot coverage, modification of the building footprint, or modification of building façades that alters the configuration of openings, shall be subject to said site plan and building elevation approval as part of the SAP”, and the SAP must be approved before a building permit issues (Atlanta Code § 16-36.004(2)). The application must be mailed to the Neighborhood Planning Unit chair with a signed affidavit, and the NPU has 21 days to comment before any approval. Existing lots of record zoned R-1 through R-5 or SPI and not immediately adjacent to the BeltLine Corridor are exempt from the SAP requirement (§ 16-36.004(3)). On a teardown, § 16-36.006 adds two things: “Any structure 50 years or older shall not be demolished for the purpose of creating open space”, and “All requests for demolition of buildings 50 years or older shall include concept plans for the redevelopment of the property that are sufficient to obtain an SAP for the development of the new structure” — so the replacement design has to exist before the old building comes down. And where 60 percent or more of a principal building is removed or destroyed by any means, the property must be redeveloped to the overlay’s standards including sidewalks and street trees, notwithstanding the nonconformity chapter. Note the direction this row can be wrong: the overlay label is only carried when no historic district is also mapped here, so a BeltLine parcel inside a historic district will not show this row. Its absence is not evidence the overlay is absent.',
      })
    }

    if (discretionary) {
      // No addsMonths: the two figures the code publishes (60 days for the
      // bureau of planning's report, 15 days' notice) are deadlines on the
      // bodies and on notice, not a schedule for the project. Nothing clocks
      // Council. Same restraint as Raleigh's rezoning row.
      hurdles.push({
        category: 'review',
        label: 'Rezoning or special use permit: Zoning Review Board, then City Council',
        status: 'likely',
        note: 'Asking for more than the base district in Atlanta is a legislative act of the City Council, not a staff decision, and a special use permit runs the identical track — § 16-25.003(1) routes special use permits through “the procedures and requirements so established in chapter 27, ‘amendments’”. The application must carry a recent plat of survey by a registered engineer or surveyor, a site plan stating current and proposed zoning, floor area ratio maximum-allowed and proposed, open space required and proposed, and parking required and proposed, plus “a written, documented analysis of the impact of the proposed zoning with respect to each of the matters enumerated in section 16-27.004” (Atlanta Code § 16-27.002(2)). Copies go to the Board of Education, the Atlanta Department of Transportation, Police, Fire and the county health department (§ 16-27.002(5)), and a copy of the application goes to the city arborist for comment, which the bureau of planning and the Zoning Review Board must consider (§ 16-27.004(8)). The bureau of planning has 60 days to transmit its report (§ 16-27.005); the Zoning Review Board holds a public hearing on at least 15 days’ published notice, 15 days’ posting of the property and 14 days’ mailed notice to owners within 300 feet, with each side guaranteed no fewer than ten minutes (§§ 16-27.006 through .009); Council then acts, with the NPU’s recommendation in the packet (§ 16-27.010). Plan for the downside: once an application has been received, “no further application for any change affecting the same property or any part thereof shall be filed within 24 months” absent a Council waiver, and after final action on substantially the same rezoning application a 12-month bar applies that “may not be waived” (§ 16-27.002(3)); a special use permit withdrawn after advertisement or denied carries its own 24-month bar (§ 16-25.003(4)). No statutory clock is published for the process as a whole — the 60-day and 15-day figures above are deadlines on the bodies and on notice, not a schedule for the project.',
      })
    }
  }

  // Demolition + loss of existing structure. New construction on a developed
  // parcel means tearing down what's there first, which adds time and cost, and
  // replacing existing homes with fewer is restricted in most cities.
  if (project.projectType === 'new') {
    // Same definitions the per-city branches used above — see existingStructure().
    const { ex, exUnits, lu, hasBuilding, multifamilyExisting, rentalMultifamily } = existing

    if (hasBuilding) {
      // No addsMonths here — the demolition phase is already in the timeline via
      // the per-city demoMonths, so a hardcoded number here would contradict it.
      hurdles.push({
        category: 'demolition',
        label: 'Demolition of the existing building',
        status: 'required',
        note: `${lu ? `The record shows an existing ${lu.toLowerCase()} here. ` : 'There is already a building on this parcel. '}Building new means demolishing it first: a demolition permit, utility disconnects, and hazardous-material abatement, all of which add cost and time.`,
      })
      const proposedUnits = project.units ?? (isResidential ? 1 : 0)
      if (multifamilyExisting && (exUnits === 0 || proposedUnits < exUnits)) {
        // 'review' (not 'demolition') so its no-net-loss/relocation delay counts
        // toward the discretionary timeline instead of being filtered out.
        hurdles.push({
          category: 'review',
          label: 'Replacing existing housing',
          status: 'required',
          note: 'This parcel already holds multiple homes. Tearing down occupied housing triggers tenant-relocation requirements and demolition review, and replacing it with fewer units runs into “no net loss of housing” rules in many cities. Expect significant added time, and in some places it may not be permitted at all.',
          addsMonths: 6,
        })
      }

      // ---- Tenant-protection teardown (LA / SF). Distinct from the no-net-loss
      // rule above: rent-regulated demolition controls fire even when the new
      // project ADDS units, because the trigger is the loss of *occupied,
      // rent-controlled* tenancies, not a net unit reduction. We reuse the
      // feasibility.ts multifamily heuristic (word-boundaried, exUnits>=2 floor). ----
      const yb = ex?.yearBuilt
      if (city === 'la' && rentalMultifamily) {
        // LA RSO covers most rental units in buildings with a certificate of
        // occupancy on or before Oct 1, 1978; post-RSO buildings are generally
        // exempt. Source: LAHD, "What is Covered under the RSO"
        // (housing.lacity.gov/residents/what-is-covered-under-the-rso) — built
        // on or before 10/1/1978. So suppress only when yearBuilt is KNOWN and
        // >= 1979; an unknown year must NOT wave the teardown through.
        if (yb == null || yb < 1979) {
          // Demolishing occupied RSO units runs the state Ellis Act: a Notice of
          // Intent to Withdraw, a 120-day notice period (extendable to up to one
          // year for senior/disabled tenants with 1+ year tenancy), tenant
          // relocation payments, and multi-year re-rental restrictions. Source:
          // SF.gov "Evictions Pursuant to the Ellis Act" + LAHD "Removal From
          // Rental Market" (120 days / up to 1 year). addsMonths: 6 = the
          // 120-day statutory notice floor (~4 months) plus filing/processing —
          // a defensible minimum, NOT the senior/disabled 1-year ceiling.
          hurdles.push({
            category: 'review',
            label: 'Rent-control teardown (RSO + Ellis Act)',
            status: 'likely',
            note:
              yb == null
                ? 'The record shows existing multifamily housing here but no year built. LA’s Rent Stabilization Ordinance (RSO) covers most rental units in buildings with a certificate of occupancy on or before October 1, 1978 — confirm the building’s RSO status. If it is RSO, demolishing occupied units triggers the state Ellis Act: a Notice of Intent to Withdraw, a 120-day tenant notice period (up to one year for senior or disabled tenants), tenant relocation payments, and multi-year re-rental restrictions on the new building.'
                : 'This parcel’s existing multifamily building predates October 1, 1978, so its rental units are almost certainly covered by LA’s Rent Stabilization Ordinance (RSO). Demolishing occupied RSO units triggers the state Ellis Act: a Notice of Intent to Withdraw, a 120-day tenant notice period (up to one year for senior or disabled tenants), tenant relocation payments, and multi-year re-rental restrictions on the new building.',
            addsMonths: 6,
          })
        }
      } else if (city === 'sf' && rentalMultifamily) {
        // SF Rent Ordinance covers rental units in buildings whose first
        // certificate of occupancy issued on or before June 13, 1979 (the date
        // rent control passed). Source: SF.gov "Partial Exemption for Newly
        // Constructed Rental Units" — new-construction exemption applies only if
        // the first C of O issued AFTER 6/13/1979. SF parcel data (providers/sf.ts)
        // carries existing.landUse and sometimes existing.units, but NEVER
        // yearBuilt — so this hurdle is, in practice, always the confirm-language
        // branch. We still branch on yb defensively in case the field is added.
        if (yb == null || yb < 1980) {
          // Demolition also runs Planning Code Section 317: loss of residential
          // units requires a Conditional Use hearing before the Planning
          // Commission. Source: SF Planning Code Sec. 317 (codelibrary.amlegal.com)
          // + sfplanning.org "Dwelling Unit Removal". addsMonths: 6 mirrors the
          // RSO/Ellis floor (120-day notice + CU hearing lead time); a defensible
          // minimum, not a ceiling.
          hurdles.push({
            category: 'review',
            label: 'Rent-control teardown (Rent Ordinance + Section 317)',
            status: 'likely',
            note:
              yb == null
                ? 'The record shows existing multifamily housing here but no year built. SF’s Rent Ordinance covers rental units in buildings with a certificate of occupancy on or before June 13, 1979 — confirm the building’s rent-control status. Demolishing residential units also runs Planning Code Section 317, which requires a Conditional Use hearing before the Planning Commission, plus tenant-relocation and notice protections.'
                : 'This parcel’s existing multifamily building predates June 13, 1979, so its rental units are almost certainly covered by SF’s Rent Ordinance. Demolishing residential units runs Planning Code Section 317, which requires a Conditional Use hearing before the Planning Commission, plus tenant-relocation and notice protections.',
            addsMonths: 6,
          })
        }
      }
    }
  }

  // Public funding triggers a mandatory procurement + labor process. Privately
  // funded projects only see this as a heads-up, and only when large enough to
  // plausibly chase a subsidy.
  if (project.funding === 'public') {
    hurdles.push({
      category: 'labor',
      label: 'Public-funding process (procurement & prevailing wage)',
      status: 'required',
      note: PUBLIC_FUNDING_NOTE,
      addsMonths: 4,
    })
  } else if (project.gfa >= 50000 || units >= 25) {
    hurdles.push({
      category: 'labor',
      label: 'Subsidy strings (if you seek public funds)',
      status: 'info',
      note: SUBSIDY_NOTE,
    })
  }

  // Parking — flagship Abundance reform target; always worth surfacing. Where a
  // city has abolished minimums entirely we frame it as the tailwind it is.
  //
  // ⚠️ THE else BRANCH WENT LIVE 2026-08-08 AND HAD NEVER RUN BEFORE. The
  // comment here used to assert "every city we cover has a rule in
  // PARKING_RULES (verified per ordinance)", which was true until Milwaukee,
  // Columbus, Charlotte and Atlanta shipped with their parking ordinances
  // unread — so the claim is corrected here rather than only at the site where
  // it stopped being true (rule 17). Its old copy — "Check the local
  // parking-minimum requirement for your zone" — read as advice from a tool
  // that had looked, next to fourteen cities where it genuinely had. It now
  // says which of the two it is, because a coverage gap presented as neutral
  // advice is the same failure class as an unencoded city reading as a less
  // regulated one (see CITIES_WITH_SPECIFIC_HURDLES).
  const parkingRule = PARKING_RULES[city]
  if (parkingRule) {
    hurdles.push({
      category: 'parking',
      label: parkingRule.headline,
      status: 'info',
      note:
        parkingRule.status === 'abolished'
          ? `${parkingRule.detail} This is a major cost saver — parking is now market-driven, not mandated.`
          : parkingRule.detail,
    })
  } else {
    hurdles.push({
      category: 'parking',
      label: 'Parking rule not yet checked for this city',
      status: 'info',
      note: 'We have not read this city’s parking ordinance yet, so nothing here should be read as “no minimum applies”. Look up the requirement for your zone before you size the building — required spaces add significant cost and can constrain the envelope.',
    })
  }

  // Private governance — curated sites escalate; otherwise a standing disclaimer.
  const [lng, lat] = parcel.coordinates
  const site = PRIVATE_SITES.find((s) => inBox(lng, lat, s.bbox))
  if (site) {
    hurdles.push({ category: 'private', label: site.label, status: 'likely', note: site.note })
  } else {
    hurdles.push({
      category: 'private',
      label: 'Private deed / HOA restrictions',
      status: 'info',
      note: 'Private deed restrictions, condo bylaws, or HOA approvals are not in public data and can independently block a project. Verify with the owner and a title search.',
    })
  }

  return softenSizeDependent(hurdles, project.gfaBasis)
}
