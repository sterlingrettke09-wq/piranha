import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { TARGETS } from './lib/parserDomains'
import { allWeights, readWeights, weightKey } from './lib/parcelWeights'
import { rank, isCitywide } from './lib/gapRanking'

// ── WHY THESE ARE PINNED (rule 20) ──────────────────────────────────────────
//
// Every assertion below would pass vacuously over an empty fixture directory:
// no target unmeasured, no residual non-zero, no gap misranked. "Nothing to
// report" and "nothing wrong" must not render the same, so the input set is
// asserted non-empty and its membership pinned to TARGETS before anything else
// is checked.

const ws = allWeights()

describe('the measurement set is complete', () => {
  it('every sweep target has stored weights, and there are no orphans', () => {
    expect(TARGETS.length).toBe(23)
    expect(ws.length).toBe(TARGETS.length)
    for (const t of TARGETS) {
      expect(readWeights(weightKey(t)), `${t.city}/${t.field}`).not.toBeNull()
    }
  })

  it('and each one carries a non-empty count table', () => {
    for (const w of ws) expect(Object.keys(w.counts).length, w.city).toBeGreaterThan(0)
  })
})

describe('every layer reconciles against its own count', () => {
  // THE check. Per-code counts plus the measured blank bucket plus the measured
  // whitespace bucket must equal the layer's own count(1=1) — not approximately.
  it('sum of counts + blanks + whitespace equals the layer total, exactly', () => {
    for (const w of ws) {
      const sum = Object.values(w.counts).reduce((a, b) => a + b, 0)
      expect(w.blankOrNull, `${w.city} blank unmeasured`).toBeGreaterThanOrEqual(0)
      expect(
        sum + w.blankOrNull + Math.max(w.whitespaceOnly, 0),
        `${w.city}/${w.field}`,
      ).toBe(w.totalFeatures)
      expect(w.residual, `${w.city}/${w.field}`).toBe(0)
      expect(w.reconciles, `${w.city}/${w.field}`).toBe(true)
      expect(w.truncated, `${w.city}/${w.field}`).toBe(false)
      expect(w.unmeasured, `${w.city}/${w.field}`).toEqual([])
    }
  })

  it('a null-only blank basis is recorded as such, never as the wider check', () => {
    // `field = ''` is invalid against a numeric column and the service answers
    // 400. Falling back to `IS NULL` is right; letting it read as the compound
    // check would claim a check that never ran.
    const narrow = ws.filter((w) => w.blankBasis === 'null-only').map((w) => `${w.city}/${w.field}`)
    expect(narrow).toEqual(['chicago/ZONE_CLASS'])
  })
})

describe("Chicago's grouped aggregate disagrees with its own layer", () => {
  // ⚠️ THIS IS A FINDING, NOT A WORKAROUND, and the fallback that repairs it
  // would otherwise erase it. `groupByFieldsForStatistics` on Chicago's zoning
  // layer undercounts: RT-4 groups to 1,954 against a direct count of 1,967, ten
  // PD codes present in returnDistinctValues are missing from the grouped result
  // and two codes it returns are missing from distinct-values. Not truncation
  // (exceededTransferLimit false, 1,520 groups against maxRecordCount 2,000) and
  // not transient (five consecutive identical probes — rule 10).
  it('is recorded, with the size of the shortfall', () => {
    const chi = readWeights('chicago__ZONE_CLASS')!
    expect(chi.method).toBe('per-value')
    expect(chi.groupedShortBy).toBe(68)
    expect(chi.totalFeatures).toBe(14943)
  })

  it('and no other target silently fell back', () => {
    const fellBack = ws.filter((w) => w.groupedShortBy != null).map((w) => w.city)
    expect(fellBack).toEqual(['chicago'])
    // Atlanta's service refuses grouped statistics outright (HTTP 400), which is
    // a different thing from answering wrongly — no shortfall to record.
    expect(readWeights('atlanta__ZONECLASS')!.method).toBe('per-value')
    expect(readWeights('atlanta__ZONECLASS')!.groupedShortBy).toBeNull()
  })
})

describe('the ranking', () => {
  const r = rank()

  it('classifies exactly the gaps the sweep does', () => {
    // Reconciled against the known-good: `npx vite-node
    // scripts/enumerate-parser-domains.ts` printed 653 on the same day, over a
    // LIVE enumeration, while this runs off committed fixtures. The two agreeing
    // is evidence the fixture roster still matches what the layers publish.
    expect(r.totalGaps).toBe(653)
    expect(r.ranked.length + r.offCoverage.length + r.unranked.length).toBe(653)
    expect(r.missingWeights).toEqual([])
    expect(r.notReconciled).toEqual([])
  })

  it('orders by share and puts Miami first, not LA', () => {
    // The point of the whole exercise. By code count LA leads with 440 gaps and
    // Miami sits at 13; by coverage Miami is 68.7% of its layer and LA 41.1%.
    expect(r.byCity[0].city).toBe('miami')
    expect(r.byCity[1].city).toBe('la')
    expect(r.byCity[0].gapCodes).toBeLessThan(r.byCity[1].gapCodes)
    expect(r.byCity[0].gapFeatures / r.byCity[0].total).toBeGreaterThan(
      r.byCity[1].gapFeatures / r.byCity[1].total,
    )
    for (let i = 1; i < r.ranked.length; i++) {
      expect(r.ranked[i - 1].share).toBeGreaterThanOrEqual(r.ranked[i].share)
    }
  })

  it('keeps off-coverage layers out of the citywide ranking', () => {
    // A code TABLE with 36 rows and an overlay with 20 features have denominators
    // that are not the city. Mixing them in would put a 3-feature San Jose gap
    // above every real one at 15%.
    expect(r.offCoverage.map((x) => x.city)).toEqual(['sanjose'])
    for (const x of r.ranked) expect(x.citywide, `${x.city}/${x.code}`).toBe(true)
    // Pinned membership, so a re-pointed provider shows up here rather than
    // quietly moving a target between the two tables.
    const off = TARGETS.filter((t) => !isCitywide(t)).map((t) => `${t.city}/${t.field}`)
    expect(off.sort()).toEqual([
      'minneapolis/Abbrv', // the built-form OVERLAY, not Planning_Primary_Zoning
      'philadelphia/MaxFAR', // a 36-row code table with no geography
      'philadelphia/MaxHeight',
      'sanjose/HEIGHTLIMIT', // 20 features with a specific height restriction
    ])
    // dc/ZR16 is NOT here: it reads a different column off the same layer the
    // registry names, and the denominator is the population, not the column.
    expect(off).not.toContain('dc/ZR16')
  })

  it('carries an AREA share beside the count share, and never blends them', () => {
    // Measured, not asserted (rule 1): a polygon count is not a land share, and
    // the divergence runs both ways. Miami 68.67% of polygons against 37.04% of
    // land; San Francisco 12.82% against 41.91%, because public land arrives in
    // a few enormous parcels. Pinning both directions so a future change that
    // quietly makes one stand in for the other goes red.
    const byCity = Object.fromEntries(r.byCity.map((v) => [v.city, v]))
    const miami = byCity.miami
    const sf = byCity.sf
    expect(miami.areaShare).not.toBeNull()
    expect(miami.gapFeatures / miami.total).toBeGreaterThan(miami.areaShare! * 1.5)
    expect(sf.areaShare).not.toBeNull()
    expect(sf.areaShare!).toBeGreaterThan((sf.gapFeatures / sf.total) * 2)
    // An unavailable area column is null, never 0 — LA publishes none.
    expect(byCity.la.areaShare).toBeNull()
    expect(r.ranked.filter((x) => x.areaShare != null).length).toBeGreaterThan(100)
  })

  it('never sums a share across cities', () => {
    // Shares have different denominators per city; a grand total would be
    // meaningless, so nothing computes one. This pins that the largest single
    // gap is a share of ONE city and is under 100%.
    expect(r.ranked[0].share).toBeLessThan(1)
    expect(r.ranked[0].city).toBe('la')
    expect(r.ranked[0].code).toBe('R1-1')
  })
})

describe('the committed report is derived, not transcribed', () => {
  const p = join(resolve(__dirname, '..'), 'docs/PARCEL-WEIGHTED-GAPS.md')
  it('exists and states the same totals the ranking computes', () => {
    expect(existsSync(p)).toBe(true)
    const md = readFileSync(p, 'utf8')
    const r = rank()
    // Row count, not a spot check: a stale document would have a different one.
    const rows = md.split('\n').filter((l) => /^\| \d+ \| /.test(l))
    expect(rows.length).toBe(r.ranked.length)
    expect(md).toContain('Do not edit by hand')
  })
})
