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
}

// Deploy set — all five live.
export const CITIES: City[] = [
  { slug: 'boston', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 13.2, bbox: BOSTON_BBOX, permitName: 'Boston Inspectional Services', permitUrl: 'https://www.boston.gov/departments/inspectional-services', tagline: 'Red brick, deep harbor, four hundred years.', landmark: [-71.0704, 42.3541] },
  { slug: 'nyc', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 13.4, bbox: NYC_BBOX, permitName: 'NYC Department of Buildings', permitUrl: 'https://www.nyc.gov/site/buildings/index.page', tagline: 'Eight million lives, stacked to the sky.', landmark: [-73.9712, 40.7725] },
  { slug: 'chicago', name: 'Chicago', live: true, center: [-87.6248, 41.8855], zoom: 13.2, bbox: CHICAGO_BBOX, permitName: 'Chicago Department of Buildings', permitUrl: 'https://www.chicago.gov/city/en/depts/bldgs.html', tagline: 'Broad shoulders on a great lake.', landmark: [-87.6233, 41.8827] },
  { slug: 'sf', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 13, bbox: SF_BBOX, permitName: 'SF Department of Building Inspection', permitUrl: 'https://www.sf.gov/departments/department-building-inspection', tagline: 'Fog, hills, and the Golden Gate.', landmark: [-122.4058, 37.8024] },
  { slug: 'seattle', name: 'Seattle', live: true, center: [-122.3331, 47.6080], zoom: 13, bbox: SEATTLE_BBOX, permitName: 'Seattle Dept. of Construction & Inspections', permitUrl: 'https://www.seattle.gov/sdci', tagline: 'Between the mountains and the sound.', landmark: [-122.3493, 47.6205] },
  { slug: 'dc', name: 'Washington, DC', live: true, center: [-77.0364, 38.8951], zoom: 12.8, bbox: DC_BBOX, permitName: 'DC Dept. of Buildings', permitUrl: 'https://dob.dc.gov/', tagline: 'A capital built on grand plans.', landmark: [-77.0091, 38.8899] },
  { slug: 'austin', name: 'Austin', live: true, center: [-97.7431, 30.2672], zoom: 12.8, bbox: AUSTIN_BBOX, permitName: 'Austin Development Services Dept.', permitUrl: 'https://www.austintexas.gov/department/development-services', tagline: 'Live music and live cranes.', landmark: [-97.7404, 30.2747] },
  { slug: 'la', name: 'Los Angeles', live: true, center: [-118.2437, 34.0522], zoom: 12.4, bbox: LA_BBOX, permitName: 'LA Dept. of Building & Safety', permitUrl: 'https://www.ladbs.org/', tagline: 'A horizon that never stops.', landmark: [-118.2468, 34.0407] },
  { slug: 'denver', name: 'Denver', live: true, center: [-104.9903, 39.7392], zoom: 12.8, bbox: DENVER_BBOX, permitName: 'Denver Community Planning & Development', permitUrl: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development', tagline: 'A mile high and climbing.', landmark: [-104.9876, 39.7486] },
  { slug: 'minneapolis', name: 'Minneapolis', live: true, center: [-93.2650, 44.9778], zoom: 12.8, bbox: MINNEAPOLIS_BBOX, permitName: 'Minneapolis Community Planning & Economic Development', permitUrl: 'https://www2.minneapolismn.gov/business-services/planning-zoning/', tagline: 'Mills, lakes, and bold building.', landmark: [-93.2577, 44.9794] },
]

export const DEFAULT_CITY = 'boston'

// The first cohort, shown directly in the header dropdown. The rest live on the
// /cities page (reached via "See all cities") so the menu stays short.
export const PRIMARY_CITY_SLUGS = ['boston', 'nyc', 'chicago', 'sf', 'seattle']

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
