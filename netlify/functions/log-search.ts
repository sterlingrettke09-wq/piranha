import type { Handler, HandlerEvent } from '@netlify/functions'
import { logSearch } from './lib/searchLog'
import { clientIp, originAllowed, rateLimited } from './lib/guard'

// Lightweight, UNCACHED logging beacon. The data functions (parcel, analyze)
// are CDN-cached, so a repeat search is served from cache and never runs the
// function — meaning it never logs. The frontend fires this beacon on every
// parcel load so we capture every search/click, cache hit or not.
//
// It is an unauthenticated write endpoint, so it carries abuse guards: a
// same-origin evidence check (drive-by scripts), a soft per-IP rate limit
// (runaway loops / log flooding), and input length caps (Blobs storage cost).
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const
const RATE = { name: 'log-search', windowMs: 60_000, max: 30 } as const
const MAX_ADDRESS_CHARS = 200
const MAX_CITY_CHARS = 40

export const handler: Handler = async (event: HandlerEvent) => {
  // Silently drop (204) rather than 4xx on guard failures: this is a
  // fire-and-forget beacon, and an error response just invites probing.
  if (!originAllowed(event.headers) || rateLimited(clientIp(event.headers), RATE)) {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }

  const p = event.queryStringParameters ?? {}
  const city = (p.city ?? '').trim().slice(0, MAX_CITY_CHARS)
  const address = (p.address ?? '').trim().slice(0, MAX_ADDRESS_CHARS)
  const kind = p.kind === 'analysis' ? 'analysis' : 'lookup'
  if (!city || !address) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'city and address required' }) }
  }
  await logSearch({ ts: new Date().toISOString(), city, address, kind })
  return { statusCode: 204, headers: HEADERS, body: '' }
}
