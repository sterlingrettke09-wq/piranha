import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import {
  lifecycleMonths as LIFECYCLE,
  lifecycleFallback as FALLBACK,
  demoMonthsByCity as DEMO_MONTHS,
  demoMonthsFallback as DEMO_FALLBACK,
  projectFactor as PROJECT_FACTOR,
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
  // Baseline = a cleared, by-right lot (the floor). Scale by project scope first.
  let months = Math.round(table[tier] * PROJECT_FACTOR[project.projectType])

  // A teardown is NOT a quick add-on: a new build over an existing structure adds
  // a demolition permit + asbestos/abatement survey + utility disconnects +
  // clearing on top of the cleared-lot baseline.
  if (includesDemolition) {
    months += DEMO_MONTHS[city] ?? DEMO_FALLBACK
  }

  // Discretionary/entitlement delay (variance, ULURP, CEQA, Article 80, etc.) is
  // NOT added here — analyze.ts computes it once from the per-city adder + the
  // triggered hurdles, so the nested approvals can't be double-counted.

  // Razing a LARGE existing building takes longer than the standard demo phase
  // (phased demolition, hauling). Add scaled months above ~50k sq ft.
  if (includesDemolition && demolitionSqFt != null && demolitionSqFt > 50000) {
    months += Math.min(18, Math.round(((demolitionSqFt - 50000) / 100000) * 3))
  }

  return { months: Math.max(1, months), path: feasibility.path, tier, includesDemolition }
}
