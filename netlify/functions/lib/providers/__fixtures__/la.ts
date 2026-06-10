// Canned Los Angeles responses for getLaParcelInfo tests (WO-2.1).
import { featureSet, featureSetWithGeometry } from './index'

// A 100ft x 200ft lot in EPSG:2229 (US survey ft) → 20000 sq ft via shoelace.
const LA_RINGS: number[][][] = [
  [
    [0, 0],
    [100, 0],
    [100, 200],
    [0, 200],
    [0, 0],
  ],
]

/** LACounty_Parcel/MapServer/0 — parcel with address + geometry (2229 ft). */
export const laParcel = featureSetWithGeometry({
  attributes: {
    APN: '5555001001',
    SitusFullAddress: '123 MAIN ST   LOS ANGELES CA 90012',
    UseType: 'Residential',
    UseDescription: 'Five or More Apartments',
  },
  rings: LA_RINGS,
})

/** NavigateLA/MapServer/71 — generalized zoning. '[Q]R3-1' = qualified R3, HD1. */
export const laZoningQR3 = featureSet({
  ZONE_CMPLT: '[Q]R3-1',
  ZONE_CLASS: 'R3',
  ZONING_DESCRIPTION: 'Multiple Dwelling Zone',
})

/** A commercial zone in Height District 2 → FAR 6.0. */
export const laZoningC42 = featureSet({
  ZONE_CMPLT: 'C4-2',
  ZONE_CLASS: 'C4',
  ZONING_DESCRIPTION: 'Commercial Zone',
})

/** HPOZ (MapServer/75) — none here. */
export const laHpozNone = { features: [] }

/** Coastal Zone polygon — none here (not coastal). */
export const laCoastalNone = { features: [] }

/** FEMA NFHL flood. */
export const laFloodX = featureSet({ FLD_ZONE: 'X' })

export const laRoutes = {
  'LACounty_Parcel/MapServer/0/query': laParcel,
  'NavigateLA/MapServer/71/query': laZoningQR3,
  'NavigateLA/MapServer/75/query': laHpozNone,
  Coastal_Zone_Polygon: laCoastalNone,
  NFHL: laFloodX,
}

export const laRoutesC42 = {
  ...laRoutes,
  'NavigateLA/MapServer/71/query': laZoningC42,
}
