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

export const softCostPct = 0.25 // soft costs as a share of hard cost

export const PERMIT_BASE_FEE = 100 // flat building-permit filing fee (USD)
export const PERMIT_RATE_PER_1000 = 10 // $ per $1,000 of construction value (Boston ISD ballpark)
export const VARIANCE_FILING_FEE = 600 // ZBA variance filing + intake (USD)

export const timelineMonthsByPath = {
  as_of_right: 4,
  variance: 12,
  prohibited: 0,
} as const

export function assumptionsSummary(): Record<string, string> {
  return {
    hardCostResidential: `$${costPerSqFtByUse.residential}/sf`,
    hardCostCommercial: `$${costPerSqFtByUse.commercial}/sf`,
    hardCostMixed: `$${costPerSqFtByUse.mixed}/sf`,
    hardCostInstitutional: `$${costPerSqFtByUse.institutional}/sf`,
    softCost: `${Math.round(softCostPct * 100)}% of hard cost`,
    permitFee: `$${PERMIT_BASE_FEE} + $${PERMIT_RATE_PER_1000} per $1,000 of construction value`,
    varianceFiling: `$${VARIANCE_FILING_FEE} when relief required`,
    timeline: 'Full life-cycle (design to move-in), estimated by city and building type',
    feetPerStory: `${FT_PER_STORY} ft`,
  }
}
