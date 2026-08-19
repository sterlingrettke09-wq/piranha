import { describe, it, expect, vi, beforeEach } from 'vitest'

const mem = new Map<string, unknown>()
/** Set to make the fake store throw, so the "cannot list" path is EXERCISED
 *  rather than simulated by hand-building a report object. */
const broken = { list: false }
vi.mock('./store', () => ({
  blobStore: () => ({
    get: async (k: string) => mem.get(k) ?? null,
    setJSON: async (k: string, v: unknown) => void mem.set(k, v),
    delete: async (k: string) => void mem.delete(k),
    list: async ({ prefix }: { prefix?: string } = {}) => {
      if (broken.list) throw new Error('blobs unreachable')
      return { blobs: [...mem.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((k) => ({ key: k })) }
    },
  }),
}))

import {
  snapshotFromInfo, rereadFrom, checkList, runAll, summarise, type ReadParcel,
} from './watchRunner'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { WatchRow, WatchSnapshot } from './watchlist'
import type { LookupResult } from './parcelLookup'
import type { ParcelVintage } from './providers/parcelVintage'

const NOT_VERSIONED: ParcelVintage = { basis: 'not-versioned', year: null, layerUrl: null }
const snap = (o: Partial<WatchSnapshot> = {}): WatchSnapshot => ({
  districtCode: 'R-2', maxHeightFt: 35, maxFAR: 0.5, lotSqFt: 6000, developable: true, ...o,
})
const row = (o: Partial<WatchRow> = {}): WatchRow => ({
  city: 'denver', parcelId: '0123', addedAt: '2026-08-19T00:00:00.000Z', address: null,
  snapshot: snap(), parcelVintage: NOT_VERSIONED, resolution: 'unchecked', lastCheckedAt: null, ...o,
})
const seed = (userId: string, rows: WatchRow[]) => mem.set(`u/${userId}`, rows)
const always = () => true

beforeEach(() => {
  mem.clear()
  broken.list = false
})

const RINGS = [[[-104.99, 39.74], [-104.98, 39.74], [-104.98, 39.75], [-104.99, 39.75], [-104.99, 39.74]]]
const RINGS_B = [[[-71.06, 42.35], [-71.05, 42.35], [-71.05, 42.36], [-71.06, 42.36], [-71.06, 42.35]]]

const info = (o: Partial<ParcelInfo> = {}): ParcelInfo =>
  ({
    address: '1 Main St', addressBasis: 'record', parcelId: '0123', coordinates: [-104.985, 39.745],
    zoning: { districtCode: 'R-2', subdistrict: null, article: null, maxHeightFt: 35, maxFAR: 0.5, allowedUses: null },
    lot: { sizeSqFt: 6000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    existing: { landUse: null },
    sources: {}, fetchedAt: '2026-09-01T00:00:00.000Z',
    ...o,
  }) as ParcelInfo

const reader = (i: ParcelInfo): ReadParcel => async () => ({ ok: true, info: i })

describe('⚠️ the re-read goes through the real pipeline, not the parcel attributes', () => {
  it('builds the snapshot from a ParcelInfo, in the report\'s own units and fields', async () => {
    // The attribute version of this shipped a wrong number the first time it met
    // a live service: San Francisco's `Shape__Area` is in SQUARE DEGREES and a
    // regex matching "shape area" made it 2.7e-7 square feet. And no parcel layer
    // carries zoning, height, FAR or developability at all, so four of the five
    // fields could never have been compared.
    const r = await rereadFrom(
      row(),
      { kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED },
      reader(info({ zoning: { ...info().zoning, districtCode: 'R-3' } })),
    )
    expect(r.kind).toBe('resolved')
    if (r.kind !== 'resolved') return
    expect(r.snapshot).toEqual(snap({ districtCode: 'R-3' }))
  })

  it('⚠️ REFUSES to compare when the interior point lands on a different parcel', async () => {
    // The whole premise of keying on the parcel is that one piece of ground is
    // never compared against another. A boundary revision or a sliver can put an
    // interior point on a neighbour, and everything downstream would still look
    // like a valid answer — the recorded Charlotte failure exactly.
    const r = await rereadFrom(
      row(),
      { kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED },
      reader(info({ parcelId: 'someone-elses' })),
    )
    expect(r.kind).toBe('unreachable')
    if (r.kind === 'unreachable') expect(r.detail).toMatch(/refusing to compare a different parcel/)
  })

  it('treats a row with no geometry as unreadable, not as a missing parcel', async () => {
    // The parcel IS there — saying it left the layer would be the most alarming
    // thing this system can say, about nothing.
    const r = await rereadFrom(
      row(), { kind: 'found', attributes: {}, rings: null, vintage: NOT_VERSIONED }, reader(info()),
    )
    expect(r.kind).toBe('unreachable')
    if (r.kind === 'unreachable') expect(r.detail).toMatch(/no geometry/)
  })

  it('and a pipeline failure is unreachable, never a change', async () => {
    const failing: ReadParcel = async () => ({ ok: false, code: 'UPSTREAM_ERROR', message: 'boom', status: 502 })
    const r = await rereadFrom(
      row(), { kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED }, failing,
    )
    expect(r.kind).toBe('unreachable')
  })

  it('carries the developable flag through rather than inventing one', () => {
    // The by-id path does not run the developability assessment, so re-deriving
    // it here would be a second implementation that could disagree with the one
    // the report used. It is carried from the stored row instead.
    expect(snapshotFromInfo(info(), null).developable).toBeNull()
    expect(snapshotFromInfo(info(), false).developable).toBe(false)
  })
})

describe('running a list', () => {
  const found = (): LookupResult => ({
    kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED,
  })

  it('persists the check and stamps every row', async () => {
    seed('u1', [row()])
    const { rows, results } = await checkList('u1', {
      diffableFor: always,
      now: new Date('2026-09-01T00:00:00.000Z'),
      lookup: async () => found(), readParcel: reader(info()),
    })
    expect(results[0].outcome.alertable).toEqual([])
    expect(rows[0].resolution).toBe('resolves')
    expect(rows[0].lastCheckedAt).toBe('2026-09-01T00:00:00.000Z')
    expect(mem.get('u/u1')).toEqual(rows)
  })

  it('reports a real change on the one field a by-id lookup can see', async () => {
    seed('u1', [row()])
    const { results } = await checkList('u1', {
      diffableFor: always,
      lookup: async () => found(),
      readParcel: reader(info({ lot: { sizeSqFt: 6500, lotType: null } })),
    })
    expect(results[0].outcome.alertable).toEqual([
      { kind: 'field-changed', field: 'lotSqFt', from: 6000, to: 6500 },
    ])
  })

  it('⚠️ does not bank an uncompared reading as the new baseline', async () => {
    // The failure this prevents: a suppressed run adopting the new value, so the
    // change is reported by nobody — this run declined to compare it, and the
    // next finds it already the baseline.
    seed('u1', [row()])
    const { rows } = await checkList('u1', {
      diffableFor: () => false, // register says this source is not diffable
      lookup: async () => found(),
      readParcel: reader(info({ lot: { sizeSqFt: 9999, lotType: null } })),
    })
    expect(rows[0].snapshot.lotSqFt).toBe(6000)
    expect(rows[0].lastCheckedAt).not.toBeNull()
  })

  it('records a missing parcel and an unreachable service differently', async () => {
    seed('u1', [row({ parcelId: 'gone' }), row({ parcelId: 'down' })])
    const { rows, results } = await checkList('u1', {
      diffableFor: always,
      lookup: async (_city, id) =>
        id === 'gone'
          ? { kind: 'absent', vintage: NOT_VERSIONED }
          : { kind: 'unreachable', detail: 'timeout' },
    })
    expect(rows[0].resolution).toBe('not-in-layer')
    expect(results[0].outcome.alertable).toEqual([{ kind: 'left-the-layer' }])
    expect(rows[1].resolution).toBe('check-failed')
    expect(results[1].outcome.alertable).toEqual([])
  })

  it('marks an ambiguous id without diffing it', async () => {
    // LA's APN matched more than one row for 8 of 8 sampled ids. Taking the first
    // would watch whichever row came back first.
    seed('u1', [row({ city: 'la' })])
    const { rows, results } = await checkList('u1', {
      diffableFor: always,
      lookup: async () => ({ kind: 'ambiguous', matches: 14, vintage: NOT_VERSIONED }),
    })
    expect(rows[0].resolution).toBe('ambiguous')
    expect(results[0].outcome.suppressed).toMatch(/14 rows carry this parcel id/)
  })

  it('marks a city with no lookup as no-lookup, not as a failed check', async () => {
    seed('u1', [row({ city: 'boston' })])
    const { rows } = await checkList('u1', {
      diffableFor: always,
      lookup: async () => ({ kind: 'no-lookup', detail: 'not wired for boston' }),
    })
    expect(rows[0].resolution).toBe('no-lookup')
  })

  it('writes nothing on a dry run but reports the same', async () => {
    seed('u1', [row()])
    const before = mem.get('u/u1')
    const { results } = await checkList('u1', {
      diffableFor: always, dryRun: true, lookup: async () => found(),
      readParcel: reader(info({ lot: { sizeSqFt: 7000, lotType: null } })),
    })
    expect(results[0].outcome.alertable).toHaveLength(1)
    expect(mem.get('u/u1')).toBe(before)
  })
})

describe('the run report', () => {
  it('counts the COMPARED population separately from the checked one', async () => {
    seed('u1', [row(), row({ parcelId: 'x', city: 'la' })])
    const r = await runAll({
      diffableFor: (c) => c !== 'la',
      lookup: async () => ({ kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED }),
      readParcel: reader(info()),
    })
    expect(r.rows).toBe(2)
    expect(r.checked).toBe(2)
    expect(r.compared).toBe(1)
    expect(r.suppressed).toBe(1)
  })

  it('⚠️ never says "no changes" about a population of zero', async () => {
    // The sentence this whole design exists to avoid printing. A run that
    // compared nothing has said nothing, and must not read as all-clear.
    const none = await runAll({ diffableFor: always, lookup: async () => ({ kind: 'no-lookup', detail: 'x' }) })
    expect(summarise(none)).toMatch(/0 list/)
    seed('u1', [row()])
    const suppressed = await runAll({
      diffableFor: () => false,
      lookup: async () => ({ kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED }),
      readParcel: reader(info()),
    })
    expect(suppressed.compared).toBe(0)
    expect(summarise(suppressed)).toMatch(/NO ROW WAS COMPARED/)
    expect(summarise(suppressed)).not.toMatch(/no changes/)
  })

  it('says "no changes" only about the rows it actually compared', async () => {
    seed('u1', [row()])
    const r = await runAll({
      diffableFor: always,
      lookup: async () => ({ kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED }),
      readParcel: reader(info()),
    })
    expect(summarise(r)).toMatch(/no changes across the 1 compared/)
  })

  it('reports a store it could not list as an ERROR, not as an empty run', async () => {
    // "0 lists, 0 changes" is indistinguishable from every watchlist being fine,
    // so an unlistable store must lead with the failure and never with a count.
    seed('u1', [row()])
    broken.list = true
    const r = await runAll({
      diffableFor: always,
      lookup: async () => ({ kind: 'found', attributes: {}, rings: RINGS, vintage: NOT_VERSIONED }),
      readParcel: reader(info()),
    })
    expect(r.errors[0]).toMatch(/could not list watchlists.*blobs unreachable/)
    expect(r.lists).toBe(0)
    expect(r.checked).toBe(0)
    expect(summarise(r)).toMatch(/FAILED — nothing was checked/)
    expect(summarise(r)).not.toMatch(/no changes/)
  })

  it('and an EMPTY store is not the same sentence as a broken one', async () => {
    // Both check nothing; only one of them is a fault. They must not read alike.
    const empty = await runAll({ diffableFor: always, lookup: async () => ({ kind: 'no-lookup', detail: 'x' }) })
    expect(empty.errors).toEqual([])
    expect(summarise(empty)).not.toMatch(/FAILED/)
    expect(summarise(empty)).toMatch(/NO ROW WAS COMPARED/)
  })

  it('collects alerts across lists without losing which row they came from', async () => {
    seed('u1', [row({ parcelId: 'a' })])
    seed('u2', [row({ parcelId: 'b' })])
    const r = await runAll({
      diffableFor: always,
      // Distinct geometry per parcel, so the reader can tell them apart and the
      // IDENTITY GUARD is satisfied on both. An earlier version of this fixture
      // returned parcel 'a' for both rows; the guard correctly refused row 'b'
      // rather than diffing one piece of ground against another, and the test
      // failed because the FIXTURE was wrong.
      lookup: async (_c, id) => ({
        kind: 'found', attributes: {},
        rings: id === 'a' ? RINGS : RINGS_B,
        vintage: NOT_VERSIONED,
      }),
      readParcel: async (_city, _lat, lng) =>
        lng < -100
          ? { ok: true, info: info({ parcelId: 'a' }) }
          : { ok: true, info: info({ parcelId: 'b', lot: { sizeSqFt: 8000, lotType: null } }) },
    })
    expect(r.lists).toBe(2)
    expect(r.alerts.map((a) => a.parcelId)).toEqual(['b'])
  })
})
