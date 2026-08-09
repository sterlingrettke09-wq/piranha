import { describe, it, expect } from 'vitest'
import {
  computeRedTapeIndex,
  citiesWithoutProcessConstants,
  parkingCell,
  REFERENCE,
  type RedTapeConstants,
} from './redTapeIndex'
import { lifecycleMonths } from '../config/estimates'
import { PARKING_RULES } from '../config/parkingRules'
import { CITIES } from '../config/cities'

describe('computeRedTapeIndex', () => {
  const ranked = computeRedTapeIndex()

  // Counts are derived from the city registry, not hard-coded, so adding a city
  // doesn't require editing these assertions — coverage just has to stay
  // accounted for.
  //
  // This assertion used to read `toHaveLength(CITIES.length)`, i.e. every live
  // city is ranked. Raleigh broke it, correctly: it is live and wired but has no
  // measured lifecycle duration, and the index is 70% weighted on that number.
  // The two ways to make the old assertion pass again were (a) invent a duration
  // or (b) drop Raleigh out of the table quietly. Both are the failures this
  // repo keeps recording — (a) is rule 1, (b) is an absence rendering as a
  // finding. So the invariant is now "every city is either RANKED or DISCLOSED,
  // and never both", which still fails loudly if a city goes missing for any
  // reason nobody wrote down.
  it('accounts for every city exactly once — ranked or disclosed', () => {
    const missing = citiesWithoutProcessConstants()
    const slugs = new Set(ranked.map((r) => r.slug))
    expect(slugs.size).toBe(ranked.length) // no duplicates
    expect(ranked).toHaveLength(CITIES.length - missing.length)

    for (const c of CITIES) {
      const isRanked = slugs.has(c.slug)
      const isDisclosed = missing.includes(c.slug)
      expect(isRanked !== isDisclosed, `${c.slug} must be exactly one of ranked/disclosed`).toBe(true)
    }
    // Cross-check against the source-of-truth timeline table, both directions.
    for (const slug of Object.keys(lifecycleMonths)) {
      expect(slugs.has(slug)).toBe(true)
    }
    for (const slug of missing) {
      expect(slug in lifecycleMonths, `${slug} is disclosed as missing but HAS constants`).toBe(false)
    }
  })

  // A disclosed city must be a real live city, never a typo that quietly excuses
  // a genuine gap.
  it('only disclosed-as-unranked cities are real registry slugs', () => {
    const known = new Set(CITIES.map((c) => c.slug))
    for (const slug of citiesWithoutProcessConstants()) {
      expect(known.has(slug), `${slug} is not a city slug`).toBe(true)
    }
  })

  // The list is DERIVED, not typed. Prove it moves with the data: hand it a
  // lifecycle table that covers nothing and every city must come back disclosed.
  it('derives the unranked list from the constants, not a hard-coded list', () => {
    expect(citiesWithoutProcessConstants({ lifecycleMonths: {} })).toHaveLength(CITIES.length)
  })

  it('ranks SF worst on months of process', () => {
    // SF is the slowest-permitting city in the constants, so it should carry
    // the highest processMonths and the maximal months sub-score.
    const sf = ranked.find((r) => r.slug === 'sf')!
    const worstMonths = Math.max(...ranked.map((r) => r.processMonths))
    expect(sf.processMonths).toBe(worstMonths)
    expect(sf.monthsScore).toBe(100)
  })

  it('keeps every sub-score and composite within 0–100', () => {
    for (const r of ranked) {
      expect(r.monthsScore).toBeGreaterThanOrEqual(0)
      expect(r.monthsScore).toBeLessThanOrEqual(100)
      expect(r.feesScore).toBeGreaterThanOrEqual(0)
      expect(r.feesScore).toBeLessThanOrEqual(100)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
  })

  it('assigns a contiguous ascending rank (1 = least red tape)', () => {
    const ranks = ranked.map((r) => r.rank)
    expect(ranks).toEqual(Array.from({ length: ranked.length }, (_, i) => i + 1))
    // Composite is non-decreasing as rank rises.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i - 1].score)
    }
  })

  it('treats the reference project as a residential apartment', () => {
    expect(REFERENCE.tier).toBe('apartment')
    expect(REFERENCE.use).toBe('residential')
    expect(REFERENCE.gfa).toBe(40000)
  })

  it('reorders when injected constants change', () => {
    // Two-city toy world: "slow" has a long lifecycle, "fast" a short one. With
    // the real-ish constants slow ranks worst; flip the lifecycle and the
    // ranking flips too — proving the order is a pure function of the inputs.
    const override: Partial<RedTapeConstants> = {
      lifecycleMonths: {
        slow: { single: 10, multi: 20, apartment: 60 },
        fast: { single: 10, multi: 20, apartment: 20 },
      },
      reliefAddMonthsByCity: { slow: 10, fast: 2 },
      demoMonthsByCity: { slow: 3, fast: 3 },
      cityCostIndex: { slow: 1, fast: 1 },
      impactFee: () => null,
    }
    const a = computeRedTapeIndex(override)
    expect(a.find((r) => r.slug === 'slow')!.rank).toBe(2)
    expect(a.find((r) => r.slug === 'fast')!.rank).toBe(1)

    const flipped: Partial<RedTapeConstants> = {
      ...override,
      lifecycleMonths: {
        slow: { single: 10, multi: 20, apartment: 20 },
        fast: { single: 10, multi: 20, apartment: 60 },
      },
      reliefAddMonthsByCity: { slow: 2, fast: 10 },
    }
    const b = computeRedTapeIndex(flipped)
    expect(b.find((r) => r.slug === 'slow')!.rank).toBe(1)
    expect(b.find((r) => r.slug === 'fast')!.rank).toBe(2)
  })

  it('counts only applied fees, not informational ones', () => {
    // Boston's residential reference project triggers no applied linkage fee
    // (linkage is commercial ≥ 50k sf only), so its feePerSqFt is 0.
    const boston = ranked.find((r) => r.slug === 'boston')!
    expect(boston.feePerSqFt).toBe(0)
    expect(boston.feeLabel).toBeNull()
    // LA applies a residential linkage fee, so it should be > 0.
    const la = ranked.find((r) => r.slug === 'la')!
    expect(la.feePerSqFt).toBeGreaterThan(0)
  })

  it('exposes parking status + label per city from PARKING_RULES', () => {
    for (const r of ranked) {
      const rule = PARKING_RULES[r.slug]
      expect(rule, `expected a parking rule for ${r.slug}`).toBeTruthy()
      expect(r.parkingStatus).toBe(rule.status)
      expect(r.parkingLabel).toBe(parkingCell(rule))
    }
  })

  it('exposes measured permit medians + relief odds where the artifacts carry them', () => {
    // Philadelphia has a measured new-construction median; Boston has a relief rate.
    // Was Chicago until 2026-08-05, when its 1-month figure was withdrawn — 46% of
    // that sample was a 2022-23 cohort stamped applied==issued. Philadelphia is one
    // of the two cities the audit rated SOUND on its date field.
    const philadelphia = ranked.find((r) => r.slug === 'philadelphia')!
    expect(philadelphia.measuredMedianMonths).toBeGreaterThan(0)
    expect(philadelphia.measuredPermitN).toBeGreaterThan(0)
    // A withdrawn city must read as absent, never as a fabricated number.
    const chicago = ranked.find((r) => r.slug === 'chicago')!
    expect(chicago.measuredMedianMonths).toBeNull()
    const boston = ranked.find((r) => r.slug === 'boston')!
    expect(boston.reliefGrantRate).toBeCloseTo(0.927, 3)
    expect(boston.reliefN).toBeGreaterThan(0)
    // A city with no artifact for a field gets null, never a fabricated number.
    const dc = ranked.find((r) => r.slug === 'dc')!
    expect(dc.measuredMedianMonths).toBeNull()
    expect(dc.reliefGrantRate).toBeNull()
  })

  it('does NOT let parking influence the composite score (informational only)', () => {
    // The composite is months 70% + fees 30%; parking rides alongside untouched.
    for (const r of ranked) {
      expect(r.score).toBeCloseTo(r.monthsScore * 0.7 + r.feesScore * 0.3, 6)
    }
  })
})

/**
 * Words of a phrase, normalised so two strings can be compared for content
 * rather than punctuation: lowercase, everything that is not a letter, digit or
 * ½ becomes a separator. Applied identically to both sides, so "CMX-4/CMX-5"
 * and "1–2 family" decompose the same way wherever they appear.
 */
function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9½]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

describe('parkingCell', () => {
  /**
   * ⚠️ THE REGRESSION TEST. This is the check that was missing when the cell was
   * computed from `rule.status` — 'abolished' → `Abolished (${asOf})`, everything
   * else → the literal string 'Near transit only'. That published a transit
   * mechanism for Nashville (Urban Zoning Overlay), Philadelphia (CMX-4/CMX-5),
   * New York (Manhattan core), Boston (income-restricted housing) and DC
   * (downtown), none of which key on transit proximity.
   *
   * The rule it enforces is deliberately mechanical rather than a list of
   * mechanisms: every word the cell prints must also appear in the headline
   * verified for THAT city. A cell may shorten its own headline; it may not add
   * a single word to it. Any invented category — 'Near transit only', or the
   * next enum value someone reaches for — fails immediately for every city whose
   * headline does not contain those words, which is the point. Enumerating
   * mechanisms would only move the defect to the city nobody enumerated.
   *
   * Note this runs over the RENDERED cell (through `parkingCell`) for the cities
   * the index actually ranks — the published surface, not the data behind it
   * (CLAUDE.md rule 11: exercise the real entry point). `parkingRules.test.ts`
   * covers the full table, including cities not yet ranked.
   */
  it('never prints a word absent from the ranked city’s own headline', () => {
    const ranked = computeRedTapeIndex()
    expect(ranked.length).toBeGreaterThan(0)
    // Collect EVERY offender before asserting, rather than failing on the first.
    // Under the old status-driven cell this is the difference between "Denver
    // says Aug" and a list naming the five cities whose mechanism was wrong —
    // and the second is what tells you the defect is systemic, not a typo.
    const offenders: string[] = []
    for (const r of ranked) {
      const rule = PARKING_RULES[r.slug]
      expect(rule, `expected a parking rule for ${r.slug}`).toBeTruthy()
      const cell = parkingCell(rule)
      expect(cell.length, `${r.slug} cell is empty`).toBeGreaterThan(0)
      expect(r.parkingLabel).toBe(cell)
      expect(r.parkingHeadline).toBe(rule.headline)
      const fromHeadline = new Set(contentWords(rule.headline))
      const invented = contentWords(cell).filter((w) => !fromHeadline.has(w))
      if (invented.length > 0) {
        offenders.push(
          `${r.slug}: cell "${cell}" asserts ${JSON.stringify(invented)}, absent from headline "${rule.headline}"`,
        )
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  // Proof the test above has teeth: the exact string that shipped is rejected
  // for the cities it was wrong about, and accepted for the ones it fitted —
  // so this is a check on the CLAIM, not a blanket ban on a phrase.
  it('rejects the string that shipped, for the cities it was false about', () => {
    const claim = contentWords('Near transit only')
    const words = (slug: string) => new Set(contentWords(PARKING_RULES[slug].headline))
    for (const slug of ['nashville', 'philadelphia', 'nyc', 'boston']) {
      expect(claim.every((w) => words(slug).has(w)), `${slug}`).toBe(false)
    }
    // Chicago's headline does carry "near transit" — the claim was true there,
    // which is exactly why a status-driven cell was so easy to miss.
    expect(words('chicago').has('transit')).toBe(true)
  })

  it('renders each city’s own label, not a category', () => {
    expect(parkingCell(PARKING_RULES.denver)).toBe('Abolished citywide (2025)')
    expect(parkingCell(PARKING_RULES.nashville)).toBe(
      'None required in the Urban Zoning Overlay or downtown',
    )
    expect(parkingCell(PARKING_RULES.philadelphia)).toBe(
      'Eliminated for housing in CMX-4/CMX-5; minimums remain elsewhere',
    )
  })

  // The qualifying clause is the part it is tempting to drop for width, and
  // dropping it is the same error one notch smaller: "None required" alone
  // reads as citywide. Where the headline carries the clause, so must the cell.
  it('keeps the “minimums remain elsewhere” clause wherever the headline has it', () => {
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      if (/minimums remain elsewhere/i.test(rule.headline)) {
        expect(rule.cellLabel, `${slug} dropped its qualifying clause`).toMatch(
          /minimums remain elsewhere/i,
        )
      }
    }
  })

  it('renders an em-dash when no rule exists', () => {
    expect(parkingCell(undefined)).toBe('—')
  })
})
