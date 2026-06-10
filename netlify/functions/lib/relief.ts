// Empirical zoning-relief grant rates, refreshed offline by scripts/relief/*.mjs.
// A static committed artifact (esbuild inlines it at bundle time); the function
// never fetches a city portal at request time. A city is present only when its
// pipeline produced a trustworthy figure (n ≥ 100, unambiguous outcomes) —
// absent cities show no relief line.
import reliefStats from './data/reliefStats.json'

/** Historical board grant rate for variance-type relief in one city. */
export interface ReliefOdds {
  /** granted ÷ decided, 0–1. */
  grantRate: number
  /** Decided records in the sample (granted + denied). */
  n: number
  /** Human window, e.g. "2022–2026". */
  window: string
  /** Provenance string: dataset, date filter, compute date, granted/denied split. */
  vintage: string
}

type ReliefStats = Record<string, { variance?: ReliefOdds } | undefined>

/** Normalize the imported JSON to the typed shape. Exported for tests so the
 *  JSON-shape contract can be exercised with an injected fixture even if no city
 *  has landed data yet. */
export function _parseStats(stats: unknown): ReliefStats {
  return (stats ?? {}) as ReliefStats
}

const RELIEF_STATS = _parseStats(reliefStats)

/** The measured variance grant rate for a city, or undefined when the pipeline
 *  has no trustworthy figure for it. The second arg lets tests inject a fixture;
 *  production callers omit it. */
export function reliefOddsFor(
  city: string,
  stats: ReliefStats = RELIEF_STATS,
): ReliefOdds | undefined {
  return stats[city]?.variance
}
