import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParcelError } from '../../src/types/parcel'
import { cacheControlFor, getParcelInfo } from './lib/parcel'
import { clientIp, rateLimited } from './lib/guard'
import { quantizeCoord } from '../../src/lib/coords'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// Soft per-IP rate limit on cache misses (each miss queries upstream ArcGIS +
// Mapbox). Generous: rapid map clicking is a legitimate usage pattern.
const RATE = { name: 'parcel', windowMs: 60_000, max: 60 } as const

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

export const handler: Handler = async (event: HandlerEvent) => {
  if (rateLimited(clientIp(event.headers ?? {}), RATE)) {
    return fail('RATE_LIMITED', 'Too many requests — please wait a moment and try again.', 429)
  }
  const city = event.queryStringParameters?.city ?? 'boston'
  // Normalize stragglers that bypassed client-side quantization (NaN passes
  // through and fails validation downstream as before).
  const lat = quantizeCoord(Number(event.queryStringParameters?.lat))
  const lng = quantizeCoord(Number(event.queryStringParameters?.lng))
  const r = await getParcelInfo(city, lat, lng)
  if (!r.ok) return fail(r.code, r.message, r.status)
  return {
    statusCode: 200,
    // Degraded answers (zoning or geocode upstream failed) cache briefly so a
    // transient outage can't poison the CDN for a day. See cacheControlFor.
    headers: { ...JSON_HEADERS, 'Cache-Control': cacheControlFor(r.info) },
    body: JSON.stringify(r.info),
  }
}
