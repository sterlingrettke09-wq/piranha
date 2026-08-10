// Empirical zoning-relief grant rates, refreshed offline by scripts/relief/*.mjs.
// A static committed artifact (esbuild inlines it at bundle time); the function
// never fetches a city portal at request time. A city is present only when its
// pipeline produced a trustworthy figure (n ≥ 100, unambiguous outcomes) —
// absent cities show no relief line.
import reliefStats from './data/reliefStats.json'
// Feed row counts observed at extraction time — see the type's own header for
// why they exist and why an entry may legitimately lack them.
import type { FeedCounts } from './feedCounts'

export type { FeedCounts, FeedEndpointTotal } from './feedCounts'

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
  /** What the denominator IS, in user-facing words — rendered verbatim in the
   *  reality-check line. Absent for cities whose track is variances alone
   *  (Boston, SF — the renderer falls back to "variance requests"); REQUIRED
   *  wherever the track is broader (NYC mixes §72-21 variances with §73 special
   *  permits; DC's is a whole-board rate over variances + special exceptions),
   *  because a caveat that lives only in the vintage JSON string is a caveat
   *  nobody renders. The JSON slot name `variance` is historical schema, not
   *  the claim; this label is the claim. */
  label?: string
}

type ReliefStats = Record<
  string,
  | {
      variance?: ReliefOdds
      /** OPTIONAL, and unpopulated on every entry written before the
       *  instrumentation landed (2026-08-10). Those are deliberately NOT
       *  backfilled — a count taken today is not the count at that extract's
       *  vintage. Nothing at request time reads it: it exists so a later
       *  grew-vs-shrank check has something to diff. */
      feed?: FeedCounts
    }
  | undefined
>

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
