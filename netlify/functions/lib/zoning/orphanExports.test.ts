import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

// AN EXPORT NO PRODUCTION FILE CALLS IS GUARDED BY NOTHING, AND ITS TESTS LOOK
// LIKE COVERAGE.
//
// ── THE DEFECT THIS GENERALISES ──────────────────────────────────────────────
//
// `denverHeightNearProtected('CMP-NWC-R', …)` returns 40 ft, the figure DZC
// Article 9 states, and a unit test asserted it and passed. No live parcel in
// that district could obtain 40 ft from anywhere: the provider ran the resolver
// only inside `if (bufferRule)`, and CMP-NWC-R — the one campus district with no
// distance-based reduction — carries no rule. The test called the resolver
// directly; nothing on the parcel path did.
//
// A test through the provider would have caught it; a test of the resolver could
// not. So the general form is: a test asserting a value from a function no
// production path reaches is testing the function, never the pipeline. At export
// granularity that is mechanically checkable, the same way the Denver
// single-caller invariant is.
//
// ── WHAT COUNTS AS REACHED ───────────────────────────────────────────────────
//
// Uses ANYWHERE in production, INCLUDING the exporting module itself — a helper
// its own resolver calls internally is on the parcel path. The first version of
// this scan excluded same-file uses and reported 14 orphans, eleven of which
// were internal helpers like `sanDiegoZoneKey` that `resolveSanDiego` calls one
// line down. That is rule 11 committed inside the check written to enforce it,
// which is the second time a probe in this repo has done exactly that.

const ROOT = resolve(__dirname, '../../../..')
const ZONING = join(ROOT, 'netlify/functions/lib/zoning')

/**
 * Exports reached only by tests, each with the reason it is allowed to be.
 *
 * Every entry must say why, because the alternative is an allowlist that grows
 * whenever the check is inconvenient. None of these publishes a value to a
 * parcel; where one DID have user-facing consequences it is recorded below
 * rather than waved through.
 */
const DECLARED: Record<string, string> = {
  // Set membership for the Protected District buffer. Production asks the
  // narrower question — `denverProtectedDistrictRule` (does a rule apply) and
  // then a live spatial query — so the bare predicate is only ever a readable
  // assertion about the 39-code set. Kept because that set is the thing worth
  // pinning; it resolves no figure by itself.
  isDenverProtectedDistrict: 'set-membership assertion; production uses denverProtectedDistrictRule + the spatial query',

  // ⚠️ THIS ONE HAS A USER-FACING CONSEQUENCE, and the check is how it surfaced.
  // It builds the sentence naming WHICH ordinance governs a planned-development
  // parcel and WHERE to read it — the actionable half of that reason code, which
  // envelope.ts explains is the whole reason the code is preferred over
  // 'basis-unavailable': "the limit is in that ordinance" tells the reader where
  // to look. Nothing calls it. The panel instead renders a hardcoded paragraph
  // carrying the general claim and no citation, so the citation is computed and
  // discarded, and the same claim now has two sources that can disagree.
  //
  // NOT wired here on purpose. It returns a sentence only for Dallas and Chicago
  // (the other PD cities carry their own disclosure text in their own modules),
  // and Dallas's runs past 400 characters including a quoted excerpt of § 51A-
  // 4.702. Putting that in a parcel panel is a copy decision, not a wiring fix,
  // and disclosure copy is code (CLAUDE.md).
  plannedDevelopmentSource: 'builds the PD citation sentence; the panel renders a generic paragraph instead — wiring it is a copy decision, see comment',

  // Classification only, and deliberately off the parcel path: it answers "which
  // Chapter 15 article publishes this district's standards", which is inventory
  // for the sweep and the module's own scope note. It resolves no limit — every
  // one of the 83 stays a gap.
  sanDiegoPlannedDistrict: 'inventory/classification for the Chapter 15 triage; resolves no limit',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(entry)) out.push(relative(ROOT, p))
  }
  return out
}

interface Orphan {
  module: string
  fn: string
}

function scan(): { orphans: Orphan[]; checked: number } {
  const all = [
    ...walk(join(ROOT, 'netlify')),
    ...walk(join(ROOT, 'src')),
    ...walk(join(ROOT, 'scripts')),
  ]
  const body = new Map(all.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]))
  const prod = all.filter((f) => !/\.test\.tsx?$/.test(f))
  const orphans: Orphan[] = []
  let checked = 0
  for (const file of readdirSync(ZONING).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))) {
    const rel = relative(ROOT, join(ZONING, file))
    const src = body.get(rel)!
    for (const m of src.matchAll(/^export (?:async )?function (\w+)/gm)) {
      const fn = m[1]
      checked++
      const uses = prod.reduce((n, p) => {
        const hits = [...body.get(p)!.matchAll(new RegExp(`\\b${fn}\\b`, 'g'))].length
        // Subtract the declaration itself in the defining file.
        return n + (p === rel ? Math.max(0, hits - 1) : hits)
      }, 0)
      if (uses === 0) orphans.push({ module: file, fn })
    }
  }
  return { orphans, checked }
}

describe('every zoning export is reachable from a parcel, or says why not', () => {
  const { orphans, checked } = scan()

  it('the scan actually examined the modules (rule 20)', () => {
    // A scan that walked nothing, or a regex that stopped matching `export
    // function`, would report zero orphans — indistinguishable from a clean
    // result. Pinned as a floor rather than an exact count so adding a module
    // does not fail the build for the wrong reason.
    expect(checked, 'no exported functions found — the scan or its regex broke').toBeGreaterThan(50)
    expect(readdirSync(ZONING).length).toBeGreaterThan(20)
  })

  it('and every orphan is declared, with a reason', () => {
    const undeclared = orphans.filter((o) => !(o.fn in DECLARED))
    expect(
      undeclared.map((o) => `${o.module}:${o.fn}`),
      'an export only tests reach publishes nothing — either wire it to a parcel path or declare why it is off it (see the CMP-NWC-R case at the top of this file)',
    ).toEqual([])
  })

  it('and no declaration outlives its subject', () => {
    // The other direction. Once an export IS wired to a parcel path its entry
    // here becomes a stale claim that it is not — the shape rule 20 keeps
    // producing, where a guard quietly stops describing anything.
    const names = new Set(orphans.map((o) => o.fn))
    for (const fn of Object.keys(DECLARED)) {
      expect(names.has(fn), `${fn} is now called from production — drop its entry`).toBe(true)
    }
  })
})
