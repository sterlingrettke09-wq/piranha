// Coordinate quantization for cache-friendliness. Raw map-click floats have
// ~15 decimals, so every click is a unique /api/parcel + /api/analyze CDN
// cache key — two clicks 1 cm apart were both cache misses fanning out to
// 4–6 upstream GIS queries. Six decimals ≈ 0.11 m at the equator: far finer
// than any parcel boundary, coarse enough that near-identical clicks (and
// re-shared links) collapse onto the same cached response.
export function quantizeCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6
}
