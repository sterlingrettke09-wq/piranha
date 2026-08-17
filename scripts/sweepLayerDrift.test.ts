import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ZONE_SOURCES } from './zoneRegistry'
import { TARGETS, unhandledFor } from './enumerate-parser-domains'
import { readEnumeration } from './enumerate-zones'
import { resolveSeattle } from '../netlify/functions/lib/zoning/seattle'
import { resolveChicago } from '../netlify/functions/lib/zoning/chicago'
import { resolveNyc } from '../netlify/functions/lib/zoning/nyc'
import { resolveLasVegas } from '../netlify/functions/lib/zoning/lasvegas'
import { resolvePhoenix } from '../netlify/functions/lib/zoning/phoenix'
import { resolveMiami } from '../netlify/functions/lib/zoning/miami'

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

describe('a partial scope subtracts only what it names', () => {
  // ⚠️ THE DEFECT THIS PINS. `scopedTo` is all-or-nothing: setting it removes
  // EVERY unhandled value on a target from the total. A note added to Denver to
  // declare its nine CMP campus districts — whose heights depend on a per-parcel
  // distance the sweep cannot measure — took all 58 of Denver's unhandled codes
  // out of the count, moving the total 753 → 695 with no code change.
  //
  // A falling total is the one to distrust (rule 26), and this is why: the drop
  // was produced by the act of DECLARING something, which feels like the honest
  // move. `partiallyScoped` keeps the remainder counted, so the composition is
  // visible instead of the target disappearing.
  const denver = TARGETS.find((t) => t.city === 'denver')!
  const codes = readEnumeration('denver')!.codes

  it('denver declares a partial scope, never a target-wide one', () => {
    expect(denver.scopedTo, 'a target-wide scope here erases 46 real gaps').toBeUndefined()
    expect(denver.partiallyScoped).toBeDefined()
  })

  it('and it matches exactly the nine CMP campus districts (rule 20)', () => {
    // Pinned by MEMBERSHIP, not by count alone. A predicate that silently stopped
    // matching would return Denver to its full count and read as a regression
    // that never happened; one that widened would excuse real gaps.
    const excused = codes.filter((c) => denver.partiallyScoped!.explains(c))
    expect(excused.sort()).toEqual([
      'CMP-EI', 'CMP-EI2', 'CMP-H', 'CMP-H2', 'CMP-NWC',
      'CMP-NWC-C', 'CMP-NWC-F', 'CMP-NWC-G', 'CMP-NWC-R',
    ])
  })

  it('no target sets both — they would mean different things about the same values', () => {
    for (const t of TARGETS) {
      if (t.scopedTo) expect(t.partiallyScoped, `${t.city} sets both scopes`).toBeUndefined()
    }
  })

  it('a FAR or a plan-governed flag counts as an answer, not a gap', () => {
    // I-A and I-B resolve at FAR 2.0 and OS-A is plan-governed; testing heightFt
    // alone called all three unresolved. Denver is height-governed, which is
    // exactly why the narrower predicate looked right.
    for (const c of ['I-A', 'I-B', 'OS-A']) {
      expect(denver.handled(c), `${c} resolves a value but is counted as a gap`).toBe(true)
    }
  })
})

describe('PRODUCTION passes the arguments its resolvers need', () => {
  // ⚠️ THE AUDIT ABOVE CHECKED THE SWEEP AND STOPPED THERE. `resolveZoningLimits`
  // is a second caller of the same per-city resolvers, and it has only a district
  // code to pass. For Denver that was a live defect: the resolver refuses former
  // Chapter 59 codes only when handed `formerChapter59`, a fact derived from
  // layer fields this caller cannot see, so it re-derived heights from district
  // CLASS numbers and published them over the provider's refusal — C-MU-20 at
  // 240 ft on a live parcel. Fixed structurally: Denver's entry now resolves
  // nothing, leaving one caller of that table.
  //
  // Of the three cities that still use the fallback, only Seattle's resolver
  // takes an optional argument, so only Seattle can have the same shape.

  it('Seattle: omitting `center` never yields a HIGHER figure', () => {
    // MEASURED, not argued (rule 1). Omitting the centre was previously called
    // "the safe direction" on reasoning alone; across all 285 live codes it
    // produces 24 value differences and NOT ONE of them is higher than the
    // centre-specific answer. That is what makes the omission acceptable, and if
    // a future tier makes it false this goes red rather than quietly
    // overstating.
    const codes = readEnumeration('seattle')!.codes
    expect(codes.length).toBeGreaterThan(200)
    let differences = 0
    for (const c of codes) {
      const bare = resolveSeattle(c)
      for (const center of ['inside', 'outside'] as const) {
        const withCenter = resolveSeattle(c, center)
        for (const k of ['far', 'heightFt'] as const) {
          if (bare[k] === withCenter[k]) continue
          differences++
          const over = bare[k] != null && (withCenter[k] == null || (bare[k] as number) > (withCenter[k] as number))
          expect(over, `${c}.${k}: omitting center gives ${bare[k]}, ${center} gives ${withCenter[k]}`).toBe(false)
        }
      }
    }
    // rule 20: pinned so the loop cannot pass by comparing nothing.
    expect(differences, 'the center argument stopped mattering — verify before relaxing').toBe(24)
  })

  it('Chicago and NYC resolvers take the district code and nothing else', () => {
    // Their signatures are single-argument, so the fallback cannot omit a guard.
    // Asserted rather than assumed: adding a second parameter to either would
    // silently recreate the Denver shape at this caller.
    expect(resolveChicago.length).toBe(1)
    expect(resolveNyc.length).toBe(1)
  })

  it('and zoningLimits resolves nothing for denver', () => {
    const src = readFileSync(join(ROOT, 'netlify/functions/lib/zoningLimits.ts'), 'utf8')
    expect(src, 'zoningLimits must not import the Denver resolver').not.toMatch(/from '\.\/zoning\/denver'/)
  })
})

describe('every declared scope accounts for what it excuses', () => {
  // ⚠️ A COARSE `scopedTo` REMOVES A WHOLE TARGET FROM THE TOTAL, so a sentence
  // naming three families silently excuses everything else on that field. All
  // six coarse declarations were audited 2026-08-17 and three were doing exactly
  // that: atlanta excused 10 values outside every family it names, austin 5
  // SINGLE-FAMILY zones under a scope reading "single-family zones only", and
  // sandiego 139 of 155 under a sentence describing 16.
  //
  // The three that remain target-wide were VERIFIED to account for every
  // unhandled value on their field, not assumed to.
  const byCity = (c: string) => TARGETS.find((t) => t.city === c)!

  it.each(['seattle', 'chicago', 'nyc'])(
    '%s: a target-wide scope is legitimate only if it explains ALL of them',
    (city) => {
      const t = byCity(city)
      expect(t.scopedTo, `${city} lost its scope declaration`).toBeDefined()
      const g = unhandledFor(city).find((x) => x.field === t.field)!
      // The parser's domain really is narrower than the field here, so every
      // unhandled value is out of scope by construction. Pinned as a floor so
      // this cannot pass by the target going empty.
      expect(g.codes.length).toBeGreaterThan(50)
    },
  )

  it.each([
    // 173/0: six codes credited once the predicate read FAR (this target is named
    // for height AND FAR), and four declared as codes Part 16 never established.
    ['atlanta', 173, 0],
    ['austin', 6, 8],
    ['sandiego', 56, 84],
    ['denver', 9, 34],
    // First city closed completely: both codes read, both cited, one surfaced to
    // the user with the City's own sentence about its own data.
    ['milwaukee', 1, 0],
    // DTC/MHP point elsewhere in the code with citations; Satellite City is a
    // different jurisdiction. `I` stays a gap — the publisher was unreachable.
    ['nashville', 3, 1],
  ] as const)('%s: partial scope names %i and leaves %i counted', (city, named, gaps) => {
    const t = byCity(city)
    expect(t.scopedTo, `${city} must not carry a target-wide scope`).toBeUndefined()
    const ps = t.partiallyScoped
    expect(ps, `${city} has no partial scope`).toBeDefined()
    const codes = unhandledFor(city).find((x) => x.field === t.field)!.codes
    const excused = codes.filter((c) => ps!.explains(c))
    // BOTH numbers pinned. Only the first would let the predicate widen and
    // quietly excuse the remainder — which is the defect being guarded.
    expect(excused.length, `${city}: scope now names ${excused.length}, expected ${named}`).toBe(named)
    expect(codes.length - excused.length, `${city}: ${gaps} gaps expected`).toBe(gaps)
  })

  it('atlanta: the four are codes Part 16 does not establish, not uncurated ones', () => {
    // A different kind of declaration from the SPI families beside them. Those
    // are chapters deliberately not read; these are district codes the ordinance
    // never created — Chapter 35 has no MR-4 and no MR-3A, Chapter 19 has no
    // PD-H1 and no PD-H2. The code's own district roster is the evidence.
    const ps = byCity('atlanta').partiallyScoped!
    for (const c of ['MR-3A-C', 'MR-4-C', 'PD-H1', 'PD-H2']) {
      expect(ps.explains(c), `${c} is absent from Part 16`).toBe(true)
    }
    // The codes Chapter 35 DOES establish must not be swept up by a loose match.
    for (const c of ['MR-1', 'MR-2', 'MR-3', 'MR-4A', 'MR-5B', 'MR-MU']) {
      expect(ps.explains(c), `${c} IS established and must not be excused`).toBe(false)
    }
  })

  it('atlanta: a cited FAR counts even when the height is tiered', () => {
    // LW and the MRC family resolve FAR under §16-33.009(1)(a) / §16-34.026(1)(a)
    // / §16-34.027(1)(a) while their heights are stated as protected-district
    // tiers — Denver's CMP shape, needing a per-parcel distance. The FAR is half
    // of what this target is named for, so it answers.
    for (const c of ['LW', 'LW-C', 'MRC-1', 'MRC-1-C', 'MRC-2', 'MRC-2-C']) {
      expect(byCity('atlanta').handled(c), `${c} resolves a cited FAR`).toBe(true)
    }
  })

  it('austin: only the module\'s own documented absences are excused', () => {
    // SUPERSEDED THE SAME DAY. This asserted that five single-family zones must
    // not be excused by a scope naming single-family zones — true, and it missed
    // the cause. § 25-2 had already been read: SF-4A/4B/5/6 are encoded with
    // citations, and the sweep was calling `austinSfLimits` alone, which serves
    // SF-1/2/3 and returns null for the rest while production falls through to
    // the § 25-2-492(D) base table.
    //
    // The excused set is now the six absences AUSTIN_LIMITS documents itself.
    const ps = byCity('austin').partiallyScoped!
    for (const c of ['W/LO', 'CH', 'PUD', 'DR', 'AV', 'P']) {
      expect(ps.explains(c), `${c} is a documented absence`).toBe(true)
    }
    // AG and LA are named as columns of the § 25-2-492(D) table in the module's
    // own header and simply are not encoded — nothing documents their absence.
    for (const c of ['AG', 'LA', 'ERC', 'NBG', 'SF2', 'TND', 'TOD', 'UNZ']) {
      expect(ps.explains(c), `${c} has no documented absence and must count`).toBe(false)
    }
  })

  it('austin: the sweep exercises the COMPOSITION, not one branch', () => {
    // SF-4A publishes 35 ft on a live parcel (§ 25-2-779(D)(3)) and SF-4B two
    // storeys (§ 25-2-558(G)). A predicate that consults only the Subchapter F
    // resolver reports them unhandled, which is how 41 of 44 came to be claimed
    // for a module carrying 37 cited districts.
    for (const c of ['SF-4A', 'SF-4B', 'SF-5', 'SF-6', 'RR', 'MH', 'CBD']) {
      expect(byCity('austin').handled(c), `${c} resolves in production`).toBe(true)
    }
  })
})

describe('a plan-governed answer counts, but only with its citation', () => {
  // ⚠️ `handled` TESTS FOR A RESOLVED FIGURE, so a documented refusal produces
  // none and reads as a gap. The sweep's own header already states the
  // convention — "farUnconstrained / heightUnconstrained / planGoverned are
  // answers under rule 5, not gaps" — and it credits exactly that for Dallas and
  // Chicago via `isPlannedDevelopment`. Las Vegas and Phoenix establish it PER
  // DISTRICT in their own modules, which envelope.ts describes as the intended
  // arrangement, so the registry check missed all 52 of them.
  //
  // The credit is bound to a SOURCE STRING rather than to the boolean. A
  // `planGoverned: true` with nothing saying which instrument governs is not the
  // sweep-finished state — it is an assertion that a limit exists somewhere,
  // which is what `basis-unavailable` already says and what envelope.ts explains
  // is the weaker of the two reason codes.
  const byCity = (c: string) => TARGETS.find((t) => t.city === c)!

  // ⚠️ 37, NOT THE 36 THAT MOVED, and the difference is the point. Las Vegas has
  // 37 plan-governed codes across all 91; only 36 were being counted as gaps,
  // because `PD` is ALSO in the planned-development registry and
  // `isPlannedDevelopment` already credited it. Pinning the number that moved
  // would pin a coincidence of two mechanisms overlapping on one code.
  it.each([
    ['lasvegas', 37, (c: string) => resolveLasVegas(c)],
    ['phoenix', 16, (c: string) => resolvePhoenix(c)],
  ] as const)('%s: %i plan-governed codes, every one carrying a citation', (city, expected, resolve) => {
    const codes = readEnumeration(city)!.codes
    const pg = codes.filter((c) => (resolve(c) as { planGoverned?: boolean }).planGoverned === true)
    expect(pg.length, `${city} plan-governed count moved`).toBe(expected)
    // VERIFIED ONE CODE AT A TIME, not by family — the failure mode being
    // crediting a whole prefix because some of its members are cited.
    for (const c of pg) {
      const r = resolve(c) as { planSource?: string | null; source?: string | null }
      const src = r.planSource ?? r.source ?? ''
      expect(src.length, `${c} is plan-governed with no citation`).toBeGreaterThan(20)
    }
    // And each is actually credited by the predicate.
    for (const c of pg) expect(byCity(city).handled(c), `${c} should count as answered`).toBe(true)
  })

  it('Miami keeps its 13 — a FAR answer does not answer a height target', () => {
    // ⚠️ THE DISTINCTION THAT KEPT THIS HONEST. Ten of Miami's thirteen resolve
    // `farUnconstrained: true`, established by the slot test on Article 4 Table
    // 2's FLR row and Illustrations 5.3–5.10 each reading "Floor Lot Ratio (FLR)
    // N/A". Crediting them here would have closed the city — but the target
    // measures HEIGHT and stories, and zoning/miami.ts says outright that
    // "HEIGHT is untouched and stays a gap: Table 2 states T4/T5/D heights in
    // STORIES and the GIS layer populates Bldg_Height only for T6".
    //
    // An answer to a different question is not an answer. The same reasoning
    // withholds Las Vegas's five `farUnconstrained` codes from its height target.
    const t = byCity('miami')
    for (const c of ['T4-L', 'T5-O', 'D1', 'D2', 'D3', 'T1']) {
      expect(resolveMiami(c, null).farUnconstrained, `${c} does resolve a FAR absence`).toBe(true)
      expect(t.handled(c), `${c} must still count — its HEIGHT is unread`).toBe(false)
    }
  })
})

describe('a partial scope must DISCRIMINATE, not just excuse', () => {
  // ⚠️ `explains: () => true` IS A TARGET-WIDE SCOPE WEARING THE PARTIAL
  // MECHANISM'S NAME, and it was written here — into Philadelphia's MaxHeight
  // target, four commits after `partiallyScoped` was built to stop exactly that.
  // Every one of its seven strings was enumerated with a reason, so excusing all
  // of them was correct on the day; an eighth string arriving next month would
  // have been excused silently, which is the whole defect.
  //
  // Neither existing guard caught it. The rule-20 check fails when a scope
  // matches NOTHING; the pinned split fails when the numbers move. A predicate
  // that matches everything trips neither, because both are counts and this is a
  // property of the function.
  //
  // So the check is behavioural: feed the predicate a value that is not in the
  // enumeration and require it to say no.
  const scoped = TARGETS.filter((t) => t.partiallyScoped)

  it('there are partial scopes to check (rule 20)', () => {
    expect(scoped.length).toBeGreaterThanOrEqual(7)
  })

  it.each(scoped.map((t) => [`${t.city}/${t.field}`, t] as const))(
    '%s rejects a value it has never seen',
    (_label, t) => {
      // Deliberately absurd, and deliberately several shapes — a predicate keyed
      // on a substring might accept one of them by accident.
      for (const alien of ['ZZ-NOT-A-REAL-DISTRICT-9', '999 zorbles per fortnight', '']) {
        expect(
          t.partiallyScoped!.explains(alien),
          `${t.city} excuses "${alien}" — this scope cannot distinguish a declared code from a new one`,
        ).toBe(false)
      }
    },
  )
})
