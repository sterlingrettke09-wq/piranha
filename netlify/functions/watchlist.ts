import type { JsonHandler } from './lib/handlerType'
import { readSessionCookie, sessionFor, clearedSessionCookie } from './lib/auth'
import { addWatch, readWatchlist, removeWatch, type AddInput } from './lib/watchlist'
import { parcelVintageFor } from './lib/providers/parcelVintage'
import { CITIES } from '../../src/config/cities'
import { clientIp, originAllowed, rateLimited } from './lib/guard'

// /api/watchlist — the durable per-parcel state. Session-gated; there is no
// anonymous mode, because a watchlist with no owner has nobody to alert.
//
//   GET                                    → { rows }
//   POST   { city, parcelId, … }           → { row, alreadyPresent } | a refusal
//   DELETE ?city=…&parcelId=…              → { removed }
//
// The refusal path is the interesting one and it is deliberately a 200 with a
// stated reason rather than a 4xx: "this parcel has no usable identifier in its
// city's records" is an ANSWER about the parcel — 7.1% of Dallas — not an error
// in the request. Rendering it as a failure would put it in the same bucket as a
// malformed body and the UI would say "something went wrong", which is both
// false and unactionable.

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const
const RATE = { name: 'watchlist', windowMs: 60_000, max: 60 } as const
const LIVE = new Set(CITIES.filter((c) => c.live).map((c) => c.slug))
const knownCity = (slug: string) => LIVE.has(slug)

/** A cap, because one blob holds one user's whole list. Stated to the user when
 *  reached rather than silently dropping the write. */
const MAX_ROWS = 200

const json = (statusCode: number, body: unknown, extra: Record<string, string> = {}) => ({
  statusCode,
  headers: { ...HEADERS, ...extra },
  body: JSON.stringify(body),
})

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export const handler: JsonHandler = async (event) => {
  if (!originAllowed(event.headers)) return json(403, { error: 'origin' })
  if (rateLimited(clientIp(event.headers), RATE)) return json(429, { error: 'slow down' })

  const sessionId = readSessionCookie(event.headers['cookie'])
  const user = await sessionFor(sessionId)
  if (!user) {
    // Clear a cookie that no longer resolves, so a revoked or expired session
    // stops being re-sent on every request and the client can see it is signed out.
    return json(401, { error: 'sign in' }, sessionId ? { 'Set-Cookie': clearedSessionCookie() } : {})
  }

  if (event.httpMethod === 'GET') {
    return json(200, { rows: await readWatchlist(user.id) })
  }

  if (event.httpMethod === 'POST') {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    } catch {
      return json(400, { error: 'malformed body' })
    }
    const city = str(body.city)
    if (city == null) return json(400, { error: 'city required' })
    // ⚠️ CITY VALIDATED BEFORE THE VINTAGE IS RESOLVED. parcelVintageFor throws
    // on an undeclared slug — deliberately, so silence cannot read as "no vintage
    // applies" — which meant an unknown city produced a 500 instead of the
    // `unknown-city` answer addWatch already had. The strictness was right; the
    // order was wrong.
    if (!knownCity(city)) {
      return json(200, { ok: false, reason: 'unknown-city', detail: `${city} is not a covered city` })
    }

    const existing = await readWatchlist(user.id)
    if (existing.length >= MAX_ROWS) {
      return json(200, {
        ok: false,
        reason: 'list-full',
        detail: `A watchlist holds ${MAX_ROWS} parcels. Remove one to add another.`,
      })
    }

    const snapshot = (body.snapshot ?? {}) as Record<string, unknown>
    const input: AddInput = {
      city,
      parcelId: str(body.parcelId),
      address: str(body.address),
      // The vintage is the SERVER's answer about the parcel, not something a
      // client may assert — a caller could otherwise store a row claiming it was
      // read against a year nobody read it against. Resolved here.
      parcelVintage: await parcelVintageFor(city),
      snapshot: {
        districtCode: str(snapshot.districtCode),
        maxHeightFt: num(snapshot.maxHeightFt),
        maxFAR: num(snapshot.maxFAR),
        lotSqFt: num(snapshot.lotSqFt),
        developable: typeof snapshot.developable === 'boolean' ? snapshot.developable : null,
      },
      ...(body.spec && typeof body.spec === 'object'
        ? { spec: body.spec as AddInput['spec'] }
        : {}),
    }
    const r = await addWatch(user.id, input, knownCity)
    return json(200, r.ok ? { ok: true, row: r.row, alreadyPresent: r.alreadyPresent } : r)
  }

  if (event.httpMethod === 'DELETE') {
    const q = event.queryStringParameters ?? {}
    const city = str(q.city)
    const parcelId = str(q.parcelId)
    if (city == null || parcelId == null) return json(400, { error: 'city and parcelId required' })
    return json(200, { removed: await removeWatch(user.id, city, parcelId) })
  }

  return json(405, { error: 'GET, POST or DELETE' })
}
