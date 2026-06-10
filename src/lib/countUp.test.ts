import { describe, it, expect } from 'vitest'
import { countUpStep, easeOutCubic } from './countUp'

describe('easeOutCubic', () => {
  it('pins the endpoints', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('clamps out-of-range progress', () => {
    expect(easeOutCubic(-0.5)).toBe(0)
    expect(easeOutCubic(1.5)).toBe(1)
  })

  it('is ease-OUT: past the halfway point of progress by the midpoint of time', () => {
    // Ease-out is front-loaded — at 50% of the way through, more than half the
    // distance is already covered.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })

  it('is monotonically increasing across the curve', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const v = easeOutCubic(p)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('countUpStep', () => {
  it('starts at 0 and is not done', () => {
    expect(countUpStep(100, 900, 0)).toEqual({ value: 0, done: false })
  })

  it('lands EXACTLY on target at the duration and reports done', () => {
    expect(countUpStep(100, 900, 900)).toEqual({ value: 100, done: true })
  })

  it('clamps and stays done past the duration (no overshoot)', () => {
    expect(countUpStep(100, 900, 5000)).toEqual({ value: 100, done: true })
  })

  it('terminates immediately for a non-positive duration', () => {
    expect(countUpStep(42, 0, 0)).toEqual({ value: 42, done: true })
    expect(countUpStep(42, -10, 0)).toEqual({ value: 42, done: true })
  })

  it('produces an in-between, eased value mid-animation', () => {
    const mid = countUpStep(100, 1000, 500)
    expect(mid.done).toBe(false)
    // Ease-out: at half the time, well past half the value, but below target.
    expect(mid.value).toBeGreaterThan(50)
    expect(mid.value).toBeLessThan(100)
  })

  it('handles negative-elapsed defensively as the start frame', () => {
    expect(countUpStep(100, 900, -50)).toEqual({ value: 0, done: false })
  })

  it('scales with the target', () => {
    expect(countUpStep(2_000_000, 900, 900)).toEqual({ value: 2_000_000, done: true })
    expect(countUpStep(0, 900, 450).value).toBe(0)
  })
})
