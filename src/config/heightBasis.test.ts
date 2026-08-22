import { describe, it, expect } from 'vitest'
import { computeEnvelope } from '../../netlify/functions/lib/envelope'
import type { ParcelInfo } from '../types/parcel'
import SITEFACTS_SRC from '../components/boston/result/SiteFacts.tsx?raw'

const parcel = (zoning: Record<string, unknown>): ParcelInfo =>
  ({
    address: 'x',
    parcelId: 'x',
    coordinates: [0, 0],
    lot: { sizeSqFt: 5000 },
    zoning: { districtCode: 'X', subdistrict: null, article: null, allowedUses: ['residential'], ...zoning },
  }) as unknown as ParcelInfo

describe('⚠️ heightBasis — the companion farBasis had and height did not', () => {
  it('an unconstrained height is an ANSWER, not a gap', () => {
    // Atlanta SPI-4 Subarea 12: "Maximum Building Height (ft): None", resolved
    // with a citation. Sixteen Atlanta districts assert this, plus Dallas and
    // Charlotte. Before this field reached the screen they all rendered "Not in
    // public data" — the tool disclaiming knowledge it demonstrably has.
    const env = computeEnvelope(parcel({ maxHeightFt: null, maxFAR: 3.0, heightUnconstrained: true }), 'atlanta')
    expect(env.maxHeightFt).toBeNull()
    expect(env.heightBasis).toBe('unconstrained')
  })

  it('a plan-governed parcel is a THIRD state, and the plan flag wins', () => {
    // Ordering mirrors farBasis deliberately: a parcel governed by its own
    // ordinance HAS a height, it is simply not in the district table. That is a
    // different sentence from "no height limit applies".
    const env = computeEnvelope(parcel({ maxHeightFt: null, maxFAR: null, planGoverned: true }), 'denver')
    expect(env.heightBasis).toBe('planned-development')
    const both = computeEnvelope(
      parcel({ maxHeightFt: null, maxFAR: null, planGoverned: true, heightUnconstrained: true }),
      'denver',
    )
    expect(both.heightBasis).toBe('planned-development')
  })

  it('a stated figure is district, and an unexplained null stays null', () => {
    expect(computeEnvelope(parcel({ maxHeightFt: 65, maxFAR: 4.5 }), 'seattle').heightBasis).toBe('district')
    // ⚠️ The gap state must SURVIVE. Collapsing it into one of the answers would
    // be the same rule 5 failure pointed the other way — claiming knowledge we
    // do not have instead of disclaiming knowledge we do.
    expect(computeEnvelope(parcel({ maxHeightFt: null, maxFAR: null }), 'boston').heightBasis).toBeNull()
  })

  it('⚠️ all four states are DISTINCT — the point of the field', () => {
    const states = [
      computeEnvelope(parcel({ maxHeightFt: 65, maxFAR: 4.5 }), 'seattle').heightBasis,
      computeEnvelope(parcel({ maxHeightFt: null, maxFAR: null, planGoverned: true }), 'denver').heightBasis,
      computeEnvelope(parcel({ maxHeightFt: null, maxFAR: 3, heightUnconstrained: true }), 'atlanta').heightBasis,
      computeEnvelope(parcel({ maxHeightFt: null, maxFAR: null }), 'boston').heightBasis,
    ]
    expect(new Set(states).size).toBe(4)
  })

  it('⚠️ SiteFacts renders all four, matching FAR beside it', () => {
    // The field existing is not the same as the distinction arriving on screen —
    // that gap is exactly what this whole change closes, so it is asserted at the
    // render layer and not only at the engine.
    const i = SITEFACTS_SRC.indexOf("label: 'Max height'")
    expect(i).toBeGreaterThan(-1)
    const block = SITEFACTS_SRC.slice(i, i + 700)
    expect(block).toMatch(/heightBasis === 'unconstrained'/)
    expect(block).toMatch(/heightBasis === 'planned-development'/)
    expect(block).toMatch(/No height limit applies/)
    expect(block).toMatch(/Not in public data/)
    // FAR and height must now offer the same number of states; a two-state
    // height beside a four-state FAR is how this shipped wrong.
    const far = SITEFACTS_SRC.slice(SITEFACTS_SRC.indexOf("label: 'Max FAR'"), i)
    const count = (s: string) => (s.match(/\?/g) ?? []).length
    expect(count(block)).toBeGreaterThanOrEqual(count(far) - 1)
  })
})
