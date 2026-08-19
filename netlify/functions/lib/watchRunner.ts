// THE RUNNER: re-read every watched parcel, decide, persist, report.
//
// The plumbing around `watchCheck.ts`. That file decides; this one fetches,
// consults the stability register, writes the rows back and returns a report.
// The split is deliberate — every decision stays testable without a network, and
// everything here is the part that can only be wrong about I/O.
//
// ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
//
// It does not send anything. Delivery is gated on the register being re-observed
// over a real interval (due 2026-08-26) and on this having been watched produce
// no false positives, so the runner's job today is to produce `alertable` events
// and stop. A runner that mailed on its first run would be asserting exactly the
// confidence the register was built to withhold.
//
// ── AND THE ONE THING IT MUST NOT GET WRONG ─────────────────────────────────
//
// A row is written back ONLY through `applyCheck`, which advances the stored
// snapshot only when a comparison actually ran on one fabric. If the runner
// updated snapshots itself, a suppressed run would bank the new reading and the
// change would be reported by nobody — this run declined to compare it, and the
// next would find it already the baseline.

import { blobStore } from './store'
import { readWatchlist, type WatchRow, type WatchSnapshot } from './watchlist'
import { checkWatch, applyCheck, type CheckOutcome, type Reread } from './watchCheck'
import { findParcelById, type LookupResult } from './parcelLookup'
import { interiorPoint } from './interiorPoint'
import { getParcelInfo } from './parcel'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { ParcelResult } from './arcgis'

const WATCHLISTS = 'watchlists'

/** Which cities may be diffed. Supplied by the caller from the stability
 *  register rather than read here, so the runner cannot quietly decide that a
 *  source it wants to check is fine. */
export type DiffableFor = (city: string) => boolean

export interface RowResult {
  city: string
  parcelId: string
  outcome: CheckOutcome
}

export interface RunReport {
  /** Watchlists visited. Reported so "0 events" cannot be read as "all clear"
   *  when the real answer is "there was nothing to check" (rule 20). */
  lists: number
  rows: number
  checked: number
  /** Rows where a comparison actually ran on one fabric. The only population any
   *  "no changes found" statement may be made about. */
  compared: number
  suppressed: number
  results: RowResult[]
  /** Every alertable event, with the row it came from. Not sent — see the header. */
  alerts: RowResult[]
  errors: string[]
}

/** THE RE-READ, THROUGH THE REAL PIPELINE.
 *
 *  ⚠️ WHY THIS IS NOT AN ATTRIBUTE READ, recorded because the attribute version
 *  was written first and shipped a wrong number within minutes of meeting a live
 *  service. Reading the parcel row's own columns gave San Francisco a lot area of
 *  `2.7e-7`: `Shape__Area` on that layer is in SQUARE DEGREES, and a regex
 *  matching "shape area" had turned an unlabelled projection unit into square
 *  feet by assumption (rule 12 — never convert through a unit the code does not
 *  use). Denver's 1,216,414 from the same path is equally unverifiable.
 *
 *  And the deeper problem the unit bug was only a symptom of: a PARCEL layer
 *  carries no zoning, no height, no FAR and no developability. An attribute read
 *  cannot reproduce the snapshot the report stored, so four of the five fields
 *  would be permanently invisible — either diffing as losses on the first run, or
 *  carried through forever, which is a checker that can never fire.
 *
 *  So: find the parcel by id to get its GEOMETRY, take an interior point, and run
 *  `getParcelInfo` — the same function `/api/analyze` calls. Same composition,
 *  same units, same fields.
 *
 *  The interior point matters and is not a centroid: an area-weighted centroid
 *  falls outside a concave lot, and the recorded Charlotte failure had one land
 *  in the neighbouring parcel while everything downstream still looked valid. */
export function snapshotFromInfo(info: ParcelInfo, developable: boolean | null): WatchSnapshot {
  return {
    districtCode: info.zoning.districtCode || null,
    maxHeightFt: info.zoning.maxHeightFt,
    maxFAR: info.zoning.maxFAR,
    lotSqFt: info.lot.sizeSqFt,
    developable,
  }
}

export type ReadParcel = (city: string, lat: number, lng: number) => Promise<ParcelResult>

export async function rereadFrom(
  row: WatchRow,
  lookup: LookupResult,
  readParcel: ReadParcel,
): Promise<Reread> {
  switch (lookup.kind) {
    case 'unreachable':
      return { kind: 'unreachable', detail: lookup.detail }
    case 'no-lookup':
      return { kind: 'no-lookup', detail: lookup.detail }
    case 'ambiguous':
      return { kind: 'ambiguous', matches: lookup.matches }
    case 'absent':
      return { kind: 'not-in-layer', vintage: lookup.vintage }
    case 'found': {
      if (!lookup.rings || lookup.rings.length === 0) {
        // The row exists but carries no geometry, so the pipeline cannot be run
        // at it. NOT `not-in-layer` — the parcel is there — and not a silent skip.
        return { kind: 'unreachable', detail: 'the parcel row carried no geometry' }
      }
      const p = interiorPoint(lookup.rings)
      if (!p) return { kind: 'unreachable', detail: 'no interior point could be found in the parcel polygon' }
      const [lng, lat] = p.pt
      const res = await readParcel(row.city, lat, lng)
      if (!res.ok) return { kind: 'unreachable', detail: `${res.code}: ${res.message}` }

      // ⚠️ THE IDENTITY GUARD. The point came from THIS parcel's polygon, so the
      // pipeline should land back on it — but a boundary revision, a sliver, or a
      // layer that disagrees with itself can put it on a neighbour, and the whole
      // premise of keying on the parcel is that we never compare one piece of
      // ground against another. A mismatch is refused, loudly, rather than diffed.
      if (res.info.parcelId !== row.parcelId) {
        return {
          kind: 'unreachable',
          detail: `an interior point of ${row.parcelId} resolved to parcel ${res.info.parcelId || '(none)'} — refusing to compare a different parcel`,
        }
      }
      return {
        kind: 'resolved',
        snapshot: snapshotFromInfo(res.info, row.snapshot.developable),
        // The vintage the LOOKUP resolved, not one inferred from the report:
        // it is the fabric the id was matched against.
        vintage: lookup.vintage,
      }
    }
  }
}

export interface RunOptions {
  diffableFor: DiffableFor
  now?: Date
  /** Injected for tests, and so a dry run can be exercised offline. */
  lookup?: typeof findParcelById
  /** The real pipeline by default — the same function /api/analyze calls. */
  readParcel?: ReadParcel
  /** When true, nothing is written back. The report is identical. */
  dryRun?: boolean
}

/** Check one user's list. Exported so a single list can be run without walking
 *  the whole store. */
export async function checkList(
  userId: string,
  opts: RunOptions,
): Promise<{ rows: WatchRow[]; results: RowResult[] }> {
  const lookup = opts.lookup ?? findParcelById
  const readParcel = opts.readParcel ?? getParcelInfo
  const now = opts.now ?? new Date()
  const rows = await readWatchlist(userId)
  const results: RowResult[] = []
  const updated: WatchRow[] = []

  for (const row of rows) {
    const found = await lookup(row.city, row.parcelId)
    const reread = await rereadFrom(row, found, readParcel)
    const outcome = checkWatch({ row, reread, sourceDiffable: opts.diffableFor(row.city) })
    results.push({ city: row.city, parcelId: row.parcelId, outcome })
    updated.push(applyCheck(row, reread, outcome, now))
  }

  if (!opts.dryRun && rows.length > 0) {
    await blobStore(WATCHLISTS).setJSON(`u/${userId}`, updated)
  }
  return { rows: updated, results }
}

/** Every stored watchlist. */
export async function listUserIds(): Promise<string[]> {
  const { blobs } = await blobStore(WATCHLISTS).list({ prefix: 'u/' })
  return blobs.map((b) => b.key.slice(2)).filter(Boolean)
}

export async function runAll(opts: RunOptions): Promise<RunReport> {
  const report: RunReport = {
    lists: 0, rows: 0, checked: 0, compared: 0, suppressed: 0,
    results: [], alerts: [], errors: [],
  }
  let ids: string[]
  try {
    ids = await listUserIds()
  } catch (e) {
    // ⚠️ A store that cannot be listed produces an ERROR, never an empty report.
    // "0 lists, 0 changes" reads as all-clear and would be indistinguishable
    // from every watchlist being fine (rule 20).
    report.errors.push(`could not list watchlists: ${e instanceof Error ? e.message : String(e)}`)
    return report
  }

  for (const id of ids) {
    try {
      const { results } = await checkList(id, opts)
      report.lists++
      report.rows += results.length
      for (const r of results) {
        report.results.push(r)
        report.checked++
        if (r.outcome.suppressed == null) report.compared++
        else report.suppressed++
        if (r.outcome.alertable.length > 0) report.alerts.push(r)
      }
    } catch (e) {
      report.errors.push(`list ${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}

/** One line per run, for a log. States the COMPARED population explicitly,
 *  because "no changes" over a population of zero is the sentence this whole
 *  design exists to avoid printing. */
export function summarise(r: RunReport): string {
  if (r.errors.length > 0 && r.checked === 0) {
    return `watch-run FAILED — nothing was checked. ${r.errors.join('; ')}`
  }
  const head = `watch-run: ${r.lists} list(s), ${r.rows} row(s), ${r.compared} compared, ${r.suppressed} suppressed`
  const tail =
    r.compared === 0
      ? ' — NO ROW WAS COMPARED, so this run says nothing about whether anything changed'
      : r.alerts.length === 0
        ? ` — no changes across the ${r.compared} compared`
        : ` — ${r.alerts.length} row(s) with something to report`
  return head + tail + (r.errors.length ? ` (${r.errors.length} error(s))` : '')
}
