import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ZONE_SOURCES, ENUMERABLE, zoneSource } from './zoneRegistry'
import { readEnumeration } from './enumerate-zones'
import { CITIES } from '../src/config/cities'

// WHAT THIS FILE DEFENDS
//
// The registry is the artifact that makes the enumeration sweep runnable without
// anyone remembering how — so the way it fails is by going quietly stale. A city
// is added and nobody enrols it; a layer is republished and the entry keeps
// pointing at the old one. Both look exactly like a clean sweep.
//
// The half that CANNOT live here is field existence: only the live layer knows
// whether `ZoneDes` is still `ZoneDes`. That is `--verify-fields`, and it earned
// its place immediately — SEVEN of the 22 entries were wrong on first write
// (case mismatches, and fields my extraction pulled from the wrong array).
// Proofreading would not have caught one of them.

const ROOT = resolve(__dirname, '..')
const FIXTURE_DIR = join(ROOT, 'scripts/__fixtures__/zoneEnumerations')

describe('enrolment: every city is accounted for', () => {
  it('every registered city has a registry entry', () => {
    // The guard that stops city 24 from silently skipping the sweep.
    for (const c of CITIES) {
      expect(zoneSource(c.slug), `${c.slug} is not enrolled in zoneRegistry.ts`).toBeDefined()
    }
  })

  it('the registry names no city that does not exist', () => {
    const slugs = new Set(CITIES.map((c) => c.slug))
    for (const z of ZONE_SOURCES) {
      expect(slugs.has(z.city), `${z.city} is in the registry but not in cities.ts`).toBe(true)
    }
  })

  it('an unenumerable city must SAY WHY, never just be absent', () => {
    // rule 5 applied to the registry itself: "cannot be swept" and "nobody
    // enrolled it" must not render the same. Boston is the live instance.
    const excluded = ZONE_SOURCES.filter((z) => z.notEnumerable)
    expect(excluded.length).toBeGreaterThan(0)
    for (const z of excluded) {
      expect(z.notEnumerable!.length, `${z.city} excluded with no reason`).toBeGreaterThan(40)
    }
  })

  it('every enumerable entry carries a layer and a field', () => {
    expect(ENUMERABLE.length).toBe(22)
    for (const z of ENUMERABLE) {
      expect(z.layer, `${z.city} has no layer`).toMatch(/^https:\/\//)
      expect(z.field.length, `${z.city} has no field`).toBeGreaterThan(1)
    }
  })
})

describe('the committed enumerations are measurements, and say when', () => {
  const files = existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')) : []

  it('there is a fixture for every enumerable city (rule 20)', () => {
    // A sweep over an empty fixture directory would pass every comparison below
    // by having nothing to compare.
    expect(files.length).toBe(ENUMERABLE.length)
    for (const z of ENUMERABLE) {
      expect(files, `${z.city} has no committed enumeration`).toContain(`${z.city}.json`)
    }
  })

  it.each(ENUMERABLE.map((z) => z.city))('%s carries a vintage and a non-empty code set', (city) => {
    const e = readEnumeration(city)!
    expect(e).not.toBeNull()
    // A fixture from a live layer is a measurement with a date, not a constant.
    // Municode served a seven-year-old archive this session and it read as
    // current; the stamp is what makes a stale fixture visible as stale.
    expect(e.capturedOn, `${city} has no capture date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(e.codes.length, `${city} enumerated nothing`).toBeGreaterThan(0)
    expect(e.layer).toMatch(/^https:\/\//)
  })

  it('no fixture is silently truncated', () => {
    // A capped enumeration that reads as complete is how "we checked every code"
    // becomes false without anyone noticing.
    for (const z of ENUMERABLE) {
      const e = readEnumeration(z.city)!
      expect(e.truncated, `${z.city} enumeration was truncated by the service`).toBe(false)
    }
  })

  it('each fixture matches the registry it was captured from', () => {
    // Drift: the registry is edited and the fixtures are not re-captured, so the
    // comparison runs against a column nobody reads any more.
    for (const z of ENUMERABLE) {
      const e = readEnumeration(z.city)!
      expect(e.layer, `${z.city} fixture layer differs from the registry`).toBe(z.layer)
      expect(e.field, `${z.city} fixture field differs from the registry`).toBe(z.field)
    }
  })
})

describe('the enumeration agrees with counts recorded independently', () => {
  // EXTERNAL CROSS-CHECK. These three numbers were written down elsewhere,
  // before this tool existed, by different means. An instrument that disagreed
  // with all of them would be measuring itself (rule 16).
  it('Chicago has the 1,528 classes the ledger recorded', () => {
    expect(readEnumeration('chicago')!.codes.length).toBe(1528)
  })

  it('LA has the 2,128 ZONE_CMPLT strings providers/la.ts names', () => {
    const src = readFileSync(resolve(ROOT, 'netlify/functions/lib/providers/la.ts'), 'utf8')
    expect(src).toContain('2,128')
    expect(readEnumeration('la')!.codes.length).toBe(2128)
  })

  it('Seattle has the 285 codes the MIO fixture was built from', () => {
    const sea = JSON.parse(
      readFileSync(resolve(ROOT, 'netlify/functions/lib/zoning/__fixtures__/seattleZoneCodes.json'), 'utf8'),
    )
    expect(sea.totalDistinct).toBe(285)
    expect(readEnumeration('seattle')!.codes.length).toBe(285)
  })
})
