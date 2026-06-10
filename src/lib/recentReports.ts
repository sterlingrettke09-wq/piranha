// ---- Recent reports memory (WO-8.3) ----
// A tiny localStorage ring buffer of the feasibility reports a visitor has
// loaded, so we can offer "pick up where you left off" without accounts. It is
// the only piece of cross-session state we keep, and it never leaves the
// browser (see /privacy). Every storage touch is wrapped in try/catch because
// private-browsing modes (and the odd locked-down profile) throw on access.

import type { CheckStatus } from '../types/analysis'

const KEY = 'tpp_recent_reports'
/** How many UNPINNED entries the ring holds. Pinned entries are kept on top of
 *  this — a user who pins twelve reports keeps all twelve plus the rolling
 *  window of unpinned ones. */
const MAX_UNPINNED = 12

export interface RecentReport {
  /** The result URL to return to (pathname + search). Also the dedupe key. */
  url: string
  address: string
  /** City slug (resolve to a label with cityName()). */
  city: string
  verdict: CheckStatus
  /** Total estimated cost in dollars, for the compact card. */
  totalCost: number
  /** When this report was last loaded (Date.now()). */
  ts: number
  /** Pinned entries survive past the ring buffer's cap. */
  pinned?: boolean
}

/** Read + parse the stored list, tolerating absent/corrupt/blocked storage. */
function read(): RecentReport[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Keep only entries that have the shape we rely on; drop anything stale or
    // malformed so a bad write can never crash a render.
    return parsed.filter(
      (e): e is RecentReport =>
        e != null &&
        typeof e === 'object' &&
        typeof (e as RecentReport).url === 'string' &&
        typeof (e as RecentReport).address === 'string' &&
        typeof (e as RecentReport).city === 'string' &&
        typeof (e as RecentReport).verdict === 'string' &&
        typeof (e as RecentReport).totalCost === 'number' &&
        typeof (e as RecentReport).ts === 'number',
    )
  } catch {
    return []
  }
}

/** Serialize + persist, swallowing quota / private-mode failures. */
function write(list: RecentReport[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable (private mode, quota, disabled) — memory is a
    // best-effort nicety, never load-bearing, so we silently give up.
  }
}

/** Enforce the cap: pinned entries are never evicted; the oldest UNPINNED ones
 *  past MAX_UNPINNED are dropped. Input is assumed newest-first. */
function evict(list: RecentReport[]): RecentReport[] {
  let unpinnedKept = 0
  return list.filter((e) => {
    if (e.pinned) return true
    unpinnedKept += 1
    return unpinnedKept <= MAX_UNPINNED
  })
}

/**
 * Record (or refresh) a report. Deduped by `url`: an existing entry is moved to
 * the front with its `ts` updated and its `pinned` flag preserved. The list is
 * then capped (pinned entries protected).
 */
export function recordReport(entry: Omit<RecentReport, 'pinned'>): void {
  const list = read()
  const existing = list.find((e) => e.url === entry.url)
  const next: RecentReport = {
    ...entry,
    pinned: existing?.pinned ?? false,
  }
  const rest = list.filter((e) => e.url !== entry.url)
  write(evict([next, ...rest]))
}

/** All stored reports, newest activity first. */
export function listReports(): RecentReport[] {
  return read()
}

/** Forget a single report (the ✕ on a card). */
export function removeReport(url: string): void {
  const list = read()
  write(list.filter((e) => e.url !== url))
}

/**
 * Toggle the pinned flag for a report. Pinning protects it from ring eviction;
 * unpinning re-applies the cap (so a freshly-unpinned entry can fall off if the
 * window is already full). Returns the new pinned state (false if not found).
 */
export function togglePin(url: string): boolean {
  const list = read()
  const target = list.find((e) => e.url === url)
  if (!target) return false
  const nextPinned = !target.pinned
  const updated = list.map((e) => (e.url === url ? { ...e, pinned: nextPinned } : e))
  write(evict(updated))
  return nextPinned
}

/** Wipe all stored reports (the clear-all control). */
export function clearAll(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Same private-mode tolerance as write().
  }
}
