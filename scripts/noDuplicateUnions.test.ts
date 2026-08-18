import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

// A UNION DECLARED TWICE IS A CLAIM THAT NOBODY CHECKS.
//
// `src/types/analysis.ts` carried its own copy of ParcelInfo's `farBasis` union
// under a comment saying it "mirrors" it. Adding 'basis-elective' updated one,
// and the build broke ONLY because analyze.ts assigns a ParcelInfo envelope
// straight into that shape. Joined by anything looser — a mapper, a spread, a
// structural subtype — the new state would have been settable upstream and
// unrepresentable downstream, silently.
//
// So this looks for the pattern rather than waiting for a third instance: two
// declarations whose string-literal member SETS are identical. Prose comments
// saying "mirrors" are not the signal (the codebase has many, all about ArcGIS
// data mirrors); the duplicated member set is.

const ROOT = resolve(__dirname, '..')
const DIRS = ['src/types', 'netlify/functions/lib']

/** Declared duplicates, each with the reason it is allowed to be one. */
const DECLARED: Record<string, string> = {}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(relative(ROOT, p))
  }
  return out
}

interface Decl { file: string; key: string; members: string[] }

function unions(): { decls: Decl[]; filesScanned: number } {
  const files = DIRS.flatMap((d) => walk(join(ROOT, d)))
  const decls: Decl[] = []
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8')
    // Runs of `| 'literal'` — the shape both farBasis copies had.
    for (const m of src.matchAll(/((?:\s*\|\s*'[a-zA-Z0-9_-]+')\s*(?:\|\s*'[a-zA-Z0-9_-]+'\s*){3,})/g)) {
      const members = [...m[1].matchAll(/'([a-zA-Z0-9_-]+)'/g)].map((x) => x[1]).sort()
      if (members.length < 4) continue
      decls.push({ file: f, key: members.join('|'), members })
    }
  }
  return { decls, filesScanned: files.length }
}

describe('no string-literal union is declared in two places', () => {
  const { decls, filesScanned } = unions()

  it('the scan reached the type files at all (rule 20)', () => {
    // An empty scan would make the assertion below vacuously true — the exact
    // shape this repo keeps re-learning.
    expect(filesScanned, 'the walk found no type files').toBeGreaterThan(10)
    expect(decls.length, 'no multi-member unions found — the regex broke').toBeGreaterThan(3)
  })

  it('and none appears twice', () => {
    const byKey = new Map<string, string[]>()
    for (const d of decls) {
      if (!byKey.has(d.key)) byKey.set(d.key, [])
      const files = byKey.get(d.key)!
      if (!files.includes(d.file)) files.push(d.file)
    }
    const dupes = [...byKey.entries()]
      .filter(([k, files]) => files.length > 1 && !(k in DECLARED))
      .map(([k, files]) => `{${k}} declared in ${files.join(' AND ')}`)
    expect(
      dupes,
      'derive the second one from the first (`NonNullable<X[\'y\']>[\'z\']`) rather than restating it — a "mirrors" comment is a claim checked by nobody',
    ).toEqual([])
  })
})
