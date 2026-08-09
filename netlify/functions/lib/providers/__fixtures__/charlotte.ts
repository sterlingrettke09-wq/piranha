// Canned Charlotte responses for getCharlotteParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-08 against the real services, not a hand-written approximation. That
// matters: a fixture invented to match the provider's expectations tests the
// provider against itself, which is the internal-verification trap CLAUDE.md
// rule 9 describes. These carry the upstream's actual field names, actual
// casing ('1918' / 'DILWORTH' / 'RD' / 'WEST' in four separate fields), actual
// nulls (`houseunit` null, `units` null on the uptown commercial cards,
// `ZonePetition`/`Hyperlink` null off a rezoning) and actual value types
// (`totalvalue` a float, `yearbuilt` a small integer, `stdir` an EMPTY STRING
// rather than null).
//
// TWO DELIBERATE DEPARTURES, named here so the sentence above stays true:
//
//  1. Where the live owner fields hold a private individual's name they have
//     been replaced with a placeholder, flagged inline at each site. The
//     provider reduces the owner to a boolean and never returns the name, so
//     the substitution changes no assertion — but a checked-in fixture is not
//     the place for a private person's name, and an unqualified "verbatim"
//     claim next to an edited value is exactly the half-true provenance
//     statement CLAUDE.md warns about (disclosure copy is code).
//  2. `charlotteParcelUncc` carries THREE of the 52 rows the live query
//     returns, flagged at the site. The aggregation assertions that read it are
//     computed from the three included rows, not from the live 52 — see the
//     comment there, which records both figures so neither can be mistaken for
//     the other.
import { featureSet } from './index'

// ── 1918 Dilworth Rd West — N1-C(HDO), one CAMA card, one tax account ───────
// Point 35.2035, -80.8503. Re-probed 3x in isolation: identical each time.
export const charlotteParcelDilworth = featureSet({
  pid: '12108812',
  taxpid: '12108812',
  totalac: 0.33204,
  houseno: '1918',
  houseunit: null,
  stdir: '',
  stname: 'DILWORTH',
  sttype: 'RD',
  stsuffix: 'WEST',
  municipality: 'CHARLOTTE',
  landvalue: 718800,
  totalvalue: 1222500.0,
  netbldgvalue: 497800,
  yearbuilt: 1930,
  heatedarea: 2972.0,
  units: 1,
  descpropertyuse: 'Single-Family',
  // PLACEHOLDER — the live owner here is a private individual. See the header.
  ownerlastname: 'PRIVATE OWNER (placeholder)',
  ownerfirstname: null,
})

export const charlotteZoningN1C = featureSet({
  ZoneDes: 'N1-C(HDO)',
  ZoneClass: 'NEIGHBORHOOD 1',
  Overlay: 'HDO',
  SPA: 'no',
  // 2023-06-01T00:00:00Z — the UDO's own effective date, as an epoch-ms value.
  RezoneDate: 1685592000000,
  ZonePetition: null,
  Hyperlink: null,
})

export const charlotteHistoricDilworth = featureSet({
  DistrictName: 'Dilworth',
  DistrictType: 'Local',
})

// ── 601 S Tryon St — UMUD-O, THREE CAMA cards across TWO tax accounts ───────
// Point 35.2226, -80.8489. This is the multi-row trap, captured whole: the
// value fields repeat per account (279,675,400 on BOTH rows of taxpid
// 12512108) while the building fields differ per card (28,182 / 500,133 /
// 766,567 heated sq ft). Taking features[0] returns 9,500,500 — a 29x
// understatement — and a single call always looks fine.
export const charlotteParcelTryon = featureSet(
  {
    pid: '12512C97',
    taxpid: '12512109',
    totalac: 2.97801,
    houseno: '601',
    houseunit: null,
    stdir: 'S',
    stname: 'TRYON',
    sttype: 'ST',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 1120700,
    totalvalue: 9500500.0,
    netbldgvalue: 8379800,
    yearbuilt: 2018,
    heatedarea: 28182.0,
    units: null,
    descpropertyuse: 'Commercial',
    ownerlastname: 'AP TRYON PLACE RETAIL LP',
    ownerfirstname: null,
  },
  {
    pid: '12512C97',
    taxpid: '12512108',
    totalac: 2.97801,
    houseno: '601',
    houseunit: null,
    stdir: 'S',
    stname: 'TRYON',
    sttype: 'ST',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 30899000,
    totalvalue: 279675400.0,
    netbldgvalue: 248776400,
    yearbuilt: 2018,
    heatedarea: 500133.0,
    units: null,
    descpropertyuse: 'Warehouse',
    ownerlastname: 'STS PROPERTIES LLC',
    ownerfirstname: null,
  },
  {
    pid: '12512C97',
    taxpid: '12512108',
    totalac: 2.97801,
    houseno: '601',
    houseunit: null,
    stdir: 'S',
    stname: 'TRYON',
    sttype: 'ST',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 30899000,
    totalvalue: 279675400.0,
    netbldgvalue: 248776400,
    yearbuilt: 2018,
    heatedarea: 766567.0,
    units: null,
    descpropertyuse: 'Office',
    ownerlastname: 'STS PROPERTIES LLC',
    ownerfirstname: null,
  },
)

/** Uptown. UMUD-O is the pre-UDO Uptown Mixed Use OPTIONAL district: UDO Table
 *  3-1 translates bare UMUD to UC, but Sec. 1.4.C.4 leaves the optional variant
 *  under the prior ordinance plus its approved site plan. Note the live
 *  `Hyperlink` to the rezoning petition — on this ~26% of the city that
 *  petition IS the binding standard. */
export const charlotteZoningUmudO = featureSet({
  ZoneDes: 'UMUD-O',
  ZoneClass: 'UPTOWN MIXED USE',
  Overlay: 'none',
  SPA: 'SPA',
  RezoneDate: 1584331200000,
  ZonePetition: '2019-161',
  Hyperlink: 'http://charlottenc.gov/planning/Rezoning/RezoningPetitions/2019Petitions/Pages/2019-161.aspx',
})

// ── UNC Charlotte — IC-1, 52 CAMA cards across TWO tax accounts ─────────────
// Point 35.3080, -80.7330.
//
// ⚠️ THREE OF 52 ROWS. The live query returns 52 cards; the three below are the
// first three, unedited. Both accounts present in the live data (04931102A at
// $246,391,200 and 04931102B at $39,100) are NOT both represented here — only
// 04931102A is — so the aggregation assertions against this fixture use the
// three-row figures (heated 71,270 sq ft, units 3, earliest 1966, one account),
// not the live 52-row ones (heated 1,919,124 sq ft, units 95, earliest 1961,
// two accounts, $246,430,300). Recording both sets here so a reader cannot
// mistake a fixture total for a measurement of the parcel.
export const charlotteParcelUncc = featureSet(
  {
    pid: '04931102',
    taxpid: '04931102A',
    totalac: 654.97604,
    houseno: '9101',
    houseunit: null,
    stdir: '',
    stname: 'UNIVERSITY CITY',
    sttype: 'BV',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 103222200,
    totalvalue: 246391200.0,
    netbldgvalue: 139959500,
    yearbuilt: 1966,
    heatedarea: 30753.0,
    units: 1,
    descpropertyuse: 'Govt-Inst',
    ownerlastname: 'UNIVERSITY OF NORTH',
    ownerfirstname: 'CAROLINA AT CHARLOTTE',
  },
  {
    pid: '04931102',
    taxpid: '04931102A',
    totalac: 654.97604,
    houseno: '9101',
    houseunit: null,
    stdir: '',
    stname: 'UNIVERSITY CITY',
    sttype: 'BV',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 103222200,
    totalvalue: 246391200.0,
    netbldgvalue: 139959500,
    yearbuilt: 1985,
    heatedarea: 8037.0,
    units: 1,
    descpropertyuse: 'Warehouse',
    ownerlastname: 'UNIVERSITY OF NORTH',
    ownerfirstname: 'CAROLINA AT CHARLOTTE',
  },
  {
    pid: '04931102',
    taxpid: '04931102A',
    totalac: 654.97604,
    houseno: '9101',
    houseunit: null,
    stdir: '',
    stname: 'UNIVERSITY CITY',
    sttype: 'BV',
    stsuffix: '',
    municipality: 'CHARLOTTE',
    landvalue: 103222200,
    totalvalue: 246391200.0,
    netbldgvalue: 139959500,
    yearbuilt: 1966,
    heatedarea: 32480.0,
    units: 1,
    descpropertyuse: 'Govt-Inst',
    ownerlastname: 'UNIVERSITY OF NORTH',
    ownerfirstname: 'CAROLINA AT CHARLOTTE',
  },
)

export const charlotteZoningIc1 = featureSet({
  ZoneDes: 'IC-1',
  ZoneClass: 'INSTITUTIONAL',
  Overlay: 'none',
  SPA: 'no',
  RezoneDate: 1685592000000,
  ZonePetition: null,
  Hyperlink: null,
})

/** NoDa, on the Blue Line. TOD-NC: 75 ft by right, 100 ft only with a Section
 *  16.3 bonus that must be earned. */
export const charlotteZoningTodNc = featureSet({
  ZoneDes: 'TOD-NC',
  ZoneClass: 'TRANSIT-ORIENTED',
  Overlay: 'none',
  SPA: 'no',
  RezoneDate: 1685592000000,
  ZonePetition: null,
  Hyperlink: null,
})

// ── 14632 S Old Statesville Rd, HUNTERSVILLE — outside Charlotte ────────────
// Point 35.4107, -80.8428. Mecklenburg County publishes the parcel; the
// Charlotte zoning layer returns ZERO features here. Captured live, both sides.
export const charlotteParcelHuntersville = featureSet({
  pid: '01904201',
  taxpid: '01904201',
  totalac: 0.1992,
  houseno: '14632',
  houseunit: null,
  stdir: 'S',
  stname: 'OLD STATESVILLE',
  sttype: 'RD',
  stsuffix: '',
  municipality: 'HUNTERSVILLE',
  landvalue: 424700,
  totalvalue: 682600.0,
  netbldgvalue: 251600,
  yearbuilt: 1928,
  heatedarea: 3921.0,
  units: 1,
  descpropertyuse: 'Commercial',
  // PLACEHOLDER — the live owner here is a private individual. See the header.
  ownerlastname: 'PRIVATE OWNER (placeholder)',
  ownerfirstname: null,
})

const NO_FEATURES = { features: [] }

/** Default routing: 1918 Dilworth Rd West, N1-C inside the Dilworth local
 *  historic district, FEMA zone X. */
export const charlotteRoutes = {
  'Accela/Accela/MapServer/16': charlotteParcelDilworth,
  'PLN/Zoning/MapServer/0': charlotteZoningN1C,
  'Accela/Accela/MapServer/12': charlotteHistoricDilworth,
  NFHL: featureSet({ FLD_ZONE: 'X' }),
}

/** Uptown: three cards, two tax accounts, and a legacy optional district whose
 *  binding standard is a site plan rather than the UDO. */
export const charlotteRoutesTryon = {
  ...charlotteRoutes,
  'Accela/Accela/MapServer/16': charlotteParcelTryon,
  'PLN/Zoning/MapServer/0': charlotteZoningUmudO,
  'Accela/Accela/MapServer/12': NO_FEATURES,
}

/** UNC Charlotte: a UDO campus district on a many-card parcel. */
export const charlotteRoutesUncc = {
  ...charlotteRoutes,
  'Accela/Accela/MapServer/16': charlotteParcelUncc,
  'PLN/Zoning/MapServer/0': charlotteZoningIc1,
  'Accela/Accela/MapServer/12': NO_FEATURES,
}

/** NoDa: TOD-NC, where the bonus height must never become the headline. */
export const charlotteRoutesTodNc = {
  ...charlotteRoutes,
  'PLN/Zoning/MapServer/0': charlotteZoningTodNc,
  'Accela/Accela/MapServer/12': NO_FEATURES,
}

/** Outside the city: county parcel data exists, Charlotte zoning does not. */
export const charlotteRoutesOutsideCity = {
  ...charlotteRoutes,
  'Accela/Accela/MapServer/16': charlotteParcelHuntersville,
  'PLN/Zoning/MapServer/0': NO_FEATURES,
  'Accela/Accela/MapServer/12': NO_FEATURES,
}
