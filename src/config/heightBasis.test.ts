import { describe, it, expect } from 'vitest'
import { maxHeightValue, maxFarValue } from '../components/boston/result/siteFactValues'
import { computeEnvelope } from '../../netlify/functions/lib/envelope'
import type { AnalysisResult } from '../types/analysis'
import type { ParcelInfo } from '../types/parcel'

type Parcel = AnalysisResult['parcel']

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
    //
    // ⚠️ REWRITTEN 2026-08-22 FROM A SOURCE GREP TO A BEHAVIOUR TEST. It used to
    // match `/heightBasis === 'unconstrained'/` in the component source and count
    // `?` characters to compare FAR's richness against height's. Both assertions
    // passed, and both pinned the SHAPE of a ternary chain rather than what the
    // reader sees — so replacing that chain with an exhaustive switch, which is
    // strictly better and makes a new state a compile error, turned this red.
    //
    // A test that goes red for an improvement is defending the thing it was
    // written to catch (rule 15). What it always meant was "the four states must
    // not render the same sentence", and that is now what it says.
    const cell = (env: Partial<NonNullable<Parcel['envelope']>>) =>
      maxHeightValue({ maxHeightFt: null, envelope: env } as unknown as Parcel).value
    const rendered = [
      maxHeightValue({ maxHeightFt: 65, envelope: { heightBasis: 'district' } } as unknown as Parcel).value,
      cell({ heightBasis: 'planned-development' }),
      cell({ heightBasis: 'unconstrained' }),
      cell({ heightBasis: null }),
    ]
    expect(new Set(rendered).size, `collapsed: ${rendered.join(' | ')}`).toBe(4)
    expect(rendered[2]).toMatch(/No height limit applies/)
    // Only the genuine gap may use the gap wording.
    expect(rendered.filter((r) => /Not in public data/.test(r))).toEqual([rendered[3]])

    // FAR and height must offer at least as many distinct states as each other;
    // a two-state height beside a four-state FAR is how this shipped wrong.
    const farStates = new Set(
      (['unconstrained', 'planned-development', 'basis-unavailable', 'basis-elective', null] as const).map(
        (b) => maxFarValue({ maxFAR: null, envelope: { farBasis: b } } as unknown as Parcel).value,
      ),
    )
    expect(farStates.size).toBe(5)
    expect(new Set(rendered).size).toBeGreaterThanOrEqual(farStates.size - 1)
  })
})
