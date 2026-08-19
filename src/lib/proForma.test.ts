import { describe, it, expect } from 'vitest'
import { buildProForma, carryCost, summariseProForma, REVENUE_NEEDS, type CostSide } from './proForma'
import type { CostEstimate } from '../../netlify/functions/lib/cost'

const est = (o: Partial<CostSide['costs']> = {}, months = 24): CostSide => ({
  costs: {
    hard: 1_000_000, soft: 250_000, permit: 30_000, demolition: 20_000,
    impact: 50_000, total: 1_350_000, ...o,
  },
  timeline: { months },
})

// ⚠️ THE SERVER'S OWN TYPE MUST STILL FIT. `CostSide` is structural, so it could
// drift from `CostEstimate` without either side noticing until a caller broke.
// This is the compile-time check that they still line up.
const _serverFits = (e: CostEstimate): CostSide => e
void _serverFits

const opts = { units: 10, gfaSqFt: 13_000 }
const money = { annualRatePct: 10, loanAmount: 1_000_000 }

describe('carry cost', () => {
  it('is months × rate × loan, and reports BOTH drawdown conventions', () => {
    // A construction loan is not outstanding in full from day one, and picking
    // one convention silently would be inventing a drawdown schedule with a 2x
    // spread. 1,000,000 × 10% × 2 years = 200,000 at full balance.
    const c = carryCost(24, money)
    expect('fullBalance' in c).toBe(true)
    if (!('fullBalance' in c)) return
    expect(c.fullBalance).toBe(200_000)
    expect(c.averageBalance).toBe(100_000)
    expect(c.months).toBe(24)
  })

  it('scales with the timeline leg, which is the whole point of including it', () => {
    const short = carryCost(6, money)
    const long = carryCost(36, money)
    if (!('fullBalance' in short) || !('fullBalance' in long)) throw new Error('setup')
    expect(long.fullBalance / short.fullBalance).toBeCloseTo(6, 5)
  })

  it('⚠️ names WHICH input is missing rather than saying "incomplete"', () => {
    // So the UI can ask for exactly what it needs.
    const noRate = carryCost(24, { annualRatePct: null, loanAmount: 500_000 })
    expect('missing' in noRate && noRate.missing).toEqual(['annualRatePct'])
    const neither = carryCost(24, { annualRatePct: null, loanAmount: null })
    expect('missing' in neither && neither.missing).toEqual(['annualRatePct', 'loanAmount'])
    const noMonths = carryCost(0, money)
    expect('missing' in noMonths && noMonths.missing).toEqual(['months'])
  })

  it('and says the rate and loan are the caller\'s, not the tool\'s', () => {
    const c = carryCost(24, { annualRatePct: null, loanAmount: null })
    expect('detail' in c && c.detail).toMatch(/We do not supply either/)
    expect('detail' in c && c.detail).toMatch(/financing decision, not a fact about the parcel/)
  })

  it('⚠️ the SENTENCE names what is missing, not the pair', () => {
    // Caught by running it: with a rate supplied and no loan, the copy still read
    // "needs an interest rate and a loan amount", sending the reader back to a
    // field they had already filled. The `missing` array was precise and the
    // prose was not — and the prose is what people act on.
    const noLoan = carryCost(24, { annualRatePct: 8.5, loanAmount: null })
    expect('detail' in noLoan && noLoan.detail).toBe(
      'Carry cost needs a loan amount from you. We do not supply either — a rate is a market fact this tool does not carry, and a loan-to-cost ratio is a financing decision, not a fact about the parcel.',
    )
    const noRate = carryCost(24, { annualRatePct: null, loanAmount: 5 })
    expect('detail' in noRate && noRate.detail).toMatch(/^Carry cost needs an interest rate from you\./)
    const both = carryCost(24, { annualRatePct: null, loanAmount: null })
    expect('detail' in both && both.detail).toMatch(/^Carry cost needs an interest rate and a loan amount from you\./)
  })

  it('refuses a nonsensical rate or loan rather than computing from it', () => {
    expect('missing' in carryCost(24, { annualRatePct: -1, loanAmount: 500_000 })).toBe(true)
    expect('missing' in carryCost(24, { annualRatePct: 8, loanAmount: 0 })).toBe(true)
    expect('missing' in carryCost(24, { annualRatePct: NaN, loanAmount: 5 })).toBe(true)
  })

  it('accepts a zero rate, which is a real answer and not a missing one', () => {
    const c = carryCost(24, { annualRatePct: 0, loanAmount: 1_000_000 })
    expect('fullBalance' in c && c.fullBalance).toBe(0)
  })
})

describe('the total', () => {
  it('is construction + land + carry, as a range from the drawdown', () => {
    const p = buildProForma(est(), opts, { ...money, landCost: 400_000 })
    // 1,350,000 + 400,000 + 100,000 / 200,000
    expect(p.totalDevelopmentCost.low).toBe(1_850_000)
    expect(p.totalDevelopmentCost.high).toBe(1_950_000)
  })

  it('⚠️ is NULL when any component is, never a total with the gap defaulted to zero', () => {
    // `?? 0` is how a missing figure becomes free. The cost engine was rewritten
    // to avoid exactly this and the pro forma must not reintroduce it one layer up.
    const unpriced = buildProForma(est({ hard: null, soft: null, permit: null, impact: null, total: null }), opts, money)
    expect(unpriced.totalDevelopmentCost.low).toBeNull()
    expect(unpriced.totalDevelopmentCost.high).toBeNull()
    expect(unpriced.perUnit.low).toBeNull()
    expect(unpriced.perSqFt.low).toBeNull()
  })

  it('is null when carry cannot be computed, rather than silently excluding it', () => {
    const p = buildProForma(est(), opts, { annualRatePct: null, loanAmount: null })
    expect(p.totalDevelopmentCost.low).toBeNull()
    expect(summariseProForma(p)).toMatch(/carry needs an interest rate and a loan amount/)
  })

  it('is null when land is not supplied, and SAYS land is the reason', () => {
    // A "total development cost" that quietly omits land reads as complete, and
    // land is usually the largest line.
    const p = buildProForma(est(), opts, money)
    expect(p.totalDevelopmentCost.low).toBeNull()
    expect(p.land.amount).toBeNull()
    expect(p.land.note).toMatch(/assessed value is not a price/)
    expect(summariseProForma(p)).toMatch(/land is not included/)
  })
})

describe('per unit and per sq ft', () => {
  it('divide the same range by the same denominators', () => {
    const p = buildProForma(est(), opts, { ...money, landCost: 400_000 })
    expect(p.perUnit.low).toBe(185_000) // 1,850,000 / 10
    expect(p.perUnit.high).toBe(195_000)
    expect(p.perSqFt.low).toBe(142) // 1,850,000 / 13,000
    expect(p.perSqFt.gfa).toBe(13_000)
  })

  it('⚠️ returns null per-unit rather than dividing by one when no unit count exists', () => {
    // Dividing by a default of 1 would print the whole project cost as the cost
    // of a single home.
    const p = buildProForma(est(), { units: null, gfaSqFt: 13_000 }, { ...money, landCost: 400_000 })
    expect(p.perUnit.low).toBeNull()
    expect(p.perUnit.units).toBeNull()
    expect(p.perSqFt.low).not.toBeNull()
  })
})

describe('⚠️ the revenue side is a stated blank, not an omission', () => {
  it('is never computed, and says why in the answer itself', () => {
    const p = buildProForma(est(), opts, { ...money, landCost: 400_000 })
    expect(p.revenue.status).toBe('not-modelled')
    expect(p.revenue.detail).toMatch(/deliberate rather than unfinished/)
    expect(p.revenue.detail).toMatch(/looks sourced because everything around it is/)
  })

  it('names what the user must supply and what each unlocks', () => {
    // Listed so the omission is legible as a decision. A bare "revenue not
    // included" reads as a feature that has not shipped yet.
    expect(REVENUE_NEEDS.map((n) => n.unlocks)).toEqual([
      'gross revenue',
      'net operating income',
      'stabilised value, yield-on-cost and residual land value',
    ])
    const p = buildProForma(est(), opts, money)
    expect(p.revenue.needs).toHaveLength(3)
  })

  it('exposes no return metric as a FIELD', () => {
    // Scoped to keys, not to the whole JSON: the prose deliberately NAMES
    // yield-on-cost and cap rate as things it does not compute, and a scan of
    // values flagged its own disclosure. The assertion is about what the object
    // carries, which is what it always meant.
    const p = buildProForma(est(), opts, { ...money, landCost: 400_000 })
    const keys: string[] = []
    const walk = (o: unknown) => {
      if (o == null || typeof o !== 'object') return
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        keys.push(k.toLowerCase())
        walk(v)
      }
    }
    walk(p)
    expect(keys.length).toBeGreaterThan(20) // rule 20: an empty walk proves nothing
    for (const forbidden of ['irr', 'caprate', 'yield', 'noi', 'profit', 'margin', 'roi', 'revenue' + 'perunit']) {
      expect(keys.some((k) => k.includes(forbidden)), forbidden).toBe(false)
    }
  })
})

describe('the summary', () => {
  it('states the range and that it is the drawdown, not cost uncertainty', () => {
    // A range on a cost figure reads as "we are unsure what this costs". Here it
    // is one assumption with two endpoints, and the sentence has to say so.
    const p = buildProForma(est(), opts, { ...money, landCost: 400_000 })
    const s = summariseProForma(p)
    expect(s).toMatch(/\$1,850,000–\$1,950,000/)
    expect(s).toMatch(/drawdown assumption, not a cost uncertainty/)
    expect(s).toMatch(/before any revenue/)
  })

  it('collapses to one figure when the range does not apply', () => {
    const p = buildProForma(est(), opts, { annualRatePct: 0, loanAmount: 1_000_000, landCost: 400_000 })
    expect(summariseProForma(p)).toMatch(/^\$1,750,000 of development cost/)
  })

  it('lists every reason there is no total, not just the first', () => {
    const p = buildProForma(est({ total: null }), opts, { annualRatePct: null, loanAmount: null })
    const s = summariseProForma(p)
    expect(s).toMatch(/could not be priced/)
    expect(s).toMatch(/carry needs an interest rate/)
    expect(s).toMatch(/land is not included/)
  })
})
