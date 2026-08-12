import type { Hurdle } from '../types/analysis'

/**
 * How a report's hurdle list should be COUNTED and how its timeline should be
 * LABELLED when some checks could not be performed.
 *
 * WHY THIS IS A FUNCTION AND NOT TWO INLINE FILTERS. `KeyMetrics` and `Compare`
 * both publish a hurdle count, and `Compare`'s is read across cities. If they
 * disagreed about whether an `unchecked` row counts as an approval, one page
 * would say a parcel needs 5 approvals and the other 6 — the boundary problem
 * CLAUDE.md rule 9 describes, between two files that look independent. One
 * definition, tested once.
 *
 * THE TWO RULES, and both are corrections of a specific way of being wrong:
 *
 *   1. An `unchecked` row is NOT an approval. It says a city layer did not
 *      answer, so we could not establish whether a requirement applies.
 *      Counting it would make an outage read as MORE approvals than the same
 *      parcel on a healthy run — the defect these rows exist to fix, pointed
 *      the other way. It leaves the count a FLOOR instead.
 *
 *   2. Only a row that would have carried MONTHS marks the timeline. A failed
 *      FEMA flood read leaves the schedule correct and only the cost unstated,
 *      so it must not put a "+" on a number it did not affect. Over-marking
 *      misdescribes what is unknown, which is rule 7's failure in miniature.
 */
export interface UncheckedSummary {
  /** Rows that are claims about the parcel — the number a reader should see. */
  counted: Hurdle[]
  /** Rows disclosing a check that could not be performed on this request. */
  unchecked: Hurdle[]
  /** Months withheld from the timeline because the requirement carrying them
   *  could not be confirmed. NEVER added to `timeline.months` — the requirement
   *  probably does not apply, and asserting it would invent time (rule 1). It
   *  exists so the figure can be shown as a floor and the size of the gap
   *  named. 0 when nothing unchecked carries months. */
  excludedMonths: number
}

export function summarizeUnchecked(hurdles: readonly Hurdle[]): UncheckedSummary {
  const counted: Hurdle[] = []
  const unchecked: Hurdle[] = []
  for (const h of hurdles) (h.status === 'unchecked' ? unchecked : counted).push(h)
  return {
    counted,
    unchecked,
    excludedMonths: unchecked.reduce((a, h) => a + (h.excludedMonths ?? 0), 0),
  }
}
