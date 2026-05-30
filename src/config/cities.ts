import { BOSTON_BBOX, NYC_BBOX, CHICAGO_BBOX, SF_BBOX, SEATTLE_BBOX, type Bbox } from '../types/parcel'

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
}

// Deploy set — all five live.
export const CITIES: City[] = [
  { slug: 'boston', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 13.2, bbox: BOSTON_BBOX, permitName: 'Boston Inspectional Services', permitUrl: 'https://www.boston.gov/departments/inspectional-services', tagline: 'Red brick, deep harbor, four hundred years.' },
  { slug: 'nyc', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 13.4, bbox: NYC_BBOX, permitName: 'NYC Department of Buildings', permitUrl: 'https://www.nyc.gov/site/buildings/index.page', tagline: 'Eight million lives, stacked to the sky.' },
  { slug: 'chicago', name: 'Chicago', live: true, center: [-87.6248, 41.8855], zoom: 13.2, bbox: CHICAGO_BBOX, permitName: 'Chicago Department of Buildings', permitUrl: 'https://www.chicago.gov/city/en/depts/bldgs.html', tagline: 'Broad shoulders on a great lake.' },
  { slug: 'sf', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 13, bbox: SF_BBOX, permitName: 'SF Department of Building Inspection', permitUrl: 'https://www.sf.gov/departments/department-building-inspection', tagline: 'Fog, hills, and the Golden Gate.' },
  { slug: 'seattle', name: 'Seattle', live: true, center: [-122.3331, 47.6080], zoom: 13, bbox: SEATTLE_BBOX, permitName: 'Seattle Dept. of Construction & Inspections', permitUrl: 'https://www.seattle.gov/sdci', tagline: 'Between the mountains and the sound.' },
]

export const DEFAULT_CITY = 'boston'

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
