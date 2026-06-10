import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  recordReport,
  listReports,
  removeReport,
  togglePin,
  clearAll,
  type RecentReport,
} from './recentReports'

// The lib reads/writes the global `localStorage`. The default vitest
// environment is `node`, which has none, so we install a small in-memory
// fake per test and can swap in a throwing one to exercise the private-mode
// tolerance path.
function installFakeStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  return store
}

const base = (url: string): Omit<RecentReport, 'pinned'> => ({
  url,
  address: `${url} St`,
  city: 'boston',
  verdict: 'AS_OF_RIGHT',
  totalCost: 1_000_000,
  ts: Date.now(),
})

describe('recentReports', () => {
  beforeEach(() => {
    installFakeStorage()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('caps the ring at 12 unpinned entries, evicting the oldest', () => {
    for (let i = 0; i < 15; i++) recordReport(base(`/r/${i}`))
    const list = listReports()
    expect(list).toHaveLength(12)
    // Newest-first: /r/14 at the front, the three oldest (/r/0../r/2) gone.
    expect(list[0].url).toBe('/r/14')
    expect(list.map((e) => e.url)).not.toContain('/r/0')
    expect(list.map((e) => e.url)).not.toContain('/r/2')
    expect(list.map((e) => e.url)).toContain('/r/3')
  })

  it('dedupes by url: refreshing moves the entry to the front', () => {
    recordReport(base('/a'))
    recordReport(base('/b'))
    recordReport(base('/c'))
    expect(listReports()[0].url).toBe('/c')

    recordReport({ ...base('/a'), ts: Date.now() + 1000 })
    const list = listReports()
    expect(list).toHaveLength(3) // no duplicate
    expect(list[0].url).toBe('/a') // moved to front
  })

  it('keeps pinned entries alive past the cap', () => {
    recordReport(base('/keep'))
    expect(togglePin('/keep')).toBe(true)
    // Flood the ring with 12 more unpinned reports; without pinning, /keep
    // would be the 13th and evicted.
    for (let i = 0; i < 12; i++) recordReport(base(`/flood/${i}`))
    const urls = listReports().map((e) => e.url)
    expect(urls).toContain('/keep')
    // 12 unpinned + 1 pinned survives.
    expect(listReports()).toHaveLength(13)
  })

  it('preserves the pinned flag when an entry is re-recorded', () => {
    recordReport(base('/p'))
    togglePin('/p')
    recordReport({ ...base('/p'), ts: Date.now() + 5 })
    expect(listReports().find((e) => e.url === '/p')?.pinned).toBe(true)
  })

  it('unpinning re-applies the cap', () => {
    recordReport(base('/x'))
    togglePin('/x')
    for (let i = 0; i < 12; i++) recordReport(base(`/u/${i}`))
    expect(listReports()).toHaveLength(13)
    // Now unpin /x — it becomes the oldest unpinned, over the cap, so it falls off.
    expect(togglePin('/x')).toBe(false)
    expect(listReports()).toHaveLength(12)
    expect(listReports().map((e) => e.url)).not.toContain('/x')
  })

  it('removes a single entry by url', () => {
    recordReport(base('/one'))
    recordReport(base('/two'))
    removeReport('/one')
    const urls = listReports().map((e) => e.url)
    expect(urls).toEqual(['/two'])
  })

  it('clears all entries', () => {
    recordReport(base('/one'))
    recordReport(base('/two'))
    clearAll()
    expect(listReports()).toEqual([])
  })

  it('togglePin on a missing url is a no-op returning false', () => {
    recordReport(base('/exists'))
    expect(togglePin('/nope')).toBe(false)
    expect(listReports()).toHaveLength(1)
  })

  it('tolerates storage that throws (private mode) without crashing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    // None of these should throw; reads degrade to empty.
    expect(() => recordReport(base('/x'))).not.toThrow()
    expect(listReports()).toEqual([])
    expect(() => removeReport('/x')).not.toThrow()
    expect(togglePin('/x')).toBe(false)
    expect(() => clearAll()).not.toThrow()
  })

  it('ignores corrupt stored JSON', () => {
    const store = installFakeStorage()
    store.set('tpp_recent_reports', '{not valid json')
    expect(listReports()).toEqual([])
    // A subsequent write recovers cleanly.
    recordReport(base('/fresh'))
    expect(listReports().map((e) => e.url)).toEqual(['/fresh'])
  })
})
