export interface City {
  slug: string
  name: string
  /** Whether live zoning/parcel data is wired for this city yet. */
  live: boolean
}

// Deploy set. Boston is live; the rest are wired one at a time in v0.2.
export const CITIES: City[] = [
  { slug: 'boston', name: 'Boston', live: true },
  { slug: 'nyc', name: 'New York City', live: false },
  { slug: 'chicago', name: 'Chicago', live: false },
  { slug: 'sf', name: 'San Francisco', live: false },
  { slug: 'seattle', name: 'Seattle', live: false },
]

export const DEFAULT_CITY = 'boston'
