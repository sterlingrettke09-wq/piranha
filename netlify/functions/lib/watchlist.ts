// The watchlist: durable per-parcel state, and the precondition for any alert.
//
// ── THE KEY IS THE PARCEL, AND NOTHING ELSE ─────────────────────────────────
//
// `(city, parcelId)`, stored as two fields rather than one concatenated string
// so a row can be queried by city when a provider changes.
//
// NOT the address: an address geocodes to a parcel and that mapping is unstable
// — this repo measured 17% wrong-parcel before the interior-point fix, and some
// cities' own address fields sit on the wrong geometry. Keying on the address
// means the same entry can resolve to different land next month, which is
// indistinguishable from the change we would be alerting on.
//
// NOT the coordinates: a point moves relative to boundaries and adjacent parcels
// are metres apart.
//
// NOT the project spec: use / GFA / units are a QUERY against the parcel, not
// the parcel. Someone watching a lot cares that the zoning moved regardless of
// what they had planned to build there, so the spec rides along as an optional
// attribute and is never part of the key.
//
// ── ⚠️ THE ID IS NOT GUARANTEED PRESENT, UNIQUE, OR PERMANENT ───────────────
//
// Checked against three cities' live layers on 2026-08-19 BEFORE this schema was
// written, because all three failure modes are schema decisions and not bugs:
//
//   nyc      BBL      856,614 rows, 856,614 distinct, 0 null. A sound key.
//   chicago  PIN10    5 null of 1,432,483. Uniqueness UNMEASURED — the service
//                     refuses a distinct-count (HTTP 400), so it is a gap and
//                     not a pass. And Cook County publishes TWENTY-SIX
//                     year-versioned parcel layers (2000-2025) plus a "Parcel
//                     History 2000-2023" layer carrying `LastTaxed`. The
//                     county's own data model states that the fabric changes
//                     between years; the provider pins /2025, so a watch stored
//                     today reads a frozen year the moment 2026 is published.
//                     That is a scheduled event, not a hypothetical.
//   dallas   ACCT     35,383 of 500,142 rows (7.1%) carry no usable id — 3,660
//                     the literal string 'MULTIPLE' (condominium footprints),
//                     29,090 empty, 2,633 null.
//
// Two consequences are built in below rather than commented on:
//
//   1. `addWatch` REFUSES a parcel with no usable id, and says so. Seven percent
//      of Dallas cannot be watched, and a user must be told that at the moment
//      they try — not left with a row that silently never fires.
//   2. An id that stops resolving is a STATE (`not-in-layer`), never an error
//      and never a silent drop. It is arguably the most important alert the
//      system can send, since a parcel leaving the fabric usually means it was
//      subdivided or merged.
//
// `parcelVintage` is stored for the same reason: without it, `not-in-layer` is
// ambiguous between "this parcel was retired" and "we are reading last year's
// layer", and those call for opposite responses. It carries the BASIS as well as
// the year, so "we could not read the layer list and used the pinned floor" is
// distinguishable from "this is the current year" — see providers/parcelVintage.ts.
//
// ── AND THE CHECKER MUST COMPARE VINTAGES BEFORE IT COMPARES SNAPSHOTS ──────
//
// When Cook County publishes `Parcel 2026`, every Chicago row stored before that
// day was read against a different fabric. A parcel that stops resolving has
// almost certainly been subdivided or merged — which is an alert worth sending —
// but it is NOT the same event as its zoning changing, and diffing the snapshots
// across a vintage boundary would report it as one.

import { blobStore } from './store'
import type { ParcelVintage } from './providers/parcelVintage'

const STORE = 'watchlists'

/** Fields an alert could fire on. Each is stored as it was resolved, so a diff
 *  can name WHAT changed rather than reporting that a hash moved. */
export interface WatchSnapshot {
  districtCode: string | null
  maxHeightFt: number | null
  maxFAR: number | null
  lotSqFt: number | null
  /** Whether the parcel was judged developable at the time of adding. */
  developable: boolean | null
}

export type WatchResolution =
  /** The id resolved in the parcel layer on the last check. */
  | 'resolves'
  /** The id did not resolve. A STATE about the parcel, not a failure of ours. */
  | 'not-in-layer'
  /** The check could not be performed — network, service error, layer down.
   *  ⚠️ Distinct from `not-in-layer` on purpose: one says the parcel is gone,
   *  the other says we do not know, and collapsing them would fire an alert for
   *  every upstream outage. */
  | 'check-failed'
  /** More than one row in the city's layer carries this id, so there is no
   *  single parcel to compare. Measured per city, not assumed — see
   *  `parcelLookup.ts`. */
  | 'ambiguous'
  /** This city has no by-id parcel lookup wired, so the row cannot be checked at
   *  all. NOBODY LOOKED — not a failure, and not a missing parcel. */
  | 'no-lookup'
  /** Never checked since being added. */
  | 'unchecked'

export interface WatchRow {
  city: string
  parcelId: string
  addedAt: string
  /** Display only. Never a key, never compared, never used to re-find the parcel. */
  address: string | null
  /** The answer when the row was created. Without a prior state there is no diff,
   *  so this is what makes the row alertable at all. */
  snapshot: WatchSnapshot
  /** WHICH FABRIC THIS ROW WAS READ AGAINST — the whole state, not a year string.
   *
   *  The three bases are not interchangeable and the checker must branch on them:
   *    `resolved`        a real tax year, read from the service's layer list.
   *    `pinned-fallback` the layer list could not be read and the pinned floor
   *                      was used. The row is usable and is NOT evidence that
   *                      this year is current.
   *    `not-versioned`   this city's fabric carries no year. An answer.
   *
   *  A bare year string could not express the middle case, and a row that cannot
   *  tell "2025 is current" from "we could not check" would let a metadata blip
   *  freeze a watch permanently with nothing recording it. */
  parcelVintage: ParcelVintage
  /** Optional, and explicitly not part of the identity. */
  spec?: { use?: string; gfa?: number; units?: number }
  resolution: WatchResolution
  lastCheckedAt: string | null
}

export type AddResult =
  | { ok: true; row: WatchRow; alreadyPresent: boolean }
  | { ok: false; reason: 'no-usable-parcel-id'; detail: string }
  | { ok: false; reason: 'unknown-city'; detail: string }

/** ⚠️ Values that LOOK like an id and are not one. Enumerated, not
 *  pattern-matched: a regex broad enough to catch these would eventually catch a
 *  real id. Every entry carries the count that put it here — add to this list
 *  only with a measurement behind the entry, never on suspicion. */
const PLACEHOLDER_IDS = new Set([
  'MULTIPLE',   // Dallas, 3,660 rows — condominium footprints
  ' --',        // LA, 19 rows of 2,432,668 — the trimmed form is '--'
  '--',
  '0000000000000', // Miami, 5,128 rows of 596,113
  '-',          // Columbus, ~410 rows
  'UNKNOWN', 'NONE', 'N/A', 'NULL',
])

export function usableParcelId(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null
  if (PLACEHOLDER_IDS.has(s.toUpperCase())) return null
  return s
}

/** One blob per user, holding their rows. Chosen over one blob per row because
 *  the read path is always "show me my whole list" and Blobs has no query. */
const keyFor = (userId: string) => `u/${userId}`

/** Within a user, the row's identity. City first so a prefix scan by city works. */
export const rowKey = (city: string, parcelId: string) => `${city} ${parcelId}`

export async function readWatchlist(userId: string): Promise<WatchRow[]> {
  const rows = (await blobStore(STORE).get(keyFor(userId), { type: 'json' })) as WatchRow[] | null
  return rows ?? []
}

async function writeWatchlist(userId: string, rows: WatchRow[]): Promise<void> {
  await blobStore(STORE).setJSON(keyFor(userId), rows)
}

export interface AddInput {
  city: string
  parcelId: string | null | undefined
  address: string | null
  snapshot: WatchSnapshot
  parcelVintage: ParcelVintage
  spec?: WatchRow['spec']
}

export async function addWatch(
  userId: string,
  input: AddInput,
  knownCity: (slug: string) => boolean,
  now = new Date(),
): Promise<AddResult> {
  if (!knownCity(input.city)) {
    return { ok: false, reason: 'unknown-city', detail: `${input.city} is not a covered city` }
  }
  const id = usableParcelId(input.parcelId)
  if (id == null) {
    // Stated, not swallowed. This is the Dallas 7.1%, and the user needs to see
    // it at the moment of adding rather than discover it as silence later.
    return {
      ok: false,
      reason: 'no-usable-parcel-id',
      detail:
        "This parcel has no usable identifier in its city's records, so it cannot be watched. " +
        'Condominium footprints and a small share of other records are published without one.',
    }
  }
  const rows = await readWatchlist(userId)
  const k = rowKey(input.city, id)
  const existing = rows.find((r) => rowKey(r.city, r.parcelId) === k)
  if (existing) return { ok: true, row: existing, alreadyPresent: true }

  const row: WatchRow = {
    city: input.city,
    parcelId: id,
    addedAt: now.toISOString(),
    address: input.address,
    snapshot: input.snapshot,
    parcelVintage: input.parcelVintage,
    ...(input.spec ? { spec: input.spec } : {}),
    resolution: 'unchecked',
    lastCheckedAt: null,
  }
  await writeWatchlist(userId, [...rows, row])
  return { ok: true, row, alreadyPresent: false }
}

export async function removeWatch(userId: string, city: string, parcelId: string): Promise<boolean> {
  const rows = await readWatchlist(userId)
  const k = rowKey(city, parcelId)
  const kept = rows.filter((r) => rowKey(r.city, r.parcelId) !== k)
  if (kept.length === rows.length) return false
  await writeWatchlist(userId, kept)
  return true
}

export interface FieldChange {
  field: keyof WatchSnapshot
  from: WatchSnapshot[keyof WatchSnapshot]
  to: WatchSnapshot[keyof WatchSnapshot]
}

export interface SnapshotDiff {
  changed: FieldChange[]
  becameUnavailable: FieldChange[]
  becameAvailable: FieldChange[]
}

/** What moved between two snapshots, field by field.
 *
 *  ⚠️ `null` MEANS "NOT RESOLVED", NOT "ZERO", so a field going null is NOT
 *  reported as a change in the value — it is reported separately as the value
 *  becoming unavailable, and the caller decides whether that is alertable.
 *  Treating "we stopped being able to read the FAR" as "the FAR changed" would
 *  fire an alert every time an upstream had a bad afternoon, which is exactly
 *  the failure the reproducibility precondition exists to prevent. */
export function diffSnapshots(before: WatchSnapshot, after: WatchSnapshot): SnapshotDiff {
  const fields: (keyof WatchSnapshot)[] = [
    'districtCode',
    'maxHeightFt',
    'maxFAR',
    'lotSqFt',
    'developable',
  ]
  const changed: FieldChange[] = []
  const becameUnavailable: FieldChange[] = []
  const becameAvailable: FieldChange[] = []
  for (const f of fields) {
    const a = before[f]
    const b = after[f]
    if (a === b) continue
    if (a != null && b == null) becameUnavailable.push({ field: f, from: a, to: b })
    else if (a == null && b != null) becameAvailable.push({ field: f, from: a, to: b })
    else changed.push({ field: f, from: a, to: b })
  }
  return { changed, becameUnavailable, becameAvailable }
}
