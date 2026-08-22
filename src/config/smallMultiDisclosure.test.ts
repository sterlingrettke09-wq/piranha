import { describe, it, expect } from 'vitest'
import { costPerSqFtByProduct } from './estimates'
import KEYMETRICS_SRC from '../components/boston/result/KeyMetrics.tsx?raw'
import RESULT_SRC from '../routes/BostonResult.tsx?raw'

const smallMulti = costPerSqFtByProduct['small-multi']

describe('⚠️ the unsourced-cost disclosure — user copy, not a ledger note', () => {
  it('the reason says what is true of the WORLD, not of our data', () => {
    // "Construction cost not estimated" reads as a failure on this parcel. The
    // truth is a gap in what anyone publishes, identical for every 2–4 unit
    // project in every city — so the sentence has to say unpublished, not
    // missing.
    expect(smallMulti.kind).toBe('unsourced')
    if (smallMulti.kind !== 'unsourced') throw new Error('unreachable')
    expect(smallMulti.reason).toMatch(/No published source prices 2–4 unit buildings separately/)
    // ⚠️ And it names the alternative we REFUSED. Without that, "no estimate"
    // reads as a gap rather than a choice.
    expect(smallMulti.reason).toMatch(/interpolated rather than measured/)
  })

  it('⚠️ the reason is short enough to be read on a page', () => {
    // It was briefly 660 characters — "Searched 2026-08-22", table counts,
    // "$53.6M per project" — because one field served both the reader looking at
    // a blank price and the engineer auditing the search. CostBreakdown renders
    // it verbatim, so it is USER copy; the provenance lives in the module
    // comment above it.
    if (smallMulti.kind !== 'unsourced') throw new Error('unreachable')
    expect(smallMulti.reason.length).toBeLessThan(400)
    for (const leak of ['Searched 2026', 'eleven tables', '$53.6M', 'deflator', 'NMHC']) {
      expect(smallMulti.reason, `provenance leaked: ${leak}`).not.toContain(leak)
    }
  })

  it('⚠️ the two unavailable causes do not share a sentence', () => {
    // 'unsourced' is a product nobody prices; 'unpriced' is a quantity nobody
    // publishes. That distinction is why CostUnavailable carries `kind`, and a
    // single label would throw it away at the last step (rule 5).
    expect(KEYMETRICS_SRC).toMatch(/costUnavailable\?\.kind === 'unsourced'/)
    expect(KEYMETRICS_SRC).toMatch(/costUnavailable\?\.kind === 'unpriced'/)
    expect(KEYMETRICS_SRC).toMatch(/No published rate for this building type/)
    expect(KEYMETRICS_SRC).toMatch(/Not priced — the figure this needs is unpublished/)
    // The bare fallback survives for a null cost with no stated cause — it must
    // not be deleted, only stop being the answer for the two known causes.
    expect(KEYMETRICS_SRC).toMatch(/'Construction cost not estimated'/)
  })

  it('⚠️ the value is actually WIRED, not merely in scope', () => {
    // rule 33's corollary: the derived value being importable is not the same as
    // its being used. CostBreakdown already rendered `costUnavailable.reason`
    // while KeyMetrics — the tile a reader sees first — showed none of it.
    expect(RESULT_SRC).toMatch(/costUnavailable=\{state\.data\.costUnavailable\}/)
    expect(KEYMETRICS_SRC).toMatch(/costUnavailable\?: AnalysisResult\['costUnavailable'\]/)
  })
})
