import type { Handler, HandlerEvent } from '@netlify/functions'
import { readSearches } from './lib/searchLog'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// Owner-only read of the private search log. Authorized by a passphrase compared
// against the ADMIN_KEY environment variable (set in Netlify, never in the bundle).
export const handler: Handler = async (event: HandlerEvent) => {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    return {
      statusCode: 503,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Admin log is not configured.' }),
    }
  }

  const provided = event.headers['x-admin-key'] ?? event.queryStringParameters?.key ?? ''
  if (provided !== expected) {
    return {
      statusCode: 401,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized.' }),
    }
  }

  try {
    const entries = await readSearches(500)
    return {
      statusCode: 200,
      headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ count: entries.length, entries }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Could not read the log.', detail: String(err) }),
    }
  }
}
