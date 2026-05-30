// SEED ESTIMATES — labeled ballpark values for the Boston analysis MVP.
// All figures are rough and meant to be tuned. Sources noted inline.
import type { Use } from '../../../src/types/analysis'

export const FT_PER_STORY = 11 // typical residential floor-to-floor incl. structure (ft)

export const costPerSqFtByUse: Record<Use, number> = {
  residential: 350, // mid-rise multifamily hard cost, Boston ~2025 ($/sf)
  commercial: 400,
  mixed: 375,
  institutional: 450,
}

// Relative hard-construction cost by metro (Boston = reference 1.0). Estimated
// from published regional cost indices: NYC and SF run hot, Chicago cheaper.
// This is hard cost only; it does not include land, which diverges far more.
export const cityCostIndex: Record<string, number> = {
  boston: 1.0,
  nyc: 1.18,
  sf: 1.13,
  seattle: 1.0,
  chicago: 0.92,
}

// High-rise construction costs more per square foot: heavier structure,
// elevators, fire/life-safety, and systems. Factor applied to hard cost by height.
export function heightCostFactor(stories: number | null): number {
  if (stories == null || stories <= 4) return 1.0
  if (stories <= 8) return 1.15
  if (stories <= 20) return 1.35
  return 1.6
}

export const softCostPct = 0.25 // soft costs as a share of hard cost

export const PERMIT_BASE_FEE = 100 // flat building-permit filing fee (USD)
export const PERMIT_RATE_PER_1000 = 10 // $ per $1,000 of construction value (Boston ISD ballpark)
export const VARIANCE_FILING_FEE = 600 // ZBA variance filing + intake (USD)

export const timelineMonthsByPath = {
  as_of_right: 4,
  variance: 12,
  prohibited: 0,
} as const

export function assumptionsSummary(city = 'boston', stories: number | null = null): Record<string, string> {
  const idx = cityCostIndex[city] ?? 1.0
  const rate = (n: number) => `$${Math.round(n * idx)}/sf`
  const hf = heightCostFactor(stories)
  return {
    cityCostIndex: `${idx.toFixed(2)}× vs. Boston base`,
    hardCostResidential: rate(costPerSqFtByUse.residential),
    hardCostCommercial: rate(costPerSqFtByUse.commercial),
    hardCostMixed: rate(costPerSqFtByUse.mixed),
    hardCostInstitutional: rate(costPerSqFtByUse.institutional),
    buildingHeightFactor: `${hf.toFixed(2)}× hard cost${stories ? ` (${stories} stories)` : ''}`,
    softCost: `${Math.round(softCostPct * 100)}% of hard cost`,
    permitFee: `$${PERMIT_BASE_FEE} + $${PERMIT_RATE_PER_1000} per $1,000 of construction value`,
    varianceFiling: `$${VARIANCE_FILING_FEE} when relief required`,
    landCost: 'Not included (construction only)',
    timeline: 'Full life-cycle (design to move-in), estimated by city and building type',
    feetPerStory: `${FT_PER_STORY} ft`,
  }
}
