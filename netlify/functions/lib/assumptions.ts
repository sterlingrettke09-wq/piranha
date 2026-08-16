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
  lifecycleMonths,
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
  gfaBasis?:
    | 'envelope'
    | 'assumed-unconstrained'
    | 'assumed-planned-development'
    | 'assumed-basis-unavailable'
    | 'assumed-far-1.0',
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
      : gfaBasis === 'assumed-unconstrained'
        ? {
            floorAreaBasis:
              'This district has NO floor-area ratio in the zoning code — size is governed by height, setbacks and lot coverage instead. Lot area is used as a placeholder here; it is not a code limit.',
          }
        : gfaBasis === 'assumed-planned-development'
          ? {
              floorAreaBasis:
                'This is a planned-development district: floor area is set by the ordinance that created it, not by a district table. Lot area is used as a placeholder here; the binding figure is in that ordinance.',
            }
          : gfaBasis === 'assumed-basis-unavailable'
            ? {
                // Must NOT say "publishes no floor-area ratio" — this district
                // publishes one and we have it. What is missing is the area the
                // ratio multiplies. Saying otherwise here would be the
                // disclosure-copy failure CLAUDE.md names: a sentence true of
                // one branch, false of the branch it was copied to.
                floorAreaBasis:
                  'This district DOES publish a floor-area ratio, but the code applies it to buildable area — the lot minus its required yards — rather than to the lot. Required yards here depend on the setbacks of neighbouring built lots, which no public layer carries, so the ratio cannot be turned into a floor area. Lot area is used as a placeholder; it is neither the code limit nor a stand-in for one.',
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
    // "estimated by city" is a CLAIM, and it is false for a city with no row in
    // `lifecycleMonths` — that project is timed by the national fallback. The
    // string used to be unconditional, which is the disclosure-copy failure
    // CLAUDE.md names under rule 9: text that is true in one context and false
    // in the one it is read in. Branch on the table itself, so a city added to
    // it later starts telling the truth without anyone editing this line.
    timeline:
      city in lifecycleMonths
        ? 'Full life-cycle (design to move-in), estimated by city and building type'
        : 'Full life-cycle (design to move-in). NO city-specific duration has been established for ' +
          'this city, so a generic national estimate is used, varying by building type only. ' +
          'Treat the schedule as a rough order of magnitude, not a local figure.',
    // Both of these reach substantive output, not just display — so both are
    // shown with their weak half named rather than left in a code comment.
    feetPerStory:
      `${FT_PER_STORY} ft residential / 13 ft commercial — a design convention, not a zoning code. ` +
      `Used only where a city publishes height in feet; where the code states stories, that figure is used directly.`,
    unitSize:
      `${avgUnitGrossSqFt} sq ft gross per dwelling unit — used to convert floor area into a unit count. ` +
      `Derived from a ~1,000 sq ft median unit (Statista 2023) at an ASSUMED ~75% net-to-gross efficiency; ` +
      `the efficiency figure is not sourced. Unit counts drive per-unit impact fees.`,
  }
}
