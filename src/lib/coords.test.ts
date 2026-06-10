import { describe, it, expect } from 'vitest'
import { quantizeCoord } from './coords'

describe('quantizeCoord', () => {
  it('rounds to 6 decimal places (~0.1 m)', () => {
    expect(quantizeCoord(42.36014999321)).toBe(42.36015)
    expect(quantizeCoord(-71.05890000123)).toBe(-71.0589)
  })
  it('collapses near-identical clicks onto one key', () => {
    expect(quantizeCoord(42.3601500001)).toBe(quantizeCoord(42.3601499999))
  })
  it('is idempotent and exact on already-quantized values', () => {
    expect(quantizeCoord(42.36015)).toBe(42.36015)
    expect(quantizeCoord(quantizeCoord(42.123456789))).toBe(quantizeCoord(42.123456789))
  })
  it('handles negatives and zero', () => {
    expect(quantizeCoord(-0.0000004)).toBe(-0)
    expect(quantizeCoord(0)).toBe(0)
  })
})
