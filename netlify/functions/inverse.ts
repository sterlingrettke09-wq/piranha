import type { JsonHandler } from './lib/handlerType'
import { getParcelInfo } from './lib/parcel'
import { whatWouldItTake, summariseInverse, type Target } from './lib/inverse'
import { clientIp, rateLimited } from './lib/guard'
import { quantizeCoord } from '../../src/lib/coords'
import type { Use } from '../../src/types/analysis'

// /api/inverse?city=&lat=&lng=&use=&units=|gfa=|stories=|heightFt=
//
// "I want 40 units here — what would it take?" One parcel, worked backward from
// a target to the constraints that bind. Not a search: nothing here scans more
// than the parcel the caller is standing on.
//
// ⚠️ NO CDN CACHING, unlike /api/parcel. The parcel read underneath is cacheable
// and the ANSWER is not — it is a function of a target the caller just typed, so
// caching it would key a per-user question on a per-parcel URL.

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const
const RATE = { name: 'inverse', windowMs: 60_000, max: 60 } as const
const USES: Use[] = ['residential', 'commercial', 'mixed', 'institutional']

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  // A junk value is not zero. Returning 0 here would turn "units=abc" into a
  // target of no units, which reads as a real answer about a real question.
  return Number.isFinite(n) && n > 0 ? n : null
}

const fail = (message: string, status: number) => ({
  statusCode: status,
  headers: HEADERS,
  body: JSON.stringify({ error: message }),
})

export const handler: JsonHandler = async (event) => {
  if (rateLimited(clientIp(event.headers ?? {}), RATE)) {
    return fail('Too many requests — please wait a moment and try again.', 429)
  }
  const q = event.queryStringParameters ?? {}
  const city = q.city ?? 'boston'
  const lat = quantizeCoord(Number(q.lat))
  const lng = quantizeCoord(Number(q.lng))
  const use = (USES as string[]).includes(q.use ?? '') ? (q.use as Use) : 'residential'

  const target: Target = {
    use,
    units: num(q.units),
    gfaSqFt: num(q.gfa),
    stories: num(q.stories),
    heightFt: num(q.heightFt),
  }

  const r = await getParcelInfo(city, lat, lng)
  // The parcel read failing is NOT an answer about the target. Passing it
  // through as its own error keeps "we could not read this parcel" from
  // rendering as "nothing constrains you".
  if (!r.ok) return fail(r.message, r.status)

  const result = whatWouldItTake(r.info, city, target)
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      parcel: {
        address: r.info.address,
        parcelId: r.info.parcelId,
        districtCode: r.info.zoning.districtCode,
        lotSqFt: r.info.lot.sizeSqFt,
      },
      target,
      ...result,
      summary: summariseInverse(result),
    }),
  }
}
