import { describe, it, expect } from 'vitest'
import { formatEstimate } from './format'

describe('formatEstimate', () => {
  it('formats the spec examples', () => {
    expect(formatEstimate(4_182_400)).toBe('$4.18M')
    expect(formatEstimate(425.4)).toBe('$425')
    expect(formatEstimate(62_500)).toBe('$62.5k')
    expect(formatEstimate(1_250_000_000)).toBe('$1.25B')
  })

  it('handles zero and falsy magnitudes', () => {
    expect(formatEstimate(0)).toBe('$0')
    expect(formatEstimate(NaN)).toBe('$0')
    expect(formatEstimate(Infinity)).toBe('$0')
  })

  it('pins the sub-1k / 1k boundary convention', () => {
    expect(formatEstimate(999)).toBe('$999')
    expect(formatEstimate(1000)).toBe('$1k') // 1000 → "$1k", not "$1.00k"
    expect(formatEstimate(1)).toBe('$1')
  })

  it('covers each magnitude band at 3 significant figures', () => {
    // sub-1k: whole dollars
    expect(formatEstimate(0.4)).toBe('$0') // rounds to nothing below a dollar
    expect(formatEstimate(425)).toBe('$425')
    // thousands
    expect(formatEstimate(1_250)).toBe('$1.25k')
    expect(formatEstimate(12_500)).toBe('$12.5k')
    expect(formatEstimate(999_000)).toBe('$999k')
    // millions
    expect(formatEstimate(1_000_000)).toBe('$1M')
    expect(formatEstimate(4_000_000)).toBe('$4M')
    expect(formatEstimate(4_180_000)).toBe('$4.18M')
    // billions
    expect(formatEstimate(1_000_000_000)).toBe('$1B')
    expect(formatEstimate(12_300_000_000)).toBe('$12.3B')
  })

  it('rounds to 3 significant figures, not to the dollar', () => {
    // $4,186,000 must not survive intact; rounds up the third figure (4.186 → 4.19).
    expect(formatEstimate(4_186_000)).toBe('$4.19M')
    expect(formatEstimate(425.6)).toBe('$426')
  })

  it('passes negatives through sanely (should never occur)', () => {
    expect(formatEstimate(-4_182_400)).toBe('-$4.18M')
    expect(formatEstimate(-425)).toBe('-$425')
  })

  it('rounding can roll a value up into the next magnitude', () => {
    // 999,800 → 3 sig figs → 1,000,000 → "$1M"
    expect(formatEstimate(999_800)).toBe('$1M')
  })
})
