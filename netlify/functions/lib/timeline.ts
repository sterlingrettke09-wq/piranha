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
   *  never recorded (the run predated this record) — an unknown, never a guess.
   *
   *  `basis` distinguishes TWO KINDS OF ABSENCE that rendered identically until
   *  Milwaukee (rule 5, one level in — it is not enough that an absence differ
   *  from a gap, two absences with different causes must differ from each other):
   *    'thin-sample'  the tier WAS counted and the count is too small to publish.
   *                   An n exists and a floor is the reason. Denver's `multi`.
   *    'unenumerable' the tier CANNOT be counted from this feed at all, so there
   *                   is no n and no floor. Milwaukee files every 5+-unit building
   *                   as commercial new construction, where `Use of Building` is
   *                   free text — apartments are not a small sample there, they
   *                   are inseparable from parking lots and cell towers.
   *  Absent means 'thin-sample', which is what every record written before
   *  2026-08-18 meant. */
  suppressed?: Partial<
    Record<
      BuildingTier,
      { n: number | null; reason: string; basis?: 'thin-sample' | 'unenumerable' }
    >
  >
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


// ── ⚠️ THE ENTITLEMENT LEG — A DIFFERENT MEASUREMENT FROM `measured` ─────────
//
// `measured` above is filing→ISSUANCE, from each city's own open permit data.
// This is application→ENTITLEMENT, from California HCD's Housing Element Annual
// Progress Report. They are DIFFERENT LEGS of the same lifecycle and must never
// be summed, compared, or substituted for one another — a city could plausibly
// carry both, and adding them would double-count the overlap neither source
// bounds.
//
// ⚠️ AND NEITHER IS THE LIFECYCLE. Both are subsets of `months`. Swapping either
// in would replace a calibrated whole with a measured fragment.

/** Application→entitlement timing for 5+ unit multifamily, from the HCD APR. */
export interface MeasuredEntitlement {
  medianMonths: number
  p80Months: number
  n: number
  vintage: string
  /** Named because it is a different instrument from the permit pipeline, and a
   *  reader comparing the two numbers has to know that. */
  source: string
  /** ⚠️ RENDERED WHEREVER THE FIGURE IS. Three of the fifteen ranked cities
   *  carry this leg and twelve do not, so a bare number would put a measured
   *  city and a calibrated one side by side with nothing to separate them. */
  coverageCaveat: string
}

/** Why a city has no entitlement leg. ⚠️ THREE OUTCOMES, NOT TWO — the same
 *  distinction `tierBreakdown` draws for the permit pipeline, because a blank
 *  reads as "fast" in exactly the place it means "unknown" (rule 5):
 *
 *    'no-source'     no equivalent dataset has been identified for this
 *                    jurisdiction. True of every non-California city here. This
 *                    is an ANSWER about our coverage, not about the city.
 *    'thin-sample'   the jurisdiction IS in the dataset and its sample is under
 *                    the publication floor. San Diego: n=15, and 4.4 months
 *                    against LA's 8.5 fails a known-good comparison on its face.
 *    'wrong-tier'    the city is measured, but this project is not 5+ unit
 *                    multifamily, which is the only population the extract
 *                    covers. A different question, not a weaker answer. */
export type EntitlementAbsence =
  | { basis: 'no-source'; detail: string }
  | { basis: 'thin-sample'; n: number; minPublishableN: number; detail: string }
  | { basis: 'wrong-tier'; tier: BuildingTier; detail: string }

const HCD_VINTAGE = '2018–2025 filings, data.ca.gov extract updated 2026-08-14'
const HCD_SOURCE =
  'California HCD Housing Element Annual Progress Report, Tables A (APP_SUBMIT_DT) and A2 (ENT_APPROVE_DT1), joined on JURIS_NAME + APN'
const HCD_COVERAGE =
  '⚠️ Measured for 3 of the 15 ranked cities. The other twelve have no equivalent source, so their timelines are calibrated rather than measured — this figure is not comparable across cities in the ranking.'
const HCD_MIN_N = 30

/** ⚠️ 5+ UNIT MULTIFAMILY ONLY. The extract covers that population and no other,
 *  so these figures are not offered for a house or a duplex — see 'wrong-tier'. */
const ENTITLEMENT_MONTHS: Readonly<Record<string, { medianMonths: number; p80Months: number; n: number }>> =
  Object.freeze({
    sf: { medianMonths: 18.0, p80Months: 27.0, n: 90 },
    sanjose: { medianMonths: 15.3, p80Months: 22.1, n: 52 },
    la: { medianMonths: 8.5, p80Months: 19.5, n: 1325 },
  })

/** ⚠️ IN THE DATASET, AND DELIBERATELY NOT PUBLISHED. Kept as data rather than
 *  dropped, so "we withheld this" stays distinguishable from "we never had it"
 *  — and so the guard can assert the partition instead of an empty exception
 *  (rule 29's corollary). */
const ENTITLEMENT_WITHHELD: Readonly<Record<string, { n: number; detail: string }>> = Object.freeze({
  sandiego: {
    n: 15,
    detail:
      'San Diego is in the HCD extract with n=15, under the n=30 floor. ⚠️ Its 4.4-month median against Los Angeles\u2019s 8.5 also fails a known-good comparison on its face — the same shape as the Milwaukee and Chicago permit-timing withholdings: a number in the right units that contradicts something already established.',
  },
})

/** The application→entitlement leg for a project, or why there is none.
 *
 *  ⚠️ Returns a DISCRIMINATED result rather than `MeasuredEntitlement | undefined`
 *  so a caller cannot render nothing where the answer is "withheld" — which is
 *  the failure this file already fixed once for the permit tiers. */
export function entitlementFor(
  city: string,
  project: AnalysisInput,
): { kind: 'measured'; value: MeasuredEntitlement } | { kind: 'absent'; why: EntitlementAbsence } {
  const tier = buildingTier(project)
  const row = ENTITLEMENT_MONTHS[city]
  const withheld = ENTITLEMENT_WITHHELD[city]
  if (!row && !withheld) {
    return {
      kind: 'absent',
      why: {
        basis: 'no-source',
        detail:
          'No application→entitlement dataset has been identified for this jurisdiction. California publishes one statewide through HCD; no equivalent was found elsewhere. ⚠️ This is a statement about our coverage, not about the city\u2019s speed.',
      },
    }
  }
  if (withheld) {
    return {
      kind: 'absent',
      why: { basis: 'thin-sample', n: withheld.n, minPublishableN: HCD_MIN_N, detail: withheld.detail },
    }
  }
  // ⚠️ The tier check comes AFTER the city checks, so a house in San Diego
  // reports the thin sample rather than the tier — the city-level reason is the
  // one that would still hold if the project changed.
  if (tier !== 'apartment') {
    return {
      kind: 'absent',
      why: {
        basis: 'wrong-tier',
        tier,
        detail:
          'The HCD extract covers 5+ unit multifamily only. This project is not in that population, so the measured figure would answer a different question rather than this one less well.',
      },
    }
  }
  return {
    kind: 'measured',
    value: { ...row, vintage: HCD_VINTAGE, source: HCD_SOURCE, coverageCaveat: HCD_COVERAGE },
  }
}

/** Cities with a published entitlement leg. Exported so the coverage claim in
 *  `HCD_COVERAGE` is checkable against the data rather than trusted (rule 20). */
export const ENTITLEMENT_MEASURED_CITIES: readonly string[] = Object.freeze(
  Object.keys(ENTITLEMENT_MONTHS).sort(),
)
/** Cities in the dataset whose figure is withheld. */
export const ENTITLEMENT_WITHHELD_CITIES: readonly string[] = Object.freeze(
  Object.keys(ENTITLEMENT_WITHHELD).sort(),
)

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
  measuredTierWithheld?:
    | {
        tier: BuildingTier
        basis: 'thin-sample'
        /** Rows the withheld tier held, or null when the run never recorded it. */
        n: number | null
        /** The publication floor the tier fell under. */
        minPublishableN: number
      }
    | {
        tier: BuildingTier
        basis: 'unenumerable'
        /** Why the feed cannot separate this tier. Rendered — not a vintage
         *  string. There is deliberately no `n` and no floor on this arm: a
         *  union rather than optional fields is what makes "sample is under the
         *  n=30 floor" unable to render for a tier that was never counted. */
        reason: string
      }
  /** ⚠️ A DIFFERENT LEG FROM `measured`, and never summed with it. Application→
   *  entitlement for 5+ unit multifamily. Present only where HCD publishes a
   *  usable sample; `entitlementAbsent` says why when it is not. */
  entitlement?: MeasuredEntitlement
  /** ⚠️ ALWAYS SET WHEN `entitlement` IS ABSENT, never left blank — a missing
   *  entitlement line reads as "no delay here", which is the opposite of what
   *  an unmeasured city means. */
  entitlementAbsent?: EntitlementAbsence
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
  // "Is this city measured at all?" — NOT "does it have an aggregate?". Those
  // were the same question until Milwaukee, which publishes two tiers and NO
  // city-wide figure precisely because a 1–2-family-only number wearing a
  // city label is the fail-open this whole mechanism exists to prevent. Reading
  // `newConstruction` as the proxy would have made the withheld-tier card vanish
  // for the one city whose absence most needs explaining.
  const measuredAtAll = Boolean(entry?.newConstruction) || Object.keys(entry?.byTier ?? {}).length > 0
  if (!entry || !measuredAtAll) return undefined
  if (!entry.tierBreakdown?.attempted) return undefined
  if (entry.byTier?.[tier]) return undefined
  const record = entry.tierBreakdown.suppressed?.[tier]
  if (record?.basis === 'unenumerable') {
    return { tier, basis: 'unenumerable', reason: record.reason }
  }
  return {
    tier,
    basis: 'thin-sample',
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

  // ⚠️ The entitlement leg is about getting a housing development APPROVED, so
  // it attaches to new construction only — the same scope rule as `measured`,
  // for a different reason.
  const ent = project.projectType === 'new' ? entitlementFor(city, project) : null
  const entitlement = ent?.kind === 'measured' ? ent.value : undefined
  const entitlementAbsent = ent?.kind === 'absent' ? ent.why : undefined

  if (feasibility.path === 'prohibited') {
    return { months: 0, path: feasibility.path, tier, includesDemolition, measured, measuredTierWithheld, entitlement, entitlementAbsent }
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
    entitlement,
    entitlementAbsent,
  }
}
