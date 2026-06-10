// Canned Chicago responses for getChicagoParcelInfo tests (WO-2.1).
import { featureSet, featureSetWithGeometry } from './index'

// A 25ft x 125ft Chicago city lot in Cook County US-ft SR → 3125 sq ft.
const CHI_RINGS: number[][][] = [
  [
    [0, 0],
    [25, 0],
    [25, 125],
    [0, 125],
    [0, 0],
  ],
]

/** Zoning_update/MapServer/15 — ZONE_CLASS. */
export const chicagoZoningRM5 = featureSet({ ZONE_CLASS: 'RM-5' })
export const chicagoZoningB32 = featureSet({ ZONE_CLASS: 'B3-2' })

/** parcelHistorical/MapServer/2025 — Cook County parcel with geometry. */
export const chicagoParcel = featureSetWithGeometry({
  attributes: { PIN10: '1701234567', AssessorBLDGclass: '211' },
  rings: CHI_RINGS,
})

/** Historic Districts (MapServer/6) — none here. */
export const chicagoHistoricNone = { features: [] }

/** FEMA NFHL flood. */
export const chicagoFloodX = featureSet({ FLD_ZONE: 'X' })

// Route table. The parcel layer path '/MapServer/2025/query' and zoning
// '/MapServer/15/query' and historic '/MapServer/6/query' are distinct.
export const chicagoRoutesRM5 = {
  '/MapServer/15/query': chicagoZoningRM5,
  '/MapServer/2025/query': chicagoParcel,
  '/MapServer/6/query': chicagoHistoricNone,
  NFHL: chicagoFloodX,
}

export const chicagoRoutesB32 = {
  ...chicagoRoutesRM5,
  '/MapServer/15/query': chicagoZoningB32,
}
