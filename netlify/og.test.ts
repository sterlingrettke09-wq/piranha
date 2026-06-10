import { describe, it, expect } from 'vitest'
import { isKnownRoute } from './edge-functions/og'

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
