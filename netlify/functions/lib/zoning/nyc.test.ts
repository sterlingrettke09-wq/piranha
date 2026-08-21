import { describe, it, expect } from 'vitest'
import { resolveNyc, NYC_LIMITS, NYC_CONTEXTUAL_HEIGHTS, NYC_COMMERCIAL_EQUIVALENT } from './nyc'

// Every height below is pinned to ZR 23-432 ("Height and setback requirements",
// last amended 12/5/2024 by City of Yes for Housing Opportunity), table
// "MINIMUM BASE HEIGHT, MAXIMUM BASE HEIGHT, AND MAXIMUM BUILDING HEIGHTS",
// column "Standard residences → Maximum height of buildings or other structures".
// Verified 2026-08-05 by parsing the published table on both official hosts.
//
// WHY THE OLD NUMBERS ARE NAMED IN THE TEST TITLES: this file previously pinned
// the figures from ZR 23-662, which the 12/5/2024 amendment REPEALED (that URL
// now 404s). The old assertions were green the whole time — they encoded a
// stale edition of the code, not a wrong reading of it. Naming the superseded
// figure makes any regression identify itself as "we went back to 23-662".
describe('resolveNyc — contextual R-district max building height (ZR 23-432, standard residences)', () => {
  it.each([
    // [district, current ZR 23-432 ft, superseded ZR 23-662 ft or null if unchanged]
    ['R6A', 75, 70], // row "R6A, R6¹, R6-1"
    ['R6B', 55, 50], // row "R6B"
    ['R7A', 85, 80], // row "R7A, R7-1¹, R7-2¹"
    ['R7B', 75, null], // row "R7B" — unchanged by the amendment
    ['R7D', 105, 100], // row "R7D"
    ['R7X', 125, 120], // row "R7X, R7-3" — old Manhattan-Core split is gone
    ['R8A', 125, 120], // row "R8A"
    ['R8B', 75, null], // row "R8B" — unchanged by the amendment
    ['R8X', 155, 150], // row "R8X"
    ['R9A', 135, null], // R9A¹ 145 / R9A² 135 → conservative narrow-street row
    ['R9X', 165, 160], // R9X¹ 175 / R9X² 165 → conservative narrow-street row
    ['R10A', 185, null], // R10A¹ 215 / R10A² 185 → conservative narrow-street row
  ])(
    '%s → ZR 23-432 max building height %i ft (superseded 23-662 figure: %s), far null',
    (zone, ft, superseded) => {
      const r = resolveNyc(zone as string)
      expect(r.heightFt).toBe(ft)
      expect(r.far).toBeNull() // FAR always from provider farByUse, never this table
      // A regression to the repealed edition must fail loudly, not silently.
      if (superseded !== null) expect(r.heightFt).not.toBe(superseded)
    },
  )
})

describe('ZR 23-432 splits by street width — we store the LOWER (narrow-street) row', () => {
  // Footnotes to ZR 23-432: ¹ = within 100 ft of a wide street; ² = on a narrow
  // street beyond 100 ft of a wide street. We carry no per-parcel frontage
  // geometry, so the ² row is the only defensible bound.
  it.each([
    ['R9A', 135, 145],
    ['R9X', 165, 175],
    ['R10A', 185, 215],
    ['R10X', 185, 215],
  ])('%s stores the ² row %i ft, never the ¹ wide-street row %i ft', (zone, narrow, wide) => {
    expect(resolveNyc(zone as string).heightFt).toBe(narrow)
    expect(resolveNyc(zone as string).heightFt).not.toBe(wide)
  })
})

describe('ZR 23-432 qualifying-housing columns are an incentive program — never reported', () => {
  // Each row carries a taller "qualifying affordable housing or qualifying
  // senior housing" max height. That is a program the user has not chosen, so
  // the standard-residence column is the by-right figure (CLAUDE.md rule 6).
  it.each([
    ['R6A', 75, 95],
    ['R6B', 55, 65],
    ['R7A', 85, 115],
    ['R7D', 105, 125],
    ['R8A', 125, 145],
  ])(
    '%s reports the standard-residence %i ft, not the qualifying-housing %i ft',
    (zone, standard, qualifying) => {
      expect(resolveNyc(zone as string).heightFt).toBe(standard)
      expect(resolveNyc(zone as string).heightFt).not.toBe(qualifying)
    },
  )
})

describe('R9D / R10X now have a published flat height (was asserted absent on a repealed rationale)', () => {
  // A prior test in this file asserted `'R9D' in NYC_CONTEXTUAL_HEIGHTS === false`
  // with the rationale "Table-1 max height is N/A → tower regs". That was true
  // of ZR 23-662 and is false of ZR 23-432, which publishes both figures. The
  // green test was defending the stale interpretation (CLAUDE.md rule 15).
  it('R9D → 175 ft (ZR 23-432 row "R9D, R9-1"), previously null', () => {
    expect(resolveNyc('R9D').heightFt).toBe(175)
  })
  it('R10X → 185 ft (ZR 23-432 R10X² row), previously null', () => {
    expect(resolveNyc('R10X').heightFt).toBe(185)
  })
})

describe('resolveNyc — commercial districts mapped to a contextual equivalent (ZR 34-112)', () => {
  it.each([
    ['C4-2A', 75], // → R6A
    ['C1-6A', 85], // → R7A
    ['C4-4A', 85], // → R7A
    ['C4-5D', 105], // → R7D
    ['C4-5X', 125], // → R7X
    ['C6-2A', 125], // → R8A
    ['C6-3A', 135], // → R9A
    ['C2-7X', 165], // → R9X
    ['C6-4A', 185], // → R10A
  ])('%s → equivalent contextual height %i ft', (zone, ft) => {
    expect(resolveNyc(zone).heightFt).toBe(ft)
  })
})

describe('resolveNyc — bare (non-contextual) R districts → null, now a GAP not an answer', () => {
  // Under the repealed text these were sky-exposure-plane / height-factor
  // governed and null was an ANSWER. ZR 23-432 now applies to "R6 R7 R8 R9 R10
  // R11 R12" and publishes flat heights for them too, so null is a gap we have
  // not closed. Pinned so the behaviour change is deliberate when it happens.
  it.each([
    'R6', // ZR 23-432 publishes R6¹ 75 / R6² 55 — not yet carried
    'R7-1',
    'R7-2',
    'R8',
    'R10',
  ])('%s → height null (not yet carried; see KNOWN GAP note)', (zone) => {
    expect(resolveNyc(zone).heightFt).toBeNull()
  })

  it('C6-7 (downtown, residential equivalent bare R10) → null height', () => {
    // C6-7 maps to R10 (no letter) in ZR 34-112 → not carried → null.
    // This is exactly the parcel.test.ts NYC fixture: maxHeightFt must stay null.
    expect(resolveNyc('C6-7').heightFt).toBeNull()
  })
})

describe('resolveNyc — unknown / empty / garbage → null (never fabricated)', () => {
  it.each([null, undefined, '', 'not-a-zone', 'M1-1', 'PARK'])('%s → both null', (zone) => {
    expect(resolveNyc(zone)).toMatchObject({ far: null, heightFt: null })
  })

  it('⚠️ a sky-exposure-plane district is an ANSWER, not the same null as garbage', () => {
    // NYC's non-contextual districts are governed by a sky exposure plane, so
    // the ZR states no maximum height — that is what the code says, not a lookup
    // this module failed. Rendering it identically to an unreadable string is
    // rule 5's failure, and it was the state before the basis existed.
    for (const z of ['C4-4', 'M1-5', 'C6-4', 'R6']) {
      expect(resolveNyc(z).heightBasis, z).toBe('sky-exposure-plane')
    }
    for (const z of ['not-a-zone', 'PARK', '']) {
      expect(resolveNyc(z).heightBasis, z).toBe('unrecognised-district')
    }
  })

  it('⚠️ a commercial equivalent is labelled as one', () => {
    // C4-4A's figure is R7A's, reached through NYC_COMMERCIAL_EQUIVALENT. A
    // reader checking C4-4A against § 23-432 will not find it there, so the
    // route has to be on the answer.
    expect(resolveNyc('C4-4A')).toMatchObject({ heightFt: 85, heightBasis: 'commercial-equivalent' })
    expect(resolveNyc('R7A').heightBasis).toBe('published')
  })

  it('⚠️ farBasis says the FAR was never read here, rather than implying none', () => {
    // Every `far` this module returns is null because it reads no FAR table. For
    // NYC in particular, letting that null imply "the city imposes no FAR" would
    // be badly wrong — FAR is the primary residential control there.
    for (const z of ['R6A', 'C4-4', 'not-a-zone']) {
      expect(resolveNyc(z).farBasis, z).toBe('not-read-here')
      expect(resolveNyc(z).far, z).toBeNull()
    }
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveNyc('  r7a  ').heightFt).toBe(85)
  })
  it('strips a commercial-overlay tail ("R7A/C2-4" → R7A)', () => {
    expect(resolveNyc('R7A/C2-4').heightFt).toBe(85)
  })
})

describe('NYC_LIMITS static table stays in lock-step with resolveNyc', () => {
  it('covers the contextual districts + C-equivalents + non-contextual examples', () => {
    expect(Object.keys(NYC_LIMITS).length).toBeGreaterThanOrEqual(14)
  })
  it('each stored entry equals the resolver output for that district', () => {
    for (const [district, limits] of Object.entries(NYC_LIMITS)) {
      expect(limits).toEqual(resolveNyc(district))
    }
  })
  it('every contextual-height entry has a null FAR (FAR is PLUTO-sourced)', () => {
    for (const limits of Object.values(NYC_LIMITS)) {
      expect(limits.far).toBeNull()
    }
  })
  it('no height in the table is a repealed ZR 23-662 figure for its district', () => {
    // Spot-guard on the four districts the amendment moved by +5 ft.
    const repealed: Record<string, number> = { R6A: 70, R6B: 50, R7A: 80, R7D: 100 }
    for (const [district, ft] of Object.entries(repealed)) {
      expect(NYC_CONTEXTUAL_HEIGHTS[district]).not.toBe(ft)
    }
  })
})

describe('NYC_COMMERCIAL_EQUIVALENT only maps to districts present in the height table', () => {
  it('every commercial equivalent resolves to a known contextual height', () => {
    for (const equiv of Object.values(NYC_COMMERCIAL_EQUIVALENT)) {
      expect(equiv in NYC_CONTEXTUAL_HEIGHTS).toBe(true)
    }
  })
})
