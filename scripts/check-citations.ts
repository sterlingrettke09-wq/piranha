// Fetch every URL this repo CITES and fail on any that no longer resolves —
// and report, per file, how much of that file's citing this tool cannot check.
//
// WHY THIS EXISTS
// NYC's zoning module cited ZR 23-662 throughout. City of Yes for Housing
// Opportunity repealed that section on 2024-12-05 and moved Quality Housing
// heights into ZR 23-432 — and the cited URL has returned 404 ever since. Nine
// published height values were sourced to a section that no longer exists.
//
// This is a THIRD failure mode, distinct from the two the ledger already tracks:
//   · unsourced      — no citation at all
//   · mis-transcribed — citation right, number copied wrong
//   · DECAYED        — citation right when written, and the document moved
//
// Nothing internal can detect the third. A citation is a claim about the current
// state of an external document, and it rots silently. This check is the floor:
// a dead URL becomes a failure instead of a broken link nobody clicks.
//
// WHAT IT CANNOT DO — stated plainly so the green result is not over-read.
//
// (a) NOT AMENDED-IN-PLACE. It catches REPEALED and MOVED. It does NOT catch a
//     section amended in place: the URL still resolves 200 while the text
//     underneath changed. That is the more common case and it still needs a
//     human reading the source. A pass here means "the documents we cite still
//     exist", never "the numbers we cite are current".
//
// (b) NOT SECTION-STYLE CITATIONS — the COVERAGE limit, and the larger of the
//     two. The only checkable item this tool knows how to fetch is a URL in a
//     comment. Most of what this repo cites is not a URL. Measured 2026-08-06:
//     3 fetchable URLs against 418 distinct section citations, and 46 of the 48
//     citing files contain not one thing this tool can test. `hurdles.ts` alone
//     carries 191 section citations (`§ 143.0210`, `SDMC § 143.0212`,
//     `11-C DCMR § 302`) and ZERO URLs. Those counts drift with the tree — run
//     it for today's, and note the tests assert FLOORS, not these figures.
//     Pointed at that file the old version of
//     this script returned a clean summary having verified NOTHING — the same
//     shape as a PDF reader reporting "no FAR is stated" while unable to extract
//     text, and `enumerate-parser-domains.ts` reading a property that did not
//     exist (ledger rules 11 and 18: a result that looks like an answer gets
//     less scrutiny than one that looks like a gap).
//
//     So: a file that plainly contains citations but yields zero checkable URLs
//     is reported as UNCHECKED, loudly and separately, and the run's verdict is
//     PARTIAL — never PASS. `--strict` makes PARTIAL exit non-zero for CI. The
//     fix is NOT to teach this tool to fetch section numbers: resolving one
//     means reading the code text and judging whether the words still say what
//     we claim, which is a human job. The fix is that silence stops looking
//     like success.
//
//   npx vite-node scripts/check-citations.ts           # check, exit 1 on a dead URL
//   npx vite-node scripts/check-citations.ts --strict  # also exit 1 on UNCHECKED files
//   npx vite-node scripts/check-citations.ts --write   # also refresh the manifest

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['netlify', 'src', 'scripts']

/** A URL in a COMMENT is a citation — a claim about a source. A URL in code is
 *  an endpoint we call, exercised by the live probes instead. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/
const URL_RE = /https?:\/\/[^\s)'"`,;<>\]]+/g

/** Section-style citations, which this tool can COUNT but cannot CHECK.
 *
 *  Deliberately scanned across ALL lines, not just comments — unlike URLs. The
 *  comment-only rule for URLs distinguishes a cited source from an endpoint we
 *  call; no such ambiguity exists here. `hurdles.ts` publishes its citations
 *  inside the user-facing `note` strings, and a citation shown to a user is the
 *  one that most needs to be true. */
const SECTION_RE = /§§?\s*[0-9][0-9A-Za-z.\-‐-―]*/g
/** Code names carrying a LOCATOR — `SMC 23.47A.013`, `Metro Code Title 17`,
 *  `Metro Code Ch. 17.20`. Counted only on lines with no § match, so
 *  `SDMC § 143.0212` is one citation and not two.
 *
 *  The locator is required, and that requirement is load-bearing in both
 *  directions. Without it a bare topic word ("the Seattle Municipal Code") scores
 *  as a citation — and worse, this very file scored 10 of them off the source
 *  text of the regex below, the instrument counting its own alternation as
 *  evidence about the repo (ledger rule 11). Requiring the locator also has to
 *  accept the connectives real citations use: `Ch.`, `Title`, `Art.`, `Sec.`
 *  Matching only a directly adjacent digit dropped `Metro Code Title 17` and
 *  `Metro Code Ch. 17.20`, silencing two files entirely — verified by diffing
 *  per-file verdicts across the real tree, not on a fixture. */
const CODE_NAME_RE =
  /\b(?:DCMR|SDMC|SMC|LAMC|D\.R\.M\.C\.|Municipal Code|Metro Code|Zoning Resolution|Admin(?:istrative)? Code)(?:\s+(?:§§?|[Tt]itle|[Cc]h(?:apter)?\.?|[Aa]rt(?:icle)?\.?|[Ss]ec(?:tion)?\.?))?\s*§?\s*\d[\w.-]*/g

export interface Citation {
  url: string
  file: string
  line: number
  /** Marked `known-dead` in the comment: cited AS EVIDENCE that it no longer
   *  resolves (nyc.ts records the repealed ZR 23-662 link that way). Expected to
   *  be dead — and if it ever comes back ALIVE the record is wrong, which is also
   *  a failure. An explicit marker, never inferred from nearby prose: guessing
   *  from a "404" mention would let a genuinely rotted link hide behind a word. */
  knownDead: boolean
}

/** What one file offered this tool, and what it withheld. */
export interface FileCoverage {
  file: string
  /** URLs in comments — the only thing this tool can actually verify. */
  checkable: Citation[]
  /** Distinct section-style citations. Real claims about real documents that
   *  this tool has no way to test. Counted so the gap is visible, never so it
   *  can be scored as fine. */
  unverifiable: string[]
}

/** `unchecked` is the state this whole exercise exists to surface: the file
 *  plainly cites sources and this tool verified none of them. `silent` files
 *  cite nothing at all and are not reported — absence of citations is not a
 *  coverage gap (ledger rule 5: a known absence is not a missing lookup). */
export type FileVerdict = 'checked' | 'unchecked' | 'silent'

export function verdictFor(f: FileCoverage): FileVerdict {
  if (f.checkable.length > 0) return 'checked'
  return f.unverifiable.length > 0 ? 'unchecked' : 'silent'
}

/** Scan ONE file's text. Pure, so the coverage rule can be tested without a
 *  filesystem — but the tests also run it over the real tree, because a rule
 *  proven only on a fixture measures the fixture (ledger rule 11). */
export function scanSource(file: string, text: string): FileCoverage {
  const checkable = new Map<string, Citation>()
  const unverifiable = new Set<string>()

  text.split('\n').forEach((line, i) => {
    if (COMMENT_LINE.test(line)) {
      for (const raw of line.match(URL_RE) ?? []) {
        // Trim trailing punctuation that belongs to the prose, not the URL.
        const url = raw.replace(/[.,;:)]+$/, '')
        if (!checkable.has(url))
          checkable.set(url, { url, file, line: i + 1, knownDead: /known-dead/.test(line) })
      }
    }
    const sections = line.match(SECTION_RE) ?? []
    for (const s of sections) unverifiable.add(s.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim())
    if (sections.length === 0)
      for (const c of line.match(CODE_NAME_RE) ?? [])
        unverifiable.add(c.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim())
  })

  return { file, checkable: [...checkable.values()], unverifiable: [...unverifiable] }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

/** Per-FILE coverage for the whole tree.
 *
 *  Counting is per file and only then deduped for probing — never the reverse.
 *  A repo-wide `seen` set applied during the walk would credit the first file to
 *  cite a URL and show every later one as having zero checkable items, which is
 *  a defect in the instrument dressed up as a finding about the code. */
export function collectCoverage(root = ROOT, dirs = DIRS): FileCoverage[] {
  const files: FileCoverage[] = []
  for (const dir of dirs)
    for (const file of walk(join(root, dir)))
      files.push(scanSource(relative(root, file), readFileSync(file, 'utf8')))
  return files.sort((a, b) => a.file.localeCompare(b.file))
}

/** The distinct URLs to probe, in stable order. */
export function distinctCitations(files: FileCoverage[]): Citation[] {
  const seen = new Map<string, Citation>()
  for (const f of files) for (const c of f.checkable) if (!seen.has(c.url)) seen.set(c.url, c)
  return [...seen.values()].sort((a, b) => a.url.localeCompare(b.url))
}

/** The run's verdict. PASS is reachable ONLY when every citing file yielded at
 *  least one checkable URL. Anything less is PARTIAL and says so. */
export function overallVerdict(
  files: FileCoverage[],
  failures: number,
): 'FAIL' | 'PARTIAL' | 'PASS' {
  if (failures > 0) return 'FAIL'
  return files.some((f) => verdictFor(f) === 'unchecked') ? 'PARTIAL' : 'PASS'
}

/** Per-file coverage table: N checkable / M unverifiable-by-this-tool. */
export function formatCoverage(files: FileCoverage[]): string {
  const cited = files.filter((f) => verdictFor(f) !== 'silent')
  const unchecked = cited.filter((f) => verdictFor(f) === 'unchecked')
  const rows = [...cited].sort(
    (a, b) =>
      Number(verdictFor(b) === 'unchecked') - Number(verdictFor(a) === 'unchecked') ||
      b.unverifiable.length - a.unverifiable.length ||
      a.file.localeCompare(b.file),
  )

  const out: string[] = ['', 'COVERAGE — what this tool checked, per file', '']
  for (const f of rows) {
    const tag = verdictFor(f) === 'unchecked' ? 'UNCHECKED' : '  checked '
    out.push(
      `${tag}  ${String(f.checkable.length).padStart(3)} checkable / ` +
        `${String(f.unverifiable.length).padStart(4)} unverifiable-by-this-tool   ${f.file}`,
    )
  }

  const totalUnverifiable = cited.reduce((n, f) => n + f.unverifiable.length, 0)
  const totalCheckable = cited.reduce((n, f) => n + f.checkable.length, 0)
  out.push(
    '',
    `${totalCheckable} checkable URLs · ${totalUnverifiable} section-style citations this tool CANNOT check · ` +
      `${unchecked.length} of ${cited.length} citing files fully unchecked`,
  )
  if (unchecked.length) {
    const worst = unchecked.reduce((a, b) => (b.unverifiable.length > a.unverifiable.length ? b : a))
    out.push(
      '',
      `UNCHECKED means this tool verified NOTHING in those ${unchecked.length} files — not that they are fine.`,
      `Worst: ${worst.file} (${worst.unverifiable.length} citations, 0 fetchable). Section citations need a`,
      'human reading the code text; this script only ever proves that cited URLs still resolve.',
    )
  }
  return out.join('\n')
}

/** HEAD first (cheap); some hosts reject HEAD, so fall back to a ranged GET.
 *  A network error is reported as UNREACHABLE and does NOT fail the run — an
 *  offline machine must not look like a repealed statute (rule 5: a failed fetch
 *  is never a substantive answer). Only a definite 4xx/5xx is a failure. */
async function probe(url: string): Promise<{ status: number | null; note: string }> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: method === 'GET' ? { Range: 'bytes=0-2048' } : {},
        signal: AbortSignal.timeout(20000),
      })
      if (res.status === 405 || res.status === 501) continue
      return { status: res.status, note: res.status >= 400 ? res.statusText : '' }
    } catch (e) {
      if (method === 'GET') return { status: null, note: String((e as Error).message).slice(0, 80) }
    }
  }
  return { status: null, note: 'no response' }
}

// ⚠️ A 403 IS NOT A DEAD DOCUMENT. It is a refused FETCHER.
//
// This check exists because a repealed section keeps being cited: NYC's ZR
// 23-662 returned 404 for months while nine height values pointed at it. A
// 404 says the document moved or was withdrawn. A 401/403/429 says the
// publisher declined to serve US — the document's state is simply unknown,
// and reporting it as DEAD makes the check say something it did not measure.
//
// Measured 2026-08-15: eleven cited URLs returned 403 — city.milwaukee.gov,
// code.mecknc.gov, four phoenix.municipal.codes pages, columbus.gov — and all
// eleven still returned 403 under a full browser user-agent, so it is IP- or
// challenge-based blocking rather than decay. The run was RED on all eleven,
// which makes the whole result unreadable: a check that is red for a reason
// unrelated to citation health is one that gets ignored, and then the real
// 404 arrives and nobody looks.
//
// So: 404/410 and the other 4xx/5xx are DEAD; 401/403/429 are BLOCKED, which
// is reported loudly and separately and does NOT fail the run. A blocked URL
// is unverified, not verified — it must never be counted as live either.
export const BLOCKED_STATUS = new Set([401, 403, 429])
export const isBlocked = (s: number | null) => s != null && BLOCKED_STATUS.has(s)
export const isDead = (s: number | null) => s != null && s >= 400 && !BLOCKED_STATUS.has(s)

async function main() {
  const files = collectCoverage()
  const cites = distinctCitations(files)
  const rows: { c: Citation; status: number | null; note: string }[] = []
  for (const c of cites) {
    const r = await probe(c.url)
    rows.push({ c, ...r })
  }


  // A `known-dead` URL that resolves again is a stale record, not a pass.
  const resurrected = rows.filter((r) => r.c.knownDead && r.status != null && !isDead(r.status))
  const dead = rows.filter((r) => !r.c.knownDead && isDead(r.status))
  const blocked = rows.filter((r) => !r.c.knownDead && isBlocked(r.status))
  const unreachable = rows.filter((r) => r.status == null)
  // A blocked URL is NOT ok. It is excluded from both sides so the two counts
  // never add up to a claim nobody measured.
  const ok = rows.filter((r) => r.status != null && !isDead(r.status) && !isBlocked(r.status) && !r.c.knownDead)
  const recorded = rows.filter((r) => r.c.knownDead && isDead(r.status))

  for (const d of dead) console.log(`DEAD  ${d.status}  ${d.c.url}\n        ${d.c.file}:${d.c.line}`)
  for (const b of blocked)
    console.log(
      `BLOCKED ${b.status}  ${b.c.url}\n        ${b.c.file}:${b.c.line} — the publisher refused this fetcher, so the document's state is UNKNOWN (not verified, not dead)`,
    )
  for (const u of unreachable) console.log(`UNREACHABLE   ${u.c.url}  (${u.note})`)
  for (const r of resurrected)
    console.log(
      `RESURRECTED ${r.status}  ${r.c.url}\n        ${r.c.file}:${r.c.line} — recorded as known-dead but it resolves; the record is stale`,
    )
  console.log(
    `\n${ok.length} live · ${dead.length} dead · ${blocked.length} blocked (state unknown) · ${recorded.length} recorded known-dead · ${resurrected.length} resurrected · ${unreachable.length} unreachable · ${cites.length} cited URLs`,
  )
  console.log(formatCoverage(files))

  const verdict = overallVerdict(files, dead.length + resurrected.length)
  const uncheckedCount = files.filter((f) => verdictFor(f) === 'unchecked').length

  if (process.argv.includes('--write')) {
    const stamp = new Date().toISOString().slice(0, 10)
    const uncheckedRows = files
      .filter((f) => verdictFor(f) === 'unchecked')
      .sort((a, b) => b.unverifiable.length - a.unverifiable.length)
    writeFileSync(
      join(ROOT, 'docs/CITATIONS.md'),
      `# Cited sources — liveness check

**GENERATED.** \`npx vite-node scripts/check-citations.ts --write\`

Every URL this repo cites **in a comment**, fetched on the date below. A citation
is a claim about the current state of an external document, and it decays: NYC's
module cited ZR 23-662 for nine height values after City of Yes repealed that
section on 2024-12-05, and the URL had been returning 404 ever since.

**This check catches REPEALED and MOVED, not AMENDED.** A section edited in place
still returns 200 while the text underneath changes. A green run means the
documents we cite still exist — never that the numbers we cite are current.

**And it only ever sees URLs.** Section-style citations (\`§ 143.0210\`,
\`SDMC § 143.0212\`, \`11-C DCMR § 302\`) are counted below and checked by nobody but
a human reading the code text. The coverage table is the tool's own scorecard, not
the repo's: a file listed as UNCHECKED is one this script verified NOTHING in.

## Checked ${stamp}

| Status | URL | Cited at |
|---|---|---|
${rows
  .map(
    (r) =>
      `| ${r.status == null ? '⚠️ unreachable' : r.c.knownDead ? (isDead(r.status) ? `📓 recorded ${r.status}` : `❗ resurrected ${r.status}`) : isDead(r.status) ? `❌ ${r.status}` : `✅ ${r.status}`} | ${r.c.url} | \`${r.c.file}:${r.c.line}\` |`,
  )
  .join('\n')}

**${ok.length} live · ${dead.length} dead · ${unreachable.length} unreachable. Verdict: ${verdict}.**

Unreachable is NOT a failure: an offline machine or a rate-limited host must not
be indistinguishable from a repealed statute. Only a definite 4xx/5xx fails.

## Coverage — ${uncheckedRows.length} files this tool checked nothing in

| File | Checkable URLs | Section citations (unverifiable here) |
|---|---|---|
${uncheckedRows.map((f) => `| \`${f.file}\` | 0 | ${f.unverifiable.length} |`).join('\n')}
`,
    )
    console.log('wrote docs/CITATIONS.md')
  }

  if (verdict === 'FAIL') {
    console.log('\nFAIL — a cited document no longer resolves. Re-read the source and re-cite;')
    console.log('do NOT just swap the link. If a section was repealed, the VALUES sourced to it')
    console.log('are suspect too — that is exactly how nine stale NYC heights survived.')
    process.exit(1)
  }
  if (verdict === 'PARTIAL') {
    console.log(
      `\nPARTIAL — every cited URL resolves, but ${uncheckedCount} files cite sources this tool cannot`,
    )
    console.log('fetch and it verified none of them. This is NOT a pass. Do not read it as one.')
    if (process.argv.includes('--strict')) process.exit(1)
    return
  }
  console.log('\nPASS — every citing file yielded at least one checkable URL, and all resolve.')
}

// Importing this module (the colocated test does) must not fire the network
// probes. The guard FAILS OPEN — it runs unless it can see it is under Vitest —
// because the alternative, an is-this-the-entry-point check, silently does
// nothing under any runner whose `argv[1]` it fails to recognise. A checker that
// no-ops and exits 0 is the precise failure this file exists to prevent, so the
// guard must not be able to cause it.
if (process.env.VITEST == null) void main()
