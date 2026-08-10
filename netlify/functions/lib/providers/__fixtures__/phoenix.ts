// Canned Phoenix responses for getPhoenixParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-09 against the real services, not a hand-written approximation. A
// fixture invented to match the provider's expectations tests the provider
// against itself, which is the internal-verification trap CLAUDE.md rule 9
// describes.
//
// These therefore keep the upstream's actual shapes, and each of them is load
// bearing somewhere in the provider:
//   · the parenthesised field name `'SHAPE.STArea()'`, exactly as ArcGIS keys it
//   · `ADDRESS` with runs of internal spaces and the city and ZIP appended
//     ("805 W AMELIA AVE   PHOENIX  85013"), and one row where it is nothing but
//     eight spaces
//   · single-space padding on empty string columns (`TOD: ' '`, `HISTORIC: ' '`,
//     `ORD_NUM: ' '`)
//   · right-padded fixed-width strings on the assessor table
//     (`FCV_CUR: '422000         '`, `JURISDICTION: 'PHOENIX      …'`)
//   · numbers delivered as strings ("1510.00", "1.00", "1952") and CONST_YEAR
//     delivered as four spaces when unknown
//   · real nulls (`STREET_NUM: null` on the unaddressed parcel,
//     `NUMBER_STORIES: null`)
//   · full float precision on SHAPE.STArea()
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live OWNER / assessor value is a private individual's name it has been
// replaced with a placeholder, flagged inline at each site. Every other field is
// as captured. The provider reduces OWNER to a boolean and never returns the
// name, so the substitution changes no assertion — but a checked-in fixture is
// not the place for a private person's name, and an unqualified "verbatim" claim
// next to an edited value is exactly the half-true provenance statement rule 9's
// corollary warns about.
import { featureSet } from './index'

// ── 805 W Amelia Ave — R1-6, the probe parcel ───────────────────────────────
// Point 33.493479, -112.08442 — the polygon's own centroid, not an address pin.
// Six isolated calls 400 ms apart returned exactly one feature, parcel
// 110-11-022, SHAPE.STArea() 7024.7741 and ZONING 'R1-6' on every pass.
export const phoenixParcelAmelia = featureSet({
  APN: '110-11-022',
  ADDRESS: '805 W AMELIA AVE   PHOENIX  85013',
  STREET_NUM: '805',
  STREET_DIR: 'W',
  STREET_NAME: 'AMELIA',
  STREET_TYPE: 'AVE',
  STREET_POSTDIR: null,
  // PLACEHOLDER — the live OWNER here is a private individual. See header.
  OWNER: 'PRIVATE OWNER (placeholder)',
  'SHAPE.STArea()': 7024.774121869425,
  DESCRIPTION: 'SFR GRADE 010-3 URBAN SUBDIVIDED',
  PROPERTY_USE_CODE: '0131',
  PARCEL_GROUP_CLASS: 'RESIDENTIAL',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=11011022&slayer=0&exprnum=0',
})

export const phoenixSuppAmelia = featureSet({
  APN_DASH: '110-11-022',
  CONST_YEAR: '1952',
  LIVING_SPACE: '1510.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '422000         ',
  LPV_CUR: '162262         ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'R1-6      ',
})

export const phoenixZoningR16 = featureSet({
  ZONING: 'R1-6',
  LABEL1: 'R1-6',
  GEN_ZONE: 'SF Residential',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: ' ',
  ORD_NUM: ' ',
  ACRES: 100.76684808,
})

// ── 2921 N 8th Ave — R1-6 inside the Campus Vista Historic District ─────────
// Point 33.481298, -112.083827. The zoning layer's own HISTORIC column reads
// 'HP' here and LABEL1 carries the suffix, while the separate Historic
// Properties layer names the district. Both are captured because the provider
// must prefer the named district and must not invent one from the 'HP' flag.
export const phoenixParcelCampusVista = featureSet({
  APN: '110-30-099',
  ADDRESS: '2921 N 8TH AVE   PHOENIX  85013',
  STREET_NUM: '2921',
  STREET_DIR: 'N',
  STREET_NAME: '8TH',
  STREET_TYPE: 'AVE',
  STREET_POSTDIR: null,
  // PLACEHOLDER — the live OWNER here is two private individuals. See header.
  OWNER: 'PRIVATE OWNER (placeholder)',
  'SHAPE.STArea()': 8047.064656549452,
  DESCRIPTION: 'SFR GRADE 010-3 URBAN SUBDIVIDED',
  PROPERTY_USE_CODE: '0131',
  PARCEL_GROUP_CLASS: 'RESIDENTIAL',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=11030099&slayer=0&exprnum=0',
})

export const phoenixSuppCampusVista = featureSet({
  APN_DASH: '110-30-099',
  CONST_YEAR: '1941',
  LIVING_SPACE: '1728.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '441000         ',
  LPV_CUR: '131759         ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'R1-6      ',
})

export const phoenixZoningR16Hp = featureSet({
  ZONING: 'R1-6',
  LABEL1: 'R1-6 HP',
  GEN_ZONE: 'SF Residential',
  TOD: ' ',
  HISTORIC: 'HP',
  REDEFINE1: 'Z-156-02',
  ORD_NUM: ' ',
  ACRES: 40.00716938,
})

export const phoenixHistoricCampusVista = featureSet({
  NAME: 'Campus Vista Historic District',
  TYPE: 'District - Residential',
  STATUS: 'Listed - Phoenix and National Registers',
})

// ── 7007 W Indian School Rd — R-5, "4 stories and 48 feet" ──────────────────
// Point 33.49265198, -112.21058552. The counterpart to R-4A below: same 48 feet,
// and here the code DOES state a storey count.
export const phoenixParcelIndianSchool = featureSet({
  APN: '102-21-023H',
  ADDRESS: '7007 W INDIAN SCHOOL RD   PHOENIX  85033',
  STREET_NUM: '7007',
  STREET_DIR: 'W',
  STREET_NAME: 'INDIAN SCHOOL',
  STREET_TYPE: 'RD',
  STREET_POSTDIR: null,
  OWNER: 'TIDES ON 71ST OWNER LLC',
  'SHAPE.STArea()': 582476.6725909077,
  DESCRIPTION: 'APARTMENTS 100+ UNITS 2 STORY',
  PROPERTY_USE_CODE: '0376',
  PARCEL_GROUP_CLASS: 'RESIDENTIAL',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=10221023H&slayer=0&exprnum=0',
})

export const phoenixSuppIndianSchool = featureSet({
  APN_DASH: '102-21-023H',
  CONST_YEAR: '1985',
  // ⚠️ Zero on an apartment complex of 100+ units. LIVING_SPACE is the assessor's
  // RESIDENTIAL living-area field and reads 0.00 on multi-family and commercial
  // rows alike, so a 0 here means "not published for this class", never "no
  // building". The provider maps 0 to null for exactly this reason.
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: '2.00',
  FCV_CUR: '120691900      ',
  LPV_CUR: '35984710       ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'R-5       ',
})

export const phoenixZoningR5 = featureSet({
  ZONING: 'R-5',
  LABEL1: 'R-5',
  GEN_ZONE: 'MF Residential',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: ' ',
  ORD_NUM: ' ',
  ACRES: 19.86972295,
})

// ── 4050 N Central Ave — C-3 under three overlays ───────────────────────────
// Point 33.49406723, -112.0743961. Measured: this point returns THREE overlay
// polygons at once, in the order the server gave them, and only the first is
// marked REGULATORY = 'Yes'. Captured to pin that the layer is multi-valued and
// that the provider must not assume exactly one.
export const phoenixParcelCentralC3 = featureSet({
  APN: '118-26-024E',
  ADDRESS: '4050 N CENTRAL AVE   PHOENIX  85012',
  STREET_NUM: '4050',
  STREET_DIR: 'N',
  STREET_NAME: 'CENTRAL',
  STREET_TYPE: 'AVE',
  STREET_POSTDIR: null,
  OWNER: 'MASYNO CENTRAL COMPANY LLC',
  'SHAPE.STArea()': 27780.22404293767,
  DESCRIPTION: 'RESTAURANT FAST FOOD',
  PROPERTY_USE_CODE: '2030',
  PARCEL_GROUP_CLASS: 'BUSINESS',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=11826024E&slayer=0&exprnum=0',
})

export const phoenixSuppCentralC3 = featureSet({
  APN_DASH: '118-26-024E',
  CONST_YEAR: '1978',
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '1942664        ',
  LPV_CUR: '1342209        ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'C-3       ',
})

export const phoenixZoningC3 = featureSet({
  ZONING: 'C-3',
  LABEL1: 'C-3',
  GEN_ZONE: 'Commercial',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: ' ',
  ORD_NUM: ' ',
  ACRES: 21.61577145,
})

export const phoenixOverlaysCentral = featureSet(
  { NAME: 'Transit Overlay District (TOD-1)', REGULATORY: 'Yes' },
  { NAME: 'Central Avenue Development Standards', REGULATORY: 'No' },
  { NAME: 'TOD District - Midtown', REGULATORY: 'No' },
)

// ── 130 N Central Ave — DTC-BCORE, an uncurated Downtown Code district ──────
// Point 33.4500, -112.0740. Chapter 12 is form-based and was NOT read in this
// build, so this must surface as a GAP: no height, no coverage, and above all no
// `farUnconstrained`.
export const phoenixParcelDowntown = featureSet({
  APN: '112-21-057',
  ADDRESS: '130 N CENTRAL AVE   PHOENIX  85004',
  STREET_NUM: '130',
  STREET_DIR: 'N',
  STREET_NAME: 'CENTRAL',
  STREET_TYPE: 'AVE',
  STREET_POSTDIR: null,
  OWNER: '130 NORTH CENTRAL LLC',
  'SHAPE.STArea()': 6914.708338392371,
  DESCRIPTION: 'STORE & OFFICE OR STORE & APT COMBO',
  PROPERTY_USE_CODE: '1210',
  PARCEL_GROUP_CLASS: 'BUSINESS',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=11221057&slayer=0&exprnum=0',
})

export const phoenixSuppDowntown = featureSet({
  APN_DASH: '112-21-057',
  CONST_YEAR: '1929',
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: '3.00',
  FCV_CUR: '4353171        ',
  LPV_CUR: '1458550        ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'DTC-BCORE ',
})

export const phoenixZoningDtcBcore = featureSet({
  ZONING: 'DTC-BCORE',
  LABEL1: 'DTC-Business Core*',
  GEN_ZONE: 'Downtown Code',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: 'Z-1-10',
  ORD_NUM: 'G-5490',
  ACRES: 344.58764551,
})

// ── W Buckeye Rd — CP/GCP, the district where the FAR SLOT EXISTS ───────────
// Point 33.433289, -112.266866. §626.H.1's Commerce Park table has a FAR row and
// this column holds an em dash, so the module must NOT claim the code imposes no
// FAR here — the one district in the table that refuses `farUnconstrained`.
//
// Also the unaddressed row: ADDRESS is eight spaces and every STREET_* component
// is null, which is what forces the address fallback.
export const phoenixParcelCommercePark = featureSet({
  APN: '101-14-008S',
  ADDRESS: '        ',
  STREET_NUM: null,
  STREET_DIR: null,
  STREET_NAME: null,
  STREET_TYPE: null,
  STREET_POSTDIR: null,
  OWNER: 'WEST BUCKEYE RD LP',
  'SHAPE.STArea()': 1459705.1076978212,
  DESCRIPTION: 'VACANT INDUSTRIAL URBAN NON-SUBDIVIDED',
  PROPERTY_USE_CODE: '0032',
  PARCEL_GROUP_CLASS: 'BUSINESS',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=10114008S&slayer=0&exprnum=0',
})

export const phoenixSuppCommercePark = featureSet({
  APN_DASH: '101-14-008S',
  // Four spaces, not null and not '0' — the assessor's "unknown year" fill.
  CONST_YEAR: '    ',
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: null,
  FCV_CUR: '11907600       ',
  LPV_CUR: '4638379        ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'CP/GCP    ',
})

export const phoenixZoningCpGcp = featureSet({
  ZONING: 'CP/GCP',
  LABEL1: 'CP/GCP*',
  GEN_ZONE: 'Industrial',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: 'Z-36-13',
  ORD_NUM: 'G-5870',
  ACRES: 153.18077469,
})

// ── 9910 W Montebello Ave — PUD, plan-governed ──────────────────────────────
// Point 33.52011381, -112.27363286. Note the ADDRESS names GLENDALE while the
// assessor's JURISDICTION reads PHOENIX and the parcel sits inside a Phoenix
// zoning polygon — a real row, and the reason the provider never derives a
// jurisdiction from the address string.
export const phoenixParcelPud = featureSet({
  APN: '102-15-006B',
  ADDRESS: '9910 W MONTEBELLO AVE   GLENDALE  85307',
  STREET_NUM: '9910',
  STREET_DIR: 'W',
  STREET_NAME: 'MONTEBELLO',
  STREET_TYPE: 'AVE',
  STREET_POSTDIR: null,
  OWNER: 'CABANA ALDEA LLC',
  'SHAPE.STArea()': 342704.16046003444,
  DESCRIPTION: 'APARTMENTS 100+ UNITS 3 OR MORE STORY',
  PROPERTY_USE_CODE: '0377',
  PARCEL_GROUP_CLASS: 'RESIDENTIAL',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=10215006B&slayer=0&exprnum=0',
})

export const phoenixSuppPud = featureSet({
  APN_DASH: '102-15-006B',
  CONST_YEAR: '2024',
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '40090100       ',
  LPV_CUR: '25401106       ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'PUD       ',
})

export const phoenixZoningPud = featureSet({
  ZONING: 'PUD',
  LABEL1: 'PUD PCD*',
  GEN_ZONE: 'PUD',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: 'Z-138-D-83',
  ORD_NUM: ' ',
  ACRES: 126.19593771,
})

// ── 5719 E Thomas Rd, SCOTTSDALE — a parcel outside Phoenix zoning ──────────
// Point 33.48038007, -111.95623295. The parcel layer is the whole of Maricopa
// County (1,759,634 features, county-wide extent) while the zoning layer stops
// at the Phoenix city limits, so this returns a real parcel and NO zoning
// polygon. Note `CITY_ZONING: 'S-R'` — Scottsdale's own district code, sitting
// in the same column a naive resolver would read.
export const phoenixParcelScottsdale = featureSet({
  APN: '128-43-002B',
  ADDRESS: '5719 E THOMAS RD   SCOTTSDALE  85251',
  STREET_NUM: '5719',
  STREET_DIR: 'E',
  STREET_NAME: 'THOMAS',
  STREET_TYPE: 'RD',
  STREET_POSTDIR: null,
  OWNER: 'ABA HOLDINGS LLC',
  'SHAPE.STArea()': 48453.85730488475,
  DESCRIPTION: 'OFFICE BUILDING 1 STORY',
  PROPERTY_USE_CODE: '1511',
  PARCEL_GROUP_CLASS: 'BUSINESS',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=12843002B&slayer=0&exprnum=0',
})

export const phoenixSuppScottsdale = featureSet({
  APN_DASH: '128-43-002B',
  CONST_YEAR: '1974',
  LIVING_SPACE: '0.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '2596100        ',
  LPV_CUR: '1108197        ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'SCOTTSDALE                              ',
  CITY_ZONING: 'S-R       ',
})

// ── 4901 E Palomino Rd — RE-35 under a non-regulatory overlay ───────────────
// Point 33.50907137, -111.97563558. The single overlay here is marked
// REGULATORY = 'No', which is the case that distinguishes "an overlay applies"
// from "an overlay changes the rules".
export const phoenixParcelPalomino = featureSet({
  APN: '172-19-009',
  ADDRESS: '4901 E PALOMINO RD   PHOENIX  85018',
  STREET_NUM: '4901',
  STREET_DIR: 'E',
  STREET_NAME: 'PALOMINO',
  STREET_TYPE: 'RD',
  STREET_POSTDIR: null,
  // PLACEHOLDER — the live OWNER here is two private individuals. See header.
  OWNER: 'PRIVATE OWNER (placeholder)',
  'SHAPE.STArea()': 56899.71434266306,
  DESCRIPTION: 'SFR GRADE 010-5 URBAN SUBDIVIDED',
  PROPERTY_USE_CODE: '0151',
  PARCEL_GROUP_CLASS: 'RESIDENTIAL',
  ASSESSOR_INFO: 'https://maps.mcassessor.maricopa.gov/?esearch=17219009&slayer=0&exprnum=0',
})

export const phoenixSuppPalomino = featureSet({
  APN_DASH: '172-19-009',
  CONST_YEAR: '1955',
  LIVING_SPACE: '5066.00',
  NUMBER_STORIES: '1.00',
  FCV_CUR: '2625800        ',
  LPV_CUR: '1405827        ',
  TAX_YR_CUR: '2027',
  JURISDICTION: 'PHOENIX                                 ',
  CITY_ZONING: 'RE-35     ',
})

export const phoenixZoningRe35 = featureSet({
  ZONING: 'RE-35',
  LABEL1: 'RE-35',
  GEN_ZONE: 'SF Residential',
  TOD: ' ',
  HISTORIC: ' ',
  REDEFINE1: ' ',
  ORD_NUM: ' ',
  ACRES: 1192.3589262,
})

export const phoenixOverlayArcadia = featureSet({
  NAME: 'Arcadia Camelback SPD',
  REGULATORY: 'No',
})

/** A city-owned parcel, so the public-ownership boolean fires. Built from the
 *  Amelia capture with only OWNER changed, and flagged as such — it is the one
 *  fixture here that is NOT a whole live row, because the government-owner path
 *  is a property of the shared `isGovernmentOwner` vocabulary rather than of any
 *  particular Phoenix parcel. */
export const phoenixParcelCityOwned = featureSet({
  ...(phoenixParcelAmelia.features[0].attributes as Record<string, unknown>),
  OWNER: 'CITY OF PHOENIX',
})

export const phoenixFloodX = featureSet({ FLD_ZONE: 'X' })

/** The city-boundary polygon, verbatim from a point query at the Amelia Ave
 *  probe (2026-08-09). CityBoundary/0 holds exactly ONE feature — counted with
 *  returnCountOnly and enumerated with returnDistinctValues on NAME — so its
 *  presence at a point is the whole signal. */
export const phoenixInsideCityBoundary = featureSet({
  OBJECTID: 2563,
  NAME: 'City of Phoenix',
})

const NO_FEATURES = { features: [] }

// ⚠️ HOW TO READ THE ROUTE SETS BELOW. Each one composes the captures that the
// six services actually returned AT THE SAME POINT — the overlay, historic and
// flood responses were re-queried at each scenario's own coordinate rather than
// inherited from the default set, because a scenario stitched together from
// unrelated points would be a fixture that never existed. Where a route is
// NO_FEATURES it is because that layer genuinely returned zero features there,
// and that was checked, not assumed.
//
// The two COUNTY_PARCELS layers are distinguished only by their layer index, so
// the route keys must be the full "MapServer/N" path: matching on
// "COUNTY_PARCELS" alone would send the parcel point query and the assessor
// table lookup to the same fixture.

/** Default routing: 805 W Amelia Ave, R1-6, no overlays, no historic listing. */
export const phoenixRoutes = {
  'COUNTY_PARCELS/MapServer/3': phoenixParcelAmelia,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppAmelia,
  'Zoning/MapServer/0': phoenixZoningR16,
  'CityBoundary/MapServer/0': phoenixInsideCityBoundary,
  'ZoningOverlays/MapServer/0': NO_FEATURES,
  'HistoricProperties/MapServer/0': NO_FEATURES,
  NFHL: phoenixFloodX,
}

/** R1-6 inside the Campus Vista Historic District. */
export const phoenixRoutesHistoric = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelCampusVista,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppCampusVista,
  'Zoning/MapServer/0': phoenixZoningR16Hp,
  'HistoricProperties/MapServer/0': phoenixHistoricCampusVista,
}

/** R-5: "4 stories and 48 feet". */
export const phoenixRoutesR5 = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelIndianSchool,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppIndianSchool,
  'Zoning/MapServer/0': phoenixZoningR5,
}

/** C-3 with the core-area limb available but unresolved, under three overlays. */
export const phoenixRoutesC3 = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelCentralC3,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppCentralC3,
  'Zoning/MapServer/0': phoenixZoningC3,
  'ZoningOverlays/MapServer/0': phoenixOverlaysCentral,
}

/** RE-35 under a non-regulatory special planning district. */
export const phoenixRoutesRe35 = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelPalomino,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppPalomino,
  'Zoning/MapServer/0': phoenixZoningRe35,
  'ZoningOverlays/MapServer/0': phoenixOverlayArcadia,
}

/** An uncurated Downtown Code district — a gap. */
export const phoenixRoutesDowntown = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelDowntown,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppDowntown,
  'Zoning/MapServer/0': phoenixZoningDtcBcore,
}

/** Commerce Park: the FAR slot exists and is empty. */
export const phoenixRoutesCommercePark = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelCommercePark,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppCommercePark,
  'Zoning/MapServer/0': phoenixZoningCpGcp,
}

/** PUD: the approved narrative sets the standards. */
export const phoenixRoutesPud = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelPud,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppPud,
  'Zoning/MapServer/0': phoenixZoningPud,
}

/** A real Maricopa County parcel that Phoenix does not zone. Scottsdale sits
 *  inside PHOENIX_BBOX, so no bounding box separates it. All three signals
 *  agree and were checked at the point: the parcel layer answers, the zoning
 *  layer returns nothing, and the city-boundary polygon does not contain it. */
export const phoenixRoutesOutsideCity = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelScottsdale,
  'COUNTY_PARCELS/MapServer/4': phoenixSuppScottsdale,
  'Zoning/MapServer/0': NO_FEATURES,
  'CityBoundary/MapServer/0': NO_FEATURES,
}

/** The gate's degrade-open path: the boundary layer is down, everything else is
 *  a normal in-city response. */
export const phoenixRoutesCityBoundaryDown = {
  ...phoenixRoutes,
  'CityBoundary/MapServer/0': () => {
    throw new Error('city boundary down')
  },
}

/** City-owned land. */
export const phoenixRoutesCityOwned = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/3': phoenixParcelCityOwned,
}

/** The assessor table has no row for this APN — the join must degrade, not
 *  fail. Measured: the supplemental table carries 1,759,497 rows against the
 *  parcel layer's 1,759,634, so a missing row is a real, if rare, state. */
export const phoenixRoutesNoSupplement = {
  ...phoenixRoutes,
  'COUNTY_PARCELS/MapServer/4': NO_FEATURES,
}
