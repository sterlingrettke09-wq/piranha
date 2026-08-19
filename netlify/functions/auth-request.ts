import type { JsonHandler } from './lib/handlerType'
import { clientIp, originAllowed, rateLimited } from './lib/guard'
import { issueLoginToken, normaliseEmail } from './lib/auth'
import { sendLoginEmail } from './lib/email'
import { emailSendAllowed } from './lib/loginThrottle'

// POST /api/auth-request  { email }  →  204, always.
//
// ── WHY THE ANSWER IS ALWAYS THE SAME ───────────────────────────────────────
//
// 204 whether or not the address has an account, whether or not the send
// succeeded, and whether or not it was throttled. Any variation turns this into
// an account-enumeration oracle — "does sterling@x.com have an account here" is
// answerable by the response, or by its timing, if the paths differ. The server
// log carries the distinction; the client never does.
//
// ── AND WHY THE THROTTLE IS NOT THE ONE IN guard.ts ─────────────────────────
//
// `rateLimited` is in-memory and per-warm-instance, which its own header says is
// "a soft brake on casual abuse, NOT a durable cap". That is the right trade for
// a fire-and-forget beacon. It is the wrong one here: this endpoint SENDS MAIL to
// an address the caller names, so a weak limit makes it an email-bombing vector
// aimed at a third party who never used this site. The per-address limit is
// therefore durable (Netlify Blobs) and survives instance churn; the per-IP one
// stays in memory and is kept as a cheap first gate.

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const
const IP_RATE = { name: 'auth-request', windowMs: 60_000, max: 10 } as const
const NO_CONTENT = { statusCode: 204, headers: HEADERS, body: '' }

function siteOrigin(event: Parameters<JsonHandler>[0]): string {
  const configured = process.env.SITE_ORIGIN
  if (configured) return configured.replace(/\/$/, '')
  const host = event.headers['host'] ?? 'localhost:8888'
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`
}

export const handler: JsonHandler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) }
  }
  if (!originAllowed(event.headers)) return NO_CONTENT
  if (rateLimited(clientIp(event.headers), IP_RATE)) {
    console.log({ event: 'auth.request.ip_throttled' })
    return NO_CONTENT
  }

  let email: string | null
  try {
    email = normaliseEmail(String((JSON.parse(event.body ?? '{}') as { email?: unknown }).email ?? ''))
  } catch {
    email = null
  }
  // Even a malformed address gets 204: a 400 here would tell a prober which
  // strings this endpoint considers real addresses.
  if (email == null) {
    console.log({ event: 'auth.request.rejected_shape' })
    return NO_CONTENT
  }

  const allowed = await emailSendAllowed(email)
  if (!allowed.ok) {
    console.log({ event: 'auth.request.email_throttled', reason: allowed.reason })
    return NO_CONTENT
  }

  const token = await issueLoginToken(email)
  const link = `${siteOrigin(event)}/api/auth-verify?token=${encodeURIComponent(token)}`
  const sent = await sendLoginEmail(email, link)
  // ⚠️ The three outcomes are logged apart. "Nobody set the API key" and "the
  // provider is down" produce the same silence in the user's inbox, so this log
  // line is the only place they are distinguishable.
  console.log({ event: 'auth.request.sent', status: sent.status, detail: 'detail' in sent ? sent.detail : undefined })
  return NO_CONTENT
}
