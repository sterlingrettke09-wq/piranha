/** Overlay reads whose failure a consumer must be able to tell apart from an
 *  empty answer. Closed on purpose: a typo is a compile error, and adding a
 *  member is the moment to decide what the consuming code should do with a gap. */
export type UnresolvedOverlay = 'historic' | 'feeArea' | 'coastal' | 'flood'

/** The uses a district can state a separate floor-area ratio for. Named rather
 *  than inlined so `farByUse` and `farElectiveByUse` cannot drift apart. */
export type FarUse = 'residential' | 'commercial' | 'mixed' | 'institutional'

export interface ParcelInfo {
  address: string
  /** Where `address` came from. REQUIRED, and set only by the two helpers in
   *  `netlify/functions/lib/address.ts`, which emit it together with the string.
   *
   *  'record'  — the parcel record's own address field(s).
   *  'geocode' — a reverse geocode of the queried point; the record had none.
   *  'none'    — neither; `address` is the "Selected location" placeholder.
   *
   *  ⚠️ ONLY 'record' MAY BE COMPARED WITH THE ADDRESS THE USER SEARCHED.
   *  Checking a forward geocode of the user's text against a reverse geocode of
   *  the point it produced compares Mapbox with Mapbox, and a self-consistent
   *  geocoder agrees with itself exactly when it is wrong (CLAUDE.md rule 11).
   *  `src/lib/addressMatch.ts` reads this field for that reason and reports
   *  'unverifiable' rather than silently passing. */
  addressBasis: 'record' | 'geocode' | 'none'
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
    farByUse?: Partial<Record<FarUse, number>>
    /** Which of `farByUse`'s limbs the code lets the APPLICANT choose the
     *  denominator for. Keyed off the SAME `FarUse` union rather than restated,
     *  so a use cannot acquire a ratio without a slot for its basis.
     *
     *  ⚠️ THE DENOMINATOR HAS TO TRAVEL WITH THE RATIO, and this field exists
     *  because it did not. Atlanta's zoning module records each limb as
     *  `{ far, basis, source }` — forty of them carry `basis: 'net-or-gross'`,
     *  the applicant's election under e.g. §16-18T.010(2) — and the provider
     *  read `.far` off each and dropped `.basis` on the floor. So SPI-1 SA1's
     *  residential FAR of 25 reached the envelope indistinguishable from a
     *  ratio stated against the lot, and published `25 × measured parcel` as a
     *  by-right CEILING when the code permits a larger denominator.
     *
     *  The arithmetic erred low, which is why nothing looked wrong: the product
     *  is one of the two figures the code allows, and it is the smaller. But the
     *  surface calls it a maximum, and a floor rendered as a ceiling is rule 5 —
     *  the reader cannot tell it apart from a limit that actually binds. */
    farElectiveByUse?: Partial<Record<FarUse, boolean>>
    /** Floor-area ALLOWANCE in square feet, for codes that cap floor area at
     *  "the greater of the ratio or a fixed floor value" — e.g. Austin's HOME
     *  FAR gradient, "0.65 or 4,350 SF". Small lots are governed by the floor
     *  value, not the ratio, so `far * lot` alone understates them.
     *  Applied as max(maxFAR * lot, farFloorSqFt). */
    farFloorSqFt?: number | null
    /** TRUE when this district's dimensional standards come from an approved
     *  plan, site plan or council ordinance rather than a district table.
     *
     *  A THIRD STATE, distinct from both a resolved figure and a gap: a limit
     *  exists and is not in any table, so nobody could have looked it up. Set
     *  by the per-city module that already establishes it (Las Vegas
     *  `planGoverned`, Phoenix `planGoverned`, Milwaukee `planGoverned`,
     *  Charlotte `conditional`), which stays the single source of truth —
     *  ../zoning/plannedDevelopment.ts covers only the cities whose modules
     *  carry no such flag. */
    planGoverned?: boolean
    /** TRUE when the code imposes no FAR limit here at all — a KNOWN absence,
     *  not a missing lookup. Distinguishes "this instrument does not bind"
     *  (floor area is governed by height/setbacks/coverage instead) from
     *  "we don't know the FAR", which `maxFAR: null` alone conflates. */
    farUnconstrained?: boolean
    /** TRUE when the code imposes no maximum HEIGHT here at all — a KNOWN
     *  absence, the exact companion to `farUnconstrained`.
     *
     *  ⚠️ ADDED 2026-08-19 TO CLOSE A GAP THAT THREE MODULES HAD ALREADY
     *  DOCUMENTED AND COULD NOT EXPRESS. `zoning/atlanta.ts`, `zoning/dallas.ts`
     *  and `zoning/charlotte.ts` each resolve this fact with a citation, and each
     *  carried a comment saying the shared type had no field for it — so the
     *  answer was flattened into an `article` sentence and `maxHeightFt: null`
     *  reached the engine, which rendered it as "no district height limit is
     *  available in public data". That is the tool disclaiming knowledge it
     *  demonstrably has, over sixteen Atlanta subareas alone.
     *
     *  Rule 5 exactly, and the asymmetry is the tell: FAR got a flag for the same
     *  distinction and height did not, so one instrument's known absence was an
     *  answer and the other's was a gap.
     *
     *  ⚠️ SET IT ONLY FOR AN UNCONDITIONAL ABSENCE. Denver's D-C/D-TD states
     *  heights "are not limited EXCEPT in the following height areas as shown on
     *  Exhibit 8.1" — three mapped areas at 200 ft and 400 ft, on a figure no
     *  published layer carries. `zoning/denver.ts` deliberately withholds the
     *  flag there and says so: publishing "no height limit" would be wrong by 2x
     *  for a Height Area 1 parcel, in the flattering direction. A conditional
     *  absence is not this flag. */
    heightUnconstrained?: boolean
    /** The area the code's FAR multiplies, where that is NOT the lot.
     *
     *  A FOURTH STATE, and the one the other three could not express: the ratio
     *  is KNOWN and correct, and the quantity it applies to is unavailable, so
     *  the product cannot be computed. Not a resolved figure, not a known
     *  absence, not an ordinance elsewhere — we have the input and cannot
     *  safely use it.
     *
     *  LA is the case. LAMC § 12.21.1 A.1 caps floor area at "three times the
     *  Buildable Area of the Lot", and § 12.03 defines FAR as a ratio "of the
     *  Buildable Area OR Lot size" — so the basis is per-provision and this
     *  provision picks the one we do not have. Buildable Area is the lot minus
     *  its required yards, and LA's required front yard is the PREVAILING
     *  setback: "the average depth of the Front Yards" of neighbouring
     *  developed lots comprising 40% or more of the frontage. That is a
     *  function of what is already built on the street. No parcel layer carries
     *  it, and no amount of reading the zoning code produces it.
     *
     *  So `maxFAR` stays populated — it is a true fact about the district and
     *  the feasibility check still uses it — while the ENVELOPE withholds floor
     *  area rather than multiplying by the wrong area. Publishing lot × FAR
     *  here is an upper bound that overstates by the yard fraction and can only
     *  be disclosed, never corrected (CLAUDE.md rule 4: a conversion factor we
     *  cannot source is not a number, and rule 18: it would be a confident
     *  number on the resolved side, where scrutiny does not go).
     *
     *  ⚠️ Set this ONLY where the code names a basis that is not the lot AND
     *  that basis is unobtainable. A city whose "net lot area" turns out to BE
     *  the lot must not set it — Atlanta reads exactly that way (§16-28.006)
     *  and correctly does not. */
    farAppliesTo?: 'buildable-area'
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
     *  same; the first is an answer, the second is a gap.
     *
     *  FOUR of these six now carry maxFloorAreaSqFt: null, and they are four
     *  DIFFERENT facts. Rendering any of them as a gap is the rule 5 collapse:
     *    'unconstrained'      — no FAR applies; height/setbacks govern instead.
     *    'planned-development'— a FAR exists, in this parcel's own ordinance.
     *    'basis-unavailable'  — the FAR is KNOWN, and the area it multiplies is
     *                           not obtainable, so the product is withheld
     *                           rather than computed against the wrong area.
     *                           See `farAppliesTo` above.
     *    null                 — nobody has looked, or the lookup failed. */
    farBasis:
      | 'residential'
      | 'mixed'
      | 'district'
      | 'planned-development'
      | 'unconstrained'
      | 'basis-unavailable'
      /** The ratio resolved and the code lets the APPLICANT choose the
       *  denominator. Atlanta SPI-20: "Residential uses may use net lot area or
       *  gross lot area." Distinct from 'basis-unavailable', where no one can
       *  obtain the area — here the developer knows it and we do not. */
      | 'basis-elective'
      | null
    /** WHY there is no height figure — the exact companion to `farBasis`, and it
     *  exists because the absence of one was a live false claim.
     *
     *  ⚠️ `heightUnconstrained` was added 2026-08-19 to express "the code imposes
     *  no maximum height here", a fact Atlanta, Dallas and Charlotte each resolve
     *  WITH A CITATION. It reached the client and stopped: SiteFacts rendered
     *  `maxHeightFt: null` as "Not in public data" whatever the reason, so on
     *  sixteen Atlanta subareas alone the tool disclaimed knowledge it
     *  demonstrably has. FAR had four rendered states and height had two.
     *
     *  The four states mirror `farBasis`, and the collapse is the same rule 5
     *  failure one dimension over:
     *    'district'           — a figure the district states.
     *    'planned-development'— a height exists, in this parcel's own ordinance.
     *    'unconstrained'      — no height limit applies; FAR/setbacks govern.
     *    null                 — nobody has looked, or the lookup failed. */
    heightBasis?: 'district' | 'planned-development' | 'unconstrained' | null
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
    /** Overlay layers whose fetch FAILED on this request.
     *
     *  ⚠️ READ THIS BEFORE TURNING AN OVERLAY'S ABSENCE INTO A CLAIM. Every
     *  field above is an `X | null` that collapses two facts: the layer
     *  answered and nothing covers this parcel (an ANSWER), or the layer did
     *  not answer (a GAP). `requiredUpstream.ts` splits that state for REQUIRED
     *  reads by refusing; this splits it for OPTIONAL ones by recording the
     *  gap, so a consumer that publishes an absence — a stated "no requirement
     *  applies", a dollar figure that depends on which area a parcel is in —
     *  can decline to publish rather than manufacture the negative branch out
     *  of a timeout.
     *
     *  Measured 2026-08-12 at the analyze handler, one layer faulted per run:
     *    · Denver EHA down  → commercial fee billed at the Typical rate;
     *      impact $921,000 → $614,000 inside a total, no note (CLAUDE.md r. 4)
     *    · Miami HISTORIC down → "No tenant relocation or replacement-housing
     *      requirement" published as a finding, and a note asserting the parcel
     *      is not in a designated historic district (CLAUDE.md r. 5)
     *    · Boston HISTORIC down, Back Bay teardown → the historic design-review
     *      row and the abutter-appeal row both vanished, and the VERDICT went
     *      NEEDS_RELIEF (55 mo) → AS_OF_RIGHT (51 mo). A timeout upgraded a
     *      parcel's legal standing.
     *    · LA COASTAL down, Abbot Kinney → the Coastal Development Permit row
     *      vanished and 57 mo → 48 mo, the permit's whole serial 9 months.
     *
     *  ⚠️ WHICH KEYS A PROVIDER SETS IS DECIDED BY WHAT CONSUMES THE FIELD, NOT
     *  BY WHICH LAYERS IT HAPPENS TO FETCH. Absence from this list is NOT a
     *  promise that every layer answered — only that no layer whose failure is
     *  known to change a published claim did. Three keys are now marked by every
     *  provider that reads the layer, because `hurdles.ts` reads all three
     *  city-agnostically and drops a requirement on a null: `historic`,
     *  `flood`, and `coastal` (the two CA providers). `feeArea` stays
     *  provider-specific because only two cities have one.
     *
     *  `providers/failedFetchClaims.test.ts` pins which providers set which
     *  keys and drives each through the real entry point, so this cannot quietly
     *  become empty. A consumer that starts publishing an absence from a field
     *  no provider marks must add the mark in the provider first — the test will
     *  not tell you, because it can only check the pairs it knows about. */
    unresolved?: readonly UnresolvedOverlay[]
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
  /** WHICH VINTAGE OF THE PARCEL FABRIC THIS ANSWER WAS READ AT.
   *
   *  Cook County publishes one parcel layer PER TAX YEAR — twenty-six of them —
   *  so "the Chicago parcel layer" is not one thing, and a stored watchlist row
   *  that cannot say which year it was resolved against cannot distinguish "this
   *  parcel was subdivided" from "we are reading last year's fabric".
   *
   *  Optional on the type only because it is set by the providers that have been
   *  wired to it; `netlify/functions/lib/providers/parcelVintage.ts` is the one
   *  place that decides, and it answers `not-versioned` for cities whose fabric
   *  carries no year rather than leaving the distinction to a missing field. */
  parcelVintage?: {
    basis: 'resolved' | 'pinned-fallback' | 'not-versioned'
    year: string | null
    layerUrl: string | null
    why?: string
  }
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

// ── The 2026-08-09 cohort: dallas, lasvegas, phoenix ───────────────────────
// ZONING layer, queried 2026-08-09 with
// `where=1=1&returnExtentOnly=true&outSR=4326`, then rounded OUTWARD to 2 dp.
// The raw returns are recorded per city below so the rounding is checkable.
//
// ⚠️ ALL THREE ARE THE MISMATCH CASE, AND FOR ALL THREE THE BBOX IS NOT THE
// GUARD. Each city's parcel layer is regional (a county or multi-county fabric)
// while its zoning layer stops at the city line, and in each one a neighbouring
// jurisdiction sits INSIDE the rectangle — Highland Park and University Park are
// enclaves entirely surrounded by Dallas; North Las Vegas, Henderson and
// unincorporated Clark County interleave with Las Vegas; Scottsdale, Tempe and
// Glendale abut Phoenix. No rectangle separates them.
//
// So each provider fetches a CITY-BOUNDARY POLYGON as a gate and REFUSES a point
// outside it, the pattern columbus.ts established. The bbox below is the coarse
// first cut; the polygon is the real gate, and the two must not be confused.
//
// Why a polygon and not a `CITY = '…'` attribute, measured rather than assumed
// (cross-tabbed against each city's zoning layer over random in-bbox points that
// returned a parcel, 2026-08-09):
//   · dallas   polygon 119/119, attribute `CITY` 118/119 — it refuses a parcel
//     whose CITY is null and which the zoning layer resolves to TH-3(A)
//   · lasvegas polygon agrees; `STRCITY` refuses in-city parcels whose SITE
//     ADDRESS is blank, i.e. vacant land — the land this tool is asked about
//   · phoenix  polygon 87/87; the parcel layer has NO city column at all (27
//     fields enumerated), so there is no attribute to use
// Each provider header carries the coordinates of the specific disagreements.

// Zoning layer: sdc_public/Zoning/MapServer/15 (Base Zoning). Returned
//   xmin -97.000646  ymin 32.605923  xmax -96.464391  ymax 33.030771
// which matches Basemap/CityLimits/MapServer/0's own extent to four decimals.
// The parcel layer is the five-county appraisal-district fabric — its own
// description says "Includes City of Dallas and one-mile buffer" — and only
// 290,743 of its 500,142 rows carry CITY='DALLAS'.
// Gate: Basemap/CityLimits/MapServer/0 (one polygon, CITY='Dallas').
export const DALLAS_BBOX: Bbox = {
  south: 32.60,
  west: -97.01,
  north: 33.04,
  east: -96.46,
}

// Zoning layer: DevelopmentServices/Zoning/MapServer/0. Returned
//   xmin -115.424217  ymin 36.128958  xmax -115.060645  ymax 36.410535
// The parcel layer is the Clark County fabric republished by the City —
// 834,987 rows, of which 291,830 carry STRCITY='LV'.
// Gate: AdministrativeBoundaries/Jurisdictions/MapServer/0, and this is the one
// city of the three where the gate must compare a NAME rather than read
// presence: the layer holds seven jurisdictions (Las Vegas, North Las Vegas,
// Henderson, Mesquite, Boulder City, Nellis AFB, and one named ' ' for
// unincorporated Clark County), so every point in the valley is inside SOME
// polygon. A presence check would pass the entire Strip.
export const LAS_VEGAS_BBOX: Bbox = {
  south: 36.12,
  west: -115.43,
  north: 36.42,
  east: -115.06,
}

// Zoning layer: Public/Zoning/MapServer/0. Returned
//   xmin -112.325977  ymin 33.289971  xmax -111.925471  ymax 33.918693
// The parcel layer is the Maricopa County fabric (1,759,634 features, extent
// -113.354…-111.077, i.e. the whole county).
// Gate: Public/CityBoundary/MapServer/0 (one polygon, NAME='City of Phoenix').
export const PHOENIX_BBOX: Bbox = {
  south: 33.28,
  west: -112.33,
  north: 33.92,
  east: -111.92,
}

export function isInBbox(bbox: Bbox, lat: number, lng: number): boolean {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
}

export function isInBostonBbox(lat: number, lng: number): boolean {
  return isInBbox(BOSTON_BBOX, lat, lng)
}
