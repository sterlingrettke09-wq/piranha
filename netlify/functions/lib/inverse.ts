// INVERSE QUERY — "I want 40 units here. What would it take?"
//
// The forward pass takes a project and reports whether it clears the envelope.
// This runs it backward on ONE parcel: given a target, report which constraints
// bind and what relief each one needs. Same parcel, same limits, same relief
// thresholds — the inputs and outputs are swapped and nothing else is.
//
// It is deliberately NOT a search. "Find me parcels where I could build X" is a
// different product with a per-city index behind it; this needs no index, no
// bounded result set and no new infrastructure.
//
// ── EVERY CONSTANT COMES FROM THE FORWARD PASS ──────────────────────────────
//
// `RELIEF_FACTOR_HEIGHT` / `RELIEF_FACTOR_FAR` are imported from feasibility.ts,
// and `avgUnitGrossSqFt` / `ftPerStory` from the estimates config. A second copy
// of any of them would let the two directions contradict each other off the same
// inputs — the report saying a project needs a variance while this says rezoning.
//
// ── ⚠️ AND THE THING THIS FEATURE CAN MOST EASILY GET WRONG ─────────────────
//
// A constraint whose limit could not be resolved is NOT a constraint that does
// not bind. If a district's FAR is unreadable, "you need a height variance" is a
// false completeness claim: the FAR might be the harder problem and nobody
// looked. So an unresolved limit produces `relief: 'unknown'`, the result is
// marked `unresolved`, and the binding constraint is labelled as the hardest
// among those that could be EVALUATED rather than the hardest full stop.
//
// That is CLAUDE.md rule 5 in the place it costs the most: the forward pass can
// say INDETERMINATE about one dimension and still give a useful verdict, because
// the user supplied the project. Here the user is asking what to do next, and an
// answer that omits the binding constraint sends them to the wrong hearing.

import type { ParcelInfo } from '../../../src/types/parcel'
import type { Use } from '../../../src/types/analysis'
import { resolveZoningLimits } from './zoningLimits'
import { RELIEF_FACTOR_HEIGHT, RELIEF_FACTOR_FAR } from './feasibility'
import { avgUnitGrossSqFt } from '../../../src/config/estimates'

export type InverseDimension = 'use' | 'far' | 'height' | 'units'

export type ReliefKind =
  /** The target fits within what the district allows. Nothing to ask for. */
  | 'none'
  /** Over the limit, within the factor doctrine treats as grantable dimensional
   *  relief. A variance is the instrument. */
  | 'dimensional-variance'
  /** Over the limit by more than a variance realistically bridges. Rezoning,
   *  planned development or a special district — not a board hearing. */
  | 'beyond-variance'
  /** The code imposes NO limit on this dimension here. An ANSWER: this dimension
   *  is not what stops you, and something else (setbacks, coverage) governs. */
  | 'no-limit'
  /** ⚠️ The limit could not be resolved. NOT 'none'. Nobody knows whether this
   *  binds, and an answer that leaves it out is incomplete. */
  | 'unknown'

export interface Constraint {
  dimension: InverseDimension
  /** What the target needs, in the dimension's own unit. */
  required: number | null
  /** What the district allows by right. */
  allowed: number | null
  /** required ÷ allowed. Null when either side is unknown, never 1. */
  ratio: number | null
  relief: ReliefKind
  /** Plain-language, and it says what the user should DO. */
  note: string
}

export interface Target {
  use: Use
  /** Any one of these, or several. At least one is required. */
  units?: number | null
  gfaSqFt?: number | null
  stories?: number | null
  heightFt?: number | null
}

export interface InverseResult {
  constraints: Constraint[]
  /** The hardest constraint AMONG THOSE THAT COULD BE EVALUATED. Null when the
   *  target fits by right, or when nothing could be evaluated at all. */
  binding: Constraint | null
  /** Dimensions whose limit could not be resolved. Non-empty means the answer is
   *  INCOMPLETE — one of these could be harder than `binding`. */
  unresolved: InverseDimension[]
  /** Every number this derived and how, so nothing in the output is unexplained.
   *  A unit target becomes a floor area through a published constant, and the
   *  user is entitled to see which. */
  derivation: string[]
  /** No target was given, so there is nothing to answer. Distinct from "fits". */
  empty: boolean
}

const RANK: Record<ReliefKind, number> = {
  none: 0,
  'no-limit': 0,
  unknown: 1,
  'dimensional-variance': 2,
  'beyond-variance': 3,
}

function classify(required: number, allowed: number, factor: number): ReliefKind {
  if (required <= allowed) return 'none'
  return required <= allowed * factor ? 'dimensional-variance' : 'beyond-variance'
}

/** ⚠️ ONE PLACE CONVERTS UNITS TO FLOOR AREA, and it is the constant the cost
 *  engine and the forward pass already use. Deriving it differently here would
 *  produce an inverse answer the report contradicts on the same parcel.
 *
 *  It is a COMPOSITE constant (a ~1,000 sf net unit ÷ a 75% efficiency), and its
 *  own file records that only the net figure is sourced. So the derivation is
 *  reported to the user rather than folded silently into a FAR — they can see
 *  that "40 units" became "52,000 sf" and on what basis. */
function gfaForUnits(units: number): number {
  return units * avgUnitGrossSqFt
}

export function whatWouldItTake(parcel: ParcelInfo, city: string, target: Target): InverseResult {
  const limits = resolveZoningLimits(parcel.zoning, city)
  const constraints: Constraint[] = []
  const derivation: string[] = []
  const unresolved: InverseDimension[] = []

  const lot = parcel.lot.sizeSqFt
  const hasTarget =
    (target.units ?? null) != null ||
    (target.gfaSqFt ?? null) != null ||
    (target.stories ?? null) != null ||
    (target.heightFt ?? null) != null

  if (!hasTarget) {
    return { constraints: [], binding: null, unresolved: [], derivation: [], empty: true }
  }

  // ── FLOOR AREA the target implies ────────────────────────────────────────
  let gfa = target.gfaSqFt ?? null
  if (gfa == null && target.units != null) {
    gfa = gfaForUnits(target.units)
    derivation.push(
      `${target.units} units → ${gfa.toLocaleString()} sq ft of floor area, at ${avgUnitGrossSqFt.toLocaleString()} gross sq ft per unit (the same figure the cost and feasibility passes use).`,
    )
  }

  // ── USE ──────────────────────────────────────────────────────────────────
  if (!limits.allowedUses) {
    constraints.push({
      dimension: 'use', required: null, allowed: null, ratio: null, relief: 'unknown',
      note: 'The uses this district allows could not be read, so whether your use is permitted here is unknown.',
    })
    unresolved.push('use')
  } else if (limits.allowedUses.includes(target.use)) {
    constraints.push({
      dimension: 'use', required: null, allowed: null, ratio: null, relief: 'none',
      note: `${target.use} is allowed here by right.`,
    })
  } else {
    // Deliberately NOT graded by adjacency here. The forward pass makes that
    // call for a project it can see in full; restating it as an instrument
    // recommendation ("ask for a special permit") would be a firmer claim than
    // the evidence, and a use variance is the hardest relief there is.
    constraints.push({
      dimension: 'use', required: null, allowed: null, ratio: null, relief: 'beyond-variance',
      note: `${target.use} is not among the uses this district lists (${limits.allowedUses.join(', ')}). Changing that is a use variance or a rezoning, not a dimensional adjustment — and it is the hardest relief to obtain.`,
    })
  }

  // ── FAR ──────────────────────────────────────────────────────────────────
  const farLimit = parcel.zoning.farByUse?.[target.use] ?? limits.maxFAR
  if (gfa != null) {
    if (parcel.zoning.farUnconstrained === true) {
      constraints.push({
        dimension: 'far', required: null, allowed: null, ratio: null, relief: 'no-limit',
        note: 'This district imposes no floor-area ratio, so floor area is not what limits you here — height, setbacks and coverage are.',
      })
    } else if (farLimit == null || lot == null) {
      constraints.push({
        dimension: 'far', required: null, allowed: null, ratio: null, relief: 'unknown',
        note:
          lot == null
            ? 'The lot size is not on record, so the floor area you need cannot be turned into a ratio to check.'
            : 'No floor-area ratio could be resolved for this district, so whether your floor area fits is unknown.',
      })
      unresolved.push('far')
    } else {
      const needFar = gfa / lot
      const relief = classify(needFar, farLimit, RELIEF_FACTOR_FAR)
      derivation.push(
        `${gfa.toLocaleString()} sq ft on a ${lot.toLocaleString()} sq ft lot → FAR ${needFar.toFixed(2)}; the district allows ${farLimit.toFixed(2)}.`,
      )
      constraints.push({
        dimension: 'far',
        required: Number(needFar.toFixed(3)),
        allowed: farLimit,
        ratio: Number((needFar / farLimit).toFixed(3)),
        relief,
        note:
          relief === 'none'
            ? `Floor area fits: FAR ${needFar.toFixed(2)} against a limit of ${farLimit.toFixed(2)}.`
            : relief === 'dimensional-variance'
              ? `You need FAR ${needFar.toFixed(2)} where ${farLimit.toFixed(2)} is allowed — ${(needFar / farLimit).toFixed(2)}× over. That is dimensional relief: a variance.`
              : `You need FAR ${needFar.toFixed(2)} where ${farLimit.toFixed(2)} is allowed — ${(needFar / farLimit).toFixed(1)}× over. Density that far above the district is past what a variance grants; it takes a rezoning or a planned development.`,
      })
    }
  }

  // ── HEIGHT ───────────────────────────────────────────────────────────────
  //
  // ⚠️ THE UNITS ARE NOT INTERCHANGEABLE. A district stating STORIES is compared
  // against a story target, and one stating FEET against a height in feet. The
  // forward pass refuses to convert between them and so does this: dividing a
  // published height by a floor-to-floor convention is the round trip that once
  // published 87 stories for a Miami district whose code says 80 (rule 12).
  const statedStories =
    parcel.zoning.maxStories != null && parcel.zoning.maxStories > 0 ? parcel.zoning.maxStories : null
  const wantFt = target.heightFt ?? null
  const wantStories = target.stories ?? null

  if (wantStories != null && statedStories != null) {
    const relief = classify(wantStories, statedStories, RELIEF_FACTOR_HEIGHT)
    constraints.push({
      dimension: 'height', required: wantStories, allowed: statedStories,
      ratio: Number((wantStories / statedStories).toFixed(3)), relief,
      note:
        relief === 'none'
          ? `${wantStories} storeys fits a ${statedStories}-storey limit.`
          : relief === 'dimensional-variance'
            ? `You want ${wantStories} storeys where ${statedStories} are allowed. That is a height variance.`
            : `You want ${wantStories} storeys where ${statedStories} are allowed — ${(wantStories / statedStories).toFixed(1)}× the limit, past what a variance grants.`,
    })
  } else if (wantFt != null && limits.maxHeightFt != null) {
    const relief = classify(wantFt, limits.maxHeightFt, RELIEF_FACTOR_HEIGHT)
    constraints.push({
      dimension: 'height', required: wantFt, allowed: limits.maxHeightFt,
      ratio: Number((wantFt / limits.maxHeightFt).toFixed(3)), relief,
      note:
        relief === 'none'
          ? `${wantFt} ft fits a ${limits.maxHeightFt} ft limit.`
          : relief === 'dimensional-variance'
            ? `You want ${wantFt} ft where ${limits.maxHeightFt} ft is allowed. That is a height variance.`
            : `You want ${wantFt} ft where ${limits.maxHeightFt} ft is allowed — ${(wantFt / limits.maxHeightFt).toFixed(1)}× the limit, past what a variance grants.`,
    })
  } else if (wantStories != null && limits.maxHeightFt != null) {
    // Limit in feet, target in storeys. KNOWN but not comparable — and this must
    // not read as "no height limit here", which is a different and false thing.
    constraints.push({
      dimension: 'height', required: null, allowed: limits.maxHeightFt, ratio: null, relief: 'unknown',
      note: `This district's limit is ${limits.maxHeightFt} ft, and you gave a storey count. Converting between the two would invent a floor-to-floor height the code does not state — give a height in feet to have this checked.`,
    })
    unresolved.push('height')
  } else if (wantFt != null && statedStories != null) {
    constraints.push({
      dimension: 'height', required: null, allowed: statedStories, ratio: null, relief: 'unknown',
      note: `This district's limit is ${statedStories} storeys, and you gave a height in feet. Converting between the two would invent a floor-to-floor height the code does not state — give a storey count to have this checked.`,
    })
    unresolved.push('height')
  } else if (wantFt != null || wantStories != null) {
    // ⚠️ There is no `heightUnconstrained` on the zoning type, only
    // `farUnconstrained`, so "this district states no height limit" and "we could
    // not read one" are NOT distinguishable from here. That is a real gap in the
    // data model and it is reported as unknown rather than guessed either way —
    // claiming no limit applies would be the more useful answer and the one with
    // nothing behind it.
    constraints.push({
      dimension: 'height', required: wantFt ?? wantStories, allowed: null, ratio: null, relief: 'unknown',
      note: 'No height limit for this district is available in public data. That may mean the code sets none, or that it sets one we could not read — the two are not distinguishable here, so neither is claimed.',
    })
    unresolved.push('height')
  }

  // ── UNITS, where the district caps them directly ─────────────────────────
  //
  // Only when the district states a unit cap of its own. A cap DERIVED from FAR
  // is already the FAR constraint, and reporting it twice would make one problem
  // look like two — and suggest two hearings.
  // ⚠️ `envelope.maxUnits` is DERIVED from floor area, not a district cap — see
  // computeEnvelope. So it is deliberately NOT used here: reporting it would
  // restate the FAR constraint as a second, separate problem and imply a second
  // hearing. A district that caps units directly would need its own field on the
  // zoning type, and none exists yet.
  const unitCap: number | null = null
  if (target.units != null && unitCap != null) {
    const relief = classify(target.units, unitCap, RELIEF_FACTOR_FAR)
    constraints.push({
      dimension: 'units', required: target.units, allowed: unitCap,
      ratio: Number((target.units / unitCap).toFixed(3)), relief,
      note:
        relief === 'none'
          ? `${target.units} units fits this district's cap of ${unitCap}.`
          : `You want ${target.units} units where this district caps ${unitCap}. A density increase is generally excluded from area-variance relief, so this is rezoning territory.`,
    })
  }

  const evaluable = constraints.filter((c) => c.relief !== 'unknown')
  const binding =
    evaluable
      .filter((c) => RANK[c.relief] > 0)
      .sort((a, b) => RANK[b.relief] - RANK[a.relief] || (b.ratio ?? 0) - (a.ratio ?? 0))[0] ?? null

  return { constraints, binding, unresolved, derivation, empty: false }
}

/** One line stating what the answer is and, crucially, what it does not cover.
 *
 *  ⚠️ Every branch that has unresolved dimensions SAYS SO in the same sentence
 *  as the recommendation. Splitting them — a confident headline with a caveat
 *  underneath — is how a partial answer gets read as a whole one, and here that
 *  sends someone to a hearing for the wrong relief. */
export function summariseInverse(r: InverseResult): string {
  if (r.empty) return 'No target given, so there is nothing to work back from.'
  const gap = r.unresolved.length
    ? ` This does not cover ${r.unresolved.join(' and ')}, which could not be read for this district and may be the harder problem.`
    : ''
  if (r.binding == null) {
    if (r.unresolved.length) return `Nothing that could be checked stands in the way.${gap}`
    // ⚠️ A DIMENSION WITH NO LIMIT IS NOT A CLEAN PASS, and this contradiction
    // was live before it was caught: asking for 40 units on Denver's D-CV
    // returned "fits within what the district allows by right" while the FAR
    // constraint directly under it said height, setbacks and coverage govern
    // instead — neither of which was checked, because the target named neither.
    //
    // "No FAR applies here" is an answer about FAR. It is not an answer about
    // the parcel, and the summary must not borrow the confidence of one for the
    // other. The forward pass never had this problem: it has a whole project to
    // check, so it always has a height.
    const unlimited = r.constraints.filter((c) => c.relief === 'no-limit')
    if (unlimited.length) {
      const names = unlimited.map((c) => c.dimension).join(' and ')
      return `Nothing you named exceeds this district's limits. But ${names} is not capped here, which means something else governs — height, setbacks or lot coverage — and you have not named a height for us to check.`
    }
    return 'This fits within what the district allows by right.'
  }
  const others = r.constraints.filter((c) => c !== r.binding && RANK[c.relief] > 0 && c.relief !== 'unknown')
  const also = others.length ? ` ${others.length} other constraint${others.length === 1 ? '' : 's'} also bind${others.length === 1 ? 's' : ''}.` : ''
  return `${r.binding.note}${also}${gap}`
}
