import { describe, it, expect } from 'vitest'
import ledger from '../../docs/VERIFICATION-LEDGER.md?raw'
import {
  extractCitations,
  findLedgerDrift,
  formatDrift,
  type LedgerCitation,
} from './ledgerFigures'
import permitStats from '../../netlify/functions/lib/data/permitStats.json'
import reliefStats from '../../netlify/functions/lib/data/reliefStats.json'

const key = (c: LedgerCitation) =>
  c.kind === 'relief'
    ? `${c.city}/relief ${c.ratePct}% n=${c.n}`
    : `${c.city}/permits/${c.tier} ${c.medianMonths}/${c.p80Months} n=${c.n}`

const citations = () => extractCitations(ledger, reliefStats, permitStats)

// ─── The drift guard ────────────────────────────────────────────────────────
// docs/VERIFICATION-LEDGER.md quotes published figures in prose and had no
// anchor: three entries went stale within hours of being written and each was
// caught only because a human re-read while working nearby. This is the anchor.
//
// A ledger is *supposed* to contain stale figures — it is a dated historical
// record — so the guard checks only what is presented as CURRENT: a published
// figure tuple (a rate or a median bound to its sample size), attributed to a
// city that is in the artifact today, and not marked by the ledger's own
// supersede/withdraw/restate conventions. See ledgerFigures.ts for the rule.
describe('ledger figure drift guard', () => {
  it('no live figure quoted as current disagrees with the artifact', () => {
    const drift = findLedgerDrift(ledger, reliefStats, permitStats)
    expect(
      drift.length,
      drift.length
        ? `\n${drift.length} ledger figure(s) contradict the published artifact.\n` +
          `Either the figure is stale (fix it) or it is history (mark it with the ledger's\n` +
          `\`> ⚠️ **SUPERSEDED/WITHDRAWN …**\` pointer, or restate the current figure beside it):\n` +
          formatDrift(drift)
        : '',
    ).toBe(0)
  })
})

// ─── The instrument, pinned ─────────────────────────────────────────────────
// Rule 11: measure the pipeline, not your probe. A guard whose regexes quietly
// stop matching is green forever and protects nothing, and a history rule that
// quietly widens to "everything" is the same failure wearing a pass. So pin the
// citations the scanner finds and the ones it rules historical. Both lists are
// short and both should change only deliberately — landing a new figure, or
// superseding one, is exactly when someone should look here.
describe('what the guard currently reads', () => {
  it('finds every published-figure citation for a live city, and no others', () => {
    expect(citations().map(key).sort()).toEqual(
      [
        // Austin's per-tier table, 2026-08-06 — the four rows are the artifact's
        // byTier block plus its aggregate.
        'austin/permits/single 1.6/4 n=8835',
        'austin/permits/multi 2.9/6.8 n=1208',
        'austin/permits/apartment 8.6/16.2 n=1491',
        'austin/permits/aggregate 2.1/6.1 n=11534',
        // SF's restatement, 2026-08-09: the current figure and the one it replaced.
        'sf/relief 97.3% n=406',
        'sf/relief 97.6% n=289',
        // NYC and DC landing in reliefStats.json, 2026-08-10.
        'nyc/relief 98.1% n=210',
        'dc/relief 97.4% n=617',
        // Charlotte: the survey's figure, the pointer that superseded it, and
        // the figure that shipped.
        'charlotte/relief 92.4% n=157',
        'charlotte/relief 92.3% n=155',
        'charlotte/relief 92.3% n=155',
      ].sort(),
    )
  })

  it('rules exactly three citations historical, each on a named signal', () => {
    const history = citations()
      .filter((c) => c.history)
      .map((c) => `${key(c)} — ${c.historyBecause}`)
      .sort()
    expect(history).toEqual(
      [
        // "Charlotte surveyed feasible … 92.4% over 157 decided cases", with the
        // `> ⚠️ **SUPERSEDED the same day**` blockquote in the next block.
        'charlotte/relief 92.4% n=157 — the next block is a supersede/withdraw pointer',
        // That blockquote itself, which quotes the shipped 92.3%/n=155.
        'charlotte/relief 92.3% n=155 — is a supersede/withdraw pointer blockquote',
        // "**Restated: 97.3% (n=406 …)**, replacing 97.6% (n=289)" — the
        // correction sits beside the superseded figure (rule 17).
        'sf/relief 97.6% n=289 — restated in-block alongside the current figure',
      ].sort(),
    )
  })

  // The false positives that would get this guard deleted. Each of these is a
  // genuine historical figure in the ledger for a city that is NOT in the
  // artifacts today, so scope alone rules them out — no annotation needed and
  // none should be demanded.
  it('never reads a citation for a city outside the artifacts', () => {
    const live = new Set([...Object.keys(reliefStats), ...Object.keys(permitStats)])
    for (const c of citations()) expect(live.has(c.city), `${key(c)}`).toBe(true)
    // Named individually because these are the specific entries that must stay
    // untouched: NYC's withdrawn 8.3 / p80 17.0 / n=4,403 and Seattle's
    // withdrawn 5.7 / 10.0 / n=4,996 permit figures, LA's 6.0/13.0 and 45.4%,
    // Chicago's 1.0-month median, San Diego's 10.2.
    for (const slug of ['seattle', 'la', 'chicago', 'sandiego']) {
      expect(live.has(slug), `${slug} is not in either artifact`).toBe(false)
    }
    // NYC is live for RELIEF and withdrawn for PERMITS — the one city where the
    // scope test has to be per-dimension, and the case most likely to be got
    // wrong. Its withdrawn permit pair must not be read as a permit citation.
    expect(Object.keys(reliefStats)).toContain('nyc')
    expect(Object.keys(permitStats)).not.toContain('nyc')
    expect(citations().some((c) => c.city === 'nyc' && c.kind === 'permits')).toBe(false)
  })
})

// ─── The discrimination, proven both ways on synthetic input ────────────────
// Four live mutation proofs were run against the real files during development
// and reverted: Charlotte's grantRate 0.923 → 0.907 (red at :4172); the ledger's
// own line 4172 rewritten to 92.4% / n=157, reproducing the original incident
// (red, naming both the rate and the n); Austin's apartment table row n 1,491 →
// 1,481 (red at :2475); and that same stale 92.4% / n=157 given a
// `> ⚠️ **SUPERSEDED**` blockquote, which turned it green again. These keep the
// property under test permanently, without depending on a mutated repo.
describe('current vs history discrimination', () => {
  const relief = { charlotte: { variance: { grantRate: 0.923, n: 155 } } }
  const permits = {
    austin: { newConstruction: { medianMonths: 2.1, p80Months: 6.1, n: 11534 } },
  }

  it('fires on an unmarked figure that disagrees', () => {
    const md = '## Entry\n\nCharlotte published 92.4% over 157 decided cases.\n'
    const drift = findLedgerDrift(md, relief, permits)
    expect(drift).toHaveLength(1)
    expect(drift[0].detail).toBe('rate 92.4% vs artifact 92.3%; n=157 vs artifact n=155')
    expect(drift[0].citation.line).toBe(3)
  })

  it('is silent on the same figure carrying a supersede pointer', () => {
    const md =
      '## Entry\n\nCharlotte published 92.4% over 157 decided cases.\n\n' +
      '> ⚠️ **SUPERSEDED — the build shipped 92.3%.**\n'
    expect(findLedgerDrift(md, relief, permits)).toHaveLength(0)
  })

  it('is silent on a figure restated beside its replacement', () => {
    const md =
      '## Entry\n\nCharlotte: **Restated: 92.3% (n=155)**, replacing 92.4% (n=157).\n'
    expect(findLedgerDrift(md, relief, permits)).toHaveLength(0)
  })

  it('a restatement block is NOT a blanket pass — mutate the current figure and it fires', () => {
    // The in-block escape requires a citation that MATCHES the artifact to be
    // present. Break that one and the block stops qualifying, so a stale
    // "restated" figure cannot hide behind the vocabulary alone.
    const md =
      '## Entry\n\nCharlotte: **Restated: 95.3% (n=155)**, replacing 92.4% (n=157).\n'
    const drift = findLedgerDrift(md, relief, permits)
    expect(drift.map((d) => d.detail).sort()).toEqual(
      ['rate 92.4% vs artifact 92.3%; n=157 vs artifact n=155', 'rate 95.3% vs artifact 92.3%'].sort(),
    )
  })

  it('a loose number with no sample size is prose, not a citation', () => {
    // "A user testing a multifamily parcel is shown 2.2 months against a
    // measured 9.8" is the real line this protects; requiring the n is what
    // keeps the ledger's narrative arithmetic out of the guard.
    const md = '## Entry\n\nAustin users were shown 2.2 months against a measured 9.8.\n'
    expect(extractCitations(md, relief, permits)).toHaveLength(0)
  })

  it('a figure and an n on opposite sides of a sentence break do not bind', () => {
    const md = '## Entry\n\nCharlotte: a comparison of ~96.9%. It measured n=155 instead.\n'
    expect(extractCitations(md, relief, permits)).toHaveLength(0)
  })

  it('attribution is section-scoped, so a later subsection cannot inherit a city', () => {
    const md =
      '## Entry\n\nCharlotte shipped 92.3% over 155 decided cases.\n\n' +
      '### The brief\n\nThe brief handed over 92.4% over 157 cases.\n'
    // The `###` names no city, so its figure is unattributed and unchecked —
    // correctly, because it quotes a brief rather than the artifact.
    expect(extractCitations(md, relief, permits).map(key)).toEqual([
      'charlotte/relief 92.3% n=155',
    ])
  })

  it('drift is collected, not thrown on the first offender', () => {
    const md =
      '## Entry\n\nCharlotte published 92.4% over 157 decided cases.\n\n' +
      '## Another\n\nCharlotte elsewhere reports 91.0%, n=155.\n'
    expect(findLedgerDrift(md, relief, permits)).toHaveLength(2)
  })

  it('reads a per-tier permit table and checks every row', () => {
    const md =
      '## Austin\n\n| tier | median | p80 | n |\n|---|---|---|---|\n' +
      '| *aggregate* | *2.1 mo* | *6.1* | *11,534* |\n'
    expect(findLedgerDrift(md, relief, permits)).toHaveLength(0)
    const stale = md.replace('*2.1 mo*', '*2.4 mo*')
    expect(findLedgerDrift(stale, relief, permits)[0].detail).toBe('median 2.4 vs artifact 2.1')
  })
})
