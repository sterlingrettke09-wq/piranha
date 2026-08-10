import { describe, it, expect } from 'vitest'
import { reliefOddsFor, _parseStats } from './relief'
import reliefStats from './data/reliefStats.json'
// @ts-expect-error — plain .mjs, no types. Imported from the WRITER on purpose:
// the artifact is checked against the same definition the extraction scripts
// enforce, not a second copy of it that can drift.
import { assertFeedCounts } from '../../../scripts/lib/feedCounts.mjs'

// Cities the committed artifact actually carries. Kept in sync with whatever the
// offline pipeline landed — the loose shape assertions below stay valid across a
// quarterly refresh (rates and n drift; the contract doesn't).
const PRESENT = Object.keys(reliefStats).filter(
  (c) => (reliefStats as Record<string, { variance?: unknown }>)[c]?.variance,
)

describe('reliefOddsFor', () => {
  it('returns undefined for a city with no relief data', () => {
    expect(reliefOddsFor('atlantis')).toBeUndefined()
    expect(reliefOddsFor('')).toBeUndefined()
  })

  it('every present city has a quarterly-refresh-safe shape', () => {
    // At least the two spec cities (Boston, SF) should be present; guard so the
    // suite fails loudly if the artifact is ever emptied by accident.
    expect(PRESENT.length).toBeGreaterThanOrEqual(2)
    for (const city of PRESENT) {
      const odds = reliefOddsFor(city)
      expect(odds, `${city} should resolve`).toBeDefined()
      if (!odds) continue
      expect(odds.grantRate).toBeGreaterThan(0)
      expect(odds.grantRate).toBeLessThanOrEqual(1)
      expect(odds.n).toBeGreaterThanOrEqual(100) // the pipeline's n ≥ 100 gate
      expect(Number.isInteger(odds.n)).toBe(true)
      expect(typeof odds.window).toBe('string')
      expect(odds.window.length).toBeGreaterThan(0)
      expect(typeof odds.vintage).toBe('string')
      expect(odds.vintage.length).toBeGreaterThan(0)
      if (odds.label !== undefined) {
        expect(typeof odds.label).toBe('string')
        expect(odds.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('cities whose denominator is not plain "variance requests" MUST carry a label', () => {
    // The realityCheck card renders `label ?? 'variance requests'`. For NYC
    // (BZ calendar: variances + §73 special permits), DC (whole-board:
    // variances + special exceptions) and Charlotte (Board of Adjustment
    // variances ONLY — see below) the fallback would be a FALSE published
    // claim, so a missing label on these entries is an impossible state, not a
    // style choice. If a quarterly refresh ever drops the label, this fails
    // before the false line ships.
    for (const city of ['nyc', 'dc', 'charlotte'] as const) {
      const odds = reliefOddsFor(city)
      expect(odds, `${city} should be present`).toBeDefined()
      expect(odds?.label, `${city} must label its denominator`).toBeTruthy()
      // And the label must not itself claim variances-only.
      expect(odds?.label).not.toBe('variance requests')
    }
  })

  it("charlotte's label carries the track EXCLUSION, not just a wider track", () => {
    // NYC and DC label a denominator that is BROADER than variances. Charlotte
    // is the opposite failure mode: its feed also carries the staff
    // administrative-adjustment track, which runs 99.2% and which the pipeline
    // deliberately excludes (UDO 37.4.A.4.b — an objection by anyone with
    // standing means "the administrative adjustment shall be denied and the
    // applicant may file for a variance", so the staff track is the
    // consent-filtered residue, not a lenient board). Pooling it in would
    // publish ~96.4% instead of 92.3%.
    //
    // So the rendered line must say WHICH BODY decided the cases counted.
    // A bare "variance requests" here would be a pooled-rate-with-an-unpooled-
    // label claim — true of neither track — which is exactly the defect that
    // got five permit figures withdrawn.
    const odds = reliefOddsFor('charlotte')
    expect(odds?.label).toBe('Board of Adjustment variances')
  })

  it('reads the JSON-shape contract from an injected fixture', () => {
    // Exercises the parse/lookup path independent of whatever the live artifact
    // currently holds (quarterly-refresh-safe; also the fallback when no city
    // has landed real data yet).
    const fixture = _parseStats({
      testville: { variance: { grantRate: 0.5, n: 200, window: '2022–2026', vintage: 'fixture' } },
    })
    const odds = reliefOddsFor('testville', fixture)
    expect(odds).toEqual({ grantRate: 0.5, n: 200, window: '2022–2026', vintage: 'fixture' })
    expect(reliefOddsFor('nowhere', fixture)).toBeUndefined()
  })

  it('_parseStats tolerates an empty / nullish artifact', () => {
    expect(reliefOddsFor('boston', _parseStats({}))).toBeUndefined()
    expect(reliefOddsFor('boston', _parseStats(null))).toBeUndefined()
    expect(reliefOddsFor('boston', _parseStats(undefined))).toBeUndefined()
  })
})

// ── Feed row counts: optional, never backfilled, never unlabelled ────────────
// The relief half of the same contract asserted in timeline.test.ts. See
// netlify/functions/lib/feedCounts.ts for what the two counts mean; the
// validator comes from the WRITER (scripts/lib/feedCounts.mjs) so the artifact
// and the scripts cannot drift apart on what "valid" means.
describe('feed row counts in reliefStats.json', () => {
  type FeedBlock = { observedAt: string; cohortRows: number; totals: unknown[]; basis: string }
  const entries = Object.entries(
    reliefStats as Record<string, { variance?: { vintage: string }; feed?: FeedBlock }>,
  )

  // Entries written before the instrumentation landed carry no `feed`, and they
  // are deliberately NOT backfilled — a count taken today is not the count at
  // that extract's vintage. An absent block is a valid, visibly unpopulated one.
  it('the field is OPTIONAL — an entry without one is valid', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const [city, entry] of entries) {
      if (entry.feed === undefined) continue
      expect(typeof entry.feed, `${city}.feed`).toBe('object')
    }
  })

  it('every feed block present is well-formed by the writer’s own definition', () => {
    for (const [city, entry] of entries) {
      if (!entry.feed) continue
      expect(() => assertFeedCounts(entry.feed, `reliefStats.${city}.feed`)).not.toThrow()
    }
  })

  // THE ANTI-BACKFILL GUARD — see the twin in timeline.test.ts for why this is a
  // structure rather than a note: a block written by a different run than the
  // figure beside it is a provenance claim about a run that did not make it.
  it('observedAt matches the vintage’s compute date — a backfilled count fails here', () => {
    for (const [city, entry] of entries) {
      if (!entry.feed || !entry.variance) continue
      const computed = /computed (\d{4}-\d{2}-\d{2})/.exec(entry.variance.vintage)?.[1]
      expect(computed, `${city}.variance.vintage must state a compute date`).toBeTruthy()
      expect(
        entry.feed.observedAt,
        `${city}.feed.observedAt (${entry.feed.observedAt}) must equal the vintage's compute ` +
          `date (${computed}).`,
      ).toBe(computed)
    }
  })
})
