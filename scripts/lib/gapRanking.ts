// Ranking the sweep's gaps by the weight measured for each code. Pure — no live
// queries, nothing runs on import, so the CLI, the document generator and the
// guards can all use ONE implementation of the arithmetic. A guard computing its
// own copy would pass against itself.

import { TARGETS, classify, type Target } from './parserDomains'
import { zoneSource } from '../zoneRegistry'
import { readWeights, weightKey } from './parcelWeights'

/** Is this target measured against the city's PRINCIPAL zoning coverage — the
 *  same layer the provider reads to answer "what is this parcel zoned"? Derived
 *  from zoneRegistry rather than asserted, so a re-pointed provider moves this
 *  automatically. The FIELD is deliberately not compared: DC's target reads ZR16
 *  off the layer the registry names, and the denominator is the population of
 *  features, not the column read off them. */
export function isCitywide(t: Target): boolean {
  const z = zoneSource(t.city)
  return z != null && z.layer === t.url
}

export interface GapRow {
  city: string
  field: string
  code: string
  /** Features carrying this code. */
  n: number
  /** n / the layer's own total. Within one city only. */
  share: number
  /** The same gap as a share of the layer's AREA, or null where the layer
   *  publishes no usable area column. Not a refinement of `share` — a different
   *  question, and on a district-grain layer the two differ by up to 2x. */
  areaShare: number | null
  citywide: boolean
}

export interface Ranking {
  /** Gaps with a measured area share, ordered by it. */
  ranked: GapRow[]
  offCoverage: GapRow[]
  /** Gaps carrying no area share. NOT small — unmeasurable on this weighting.
   *  Kept out of the order rather than given a zero or ranked on the other
   *  column, which would silently mix two denominators in one list. */
  unranked: Array<{ city: string; code: string; n: number | null; share: number | null; why: string }>
  missingWeights: string[]
  notReconciled: string[]
  byCity: Array<{ city: string; gapFeatures: number; total: number; gapCodes: number; areaShare: number | null }>
  totalGaps: number
}

/** The ranking, computed from the stored fixtures. One implementation, used by
 *  the console output, the committed report and the tests — so a guard cannot
 *  pass against a second copy of the arithmetic. */
export function rank(): Ranking {
  const ranked: GapRow[] = []
  const offCoverage: GapRow[] = []
  const unranked: Ranking['unranked'] = []
  const missingWeights: string[] = []
  const notReconciled: string[] = []
  const byCity: Ranking['byCity'] = []
  let totalGaps = 0

  for (const t of TARGETS) {
    const w = readWeights(weightKey(t))
    if (w == null) { missingWeights.push(`${t.city}/${t.field}`); continue }
    // A target whose counts do not add up to its own layer total gets no share.
    // Publishing one would be publishing a denominator already known to be wrong.
    if (!w.reconciles) { notReconciled.push(`${t.city}/${t.field} (residual ${w.residual})`); continue }

    // The value roster comes from the SAME measurement as the weights. Using a
    // live enumeration here would rank one day's codes against another day's
    // counts and silently drop whatever moved between them.
    const vals = [...Object.keys(w.counts), ...w.confirmedZero].sort()
    const c = classify(t, vals)
    totalGaps += c.gaps.length
    const citywide = isCitywide(t)
    const areaTotal = w.areaByCode ? Object.values(w.areaByCode).reduce((a, b) => a + b, 0) : null
    let gapFeatures = 0
    let gapArea = 0
    for (const g of c.gaps) {
      const n = w.counts[g]
      if (n == null) {
        unranked.push({
          city: t.city,
          code: g,
          // null, not 0 — a code whose weight could not be measured has no count
          // to report, and a 0 here would be the same lie the area column refuses.
          n: w.confirmedZero.includes(g) ? 0 : null,
          share: w.confirmedZero.includes(g) ? 0 : null,
          why: w.confirmedZero.includes(g)
            ? 'ZERO features — measured, and an answer about priority'
            : 'weight UNMEASURED — not zero, unknown',
        })
        continue
      }
      gapFeatures += n
      const a = w.areaByCode?.[g]
      if (a != null) gapArea += a
      const row: GapRow = {
        city: t.city, field: t.field, code: g, n,
        share: n / w.totalFeatures,
        areaShare: areaTotal != null && a != null ? a / areaTotal : null,
        citywide,
      }
      if (!citywide) { offCoverage.push(row); continue }
      // ⚠️ RANKED BY AREA, so a gap with no area column cannot be placed. It is
      // not last and it is not zero — those both assert something. Ten of the 23
      // layers publish no usable area column, and two of those cities have gaps:
      // LA's 440 and Phoenix's 8. Ranking them on the count column instead would
      // interleave two different denominators in one ordered list, which is the
      // one thing this file has refused to do since it was written.
      if (row.areaShare == null) {
        unranked.push({
          city: t.city, code: g, n: row.n, share: row.share,
          why: w.areaField == null
            ? "layer publishes no area column — this gap's land share is unmeasured, not small"
            : `area column \`${w.areaField}\` present but unusable (counts did not reconcile against it)`,
        })
        continue
      }
      ranked.push(row)
    }
    if (citywide) {
      byCity.push({
        city: t.city, gapFeatures, total: w.totalFeatures, gapCodes: c.gaps.length,
        areaShare: areaTotal != null && areaTotal > 0 ? gapArea / areaTotal : null,
      })
    }
  }

  // AREA is the order. `share` (polygon count) rides along as a second column
  // and never breaks a tie, so the two can never quietly swap roles.
  ranked.sort((a, b) => b.areaShare! - a.areaShare! || a.city.localeCompare(b.city) || a.code.localeCompare(b.code))
  offCoverage.sort((a, b) => (b.areaShare ?? -1) - (a.areaShare ?? -1) || b.share - a.share)
  unranked.sort((a, b) => (b.share ?? -1) - (a.share ?? -1))
  // Cities with no area column sort to the END and are labelled unranked rather
  // than appearing to have the smallest share.
  byCity.sort((a, b) => (b.areaShare ?? -1) - (a.areaShare ?? -1))
  return { ranked, offCoverage, unranked, missingWeights, notReconciled, byCity, totalGaps }
}

