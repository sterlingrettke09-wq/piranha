// A DURABLE per-address limit on login emails.
//
// Separate from `guard.ts` on purpose. That limiter is in-memory and
// per-warm-instance — its own header calls it "a soft brake on casual abuse, NOT
// a durable cap" — which is the right trade for a beacon that logs a search and
// the wrong one for an endpoint that sends mail to an address the caller names.
// Without a durable limit, `POST /api/auth-request` is an email-bombing vector
// pointed at a third party who never visited this site, and instance churn
// resets the only thing stopping it.
//
// Keyed by the SHA-256 of the address, not the address: this store exists to
// throttle, and it should not double as a list of everyone who has ever tried to
// sign in.

import { createHash } from 'node:crypto'
import { blobStore } from './store'

const STORE = 'login-throttle'

/** Five in an hour. Enough for a user who mistypes, loses the mail to spam and
 *  tries again; far short of useful as a way to flood an inbox. */
export const WINDOW_MS = 60 * 60 * 1000
export const MAX_PER_WINDOW = 5

interface Record_ {
  /** Epoch ms of each send in the current window. */
  times: number[]
}

export type ThrottleResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'too-many-for-address' }
  // ⚠️ A store that cannot be reached is its OWN answer, and it fails CLOSED.
  // An unreachable throttle that returned `ok` would remove the limit exactly
  // when the system is least healthy, which is when abuse is cheapest.
  | { ok: false; reason: 'throttle-unavailable' }

export async function emailSendAllowed(email: string, now = Date.now()): Promise<ThrottleResult> {
  const key = createHash('sha256').update(email).digest('hex')
  try {
    const store = blobStore(STORE)
    const rec = ((await store.get(key, { type: 'json' })) as Record_ | null) ?? { times: [] }
    const times = rec.times.filter((t) => now - t < WINDOW_MS)
    if (times.length >= MAX_PER_WINDOW) return { ok: false, reason: 'too-many-for-address' }
    await store.setJSON(key, { times: [...times, now] } satisfies Record_)
    return { ok: true, remaining: MAX_PER_WINDOW - times.length - 1 }
  } catch {
    return { ok: false, reason: 'throttle-unavailable' }
  }
}
