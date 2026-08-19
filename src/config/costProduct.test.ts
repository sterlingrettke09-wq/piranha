import { describe, it, expect } from 'vitest'
import {
  costPerSqFtByProduct,
  costProductFor,
  costRateFor,
  costPerSqFtByUse,
  type CostProduct,
} from './estimates'
import { buildingTier } from '../../netlify/functions/lib/timeline'

// RE-KEYING BY PRODUCT TYPE IS THE CHANGE THAT MAKES THESE NUMBERS CHECKABLE.
// `Use` distinguishes residential/commercial/mixed/institutional and says nothing
// about product; every published source — Cumming, RSMeans, NAHB — is organised
// by product. A constant keyed differently from every source that could validate
// it can only be validated by accident.

describe('the tier union matches the classifier it mirrors', () => {
  it('buildingTier returns only members this file names', () => {
    // The union is repeated rather than imported (src/config cannot depend on
    // netlify/). Pinned so the duplication cannot drift — the failure mode this
    // repo keeps finding (a "mirrors X" comment nobody checks).
    const seen = new Set([
      buildingTier({ use: 'residential', units: 1 } as never),
      buildingTier({ use: 'residential', units: 3 } as never),
      buildingTier({ use: 'residential', units: 40 } as never),
    ])
    for (const t of seen) expect(['single', 'multi', 'apartment']).toContain(t)
    expect(seen.size, 'the three tiers must be reachable').toBe(3)
  })
})

describe('a detached house and a mid-rise are no longer the same product', () => {
  it('residential splits three ways by tier', () => {
    expect(costProductFor('residential', 'single')).toBe('detached')
    expect(costProductFor('residential', 'multi')).toBe('small-multi')
    expect(costProductFor('residential', 'apartment')).toBe('apartment')
  })

  it('and the non-residential uses map straight through', () => {
    expect(costProductFor('commercial', null)).toBe('office')
    expect(costProductFor('institutional', null)).toBe('institutional')
    expect(costProductFor('mixed', null)).toBe('mixed')
  })

  it('an unresolved tier produces NO rate, because the choice is the answer', () => {
    // ⚠️ THIS ASSERTION INVERTED 2026-08-19 and the reason is worth keeping.
    // While detached and apartment carried the same 340, the default cost
    // nothing and the test asserted which product it landed on. NAHB put
    // detached at 152 against apartment's 340 — 2.2x — so every default is now
    // wrong in a direction, and understating is the one that flatters a cost
    // estimate. A test that passed for a year did so only because the two
    // numbers happened to be equal.
    const r = costRateFor('residential', null)
    expect(r.kind).toBe('unsourced')
    if (r.kind !== 'rate') expect(r.reason).toMatch(/could not be determined/i)
  })
})

describe('every product states its provenance, and two state no rate', () => {
  it('the corroborated three carry a scope-matched source', () => {
    for (const p of ['apartment', 'office', 'institutional'] as CostProduct[]) {
      const r = costPerSqFtByProduct[p]
      expect(r.kind, p).toBe('rate')
      if (r.kind === 'rate') {
        expect(r.provenance, p).toBe('corroborated')
        expect(r.source, p).toMatch(/Cumming/)
        expect(r.perSqFt, p).toBeGreaterThan(0)
      }
    }
  })

  it('detached is SOURCED from NAHB, scope-matched, and no longer the apartment rate', () => {
    const r = costPerSqFtByProduct.detached
    expect(r.kind).toBe('rate')
    if (r.kind === 'rate') {
      expect(r.provenance).toBe('corroborated')
      expect(r.source).toMatch(/NAHB/)
      // The scope match is the load-bearing part: NAHB's published $161.77/sf
      // includes permit fees, impact fees, water/sewer and A&E, all of which
      // this model bills separately. Billing them twice is the failure mode.
      expect(r.source).toMatch(/permit fees|architecture/i)
      expect(r.perSqFt).toBe(152)
      // and it is emphatically NOT the old use-keyed residential rate
      expect(r.perSqFt).not.toBe(costPerSqFtByUse.residential)
    }
  })

  it('detached and apartment are now different numbers, which was the point', () => {
    const d = costPerSqFtByProduct.detached
    const a = costPerSqFtByProduct.apartment
    if (d.kind === 'rate' && a.kind === 'rate') {
      expect(d.perSqFt).toBeLessThan(a.perSqFt)
      expect(a.perSqFt / d.perSqFt).toBeGreaterThan(2)
    }
  })

  it('2-4 unit is UNSOURCED and mixed is UNPRICED, and they are different states', () => {
    // Rule 5: two absences with different causes must not render the same. One
    // is "no source covers this product"; the other is "no source publishes this
    // quantity at all". Interpolating either would be an invented conversion.
    expect(costPerSqFtByProduct['small-multi'].kind).toBe('unsourced')
    expect(costPerSqFtByProduct.mixed.kind).toBe('unpriced')
    expect(costPerSqFtByProduct['small-multi'].kind).not.toBe(costPerSqFtByProduct.mixed.kind)
    for (const p of ['small-multi', 'mixed'] as CostProduct[]) {
      const r = costPerSqFtByProduct[p]
      expect('perSqFt' in r, `${p} must not carry a number`).toBe(false)
      if (r.kind !== 'rate') expect(r.reason.length, p).toBeGreaterThan(40)
    }
  })

  it('no product is silently absent — the map is exhaustive', () => {
    const all: CostProduct[] = ['detached', 'small-multi', 'apartment', 'office', 'institutional', 'mixed']
    for (const p of all) expect(costPerSqFtByProduct[p], p).toBeDefined()
    expect(Object.keys(costPerSqFtByProduct).sort()).toEqual([...all].sort())
  })
})
