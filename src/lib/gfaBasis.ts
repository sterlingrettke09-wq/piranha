import type { ParcelInfo } from '../types/parcel'
import type { AnalysisInput } from '../types/analysis'

// ONE derivation of `gfaBasis`, because there were three and they disagreed.
//
// WHAT THIS FILE EXISTS TO PREVENT
// `gfaBasis` records where a project's floor area came from, and three
// fail-closed guards read it: feasibility withholds the verdict, hurdles
// downgrades size-triggered rows to 'info', and assumptions prints the "not a
// code limit" disclosure. Getting it wrong does not produce an error — it
// produces a confident AS_OF_RIGHT on a placeholder.
//
// The derivation was copied in three places: `analyze.ts` (the live HTTP path,
// which derives it server-side so a caller cannot omit it), `buildDefaultSpec`
// (client-side), and `scripts/smoke-parcels.ts` (the sampler that measures
// coverage). Adding a fourth `farBasis` state in 2026-08-15 updated ONE of
// them. The consequences were exactly the ones this indirection now removes:
//
//   · analyze.ts would have mapped LA's new 'basis-unavailable' envelope to
//     'assumed-far-1.0' — so the guard written for it never fires in
//     production, and the disclosure states "this district publishes no
//     floor-area ratio" about a district that publishes one.
//   · smoke-parcels.ts would have bucketed every LA parcel as GAP, reporting a
//     city where nothing was read rather than one where everything was.
//
// Neither is visible from a unit test, because a unit test calls the function
// it is testing. Only `tsc` caught it, and only because the sampler's copy had
// been narrowed enough to make the new comparison provably dead (TS2367).
// That was luck. This module is the structure that replaces it (CLAUDE.md
// rule 14 — convert a caught error into an impossible state, not a comment).
//
// ⚠️ ADDING A `farBasis`? Add it HERE and nowhere else. The switch is
// exhaustive over the published union, so a new member is a compile error in
// this file rather than a silent fall-through to 'assumed-far-1.0' in three.

type FarBasis = NonNullable<ParcelInfo['envelope']>['farBasis']
type GfaBasis = NonNullable<AnalysisInput['gfaBasis']>

/**
 * Where a project's floor area came from, given the parcel's envelope.
 *
 * 'envelope' when the envelope produced a usable floor area. Otherwise the
 * REASON it did not, which is the part that must not collapse: a stated absence
 * of FAR, an ordinance-governed district, a published ratio whose basis is
 * unobtainable, and a genuine failure to resolve anything are four different
 * facts, and only the last one means "nobody looked".
 */
export function deriveGfaBasis(envelope: ParcelInfo['envelope']): GfaBasis {
  if (envelope?.maxFloorAreaSqFt != null && envelope.maxFloorAreaSqFt > 0) return 'envelope'
  return gfaBasisForFarBasis(envelope?.farBasis ?? null)
}

/** The reason half, split out so it can be exercised over every `farBasis`. */
export function gfaBasisForFarBasis(farBasis: FarBasis | undefined): GfaBasis {
  switch (farBasis) {
    case 'unconstrained':
      // The code affirmatively imposes no FAR. A lot-area stand-in sits under a
      // STATED ABSENCE, which is why feasibility lets its verdict stand.
      return 'assumed-unconstrained'
    case 'planned-development':
      // A limit exists, in the ordinance that created the district. There is a
      // specific document to go and read.
      return 'assumed-planned-development'
    case 'basis-unavailable':
      // The ratio is published and the area it multiplies is not obtainable.
      // Distinct from 'assumed-far-1.0' in the one way that matters: nothing
      // here was left unread.
      return 'assumed-basis-unavailable'
    case 'basis-elective':
      // The ratio is published AND the denominator is the applicant's election,
      // so the product is uncomputable for the same arithmetic reason as
      // 'basis-unavailable' and for a completely different human reason. Kept
      // apart because the disclosure differs: one says nobody can compute this,
      // the other says you can and we cannot.
      return 'assumed-basis-elective'
    case 'residential':
    case 'mixed':
    case 'district':
      // A FAR resolved but produced no usable floor area — no lot size, or a
      // zero. Nothing was established about the limit's absence, so this is a
      // genuine gap rather than any of the three answers above.
      return 'assumed-far-1.0'
    case null:
    case undefined:
      return 'assumed-far-1.0'
  }
}
