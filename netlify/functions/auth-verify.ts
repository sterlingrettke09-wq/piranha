import type { JsonHandler } from './lib/handlerType'
import { redeemLoginToken, sessionCookie } from './lib/auth'

// GET /api/auth-verify?token=…  → sets the session cookie and redirects.
//
// Always a 302, never a JSON body, and the destination carries only a coarse
// outcome. Three things follow from that:
//
//  · The raw token is in the URL, so it is in the browser's history and in any
//    referrer the landing page emits. Redirecting immediately to a clean path
//    means the credential does not stay on screen; it is single-use and already
//    burned by the time this responds, which is the real mitigation.
//  · The failure reasons — unknown / expired / already-used — are logged, and
//    the redirect says only `expired`. "Already used" tells a prober that a
//    token they hold was valid, which is a small oracle and free to close.
//  · A redirect rather than a rendered page keeps this out of the SPA's route
//    table: the app reads its session from /api/auth-session like any other
//    state, so there is no second place that knows how login works.

const REDIRECT = (to: string, cookie?: string) => ({
  statusCode: 302,
  headers: {
    Location: to,
    'Cache-Control': 'no-store',
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  },
  body: '',
})

export const handler: JsonHandler = async (event) => {
  const token = event.queryStringParameters?.token
  if (!token) return REDIRECT('/?signin=expired')

  const result = await redeemLoginToken(token)
  if (!result.ok) {
    console.log({ event: 'auth.verify.refused', reason: result.reason })
    return REDIRECT('/?signin=expired')
  }
  console.log({ event: 'auth.verify.ok', userId: result.user.id })
  return REDIRECT('/watchlist', sessionCookie(result.sessionId))
}
