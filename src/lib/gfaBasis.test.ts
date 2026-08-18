import { describe, it, expect } from 'vitest'
import { deriveGfaBasis, gfaBasisForFarBasis } from './gfaBasis'
import type { ParcelInfo } from '../types/parcel'

// WHAT THIS FILE DEFENDS
//
// `gfaBasis` decides whether three fail-closed guards fire. The derivation was
// copied into three files, a fourth `farBasis` was added, and only one copy was
// updated — so the live handler would have mapped LA to 'assumed-far-1.0',
// silently disabling the guard written for it and printing a disclosure that
// says the district publishes no FAR when it publishes one.
//
// No unit test could see that, because a unit test calls the function it is
// testing. What follows therefore asserts TWO different things: that the
// derivation is right, and that the call sites actually call it.

type FarBasis = NonNullable<ParcelInfo['envelope']>['farBasis']

/** Every member of the published union.
 *
 *  ⚠️ THIS COMMENT USED TO CLAIM A NEW MEMBER "FAILS HERE", AND IT DID NOT.
 *  Adding 'basis-elective' on 2026-08-18 left this array stale and every test in
 *  the file green, because a hand-kept list is only ever checked against itself:
 *  the loop below iterated six members and asserted six things, and the seventh
 *  simply was not in the conversation. A pinned inventory that cannot notice its
 *  own subject growing is rule 20 inside the guard.
 *
 *  Now the compiler enforces it. `Missing` resolves to `never` only when this
 *  array covers the union; otherwise the assignment below is a type error that
 *  NAMES the absent member. */
const ALL_FAR_BASES = [
  'residential',
  'mixed',
  'district',
  'planned-development',
  'unconstrained',
  'basis-unavailable',
  'basis-elective',
  null,
] as const satisfies readonly FarBasis[]

type MissingFarBasis = Exclude<FarBasis, (typeof ALL_FAR_BASES)[number]>
const _allFarBasesCovered: MissingFarBasis extends never ? true : MissingFarBasis = true
void _allFarBasesCovered

describe('every farBasis maps to a gfaBasis, and the FIVE reasons stay apart', () => {
  it.each([
    ['unconstrained', 'assumed-unconstrained'],
    ['planned-development', 'assumed-planned-development'],
    ['basis-unavailable', 'assumed-basis-unavailable'],
    ['basis-elective', 'assumed-basis-elective'],
    ['district', 'assumed-far-1.0'],
    ['residential', 'assumed-far-1.0'],
    ['mixed', 'assumed-far-1.0'],
    [null, 'assumed-far-1.0'],
  ] as const)('%s -> %s', (farBasis, expected) => {
    expect(gfaBasisForFarBasis(farBasis)).toBe(expected)
  })

  it('never returns undefined for any member of the union', () => {
    // The failure mode that started this: a fall-through producing a value
    // nobody chose. An exhaustive switch cannot, and this proves it over the
    // pinned set rather than trusting the compiler alone.
    for (const b of ALL_FAR_BASES) {
      expect(gfaBasisForFarBasis(b), String(b)).toBeTruthy()
    }
  })

  it('keeps the FOUR ESTABLISHED reasons distinct from the gap', () => {
    // 'basis-elective' joins them: the ratio is known and the denominator is the
    // applicant's to choose, which is an answer about the code — not a failure
    // to look. It must not collapse into 'basis-unavailable' either, because
    // that one tells the reader nobody can compute the area and this one tells
    // them they can.
    const established = ([
      'unconstrained',
      'planned-development',
      'basis-unavailable',
      'basis-elective',
    ] as const).map(gfaBasisForFarBasis)
    expect(new Set(established).size).toBe(4)
    for (const e of established) expect(e).not.toBe('assumed-far-1.0')
  })
})

describe('deriveGfaBasis prefers a real envelope over any reason', () => {
  const env = (over: Partial<NonNullable<ParcelInfo['envelope']>>) =>
    ({
      maxFloorAreaSqFt: null, maxHeightFt: null, maxStories: null, maxUnits: null,
      allowedUses: null, farBasis: null, ...over,
    }) as NonNullable<ParcelInfo['envelope']>

  it("returns 'envelope' when a floor area resolved", () => {
    expect(deriveGfaBasis(env({ maxFloorAreaSqFt: 20_000, farBasis: 'district' }))).toBe('envelope')
  })

  it('falls to the reason when the floor area is null or zero', () => {
    expect(deriveGfaBasis(env({ maxFloorAreaSqFt: null, farBasis: 'basis-unavailable' }))).toBe(
      'assumed-basis-unavailable',
    )
    expect(deriveGfaBasis(env({ maxFloorAreaSqFt: 0, farBasis: 'unconstrained' }))).toBe(
      'assumed-unconstrained',
    )
  })

  it('handles a missing envelope entirely', () => {
    expect(deriveGfaBasis(undefined)).toBe('assumed-far-1.0')
  })
})

// The source-text wiring assertions — that all three call sites actually USE
// this module — live in netlify/functions/lib/gfaBasisWiring.test.ts, because
// `src`'s tsconfig carries no node types and they need to read files.
