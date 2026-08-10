// Canned Dallas responses for getDallasParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-09 against the real services, not a hand-written approximation. A
// fixture invented to match the provider's expectations tests the provider
// against itself, which is the internal-verification trap CLAUDE.md rule 9
// describes. These carry the upstream's actual field names, actual casing
// ("7322 THURSTON DR"), actual single-space padding on empty string columns
// (`PD_NUM: ' '`, `EXPIRES: ' '`), actual empty strings vs actual nulls (the
// parcel layer uses `''` on ordinary rows and `null` on the condominium rows),
// actual trailing spaces ("PD-269 (Tract A) ", "State Thomas ") and actual float
// precision on AREA_FEET.
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live TAXPANAME1 value is a private individual's name it has been replaced
// with a placeholder, flagged inline at the site. Every other field is as
// captured. The provider reduces TAXPANAME1 to a boolean and never returns the
// name, so the substitution changes no assertion — but a checked-in fixture is
// not the place for a private person's name, and an unqualified "verbatim"
// claim next to an edited value is exactly the half-true provenance statement
// CLAUDE.md rule 9's corollary warns about.
import { featureSet } from './index'

const NO_FEATURES = { features: [] }

// ── 7322 Thurston Dr — R-7.5(A), the most common district in Dallas ─────────
// Point 32.833874, -96.851017 (the parcel polygon's own centroid). Re-probed
// four times in isolation through the parcel and zoning layers: one distinct
// (ACCT, AREA_FEET, LONG_ZONE_DIST) triple on every pass.
export const dallasParcelThurston = featureSet({
  ACCT: '00000213379000000',
  ST_NUM: '7322',
  ST_DIR: '',
  ST_NAME: 'THURSTON DR',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 7609.918,
  PROP_CL: 'SINGLE FAMILY RESIDENCES',
  BLDG_CL: '08',
  // PLACEHOLDER — the live TAXPANAME1 here is a private individual. See header.
  TAXPANAME1: 'PRIVATE OWNER (placeholder)',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'A11',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000213379000000',
})

/** Note `PD_NUM: ' '` — the layer pads this column with a single space rather
 *  than nulling it on the 2,814 polygons that are not planned developments. */
export const dallasZoningR75 = featureSet({
  LONG_ZONE_DIST: 'R-7.5(A)',
  ZONE_DIST: 'R-7.5(A)',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: null,
  CASE_NUMBER: null,
})

// ── 301 Ross Ave — CA-1(A), the CBD, inside a historic overlay ──────────────
// Point 32.780464, -96.809435. Two things at once: the district whose code
// states "Maximum structure height is any legal height", and a real H-overlay
// footprint from the Historic Overlay layer.
export const dallasParcelRossAve = featureSet({
  ACCT: '00000100006000000',
  ST_NUM: '301',
  ST_DIR: '',
  ST_NAME: 'ROSS AVE',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 25796.11,
  PROP_CL: 'COMMERCIAL - VACANT PLOTTED LOTS/TRACTS',
  BLDG_CL: 'LAND ONLY',
  TAXPANAME1: 'M K T RAILROAD CO',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'C12',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000100006000000',
})

export const dallasZoningCa1 = featureSet({
  LONG_ZONE_DIST: 'CA-1(A)',
  ZONE_DIST: 'CA-1(A)',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: '29128',
  CASE_NUMBER: 'DCA 112-002',
})

export const dallasHistoricWestEnd = featureSet({
  H_OVERLAY: 'H/2',
  NAME: 'West End Historic District',
  ORD_NUM: '15203',
})

// ── 5225 Maple Ave — MF-3(A), the first district whose FAR slot holds a NUMBER ─
// Point 32.816978, -96.832597. §51A-4.116(c)(4)(D) "Maximum floor area ratio is
// 2.0", against R-7.5(A)'s "No maximum floor area ratio" in the same slot.
export const dallasParcelMapleAve = featureSet({
  ACCT: '00231800000010000',
  ST_NUM: '5225',
  ST_DIR: '',
  ST_NAME: 'MAPLE AVE',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 216190.763,
  PROP_CL: 'MFR - APARTMENTS',
  BLDG_CL: 'APARTMENT (BRICK EXTERIOR)',
  TAXPANAME1: 'MAEDC MAPLE APTS LLC',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'B11',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00231800000010000',
})

/** Note `PD_NUM: null` here against `' '` on the Thurston row — the same column
 *  arrives both ways on different rows, which is why the provider treats
 *  whitespace-only as absent rather than testing for null. */
export const dallasZoningMf3 = featureSet({
  LONG_ZONE_DIST: 'MF-3(A)',
  ZONE_DIST: 'MF-3(A)',
  PD_NUM: null,
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: null,
  CASE_NUMBER: null,
})

// ── 2520 N Carroll Ave — CR, the per-program FAR sub-cap ───────────────────
// Point 32.809185, -96.787475. An OFFICE BUILDING in a district that caps
// office at 0.5 and all uses combined at 0.75.
export const dallasParcelCarroll = featureSet({
  ACCT: '00000193942000000',
  ST_NUM: '2520',
  ST_DIR: '',
  ST_NAME: 'N CARROLL AVE',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 8502.016,
  PROP_CL: 'COMMERCIAL IMPROVEMENTS',
  BLDG_CL: 'OFFICE BUILDING',
  TAXPANAME1: 'EAST DALLAS COLLABORATIVE',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'F10',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000193942000000',
})

export const dallasZoningCr = featureSet({
  LONG_ZONE_DIST: 'CR',
  ZONE_DIST: 'CR',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: '19455',
  CASE_NUMBER: 'Transition',
})

// ── 2715 Main St — PD-269 Deep Ellum, plan-governed ────────────────────────
// Point 32.784, -96.7838. 18% of the city's acreage is PD. Note the PD
// Subdistricts layer's own trailing space in "PD-269 (Tract A) ".
export const dallasParcelMainSt = featureSet({
  ACCT: '00000110905000000',
  ST_NUM: '2715',
  ST_DIR: '',
  ST_NAME: 'MAIN ST',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 10058.179,
  PROP_CL: 'COMMERCIAL IMPROVEMENTS',
  BLDG_CL: 'RETAIL STRIP',
  TAXPANAME1: 'MAIN PROPERTIES LLC',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'F10',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000110905000000',
})

export const dallasZoningPd269 = featureSet({
  LONG_ZONE_DIST: 'PD-269',
  ZONE_DIST: 'PD',
  PD_NUM: '269',
  CD_NUM: null,
  COMMON_NAME: 'Deep Ellum/Near East Side District',
  ORD_NUM: '29357',
  CASE_NUMBER: 'Z123-267',
})

export const dallasPdSubTractA = featureSet({
  LONG_ZONE_DIST: 'PD-269 (Tract A) ',
  PD_NUM: '269',
  SUBDIST1: 'Tract A',
  SUBDIST2: null,
  COMMON_NAME: 'Deep Ellum/Near East Side District',
  ORD_NUM: '19532',
})

// ── 410 N Bishop Ave — CD-7 Bishop/Eighth, conservation district ───────────
// Point 32.748664, -96.82815.
export const dallasParcelBishop = featureSet({
  ACCT: '00000254731000000',
  ST_NUM: '410',
  ST_DIR: '',
  ST_NAME: 'N BISHOP AVE',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 18009.243,
  PROP_CL: 'COMMERCIAL IMPROVEMENTS',
  BLDG_CL: 'RETAIL STRIP',
  TAXPANAME1: 'BISHOP STREET PARTNERS JV',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'F10',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000254731000000',
})

export const dallasZoningCd7 = featureSet({
  LONG_ZONE_DIST: 'CD-7',
  ZONE_DIST: 'CD',
  PD_NUM: null,
  CD_NUM: '7',
  COMMON_NAME: 'Bishop Eighth Conservation District',
  ORD_NUM: '27946',
  CASE_NUMBER: 'Z089-219',
})

// ── 1801 E Wheatland Rd — WMU-5, an Article XIII form district ─────────────
// Point 32.651758, -96.796745. One of the 254.6 acres this build deliberately
// did NOT read, so it must surface as a GAP — above all with no
// `farUnconstrained`.
export const dallasParcelWheatland = featureSet({
  ACCT: '00000754594000000',
  ST_NUM: '1801',
  ST_DIR: '',
  ST_NAME: 'E WHEATLAND RD',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 2794145.514,
  PROP_CL: 'COMMERCIAL IMPROVEMENTS',
  BLDG_CL: 'CONVERTED RESIDENCE (FRAME EXTERIOR)',
  TAXPANAME1: 'RKCJ LLC',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'F10',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=00000754594000000',
})

export const dallasZoningWmu5 = featureSet({
  LONG_ZONE_DIST: 'WMU-5',
  ZONE_DIST: 'WMU-5',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: '33157',
  CASE_NUMBER: 'Z245-176',
})

// ── 2826 Guillot St — a CHAPTER 51 stray, plus a live SUP ──────────────────
// Point 32.79554, -96.796343. LONG_ZONE_DIST "GR Chap 51" with ZONE_DIST "GR":
// a district of the FORMER Dallas Development Code, which Chapter 51A does not
// establish. Three such polygons exist citywide (4.4 acres). Note the SUP row's
// `EXPIRES: ' '` and the COMMON_NAME's trailing space.
export const dallasParcelGuillot = featureSet({
  ACCT: '0005730H0005B0000',
  ST_NUM: '2826',
  ST_DIR: '',
  ST_NAME: 'GUILLOT ST',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 90891.747,
  PROP_CL: 'ELECTRIC COMPANIES',
  BLDG_CL: 'LAND ONLY',
  // Captured as spelled upstream, typo and all.
  TAXPANAME1: 'ONCOR ELECRTIC DELIVERY COMPANY',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'J30',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=0005730H0005B0000',
})

export const dallasZoningGrChap51 = featureSet({
  LONG_ZONE_DIST: 'GR Chap 51',
  ZONE_DIST: 'GR',
  PD_NUM: null,
  CD_NUM: null,
  COMMON_NAME: 'State Thomas ',
  ORD_NUM: null,
  CASE_NUMBER: null,
})

export const dallasSupSubstation = featureSet({
  SUP_NUM: '835',
  SPECIFICUSE: 'Electric Substation',
  STATUS: 'Permanent',
  EXPIRES: ' ',
  ORD_NUM: '17052',
})

// ── 717 N Harwood — ACCT 'MULTIPLE', the condominium footprint ─────────────
// Point 32.7876, -96.796. Measured citywide: 3,660 of 500,142 parcel rows carry
// ACCT 'MULTIPLE' (2,564 of them in Dallas), and on those rows the address,
// owner and classification columns are ALL null while the geometry and area are
// real. The Website column switches to the appraisal district's GIS-by-footprint
// page rather than an account page, which is what identifies the shape.
export const dallasParcelHarwoodCondo = featureSet({
  ACCT: 'MULTIPLE',
  ST_NUM: null,
  ST_DIR: null,
  ST_NAME: null,
  ST_TYPE: null,
  UNITID: null,
  AREA_FEET: 237085.266,
  PROP_CL: null,
  BLDG_CL: null,
  TAXPANAME1: null,
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: '',
  Website: 'https://www.dallascad.org/AcctDetailGIS.aspx?ID=CONDO00C5715CONDO',
})

export const dallasSupVehicleDisplay = featureSet({
  SUP_NUM: '2621',
  SPECIFICUSE: 'Vehicle display, sales, and service',
  STATUS: 'Permanent',
  EXPIRES: null,
  ORD_NUM: '33341',
})

// ── 4200 Mockingbird Ln — HIGHLAND PARK, inside the Dallas bbox ────────────
// Point 32.8354, -96.8068. The parcel layer is regional ("Tax parcels from
// Dallas, Collin, Denton, Kaufman and Rockwall county appraisal districts.
// Includes City of Dallas and one-mile buffer" — the service's own description);
// only 290,743 of its 500,142 rows carry CITY='DALLAS'. The zoning layer stops
// at the city limits. Highland Park and University Park are enclaves entirely
// INSIDE the Dallas bounding box, so this is not an edge case a bbox can
// exclude — it must render as a gap.
export const dallasParcelHighlandPark = featureSet({
  ACCT: '600865000B0010000',
  ST_NUM: '4200',
  ST_DIR: '',
  ST_NAME: 'MOCKINGBIRD LN',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 422633.986,
  PROP_CL: 'UNASSIGNED',
  BLDG_CL: 'SHOPPING CENTER',
  TAXPANAME1: 'HP VILLAGE PARTNERS LP',
  CITY: 'HIGHLAND PARK',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'F10',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=600865000B0010000',
})

// ── 2752 Gaston Ave — MU-3, base-vs-mixed-use-project ──────────────────────
// Point 32.786294, -96.785286.
export const dallasParcelGaston = featureSet({
  ACCT: '000487000A0010000',
  ST_NUM: '2752',
  ST_DIR: '',
  ST_NAME: 'GASTON AVE',
  ST_TYPE: '',
  UNITID: '',
  AREA_FEET: 547130.755,
  PROP_CL: 'MFR - APARTMENTS',
  BLDG_CL: 'APARTMENT (BRICK EXTERIOR)',
  TAXPANAME1: 'DEEP ELLUM MARQUIS LP',
  CITY: 'DALLAS',
  COUNTY: 'DALLAS COUNTY',
  APPRAISALYEAR: 2026,
  SPTBCODE: 'B11',
  Website: 'https://www.dallascad.org/AcctDetail.aspx?ID=000487000A0010000',
})

export const dallasZoningMu3 = featureSet({
  LONG_ZONE_DIST: 'MU-3',
  ZONE_DIST: 'MU-3',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: null,
  CASE_NUMBER: null,
})

// A synthesised pair, and the ONLY one in this file — flagged because the rest
// are captures. The live layer carries exactly one polygon whose
// LONG_ZONE_DIST is the typo "MU=1" against a correct ZONE_DIST "MU-1"
// (2.5 acres, measured over all 3,815 polygons). It was found by tabulating the
// layer, not by clicking it, so no point query for it was captured; these two
// field values are the ones the tabulation returned, in the shape a point query
// returns them. It exists to exercise the both-fields resolution path.
export const dallasZoningMuTypo = featureSet({
  LONG_ZONE_DIST: 'MU=1',
  ZONE_DIST: 'MU-1',
  PD_NUM: ' ',
  CD_NUM: null,
  COMMON_NAME: null,
  ORD_NUM: null,
  CASE_NUMBER: null,
})

export const dallasFloodX = featureSet({ FLD_ZONE: 'X' })

// ⚠️ HOW TO READ THE ROUTE SETS BELOW. Each composes the captures that the six
// services actually returned AT THE SAME POINT — the overlay, PD-subdistrict,
// historic and SUP responses were queried at each scenario's own coordinate
// rather than inherited from the default set, because a scenario stitched
// together from unrelated points would be a fixture that never existed. Where a
// route is NO_FEATURES it is because that layer genuinely returned zero features
// there, and that was checked, not assumed.
//
// The route keys must include the layer index: "sdc_public/Zoning/MapServer"
// alone would send the base-zoning, PD-subdistrict, historic and SUP fetches to
// the same fixture.

/** The city-limits polygon, verbatim from a point query at the Thurston Dr probe
 *  (2026-08-09). The layer holds exactly ONE feature, so its presence at a point
 *  is the whole signal. */
export const dallasInsideCityLimits = featureSet({ OBJECTID: 2416, CITY: 'Dallas' })

/** Default routing: 7322 Thurston Dr, R-7.5(A), no overlays of any kind. */
export const dallasRoutes = {
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelThurston,
  'Basemap/CityLimits/MapServer/0': dallasInsideCityLimits,
  'sdc_public/Zoning/MapServer/15': dallasZoningR75,
  'sdc_public/Zoning/MapServer/9': NO_FEATURES,
  'sdc_public/Zoning/MapServer/2': NO_FEATURES,
  'sdc_public/Zoning/MapServer/4': NO_FEATURES,
  NFHL: dallasFloodX,
}

/** CA-1(A) in the West End historic overlay. */
export const dallasRoutesCa1 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelRossAve,
  'sdc_public/Zoning/MapServer/15': dallasZoningCa1,
  'sdc_public/Zoning/MapServer/2': dallasHistoricWestEnd,
}

/** MF-3(A): the district whose FAR slot holds a number. */
export const dallasRoutesMf3 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelMapleAve,
  'sdc_public/Zoning/MapServer/15': dallasZoningMf3,
}

/** CR: an office building where the office sub-cap binds below the ceiling. */
export const dallasRoutesCr = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelCarroll,
  'sdc_public/Zoning/MapServer/15': dallasZoningCr,
}

/** PD-269 Deep Ellum, with its Tract A subdistrict. */
export const dallasRoutesPd269 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelMainSt,
  'sdc_public/Zoning/MapServer/15': dallasZoningPd269,
  'sdc_public/Zoning/MapServer/9': dallasPdSubTractA,
}

/** CD-7 Bishop/Eighth conservation district. */
export const dallasRoutesCd7 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelBishop,
  'sdc_public/Zoning/MapServer/15': dallasZoningCd7,
}

/** WMU-5: a real mapped district this build has not read. */
export const dallasRoutesWmu5 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelWheatland,
  'sdc_public/Zoning/MapServer/15': dallasZoningWmu5,
}

/** "GR Chap 51": a superseded Chapter 51 district, under a permanent SUP. */
export const dallasRoutesChap51 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelGuillot,
  'sdc_public/Zoning/MapServer/15': dallasZoningGrChap51,
  'sdc_public/Zoning/MapServer/4': dallasSupSubstation,
}

/** A condominium footprint: real geometry, ACCT 'MULTIPLE', no address, no owner. */
export const dallasRoutesCondo = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelHarwoodCondo,
  'sdc_public/Zoning/MapServer/15': dallasZoningCa1,
  'sdc_public/Zoning/MapServer/4': dallasSupVehicleDisplay,
}

/** Highland Park: the parcel layer covers it, the zoning layer does not, and the
 *  city-limits polygon does not contain it. Verified live 2026-08-09 at
 *  32.840410, -96.795804 (3800 SHENANDOAH ST, CITY='HIGHLAND PARK'): parcel
 *  returns a feature, zoning returns zero, city limits returns zero. */
export const dallasRoutesHighlandPark = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelHighlandPark,
  'Basemap/CityLimits/MapServer/0': NO_FEATURES,
  'sdc_public/Zoning/MapServer/15': NO_FEATURES,
}

/** The gate's degrade-open path: the boundary layer is down, everything else is
 *  a normal in-city response. */
export const dallasRoutesCityLimitsDown = {
  ...dallasRoutes,
  'Basemap/CityLimits/MapServer/0': () => {
    throw new Error('city limits down')
  },
}

/** ⚠️ THE CASE THAT REJECTED THE ATTRIBUTE PREDICATE — a verbatim capture, all
 *  nulls and all real. Point-queried live 2026-08-09 at 33.00695, -96.83756, a
 *  coordinate that surfaced in a random cross-tab of 119 points rather than
 *  being hunted for. The parcel row carries `CITY: null` (and a null ACCT, owner
 *  and address with it), the zoning layer returns `TH-3(A)`, and the city-limits
 *  polygon contains the point. `CITY = 'DALLAS'` would refuse a parcel Dallas
 *  demonstrably zones — an answer rendered as a gap, rule 5 in the direction the
 *  attribute predicate cannot see. The polygon gate admits it. */
export const dallasRoutesNullCityAttribute = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': featureSet({
    ACCT: null,
    ST_NUM: null,
    ST_DIR: null,
    ST_NAME: null,
    ST_TYPE: null,
    UNITID: null,
    AREA_FEET: 6018.753,
    PROP_CL: null,
    BLDG_CL: null,
    TAXPANAME1: null,
    CITY: null,
    COUNTY: null,
    APPRAISALYEAR: null,
    SPTBCODE: 'A1',
    Website: null,
  }),
  'sdc_public/Zoning/MapServer/15': featureSet({
    LONG_ZONE_DIST: 'TH-3(A)',
    ZONE_DIST: 'TH-3(A)',
    PD_NUM: ' ',
    CD_NUM: null,
    COMMON_NAME: null,
    ORD_NUM: null,
    CASE_NUMBER: null,
  }),
}

/** MU-3: base figures, with the mixed-use-project tiers as alternatives. */
export const dallasRoutesMu3 = {
  ...dallasRoutes,
  'Basemap/DallasTaxParcels/MapServer/0': dallasParcelGaston,
  'sdc_public/Zoning/MapServer/15': dallasZoningMu3,
}

/** ⚠️ THE ONE SYNTHETIC PAIRING IN THIS FILE, and it is flagged rather than
 *  buried because every other route set composes captures taken at the SAME
 *  point. This one puts the tabulated `MU=1` zoning row against the Thurston Dr
 *  parcel — two real records that do not sit at one coordinate. It exists only
 *  to exercise the both-fields resolution path and the MU-1 story-slot branch,
 *  neither of which touches the parcel row; nothing here asserts anything about
 *  what stands at 7322 Thurston Dr. */
export const dallasRoutesMuTypo = {
  ...dallasRoutes,
  'sdc_public/Zoning/MapServer/15': dallasZoningMuTypo,
}
