// Canned Seattle responses for getSeattleParcelInfo tests (WO-2.1).
import { featureSet } from './index'

/** Current_Land_Use_Zoning_Detail_2 — ZONING string. */
export const seattleZoningNC3 = featureSet({ ZONING: 'NC3-65' })
export const seattleZoningMioOverlay = featureSet({ ZONING: 'MIO-105-NC3-65' })
export const seattleZoningIndustrial = featureSet({ ZONING: 'IG1 U/85' })

/** Parcel_Boundary — PIN + ADDRESS + SQFTLOT + PRES_USE_DESC (no geometry). */
export const seattleParcel = featureSet({
  PIN: '1234567890',
  ADDRESS: '123 Pike St',
  SQFTLOT: 4800,
  PRES_USE_DESC: 'Apartment',
})

/** Historic/Special-Review overlays — none here (TYPE not HISTORIC). */
export const seattleHistoricNone = { features: [] }

/** MHA fee area. */
export const seattleMha = featureSet({ FEE_AREA: 'High' })

/** FEMA NFHL flood. */
export const seattleFloodX = featureSet({ FLD_ZONE: 'X' })

export const seattleRoutes = {
  Current_Land_Use_Zoning_Detail_2: seattleZoningNC3,
  Parcel_Boundary: seattleParcel,
  'Zoning_Overlays-Historic': seattleHistoricNone,
  MHA_Fee_Areas: seattleMha,
  NFHL: seattleFloodX,
}

export const seattleRoutesMio = {
  ...seattleRoutes,
  Current_Land_Use_Zoning_Detail_2: seattleZoningMioOverlay,
}

export const seattleRoutesIndustrial = {
  ...seattleRoutes,
  Current_Land_Use_Zoning_Detail_2: seattleZoningIndustrial,
}
