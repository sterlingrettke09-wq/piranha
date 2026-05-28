export interface ParcelInfo {
  address: string
  parcelId: string
  coordinates: [number, number]
  zoning: {
    districtCode: string
    subdistrict: string | null
    article: string | null
    maxHeightFt: number | null
    maxFAR: number | null
    allowedUses: string[] | null
  }
  lot: {
    sizeSqFt: number | null
    lotType: string | null
  }
  overlays: {
    historicDistrict: string | null
    floodZone: string | null
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

export const BOSTON_BBOX = {
  south: 42.227,
  west: -71.191,
  north: 42.395,
  east: -70.986,
} as const

export function isInBostonBbox(lat: number, lng: number): boolean {
  return (
    lat >= BOSTON_BBOX.south &&
    lat <= BOSTON_BBOX.north &&
    lng >= BOSTON_BBOX.west &&
    lng <= BOSTON_BBOX.east
  )
}
