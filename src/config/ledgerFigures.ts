// Drift guard for figures quoted in docs/VERIFICATION-LEDGER.md.
//
// ─── The problem this exists for ────────────────────────────────────────────
// `coverage.ts` and `CITIES_WITH_MEASURED_PERMITS` are anchored to
// reliefStats.json / permitStats.json by a test. Ledger prose was not, and
// three entries went stale within hours of being written — most recently a
// survey entry quoting Charlotte at "92.4% over 157 decided cases" against a
// build that published 92.3% / n=155. Nothing surfaced the contradiction; a
// human happened to re-read.
//
// ─── The hard part: a ledger is SUPPOSED to contain stale figures ───────────
// It is a dated historical record. "NYC published 8.3 mo / p80 17.0 / n=4,403"
// is CORRECT HISTORY. So the guard cannot be "no figure disagrees with the
// artifact"; it has to separate a figure presented as CURRENT from one recorded
// as HISTORY. Four decisions do that, in order of how much work each does:
//
//   1. SCOPE. Only cities currently IN the artifacts are in scope (5 relief, 6
//      permits). A figure for a withdrawn city — NYC/Seattle permits, LA,
//      Chicago, San Diego — is necessarily historical and is never examined.
//
//   2. WHAT COUNTS AS A CITATION. Only a *published-figure tuple*: a rate or a
//      median bound to its sample size, close enough together to be one claim.
//      This is the load-bearing narrowing. The ledger is full of loose numbers
//      about live cities — "shown 2.2 months against a measured 9.8",
//      "Philadelphia 2.9", "median 11.1 mo / p80 17.4" for a Shell subgroup —
//      and none of them assert a published figure. Requiring the `n` excludes
//      every one of them without a single exemption.
//
//   3. ATTRIBUTION. A citation belongs to the last city named at or before it
//      within its own section (the text since the nearest heading, plus that
//      heading and the enclosing `##`). Section-scoped, not entry-scoped, on
//      purpose: "The brief handed the build agent the survey's figures: 92.4%
//      over 157 cases" sits in its own `###` and names no city, so it is not
//      attributed to Charlotte and not checked — which is right, since it
//      quotes a brief rather than the artifact.
//
//   4. HISTORY MARKING. Reusing the convention the ledger already writes rather
//      than inventing one:
//        · a `> ⚠️ **SUPERSEDED/WITHDRAWN/RETRACTED …**` blockquote pointer
//          adjacent to the paragraph (the ledger puts it immediately after);
//        · the same pointer as the block itself;
//        · `~~strikethrough~~`;
//        · an in-block restatement — "**Restated: 97.3% (n=406…)**, replacing
//          97.6% (n=289)" — which requires the block to ALSO carry a citation
//          that matches the artifact exactly. That extra requirement is rule 17
//          in mechanical form: quoting a superseded figure is fine as long as
//          the correction is where the reader lands. It is not a free pass —
//          mutating the *current* figure in such a block removes the matching
//          citation and the block stops qualifying.
//
// Everything unmarked and attributable is treated as CURRENT and must agree.
//
// The module is deliberately pure — it takes the markdown and the two artifacts
// as arguments so the test can exercise it on synthetic input as well as on the
// real file (rule 11: exercise the real entry point, but be able to perturb it).

export type CitationKind = 'relief' | 'permits'

export type PermitTier = 'aggregate' | 'single' | 'multi' | 'apartment'

export type LedgerCitation = {
  /** 1-indexed line in the ledger where the quoted figure sits. */
  line: number
  city: string
  kind: CitationKind
  /** permits only */
  tier?: PermitTier
  /** relief only: the quoted grant rate as a percentage, e.g. 92.3 */
  ratePct?: number
  /** permits only */
  medianMonths?: number
  /** permits only */
  p80Months?: number
  /** the quoted sample size */
  n: number
  /** the sentence/row the figure was read out of, for the failure message */
  quote: string
  /** true when the ledger marks this as superseded/withdrawn/restated history */
  history: boolean
  /** which signal marked it, for the inventory test */
  historyBecause?: string
}

export type LedgerDrift = {
  citation: LedgerCitation
  /** human-readable "quoted X, artifact Y" */
  detail: string
}

// ─── Artifact shapes (structurally typed against the committed JSON) ─────────

type ReliefEntry = { variance: { grantRate: number; n: number } }
type PermitFigure = { medianMonths: number; p80Months: number; n: number }
type PermitEntry = {
  newConstruction: PermitFigure
  byTier?: Partial<Record<Exclude<PermitTier, 'aggregate'>, PermitFigure>>
}

export type ReliefStats = Record<string, ReliefEntry>
export type PermitStats = Record<string, PermitEntry>

// ─── City tokens ────────────────────────────────────────────────────────────
// Only the eleven cities that can be in scope. `\bDC\b` does not match DCGIS
// (G is a word character, so the trailing boundary fails).
const CITY_TOKENS: Record<string, RegExp> = {
  austin: /\bAustin\b/gi,
  boston: /\bBoston\b/gi,
  charlotte: /\bCharlotte\b/gi,
  dc: /\bDC\b|\bWashington,? D\.?C\.?\b/g,
  denver: /\bDenver\b/gi,
  miami: /\bMiami\b/gi,
  nashville: /\bNashville\b/gi,
  nyc: /\bNYC\b|\bNew York City\b/gi,
  philadelphia: /\bPhiladelphia\b/gi,
  raleigh: /\bRaleigh\b/gi,
  sf: /\bSF\b|\bSan Francisco\b/gi,
}

// ─── History markers, as the ledger already writes them ─────────────────────
const POINTER_WORDS = /\b(SUPERSEDED|WITHDRAWN|RETRACTED|SUPERSEDES|RESTATED)\b/i
const POINTER_SIGIL = /⚠️|✅/
const RESTATEMENT_WORDS = /\b(restated|replacing|superseded|withdrawn|retracted)\b/i

// ─── Block / heading model ──────────────────────────────────────────────────

type Block = {
  start: number // 1-indexed line of the block's first line
  lines: string[]
  text: string // lines joined with a space (the ledger hard-wraps prose)
  /** offset of each line's start within `text`, for line attribution */
  lineOffsets: number[]
  isQuote: boolean
  /** attribution scope: enclosing `##` heading + nearest heading + section text so far */
  scopePrefix: string
  h2: string
}

function splitBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let h2 = ''
  let scopeText = '' // text accumulated since the nearest heading
  let nearestHeading = ''
  let cur: { start: number; lines: string[] } | null = null

  const flush = () => {
    if (!cur) return
    const text = cur.lines.join(' ')
    const lineOffsets: number[] = []
    let off = 0
    for (const l of cur.lines) {
      lineOffsets.push(off)
      off += l.length + 1
    }
    blocks.push({
      start: cur.start,
      lines: cur.lines,
      text,
      lineOffsets,
      isQuote: cur.lines.every((l) => l.trimStart().startsWith('>')),
      scopePrefix: `${h2}\n${nearestHeading}\n${scopeText}`,
      h2,
    })
    scopeText += ' ' + text
    cur = null
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const heading = /^(#{1,6})\s+(.*)$/.exec(raw)
    if (heading) {
      flush()
      const level = heading[1].length
      if (level <= 2) h2 = heading[2]
      if (level >= 2) {
        nearestHeading = heading[2]
        scopeText = ''
      }
      continue
    }
    if (raw.trim() === '') {
      flush()
      continue
    }
    if (!cur) cur = { start: i + 1, lines: [] }
    cur.lines.push(raw)
  }
  flush()
  return blocks
}

/** 1-indexed ledger line for a character offset inside a block's joined text. */
function lineAt(block: Block, offset: number): number {
  let idx = 0
  for (let i = 0; i < block.lineOffsets.length; i++) {
    if (block.lineOffsets[i] <= offset) idx = i
    else break
  }
  return block.start + idx
}

/**
 * The last in-scope city named at or before `offset`. Scope is the block's own
 * text up to the figure, preceded by the section text, the nearest heading and
 * the enclosing `##` — never the whole entry, so a later `###` cannot inherit an
 * earlier paragraph's city.
 */
function attribute(block: Block, offset: number, eligible: readonly string[]): string | null {
  const haystack = `${block.scopePrefix}\n${block.text.slice(0, offset)}`
  let best: { city: string; at: number } | null = null
  for (const city of eligible) {
    const re = new RegExp(CITY_TOKENS[city].source, CITY_TOKENS[city].flags)
    let m: RegExpExecArray | null
    let last = -1
    while ((m = re.exec(haystack)) !== null) last = m.index
    if (last >= 0 && (!best || last > best.at)) best = { city, at: last }
  }
  return best ? best.city : null
}

// ─── Citation extraction ────────────────────────────────────────────────────

// A rate bound to its sample size. The gap may not cross a sentence boundary
// (`. `, `; `, `: `) and may not contain another `%`, so "…of ~96.9%. It
// reproduced neither exactly and said so: n=155…" does not bind.
const RELIEF_CITATION =
  /(\d{1,3}(?:\.\d{1,2})?)\s?%([^%]{0,60}?)(?:\bover\s+(?:n\s*=\s*)?([\d,]+)\s+(?:decided\s+)?cases?|\bn\s*=\s*([\d,]+))/g

// "8.3 mo / p80 17.0 / n=4,403" and "median 8.3, p80 17.0, n 4,403".
const PERMIT_SLASH =
  /(\d{1,3}(?:\.\d)?)\s*(?:mo\b|months?\b)?\s*\/\s*(?:p80\s+)?(\d{1,3}(?:\.\d)?)\s*\/\s*n\s*[= ]\s*([\d,]+)/g
const PERMIT_PROSE =
  /median\s+(\d{1,3}(?:\.\d)?),\s*p80\s+(\d{1,3}(?:\.\d)?),\s*n\s*=?\s*([\d,]+)/g

const SENTENCE_BREAK = /[.;:]\s/

const num = (s: string) => Number(s.replace(/,/g, ''))
const stripEmphasis = (s: string) => s.replace(/[*`~_]/g, '').trim()

function sentenceAround(text: string, offset: number): string {
  const from = Math.max(0, text.lastIndexOf('. ', offset) + 1)
  const dot = text.indexOf('. ', offset)
  const to = dot === -1 ? text.length : dot + 1
  return text.slice(from, to).trim()
}

function markedHistory(blocks: Block[], i: number): string | null {
  const b = blocks[i]
  const isPointer = (x: Block | undefined) =>
    !!x && x.isQuote && POINTER_SIGIL.test(x.text) && POINTER_WORDS.test(x.text)
  if (isPointer(b)) return 'is a supersede/withdraw pointer blockquote'
  if (isPointer(blocks[i + 1])) return 'the next block is a supersede/withdraw pointer'
  if (isPointer(blocks[i - 1])) return 'the previous block is a supersede/withdraw pointer'
  return null
}

/** Every published-figure citation the ledger makes about a live city. */
export function extractCitations(
  markdown: string,
  relief: ReliefStats,
  permits: PermitStats,
): LedgerCitation[] {
  const reliefCities = Object.keys(relief)
  const permitCities = Object.keys(permits)
  const blocks = splitBlocks(markdown)
  const out: LedgerCitation[] = []

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]
    const pointer = markedHistory(blocks, bi)
    const found: LedgerCitation[] = []

    // ── relief: a percentage bound to a sample size ──
    RELIEF_CITATION.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RELIEF_CITATION.exec(b.text)) !== null) {
      const gap = m[2]
      if (SENTENCE_BREAK.test(gap)) continue
      const city = attribute(b, m.index, reliefCities)
      if (!city) continue
      const struck = /~~[^~]*$/.test(b.text.slice(0, m.index)) || false
      found.push({
        line: lineAt(b, m.index),
        city,
        kind: 'relief',
        ratePct: Number(m[1]),
        n: num(m[3] ?? m[4]),
        quote: sentenceAround(b.text, m.index),
        history: !!pointer || struck,
        historyBecause: pointer ?? (struck ? 'struck through' : undefined),
      })
    }

    // ── permits: median / p80 / n stated together ──
    for (const re of [PERMIT_SLASH, PERMIT_PROSE]) {
      re.lastIndex = 0
      while ((m = re.exec(b.text)) !== null) {
        const city = attribute(b, m.index, permitCities)
        if (!city) continue
        found.push({
          line: lineAt(b, m.index),
          city,
          kind: 'permits',
          tier: 'aggregate',
          medianMonths: Number(m[1]),
          p80Months: Number(m[2]),
          n: num(m[3]),
          quote: sentenceAround(b.text, m.index),
          history: !!pointer,
          historyBecause: pointer ?? undefined,
        })
      }
    }

    // ── permits: a `| tier | median | p80 | n |` table ──
    found.push(...tableCitations(b, permitCities, pointer))

    // ── in-block restatement: "Restated: <current>, replacing <old>" ──
    // Only counts when the block also carries a citation that matches the
    // artifact for the same city — the correction has to be present, not merely
    // the vocabulary.
    if (RESTATEMENT_WORDS.test(b.text)) {
      const matching = new Set(
        found.filter((c) => driftDetail(c, relief, permits) === null).map((c) => c.city),
      )
      for (const c of found) {
        if (!c.history && matching.has(c.city) && driftDetail(c, relief, permits) !== null) {
          c.history = true
          c.historyBecause = 'restated in-block alongside the current figure'
        }
      }
    }

    out.push(...found)
  }
  return out
}

function tableCitations(b: Block, permitCities: readonly string[], pointer: string | null): LedgerCitation[] {
  if (b.lines.length < 3 || !b.lines[0].trim().startsWith('|')) return []
  const header = b.lines[0].split('|').map((c) => stripEmphasis(c).toLowerCase())
  const ti = header.findIndex((c) => c === 'tier')
  const mi = header.findIndex((c) => c === 'median')
  const pi = header.findIndex((c) => c === 'p80')
  const ni = header.findIndex((c) => c === 'n')
  if (ti < 0 || mi < 0 || pi < 0 || ni < 0) return []
  const city = attribute(b, 0, permitCities)
  if (!city) return []

  const out: LedgerCitation[] = []
  for (let r = 2; r < b.lines.length; r++) {
    const cells = b.lines[r].split('|').map(stripEmphasis)
    if (cells.length <= Math.max(ti, mi, pi, ni)) continue
    const tier = cells[ti].toLowerCase()
    if (!['single', 'multi', 'apartment', 'aggregate'].includes(tier)) continue
    const median = Number(/(\d+(?:\.\d+)?)/.exec(cells[mi])?.[1])
    const p80 = Number(/(\d+(?:\.\d+)?)/.exec(cells[pi])?.[1])
    const n = num(/([\d,]+)/.exec(cells[ni])?.[1] ?? '')
    if (!Number.isFinite(median) || !Number.isFinite(p80) || !Number.isFinite(n)) continue
    out.push({
      line: b.start + r,
      city,
      kind: 'permits',
      tier: tier as PermitTier,
      medianMonths: median,
      p80Months: p80,
      n,
      quote: b.lines[r].trim(),
      history: !!pointer,
      historyBecause: pointer ?? undefined,
    })
  }
  return out
}

// ─── Comparison ─────────────────────────────────────────────────────────────

// The artifacts carry three significant figures, so a quote is compared at one
// decimal place — "97.29%" reads as agreement with a stored 0.973, and 92.4 vs
// 92.3 does not.
const at1dp = (x: number) => Math.round(x * 10) / 10

function driftDetail(
  c: LedgerCitation,
  relief: ReliefStats,
  permits: PermitStats,
): string | null {
  const bad: string[] = []
  if (c.kind === 'relief') {
    const a = relief[c.city]?.variance
    if (!a) return null
    if (at1dp(c.ratePct!) !== at1dp(a.grantRate * 100))
      bad.push(`rate ${c.ratePct}% vs artifact ${at1dp(a.grantRate * 100)}%`)
    if (c.n !== a.n) bad.push(`n=${c.n} vs artifact n=${a.n}`)
  } else {
    const e = permits[c.city]
    const a = c.tier === 'aggregate' || !c.tier ? e?.newConstruction : e?.byTier?.[c.tier]
    if (!a) return null
    if (at1dp(c.medianMonths!) !== at1dp(a.medianMonths))
      bad.push(`median ${c.medianMonths} vs artifact ${a.medianMonths}`)
    if (at1dp(c.p80Months!) !== at1dp(a.p80Months))
      bad.push(`p80 ${c.p80Months} vs artifact ${a.p80Months}`)
    if (c.n !== a.n) bad.push(`n=${c.n} vs artifact n=${a.n}`)
  }
  return bad.length ? bad.join('; ') : null
}

/**
 * Every citation presented as CURRENT that disagrees with the artifact.
 * Collect-all, so the failure output reads as systemic rather than as one typo.
 */
export function findLedgerDrift(
  markdown: string,
  relief: ReliefStats,
  permits: PermitStats,
): LedgerDrift[] {
  const out: LedgerDrift[] = []
  for (const c of extractCitations(markdown, relief, permits)) {
    if (c.history) continue
    const detail = driftDetail(c, relief, permits)
    if (detail) out.push({ citation: c, detail })
  }
  return out
}

export function formatDrift(d: LedgerDrift[]): string {
  return d
    .map(
      (x) =>
        `  docs/VERIFICATION-LEDGER.md:${x.citation.line} — ${x.citation.city}/${x.citation.kind}` +
        `${x.citation.tier && x.citation.tier !== 'aggregate' ? `/${x.citation.tier}` : ''}: ${x.detail}\n` +
        `    quoted: "${x.citation.quote}"`,
    )
    .join('\n')
}
