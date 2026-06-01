import type { ParcelInfo } from '../../../src/types/parcel'
import { resolveZoningLimits } from './zoningLimits'
import { FT_PER_STORY, avgUnitGrossSqFt } from '../../../src/config/estimates'

// The maximum by-right envelope a parcel allows, derived from its resolved
// zoning limits and lot size. Flips the tool's question from "will my plan
// work?" to "what does this parcel allow?". All values are estimates.
export function computeEnvelope(info: ParcelInfo, city: string): NonNullable<ParcelInfo['envelope']> {
  const limits = resolveZoningLimits(info.zoning, city)
  const lot = info.lot.sizeSqFt

  // Headline floor area uses the residential/mixed FAR when broken out, else the max.
  const far = info.zoning.farByUse?.residential ?? info.zoning.farByUse?.mixed ?? limits.maxFAR
  const maxFloorAreaSqFt = far != null && lot != null && lot > 0 ? Math.round(far * lot) : null

  const maxHeightFt = limits.maxHeightFt
  const maxStories = maxHeightFt != null ? Math.floor(maxHeightFt / FT_PER_STORY) : null

  const allowsResidential =
    !!limits.allowedUses?.includes('residential') || !!limits.allowedUses?.includes('mixed')
  const maxUnits =
    allowsResidential && maxFloorAreaSqFt != null
      ? Math.max(1, Math.floor(maxFloorAreaSqFt / avgUnitGrossSqFt))
      : null

  return {
    maxFloorAreaSqFt,
    maxHeightFt,
    maxStories,
    maxUnits,
    allowedUses: limits.allowedUses,
  }
}
