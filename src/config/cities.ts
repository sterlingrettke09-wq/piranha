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
  { slug: 'boston', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 12, bbox: BOSTON_BBOX, permitName: 'Boston Inspectional Services', permitUrl: 'https://www.boston.gov/departments/inspectional-services', tagline: 'Brownstones, the BPDA, and four centuries of rules.' },
  { slug: 'nyc', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 11, bbox: NYC_BBOX, permitName: 'NYC Department of Buildings', permitUrl: 'https://www.nyc.gov/site/buildings/index.page', tagline: 'Five boroughs, MapPLUTO, and the ULURP gauntlet.' },
  { slug: 'chicago', name: 'Chicago', live: true, center: [-87.6298, 41.8781], zoom: 11, bbox: CHICAGO_BBOX, permitName: 'Chicago Department of Buildings', permitUrl: 'https://www.chicago.gov/city/en/depts/bldgs.html', tagline: 'The grid, the aldermen, and Connected Communities.' },
  { slug: 'sf', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 12, bbox: SF_BBOX, permitName: 'SF Department of Building Inspection', permitUrl: 'https://www.sf.gov/departments/department-building-inspection', tagline: 'Steep hills, CEQA, and the hardest approvals in America.' },
  { slug: 'seattle', name: 'Seattle', live: true, center: [-122.3321, 47.6062], zoom: 12, bbox: SEATTLE_BBOX, permitName: 'Seattle Dept. of Construction & Inspections', permitUrl: 'https://www.seattle.gov/sdci', tagline: 'Middle housing, SEPA, and the urban-village map.' },
]

export const DEFAULT_CITY = 'boston'

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
