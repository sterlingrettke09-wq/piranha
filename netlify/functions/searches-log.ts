import { createHash, timingSafeEqual } from 'node:crypto'
import type { Handler, HandlerEvent } from '@netlify/functions'
import { readSearches, searchStorageStatus } from './lib/searchLog'
import { clientIp, rateLimited } from './lib/guard'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// Throttle guess attempts; the owner only loads this once per Admin visit.
const RATE = { name: 'searches-log', windowMs: 60_000, max: 10 } as const

// Constant-time comparison. Hashing both sides first gives equal-length
// buffers (a timingSafeEqual requirement) and avoids leaking length.
function keyMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// Owner-only read of the private search log. Authorized by a passphrase compared
// against the ADMIN_KEY environment variable (set in Netlify, never in the bundle).
// The key is accepted ONLY via the x-admin-key header — never as a query param,
// which would leak it into CDN logs, browser history, and Referer headers.
export const handler: Handler = async (event: HandlerEvent) => {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    return {
      statusCode: 503,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Admin log is not configured.' }),
    }
  }

  if (rateLimited(clientIp(event.headers), RATE)) {
    return {
      statusCode: 429,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Too many attempts — wait a minute and try again.' }),
    }
  }

  const provided = event.headers['x-admin-key'] ?? ''
  if (!provided || !keyMatches(provided, expected)) {
    return {
      statusCode: 401,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized.' }),
    }
  }

  try {
    const [entries, storage] = await Promise.all([readSearches(500), searchStorageStatus()])
    return {
      statusCode: 200,
      headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ count: entries.length, entries, storage }),
    }
  } catch (err) {
    // Detail goes to the function log, not the response.
    console.log({ event: 'searches-log.error', message: err instanceof Error ? err.message : String(err) })
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Could not read the log.' }),
    }
  }
}
