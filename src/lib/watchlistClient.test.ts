import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getSession, requestSignIn, listWatchlist, addWatch, removeWatch, signOut,
  type WatchRow,
} from './watchlistClient'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const mock = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    impl(String(input), init as RequestInit | undefined),
  )

const row = (o: Partial<WatchRow> = {}): WatchRow => ({
  city: 'denver',
  parcelId: '0123',
  addedAt: '2026-08-19T00:00:00.000Z',
  address: '1 Main St',
  snapshot: { districtCode: 'R-2', maxHeightFt: 35, maxFAR: 0.5, lotSqFt: 6000, developable: true },
  parcelVintage: { basis: 'not-versioned', year: null, layerUrl: null },
  resolution: 'unchecked',
  lastCheckedAt: null,
  ...o,
})

afterEach(() => vi.restoreAllMocks())

describe('the session', () => {
  it('reads the user, and treats a non-200 as signed out rather than throwing', async () => {
    mock(async () => json({ user: { id: 'u1', email: 'a@b.co' } }))
    expect(await getSession()).toEqual({ id: 'u1', email: 'a@b.co' })
    vi.restoreAllMocks()
    mock(async () => json({}, 500))
    expect(await getSession()).toBeNull()
  })

  it('survives the network being gone', async () => {
    mock(async () => { throw new Error('offline') })
    expect(await getSession()).toBeNull()
    await expect(signOut()).resolves.toBeUndefined()
  })

  it('sends credentials, or the cookie never arrives', async () => {
    const f = mock(async () => json({ user: null }))
    await getSession()
    expect((f.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin')
  })
})

describe('requesting a sign-in link', () => {
  it('⚠️ reports only whether the REQUEST landed, never whether an account exists', async () => {
    // The endpoint answers 204 for every outcome — unknown address, throttled,
    // send failed — because anything else is an account-enumeration oracle. A
    // client that surfaced a difference would leak exactly what the 204 protects,
    // so there is no success/failure distinction available here to surface.
    // `new Response('', {status: 204})` THROWS — 204 is a null-body status, and
    // an empty string is still a body. The first version of this fixture did
    // exactly that, so the mock threw, the client caught it, and the test failed
    // claiming the 204 path was broken when the fixture was.
    mock(async () => new Response(null, { status: 204 }))
    expect(await requestSignIn('a@b.co')).toBe('sent')
  })

  it('distinguishes only the case where nothing was delivered at all', async () => {
    mock(async () => { throw new Error('offline') })
    expect(await requestSignIn('a@b.co')).toBe('network-error')
    vi.restoreAllMocks()
    mock(async () => json({}, 502))
    expect(await requestSignIn('a@b.co')).toBe('network-error')
  })
})

describe('listing', () => {
  it('separates signed-out from failed from empty', async () => {
    // rule 5, in the UI layer: an empty list says "you are watching nothing",
    // a failure says "we do not know", and rendering them the same would show
    // someone an empty watchlist when their rows are simply unreachable.
    mock(async () => json({}, 401))
    expect(await listWatchlist()).toEqual({ kind: 'signed-out' })
    vi.restoreAllMocks()
    mock(async () => json({}, 503))
    expect(await listWatchlist()).toEqual({ kind: 'error', detail: 'The server answered 503.' })
    vi.restoreAllMocks()
    mock(async () => json({ rows: [] }))
    expect(await listWatchlist()).toEqual({ kind: 'ok', rows: [] })
  })
})

describe('adding', () => {
  const input = {
    city: 'denver', parcelId: '0123', address: '1 Main St',
    snapshot: { districtCode: 'R-2', maxHeightFt: 35, maxFAR: 0.5, lotSqFt: 6000, developable: true },
  }

  it('distinguishes a new row from one already watched', async () => {
    mock(async () => json({ ok: true, row: row(), alreadyPresent: false }))
    expect((await addWatch(input)).kind).toBe('added')
    vi.restoreAllMocks()
    mock(async () => json({ ok: true, row: row(), alreadyPresent: true }))
    expect((await addWatch(input)).kind).toBe('already-watching')
  })

  it('⚠️ carries "no usable parcel id" through as its own kind, not as an error', async () => {
    // This is an ANSWER about the parcel — 7.1% of Dallas — arriving as a 200.
    // Collapsing it into `error` would put a fact about the land behind
    // "something went wrong" and send the reader looking for a fault.
    mock(async () =>
      json({ ok: false, reason: 'no-usable-parcel-id', detail: 'This parcel has no usable identifier…' }),
    )
    const r = await addWatch({ ...input, parcelId: 'MULTIPLE' })
    expect(r.kind).toBe('not-watchable')
    if (r.kind === 'not-watchable') expect(r.detail).toMatch(/no usable identifier/)
  })

  it('and keeps list-full separate again, since the fix differs', async () => {
    mock(async () => json({ ok: false, reason: 'list-full', detail: 'A watchlist holds 200 parcels.' }))
    expect((await addWatch(input)).kind).toBe('list-full')
  })

  it('maps a 401 to signed-out so the UI can offer a sign-in, not a retry', async () => {
    mock(async () => json({}, 401))
    expect((await addWatch(input)).kind).toBe('signed-out')
  })

  it('posts the snapshot, because without a prior answer nothing can be diffed', async () => {
    const f = mock(async () => json({ ok: true, row: row(), alreadyPresent: false }))
    await addWatch(input)
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>
    expect(body.snapshot).toEqual(input.snapshot)
    expect(body.city).toBe('denver')
    expect(body.parcelId).toBe('0123')
    // ⚠️ The client does NOT send a vintage. Which fabric a row was read against
    // is the server's answer about the parcel, not something a caller may assert.
    expect(body).not.toHaveProperty('parcelVintage')
    expect(body).not.toHaveProperty('layerVintage')
  })
})

describe('removing', () => {
  it('reports whether anything was removed, and false on any failure', async () => {
    mock(async () => json({ removed: true }))
    expect(await removeWatch('denver', '1')).toBe(true)
    vi.restoreAllMocks()
    mock(async () => json({ removed: false }))
    expect(await removeWatch('denver', '1')).toBe(false)
    vi.restoreAllMocks()
    mock(async () => { throw new Error('offline') })
    expect(await removeWatch('denver', '1')).toBe(false)
  })

  it('encodes both halves of the key into the query', async () => {
    const f = mock(async () => json({ removed: true }))
    await removeWatch('denver', '0295    0805')
    const url = String(f.mock.calls[0][0])
    // Real ids carry spaces (DC) and letters (Charlotte); an unencoded key would
    // silently fail to match the row it was meant to remove.
    expect(url).toContain('city=denver')
    expect(url).toContain(encodeURIComponent('0295    0805').replace(/%20/g, '+'))
  })
})
