import type { JsonHandler } from './lib/handlerType'
import { readSessionCookie, sessionFor, revokeSession, clearedSessionCookie } from './lib/auth'

// /api/auth-session — who the caller is, and how to stop being them.
//
//   GET     → { user } or { user: null }
//   DELETE  → sign out; revokes server-side AND clears the cookie
//
// GET answers 200 with `user: null` rather than 401. "Nobody is signed in" is
// the ordinary state of this endpoint, not a failure, and the SPA calls it on
// every load — a 401 would put a red line in the console on every visit by an
// anonymous reader and train everyone to ignore it.

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const

export const handler: JsonHandler = async (event) => {
  const sessionId = readSessionCookie(event.headers['cookie'])

  if (event.httpMethod === 'DELETE') {
    // Revoke server-side FIRST. Clearing only the cookie would leave a live
    // session id that anyone holding a copy could keep using, which is the whole
    // reason sessions here are opaque and server-side rather than self-contained.
    if (sessionId) await revokeSession(sessionId)
    return {
      statusCode: 200,
      headers: { ...HEADERS, 'Set-Cookie': clearedSessionCookie() },
      body: JSON.stringify({ user: null }),
    }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'GET or DELETE' }) }
  }

  const user = await sessionFor(sessionId)
  return {
    statusCode: 200,
    // A cookie that no longer resolves is cleared here too, so the browser stops
    // sending a dead credential on every subsequent request.
    headers: sessionId && !user ? { ...HEADERS, 'Set-Cookie': clearedSessionCookie() } : HEADERS,
    body: JSON.stringify({ user: user ? { id: user.id, email: user.email } : null }),
  }
}
