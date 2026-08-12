import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  readRequired,
  requestDeadline,
  upstreamUnavailable,
  REQUIRED_BUDGET_MS,
  type RequiredRead,
} from './requiredUpstream'

// This suite guards the helper 21 providers are meant to port to, so the
// assertions are on COUNTS and CONTENT rather than on "it didn't blow up".
// CLAUDE.md rule 20: a check that can pass by finding nothing is not a check —
// every test below pins how many attempts were actually made, so a fix that
// quietly stops retrying, or one that loops, goes red instead of green.

describe('readRequired', () => {
  afterEach(() => vi.restoreAllMocks())

  it('makes exactly one attempt when the read succeeds', async () => {
    let calls = 0
    const r = await readRequired('zoning', async () => {
      calls++
      return 'ok'
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toBe('ok')
    expect(r.attempts).toBe(1)
    expect(calls).toBe(1)
  })

  it('retries a transient failure and reports how many attempts it took', async () => {
    let calls = 0
    const r = await readRequired('zoning', async () => {
      calls++
      if (calls < 3) throw new Error('reset')
      return 'ok'
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.attempts).toBe(3)
    expect(calls).toBe(3)
  })

  // The retry is BOUNDED. An unbounded one under a wide deadline is how a
  // provider blows Netlify's 10 s wall and returns an opaque platform kill
  // instead of the clean UPSTREAM_ERROR this helper exists to produce.
  it('stops at maxAttempts and returns a failure rather than rejecting', async () => {
    let calls = 0
    const r = await readRequired(
      'zoning',
      async () => {
        calls++
        throw new Error('service down')
      },
      { maxAttempts: 3 },
    )
    expect(calls).toBe(3)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.attempts).toBe(3)
    expect(r.layer).toBe('zoning')
    expect(String(r.error)).toContain('service down')
  })

  // NEVER REJECTS is the load-bearing property. A rejected promise is what the
  // `Promise.allSettled` idiom turns into `null` in one careless ternary, which
  // is the defect this whole module exists to make unwritable.
  it('never rejects, even when the attempt throws synchronously', async () => {
    const r = await readRequired('zoning', () => {
      throw new Error('sync throw')
    })
    expect(r.ok).toBe(false)
  })

  it('makes at least one attempt even when the deadline has already passed', async () => {
    let calls = 0
    const r = await readRequired(
      'zoning',
      async () => {
        calls++
        throw new Error('down')
      },
      { deadline: Date.now() - 5_000 },
    )
    // One attempt, not zero: zero attempts would report a failure nobody tried
    // to avoid, and not three: the budget is gone.
    expect(calls).toBe(1)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.attempts).toBe(1)
  })

  it('bounds each attempt’s timeout by what remains of the shared deadline', async () => {
    const seen: number[] = []
    await readRequired(
      'zoning',
      async (timeoutMs) => {
        seen.push(timeoutMs)
        throw new Error('down')
      },
      { deadline: Date.now() + 900, maxAttempts: 3, attemptCapMs: 3000 },
    )
    expect(seen.length).toBeGreaterThan(0)
    // Never the 3 s cap — the deadline is tighter, and the helper must hand the
    // fetch the smaller of the two rather than its own default.
    for (const t of seen) expect(t).toBeLessThanOrEqual(900)
  })

  it('caps each attempt at attemptCapMs when the deadline is generous', async () => {
    const seen: number[] = []
    await readRequired(
      'zoning',
      async (timeoutMs) => {
        seen.push(timeoutMs)
        throw new Error('down')
      },
      { deadline: Date.now() + 60_000, maxAttempts: 2, attemptCapMs: 3000 },
    )
    expect(seen).toEqual([3000, 3000])
  })

  it('requestDeadline hands back one shared deadline, defaulting to the budget', () => {
    const before = Date.now()
    const d = requestDeadline()
    expect(d - before).toBeGreaterThanOrEqual(REQUIRED_BUDGET_MS - 50)
    expect(d - before).toBeLessThanOrEqual(REQUIRED_BUDGET_MS + 50)
  })
})

describe('upstreamUnavailable', () => {
  afterEach(() => vi.restoreAllMocks())

  const failed = (layer: string): RequiredRead<unknown> => ({
    ok: false,
    layer,
    attempts: 3,
    elapsedMs: 900,
    error: new Error(`${layer} down`),
  })
  const fine = (layer: string): RequiredRead<unknown> => ({ ok: true, layer, value: {}, attempts: 1 })

  it('is UPSTREAM_ERROR / 502 — the code the app already renders as an error', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = upstreamUnavailable('phoenix', 'Phoenix', [failed('zoning')], Date.now())
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
    expect(r.status).toBe(502)
  })

  it('names only the layers that actually failed', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const one = upstreamUnavailable('phoenix', 'Phoenix', [fine('parcel'), failed('zoning')], Date.now())
    expect(one.message).toContain('Phoenix zoning data service')
    // Asserted on the layer PHRASE, not on the bare word: "parcel" occurs in the
    // sentence's ordinary prose ("anything about this parcel"), so `not
    // toContain('parcel')` was measuring the copy rather than the layer list.
    expect(one.message).not.toContain('parcel and zoning')
    expect(one.message).not.toContain('parcel data service')

    const both = upstreamUnavailable('phoenix', 'Phoenix', [failed('parcel'), failed('zoning')], Date.now())
    expect(both.message).toContain('parcel and zoning data service')
  })

  // Rule 21. The copy replaces a sentence that told users the parcel might be
  // outside our coverage; naming that sentence, even to deny it, reproduces it
  // for anyone skimming — and for any scanner. Say what is true instead.
  it('states that the answer is unknown WITHOUT naming the claim it replaces', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = upstreamUnavailable('phoenix', 'Phoenix', [failed('zoning')], Date.now())
    expect(r.message).toMatch(/couldn’t reach/i)
    expect(r.message).toMatch(/don’t know|no reading/i)
    expect(r.message).toMatch(/try again/i)
    expect(r.message).not.toMatch(/neighboring city|unincorporated|coverage|unzoned|undevelopable/i)
  })

  it('logs the layers and the attempt counts, so a live failure is diagnosable', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    upstreamUnavailable('phoenix', 'Phoenix', [failed('parcel'), fine('zoning')], Date.now() - 1234)
    expect(log).toHaveBeenCalledTimes(1)
    const entry = log.mock.calls[0][0] as Record<string, unknown>
    expect(entry.event).toBe('parcel.upstream_fail')
    expect(entry.city).toBe('phoenix')
    expect(entry.layers).toEqual(['parcel'])
    expect(entry.attempts).toEqual([3])
    expect(Number(entry.durationMs)).toBeGreaterThanOrEqual(1234)
  })
})
