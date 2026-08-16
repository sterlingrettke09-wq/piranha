import type { ParcelInfo } from '../../../src/types/parcel'
import { resolveZoningLimits } from './zoningLimits'
import { isPlannedDevelopment } from './zoning/plannedDevelopment'
import { ftPerStory, avgUnitGrossSqFt, MIXED_RESIDENTIAL_SHARE } from '../../../src/config/estimates'

// The maximum by-right envelope a parcel allows, derived from its resolved
// zoning limits and lot size. Flips the tool's question from "will my plan
// work?" to "what does this parcel allow?". All values are estimates.
export function computeEnvelope(info: ParcelInfo, city: string): NonNullable<ParcelInfo['envelope']> {
  const limits = resolveZoningLimits(info.zoning, city)
  const lot = info.lot.sizeSqFt

  // Headline floor area uses the residential/mixed FAR when broken out, else the
  // district max. Record which one drove the headline so the UI can label it —
  // an envelope sized off the residential FAR isn't the same number a commercial
  // or mixed project would see (WO-5.5).
  const residFar = info.zoning.farByUse?.residential
  const mixedFar = info.zoning.farByUse?.mixed
  let far: number | null
  // Derived from the published type rather than restated. The two had to be
  // edited in lockstep, and a local annotation that silently narrows is exactly
  // how a new basis becomes unreachable without anyone noticing.
  let farBasis: NonNullable<ParcelInfo['envelope']>['farBasis']
  if (info.zoning.farAppliesTo === 'buildable-area') {
    // FIRST, and that is the whole point. `maxFAR` IS populated here — LA's
    // height district really does cap floor area at 3.0 — so every branch below
    // would happily consume it and multiply by the lot. The ratio is right and
    // the multiplicand is wrong: LAMC § 12.21.1 A.1 says "three times the
    // Buildable Area of the Lot", the lot minus its required yards, and LA's
    // required front yard is the PREVAILING setback — the average of the front
    // yards already built on 40%+ of the frontage. It is a fact about the
    // street, not about this parcel or its zone, and nothing we fetch carries
    // it.
    //
    // So the product is withheld rather than computed against the wrong area.
    // Deriving a lot→buildable ratio would be an invented conversion factor
    // (rule 4), and publishing lot × FAR would put a known-high number on the
    // RESOLVED side of the ledger, where scrutiny does not go (rule 18).
    //
    // Note what this also fixes, for free: `maxUnits` derives from
    // `maxFloorAreaSqFt`, so withholding the area withholds the unit count too.
    // LA's R3/R4/R5 published FAR 3.0 straight into a units figure with no
    // density check, while R2/RD/RW were withheld upstream to avoid exactly
    // that — the guard was on the quieter zones.
    // WHEN TWO TRUE REASON CODES APPLY, THE MORE SPECIFIC ONE WINS — the one
    // that tells the reader where to look. Both are true of an LA parcel
    // carrying a "D" Development Limitation: the code states its FAR against
    // buildable area (so we cannot compute it) AND the binding figure lives in
    // the ordinance that imposed the D (so there is a document to go and read).
    // "The limit is in that ordinance" is actionable; "the basis is
    // unavailable" leaves the reader nothing to do.
    //
    // ⚠️ SCOPED INSIDE THIS BRANCH ON PURPOSE. Hoisting the PD check above the
    // resolved-figure branches would suppress FARs other cities really do
    // publish for PD districts — the case `never overrides a FAR the city
    // actually resolved` already pins. Here there is no figure to suppress:
    // this branch runs precisely when the district ratio cannot be applied.
    far = null
    farBasis =
      info.zoning.planGoverned || isPlannedDevelopment(city, info.zoning.districtCode)
        ? 'planned-development'
        : 'basis-unavailable'
  } else if (residFar != null) {
    far = residFar
    farBasis = 'residential'
  } else if (mixedFar != null) {
    far = mixedFar
    farBasis = 'mixed'
  } else if (limits.maxFAR != null) {
    far = limits.maxFAR
    farBasis = 'district'
  } else if (info.zoning.planGoverned || isPlannedDevelopment(city, info.zoning.districtCode)) {
    // A limit EXISTS for this parcel; it is in the ordinance that created this
    // specific district rather than in any district table (Dallas § 51A-4.702
    // (a)(4) says so outright). Neither a resolved figure nor a failure to
    // look — reporting it as a gap told the reader we could not find something
    // that is not there to be found, and it is why a city like Chicago, with
    // 1,457 PD/PMD classes, can never reach 100% by reading tables.
    //
    // Ordered BEFORE `farUnconstrained` because it is the more specific claim:
    // "set by its own ordinance" says where to look, "no FAR applies" says
    // there is nothing to look for. No city currently asserts both.
    //
    // TWO SOURCES, deliberately, and the provider's flag comes first. Several
    // per-city modules already establish this per DISTRICT, with a citation and
    // user-facing disclosure text — Las Vegas P-C, Phoenix PAD/PUD/PC,
    // Milwaukee PD/DPD/RED, Charlotte's conditional districts. Those stay the
    // source of truth for their own city; the registry covers the cities whose
    // modules carry no such flag. Duplicating a district in both would create
    // two places that can disagree.
    far = null
    farBasis = 'planned-development'
  } else if (info.zoning.farUnconstrained) {
    // The code imposes no FAR here. That is an ANSWER, not a gap: floor area is
    // governed by height/setbacks/coverage instead. Deliberately does NOT
    // invent a ratio — reporting one would be a cap the code never imposed.
    far = null
    farBasis = 'unconstrained'
  } else {
    far = null
    farBasis = null
  }

  // Some codes cap floor area at "the greater of the ratio or a fixed floor
  // value" (Austin HOME: "0.65 or 4,350 SF"). On small lots the floor governs,
  // so far * lot alone understates them. Only applies where a FAR actually
  // binds — an allowance is a floor under a cap, not a cap of its own, so it
  // must never manufacture a limit on an unconstrained parcel.
  const farFloor = info.zoning.farFloorSqFt
  const ratioArea = far != null && lot != null && lot > 0 ? Math.round(far * lot) : null
  let maxFloorAreaSqFt = ratioArea
  let floorAreaFromAllowance = false
  if (ratioArea != null && farFloor != null && farFloor > ratioArea) {
    maxFloorAreaSqFt = Math.round(farFloor)
    floorAreaFromAllowance = true
  }

  // Other programs the code allows, sized against this lot. ALTERNATIVES to the
  // headline, not a range around it — the headline stays the base case so it
  // never assumes a program the user hasn't chosen, and these show what else is
  // legally available. Same greater-of-ratio-or-floor rule as the headline.
  const alternatives =
    lot != null && lot > 0
      ? info.zoning.farAlternatives?.map((a) => ({
          label: a.label,
          maxFloorAreaSqFt: Math.round(Math.max(a.far * lot, a.floorSqFt ?? 0)),
          ...(a.source ? { source: a.source } : {}),
        }))
      : undefined

  const maxHeightFt = limits.maxHeightFt
  // Floor-to-floor height is use-aware: residential/mixed envelopes pack ~11 ft
  // floors, a district (commercial-style) envelope ~13 ft. With no FAR basis but
  // a known height, default to residential 11 ft — the conservative (taller
  // story count) read, matching the parcel-describing intent of this envelope.
  const storyUse: 'residential' | 'commercial' = farBasis === 'district' ? 'commercial' : 'residential'
  // Prefer a story count the CODE states directly. Deriving it from height
  // round-trips through two different floor-to-floor constants — Miami's module
  // multiplied 80 stories by 12 ft, then this line divided 960 ft by 11 ft and
  // produced 87 stories for a district whose code says 80. A stated figure is
  // exact; a derived one carries both constants' error.
  const statedStories = info.zoning.maxStories != null && info.zoning.maxStories > 0
  const maxStories = statedStories
    ? (info.zoning.maxStories as number)
    : maxHeightFt != null
      ? Math.floor(maxHeightFt / ftPerStory(storyUse))
      : null
  // 'stated' = the code says this many stories. 'derived' = we divided a
  // published height by an unsourced floor-to-floor convention. Both render as
  // a story count, and only one of them is a fact about the code.
  const storiesBasis: 'stated' | 'derived' | null =
    maxStories == null ? null : statedStories ? 'stated' : 'derived'

  const allowsResidential =
    !!limits.allowedUses?.includes('residential') || !!limits.allowedUses?.includes('mixed')
  // A mixed-basis envelope isn't 100% residential — only the residential share of
  // its GFA converts to dwelling units.
  const unitFloorArea =
    maxFloorAreaSqFt != null && farBasis === 'mixed'
      ? maxFloorAreaSqFt * MIXED_RESIDENTIAL_SHARE
      : maxFloorAreaSqFt
  const maxUnits =
    allowsResidential && unitFloorArea != null
      ? Math.max(1, Math.floor(unitFloorArea / avgUnitGrossSqFt))
      : null

  return {
    maxFloorAreaSqFt,
    maxHeightFt,
    maxStories,
    ...(storiesBasis ? { storiesBasis } : {}),
    maxUnits,
    allowedUses: limits.allowedUses,
    farBasis,
    ...(floorAreaFromAllowance ? { floorAreaFromAllowance: true } : {}),
    ...(alternatives && alternatives.length > 0 ? { alternatives } : {}),
  }
}
