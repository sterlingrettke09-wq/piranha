import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParcelError } from '../../src/types/parcel'
import { getParcelInfo } from './lib/parcel'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)
  const r = await getParcelInfo(lat, lng)
  if (!r.ok) return fail(r.code, r.message, r.status)
  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(r.info),
  }
}
