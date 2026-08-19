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

/** parcelHistorical/MapServer?f=json — the service's own layer list.
 *
 *  ⚠️ ROUTED DELIBERATELY, and the shape is copied from the live service rather
 *  than tidied. Cook County's layer ids are NOT the year: 2000-2021 use ids 0-23
 *  (including a `Parcels 2012A`), and only 2022 onward happen to use the year as
 *  the id. A fixture that made id === year would let a resolver that assumed it
 *  pass, and that resolver would pick layer 2026 on a service that numbers the
 *  next one 24.
 *
 *  It also carries a year BEYOND the pinned floor, so these tests exercise the
 *  resolved path rather than the fallback. Without this route the vintage fetch
 *  is unrouted, `mockArcgisFetch` throws, and the provider quietly falls back to
 *  the pin — which is the exact silence parcelVintage.ts exists to end, and it
 *  would have been invisible here. */
export const cookLayerList = {
  layers: [
    { id: 0, name: 'Parcels 2000' },
    { id: 13, name: 'Parcels 2012A' },
    { id: 23, name: 'Parcel 2021' },
    { id: 2025, name: 'Parcel 2025' },
    { id: 24, name: 'Parcel 2026' },
    { id: 19, name: 'Parcel History 2000-2023' },
  ],
}

// Route table. The parcel layer path '/MapServer/2026/query' and zoning
// '/MapServer/15/query' and historic '/MapServer/6/query' are distinct.
export const chicagoRoutesRM5 = {
  '/MapServer/15/query': chicagoZoningRM5,
  // The resolver picks layer id 24 ("Parcel 2026"), the newest by NAME.
  '/MapServer/24/query': chicagoParcel,
  '/MapServer/6/query': chicagoHistoricNone,
  'parcelHistorical/MapServer?f=json': cookLayerList,
  NFHL: chicagoFloodX,
}

export const chicagoRoutesB32 = {
  ...chicagoRoutesRM5,
  '/MapServer/15/query': chicagoZoningB32,
}
