import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import {
  costPerSqFtByUse,
  cityCostIndex,
  heightCostFactor,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
  timelineMonthsByPath,
  FT_PER_STORY,
  demoCostPerSqFt,
  projectFactor,
} from './assumptions'

export interface CostEstimate {
  costs: { hard: number; soft: number; permit: number; demolition: number; total: number; currency: 'USD' }
  timeline: { months: number; path: Feasibility['path'] }
}

export interface CostOpts {
  /** Sq ft of existing building to demolish first. When > 0, a demolition cost
   *  is added — otherwise the quote silently ignores tearing down what's there. */
  demolitionSqFt?: number | null
}

export function estimateCost(
  project: AnalysisInput,
  feasibility: Feasibility,
  opts: CostOpts = {},
): CostEstimate {
  const cityIdx = cityCostIndex[project.city] ?? 1.0
  const stories = project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / FT_PER_STORY) : null)
  // Renovations / ADUs / changes-of-use cost less per sq ft than ground-up new
  // construction. Scale by the same project-scope factor the timeline uses, so
  // cost and schedule stay consistent. (new = 1.0.)
  const scope = projectFactor[project.projectType ?? 'new'] ?? 1
  const hard = Math.round(
    project.gfa * costPerSqFtByUse[project.use] * cityIdx * heightCostFactor(stories) * scope,
  )
  const soft = Math.round(hard * softCostPct)
  const demoSf = opts.demolitionSqFt ?? 0
  const demolition = demoSf > 0 ? Math.round(demoSf * demoCostPerSqFt * cityIdx) : 0
  const constructionValue = hard
  let permit = Math.round(PERMIT_BASE_FEE + (constructionValue / 1000) * PERMIT_RATE_PER_1000)
  if (feasibility.path === 'variance') permit += VARIANCE_FILING_FEE
  const total = hard + soft + permit + demolition
  return {
    costs: { hard, soft, permit, demolition, total, currency: 'USD' },
    timeline: { months: timelineMonthsByPath[feasibility.path], path: feasibility.path },
  }
}
