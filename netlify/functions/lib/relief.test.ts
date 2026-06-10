import { describe, it, expect } from 'vitest'
import { reliefOddsFor, _parseStats } from './relief'
import reliefStats from './data/reliefStats.json'

// Cities the committed artifact actually carries. Kept in sync with whatever the
// offline pipeline landed — the loose shape assertions below stay valid across a
// quarterly refresh (rates and n drift; the contract doesn't).
const PRESENT = Object.keys(reliefStats).filter(
  (c) => (reliefStats as Record<string, { variance?: unknown }>)[c]?.variance,
)

describe('reliefOddsFor', () => {
  it('returns undefined for a city with no relief data', () => {
    expect(reliefOddsFor('atlantis')).toBeUndefined()
    expect(reliefOddsFor('')).toBeUndefined()
  })

  it('every present city has a quarterly-refresh-safe shape', () => {
    // At least the two spec cities (Boston, SF) should be present; guard so the
    // suite fails loudly if the artifact is ever emptied by accident.
    expect(PRESENT.length).toBeGreaterThanOrEqual(2)
    for (const city of PRESENT) {
      const odds = reliefOddsFor(city)
      expect(odds, `${city} should resolve`).toBeDefined()
      if (!odds) continue
      expect(odds.grantRate).toBeGreaterThan(0)
      expect(odds.grantRate).toBeLessThanOrEqual(1)
      expect(odds.n).toBeGreaterThanOrEqual(100) // the pipeline's n ≥ 100 gate
      expect(Number.isInteger(odds.n)).toBe(true)
      expect(typeof odds.window).toBe('string')
      expect(odds.window.length).toBeGreaterThan(0)
      expect(typeof odds.vintage).toBe('string')
      expect(odds.vintage.length).toBeGreaterThan(0)
    }
  })

  it('reads the JSON-shape contract from an injected fixture', () => {
    // Exercises the parse/lookup path independent of whatever the live artifact
    // currently holds (quarterly-refresh-safe; also the fallback when no city
    // has landed real data yet).
    const fixture = _parseStats({
      testville: { variance: { grantRate: 0.5, n: 200, window: '2022–2026', vintage: 'fixture' } },
    })
    const odds = reliefOddsFor('testville', fixture)
    expect(odds).toEqual({ grantRate: 0.5, n: 200, window: '2022–2026', vintage: 'fixture' })
    expect(reliefOddsFor('nowhere', fixture)).toBeUndefined()
  })

  it('_parseStats tolerates an empty / nullish artifact', () => {
    expect(reliefOddsFor('boston', _parseStats({}))).toBeUndefined()
    expect(reliefOddsFor('boston', _parseStats(null))).toBeUndefined()
    expect(reliefOddsFor('boston', _parseStats(undefined))).toBeUndefined()
  })
})
