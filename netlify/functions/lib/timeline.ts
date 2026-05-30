import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

export type BuildingTier = 'single' | 'multi' | 'apartment'

// Full life-cycle months: architectural design → demolition & building permits →
// site prep → construction → move-in. City × building type. These are typical,
// estimated durations for new construction that includes demolishing and rebuilding.
// Coastal/discretionary cities run far longer than Chicago's faster pipeline.
const LIFECYCLE: Record<string, Record<BuildingTier, number>> = {
  boston: { single: 14, multi: 18, apartment: 26 },
  nyc: { single: 18, multi: 24, apartment: 36 },
  chicago: { single: 11, multi: 15, apartment: 20 },
  sf: { single: 24, multi: 30, apartment: 42 },
  seattle: { single: 14, multi: 18, apartment: 24 },
}
const FALLBACK: Record<BuildingTier, number> = { single: 16, multi: 20, apartment: 30 }

// Share of the life-cycle attributable to demolition + site clearing. A vacant lot
// skips this phase. Grounded in each city's demolition-permit reality (Chicago days,
// SF months).
const DEMO_MONTHS: Record<string, number> = {
  boston: 2,
  nyc: 3,
  chicago: 1,
  sf: 4,
  seattle: 2,
}
const DEMO_FALLBACK = 2

// Scope relative to a full new build (demo + ground-up).
const PROJECT_FACTOR: Record<AnalysisInput['projectType'], number> = {
  new: 1,
  addition: 0.6,
  adu: 0.55,
  change_of_use: 0.5,
}

// A project that needs discretionary relief adds a hearing cycle on top of the
// as-of-right baseline.
const RELIEF_ADD_MONTHS = 6

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

  return { months: Math.max(1, months), path: feasibility.path, tier, includesDemolition }
}
