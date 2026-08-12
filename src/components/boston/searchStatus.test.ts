import { describe, it, expect } from 'vitest'
import { statusFor, searchBoxOptions, IDLE_NOTE, MIN_QUERY, SLOW_MS, STALL_MS, type Hop } from './searchStatus'

// Every state the geocode hop can be in. Pinned as an exhaustive list rather
// than iterated from somewhere, because the defect this file exists for is two
// states rendering the same — and a list derived from the renderer could not
// see that (CLAUDE.md rule 20: a check that reads its own answer checks nothing).
const ALL: Hop[] = [
  { kind: 'idle' },
  { kind: 'searching' },
  { kind: 'slow' },
  { kind: 'results' },
  { kind: 'none' },
  { kind: 'failed' },
  { kind: 'stalled' },
]

describe('the geocode hop renders its states differently', () => {
  it('covers every kind the union declares', () => {
    // A new arm added to `Hop` without a line here fails the exhaustive switch
    // in statusFor at compile time; this catches the reverse — an arm dropped
    // from this list, which would silently stop being tested.
    expect(ALL.length).toBe(7)
    expect(new Set(ALL.map((h) => h.kind)).size).toBe(7)
  })

  // THE ASSERTION. Before this, `SearchBar` wired only `onRetrieve`, and zero
  // results / a rejected fetch / an HTTP 500 / a hung request were pixel
  // identical — to each other and to a search that never happened. Measured at
  // the real UI 2026-08-12, all four produced: no dropdown, aria-expanded=false,
  // no message at all.
  it('gives a DISTINCT line to each state that means something different', () => {
    const meaningful: Hop[] = [
      { kind: 'idle' }, // nothing to report
      { kind: 'slow' }, // in flight, taking a while
      { kind: 'none' }, // ANSWERED, matched nothing
      { kind: 'failed' }, // did NOT answer
      { kind: 'stalled' }, // neither answered nor errored
    ]
    const lines = meaningful.map(statusFor)
    expect(lines.length).toBe(5)
    expect(new Set(lines).size).toBe(5)
  })

  it('says nothing while a search is healthy and in flight', () => {
    // Under SLOW_MS a pending query is deliberately indistinguishable from idle —
    // the median answer is 122 ms and a line that flickers per keystroke is
    // noise. The distinction that matters starts at 'slow'.
    expect(statusFor({ kind: 'idle' })).toBe(IDLE_NOTE)
    expect(statusFor({ kind: 'searching' })).toBe(IDLE_NOTE)
    expect(statusFor({ kind: 'results' })).toBe(IDLE_NOTE)
  })

  it('never lets a FAILED read read like an absent address', () => {
    // The rule-5 pairing, stated directly: the failure copy must not claim
    // anything about whether the address exists, and the empty-answer copy must
    // not blame the service.
    const failed = statusFor({ kind: 'failed' })
    const none = statusFor({ kind: 'none' })
    expect(failed).not.toMatch(/no address|not found|doesn.t exist|no match/i)
    expect(failed).toMatch(/unavailable|our side|not a result/i)
    expect(none).toMatch(/no address matched/i)
    expect(none).not.toMatch(/unavailable|outage|our side/i)
  })

  it('tells the user what still works when the search does not', () => {
    for (const kind of ['failed', 'stalled'] as const) {
      expect([kind, /map click|on the map/i.test(statusFor({ kind }))]).toEqual([kind, true])
    }
  })

  it('keeps the two timers ordered and inside a useful window', () => {
    expect(SLOW_MS).toBeLessThan(STALL_MS)
    // Above the measured max suggest latency (371 ms) so a healthy search never
    // trips it, and below the point where a user assumes the box is broken.
    expect(SLOW_MS).toBeGreaterThan(371)
    expect(STALL_MS).toBeGreaterThanOrEqual(3000)
    expect(MIN_QUERY).toBe(3)
  })
})

describe('the search is not scoped by a bounding box', () => {
  const boston: [number, number] = [-71.0589, 42.3601]

  // ⚠️ THE REGRESSION THIS FILE EXISTS FOR. Mapbox's bbox SUBSTITUTES rather
  // than filters: given an address outside the box it returns a DIFFERENT
  // address inside it, unmarked. Searching the Bellagio in Las Vegas published
  // AS_OF_RIGHT / T6-UC / 225,750 sf / $100.8M for a parcel 6 km away, address
  // line reading "Selected location". Re-adding `bbox` here looks like scoping
  // and is that defect.
  it('passes no bbox to the Search Box API', () => {
    const opts = searchBoxOptions(boston)
    expect(Object.keys(opts).sort()).toEqual(['country', 'proximity', 'types'])
    expect('bbox' in opts).toBe(false)
  })

  it('still biases results toward the city being searched', () => {
    // proximity is what makes the top hit for an in-city query identical to the
    // bbox-scoped result — measured on three cities. Losing it silently would
    // turn every city's search into a national one.
    const opts = searchBoxOptions(boston)
    expect(opts.proximity).toEqual({ lng: -71.0589, lat: 42.3601 })
    expect(opts.country).toBe('us')
    expect(opts.types).toBe('address')
  })

  it('is a pure function of the city centre, with no hidden per-city state', () => {
    const la: [number, number] = [-118.2437, 34.0522]
    expect(searchBoxOptions(la).proximity).toEqual({ lng: -118.2437, lat: 34.0522 })
    expect(searchBoxOptions(boston)).toEqual(searchBoxOptions(boston))
  })
})
