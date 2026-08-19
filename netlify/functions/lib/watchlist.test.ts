import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usableParcelId, diffSnapshots, rowKey, type WatchSnapshot } from './watchlist'

// The Blobs-backed paths are exercised through a fake store so the schema
// decisions are testable without a network or a Netlify environment.
const mem = new Map<string, unknown>()
vi.mock('./store', () => ({
  blobStore: () => ({
    get: async (k: string) => mem.get(k) ?? null,
    setJSON: async (k: string, v: unknown) => void mem.set(k, v),
    delete: async (k: string) => void mem.delete(k),
  }),
}))

const NOT_VERSIONED = { basis: 'not-versioned', year: null, layerUrl: null } as const

const snap = (o: Partial<WatchSnapshot> = {}): WatchSnapshot => ({
  districtCode: 'R-2',
  maxHeightFt: 35,
  maxFAR: 0.5,
  lotSqFt: 6000,
  developable: true,
  ...o,
})

beforeEach(() => mem.clear())

describe('a parcel id that is not one', () => {
  it("rejects Dallas's condominium placeholder, which looks exactly like an id", () => {
    // 3,660 rows carry the literal string. Publishing it as a key would produce
    // a watch that can never fire and a value that matches nothing at DCAD.
    expect(usableParcelId('MULTIPLE')).toBeNull()
    expect(usableParcelId('multiple')).toBeNull()
    expect(usableParcelId(' MULTIPLE ')).toBeNull()
  })

  it('rejects absent and blank ids, which are 31,723 further Dallas rows', () => {
    expect(usableParcelId(null)).toBeNull()
    expect(usableParcelId(undefined)).toBeNull()
    expect(usableParcelId('')).toBeNull()
    expect(usableParcelId('   ')).toBeNull()
  })

  it('and keeps every real id shape the providers actually emit', () => {
    // Drawn from the provider tests, not invented: spaces, letters and leading
    // zeros are all load-bearing somewhere, so a "tidy the id" step would break
    // a key in a city nobody was thinking about.
    for (const id of ['0203140112', '14 001700100034', '12512C97', '010-009995', '0295    0805', '1701234567']) {
      expect(usableParcelId(id), id).toBe(id)
    }
  })
})

describe('the row key', () => {
  it('keeps city and id separate and does not collide across cities', () => {
    expect(rowKey('denver', '123')).not.toBe(rowKey('dallas', '123'))
  })
})

describe('diffing two snapshots', () => {
  it('reports nothing when nothing moved', () => {
    const d = diffSnapshots(snap(), snap())
    expect(d.changed).toEqual([])
    expect(d.becameUnavailable).toEqual([])
    expect(d.becameAvailable).toEqual([])
  })

  it('names the field that moved, not just that something did', () => {
    const d = diffSnapshots(snap(), snap({ districtCode: 'R-3', maxFAR: 1.5 }))
    expect(d.changed.map((c) => c.field).sort()).toEqual(['districtCode', 'maxFAR'])
    expect(d.changed.find((c) => c.field === 'maxFAR')).toEqual({ field: 'maxFAR', from: 0.5, to: 1.5 })
  })

  it('⚠️ does NOT call a value going null a change in that value', () => {
    // This is the whole reason the alerting layer can exist. `null` means "not
    // resolved", so a FAR we can no longer read is an upstream problem, not a
    // rezoning — and reporting it as "FAR changed from 0.5" would fire an alert
    // every time a service had a bad afternoon.
    const d = diffSnapshots(snap(), snap({ maxFAR: null }))
    expect(d.changed).toEqual([])
    expect(d.becameUnavailable).toEqual([{ field: 'maxFAR', from: 0.5, to: null }])
  })

  it('and does not call a value appearing a change either', () => {
    const d = diffSnapshots(snap({ maxHeightFt: null }), snap())
    expect(d.changed).toEqual([])
    expect(d.becameAvailable).toEqual([{ field: 'maxHeightFt', from: null, to: 35 }])
  })

  it('treats developable flipping as a real change, not availability', () => {
    const d = diffSnapshots(snap(), snap({ developable: false }))
    expect(d.changed).toEqual([{ field: 'developable', from: true, to: false }])
  })

  it('covers every snapshot field — a new field must not be silently undiffed', () => {
    // rule 20: the diff asserting over a subset of the snapshot would pass
    // forever while quietly never alerting on whatever was added last.
    const before = snap()
    const after: WatchSnapshot = {
      districtCode: 'X', maxHeightFt: 1, maxFAR: 9, lotSqFt: 1, developable: false,
    }
    const d = diffSnapshots(before, after)
    expect(d.changed.length).toBe(Object.keys(before).length)
  })
})

describe('adding to a watchlist', () => {
  const known = (c: string) => ['denver', 'dallas'].includes(c)

  it('refuses a parcel with no usable id, and says why', async () => {
    const { addWatch } = await import('./watchlist')
    const r = await addWatch('u1', {
      city: 'dallas', parcelId: 'MULTIPLE', address: '1 Main St',
      snapshot: snap(), parcelVintage: NOT_VERSIONED,
    }, known)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('no-usable-parcel-id')
      expect(r.detail).toMatch(/cannot be watched/)
    }
  })

  it('refuses an uncovered city rather than storing an unwatchable row', async () => {
    const { addWatch } = await import('./watchlist')
    const r = await addWatch('u1', {
      city: 'atlantis', parcelId: '1', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED,
    }, known)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unknown-city')
  })

  it('stores the snapshot and the layer vintage, and starts unchecked', async () => {
    const { addWatch, readWatchlist } = await import('./watchlist')
    const r = await addWatch('u1', {
      city: 'denver', parcelId: '0123', address: '1 Main St',
      snapshot: snap(), parcelVintage: { basis: 'resolved', year: '2025', layerUrl: 'https://x/2025' },
    }, known)
    expect(r.ok).toBe(true)
    if (r.ok) {
      // `unchecked` and not `resolves`: nothing has re-queried the layer yet, and
      // claiming otherwise would be a check that never ran reading as one that did.
      expect(r.row.resolution).toBe('unchecked')
      expect(r.row.lastCheckedAt).toBeNull()
      expect(r.row.parcelVintage).toEqual({ basis: 'resolved', year: '2025', layerUrl: 'https://x/2025' })
      expect(r.row.snapshot.maxFAR).toBe(0.5)
    }
    expect(await readWatchlist('u1')).toHaveLength(1)
  })

  it('is idempotent on (city, parcelId) and does not duplicate the row', async () => {
    const { addWatch, readWatchlist } = await import('./watchlist')
    const input = { city: 'denver', parcelId: '0123', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }
    await addWatch('u1', input, known)
    const again = await addWatch('u1', { ...input, address: 'a different spelling' }, known)
    expect(again.ok && again.alreadyPresent).toBe(true)
    expect(await readWatchlist('u1')).toHaveLength(1)
  })

  it('keeps the spec off the identity — same parcel, different plan, one row', async () => {
    const { addWatch, readWatchlist } = await import('./watchlist')
    const base = { city: 'denver', parcelId: '0123', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }
    await addWatch('u1', { ...base, spec: { use: 'residential', units: 4 } }, known)
    await addWatch('u1', { ...base, spec: { use: 'office', gfa: 9000 } }, known)
    expect(await readWatchlist('u1')).toHaveLength(1)
  })

  it('separates users', async () => {
    const { addWatch, readWatchlist } = await import('./watchlist')
    const base = { city: 'denver', parcelId: '0123', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }
    await addWatch('u1', base, known)
    expect(await readWatchlist('u2')).toEqual([])
  })
})

describe('removing', () => {
  const known = () => true
  it('reports whether it removed anything, so a no-op is visible', async () => {
    const { addWatch, removeWatch } = await import('./watchlist')
    await addWatch('u1', { city: 'denver', parcelId: '0123', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }, known)
    expect(await removeWatch('u1', 'denver', '0123')).toBe(true)
    expect(await removeWatch('u1', 'denver', '0123')).toBe(false)
  })

  it('does not remove the same id in another city', async () => {
    const { addWatch, removeWatch, readWatchlist } = await import('./watchlist')
    await addWatch('u1', { city: 'denver', parcelId: '9', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }, known)
    await addWatch('u1', { city: 'dallas', parcelId: '9', address: null, snapshot: snap(), parcelVintage: NOT_VERSIONED }, known)
    expect(await removeWatch('u1', 'denver', '9')).toBe(true)
    const left = await readWatchlist('u1')
    expect(left.map((r) => r.city)).toEqual(['dallas'])
  })
})
