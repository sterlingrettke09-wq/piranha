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
  id: 'measured' | 'entitlement' | 'relief' | 'parking'
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

/** Plain-English building-size bands, for copy that has to name the tier the
 *  measurement is missing for. Matches buildingTier(): single ≤1 unit,
 *  multi 2–4, apartment 5+ (plus commercial/institutional). */
const TIER_LABEL: Record<'single' | 'multi' | 'apartment', string> = {
  single: 'single-family homes',
  multi: '2–4 unit buildings',
  apartment: '5+ unit buildings',
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
  } else if (result.timeline.measuredTierWithheld) {
    // The city DOES publish measured permit timing — just not for a building of
    // this size. Before this branch existed the card simply vanished, which is
    // indistinguishable from a city we never measured, and the city-wide median
    // was served in its place: a Denver duplex was shown 4.5 months computed
    // from a population containing almost no duplexes. An absent measurement
    // must read as absent, and it must say which measurement is absent.
    const w = result.timeline.measuredTierWithheld
    // TWO KINDS OF ABSENCE, AND THE COPY BELOW IS ONLY TRUE OF ONE OF THEM.
    // Everything here was written for Denver: a tier that was counted and came
    // in under the publication floor. Milwaukee's apartments were never counted
    // — the city files every 5+-unit building as commercial new construction,
    // where the building-use field is free text — so "its sample is under the
    // n=30 floor" would assert a measurement that does not exist, and "the
    // city-wide median is a different population" would refer to a figure
    // Milwaukee deliberately does not publish. Disclosure copy is code
    // (CLAUDE.md rule 9), and this is the same sentence being true in one city
    // and false in the next.
    if (w.basis === 'unenumerable') {
      cards.push({
        id: 'measured',
        kicker: 'Measured permit time',
        big: 'Not measured',
        unit: `for ${TIER_LABEL[w.tier]}`,
        sub: `${name} publishes permit timing only for the building sizes its permit feed can separate. ${TIER_LABEL[w.tier]} cannot be separated at all: ${w.reason}`,
        soWhat: `This is a limit of the city's data, not a small sample — no amount of additional permits would produce a figure, so nothing is shown rather than a number drawn from other building types.`,
      })
    } else {
      const sample =
        w.n == null
          ? `under the n=${w.minPublishableN} floor we publish (the exact count was not recorded)`
          : `only n=${w.n}, under the n=${w.minPublishableN} floor we publish`
      cards.push({
        id: 'measured',
        kicker: 'Measured permit time',
        big: 'Not measured',
        unit: `for ${TIER_LABEL[w.tier]}`,
        sub: `${name} publishes permit timing by building size, but its ${TIER_LABEL[w.tier]} sample is ${sample}.`,
        soWhat: `The city-wide median is a different population — it would answer a question about ${TIER_LABEL[w.tier]} with other buildings' numbers, so it is not shown.`,
      })
    }
  }

  // 1b. Measured entitlement time — a DIFFERENT LEG from the permit card above,
  //     from California HCD's Annual Progress Report rather than the city's own
  //     permit feed. Rendered as its own card and never merged with the permit
  //     figure: no source bounds their overlap, so a combined number would
  //     double-count it, and neither is the lifecycle.
  const ent = result.timeline.entitlement
  if (ent) {
    const totalMonths = result.timeline.months
    cards.push({
      id: 'entitlement',
      kicker: 'Measured entitlement time',
      big: `${ent.medianMonths} mo`,
      sub: `Median application→entitlement for 5+ unit buildings in ${name} (p80 ${ent.p80Months}, n=${ent.n}). ${ent.coverageCaveat}`,
      // ⚠️ The so-what states the RELATIONSHIP to the estimate rather than
      // implying the estimate is wrong. This leg sits inside the ~N months
      // shown; it does not add to them and does not replace them.
      soWhat:
        totalMonths > 0
          ? `Getting approved is ${ent.medianMonths} of the ~${totalMonths} months shown below — a leg of that estimate, not an addition to it.`
          : 'Getting approved is one leg of the estimate below, not an addition to it.',
    })
  } else if (result.timeline.entitlementAbsent) {
    // ⚠️ NEVER A BLANK. A missing entitlement line reads as "no delay here",
    // which is the opposite of what an unmeasured city means — the same failure
    // the permit card above already had to fix once. Each basis gets copy that
    // is true of IT: "no source" is a statement about our coverage, "thin
    // sample" is about the city's data, and "wrong tier" is about this project.
    const a = result.timeline.entitlementAbsent
    if (a.basis === 'thin-sample') {
      cards.push({
        id: 'entitlement',
        kicker: 'Measured entitlement time',
        big: 'Not measured',
        unit: `in ${name}`,
        sub: `${name} appears in the state dataset with only n=${a.n}, under the n=${a.minPublishableN} floor we publish.`,
        soWhat:
          'A figure exists but is too thin to stand behind, so nothing is shown rather than a number that would not survive one more quarter of filings.',
      })
    } else if (a.basis === 'no-source') {
      cards.push({
        id: 'entitlement',
        kicker: 'Measured entitlement time',
        big: 'Not measured',
        unit: `in ${name}`,
        // ⚠️ Says whose limitation this is. Without that sentence a reader takes
        // "not measured" as a fact about the city rather than about us.
        sub: `California publishes application→entitlement timing statewide; no equivalent dataset has been identified for ${name}.`,
        soWhat: `This is a gap in our sources, not a finding about ${name} — its timeline below is calibrated rather than measured.`,
      })
    } else {
      cards.push({
        id: 'entitlement',
        kicker: 'Measured entitlement time',
        big: 'Not measured',
        unit: `for ${TIER_LABEL[a.tier]}`,
        sub: `${name} is measured, but the state dataset covers 5+ unit buildings only.`,
        soWhat: `The 5+ unit figure would answer a different question rather than this one less well, so it is not shown for ${TIER_LABEL[a.tier]}.`,
      })
    }
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
      // The denominator label comes from the city's own pipeline when the track
      // is broader than variances (NYC: + special permits; DC: whole-board
      // variances + special exceptions). Hardcoding "variance requests" here was
      // a claim that would have been false for those cities — the caveat has to
      // live on the rendered surface, not in the vintage JSON string.
      sub: `${name}'s board granted ${pct}% of ${relief.label ?? 'variance requests'} (${relief.window}, n=${relief.n})`,
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
