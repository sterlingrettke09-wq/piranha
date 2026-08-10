import { describe, it, expect } from 'vitest'
import { storyFor, parkingClause } from './cityStories'
import { computeRedTapeIndex, type RankedCity } from './redTapeIndex'
import { PARKING_RULES } from '../config/parkingRules'
import { cityName } from '../config/cities'

const ranked = computeRedTapeIndex()
const byCity = (slug: string): RankedCity => {
  const c = ranked.find((r) => r.slug === slug)
  if (!c) throw new Error(`no ranked city ${slug}`)
  return c
}

describe('storyFor', () => {
  it('produces a non-empty plain string for every city, no throws', () => {
    for (const c of ranked) {
      const story = storyFor(c, ranked)
      expect(typeof story).toBe('string')
      expect(story.length).toBeGreaterThan(40)
      // House voice: no exclamation marks anywhere.
      expect(story).not.toContain('!')
      // The city's own name leads or appears in its story.
      expect(story).toContain(cityName(c.slug))
    }
  })

  // ── Branch 1: MEASURED permit time leads ─────────────────────────────────
  // ⚠️ Chicago's 1-month median was WITHDRAWN 2026-08-05: 46% of the sample was a
  // 2022-23 cohort stamped applied==issued. The "fastest we measure" superlative
  // it carried was an artifact of that, and this test was pinning it.
  it('Chicago no longer carries a measured median or the fastest superlative', () => {
    const chicago = byCity('chicago')
    const story = storyFor(chicago, ranked)
    expect(chicago.measuredMedianMonths).toBeNull()
    expect(story).not.toContain('the fastest we measure')
    // The real relief adder (3 months) is interpolated, not invented.
    expect(story).toContain('3 months')
  })

  // SF held "the slowest we measure" only because it WAS the slowest city we had
  // data for. Measuring Miami (12.1 mo) in 2026-08 took that title, and the copy
  // correctly stopped claiming it. The superlative is computed from the measured
  // set, so it moves whenever the set grows — a test asserting it belongs to one
  // named city is pinning a fact about our COVERAGE, not about San Francisco.
  // ⚠️ SF's measurement was WITHDRAWN 2026-08-06: only 37.7% of its
  // new-construction filings carry an issue date at extract (matured 2022 cohort:
  // single 32.4%, multi 23.4%, apartment 44.4%), so the unconditional median does
  // not exist — the 50th percentile is past the last observation. Its story now
  // falls back to the lifecycle estimate. State the SHARE, not the FATE: the feed
  // does not distinguish a not-yet from a never, so "ever issue" is retracted
  // phrasing (2026-08-08). The median is undefined either way.
  it('SF renders no measured median — most of its filings carry no issue date', () => {
    const sf = byCity('sf')
    const story = storyFor(sf, ranked)
    expect(sf.measuredMedianMonths).toBeNull()
    expect(story).not.toContain('the slowest we measure')
  })
  it('LA no longer renders a measured median — 45% of its cohort has no issue date', () => {
    const la = byCity('la')
    const story = storyFor(la, ranked)
    expect(la.measuredMedianMonths).toBeNull()
    expect(story).not.toContain('about 6 months')
  })

  // ── Branch 2: RELIEF grant rate (says-yes angle) ─────────────────────────
  it('uses the says-yes angle with the real grant rate (Boston, 93%)', () => {
    const boston = byCity('boston')
    // Boston has no measured permit median, so the relief branch wins.
    expect(boston.measuredMedianMonths).toBeNull()
    expect(boston.reliefGrantRate).not.toBeNull()
    const story = storyFor(boston, ranked)
    expect(story).toContain('93%')
    expect(story).toContain('says yes')
    // The real by-right lifecycle (44 months) is interpolated.
    expect(story).toContain('about 44 months')
  })

  // ── Branch 3: PARKING leads (tailwind angle) ─────────────────────────────
  it('uses the parking tailwind for abolished cities without measured data (Minneapolis)', () => {
    const mpls = byCity('minneapolis')
    expect(mpls.measuredMedianMonths).toBeNull()
    expect(mpls.reliefGrantRate).toBeNull()
    expect(mpls.parkingStatus).toBe('abolished')
    const story = storyFor(mpls, ranked)
    // The city's OWN headline, verbatim — not a sentence synthesised from the
    // status. Was `toContain('abolished parking minimums')`, which passed
    // against a phrase the code manufactured rather than one anyone verified.
    expect(story).toContain(PARKING_RULES.minneapolis.headline)
    // Lifecycle (38) and lifecycle+relief (41) both interpolated.
    expect(story).toContain('about 38 months')
    expect(story).toContain('about 41 months')
  })

  // ── Branch 4: FALLBACK from lifecycle months alone ───────────────────────
  it('falls back to the lifecycle line for a city with no extras (DC)', () => {
    const dc = byCity('dc')
    // DC: no measured permit data, no relief stat, partial (not abolished) parking.
    expect(dc.measuredMedianMonths).toBeNull()
    expect(dc.reliefGrantRate).toBeNull()
    expect(dc.parkingStatus).not.toBe('abolished')
    const story = storyFor(dc, ranked)
    expect(story).toContain('about 40 months')
    expect(story).toContain('land, not the labor')
    // The real variance adder (5 months) is interpolated.
    expect(story).toContain('5 months')
  })

  // ⚠️ NYC WITHDRAWN 2026-08-09 — this test is back to asserting the 54-month
  // LIFECYCLE estimate, which is what it asserted before 2026-08-06.
  //
  // Between those dates it asserted "about 8 months", on the strength of median
  // 8.3 over n=4,403 DOB NOW initial New Building filings. That figure was a
  // CONDITIONAL median — time to issuance GIVEN issuance — over a cohort in which
  // 45% of filings carried no issue date at extract, against a Kaplan-Meier
  // estimate of ~15.9 months over the same filings. The condition existed only in
  // the artifact's `vintage` string, and this sentence renders none of it: the
  // story said New York City "issues a new-construction permit in about 8
  // months", flatly. `scripts/permits/nyc.mjs` now halts rather than republish it.
  //
  // The claim moved from "we counted" back to "we estimate", and the story has to
  // say so — an estimate labelled as one is honest; a censored measurement read
  // as a measurement is not. Note that 8 months is the FLATTERING direction: the
  // withdrawal makes NYC look slower, which is why nothing in the copy was
  // pushing back on it.
  it('falls back to the lifecycle estimate for NYC — its measured figure was withdrawn', () => {
    const nyc = byCity('nyc')
    expect(nyc.measuredMedianMonths).toBeNull()
    expect(nyc.measuredPermitN).toBeNull()
    const story = storyFor(nyc, ranked)
    expect(story).toContain('about 54 months')
    expect(story).not.toContain('about 8 months')
    // And it must not claim to issue a permit in any measured time at all.
    expect(story).not.toContain('issues a new-construction permit')
    // The real variance adder (7 months) is still interpolated, not invented.
    expect(story).toContain('7 months')
  })

  // ⚠️ SEATTLE WITHDRAWN 2026-08-09, hours after NYC and for the same defect
  // class. Its story said Seattle "issues a new-construction permit in about 6
  // months" off median 5.7 over n=4,996 — a CONDITIONAL median (74.71% of the
  // in-window cohort carried an issue date at extract; the file's own RESULTS
  // block recorded 74.1% while the query's `issueddate IS NOT NULL` limb kept
  // main() from seeing it). At 74.71% observed the p80 of 10.0 was unidentified,
  // and the median is not republished alone because no surface renders its
  // condition — the Milwaukee reason. Found by the outcome-selection guard's
  // exemption measurement, not by anyone auditing Seattle.
  //
  // Seattle has no relief stat and its parking record is `partial`, so the story
  // falls all the way to the lifecycle line — an estimate labelled as one.
  it('falls back to the lifecycle line for Seattle — its measured figure was withdrawn', () => {
    const seattle = byCity('seattle')
    expect(seattle.measuredMedianMonths).toBeNull()
    expect(seattle.measuredPermitN).toBeNull()
    const story = storyFor(seattle, ranked)
    expect(story).toContain('about 44 months')
    expect(story).not.toContain('about 6 months')
    // And it must not claim to issue a permit in any measured time at all.
    expect(story).not.toContain('issues a new-construction permit')
    // The real variance adder (9 months) is interpolated, not invented.
    expect(story).toContain('9 months')
  })

  // ── No fabrication: a synthetic bare city still works ─────────────────────
  it('handles a city with no extras at all without inventing numbers', () => {
    const bare: RankedCity = {
      ...byCity('dc'),
      slug: 'dc',
      measuredMedianMonths: null,
      measuredPermitN: null,
      reliefGrantRate: null,
      reliefN: null,
      parkingStatus: 'partial',
      lifecycleMonths: 40,
      reliefAddMonths: 5,
    }
    const story = storyFor(bare, [bare])
    expect(story).toContain('about 40 months')
    expect(story).not.toContain('NaN')
    expect(story).not.toContain('undefined')
  })

  it('never emits NaN or undefined for any real city', () => {
    for (const c of ranked) {
      const story = storyFor(c, ranked)
      expect(story).not.toContain('NaN')
      expect(story).not.toContain('undefined')
      expect(story).not.toContain('null')
    }
  })
})

/**
 * Words of a phrase, normalised so two strings compare on content rather than
 * punctuation. Same helper, same normalisation as the `parkingCell` regression
 * test in redTapeIndex.test.ts — the two checks guard the same defect on two
 * surfaces (the table cell and the prose), so they must decompose "CMX-4/CMX-5"
 * and "1–2 family" identically or one will pass what the other rejects.
 */
function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9½]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * ⚠️ THE REGRESSION TESTS for the second site of the status-drives-prose defect.
 *
 * `storyFor` branch 3 used to print a fixed sentence — "<City> abolished parking
 * minimums citywide, so nothing forces a garage under your units" — for any city
 * whose `parkingStatus` was `abolished`. That is the same collapse removed from
 * `parkingCell()` in redTapeIndex.ts, where `abolished` printed a year and every
 * other city printed the literal string "Near transit only".
 *
 * The rule enforced here is deliberately mechanical rather than a list of
 * approved sentences: every word the parking claim prints must appear in THAT
 * city's verified headline. A story may shorten its own headline; it may not add
 * a word to it. Any invented category fails immediately for every city whose
 * headline lacks those words, which is the point — enumerating mechanisms only
 * moves the defect to the city nobody enumerated.
 */
describe('parkingClause', () => {
  it('never prints a word absent from the city’s own headline — every rule in the table', () => {
    // Runs over PARKING_RULES, not just the ranked set, so a city that has a
    // verified parking record but no lifecycle constants yet is covered BEFORE
    // it enters the index. Raleigh is exactly that case today, and it is the
    // first `abolished` city whose headline is not "abolished citywide (year)".
    const template = byCity('minneapolis')
    const offenders: string[] = []
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      const city: RankedCity = {
        ...template,
        slug,
        parkingStatus: rule.status,
        parkingLabel: rule.cellLabel,
        parkingHeadline: rule.headline,
      }
      const clause = parkingClause(city)
      expect(clause, `${slug} produced no parking clause`).not.toBeNull()
      const allowed = new Set([
        ...contentWords(rule.headline),
        ...contentWords(cityName(slug)),
        ...contentWords('Parking in'),
      ])
      const invented = contentWords(clause!).filter((w) => !allowed.has(w))
      if (invented.length > 0) {
        offenders.push(
          `${slug}: clause "${clause}" asserts ${JSON.stringify(invented)}, absent from headline "${rule.headline}"`,
        )
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('covers Raleigh, which is not ranked yet', () => {
    // Guards the coverage claim above rather than the behaviour: if Raleigh ever
    // leaves PARKING_RULES, or gains lifecycle constants and starts being ranked,
    // this says so instead of the loop silently shrinking.
    expect(PARKING_RULES.raleigh).toBeTruthy()
    expect(PARKING_RULES.raleigh.status).toBe('abolished')
    expect(ranked.some((r) => r.slug === 'raleigh')).toBe(false)
  })

  it('every story that leads with parking carries its city’s headline verbatim', () => {
    for (const c of ranked) {
      const story = storyFor(c, ranked)
      const leadsWithParking =
        c.measuredMedianMonths == null &&
        c.reliefGrantRate == null &&
        c.parkingStatus === 'abolished'
      if (!leadsWithParking) continue
      expect(c.parkingHeadline, `${c.slug} has no headline`).not.toBeNull()
      expect(story, `${c.slug}`).toContain(c.parkingHeadline!)
      expect(story, `${c.slug}`).toContain(parkingClause(c)!)
    }
  })

  /**
   * PROOF THE TEST ABOVE HAS TEETH. No city in the table trips the old
   * implementation today — all six `abolished` headlines happen to contain the
   * words "abolished", "parking", "minimums" and "citywide" — which is precisely
   * why this went unnoticed and why the check has to run against a record that
   * does not exist yet rather than only against the ones that do.
   *
   * A city abolishing minimums for one district is an entirely ordinary record
   * (Philadelphia's CMX-4/CMX-5 is that shape already, at `partial`). Tag one
   * `abolished` and the shipped sentence claimed "citywide" from the category.
   */
  it('does not print a scope word the record withholds (a rule not yet in the table)', () => {
    const scoped: RankedCity = {
      ...byCity('minneapolis'),
      slug: 'minneapolis',
      parkingStatus: 'abolished',
      parkingLabel: 'Abolished for housing downtown; minimums remain elsewhere',
      parkingHeadline: 'Abolished for housing downtown; minimums remain elsewhere',
      measuredMedianMonths: null,
      measuredPermitN: null,
      reliefGrantRate: null,
      reliefN: null,
    }
    const story = storyFor(scoped, [scoped])
    // The record's own words survive, including the qualifying clause — the part
    // it is most tempting to drop, and dropping it is the same error one notch
    // smaller ("Abolished for housing downtown" alone reads as the whole city).
    expect(story).toContain('Abolished for housing downtown; minimums remain elsewhere')
    // And the words the CATEGORY used to supply are gone. Under the shipped
    // implementation this line failed: 'citywide' came from `parkingStatus`.
    expect(story.toLowerCase()).not.toContain('citywide')
    expect(story).not.toContain('abolished parking minimums citywide')
  })

  it('a city with no parking rule gets no parking clause, and never a synthesised one', () => {
    const bare: RankedCity = { ...byCity('dc'), parkingStatus: null, parkingHeadline: null }
    expect(parkingClause(bare)).toBeNull()
  })
})
