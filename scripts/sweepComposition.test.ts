import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

// DOES THE SWEEP CALL WHAT PRODUCTION CALLS, WITH WHAT PRODUCTION PASSES?
//
// ── THREE VARIANTS OF ONE SHAPE, EACH FOUND BY INVESTIGATING A CITY ──────────
//
//   Denver     the sweep omitted `formerChapter59`, so legacy CLASS codes parsed
//              as storey counts and ~19 codes were credited that production
//              refuses.
//   Minneapolis the sweep hardcodes `primaryZone: 'UN1'`; FAR values differ by
//              primary zone (BFT20 is 7 under UN1, 7.4 otherwise).
//   Austin     the sweep called `austinSfLimits`, one branch of a two-branch
//              resolution, and read its null as "no answer" — 41 of 44 codes
//              reported unhandled for a module carrying 37 cited districts, while
//              SF-4A publishes 35 ft on a live parcel.
//
// Austin is the expensive one: the too-clean number pointed at the city and the
// cause was the instrument. Investigating cities one at a time finds these one at
// a time, and each costs a source read to discover the count was wrong.
//
// ── THE MECHANICAL FORM ──────────────────────────────────────────────────────
//
// Every parameter beyond the zone string is a PARCEL FACT — a boundary the parcel
// sits in, a lot size, a community plan, a layer field. When the sweep supplies
// one as a constant, or omits it, it is guessing something production measures.
// That is extractable from the declared signatures, so it is asserted here rather
// than rediscovered.
//
// ⚠️ THE FIRST VERSION OF THIS CHECK BUILT ITS NAMESPACE FROM THE SWEEP'S OWN
// IMPORTS and was therefore structurally unable to see a function the provider
// calls and the sweep does not — Denver, the motivating case, came back clean.
// The namespace comes from what the modules EXPORT. Third time a probe in this
// repo has measured itself; the guard is to reconcile against known-good cases
// first, which is what the DECLARED table below does.

const ROOT = resolve(__dirname, '..')
const SWEEP_PATH = join(ROOT, 'scripts/lib/parserDomains.ts')
const DIRS = ['netlify/functions/lib/zoning', 'netlify/functions/lib/providers'].map((d) => join(ROOT, d))

/**
 * Every guessed or omitted parameter, with the EXACT argument it is declared for
 * and why that is acceptable.
 *
 * ⚠️ THE DETAIL IS PART OF THE CLAIM, and the first version of this table left it
 * out. Keyed on `city:function:argN` alone, changing `resolveSeattle(v)` to
 * `resolveSeattle(v, 'inside')` kept the same key and stayed green — an OMITTED
 * parameter and a hardcoded wrong VALUE are different facts with the same
 * address. The reason declared for omitting `center` ("understates in every one of
 * 24 measured differences") says nothing about hardcoding it to one centre.
 *
 * Each entry is a claim that this specific constant does not change the HANDLED
 * verdict, or changes it only in the understating direction. Anything absent, or
 * present with a different argument, fails.
 */
const DECLARED: Record<string, { arg: string; why: string }> = {
  // Measured 2026-08-17 across all 285 live Seattle codes: omitting `center`
  // produces 24 value differences and NOT ONE is higher than the centre-specific
  // answer. Pinned separately in sweepLayerDrift.test.ts.
  'seattle:resolveSeattle:2': { arg: 'center? OMITTED', why: 'omitting center understates in every one of 24 measured differences' },

  // Changes FAR VALUES (BFT20 is 7 under UN1, 7.4 otherwise) but not the handled
  // count — all 14 built-form codes resolve at every primary zone.
  'minneapolis:resolveMinneapolisFar:2': { arg: "primaryZone = 'UN1'", why: 'primaryZone changes values, not the resolve verdict; all 14 codes resolve at every zone' },

  // Inside the Subchapter F boundary is the case that RESOLVES a FAR, so `true`
  // is the generous branch — and the composition falls through to the base table
  // either way, so no code's verdict depends on it.
  'austin:austinResolvedLimits:2': { arg: 'insideSubchapterF = true', why: 'true is the resolving branch; the base-table fallback makes the verdict independent of it' },
  'austin:austinResolvedLimits:3': { arg: 'subchapterFResolved OMITTED', why: 'omitted → defaults true, matching a successful fetch' },

  // Declared in the target's own scopedTo: the RS lot-area bands and the
  // community-plan overrides need parcel facts the sweep has none of.
  'sandiego:resolveSanDiego:2': { arg: 'lotSqFt = null', why: 'lotSqFt null is declared in the target scope — RS bands need a parcel' },
  'sandiego:resolveSanDiego:3': { arg: 'communityPlan? OMITTED', why: 'communityPlan omitted is declared in the target scope' },

  // Miami's live Bldg_Height field is per-parcel. Passing null means the sweep
  // measures the transect table alone, which is the module's own domain.
  'miami:resolveMiami:2': { arg: 'bldgHeight? = null', why: "bldgHeight is a per-parcel field; null measures the transect table, the module's domain" },

  // The flag Denver's whole legacy guard lives in. Supplied — this is the FIXED
  // case, kept in the table because the object literal is still a constant and
  // the check cannot tell a correct constant from a wrong one.
  'denver:resolveDenver:2': { arg: 'opts = { formerChapter59: isFormerChapter', why: 'supplies formerChapter59, which is the fix; derived per-code rather than hardcoded' },

  // ⚠️ THE SHAPE FALLBACK, AND IT IS NOT HARMLESS IN GENERAL. Production derives
  // this from ZONE_USE_FORM and ZONE_DESCRIPTION; the sweep has neither, so
  // isFormerChapter59 falls back to the code-shape test. That test misses 31 of
  // the 76 legacy districts (two-or-more-hyphen codes like C-MU-30), which would
  // CREDIT them — except CURRENT_NON_FORM_FAMILIES and the curated table settle
  // those independently. Recorded rather than waved through.
  'denver:isFormerChapter59:2': { arg: 'description? OMITTED', why: 'ZONE_USE_FORM unavailable to the sweep; falls back to the shape test' },
  'denver:isFormerChapter59:3': { arg: 'useForm? OMITTED', why: 'ZONE_DESCRIPTION unavailable to the sweep; falls back to the shape test' },

  // ⚠️ FOUND BY THIS CHECK, not by investigating Dallas. resolveDallas tries
  // longCode then falls back to zoneDist, and the provider passes both fields.
  // The sweep enumerates LONG_ZONE_DIST alone, so any code resolving only via the
  // second candidate is counted as a gap. MEASURED against the live 1,081
  // LONG_ZONE_DIST/ZONE_DIST pairs: exactly ONE of the 31 changes — `MU=1`, a
  // typo in the city's own field (equals sign for hyphen) whose ZONE_DIST reads
  // `MU-1`. Rescuing that typo is precisely why the second candidate exists.
  //
  // The `… Chap 51` holdovers do NOT change, and correctly: their ZONE_DIST reads
  // GR / MF-2 / O-2, and those are Chapter 51 districts under Dallas's superseded
  // code, which a Chapter 51A module is not meant to cover.
  'dallas:resolveDallas:2': { arg: 'zoneDist? OMITTED', why: 'zoneDist omitted overstates by exactly 1 of 31, measured against the live pairs — MU=1, a field typo' },
}

interface CallSite {
  city: string
  fn: string
  arg: number
  detail: string
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Arguments of the call whose opening paren is at `open`. */
function argsAt(src: string, open: number): string[] | null {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if ('([{'.includes(src[i])) depth++
    else if (')]}'.includes(src[i])) {
      depth--
      if (depth === 0) return splitTop(src.slice(open + 1, i))
    }
  }
  return null
}

const LITERAL = /^(true|false|null|undefined|'[^']*'|"[^"]*"|\d+(\.\d+)?|\{[\s\S]*\})$/

/** A parameter's NAME, with its type annotation and any default stripped — a
 *  default is part of the signature, not part of the argument the sweep passes. */
const paramName = (p: string | undefined): string | undefined =>
  p?.split(':')[0].split('=')[0].trim()

function scan(): { sites: CallSite[]; signatures: number; targets: number } {
  const signatures = new Map<string, string[]>()
  for (const dir of DIRS) {
    for (const f of readdirSync(dir).filter((n) => /^[a-zA-Z]+\.ts$/.test(n) && !/\.test\./.test(n))) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/^export (?:async )?function (\w+)\(([\s\S]*?)\)(?::|\s*\{)/gm)) {
        const params = m[2]
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .split(/,(?![^<(]*[>)])/)
          .map((p) => p.trim())
          .filter(Boolean)
        signatures.set(m[1], params)
      }
    }
  }

  const sweep = readFileSync(SWEEP_PATH, 'utf8')
  const blocks = sweep.split(/\n {2}\{\n/).slice(1)
  const sites: CallSite[] = []
  let targets = 0
  for (const block of blocks) {
    const city = /city: '([a-z]+)'/.exec(block)?.[1]
    const hi = block.indexOf('handled:')
    if (!city || hi < 0) continue
    targets++
    const handled = block.slice(hi, block.indexOf('\n  }', hi))
    for (const m of handled.matchAll(/\b(\w+)\s*\(/g)) {
      const fn = m[1]
      const params = signatures.get(fn)
      if (!params) continue
      const a = argsAt(handled, m.index! + fn.length)
      if (!a) continue
      a.forEach((arg, i) => {
        if (i > 0 && LITERAL.test(arg)) {
          sites.push({ city, fn, arg: i + 1, detail: `${paramName(params[i]) ?? '?'} = ${arg.replace(/\s+/g, ' ').slice(0, 40)}` })
        }
      })
      for (let i = a.length; i < params.length; i++) {
        sites.push({ city, fn, arg: i + 1, detail: `${paramName(params[i])} OMITTED` })
      }
    }
  }
  return { sites, signatures: signatures.size, targets }
}

describe('the sweep passes what production passes', () => {
  const { sites, signatures, targets } = scan()

  it('the extraction found signatures and targets (rule 20)', () => {
    // A regex that stopped matching `export function`, or a block split that
    // stopped finding targets, would report zero guessed parameters — which reads
    // exactly like a clean result.
    expect(signatures, 'no exported signatures extracted').toBeGreaterThan(50)
    expect(targets, 'no sweep targets found').toBeGreaterThan(18)
  })

  it('reproduces the three cases that were found by hand', () => {
    // KNOWN-GOOD RECONCILIATION FIRST (rule 16). A check that missed the defects
    // already known would be measuring itself, and the first version of this scan
    // did exactly that — it came back clean on Denver.
    const keys = sites.map((s) => `${s.city}:${s.fn}:${s.arg}`)
    expect(keys, 'Denver legacy flag').toContain('denver:resolveDenver:2')
    expect(keys, 'Minneapolis hardcoded primary zone').toContain('minneapolis:resolveMinneapolisFar:2')
    expect(keys, 'Austin hardcoded boundary fact').toContain('austin:austinResolvedLimits:2')
  })

  it('and every guessed or omitted parameter is declared, with a reason', () => {
    const bad = sites.filter((s) => {
      const d = DECLARED[`${s.city}:${s.fn}:${s.arg}`]
      // Undeclared, OR declared for a different argument than the one now passed.
      return !d || !s.detail.startsWith(d.arg)
    })
    expect(
      bad.map((s) => `${s.city}:${s.fn}:${s.arg}  now "${s.detail}"`),
      'the sweep is guessing a parcel fact production measures, or the argument changed under an existing declaration — measure which direction it errs, then declare it',
    ).toEqual([])
  })

  it('and no declaration outlives its call site', () => {
    // Once a call site starts passing the real value its entry becomes a stale
    // claim that it does not.
    const keys = new Set(sites.map((s) => `${s.city}:${s.fn}:${s.arg}`))
    for (const k of Object.keys(DECLARED)) {
      expect(keys.has(k), `${k} no longer guesses — drop its entry`).toBe(true)
    }
  })
})
