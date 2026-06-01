export interface ParcelInfo {
  address: string
  parcelId: string
  /** GeoJSON-style [lng, lat]. Matches Mapbox + ArcGIS conventions. */
  coordinates: [number, number]
  zoning: {
    districtCode: string
    subdistrict: string | null
    article: string | null
    maxHeightFt: number | null
    maxFAR: number | null
    allowedUses: string[] | null
    /** Max FAR that varies by use (e.g. NYC Resid/Comm/Facil FAR). When set, the
     *  feasibility check prefers the entry matching the proposed use. */
    farByUse?: {
      residential?: number
      commercial?: number
      mixed?: number
      institutional?: number
    }
  }
  lot: {
    sizeSqFt: number | null
    lotType: string | null
  }
  /** City tax-assessment total value, where the assessment reflects market
   *  (full-market states only, e.g. MA). Public record, not a market appraisal. */
  assessedValue?: number | null
  /** The maximum by-right envelope this parcel allows, derived from its zoning
   *  limits and lot size. Estimated; shown only where the inputs are known. */
  envelope?: {
    maxFloorAreaSqFt: number | null
    maxHeightFt: number | null
    maxStories: number | null
    maxUnits: number | null
    allowedUses: string[] | null
  }
  overlays: {
    historicDistrict: string | null
    floodZone: string | null
  }
  /** What currently stands on the parcel, where the city's data carries it.
   *  Every field is optional — the UI shows only what's present. */
  existing?: {
    landUse?: string | null
    yearBuilt?: number | null
    buildingAreaSqFt?: number | null
    units?: number | null
    stories?: number | null
    numBuildings?: number | null
  }
  sources: Record<string, string>
  fetchedAt: string
}

export type ParcelErrorCode =
  | 'OUT_OF_BBOX'
  | 'NO_PARCEL'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'

export interface ParcelError {
  code: ParcelErrorCode
  message: string
}

export interface Bbox {
  south: number
  west: number
  north: number
  east: number
}

export const BOSTON_BBOX: Bbox = {
  south: 42.227,
  west: -71.191,
  north: 42.395,
  east: -70.986,
}

// Five boroughs (generous envelope).
export const NYC_BBOX: Bbox = {
  south: 40.49,
  west: -74.27,
  north: 40.92,
  east: -73.68,
}

export const CHICAGO_BBOX: Bbox = {
  south: 41.64,
  west: -87.95,
  north: 42.03,
  east: -87.52,
}

export const SF_BBOX: Bbox = {
  south: 37.70,
  west: -122.52,
  north: 37.84,
  east: -122.35,
}

export const SEATTLE_BBOX: Bbox = {
  south: 47.49,
  west: -122.44,
  north: 47.74,
  east: -122.22,
}

export const DC_BBOX: Bbox = {
  south: 38.79,
  west: -77.12,
  north: 38.996,
  east: -76.91,
}

export const AUSTIN_BBOX: Bbox = {
  south: 30.10,
  west: -97.94,
  north: 30.52,
  east: -97.57,
}

// City of Los Angeles is sprawling + non-convex; a generous envelope.
export const LA_BBOX: Bbox = {
  south: 33.70,
  west: -118.67,
  north: 34.34,
  east: -118.15,
}

export const DENVER_BBOX: Bbox = {
  south: 39.61,
  west: -105.11,
  north: 39.91,
  east: -104.60,
}

export const MINNEAPOLIS_BBOX: Bbox = {
  south: 44.89,
  west: -93.33,
  north: 45.05,
  east: -93.19,
}

export function isInBbox(bbox: Bbox, lat: number, lng: number): boolean {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

export function isInBostonBbox(lat: number, lng: number): boolean {
  return isInBbox(BOSTON_BBOX, lat, lng)
}
