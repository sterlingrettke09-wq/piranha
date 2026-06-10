import { describe, it, expect } from 'vitest'
import { PARKING_RULES, type ParkingRule } from './parkingRules'
import { CITIES } from './cities'

describe('PARKING_RULES', () => {
  it('covers every city slug in cities.ts', () => {
    for (const c of CITIES) {
      expect(PARKING_RULES[c.slug], `missing parking rule for ${c.slug}`).toBeTruthy()
    }
    // and no orphan slugs
    const known = new Set(CITIES.map((c) => c.slug))
    for (const slug of Object.keys(PARKING_RULES)) {
      expect(known.has(slug), `parking rule for unknown slug ${slug}`).toBe(true)
    }
  })

  it('every rule is well-formed', () => {
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      const r = rule as ParkingRule
      expect(['abolished', 'partial']).toContain(r.status)
      expect(r.headline.length, `${slug} headline`).toBeGreaterThan(0)
      expect(r.detail.length, `${slug} detail`).toBeGreaterThan(0)
      expect(r.asOf.length, `${slug} asOf`).toBeGreaterThan(0)
    }
  })

  it('marks the four abolished cities as abolished', () => {
    for (const slug of ['minneapolis', 'sf', 'austin', 'denver']) {
      expect(PARKING_RULES[slug].status, slug).toBe('abolished')
    }
  })

  it('marks the partial cities as partial', () => {
    for (const slug of ['chicago', 'nyc', 'seattle', 'la', 'boston', 'dc']) {
      expect(PARKING_RULES[slug].status, slug).toBe('partial')
    }
  })

  it('does NOT claim NYC eliminated minimums citywide', () => {
    const nyc = PARKING_RULES.nyc
    expect(nyc.status).toBe('partial')
    const text = `${nyc.headline} ${nyc.detail}`
    // The old, wrong copy said minimums were "eliminated citywide". Elimination
    // is now scoped to Zone 1 (the Manhattan core); only the exemptions are
    // citywide, so the bare word "citywide" can legitimately still appear.
    expect(text).not.toMatch(/minimums (were )?eliminated citywide/i)
    expect(text).not.toMatch(/eliminated (mandatory )?parking minimums citywide/i)
    expect(text).toMatch(/Zone 1|Manhattan/i)
  })

  it('abolished headlines read as abolished', () => {
    for (const slug of ['minneapolis', 'sf', 'austin', 'denver']) {
      expect(PARKING_RULES[slug].headline).toMatch(/abolished/i)
    }
  })
})
