import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

// DENVER'S TABLE HAS ONE PRODUCTION CALLER, AND THAT IS ASSERTED HERE RATHER
// THAN OBSERVED ONCE.
//
// ── THE DEFECT THIS EXISTS TO PREVENT ────────────────────────────────────────
//
// `resolveDenver` refuses former Chapter 59 districts only when handed
// `{ formerChapter59: true }`. Their trailing numbers are district CLASS codes —
// R-2 is the second business class, C-MU-20 the twentieth — so without the flag
// the storeys parse reads them as heights and multiplies. The flag is derived
// from ZONE_USE_FORM and ZONE_DESCRIPTION, layer fields only the provider sees.
//
// There were two callers. `providers/denver.ts` passed the flag;
// `resolveZoningLimits` had nothing but a district code to pass, and its fallback
// filled in exactly what the provider had refused. Measured live 2026-08-17
// through getParcelInfo + computeEnvelope:
//
//     R-2      provider withheld → envelope published  24 ft /  2 storeys
//     B-3      provider withheld → envelope published  36 ft /  3 storeys
//     C-MU-20  provider withheld → envelope published 240 ft / 21 storeys
//
// ── WHY A TEST AND NOT A COMMENT ─────────────────────────────────────────────
//
// The same defect had already been found and fixed in the parser-domain sweep
// earlier the same day, and the audit that fixed it enumerated the SWEEP's call
// sites. Its scope was itself a claim: "I checked every caller" meant "every
// caller in the instrument". A third caller would arrive exactly the way the
// second did — someone needing a Denver figure, reaching for the resolver, with
// no way to know an argument carries the correctness.
//
// So the invariant is structural, in the shape of gfaBasisWiring.test.ts: one
// production caller, pinned by name. Adding another turns this red and the
// reader lands on the reason. Rule 14 — convert a caught error into an
// impossible state, not a comment.

const ROOT = resolve(__dirname, '../../../..')

/** The ONLY production file permitted to call the Denver resolver. */
const THE_ONE_CALLER = 'netlify/functions/lib/providers/denver.ts'

/** Where the resolver is defined — naming itself is not calling itself. */
const DEFINITION = 'netlify/functions/lib/zoning/denver.ts'

// Declared, never silently skipped (rule 5). scripts/ is an instrument rather
// than production, and its one caller is separately guarded by
// scripts/sweepLayerDrift.test.ts, which asserts the sweep passes the flag AND
// that it never calls the resolver bare. Listing it here keeps the exemption
// visible instead of leaving the scan quietly narrower than it looks.
const INSTRUMENTS_GUARDED_ELSEWHERE = new Set(['scripts/lib/parserDomains.ts'])

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
      const p = join(d, entry)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(relative(ROOT, p))
    }
  }
  walk(dir)
  return out
}

/** Non-test files that name `resolveDenver` at all. */
function filesNamingResolveDenver(): string[] {
  const scanned = [
    ...tsFilesUnder(join(ROOT, 'netlify')),
    ...tsFilesUnder(join(ROOT, 'src')),
    ...tsFilesUnder(join(ROOT, 'scripts')),
  ]
  // rule 20: a scan that walked nothing would make every assertion below
  // vacuously true — the exact shape this repo keeps re-learning.
  expect(scanned.length, 'the file walk found nothing to scan').toBeGreaterThan(60)
  expect(scanned, 'the walk missed the module under test').toContain(DEFINITION)
  return scanned.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('resolveDenver'))
}

describe('the Denver resolver has exactly one production caller', () => {
  const naming = filesNamingResolveDenver()

  it('and it is the provider', () => {
    const callers = naming.filter((f) => f !== DEFINITION && !INSTRUMENTS_GUARDED_ELSEWHERE.has(f))
    expect(
      callers,
      'a second production caller cannot know the formerChapter59 flag, and resolveZoningLimits published 240 ft for C-MU-20 by being one',
    ).toEqual([THE_ONE_CALLER])
  })

  it('the one caller passes the flag', () => {
    // Not merely "is the only caller" — being sole caller is worthless if it
    // stops guarding. Both halves, or the invariant is decorative.
    const src = readFileSync(join(ROOT, THE_ONE_CALLER), 'utf8')
    expect(src).toMatch(/resolveDenver\([^)]*\{\s*\n?\s*formerChapter59:/s)
    expect(src, 'a bare call is the exact shape that fabricated the heights').not.toMatch(
      /resolveDenver\(\s*(?:code|zone)\s*\)/,
    )
  })

  it('and the shared limits resolver is not among them', () => {
    // The specific regression, named. resolveZoningLimits still serves Chicago,
    // NYC and Seattle from their curated tables — only Denver is removed, and
    // only because its provider already supplies every figure that fallback
    // could contribute.
    expect(naming).not.toContain('netlify/functions/lib/zoningLimits.ts')
  })

  it('the declared instrument exemption still exists (rule 20)', () => {
    // If the sweep stopped calling the resolver, this exemption would silently
    // become dead weight and the set it protects would go unchecked. Pinned so
    // the exemption cannot outlive its subject.
    for (const f of INSTRUMENTS_GUARDED_ELSEWHERE) {
      expect(naming, `${f} no longer calls resolveDenver — drop the exemption`).toContain(f)
    }
  })
})
