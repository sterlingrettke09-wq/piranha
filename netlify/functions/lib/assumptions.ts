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
  ftPerStory,
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
  ftPerStory,
  demoCostPerSqFt,
  projectFactor,
  avgUnitGrossSqFt,
}

export const timelineMonthsByPath = {
  as_of_right: 4,
  variance: 12,
  prohibited: 0,
} as const

export function assumptionsSummary(
  city = 'boston',
  stories: number | null = null,
  // Where the project's floor area came from. 'assumed-far-1.0' means NO
  // floor-area limit was resolvable for the district and lot area was used as a
  // stand-in — an unsourced assumption that drives cost, unit counts and impact
  // fees. It has to be visible: an undisclosed guess is indistinguishable from
  // a code-derived figure, which is the whole defect.
  gfaBasis?: 'envelope' | 'assumed-far-1.0',
): Record<string, string> {
  const idx = cityCostIndex[city] ?? 1.0
  const rate = (n: number) => `$${Math.round(n * idx)}/sf`
  const hf = heightCostFactor(stories)
  return {
    ...(gfaBasis === 'assumed-far-1.0'
      ? {
          floorAreaBasis:
            'ASSUMED — this district publishes no floor-area ratio, so lot area was used as a stand-in. Not a code limit; treat the size (and every figure derived from it) as a placeholder.',
        }
      : gfaBasis === 'envelope'
        ? { floorAreaBasis: 'Derived from the published zoning limit for this district' }
        : {}),
    cityCostIndex: `${idx.toFixed(2)}× U.S. national average`,
    hardCostResidential: rate(costPerSqFtByUse.residential),
    hardCostCommercial: rate(costPerSqFtByUse.commercial),
    hardCostMixed: rate(costPerSqFtByUse.mixed),
    hardCostInstitutional: rate(costPerSqFtByUse.institutional),
    buildingHeightFactor: `${hf.toFixed(2)}× hard cost${stories ? ` (${stories} stories)` : ''}`,
    softCost: `${Math.round(softCostPct * 100)}% of hard cost`,
    permitFee: `$${PERMIT_BASE_FEE} + $${PERMIT_RATE_PER_1000} per $1,000 of hard cost`,
    varianceFiling: `$${VARIANCE_FILING_FEE} when relief required`,
    landCost: 'Not included (construction only)',
    timeline: 'Full life-cycle (design to move-in), estimated by city and building type',
    feetPerStory: `${FT_PER_STORY} ft residential / 13 ft commercial`,
  }
}
