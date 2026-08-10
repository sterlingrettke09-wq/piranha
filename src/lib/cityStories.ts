// City stories for the Red Tape Index (WO-8.7a). One 2–3 sentence plain-English
// paragraph per city, COMPUTED from the same artifacts every report uses — the
// measured permit medians (permitStats.json), the empirical relief grant rates
// (reliefStats.json), the parking rules, and the lifecycle/relief months that
// drive the ranking. Nothing here is hand-typed prose with a baked-in number:
// every figure is interpolated from the RankedCity object passed in, so a story
// can never drift from the table above it.
//
// House voice: plain, confident, a little sharp. No exclamation marks, no jargon
// without a translation. We round months to whole numbers in prose and never
// invent a figure the data doesn't carry.

import type { RankedCity } from './redTapeIndex'
import { cityName } from '../config/cities'

/** Round a month figure to a whole number for prose. */
function whole(n: number): number {
  return Math.round(n)
}

/** A measured median like 1 reads as "a month"; everything else as "N months". */
function monthsPhrase(n: number): string {
  const m = whole(n)
  if (m <= 1) return 'about a month'
  return `about ${m} months`
}

/** "the fastest we measure" / "the slowest we measure" / "" — only when this
 *  city actually holds the extreme across the measured set. */
function measuredSuperlative(city: RankedCity, all: RankedCity[]): string {
  const measured = all
    .map((c) => c.measuredMedianMonths)
    .filter((v): v is number => v != null)
  if (measured.length < 2 || city.measuredMedianMonths == null) return ''
  const min = Math.min(...measured)
  const max = Math.max(...measured)
  if (city.measuredMedianMonths === min) return ' — the fastest we measure'
  if (city.measuredMedianMonths === max) return ' — the slowest we measure'
  return ''
}

/** "N months" / "a month" for an added duration, rounded to whole. */
function monthsAdded(n: number): string {
  const m = whole(n)
  if (m <= 0) return 'no extra time'
  if (m === 1) return 'a month'
  return `${m} months`
}

/** Rank context for the fallback line: front / middle / back of the ten. */
function packPosition(rank: number, total: number): string {
  if (rank <= Math.ceil(total / 3)) return 'near the front of the pack'
  if (rank > total - Math.ceil(total / 3)) return 'toward the back of the pack'
  return 'middle of the pack'
}

/**
 * The one part of a story that makes a claim about a city's parking rules — and
 * it is that city's OWN verified headline, verbatim.
 *
 * ⚠️ THIS DELIBERATELY DOES NOT LOOK AT `parkingStatus`. The branch below used to
 * print the fixed sentence "<City> abolished parking minimums citywide, so
 * nothing forces a garage under your units" for every city whose status was
 * `abolished`, which is the same status-drives-prose collapse just removed from
 * `parkingCell()` in redTapeIndex.ts — there, `abolished` printed a year and
 * EVERYTHING ELSE printed the literal string "Near transit only", false for five
 * of the fifteen ranked cities. This is that defect's second site.
 *
 * It has not published a false sentence yet, and that is the hazard rather than
 * the defence: only Minneapolis and San Jose currently reach the branch, and
 * both happen to carry citywide-abolition headlines. The words "citywide" and
 * "nothing forces a garage" came from the CATEGORY, so they were guaranteed for
 * any future city tagged `abolished` — including one whose record scopes the
 * reform. Raleigh is the first `abolished` city whose headline is not of the
 * form "abolished citywide (year)": its record is "Abolished citywide — the UDO
 * sets parking maximums, not minimums", and its file states outright that no
 * reform year is asserted because none could be established.
 *
 * A status is a CATEGORY someone assigned; the words have to come from the
 * RECORD someone verified. The status may still choose WHICH angle a story leads
 * with — that is an editorial routing decision, not a claim shown to a reader —
 * but it may not supply a single word of the claim itself.
 *
 * Every word this returns, other than the city's own name, must appear in that
 * city's `headline`. `cityStories.test.ts` checks exactly that, mechanically,
 * over every rule in the table — ranked or not, so Raleigh is covered before it
 * enters the index.
 */
export function parkingClause(city: RankedCity): string | null {
  if (city.parkingHeadline == null) return null
  return `Parking in ${cityName(city.slug)}: ${city.parkingHeadline}.`
}

/**
 * Build the editorial story for one ranked city. `all` is the full ranking,
 * needed for the "fastest/slowest we measure" superlatives. Every number in the
 * returned string is read off `city` (or computed from `all`) — never invented.
 */
export function storyFor(city: RankedCity, all: RankedCity[]): string {
  const name = cityName(city.slug)

  // Branch 1 — MEASURED permit time present: lead with the hard number. If the
  // calendar triples (or more) once you trigger relief, say so with the real
  // multiple; otherwise just note what entitlement adds.
  if (city.measuredMedianMonths != null) {
    const sup = measuredSuperlative(city, all)
    // Compute the relief multiple off the SAME whole-number figures the reader
    // sees in prose, so the "doubles/triples" verb can't contradict the numbers.
    const base = whole(city.measuredMedianMonths)
    const add = whole(city.reliefAddMonths)
    const lead = `${name} issues a new-construction permit in ${monthsPhrase(city.measuredMedianMonths)}${sup}.`

    if (add > 0 && base > 0 && base + add >= base * 2) {
      const mult = (base + add) / base
      const verb =
        mult >= 3
          ? 'and the calendar more than triples'
          : mult > 2
            ? 'and the calendar more than doubles'
            : 'and the calendar doubles'
      return (
        `${lead} But trigger zoning relief — a variance, a special permit — ${verb}, ` +
        `adding ${monthsAdded(city.reliefAddMonths)} of discretionary review on top of the file.`
      )
    }
    if (city.reliefAddMonths > 0) {
      return (
        `${lead} Stay by-right and it stays quick; trigger zoning relief and you add ` +
        `${monthsAdded(city.reliefAddMonths)} of discretionary review on top.`
      )
    }
    return `${lead} The hard part here is what you build, not how long you wait for permission.`
  }

  // Branch 2 — RELIEF grant rate present: the says-yes angle. The punishment
  // isn't the answer; it's the wait to hear it.
  if (city.reliefGrantRate != null) {
    const pct = Math.round(city.reliefGrantRate * 100)
    return (
      `${name}'s board says yes ${pct}% of the time. The punishment isn't the answer — ` +
      `it's the ${monthsAdded(city.reliefAddMonths)} you wait to hear it, ` +
      `tacked onto a by-right apartment build that already runs ${monthsPhrase(city.lifecycleMonths)}.`
    )
  }

  // Branch 3 — PARKING leads: the tailwind angle. One fewer mandate between the
  // idea and the building.
  //
  // `parkingStatus` selects the angle; `parkingClause` supplies every word of
  // the claim, from the city's own verified headline. See parkingClause() for
  // why that split is the whole point. The consequence clause that follows is
  // written CONDITIONALLY ("where the minimum is gone") rather than absolutely,
  // so it stays true for any headline the record might carry — including one
  // that scopes the reform to a district. Under-claiming is the safe direction;
  // the headline immediately before it states the real scope.
  const parking = parkingClause(city)
  if (city.parkingStatus === 'abolished' && parking != null) {
    return (
      `${parking} Where the minimum is gone, nothing forces a garage under your units — ` +
      `a real cost off the table. The process is the rest of the story: ` +
      `a by-right apartment build runs ${monthsPhrase(city.lifecycleMonths)}, ` +
      `${monthsPhrase(city.lifecycleMonths + city.reliefAddMonths)} once you need a variance.`
    )
  }

  // Branch 4 — FALLBACK: an honest line from the lifecycle months alone.
  const position = packPosition(city.rank, all.length)
  return (
    `A by-right apartment building in ${name} runs ${monthsPhrase(city.lifecycleMonths)} end to end — ` +
    `${position}. A single variance adds ${monthsAdded(city.reliefAddMonths)}, ` +
    `but the real weight here is in the land, not the labor.`
  )
}
