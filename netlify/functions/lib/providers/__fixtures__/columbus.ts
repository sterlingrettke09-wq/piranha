// Canned Columbus responses for getColumbusParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-08 against the real services, not a hand-written approximation. That
// matters: a fixture invented to match the provider's expectations tests the
// provider against itself, which is the internal-verification trap CLAUDE.md
// rule 9 describes. These carry the upstream's actual field names, actual
// casing ('846 S HIGH ST'), actual nulls (RESYRBLT null on commercial-class
// records, BLDGAREA null on residential ones, WEB_LINK null on the Downtown
// District polygons) and actual value types (ACRES and every *VALUEBASE as
// floats, BLDGAREA as an integer).
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live OWNERNME1 value is a private individual's name it has been replaced
// with a placeholder, flagged inline at that one site. Every other field is as
// captured. The provider reduces the owner name to a boolean and never returns
// it, so the substitution changes no assertion — but a checked-in fixture is not
// the place for a private person's name, and an unqualified "verbatim" claim
// next to an edited value is exactly the half-true provenance statement
// CLAUDE.md rule 9's corollary warns about.
import { featureSet } from './index'

// ── 148 Dakota Ave, Franklinton — R2F, the ordinary Title 33 case ───────────
// Point 39.95600, -83.02700. Franklin County parcel 010-009995.
export const columbusParcelDakota = featureSet({
  PARCELID: '010-009995',
  SITEADDRESS: '148 DAKOTA AVE',
  ACRES: 0.09916554,
  // The trap field. 4320 here happens to be square feet; on ~2% of parcels the
  // same column holds acres. Never read by the provider. See its header.
  STATEDAREA: 4320.0,
  CLASSDSCRP: 'SINGLE FAMILY DWELLING, PLATTED LOT',
  // PLACEHOLDER — the live OWNERNME1 here is a private individual. See header.
  OWNERNME1: 'PRIVATE OWNER (placeholder)',
  RESYRBLT: 1893,
  BLDGAREA: null,
  FLOORCOUNT: null,
  LNDVALUEBASE: 18500.0,
  BLDVALUEBASE: 380400.0,
  TOTVALUEBASE: 398900.0,
  COUNTY: 'Franklin',
})

export const columbusZoningR2F = featureSet({
  CLASSIFICATION: 'R2F',
  GENERAL_ZONING_CATEGORY: 'Residential',
  HEIGHT_DISTRICT: 'H-35',
  ORD_NO: '1449-2010',
  CASE_NUMBER: 'Z10-012',
  WEB_LINK:
    'http://columbus.legistar.com/LegislationDetail.aspx?ID=1038702&GUID=4C32BE24-DDEB-438E-98A7-314C9F2AA5DD&Options=ID|Text|&Search=Z10-012',
})

// ── 846 S High St, Brewery District — UCT, a Title 34 (Zone In) parcel ──────
// Point 39.94500, -82.99664. Franklin County parcel 010-043106.
// Also the parcel whose Auditor record was pulled to establish what the
// *VALUEBASE columns actually mean — see the provider's ASSESSED VALUE note.
export const columbusParcelHighSt = featureSet({
  PARCELID: '010-043106',
  SITEADDRESS: '846 S HIGH ST',
  ACRES: 0.26539562,
  STATEDAREA: 11561.0,
  CLASSDSCRP: 'DWELLING CONVERTED TO OFFICE',
  OWNERNME1: 'WILIA HOLDING GROUP LLC',
  RESYRBLT: null,
  BLDGAREA: 4148,
  FLOORCOUNT: null,
  LNDVALUEBASE: 231100.0,
  BLDVALUEBASE: 398400.0,
  TOTVALUEBASE: 629500.0,
  COUNTY: 'Franklin',
})

export const columbusZoningUCT = featureSet({
  CLASSIFICATION: 'UCT',
  GENERAL_ZONING_CATEGORY: 'Mixed-Use',
  HEIGHT_DISTRICT: 'H-N/A',
  ORD_NO: '2113-2024',
  CASE_NUMBER: '2113-2024',
  WEB_LINK:
    'https://columbus.legistar.com/LegislationDetail.aspx?ID=6789485&GUID=1A3AD173-9153-4C20-B5E9-67AA04C1CF3E&Options=ID|Text|&Search=2113',
})

// ── 520 W Tenth Ave, OSU — LUCRPD. The UCR/UCRPD collision, live. ───────────
// Point 39.999, -83.014. State-owned, so it also exercises ownerPublic.
export const columbusParcelOSU = featureSet({
  PARCELID: '010-067007',
  SITEADDRESS: '520 W TENTH AVE',
  ACRES: 331.97743416,
  STATEDAREA: 14451610.0,
  CLASSDSCRP: 'EXEMPT PROPERTY OWNED BY STATE OF OH',
  OWNERNME1: 'STATE OF OHIO O S U',
  RESYRBLT: null,
  BLDGAREA: null,
  FLOORCOUNT: null,
  LNDVALUEBASE: 173490100.0,
  BLDVALUEBASE: 8011251000.0,
  TOTVALUEBASE: 8184741100.0,
  COUNTY: 'Franklin',
})

export const columbusZoningLUCRPD = featureSet({
  CLASSIFICATION: 'LUCRPD',
  GENERAL_ZONING_CATEGORY: 'Research Park',
  HEIGHT_DISTRICT: 'H-110',
  ORD_NO: '2699-88',
  CASE_NUMBER: 'Z88-1962',
  WEB_LINK:
    'https://columbus.legistar.com/LegislationDetail.aspx?ID=1622151&GUID=2B682C74-CC1F-4A28-8233-2F90CA3D4D0F&Options=ID|Text|Attachments|&Search=Z88-1962',
})

// ── The Ohio Statehouse block — DD / H-UNLTD, the height gap ────────────────
// Point 39.96154, -82.99893. WEB_LINK is genuinely null on these polygons.
export const columbusParcelStatehouse = featureSet({
  PARCELID: '010-067008',
  SITEADDRESS: 'S HIGH ST',
  ACRES: 9.93759274,
  STATEDAREA: 432870.0,
  CLASSDSCRP: 'EXEMPT PROPERTY OWNED BY STATE OF OH',
  OWNERNME1: 'STATE OF OHIO CAPITOL',
  RESYRBLT: null,
  BLDGAREA: 798272,
  FLOORCOUNT: null,
  LNDVALUEBASE: 61674300.0,
  BLDVALUEBASE: 76199900.0,
  TOTVALUEBASE: 137874200.0,
  COUNTY: 'Franklin',
})

export const columbusZoningDD = featureSet({
  CLASSIFICATION: 'DD',
  GENERAL_ZONING_CATEGORY: 'Downtown District',
  HEIGHT_DISTRICT: 'H-UNLTD',
  ORD_NO: '1532-2013',
  CASE_NUMBER: '1532-2013 Zone A',
  WEB_LINK: null,
})

// ── 1505-1509 Gerrard Ave — AR3 mapped H-65, the off-schedule height gap ────
// Point 39.99027, -83.03369. Ord. 0538-2025 § 2 establishes SIXTY (60) feet on
// this property; the layer maps H-65. That contradiction is why the provider
// resolves only the four symbols C.C. 3309.14 establishes.
export const columbusParcelGerrard = featureSet({
  PARCELID: '010-061978',
  SITEADDRESS: '1505 - 1509 GERRARD AVE',
  ACRES: 2.44145978,
  STATEDAREA: null,
  CLASSDSCRP: 'THREE FAMILY DWELLING, PLATTED LOT',
  OWNERNME1: 'RNB GERRARD PARTNERS LLC',
  RESYRBLT: 1972,
  BLDGAREA: null,
  FLOORCOUNT: null,
  LNDVALUEBASE: 183600.0,
  BLDVALUEBASE: 207700.0,
  TOTVALUEBASE: 391300.0,
  COUNTY: 'Franklin',
})

export const columbusZoningAR3H65 = featureSet({
  CLASSIFICATION: 'AR3',
  GENERAL_ZONING_CATEGORY: 'Multi-family',
  HEIGHT_DISTRICT: 'H-65',
  ORD_NO: '0538-2025',
  CASE_NUMBER: 'Z24-069',
  WEB_LINK:
    'https://columbus.legistar.com/LegislationDetail.aspx?ID=7158183&GUID=B7F82598-0854-4EEB-BEF8-5D239E7EDADB&Options=ID%7CText%7C&Search=Z24-069&FullText=1',
})

// ── 1494 N High St — UCR (Title 34) INSIDE the University District overlay ──
// Point 39.9930, -83.0060. The rule-13 case: C.C. 3304.03(H) puts Ch. 3325 on
// the list of Title 33 chapters that apply to the 2024 Zoning Code, so a FAR
// applies to a Title 34 parcel here.
export const columbusParcelUniversity = featureSet({
  PARCELID: '010-294232',
  SITEADDRESS: '1494 N HIGH ST',
  ACRES: 2.05027673,
  STATEDAREA: null,
  CLASSDSCRP: 'APARTMENTS 40 OR MORE RENTAL UNITS',
  OWNERNME1: 'ABY 52 LLC',
  RESYRBLT: null,
  BLDGAREA: 325684,
  FLOORCOUNT: null,
  LNDVALUEBASE: 3049200.0,
  BLDVALUEBASE: 55142700.0,
  TOTVALUEBASE: 58191900.0,
  COUNTY: 'Franklin',
})

export const columbusZoningUCR = featureSet({
  CLASSIFICATION: 'UCR',
  GENERAL_ZONING_CATEGORY: 'Mixed-Use',
  HEIGHT_DISTRICT: 'H-N/A',
  ORD_NO: '2113-2024',
  CASE_NUMBER: '2113-2024',
  WEB_LINK:
    'https://columbus.legistar.com/LegislationDetail.aspx?ID=6789485&GUID=1A3AD173-9153-4C20-B5E9-67AA04C1CF3E&Options=ID|Text|&Search=2113',
})

// ── A Dublin parcel: county property data exists, Columbus zoning does not ──
// Point 40.0992, -83.1141. The Corporate Boundary layer returns nothing here.
export const columbusParcelDublin = featureSet({
  PARCELID: '273-009979',
  SITEADDRESS: 'S HIGH ST',
  ACRES: 0.14349338,
  STATEDAREA: 6251.0,
  CLASSDSCRP: 'EXEMPT PROPERTY OWNED BY MUNICIPALS',
  OWNERNME1: 'CITY OF DUBLIN',
  RESYRBLT: null,
  BLDGAREA: null,
  FLOORCOUNT: null,
  LNDVALUEBASE: 109000.0,
  BLDVALUEBASE: 6300.0,
  TOTVALUEBASE: 115300.0,
  COUNTY: 'Franklin',
})

// ── Overlay layers ─────────────────────────────────────────────────────────
export const columbusCityBoundary = featureSet({ CITY_NAME: 'COLUMBUS' })

/** Layer 14 at the Brewery District point. */
export const columbusHistoricBrewery = featureSet({
  TYPE: 'Historic District',
  REVIEW_BODY: 'Historic Resources Commission',
  DISTRICT_NAME: 'Brewery District',
  PROPERTY_NAME: 'N/A',
})

/** Layer 14 at the Statehouse — TWO features, and the ORDER matters: the first
 *  is a Design Review Area (which is NOT historic) and the second the listed
 *  property. A provider that took features[0] would publish "Downtown District"
 *  as the historic district. */
export const columbusHistoricStatehouse = featureSet(
  {
    TYPE: 'Design Review Area',
    REVIEW_BODY: 'Downtown Commission',
    DISTRICT_NAME: 'Downtown District',
    PROPERTY_NAME: 'N/A',
  },
  {
    TYPE: 'Individual Listing',
    REVIEW_BODY: 'Historic Resources Commission',
    DISTRICT_NAME: null,
    PROPERTY_NAME: 'Ohio Statehouse',
  },
)

/** Layer 14 in the University Impact District — design review, not historic. */
export const columbusDesignReviewUID = featureSet({
  TYPE: 'Design Review Area',
  REVIEW_BODY: 'University Impact District Review Board',
  DISTRICT_NAME: 'University Impact District',
  PROPERTY_NAME: 'N/A',
})

/** Layer 16 at OSU. */
export const columbusPlanningOverlayUniversity = featureSet({ OVERLAY_NAME: 'University' })
/** Layer 16 at 1494 N High St. */
export const columbusPlanningOverlayUniversityImpact = featureSet({ OVERLAY_NAME: 'University/Impact' })

export const columbusFloodX = featureSet({ FLD_ZONE: 'X' })

const NO_FEATURES = { features: [] }

/** Default routing: 148 Dakota Ave, R2F, no overlays. The route keys are the
 *  full "MapServer/N" paths, because five of the seven fetches hit layers of the
 *  SAME MapServer — matching on "Zoning" alone would send all of them to one
 *  fixture. */
export const columbusRoutes = {
  'Applications/Zoning/MapServer/5': columbusParcelDakota,
  'Applications/Zoning/MapServer/20': columbusZoningR2F,
  'Applications/Zoning/MapServer/21': columbusCityBoundary,
  'Applications/Zoning/MapServer/14': NO_FEATURES,
  'Applications/Zoning/MapServer/16': NO_FEATURES,
  'Applications/Zoning/MapServer/15': NO_FEATURES,
  NFHL: columbusFloodX,
}

/** 846 S High St — a Title 34 UCT parcel in the Brewery District. */
export const columbusRoutesUCT = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelHighSt,
  'Applications/Zoning/MapServer/20': columbusZoningUCT,
  'Applications/Zoning/MapServer/14': columbusHistoricBrewery,
}

/** OSU — LUCRPD, the district string that must not reach the Urban Core table. */
export const columbusRoutesLUCRPD = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelOSU,
  'Applications/Zoning/MapServer/20': columbusZoningLUCRPD,
  'Applications/Zoning/MapServer/16': columbusPlanningOverlayUniversity,
}

/** Statehouse — DD / H-UNLTD, plus the two-feature historic layer. */
export const columbusRoutesDD = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelStatehouse,
  'Applications/Zoning/MapServer/20': columbusZoningDD,
  'Applications/Zoning/MapServer/14': columbusHistoricStatehouse,
}

/** Gerrard Ave — the off-schedule H-65 whose ordinance says 60 ft. */
export const columbusRoutesOffSchedule = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelGerrard,
  'Applications/Zoning/MapServer/20': columbusZoningAR3H65,
}

/** 1494 N High St — Title 34 inside the University District overlay. */
export const columbusRoutesUniversity = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelUniversity,
  'Applications/Zoning/MapServer/20': columbusZoningUCR,
  'Applications/Zoning/MapServer/14': columbusDesignReviewUID,
  'Applications/Zoning/MapServer/16': columbusPlanningOverlayUniversityImpact,
}

/** Dublin: a real county parcel outside the city limits. Corporate Boundary and
 *  the zoning layer both return nothing. */
export const columbusRoutesOutsideCity = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelDublin,
  'Applications/Zoning/MapServer/20': NO_FEATURES,
  'Applications/Zoning/MapServer/21': NO_FEATURES,
}

// ── A CONDOMINIUM STACK: twelve parcels on one footprint, unstable order ────
//
// Captured at 39.919036, -82.874822 (Tennyson Blvd, Edgewater). Twelve
// features, identical geometry, identical ACRES, different PARCELID and
// address. `nearestFeatureSet()` cannot break this tie — the centroids are the
// same point — so a provider that takes features[0] returns whichever parcel
// the server happened to list first.
//
// THIS IS NOT A THEORETICAL RISK, AND THE WAY IT WAS CAUGHT IS THE POINT.
// Four isolated probes 400 ms apart on 2026-08-08 all returned 010-350320
// first — a textbook "stable" result (CLAUDE.md rule 18: a plausible answer and
// a correct answer do not feel different). Ninety minutes later the layer was
// republished — SHP_UPLD_DATE moved to 2026-08-08T05:05:54 on every row — and
// the SAME point returned the SAME twelve parcels led by 010-350327. The
// ordering is a property of the server's storage, not of the query, and it
// changes whenever the layer is reloaded.
//
// The order below is VERBATIM from the post-republish capture, including the
// fact that it is neither PARCELID order nor address order. The provider sorts
// by PARCELID and must therefore return 010-350320 from this fixture.
const condoUnit = (PARCELID: string, SITEADDRESS: string) => ({
  PARCELID,
  SITEADDRESS,
  ACRES: 0.13413275,
  STATEDAREA: null,
  CLASSDSCRP: 'CONDO 40+ RENTAL UNITS',
  OWNERNME1: 'EDGEWATER OH OWNER LLC',
  RESYRBLT: null,
  BLDGAREA: null,
  FLOORCOUNT: null,
  LNDVALUEBASE: null,
  BLDVALUEBASE: null,
  TOTVALUEBASE: null,
  COUNTY: 'Franklin',
})

export const columbusParcelCondoStack = featureSet(
  condoUnit('010-350327', '2763 TENNYSON BLVD 408'),
  condoUnit('010-350330', '2765 TENNYSON BLVD #C'),
  condoUnit('010-350325', '2759 TENNYSON BLVD 406'),
  condoUnit('010-350331', '2765 TENNYSON BLVD #D'),
  condoUnit('010-350322', '2755 TENNYSON BLVD #C'),
  condoUnit('010-350328', '2765 TENNYSON BLVD #A'),
  condoUnit('010-350323', '2755 TENNYSON BLVD #D'),
  condoUnit('010-350329', '2765 TENNYSON BLVD #B'),
  condoUnit('010-350320', '2755 TENNYSON BLVD #A'),
  condoUnit('010-350326', '2761 TENNYSON BLVD 407'),
  condoUnit('010-350321', '2755 TENNYSON BLVD #B'),
  condoUnit('010-350324', '2757 TENNYSON BLVD 405'),
)

export const columbusRoutesCondoStack = {
  ...columbusRoutes,
  'Applications/Zoning/MapServer/5': columbusParcelCondoStack,
}
