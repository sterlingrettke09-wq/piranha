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
    /** Floor-area ALLOWANCE in square feet, for codes that cap floor area at
     *  "the greater of the ratio or a fixed floor value" — e.g. Austin's HOME
     *  FAR gradient, "0.65 or 4,350 SF". Small lots are governed by the floor
     *  value, not the ratio, so `far * lot` alone understates them.
     *  Applied as max(maxFAR * lot, farFloorSqFt). */
    farFloorSqFt?: number | null
    /** TRUE when the code imposes no FAR limit here at all — a KNOWN absence,
     *  not a missing lookup. Distinguishes "this instrument does not bind"
     *  (floor area is governed by height/setbacks/coverage instead) from
     *  "we don't know the FAR", which `maxFAR: null` alone conflates. */
    farUnconstrained?: boolean
    /** Other programs the code allows, each with its own FAR — ALTERNATIVES to
     *  the headline `maxFAR`, not a range around it. The user picks one.
     *  Austin: one house at 0.40, or three units at 0.65 under HOME.
     *  computeEnvelope sizes these against the lot; same
     *  greater-of-ratio-or-floor rule as `farFloorSqFt`. */
    farAlternatives?: Array<{
      label: string
      far: number
      floorSqFt?: number | null
      source?: string
    }>
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
    /** Which FAR drove the headline floor area: the residential per-use FAR, the
     *  mixed-use per-use FAR, the district maxFAR, 'unconstrained' when the code
     *  imposes NO FAR here, or null when the FAR is simply unknown.
     *  Lets the UI label the envelope so the number isn't read as use-agnostic.
     *
     *  'unconstrained' vs null matters: both carry maxFloorAreaSqFt: null, but
     *  'unconstrained' means "FAR does not bind — height/setbacks/coverage do",
     *  while null means "we could not resolve a FAR". Never render them the
     *  same; the first is an answer, the second is a gap. */
    farBasis: 'residential' | 'mixed' | 'district' | 'unconstrained' | null
    /** Set when the headline floor area came from the code's fixed floor
     *  allowance rather than the ratio (small-lot case). Lets the UI cite the
     *  right half of a "greater of X or Y SF" rule. */
    floorAreaFromAllowance?: boolean
    /** Other programs the code allows on this parcel, each with its own floor
     *  area. These are ALTERNATIVES to the headline, not a range around it —
     *  the headline is the base case (assuming no program the user hasn't
     *  chosen) and these are what becomes available under a different one.
     *  Austin: 0.40 FAR as one house, or 0.65 for three units under HOME. */
    alternatives?: Array<{
      /** Short program label, e.g. "3 units (HOME)". */
      label: string
      maxFloorAreaSqFt: number
      /** Where the alternative comes from, e.g. "Austin HOME, 2024". */
      source?: string
    }>
  }
  overlays: {
    historicDistrict: string | null
    floodZone: string | null
    /** Inside the CA Coastal Zone → a Coastal Development Permit is required. */
    coastalZone?: boolean
    /** Affordable-housing/linkage fee market area (Denver High/Typical, Seattle
     *  Low/Medium/High/Downtown) — lets the fee be parcel-exact, not a midpoint. */
    feeArea?: string
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
    /** Owner is a government/public entity (derived boolean — no name stored). */
    ownerPublic?: boolean
    /** County assessor's total/improvement value, in dollars — a coarse
     *  LAND-COST PROXY only; assessor values typically lag market prices
     *  substantially. Never used in the cost math. */
    assessedValue?: number | null
    /** Qualifier for what `assessedValue` measures, since semantics differ by
     *  city (e.g. 'total assessed (county)', 'improvement only',
     *  'assessed (≈45% of market for most classes)'). Printed by the UI so an
     *  improvement-only number is never shown as a total. */
    assessedValueBasis?: string | null
  }
  sources: Record<string, string>
  fetchedAt: string
}

export type ParcelErrorCode =
  | 'OUT_OF_BBOX'
  | 'NO_PARCEL'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
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

export const PHILADELPHIA_BBOX: Bbox = {
  south: 39.86,
  west: -75.29,
  north: 40.14,
  east: -74.95,
}

export const MIAMI_BBOX: Bbox = {
  south: 25.70,
  west: -80.32,
  north: 25.86,
  east: -80.14,
}

export const SAN_DIEGO_BBOX: Bbox = {
  south: 32.53,
  west: -117.29,
  north: 33.11,
  east: -116.90,
}

export const SAN_JOSE_BBOX: Bbox = {
  south: 37.12,
  west: -122.06,
  north: 37.47,
  east: -121.59,
}

export const NASHVILLE_BBOX: Bbox = {
  south: 35.97,
  west: -87.06,
  north: 36.41,
  east: -86.51,
}

export function isInBbox(bbox: Bbox, lat: number, lng: number): boolean {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

export function isInBostonBbox(lat: number, lng: number): boolean {
  return isInBbox(BOSTON_BBOX, lat, lng)
}
