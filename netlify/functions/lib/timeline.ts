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
// Empirical permit timings, refreshed offline by scripts/permits/*.mjs. A static
// committed artifact (esbuild inlines it at bundle time); the function never
// fetches a city portal at request time. A city is present only when its
// pipeline produced a trustworthy figure — absent cities show no measured line.
import permitStats from './data/permitStats.json'

export type { BuildingTier }

/** Empirical new-construction filing→issuance timing for one city. */
export interface MeasuredPermit {
  medianMonths: number
  p80Months: number
  n: number
  vintage: string
}

const PERMIT_STATS = permitStats as Record<
  string,
  { newConstruction?: MeasuredPermit; byTier?: Partial<Record<BuildingTier, MeasuredPermit>> } | undefined
>

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
  /** Empirical filing→issuance permit time for this city's new construction,
   *  when the open-data pipeline produced one. A SUBSET of `months` (the permit
   *  leg only); informational, never folded into the estimate. */
  measured?: MeasuredPermit
}

/** The measured new-construction permit timing for a city, or undefined when the
 *  pipeline has no trustworthy figure for it. Exposed for the wiring + tests.
 *
 *  PREFERS THE TIER-SPECIFIC FIGURE when one exists and the caller knows the
 *  tier. A single city-wide median answers no question anyone asked: Austin's
 *  new-construction population is 77% single-family houses at 1.6 months and 13%
 *  apartment-tier at 8.6 — a 5x spread hidden inside one 2.1-month headline.
 *  Someone testing a multifamily parcel was being shown the single-family number.
 *
 *  The aggregate remains the fallback, because a city with no tier breakdown is
 *  better served by a city-wide median than by nothing — but where a breakdown
 *  exists the aggregate is the WEAKER number, not the default. */
export function measuredFor(city: string, tier?: BuildingTier): MeasuredPermit | undefined {
  const entry = PERMIT_STATS[city]
  if (tier && entry?.byTier?.[tier]) return entry.byTier[tier]
  return entry?.newConstruction
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

  // The measured permit timing only applies to ground-up new construction (the
  // pipeline samples NB/new-construction permits), so it's only attached for
  // projectType 'new'; additions/renovations get no measured line.
  const measured = project.projectType === 'new' ? measuredFor(city, tier) : undefined

  if (feasibility.path === 'prohibited') {
    return { months: 0, path: feasibility.path, tier, includesDemolition, measured }
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

  return { months: Math.max(1, months), path: feasibility.path, tier, includesDemolition, measured }
}
