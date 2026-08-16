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

/** Every member of the published union. Pinned, so a new one fails HERE — the
 *  one place that must decide — rather than falling through in three files. */
const ALL_FAR_BASES: FarBasis[] = [
  'residential',
  'mixed',
  'district',
  'planned-development',
  'unconstrained',
  'basis-unavailable',
  null,
]

describe('every farBasis maps to a gfaBasis, and the four reasons stay apart', () => {
  it.each([
    ['unconstrained', 'assumed-unconstrained'],
    ['planned-development', 'assumed-planned-development'],
    ['basis-unavailable', 'assumed-basis-unavailable'],
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

  it('keeps the three ESTABLISHED reasons distinct from the gap', () => {
    const established = (['unconstrained', 'planned-development', 'basis-unavailable'] as const).map(
      gfaBasisForFarBasis,
    )
    expect(new Set(established).size).toBe(3)
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
