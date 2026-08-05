// Fetch every URL this repo CITES and fail on any that no longer resolves.
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
// WHAT IT CANNOT DO — stated plainly so the green result is not over-read. It
// catches REPEALED and MOVED. It does NOT catch a section amended in place: the
// URL still resolves 200 while the text underneath changed. That is the more
// common case and it still needs a human reading the source. A pass here means
// "the documents we cite still exist", never "the numbers we cite are current".
//
//   npx vite-node scripts/check-citations.ts           # check, exit 1 on failure
//   npx vite-node scripts/check-citations.ts --write   # also refresh the manifest

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['netlify', 'src', 'scripts']

/** A URL in a COMMENT is a citation — a claim about a source. A URL in code is
 *  an endpoint we call, exercised by the live probes instead. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/
const URL_RE = /https?:\/\/[^\s)'"`,;<>\]]+/g

interface Citation {
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

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

function collect(): Citation[] {
  const seen = new Map<string, Citation>()
  for (const dir of DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!COMMENT_LINE.test(line)) return
        for (const raw of line.match(URL_RE) ?? []) {
          // Trim trailing punctuation that belongs to the prose, not the URL.
          const url = raw.replace(/[.,;:)]+$/, '')
          if (seen.has(url)) continue
          seen.set(url, { url, file: relative(ROOT, file), line: i + 1, knownDead: /known-dead/.test(line) })
        }
      })
    }
  }
  return [...seen.values()].sort((a, b) => a.url.localeCompare(b.url))
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

;(async () => {
  const cites = collect()
  const rows: { c: Citation; status: number | null; note: string }[] = []
  for (const c of cites) {
    const r = await probe(c.url)
    rows.push({ c, ...r })
  }

  const isDead = (s: number | null) => s != null && s >= 400
  // A `known-dead` URL that resolves again is a stale record, not a pass.
  const resurrected = rows.filter((r) => r.c.knownDead && r.status != null && !isDead(r.status))
  const dead = rows.filter((r) => !r.c.knownDead && isDead(r.status))
  const unreachable = rows.filter((r) => r.status == null)
  const ok = rows.filter((r) => r.status != null && !isDead(r.status) && !r.c.knownDead)
  const recorded = rows.filter((r) => r.c.knownDead && isDead(r.status))

  for (const d of dead) console.log(`DEAD  ${d.status}  ${d.c.url}\n        ${d.c.file}:${d.c.line}`)
  for (const u of unreachable) console.log(`UNREACHABLE   ${u.c.url}  (${u.note})`)
  for (const r of resurrected) console.log(`RESURRECTED ${r.status}  ${r.c.url}\n        ${r.c.file}:${r.c.line} — recorded as known-dead but it resolves; the record is stale`)
  console.log(`\n${ok.length} live · ${dead.length} dead · ${recorded.length} recorded known-dead · ${resurrected.length} resurrected · ${unreachable.length} unreachable · ${cites.length} cited URLs`)

  if (process.argv.includes('--write')) {
    const stamp = new Date().toISOString().slice(0, 10)
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

## Checked ${stamp}

| Status | URL | Cited at |
|---|---|---|
${rows
  .map(
    (r) =>
      `| ${r.status == null ? '⚠️ unreachable' : r.c.knownDead ? (isDead(r.status) ? `📓 recorded ${r.status}` : `❗ resurrected ${r.status}`) : isDead(r.status) ? `❌ ${r.status}` : `✅ ${r.status}`} | ${r.c.url} | \`${r.c.file}:${r.c.line}\` |`,
  )
  .join('\n')}

**${ok.length} live · ${dead.length} dead · ${unreachable.length} unreachable.**

Unreachable is NOT a failure: an offline machine or a rate-limited host must not
be indistinguishable from a repealed statute. Only a definite 4xx/5xx fails.
`,
    )
    console.log('wrote docs/CITATIONS.md')
  }

  if (dead.length || resurrected.length) {
    console.log('\nFAIL — a cited document no longer resolves. Re-read the source and re-cite;')
    console.log('do NOT just swap the link. If a section was repealed, the VALUES sourced to it')
    console.log('are suspect too — that is exactly how nine stale NYC heights survived.')
    process.exit(1)
  }
})()
