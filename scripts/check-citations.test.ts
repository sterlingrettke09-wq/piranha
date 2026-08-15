import { describe, it, expect } from 'vitest'
import {
  BLOCKED_STATUS,
  isBlocked,
  isDead,
  scanSource,
  verdictFor,
  collectCoverage,
  distinctCitations,
  overallVerdict,
  formatCoverage,
  type FileCoverage,
} from './check-citations'

// WHAT THESE TESTS DEFEND
//
// `check-citations.ts` can only verify one kind of thing: a URL in a comment. It
// fetches those and fails on a 4xx. Everything else this repo cites — and that is
// MOST of it — is a section number it cannot fetch. Before the coverage
// assertion, pointing the script at `hurdles.ts` (191 section citations, zero
// URLs) produced a clean summary having verified nothing at all. An instrument
// reporting success on the empty set.
//
// The rule under test: a file that plainly cites sources but yields zero
// checkable URLs is UNCHECKED, and a run containing one can never print PASS.
// Delete that rule and the assertions below fail — including on the real tree,
// not only on fixtures, because a rule proven on a fixture measures the fixture
// (ledger rule 11).

/** Shaped like `hurdles.ts`: citations live in user-facing strings, no URL anywhere. */
const HURDLES_SHAPED = [
  "  note: 'Work needs a Certificate of Appropriateness (SDMC § 143.0210(e)(2)) before permits issue.',",
  "  note: 'Historic review runs under D.C. Official Code § 6-1107(b), with 11-C DCMR § 302 controlling.',",
  '  // Screening threshold at § 143.0212; demolition screen at §§ 599.910, 599.920.',
].join('\n')

describe('coverage — a file that cites but offers nothing fetchable is UNCHECKED', () => {
  it('classifies a citation-dense, URL-free file as unchecked rather than passing it', () => {
    const f = scanSource('netlify/functions/lib/hurdles.ts', HURDLES_SHAPED)

    expect(f.checkable).toHaveLength(0)
    expect(f.unverifiable.length).toBeGreaterThan(0)
    // The whole point: not 'checked', and not 'silent' either. Silence here would
    // be the old behaviour — nothing to report, therefore fine.
    expect(verdictFor(f)).toBe('unchecked')
  })

  it('extracts the section citations it cannot check, so the gap has a number on it', () => {
    const f = scanSource('x.ts', HURDLES_SHAPED)
    expect(f.unverifiable).toEqual(
      expect.arrayContaining(['§ 143.0210', '§ 6-1107', '§ 302', '§ 143.0212', '§§ 599.910']),
    )
  })

  it('separates a known absence from an unchecked gap', () => {
    // No citations of any kind. Nothing was missed, so nothing is reported —
    // an absence is an answer, not a hole (ledger rule 5).
    expect(verdictFor(scanSource('x.ts', 'export const RATE = 1.25\n'))).toBe('silent')
    // A URL in a comment is the one thing this tool can actually test.
    expect(verdictFor(scanSource('x.ts', '// see https://example.gov/code\n'))).toBe('checked')
  })

  it('does not count a bare code name with no locator as a citation', () => {
    // Guards the instrument against itself: an unlocated topic word is a mention.
    // Matching those made this very file report 10 citations lifted off the
    // source text of its own regex.
    expect(scanSource('x.ts', '// under the Seattle Municipal Code generally\n').unverifiable).toEqual([])
    // ...while real locator forms still count, including the connective ones.
    expect(scanSource('x.ts', '// Nashville zoning (Metro Code Title 17): RM multifamily\n').unverifiable).toEqual([
      'Metro Code Title 17',
    ])
    expect(scanSource('x.ts', '// Metro Code Ch. 17.20 minimums remain outside the UZO.\n').unverifiable).toEqual([
      'Metro Code Ch. 17.20',
    ])
    expect(scanSource('x.ts', '// SMC 23.47A.013 Table A publishes the by-right FAR\n').unverifiable).toEqual([
      'SMC 23.47A.013',
    ])
  })
})

describe('the run verdict cannot read as success while a file is unchecked', () => {
  const unchecked: FileCoverage = { file: 'a.ts', checkable: [], unverifiable: ['§ 1001.2'] }
  const checked: FileCoverage = {
    file: 'b.ts',
    checkable: [{ url: 'https://example.gov/x', file: 'b.ts', line: 1, knownDead: false }],
    unverifiable: [],
  }

  it('is PARTIAL — never PASS — when any citing file yielded nothing checkable', () => {
    expect(overallVerdict([checked, unchecked], 0)).toBe('PARTIAL')
    expect(overallVerdict([checked, unchecked], 0)).not.toBe('PASS')
  })

  it('reaches PASS only when every citing file yielded a checkable URL', () => {
    expect(overallVerdict([checked], 0)).toBe('PASS')
  })

  it('still puts a dead link ahead of coverage — FAIL outranks PARTIAL', () => {
    expect(overallVerdict([checked, unchecked], 1)).toBe('FAIL')
  })

  it('prints UNCHECKED loudly and distinctly, with per-file N checkable / M unverifiable', () => {
    const out = formatCoverage([checked, unchecked])
    expect(out).toContain('UNCHECKED')
    expect(out).toMatch(/0 checkable \/\s+1 unverifiable-by-this-tool\s+a\.ts/)
    expect(out).toMatch(/1 checkable \/\s+0 unverifiable-by-this-tool\s+b\.ts/)
    // The word must not be reusable as a pass: the summary says what it means.
    expect(out).toContain('verified NOTHING')
  })
})

describe('measuring the real tree, not a fixture', () => {
  const files = collectCoverage()

  it('reports hurdles.ts as unchecked — the file that motivated all of this', () => {
    const hurdles = files.find((f) => f.file === 'netlify/functions/lib/hurdles.ts')
    expect(hurdles, 'hurdles.ts must be in the scan; if it moved, retarget this test').toBeDefined()
    expect(hurdles!.checkable).toHaveLength(0)
    // ~191 today. The floor is deliberately far below that: this asserts the
    // scanner still SEES the citations, not that the count is frozen.
    expect(hurdles!.unverifiable.length).toBeGreaterThan(100)
    expect(verdictFor(hurdles!)).toBe('unchecked')
  })

  it('cannot currently print PASS for this repo', () => {
    expect(overallVerdict(files, 0)).toBe('PARTIAL')
  })

  it('reports far more unverifiable citations than checkable URLs', () => {
    const checkable = files.reduce((n, f) => n + f.checkable.length, 0)
    const unverifiable = files.reduce((n, f) => n + f.unverifiable.length, 0)
    // The honest headline: a handful of fetchable URLs against hundreds of
    // section citations. If this ever inverts, re-read the header's claim (b).
    //
    // ⚠️ REFORMULATED 2026-08-08 as a RATIO. This asserted `checkable < 20`,
    // and wiring four cities pushed the count from 15 to exactly 20 — five of
    // them permit-department URLs recorded in `cities.ts` as evidence that the
    // URL was read rather than guessed. The test went red for citing MORE
    // sources, which is the opposite of what it exists to police, and the fix
    // it invited was to bump 20 to 25 and wait for the next city.
    //
    // The sentence in the test's own name is a comparison, not a budget, so the
    // assertion is now the comparison. Note the neighbouring hurdles.ts test
    // already says the same thing about itself — "this asserts the scanner
    // still SEES the citations, not that the count is frozen" — so this is the
    // file's stated philosophy applied to the one assertion that had not
    // followed it. Today: 20 checkable, 556 unverifiable, ratio 27.8.
    expect(checkable).toBeGreaterThan(0)
    expect(unverifiable).toBeGreaterThan(300)
    expect(unverifiable / checkable).toBeGreaterThan(10)
  })

  it('counts per file BEFORE deduping for the probe', () => {
    // The instrument bug this shape invites: dedupe URLs during the walk and
    // every file after the first to cite a shared URL shows zero checkable
    // items — a defect in the measurement dressed up as a finding about the
    // repo (ledger rule 11).
    const url = '// https://example.gov/shared'
    const a = scanSource('a.ts', url)
    const b = scanSource('b.ts', url)
    expect(a.checkable).toHaveLength(1)
    expect(b.checkable).toHaveLength(1)
    expect(verdictFor(b)).toBe('checked')
    // ...and the probe list is still deduped, so coverage accounting does not
    // multiply network requests.
    expect(distinctCitations([a, b])).toHaveLength(1)
  })

  it('preserves the known-dead marker through the per-file scan', () => {
    const f = scanSource('nyc.ts', '// known-dead: https://zr.planning.nyc.gov/article-ii/chapter-3/23-662\n')
    expect(f.checkable[0].knownDead).toBe(true)
  })
})

describe('a refused fetcher is not a dead document', () => {
  // The check exists because a REPEALED section keeps being cited: NYC's
  // ZR 23-662 returned 404 for months while nine height values pointed at it.
  // A 403 is a different fact — the publisher declined to serve us, and the
  // document's state is simply unknown.
  //
  // Measured 2026-08-15: nine cited URLs returned 403 (city.milwaukee.gov,
  // phoenix.municipal.codes, columbus.gov) and all of them still 403 under a
  // full browser user-agent, so it is IP- or challenge-based blocking. The run
  // was RED on every one, which made the whole result unreadable — and a check
  // that is red for a reason unrelated to citation health gets ignored, which
  // is exactly when the real 404 slips through.
  it.each([404, 410, 400, 500, 503])('%i is DEAD', (s) => {
    expect(isDead(s)).toBe(true)
    expect(isBlocked(s)).toBe(false)
  })

  it.each([401, 403, 429])('%i is BLOCKED, not dead', (s) => {
    expect(isBlocked(s)).toBe(true)
    expect(isDead(s)).toBe(false)
  })

  it.each([200, 206, 301, 302])('%i is neither', (s) => {
    expect(isDead(s)).toBe(false)
    expect(isBlocked(s)).toBe(false)
  })

  it('a null status is neither dead nor blocked — it is unreachable', () => {
    expect(isDead(null)).toBe(false)
    expect(isBlocked(null)).toBe(false)
  })

  // ⚠️ THE HALF THAT KEEPS THIS HONEST. A blocked URL must not be counted as
  // LIVE either. It is unverified, and folding it into the pass column would
  // turn "we could not check nine of these" into "all thirty-four resolve".
  it('the blocked set is non-empty and pinned (rule 20)', () => {
    expect(BLOCKED_STATUS.size).toBe(3)
    expect([...BLOCKED_STATUS].sort()).toEqual([401, 403, 429])
    // 404 must never drift into it — that is the status the whole check exists
    // to catch.
    expect(BLOCKED_STATUS.has(404)).toBe(false)
  })
})
