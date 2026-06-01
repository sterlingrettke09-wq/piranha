// Estimate constants now live in src/config/estimates.ts (single source of
// truth shared with the /math page). Re-exported here so the engine modules
// that import from './assumptions' are unchanged.
import {
  costPerSqFtByUse,
  cityCostIndex,
  heightCostFactor,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
  FT_PER_STORY,
  demoCostPerSqFt,
  projectFactor,
  avgUnitGrossSqFt,
} from '../../../src/config/estimates'

export {
  costPerSqFtByUse,
  cityCostIndex,
  heightCostFactor,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
  FT_PER_STORY,
  demoCostPerSqFt,
  projectFactor,
  avgUnitGrossSqFt,
}

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
