import { describe, it, expect } from 'vitest'
import {
  classify,
  reliability,
  reliabilityCell,
  reliabilitySummary,
  failureCeiling,
  sampleCity,
  type Prober,
  type Reliability,
} from './null-inventory'
import type { ParcelResult } from '../netlify/functions/lib/parcel'

// WHAT THESE TESTS DEFEND
//
// `probe()` retried up to 3× on `districtCode: 'Unknown'` and returned the first
// clean result. That is rule 10 done right for the RECORDED verdict — a transient
// failure must not be written down as a permanent one. But the retry was ALSO the
// only place a failure was ever observed, and nothing counted it. Phoenix fails
// about one call in five; three tries hide that on ~99% of runs, so
// `docs/NULL-INVENTORY.md` published 23 of 23 cities clean while one was failing
// 19% of requests. The instrument measured the best case and reported it as the
// state.
//
// The rule under test, in one line: **a city that needed a retry must not render
// identically to one that did not.** Everything below is that property, plus
// rule 20 on the fix itself — the new accounting must not be able to pass by
// finding nothing.
//
// The prober is stubbed on purpose. The accounting is the part that was broken,
// and it must be checkable without hitting a live service and hoping a city
// misbehaves on the run where someone happens to be looking.

/** A clean result: parcel found, district resolved. */
const ok = (districtCode: string, parcelId = 'P1', sizeSqFt = 7000) =>
  ({ ok: true, info: { parcelId, lot: { sizeSqFt }, zoning: { districtCode } } }) as unknown as ParcelResult

/** The Phoenix-shaped failure: the call SUCCEEDS, finds the right parcel, and
 *  reports `Unknown` for the district. It is `ok: true`, which is why it slid
 *  past every guard that keyed on `!r.ok`. */
const unknown = (parcelId = 'P1', sizeSqFt = 7000) => ok('Unknown', parcelId, sizeSqFt)

const err = () =>
  ({ ok: false, code: 'NO_PARCEL', message: 'none', status: 404 }) as unknown as ParcelResult

/** Replays a fixed script of results, and counts how many times it was called. */
function stub(script: ParcelResult[]) {
  const calls: string[] = []
  const prober: Prober = async (city) => {
    calls.push(city)
    return script[Math.min(calls.length - 1, script.length - 1)]
  }
  return { prober, calls }
}

const sample = (script: ParcelResult[], calls = 6) =>
  sampleCity('phoenix', 33.49, -112.08, { calls, gapMs: 0, prober: stub(script).prober })

describe('the recorded verdict — rule 10 still stands', () => {
  it('records the first CLEAN call, not the transient Unknown that preceded it', async () => {
    const { recorded } = await sample([unknown(), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6')])
    expect(recorded?.ok).toBe(true)
    // The whole reason the retry exists. Deleting the retry would make this
    // 'Unknown' and record a transient failure as a permanent one.
    expect(recorded && recorded.ok && recorded.info.zoning.districtCode).toBe('R1-6')
  })

  it('falls back to the last result when nothing ever came back clean', async () => {
    const { recorded } = await sample([unknown()])
    expect(recorded?.ok).toBe(true)
    expect(recorded && recorded.ok && recorded.info.zoning.districtCode).toBe('Unknown')
  })
})

describe('the retry is now COUNTED — the defect this file exists for', () => {
  it('a city needing a retry does not render identically to one that did not', async () => {
    const healthy = reliability((await sample([ok('R1-6')])).calls)
    const flaky = reliability(
      (await sample([unknown(), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6')])).calls,
    )

    // Both produce the same recorded district — that is the retry working, and it
    // is exactly why the two rows used to be indistinguishable.
    expect(reliabilityCell(healthy)).toBe('6/6')
    expect(reliabilityCell(flaky)).not.toBe(reliabilityCell(healthy))
    // Equal denominators, or the comparison means nothing. An early exit would
    // hand the healthy city a sample of 1 and the flaky one a sample of 2 —
    // sample sizes chosen by the outcome, which is not a rate.
    expect(flaky.calls).toBe(healthy.calls)
    expect(reliabilityCell(flaky)).toContain('5/6')
    expect(reliabilityCell(flaky)).toContain('first clean on call 2')
  })

  it('keeps sampling AFTER the first clean call — no early exit', async () => {
    // An early exit samples until the answer is good and then reports it, which
    // biases the estimate towards success by construction: a city that failed
    // once and then succeeded would score 1/2, and one that succeeded first time
    // would score 1/1, on samples of different sizes chosen by the outcome.
    const s = stub([ok('R1-6')])
    await sampleCity('phoenix', 1, 2, { calls: 6, gapMs: 0, prober: s.prober })
    expect(s.calls).toHaveLength(6)
  })

  it('counts a Phoenix-rate failure even though every call returned ok:true', async () => {
    // The failure mode that survived: `ok: true`, right parcel, `Unknown`
    // district. Identity is stable, so the old stability check passed it.
    const rel = reliability((await sample([unknown(), unknown(), ok('R1-6')])).calls)
    expect(rel.stable).toBe(true) // same parcel every time — genuinely stable
    expect(rel.clean).toBe(4) // and still not clean on two of six
    expect(rel.firstCleanAt).toBe(3)
  })

  it('names the intermittent city in the summary, with its rate', () => {
    const rows = [
      { city: 'boston', rel: reliability(Array(6).fill(classify(ok('MFR/LS')))) },
      { city: 'phoenix', rel: reliability([unknown(), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6'), ok('R1-6')].map(classify)) },
    ]
    const out = reliabilitySummary(rows)
    expect(out).toContain('phoenix 5/6')
    expect(out).toContain('INTERMITTENT')
    expect(out).not.toContain('boston 5/6')
  })
})

describe('rule 20 — the new accounting cannot pass by finding nothing', () => {
  it('an empty run is LOUD, not clean', () => {
    const out = reliabilitySummary([])
    expect(out).toContain('NO OBSERVATIONS RECORDED')
    expect(out).toContain('do not publish this file')
  })

  it('a city sampled zero times is not reported as stable or clean', () => {
    const none = reliability([])
    expect(none.stable).toBe(false)
    expect(none.clean).toBe(0)
    expect(reliabilityCell(none)).toBe('**NOT SAMPLED**')
    // and it must not be silently absent from the summary either
    expect(reliabilitySummary([{ city: 'phoenix', rel: none }])).toContain('NO OBSERVATIONS RECORDED')
  })

  it('flags an unsampled city even when other cities carry the run', () => {
    const rows = [
      { city: 'boston', rel: reliability(Array(6).fill(classify(ok('MFR/LS')))) },
      { city: 'phoenix', rel: reliability([]) },
    ]
    const out = reliabilitySummary(rows)
    expect(out).toContain('NOT SAMPLED')
    expect(out).toContain('phoenix')
    expect(out).toContain('An unsampled city is not a clean one.')
  })

  it('the all-clean summary states its denominator and refuses to claim zero', () => {
    const rows = ['boston', 'nyc'].map((city) => ({
      city,
      rel: reliability(Array(6).fill(classify(ok('R6B')))),
    }))
    const out = reliabilitySummary(rows)
    // The denominator is the check. "clean" with no denominator is what an empty
    // sample also renders as.
    expect(out).toContain('2 cities × 6 isolated calls = 12 observations')
    expect(out).toContain('not as "the failure')
    expect(out).toContain('39.3%') // the 95% one-sided ceiling on 6 clean calls
  })

  it('the failure ceiling makes a small sample honest about what it proves', () => {
    // A single clean call bounds nothing useful; the bound tightens slowly.
    expect(failureCeiling(1)).toBeCloseTo(0.95, 5)
    expect(failureCeiling(6)).toBeCloseTo(0.3930, 3)
    expect(failureCeiling(0)).toBe(1)
    // And crucially: 6 clean calls do NOT rule out Phoenix's real 19% rate.
    expect(failureCeiling(6)).toBeGreaterThan(0.19)
  })
})

describe('classification and the identity axis', () => {
  it('separates a failed call, an Unknown district, and a clean resolve', () => {
    expect(classify(err())).toEqual({ outcome: 'error', identity: 'ERR' })
    expect(classify(unknown())).toEqual({ outcome: 'unknown-district', identity: 'P1/7000' })
    expect(classify(ok('R1-6'))).toEqual({ outcome: 'clean', identity: 'P1/7000' })
  })

  it('still detects the San Diego overlapping-polygon case from the same sample', () => {
    // Four calls, two parcelIds, four lot sizes — the old probe's actual output.
    const rel = reliability(
      [ok('RS-1-7', '5861800900', 97106), ok('RS-1-7', '4174800800', 39615),
        ok('RS-1-7', '5861800900', 21389), ok('RS-1-7', '4174800800', 8500)].map(classify),
    )
    expect(rel.stable).toBe(false)
    expect(rel.identities).toHaveLength(4)
    // Fully clean on the resolution axis while unstable on identity — the two
    // axes are independent, which is what let the Phoenix failure hide behind a
    // stability check that only ever looked at parcel identity.
    expect(rel.clean).toBe(4)
    expect(reliabilityCell(rel)).toBe('4/4')
  })

  it('reports a city that never came back clean as never, not as missing', async () => {
    const rel: Reliability = reliability((await sample([err()])).calls)
    expect(reliabilityCell(rel)).toContain('never clean')
    const out = reliabilitySummary([{ city: 'phoenix', rel }])
    expect(out).toContain('phoenix 0/6')
    expect(out).toContain('never came back clean')
  })
})
