// Canned Atlanta responses for getAtlantaParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-08 against the real services, not a hand-written approximation. That
// matters: a fixture invented to match the provider's expectations tests the
// provider against itself, which is the internal-verification trap CLAUDE.md
// rule 9 describes. These carry the upstream's actual field names (including
// the dot in `'SHAPE.AREA'`), actual casing ("152 HOWARD STREET NE    " with
// its trailing spaces), actual single-space padding on empty string columns
// (`SPI: ' '`), actual nulls (every appraisal field null on the DeKalb rows,
// LIVUNITS null there too) and actual float precision on SHAPE.AREA.
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live OWNERNME1 value is a private individual's name it has been replaced
// with a placeholder, flagged inline at each site. Every other field is as
// captured. The provider reduces OWNERNME1 to a boolean and never returns the
// name, so the substitution changes no assertion — but a checked-in fixture is
// not the place for a private person's name, and an unqualified "verbatim"
// claim next to an edited value is exactly the half-true provenance statement
// CLAUDE.md rule 9's corollary warns about.
import { featureSet } from './index'

// ── 675 Ponce De Leon Ave NE — Ponce City Market, MRC-3-C ───────────────────
// Point 33.77245, -84.36580. Re-probed 3x in isolation: identical each pass.
// A conditional ("-C") district: the base MRC-3 figures apply, but §16-02.003(2)
// conditions held by the Clerk of Council may cut below them.
export const atlantaParcelPonce = featureSet({
  PARCELID: '14 001700100034',
  SITEADDRESS: '675 PONCE DE LEON AVE NE',
  'SHAPE.AREA': 561670.265245609,
  OWNERNME1: 'JAMESTOWN PONCE CITY MARKET LP',
  CLASSDSCRP: null,
  LIVUNITS: 259,
  TOT_APPR: 320000000.0,
  LANDAPPR: 22188000.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Old Fourth Ward',
  NPU: 'M',
})

export const atlantaZoningMrc3C = featureSet({
  ZONECLASS: 'MRC-3-C',
  ZONINGCODE: 'Multi-Family Residential',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH34MRMIRECODIRE_S16-34.028SPREM',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 1019 Virginia Ave NE — NC-11 Virginia-Highland ──────────────────────────
// Point 33.78230, -84.35380. NC-11 is one of the 173 mapped codes this build
// did NOT curate, so it must surface as a GAP: no height, no FAR, and above all
// no `farUnconstrained`.
export const atlantaParcelVirginiaHighland = featureSet({
  PARCELID: '17 000100080435',
  SITEADDRESS: '1019 VIRGINIA AVE NE',
  'SHAPE.AREA': 3418.13965123133,
  OWNERNME1: 'HIGHLANDS REAL ESTATE LLC',
  CLASSDSCRP: null,
  LIVUNITS: 0,
  TOT_APPR: 852200.0,
  LANDAPPR: 114200.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Virginia Highland',
  NPU: 'F',
})

export const atlantaZoningNc11 = featureSet({
  ZONECLASS: 'NC-11',
  ZONINGCODE: 'Neighborhood Commercial District',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH32KNCVIGHNECODI',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 152 Howard Street NE, Kirkwood — R-4A on a CONFORMING lot ───────────────
// Point 33.75660, -84.32370. Two things at once, both load-bearing:
//   · 12,534 sq ft ≥ the 7,500 sq ft R-4A minimum, so the headline 0.50 applies
//     and the substandard-lot branch must NOT fire.
//   · A DeKalb-side parcel (PARCELID prefix '15 '), where every Fulton
//     appraisal column is null. Note SITEADDRESS's trailing spaces and
//     CLASSDSCRP 'R3' — the DeKalb rows have a different fill pattern from the
//     Fulton rows, and both are real.
export const atlantaParcelHoward = featureSet({
  PARCELID: '15 211 02 096',
  SITEADDRESS: '152 HOWARD STREET NE    ',
  'SHAPE.AREA': 12534.437546033101,
  // PLACEHOLDER — the live OWNERNME1 here is a private individual. See header.
  OWNERNME1: 'PRIVATE OWNER (placeholder)',
  CLASSDSCRP: 'R3',
  LIVUNITS: null,
  TOT_APPR: null,
  LANDAPPR: null,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Kirkwood',
  NPU: 'O',
})

export const atlantaZoningR4A = featureSet({
  ZONECLASS: 'R-4A',
  ZONINGCODE: 'Single Family Residential',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH6ASIMIREDIRE',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 1789 Hosea L Williams Drive SE, Kirkwood — R-4A on a SUBSTANDARD lot ────
// Point 33.75300, -84.32900. 7,472.58 sq ft, i.e. 27 sq ft under the 7,500 sq ft
// minimum at §16-06A.007(1) — so §16-06A.008(5)b's "lesser of 3,750 sq ft or
// 0.65" governs, and on this lot the 3,750 sq ft limb is the smaller one.
export const atlantaParcelHosea = featureSet({
  PARCELID: '15 206 04 064',
  SITEADDRESS: '1789 HOSEA L WILLIAMS DRIVE SE    ',
  'SHAPE.AREA': 7472.583152272561,
  // PLACEHOLDER — the live OWNERNME1 here is a private individual. See header.
  OWNERNME1: 'PRIVATE OWNER (placeholder)',
  CLASSDSCRP: 'R3',
  LIVUNITS: null,
  TOT_APPR: null,
  LANDAPPR: null,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Kirkwood',
  NPU: 'O',
})

// ── 671 Waldo St SE, Grant Park — R-5 on a SUBSTANDARD lot ─────────────────
// Point 33.73600, -84.36700. 7,414.32 sq ft against the 7,500 sq ft minimum at
// §16-07.007(2), so §16-07.008(5)b applies — including its 1,800 sq ft
// guaranteed floor, which is the only place in this table that maps onto
// `farFloorSqFt`.
export const atlantaParcelWaldo = featureSet({
  PARCELID: '14 002200010384',
  SITEADDRESS: '671 WALDO ST SE',
  'SHAPE.AREA': 7414.3235529638705,
  // PLACEHOLDER — the live OWNERNME1 here is two private individuals. See header.
  OWNERNME1: 'PRIVATE OWNER (placeholder)',
  CLASSDSCRP: null,
  LIVUNITS: 1,
  TOT_APPR: 724800.0,
  LANDAPPR: 161700.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Grant Park',
  NPU: 'W',
})

export const atlantaZoningR5 = featureSet({
  ZONECLASS: 'R-5',
  ZONINGCODE: 'Single Family Residential',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH7TMIREDIRE',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 800 Cherokee Ave SE — Grant Park itself, R-5 inside the historic district ─
// Point 33.73950, -84.37150. City-owned, so `ownerPublic` fires.
export const atlantaParcelGrantPark = featureSet({
  PARCELID: '14 0044  LL0018',
  SITEADDRESS: '800 CHEROKEE AVE SE',
  'SHAPE.AREA': 1509954.52197512,
  OWNERNME1: 'CITY OF ATLANTA',
  CLASSDSCRP: null,
  LIVUNITS: 0,
  TOT_APPR: 27306700.0,
  LANDAPPR: 16122700.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Grant Park',
  NPU: 'W',
})

// ── 1600 Clifton Road NE — O-I, where the code states NO maximum height ─────
// Point 33.79913, -84.32511. Federally owned (the CDC campus), and a DeKalb-side
// parcel under the OTHER DeKalb land-lot prefix, '18 ' — which is why every
// appraisal column is null here too.
export const atlantaParcelClifton = featureSet({
  PARCELID: '18 058 03 013',
  SITEADDRESS: '1600 CLIFTON ROAD NE    ',
  'SHAPE.AREA': 2066359.70659483,
  OWNERNME1: 'UNITED STATES OF AMERICA',
  CLASSDSCRP: 'E1',
  LIVUNITS: null,
  TOT_APPR: null,
  LANDAPPR: null,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Emory',
  NPU: 'F',
})

export const atlantaZoningOi = featureSet({
  ZONECLASS: 'O-I',
  ZONINGCODE: 'Office-Institutional',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH10OFSTDIRE',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 3684 Kingsboro Rd, Ridgedale Park — PD-H, plan-governed ────────────────
// Point 33.85512, -84.35135.
export const atlantaParcelKingsboro = featureSet({
  PARCELID: '17 001000070286',
  SITEADDRESS: '3684 KINGSBORO RD',
  'SHAPE.AREA': 5902.96486024459,
  OWNERNME1: 'C H BRADDY MINISTRIES INC',
  CLASSDSCRP: null,
  LIVUNITS: 1,
  TOT_APPR: 1448500.0,
  LANDAPPR: 193400.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'Ridgedale Park',
  NPU: 'B',
})

export const atlantaZoningPdH = featureSet({
  ZONECLASS: 'PD-H',
  ZONINGCODE: 'Planned Development',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH19APLDEOUDIRE',
  SPI: ' ',
  SUBAREA: ' ',
  STATUS: 'Current',
})

// ── 680 Lee St SW — SPI-21 SA2, a MARTA site ───────────────────────────────
// Point 33.73570, -84.41400. An uncurated SPI subarea, so a gap; also the SPI /
// SUBAREA columns populated, which they are not on most rows.
export const atlantaParcelLeeSt = featureSet({
  PARCELID: '14 0107  LL0020',
  SITEADDRESS: '680 LEE ST SW',
  'SHAPE.AREA': 568858.2655191061,
  OWNERNME1: 'MARTA',
  CLASSDSCRP: null,
  LIVUNITS: 0,
  TOT_APPR: 20315300.0,
  LANDAPPR: 4880900.0,
  TAXYEAR: 2025,
  NEIGHBORHOOD: 'West End',
  NPU: 'T',
})

export const atlantaZoningSpi21 = featureSet({
  ZONECLASS: 'SPI-21 SA2',
  ZONINGCODE: 'Special Public Interest',
  ZONEDESC:
    'https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOORANDECO_PT16ZO_CH18USPHIWEENADPASPPUINDIRE',
  SPI: '21',
  SUBAREA: '2',
  STATUS: 'Current',
})

// ── Overlay layer (MapServer/1) ────────────────────────────────────────────
/** Grant Park: a single HC-20K overlay footprint. */
export const atlantaOverlayGrantPark = featureSet({
  ZONECLASS: 'HC20KSA1 - Grant Park',
  LABEL: 'HC-20K SA-1',
})
/** Ponce City Market: the BeltLine overlay alone. */
export const atlantaOverlayBeltline = featureSet({ ZONECLASS: 'Beltline', LABEL: 'BELTLINE' })
/** Inman Park: TWO overlays at one point, in the order the server returned them.
 *  Captured to pin that this layer really is multi-valued — the provider takes
 *  the first feature and must never be assumed to get exactly one. */
export const atlantaOverlayInmanPark = featureSet(
  { ZONECLASS: 'Beltline', LABEL: 'BELTLINE' },
  { ZONECLASS: 'HC20LSA1 - Inman Park SA 1', LABEL: 'HC-20L SA-1' },
)
/** 671 Waldo St SE: HC-20K first, BeltLine second — note the order is the
 *  REVERSE of the Inman Park capture, which is why nothing here may depend on
 *  the server's ordering. */
export const atlantaOverlayWaldo = featureSet(
  { ZONECLASS: 'HC20KSA1 - Grant Park', LABEL: 'HC-20K SA-1' },
  { ZONECLASS: 'Beltline', LABEL: 'BELTLINE' },
)
/** 3684 Kingsboro Rd. A parking overlay, not a historic or intensity one. */
export const atlantaOverlayBuckheadParking = featureSet({
  ZONECLASS: 'Buckhead Parking Overlay',
  LABEL: 'BH P OLA',
})
/** 1600 Clifton Road NE. */
export const atlantaOverlayEmoryParking = featureSet({
  ZONECLASS: 'Emory Campus Parking Overlay',
  LABEL: 'Emory Cam Pkng OLAY',
})
/** 680 Lee St SW: THREE overlays at one point. */
export const atlantaOverlayLeeSt = featureSet(
  { ZONECLASS: 'SPI-21 SA2 - Sign Overlay', LABEL: 'SPI-21 SA2-SIGN OLAY' },
  { ZONECLASS: 'Intown South Commercial Corridor', LABEL: 'Intown S Com Cor' },
  { ZONECLASS: 'Beltline', LABEL: 'BELTLINE' },
)

// ── Historic District layer (MapServer/6) ──────────────────────────────────
export const atlantaHistoricGrantPark = featureSet({
  DIST_1: 'Grant Park Historic District',
  DIST_2: 'Sub Area 2',
})

export const atlantaFloodX = featureSet({ FLD_ZONE: 'X' })

const NO_FEATURES = { features: [] }

// ⚠️ HOW TO READ THE ROUTE SETS BELOW. Each one composes the captures that the
// five services actually returned AT THE SAME POINT — the overlay and historic
// responses were re-queried at each scenario's own coordinate rather than
// inherited from the default set, because a scenario stitched together from
// three unrelated points would be a fixture that never existed. Where a route
// is NO_FEATURES it is because that layer genuinely returned zero features
// there, and that was checked, not assumed.

/** Default routing. The two LandUsePlanning layers used here are distinguished
 *  only by their layer index, so the route keys must be the full
 *  "MapServer/N" path — matching on "LandUsePlanning" alone would send the
 *  zoning, overlay and historic fetches to the same fixture. */
export const atlantaRoutes = {
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelPonce,
  'LandUsePlanning/MapServer/0': atlantaZoningMrc3C,
  'LandUsePlanning/MapServer/1': atlantaOverlayBeltline,
  'LandUsePlanning/MapServer/6': NO_FEATURES,
  NFHL: atlantaFloodX,
}

/** NC-11: a district Part 16 has, and this build has not read. */
export const atlantaRoutesNc11 = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelVirginiaHighland,
  'LandUsePlanning/MapServer/0': atlantaZoningNc11,
  'LandUsePlanning/MapServer/1': NO_FEATURES,
}

/** R-4A on a conforming 12,534 sq ft DeKalb lot. */
export const atlantaRoutesHoward = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelHoward,
  'LandUsePlanning/MapServer/0': atlantaZoningR4A,
  'LandUsePlanning/MapServer/1': NO_FEATURES,
}

/** R-4A on a 7,472 sq ft lot — 27 sq ft under the district minimum. */
export const atlantaRoutesHosea = {
  ...atlantaRoutesHoward,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelHosea,
}

/** R-5 on a 7,414 sq ft lot — the branch WITH the 1,800 sq ft guaranteed floor.
 *  Also inside the Grant Park historic district, which is what the live services
 *  return there. */
export const atlantaRoutesWaldo = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelWaldo,
  'LandUsePlanning/MapServer/0': atlantaZoningR5,
  'LandUsePlanning/MapServer/1': atlantaOverlayWaldo,
  'LandUsePlanning/MapServer/6': atlantaHistoricGrantPark,
}

/** Grant Park: city-owned, R-5, inside a designated historic district. */
export const atlantaRoutesGrantPark = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelGrantPark,
  'LandUsePlanning/MapServer/0': atlantaZoningR5,
  'LandUsePlanning/MapServer/1': atlantaOverlayGrantPark,
  'LandUsePlanning/MapServer/6': atlantaHistoricGrantPark,
}

/** O-I: the code states "Maximum height limitations. None". */
export const atlantaRoutesOi = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelClifton,
  'LandUsePlanning/MapServer/0': atlantaZoningOi,
  'LandUsePlanning/MapServer/1': atlantaOverlayEmoryParking,
}

/** PD-H: intensity and height come from the approving council ordinance. */
export const atlantaRoutesPdH = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelKingsboro,
  'LandUsePlanning/MapServer/0': atlantaZoningPdH,
  'LandUsePlanning/MapServer/1': atlantaOverlayBuckheadParking,
}

/** An uncurated SPI subarea on publicly owned land, under three overlays. */
export const atlantaRoutesSpi = {
  ...atlantaRoutes,
  'AdministrativeArea/TaxParcel/MapServer/0': atlantaParcelLeeSt,
  'LandUsePlanning/MapServer/0': atlantaZoningSpi21,
  'LandUsePlanning/MapServer/1': atlantaOverlayLeeSt,
}

/** A point the parcel layer covers but the zoning layer does not. */
export const atlantaRoutesNoZoning = {
  ...atlantaRoutes,
  'LandUsePlanning/MapServer/0': NO_FEATURES,
  'LandUsePlanning/MapServer/1': NO_FEATURES,
}
