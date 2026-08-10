import { describe, it, expect, vi, afterEach } from 'vitest'
// @ts-expect-error — plain .mjs, no types; the shape it emits is
// netlify/functions/lib/feedCounts.ts and is asserted from the artifact side in
// netlify/functions/lib/timeline.test.ts and relief.test.ts.
import { assertFeedCounts, feedCounts, probeFeedTotal } from './feedCounts.mjs'

// The row-count recorder every extraction script writes through.
//
// What is being defended here is not arithmetic — the counts come from live
// endpoints and cannot be unit-tested — but the two properties that made the
// hand-written nashville.mjs comment unusable and this module's shape a
// deliberate answer to it:
//
//   1. A count cannot be recorded without saying WHICH count it is. The comment
//      said "28,571 rows total" and a reader cannot recover whether that was the
//      whole layer or the script's own pull. Here the two live under separate
//      required names and neither can be written alone.
//   2. A failed probe is a null with a reason, never a number. A count probe
//      that errors must not silently become "the feed is empty" — the failure
//      this repo keeps correcting (rule 5: a failed fetch must never quietly
//      become a substantive answer).

const valid = () => ({
  totals: [{ endpoint: 'data.example.gov/resource/abcd-1234', totalRows: 2_369_500 }],
  cohortRows: 18_270,
  basis: 'totalRows: whole resource. cohortRows: the window + filters.',
  observedAt: '2026-08-10',
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('feedCounts — the two counts cannot be conflated or written alone', () => {
  it('emits both counts under separate names', () => {
    const r = feedCounts(valid())
    expect(r.totals[0].totalRows).toBe(2_369_500)
    expect(r.cohortRows).toBe(18_270)
    // The distinction is the whole point: they must not be the same field, and
    // the total must not be reachable without knowing it is the total.
    expect(Object.keys(r).sort()).toEqual(['basis', 'cohortRows', 'observedAt', 'totals'])
  })

  it('REFUSES a feed total with no cohort count', () => {
    const { cohortRows: _drop, ...withoutCohort } = valid()
    void _drop
    expect(() => feedCounts(withoutCohort)).toThrow(/cohortRows/)
  })

  it('REFUSES a cohort count with no feed total', () => {
    expect(() => feedCounts({ ...valid(), totals: [] })).toThrow(/totals/)
  })

  it('REFUSES a record with no basis — an unlabelled number is the defect', () => {
    expect(() => feedCounts({ ...valid(), basis: '   ' })).toThrow(/basis/)
  })

  it('keeps one entry per endpoint, so a two-feed script stays diffable per feed', () => {
    const r = feedCounts({
      ...valid(),
      totals: [
        { endpoint: 'phl.carto.com permits', totalRows: 10 },
        { endpoint: 'eCLIPSE/FeatureServer/0', totalRows: 20 },
      ],
    })
    expect(r.totals.map((t: { endpoint: string }) => t.endpoint)).toEqual([
      'phl.carto.com permits',
      'eCLIPSE/FeatureServer/0',
    ])
  })

  it('REFUSES two entries for one endpoint — the diff would be ambiguous', () => {
    expect(() =>
      feedCounts({
        ...valid(),
        totals: [
          { endpoint: 'same', totalRows: 10 },
          { endpoint: 'same', totalRows: 20 },
        ],
      }),
    ).toThrow(/duplicate endpoint/)
  })

  it('REFUSES a non-ISO observedAt — the date is what a diff anchors on', () => {
    expect(() => feedCounts({ ...valid(), observedAt: 'August 2026' })).toThrow(/observedAt/)
  })
})

describe('a null total must carry its reason, and must never be a number', () => {
  it('accepts totalRows: null WITH an `unavailable` reason', () => {
    const r = feedCounts({
      ...valid(),
      totals: [{ endpoint: 'x', totalRows: null, unavailable: 'count probe threw: HTTP 503' }],
    })
    expect(r.totals[0].totalRows).toBeNull()
    expect(r.totals[0].unavailable).toMatch(/503/)
  })

  it('REFUSES totalRows: null with no reason — that is a gap dressed as an answer', () => {
    expect(() =>
      feedCounts({ ...valid(), totals: [{ endpoint: 'x', totalRows: null }] }),
    ).toThrow(/unavailable/)
  })
})

describe('probeFeedTotal — a broken probe cannot break the pipeline, or lie about it', () => {
  it('returns the count when the probe succeeds', async () => {
    const t = await probeFeedTotal('endpoint-a', async () => 1234)
    expect(t).toEqual({ endpoint: 'endpoint-a', totalRows: 1234 })
  })

  it('coerces the numeric strings Socrata returns for count(1)', async () => {
    const t = await probeFeedTotal('endpoint-a', async () => '2369500')
    expect(t.totalRows).toBe(2_369_500)
  })

  it('records a THROWN probe as null-with-reason, and does not rethrow', async () => {
    const t = await probeFeedTotal('endpoint-a', async () => {
      throw new Error('HTTP 503 Service Unavailable')
    })
    expect(t.totalRows).toBeNull()
    expect(t.unavailable).toMatch(/503/)
  })

  // The failure mode this exists to prevent: a probe that comes back with
  // something that is not a count must not be coerced to 0, because 0 reads as
  // "the feed emptied" — a finding — where the truth is "we did not measure it".
  it.each([undefined, null, {}, 'nope', -1, 1.5, NaN])(
    'records %s as an UNKNOWN rather than coercing it to a count',
    async (bad) => {
      const t = await probeFeedTotal('endpoint-a', async () => bad)
      expect(t.totalRows).toBeNull()
      expect(t.unavailable).toBeTruthy()
    },
  )

  it('a failed probe still produces a WRITABLE record — instrumentation never blocks a run', async () => {
    const totals = [await probeFeedTotal('endpoint-a', async () => Promise.reject(new Error('down')))]
    expect(() => feedCounts({ ...valid(), totals })).not.toThrow()
  })
})

describe('assertFeedCounts is the single definition the artifact is checked against', () => {
  it('accepts what feedCounts builds', () => {
    expect(() => assertFeedCounts(feedCounts(valid()), 'fixture')).not.toThrow()
  })

  it('names the offending location in the message', () => {
    expect(() => assertFeedCounts({ ...valid(), cohortRows: -1 }, 'permitStats.austin')).toThrow(
      /permitStats\.austin\.cohortRows/,
    )
  })

  it.each([null, undefined, 42, 'feed', []])('rejects %s as a feed block', (bad) => {
    expect(() => assertFeedCounts(bad, 'fixture')).toThrow()
  })
})
