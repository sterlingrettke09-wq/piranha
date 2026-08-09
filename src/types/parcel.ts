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
    /** Max stories where the CODE regulates in stories rather than feet (Miami
     *  21, Denver). When set, the envelope uses it directly instead of deriving
     *  a story count from height — deriving round-trips through two different
     *  floor-to-floor constants and does not come back to the same number. */
    maxStories?: number | null
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
    /** Whether `maxStories` is what the CODE states, or what we got by dividing
     *  a published height by an unsourced floor-to-floor convention. Only one
     *  of those is a fact about the code, and they render identically. */
    storiesBasis?: 'stated' | 'derived'
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

// MEASURED, not drawn around a city label. This is the extent of the layer that
// actually answers the question — the City of Raleigh Zoning layer
// (Planning/Zoning/MapServer/0), queried 2026-08-07 with
// `where=1=1&returnExtentOnly=true&outSR=4326`, which returned
//   xmin -78.819399  ymin 35.706213  xmax -78.469890  ymax 35.971650
// rounded OUTWARD to 2 dp below (~1 km of slack on each side).
//
// It is deliberately tighter than the parcel service. Raleigh's parcel layer is
// Wake County property republished by the City, so it also covers Cary, Apex,
// Garner and the rest of the county; the ZONING layer stops at the city limits.
// A search box scoped to the county would let someone type a Cary address, get a
// real parcel back, and see districtCode 'Unknown' with null limits — a correct
// render of a gap, but a pointless answer. Scoping the search to the zoning
// layer's own footprint keeps the two datasets aligned.
export const RALEIGH_BBOX: Bbox = {
  south: 35.7,
  west: -78.83,
  north: 35.98,
  east: -78.46,
}

// ── The 2026-08-08 cohort: Milwaukee, Columbus, Charlotte, Atlanta ──────────
//
// All four MEASURED the same way Raleigh's was, and from the layer that
// actually answers the question rather than from a city label: each city's own
// ZONING layer, queried 2026-08-08 with
// `where=1=1&returnExtentOnly=true&outSR=4326`, then rounded OUTWARD to 2 dp.
// The raw returns are recorded per city below so the rounding is checkable.
//
// The jurisdiction reasoning differs per city and is NOT copied between them —
// three of the four have parcel and zoning coverage that agree, and one does
// not. Stating one city's reason on another is the rule-9-corollary failure
// (a claim true in one file and false in the next).

// Zoning layer: planning/zoning/MapServer/12 (Zoning with downtown
// subdistricts). Returned
//   xmin -88.077255  ymin 42.919583  xmax -87.859611  ymax 43.194861
// Milwaukee's parcel layer (148,937 features) and zoning layer (148,099) are
// both City-of-Milwaukee-only, so the two datasets cover the same ground: a
// click outside the city returns no parcel rather than a parcel with no zoning.
// The bbox is therefore a search-scoping convenience here, not a guard against
// a coverage mismatch.
export const MILWAUKEE_BBOX: Bbox = {
  south: 42.91,
  west: -88.08,
  north: 43.20,
  east: -87.85,
}

// Zoning layer: Applications/Zoning/MapServer/20 (Base Zoning). Returned
//   xmin -83.211793  ymin 39.807747  xmax -82.770595  ymax 40.157960
// The Corporate Boundary layer (/21) returns a near-identical extent
//   xmin -83.211641  ymin 39.807751  xmax -82.770561  ymax 40.157960
// and the values below are the OUTWARD round of the union of the two.
//
// Columbus is the mismatch case: the parcel layer is the Franklin County
// Auditor fabric and is county-wide, while zoning stops at the city line — an
// ungated county sample returned a parcel at 60 of 60 points and zoning at 34.
// The provider already refuses a point outside the Corporate Boundary polygon
// with OUT_OF_BBOX, so this box is the coarse first cut and the polygon is the
// real gate. The two must not be confused: a Dublin or Grove City address falls
// INSIDE this rectangle and is still correctly refused by the polygon.
export const COLUMBUS_BBOX: Bbox = {
  south: 39.80,
  west: -83.22,
  north: 40.16,
  east: -82.77,
}

// Zoning layer: PLN/Zoning/MapServer/0. Returned
//   xmin -81.066311  ymin 34.999100  xmax -80.594966  ymax 35.402450
// Like Raleigh, the parcel layer is county property (Mecklenburg) republished
// by the City and so also returns Huntersville, Cornelius, Matthews and
// Pineville; the zoning layer does not. Scoping the search to the zoning
// layer's own footprint keeps the two datasets aligned. Unlike Columbus there
// is no boundary-polygon gate in the provider, so a click inside this box but
// outside the city surfaces as districtCode 'Unknown' with null limits — the
// correct render of a gap, pinned by a provider test.
export const CHARLOTTE_BBOX: Bbox = {
  south: 34.99,
  west: -81.07,
  north: 35.41,
  east: -80.59,
}

// Zoning layer: LandUsePlanning/LandUsePlanning/MapServer/0. Returned
//   xmin -84.551589  ymin 33.647515  xmax -84.289481  ymax 33.887016
// Atlanta is the inverse of Raleigh: the zoning layer is the city's own (2,979
// polygons) and the parcel layer is likewise city-scoped (171,077 of 171,156
// rows carry SITECITY='ATLANTA'), so the two cover the same ground and a point
// outside both simply returns no parcel.
export const ATLANTA_BBOX: Bbox = {
  south: 33.64,
  west: -84.56,
  north: 33.89,
  east: -84.28,
}

export function isInBbox(bbox: Bbox, lat: number, lng: number): boolean {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

export function isInBostonBbox(lat: number, lng: number): boolean {
  return isInBbox(BOSTON_BBOX, lat, lng)
}
