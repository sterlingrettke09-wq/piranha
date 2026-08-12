import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import { costPerSqFtByUse, cityCostIndex, heightCostFactor, MIXED_RESIDENTIAL_SHARE } from '../../../src/config/estimates'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { Feasibility } from './feasibility'

const RES = costPerSqFtByUse.residential // national $/sf, sourced

// The base fixture carries a REAL city, because production always has one:
// analyze.ts resolves `city` as `q.city ?? 'boston'`, so no request reaches
// estimateCost without a slug. This fixture used to omit `city` entirely (the
// type requires it; nothing typechecked this file), which made every
// expectation below run at `cityCostIndex[undefined] ?? 1.0` — an index no
// production request can produce. Boston's 1.14 is now carried explicitly in
// the expectations rather than silently assumed away.
const CITY = 'boston'
const IDX = cityCostIndex[CITY]

const project: AnalysisInput = {
  parcelId: 'p1',
  city: CITY,
  projectType: 'new',
  funding: 'private',
  lat: 42.36,
  lng: -71.06,
  use: 'residential',
  gfa: 10000,
}
const asOfRight: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
const variance: Feasibility = { overall: 'NEEDS_RELIEF', checks: [], path: 'variance' }

describe('estimateCost', () => {
  it('computes hard cost as gfa x $/sf for the use', () => {
    expect(estimateCost(project, asOfRight).costs.hard).toBe(Math.round(10_000 * RES * IDX))
  })

  it('scales hard cost by the city construction index', () => {
    const bos = estimateCost({ ...project, city: 'boston' }, asOfRight).costs.hard
    const nyc = estimateCost({ ...project, city: 'nyc' }, asOfRight).costs.hard
    const chi = estimateCost({ ...project, city: 'chicago' }, asOfRight).costs.hard
    const dc = estimateCost({ ...project, city: 'dc' }, asOfRight).costs.hard
    // Per the RSMeans City Cost Index: NYC > Chicago (unionized trades) > Boston,
    // and DC's construction is below the national average (cheap labor pool).
    expect(nyc).toBeGreaterThan(chi)
    expect(chi).toBeGreaterThan(bos)
    expect(bos).toBeGreaterThan(dc)
    expect(nyc).toBe(Math.round(10000 * RES * cityCostIndex.nyc))
    expect(chi).toBe(Math.round(10000 * RES * cityCostIndex.chicago))
  })

  it('applies a height premium to taller buildings', () => {
    const low = estimateCost({ ...project, stories: 3 }, asOfRight).costs.hard
    const high = estimateCost({ ...project, stories: 15 }, asOfRight).costs.hard
    expect(high).toBeGreaterThan(low)
    expect(high).toBe(Math.round(10000 * RES * IDX * heightCostFactor(15)))
  })

  it('computes soft cost as a fraction of hard', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.soft).toBe(Math.round(c.hard * 0.25))
  })

  it('total is hard + soft + permit', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.demolition).toBe(0)
    expect(c.total).toBe(c.hard + c.soft + c.permit + c.demolition)
  })

  it('adds a demolition cost scaled to the existing building being torn down', () => {
    const noDemo = estimateCost(project, asOfRight)
    const withDemo = estimateCost(project, asOfRight, { demolitionSqFt: 20000 })
    expect(noDemo.costs.demolition).toBe(0)
    expect(withDemo.costs.demolition).toBeGreaterThan(0)
    expect(withDemo.costs.total).toBe(
      withDemo.costs.hard + withDemo.costs.soft + withDemo.costs.permit + withDemo.costs.demolition,
    )
    expect(withDemo.costs.total).toBeGreaterThan(noDemo.costs.total)
  })

  it('prices renovations & changes-of-use below an identical ground-up build', () => {
    const base = estimateCost({ ...project, projectType: 'new' }, asOfRight).costs.hard
    for (const pt of ['change_of_use', 'addition'] as const) {
      const scoped = estimateCost({ ...project, projectType: pt }, asOfRight).costs.hard
      expect(scoped).toBeLessThan(base)
    }
  })

  it('prices an ADU at per-sf parity with new build (NOT a discount)', () => {
    // Terner Center: ADUs run ~$250/sf — equal-or-more than a house per sf,
    // because fixed costs (foundation, utilities, kitchen/bath) hit a tiny area.
    const base = estimateCost({ ...project, projectType: 'new' }, asOfRight).costs.hard
    const adu = estimateCost({ ...project, projectType: 'adu' }, asOfRight).costs.hard
    expect(adu).toBe(base)
  })

  it('adds a variance filing fee and a longer timeline on the variance path', () => {
    const aor = estimateCost(project, asOfRight)
    const v = estimateCost(project, variance)
    expect(v.costs.permit).toBeGreaterThan(aor.costs.permit)
    expect(v.timeline.months).toBeGreaterThan(aor.timeline.months)
    expect(v.timeline.path).toBe('variance')
  })
})

// WO-5.6: the demo rate interpolates linearly between (5k sf, $10) and
// (20k sf, $18) — the old step tiers made one square foot at the 20k boundary
// worth $120,000, an instant credibility hit with any real developer.
describe('demolition rate (interpolated)', () => {
  const demoRate = (sf: number) => {
    const c = estimateCost(project, asOfRight, { demolitionSqFt: sf }).costs.demolition
    return c / sf / IDX // demolition is scaled by the city index too — divide it back out
  }
  it('small (≤5,000 sf) teardowns run $10/sf', () => {
    expect(demoRate(4_999)).toBeCloseTo(10, 2)
    expect(demoRate(5_000)).toBeCloseTo(10, 2)
  })
  it('interpolates between the bounds (12,500 sf → $14/sf)', () => {
    expect(demoRate(12_500)).toBeCloseTo(14, 2)
  })
  it('large (≥20,000 sf) runs $18/sf with no boundary cliff', () => {
    expect(demoRate(20_000)).toBeCloseTo(18, 2)
    const below = estimateCost(project, asOfRight, { demolitionSqFt: 19_999 }).costs.demolition
    const above = estimateCost(project, asOfRight, { demolitionSqFt: 20_000 }).costs.demolition
    expect(above - below).toBeLessThan(100) // continuous, not a $120k step
  })
})

describe('impact fees per city', () => {
  // Fee area is passed the way production passes it — as OVERLAYS, so the
  // resolution state travels with the value. `feeArea: 'High'` and "the layer
  // failed" used to be the same argument here.
  const overlays = (o: Partial<ParcelInfo['overlays']> = {}): ParcelInfo['overlays'] => ({
    historicDistrict: null,
    floodZone: null,
    ...o,
  })
  const at = (over: Partial<AnalysisInput>, feeOverlays?: Partial<ParcelInfo['overlays']>) =>
    estimateCost({ ...project, ...over }, asOfRight, feeOverlays ? { overlays: overlays(feeOverlays) } : {})

  it('Boston: commercial ≥50k sf pays linkage; smaller and residential do not', () => {
    expect(at({ city: 'boston', use: 'commercial', gfa: 50_000 }).costs.impact).toBe(
      Math.round(23.09 * 50_000),
    )
    expect(at({ city: 'boston', use: 'commercial', gfa: 49_999 }).costs.impact).toBe(0)
    expect(at({ city: 'boston', use: 'residential', gfa: 80_000 }).costs.impact).toBe(0)
  })

  it('LA: residential always pays the Medium-tier rate; nonres only at ≥15k sf', () => {
    // AHLF flattened to the published Medium market-area rate (eff. 7/1/2025):
    // residential $12.90/sf, nonresidential $5.16/sf.
    expect(at({ city: 'la', use: 'residential', gfa: 10_000 }).costs.impact).toBe(Math.round(12.9 * 10_000))
    expect(at({ city: 'la', use: 'commercial', gfa: 15_000 }).costs.impact).toBe(Math.round(5.16 * 15_000))
    expect(at({ city: 'la', use: 'commercial', gfa: 14_999 }).costs.impact).toBe(0)
  })

  it('Denver: residential <10 units pays $5.12/sf; 10+ units pays none (inclusionary mandate); commercial varies by EHA area', () => {
    // Rates per the Denver CPD EHA schedule effective 7/1/2026 (annual CPI-U).
    expect(at({ city: 'denver', use: 'residential', gfa: 8_000, units: 4 }).costs.impact).toBe(Math.round(5.12 * 8_000))
    expect(at({ city: 'denver', use: 'residential', gfa: 80_000, units: 60 }).costs.impact).toBe(0)
    // WO-5.6: units omitted → tier unknowable → informational note, not a charge.
    const unknown = at({ city: 'denver', use: 'residential', gfa: 8_000 })
    expect(unknown.costs.impact).toBe(0)
    expect(unknown.impactNote).toMatch(/unit count needed/)
    expect(at({ city: 'denver', use: 'commercial', gfa: 10_000 }, { feeArea: 'High' }).costs.impact).toBe(Math.round(9.21 * 10_000))
    expect(at({ city: 'denver', use: 'commercial', gfa: 10_000 }, { feeArea: 'Typical' }).costs.impact).toBe(Math.round(6.14 * 10_000))
  })

  it('Philadelphia: mandatory 1% Development Impact Tax on residential construction', () => {
    // Phila. Code Ch. 19-4400 — 1% of construction cost, residential only,
    // over $15,000 of value. Asserted as a RELATIONSHIP to hard cost so the
    // expectation survives future cost-index tuning.
    const res = at({ city: 'philadelphia', use: 'residential', gfa: 6_000, units: 4 })
    expect(res.costs.impact).toBe(Math.round(res.costs.hard * 0.01))
    expect(res.impactNote).toMatch(/Development Impact Tax/i)

    // Non-residential is exempt.
    const com = at({ city: 'philadelphia', use: 'commercial', gfa: 40_000 })
    expect(com.costs.impact).toBe(0)

    // Mixed-use is taxed on the residential share only, not the whole building.
    const mix = at({ city: 'philadelphia', use: 'mixed', gfa: 40_000, units: 30 })
    expect(mix.costs.impact).toBe(Math.round(mix.costs.hard * MIXED_RESIDENTIAL_SHARE * 0.01))

    // Below the $15,000 construction-value floor, no tax.
    const tiny = at({ city: 'philadelphia', use: 'residential', gfa: 20 })
    expect(tiny.costs.impact).toBe(0)
  })

  it('Seattle and SF fees are informational (applied:false): note set, $0 in total', () => {
    const sea = at({ city: 'seattle', use: 'residential', gfa: 20_000 }, { feeArea: 'High Areas' })
    expect(sea.costs.impact).toBe(0)
    expect(sea.impactNote).toMatch(/Seattle MHA/)
    const sf = at({ city: 'sf', use: 'commercial', gfa: 60_000 })
    expect(sf.costs.impact).toBe(0)
    if (sf.impactNote) expect(sf.impactNote).toMatch(/not included/)
  })

  it('cities with no codified fee produce neither a charge nor a note', () => {
    const chi = at({ city: 'chicago', use: 'residential', gfa: 20_000 })
    expect(chi.costs.impact).toBe(0)
    expect(chi.impactNote).toBeUndefined()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // A FAILED FEE-AREA LOOKUP IS NOT AN AREA (CLAUDE.md rules 4 and 5).
  //
  // Measured 2026-08-12 at the analyze handler with only Denver's EHA layer
  // faulted, 100,000 sf commercial on a D-C parcel at Union Station whose live
  // market area is "High": impact $921,000 → $614,000, total $45,638,500 →
  // $45,331,500, `applied: true`, no note. The understatement was not the whole
  // problem — nothing in the response said a lookup had failed.
  //
  // These cases pin all THREE states, so the fix cannot pass by making
  // everything unpriced: a resolved area is still billed to the cent.
  describe('a fee-area layer that did not answer', () => {
    const DEN = { city: 'denver', use: 'commercial' as const, gfa: 100_000 }

    it('Denver: an unresolved EHA read leaves the fee UNPRICED and disclosed, not billed at Typical', () => {
      const high = at(DEN, { feeArea: 'High' })
      const typical = at(DEN, { feeArea: 'Typical' })
      const failed = at(DEN, { unresolved: ['feeArea'] })

      // The measured control values, to the dollar.
      expect(high.costs.impact).toBe(921_000)
      expect(typical.costs.impact).toBe(614_000)

      // The defect, stated as the assertion that would have failed: a failed
      // read must NOT produce the Typical charge.
      expect(failed.costs.impact).not.toBe(typical.costs.impact)
      expect(failed.costs.impact).toBe(0)
      expect(failed.costs.total).toBe(typical.costs.total - 614_000)

      // …and the gap is disclosed, naming both rates, with NO "roughly $X/sq ft"
      // beside it — that figure would re-publish the guess the label withdraws.
      expect(failed.impactNote).toMatch(/didn’t answer/)
      expect(failed.impactNote).toMatch(/\$6\.14/)
      expect(failed.impactNote).toMatch(/\$9\.21/)
      expect(failed.impactNote).not.toMatch(/roughly \$/)
      expect(failed.impactNote).not.toMatch(/\(Typical market\)/)
    })

    it('Denver: an EHA read that ANSWERED with no area still bills Typical, and says so', () => {
      // Distinct values on the live layer are exactly {High, Typical} and both
      // polygons cover the city (probed 2026-08-12), so this is the
      // outside-the-mapped-areas case, not a failure. The dollars are
      // unchanged; only the label stops attributing "Typical" to the layer.
      const none = at(DEN, {})
      expect(none.costs.impact).toBe(614_000)
      expect(none.impactNote).toBeUndefined() // applied → in the total, no note
    })

    it('Seattle: an unresolved MHA read publishes the rate SPREAD, not the Medium midpoint', () => {
      // Measured on a Capitol Hill parcel: control resolved "High Areas" and
      // published "roughly $45/sq ft"; with the layer faulted the same line
      // said "$28/sq ft". Out of the total either way — the claim is the defect.
      const highArea = at({ city: 'seattle', use: 'residential', gfa: 20_000 }, { feeArea: 'High Areas' })
      const failed = at({ city: 'seattle', use: 'residential', gfa: 20_000 }, { unresolved: ['feeArea'] })
      expect(highArea.impactNote).toMatch(/roughly \$45\/sq ft/)
      expect(failed.costs.impact).toBe(0) // still out of the total
      expect(failed.impactNote).not.toMatch(/roughly \$28\/sq ft/)
      expect(failed.impactNote).toMatch(/didn’t answer/)
      expect(failed.impactNote).toMatch(/\$10\.78–\$50\.46/)
    })

    it('a city whose fee ignores fee area is unmoved by an unresolved lookup', () => {
      // Non-empty control on the other side of the change: marking `feeArea`
      // unresolved must not become a general "charge nothing" switch.
      const a = at({ city: 'boston', use: 'commercial', gfa: 60_000 })
      const b = at({ city: 'boston', use: 'commercial', gfa: 60_000 }, { unresolved: ['feeArea'] })
      expect(a.costs.impact).toBe(Math.round(23.09 * 60_000))
      expect(b.costs.impact).toBe(a.costs.impact)
      expect(b.costs.total).toBe(a.costs.total)
    })
  })
})
