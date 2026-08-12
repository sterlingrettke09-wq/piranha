import { describe, it, expect } from 'vitest'
import {
  CITY_CLAIMS,
  buildCityClaims,
  citiesSentence,
  coverageFacts,
  rangeSentence,
  silentSentence,
  verdictFor,
  type CityClaim,
} from './coverageClaim'
import { envelopeSample, type EnvelopeSample, type EnvelopeSampleCounts } from './envelopeSample'
import { CITIES } from './cities'

// WHAT THIS FILE DEFENDS
//
// No public surface may say a city is live, covered or answering unless the
// committed measurement says it answers. Five surfaces said exactly that about
// all 23 cities while the 575-parcel sample recorded Nashville at 0 of 24, San
// Diego at 0 of 11 and San Jose at 0 of 15.
//
// Two failures are in scope and both are silent:
//   · the copy stops tracking the measurement — someone hard-codes a count, a
//     rate or a list back into a page, and it reads correctly on the day it is
//     written;
//   · a NEW surface is added that makes the old claim, and nothing notices
//     because nothing enumerates the surfaces.
//
// RULE 20 — this check must not be able to pass by finding nothing. Three
// things make the set non-empty and pinned: the forbidden-phrasing scan runs
// over a GLOB of every route and edge function rather than a list (so a page
// added tomorrow is scanned without anyone remembering to enrol it), SOURCES is
// asserted to contain each pinned surface and to be larger than the inventory,
// and the claim tests run over CITIES, whose membership is pinned against the
// registry. A file renamed away, or an artifact that empties, goes RED.
//
// RULE 11 — the copy is exercised through the real entry points the routes
// import (`coverageFacts`, `rangeSentence`, `silentSentence`, `citiesSentence`,
// `CITY_CLAIMS`), not through a re-implementation of them here.

/**
 * Every route, every edge function, and the HTML shell — read as text. A glob
 * rather than a list, because the failure that motivated this file is a surface
 * nobody thought to enrol.
 */
const SOURCES = import.meta.glob(
  ['/src/routes/*.tsx', '/netlify/edge-functions/*.ts', '/index.html'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const read = (rel: string): string => {
  const src = SOURCES[`/${rel}`]
  if (src === undefined) throw new Error(`${rel} is in the surface inventory but was not globbed`)
  return src
}

/**
 * THE PINNED INVENTORY of surfaces that make a public coverage claim. The glob
 * above is what catches a new one; this list is what proves the glob is
 * pointed at the right place — if it stops matching, these lookups throw.
 */
const SURFACES = [
  'src/routes/Cities.tsx',
  'src/routes/Home.tsx',
  'src/routes/About.tsx',
  'src/routes/Ask.tsx',
  'src/routes/RequestCity.tsx',
  'src/routes/RedTape.tsx',
  'src/routes/Methodology.tsx',
  'netlify/edge-functions/og.ts',
  'index.html',
] as const

/** The five that interpolate a count or a city list, and therefore must read it
 *  from the derived module rather than hold their own. */
const DERIVED_COPY_SURFACES = [
  'src/routes/Cities.tsx',
  'src/routes/Home.tsx',
  'src/routes/About.tsx',
  'src/routes/Ask.tsx',
  'src/routes/RequestCity.tsx',
] as const

describe('the surface inventory is pinned and non-empty', () => {
  it('names every surface, and each one is present with real content', () => {
    // A list that has quietly gone empty, or whose paths have rotted, would make
    // every assertion below vacuously true.
    expect(SURFACES.length).toBe(9)
    for (const f of SURFACES) {
      // read() throws if the glob no longer reaches this file.
      expect(read(f).length, `${f} is empty`).toBeGreaterThan(500)
    }
  })

  it('the glob reaches more than the inventory, so a new page is scanned too', () => {
    // If the glob only ever matched the nine files someone remembered to list,
    // it would be the list again wearing a wildcard.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(SURFACES.length)
    expect(Object.keys(SOURCES)).toContain('/index.html')
  })
})

describe('no surface claims a city is live or answering', () => {
  // `live` is a registry field about our plumbing. These patterns are the ways
  // it leaked into copy as a claim about what a visitor gets. Deliberately
  // narrow: "read live from its own city's public records" on /math is about
  // data freshness and is true, so the patterns anchor on the coverage sense.
  const FORBIDDEN: [RegExp, string][] = [
    // Matched on the CLAIM form, not on proximity. "read live from its own
    // city's public records" (freshness) and "a city that is pleasant to live
    // in" are both true and both sit next to the word city; a guard that
    // flagged them would get loosened, and a loosened guard is the one that
    // misses the real thing.
    [/\blive (in|across) \{?[\w.()]*\}?\s*cities\b/i, 'claims we are live in or across N cities'],
    [/\blive today\b/i, 'a "live today across N cities" claim'],
    [/\blive (city|cities)\b/i, 'describes cities themselves as live'],
    [/\bcities,\s*live\b/i, 'a "N cities, live" headline'],
    [/\b(we are|we[’']re) live\b/i, 'asserts the product is live'],
    [/(this|these) cit(y|ies) (is|are) live\b/i, 'asserts specific cities are live'],
    [/>\s*Live\s*</, 'a bare "Live" badge'],
    [/\ball (ten|eleven|twelve|twenty)\b/i, 'a hand-written city count in words'],
    [/\b(ten|eleven|twelve|twenty-three) (US )?cities\b/i, 'a hand-written city count in words'],
  ]

  // Over the GLOB, not the inventory: a route added tomorrow that says a city
  // is live fails here without anyone remembering to enrol it.
  for (const path of Object.keys(SOURCES).sort()) {
    it(`${path} carries no live/answering claim`, () => {
      const src = SOURCES[path]
      for (const [re, why] of FORBIDDEN) {
        expect(re.test(src), `${path} ${why}: ${re}`).toBe(false)
      }
    })
  }

  it('no coverage-claim surface hard-codes a city list', () => {
    // The second defect: a derived count interpolated beside names typed by
    // hand. A copy file naming several cities literally is that list coming
    // back. Scoped to the surfaces that STATE the roster. Two exclusions, both
    // deliberate and both covered elsewhere:
    //   · /math is a methodology document whose prose works through named
    //     cities (Denver's district rewrite, Philadelphia's tables), and whose
    //     own city list is already rendered from the coverage matrix.
    //   · og.ts MUST transcribe the names — it runs in Deno against the built
    //     site and cannot import this config — so the equivalent guard lives in
    //     netlify/og.test.ts, which pins its map to the registry by membership.
    const names = CITIES.map((c) => c.name)
    for (const f of [...DERIVED_COPY_SURFACES, 'src/routes/RedTape.tsx', 'index.html']) {
      const src = read(f)
      const named = names.filter((n) => src.includes(n))
      expect(
        named.length,
        `${f} names ${named.length} cities literally (${named.join(', ')}) — derive the list`,
      ).toBeLessThanOrEqual(2)
    }
  })

  it('every surface that states a count or a list derives it', () => {
    // The positive half. Forbidding phrasings alone would pass on a page that
    // simply deleted the claim; these five must actually read the measurement.
    expect(DERIVED_COPY_SURFACES.length).toBe(5)
    for (const f of DERIVED_COPY_SURFACES) {
      expect(read(f), `${f} no longer imports the derived coverage claim`).toMatch(
        /from '\.\.\/config\/coverageClaim'/,
      )
    }
  })
})

describe('the claim set is pinned to the registry', () => {
  it('covers every city, and there is at least one', () => {
    expect(CITY_CLAIMS.map((c) => c.slug)).toEqual(CITIES.map((c) => c.slug))
    expect(CITY_CLAIMS.length).toBeGreaterThan(0)
  })

  it('never calls a city answering unless its sample resolved something', () => {
    for (const c of CITY_CLAIMS) {
      const s = envelopeSample(c.slug)
      if (c.verdict === 'answering') {
        expect(s.kind, `${c.slug} is called answering with no measurement`).toBe('measured')
        if (s.kind === 'measured') expect(s.resolved).toBeGreaterThan(0)
      }
      // The converse, which is the actual defect: a wired city with nothing
      // measured must not be describable as answering.
      if (s.kind !== 'measured' || s.resolved === 0) {
        expect(c.verdict, `${c.slug} resolves nothing but is not marked silent`).not.toBe('answering')
      }
    }
  })

  it('records exactly the cities the 2026-08-11 run found silent', () => {
    // Pinned membership, not a count — a set that matches in size and not in
    // members is the regex that silently stopped matching. If one of these
    // starts resolving, this goes RED and the entry is deleted deliberately,
    // which is the point: the alternative is a fix nobody notices.
    expect(coverageFacts().silent.map((c) => c.slug).sort()).toEqual([
      'nashville',
      'sandiego',
      'sanjose',
    ])
  })

  it('the rate still discriminates between cities', () => {
    // If every city read the same, the copy would have regressed to the boolean
    // it replaced while looking like success (rule 18).
    const labels = new Set(CITY_CLAIMS.map((c) => c.rateLabel))
    expect(labels.size).toBeGreaterThan(1)
  })
})

describe('the copy moves when the measurement moves', () => {
  // PERTURBATION. Copy generated from a measurement and copy typed by hand are
  // indistinguishable until something changes the measurement, so change it.
  const counts = (over: Partial<EnvelopeSampleCounts> = {}): EnvelopeSampleCounts => ({
    attempted: 25, outOfCity: 0, noParcel: 0, upstreamError: 0, exception: 0, noSpec: 0,
    nonDevelopable: 14, developable: 11, resolved: 0, unconstrained: 0, gap: 11, indeterminate: 11,
    sampledOn: '2026-08-11', ...over,
  })
  const ZEROED: EnvelopeSample = {
    kind: 'measured', n: 11, resolved: 0, gap: 11, indeterminate: 11, share: 0, counts: counts(),
  }
  const drop = (slug: string) => (s: string): EnvelopeSample =>
    s === slug ? ZEROED : envelopeSample(s)

  const perturbed: CityClaim[] = buildCityClaims(drop('chicago'))

  it('a city dropped to 0% stops being called answering', () => {
    const before = CITY_CLAIMS.find((c) => c.slug === 'chicago')!
    const after = perturbed.find((c) => c.slug === 'chicago')!
    expect(before.verdict).toBe('answering')
    expect(after.verdict).toBe('silent')
    expect(before.rateLabel).toBe('100% · n=11')
    expect(after.rateLabel).toBe('0% · n=11')
  })

  it('the sentences every page renders change with it', () => {
    const now = silentSentence()
    const then = silentSentence(perturbed)
    expect(then).not.toBe(now)
    expect(then).toContain('Chicago')
    expect(now).not.toContain('Chicago')
    expect(coverageFacts(perturbed).silent).toHaveLength(coverageFacts().silent.length + 1)
    // The range sentence carries the top of the range, so losing the only other
    // 100% cities would move it too — check the mechanism, not just the copy.
    const noFull = buildCityClaims((s) =>
      ['chicago', 'nyc', 'raleigh'].includes(s) ? ZEROED : envelopeSample(s),
    )
    expect(rangeSentence(noFull)).not.toBe(rangeSentence())
    expect(rangeSentence(noFull)).not.toContain('100%')
  })

  it('the silent clause disappears entirely when nothing is silent', () => {
    // Rule 5 inside the copy: the sentence must be absent because there is
    // nothing to report, never because the generator quietly stopped emitting.
    const allFull = buildCityClaims(() => ({
      kind: 'measured', n: 10, resolved: 10, gap: 0, indeterminate: 0, share: 1,
      counts: counts({ developable: 10, resolved: 10, gap: 0, indeterminate: 0, nonDevelopable: 15 }),
    }))
    expect(silentSentence(allFull)).toBe('')
    expect(coverageFacts(allFull).silent).toHaveLength(0)
    expect(rangeSentence(allFull)).toContain('100% in every city')
  })

  it('an unmeasured city is never folded into answering', () => {
    const unknown = buildCityClaims(() => ({ kind: 'unmeasured' }))
    expect(coverageFacts(unknown).answering).toBe(0)
    expect(unknown.every((c) => c.verdict === 'unknown')).toBe(true)
    expect(rangeSentence(unknown)).toContain('no measured rate')
  })
})

describe('the derived list cannot disagree with the derived count', () => {
  it('names exactly as many cities as the count claims', () => {
    const sentence = citiesSentence()
    for (const c of CITIES) expect(sentence, `${c.name} missing from the list`).toContain(c.name)
  })

  it('the list tracks the array rather than a frozen copy of it', () => {
    // The original defect was a list that kept saying ten while the count said
    // twenty-three. Counting commas cannot check that — one city is literally
    // named "Washington, DC" — so shorten the input and confirm the dropped
    // cities leave the sentence.
    const short = CITY_CLAIMS.slice(0, 3)
    const sentence = citiesSentence(short)
    for (const c of short) expect(sentence).toContain(c.name)
    for (const c of CITY_CLAIMS.slice(3)) {
      expect(sentence, `${c.name} survives in a list it was dropped from`).not.toContain(c.name)
    }
    expect(citiesSentence([])).toBe('')
  })

  it('verdictFor is the only place the zero cutoff is drawn', () => {
    expect(verdictFor({ kind: 'unmeasured' })).toBe('unknown')
    expect(verdictFor({ kind: 'no-denominator', counts: counts0() })).toBe('unknown')
    expect(verdictFor({ kind: 'measured', n: 5, resolved: 0, gap: 5, indeterminate: 5, share: 0, counts: counts0() })).toBe('silent')
    expect(verdictFor({ kind: 'measured', n: 5, resolved: 1, gap: 4, indeterminate: 4, share: 0.2, counts: counts0() })).toBe('answering')
  })
})

function counts0(): EnvelopeSampleCounts {
  return {
    attempted: 5, outOfCity: 0, noParcel: 0, upstreamError: 0, exception: 0, noSpec: 0,
    nonDevelopable: 0, developable: 5, resolved: 0, unconstrained: 0, gap: 5, indeterminate: 5,
    sampledOn: '2026-08-11',
  }
}
