import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HandlerEvent } from '@netlify/functions'

const mem = new Map<string, unknown>()
vi.mock('./lib/store', () => ({
  blobStore: (name: string) => ({
    get: async (k: string) => mem.get(`${name}/${k}`) ?? null,
    setJSON: async (k: string, v: unknown) => void mem.set(`${name}/${k}`, v),
    delete: async (k: string) => void mem.delete(`${name}/${k}`),
    list: async () => ({ blobs: [] }),
  }),
}))

import { handler } from './watchlist'
import { handler as session } from './auth-session'
import { issueLoginToken, redeemLoginToken, SESSION_COOKIE } from './lib/auth'

const ev = (o: Partial<HandlerEvent> & { cookie?: string }): HandlerEvent =>
  ({
    httpMethod: 'GET',
    headers: { host: 'x.test', ...(o.cookie ? { cookie: o.cookie } : {}) },
    queryStringParameters: null,
    body: null,
    ...o,
  }) as HandlerEvent

async function signedInAs(email: string): Promise<string> {
  const r = await redeemLoginToken(await issueLoginToken(email))
  if (!r.ok) throw new Error('setup')
  return `${SESSION_COOKIE}=${r.sessionId}`
}
const signedIn = () => signedInAs('a@b.co')

const snapshot = { districtCode: 'R-2', maxHeightFt: 35, maxFAR: 0.5, lotSqFt: 6000, developable: true }

beforeEach(() => mem.clear())

describe('the session gate', () => {
  it('refuses an anonymous caller', async () => {
    const res = await handler(ev({}))
    expect(res.statusCode).toBe(401)
  })

  it('clears a cookie that no longer resolves, and only then', async () => {
    // A dead credential re-sent on every request is both a wasted round trip and
    // a client that cannot tell it has been signed out.
    const dead = await handler(ev({ cookie: `${SESSION_COOKIE}=gone` }))
    expect(dead.headers?.['Set-Cookie']).toContain('Max-Age=0')
    const none = await handler(ev({}))
    expect(none.headers?.['Set-Cookie']).toBeUndefined()
  })

  it('lets a signed-in caller read an empty list without inventing rows', async () => {
    const res = await handler(ev({ cookie: await signedIn() }))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ rows: [] })
  })
})

describe('adding a parcel', () => {
  it('stores it and returns the row', async () => {
    const cookie = await signedIn()
    const res = await handler(
      ev({
        httpMethod: 'POST',
        cookie,
        body: JSON.stringify({ city: 'denver', parcelId: '0123', address: '1 Main St', snapshot, layerVintage: null }),
      }),
    )
    const b = JSON.parse(res.body)
    expect(b.ok).toBe(true)
    expect(b.row.parcelId).toBe('0123')
    expect(b.row.snapshot.maxFAR).toBe(0.5)
    expect(b.row.resolution).toBe('unchecked')
  })

  it("⚠️ refuses a parcel with no usable id as a 200 with a reason, not an error", async () => {
    // This is an ANSWER about the parcel — 7.1% of Dallas — and a 4xx would put
    // it in the same bucket as a malformed request, so the UI would say
    // "something went wrong" for a fact about the land.
    const res = await handler(
      ev({
        httpMethod: 'POST',
        cookie: await signedIn(),
        body: JSON.stringify({ city: 'dallas', parcelId: 'MULTIPLE', address: null, snapshot, layerVintage: null }),
      }),
    )
    expect(res.statusCode).toBe(200)
    const b = JSON.parse(res.body)
    expect(b.ok).toBe(false)
    expect(b.reason).toBe('no-usable-parcel-id')
    expect(b.detail).toMatch(/cannot be watched/)
  })

  it('rejects a city that is not live', async () => {
    const res = await handler(
      ev({
        httpMethod: 'POST',
        cookie: await signedIn(),
        body: JSON.stringify({ city: 'atlantis', parcelId: '1', snapshot, layerVintage: null }),
      }),
    )
    expect(JSON.parse(res.body).reason).toBe('unknown-city')
  })

  it('accepts a real live city slug from the shared config', async () => {
    // Guards against the city list here drifting from src/config/cities.ts,
    // which is the single source of truth for slugs.
    const res = await handler(
      ev({
        httpMethod: 'POST',
        cookie: await signedIn(),
        body: JSON.stringify({ city: 'nyc', parcelId: '1000010001', snapshot, layerVintage: null }),
      }),
    )
    expect(JSON.parse(res.body).ok).toBe(true)
  })

  it('coerces a junk snapshot to nulls rather than storing junk', async () => {
    // null means "not resolved". A string in maxFAR would diff as a change
    // forever and alert on nothing real.
    const res = await handler(
      ev({
        httpMethod: 'POST',
        cookie: await signedIn(),
        body: JSON.stringify({
          city: 'denver', parcelId: '1',
          snapshot: { districtCode: 5, maxHeightFt: 'tall', maxFAR: NaN, lotSqFt: null, developable: 'yes' },
        }),
      }),
    )
    expect(JSON.parse(res.body).row.snapshot).toEqual({
      districtCode: null, maxHeightFt: null, maxFAR: null, lotSqFt: null, developable: null,
    })
  })

  it('refuses a malformed body with a 400, which IS a request error', async () => {
    const res = await handler(ev({ httpMethod: 'POST', cookie: await signedIn(), body: '{not json' }))
    expect(res.statusCode).toBe(400)
  })

  it("does not let one user see another's rows", async () => {
    const alice = await signedInAs('alice@b.co')
    const bob = await signedInAs('bob@b.co')
    await handler(ev({ httpMethod: 'POST', cookie: alice, body: JSON.stringify({ city: 'denver', parcelId: '7', snapshot }) }))
    expect(JSON.parse((await handler(ev({ cookie: alice }))).body).rows).toHaveLength(1)
    expect(JSON.parse((await handler(ev({ cookie: bob }))).body).rows).toHaveLength(0)
    // And Bob cannot delete what he cannot see.
    const del = await handler(ev({ httpMethod: 'DELETE', cookie: bob, queryStringParameters: { city: 'denver', parcelId: '7' } }))
    expect(JSON.parse(del.body)).toEqual({ removed: false })
    expect(JSON.parse((await handler(ev({ cookie: alice }))).body).rows).toHaveLength(1)
  })

  it('and a second login by the same person reaches the same rows', async () => {
    // The account is the email, so a new session is a new key to the same list.
    // Asserted because the opposite failure — a fresh user id per login — would
    // look like a working sign-in and an empty watchlist, with nothing on screen
    // explaining where the parcels went.
    const first = await signedInAs('carol@b.co')
    await handler(ev({ httpMethod: 'POST', cookie: first, body: JSON.stringify({ city: 'denver', parcelId: '9', snapshot }) }))
    const second = await signedInAs('carol@b.co')
    expect(second).not.toBe(first)
    expect(JSON.parse((await handler(ev({ cookie: second }))).body).rows).toHaveLength(1)
  })
})

describe('removing', () => {
  it('reports whether anything was removed', async () => {
    const cookie = await signedIn()
    await handler(ev({ httpMethod: 'POST', cookie, body: JSON.stringify({ city: 'denver', parcelId: '5', snapshot }) }))
    const hit = await handler(ev({ httpMethod: 'DELETE', cookie, queryStringParameters: { city: 'denver', parcelId: '5' } }))
    expect(JSON.parse(hit.body)).toEqual({ removed: true })
    const miss = await handler(ev({ httpMethod: 'DELETE', cookie, queryStringParameters: { city: 'denver', parcelId: '5' } }))
    expect(JSON.parse(miss.body)).toEqual({ removed: false })
  })

  it('requires both halves of the key', async () => {
    const res = await handler(ev({ httpMethod: 'DELETE', cookie: await signedIn(), queryStringParameters: { city: 'denver' } }))
    expect(res.statusCode).toBe(400)
  })
})

describe('/api/auth-session', () => {
  it('answers 200 with user: null for an anonymous reader, not 401', async () => {
    // The SPA calls this on every load. A 401 would put a red line in the
    // console for every anonymous visitor and train everyone to ignore it.
    const res = await session(ev({}))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ user: null })
  })

  it('reports the signed-in user', async () => {
    const res = await session(ev({ cookie: await signedIn() }))
    expect(JSON.parse(res.body).user.email).toBe('a@b.co')
  })

  it('signs out server-side, not only in the browser', async () => {
    const cookie = await signedIn()
    const out = await session(ev({ httpMethod: 'DELETE', cookie }))
    expect(out.headers?.['Set-Cookie']).toContain('Max-Age=0')
    // The session id is dead even if someone kept a copy of the cookie — which
    // a self-contained signed token could not offer.
    const after = await session(ev({ cookie }))
    expect(JSON.parse(after.body)).toEqual({ user: null })
  })
})
