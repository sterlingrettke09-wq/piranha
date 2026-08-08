// Canned Raleigh responses for getRaleighParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-07 against the real services, not a hand-written approximation. That
// matters: a fixture invented to match the provider's expectations tests the
// provider against itself, which is the internal-verification trap CLAUDE.md
// rule 9 describes. These carry the upstream's actual field names, actual
// casing ("2000 FAIRVIEW RD"), actual nulls (HEIGHT null on R districts,
// OLAY_NAME null on -TOD) and actual value types (Shape_Area as a float).
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live OWNER value is a private individual's name it has been replaced with
// a placeholder, flagged inline at each site. Every other field is as captured.
// The provider reduces OWNER to a boolean and never returns the name, so the
// substitution changes no assertion — but a checked-in fixture is not the place
// for a private person's name, and an unqualified "verbatim" claim next to an
// edited value is the kind of half-true provenance statement CLAUDE.md warns
// about (disclosure copy is code).
import { featureSet } from './index'

// ── 2000 Fairview Rd — NX-3-UG, a small commercial parcel with 5 units ──────
// Point 35.804513, -78.646281. Re-probed 3x in isolation: byte-identical.
export const raleighParcelFairview = featureSet({
  PIN_NUM: '1704478963',
  SITE_ADDRESS: '2000 FAIRVIEW RD',
  Shape_Area: 5324.561274008643,
  DEED_ACRES: 0.12,
  OWNER: 'ROMAS REALTY LLC ',
  TOTAL_VALUE_ASSD: 1960588,
  BLDG_VAL: 1333348,
  LAND_CLASS_DECODE: 'Commercial',
  YEAR_BUILT: 1925,
  HEATEDAREA: 9532,
  TOTUNITS: 5,
  TOTSTRUCTS: 1,
  PLANNING_JURISDICTION: 'RA',
})

export const raleighZoningNx3 = featureSet({
  ZONING: 'NX-3-UG',
  ZONE_TYPE: 'NX-',
  ZONE_TYPE_DECODE: 'Neighborhood Mixed Use',
  HEIGHT: 3,
  FRONTAGE_DECODE: 'Urban General',
  CONDITIONAL: null,
  COND_LINK: null,
  ZONE_CASE: 'Z-27B-2014',
})

// ── 525 N East St — R-10 inside the Oakwood general historic overlay ────────
// Point 35.78730, -78.63200. The R districts are where HEIGHT is null on the
// wire and the curated Chapter 2 table has to carry the figure.
export const raleighParcelOakwood = featureSet({
  PIN_NUM: '1704910697',
  SITE_ADDRESS: '525 N EAST ST',
  Shape_Area: 5600.487761793594,
  DEED_ACRES: 0.13,
  // PLACEHOLDER — the live OWNER here is a private individual. See the header.
  OWNER: 'PRIVATE OWNER (placeholder)',
  TOTAL_VALUE_ASSD: 873145,
  BLDG_VAL: 303145,
  LAND_CLASS_DECODE: 'Residential Less Than 10 Acres',
  YEAR_BUILT: 1924,
  HEATEDAREA: 1884,
  TOTUNITS: 1,
  TOTSTRUCTS: 1,
  PLANNING_JURISDICTION: 'RA',
})

export const raleighZoningR10 = featureSet({
  ZONING: 'R-10',
  ZONE_TYPE: 'R-10',
  ZONE_TYPE_DECODE: 'Residential-10',
  HEIGHT: null,
  FRONTAGE_DECODE: null,
  CONDITIONAL: null,
  COND_LINK: null,
  ZONE_CASE: null,
})

/** A conditional-use R-10, with the signed ordinance PDF the layer links.
 *  Captured at 35.86500, -78.63500 (6100 Sandy Forks Rd). */
export const raleighZoningR10Conditional = featureSet({
  ZONING: 'R-10-CU',
  ZONE_TYPE: 'R-10',
  ZONE_TYPE_DECODE: 'Residential-10',
  HEIGHT: null,
  FRONTAGE_DECODE: null,
  CONDITIONAL: '-CU',
  COND_LINK: 'https://cityofraleigh0drupal.blob.core.usgovcloudapi.net/drupal-prod/COR22/Z-106-98-ORD.pdf',
  ZONE_CASE: 'Z-106-1998',
})

/** Downtown, 20 storeys — the tier where the UDO states stories and NO feet.
 *  Captured at 35.77972, -78.64236. */
export const raleighZoningDx20 = featureSet({
  ZONING: 'DX-20-UG',
  ZONE_TYPE: 'DX-',
  ZONE_TYPE_DECODE: 'Downtown Mixed Use',
  HEIGHT: 20,
  FRONTAGE_DECODE: 'Urban General',
  CONDITIONAL: null,
  COND_LINK: null,
  ZONE_CASE: 'Z-27B-2014',
})

/** CX-5: the tier where the UDO states BOTH 5 stories and 80 feet. */
export const raleighZoningCx5 = featureSet({
  ZONING: 'CX-5-SH',
  ZONE_TYPE: 'CX-',
  ZONE_TYPE_DECODE: 'Commercial Mixed Use',
  HEIGHT: 5,
  FRONTAGE_DECODE: 'Shopfront',
  CONDITIONAL: null,
  COND_LINK: null,
  ZONE_CASE: 'Z-27B-2014',
})

// ── Overlays. All four layers share one schema. ─────────────────────────────
/** Layer 7, captured at the Oakwood point. */
export const raleighHodGeneralOakwood = featureSet({
  OVERLAY: 'HOD-G',
  OLAY_DECODE: 'General Historic Overlay District',
  OLAY_NAME: 'Oakwood',
})

/** Layer 8, captured in Glenwood-Brooklyn. */
export const raleighHodStreetside = featureSet({
  OVERLAY: 'HOD-S',
  OLAY_DECODE: 'Streetside Historic Overlay District',
  OLAY_NAME: 'Glenwood-Brooklyn',
})

/** Layer 9. */
export const raleighNcod = featureSet({
  OVERLAY: 'NCOD',
  OLAY_DECODE: 'Neighborhood Conservation Overlay District',
  OLAY_NAME: 'Trailwood',
})

/** Layer 10. Note OLAY_NAME is genuinely null on the -TOD polygons. */
export const raleighTod = featureSet({
  OVERLAY: 'TOD',
  OLAY_DECODE: 'Transit Overlay District',
  OLAY_NAME: null,
})

export const raleighFloodX = featureSet({ FLD_ZONE: 'X' })

const NO_FEATURES = { features: [] }

/** Default routing. The overlay layers are distinguished by their layer index,
 *  so the route keys must be the full "MapServer/N" path — matching on
 *  "Overlays" alone would send all four to the same fixture. */
export const raleighRoutes = {
  'Property/Property/MapServer/0': raleighParcelFairview,
  'Planning/Zoning/MapServer/0': raleighZoningNx3,
  'Planning/Overlays/MapServer/7': NO_FEATURES,
  'Planning/Overlays/MapServer/8': NO_FEATURES,
  'Planning/Overlays/MapServer/9': NO_FEATURES,
  'Planning/Overlays/MapServer/10': NO_FEATURES,
  NFHL: raleighFloodX,
}

/** Oakwood: R-10 (no wire height) inside a general historic overlay. */
export const raleighRoutesOakwood = {
  ...raleighRoutes,
  'Property/Property/MapServer/0': raleighParcelOakwood,
  'Planning/Zoning/MapServer/0': raleighZoningR10,
  'Planning/Overlays/MapServer/7': raleighHodGeneralOakwood,
}

/** A conditional-use parcel carrying recorded zoning conditions. */
export const raleighRoutesConditional = {
  ...raleighRoutes,
  'Property/Property/MapServer/0': raleighParcelOakwood,
  'Planning/Zoning/MapServer/0': raleighZoningR10Conditional,
}

/** Downtown DX-20: stories stated, feet NOT stated by the code. */
export const raleighRoutesDx20 = {
  ...raleighRoutes,
  'Planning/Zoning/MapServer/0': raleighZoningDx20,
}

/** CX-5: both units stated by the code. */
export const raleighRoutesCx5 = {
  ...raleighRoutes,
  'Planning/Zoning/MapServer/0': raleighZoningCx5,
}

/** Inside the transit overlay — an overlay that must NOT raise the published
 *  by-right height (UDO Sec. 5.5.1.I bonuses are earned and conditional). */
export const raleighRoutesTod = {
  ...raleighRoutes,
  'Planning/Zoning/MapServer/0': raleighZoningCx5,
  'Planning/Overlays/MapServer/10': raleighTod,
}

/** A parcel outside the city limits: Wake County property data exists, Raleigh
 *  zoning does not. */
export const raleighRoutesNoZoning = {
  ...raleighRoutes,
  'Planning/Zoning/MapServer/0': NO_FEATURES,
}
