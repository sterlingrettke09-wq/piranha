export interface City {
  slug: string
  name: string
  /** Whether live zoning/parcel data is wired for this city yet. */
  live: boolean
  /** Map center [lng, lat] and zoom for the dashboard. */
  center: [number, number]
  zoom: number
}

// Deploy set. Boston + NYC are live; the rest are wired one at a time.
export const CITIES: City[] = [
  { slug: 'boston', name: 'Boston', live: true, center: [-71.0589, 42.3601], zoom: 12 },
  { slug: 'nyc', name: 'New York City', live: true, center: [-73.9857, 40.7549], zoom: 11 },
  { slug: 'chicago', name: 'Chicago', live: true, center: [-87.6298, 41.8781], zoom: 11 },
  { slug: 'sf', name: 'San Francisco', live: true, center: [-122.4194, 37.7749], zoom: 12 },
  { slug: 'seattle', name: 'Seattle', live: true, center: [-122.3321, 47.6062], zoom: 12 },
]

export const DEFAULT_CITY = 'boston'

export function getCity(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0]
}
