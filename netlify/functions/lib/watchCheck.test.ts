import { describe, it, expect } from 'vitest'
import { checkWatch, applyCheck, sameFabric, type Reread } from './watchCheck'
import type { WatchRow, WatchSnapshot } from './watchlist'
import type { ParcelVintage } from './providers/parcelVintage'

const V = {
  y2025: { basis: 'resolved', year: '2025', layerUrl: 'x/2025' } as ParcelVintage,
  y2026: { basis: 'resolved', year: '2026', layerUrl: 'x/24' } as ParcelVintage,
  none: { basis: 'not-versioned', year: null, layerUrl: null } as ParcelVintage,
  fallback: { basis: 'pinned-fallback', year: '2025', layerUrl: 'x/2025', why: 'HTTP 500' } as ParcelVintage,
}

const snap = (o: Partial<WatchSnapshot> = {}): WatchSnapshot => ({
  districtCode: 'R-2', maxHeightFt: 35, maxFAR: 0.5, lotSqFt: 6000, developable: true, ...o,
})

const row = (o: Partial<WatchRow> = {}): WatchRow => ({
  city: 'chicago', parcelId: '1701234567', addedAt: '2026-08-19T00:00:00.000Z',
  address: null, snapshot: snap(), parcelVintage: V.y2025,
  resolution: 'unchecked', lastCheckedAt: null, ...o,
})

const run = (reread: Reread, o: Partial<WatchRow> = {}, sourceDiffable = true) =>
  checkWatch({ row: row(o), reread, sourceDiffable })

describe('1. an outage is never an event about the parcel', () => {
  it('records check-failed and produces no alert at all', () => {
    // The single most important refusal here. If an unreachable service produced
    // an event, every upstream wobble would look like a rezoning to the user.
    const out = run({ kind: 'unreachable', detail: 'HTTP 503' })
    expect(out.resolution).toBe('check-failed')
    expect(out.events).toEqual([])
    expect(out.alertable).toEqual([])
    expect(out.suppressed).toMatch(/could not be re-read/)
  })

  it('and check-failed is distinct from not-in-layer', () => {
    // One says "we do not know", the other says "the parcel is gone". Collapsing
    // them would announce a subdivision every time a service timed out.
    expect(run({ kind: 'unreachable', detail: 'x' }).resolution).toBe('check-failed')
    expect(run({ kind: 'not-in-layer', vintage: V.y2025 }).resolution).toBe('not-in-layer')
  })
})

describe('2. the stability register gates the diff', () => {
  it('refuses to compare a source that has not been observed reproducing', () => {
    // NYC's permit feed gave 4,394 -> 1,040 -> 8,103 on one unchanged query. A
    // diff of that is noise wearing the shape of a finding.
    const out = run({ kind: 'resolved', snapshot: snap({ maxFAR: 9 }), vintage: V.y2025 }, {}, false)
    expect(out.events).toEqual([])
    expect(out.alertable).toEqual([])
    expect(out.suppressed).toMatch(/not been observed reproducing/)
  })

  it('and the refusal does not pretend the parcel is missing', () => {
    const out = run({ kind: 'not-in-layer', vintage: V.y2025 }, {}, false)
    expect(out.resolution).toBe('not-in-layer')
    expect(out.alertable).toEqual([])
  })
})

describe('3. the fabric is compared before the fields', () => {
  it('reports a republication and does NOT diff across it', () => {
    // Cook County publishes one parcel layer per tax year. Diffing a 2025
    // snapshot against a 2026 read would report boundary and area revisions as
    // if the parcel had been rezoned.
    const out = run({ kind: 'resolved', snapshot: snap({ districtCode: 'R-3', lotSqFt: 6120 }), vintage: V.y2026 })
    expect(out.events).toEqual([{ kind: 'fabric-rebased', from: '2025', to: '2026' }])
    expect(out.alertable).toEqual([{ kind: 'fabric-rebased', from: '2025', to: '2026' }])
    expect(out.suppressed).toMatch(/republished/)
    // ⚠️ The district really did change in this fixture, and it is deliberately
    // NOT reported — it cannot be told apart from a re-drawn parcel until the
    // next run compares on one fabric.
    expect(out.events.some((e) => e.kind === 'field-changed')).toBe(false)
  })

  it('treats a parcel vanishing ACROSS a rebase as the rebase, not as a loss', () => {
    const out = run({ kind: 'not-in-layer', vintage: V.y2026 })
    expect(out.alertable.map((e) => e.kind)).toEqual(['fabric-rebased'])
    expect(out.resolution).toBe('not-in-layer')
  })

  it('⚠️ an unconfirmed vintage is neither a match nor a rebase', () => {
    // `pinned-fallback` means the layer list could not be read. Calling it a
    // rebase would announce a republication on every metadata blip; calling it a
    // match would hide a real one. So the run is suppressed and says which.
    const out = run({ kind: 'resolved', snapshot: snap({ maxFAR: 3 }), vintage: V.fallback })
    expect(out.events).toEqual([])
    expect(out.suppressed).toMatch(/republication from a metadata failure/)
  })

  it('sameFabric is strict in both directions', () => {
    expect(sameFabric(V.y2025, V.y2025)).toBe(true)
    expect(sameFabric(V.none, V.none)).toBe(true)
    expect(sameFabric(V.y2025, V.y2026)).toBe(false)
    expect(sameFabric(V.y2025, V.fallback)).toBe(false)
    expect(sameFabric(V.fallback, V.fallback)).toBe(false)
    expect(sameFabric(V.none, V.y2025)).toBe(false)
  })
})

describe('4. leaving the layer', () => {
  it('is its own event on an unchanged fabric', () => {
    const out = run({ kind: 'not-in-layer', vintage: V.y2025 })
    expect(out.alertable).toEqual([{ kind: 'left-the-layer' }])
    expect(out.resolution).toBe('not-in-layer')
  })
})

describe('5. the field diff, and what of it is alertable', () => {
  it('names the field that moved', () => {
    const out = run({ kind: 'resolved', snapshot: snap({ districtCode: 'R-3' }), vintage: V.y2025 })
    expect(out.alertable).toEqual([{ kind: 'field-changed', field: 'districtCode', from: 'R-2', to: 'R-3' }])
    expect(out.suppressed).toBeNull()
  })

  it('⚠️ records a value going unavailable and refuses to alert on it', () => {
    // null means "not resolved", never zero. "We stopped being able to read the
    // FAR" is an upstream problem; announcing it as "your FAR changed" is the
    // false positive that would make people turn alerts off.
    const out = run({ kind: 'resolved', snapshot: snap({ maxFAR: null }), vintage: V.y2025 })
    expect(out.events).toEqual([{ kind: 'became-unavailable', field: 'maxFAR' }])
    expect(out.alertable).toEqual([])
  })

  it('and a value becoming available is recorded, not announced', () => {
    const out = checkWatch({
      row: row({ snapshot: snap({ maxHeightFt: null }) }),
      reread: { kind: 'resolved', snapshot: snap(), vintage: V.y2025 },
      sourceDiffable: true,
    })
    expect(out.events).toEqual([{ kind: 'became-available', field: 'maxHeightFt', to: 35 }])
    expect(out.alertable).toEqual([])
  })

  it('says nothing at all when nothing moved', () => {
    const out = run({ kind: 'resolved', snapshot: snap(), vintage: V.y2025 })
    expect(out.events).toEqual([])
    expect(out.alertable).toEqual([])
    expect(out.resolution).toBe('resolves')
  })
})

describe('what gets written back', () => {
  const now = new Date('2026-09-01T12:00:00.000Z')

  it('advances the snapshot only when a comparison actually ran', () => {
    // ⚠️ The failure this prevents: adopting an UNCOMPARED reading as the new
    // baseline. The change would then never be reported by anyone — this run
    // suppressed it, and the next run would find it already banked.
    const reread: Reread = { kind: 'resolved', snapshot: snap({ maxFAR: 9 }), vintage: V.y2025 }
    const compared = applyCheck(row(), reread, checkWatch({ row: row(), reread, sourceDiffable: true }), now)
    expect(compared.snapshot.maxFAR).toBe(9)

    const suppressed = applyCheck(
      row(), reread, checkWatch({ row: row(), reread, sourceDiffable: false }), now,
    )
    expect(suppressed.snapshot.maxFAR).toBe(0.5)
    expect(suppressed.lastCheckedAt).toBe(now.toISOString())
  })

  it('does not advance the snapshot across a rebase', () => {
    const reread: Reread = { kind: 'resolved', snapshot: snap({ lotSqFt: 6120 }), vintage: V.y2026 }
    const after = applyCheck(row(), reread, checkWatch({ row: row(), reread, sourceDiffable: true }), now)
    expect(after.snapshot.lotSqFt).toBe(6000)
    // But it DOES advance the vintage, so the next run compares on one fabric
    // instead of reporting the same rebase forever.
    expect(after.parcelVintage).toEqual(V.y2026)
  })

  it('never adopts an unconfirmed vintage as the row\'s vintage', () => {
    const reread: Reread = { kind: 'resolved', snapshot: snap(), vintage: V.fallback }
    const after = applyCheck(row(), reread, checkWatch({ row: row(), reread, sourceDiffable: true }), now)
    expect(after.parcelVintage).toEqual(V.y2025)
  })

  it('stamps lastCheckedAt on every path, including the ones that alert nothing', () => {
    for (const reread of [
      { kind: 'unreachable', detail: 'x' },
      { kind: 'not-in-layer', vintage: V.y2025 },
      { kind: 'resolved', snapshot: snap(), vintage: V.y2025 },
    ] satisfies Reread[]) {
      const after = applyCheck(row(), reread, checkWatch({ row: row(), reread, sourceDiffable: true }), now)
      expect(after.lastCheckedAt, reread.kind).toBe(now.toISOString())
    }
  })
})

describe('the order of the gates is the contract', () => {
  it('an unreachable read beats everything, including a rebase and a gap', () => {
    const out = checkWatch({
      row: row({ parcelVintage: V.y2025 }),
      reread: { kind: 'unreachable', detail: 'timeout' },
      sourceDiffable: false,
    })
    expect(out.resolution).toBe('check-failed')
    expect(out.suppressed).toMatch(/could not be re-read/)
  })

  it('and the register beats a rebase', () => {
    const out = run({ kind: 'resolved', snapshot: snap(), vintage: V.y2026 }, {}, false)
    expect(out.suppressed).toMatch(/not been observed reproducing/)
    expect(out.events).toEqual([])
  })
})
