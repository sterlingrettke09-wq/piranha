import { describe, it, expect } from 'vitest'
import { CUMMING_Q4_2025_CITIES, CUMMING_Q4_2025_RANGES, cummingRange } from './cummingRanges'
import { costPerSqFtByProduct, cityCostIndex, heightCostFactor } from './estimates'

// THE CORROBORATION, RE-RUN FROM DATA RATHER THAN QUOTED FROM A SUMMARY.
//
// The 2026-08-05 check recorded "inside Cumming's published range for 3 of 9
// cities" and not the ranges. When the constants were re-keyed on 2026-08-19 the
// claim could not be re-examined without re-obtaining the report. Now the numbers
// live in cummingRanges.ts and every assertion below is computed from them, so
// the check survives the next change to either side.

const rate = (p: string): number => {
  const r = costPerSqFtByProduct[p as keyof typeof costPerSqFtByProduct]
  if (r.kind !== 'rate') throw new Error(`${p} carries no rate`)
  return r.perSqFt
}
const inside = (v: number, r: readonly [number, number]) => v >= r[0] && v <= r[1]

describe('the stored table is intact', () => {
  it('ten cities, and every row has one range each', () => {
    // rule 20: a shrunken table would make every comparison below vacuous.
    expect(CUMMING_Q4_2025_CITIES.length).toBe(10)
    for (const [k, row] of Object.entries(CUMMING_Q4_2025_RANGES)) {
      expect(row.length, k).toBe(10)
      for (const [lo, hi] of row) expect(hi, k).toBeGreaterThan(lo)
    }
  })

  it('and every city is one this project actually costs', () => {
    for (const c of CUMMING_Q4_2025_CITIES) expect(cityCostIndex[c], c).toBeGreaterThan(0)
  })

  it('Nashville is still the lowest apartment low-bound, as the old note said', () => {
    const lows = CUMMING_Q4_2025_RANGES.apartment.map(([lo]) => lo)
    expect(Math.min(...lows)).toBe(280)
    expect(cummingRange('apartment', 'nashville')).toEqual([280, 410])
  })
})

describe('apartment: the tier explanation, recomputed', () => {
  const at = (f: number) =>
    CUMMING_Q4_2025_CITIES.filter((c) =>
      inside(rate('apartment') * cityCostIndex[c] * f, cummingRange('apartment', c)!),
    ).length

  it('sits below most low bounds at the flat tier, and inside all ten with the premium', () => {
    // This is the original claim, reproduced from the data rather than restated:
    // 3 of 10 at factor 1.00, 10 of 10 once the mid-rise premium applies. The old
    // note said "3 of 9" and "all nine" — the count of cities was wrong, the
    // finding was not.
    expect(at(1.0)).toBe(3)
    expect(at(heightCostFactor(6))).toBe(10)
  })

  it('and the conclusion survives the premium being what RSMeans measures', () => {
    // RSMeans size-normalised puts the 4-7 storey factor at ~1.09–1.10 against
    // this project's 1.12. If the finding only held at exactly 1.12 it would be
    // an artifact of the factor rather than evidence about the rate.
    expect(at(1.1)).toBe(10)
    expect(at(1.15)).toBe(10)
    expect(at(1.09)).toBe(9)
  })

  it('Denver is the worst case at the flat tier, at about -9%', () => {
    const short = CUMMING_Q4_2025_CITIES.map((c) => ({
      c,
      d: (rate('apartment') * cityCostIndex[c]) / cummingRange('apartment', c)![0] - 1,
    })).sort((a, b) => a.d - b.d)
    expect(short[0].c).toBe('denver')
    expect(short[0].d).toBeLessThan(-0.08)
    expect(short[0].d).toBeGreaterThan(-0.1)
  })
})

describe('office and institutional, recomputed from the same table', () => {
  it('lands inside Shell & Core in 8 of the 10, over the top in Nashville and SF', () => {
    const over = CUMMING_Q4_2025_CITIES.filter(
      (c) => rate('office') * cityCostIndex[c] > cummingRange('officeShellCore', c)![1],
    )
    // The old note said "7 of 9". Ten cities, and the two exceptions are the two
    // cheapest-to-build markets in the table relative to our index — not a
    // systematic overstatement.
    expect(over).toEqual(['nashville', 'sf'])
    expect(10 - over.length).toBe(8)
  })

  it('and sits between Shell & Core and S&C + Tenant Improvement in all ten', () => {
    // This is the claim that justifies a single complete-building rate: a
    // finished office costs at least the shell and at most shell plus a full
    // fit-out. Recomputed here, not asserted — the TI row is stored for exactly
    // this reason.
    for (const c of CUMMING_Q4_2025_CITIES) {
      const v = rate('office') * cityCostIndex[c]
      const sc = cummingRange('officeShellCore', c)!
      const ti = cummingRange('officeTenantImprovement', c)!
      expect(v, c).toBeGreaterThanOrEqual(sc[0])
      expect(v, c).toBeLessThanOrEqual(sc[1] + ti[1])
    }
  })

  it('institutional lands inside the K-12 range in every city', () => {
    for (const c of CUMMING_Q4_2025_CITIES) {
      expect(inside(rate('institutional') * cityCostIndex[c], cummingRange('k12School', c)!), c).toBe(
        true,
      )
    }
  })
})
