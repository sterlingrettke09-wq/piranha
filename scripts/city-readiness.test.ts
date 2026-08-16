import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  stripCommentsAndStrings,
  regexLiterals,
  findDuplicateParses,
  citationCoverage,
  cityModules,
  citiesWithBothModules,
} from './city-readiness'

// WHAT THIS FILE DEFENDS
//
// A checking tool is code, and nothing was checking it. `enumerate-parser-domains.ts`
// is in the ledger for exactly this: a script written to enforce a rule broke the
// rule, reported Chicago as 1,528 classes unhandled, and put already-finished work
// back in the backlog. So the harness gets the same treatment it applies.
//
// The citation heuristic in particular was WRONG FOUR TIMES while being written,
// each time confidently:
//   1. Ranked zoning/dallas.ts — which pairs every value with a `*Source` field —
//      as the worst-cited module in the repo, at 7%.
//   2. Scored zoning/philadelphia.ts 0% on a denominator of three sanity bounds.
//   3. Reported zoning/nashville.ts, 73 districts and four bulk tables, as having
//      NO NUMBERS AT ALL — and printed GREEN.
//   4. Scoped itself to zoning/<city>.ts, which EXCLUDED the uncited Seattle tier
//      heights that motivated the whole check.
// Every one produced a plausible number. The tests below pin the corrections.

const ROOT = resolve(__dirname, '..')

describe('the city set is real and non-empty (rule 20)', () => {
  it('finds the paired modules', () => {
    const cities = citiesWithBothModules()
    expect(cities.length).toBe(19)
    for (const c of ['seattle', 'dallas', 'charlotte', 'nashville']) expect(cities).toContain(c)
  })

  it('a city resolves to MORE than one file where one exists', () => {
    // The scope bug. Seattle's uncited tier heights live in
    // zoning/seattleZoneString.ts, not zoning/seattle.ts, so a check scoped to
    // the latter would miss its own motivating defect.
    const files = cityModules('seattle')
    expect(files.length).toBeGreaterThan(2)
    expect(files.some((f) => f.endsWith('seattleZoneString.ts'))).toBe(true)
    expect(files.some((f) => f.includes('/providers/'))).toBe(true)
    for (const f of files) expect(f.includes('.test.'), f).toBe(false)
  })
})

describe('comment and string stripping', () => {
  it('drops a regex that only appears in a comment', () => {
    const src = "// see /^MIO-\\d{1,3}-/ for why\nconst x = 1\n"
    expect(regexLiterals(src)).toEqual([])
  })

  it('keeps a regex in executable code', () => {
    const src = "const m = s.replace(/^MIO-\\d{1,3}-/, '')\n"
    expect(regexLiterals(src).some((r) => r.includes('MIO'))).toBe(true)
  })

  it('drops regex-looking text inside a string literal', () => {
    const src = "const msg = 'use /^MIO-\\d{1,3}-/ here'\n"
    expect(regexLiterals(src)).toEqual([])
  })
})

describe('the duplicate-parse check finds pairs, it does not check a list', () => {
  it('reports nothing for the current tree except the known Charlotte pair', () => {
    const dupes = findDuplicateParses(citiesWithBothModules())
    // Pinned, not asserted-empty: an empty result would also be produced by a
    // detector that stopped working (rule 20).
    expect(dupes.length).toBe(1)
    expect(dupes[0].city).toBe('charlotte')
    expect(dupes[0].pattern).toContain('()')
  })

  it('WOULD have caught Seattle before the fix', () => {
    // The regression the harness exists for, proven rather than asserted: the
    // MIO strip lived in both files, and the only thing claiming they agreed
    // was a docstring. Simulated here rather than by editing the tree.
    const provider = "const z = s.replace(/^MIO-\\d{1,3}-/, '')\n"
    const zoning = "let z = zone.replace(/^MIO-\\d{1,3}-/, '')\n"
    const shared = regexLiterals(provider).filter((r) => regexLiterals(zoning).includes(r))
    expect(shared.length).toBe(1)
    expect(shared[0]).toContain('MIO')
  })
})

describe('citation coverage counts what a city actually publishes', () => {
  it('does not punish a module for factoring its citations into a helper', () => {
    // zoning/dallas.ts pairs every value with `heightSource: S('51A-4.112(a)', 'E')`.
    // The literal § appears once, in the helper. Scoring that module low was the
    // instrument's error, not the module's (rule 16).
    const s = citationCoverage('dallas')!
    expect(s.numbers).toBeGreaterThan(100)
    expect(s.cited / s.numbers).toBeGreaterThan(0.95)
  })

  it('counts a returned tier default, not just an assignment', () => {
    // `if (/\\bLR1\\b/.test(base)) return 32` is a published figure, and an
    // earlier filter skipped every line containing a comparison — which excluded
    // exactly the numbers the check was built to surface.
    //
    // SUPERSEDED BY THE FIX IT CAUSED. This asserted those lines appear in the
    // UNCITED samples; they no longer do, because SMC 23.45.514 was read and the
    // figures now carry SMC_HEIGHT_SRC. So the assertion is inverted: the tier
    // returns must still be COUNTED as figures, and must now be counted as CITED.
    // A check that stopped seeing them entirely would pass either way, which is
    // why the count is pinned rather than just the samples.
    const s = citationCoverage('seattle')!
    expect(s.numbers).toBeGreaterThan(30)
    const flagged = s.uncitedSamples.map((u) => u.text).join('\n')
    expect(flagged, 'the tier heights are sourced now and must not read as uncited').not.toMatch(
      /seattleZoneString\.ts:\d+\s+if \(\/\\bLR[123]\\b\/\.test\(base\)\) return \d+/,
    )
  })

  it('does not count sanity bounds as figures', () => {
    // `ft > 1000` and `far > 100` are guards. A module whose only numbers are
    // guards is not badly sourced; it is being measured wrong.
    const src = 'if (!Number.isFinite(ft) || ft <= 0 || ft > 1000) return null\n'
    const stripped = stripCommentsAndStrings(src)
    expect(stripped).toContain('1000')
    // Proven through the real scan rather than the regex: philadelphia's figure
    // count must not be dominated by its guards.
    const s = citationCoverage('philadelphia')!
    expect(s.numbers).toBeLessThan(20)
  })

  it('reports per-FILE line numbers, not offsets into a concatenation', () => {
    const s = citationCoverage('seattle')!
    for (const u of s.uncitedSamples) {
      expect(u.text, 'sample must name its file').toMatch(/^(zoning|providers)\/[\w.]+\.ts:\d+/)
    }
  })

  it('every city reports a non-zero file count', () => {
    // A city whose module list silently empties would return a clean 0/0 and
    // read as perfect. Pin that it scanned something.
    for (const c of citiesWithBothModules()) {
      const s = citationCoverage(c)!
      expect(s.files, `${c} scanned no files`).toBeGreaterThan(0)
    }
  })
})

describe('the baseline is committed and covers every city', () => {
  const p = resolve(ROOT, 'scripts/__fixtures__/citationBaseline.json')

  it('exists — without it the citation half cannot fail, so it is not a check', () => {
    expect(existsSync(p)).toBe(true)
  })

  it('has an entry for every paired city', () => {
    const b = JSON.parse(readFileSync(p, 'utf8'))
    const cities = citiesWithBothModules()
    expect(Object.keys(b.modules).length).toBe(cities.length)
    for (const c of cities) expect(b.modules[c], `${c} missing from baseline`).toBeDefined()
  })

  it('no city has MORE uncited figures than its baseline', () => {
    // ⚠️ THE UNCITED COUNT IS THE RATCHET, not the cited count. Comparing
    // `cited` was the first version and it did not work: adding a new uncited
    // number leaves `cited` unchanged and raises `numbers`. Proven by planting
    // one — Seattle went 35/47 to 35/48 and the harness printed GREEN.
    const b = JSON.parse(readFileSync(p, 'utf8'))
    for (const c of citiesWithBothModules()) {
      const now = citationCoverage(c)!
      const prior = b.modules[c]
      expect(now.numbers - now.cited, `${c} gained an uncited figure`).toBeLessThanOrEqual(
        prior.numbers - prior.cited,
      )
    }
  })
})

describe('the harness states what GREEN does not mean', () => {
  it('says so in its own source, where the next reader will be', () => {
    // The coverage percentage and this check answer different questions, and
    // conflating them is how "94% resolved" came to read as "94% right".
    const src = readFileSync(resolve(ROOT, 'scripts/city-readiness.ts'), 'utf8')
    expect(src).toMatch(/GREEN DOES NOT MEAN the city resolves/)
    expect(src).toMatch(/does not mean the numbers are\s*\/\/ correct/)
  })
})
