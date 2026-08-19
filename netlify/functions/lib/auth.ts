// Passwordless accounts: an emailed one-time link, an opaque server-side session.
//
// Chosen 2026-08-19 over a hosted identity provider so that no third party holds
// the user table, no new script or fetch origin has to be cut into the CSP that
// `netlify.toml` keeps deliberately strict, and there is nothing to migrate off
// later. The cost is that token expiry, replay protection and rate limiting are
// ours, so they are written here explicitly rather than assumed.
//
// ── WHAT IS AND IS NOT STORED ───────────────────────────────────────────────
//
// The raw login token is NEVER stored. What goes into Blobs is its SHA-256, and
// the lookup key is that same hash — so a dump of the store cannot be replayed
// into a login, and there is no "compare the stored secret" step to get wrong.
// The session id is opaque and server-side for the same reason: it can be
// revoked, which a self-contained signed cookie cannot be.

import { randomBytes, createHash } from 'node:crypto'
import { blobStore } from './store'

const TOKENS = 'auth-tokens'
const SESSIONS = 'auth-sessions'
const USERS = 'users'

/** Fifteen minutes. Long enough to survive a slow mail hop, short enough that a
 *  link left in an inbox is not a standing credential. */
export const TOKEN_TTL_MS = 15 * 60 * 1000
/** Thirty days. The session is revocable server-side, which is the reason this
 *  can be generous without the cookie becoming a bearer token with no off switch. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const SESSION_COOKIE = '__Host-tpp_session'

export interface User {
  id: string
  email: string
  createdAt: string
}

interface TokenRecord {
  email: string
  expiresAt: number
  /** Single-use. Set the moment it is redeemed, so a second redemption of the
   *  same link is refused rather than silently issuing a second session. */
  usedAt: number | null
}

interface SessionRecord {
  userId: string
  email: string
  createdAt: string
  expiresAt: number
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// ⚠️ THERE IS NO SECRET COMPARISON IN THIS FILE, and that is the design rather
// than an omission. A timing-safe compare is the usual answer to "check the
// submitted token against the stored one" — but keying the store BY the token's
// hash removes the comparison entirely: the lookup either finds a record or it
// does not, and the storage layer never sees the raw token. An earlier draft
// carried a `hashesEqual(key, key)` call that compared a value with itself,
// which is what a defence looks like once the thing it defended is gone.

/** Lowercased and trimmed. Addresses differing only in case are ONE account —
 *  otherwise `A@x.com` and `a@x.com` get separate watchlists and neither user
 *  can see why half their parcels vanished. */
export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  // Deliberately permissive: the delivery attempt is the real validator. This
  // only rejects shapes that cannot be an address at all, so a valid-but-unusual
  // address is not refused by a regex nobody will maintain.
  if (e.length < 3 || e.length > 254) return null
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(e)) return null
  return e
}

/** Issues a login token. Returns the RAW token, which exists only in this
 *  return value and the email — never in a log and never in the store. */
export async function issueLoginToken(email: string, now = Date.now()): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  const rec: TokenRecord = { email, expiresAt: now + TOKEN_TTL_MS, usedAt: null }
  await blobStore(TOKENS).setJSON(sha256(raw), rec)
  return raw
}

export type RedeemResult =
  | { ok: true; user: User; sessionId: string }
  // Every failure is its own state rather than a shared boolean, because the
  // caller must NOT tell them apart to the client while the server log must.
  | { ok: false; reason: 'unknown' | 'expired' | 'already-used' }

/** ⚠️ REDEEMED TOKENS ARE KEPT, NOT DELETED. A deleted record and a token that
 *  never existed are indistinguishable on lookup, so deleting on redemption
 *  would turn every replay into `unknown` and erase the one signal that says a
 *  link was used twice. The cost is that the token store grows by one small
 *  record per login attempt; it is swept by expiry, not by redemption — see
 *  `sweepExpiredTokens`. */
export async function redeemLoginToken(raw: string, now = Date.now()): Promise<RedeemResult> {
  const key = sha256(raw)
  const store = blobStore(TOKENS)
  const rec = (await store.get(key, { type: 'json' })) as TokenRecord | null
  if (rec == null) return { ok: false, reason: 'unknown' }
  if (rec.usedAt != null) return { ok: false, reason: 'already-used' }
  if (rec.expiresAt <= now) return { ok: false, reason: 'expired' }

  // Burn it BEFORE issuing the session. If the session write then fails the user
  // retries the login rather than holding a link that can be redeemed twice.
  await store.setJSON(key, { ...rec, usedAt: now } satisfies TokenRecord)

  const user = await upsertUser(rec.email, now)
  const sessionId = randomBytes(32).toString('base64url')
  await blobStore(SESSIONS).setJSON(sha256(sessionId), {
    userId: user.id,
    email: user.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  } satisfies SessionRecord)
  return { ok: true, user, sessionId }
}

async function upsertUser(email: string, now: number): Promise<User> {
  const store = blobStore(USERS)
  const key = sha256(email)
  const existing = (await store.get(key, { type: 'json' })) as User | null
  if (existing) return existing
  const user: User = { id: randomBytes(16).toString('hex'), email, createdAt: new Date(now).toISOString() }
  await store.setJSON(key, user)
  return user
}

/** The session behind a cookie, or null. Expiry is checked HERE rather than
 *  trusted to the cookie's own Max-Age — the client controls that. */
export async function sessionFor(sessionId: string | null, now = Date.now()): Promise<User | null> {
  if (!sessionId) return null
  const rec = (await blobStore(SESSIONS).get(sha256(sessionId), { type: 'json' })) as SessionRecord | null
  if (rec == null || rec.expiresAt <= now) return null
  return { id: rec.userId, email: rec.email, createdAt: rec.createdAt }
}

/** Deletes token records whose expiry AND replay window have both passed. A
 *  record is only safe to remove once a replay of it would be refused for a
 *  reason that does not depend on the record existing — i.e. long after expiry.
 *  Returns what it removed, so a sweep that finds nothing reads as "nothing to
 *  remove" and not as "ran successfully" (rule 20). */
export async function sweepExpiredTokens(now = Date.now(), graceMs = 7 * 24 * 60 * 60 * 1000): Promise<{ scanned: number; deleted: number }> {
  const store = blobStore(TOKENS)
  const { blobs } = await store.list()
  let deleted = 0
  for (const b of blobs) {
    const rec = (await store.get(b.key, { type: 'json' })) as TokenRecord | null
    if (rec != null && rec.expiresAt + graceMs <= now) {
      await store.delete(b.key)
      deleted++
    }
  }
  return { scanned: blobs.length, deleted }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await blobStore(SESSIONS).delete(sha256(sessionId))
}

/** `__Host-` prefixed, so the browser itself enforces Secure, Path=/ and no
 *  Domain attribute — a subdomain cannot set or overwrite it. */
export function sessionCookie(sessionId: string, maxAgeMs = SESSION_TTL_MS): string {
  return `${SESSION_COOKIE}=${sessionId}; Max-Age=${Math.floor(maxAgeMs / 1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
}

export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === SESSION_COOKIE) return v.join('=') || null
  }
  return null
}
