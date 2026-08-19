import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import { costPerSqFtByProduct } from '../../../src/config/estimates'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

const FEAS = { overall: 'AS_OF_RIGHT', path: 'as_of_right', checks: [] } as unknown as Feasibility
const project = (p: Partial<AnalysisInput>): AnalysisInput =>
  ({ city: 'philadelphia', use: 'residential', gfa: 10_000, units: 3, projectType: 'new', ...p }) as AnalysisInput

// A MISSING RATE MUST REMOVE LINES, NEVER ZERO THEM.
//
// Four of the seven cost lines are functions of construction value. When no
// published rate covers a product they cannot be produced — and `?? 0` on any of
// them turns a partial sum into a confident total, which is the failure this
// whole change exists to prevent.

describe('what a missing hard cost does downstream', () => {
  const noRate = estimateCost(project({ units: 3 }), FEAS) // 2–4 unit → unsourced
  const mixed = estimateCost(project({ use: 'mixed', units: 30 }), FEAS) // → unpriced
  const priced = estimateCost(project({ units: 40 }), FEAS) // apartment → corroborated

  it('the value-derived lines go null, not zero', () => {
    for (const c of [noRate.costs, mixed.costs]) {
      expect(c.hard).toBeNull()
      expect(c.soft).toBeNull()
      expect(c.permit, 'the flat base fee alone is not "the permit fee"').toBeNull()
      expect(c.total).toBeNull()
    }
  })

  it('and nothing rounds a missing figure to 0', () => {
    // The specific coercion: `null + n` is `n` in JS, and Math.round(null) is 0.
    // A zero here renders as free, which is worse than rendering as unknown.
    for (const c of [noRate.costs, mixed.costs]) {
      for (const v of [c.hard, c.soft, c.permit, c.total]) expect(v).not.toBe(0)
    }
  })

  it('but the per-square-foot lines survive, because they never touch that value', () => {
    // Demolition is sq ft x rate x city index; linkage is $/sq ft x area. Neither
    // passes through construction value, so both are still knowable.
    const demo = estimateCost(project({ units: 3 }), FEAS, { demolitionSqFt: 4_000 })
    expect(demo.costs.demolition).toBeGreaterThan(0)
    expect(demo.costs.hard).toBeNull()
  })

  it('the TIMELINE is untouched — it never depended on cost', () => {
    // ⚠️ THE FIRST VERSION OF THIS FIXTURE USED path: 'by-right', WHICH IS NOT A
    // PATH. timelineMonthsByPath returned undefined for both sides, so the
    // equality assertion passed comparing undefined to undefined — a check that
    // agreed about nothing. Only the > 0 assertion caught it. Pinned as a real
    // number so the comparison has something to compare.
    expect(priced.timeline.months, 'the fixture path must be a real one').toBeGreaterThan(0)
    expect(noRate.timeline.months).toBe(priced.timeline.months)
    expect(mixed.timeline.path).toBe(priced.timeline.path)
  })

  it('a percentage-of-construction-value tax is unknown, not zero', () => {
    // Philadelphia levies 1% of construction cost on residential. With no
    // construction value there is no 1% of it — and reporting 0 would say the
    // city charges nothing.
    expect(mixed.costs.impact).toBeNull()
  })

  it('a priced product is unaffected by any of this', () => {
    expect(priced.costs.hard).not.toBeNull()
    expect(priced.costs.total).not.toBeNull()
    expect(priced.costUnavailable).toBeUndefined()
  })
})

describe('the two unavailable states do not share a sentence', () => {
  it('unsourced names the product gap; unpriced names the missing quantity', () => {
    const unsourced = estimateCost(project({ units: 3 }), FEAS).costUnavailable!
    const unpriced = estimateCost(project({ use: 'mixed', units: 30 }), FEAS).costUnavailable!
    expect(unsourced.kind).toBe('unsourced')
    expect(unpriced.kind).toBe('unpriced')
    expect(unsourced.product).toBe('small-multi')
    expect(unpriced.product).toBe('mixed')
    // The requirement: not one shared string with the product swapped in.
    expect(unsourced.reason).not.toBe(unpriced.reason)
    expect(unsourced.reason).toMatch(/2–4 unit|NAHB|Cumming/)
    expect(unpriced.reason).toMatch(/mixed-use|blend/i)
  })

  it('and neither carries a number to be mistaken for a rate', () => {
    for (const p of ['small-multi', 'mixed'] as const) {
      expect('perSqFt' in costPerSqFtByProduct[p]).toBe(false)
    }
  })
})
