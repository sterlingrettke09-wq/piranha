import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import {
  lifecycleMonths as LIFECYCLE,
  lifecycleFallback as FALLBACK,
  demoMonthsByCity as DEMO_MONTHS,
  demoMonthsFallback as DEMO_FALLBACK,
  projectFactor as PROJECT_FACTOR,
  reliefAddMonths as RELIEF_ADD_MONTHS,
  type BuildingTier,
} from '../../../src/config/estimates'

export type { BuildingTier }

/** single ≤1 unit · multi 2–4 · apartment 5+. Commercial & institutional → apartment. */
export function buildingTier(project: AnalysisInput): BuildingTier {
  if (project.use === 'commercial' || project.use === 'institutional') return 'apartment'
  const units = project.units ?? (project.use === 'mixed' ? 3 : 1)
  if (units >= 5) return 'apartment'
  if (units >= 2) return 'multi'
  return 'single'
}

export interface TimelineResult {
  months: number
  path: Feasibility['path']
  tier: BuildingTier
  includesDemolition: boolean
}

export function resolveTimeline(
  city: string,
  project: AnalysisInput,
  feasibility: Feasibility,
  hasExistingBuilding: boolean,
  demolitionSqFt: number | null = null,
): TimelineResult {
  const tier = buildingTier(project)
  const includesDemolition = project.projectType === 'new' && hasExistingBuilding

  if (feasibility.path === 'prohibited') {
    return { months: 0, path: feasibility.path, tier, includesDemolition }
  }

  const table = LIFECYCLE[city] ?? FALLBACK
  let months = table[tier]

  // The baseline assumes demo + rebuild; a vacant lot skips the demolition phase.
  if (project.projectType === 'new' && !hasExistingBuilding) {
    months -= DEMO_MONTHS[city] ?? DEMO_FALLBACK
  }

  months = Math.round(months * PROJECT_FACTOR[project.projectType])

  if (feasibility.path === 'variance') months += RELIEF_ADD_MONTHS

  // Razing a large existing building takes longer than the baseline demo phase
  // (abatement, phased demolition, hauling). Add scaled months above ~50k sq ft.
  if (includesDemolition && demolitionSqFt != null && demolitionSqFt > 50000) {
    months += Math.min(18, Math.round(((demolitionSqFt - 50000) / 100000) * 3))
  }

  return { months: Math.max(1, months), path: feasibility.path, tier, includesDemolition }
}
