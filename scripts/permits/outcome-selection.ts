// Guard against a permit script asking a feed a question that presupposes its
// own answer.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
// A permit pipeline measures how long an application takes to become a permit.
// If the pull that defines the cohort carries `issued_date IS NOT NULL`, the
// server returns only applications that issued — so "every application in this
// city issues" and "we only asked about applications that issued" come back as
// THE SAME ROW SET with opposite meanings, and nothing downstream can tell them
// apart. There is no denominator, therefore no gate. Ledger rule 11: measure the
// pipeline, not your probe.
//
// It has cost this repo five cities. `sf.mjs` reported n=132 issued permits
// with no idea they were 37.61% of the filings. `la.mjs` reported 100% observed
// off an issued-only feed and read it as "LA issues everything". `chicago.mjs`
// kept the predicate through the very change that added its halt narrative —
// the diff wrote the story and left the WHERE clause alone (removed 2026-08-09).
// `nyc.mjs` shipped a p80 the predicate had blinded it to, with the disqualifier
// recorded in its own header. And `seattle.mjs` was withdrawn 2026-08-09 by THIS
// FILE's own rule: the registry demands a measured share on every known-defect
// exemption, and measuring Seattle's (74.71% observed) showed its published p80
// was unidentified. The guard built to stop city 24 caught city 5.
//
// ── WHY A TEST AND NOT A REVIEW ─────────────────────────────────────────────
// The predicate spreads by CLONE. There is no shared query builder in this
// directory: `quantile()` is byte-identical across every script in two variants,
// and the predicate had two verbatim spellings tracking the same split. Adding a
// city means copying the nearest script, so city 24 inherits whatever city 23
// carried. And it is invisible to everything else — a runtime template literal
// inside `.mjs`, so `tsc` never sees it, the linter has no opinion on the
// contents of a string, and no test read the query at all.
//
// ── WHAT THIS DETECTOR DOES AND DOES NOT SEE (read before trusting it) ──────
// It finds `<token> IS NOT NULL` where the token names issuance, in CODE (both
// comment forms are stripped first — four scripts quote the predicate inside
// their own retraction notes and must not be flagged for it). The token is
// matched on `/issu/i` against BOTH its identifier and, when it is a `const`
// declared in the same file, the string literal it resolves to. That second step
// is the point: a test matching only today's two literals is satisfied the moment
// somebody renames the constant.
//
// It does NOT see:
//   · selection by comparison rather than by null — `permitissuedate >= SINCE`
//     defines a cohort by the outcome just as surely, and `philadelphia.mjs`
//     does exactly that. A null-predicate check cannot find it.
//   · selection by status — `status = 'Issued'`, `LIKE '%ISSUED%'`.
//   · a field naming issuance in words this regex does not know: a rename to
//     `GRANTED_DATE` or `PERMIT_LIVE_ON` resolving to a literal without "issu"
//     passes clean.
//   · an outcome-selecting filter applied client-side after the pull.
// Those are gaps, not answers (rule 5). The instrument's reach is stated here so
// that a green run is read as "no null-predicate carrier", never as "no city
// selects on the outcome".
//
// A trailing `// ...` comment on a line of code is NOT stripped, so a comment
// about the predicate sharing a line with code will be flagged. That direction
// is deliberate: this guard errs toward a false alarm, never toward silence. Put
// the note on its own line.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** One `<issuance token> IS NOT NULL` occurrence in a script's executable text. */
export type Finding = {
  /** Basename, e.g. `seattle.mjs`. */
  file: string
  /** 1-indexed line in the ORIGINAL source, comment-stripping and glue notwithstanding. */
  line: number
  /** The identifier as written, e.g. `ISSUED_DATE_FIELD` or `permitissuedate`. */
  token: string
  /** The literal it resolves to when it is a same-file `const`, else null. */
  resolved: string | null
  /** Trimmed source line, for the report. */
  excerpt: string
}

/**
 * Why a file is allowed to keep the predicate.
 *
 * `issued-only-feed` — the feed contains no un-issued rows, so the limb removes
 *   nothing and cannot be selecting on anything. THIS MUST BE MEASURED, not
 *   inferred from a dataset title: run the script's own cohort filter with and
 *   without the limb and compare the counts (rule 2 — perturbation beats a sum).
 *
 * `unreachable` — the query is in code that cannot execute, because the script
 *   halts upstream on a missing application-date column. The exemption lapses the
 *   day that halt does.
 *
 * `known-defect` — the limb IS selecting on the outcome, the size of the
 *   selection has been measured, and removing it needs a gate and a product
 *   decision rather than an edit. NOT a clearance. Recorded here so the guard can
 *   protect the other files instead of being deleted for being red.
 */
export type ExemptionBasis = 'issued-only-feed' | 'unreachable' | 'known-defect'

export type Exemption = {
  basis: ExemptionBasis
  /** A written reason. The test enforces length, a date, and — for `known-defect` — a measured share. */
  reason: string
}

/**
 * The opt-out. A file listed here may carry the predicate; a file not listed may
 * not. Adding an entry is a deliberate, reviewable act with a reason attached —
 * which is the whole mechanism: an unexplained new carrier fails, and so does an
 * entry whose file no longer carries anything, so removing a predicate forces
 * removing its exemption rather than leaving a licence lying around.
 */
export const OUTCOME_SELECTION_EXEMPTIONS: Readonly<Record<string, Exemption>> = {
  'austin.mjs': {
    basis: 'issued-only-feed',
    reason:
      "Socrata 3syk-w9eu is titled 'Issued Construction Permits' — but the title is not the evidence. " +
      "Measured 2026-08-09 by running austin.mjs's own cohort filter (permittype='BP', work_class IN " +
      "('New','Shell'), applieddate >= 2022-01-01) both ways: 18,270 rows without the limb, 18,270 with " +
      'it. It hides 0. Feed-wide, issue_date IS NULL returns 0 of 2,369,500 rows. The predicate is a ' +
      'no-op, so it cannot be selecting on anything. (Server-side counts; austin.mjs then filters to ' +
      'building permit_class client-side, which is why the published n is 11,534.)',
  },
  'denver.mjs': {
    basis: 'issued-only-feed',
    reason:
      'Both denvergov ArcGIS layers, measured 2026-08-09 with denver.mjs\'s own CLASS filters and ' +
      'DATE_RECEIVED >= 2022-01-01, run with and without the limb: residential 6,293 vs 6,293, ' +
      'commercial 642 vs 642 — 0 hidden on either side. Feed-wide DATE_ISSUED IS NULL is 0 of 79,035 ' +
      '(residential layer 316) and 0 of 42,901 (commercial layer 317). No un-issued row exists to be ' +
      'selected away.',
  },
  'miami.mjs': {
    basis: 'issued-only-feed',
    reason:
      "Building_Permits_Since_2014 layer 0, measured 2026-08-09 with miami.mjs's own filter " +
      "(ScopeofWork='NEW CONSTRUCTION', PermitNumber LIKE '%001B001', PlanCreatedDate >= 2022-01-01): " +
      '2,725 rows with the limb and 2,725 without, 0 hidden. Feed-wide IssuedDate IS NULL is 39 of ' +
      '229,022 (0.02%) and none fall in the cohort. This matches what README.md already records — ' +
      'Miami is issued-only, which is why its median is published as a FLOOR.',
  },
  'philadelphia.mjs': {
    basis: 'issued-only-feed',
    reason:
      'The phl.carto `permits` table is issued permits, and the limb is redundant twice over: the ' +
      "script's own window is `permitissuedate >= SINCE`, and a `>=` comparison already excludes " +
      'nulls. Measured 2026-08-09: 4,252 rows with the limb and 4,252 without, 0 hidden; across the ' +
      'whole type filter only 4 of 11,186 rows carry a null permitissuedate. ⚠️ SEPARATE ISSUE, and ' +
      'one this detector cannot see: that WINDOW is itself issuance-side, i.e. a cohort defined by the ' +
      'outcome. philadelphia.mjs argues it is a valid superset of `applied >= SINCE`. That argument is ' +
      'not re-checked here and this exemption does not cover it.',
  },
  'boston.mjs': {
    basis: 'unreachable',
    reason:
      'The SQL holding the limb never runs. applicationDateField() throws a ComputabilityHalt first — ' +
      'Boston publishes no application/filed date at all (25 columns; the only other timestamp is ' +
      'expiration_date, derived from issuance). Verified 2026-08-09 by running the script: it prints ' +
      'the NOT COMPUTABLE message, exits 0, and leaves permitStats.json byte-identical. If Boston ever ' +
      'publishes an application date this query becomes live and the limb must go BEFORE it does — ' +
      'ledger rule 18: code that did not run is not code that works.',
  },
  'dc.mjs': {
    basis: 'unreachable',
    reason:
      'The ArcGIS where-clause holding the limb never runs. dc.mjs returns at its `if (!appliedField)` ' +
      'guard because the DCRA feed carries ISSUE_DATE plus only the GIS row-edit stamps CREATED_DATE / ' +
      'LAST_EDITED_DATE, which are a single ETL load timestamp. Verified 2026-08-09 by running the ' +
      'script: it prints the gap, exits 0, permitStats.json byte-identical. The exemption lapses the ' +
      'day DC exposes a genuine submitted date and APPLIED_DATE_CANDIDATES starts resolving.',
  },
  'minneapolis.mjs': {
    basis: 'unreachable',
    reason:
      'Same shape as dc.mjs. The where-clause holding the limb never runs: CCS_Permits carries ' +
      'issueDate and a project completeDate that falls AFTER issuance, and no application date, so ' +
      'minneapolis.mjs returns at its `if (!appliedField)` guard. Verified 2026-08-09 by running the ' +
      'script: it prints the gap, exits 0, permitStats.json byte-identical. The exemption lapses the ' +
      'day Minneapolis exposes a genuine submitted date.',
  },
  // ⚠️ seattle.mjs had a `known-defect` entry here from the day this registry was
  // written to 2026-08-09, when the work order it named was executed: the limb is
  // gone from `pull()`, a refuseUnlessQuantilesAreObserved() gate recomputes the
  // observed share on every run, and the published 5.7 / p80 10.0 / n=4,996 was
  // withdrawn from permitStats.json and CITIES_WITH_MEASURED_PERMITS. The entry
  // is deleted because the staleness rule this file enforces demands it — the
  // predicate is gone, so a licence to carry it must not outlive it. The
  // measurement that entry carried (6,980 in-window applications, 5,215 with the
  // limb, observed share 74.71%, p80 not identified) is preserved in
  // seattle.mjs's halt section and docs/VERIFICATION-LEDGER.md. Note what the
  // sequence proved: requiring a measured share on every known-defect exemption
  // is what surfaced the withdrawal — the guard built to stop city 24 caught
  // city 5.
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const WHOLE_LINE_COMMENT = /^\s*\/\/.*$/

/**
 * Blank out comments while preserving every character position, so a match index
 * into the result is still a valid index into the original source. Newlines
 * survive; everything else becomes a space.
 */
export function stripComments(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  const noBlocks = source.replace(BLOCK_COMMENT, blank)
  return noBlocks
    .split('\n')
    .map((line) => (WHOLE_LINE_COMMENT.test(line) ? ' '.repeat(line.length) : line))
    .join('\n')
}

/**
 * These WHERE clauses are built by concatenating adjacent string literals across
 * lines, so the predicate is routinely split as ``…FIELD} ` + `IS NOT NULL``.
 * Glue those seams shut before matching, keeping a map back to source offsets so
 * reported line numbers stay true.
 */
function glue(source: string): { text: string; map: number[] } {
  const stripped = stripComments(source)
  const seam = /["'`]\s*\+\s*["'`]/g
  let text = ''
  const map: number[] = []
  let last = 0
  for (const m of stripped.matchAll(seam)) {
    for (let i = last; i < (m.index ?? 0); i++) {
      text += stripped[i]
      map.push(i)
    }
    last = (m.index ?? 0) + m[0].length
  }
  for (let i = last; i < stripped.length; i++) {
    text += stripped[i]
    map.push(i)
  }
  return { text, map }
}

/** `const NAME = 'literal'` and `const NAME = OTHER`, for resolving renamed constants. */
export function constBindings(source: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:['"`]([^'"`\n]*)['"`]|([A-Za-z_$][A-Za-z0-9_$]*))/g
  for (const m of stripComments(source).matchAll(re)) out.set(m[1], m[2] ?? m[3] ?? '')
  return out
}

/** The token itself plus whatever it resolves to, following up to 4 hops. */
function chain(token: string, bindings: Map<string, string>): string[] {
  const seen = [token]
  let cur = token
  for (let i = 0; i < 4; i++) {
    const next = bindings.get(cur)
    if (next === undefined || seen.includes(next)) break
    seen.push(next)
    cur = next
  }
  return seen
}

const NAMES_ISSUANCE = /issu/i

/** Identifier immediately left of the predicate, through `}`, quotes and brackets. */
const TRAILING_IDENT = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\}?\s*["'`\]]*\s*$/

const IS_NOT_NULL = /\bIS\s+NOT\s+NULL\b/gi

/** Every outcome-selecting null predicate in one script's executable text. */
export function findOutcomeSelections(file: string, source: string): Finding[] {
  const { text, map } = glue(source)
  const bindings = constBindings(source)
  const lines = source.split('\n')
  const found: Finding[] = []

  for (const m of text.matchAll(IS_NOT_NULL)) {
    const at = m.index ?? 0
    const ident = TRAILING_IDENT.exec(text.slice(Math.max(0, at - 160), at))
    if (!ident) continue
    const token = ident[1]
    const candidates = chain(token, bindings)
    if (!candidates.some((c) => NAMES_ISSUANCE.test(c))) continue

    const srcAt = map[at] ?? 0
    const line = source.slice(0, srcAt).split('\n').length
    const resolved = candidates.length > 1 ? candidates[candidates.length - 1] : null
    found.push({ file, line, token, resolved, excerpt: (lines[line - 1] ?? '').trim() })
  }
  return found
}

/** Read the real scripts. The rule has to hold on the tree, not on a fixture (rule 11). */
export function readPermitScripts(dir: string): { file: string; source: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mjs'))
    .sort()
    .map((file) => ({ file, source: readFileSync(join(dir, file), 'utf8') }))
}

export type Audit = {
  /** Carriers with no exemption — the failure this guard exists for. */
  unexempted: Finding[]
  /** Exemptions naming a file that no longer carries anything — a licence left lying around. */
  stale: string[]
  /** Exempted carriers, for the record. */
  covered: { file: string; basis: ExemptionBasis; findings: Finding[] }[]
}

export function auditOutcomeSelection(
  files: { file: string; source: string }[],
  exemptions: Readonly<Record<string, Exemption>> = OUTCOME_SELECTION_EXEMPTIONS,
): Audit {
  const unexempted: Finding[] = []
  const covered: Audit['covered'] = []
  const carriers = new Set<string>()

  for (const { file, source } of files) {
    const findings = findOutcomeSelections(file, source)
    if (findings.length === 0) continue
    carriers.add(file)
    const ex = exemptions[file]
    if (ex) covered.push({ file, basis: ex.basis, findings })
    else unexempted.push(...findings)
  }

  const present = new Set(files.map((f) => f.file))
  const stale = Object.keys(exemptions)
    .filter((f) => !carriers.has(f))
    .map((f) => (present.has(f) ? `${f} (no longer carries it)` : `${f} (file is gone)`))
    .sort()

  return { unexempted, stale, covered }
}

/** Empty string means clean. Everything is collected first, so the report reads as systemic. */
export function formatAudit(audit: Audit): string {
  const out: string[] = []
  if (audit.unexempted.length > 0) {
    out.push(
      `${audit.unexempted.length} query/queries select on the OUTCOME they measure, with no exemption.`,
      `A cohort filtered on issuance cannot report how often issuance happens — the same rows come`,
      `back whether the city permits everything or the feed only lists permits. Remove the predicate,`,
      `or add an entry to OUTCOME_SELECTION_EXEMPTIONS in scripts/permits/outcome-selection.ts with a`,
      `written, measured reason.`,
      ``,
    )
    for (const f of audit.unexempted) {
      const via = f.resolved ? ` -> '${f.resolved}'` : ''
      out.push(`  ${f.file}:${f.line}  ${f.token}${via}`, `      ${f.excerpt}`)
    }
  }
  if (audit.stale.length > 0) {
    if (out.length > 0) out.push('')
    out.push(
      `${audit.stale.length} stale exemption(s): the predicate is gone but the licence to carry it`,
      `remains. Delete the entry so the next clone does not inherit permission.`,
      ``,
      ...audit.stale.map((s) => `  ${s}`),
    )
  }
  return out.join('\n')
}
