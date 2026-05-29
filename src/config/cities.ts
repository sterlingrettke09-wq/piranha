export interface City {
  slug: string
  name: string
  /** Whether live zoning/parcel data is wired for this city yet. */
  live: boolean
  /** Map center [lng, lat] and zoom for the dashboard. */
  center: [number, number]
  zoom: number
  /** Where to take the next real step (permitting / planning dept). */
  permitName: string
  permitUrl: string
}

// Deploy set — all five live.
export const CITIES: City[] = [
  { slug: 'boston', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 12, permitName: 'Boston Inspectional Services', permitUrl: 'https://www.boston.gov/departments/inspectional-services' },
  { slug: 'nyc', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 11, permitName: 'NYC Department of Buildings', permitUrl: 'https://www.nyc.gov/site/buildings/index.page' },
  { slug: 'chicago', name: 'Chicago', live: true, center: [-87.6298, 41.8781], zoom: 11, permitName: 'Chicago Department of Buildings', permitUrl: 'https://www.chicago.gov/city/en/depts/bldgs.html' },
  { slug: 'sf', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 12, permitName: 'SF Department of Building Inspection', permitUrl: 'https://www.sf.gov/departments/department-building-inspection' },
  { slug: 'seattle', name: 'Seattle', live: true, center: [-122.3321, 47.6062], zoom: 12, permitName: 'Seattle Dept. of Construction & Inspections', permitUrl: 'https://www.seattle.gov/sdci' },
]

export const DEFAULT_CITY = 'boston'

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
