import { describe, it, expect } from 'vitest'
import { isKnownRoute, cityName } from './edge-functions/og'
import { CITIES } from '../src/config/cities'

// The edge function cannot import the SPA's city registry (it runs in Deno
// against the built site), so its slug → name map is a transcription. A
// transcription with nothing checking it froze at the first ten cities, and
// every city added afterwards produced "Explore your city" on every crawler
// preview and shared link — silently, because the fallback is well-formed
// English. Pinned to the registry by MEMBERSHIP, not count.
describe('cityName mirrors the city registry', () => {
  it('resolves every registry slug to its registry name', () => {
    expect(CITIES.length).toBeGreaterThan(0)
    for (const c of CITIES) {
      expect(cityName(c.slug), `${c.slug} is missing from og.ts's CITY map`).toBe(c.name)
    }
  })

  it('still falls back rather than throwing on an unknown slug', () => {
    expect(cityName('atlantis')).toBe('your city')
    expect(cityName(null)).toBe(CITIES[0].name)
  })
})

// The route list must mirror src/App.tsx. Unknown paths get HTTP 404 (the SPA
// shell still renders NotFound); known routes keep 200.
describe('isKnownRoute', () => {
  it('accepts every route in the App.tsx table', () => {
    for (const p of ['/', '/map', '/start', '/result', '/boston', '/boston/start', '/boston/result', '/ask', '/about', '/math', '/compare', '/request-city', '/cities', '/admin']) {
      expect(isKnownRoute(p), p).toBe(true)
    }
  })
  it('tolerates a trailing slash', () => {
    expect(isKnownRoute('/about/')).toBe(true)
  })
  it('rejects junk and near-miss paths', () => {
    for (const p of ['/zzz', '/maps', '/boston/zzz', '/about/team', '/ADMIN', '/index.php']) {
      expect(isKnownRoute(p), p).toBe(false)
    }
  })
})
