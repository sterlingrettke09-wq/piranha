import { describe, it, expect, vi, beforeEach } from 'vitest'

const mem = new Map<string, unknown>()
vi.mock('./store', () => ({
  blobStore: (name: string) => ({
    get: async (k: string) => mem.get(`${name}/${k}`) ?? null,
    setJSON: async (k: string, v: unknown) => void mem.set(`${name}/${k}`, v),
    delete: async (k: string) => void mem.delete(`${name}/${k}`),
    list: async () => ({
      blobs: [...mem.keys()].filter((k) => k.startsWith(`${name}/`)).map((k) => ({ key: k.slice(name.length + 1) })),
    }),
  }),
}))

import {
  normaliseEmail, issueLoginToken, redeemLoginToken, sessionFor, revokeSession,
  sessionCookie, clearedSessionCookie, readSessionCookie, sweepExpiredTokens,
  SESSION_COOKIE, TOKEN_TTL_MS,
} from './auth'

beforeEach(() => mem.clear())

describe('email normalisation', () => {
  it('folds case and whitespace so one person is one account', () => {
    // Two accounts for `A@x.com` and `a@x.com` means a user logs in and half
    // their watchlist is missing, with nothing on screen explaining it.
    expect(normaliseEmail('  A@Example.COM ')).toBe('a@example.com')
  })

  it('rejects only shapes that cannot be an address', () => {
    for (const bad of ['', 'a', 'no-at-sign', 'a@b', 'a@@b.com', 'a b@c.com']) {
      expect(normaliseEmail(bad), bad).toBeNull()
    }
    for (const ok of ['a@b.co', "o'brien+tag@sub.example.museum"]) {
      expect(normaliseEmail(ok), ok).not.toBeNull()
    }
  })
})

describe('the login token', () => {
  it('is never stored in the clear — the store holds only its hash', async () => {
    const raw = await issueLoginToken('a@b.co')
    const dump = JSON.stringify([...mem.entries()])
    // The raw token appears nowhere in the store. A dump cannot be replayed.
    expect(dump).not.toContain(raw)
    expect([...mem.keys()].some((k) => k.startsWith('auth-tokens/'))).toBe(true)
  })

  it('is single-use — a second redemption is refused, not silently re-issued', async () => {
    const raw = await issueLoginToken('a@b.co')
    const first = await redeemLoginToken(raw)
    expect(first.ok).toBe(true)
    const second = await redeemLoginToken(raw)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('already-used')
  })

  it('expires, and expiry is distinguishable from replay and from nonsense', async () => {
    // Three separate reasons rather than one boolean: the client must not be
    // told which, and the server log must be able to say.
    const raw = await issueLoginToken('a@b.co', 1_000)
    const late = await redeemLoginToken(raw, 1_000 + TOKEN_TTL_MS + 1)
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.reason).toBe('expired')

    const nonsense = await redeemLoginToken('not-a-token')
    expect(nonsense.ok).toBe(false)
    if (!nonsense.ok) expect(nonsense.reason).toBe('unknown')
  })

  it('burns the token before issuing the session', async () => {
    // Ordering matters: if the session write fails the user retries a login,
    // rather than holding a link that can still be redeemed a second time.
    const raw = await issueLoginToken('a@b.co')
    await redeemLoginToken(raw)
    const rec = [...mem.entries()].find(([k]) => k.startsWith('auth-tokens/'))![1] as { usedAt: number | null }
    expect(rec.usedAt).not.toBeNull()
  })

  it('gives the same person the same account on a second login', async () => {
    const a = await redeemLoginToken(await issueLoginToken('a@b.co'))
    const b = await redeemLoginToken(await issueLoginToken('a@b.co'))
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) {
      expect(b.user.id).toBe(a.user.id)
      expect(b.sessionId).not.toBe(a.sessionId)
    }
  })
})

describe('the session', () => {
  it('resolves to its user and can be revoked', async () => {
    const r = await redeemLoginToken(await issueLoginToken('a@b.co'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect((await sessionFor(r.sessionId))?.email).toBe('a@b.co')
    await revokeSession(r.sessionId)
    expect(await sessionFor(r.sessionId)).toBeNull()
  })

  it('checks expiry server-side rather than trusting the cookie Max-Age', async () => {
    const r = await redeemLoginToken(await issueLoginToken('a@b.co'), 1_000)
    if (!r.ok) throw new Error('setup')
    const far = 1_000 + 31 * 24 * 60 * 60 * 1000
    expect(await sessionFor(r.sessionId, far)).toBeNull()
  })

  it('rejects an absent or unknown session without throwing', async () => {
    expect(await sessionFor(null)).toBeNull()
    expect(await sessionFor('')).toBeNull()
    expect(await sessionFor('made-up')).toBeNull()
  })
})

describe('the cookie', () => {
  it('carries the __Host- prefix and every flag it implies', () => {
    const c = sessionCookie('abc')
    expect(c.startsWith('__Host-')).toBe(true)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    // __Host- forbids Domain; a subdomain must not be able to set this cookie.
    expect(c).not.toContain('Domain=')
  })

  it('clears with Max-Age=0 and the same flags', () => {
    expect(clearedSessionCookie()).toContain('Max-Age=0')
    expect(clearedSessionCookie()).toContain('HttpOnly')
  })

  it('reads its own value out of a header with other cookies present', () => {
    expect(readSessionCookie(`other=1; ${SESSION_COOKIE}=xyz; third=2`)).toBe('xyz')
    expect(readSessionCookie('other=1')).toBeNull()
    expect(readSessionCookie(undefined)).toBeNull()
  })

  it('does not confuse a cookie whose name merely ends with ours', () => {
    expect(readSessionCookie(`not${SESSION_COOKIE}=nope`)).toBeNull()
  })
})

describe('the token sweep', () => {
  it('reports what it scanned, so finding nothing does not read as success', async () => {
    // rule 20: a sweep that returns void goes "green" over an empty store, which
    // is indistinguishable from one whose listing silently stopped working.
    const empty = await sweepExpiredTokens()
    expect(empty).toEqual({ scanned: 0, deleted: 0 })

    await issueLoginToken('a@b.co', 1_000)
    const tooEarly = await sweepExpiredTokens(1_000 + TOKEN_TTL_MS + 1)
    expect(tooEarly).toEqual({ scanned: 1, deleted: 0 })

    const later = await sweepExpiredTokens(1_000 + TOKEN_TTL_MS + 8 * 24 * 60 * 60 * 1000)
    expect(later).toEqual({ scanned: 1, deleted: 1 })
  })
})
