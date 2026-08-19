import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  classify, diffable, ADEQUATE_SPAN_DAYS, NEAR_STATIC_TOLERANCE,
  type Observation, type SourceExpectation, type Verdict,
} from './lib/sourceStability'

const appendMostly: SourceExpectation = {
  id: 'x', kind: 'permit-feed', expected: 'append-mostly',
  why: 'fixed lower-bound window over an append-mostly feed',
}
const nearStatic: SourceExpectation = {
  id: 'y', kind: 'zoning-roster', expected: 'near-static',
  why: 'a roster gains an entry when a rezoning is adopted',
}
const o = (on: string, n: number): Observation => ({ on, n, from: 'test' })

describe('the default is insufficient, and it is not a soft stable', () => {
  it('refuses a source nobody has observed', () => {
    const v = classify(nearStatic, [])
    expect(v.klass).toBe('insufficient')
    expect(diffable(v)).toBe(false)
  })

  it('refuses a source observed exactly once', () => {
    // rule 10: one probe is not evidence. A register that promoted on a single
    // observation would green-light every source the day it was written.
    const v = classify(nearStatic, [o('2026-08-19', 100)])
    expect(v.klass).toBe('insufficient')
    expect(v.detail).toMatch(/one probe is not evidence/)
    expect(diffable(v)).toBe(false)
  })
})

describe('direction is what gives the test its power', () => {
  it('refutes an append-mostly source that shrank, at any magnitude', () => {
    // NYC: 4,394 → 1,040 → 8,103 on one unchanged query. The refutation is the
    // DIRECTION — a fixed lower-bound window cannot lose rows by gaining data —
    // so it does not depend on picking a threshold.
    const v = classify(appendMostly, [o('2026-08-06', 4394), o('2026-08-09', 1040), o('2026-08-18', 8103)])
    expect(v.klass).toBe('unstable')
    expect(v.detail).toMatch(/SHRANK/)
    expect(diffable(v)).toBe(false)
  })

  it('confirms an append-mostly source that grew a little', () => {
    // Austin: +1.0% over twelve days, medians unmoved. Same script, same query.
    const v = classify(appendMostly, [o('2026-08-06', 11534), o('2026-08-18', 11650)])
    expect(v.klass).toBe('stable')
    expect(v.evidence).toBe('adequate')
    expect(diffable(v)).toBe(true)
  })

  it('and a one-row DROP refutes where a large rise does not', () => {
    // The asymmetry is the point: growth is what the feed is supposed to do.
    expect(classify(appendMostly, [o('a', 100), o('b', 99)]).klass).toBe('unstable')
    expect(classify(appendMostly, [o('2026-01-01', 100), o('2026-06-01', 400)]).klass).toBe('stable')
  })
})

describe('a near-static source is judged on magnitude, not direction', () => {
  it('tolerates the single Dallas code that appeared', () => {
    // 1,077 → 1,078 in two days: one new planned development, which is exactly
    // the change an alert SHOULD fire on and not evidence the feed is unstable.
    const v = classify(nearStatic, [o('2026-08-17', 1077), o('2026-08-19', 1078)])
    expect(v.klass).toBe('stable')
    expect(1 / 1077).toBeLessThan(NEAR_STATIC_TOLERANCE)
  })

  it('refutes a roster that moved more than a rezoning could explain', () => {
    const v = classify(nearStatic, [o('2026-08-17', 100), o('2026-08-19', 130)])
    expect(v.klass).toBe('unstable')
    expect(v.detail).toMatch(/30\.0%/)
  })

  it('refutes movement in EITHER direction, unlike append-mostly', () => {
    expect(classify(nearStatic, [o('a', 100), o('b', 70)]).klass).toBe('unstable')
    expect(classify(nearStatic, [o('a', 100), o('b', 130)]).klass).toBe('unstable')
  })
})

describe('⚠️ how strong the evidence is, said on the verdict', () => {
  it('marks a short interval weak even when the verdict is stable', () => {
    // A near-static source holding still for two days is close to vacuous — it
    // would read identically if the service were quietly serving a cached
    // snapshot. Saying so on the verdict is what stops `stable` being read as
    // "settled".
    const v = classify(nearStatic, [o('2026-08-17', 100), o('2026-08-19', 100)])
    expect(v.klass).toBe('stable')
    expect(v.evidence).toBe('weak-short-interval')
    expect(v.spanDays).toBe(2)
  })

  it('and adequate once the span reaches the one measured here', () => {
    const v = classify(nearStatic, [o('2026-08-06', 100), o('2026-08-18', 100)])
    expect(v.spanDays).toBe(ADEQUATE_SPAN_DAYS)
    expect(v.evidence).toBe('adequate')
  })

  it('does not let weak evidence silently block diffing — that is the caller\'s call', () => {
    // Deliberate: refusing everything for twelve days would mean the register
    // could never let anything through on the day it was written. The limit is
    // reported loudly instead of encoded as a permanent refusal.
    const weak = classify(nearStatic, [o('2026-08-17', 100), o('2026-08-19', 100)])
    expect(diffable(weak)).toBe(true)
    expect(weak.evidence).toBe('weak-short-interval')
  })
})

describe('the committed register', () => {
  const path = join(resolve(__dirname, '..'), 'scripts/__fixtures__/sourceStability.json')

  it('exists and is not empty — a register with nothing in it classifies nothing', () => {
    expect(existsSync(path)).toBe(true)
    const reg = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      { expectation: SourceExpectation; observations: Observation[] }
    >
    // rule 20: pin the inventory. A register that silently stopped being written
    // would otherwise pass every assertion below by having nothing to check.
    expect(Object.keys(reg).length).toBe(20)
    expect(Object.keys(reg).filter((k) => k.startsWith('zoning-roster:'))).toHaveLength(18)
    expect(Object.keys(reg).filter((k) => k.startsWith('permit-feed:'))).toHaveLength(2)
  })

  it('classifies NYC unstable and Austin diffable, from the stored numbers', () => {
    const reg = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      { expectation: SourceExpectation; observations: Observation[] }
    >
    const v = (id: string): Verdict => classify(reg[id].expectation, reg[id].observations)
    expect(v('permit-feed:nyc').klass).toBe('unstable')
    expect(v('permit-feed:austin').klass).toBe('stable')
    // The one real identity change across the whole zoning sweep: Dallas gained
    // a planned development between the two vintages.
    const dallas = reg['zoning-roster:dallas'].observations.at(-1)!
    expect(dallas.added).toEqual(['PD-1144'])
    expect(dallas.removed).toEqual([])
  })

  it('and every expectation states WHY, so no prior is a bare guess', () => {
    const reg = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      { expectation: SourceExpectation; observations: Observation[] }
    >
    for (const [id, v] of Object.entries(reg)) {
      expect(v.expectation.why.length, id).toBeGreaterThan(40)
      expect(v.observations.length, id).toBeGreaterThan(0)
    }
  })
})
