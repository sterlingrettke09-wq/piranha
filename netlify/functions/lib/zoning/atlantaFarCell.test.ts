import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseAtlantaFarCell, atlantaFarFor, type AtlantaSubareaFar } from './atlanta'

const ROOT = resolve(__dirname, '../../../..')

// A FAR CELL IS A RATIO ONLY IF IT IS A BARE NUMBER.
//
// The strings below are VERBATIM from the expanded Municode grids of Atlanta's
// SPI chapters, read 2026-08-18. They are not invented shapes: every one of them
// sits today in a row whose label says "FAR", and coercing any of them yields a
// plausible number an order of magnitude from anything real, in the flattering
// direction — `20%` -> 0.20, `Max 5% of Res. FAR` -> 0.05.
const REAL_NON_RATIO_CELLS: ReadonlyArray<readonly [string, string]> = [
  ['20%', 'SPI-20 / SPI-21 subarea 4 — a use-mix cap, not a ratio'],
  ['5%', 'SPI-20 / SPI-21 subarea 5'],
  ['Max 5% of Res. FAR', 'SPI-11 — a percentage OF another limb'],
  ['5% of the total occupied residential floor area 1', 'SPI-17, footnote marker included'],
  [
    'On street level & street frontage 2,500 sf, max 5% residential floor area',
    'SPI-16 — a locational rule in a FAR row',
  ],
  ['On street level & street frontage', 'SPI-16 — the shorter variant'],
  ['None', 'stated absence'],
  ['N/A', "SPI-11's Combined row"],
  ['', 'empty cell'],
]

const REAL_RATIO_CELLS: ReadonlyArray<readonly [string, number]> = [
  ['2.5', 2.5],
  ['1.0', 1],
  ['0.696', 0.696],
  ['3.196', 3.196],
  ['0', 0],
  [' 5.2 ', 5.2],
]

describe('parseAtlantaFarCell refuses everything that is not a bare ratio', () => {
  it('the fixture is the real corpus, not a sample (rule 20)', () => {
    // A shrunken fixture would make every assertion below pass by having
    // nothing to reject. Pin both sides.
    expect(REAL_NON_RATIO_CELLS.length).toBeGreaterThanOrEqual(9)
    expect(REAL_RATIO_CELLS.length).toBeGreaterThanOrEqual(6)
    // And pin that the corpus still contains the four DISTINCT forms measured
    // across the chapters — a bare percentage, a percentage of another limb, a
    // percentage of floor area, and a prose locational rule.
    const joined = REAL_NON_RATIO_CELLS.map(([c]) => c).join('|')
    expect(joined).toContain('20%')
    expect(joined).toContain('Max 5% of Res. FAR')
    expect(joined).toContain('total occupied residential floor area')
    expect(joined).toContain('On street level')
  })

  it.each(REAL_NON_RATIO_CELLS)('refuses %j (%s)', (cell) => {
    expect(parseAtlantaFarCell(cell)).toBeNull()
  })

  it.each(REAL_RATIO_CELLS)('reads %j as %d', (cell, expected) => {
    expect(parseAtlantaFarCell(cell)).toBe(expected)
  })

  it('never turns a percentage into its decimal', () => {
    // The specific silent failure. Stated as its own assertion because it is the
    // one a future "helpful" parser change would reintroduce.
    for (const pct of ['20%', '5%', '70%']) {
      expect(parseAtlantaFarCell(pct)).not.toBe(Number(pct.replace('%', '')) / 100)
      expect(parseAtlantaFarCell(pct)).toBeNull()
    }
  })
})

// ── THE COMBINED CAP IS NOT REACHABLE WITHOUT DECLARING A MIXED PROGRAMME ────
//
// SPI-16 SA1 states non-residential 5.0, residential 3.2, Max FAR 8.2 — and 8.2
// is 5.0 + 3.2, a cap on a MIXED programme. A residential building there is
// limited to 3.2. Publishing 8.2 to it overstates by 2.6x, which is what a
// reading of the combined row alone would have done.
const SPI16_SA1: AtlantaSubareaFar = {
  nonResidential: { far: 5.0, basis: 'gross', source: 'Ch. 16-18P Table, Non-Residential FAR' },
  residential: { far: 3.2, basis: 'gross', source: 'Ch. 16-18P Table, Residential FAR' },
  combinedIfMixedUse: { far: 8.2, basis: 'gross', source: 'Ch. 16-18P Table, Max FAR' },
}

describe('atlantaFarFor routes by programme', () => {
  it('a residential project gets 3.2, never the 8.2 combined cap', () => {
    expect(atlantaFarFor(SPI16_SA1, 'residential')!.far).toBe(3.2)
    expect(atlantaFarFor(SPI16_SA1, 'residential')!.far).not.toBe(8.2)
  })

  it('a non-residential project gets 5.0', () => {
    expect(atlantaFarFor(SPI16_SA1, 'non-residential')!.far).toBe(5.0)
  })

  it('only a mixed programme reaches the combined cap', () => {
    expect(atlantaFarFor(SPI16_SA1, 'mixed')!.far).toBe(8.2)
  })

  it('and a subarea stating no ratio for a programme returns null, not a fallback', () => {
    // SPI-16 SA2: the non-residential cell is a locational rule, so there is no
    // non-residential ratio. That is an ANSWER and must not be filled from the
    // residential limb or the combined cap (rule 5).
    const sa2: AtlantaSubareaFar = {
      nonResidential: null,
      residential: { far: 6.4, basis: 'gross', source: 'Ch. 16-18P' },
      combinedIfMixedUse: { far: 6.4, basis: 'gross', source: 'Ch. 16-18P' },
    }
    expect(atlantaFarFor(sa2, 'non-residential')).toBeNull()
  })
})

describe('the combined field has exactly one reader', () => {
  it('and it is the accessor', () => {
    // Structural, in the shape of denverResolverWiring.test.ts. Naming the field
    // for its condition makes a direct read legible; this makes it impossible to
    // add one quietly. A second reader is how 8.2 gets published to a
    // residential project again.
    const files = [
      'netlify/functions/lib/zoning/atlanta.ts',
      'netlify/functions/lib/envelope.ts',
      'netlify/functions/analyze.ts',
      'src/lib/gfaBasis.ts',
    ]
    let seen = 0
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      const hits = [...src.matchAll(/\bcombinedIfMixedUse\b/g)].length
      // atlanta.ts holds the interface field, its doc comment and the accessor.
      if (f.endsWith('zoning/atlanta.ts')) {
        expect(hits, 'the field and its accessor must both still exist').toBeGreaterThanOrEqual(2)
        seen += 1
        continue
      }
      expect(hits, `${f} reads combinedIfMixedUse directly — call atlantaFarFor(sub, 'mixed')`).toBe(0)
    }
    expect(seen, 'the scan did not reach atlanta.ts at all').toBe(1)
  })
})

describe('the two uncomputable-product disclosures do not share a sentence', () => {
  it('elective must not claim the area is unobtainable', () => {
    const src = readFileSync(join(ROOT, 'netlify/functions/lib/assumptions.ts'), 'utf8')
    // Anchor on the BRANCH, not the union declaration. The first version keyed
    // on the bare member name, which also appears in the local union type above
    // — so both patterns ran forward into the same first floorAreaBasis and the
    // guard reported the two sentences identical when they are not. The probe
    // was wrong, not the copy (rule 11).
    const elective = /gfaBasis === 'assumed-basis-elective'[\s\S]{0,1200}?floorAreaBasis:\s*\n?\s*'([^']+)'/.exec(src)
    const unavailable = /gfaBasis === 'assumed-basis-unavailable'[\s\S]{0,1400}?floorAreaBasis:\s*\n?\s*'([^']+)'/.exec(src)
    expect(elective, 'the elective disclosure is missing').not.toBeNull()
    expect(unavailable, 'the unavailable disclosure is missing').not.toBeNull()
    expect(elective![1]).not.toBe(unavailable![1])
    // The load-bearing difference: one says nobody can compute it, the other
    // says the reader can and we cannot.
    expect(unavailable![1]).toContain('cannot be turned into a floor area')
    expect(elective![1]).not.toContain('cannot be turned into a floor area')
    expect(elective![1]).toMatch(/your|yours/i)
  })
})
