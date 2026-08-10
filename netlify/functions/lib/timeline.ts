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
// Feed row counts observed at extraction time — see the type's own header for
// why they exist and why an entry may legitimately lack them.
import type { FeedCounts } from './feedCounts'

export type { BuildingTier }
export type { FeedCounts, FeedEndpointTotal } from './feedCounts'

/** Empirical new-construction filing→issuance timing for one city. */
export interface MeasuredPermit {
  medianMonths: number
  p80Months: number
  n: number
  vintage: string
}

/** Whether the city's pipeline COMPUTED a per-tier split, and which tiers it
 *  computed and then withheld. Written by scripts/permits/lib/tierFloor.mjs.
 *
 *  This is the field that separates two states which used to render identically
 *  in permitStats.json (rule 5 — a known absence and a missing lookup must not
 *  look the same):
 *
 *    attempted: false  — no breakdown was ever computed. The aggregate spans all
 *                        three tiers, so serving it for any tier is disclosed
 *                        and defensible (NYC, Philadelphia).
 *    attempted: true   — a breakdown exists. A tier missing from `byTier` was
 *                        computed and WITHHELD for a thin sample, which means
 *                        the aggregate is a population that barely contains that
 *                        tier. Serving it would be a fail-open answer (Denver's
 *                        `multi`). */
export interface TierBreakdown {
  attempted: boolean
  /** Tiers under this many rows are not published. Absent when !attempted. */
  minPublishableN?: number
  /** Only when !attempted: what in the feed or query makes a split absent. */
  reason?: string
  /** Tiers computed and withheld. `n: null` means the suppressed sample size was
   *  never recorded (the run predated this record) — an unknown, never a guess. */
  suppressed?: Partial<Record<BuildingTier, { n: number | null; reason: string }>>
}

const PERMIT_STATS = permitStats as Record<
  string,
  | {
      newConstruction?: MeasuredPermit
      byTier?: Partial<Record<BuildingTier, MeasuredPermit>>
      tierBreakdown?: TierBreakdown
      /** OPTIONAL, and unpopulated on every entry written before the
       *  instrumentation landed (2026-08-10). Those are deliberately NOT
       *  backfilled — a count taken today is not the count at that extract's
       *  vintage. An absent `feed` means "this run predates the counter", which
       *  is a true statement; a backfilled one would be a false provenance
       *  claim. Nothing at request time reads it: it exists so a later
       *  grew-vs-shrank check has something to diff. */
      feed?: FeedCounts
    }
  | undefined
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
  /** Set when the city HAS a tier breakdown but THIS project's tier was withheld
   *  from it. `measured` is deliberately undefined in that case: the city
   *  aggregate is a different population and would answer a question about
   *  duplexes with a number computed almost entirely from other building types.
   *  The UI must render this as "not measured for this size" — never as blank,
   *  which reads as fast. */
  measuredTierWithheld?: {
    tier: BuildingTier
    /** Rows the withheld tier held, or null when the run never recorded it. */
    n: number | null
    /** The publication floor the tier fell under. */
    minPublishableN: number
  }
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
 *  The aggregate remains the fallback ONLY where no breakdown was attempted,
 *  because a city that never split its population by tier is better served by a
 *  city-wide median than by nothing, and its aggregate genuinely spans all three
 *  tiers. Where a breakdown EXISTS, a tier missing from it was computed and
 *  withheld — and the aggregate is then not a weaker answer to the same
 *  question, it is an answer to a different one.
 *
 *  ⚠️ THIS USED TO FAIL OPEN. `entry.newConstruction` was returned for any tier
 *  lacking a `byTier` entry, whatever the reason. Denver's `multi` fell under the
 *  n<30 publication floor, so a Denver duplex was answered with the 4.5-month
 *  city aggregate — a population of 3,505 single-family houses, 628 apartment
 *  buildings, the untiered residential rows and the whole commercial layer, of
 *  which fewer than 30 rows are 2–4 unit buildings. The two states were
 *  indistinguishable in the artifact, so the code could not tell them apart
 *  either; `tierBreakdown` now records the difference and this reads it. */
export function measuredFor(city: string, tier?: BuildingTier): MeasuredPermit | undefined {
  const entry = PERMIT_STATS[city]
  if (!entry) return undefined
  if (tier) {
    const forTier = entry.byTier?.[tier]
    if (forTier) return forTier
    // Fail CLOSED for every tier absent from an attempted breakdown, not just
    // the ones documented in `suppressed`. A city that computes a split and
    // omits a tier has, by construction, no fit population for it — whether or
    // not anyone remembered to write down why.
    if (entry.tierBreakdown?.attempted) return undefined
  }
  return entry.newConstruction
}

/** Why `measuredFor(city, tier)` returned nothing while the city itself is
 *  measured — i.e. the tier was computed and withheld. Undefined in every other
 *  case (unmeasured city, no breakdown attempted, tier actually published), so a
 *  caller can only ever render this alongside a genuinely absent figure. */
export function measuredTierWithheldFor(
  city: string,
  tier: BuildingTier,
): TimelineResult['measuredTierWithheld'] {
  const entry = PERMIT_STATS[city]
  if (!entry?.newConstruction) return undefined
  if (!entry.tierBreakdown?.attempted) return undefined
  if (entry.byTier?.[tier]) return undefined
  const record = entry.tierBreakdown.suppressed?.[tier]
  return {
    tier,
    n: record?.n ?? null,
    minPublishableN: entry.tierBreakdown.minPublishableN ?? 30,
  }
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
  // Only ever set when `measured` is undefined for a tier reason — so the UI can
  // say "not measured for this size" instead of silently dropping the card.
  const measuredTierWithheld =
    project.projectType === 'new' && !measured ? measuredTierWithheldFor(city, tier) : undefined

  if (feasibility.path === 'prohibited') {
    return { months: 0, path: feasibility.path, tier, includesDemolition, measured, measuredTierWithheld }
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

  return {
    months: Math.max(1, months),
    path: feasibility.path,
    tier,
    includesDemolition,
    measured,
    measuredTierWithheld,
  }
}
