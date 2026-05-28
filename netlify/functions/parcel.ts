import type { Handler, HandlerEvent } from '@netlify/functions'
import { isInBostonBbox, type ParcelError } from '../../src/types/parcel'

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return fail(
      'OUT_OF_BBOX',
      'lat/lng missing, invalid, or outside Boston bbox.',
      400,
    )
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ todo: 'normalize parcel', lat, lng }),
  }
}
