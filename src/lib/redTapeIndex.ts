// The Red Tape Index — a ranked cross-city scorecard computed 100% from the
// same constants the analysis engine uses (src/config/estimates.ts), so it can
// never drift from a real report. Nothing here is hand-typed; every number is
// derived from the imported tables (or, for testing, an injected override of
// them). Change a constant in estimates.ts and the ranking reorders itself.
//
// Reference project: a mid-rise apartment building — ~40,000 sf of residential
// GFA, apartment tier, new construction. We score each city on (a) months of
// process (lifecycle for that tier + a simple variance adder + a teardown
// adder) and (b) impact/linkage fees in $/sf that would actually apply to this
// reference project. The composite weights months 70% / fees 30% and ranks
// ascending (least red tape first).

import {
  lifecycleMonths as defaultLifecycleMonths,
  reliefAddMonthsByCity as defaultReliefAddMonths,
  demoMonthsByCity as defaultDemoMonths,
  cityCostIndex as defaultCityCostIndex,
  impactFee as defaultImpactFee,
  type BuildingTier,
} from '../config/estimates'
import { PARKING_RULES, type ParkingRule } from '../config/parkingRules'
import type { Use } from '../types/analysis'

// Compact, table-cell version of a parking headline ("Abolished (2025)" /
// "Near transit only"). Informational only — NOT folded into the composite
// score (see computeRedTapeIndex / the /redtape methodology prose).
export function parkingCell(rule: ParkingRule | undefined): string {
  if (!rule) return '—'
  if (rule.status === 'abolished') return `Abolished (${rule.asOf})`
  return 'Near transit only'
}

// The fixed reference project the whole index is computed against.
export const REFERENCE = {
  tier: 'apartment' as BuildingTier,
  use: 'residential' as Use,
  gfa: 40000,
  units: 40,
  label: 'Mid-rise apartment · ~40,000 sf residential · new construction',
}

// The constants the index depends on, bundled so a test can inject overrides
// and prove the ranking is genuinely a function of the data, not hard-coded.
export interface RedTapeConstants {
  lifecycleMonths: Record<string, Record<BuildingTier, number>>
  reliefAddMonthsByCity: Record<string, number>
  demoMonthsByCity: Record<string, number>
  cityCostIndex: Record<string, number>
  impactFee: typeof defaultImpactFee
}

const DEFAULTS: RedTapeConstants = {
  lifecycleMonths: defaultLifecycleMonths,
  reliefAddMonthsByCity: defaultReliefAddMonths,
  demoMonthsByCity: defaultDemoMonths,
  cityCostIndex: defaultCityCostIndex,
  impactFee: defaultImpactFee,
}

export interface RankedCity {
  slug: string
  /** Full life-cycle months for the reference tier. */
  lifecycleMonths: number
  /** Months a simple variance adds, per city. */
  reliefAddMonths: number
  /** Months a teardown adds, per city. */
  demoMonths: number
  /** lifecycle + relief (the "months of process" the composite scores). */
  processMonths: number
  /** Construction cost index (1.00 = national average). */
  costIndex: number
  /** Impact/linkage fee $/sf applied to the reference project (0 if none). */
  feePerSqFt: number
  /** Human label for the applied fee, or null when none applies. */
  feeLabel: string | null
  /** 0–100 sub-score for months (0 = least, 100 = most across the set). */
  monthsScore: number
  /** 0–100 sub-score for fees. */
  feesScore: number
  /** Weighted composite, 0–100 (lower = less red tape). */
  score: number
  /** 1-based rank, ascending by score (1 = least red tape). */
  rank: number
  /** Parking-minimum status for this city — informational, NOT scored. */
  parkingStatus: ParkingRule['status'] | null
  /** Compact table-cell label for the parking column ("Abolished (2025)"). */
  parkingLabel: string
}

const MONTHS_WEIGHT = 0.7
const FEES_WEIGHT = 0.3

// Normalize a value to 0–100 across the set's [min, max]. When every value is
// identical the spread is zero, so we return 0 (no city is "worse" than another).
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return ((value - min) / (max - min)) * 100
}

export function computeRedTapeIndex(constants: Partial<RedTapeConstants> = {}): RankedCity[] {
  const c: RedTapeConstants = { ...DEFAULTS, ...constants }
  const slugs = Object.keys(c.lifecycleMonths)

  // First pass: pull the raw inputs per city.
  const base = slugs.map((slug) => {
    const lifecycle = c.lifecycleMonths[slug][REFERENCE.tier]
    const reliefAdd = c.reliefAddMonthsByCity[slug] ?? 0
    const demo = c.demoMonthsByCity[slug] ?? 0
    const fee = c.impactFee(slug, REFERENCE.use, REFERENCE.gfa, REFERENCE.units)
    // null fee, or a fee surfaced as informational (applied:false, e.g. it
    // can't be confirmed per parcel), counts as $0 for the reference project.
    const feePerSqFt = fee && fee.applied ? fee.perSqFt : 0
    const feeLabel = fee && fee.applied ? fee.label : null
    return {
      slug,
      lifecycleMonths: lifecycle,
      reliefAddMonths: reliefAdd,
      demoMonths: demo,
      processMonths: lifecycle + reliefAdd,
      costIndex: c.cityCostIndex[slug] ?? 1,
      feePerSqFt,
      feeLabel,
    }
  })

  const monthsVals = base.map((b) => b.processMonths)
  const feeVals = base.map((b) => b.feePerSqFt)
  const monthsMin = Math.min(...monthsVals)
  const monthsMax = Math.max(...monthsVals)
  const feeMin = Math.min(...feeVals)
  const feeMax = Math.max(...feeVals)

  const scored = base.map((b) => {
    const monthsScore = normalize(b.processMonths, monthsMin, monthsMax)
    const feesScore = normalize(b.feePerSqFt, feeMin, feeMax)
    const score = monthsScore * MONTHS_WEIGHT + feesScore * FEES_WEIGHT
    return { ...b, monthsScore, feesScore, score }
  })

  // Rank ascending: least red tape (lowest composite) is rank 1. Ties break by
  // process months, then slug, so the order is stable and deterministic.
  scored.sort((a, b) => a.score - b.score || a.processMonths - b.processMonths || a.slug.localeCompare(b.slug))

  return scored.map((s, i) => {
    const rule = PARKING_RULES[s.slug]
    return {
      ...s,
      rank: i + 1,
      parkingStatus: rule?.status ?? null,
      parkingLabel: parkingCell(rule),
    }
  })
}
