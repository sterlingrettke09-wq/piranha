import { describe, it, expect } from 'vitest'
import { polygonAreaSqFt, lngLatToUtm15 } from './geo'

// polygonAreaSqFt feeds the lot size — and therefore every FAR verdict — for
// SF, LA, and Chicago. lngLatToUtm15 is Minneapolis's entire ability to find
// a parcel (Hennepin County won't reproject 4326).

describe('polygonAreaSqFt (shoelace)', () => {
  it('computes a unit square (closed ring) as 1', () => {
    const ring = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
    expect(polygonAreaSqFt(ring)).toBe(1)
  })

  it('computes a 50×100 ft lot as 5,000 sq ft regardless of winding order', () => {
    const ccw = [[[0, 0], [50, 0], [50, 100], [0, 100], [0, 0]]]
    const cw = [[[0, 0], [0, 100], [50, 100], [50, 0], [0, 0]]]
    expect(polygonAreaSqFt(ccw)).toBe(5000)
    expect(polygonAreaSqFt(cw)).toBe(5000)
  })

  it('sums multiple rings (current behavior: holes ADD absolute area only if wound the same way)', () => {
    // A 100×100 outer ring with a 10×10 inner ring wound OPPOSITE contributes
    // negative signed area before the final abs(): 10,000 − 100 = 9,900.
    const outer = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
    const hole = [[20, 20], [20, 30], [30, 30], [30, 20], [20, 20]] // opposite winding
    expect(polygonAreaSqFt([outer, hole])).toBe(9900)
  })

  it('converts meter-SR rings with unitToFeet = 3.28084 (the currently-unused branch)', () => {
    // 10 m × 10 m = 100 m² = 1,076.39 sq ft. This branch has no production
    // caller yet — the test exists so the day a meter-SR city lands, forgetting
    // the factor (a silent 10.76× lot-size error) is caught here first.
    const ring = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
    expect(polygonAreaSqFt(ring, 3.28084)).toBe(1076)
  })

  it('returns null for missing, empty, or degenerate rings', () => {
    expect(polygonAreaSqFt(undefined)).toBeNull()
    expect(polygonAreaSqFt([])).toBeNull()
    expect(polygonAreaSqFt([[[5, 5]]])).toBeNull() // single point, zero area
  })
})

describe('lngLatToUtm15 (EPSG:26915 forward projection)', () => {
  // Reference values computed independently with pyproj (EPSG:4326 →
  // EPSG:26915, always_xy). Tolerance 1 m — the parcel snap buffer is 30 m,
  // so sub-meter agreement is more than enough.
  it('projects Minneapolis City Hall within 1 m of the pyproj reference', () => {
    const { x, y } = lngLatToUtm15(-93.265, 44.9778)
    expect(Math.abs(x - 479105.882)).toBeLessThan(1)
    expect(Math.abs(y - 4980518.42)).toBeLessThan(1)
  })

  it('projects a second Hennepin County point within 1 m', () => {
    const { x, y } = lngLatToUtm15(-93.3, 45.05)
    expect(Math.abs(x - 476375.985)).toBeLessThan(1)
    expect(Math.abs(y - 4988548.562)).toBeLessThan(1)
  })

  it('is west of the central meridian → easting below 500,000', () => {
    expect(lngLatToUtm15(-93.5, 44.9).x).toBeLessThan(500000)
    expect(lngLatToUtm15(-92.5, 44.9).x).toBeGreaterThan(500000)
  })
})
