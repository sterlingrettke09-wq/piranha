import {
  BOSTON_BBOX,
  NYC_BBOX,
  CHICAGO_BBOX,
  SF_BBOX,
  SEATTLE_BBOX,
  DC_BBOX,
  AUSTIN_BBOX,
  LA_BBOX,
  DENVER_BBOX,
  MINNEAPOLIS_BBOX,
  PHILADELPHIA_BBOX,
  MIAMI_BBOX,
  SAN_DIEGO_BBOX,
  SAN_JOSE_BBOX,
  NASHVILLE_BBOX,
  RALEIGH_BBOX,
  MILWAUKEE_BBOX,
  COLUMBUS_BBOX,
  CHARLOTTE_BBOX,
  ATLANTA_BBOX,
  type Bbox,
} from '../types/parcel'

export interface City {
  slug: string
  name: string
  /** "City, ST" display label (city cards, admin tables). */
  stateLabel: string
  /** Whether live zoning/parcel data is wired for this city yet. */
  live: boolean
  /** Map center [lng, lat] and zoom for the dashboard. */
  center: [number, number]
  zoom: number
  /** Bounding box that scopes the address search to this city. */
  bbox: Bbox
  /** Where to take the next real step (permitting / planning dept). */
  permitName: string
  permitUrl: string
  /** One-line, city-specific descriptor for the cinematic entry splash. */
  tagline: string
  /** [lng, lat] landmark the cinematic intro dives toward (kept near the
   *  dashboard center so the hand-off stays seamless). Falls back to center. */
  landmark: [number, number]
  /**
   * Client-side zoning-district overlay (WO-8.1b). The dashboard fetches this
   * FeatureServer/MapServer layer directly from the browser as GeoJSON
   * (viewport envelope, zoom ≥ 14, f=geojson). `url` and `codeField` are copied
   * from each provider's ZONING constant; the host must be in netlify.toml's
   * CSP connect-src. `undefined` = no client overlay for this city (CORS-blocked
   * server, or the layer isn't a true zoning-district layer) — the map still
   * works, it just shows no district fill. Probed live 2026-06-10.
   */
  zoningLayer?: { url: string; codeField: string }
}

// Deploy set — all ten live.
export const CITIES: City[] = [
  { slug: 'boston', stateLabel: 'Boston, MA', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 13.2, bbox: BOSTON_BBOX, permitName: 'Boston Inspectional Services', permitUrl: 'https://www.boston.gov/departments/inspectional-services', tagline: 'Red brick, deep harbor, four hundred years.', landmark: [-71.0704, 42.3541], zoningLayer: { url: 'https://services.arcgis.com/sFnw0xNflSi8J0uh/ArcGIS/rest/services/Zoning_Subdistricts_Urban_20240719/FeatureServer/93', codeField: 'Name' } },
  { slug: 'nyc', stateLabel: 'New York, NY', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 13.4, bbox: NYC_BBOX, permitName: 'NYC Department of Buildings', permitUrl: 'https://www.nyc.gov/site/buildings/index.page', tagline: 'Eight million lives, stacked to the sky.', landmark: [-73.9712, 40.7725], zoningLayer: { url: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0', codeField: 'ZoneDist1' } },
  { slug: 'chicago', stateLabel: 'Chicago, IL', name: 'Chicago', live: true, center: [-87.6248, 41.8855], zoom: 13.2, bbox: CHICAGO_BBOX, permitName: 'Chicago Department of Buildings', permitUrl: 'https://www.chicago.gov/city/en/depts/bldgs.html', tagline: 'Broad shoulders on a great lake.', landmark: [-87.6233, 41.8827], zoningLayer: { url: 'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/15', codeField: 'ZONE_CLASS' } },
  { slug: 'sf', stateLabel: 'San Francisco, CA', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 13, bbox: SF_BBOX, permitName: 'SF Department of Building Inspection', permitUrl: 'https://www.sf.gov/departments/department-building-inspection', tagline: 'Fog, hills, and the Golden Gate.', landmark: [-122.4058, 37.8024], zoningLayer: { url: 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/3', codeField: 'zoning' } },
  { slug: 'seattle', stateLabel: 'Seattle, WA', name: 'Seattle', live: true, center: [-122.3331, 47.6080], zoom: 13, bbox: SEATTLE_BBOX, permitName: 'Seattle Dept. of Construction & Inspections', permitUrl: 'https://www.seattle.gov/sdci', tagline: 'Between the mountains and the sound.', landmark: [-122.3493, 47.6205], zoningLayer: { url: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0', codeField: 'ZONING' } },
  { slug: 'dc', stateLabel: 'Washington, DC', name: 'Washington, DC', live: true, center: [-77.0364, 38.8951], zoom: 12.8, bbox: DC_BBOX, permitName: 'DC Dept. of Buildings', permitUrl: 'https://dob.dc.gov/', tagline: 'A capital built on grand plans.', landmark: [-77.0091, 38.8899], zoningLayer: { url: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCOZ/Zone_Mapservice/MapServer/24', codeField: 'Zoning' } },
  { slug: 'austin', stateLabel: 'Austin, TX', name: 'Austin', live: true, center: [-97.7431, 30.2672], zoom: 12.8, bbox: AUSTIN_BBOX, permitName: 'Austin Development Services Dept.', permitUrl: 'https://www.austintexas.gov/department/development-services', tagline: 'Live music and live cranes.', landmark: [-97.7404, 30.2747], zoningLayer: { url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0', codeField: 'BASE_ZONE' } },
  { slug: 'la', stateLabel: 'Los Angeles, CA', name: 'Los Angeles', live: true, center: [-118.2437, 34.0522], zoom: 12.4, bbox: LA_BBOX, permitName: 'LA Dept. of Building & Safety', permitUrl: 'https://www.ladbs.org/', tagline: 'A horizon that never stops.', landmark: [-118.2468, 34.0407], zoningLayer: { url: 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/71', codeField: 'ZONE_CMPLT' } },
  { slug: 'denver', stateLabel: 'Denver, CO', name: 'Denver', live: true, center: [-104.9903, 39.7392], zoom: 12.8, bbox: DENVER_BBOX, permitName: 'Denver Community Planning & Development', permitUrl: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development', tagline: 'A mile high and climbing.', landmark: [-104.9876, 39.7486],
    // No client overlay: denvergov.org/maps/data/Zoning/MapServer/1 serves valid
    // f=geojson but sends NO Access-Control-Allow-Origin header (probed twice,
    // 2026-06-10) → a browser fetch is CORS-blocked. The zoning data still
    // powers the verdict server-side via the provider; only the visual overlay
    // is unavailable until Denver enables CORS or we proxy it.
    zoningLayer: undefined },
  { slug: 'minneapolis', stateLabel: 'Minneapolis, MN', name: 'Minneapolis', live: true, center: [-93.2650, 44.9778], zoom: 12.8, bbox: MINNEAPOLIS_BBOX, permitName: 'Minneapolis Community Planning & Economic Development', permitUrl: 'https://www2.minneapolismn.gov/business-services/planning-zoning/', tagline: 'Mills, lakes, and bold building.', landmark: [-93.2577, 44.9794],
    // No client overlay: Minneapolis's Primary Zoning layer is LAND-USE
    // (Built-Form districts carry the FAR/height), not a single district-code
    // layer the family classifier maps cleanly. Skipped per spec; the provider
    // still resolves limits server-side.
    zoningLayer: undefined },
  { slug: 'philadelphia', stateLabel: 'Philadelphia, PA', name: 'Philadelphia', live: true, center: [-75.1635, 39.9526], zoom: 12.6, bbox: PHILADELPHIA_BBOX, permitName: 'Philadelphia Licenses & Inspections', permitUrl: 'https://www.phila.gov/departments/department-of-licenses-and-inspections/', tagline: 'Rowhouses, and room to build.', landmark: [-75.1652, 39.9524],
    // Philadelphia's Zoning_BaseDistricts is AGOL-hosted (CORS-open like the
    // other services.arcgis.com layers) and it is one of only two cities
    // publishing real FAR/height, so the client overlay is worth enabling.
    zoningLayer: { url: 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_BaseDistricts/FeatureServer/0', codeField: 'long_code' } },
  { slug: 'miami', stateLabel: 'Miami, FL', name: 'Miami', live: true, center: [-80.1918, 25.7743], zoom: 12.6, bbox: MIAMI_BBOX, permitName: 'City of Miami Building Department', permitUrl: 'https://www.miami.gov/Government/Departments-Organizations/Building', tagline: 'Building on the water\u2019s edge.', landmark: [-80.1918, 25.7743],
    // Miami 21 Primary Zoning is served from gis.miami.gov (NOT gis.miamigov.com,
    // which times out). Server-side only for now; enabling a client overlay would
    // require adding the host to the netlify.toml CSP connect-src.
    zoningLayer: undefined },
  { slug: 'sandiego', stateLabel: 'San Diego, CA', name: 'San Diego', live: true, center: [-117.1611, 32.7157], zoom: 12.4, bbox: SAN_DIEGO_BBOX, permitName: 'San Diego Development Services', permitUrl: 'https://www.sandiego.gov/development-services', tagline: 'Sun, surf, and a 30-foot ceiling.', landmark: [-117.1611, 32.7157],
    // Server-side only: webmaps.sandiego.gov would need a CSP connect-src entry.
    zoningLayer: undefined },
  { slug: 'sanjose', stateLabel: 'San Jose, CA', name: 'San Jose', live: true, center: [-121.8863, 37.3382], zoom: 12.4, bbox: SAN_JOSE_BBOX, permitName: 'San Jose Planning, Building & Code Enforcement', permitUrl: 'https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement', tagline: 'The valley\u2019s capital, still low-rise.', landmark: [-121.8863, 37.3382],
    // Server-side only: geo.sanjoseca.gov would need a CSP connect-src entry.
    zoningLayer: undefined },
  { slug: 'nashville', stateLabel: 'Nashville, TN', name: 'Nashville', live: true, center: [-86.7816, 36.1627], zoom: 12.2, bbox: NASHVILLE_BBOX, permitName: 'Metro Nashville Codes & Building Safety', permitUrl: 'https://www.nashville.gov/departments/codes', tagline: 'Boomtown, building fast.', landmark: [-86.7816, 36.1627],
    // Server-side only: maps.nashville.gov would need a CSP connect-src entry.
    zoningLayer: undefined },
  { slug: 'raleigh', stateLabel: 'Raleigh, NC', name: 'Raleigh', live: true, center: [-78.6423, 35.7813], zoom: 12.6, bbox: RALEIGH_BBOX, permitName: 'Raleigh Planning & Development', permitUrl: 'https://raleighnc.gov/planning-and-development', tagline: 'Pines, research parks, and permits that move.', landmark: [-78.6423, 35.7813],
    // center/landmark are MEASURED, not eyeballed off a map: the midpoint of the
    // DX (Downtown Mixed Use) districts' own extent, from
    // Planning/Zoning/MapServer/0 queried with returnExtentOnly, 2026-08-07.
    // permitUrl is the department page's own canonical URL (read from the page's
    // <link rel="canonical">, not guessed — CLAUDE.md rule 8).
    //
    // Server-side only: maps.raleighnc.gov is NOT in netlify.toml's CSP
    // connect-src (checked, 2026-08-07 — the file contains no raleigh host), so a
    // browser fetch of the zoning layer would be blocked. This is a CSP gap, not
    // a CORS finding: no cross-origin probe of the host was run, so nothing is
    // claimed about whether it would send Access-Control-Allow-Origin. The
    // provider still resolves every limit server-side; only the map fill is absent.
    zoningLayer: undefined },

  // ── The 2026-08-08 cohort ────────────────────────────────────────────────
  // Four things about every entry below, so the provenance is not re-litigated
  // per city:
  //   · center/landmark are MEASURED. Each is the AREA-WEIGHTED CENTROID of
  //     that city's own downtown-district polygons, computed 2026-08-08 from
  //     the polygons the zoning layer returns (equirectangular projection about
  //     the data's own mean latitude). This deliberately DIFFERS from Raleigh's
  //     bbox midpoint, and the reason is a measurement: Milwaukee's C9 downtown
  //     districts include one arm (C9D subdistrict A) running ~5 km west down
  //     the Menomonee Valley, and the bbox midpoint of the set lands at
  //     -87.9362, 43.0480 — roughly 2 km off the downtown mass, in a rail
  //     corridor. A bbox midpoint is a property of two extreme polygons; an
  //     area-weighted centroid is a property of all of them. Both are measured;
  //     the centroid is the better instrument, and it is applied uniformly to
  //     all four so no city gets a bespoke method.
  //   · zoom is NOT a measurement. It is a display choice, set from each city's
  //     bbox span to match cities already in this file with comparable spans.
  //     It is labelled as such rather than dressed up as derived from data.
  //   · permitUrl was READ, not guessed (rule 8), and every guessed path is
  //     recorded as having 404'd rather than quietly replaced.
  //   · zoningLayer is undefined for all four, and the reason is the SAME one
  //     Raleigh's carries — a CSP gap. netlify.toml's connect-src lists only
  //     'self', *.mapbox.com, *.arcgis.com, gisapps.chicago.gov,
  //     maps2.dcgis.dc.gov, sfplanninggis.org and maps.lacity.org (read
  //     2026-08-08); none of milwaukeemaps.milwaukee.gov, maps2.columbus.gov,
  //     gis.charlottenc.gov or gis.atlantaga.gov appears, so a browser fetch
  //     would be blocked before it left the page. That is a CSP gap and NOT a
  //     CORS finding: no cross-origin probe was run against any of the four, so
  //     nothing is claimed here about Access-Control-Allow-Origin. Denver's
  //     entry above records an actual CORS probe; do not read these as the same
  //     claim. Every limit still resolves server-side.

  { slug: 'milwaukee', stateLabel: 'Milwaukee, WI', name: 'Milwaukee', live: true, center: [-87.9204, 43.0396], zoom: 12.8, bbox: MILWAUKEE_BBOX, permitName: 'Milwaukee Dept. of Neighborhood Services', permitUrl: 'https://city.milwaukee.gov/dns', tagline: 'Cream city brick, on a working lakefront.', landmark: [-87.9204, 43.0396],
    // center/landmark: area-weighted centroid of the 762 C9* downtown polygons
    // on planning/zoning/MapServer/12.
    // permitName/permitUrl: the department's own page, loaded 2026-08-08 and
    // read from the rendered document (city.milwaukee.gov sits behind a
    // Cloudflare challenge that returns 403 to a plain fetch, so the page was
    // opened in a browser). It self-identifies as "Department of Neighborhood
    // Services" and runs the Permit & Development Center. The site publishes NO
    // <link rel="canonical">, so the URL recorded is the one the browser
    // resolved to — https://city.milwaukee.gov/dns — not a canonical tag. Said
    // plainly because Raleigh's line above cites a canonical tag and this one
    // cannot; the two are different strengths of evidence.
    zoningLayer: undefined },

  { slug: 'columbus', stateLabel: 'Columbus, OH', name: 'Columbus', live: true, center: [-83.0014, 39.9644], zoom: 12.2, bbox: COLUMBUS_BBOX, permitName: 'Columbus Building & Zoning Services', permitUrl: 'https://www.columbus.gov/Business-Development/Building-Zoning-Services', tagline: 'A capital that keeps outgrowing its map.', landmark: [-83.0014, 39.9644],
    // center/landmark: area-weighted centroid of the DD (Downtown District)
    // polygons on Applications/Zoning/MapServer/20.
    // permitUrl: `/Services/Building-Zoning/` was tried first and returned 404
    // with canonical https://www.columbus.gov/Page-Not-Found — which proves the
    // guess wrong, not the department absent (rule 8). The URL below came from
    // the site's own navigation index and its page carries
    // <link rel="canonical" href="https://www.columbus.gov/Business-Development/Building-Zoning-Services">
    // with <title>Building &amp; Zoning Services</title>.
    zoningLayer: undefined },

  { slug: 'charlotte', stateLabel: 'Charlotte, NC', name: 'Charlotte', live: true, center: [-80.8443, 35.2246], zoom: 12.2, bbox: CHARLOTTE_BBOX, permitName: 'Mecklenburg County Code Enforcement', permitUrl: 'https://code.mecknc.gov/', tagline: 'A skyline the banks built, still rising.', landmark: [-80.8443, 35.2246],
    // center/landmark: area-weighted centroid of the 10 UC (Uptown Core)
    // polygons on PLN/Zoning/MapServer/0.
    //
    // ⚠️ THE PERMIT AUTHORITY IS THE COUNTY, NOT THE CITY, and that is the only
    // entry in this file where the two differ — so it is stated rather than
    // smoothed over. The City of Charlotte writes and administers the UDO (the
    // ordinance ../../netlify/functions/lib/zoning/charlotte.ts is curated
    // from), but building permits, plan review and inspections for all of
    // Mecklenburg County — Charlotte included — are issued by Mecklenburg
    // County Code Enforcement, a division of the county's Land Use and
    // Environmental Services Agency. Read from the division's own site
    // 2026-08-08, which states it verbatim: "Permitting, plan review and
    // inspections for building, electrical, mechanical and plumbing work in
    // Mecklenburg County", ">100,000 permits each year", inspectors covering
    // "all construction in Mecklenburg County's 524 square miles".
    // https://www.mecknc.gov/LUESA/CodeEnforcement redirects there and the page
    // carries <link rel="canonical" href="https://code.mecknc.gov/">.
    zoningLayer: undefined },

  { slug: 'atlanta', stateLabel: 'Atlanta, GA', name: 'Atlanta', live: true, center: [-84.3898, 33.7583], zoom: 12.6, bbox: ATLANTA_BBOX, permitName: 'Atlanta Zoning, Development & Permitting Services', permitUrl: 'https://www.atlantaga.gov/government/departments/city-planning/zoning-development-permitting-services', tagline: 'A city in a forest, filling in.', landmark: [-84.3898, 33.7583],
    // center/landmark: area-weighted centroid of the 7 SPI-1 (Downtown) polygons
    // on LandUsePlanning/LandUsePlanning/MapServer/0. Note that ZONECLASS='C-5'
    // — the old Central Business District — survives on exactly ONE polygon of
    // 2,979 and is far too small to centre a map on; SPI-1 is the mapped
    // downtown. Checked, not assumed.
    // permitUrl: `/government/departments/city-planning/office-of-buildings`
    // was tried first and returned 404. The URL below is linked from the
    // Department of City Planning's own page and returns 200 with
    // <title>Zoning, Development, and Permitting Services | Atlanta, GA</title>.
    // atlantaga.gov publishes no <link rel="canonical"> anywhere, so the
    // evidence here is a live 200 plus the page's own title — weaker than
    // Columbus's canonical tag, and recorded as such.
    zoningLayer: undefined },
]

export const DEFAULT_CITY = 'boston'

// The first cohort, shown directly in the header dropdown. The rest live on the
// /cities page (reached via "See all cities") so the menu stays short.
export const PRIMARY_CITY_SLUGS = ['boston', 'nyc', 'chicago', 'sf', 'seattle']

export function isCitySlug(slug: string): boolean {
  return CITIES.some((c) => c.slug === slug)
}

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}

/** Display name for a slug — single source of truth for city labels. */
export function cityName(slug: string): string {
  return CITIES.find((c) => c.slug === slug)?.name ?? slug
}

/**
 * Cities for which city-SPECIFIC regulatory hurdles are encoded (inclusionary
 * mandates, large-project review, environmental review, local labour rules…).
 *
 * Every other city still gets the generic set — historic review, flood, permit
 * fees, demolition — so its hurdle list is a FLOOR, not a complete account of
 * what that city requires.
 *
 * This exists because Compare renders "Approvals to clear" as a bare count side
 * by side. Without the distinction, a city we have not encoded reads as a city
 * with fewer requirements, which is a coverage artifact presented as a finding
 * about the world — in the direction that flatters the tool. Same failure class
 * as rendering a missing FAR lookup as an absent FAR limit (rule 5).
 *
 * Kept honest by a test that reads the `city === '…'` branches out of
 * `hurdles.ts` and asserts they match this list exactly, so encoding a new city
 * without updating it fails the suite rather than silently mislabelling.
 */
// Milwaukee, Columbus, Charlotte and Atlanta were added 2026-08-08 and now carry
// 16–20 rows each, spanning the same subjects as the other sixteen: inclusionary
// (or the absence of one, where a State bars it), site-plan and design review,
// impact and connection fees, stormwater, tree ordinances, demolition and
// historic. Read the branches in `hurdles.ts` for what each one actually claims.
//
// KEPT AS A RECORD, because for one workflow this comment said the opposite and
// was true when it said it. These four were added to this list while encoded for
// PARKING ONLY — a handoff between agents had been passed through
// `.slice(0, 4500)`, and the cut landed inside the first key, so 140,418
// characters of hurdles research arrived as nothing (ledger 2026-08-08, rule 19).
// The list drives Compare's "partial" marker, whose whole job is to stop an
// unencoded city from reading as a lightly regulated one; for that interval a
// parking-only city read as fully encoded. What caught it was the applying agent
// reporting that its input looked truncated — not a test, which passed
// throughout, and could not have known what was missing.
//
// The residual claim to be careful about: this list is binary and coverage is
// not. It says a city has SOME encoded specifics, never that the encoding is
// complete — no city's is. Each branch names its own gaps and unevaluable limbs
// inline; that is where coverage actually lives.
export const CITIES_WITH_SPECIFIC_HURDLES = [
  'atlanta', 'austin', 'boston', 'charlotte', 'chicago', 'columbus', 'dc',
  'denver', 'la', 'miami', 'milwaukee', 'minneapolis', 'nashville', 'nyc',
  'philadelphia', 'raleigh', 'sandiego', 'sanjose', 'seattle', 'sf',
] as const

export function hasCitySpecificHurdles(slug: string): boolean {
  return (CITIES_WITH_SPECIFIC_HURDLES as readonly string[]).includes(slug)
}

/**
 * Cities whose timeline includes an EMPIRICAL filing→issuance permit measurement
 * pulled from the city's own open-data portal, rather than only a lifecycle
 * estimate.
 *
 * Boston, DC, Minneapolis, San Jose and Columbus publish NO application date at
 * all, so filing→issuance is not a metric we failed to compute but one their
 * data cannot support. Each was checked by asking whether the schema has a SLOT
 * for an application date, not whether one row was blank, and each tempting
 * substitute was tested and rejected (DC's CREATED_DATE is an identical ETL stamp
 * on every row; Minneapolis's completeDate lands after issueDate in 409 of 409
 * sampled records; San Jose's FINALDATE is final inspection; Columbus's
 * Building_Permits layer carries exactly two date fields, ISSUED_DT and
 * LAST_STATUS_DT, and the second is a status stamp, not an intake one).
 *
 * Charlotte is a harder no still: it publishes no building-permit dataset at
 * all. Its full 300-dataset catalogue was enumerated through the portal's own
 * OGC search API, so this is an established absence rather than a failed guess.
 *
 * Atlanta and Milwaukee are the two cases where a pipeline EXISTS and refuses —
 * see scripts/permits/milwaukee.mjs and the notes below.
 *
 * This exists for the same reason `CITIES_WITH_SPECIFIC_HURDLES` does. Compare
 * renders cities side by side, and a city with no measured line reads as faster
 * or simpler rather than unmeasured — absence of a finding rendering as a finding
 * of absence, in the direction that flatters. Third instance of that shape.
 *
 * Kept honest by a test that reads permitStats.json and asserts this list matches
 * it exactly, so measuring a twelfth city cannot silently leave the list stale.
 */
// ⚠️ chicago, la and sandiego were REMOVED 2026-08-05 after an adversarial audit.
// They were published for part of one session and are recorded here so nobody
// re-adds them from the old query:
//   · sandiego — WRONG DATE FIELD. The start stamp is documented as when a permit
//     is "added to the Permit System", never earlier than intake (median +14 d,
//     p90 +181 d), and 8.93% of rows are create==issue on projects filed a median
//     928 days earlier. The UI called it "Median filing→permit". It was not.
//   · chicago — 46% of the sample is a 2022-23 cohort where 51.6%/31.2% of records
//     are stamped applied==issued, a backfill artifact that roughly HALVED the
//     median. Clean 2024-25 cohorts give 1.71 mo, not 1.0.
//   · la — 45.4% of the cohort carries NO issue date at extract. The p80 of 13.0
//     is unsalvageable: only 64.1% of the matured 2022 cohort carries one, so the
//     80th percentile lies beyond the observed range and no p80 exists. A caveat
//     cannot repair a statistic that is undefined.
//   · sf — WITHDRAWN 2026-08-06. Only 37.7% of new-construction filings since
//     2022 carry an issue date at extract (matured 2022 cohort: single 32.4%,
//     multi 23.4%, apartment 44.4%). When most of the cohort has no issue date,
//     the unconditional median time-to-issuance DOES NOT EXIST — the 50th
//     percentile is past the last observation — and a "floor" label cannot rescue
//     an undefined statistic, it just makes an absent number look cautious. LA was
//     withdrawn at 64.1%; SF is far below it.
//     ⚠️ State the SHARE, not the FATE (2026-08-08). Neither feed distinguishes a
//     not-yet from a never, so "37.7% ever issue" and "45.4% never issued" are
//     both unsupported and are retracted phrasings. SF's non-issued rows do carry
//     21 `withdrawn` and 1 `cancelled`, but 173 sit at `filed`; Raleigh's
//     `statuscurrent` vocabulary has no Withdrawn/Denied/Cancelled value at all.
//     The undefinedness above does not depend on fate, so both withdrawals stand.
//
// ⚠️ milwaukee is WITHHELD 2026-08-08, and it is the first city withheld for a
// reason that is not about the data's quality. Milwaukee publishes both dates
// with a 0.00% null rate on each, and its RESIDENTIAL `Use of Building` column
// is a genuine controlled vocabulary (9 values, no singletons, 0.1% blank), so
// one- and two-family dwellings measure cleanly: single 2.3 mo (n=262), multi
// 5.3 mo (n=83), applied 2022-01-01 onward. But the city files ALL 5+-unit
// multifamily as a Commercial New Construction Permit, and the commercial half
// of that same column is FREE TEXT — 123 distinct strings over 354 windowed
// rows, 25.7% of them appearing exactly once, 15.0% blank. The apartment tier
// therefore cannot be enumerated at all.
//
// Publishing the residential pair alone was ALSO refused, for a wiring reason
// that is now FIXED (2026-08-09) — recorded here because the old sentence is
// still quoted elsewhere: measuredFor() used to fall back to `newConstruction`
// for any tier lacking an entry, so an apartment query in Milwaukee would have
// been answered from a population containing no apartments. It no longer does.
// permitStats.json carries a `tierBreakdown` per city, measuredFor() returns
// undefined for a tier absent from an attempted breakdown, and realityCheck.ts
// renders "Not measured for 5+ unit buildings" instead of a wrong figure.
// Milwaukee stays absent for the un-enumerable commercial stratum above, and
// because publishing its residential pair needs a live re-run plus a product
// decision — not because the wiring would mis-serve it.
// scripts/permits/milwaukee.mjs computes every figure, prints them, and halts
// structurally.
//
// ⚠️ atlanta publishes an application date (`Opend` / `OrigOpened`) and NO issue
// date. `StatusDate` is the timestamp of the CURRENT status, so it equals the
// issue date only for the 13,514 of 36,114 rows (37.4%) still sitting at
// Status_1 = 'Issued' — every permit that issued and then moved on to 'Closed',
// 'CO Issued' or 'No CO Required' carries a later milestone instead. Restricting
// to the 37.4% selects permits that issued and then stalled, which is a
// survivorship-biased third, not a sample. That is structural, not a gap we can
// close, so no atlanta pipeline exists.
export const CITIES_WITH_MEASURED_PERMITS = [
  'austin', 'denver', 'miami', 'nashville', 'nyc', 'philadelphia', 'raleigh',
  'seattle',
] as const

export function hasMeasuredPermitTiming(slug: string): boolean {
  return (CITIES_WITH_MEASURED_PERMITS as readonly string[]).includes(slug)
}
