// An INTERIOR point of a polygon — shared, because two callers need the same one.
//
// Extracted from scripts/smoke-parcels.ts on 2026-08-19 when the watchlist
// checker needed it too. A second implementation would have been a second chance
// to make the mistake this code already records: an area-weighted centroid can
// fall OUTSIDE a concave lot, and the recorded Charlotte failure had one land in
// the neighbouring parcel while everything downstream still looked like a valid
// answer. The scanline rescue below is what fixed it, and it is not obvious
// enough to re-derive.

// ─────────────────────────────────────────────────────────────────────────────
// Geometry: an INTERIOR point of a polygon.
// ─────────────────────────────────────────────────────────────────────────────
export type Ring = number[][]

export function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]
  return a / 2
}

export function areaCentroid(r: Ring): [number, number] | null {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]
    a += f
    cx += (r[j][0] + r[i][0]) * f
    cy += (r[j][1] + r[i][1]) * f
  }
  if (Math.abs(a) < 1e-14) return null
  return [cx / (3 * a), cy / (3 * a)]
}

export function pointInRing(x: number, y: number, r: Ring): boolean {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Midpoint of the widest interior span on a horizontal scanline — always an
 *  interior point when one exists at that y. Used when the area centroid falls
 *  outside a concave lot (the recorded Charlotte failure: an area-weighted
 *  centroid landed in the neighbouring parcel and everything downstream still
 *  looked like a valid answer). */
export function scanlineInterior(r: Ring, y: number): number | null {
  const xs: number[] = []
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
  }
  xs.sort((a, b) => a - b)
  let best: number | null = null
  let bestW = 0
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const w = xs[k + 1] - xs[k]
    if (w > bestW) {
      bestW = w
      best = (xs[k] + xs[k + 1]) / 2
    }
  }
  return best
}

/** An interior point of the polygon's largest ring, or null. Reports which
 *  method produced it: 'centroid' means the area centroid was already inside,
 *  'scanline' means it was not and the lot is concave enough to have fooled a
 *  centroid-only sampler. */
export function interiorPoint(rings: Ring[]): { pt: [number, number]; via: 'centroid' | 'scanline' } | null {
  const usable = rings.filter((r) => r.length >= 4)
  if (!usable.length) return null
  const outer = usable.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a))
  const c = areaCentroid(outer)
  if (c && pointInRing(c[0], c[1], outer)) return { pt: c, via: 'centroid' }
  const ys = outer.map((p) => p[1])
  const lo = Math.min(...ys), hi = Math.max(...ys)
  for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = lo + (hi - lo) * t
    const x = scanlineInterior(outer, y)
    if (x != null && pointInRing(x, y, outer)) return { pt: [x, y], via: 'scanline' }
  }
  return null
}

