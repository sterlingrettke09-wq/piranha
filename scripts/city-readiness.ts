// City readiness — the checks that watch for WRONG and UNSOURCED values.
//
// ── WHAT THIS IS FOR, AND WHAT GREEN MEANS ───────────────────────────────────
//
// The coverage percentage on every city card answers ONE question: did the
// pipeline resolve an envelope? It says nothing whatever about whether the
// numbers in that envelope are right. Seattle is the proof: the provider
// published a Major Institution Overlay height as the by-right height — 160 ft
// where the base zone allows 40 — on 5.3% of the city's zoning polygons, and
// Seattle's coverage rate was 94% before the fix and 94% after. The metric could
// not see a 4x error, and no MIO parcel appeared in the 100-parcel sample either.
//
// So the checks a city needs split three ways, and only ONE of them was already
// covered:
//
//   WRONG values     — enumeration divergence, duplicated parses   ← nothing watched
//   MISSING values   — real-entry-point probe, partition, nulls    ← already covered
//   UNSOURCED values — citation presence                           ← nothing watched
//
// This file is the first and third. It deliberately does not re-measure
// resolution: `scripts/smoke-parcels.ts` does that, and conflating them is how a
// coverage number came to be read as a correctness claim.
//
// GREEN HERE MEANS: no two modules parse the same thing differently, and the
// module's published numbers carry citations at or above its recorded baseline.
// GREEN DOES NOT MEAN the city resolves, and it does not mean the numbers are
// correct — only that the two mechanical ways they are known to go wrong are not
// present. Say it that way in the output, every run, so nobody has to remember.
//
// ── WHY THESE TWO CHECKS ─────────────────────────────────────────────────────
//
// Both were derived from defects that actually shipped here, not from a list of
// good practices:
//
//   · DUPLICATED PARSE. providers/seattle.ts and zoning/seattle.ts each read a
//     zone string, disagreed on 39 of 285 live codes, and the only thing
//     asserting they agreed was a sentence in a docstring. The same shape had
//     already produced the gfaBasis triplication, where the live HTTP handler
//     silently disabled a guard written hours earlier.
//
//     ⚠️ THIS FINDS PAIRS, IT DOES NOT CHECK A LIST. Seattle was found by
//     grepping for comments CLAIMING a mirroring — which only works when someone
//     wrote the comment. A pair with no comment is invisible to that search, so
//     the mechanical version compares the modules themselves.
//
//   · UNCITED NUMBER. Seattle's LR/MR/HR tier heights (30/40/50/85/240) are
//     constants in a module with no citation anywhere near them; the provider
//     says the tiers "get the SMC base-height by tier" and cites nothing. A
//     check that only looked at docs/CITATIONS.md would miss exactly the class
//     it exists to catch, so "published number" here means a numeric literal in
//     a zoning module, not an entry in a ledger.
//
// ── THE BASELINE IS A RATCHET, NOT A TARGET ──────────────────────────────────
//
// Citation coverage is not 100% today and demanding it would make this check
// noise on its first run. Instead each module's current coverage is committed to
// `__fixtures__/citationBaseline.json` and the check FAILS when a module drops
// below its own recorded figure. New uncited numbers are caught; the existing
// backlog is visible and does not block. Raising a baseline is a deliberate edit.

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '..')
const PROVIDERS = join(ROOT, 'netlify/functions/lib/providers')
const ZONING = join(ROOT, 'netlify/functions/lib/zoning')
const BASELINE = join(ROOT, 'scripts/__fixtures__/citationBaseline.json')

/** Strip comments and string literals before scanning for code patterns. A regex
 *  quoted in a comment is documentation, not a second implementation, and
 *  counting it would make the duplicate check cry wolf on its own warnings. */
export function stripCommentsAndStrings(src: string): string {
  let out = ''
  let i = 0
  type Mode = 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl'
  let mode: Mode = 'code'
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue }
      if (two === '/*') { mode = 'block'; i += 2; continue }
      if (src[i] === "'") { mode = 'sq'; out += ' '; i++; continue }
      if (src[i] === '"') { mode = 'dq'; out += ' '; i++; continue }
      if (src[i] === '`') { mode = 'tpl'; out += ' '; i++; continue }
      out += src[i]; i++; continue
    }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n' } ; i++; continue }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2 } else { if (src[i] === '\n') out += '\n'; i++ } ; continue }
    // inside a string
    if (src[i] === '\\') { i += 2; continue }
    if ((mode === 'sq' && src[i] === "'") || (mode === 'dq' && src[i] === '"') || (mode === 'tpl' && src[i] === '`')) {
      mode = 'code'; i++; continue
    }
    if (src[i] === '\n') out += '\n'
    i++
  }
  return out
}

/** Regex literals appearing in executable code. */
export function regexLiterals(src: string): string[] {
  const code = stripCommentsAndStrings(src)
  // A regex literal preceded by a token that cannot end an expression — so
  // division is not mistaken for one.
  const out = new Set<string>()
  const re = /(^|[=(,:[!&|?{;+\s])\/((?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])+)\/([gimsuy]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const body = m[2]
    // Ignore trivially generic ones that carry no parsing intent.
    if (body.length < 4) continue
    out.add(`/${body}/${m[3]}`)
  }
  return [...out]
}

export interface DuplicatePair {
  city: string
  pattern: string
  files: [string, string]
}

/** Regexes present in BOTH a city's provider and its zoning module. Two modules
 *  parsing the same string the same way is a pair that can drift; two modules
 *  parsing it DIFFERENTLY is what already shipped. Either way there should be
 *  one implementation, so the shared literal is the signal. */
export function findDuplicateParses(cities: string[]): DuplicatePair[] {
  const found: DuplicatePair[] = []
  for (const city of cities) {
    const p = join(PROVIDERS, `${city}.ts`)
    const z = join(ZONING, `${city}.ts`)
    if (!existsSync(p) || !existsSync(z)) continue
    const pr = new Set(regexLiterals(readFileSync(p, 'utf8')))
    const zr = regexLiterals(readFileSync(z, 'utf8'))
    for (const r of zr) {
      if (pr.has(r)) {
        found.push({ city, pattern: r, files: [`providers/${city}.ts`, `zoning/${city}.ts`] })
      }
    }
  }
  return found
}

/** A citation marker: the vocabulary this repo's modules actually use when they
 *  source a figure. Deliberately broad — the check is "did anyone name a
 *  source", not "is the source formatted correctly". */
// ⚠️ A CITATION HELPER IS STILL A CITATION. The first version of this regex
// looked only for the literal vocabulary below, and ranked zoning/dallas.ts —
// which pairs EVERY value with a `heightSource: S('51A-4.112(a)', 'E')` field —
// as the worst-cited module in the repo at 7%. The `§` appears once, in the
// helper's definition, and never beside a number. The check was punishing the
// most rigorous module in the codebase for factoring its citations well.
//
// Caught by disbelieving the result: Dallas was built with a source per value,
// so a measurement calling it worst-in-repo was the instrument's problem
// (CLAUDE.md rule 16). Structural evidence of sourcing — a `*Source` /
// `source:` / `citation:` key on the same row — counts, because that is what a
// well-factored citation looks like.
const SOURCE_KEY = /\b\w*(Source|source|citation|Citation|cite)\b\s*:|\b(T_?[A-Z0-9_]{2,}|SRC|[A-Z][A-Z0-9_]{2,}_SRC)\b/
const CITATION = /§|\bZR\s*\d|\bSMC\b|\bLAMC\b|\bLVMC\b|\bOrd(inance)?\.?\s*(No\.?)?\s*\d|\bTable\b|\bSec(tion)?\.\s*\d|\bCh(apter)?\.?\s*\d|Municipal Code|Land Development Code|Zoning (Ordinance|Code|Resolution)|\bArt(icle)?\.?\s*\d|\bDivision\s*\d|\bSubtitle\b|\bTitle\s*\d|\b[A-Z]{2,4}\s+\d+[-.–]\d+/i

export interface CitationStat {
  module: string
  numbers: number
  cited: number
  /** How many files were scanned. Pinned by a test: a city whose module list
   *  silently empties would report a clean 0/0 (rule 20). */
  files: number
  uncitedSamples: Array<{ line: number; text: string }>
}

/** How many numeric literals in a zoning module sit within reach of a citation.
 *
 *  "Published number" means a numeric literal in the module — NOT an entry in a
 *  ledger. Seattle's uncited tier heights are constants in code, and a check
 *  scoped to docs/CITATIONS.md would have missed them entirely. */
export function cityModules(city: string): string[] {
  // ⚠️ EVERY MODULE THE CITY OWNS, not just zoning/<city>.ts. The first version
  // scanned that one file and would therefore have MISSED the case this whole
  // check was built from: Seattle's uncited LR/MR/HR tier heights now live in
  // zoning/seattleZoneString.ts, extracted there by the very fix that motivated
  // the harness. A check whose scope excludes its own motivating defect is not
  // a weak check, it is a decorative one (CLAUDE.md rule 23 — absence within a
  // scope is not absence; establish the scope first).
  const out: string[] = []
  for (const dir of [ZONING, PROVIDERS]) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.includes('.test.')) continue
      const base = f.replace(/\.ts$/, '').toLowerCase()
      if (base === city || base.startsWith(city)) out.push(join(dir, f))
    }
  }
  return out.sort()
}

export function citationCoverage(city: string, window = 12): CitationStat | null {
  const files = cityModules(city)
  if (files.length === 0) return null
  let numbersAll = 0
  let citedAll = 0
  const samplesAll: CitationStat['uncitedSamples'] = []
  for (const file of files) {
    const one = scanOne(readFileSync(file, 'utf8'), window)
    numbersAll += one.numbers
    citedAll += one.cited
    // Per-FILE line numbers. Concatenating first and reporting offsets into the
    // concatenation made every number after the first file's boundary point at
    // the wrong line — a report nobody could act on, which is the same failure
    // as not reporting at all.
    for (const u of one.uncited) {
      if (samplesAll.length < 8) samplesAll.push({ line: u.line, text: `${file.split('/').slice(-2).join('/')}:${u.line}  ${u.text}` })
    }
  }
  return { module: city, numbers: numbersAll, cited: citedAll, uncitedSamples: samplesAll, files: files.length }
}

function scanOne(raw: string, window: number) {
  const lines = raw.split('\n')
  const code = stripCommentsAndStrings(raw).split('\n')
  let numbers = 0
  let cited = 0
  const uncitedSamples: CitationStat['uncitedSamples'] = []
  for (let i = 0; i < code.length; i++) {
    // Candidate limits: a number with a decimal point, or an integer of 2+
    // digits. Skips 0/1-style flags and array indices, which are not figures
    // anybody sourced.
    const hits = code[i].match(/(?<![\w.])(?:\d+\.\d+|\d{2,})(?![\w.])/g)
    if (!hits) continue
    // ⚠️ FILTER PER NUMBER, NOT PER LINE — and this took three tries.
    //   · Skipping whole lines that contained a comparison fixed
    //     philadelphia.ts, whose only "figures" are the sanity bounds
    //     `ft > 1000` and `far > 100`. Nothing anybody could cite.
    //   · But it then excluded `if (/\bLR1\b/.test(base)) return 30` — the
    //     Seattle tier heights, which are the exact uncited numbers this whole
    //     check was built to catch. A bound and a returned default are both
    //     conditionals; only one is a published figure.
    // The discriminator is what the number is DOING: compared against, or
    // returned/assigned. So each hit is judged on its own context.
    if (/\bimport\b|\brequire\(|FeatureServer|MapServer|https?:/.test(code[i])) continue
    // Infrastructure constants are not code figures. Timeouts, retry counts and
    // buffer distances are engineering choices nobody could cite to an
    // ordinance, and counting them makes the ratchet noisier without making any
    // city better sourced.
    if (/\b(deadline|timeout|timeoutMs|attemptCapMs|maxAttempts|retries|retryMs|ms|bufferFt|precision|maxRecordCount|resultRecordCount|outSR|wkid)\b/i.test(code[i])) continue
    const line = code[i]
    const counted = hits.filter((h) => {
      const at = line.indexOf(h)
      const before = line.slice(Math.max(0, at - 12), at)
      // A comparison operand, an array index, or a formatting argument is not a
      // figure the code publishes.
      if (/[<>]=?\s*$|[!=]==?\s*$/.test(before)) return false
      if (/\.(slice|substring|padStart|padEnd|toFixed|repeat)\(\s*$/.test(before)) return false
      if (/\b(isFinite|isNaN)\b/.test(line) && /[<>]/.test(line)) return false
      // Must be RETURNED, ASSIGNED, or passed to a helper.
      return /return\s*$|[:=]\s*$|[(,]\s*$/.test(before) || /[:=]\s*[-\d]/.test(line)
    })
    if (counted.length === 0) continue
    numbers += counted.length
    const from = Math.max(0, i - window)
    const near = lines.slice(from, i + 2).join('\n')
    if (CITATION.test(near) || SOURCE_KEY.test(near)) cited += counted.length
    else if (uncitedSamples.length < 5) uncitedSamples.push({ line: i + 1, text: lines[i].trim().slice(0, 90) })
  }
  return { numbers, cited, uncited: uncitedSamples }
}

interface Baseline {
  note: string
  generated: string
  modules: Record<string, { numbers: number; cited: number }>
}

function loadBaseline(): Baseline | null {
  if (!existsSync(BASELINE)) return null
  return JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
}

export function citiesWithBothModules(): string[] {
  const p = readdirSync(PROVIDERS).filter((f) => /^[a-z]+\.ts$/.test(f)).map((f) => f.replace('.ts', ''))
  const z = new Set(readdirSync(ZONING).filter((f) => /^[a-z]+\.ts$/.test(f)).map((f) => f.replace('.ts', '')))
  return p.filter((c) => z.has(c)).sort()
}

function main() {
  const argv = process.argv.slice(2)
  const only = argv.find((a) => a.startsWith('--city='))?.split('=')[1]
  const writeBaseline = argv.includes('--write-baseline')
  const all = citiesWithBothModules()
  const cities = only ? all.filter((c) => c === only) : all

  if (cities.length === 0) {
    console.error(`[readiness] no cities matched${only ? ` --city=${only}` : ''} — refusing to report a clean run over an empty set`)
    process.exitCode = 1
    return
  }

  console.log('[readiness] GREEN means: no duplicated parse between a city’s two modules, and')
  console.log('[readiness] citation coverage at or above the recorded baseline.')
  console.log('[readiness] It does NOT mean the city resolves — that is scripts/smoke-parcels.ts —')
  console.log('[readiness] and it does NOT mean the numbers are correct.\n')

  const dupes = findDuplicateParses(cities)
  const stats = cities.map((c) => citationCoverage(c)).filter((s): s is CitationStat => s != null)

  if (argv.includes('--samples')) {
    // What actually scored uncited. Printed on demand because the point of a
    // ratchet is to be actionable: a percentage nobody can act on is a number,
    // not a finding.
    for (const s of stats) {
      if (s.cited === s.numbers) continue
      console.log(`\n${s.module} — ${s.numbers - s.cited} uncited of ${s.numbers}`)
      for (const u of s.uncitedSamples) console.log(`   :${u.line}  ${u.text}`)
    }
    return
  }

  if (writeBaseline) {
    const modules: Baseline['modules'] = {}
    for (const s of stats) modules[s.module] = { numbers: s.numbers, cited: s.cited }
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note: 'A RATCHET, not a target. Each module\'s citation coverage as measured when recorded; city-readiness.ts fails when a module drops BELOW its figure. Raising one is a deliberate edit. Generated by `--write-baseline`.',
          generated: new Date().toISOString().slice(0, 10),
          modules,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`[readiness] wrote baseline for ${stats.length} modules`)
    return
  }

  const baseline = loadBaseline()
  const failures: string[] = []

  for (const city of cities) {
    const d = dupes.filter((x) => x.city === city)
    const s = stats.find((x) => x.module === city)
    const prior = baseline?.modules[city]
    const pct = s && s.numbers ? Math.round((100 * s.cited) / s.numbers) : null
    const priorPct = prior && prior.numbers ? Math.round((100 * prior.cited) / prior.numbers) : null
    // ⚠️ RATCHET ON THE UNCITED COUNT, NOT THE CITED COUNT. The first version
    // compared `cited` against its baseline, and adding a NEW uncited number
    // does not reduce `cited` — it raises `numbers`. Verified by planting one:
    // Seattle went 35/47 → 35/48 and the check printed GREEN. The quantity that
    // must not grow is the number of figures with no source.
    const uncitedNow = s != null ? s.numbers - s.cited : 0
    const uncitedPrior = prior != null ? prior.numbers - prior.cited : 0
    const dropped = prior != null && s != null && uncitedNow > uncitedPrior
    const ok = d.length === 0 && !dropped
    if (!ok) failures.push(city)
    const bits = [
      `${d.length} duplicated parse${d.length === 1 ? '' : 's'}`,
      pct == null ? 'no numbers' : `${pct}% cited (${s!.cited}/${s!.numbers})`,
      priorPct == null ? 'no baseline' : dropped ? `REGRESSED: ${uncitedNow} uncited vs ${uncitedPrior} at baseline` : 'at baseline',
    ]
    console.log(`${ok ? 'GREEN' : 'RED  '} ${city.padEnd(13)} ${bits.join(' · ')}`)
    for (const x of d) console.log(`        ↳ ${x.pattern} in BOTH ${x.files[0]} and ${x.files[1]}`)
  }

  console.log(`\n[readiness] ${cities.length} cities checked · ${dupes.length} duplicated parses · ${failures.length} RED`)
  if (!baseline) {
    console.log('[readiness] NO BASELINE RECORDED — run with --write-baseline. Until then the')
    console.log('[readiness] citation half of this check cannot fail, which means it is not a check.')
    process.exitCode = 1
    return
  }
  if (failures.length) process.exitCode = 1
}

if (process.env.VITEST == null) main()
