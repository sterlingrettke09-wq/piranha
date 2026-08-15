import { describe, it, expect } from 'vitest'
import {
  isPlannedDevelopment,
  plannedDevelopmentRule,
  plannedDevelopmentSource,
  PD_CITIES,
} from './plannedDevelopment'
import { CITIES } from '../../../../src/config/cities'

describe('inventory (rule 20)', () => {
  it('pins the cities with an established rule', () => {
    expect(PD_CITIES.length).toBe(8)
    expect([...PD_CITIES].sort()).toEqual(
      ['atlanta', 'austin', 'chicago', 'columbus', 'dallas', 'lasvegas', 'nashville', 'sanjose'].sort(),
    )
  })

  it('every rule names a real city in the registry', () => {
    const slugs = new Set(CITIES.map((c) => c.slug))
    for (const city of PD_CITIES) expect(slugs.has(city), `${city} is not a registered city`).toBe(true)
  })

  it('every rule carries a citation and non-empty match/never sets', () => {
    for (const city of PD_CITIES) {
      const r = plannedDevelopmentRule(city)!
      expect(r.citation.length, `${city} has no citation`).toBeGreaterThan(30)
      expect(r.governedBy.length).toBeGreaterThan(5)
      // A rule with an empty alwaysMatch would make the matching test below
      // vacuously green — the exact shape rule 20 is about.
      expect(r.alwaysMatch.length, `${city} declares nothing it must match`).toBeGreaterThan(0)
      expect(r.neverMatch.length, `${city} declares nothing it must not match`).toBeGreaterThan(0)
    }
  })
})

describe('each rule matches what it claims to', () => {
  for (const city of PD_CITIES) {
    const rule = plannedDevelopmentRule(city)!
    it(`${city}: matches all ${rule.alwaysMatch.length} declared PD codes`, () => {
      for (const code of rule.alwaysMatch) {
        expect(isPlannedDevelopment(city, code), `${city}/${code} should be a planned development`).toBe(true)
      }
    })

    // THE HALF THAT MATTERS MOST. Turning a by-right district into "governed by
    // an ordinance" SUPPRESSES a real answer, which is the expensive direction
    // (rule 18 — it still produces output, just wrong output).
    it(`${city}: matches none of its ${rule.neverMatch.length} ordinary districts`, () => {
      for (const code of rule.neverMatch) {
        expect(isPlannedDevelopment(city, code), `${city}/${code} must NOT be a planned development`).toBe(false)
      }
    })
  }
})

describe('the Las Vegas R-PD carve-out', () => {
  // LVMC 19.10.050(A) states a by-right density for R-PD{n} — "R-PD4 allows up
  // to four units per gross acre" — so it is a district with a published
  // standard, not one whose numbers exist only in an adopted plan. If it ever
  // starts matching, a figure the code publishes is being hidden.
  it.each(['R-PD2', 'R-PD4', 'R-PD9', 'R-PD46'])('%s is not treated as ordinance-governed', (code) => {
    expect(isPlannedDevelopment('lasvegas', code)).toBe(false)
  })

  it('but bare PD still is', () => {
    expect(isPlannedDevelopment('lasvegas', 'PD')).toBe(true)
  })
})

describe('cities without an established rule', () => {
  // An absence is only an answer once someone has looked (rule 23). A city with
  // no rule must report false, and those parcels keep reading as ordinary gaps
  // rather than being quietly reclassified.
  it.each(['nyc', 'boston', 'philadelphia', 'seattle', 'denver', 'sf', 'dc', 'miami'])(
    '%s returns false rather than guessing',
    (city) => {
      expect(plannedDevelopmentRule(city)).toBeNull()
      expect(isPlannedDevelopment(city, 'PD')).toBe(false)
      expect(isPlannedDevelopment(city, 'PDR-1')).toBe(false)
      expect(plannedDevelopmentSource(city, 'PD')).toBeNull()
    },
  )

  // DC's PDR (Production, Distribution and Repair) is the concrete reason the
  // matching is per-city rather than a global /PD/ — it is an ordinary
  // by-right district whose code merely begins with those two letters.
  it('never mistakes DC PDR districts for planned developments', () => {
    for (const c of ['PDR-1', 'PDR-2', 'PDR-3', 'PDR-4', 'PDR-5']) {
      expect(isPlannedDevelopment('dc', c)).toBe(false)
    }
  })
})

describe('normalisation and edge cases', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(isPlannedDevelopment('dallas', 'pd 193')).toBe(true)
    expect(isPlannedDevelopment('sanjose', ' a(pd) ')).toBe(true)
    expect(isPlannedDevelopment('nashville', 'sp-2019-1')).toBe(true)
  })

  it('returns false for absent or empty codes', () => {
    for (const bad of [null, undefined, '', '   ']) {
      expect(isPlannedDevelopment('dallas', bad)).toBe(false)
      expect(plannedDevelopmentSource('dallas', bad)).toBeNull()
    }
  })

  it('the source sentence names the ordinance and cites the code', () => {
    const s = plannedDevelopmentSource('dallas', 'PD 193')!
    expect(s).toContain('Chapter 51P')
    expect(s).toContain('51A-4.702')
    // It must say the limit EXISTS elsewhere, not that there is none.
    expect(s).toMatch(/not by a district table/)
  })
})
