// ---- Instant-report default spec (WO-8.4) ----
// Turns a resolved parcel into a reasonable AnalysisInput so a visitor can jump
// straight from the map panel to a full report without the four-step wizard.
// The numbers are deliberately conservative defaults derived FROM the parcel's
// own published limits (it's "the most you could build here, roughly"), and the
// result page surfaces a banner inviting the user to refine them. Returns null
// when the parcel gives us no size basis at all — better no instant report than
// a fabricated one — and, since 2026-08-11, also when the parcel's own envelope
// is smaller than the smallest program this module proposes (see GFA_MIN). The
// panel then falls back to its "Start full analysis" CTA, where the user states
// the size and the verdict is about THEIR number.

import type { AnalysisInput, Use } from '../types/analysis'
import type { ParcelInfo } from '../types/parcel'
import { avgUnitGrossSqFt } from '../config/estimates'

// The smallest and largest DEFAULT PROGRAM this module will propose. Neither is
// a fact about any city's code — they bound what the tool volunteers on a
// visitor's behalf, nothing more. The two ends are not symmetric, and the
// asymmetry is the whole point (see the ceiling note at GFA_MAX):
//
// ⚠️ GFA_MIN IS A PRECONDITION, NOT A CLAMP (2026-08-11). It used to be applied
// with `Math.max`, which meant that on a parcel whose envelope was smaller than
// 1,000 sf the proposal was RAISED THROUGH the envelope — the tool proposing a
// building its own envelope forbids, then reporting the overage as the city's
// doing. Measured live on four sampled parcels: Atlanta RG-2 (envelope 303 sf)
// and C-1 (717) and Boston 2F-5000 (388) each published PROHIBITED, and Chicago
// RS-3 (envelope 956) published NEEDS_RELIEF with $514,780 and 22 months — a
// relief path, a cost and a schedule for a program that cannot be built here.
// Not one of those verdicts was about the parcel; all four were about this
// constant.
const GFA_MIN = 1000
// The ceiling is a DIFFERENT QUESTION and was left alone deliberately — measured,
// not assumed. Across the 575-parcel live sample, 149 parcels sat on it and
// **zero** of them proposed more floor area than their envelope allowed; on the
// 31 with a resolved envelope the envelope was larger than 200,000 sf in every
// case. So the ceiling only ever proposes LESS than the code permits, which is
// the opposite direction from the floor: it cannot produce a verdict the code
// forbids, only a smaller program than the parcel would carry. Removing it is
// also not obviously an improvement — NYC's R4 sample parcel has a 12.25M sf
// envelope, and an uncapped default would publish a ~10M sf, 8,000-unit program
// nobody proposed. What the ceiling DOES do is choose a program on large lots,
// and on four sampled parcels that program came in under the existing housing
// and scored PROHIBITED on no-net-loss. That verdict is true of the program
// proposed; it is not the same defect as the floor and is not fixed here.
const GFA_MAX = 200000

/** Round to the nearest 500 and bound into the band this module proposes in.
 *
 *  `ceilingSqFt` is a LIMIT THE PARCEL IMPOSES (the by-right floor-area
 *  envelope) and it wins over everything here, including the rounding: rounding
 *  to the nearest 500 can itself cross an envelope that sits just under a
 *  multiple of 500 (an envelope of 1,480 sf takes 0.85 → 1,258 → 1,500), so the
 *  floor is not the only way this function could exceed its own input. Pass null
 *  where no envelope resolved — a lot area is an assumption, not a ceiling, and
 *  capping against it would silently convert one into the other. */
function quantizeGfa(raw: number, ceilingSqFt: number | null): number {
  const rounded = Math.round(raw / 500) * 500
  const banded = Math.min(GFA_MAX, Math.max(GFA_MIN, rounded))
  return ceilingSqFt != null ? Math.min(banded, Math.floor(ceilingSqFt)) : banded
}

/** Pick the default use: residential if the district allows it, else mixed,
 *  else whatever the district lists first, else residential as a last resort. */
function pickUse(allowedUses: string[] | null | undefined): Use {
  const uses = allowedUses ?? []
  if (uses.includes('residential')) return 'residential'
  if (uses.includes('mixed')) return 'mixed'
  const first = uses[0]
  if (first === 'residential' || first === 'commercial' || first === 'mixed' || first === 'institutional') {
    return first
  }
  return 'residential'
}

export function buildDefaultSpec(parcel: ParcelInfo, city: string): AnalysisInput | null {
  const env = parcel.envelope
  const use = pickUse(env?.allowedUses)

  // GFA basis, in priority order: 85% of the by-right floor-area envelope
  // (never more than that envelope, and nothing at all when the envelope is
  // smaller than the smallest program this module proposes), then a
  // 1.0-FAR-equivalent fall back on lot size, then nothing.
  //
  // ⚠️ DEFECT 7 — the fallback is an ASSUMPTION, not a code limit, and it must
  // travel labelled. `lot.sizeSqFt * 1.0` is an unsourced FAR-1.0 guess. It
  // fires wherever the envelope yields no floor area, which the 2026-08-04
  // sweep found is MOST parcels in several cities — and for a reason that
  // matters: San Diego, San Jose and Nashville all have real FARs in their
  // zoning codes that simply are not published in GIS. So this path is usually
  // covering a MISSING LOOKUP, not a district that genuinely has no FAR.
  //
  // Emitting it unlabelled let a guess reach cost, unit counts and impact fees
  // indistinguishable from a code-derived number. `gfaBasis` makes the two
  // separable downstream so the UI can disclose it. Deliberately NOT removed:
  // returning null here would leave those parcels with no estimate at all, and
  // a disclosed assumption beats both a silent one and a blank screen.
  // ⚠️ FAIL-CLOSED AUDIT, 2026-08-05. This function used to collapse two states
  // the envelope had carefully separated. `farBasis: 'unconstrained'` (the code
  // affirmatively imposes no FAR — SF §124(b), Denver's form-based DZC) and
  // `farBasis: null` (we could not resolve one) BOTH yield a null floor area,
  // so both fell to the same `lot * 1.0` guess and both reported
  // 'assumed-far-1.0'. Rule 5's distinction was built one layer up and thrown
  // away here.
  //
  // They are now separable downstream. Five defect classes this session ran in
  // the permissive direction, and the reason is structural: "we did not find a
  // constraint" naturally defaults to "unconstrained".
  let gfa: number | null = null
  let gfaBasis: 'envelope' | 'assumed-unconstrained' | 'assumed-planned-development' | 'assumed-far-1.0' | null = null
  if (env && env.maxFloorAreaSqFt != null && env.maxFloorAreaSqFt > 0) {
    // The envelope is the constraint, so it bounds the proposal — a default that
    // does not fit inside it is not a default, it is a program we invented and
    // then graded the city against. Where the envelope cannot hold even the
    // smallest program this module proposes, there is no honest number to offer,
    // so we decline outright rather than shrink into a size whose unit count
    // (`Math.max(1, …)` invents a dwelling that does not fit) and $/sf are both
    // fictions. The panel then shows its "Start full analysis" CTA and the user
    // states the size, which is the one number we have no business guessing here.
    if (env.maxFloorAreaSqFt < GFA_MIN) return null
    gfa = quantizeGfa(env.maxFloorAreaSqFt * 0.85, env.maxFloorAreaSqFt)
    gfaBasis = 'envelope'
  } else if (parcel.lot.sizeSqFt != null && parcel.lot.sizeSqFt > 0) {
    // NO CEILING ON THIS BRANCH, DELIBERATELY. Nothing resolved a floor-area
    // limit here, so there is nothing to clamp against: `lot × 1.0` is the
    // labelled placeholder described below, and capping it by the lot area would
    // dress an assumption up as a limit the code never stated. The band applies
    // as it always has, and `gfaBasis` carries the disclosure downstream.
    gfa = quantizeGfa(parcel.lot.sizeSqFt * 1.0, null)
    // The code SAYS no FAR binds here, so a lot-area stand-in is a stated
    // absence with a placeholder size — weaker than an envelope, stronger than
    // a guess made in ignorance.
    gfaBasis =
      env?.farBasis === 'unconstrained'
        ? 'assumed-unconstrained'
        : // A planned-development parcel HAS a floor-area limit; it is in the
          // ordinance that created the district. The stand-in is just as much a
          // placeholder as the other two, but the reason is different and the
          // reader can act on it — there is a specific document to go and read.
          env?.farBasis === 'planned-development'
          ? 'assumed-planned-development'
          : 'assumed-far-1.0'
  }
  if (gfa === null || gfaBasis === null) return null

  // Units only mean something for residential/mixed projects. Mixed buildings
  // give roughly 85% of their floor area to the residential program.
  let units: number | undefined
  if (use === 'residential' || use === 'mixed') {
    const residentialGfa = gfa * (use === 'mixed' ? 0.85 : 1)
    units = Math.max(1, Math.floor(residentialGfa / avgUnitGrossSqFt))
  }

  const stories = env?.maxStories != null ? Math.min(env.maxStories, 6) : undefined

  // coordinates are GeoJSON [lng, lat].
  const [lng, lat] = parcel.coordinates

  return {
    parcelId: parcel.parcelId,
    city,
    projectType: 'new',
    funding: 'private',
    lat,
    lng,
    use,
    gfa,
    gfaBasis,
    units,
    stories,
  }
}
