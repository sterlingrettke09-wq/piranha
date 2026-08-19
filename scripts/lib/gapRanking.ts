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
  ranked: GapRow[]
  offCoverage: GapRow[]
  unranked: Array<{ city: string; code: string; why: string }>
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
  const unranked: Array<{ city: string; code: string; why: string }> = []
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
          why: w.confirmedZero.includes(g)
            ? 'ZERO features — measured, and an answer about priority'
            : 'weight UNMEASURED — not zero, unknown',
        })
        continue
      }
      gapFeatures += n
      const a = w.areaByCode?.[g]
      if (a != null) gapArea += a
      ;(citywide ? ranked : offCoverage).push({
        city: t.city, field: t.field, code: g, n,
        share: n / w.totalFeatures,
        areaShare: areaTotal != null && a != null ? a / areaTotal : null,
        citywide,
      })
    }
    if (citywide) {
      byCity.push({
        city: t.city, gapFeatures, total: w.totalFeatures, gapCodes: c.gaps.length,
        areaShare: areaTotal != null && areaTotal > 0 ? gapArea / areaTotal : null,
      })
    }
  }

  ranked.sort((a, b) => b.share - a.share || b.n - a.n || a.city.localeCompare(b.city))
  offCoverage.sort((a, b) => b.share - a.share)
  byCity.sort((a, b) => b.gapFeatures / b.total - a.gapFeatures / a.total)
  return { ranked, offCoverage, unranked, missingWeights, notReconciled, byCity, totalGaps }
}

