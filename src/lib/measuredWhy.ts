import type { AnalysisResult } from '../types/analysis'

/** ⚠️ WHY A TIMELINE IS ESTIMATED RATHER THAN MEASURED — derived from the
 *  reason code the engine already produced, not from a hand-written list.
 *
 *  The old copy named exactly two causes and joined them with "either … or":
 *  "the data carries no application date, or a figure was measured and
 *  withdrawn". That is a CLOSED disjunction, and it was already wrong —
 *  Milwaukee's 5+ unit tier is absent because the permit feed cannot separate
 *  that tier at all, which is neither. A closed list of causes is a completeness
 *  claim about our own pipeline, and it goes stale the first time a new
 *  withholding reason is added.
 *
 *  So the specific arms below are the ones the engine can actually report, and
 *  the fallback stays OPEN — it says a figure is not published without
 *  enumerating why. */
export function estimatedWhy(d: AnalysisResult): string {
  const w = d.timeline.measuredTierWithheld
  const TIER: Record<string, string> = {
    single: 'single-family homes',
    multi: '2–4 unit buildings',
    apartment: '5+ unit buildings',
  }
  const tail =
    ' The figure shown is a full-lifecycle estimate, not a filing-to-issuance measurement, so it is not comparable to a city showing a measured figure.'
  if (w?.basis === 'thin-sample') {
    const n = w.n == null ? 'too small a sample' : `only n=${w.n}`
    return `Estimated, not measured. This city publishes permit timing by building size, but its ${TIER[w.tier] ?? w.tier} sample is ${n} — under the n=${w.minPublishableN} floor we publish. The city-wide median is a different population and is not substituted.${tail}`
  }
  if (w?.basis === 'unenumerable') {
    return `Estimated, not measured. This city publishes permit timing only for the building sizes its permit feed can separate, and ${TIER[w.tier] ?? w.tier} cannot be separated at all: ${w.reason}${tail}`
  }
  return `Estimated, not measured. No filing-to-issuance figure is published for this city and this building size.${tail}`
}
