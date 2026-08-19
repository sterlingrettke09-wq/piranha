// Client for the accounts + watchlist endpoints.
//
// Every function here returns a DISCRIMINATED RESULT rather than throwing or
// returning null. The server distinguishes "this parcel has no identifier in its
// city's records" from "the request was malformed" from "you are signed out",
// and a client that collapsed those into a thrown Error would put all three
// behind one "something went wrong" — which is false for the first, since that
// one is an answer about the parcel and nothing is wrong at all.

export interface SessionUser {
  id: string
  email: string
}

export interface WatchSnapshot {
  districtCode: string | null
  maxHeightFt: number | null
  maxFAR: number | null
  lotSqFt: number | null
  developable: boolean | null
}

export interface ParcelVintage {
  basis: 'resolved' | 'pinned-fallback' | 'not-versioned'
  year: string | null
  layerUrl: string | null
  why?: string
}

export interface WatchRow {
  city: string
  parcelId: string
  addedAt: string
  address: string | null
  snapshot: WatchSnapshot
  parcelVintage: ParcelVintage
  spec?: { use?: string; gfa?: number; units?: number }
  resolution: 'resolves' | 'not-in-layer' | 'check-failed' | 'unchecked'
  lastCheckedAt: string | null
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function getSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth-session', { credentials: 'same-origin' })
    if (!res.ok) return null
    return ((await res.json()) as { user: SessionUser | null }).user
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth-session', { method: 'DELETE', credentials: 'same-origin' })
  } catch {
    // The cookie is cleared server-side or it is not; either way there is
    // nothing useful to tell the user here, and the next call will 401.
  }
}

/** ⚠️ ALWAYS RESOLVES THE SAME WAY on the happy and unhappy paths, because the
 *  endpoint does. It answers 204 whether or not the address has an account,
 *  whether or not mail was sent, and whether or not it was throttled — anything
 *  else is an account-enumeration oracle. So the UI can only ever say "if that
 *  address is valid, a link is on its way", and this returns whether the request
 *  was DELIVERED, never whether an email exists. */
export async function requestSignIn(email: string): Promise<'sent' | 'network-error'> {
  try {
    const res = await fetch('/api/auth-request', {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'same-origin',
      body: JSON.stringify({ email }),
    })
    return res.ok ? 'sent' : 'network-error'
  } catch {
    return 'network-error'
  }
}

export type ListResult =
  | { kind: 'ok'; rows: WatchRow[] }
  | { kind: 'signed-out' }
  | { kind: 'error'; detail: string }

export async function listWatchlist(): Promise<ListResult> {
  try {
    const res = await fetch('/api/watchlist', { credentials: 'same-origin' })
    if (res.status === 401) return { kind: 'signed-out' }
    if (!res.ok) return { kind: 'error', detail: `The server answered ${res.status}.` }
    return { kind: 'ok', rows: ((await res.json()) as { rows: WatchRow[] }).rows }
  } catch {
    return { kind: 'error', detail: 'Could not reach the server.' }
  }
}

export interface AddWatchInput {
  city: string
  parcelId: string | null
  address: string | null
  snapshot: WatchSnapshot
  spec?: WatchRow['spec']
}

export type AddResult =
  | { kind: 'added'; row: WatchRow }
  | { kind: 'already-watching'; row: WatchRow }
  /** An ANSWER about the parcel, not a failure. 7.1% of Dallas parcels — condo
   *  footprints and a few thousand blank records — carry no identifier at all. */
  | { kind: 'not-watchable'; detail: string }
  | { kind: 'list-full'; detail: string }
  | { kind: 'signed-out' }
  | { kind: 'error'; detail: string }

export async function addWatch(input: AddWatchInput): Promise<AddResult> {
  try {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'same-origin',
      body: JSON.stringify(input),
    })
    if (res.status === 401) return { kind: 'signed-out' }
    if (!res.ok) return { kind: 'error', detail: `The server answered ${res.status}.` }
    const b = (await res.json()) as
      | { ok: true; row: WatchRow; alreadyPresent: boolean }
      | { ok: false; reason: string; detail: string }
    if (b.ok) return b.alreadyPresent ? { kind: 'already-watching', row: b.row } : { kind: 'added', row: b.row }
    if (b.reason === 'no-usable-parcel-id') return { kind: 'not-watchable', detail: b.detail }
    if (b.reason === 'list-full') return { kind: 'list-full', detail: b.detail }
    return { kind: 'error', detail: b.detail }
  } catch {
    return { kind: 'error', detail: 'Could not reach the server.' }
  }
}

export async function removeWatch(city: string, parcelId: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ city, parcelId })
    const res = await fetch(`/api/watchlist?${q}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!res.ok) return false
    return ((await res.json()) as { removed: boolean }).removed
  } catch {
    return false
  }
}
