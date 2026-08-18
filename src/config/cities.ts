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
  DALLAS_BBOX,
  LAS_VEGAS_BBOX,
  PHOENIX_BBOX,
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

  // ── The 2026-08-09 cohort ────────────────────────────────────────────────
  // Same provenance discipline as the cohort above, and one thing that is NEW to
  // all three and stated once rather than per city:
  //   · Each has a regional parcel layer and a city-only zoning layer, and each
  //     has a neighbouring jurisdiction INSIDE its bounding box. Their providers
  //     therefore fetch a CITY-BOUNDARY POLYGON as a gate and REFUSE a point
  //     outside it — the columbus.ts pattern, now the third, fourth and fifth
  //     instance. See src/types/parcel.ts for why the gate is a polygon and not
  //     a `CITY = '…'` attribute in any of the three; it was cross-tabbed
  //     against each zoning layer and the attribute lost twice and did not exist
  //     the third time.
  //   · center/landmark are MEASURED — the area-weighted centroid of each
  //     city's own downtown-district polygons, the same instrument the
  //     2026-08-08 cohort used.
  //   · zoom is NOT a measurement. It is a display choice set from each city's
  //     bbox span to match cities already in this file with comparable spans.
  //   · zoningLayer is undefined for all three. For Las Vegas and Phoenix the
  //     reason is the same CSP gap Raleigh's entry records — netlify.toml's
  //     connect-src carries no lasvegasnevada.gov or phoenix.gov host (grepped,
  //     zero matches) — and NOT a CORS finding, since no cross-origin probe was
  //     run against either. Dallas is the exception and its reason is different
  //     and worse; it is stated at its own entry rather than folded in here.

  { slug: 'dallas', stateLabel: 'Dallas, TX', name: 'Dallas', live: true, center: [-96.8017, 32.7790], zoom: 12.4, bbox: DALLAS_BBOX, permitName: 'Dallas Planning & Development', permitUrl: 'https://dallascityhall.com/departments/sustainabledevelopment/Pages/default.aspx', tagline: 'A skyline the prairie never asked for.', landmark: [-96.8094, 32.7757],
    // center: area-weighted centroid of the CA-1(A) Central Area District
    // polygon (the code's own CBD, 686.7 mapped acres), computed from its rings
    // in 4326 with holes subtracted — not the extent midpoint, which is a
    // bounding-box artifact. Cross-checked: adding CA-2(A) and PD-619 (the other
    // downtown districts, 69.8 ac) moves it 0.07 km, to -96.801011, 32.779415.
    // landmark: polygon centroid of 300 Reunion Blvd (Reunion Tower / Hyatt
    // Regency), identified FROM THE DATA rather than from memory — the parcel row
    // at that point returns ST_NUM 300, ST_NAME 'REUNION BLVD', BLDG_CL 'HOTEL'.
    // 0.9 km from center.
    // permitUrl: read, not guessed. /departments/developmentservices/Pages/
    // default.aspx and /departments/development-services/... were tried FIRST
    // and both returned 404 — which proves those guesses wrong, not that a
    // development-services department is absent (rule 8). The URL above returns
    // 200 with <title>Planning and Development</title> and its own
    // <link rel="canonical"> (the canonical prints a ':443' SharePoint artifact,
    // stripped here).
    //
    // ⚠️ zoningLayer is undefined for a reason that is NOT the usual CSP gap, and
    // this matters because the obvious fix would ship a false map. Two things
    // were probed and both came back fine: CORS is OPEN (a GET of
    // .../MapServer/15/query?f=geojson with an Origin header returns 200 with
    // access-control-allow-origin echoing it, probed twice), and the CSP gap is
    // real but closable. The BLOCKING reason is the shared classifier. Running
    // `classifyZoningFamily` over all 60 live ZONE_DIST values gives 45 'other',
    // 8 'residential', 7 'commercial', 0 'industrial' — and one of the eight
    // "residential" hits is RR, which in Dallas is the REGIONAL RETAIL district,
    // 3,275 acres, matched by the classifier's Boston `^RR` convention. Shipping
    // the overlay would paint 3,275 acres of retail green while leaving ~9,600
    // acres of MF districts neutral. That is a false claim on a map, so the
    // overlay stays off until classifyZoningFamily learns Dallas's vocabulary.
    // If it is extended, the entry is { url: '…/sdc_public/Zoning/MapServer/15',
    // codeField: 'LONG_ZONE_DIST' } plus gis.dallascityhall.com in the CSP.
    zoningLayer: undefined },

  { slug: 'lasvegas', stateLabel: 'Las Vegas, NV', name: 'Las Vegas', live: true, center: [-115.1541, 36.1729], zoom: 12.4, bbox: LAS_VEGAS_BBOX, permitName: 'Las Vegas Building & Safety', permitUrl: 'https://www.lasvegasnevada.gov/Business/Planning-Zoning/Building-Safety', tagline: 'A city the desert was not asked about.', landmark: [-115.1541, 36.1729],
    // center/landmark: the SHAPE_Area-weighted centroid of all 1,755 Form-Based
    // Code transect polygons (ZONE IN T3-N…T6-UGL, 866.9 acres) on
    // DevelopmentServices/Zoning/MapServer/0, computed 2026-08-09 from geometry
    // returned at outSR=4326 — the same method Atlanta's SPI-1 centre used. The
    // FBC area is INSIDE downtown Las Vegas, and the containment runs one way
    // only — RETRACTED 2026-08-10, this line previously read "The FBC area IS
    // downtown Las Vegas: LVMC Appendix F establishes the DTLV-O over it", which
    // is backwards. § 19.09.020.D(1): "The FBC applies only to the Downtown Las
    // Vegas Overlay District established in LVMC Section 19.10.110 which
    // encompasses the 12 Downtown Districts … The City will begin the process of
    // implementing the FBC with a pilot area located within the Las Vegas
    // Medical District." Transect zone ⟹ DTLV-O; the converse is false. Measured:
    // the transect polygons are 866.9 acres against ~2,997 acres of DTLV-O Area
    // polygons, so treating the two as coextensive understates the overlay by
    // ~3.5×. The centre point is unchanged — an 866.9-acre downtown pilot is
    // still the right place to open the map — but the claim about what it IS is
    // not. Deliberately NOT the Strip, which is unincorporated Clark County
    // and returns no City zoning at all (measured: 8 of 8 sampled points) — and
    // which the jurisdiction gate now refuses outright. The extent midpoint of
    // the same set is [-115.146218, 36.172696]; the area-weighted figure is used
    // because it is less sensitive to one outlying polygon.
    // permitUrl: `/Government/Departments/Building-Safety` was tried first and
    // 301-redirects to the URL above, which returns 200 with
    // <title>Building & Safety</title>. lasvegasnevada.gov publishes NO
    // <link rel="canonical"> anywhere (checked on three pages), so the evidence
    // is a live redirect target plus the page's own title — weaker than
    // Columbus's canonical tag, and recorded as such.
    zoningLayer: undefined },

  { slug: 'phoenix', stateLabel: 'Phoenix, AZ', name: 'Phoenix', live: true, center: [-112.074124, 33.4528], zoom: 12.2, bbox: PHOENIX_BBOX, permitName: 'Phoenix Planning & Development Department', permitUrl: 'https://www.phoenix.gov/administration/departments/pdd.html', tagline: 'A desert grid, running out of edges.', landmark: [-112.074124, 33.4528],
    // center/landmark: acres-weighted centroid of the 104 Downtown Code (DTC-*)
    // polygons on Public/Zoning/MapServer/0 — 1,248.9 acres. Measured, not
    // eyeballed.
    // permitUrl: read from the department page's own <link rel="canonical">,
    // which resolves https://www.phoenix.gov/pdd to the URL above. Page <title>
    // is "Planning and Development Department | City of Phoenix". Same strength
    // of evidence as Raleigh's and Columbus's canonical tags, and stronger than
    // Atlanta's title-only line.
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
//
// ⚠️ THE DELIBERATE-ABSENCE CARVE-OUT THIS NOTE CARRIED IS EMPTY AS OF
// 2026-08-10, and the record of it is kept rather than deleted because a reader
// who remembers it needs to see why it went (rule 17). From 2026-08-09 it named
// cities that were fully wired — provider, zoning module, dispatcher,
// jurisdiction gate, parking rule, cost index, probe — and DELIBERATELY ABSENT
// from the list below, because no city-specific hurdle had been researched for
// any of them. Being wired is precisely where a reader would otherwise assume
// encoding, and each one's probe returned 3 hurdles — the generic floor of
// historic review, flood, permit fees and demolition — rather than more. It
// named dallas, lasvegas and phoenix; PHOENIX WAS THE LAST OF THE THREE AND WAS
// SO NAMED UNTIL 2026-08-10. The list below is now 23 of 23 live cities, so the
// carve-out applies to no city today. Do NOT read that as completeness — the
// paragraph above already disclaims it, and it is the claim most likely to be
// made on this list's behalf: it is binary, and says only that a city has SOME
// encoded specifics. `src/config/cities.test.ts` still guards this note, and one
// of its tests fails if NEITHER this note nor the permits note names a
// deliberately-absent city; the permits note still names three, so the guard is
// live rather than inert. If that ever changes, delete that test on purpose
// rather than leaving one that can only pass.
//
// LAS VEGAS WAS THE SECOND CITY IN THIS NOTE UNTIL 2026-08-10 and is now on the
// list above. Title 19 was read from the publisher the City's own Zoning Code
// page links by name, and Titles 4, 14 and 20 from the publisher the City
// Attorney's Laws & Codes page links — which is the structural finding of that
// read and the reason it is recorded here: Title 19 carries NO fee, NO drainage
// permit and NO landscape-water rule, so a reader who stopped at the zoning code
// would have reported Las Vegas as a city with almost no exactions. Eleven rows
// are encoded — the inclusionary ABSENCE (a FOURTH shape: NRS 278.250(4)–(5)
// authorises inclusionary zoning BY NAME and defines it, and the City has still
// not adopted one, which is neither Wisconsin's ban, North Carolina's silence
// nor Texas's price cap), two 2025 State mandates on the City that are not
// visible in the published code, Site Development Plan Review, the Development
// Impact Notice and Assessment, plan-governed districts, the Form-Based Code /
// DTLV-O overlay, a recorded entitlement on the parcel's own zoning row,
// rezoning, the desert-tortoise MSHCP fee, the residential construction tax, the
// sewer and traffic-signal fees, off-site improvements, the Title 20 drainage
// permit, the turf prohibition and the HD-O overlay. What was researched and
// deliberately NOT encoded is recorded on the rows themselves and in the ledger
// entry, not here: any `addsMonths` (Las Vegas publishes no shot clock at all —
// every figure is a filing lead, a notice period, an appeal window, an expiry or
// a re-application bar), DINA's trip-generation limb (Title 19 publishes no trip
// table, so an ITE rate would be rule 4's invented conversion), the DTLV-O Area
// 1/2/3 boundary and the `CLV_DTMasterPlan` / `RedevelopmentAreas` layers as
// gates (measured to exist, but the label match to Appendix F's own figures is a
// plausible inference, not a measurement), a park land dedication row (positively
// excluded — NRS 278.4987 makes dedication and the construction tax mutually
// exclusive and the City elected the tax), and Titles 6, 9–13 and 16, which were
// not opened at all. The candidate line this note used to carry was half wrong
// in the direction that flatters, and is kept for that reason: it recorded
// § 19.08.040(E)'s HCDDM reference as a hurdle, and that sentence is hortatory
// ("drainageways SHOULD be lined") — the binding rule is LVMC Title 20's
// citywide "unlawful … without first obtaining a development permit", in a title
// a zoning reader never opens.
//
// DALLAS WAS THE THIRD CITY IN THIS NOTE UNTIL 2026-08-10 and is now on the list
// above. Chapter 51A was read from the city's electronic code of record and nine
// rows encoded in `hurdles.ts` — the inclusionary ABSENCE (and it is a third
// shape of one: Texas caps a maximum SALES PRICE at Tex. Loc. Gov't Code
// § 214.905(a) and expressly preserves density bonuses, so it is neither
// Wisconsin's ban nor North Carolina's silence), development impact review,
// SUP conditions, planned development, conservation district, rezoning, park
// land dedication, urban forest conservation, floodplain, platting, the state
// 45-day permit clock and historic demolition, plus a `HISTORIC_BODY` entry.
// The candidate line this note used to carry was wrong in a way worth keeping:
// it recorded § 51A-4.803 as "development impact review at ≥6,000 trips/day",
// and the code says 6,000 trips per day AND 500 trips per day per acre, inside a
// closed list of districts — encoding the first clause alone would have fired
// the row on any 911-unit project anywhere in Dallas. What Dallas researched and
// deliberately did NOT encode is recorded on the rows themselves and in the
// ledger entry, not here: Chapter 51P's per-PD ordinances (the publisher does
// not carry Chapter 51P at all), the Demolition Delay Overlay (§ 51A-4.504 — the
// layer is unfetched and carries 4 polygons citywide, so a teardown-gated row
// would over-fire), the six unfetched overlays at §§ 51A-4.502/.506/.507/.508/
// .510/.511, stormwater, the escarpment zone, landscaping, impact fees and every
// fee AMOUNT (all route to the § 51A-1.105 fee schedule, which is not in the
// code text). One live defect the read turned up — `providers/dallas.ts`'s
// residential proximity slope sentence omits seven origination districts and the
// 1:1 limb of § 51A-4.412(c) — is a separate fix and is NOT closed by this list.
//
// PHOENIX WAS THE LAST CITY IN THIS NOTE UNTIL 2026-08-10 and is now on the list
// above. Surveyed 2026-08-10 and encoded as thirteen rows, and the structural
// finding of that read is why half of them cite a chapter a zoning reader never
// opens: the Phoenix ZONING ORDINANCE contains no impact fee, no retention
// standard and no grading permit — those are City Code chs. 29 and 32A, a
// separate instrument from the same publisher. The rows are the county island
// (mapped ZONING='COUNTY', where the Maricopa County ordinance governs and this
// tool has not read it), § 507 development review, the inclusionary ABSENCE
// (Milwaukee's shape and NOT Dallas's — Ariz. Rev. Stat. § 9-461.16(A) is a
// genuine preemption reaching the LEASE price as well as the sale price and
// barring a set-aside by class, where Texas's § 214.905 caps a for-sale price
// only, so neither row may be copied onto the other city), § 32A-24 on-site
// stormwater retention, ch. 29 impact fees, § 703.B multifamily landscape and
// open space, § 703.E plant salvage, plan-governed districts, mapped overlays,
// § 506 rezoning, the A.R.S. § 9-500.12 exaction appeal, the A.R.S. § 9-835
// licensing clocks and § 813 historic demolition, plus a `HISTORIC_BODY` entry.
// The branch carries NO addsMonths at all: every number § 506, § 507, § 812,
// § 813 and A.R.S. § 9-835 publish is a shot clock, a ceiling, an appeal window,
// an expiry or a restraint. Unlike Las Vegas and Dallas there was no candidate
// line to inherit — this note carried only "Phoenix — not surveyed" — which cut
// both ways: nothing to correct, and nothing to start from. What Phoenix
// researched and deliberately did NOT encode is recorded on the rows themselves
// and in the ledger entry, not here: the impact-fee AREA boundaries (no layer
// publishes them, so the fee row names the nine areas and computes only the two
// categories Appendix A prices for the balance of the city), City Code ch. 32B
// floodplains and ch. 32C stormwater quality, the Stormwater Policies and
// Standards Manual (adopted by reference at § 32A-23 and not in the code text),
// Phoenix's own published A.R.S. § 9-835 time frames, the roughly thirty overlay
// districts at §§ 644–672, and Chapters 12 and 13 (the Downtown Code and the
// Walkable Urban Code), which are separate regulatory regimes this branch does
// not read. Three corrections the read produced are worth keeping: City Code ch.
// 34 "Trees and Vegetation" is a street-tree ASSESSMENT DISTRICT procedure with
// no development trigger and is not Phoenix's tree ordinance (§ 703.E is);
// § 501 "Required permits and approvals" is RESERVED and has no text, so the
// applicability rule is § 507.B; and the $600/$360 ch. 19A/19C occupational fees
// are superseded wherever a ch. 29 treatment impact fee is due (§ 19A-2(f),
// § 19C-2(c), Ord. G-7376, 2025), so anything written before 2025-06-23
// double-counts them.
//
// The Las Vegas candidate line is kept above rather than deleted, because both
// of its entries turned out to be instructive: the HD-O overlay is real and was
// encoded as an ungated 'info' row precisely BECAUSE no layer publishes it
// (re-enumerated 2026-08-10, finding unchanged), and § 19.08.040(E) was the
// hortatory sentence that the Title 20 permit replaced.
export const CITIES_WITH_SPECIFIC_HURDLES = [
  'atlanta', 'austin', 'boston', 'charlotte', 'chicago', 'columbus', 'dallas',
  'dc', 'denver', 'la', 'lasvegas', 'miami', 'milwaukee', 'minneapolis',
  'nashville', 'nyc', 'philadelphia', 'phoenix', 'raleigh', 'sandiego',
  'sanjose', 'seattle', 'sf',
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
 * Atlanta is the case where a pipeline EXISTS and refuses outright. Milwaukee's
 * refuses IN PART — it publishes two tiers and withholds the apartment tier and
 * the city aggregate — which is a third state this list could not express before
 * 2026-08-18. See scripts/permits/milwaukee.mjs and the notes below.
 *
 * This exists for the same reason `CITIES_WITH_SPECIFIC_HURDLES` does. Compare
 * renders cities side by side, and a city with no measured line reads as faster
 * or simpler rather than unmeasured — absence of a finding rendering as a finding
 * of absence, in the direction that flatters. Third instance of that shape.
 *
 * Kept honest by a test that reads permitStats.json and asserts this list matches
 * it exactly, so measuring another city cannot silently leave the list stale —
 * nor, as NYC's 2026-08-09 withdrawal proved, can WITHDRAWING one. A half-done
 * withdrawal (artifact emptied, list not) would keep marking NYC as measured in
 * Compare while its result page showed nothing, which is the worse direction.
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
//     SOURCE (established 2026-08-09): these shares are measured on LADBS's
//     SUBMITTED feed, Socrata `gwh9-jnip` — `permit_type='Bldg-New'`,
//     `submitted_date >= 2022-01-01`: 11,810 of 26,035 rows carry no issue date
//     (45.36%), observed share 54.64%; the 2022 cohort is 3,901/6,085 = 64.11%.
//     NOT from `pi9x-tg5x`, the ISSUED feed la.mjs reads, where the share is
//     100% by construction. A 2026-08-09 note recording this claim as
//     "does not reproduce" was measuring the issued feed and has been withdrawn
//     (rule 11 — measure the pipeline, not your probe). At 54.64% observed the
//     p50 IS identified and the p80 is not, which is exactly the finding above.
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
//     RE-CHECKED 2026-08-09 against LA's real denominator feed `gwh9-jnip`, which
//     was not known when this retraction was written: its 11,810 no-issue rows
//     run Quality Review Completed 5,592, Verifications in Progress 2,902, PC
//     Info Complete 1,215, Corrections Issued 698, PC Approved 648, Ready to
//     Issue 286, Submitted 87, Plans on Hold 16 — every value an IN-PROGRESS
//     state, with no Withdrawn, Denied or Expired anywhere in the domain. So LA
//     cannot separate a not-yet from a never either, and the retraction holds on
//     the better feed rather than merely on the one that lacked the column.
//
// ✅ milwaukee PUBLISHES 2026-08-18, in part — the first city in the artifact to
// carry tiers with NO city aggregate. The block that stood here recorded it as
// wholly withheld and named a live re-run plus an untaken product decision as
// what remained; both have since happened, so the block is replaced rather than
// annotated (rule 21 — a correction that reproduces the claim it corrects is
// indistinguishable from the claim).
//
// WHAT PUBLISHES: single 2.3 mo (n=262) and multi 5.3 mo (n=83), applied
// 2022-01-01 onward, off a genuine controlled vocabulary (9 values, no
// singletons, 0.1% blank).
//
// WHAT DOES NOT, and why the aggregate is absent on purpose: Milwaukee files ALL
// 5+-unit multifamily as a Commercial New Construction Permit, and the
// commercial half of that same column is FREE TEXT — re-measured 2026-08-18 at
// 123 distinct strings over 354 windowed rows, 25.7% appearing exactly once,
// 15.0% blank. So apartments are UNENUMERABLE, not scarce, and there is no
// city-wide population to average: writing a houses-only median under
// `newConstruction` would put it behind the key every other city fills with its
// whole new-construction population.
//
// WHAT UNBLOCKED IT was not new data. The refusal was that the scope caveat
// would live in a `vintage` string no surface renders — the mechanism that
// published NYC's 8.3 as an unconditional median. That is now a GUARD:
// measuredFor() fails closed for any tier absent from an attempted breakdown, so
// an apartment query cannot reach a 1-2-family number whatever any string says.
// The apartment tier carries `basis: 'unenumerable'` and renders the feed's own
// reason. A guard is not a caveat, and that difference is the whole decision.
//
// ⚠️ atlanta publishes an application date (`Opend` / `OrigOpened`) and NO issue
// date. `StatusDate` is the timestamp of the CURRENT status, so it equals the
// issue date only for the 13,514 of 36,114 rows (37.4%) still sitting at
// Status_1 = 'Issued' — every permit that issued and then moved on to 'Closed',
// 'CO Issued' or 'No CO Required' carries a later milestone instead. Restricting
// to the 37.4% selects permits that issued and then stalled, which is a
// survivorship-biased third, not a sample. That is structural, not a gap we can
// close, so no atlanta pipeline exists.
// ⚠️ dallas, lasvegas and phoenix are absent, and all three now have FINDINGS —
// this note said the opposite until 2026-08-10, when it still asserted that none
// of the three had been looked at and that no feed had been opened for any of
// them. (The retracted sentence is described rather than quoted: quoting it
// verbatim trips the guard below, which is the correct behaviour — a retracted
// claim restated in live prose is indistinguishable from a current one.) That
// was true when written and false by the time anyone read it; it is corrected
// rather than deleted because a reader who remembers it needs to see the
// correction (rule 17), and because `src/config/cities.test.ts` now fails if a
// city called uninvestigated here has a script proving otherwise — which is how
// this staleness was caught.
//
// dallas — a pipeline EXISTS and refuses (scripts/permits/dallas.mjs). The only
// feed carrying both dates is a frozen snapshot of the retired Posse system
// ("no updates planned", max date 2024-11-12, re-probed each run), and 73.44% of
// gated 2022+ filings carry an issue date — enough to identify a median, not the
// p80, with the apartment tier at 47.76%, below even the median's bar. The feed
// can never mature, so this is a measured refusal, not a gap.
// lasvegas — verified no: the open-data permits feed has no SLOT for an
// application date (ISSDTTM is its only date field), and the one internal layer
// carrying both measured unusable (~11.6x row duplication, misaligned columns).
// phoenix — verified no: no per-permit dataset exists at all, established by
// enumerating the full 160-package CKAN catalogue rather than by a failed guess.
// ⚠️ nyc was WITHDRAWN 2026-08-09, after shipping 8.3 mo / p80 17.0 / n=4,403
// from 2026-08-06. The disqualifier was already written down IN THE PIPELINE
// THAT PRODUCED IT: scripts/permits/nyc.mjs recorded that 45% of initial New
// Building filings since 2022 carried no issue date, and that Kaplan-Meier over
// all 8,039 gave ~15.9 months — roughly 2x the number being served. The script's
// own `pull()` could not see that, because its WHERE clause ended
// `AND first_permit_date IS NOT NULL`: a query that selects on the outcome
// cannot measure how often the outcome occurs (rule 11).
//
// 8.3 was a CONDITIONAL median — time to issuance GIVEN issuance. The only place
// that condition could have been stated is the `vintage` string, and
// src/lib/realityCheck.ts never renders it: the card said "Median filing→permit
// in New York City". Milwaukee's residential pair was withheld for exactly this
// reason until 2026-08-18, and what released it sharpens the point rather than
// weakening it: the caveat did not get better wording, it became a GUARD that
// fails closed. NYC has no equivalent available — its whole figure is
// conditional, not one tier of it, so there is no boundary to fail closed on.
// NYC is not an exception for being large.
//
// WHICH LIMB BINDS (measured 2026-08-09 against w9ak-ipjd, through the script's
// own filters, with the IS NOT NULL removed): 662 of 1,040 in-window -I1 filings
// carry an issue date = 63.65%. That clears p50 and does NOT clear p80, so it is
// specifically the published p80 of 17.0 that is unidentified — LA's shape, not
// SF's. Per filing year: 2022 71.4%, 2023 63.4%, 2024 57.0%, 2025 46.8%. Even
// the matured 2022 cohort fails p80, so restricting the window does not rescue it.
//
// ⚠️ WITHDRAWING IS NOT PUBLISHING 15.9. The Kaplan-Meier figure rests on an
// assumption about the non-issued filings that has not been adopted here, and
// NYC's `filing_status` shows the population is mixed — over the 378 non-issued
// rows: Objections 155, Approved 151, Filing Withdrawn 57, Plan Examiner Review
// 7, On Hold 6, QA Failed 1, OnHold-NoGoodCheck 1. Only the 57 are a terminal
// never. State the SHARE, not the FATE.
//
// ⚠️ SEPARATELY, AND NOT THE REASON FOR THE WITHDRAWAL: the committed n=4,403 no
// longer reproduces from the feed at all. Today `job_type='New Building'` returns
// 13,353 rows of which 5,469 are permitted and 914 are `-I1`, against the 19,319
// permitted / 4,394 `-I1` the script's header records. No reframing recovered the
// old counts. Cause undiagnosed; recorded so nobody reads today's smaller cohort
// as a contradiction of the shares above.
// ⚠️ seattle was WITHDRAWN 2026-08-09, hours after NYC, after shipping 5.7 mo /
// p80 10.0 / n=4,996 from 2026-08-06. Same defect class, different discovery
// path: nobody was auditing Seattle. The outcome-selection guard
// (scripts/permits/outcome-selection.ts) was built 2026-08-09 to stop city 24
// inheriting the issued-only predicate by clone, and its registry refuses a
// `known-defect` exemption without a MEASURED share attached — so measuring
// Seattle's was the price of exempting it. The measurement is what disqualified
// the figure: seattle.mjs's own cohort filter run against 76t5-zqzr both ways
// gives 6,980 in-window applications, 5,215 with the `issueddate IS NOT NULL`
// limb — the predicate hid 1,765 filings (25.29%), so the observed share is
// 74.71%. Under the quantile-existence rule (a p-th quantile is identified only
// when the observed share exceeds p), 74.71% identifies the p50 and does NOT
// identify the published p80 of 10.0. The guard built to stop city 24 caught
// city 5.
//
// THE MEDIAN IS NOT REPUBLISHED ALONE, for the Milwaukee reason. 5.7 at 74.71%
// observed is a CONDITIONAL median — time to issuance GIVEN issuance — and the
// only field that could state the condition is `vintage`, which no UI surface
// renders (src/lib/realityCheck.ts renders medianMonths/p80Months/n only). A
// conditional figure whose condition nobody can see is the exact thing
// Milwaukee's residential pair was withheld over until a guard replaced the
// string (2026-08-18); Seattle's condition applies to the whole figure, so no
// tier boundary can carry it. Seattle is not an exception for having a higher
// share.
//
// THE TWO-ARM SHAPE, so the next reader doesn't re-average it: seattle.mjs pulls
// a 'New' arm and a detached-ADU arm gated on `description`. Both gates are
// filing-time (description is populated on 2001/2001 non-issued filings — the
// 2026-08-06 (A2) fix), so each arm's observed share is separately measurable at
// run time and the refusal gate reports them separately. The pre-(A2) ADU gate
// on `dwellingunittype` — null for 100% of non-issued filings, i.e. issued-only
// BY CONSTRUCTION — is the shape to never reintroduce: an arm with no
// denominator cannot even state its own condition. And the per-TIER shares are
// only bounded, not point-valued (`housingunitsadded` is 58.2% populated on
// non-issued rows), so the withdrawn byTier p80s could not be re-identified even
// at a higher aggregate share without settling that interval.
export const CITIES_WITH_MEASURED_PERMITS = [
  'austin', 'denver', 'miami', 'nashville', 'philadelphia', 'raleigh',
  // Tiers only, no city aggregate — see the milwaukee note above. Membership
  // here means "publishes measured permit timing", NOT "has a city-wide median",
  // and Milwaukee is the first city where those differ.
  'milwaukee',
] as const

export function hasMeasuredPermitTiming(slug: string): boolean {
  return (CITIES_WITH_MEASURED_PERMITS as readonly string[]).includes(slug)
}
