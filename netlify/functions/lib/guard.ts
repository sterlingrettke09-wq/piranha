// Shared abuse guards for the public functions.
//
// The rate limiter is best-effort and per-warm-instance: serverless instances
// are ephemeral and not shared, so this is a soft brake on casual abuse and
// runaway loops, NOT a durable cap — a real cap needs a shared store
// (Netlify Blobs / Upstash) or Netlify's platform rate limiting. Documented
// intentionally; pair it with billing alerts on any metered upstream key.

type Bucket = { times: number[] }

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 5000 // bound memory if a warm instance sees many IPs

export interface RateLimitOptions {
  /** Distinct limiter namespace so endpoints don't share budgets. */
  name: string
  windowMs: number
  max: number
}

export function clientIp(headers: Record<string, string | undefined>): string {
  return headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || 'unknown'
}

export function rateLimited(ip: string, opts: RateLimitOptions): boolean {
  const key = `${opts.name}:${ip}`
  const now = Date.now()
  const bucket = buckets.get(key) ?? { times: [] }
  bucket.times = bucket.times.filter((t) => now - t < opts.windowMs)
  bucket.times.push(now)
  buckets.set(key, bucket)
  if (buckets.size > MAX_TRACKED_KEYS) {
    // Drop the oldest-inserted entries rather than growing without bound.
    for (const k of buckets.keys()) {
      if (buckets.size <= MAX_TRACKED_KEYS / 2) break
      buckets.delete(k)
    }
  }
  return bucket.times.length > opts.max
}

/**
 * Same-origin evidence check for browser-only endpoints (the search beacon).
 * Browsers send an Origin or Referer for fetch() calls from our own pages;
 * if either is present it must match our host. When both are absent (privacy
 * extensions, strict referrer policies) we let the request through — this is
 * a bar-raiser against drive-by scripted abuse, not an auth mechanism.
 */
export function originAllowed(headers: Record<string, string | undefined>): boolean {
  const host = headers['host']
  if (!host) return true
  const evidence = headers['origin'] ?? headers['referer']
  if (!evidence) return true
  try {
    return new URL(evidence).host === host
  } catch {
    return false
  }
}
