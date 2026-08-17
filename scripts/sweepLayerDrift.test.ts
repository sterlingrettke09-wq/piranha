import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ZONE_SOURCES } from './zoneRegistry'

// EVERY LAYER THE SWEEP READS MUST BE ONE A PROVIDER ACTUALLY READS.
//
// ── THE DEFECT THIS EXISTS TO PREVENT ────────────────────────────────────────
//
// enumerate-parser-domains.ts declared San Jose's height layer as
// `PLN_Zoning_Height_Limit/MapServer/0`. That service now returns 404, so the
// sweep reported LAYER UNREACHABLE and an isolated re-probe confirmed the 404 —
// which read as the urgent finding of the round: a layer the tool depends on had
// disappeared.
//
// It had not. providers/sanjose.ts never read that service. It reads
// `${PLN}/84` — "Specific Height Restriction" — which is live. The sweep was
// pointing at a retired service of its own invention, and the failure was a
// stale declaration rather than a broken city.
//
// ── WHY --verify-fields DID NOT CATCH IT ─────────────────────────────────────
//
// The live field check asks "does this field exist on this layer". That is a
// different question from "is this the layer the provider reads", and only the
// first was being asked. A registry entry can point at a perfectly healthy layer
// that no provider has ever queried and pass every field assertion.
//
// This check closes that gap MECHANICALLY, using the same extraction that built
// the registry in the first place: resolve each provider's layer constants
// (including the ones assembled from a base constant) and assert every URL the
// sweep declares appears among them. It would have caught San Jose with no
// network probe at all.

const ROOT = resolve(__dirname, '..')
const PROVIDERS = join(ROOT, 'netlify/functions/lib/providers')

/** Every absolute layer URL a provider constructs, with `${CONST}` resolved. */
export function providerLayerUrls(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const f of readdirSync(PROVIDERS)) {
    if (!/^[a-z]+\.ts$/.test(f)) continue
    const city = f.replace('.ts', '')
    const src = readFileSync(join(PROVIDERS, f), 'utf8')
    const consts: Record<string, string> = {}
    for (const m of src.matchAll(/^const ([A-Z_0-9]+) =\s*['`]([^'`]+)['`]/gm)) consts[m[1]] = m[2]
    const urls = new Set<string>()
    for (const m of src.matchAll(/['`](https:\/\/[^'`\s]+)['`]/g)) urls.add(m[1])
    // Template forms: `${BASE}/Zoning/MapServer/0`
    for (const m of src.matchAll(/`(\$\{[A-Z_0-9]+\}[^`]*)`/g)) {
      const resolved = m[1].replace(/\$\{([A-Z_0-9]+)\}/g, (_, k) => consts[k] ?? `{${k}}`)
      if (resolved.startsWith('https://')) urls.add(resolved)
    }
    out.set(city, urls)
  }
  return out
}

/** Layer URLs the parser-domain sweep declares, by city. */
function sweepTargetUrls(): Array<{ city: string; url: string }> {
  const src = readFileSync(join(ROOT, 'scripts/enumerate-parser-domains.ts'), 'utf8')
  const consts: Record<string, string> = {}
  for (const m of src.matchAll(/^const ([A-Z_0-9]+) =\s*['`]([^'`]+)['`]/gm)) consts[m[1]] = m[2]
  const out: Array<{ city: string; url: string }> = []
  // Each target block opens with `city: '…'` and carries a `url:` before the next.
  const blocks = src.split(/\n\s*\{\s*\n/).slice(1)
  for (const b of blocks) {
    const city = /city:\s*'([a-z]+)'/.exec(b)?.[1]
    const url = /url:\s*['`]([^'`]+)['`]/.exec(b)?.[1]
    if (!city || !url) continue
    out.push({ city, url: url.replace(/\$\{([A-Z_0-9]+)\}/g, (_, k) => consts[k] ?? `{${k}}`) })
  }
  return out
}

describe('the extraction itself works (rule 20)', () => {
  const byCity = providerLayerUrls()

  it('finds providers and URLs', () => {
    // An extractor that silently returned nothing would make every assertion
    // below vacuous — the exact shape this repo keeps re-learning.
    expect(byCity.size).toBeGreaterThan(20)
    const total = [...byCity.values()].reduce((n, s) => n + s.size, 0)
    expect(total, 'no provider URLs extracted').toBeGreaterThan(50)
  })

  it('resolves a template-built URL, not just a literal one', () => {
    // seattle builds its layer as `${ORG}/Current_Land_Use_Zoning_Detail_2/…`.
    // If templates were skipped, the check would pass by not looking.
    const sea = byCity.get('seattle')!
    expect([...sea].some((u) => u.includes('Current_Land_Use_Zoning_Detail_2'))).toBe(true)
    const sj = byCity.get('sanjose')!
    expect([...sj].some((u) => u.includes('PLN_Geocortex_Public_PRD'))).toBe(true)
  })

  it('finds the sweep targets', () => {
    const t = sweepTargetUrls()
    expect(t.length).toBeGreaterThan(18)
    expect(t.some((x) => x.city === 'sanjose')).toBe(true)
  })
})

describe('zoneRegistry points only at layers a provider reads', () => {
  const byCity = providerLayerUrls()

  it.each(ZONE_SOURCES.filter((z) => !z.notEnumerable).map((z) => [z.city, z.layer] as const))(
    '%s',
    (city, layer) => {
      const urls = byCity.get(city)
      expect(urls, `no provider source for ${city}`).toBeDefined()
      expect(
        [...urls!].some((u) => u === layer),
        `${city}: registry declares a layer no provider constructs — ${layer}`,
      ).toBe(true)
    },
  )
})

describe('the parser-domain sweep points only at layers a provider reads', () => {
  const byCity = providerLayerUrls()
  // Philadelphia's ZoningCodeCharacteristics is a CHARACTERISTICS table keyed by
  // district, not the parcel layer the provider snaps to — it is read by the
  // sweep to enumerate free-text MaxFAR/MaxHeight values, which is a legitimate
  // target the provider itself has no reason to fetch. Declared, not silent.
  const NOT_A_PROVIDER_LAYER = new Set(['ZoningCodeCharacteristics'])

  it.each(sweepTargetUrls().map((t) => [t.city, t.url] as const))('%s → %s', (city, url) => {
    if ([...NOT_A_PROVIDER_LAYER].some((n) => url.includes(n))) return
    const urls = byCity.get(city)
    expect(urls, `no provider source for ${city}`).toBeDefined()
    expect(
      [...urls!].some((u) => u === url),
      `${city}: the sweep declares a layer no provider constructs — ${url}. This is how San Jose came to report a 404 for a service the provider never read.`,
    ).toBe(true)
  })
})

describe('the sweep passes the arguments production passes', () => {
  // ⚠️ THE PROTECTION CAN LIVE IN AN ARGUMENT THE CALLER SUPPLIES. Denver's
  // resolver refuses former Chapter 59 codes only when handed
  // `{ formerChapter59: true }` — its trailing numbers are CLASS codes, and
  // without the flag the stories parse read R-2 as "2 storeys", B-3 as "3",
  // OS-1 as "1". The sweep called it bare and counted them HANDLED while
  // production refuses them, overstating Denver's coverage by ~19 codes.
  //
  // AUDITED ACROSS EVERY TARGET after that (2026-08-17), comparing each
  // resolver's signature against what the sweep supplies:
  //   denver       formerChapter59 OMITTED    → credited codes falsely. FIXED.
  //   minneapolis  primaryZone 'UN1' hardcoded → changes FAR VALUES (BFT20 is
  //                7 under UN1, 7.4 otherwise) but not the handled count; all
  //                14 resolve at every primary zone.
  //   austin       insideSubchapterF true      → 41 of 44 unhandled either way.
  //   seattle      center OMITTED              → LR3 refuses, which is the SAFE
  //                direction (understates), and the target is scoped anyway.
  //   sandiego     lotSqFt null                → already declared in scopedTo.
  //   miami/dallas/columbus  optional args passed null or omitted; no credit.
  // Denver was the only one crediting values production withholds.
  const src = readFileSync(join(ROOT, 'scripts/enumerate-parser-domains.ts'), 'utf8')

  it('denver hands the resolver its legacy flag', () => {
    expect(src, 'resolveDenver called without formerChapter59 — legacy class codes will be read as storeys').toMatch(
      /resolveDenver\(\s*v,\s*\{\s*formerChapter59:/,
    )
  })

  it('and never calls it bare', () => {
    // `resolveDenver(v)` with no options is the exact call that produced the
    // fabricated storey counts.
    expect(src).not.toMatch(/resolveDenver\(v\)/)
  })
})
