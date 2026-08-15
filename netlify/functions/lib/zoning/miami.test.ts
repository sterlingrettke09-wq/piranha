import { describe, it, expect } from 'vitest'
import { resolveMiami, miamiUsesForZone, MIAMI_MAX_FT_PER_STORY } from './miami'

// Zone codes and Bldg_Height values below are verbatim from a full sweep of the
// live Miami 21 Primary Zoning layer (36 distinct zones, 2026-08-03).
describe('resolveMiami — T6 (Urban Core), the only zones with published heights', () => {
  it('reads max stories from the layer and converts to feet', () => {
    expect(resolveMiami('T6-48A-O', '48')).toEqual({ heightFt: 48 * MIAMI_MAX_FT_PER_STORY, stories: 48, maxFAR: 11, farUnconstrained: false })
    expect(resolveMiami('T6-8-L', '8').stories).toBe(8)
    expect(resolveMiami('T6-80-O', '80').stories).toBe(80)
    expect(resolveMiami('T6-12-R', '12').stories).toBe(12)
  })
  it('falls back to the story count embedded in the zone code when the field is blank', () => {
    expect(resolveMiami('T6-24A-O', ' ').stories).toBe(24)
    expect(resolveMiami('T6-36B-L', '').stories).toBe(36)
  })
})

describe('resolveMiami — T3 is exact (Article 5 §5.3.2(e): two stories, 25 ft)', () => {
  it('returns 25 ft for every T3 intensity', () => {
    for (const z of ['T3-R', 'T3-L', 'T3-O']) {
      expect(resolveMiami(z, ' ')).toEqual({ heightFt: 25, stories: 2, maxFAR: null, farUnconstrained: true })
    }
  })
})

describe('resolveMiami — zones whose limits are not in public data', () => {
  it('returns null HEIGHTS for T4/T5/T1/D/CI/CS rather than guessing', () => {
    // Article 5 defers these HEIGHTS to Article 4 Table 2, which states them in
    // stories and which the GIS layer omits for everything but T6.
    for (const z of ['T4-R', 'T4-L', 'T4-O', 'T5-R', 'T5-L', 'T5-O', 'T1', 'D1', 'D2', 'D3', 'CI', 'CS']) {
      expect(resolveMiami(z, ' ').heightFt, z).toBeNull()
      expect(resolveMiami(z, ' ').stories, z).toBeNull()
      expect(resolveMiami(z, ' ').maxFAR, z).toBeNull()
    }
    // CI-HD is no longer all-null: Table 2 gives it an FLR (see below). Its
    // height stays unknown.
    expect(resolveMiami('CI-HD', ' ').heightFt).toBeNull()
  })
  it('handles missing / empty input', () => {
    expect(resolveMiami(null)).toEqual({ heightFt: null, stories: null, maxFAR: null, farUnconstrained: false })
    expect(resolveMiami('')).toEqual({ heightFt: null, stories: null, maxFAR: null, farUnconstrained: false })
    expect(resolveMiami(undefined)).toEqual({ heightFt: null, stories: null, maxFAR: null, farUnconstrained: false })
  })
})

// ─── Floor Lot Ratio ────────────────────────────────────────────────────────
// Every number below was read on 2026-08-05 in Miami 21 Article 4, Table 2, row
// "d. Floor Lot Ratio (FLR)" (pp. IV.5–IV.6, as adopted January 2018), and
// re-read in Article 3 §3.14.1, Article 5 Illustration 5.6/5.8 and Article 7
// §7.1.2.8(a)(3). Base only — the "/ n% additional Public Benefit" half of each
// Table 2 cell is the Article 3 §3.14 bonus and is NOT reported.
//
// REGRESSION MARKER: every one of these previously shipped as `maxFAR: null`,
// defended by a test titled "never invents a FAR — the layer FLR field is a
// letter suffix, not a ratio". The premise was true (the GIS `FLR` FIELD is a
// letter) and the conclusion was wrong: the letter is the Table 2 row KEY.
describe('resolveMiami — base FLR from Article 4 Table 2 (was null for all of these)', () => {
  const cases: Array<[string, string, number]> = [
    ['T6-8-O', '8', 5], // Table 2: "5 / 25% additional Public Benefit"
    ['T6-8-L', '8', 5],
    ['T6-8-R', '8', 5],
    ['T6-12-R', '12', 8], // Table 2: "8 / 30% additional Public Benefit"
    ['T6-24A-O', '24', 7], // Table 2: "a. 7 / 30% … or b.16 / 40% …"
    ['T6-24A-R', '24', 7],
    ['T6-24B-O', '24', 16],
    ['T6-36A-L', '36', 12], // Table 2: "a.12 or b.22 / 40% …"
    ['T6-36B-O', '36', 22],
    ['T6-48A-O', '48', 11], // Table 2: "a.11 or b.18 / 50% …"
    ['T6-48B-O', '48', 18],
    ['T6-60A-O', '60', 11], // Table 2: "a.11 or b.18 / 50% …"
    ['T6-80-O', '80', 24], // Table 2: "24 / 50% additional Public Benefit"
  ]
  it.each(cases)('%s → FLR %s', (zone, height, flr) => {
    expect(resolveMiami(zone, height).maxFAR).toBe(flr)
  })

  it('reports the BASE, never base + Public Benefit bonus', () => {
    // T6-8 is "5 / 25%" → 5, not 6.25. T6-80 is "24 / 50%" → 24, not 36.
    expect(resolveMiami('T6-8-O', '8').maxFAR).toBe(5)
    expect(resolveMiami('T6-80-O', '80').maxFAR).toBe(24)
  })

  it('CI-HD carries the flat FLR 8 of Table 2 / Illustration 5.8, and no height', () => {
    expect(resolveMiami('CI-HD', ' ')).toEqual({ heightFt: null, stories: null, maxFAR: 8, farUnconstrained: false })
  })

  it('keeps FLR independent of the story count and of the R/L/O intensity', () => {
    // Same 24 stories, different FLR — so FLR can never be derived from height.
    expect(resolveMiami('T6-24A-O', '24').stories).toBe(resolveMiami('T6-24B-O', '24').stories)
    expect(resolveMiami('T6-24A-O', '24').maxFAR).not.toBe(resolveMiami('T6-24B-O', '24').maxFAR)
  })
})

describe('resolveMiami — FLR left null where Table 2 does not answer', () => {
  it('refuses to pick between T6-24 a.7 and b.16 when the zone carries no letter', () => {
    // `T6-24-O` is live (2 features, blank FLR letter, queried 2026-08-05).
    // Reporting 16 would be reporting the larger of two alternatives.
    const r = resolveMiami('T6-24-O', '24')
    expect(r.maxFAR).toBeNull()
    expect(r.stories).toBe(24) // …while the height half stays resolved.
  })
  it('returns null for T6-8A / T6-8B — letters Miami 21 does not define', () => {
    // Live in the layer (4 features) but absent from Table 2, which gives T6-8
    // one unlettered FLR. An unexplained letter is a gap, not an answer.
    expect(resolveMiami('T6-8A-O', '8').maxFAR).toBeNull()
    expect(resolveMiami('T6-8B-O', '8').maxFAR).toBeNull()
  })
  it('returns null for T3/T4/T5/D/CI/CS, whose FLR cells read N/A', () => {
    for (const z of ['T3-R', 'T4-L', 'T5-O', 'T1', 'D1', 'D2', 'D3', 'CI', 'CS']) {
      expect(resolveMiami(z, ' ').maxFAR).toBeNull()
    }
  })
})

describe('miamiUsesForZone', () => {
  it('maps transect families to use vocabulary', () => {
    expect(miamiUsesForZone('T3-R')).toEqual(['residential'])
    expect(miamiUsesForZone('T4-L')).toContain('mixed')
    expect(miamiUsesForZone('T6-48A-O')).toContain('commercial')
    expect(miamiUsesForZone('CS')).toEqual(['institutional'])
    expect(miamiUsesForZone('CI-HD')).toEqual(['institutional'])
    expect(miamiUsesForZone('D3')).toContain('commercial')
    expect(miamiUsesForZone(null)).toBeNull()
  })
})

describe('Miami 21 story height — sourced, and the round-trip is gone', () => {
  it('uses the 14 ft maximum Story height Miami 21 Article 1 defines', () => {
    // Was 12, borrowed from the Denver module. Unsourced and wrong.
    expect(MIAMI_MAX_FT_PER_STORY).toBe(14)
  })

  it('reports the EXACT story count the code states, not a derived one', () => {
    // T6-80 means 80 stories. Previously: 80 x 12 = 960 ft, then the envelope
    // divided 960 by 11 ft and published 87 stories for an 80-story district.
    const r = resolveMiami('T6-80-O', '80')
    expect(r.stories).toBe(80)
    expect(r.heightFt).toBe(80 * 14)
  })
})

describe('the FLR absence Miami 21 states outright (rule 5)', () => {
  // Re-verified 2026-08-15 by RENDERING Article 4 Table 2 (pp. IV.6–IV.7) and
  // the Article 5 illustrations rather than extracting them. Each of
  // Illustration 5.3 (T3), 5.4 (T4), 5.5 (T5), 5.9 (D1, D2) and 5.10 (D3)
  // states "d. Floor Lot Ratio (FLR)  N/A". Table 2's FLR row is empty for
  // those columns while every other Lot Occupation row is filled — the row is
  // populated exactly where the instrument applies.
  it.each(['T3-R', 'T3-L', 'T3-O', 'T4-R', 'T4-L', 'T4-O', 'T5-R', 'T5-L', 'T5-O', 'D1', 'D2', 'D3', 'T1'])(
    '%s reports no FLR as an ANSWER',
    (z) => {
      const r = resolveMiami(z, ' ')
      expect(r.farUnconstrained).toBe(true)
      expect(r.maxFAR).toBeNull()
    },
  )

  // ⚠️ CI IS NOT ONE OF THEM. Miami 21 gives plain CI no FLR row and no Table 2
  // column; § 5.7.2.4(b) instead says "Development in a CI Zone shall follow
  // the regulations of the Abutting Transect Zone". That is a joint dependency
  // on the NEIGHBOUR's zoning (rule 13), which this provider does not read, so
  // CI must stay a GAP and must never be reported as an absence.
  it.each(['CI', 'CS'])('%s stays a gap, because an abutting zone governs it', (z) => {
    const r = resolveMiami(z, ' ')
    expect(r.farUnconstrained).toBe(false)
    expect(r.maxFAR).toBeNull()
  })

  it('CI-HD is not swept into the absence either — Table 2 gives it 8', () => {
    const r = resolveMiami('CI-HD', ' ')
    expect(r.farUnconstrained).toBe(false)
    expect(r.maxFAR).toBe(8)
  })

  it('never reports a T6 zone as unconstrained', () => {
    for (const z of ['T6-8-O', 'T6-24A-L', 'T6-80-O']) {
      expect(resolveMiami(z, '').farUnconstrained, z).toBe(false)
    }
  })
})
