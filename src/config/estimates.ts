// Single source of truth for the estimate constants used by BOTH the analysis
// engine (netlify/functions) and the public Methodology page (/math). Keeping
// them here means the published tables can never drift from what the engine
// actually computes. All figures are labeled estimates, meant to be tuned.
import type { ProjectType, Use } from '../types/analysis'

export type BuildingTier = 'single' | 'multi' | 'apartment'

// ---- Construction cost ----
export const costPerSqFtByUse: Record<Use, number> = {
  residential: 350, // mid-rise multifamily hard cost, Boston ~2025 ($/sf)
  commercial: 400,
  mixed: 375,
  institutional: 450,
}

// Relative hard-construction cost by metro (Boston = reference 1.0). Estimated
// from published regional cost indices. Hard cost only; excludes land.
export const cityCostIndex: Record<string, number> = {
  boston: 1.0,
  nyc: 1.18,
  sf: 1.13,
  seattle: 1.0,
  chicago: 0.92,
  dc: 0.93,
  austin: 0.80,
  la: 1.02,
  denver: 0.90,
  minneapolis: 0.97,
}

// High-rise construction costs more per sq ft (structure, elevators, life-safety).
// These tiers drive both the engine factor and the /math display table.
export const heightFactorTiers: { label: string; max: number | null; factor: number }[] = [
  { label: 'Up to 4 stories', max: 4, factor: 1.0 },
  { label: '5 to 8 stories', max: 8, factor: 1.15 },
  { label: '9 to 20 stories', max: 20, factor: 1.35 },
  { label: 'Over 20 stories', max: null, factor: 1.6 },
]
export function heightCostFactor(stories: number | null): number {
  if (stories == null) return 1.0
  for (const t of heightFactorTiers) {
    if (t.max == null || stories <= t.max) return t.factor
  }
  return 1.0
}

export const softCostPct = 0.25 // soft costs as a share of hard cost
export const PERMIT_BASE_FEE = 100 // flat building-permit filing fee (USD)
export const PERMIT_RATE_PER_1000 = 10 // $ per $1,000 of construction value
export const VARIANCE_FILING_FEE = 600 // variance filing + intake (USD)
export const FT_PER_STORY = 11 // typical floor-to-floor incl. structure (ft)

// ---- Timeline: full life-cycle months (design → permits → site prep → build → move-in) ----
export const lifecycleMonths: Record<string, Record<BuildingTier, number>> = {
  boston: { single: 14, multi: 18, apartment: 26 },
  nyc: { single: 18, multi: 24, apartment: 36 },
  chicago: { single: 11, multi: 15, apartment: 20 },
  sf: { single: 24, multi: 30, apartment: 42 },
  seattle: { single: 14, multi: 18, apartment: 24 },
}
export const lifecycleFallback: Record<BuildingTier, number> = { single: 16, multi: 20, apartment: 30 }

// Months of the life-cycle attributable to demolition + site clearing (a vacant
// lot skips this). Grounded in each city's demolition-permit reality.
export const demoMonthsByCity: Record<string, number> = {
  boston: 2,
  nyc: 3,
  chicago: 1,
  sf: 4,
  seattle: 2,
}
export const demoMonthsFallback = 2

// Demolition cost per sq ft of EXISTING building removed (structural teardown,
// haul-off, and disposal; abatement on older buildings can push this higher).
// Estimate; scaled by the city construction index like hard cost.
export const demoCostPerSqFt = 14

// Scope relative to a full new build (demo + ground-up).
export const projectFactor: Record<ProjectType, number> = {
  new: 1,
  addition: 0.6,
  adu: 0.55,
  change_of_use: 0.5,
}

// A project needing discretionary relief adds a hearing cycle on top of baseline.
export const reliefAddMonths = 6

// Rough gross residential area per dwelling unit (incl. circulation, walls,
// common area) — used to estimate how many units a buildable envelope implies.
export const avgUnitGrossSqFt = 1000
