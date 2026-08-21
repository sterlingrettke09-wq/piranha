import type { JsonHandler } from './lib/handlerType'
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

// ⚠️ THE OPTIONAL FIELDS ARE VALIDATED AGAINST CLOSED SETS, NOT PASSED THROUGH.
// This is an unauthenticated write endpoint, so an unbounded string here is
// storage cost and a garbage row in the only instrument that tells us what
// people actually search for. An unrecognised value is DROPPED rather than
// stored — a missing field reads as "not sent", which is true, where a stored
// junk value would read as a finding.
const USES = new Set(['residential', 'commercial', 'mixed', 'institutional'])
const PROJECT_TYPES = new Set(['new', 'addition', 'adu', 'change_of_use'])
const VERDICTS = new Set(['AS_OF_RIGHT', 'NEEDS_RELIEF', 'PROHIBITED', 'INDETERMINATE'])
// Generous but finite. gfa is square feet, units a unit count, months a
// lifecycle estimate — each is bounded so a malformed or hostile value cannot
// skew an average later.
const MAX_GFA = 10_000_000
const MAX_UNITS = 10_000
const MAX_MONTHS = 600

/** A finite, non-negative number within `max`, or undefined. ⚠️ Returns
 *  undefined for NaN, Infinity and negatives rather than coercing — `Number('')`
 *  is 0, so a bare presence check would store a real-looking zero for a field
 *  the client never sent. */
function boundedNumber(raw: string | undefined, max: number): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
}

function oneOf(raw: string | undefined, allowed: Set<string>): string | undefined {
  return raw != null && allowed.has(raw) ? raw : undefined
}

export const handler: JsonHandler = async (event) => {
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
  // ⚠️ SPREAD THE OPTIONALS RATHER THAN ASSIGNING THEM. An explicit
  // `use: undefined` still creates the key, and `setJSON` would persist
  // `"use": null` — which is a value, and would be indistinguishable from a
  // client that sent one. Omitting the key keeps "not sent" and "sent empty"
  // different facts (rule 5, at the storage layer).
  await logSearch({
    ts: new Date().toISOString(),
    city,
    address,
    kind,
    ...(oneOf(p.use, USES) != null ? { use: oneOf(p.use, USES) } : {}),
    ...(oneOf(p.projectType, PROJECT_TYPES) != null ? { projectType: oneOf(p.projectType, PROJECT_TYPES) } : {}),
    ...(oneOf(p.verdict, VERDICTS) != null ? { verdict: oneOf(p.verdict, VERDICTS) } : {}),
    ...(boundedNumber(p.gfa, MAX_GFA) != null ? { gfa: boundedNumber(p.gfa, MAX_GFA) } : {}),
    ...(boundedNumber(p.units, MAX_UNITS) != null ? { units: boundedNumber(p.units, MAX_UNITS) } : {}),
    ...(boundedNumber(p.months, MAX_MONTHS) != null ? { months: boundedNumber(p.months, MAX_MONTHS) } : {}),
  })
  return { statusCode: 204, headers: HEADERS, body: '' }
}
