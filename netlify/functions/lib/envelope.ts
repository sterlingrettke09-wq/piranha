import type { ParcelInfo } from '../../../src/types/parcel'
import { resolveZoningLimits } from './zoningLimits'
import { ftPerStory, avgUnitGrossSqFt, MIXED_RESIDENTIAL_SHARE } from '../../../src/config/estimates'

// The maximum by-right envelope a parcel allows, derived from its resolved
// zoning limits and lot size. Flips the tool's question from "will my plan
// work?" to "what does this parcel allow?". All values are estimates.
export function computeEnvelope(info: ParcelInfo, city: string): NonNullable<ParcelInfo['envelope']> {
  const limits = resolveZoningLimits(info.zoning, city)
  const lot = info.lot.sizeSqFt

  // Headline floor area uses the residential/mixed FAR when broken out, else the
  // district max. Record which one drove the headline so the UI can label it —
  // an envelope sized off the residential FAR isn't the same number a commercial
  // or mixed project would see (WO-5.5).
  const residFar = info.zoning.farByUse?.residential
  const mixedFar = info.zoning.farByUse?.mixed
  let far: number | null
  let farBasis: 'residential' | 'mixed' | 'district' | null
  if (residFar != null) {
    far = residFar
    farBasis = 'residential'
  } else if (mixedFar != null) {
    far = mixedFar
    farBasis = 'mixed'
  } else if (limits.maxFAR != null) {
    far = limits.maxFAR
    farBasis = 'district'
  } else {
    far = null
    farBasis = null
  }
  const maxFloorAreaSqFt = far != null && lot != null && lot > 0 ? Math.round(far * lot) : null

  const maxHeightFt = limits.maxHeightFt
  // Floor-to-floor height is use-aware: residential/mixed envelopes pack ~11 ft
  // floors, a district (commercial-style) envelope ~13 ft. With no FAR basis but
  // a known height, default to residential 11 ft — the conservative (taller
  // story count) read, matching the parcel-describing intent of this envelope.
  const storyUse: 'residential' | 'commercial' = farBasis === 'district' ? 'commercial' : 'residential'
  const maxStories = maxHeightFt != null ? Math.floor(maxHeightFt / ftPerStory(storyUse)) : null

  const allowsResidential =
    !!limits.allowedUses?.includes('residential') || !!limits.allowedUses?.includes('mixed')
  // A mixed-basis envelope isn't 100% residential — only the residential share of
  // its GFA converts to dwelling units.
  const unitFloorArea =
    maxFloorAreaSqFt != null && farBasis === 'mixed'
      ? maxFloorAreaSqFt * MIXED_RESIDENTIAL_SHARE
      : maxFloorAreaSqFt
  const maxUnits =
    allowsResidential && unitFloorArea != null
      ? Math.max(1, Math.floor(unitFloorArea / avgUnitGrossSqFt))
      : null

  return {
    maxFloorAreaSqFt,
    maxHeightFt,
    maxStories,
    maxUnits,
    allowedUses: limits.allowedUses,
    farBasis,
  }
}
