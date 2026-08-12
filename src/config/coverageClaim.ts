// What a public surface is allowed to SAY about a city.
//
// THE DEFECT THIS EXISTS TO PREVENT (2026-08-12). Five surfaces — the cities
// page heading and every city card, the home stats block, the about page, the
// request-a-city page, the Q&A — said that all 23 cities were "live". `live` is
// a field on the city registry: it means the provider, the zoning module and
// the dispatcher are wired. That is a fact about our plumbing. What a visitor
// gets is a different fact, and the 575-parcel live sample had already measured
// it: in Nashville, San Diego and San Jose not one sampled developable parcel
// produced a zoning envelope. Someone typing a Nashville address got nothing,
// and the front page had told them the city was live.
//
// So WIRED is derived from the registry and ANSWERING is derived from the
// measurement, and no surface may state the second by reading the first. Every
// number and every sentence below is computed from `envelopeSample` — the
// qualifier that already existed for the /math matrix, reused rather than
// recomputed — so re-running the sampler moves the copy, and a coverage claim
// cannot be typed into a page.
//
// SECOND DEFECT, same family. `About.tsx` and `Ask.tsx` interpolated
// `CITIES.length` and then enumerated ten cities by name, stale from when there
// were ten: a derived count sitting beside a hand-written list, disagreeing
// inside one sentence. `citiesSentence()` derives the list from the same array
// the count comes from. There is no second list to maintain.
//
// ── THE ONLY CUTOFF IS ZERO, AND IT IS NOT A THRESHOLD ────────────────────
//
// Wherever there is room for one, the RATE IS RENDERED DIRECTLY — "33% · n=6"
// on the card, the full range in prose. A rate needs no cutoff to be true, and
// that is most of this fix.
//
// The one binary drawn here is `resolved === 0`. It is deliberately the only
// one, because it is not a magnitude judgement: "the sample produced an
// envelope sometimes" and "the sample never produced one" differ in kind, not
// in degree, and the second is the state that makes the page's promise false.
// Any other line — 50%, 70%, "most" — would be a number nobody sourced, applied
// to specific cities, flowing into user-facing copy: the exact shape this repo
// keeps retracting (rules 1 and 4).
//
// The cost of refusing a second cutoff is visible and accepted: Seattle
// resolved 1 of 18 and therefore counts as answering. No sentence here leans on
// that count. Seattle's card shows 6%, which tells a reader more than any
// bucket would, and the range sentence carries the low end wherever the count
// appears.

import { CITIES } from './cities'
import {
  envelopeSample,
  envelopeSampleLabel,
  envelopeSampleDetail,
  type EnvelopeSample,
} from './envelopeSample'

/**
 * What the measurement licenses a surface to say about one city.
 *
 *   'answering'  — the sample resolved an envelope for at least one parcel.
 *   'silent'     — the sample resolved one for none of them. Wired, not
 *                  answering. This is the state the word "live" was hiding.
 *   'unknown'    — no usable sample: never sampled, or sampled with no
 *                  developable answered parcel to form a denominator. Not a
 *                  clean city and not a broken one; nobody has looked.
 *                  Deliberately NOT folded into 'answering' — an unmeasured
 *                  city reading as a working one is the original defect.
 */
export type ClaimVerdict = 'answering' | 'silent' | 'unknown'

export interface CityClaim {
  slug: string
  name: string
  stateLabel: string
  sample: EnvelopeSample
  verdict: ClaimVerdict
  /** `92% · n=25`, or words for the two states that have no rate. */
  rateLabel: string
  /** Numerator, denominator, exclusions and sample date — for a tooltip. */
  detail: string
}

export function verdictFor(s: EnvelopeSample): ClaimVerdict {
  if (s.kind !== 'measured') return 'unknown'
  return s.resolved > 0 ? 'answering' : 'silent'
}

/**
 * Built through an injected sampler so the guard can PERTURB it: drop a city's
 * rate to zero and every sentence on every surface has to move. A module-level
 * constant read straight off the JSON could not be tested that way, and a copy
 * generator nobody can perturb is indistinguishable from hard-coded copy.
 */
export function buildCityClaims(
  sampleOf: (slug: string) => EnvelopeSample = envelopeSample,
): CityClaim[] {
  return CITIES.map((c) => {
    const sample = sampleOf(c.slug)
    return {
      slug: c.slug,
      name: c.name,
      stateLabel: c.stateLabel,
      sample,
      verdict: verdictFor(sample),
      rateLabel: envelopeSampleLabel(sample),
      detail: envelopeSampleDetail(c.name, sample),
    }
  })
}

export const CITY_CLAIMS: CityClaim[] = buildCityClaims()

export interface CoverageFacts {
  /** Cities with a provider, a zoning module and a dispatcher route. */
  wired: number
  /** Of those, how many have a rate at all. */
  measured: number
  answering: number
  /** Wired, sampled, and resolved nothing. */
  silent: CityClaim[]
  /** Sampled and resolved every parcel drawn. */
  full: CityClaim[]
  /** Whole percents, over measured cities only. Null when nothing is measured. */
  minPct: number | null
  maxPct: number | null
}

const pct = (share: number): number => Math.round(share * 100)

export function coverageFacts(claims: CityClaim[] = CITY_CLAIMS): CoverageFacts {
  const measured = claims.filter((c) => c.sample.kind === 'measured')
  const shares = measured.map((c) => (c.sample.kind === 'measured' ? c.sample.share : 0))
  return {
    wired: claims.length,
    measured: measured.length,
    answering: claims.filter((c) => c.verdict === 'answering').length,
    silent: claims.filter((c) => c.verdict === 'silent'),
    full: measured.filter((c) => c.sample.kind === 'measured' && c.sample.share === 1),
    minPct: shares.length ? pct(Math.min(...shares)) : null,
    maxPct: shares.length ? pct(Math.max(...shares)) : null,
  }
}

/**
 * The city list, derived from the same array the count is derived from, so the
 * two cannot disagree inside one sentence the way the hand-written ten did.
 * Registry order — the order the old list was written in, and the order the
 * cities page renders.
 */
export function citiesSentence(claims: CityClaim[] = CITY_CLAIMS): string {
  const names = claims.map((c) => c.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * The measured spread, in one sentence. Says what was sampled and over what, so
 * the percentages are never the only thing on offer.
 */
export function rangeSentence(claims: CityClaim[] = CITY_CLAIMS): string {
  const f = coverageFacts(claims)
  if (f.minPct === null || f.maxPct === null)
    return 'No city has been sampled yet, so there is no measured rate to report.'
  const spread =
    f.minPct === f.maxPct
      ? `was ${f.minPct}% in every city`
      : `runs from ${f.minPct}% to ${f.maxPct}% depending on the city`
  return `On a live sample of each city’s own parcels, the share for which we could actually resolve a zoning envelope ${spread}.`
}

/**
 * The cities where the sample produced nothing — named, because "some cities
 * are weaker" is not something a reader can act on and "Nashville, San Diego
 * and San Jose" is. Empty string when there are none, so the clause disappears
 * from every surface the day the measurement changes.
 */
export function silentSentence(claims: CityClaim[] = CITY_CLAIMS): string {
  const { silent } = coverageFacts(claims)
  if (silent.length === 0) return ''
  const names = silent.map((c) => c.name)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const verb = names.length === 1 ? 'is' : 'are'
  return `${list} ${verb} wired and not yet answering: no sampled parcel there resolved one.`
}

/**
 * What we do when the envelope does not resolve — the sentence that stops a low
 * rate reading as "expect a wrong answer". Same claim /math already makes, kept
 * here so the two cannot drift.
 */
export const WITHHELD_SENTENCE =
  'Where it does not resolve we say so rather than assume a limit, so a low rate means “expect to be told we don’t know,” not “expect a wrong answer.”'
