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
  let gfa: number | null = null
  if (env && env.maxFloorAreaSqFt != null && env.maxFloorAreaSqFt > 0) {
    gfa = quantizeGfa(env.maxFloorAreaSqFt * 0.85)
  } else if (parcel.lot.sizeSqFt != null && parcel.lot.sizeSqFt > 0) {
    gfa = quantizeGfa(parcel.lot.sizeSqFt * 1.0)
  }
  if (gfa === null) return null

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
    units,
    stories,
  }
}
