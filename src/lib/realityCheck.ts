// ---- Reality-check band selection logic (WO-8.2) ----
// Pure selection: given a loaded AnalysisResult, decide which of up to three
// "loud" stat cards the result page's RealityCheck band should render. Each
// card only appears when REAL, city-specific data backs it; zero qualifying
// cards → the band renders nothing. Kept side-effect-free and UI-free so it can
// be unit-tested independently of React.

import type { AnalysisResult } from '../types/analysis'
import { cityName } from '../config/cities'
import { PARKING_RULES } from '../config/parkingRules'

export interface RealityCard {
  /** Stable key for React + tests. */
  id: 'measured' | 'relief' | 'parking'
  /** Small uppercase label above the big number. */
  kicker: string
  /** The headline figure (already formatted, e.g. "8 mo", "72%", "None"). */
  big: string
  /** Optional unit line shown under `big` when the figure isn't self-describing
   *  (e.g. parking's "None" needs "required" beneath it). */
  unit?: string
  /** Provenance sub-line: where the number comes from, with n / window. */
  sub: string
  /** One-line plain-English "so what" — the human takeaway. */
  soWhat: string
}

/**
 * Build the Reality-check cards for a loaded result. Order is fixed:
 * measured permit time → relief odds → parking. Only cards with real data on
 * the result render; the caller hides the whole band when this returns [].
 */
export function buildRealityCards(result: AnalysisResult): RealityCard[] {
  const cards: RealityCard[] = []
  const city = result.project.city
  const name = cityName(city)

  // 1. Measured permit time — from the city's open permit data, present only
  //    when the offline pipeline produced a new-construction median.
  const measured = result.timeline.measured
  if (measured) {
    const totalMonths = result.timeline.months
    const median = measured.medianMonths
    // The so-what compares the measured permit leg to the full life-cycle the
    // timeline shows. Thresholds at 25% / 50% of the total.
    let soWhat: string
    if (totalMonths > 0 && median < totalMonths * 0.25) {
      soWhat =
        'Permits here are quick — entitlement and construction eat the calendar.'
    } else if (totalMonths > 0 && median > totalMonths * 0.5) {
      soWhat = 'The permit queue itself is a major part of this timeline.'
    } else {
      soWhat = `Permit queue is ${median} of the ~${totalMonths} months shown below.`
    }
    cards.push({
      id: 'measured',
      kicker: 'Measured permit time',
      big: `${median} mo`,
      sub: `Median filing→permit in ${name} (p80 ${measured.p80Months}, n=${measured.n})`,
      soWhat,
    })
  }

  // 2. Relief odds — attached only on a NEEDS_RELIEF (variance-path) verdict
  //    when the city's relief pipeline produced a figure.
  const relief = result.reliefOdds
  if (relief) {
    const pct = Math.round(relief.grantRate * 100)
    cards.push({
      id: 'relief',
      kicker: 'Board approval rate',
      big: `${pct}%`,
      sub: `${name}'s board granted ${pct}% of variance requests (${relief.window}, n=${relief.n})`,
      soWhat: 'The answer is usually yes — the cost is the months it takes to ask.',
    })
  }

  // 3. Parking minimums — only where the city has abolished them outright or
  //    relaxed them partially (a real, on-thesis cost story).
  const rule = PARKING_RULES[city]
  if (rule && (rule.status === 'abolished' || rule.status === 'partial')) {
    if (rule.status === 'abolished') {
      cards.push({
        id: 'parking',
        kicker: 'Parking minimums',
        big: 'None',
        unit: 'required',
        sub: rule.headline,
        soWhat:
          'Build the parking the market wants, not what a 1950s code guessed.',
      })
    } else {
      cards.push({
        id: 'parking',
        kicker: 'Parking minimums',
        big: 'Relaxed',
        sub: rule.headline,
        soWhat: rule.detail.trim(),
      })
    }
  }

  return cards
}
