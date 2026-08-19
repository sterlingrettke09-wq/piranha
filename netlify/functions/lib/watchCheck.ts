// THE CHECKER: what re-resolving a watched parcel is allowed to conclude.
//
// Pure. It takes a stored row and the result of re-reading that parcel, and
// returns the events that follow. No fetching, no storage, no delivery — those
// are the caller's, and keeping them out is what makes every branch below
// testable without a network.
//
// ── THE ORDER IS FIXED, AND IT IS NOT COSMETIC ──────────────────────────────
//
//   1. Could we check at all?      → `check-failed`, and STOP. Never an alert.
//   2. Is the source diffable?     → refuse, and STOP.
//   3. Did the FABRIC change?      → report that, and never diff across it.
//   4. Is the parcel still there?  → `not-in-layer` is an event in itself.
//   5. Only now, diff the fields.
//
// Each earlier step can produce a change in the later ones for a reason that has
// nothing to do with the land. Cook County publishes one parcel layer per tax
// year; when 2026 lands, every Chicago row was stored against a different fabric,
// and diffing a 2025 snapshot against a 2026 read would report boundary and area
// revisions as if the parcel had been rezoned. So the vintage is compared BEFORE
// the snapshot, always, and a vintage change suppresses the field diff rather
// than annotating it.
//
// ── AND WHY "WE COULD NOT READ IT" IS NEVER AN ALERT ────────────────────────
//
// `null` in a snapshot means "not resolved", not zero. A field that stops
// resolving because a service had a bad afternoon is not a change in the world,
// and `diffSnapshots` already separates `becameUnavailable` from `changed` for
// exactly that reason. This file carries the separation through: only `changed`
// is alertable, and the other two are recorded so a row's history is complete.

import { diffSnapshots, type WatchRow, type WatchSnapshot, type WatchResolution } from './watchlist'
import type { ParcelVintage } from './providers/parcelVintage'

/** What a re-read of the parcel produced. FIVE cases, and each one exists
 *  because collapsing it into another would produce a false statement:
 *
 *    resolved      the answer now
 *    not-in-layer  the service answered; no row carries this id
 *    unreachable   the service did not answer
 *    ambiguous     several rows carry this id, so "the" parcel is undefined
 *    no-lookup     this city has no by-id lookup; NOBODY LOOKED */
export type Reread =
  /** The parcel resolved and here is its answer now. */
  | { kind: 'resolved'; snapshot: WatchSnapshot; vintage: ParcelVintage }
  /** The service ANSWERED and no parcel carries this id. A fact about the land. */
  | { kind: 'not-in-layer'; vintage: ParcelVintage }
  /** The service did not answer. A fact about the network, and about nothing else. */
  | { kind: 'unreachable'; detail: string }
  /** More than one row carries this id, so the watched parcel is undefined.
   *  Rare but real — Chicago's `1716405037` carries two rows, and Charlotte and
   *  Columbus each show one duplicate in a spread sample. Diffing would compare
   *  against whichever row came back first. See parcelLookup.ts for the figures
   *  and for the sampler defect that first overstated them. */
  | { kind: 'ambiguous'; matches: number }
  /** No by-id lookup is wired for this city. NOBODY LOOKED — distinct from both
   *  a failed check and a missing parcel. */
  | { kind: 'no-lookup'; detail: string }

export type WatchEvent =
  /** A field the source publishes moved. THE alertable event. */
  | { kind: 'field-changed'; field: keyof WatchSnapshot; from: unknown; to: unknown }
  /** The parcel left the fabric — usually a subdivision or a merge. Alertable,
   *  and arguably the most important thing this system can say. */
  | { kind: 'left-the-layer' }
  /** The city republished its parcel fabric under a new vintage. Not a change in
   *  the parcel, and it suppresses the field diff for this run. */
  | { kind: 'fabric-rebased'; from: string | null; to: string | null }
  /** A value we used to resolve, and no longer can. Recorded, never alerted. */
  | { kind: 'became-unavailable'; field: keyof WatchSnapshot }
  /** A value we could not resolve, and now can. Recorded, never alerted. */
  | { kind: 'became-available'; field: keyof WatchSnapshot; to: unknown }

export interface CheckOutcome {
  /** What the row's `resolution` should become. */
  resolution: WatchResolution
  events: WatchEvent[]
  /** Events worth sending. A strict subset of `events`, and often empty when
   *  `events` is not — which is the point. */
  alertable: WatchEvent[]
  /** Why nothing was compared, when nothing was. Null when a diff ran. */
  suppressed: string | null
}

const ALERTABLE = new Set(['field-changed', 'left-the-layer'])

/** Two vintages describe the same fabric?
 *
 *  ⚠️ `pinned-fallback` NEVER counts as a rebase against anything. It means the
 *  layer list could not be read and the floor was used, so its year is not
 *  evidence about what is current — treating it as a rebase would announce a
 *  republication every time Cook County's metadata endpoint had a blip, and
 *  treating it as a match would hide a real one. Neither: the run is suppressed
 *  and says so. */
export function sameFabric(a: ParcelVintage, b: ParcelVintage): boolean {
  if (a.basis === 'not-versioned' && b.basis === 'not-versioned') return true
  if (a.basis === 'resolved' && b.basis === 'resolved') return a.year === b.year
  return false
}

export interface CheckInput {
  row: WatchRow
  reread: Reread
  /** Whether the register says this city's source may be diffed at all. The
   *  checker does not decide this and must not guess it. */
  sourceDiffable: boolean
}

export function checkWatch({ row, reread, sourceDiffable }: CheckInput): CheckOutcome {
  // 1. Could we check at all? An outage is not an event about the parcel, and
  //    firing on it would make every upstream wobble look like a rezoning.
  if (reread.kind === 'unreachable') {
    return {
      resolution: 'check-failed',
      events: [],
      alertable: [],
      suppressed: `the parcel could not be re-read (${reread.detail})`,
    }
  }
  // 1b. Nobody looked, which is not the same as looking and failing. A row in a
  //     city with no by-id lookup must not accumulate `check-failed` forever as
  //     though something were broken.
  if (reread.kind === 'no-lookup') {
    return { resolution: 'no-lookup', events: [], alertable: [], suppressed: reread.detail }
  }
  // 1c. More than one row carries this id, so "the" parcel is undefined and any
  //     diff would be against whichever row the service returned first.
  if (reread.kind === 'ambiguous') {
    return {
      resolution: 'ambiguous',
      events: [],
      alertable: [],
      suppressed: `${reread.matches} rows carry this parcel id, so there is no single parcel to compare`,
    }
  }

  // 2. The register gates everything downstream. A source not observed holding
  //    still produces diffs that are indistinguishable from noise — this is the
  //    NYC feed, 4,394 → 1,040 → 8,103 on an unchanged query.
  if (!sourceDiffable) {
    return {
      resolution: reread.kind === 'not-in-layer' ? 'not-in-layer' : 'resolves',
      events: [],
      alertable: [],
      suppressed: 'this source has not been observed reproducing, so a diff of it would be noise',
    }
  }

  // 3. The fabric, before the fields.
  if (!sameFabric(row.parcelVintage, reread.vintage)) {
    const from = row.parcelVintage
    const to = reread.vintage
    // A fallback on either side is not evidence of a republication; it is an
    // absence of evidence, and it must not render as one.
    if (from.basis === 'pinned-fallback' || to.basis === 'pinned-fallback') {
      return {
        resolution: reread.kind === 'not-in-layer' ? 'not-in-layer' : 'resolves',
        events: [],
        alertable: [],
        suppressed:
          'the parcel map’s vintage could not be confirmed on one side, so this run cannot tell a ' +
          'republication from a metadata failure',
      }
    }
    const ev: WatchEvent = { kind: 'fabric-rebased', from: from.year, to: to.year }
    // A parcel that vanishes ACROSS a rebase is the ordinary consequence of a
    // republication, so it is reported as the rebase and not as a loss — the
    // next run, on one fabric, is what establishes whether it is really gone.
    return {
      resolution: reread.kind === 'not-in-layer' ? 'not-in-layer' : 'resolves',
      events: [ev],
      alertable: [ev],
      suppressed: 'the city republished its parcel map, so fields were not compared across the boundary',
    }
  }

  // 4. Still on the same fabric — so a missing parcel really is a missing parcel.
  if (reread.kind === 'not-in-layer') {
    const ev: WatchEvent = { kind: 'left-the-layer' }
    return { resolution: 'not-in-layer', events: [ev], alertable: [ev], suppressed: null }
  }

  // 5. Only now.
  const d = diffSnapshots(row.snapshot, reread.snapshot)
  const events: WatchEvent[] = [
    ...d.changed.map((c) => ({ kind: 'field-changed' as const, field: c.field, from: c.from, to: c.to })),
    ...d.becameUnavailable.map((c) => ({ kind: 'became-unavailable' as const, field: c.field })),
    ...d.becameAvailable.map((c) => ({ kind: 'became-available' as const, field: c.field, to: c.to })),
  ]
  return {
    resolution: 'resolves',
    events,
    alertable: events.filter((e) => ALERTABLE.has(e.kind)),
    suppressed: null,
  }
}

/** The row as it should be stored after a check. The SNAPSHOT is only advanced
 *  when a comparison actually ran on one fabric — otherwise the next run would
 *  silently adopt an uncompared reading as its baseline and the change would
 *  never be reported by anyone. */
export function applyCheck(row: WatchRow, reread: Reread, outcome: CheckOutcome, now: Date): WatchRow {
  const advance = outcome.suppressed == null && reread.kind === 'resolved'
  return {
    ...row,
    resolution: outcome.resolution,
    lastCheckedAt: now.toISOString(),
    ...(advance ? { snapshot: reread.snapshot } : {}),
    // The vintage IS advanced on a confirmed rebase, so the next run compares on
    // one fabric. It is NOT advanced when the vintage could not be confirmed, and
    // the kinds that carry no vintage at all — unreachable, ambiguous, no-lookup —
    // never touch it: none of them read a fabric, so none of them may claim one.
    ...((reread.kind === 'resolved' || reread.kind === 'not-in-layer') &&
    reread.vintage.basis !== 'pinned-fallback'
      ? { parcelVintage: reread.vintage }
      : {}),
  }
}
