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
