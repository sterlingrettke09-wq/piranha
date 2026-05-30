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
} from './assumptions'

export interface CostEstimate {
  costs: { hard: number; soft: number; permit: number; total: number; currency: 'USD' }
  timeline: { months: number; path: Feasibility['path'] }
}

export function estimateCost(project: AnalysisInput, feasibility: Feasibility): CostEstimate {
  const cityIdx = cityCostIndex[project.city] ?? 1.0
  const stories = project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / FT_PER_STORY) : null)
  const hard = Math.round(
    project.gfa * costPerSqFtByUse[project.use] * cityIdx * heightCostFactor(stories),
  )
  const soft = Math.round(hard * softCostPct)
  const constructionValue = hard
  let permit = Math.round(PERMIT_BASE_FEE + (constructionValue / 1000) * PERMIT_RATE_PER_1000)
  if (feasibility.path === 'variance') permit += VARIANCE_FILING_FEE
  const total = hard + soft + permit
  return {
    costs: { hard, soft, permit, total, currency: 'USD' },
    timeline: { months: timelineMonthsByPath[feasibility.path], path: feasibility.path },
  }
}
