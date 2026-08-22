import type { AnalysisResult } from '../../../types/analysis'

type Parcel = AnalysisResult['parcel']

// Labels which FAR drove the envelope's headline floor area, so the figure reads
// as use-specific rather than a single use-agnostic cap (WO-5.5).
function farBasisLabel(
  // Derived from the type rather than restated, so adding a basis is a compile
  // error here instead of a silent `default: null`.
  basis: NonNullable<Parcel['envelope']>['farBasis'] | undefined,
): string | null {
  switch (basis) {
    case 'residential':
      return '(residential FAR)'
    case 'mixed':
      return '(mixed-use FAR)'
    case 'district':
      return '(district FAR)'
    case 'planned-development':
      // Not a resolved figure and not a missing one — the binding number is in
      // the ordinance that created this district.
      return '(set by PD ordinance)'
    case 'basis-unavailable':
    case 'basis-elective':
    case 'unconstrained':
      // All three carry a null floor area, so the row that calls this never
      // renders for them. Listed anyway so the switch stays exhaustive — and
      // 'unconstrained' was MISSING here, found the moment the `default` came
      // out. It had been falling through to the same silent null.
      return null
    case undefined:
    case null:
      return null
  }
}

// ⚠️ WHY THE ROWS BELOW ARE WRITTEN THIS WAY, AND NOT AS A TERNARY CHAIN.
//
// The engine distinguishes five reasons a floor-area figure can be missing and
// the screen collapsed four of them into one sentence. `Max FAR` read
//
//     maxFAR != null ? … : basis === 'unconstrained' ? … : basis === 'pd' ? …
//                                                        : 'Not in public data'
//
// which handles two states by name and defaults the rest — so `basis-elective`
// landed in the gap wording on SPI-1 SA1, a district publishing FAR 25 with a
// citation. Measured on production: the API returned
// `farByUse: {residential: 25, commercial: 25}` while the page said the figure
// was not in public data.
//
// The type system could not object, and that is the part worth keeping. A
// `Record<Union, T>` makes a new member a compile error — that is what caught
// three stale maps when ReliefKind moved. A `switch` with a `default` does not.
// A TERNARY CHAIN ENDING IN A FALLBACK STRING does not, and it was the idiom at
// every render site in this file. So the distinction is carried faithfully by
// the types all the way to the component and then dissolved by an if/else,
// which is why it "reaches the screen and dies there".
//
// These are switches with no `default` and an exhaustiveness assertion, so the
// next basis added upstream stops the build here instead of quietly rendering
// as a gap.
function assertNever(x: never): never {
  throw new Error(`unhandled basis: ${String(x)}`)
}

type FarBasis = NonNullable<Parcel['envelope']>['farBasis']

/** The Max FAR cell. A published ratio prints as a number; every other state
 *  says what is true of the CODE, never "we could not find it" unless that is
 *  what happened. */
export function maxFarValue(parcel: Parcel): { value: string; note?: string | null } {
  // One ratio for all uses — the district states it outright.
  if (parcel.maxFAR != null) return { value: parcel.maxFAR.toFixed(2) }

  // Per-use ratios. `maxFAR` is null wherever a district states them separately,
  // which is most of Atlanta's SPI chapters, and printing nothing there told the
  // reader we had not looked.
  const byUse = parcel.farByUse
  const elective = parcel.farElectiveByUse
  if (byUse) {
    const parts = (['residential', 'commercial', 'mixed', 'institutional'] as const)
      .filter((u) => byUse[u] != null)
      .map((u) => `${u.slice(0, 4)} ${byUse[u]!.toFixed(2)}${elective?.[u] ? '*' : ''}`)
    if (parts.length > 0) {
      return {
        value: parts.join(' · '),
        note: Object.values(elective ?? {}).some(Boolean)
          ? '* you choose net or gross lot area — the code allows either'
          : 'stated per use; these are alternatives, not a range',
      }
    }
  }

  const basis: FarBasis | undefined = parcel.envelope?.farBasis
  switch (basis) {
    case 'unconstrained':
      // "The code imposes no FAR here" is an ANSWER; "Not in public data" is a
      // GAP. Printing the gap wording here states the wrong thing.
      return { value: 'No FAR limit applies', note: 'height, setbacks and coverage govern instead' }
    case 'planned-development':
      return { value: 'Set by PD ordinance', note: 'the binding figure is in this district’s own ordinance' }
    case 'basis-unavailable':
      return {
        value: 'Published, not computable here',
        note: 'the code applies it to buildable area — the lot minus required yards — which no public layer carries',
      }
    case 'basis-elective':
      // Reached when a ratio exists but did not survive to `farByUse` — the
      // sentence must still not claim the code is silent.
      return { value: 'Published — you choose the lot area', note: 'net or gross; the code allows either' }
    case 'residential':
    case 'mixed':
    case 'district':
    case null:
    case undefined:
      return { value: 'Not in public data' }
    default:
      return assertNever(basis)
  }
}

/** The Max floor area cell. Returns zero or one row: the PRODUCT of a ratio and
 *  a lot area, or the reason there isn't one.
 *
 *  ⚠️ This was the third ternary chain, and it failed in the quietest way of
 *  the three — `basis-elective` fell through to `[]`, so the row vanished
 *  entirely. A missing row cannot be wrong on its face, which is exactly why it
 *  survives review: nothing on screen makes a claim, and nothing tells the
 *  reader a limit exists either. */
export function maxFloorAreaRows(parcel: Parcel): { label: string; value: string; note?: string | null }[] {
  const env = parcel.envelope
  const label = 'Max floor area'
  if (env?.maxFloorAreaSqFt != null) {
    return [{ label, value: `${env.maxFloorAreaSqFt.toLocaleString()} sq ft`, note: farBasisLabel(env.farBasis) }]
  }
  const basis: FarBasis | undefined = env?.farBasis
  switch (basis) {
    case 'unconstrained':
      return [{ label, value: 'No FAR limit', note: 'governed by height, setbacks and lot coverage' }]
    case 'planned-development':
      return [{ label, value: 'Set by PD ordinance', note: 'this district’s limits are in its own ordinance, not a district table' }]
    case 'basis-unavailable':
      // The FAR itself still prints in the row below — it is known. What cannot
      // be produced is the PRODUCT, because the code multiplies the ratio by
      // buildable area rather than by the lot, and buildable area depends on the
      // setbacks of neighbouring built lots. Saying "not in public data" here
      // would be false: the limit is public and we have it.
      return [{
        label,
        value: 'Not derivable from lot size',
        note: 'the FAR applies to buildable area — the lot minus required yards — which depends on neighbouring setbacks and is not in any public layer',
      }]
    case 'basis-elective':
      // Same arithmetic outcome as above, entirely different human one: nobody
      // can obtain a buildable area, whereas the reader knows their own basis.
      // The two must never share a sentence.
      return [{
        label,
        value: 'Depends on the lot area you choose',
        note: 'the code lets you apply the ratio to net or gross lot area, and the two give different answers',
      }]
    case 'residential':
    case 'mixed':
    case 'district':
    case null:
    case undefined:
      // A ratio resolved but produced no product — no lot size on file. Nothing
      // was established about the limit, so no row rather than a false reason.
      return []
    default:
      return assertNever(basis)
  }
}

type HeightBasis = NonNullable<Parcel['envelope']>['heightBasis']

export function maxHeightValue(parcel: Parcel): { value: string; note?: string | null } {
  if (parcel.maxHeightFt != null) return { value: `${parcel.maxHeightFt} ft` }
  const basis: HeightBasis | undefined = parcel.envelope?.heightBasis
  switch (basis) {
    case 'unconstrained':
      return { value: 'No height limit applies', note: 'FAR, setbacks and coverage govern instead' }
    case 'planned-development':
      return { value: 'Set by PD ordinance', note: 'the binding figure is in this district’s own ordinance' }
    case 'district':
    case null:
    case undefined:
      return { value: 'Not in public data' }
    default:
      return assertNever(basis)
  }
}
