import { describe, it, expect } from 'vitest'
import { computeRedTapeIndex, REFERENCE, type RedTapeConstants } from './redTapeIndex'
import { lifecycleMonths } from '../config/estimates'

describe('computeRedTapeIndex', () => {
  const ranked = computeRedTapeIndex()

  it('includes all 10 cities exactly once', () => {
    expect(ranked).toHaveLength(10)
    const slugs = new Set(ranked.map((r) => r.slug))
    expect(slugs.size).toBe(10)
    // Cross-check against the source-of-truth timeline table.
    for (const slug of Object.keys(lifecycleMonths)) {
      expect(slugs.has(slug)).toBe(true)
    }
  })

  it('ranks SF worst on months of process', () => {
    // SF is the slowest-permitting city in the constants, so it should carry
    // the highest processMonths and the maximal months sub-score.
    const sf = ranked.find((r) => r.slug === 'sf')!
    const worstMonths = Math.max(...ranked.map((r) => r.processMonths))
    expect(sf.processMonths).toBe(worstMonths)
    expect(sf.monthsScore).toBe(100)
  })

  it('keeps every sub-score and composite within 0–100', () => {
    for (const r of ranked) {
      expect(r.monthsScore).toBeGreaterThanOrEqual(0)
      expect(r.monthsScore).toBeLessThanOrEqual(100)
      expect(r.feesScore).toBeGreaterThanOrEqual(0)
      expect(r.feesScore).toBeLessThanOrEqual(100)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
  })

  it('assigns a contiguous ascending rank (1 = least red tape)', () => {
    const ranks = ranked.map((r) => r.rank)
    expect(ranks).toEqual(Array.from({ length: ranked.length }, (_, i) => i + 1))
    // Composite is non-decreasing as rank rises.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i - 1].score)
    }
  })

  it('treats the reference project as a residential apartment', () => {
    expect(REFERENCE.tier).toBe('apartment')
    expect(REFERENCE.use).toBe('residential')
    expect(REFERENCE.gfa).toBe(40000)
  })

  it('reorders when injected constants change', () => {
    // Two-city toy world: "slow" has a long lifecycle, "fast" a short one. With
    // the real-ish constants slow ranks worst; flip the lifecycle and the
    // ranking flips too — proving the order is a pure function of the inputs.
    const override: Partial<RedTapeConstants> = {
      lifecycleMonths: {
        slow: { single: 10, multi: 20, apartment: 60 },
        fast: { single: 10, multi: 20, apartment: 20 },
      },
      reliefAddMonthsByCity: { slow: 10, fast: 2 },
      demoMonthsByCity: { slow: 3, fast: 3 },
      cityCostIndex: { slow: 1, fast: 1 },
      impactFee: () => null,
    }
    const a = computeRedTapeIndex(override)
    expect(a.find((r) => r.slug === 'slow')!.rank).toBe(2)
    expect(a.find((r) => r.slug === 'fast')!.rank).toBe(1)

    const flipped: Partial<RedTapeConstants> = {
      ...override,
      lifecycleMonths: {
        slow: { single: 10, multi: 20, apartment: 20 },
        fast: { single: 10, multi: 20, apartment: 60 },
      },
      reliefAddMonthsByCity: { slow: 2, fast: 10 },
    }
    const b = computeRedTapeIndex(flipped)
    expect(b.find((r) => r.slug === 'slow')!.rank).toBe(1)
    expect(b.find((r) => r.slug === 'fast')!.rank).toBe(2)
  })

  it('counts only applied fees, not informational ones', () => {
    // Boston's residential reference project triggers no applied linkage fee
    // (linkage is commercial ≥ 50k sf only), so its feePerSqFt is 0.
    const boston = ranked.find((r) => r.slug === 'boston')!
    expect(boston.feePerSqFt).toBe(0)
    expect(boston.feeLabel).toBeNull()
    // LA applies a residential linkage fee, so it should be > 0.
    const la = ranked.find((r) => r.slug === 'la')!
    expect(la.feePerSqFt).toBeGreaterThan(0)
  })
})
