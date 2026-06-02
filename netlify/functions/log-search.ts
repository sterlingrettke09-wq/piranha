import type { Handler, HandlerEvent } from '@netlify/functions'
import { logSearch } from './lib/searchLog'

// Lightweight, UNCACHED logging beacon. The data functions (parcel, analyze)
// are CDN-cached, so a repeat search is served from cache and never runs the
// function — meaning it never logs. The frontend fires this beacon on every
// parcel load so we capture every search/click, cache hit or not.
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const

export const handler: Handler = async (event: HandlerEvent) => {
  const p = event.queryStringParameters ?? {}
  const city = (p.city ?? '').trim()
  const address = (p.address ?? '').trim()
  const kind = p.kind === 'analysis' ? 'analysis' : 'lookup'
  if (!city || !address) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'city and address required' }) }
  }
  await logSearch({ ts: new Date().toISOString(), city, address, kind })
  return { statusCode: 204, headers: HEADERS, body: '' }
}
