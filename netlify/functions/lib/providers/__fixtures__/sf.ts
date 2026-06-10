// Canned San Francisco responses for getSfParcelInfo tests (WO-2.1).
// Field names mirror the SF Planning MapServer layers the provider reads.
import { featureSet, featureSetWithGeometry } from './index'

// A 50ft x 100ft lot in EPSG:2227 (US ft) → 5000 sq ft via shoelace.
const SF_RINGS: number[][][] = [
  [
    [0, 0],
    [50, 0],
    [50, 100],
    [0, 100],
    [0, 0],
  ],
]

/** PlanningData/MapServer/3 — zoning (zoning/gen/districtname). */
export const sfZoning = featureSet({
  zoning: 'RH-2',
  gen: 'Residential House Districts',
  districtname: 'RH-2',
})

/** PlanningData/MapServer/23 — parcels with address fields + geometry. */
export const sfParcel = featureSetWithGeometry({
  attributes: { blklot: '0123A045', from_st: '123', street: 'Main', st_type: 'St' },
  rings: SF_RINGS,
})

/** PlanningData/MapServer/35 — land use. */
export const sfLandUse = featureSet({ landuse_landuse: 'RESIDENT', landuse_resunits: 2 })

/** PlanningData/MapServer/5 — height districts (gen_hght = max ft). */
export const sfHeight = featureSet({ gen_hght: 40 })

/** PlanningData/MapServer/17 — Article 10 historic districts (none here). */
export const sfHistoricNone = { features: [] }

/** FEMA NFHL — minimal hazard. */
export const sfFloodX = featureSet({ FLD_ZONE: 'X' })

// Route table. SF endpoints share a base; route by the distinct layer-path
// substring (e.g. '/MapServer/23/query' for parcels). Order matters: keys are
// matched in insertion order, so list the more specific paths first.
export const sfRoutes = {
  '/MapServer/3/query': sfZoning,
  '/MapServer/23/query': sfParcel,
  '/MapServer/35/query': sfLandUse,
  '/MapServer/5/query': sfHeight,
  '/MapServer/17/query': sfHistoricNone,
  NFHL: sfFloodX,
}
