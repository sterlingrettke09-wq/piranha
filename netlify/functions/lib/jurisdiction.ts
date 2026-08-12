// The jurisdiction gate — one registry, one reader, twenty-three decisions.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE DEFECT THIS EXISTS FOR
//
// A city's PARCEL layer is very often county-wide or regional while its ZONING
// layer stops at the city limits. Click (or search) a parcel in the next town
// and the parcel layer answers with a real address, a real lot area and a real
// assessed value, while zoning returns nothing — `districtCode: 'Unknown'`.
//
// That render was assumed to be enough. It is not, and the measurement is the
// whole reason this file exists. Driving `getParcelInfo` at real addresses in
// neighbouring municipalities on 2026-08-12 (isolated re-probes, three passes on
// each publishing case), EIGHT cities returned `ok: true` for land the tool does
// not cover:
//
//     la          ← West Hollywood, Beverly Hills, Culver City, Santa Monica
//     chicago     ← Oak Park, Cicero
//     austin      ← West Lake Hills, Rollingwood, Sunset Valley
//     miami       ← Coral Gables, Hialeah, West Miami
//     sandiego    ← Coronado, National City, La Mesa
//     raleigh     ← Cary, Garner, Wake Forest
//     charlotte   ← Matthews, Mint Hill, Pineville
//     nashville   ← the Davidson County satellite cities
//
// Every one carried a lot area, and a lot area is all the cost engine needs to
// print a confident dollar figure — $98.5M for a West Hollywood parcel, $25.3M
// for a Matthews NC one. The zoning gap did not stop any of it. This is
// CLAUDE.md rule 18 exactly: the result LOOKED like an answer, so nothing
// interrogated it.
//
// Four cities (dallas, columbus, lasvegas, phoenix) already carried a gate,
// each written by hand into its own provider. This file is those four gates
// with the decision moved out of the provider and into a table that must cover
// every live city — so the next city cannot be added without stating what its
// boundary layer is, or that it has none.
//
// ─────────────────────────────────────────────────────────────────────────────
// A CITY WITH NO BOUNDARY LAYER IS NOT GIVEN ONE BY INFERENCE
//
// Where no boundary layer was found, the entry is `{ kind: 'none' }` with the
// reason and what refuses today. It is NOT approximated from the bbox: a bbox is
// a rectangle and a city is not, and treating the rectangle as the boundary is
// the *cause* of the sibling defect in this same round (Mapbox, scoped by bbox,
// substituting a different address 6 km away for one outside the city). An
// absence is only an answer once someone has looked (rule 23) — so each 'none'
// records where it looked.
//
// ─────────────────────────────────────────────────────────────────────────────
// FOUR RULES THAT ARE NOT NEGOTIABLE, EACH LEARNED HERE
//
// 1. THE GATE IS THE POLYGON, NOT A `CITY` ATTRIBUTE ON THE PARCEL ROW. Measured
//    in Dallas over 119 random in-bbox points: the polygon agreed with the
//    zoning layer 119/119, the attribute 118/119 — and the disagreement was a
//    real Dallas parcel whose `CITY` is null, which an attribute gate refuses.
//    See providers/dallas.ts. Phoenix's parcel layer has no jurisdiction column
//    at all; Las Vegas's and Dallas's were both measured and rejected.
//
// 2. THE GATE READS THE EXACT POINT, NEVER A BUFFERED SNAP. A 30 m buffered
//    retry pulls the city limits across the line and opens the gate for the
//    enclave it exists to close.
//
// 3. THE GATE DEGRADES **OPEN** ON A FAILED FETCH. Refusing a real in-city
//    address because an optional boundary layer timed out is a worse failure
//    than the one the gate prevents. "Fulfilled with zero features" is an
//    ANSWER and closes the gate; a rejection is a GAP and does not (rule 5).
//
// 4. THE GATE RUNS BEFORE THE PARCEL IS READ AND BEFORE THE REQUIRED-READ STATE
//    SPLIT. The boundary layer answers independently of zoning, so "the point is
//    outside the city" is a complete answer and the more useful one — no reason
//    to trade it for "we couldn't reach the service" because zoning also timed
//    out.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW EACH LAYER BELOW WAS ESTABLISHED (rule 8: indexes, not guessed paths)
//
// Every URL was found by reading the publisher's own service index, then
// verified live 2026-08-12 by point-querying it at a known-IN address and at
// every known-OUT neighbour address in the measurement above. Then each new gate
// was CROSS-TABULATED against that city's own zoning layer over 40 random
// in-bbox points that return a parcel — the Dallas method — because "the gate
// agrees with my neighbour list" is a check against the cases I already knew.
// The cross-tab is what corrected two of them:
//
//   · Austin's gate is NOT `JURISDICTION_TYPE = 'FULL'`. Four sampled points
//     carried `LTD` (limited-purpose annexation) and the city's own zoning layer
//     returned a real district at all four. Austin zones in its limited-purpose
//     jurisdiction; a FULL-only gate would have refused land the city zones.
//   · Raleigh's gate is NOT the "Corporate Limits" layer, which is the obvious
//     one. It disagreed with Raleigh's zoning layer at 9 of 40 points — Raleigh
//     zones inside its ETJ. `Planning Jurisdictions` (layer 1) is the layer whose
//     coverage matches the zoning layer's.
//
// Neither error was reachable by reading the layer names.
import { fetchFeatures, type FeatureSet } from './arcgis'
import type { ParcelRefusal } from './requiredUpstream'

export type GateRow = Record<string, unknown>

export interface CityLimitsGate {
  kind: 'layer'
  /** The boundary layer. Queried at the EXACT point — never buffered. */
  url: string
  /** Fields read. Named, not `*`: the match below is the only thing they feed. */
  fields: readonly string[]
  /**
   * Does this returned row place the point inside the city we cover?
   *
   * `null` means the layer holds exactly ONE jurisdiction, so PRESENCE is itself
   * the answer and no attribute comparison is made — which also means a renamed
   * attribute value cannot silently open the gate. Give a predicate only where
   * the layer holds other jurisdictions too, and say which in `verified`.
   */
  covers: ((row: GateRow) => boolean) | null
  /**
   * What ZERO returned rows means. Required, never defaulted — this is the
   * question a boundary layer's shape answers and the author has to know it.
   *
   *   'outside'  the layer draws the area we DO cover, so no polygon at the
   *              point is positive evidence the point is outside it. Every
   *              layer here but one.
   *
   *   'inside'   the layer only marks places we do NOT cover, so no polygon is
   *              the absence of evidence and the gate must OPEN. Nashville:
   *              its gate is Metro's own zoning layer, where the excluded
   *              places carry `ZONE_DESC = 'Satellite City'`. Reading zero rows
   *              as "outside" there would publish *"you are in a satellite
   *              city"* for a Metro point that simply has no zoning polygon —
   *              a river, a right-of-way — which is rule 5's failure inside the
   *              gate itself: an absence rendered as an answer. Caught by
   *              upstreamSplit.test.ts, which empties that layer on purpose.
   *
   * The quantifier over a NON-empty result follows from this and is not a
   * separate choice: a coverage layer is inside if ANY row covers, an exclusion
   * layer is inside only if EVERY row does.
   */
  emptyMeans: 'outside' | 'inside'
  /** The refusal the user reads. Names the neighbours, not just the city. */
  message: string
  /** What was read to establish this layer, and what the cross-tab measured. */
  verified: string
  /**
   * One row this layer really returns for a point INSIDE the covered city.
   *
   * Required wherever `covers` is a predicate, and asserted by
   * jurisdiction.test.ts to actually satisfy it. Two jobs, and the second is the
   * one worth stating: the shared upstream-probe harness (`__fixtures__/
   * upstreamProbe.ts`) answers every field with the placeholder 'X1', which no
   * value-comparing gate accepts — so before this existed, the harness would
   * have had to hand-copy each gate's magic value, and a gate whose predicate
   * changed would have silently started refusing every mocked request. The
   * harness now reads this field, so the fixture cannot drift from the gate.
   */
  insideSample?: GateRow
}

export interface NoCityLimitsGate {
  kind: 'none'
  /**
   * Why this city has no gate — which services were enumerated, and what
   * refuses an out-of-city point today instead. Never "not needed".
   */
  reason: string
}

export type Jurisdiction = CityLimitsGate | NoCityLimitsGate

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY. Must cover exactly `LIVE_CITIES` — pinned by jurisdiction.test.ts.
export const JURISDICTIONS: Record<string, Jurisdiction> = {
  // ── Gated: a boundary layer is read and an outside point is REFUSED ────────

  dallas: {
    kind: 'layer',
    url: 'https://gis.dallascityhall.com/arcgis/rest/services/Basemap/CityLimits/MapServer/0',
    fields: ['CITY'],
    covers: null,
    emptyMeans: 'outside',
    // ⚠️ WORDING IS LOAD-BEARING AND REGRESSION-TESTED. providers/dallas.test.ts
    // asserts the Highland Park refusal contains 'outside the City of Dallas'.
    message:
      'That point is inside the Dallas area but outside the City of Dallas — Highland Park and University Park are separate cities. Dallas zoning is the only zoning this tool has here.',
    verified:
      'One polygon, CITY = \'Dallas\'; the layer describes itself as the "city limits of the City of Dallas, Texas". Cross-tabbed against the zoning layer over 119 random in-bbox parcel points 2026-08-09: 119/119 agree (the CITY attribute: 118/119).',
  },

  columbus: {
    kind: 'layer',
    url: 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/21',
    fields: ['CITY_NAME'],
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in Franklin County but outside the City of Columbus, whose zoning is the only zoning this tool has for the area.',
    verified:
      "Corporate Boundary, layer 21 of the city's own Zoning service; single polygon, CITY_NAME = 'COLUMBUS'. The Franklin County Auditor parcel fabric behind it answers for Dublin, Grove City, Upper Arlington, Westerville and Gahanna.",
  },

  lasvegas: {
    kind: 'layer',
    url: 'https://mapdata.lasvegasnevada.gov/clvgis/rest/services/AdministrativeBoundaries/Jurisdictions/MapServer/0',
    fields: ['NAME'],
    // ⚠️ THIS LAYER HOLDS OTHER JURISDICTIONS, so presence is NOT the answer and
    // the NAME must be compared — unlike Dallas/Phoenix/Chicago/LA/Miami/SD.
    covers: (r) => String(r.NAME ?? '').trim() === 'City of Las Vegas',
    emptyMeans: 'outside',
    message:
      'That point is in the Las Vegas valley but outside the City of Las Vegas — North Las Vegas, Henderson and unincorporated Clark County (including the Strip) write their own zoning, and City of Las Vegas zoning is the only zoning this tool has here.',
    verified:
      "Seven polygons, enumerated live 2026-08-09 with returnDistinctValues: City of Las Vegas, City of North Las Vegas, City of Henderson, City of Mesquite, Boulder City, Nellis AFB, and one named ' ' (unincorporated Clark County — the Strip and most of the valley).",
    insideSample: { NAME: 'City of Las Vegas' },
  },

  phoenix: {
    kind: 'layer',
    url: 'https://maps.phoenix.gov/pub/rest/services/Public/CityBoundary/MapServer/0',
    fields: ['NAME'],
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in Maricopa County but outside the City of Phoenix — Scottsdale, Tempe, Mesa and Glendale write their own zoning, and Phoenix zoning is the only zoning this tool has here.',
    verified:
      "Layer 0 of the city's own CityBoundary service. The county parcel fabric has NO jurisdiction column at all (27 fields enumerated 2026-08-09); the SUPPLEMENT table's JURISDICTION agreed with this polygon 84/84 over 130 random in-bbox points but sits behind a second-hop join, so the polygon is the gate.",
  },

  // ── Gates added 2026-08-12, each closing a measured publishing case ────────

  la: {
    kind: 'layer',
    url: 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/410',
    fields: ['CITY'],
    // Presence is the answer: ONE polygon. The `CITY` column is read for the log
    // only and is NOT compared — its single stored value is the string 'IN',
    // which is a rendering flag rather than a jurisdiction name, and comparing
    // it would be an attribute gate on a value nobody publishes a meaning for.
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in Los Angeles County but outside the City of Los Angeles — West Hollywood, Beverly Hills, Culver City and Santa Monica are separate cities that write their own zoning, and City of LA zoning is the only zoning this tool has here.',
    verified:
      'Layer 410 "City Boundary" on the SAME NavigateLA service the LA zoning layer (71) comes from; one polygon. Verified 2026-08-12: present at 4907 W Pico Blvd, absent at West Hollywood / Beverly Hills / Culver City / Santa Monica. Cross-tabbed against NavigateLA/71 over 40 random in-bbox parcel points: 19 in-and-zoned, 21 out-and-unzoned, ZERO disagreements either way.',
  },

  chicago: {
    kind: 'layer',
    url: 'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/119',
    fields: ['NAME'],
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in Cook County but outside the City of Chicago — Evanston, Oak Park and Cicero are separate municipalities that write their own zoning, and Chicago zoning is the only zoning this tool has here.',
    verified:
      "Layer 119 \"City Boundary\" on the city's own operational service (layer index read 2026-08-12, not guessed); one polygon, NAME = 'CHICAGO'. The Cook County parcel layer behind it is county-wide. Verified present at 3731 N Clark St, absent at Oak Park and Cicero. Cross-tab against Zoning_update/15 over 40 in-bbox parcel points: 16 in-and-zoned, 23 out-and-unzoned, ZERO disagreements.",
  },

  austin: {
    kind: 'layer',
    url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/BOUNDARIES_jurisdictions/FeatureServer/0',
    fields: ['JURISDICTION_TYPE', 'JURISDICTION_LABEL'],
    // ⚠️ THE ETJ IS NOT THE CITY AND LIMITED PURPOSE IS. This layer holds five
    // kinds of Austin jurisdiction (FULL, LTD, 2MILE, 5MIL, 2MILE_AG,
    // enumerated live with returnDistinctValues), so presence is not the answer.
    // FULL alone was the obvious gate and it is WRONG: the cross-tab found four
    // sampled points in LTD polygons where Austin's own zoning layer returns a
    // real base district (RR, LA, PUD, LA). Austin zones in its limited-purpose
    // jurisdiction; it does not zone in the ETJ rings.
    covers: (r) => r.JURISDICTION_TYPE === 'FULL' || r.JURISDICTION_TYPE === 'LTD',
    emptyMeans: 'outside',
    message:
      "That point is in the Austin area but outside Austin's zoning jurisdiction — West Lake Hills, Rollingwood and Sunset Valley are separate cities, and the extraterritorial jurisdiction is not zoned by the city. Austin zoning is the only zoning this tool has here.",
    verified:
      "389 polygons, all CITY_NAME 'CITY OF AUSTIN', JURISDICTION_TYPE one of FULL / LTD / 2MILE / 5MIL / 2MILE_AG (enumerated live 2026-08-12). Verified absent at West Lake Hills, Rollingwood and Sunset Valley. Cross-tab against Current_Zoning_gdb/0 over 40 in-bbox TCAD parcel points corrected the predicate from FULL to FULL-or-LTD.",
    insideSample: { JURISDICTION_TYPE: 'FULL', JURISDICTION_LABEL: 'AUSTIN FULL PURPOSE' },
  },

  miami: {
    kind: 'layer',
    url: 'https://gis.miami.gov/gis/rest/services/BaseMaps/BaseLayers/MapServer/9',
    fields: ['JURINAME'],
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in Miami-Dade County but outside the City of Miami — Coral Gables, Hialeah, Miami Beach and West Miami are separate cities that write their own zoning, and Miami 21 is the only zoning this tool has here.',
    verified:
      "Layer 9 \"City Boundary\" on the city's own BaseLayers service; one polygon, JURINAME = 'MIAMI'. The Miami-Dade parcel layer behind it is county-wide. Verified present downtown, absent at Coral Gables / Hialeah / West Miami. Cross-tab against ZoningMiami21/5 over 40 in-bbox county parcel points: 12 in-and-zoned, 26 out-and-unzoned, 2 in-but-unzoned (bayfront points with no Miami 21 polygon — the gate opens and the zoning gap still renders as a gap), ZERO out-but-zoned.",
  },

  sandiego: {
    kind: 'layer',
    url: 'https://webmaps.sandiego.gov/arcgis/rest/services/DoIT_Public/DoIT_Public/MapServer/7',
    fields: ['Name'],
    covers: null,
    emptyMeans: 'outside',
    message:
      'That point is in San Diego County but outside the City of San Diego — Coronado, National City, La Mesa and Chula Vista are separate cities that write their own zoning, and City of San Diego zoning is the only zoning this tool has here.',
    verified:
      "Layer 7 \"City Boundary\" on the city's own DoIT_Public service; 6 rows, every one Name = 'SAN DIEGO' (returnDistinctValues, 2026-08-12) — a multi-part boundary, not a multi-jurisdiction layer, so presence is the answer. The parcel layer behind it is SANDAG's regional fabric. Cross-tab against DSD/Zoning_Base/0 over 40 in-bbox parcel points: 14 in-and-zoned, 26 out-and-unzoned, ZERO disagreements.",
  },

  raleigh: {
    kind: 'layer',
    url: 'https://maps.raleighnc.gov/arcgis/rest/services/Planning/Jurisdictions/MapServer/1',
    fields: ['JURISDICTION'],
    // ⚠️ NOT layer 0 ("Corporate Limits"), which is the layer the name suggests.
    // Raleigh zones inside its extraterritorial jurisdiction, so corporate
    // limits under-cover: the cross-tab found 9 of 40 points outside corporate
    // limits where Raleigh's own zoning layer returns a district. Layer 1
    // ("Planning Jurisdictions") is the one whose coverage matches the zoning.
    // The 17 values include 'RALEIGH DURHAM AIRPORT', so the match is exact
    // equality, not a substring.
    covers: (r) => String(r.JURISDICTION ?? '').trim() === 'RALEIGH',
    emptyMeans: 'outside',
    message:
      "That point is in Wake County but outside Raleigh's planning jurisdiction — Cary, Garner, Wake Forest and Knightdale write their own zoning, and Raleigh zoning is the only zoning this tool has here.",
    verified:
      "17 jurisdictions enumerated live 2026-08-12 with returnDistinctValues (RALEIGH, CARY, APEX, GARNER, WAKE FOREST, KNIGHTDALE, MORRISVILLE, ROLESVILLE, ZEBULON, WENDELL, HOLLY SPRINGS, FUQUAY VARINA, ANGIER, CLAYTON, DURHAM, RESEARCH TRIANGLE PARK, RALEIGH DURHAM AIRPORT). The Wake County parcel fabric behind it covers all of them.",
    insideSample: { JURISDICTION: 'RALEIGH' },
  },

  charlotte: {
    kind: 'layer',
    url: 'https://meckgis.mecklenburgcountync.gov/server/rest/services/SphereofInfluence/MapServer/0',
    fields: ['name'],
    // ⚠️ NOT the county's `Jurisdictions` layer, which is the obvious one and is
    // WRONG for the same reason Raleigh's "Corporate Limits" is: North Carolina
    // cities zone inside their extraterritorial jurisdiction, and Charlotte's
    // UDO does. Cross-tabbed against Charlotte's own zoning layer over 40 random
    // in-bbox parcel points, `Jurisdictions` disagreed 9 times — 8 of them
    // `name: 'Mecklenburg'` (unincorporated county) where the zoning layer
    // returns a real district (N1-B, MX-1(INNOV), IC-1). Sphere of Influence
    // carries those same points as `name: 'Charlotte', inside: 1`, and the same
    // cross-tab over 45 points gives 34 in-and-zoned, 10 out-and-unzoned and one
    // disagreement — a point the county's OWN boundary layer places outside
    // Mecklenburg entirely, where Charlotte's zoning layer overreaches. That one
    // is the zoning layer being wrong, not the gate.
    //
    // `inside` (1 = sphere/ETJ, 100 = inside the municipality) is deliberately
    // NOT read: both are Charlotte's zoning jurisdiction, so reading it could
    // only narrow the gate incorrectly.
    covers: (r) => String(r.name ?? '').trim() === 'Charlotte',
    emptyMeans: 'outside',
    message:
      "That point is in Mecklenburg County but outside Charlotte's zoning jurisdiction — Matthews, Mint Hill, Pineville, Huntersville and Davidson write their own zoning, and Charlotte zoning is the only zoning this tool has here.",
    verified:
      "149 polygons; 15 distinct name/inside pairs enumerated live 2026-08-12 (Charlotte, Matthews, Mint Hill, Pineville, Cornelius, Davidson, Huntersville, Stallings, plus 'Mecklenburg' and 'Water'). Verified 'Charlotte' uptown and at two ETJ points, 'Matthews' at the address that was publishing. This is the ONLY gate on a host its provider does not otherwise read — gis.charlottenc.gov publishes no jurisdiction layer (Accela, PLN, LOC, WEB, NBS, CountyData and CLT_Ex service lists were all enumerated first).",
    insideSample: { name: 'Charlotte' },
  },

  nashville: {
    kind: 'layer',
    url: 'https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/Zoning/MapServer/14',
    fields: ['ZONE_DESC'],
    // ⚠️ NASHVILLE'S GATE IS IN-BAND, and that is Metro's own vocabulary rather
    // than an inference. Nashville is a consolidated city-county, so there is no
    // "city limits" to read — Metro's boundary IS Davidson County. What sits
    // inside it are seven satellite cities that kept their own zoning, and
    // Metro's zoning layer labels their polygons `ZONE_DESC = 'Satellite City'`
    // (5 polygons, counted live 2026-08-12). A point in one is inside the
    // county and outside Metro zoning at the same time, which is exactly what
    // this field says. Belle Meade and Berry Hill were both publishing before
    // this gate, each carrying `districtCode: 'Satellite City'` straight through
    // to the report.
    //
    // maps.nashville.gov was enumerated for a boundary layer first: Boundaries/
    // Boundaries holds only zip codes, community planning areas and
    // redevelopment districts, and no folder publishes a satellite-city or
    // Metro-limits polygon.
    covers: (r) => String(r.ZONE_DESC ?? '').trim() !== 'Satellite City',
    emptyMeans: 'inside',
    message:
      'That point is in Davidson County but inside one of its satellite cities — Belle Meade, Berry Hill, Forest Hills, Oak Hill, Goodlettsville, Ridgetop and Lakewood write their own zoning, and Metro Nashville zoning is the only zoning this tool has here.',
    verified:
      "ZONE_DESC = 'Satellite City' returns 5 polygons (live count 2026-08-12). Cross-tab over 40 random in-bbox Metro parcel points: 40/40 returned a substantive district, i.e. an in-city point is not left gateless by an empty answer.",
    insideSample: { ZONE_DESC: 'RS5' },
  },

  // ── No boundary layer: these cities are NOT given one by inference ─────────
  //
  // Each was probed at the real entry point on 2026-08-12 with real addresses in
  // its neighbours; each refused. The refusal comes from the parcel layer being
  // CITY-SCOPED rather than from a gate, so it is NO_PARCEL rather than a
  // jurisdiction message — a weaker render, but a true one, and it is recorded
  // here rather than papered over with a rectangle.

  boston: {
    kind: 'none',
    reason:
      'The assessing-parcels layer is the City of Boston\'s own and stops at the city line. Probed 2026-08-12 at Cambridge, Brookline and Somerville addresses inside BOSTON_BBOX: all three NO_PARCEL. No City service publishes a municipal-boundary polygon this build has found.',
  },
  nyc: {
    kind: 'none',
    reason:
      'MapPLUTO is the five boroughs only. Probed 2026-08-12 at Jersey City and Hoboken addresses inside NYC_BBOX: both NO_PARCEL.',
  },
  sf: {
    kind: 'none',
    reason:
      'City-and-county parcel layer; the city line is the county line. Daly City and Brisbane both fall OUTSIDE SF_BBOX, so the bbox refuses before any gate would run.',
  },
  seattle: {
    kind: 'none',
    reason:
      "King County's neighbours (Tukwila, Shoreline, Mercer Island) all fall OUTSIDE SEATTLE_BBOX, so the bbox refuses first; the parcel layer is the City's own.",
  },
  dc: {
    kind: 'none',
    reason:
      'DC has no municipal neighbours — the district line is a state line. Probed 2026-08-12 at Arlington VA and Bethesda MD inside DC_BBOX: both NO_PARCEL, because the parcel layer is DC-only.',
  },
  denver: {
    kind: 'none',
    reason:
      'City-and-county parcel layer. Probed 2026-08-12 at Glendale, Aurora and Englewood addresses inside DENVER_BBOX: all three NO_PARCEL.',
  },
  minneapolis: {
    kind: 'none',
    reason:
      'City-scoped parcel layer. Saint Paul, Richfield and St Louis Park all fall OUTSIDE MINNEAPOLIS_BBOX, so the bbox refuses before any gate would run.',
  },
  philadelphia: {
    kind: 'none',
    reason:
      'City-and-county parcel layer. Probed 2026-08-12 at Camden NJ and Elkins Park PA inside PHILADELPHIA_BBOX: both NO_PARCEL.',
  },
  sanjose: {
    kind: 'none',
    reason:
      "City-scoped parcel layer. Probed 2026-08-12 at Santa Clara, Campbell and Cupertino addresses inside SAN_JOSE_BBOX: all three NO_PARCEL.",
  },
  milwaukee: {
    kind: 'none',
    reason:
      "Both the parcel and zoning layers are the City's own and neither extends past the city line (recorded in providers/milwaukee.ts). Probed 2026-08-12 at Wauwatosa, West Allis and Shorewood addresses inside MILWAUKEE_BBOX: all three NO_PARCEL.",
  },
  atlanta: {
    kind: 'none',
    reason:
      'City-scoped tax-parcel layer. Probed 2026-08-12 at Decatur and East Point addresses inside ATLANTA_BBOX: both NO_PARCEL (Sandy Springs falls outside the bbox).',
  },
}

/** Every city that carries a real boundary-layer gate. */
export const GATED_CITIES = Object.entries(JURISDICTIONS)
  .filter(([, j]) => j.kind === 'layer')
  .map(([city]) => city)
  .sort()

/** The gate for a city, or null when that city has none. */
export function cityLimitsGate(city: string): CityLimitsGate | null {
  const j = JURISDICTIONS[city]
  return j?.kind === 'layer' ? j : null
}

/**
 * The one key a gate publishes under, in one place.
 *
 * Before this existed the three providers that published their gate at all used
 * three different spellings — `cityLimits` (dallas), `cityBoundary` (phoenix),
 * `jurisdictions` (lasvegas) — and the other nine published nothing. A reader
 * comparing two reports could not tell "this city's gate is sourced under a
 * different name" from "this city has no gate", which is rule 5's failure in the
 * source list: an absence and an answer rendering the same.
 */
export const CITY_LIMITS_SOURCE_KEY = 'cityLimits'

/**
 * The gate's entry for a provider's `sources` object — spread it in.
 *
 *     sources: { parcels: PARCELS, zoning: ZONING, ...cityLimitsSource('miami') }
 *
 * A gate that REFUSES is making a claim about where the parcel is, and every
 * other claim in the report carries its source. This is that source, read off
 * the SAME registry row `fetchCityLimits` queries — so the URL a report
 * publishes and the URL the gate actually read are one value and cannot drift
 * apart (rule 14: emit the pair together, don't leave a second hand-written
 * literal that a later edit can desynchronise).
 *
 * An ungated city gets `{}` — never the key with an empty, guessed or bbox-
 * derived value. A city with no gate makes no jurisdiction claim and so has
 * nothing to source, and that is the same decision the registry already records
 * in `kind: 'none'`. It also makes this spread safe to paste into ANY provider:
 * the registry decides whether anything is published, not the call site.
 */
export function cityLimitsSource(city: string): Record<string, string> {
  const gate = cityLimitsGate(city)
  return gate ? { [CITY_LIMITS_SOURCE_KEY]: gate.url } : {}
}

/**
 * Issue the gate's point query. Put this in the provider's OPTIONAL parallel
 * batch (`Promise.allSettled`) — it must not add a serial hop, and it must not
 * be a `readRequired`, because rule 3 above says it degrades open.
 *
 * ⚠️ NO `distance=` PARAMETER, EVER. `fetchFeatures` queries the exact point;
 * `fetchParcelSnap` would buffer it 30 m and open the gate for the enclave.
 */
export function fetchCityLimits(
  gate: CityLimitsGate,
  lat: number,
  lng: number,
  timeoutMs?: number,
): Promise<FeatureSet> {
  return fetchFeatures(gate.url, lat, lng, gate.fields, false, undefined, timeoutMs)
}

/**
 * Read the gate's answer.
 *
 * Returns the refusal to hand straight back to the caller, or `null` to
 * continue — which covers BOTH "the point is inside the city" and "the boundary
 * layer did not answer" (rule 3: degrade open). The two are deliberately the
 * same for the caller and deliberately different in the log.
 *
 * Call this BEFORE reading the parcel and BEFORE the required-read state split,
 * so nothing about an out-of-city parcel can reach the response (rule 4).
 */
export function outsideCity(
  city: string,
  r: PromiseSettledResult<FeatureSet>,
  t0: number,
): ParcelRefusal | null {
  const gate = cityLimitsGate(city)
  if (!gate) return null
  // A rejection is a GAP, not an answer. It must not close the gate, and it must
  // not be silent either — this is the one branch where the tool knowingly
  // serves a point it could not place.
  if (r.status !== 'fulfilled') {
    console.log({ event: 'parcel.jurisdiction_unread', city, durationMs: Date.now() - t0 })
    return null
  }
  const rows = r.value.features ?? []
  // The empty case first, because it is the one the layer's SHAPE decides —
  // see `emptyMeans`. The quantifier below follows from the same fact: a
  // coverage layer is inside if ANY row covers, an exclusion layer only if
  // EVERY row does.
  const inside =
    rows.length === 0
      ? gate.emptyMeans === 'inside'
      : gate.covers == null
        ? true
        : gate.emptyMeans === 'inside'
          ? rows.every((f) => gate.covers!(f.attributes ?? {}))
          : rows.some((f) => gate.covers!(f.attributes ?? {}))
  if (inside) return null
  console.log({ event: 'parcel.outside_city', city, durationMs: Date.now() - t0 })
  return { ok: false, code: 'OUT_OF_BBOX', message: gate.message, status: 400 }
}
