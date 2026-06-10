import type { Handler, HandlerEvent } from '@netlify/functions'
import { clientIp, originAllowed, rateLimited } from './lib/guard'

// Tiny client-side error beacon. The SPA posts uncaught errors and unhandled
// promise rejections here so they show up in the Netlify function logs as
// structured `client_error` events. This is a deliberately minimal alternative
// to a full Sentry install — re-evaluate when there's revenue.
//
// Like log-search, this is an unauthenticated fire-and-forget write endpoint,
// so it carries the same abuse guards: a same-origin evidence check, a soft
// per-IP rate limit, and input length caps. On any guard failure we silently
// return 204 rather than a 4xx — an error response just invites probing.
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const
const RATE = { name: 'client-error', windowMs: 60_000, max: 10 } as const
const MAX_MESSAGE_CHARS = 500
const MAX_STACK_CHARS = 2000
const MAX_URL_CHARS = 300

const noContent = { statusCode: 204, headers: HEADERS, body: '' }

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Use POST.' }) }
  }

  // Silently drop (204) on guard failures.
  if (!originAllowed(event.headers) || rateLimited(clientIp(event.headers), RATE)) {
    return noContent
  }

  let body: { message?: unknown; stack?: unknown; url?: unknown }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return noContent
  }

  const message = typeof body.message === 'string' ? body.message.slice(0, MAX_MESSAGE_CHARS) : ''
  const stack = typeof body.stack === 'string' ? body.stack.slice(0, MAX_STACK_CHARS) : undefined
  const url = typeof body.url === 'string' ? body.url.slice(0, MAX_URL_CHARS) : undefined

  if (!message) return noContent

  console.log({ event: 'client_error', message, url, stack })
  return noContent
}
