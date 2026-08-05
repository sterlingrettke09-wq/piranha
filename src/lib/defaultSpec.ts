// ---- Instant-report default spec (WO-8.4) ----
// Turns a resolved parcel into a reasonable AnalysisInput so a visitor can jump
// straight from the map panel to a full report without the four-step wizard.
// The numbers are deliberately conservative defaults derived FROM the parcel's
// own published limits (it's "the most you could build here, roughly"), and the
// result page surfaces a banner inviting the user to refine them. Returns null
// when the parcel gives us no size basis at all — better no instant report than
// a fabricated one.

import type { AnalysisInput, Use } from '../types/analysis'
import type { ParcelInfo } from '../types/parcel'
import { avgUnitGrossSqFt } from '../config/estimates'

const GFA_MIN = 1000
const GFA_MAX = 200000

/** Round to the nearest 500, then clamp into the sane GFA band. */
function quantizeGfa(raw: number): number {
  const rounded = Math.round(raw / 500) * 500
  return Math.min(GFA_MAX, Math.max(GFA_MIN, rounded))
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

  // GFA basis, in priority order: 85% of the by-right floor-area envelope, then
  // a 1.0-FAR-equivalent fall back on lot size, then nothing.
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
  let gfaBasis: 'envelope' | 'assumed-unconstrained' | 'assumed-far-1.0' | null = null
  if (env && env.maxFloorAreaSqFt != null && env.maxFloorAreaSqFt > 0) {
    gfa = quantizeGfa(env.maxFloorAreaSqFt * 0.85)
    gfaBasis = 'envelope'
  } else if (parcel.lot.sizeSqFt != null && parcel.lot.sizeSqFt > 0) {
    gfa = quantizeGfa(parcel.lot.sizeSqFt * 1.0)
    // The code SAYS no FAR binds here, so a lot-area stand-in is a stated
    // absence with a placeholder size — weaker than an envelope, stronger than
    // a guess made in ignorance.
    gfaBasis = env?.farBasis === 'unconstrained' ? 'assumed-unconstrained' : 'assumed-far-1.0'
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
