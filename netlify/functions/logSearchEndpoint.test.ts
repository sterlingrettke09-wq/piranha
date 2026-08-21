import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HandlerEvent } from '@netlify/functions'
import type { SearchEntry } from './lib/searchLog'

// Capture what the handler actually WRITES. The point of this suite is the
// shape of the stored row, not the HTTP response — every row said `lookup` and
// six of the ten fields had no writer at all, and neither fact was visible from
// a 204.
const written: SearchEntry[] = []
vi.mock('./lib/searchLog', () => ({
  logSearch: async (e: SearchEntry) => void written.push(e),
}))

import { handler } from './log-search'

const ev = (q: Record<string, string>): HandlerEvent =>
  ({
    httpMethod: 'GET',
    headers: { host: 'x.test', origin: 'https://x.test', referer: 'https://x.test/' },
    queryStringParameters: q,
    body: null,
  }) as unknown as HandlerEvent

const BASE = { city: 'boston', address: '1 Main St' }

beforeEach(() => {
  written.length = 0
})

describe('the search log writer', () => {
  it('⚠️ stamps kind=analysis, which nothing used to send', () => {
    // Every row in the log said `lookup` because the only caller hard-coded it.
    // An analysis is the row that carries what someone tried to BUILD.
    return handler(ev({ ...BASE, kind: 'analysis' })).then(() => {
      expect(written).toHaveLength(1)
      expect(written[0].kind).toBe('analysis')
    })
  })

  it('defaults to lookup for anything else, including a bogus kind', async () => {
    await handler(ev({ ...BASE }))
    await handler(ev({ ...BASE, kind: 'not-a-kind' }))
    expect(written.map((w) => w.kind)).toEqual(['lookup', 'lookup'])
  })

  it('⚠️ writes all six previously-unwritten fields', async () => {
    await handler(
      ev({
        ...BASE,
        kind: 'analysis',
        use: 'residential',
        projectType: 'adu',
        gfa: '1200',
        units: '2',
        verdict: 'NEEDS_RELIEF',
        months: '18',
      }),
    )
    expect(written[0]).toMatchObject({
      city: 'boston',
      address: '1 Main St',
      kind: 'analysis',
      use: 'residential',
      projectType: 'adu',
      gfa: 1200,
      units: 2,
      verdict: 'NEEDS_RELIEF',
      months: 18,
    })
    // ⚠️ Pinned by COUNT as well as by content: this is the check that would
    // catch a field silently losing its writer again (rule 20 — a subset match
    // passes happily while five of six are missing).
    expect(Object.keys(written[0]).sort()).toEqual(
      ['address', 'city', 'gfa', 'kind', 'months', 'projectType', 'ts', 'units', 'use', 'verdict'].sort(),
    )
  })

  it('⚠️ OMITS a field it did not receive, rather than storing null', async () => {
    // rule 5 at the storage layer: "not sent" and "sent empty" must not render
    // the same. An explicit `use: undefined` still creates the key, and setJSON
    // would persist `"use": null` — a value, indistinguishable from a real one.
    await handler(ev({ ...BASE, kind: 'analysis' }))
    const row = written[0]
    for (const f of ['use', 'projectType', 'gfa', 'units', 'verdict', 'months']) {
      expect(Object.prototype.hasOwnProperty.call(row, f), f).toBe(false)
    }
    expect(Object.keys(row).sort()).toEqual(['address', 'city', 'kind', 'ts'])
  })

  it('⚠️ drops unrecognised enum values instead of storing them', async () => {
    // An unauthenticated write endpoint: an arbitrary string here is storage
    // cost and a junk row in the only instrument that reports what people
    // search for. A dropped field reads as "not sent", which is true.
    await handler(
      ev({ ...BASE, use: 'dragons', projectType: 'wormhole', verdict: 'VIBES' }),
    )
    expect(written[0].use).toBeUndefined()
    expect(written[0].projectType).toBeUndefined()
    expect(written[0].verdict).toBeUndefined()
  })

  it('⚠️ rejects out-of-range and non-finite numbers, and never coerces empty to 0', async () => {
    // Number('') is 0, so a bare presence check would store a real-looking zero
    // for a field the client never sent — a fabricated measurement in the one
    // place we would later compute averages from.
    await handler(
      ev({ ...BASE, gfa: '', units: 'NaN', months: '-3' }),
    )
    expect(written[0].gfa).toBeUndefined()
    expect(written[0].units).toBeUndefined()
    expect(written[0].months).toBeUndefined()

    written.length = 0
    await handler(ev({ ...BASE, gfa: '99999999999', units: '999999', months: '9999' }))
    expect(written[0].gfa).toBeUndefined()
    expect(written[0].units).toBeUndefined()
    expect(written[0].months).toBeUndefined()

    // ⚠️ And a legitimate zero IS stored — the check above must not pass by
    // rejecting everything (rule 20).
    written.length = 0
    await handler(ev({ ...BASE, gfa: '0', units: '0', months: '0' }))
    expect(written[0].gfa).toBe(0)
    expect(written[0].units).toBe(0)
    expect(written[0].months).toBe(0)
  })

  it('still requires city and address, and still caps their length', async () => {
    const res = await handler(ev({ city: 'boston' }))
    expect(res.statusCode).toBe(400)
    expect(written).toHaveLength(0)

    await handler(ev({ city: 'x'.repeat(80), address: 'y'.repeat(400) }))
    expect(written[0].city.length).toBe(40)
    expect(written[0].address.length).toBe(200)
  })
})
