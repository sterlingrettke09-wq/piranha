import { describe, it, expect } from 'vitest'
import { resolveChicago, CHICAGO_LIMITS, CHICAGO_BASE_FAR, CHICAGO_RESIDENTIAL } from './chicago'

// Every number below is pinned to the Chicago Zoning Ordinance (Title 17) tables
// cited in chicago.ts. These tests are the guard against silently changing a
// sourced figure — and against the dash-suffix parser drifting.
describe('resolveChicago — B/C district FAR by dash suffix (§17-3-0403-A)', () => {
  it.each([
    ['B1-1', 1.2],
    ['B3-2', 2.2], // the spec's worked example: suffix 2 → 2.2
    ['B3-3', 3.0],
    ['B3-5', 5.0],
    ['C1-2', 2.2],
    ['C3-5', 5.0],
    ['B1-1.5', 1.5], // dash 1.5
  ])('%s → FAR %f', (zone, far) => {
    expect(resolveChicago(zone).far).toBe(far)
  })
})

describe('resolveChicago — B/C district height (§17-3-0408-A)', () => {
  it('dash 1 / 1.5 publish a flat 38 ft (frontage-independent)', () => {
    expect(resolveChicago('B1-1').heightFt).toBe(38)
    expect(resolveChicago('C1-1.5').heightFt).toBe(38)
  })
  it('dash 2 / 3 / 5 height VARIES by lot frontage → null (never guessed)', () => {
    expect(resolveChicago('B3-2').heightFt).toBeNull()
    expect(resolveChicago('B3-3').heightFt).toBeNull()
    expect(resolveChicago('C3-5').heightFt).toBeNull()
  })
})

describe('resolveChicago — D downtown FAR (§17-4-0405-A) with no height (§17-4-0407)', () => {
  it.each([
    ['DC-12', 12.0],
    ['DX-5', 5.0],
    ['DX-7', 7.0],
    ['DR-3', 3.0],
    ['DC-16', 16.0],
  ])('%s → base FAR %f, height null', (zone, far) => {
    const r = resolveChicago(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull() // D districts have no max height limit
  })
})

describe('resolveChicago — M manufacturing FAR (§17-5-0404-A)', () => {
  it.each([
    ['M1-2', 2.2],
    ['M2-2', 2.2],
    ['M3-3', 3.0],
    ['M1-1', 1.2],
  ])('%s → FAR %f, height null', (zone, far) => {
    const r = resolveChicago(zone)
    expect(r.far).toBe(far)
    expect(r.heightFt).toBeNull()
  })
})

describe('resolveChicago — residential base FAR (§17-2-0304-A)', () => {
  it.each([
    ['RS-1', 0.5],
    ['RS-2', 0.65],
    ['RS-3', 0.9],
    ['RT-3.5', 1.05],
    ['RT-4', 1.2],
    ['RM-4.5', 1.7],
    ['RM-5', 2.0],
    ['RM-5.5', 2.5],
    ['RM-6', 4.4],
    ['RM-6.5', 6.6],
  ])('%s → FAR %f', (zone, far) => {
    expect(resolveChicago(zone).far).toBe(far)
  })
})

// ── §17-2-0311-A "Maximum Building Height (feet)" ─────────────────────────
//
// REGRESSION GUARD. Until 2026-08-05 every residential district in this module
// returned heightFt: null, justified by a comment claiming residential heights
// "vary by district and building type". §17-2-0311-A publishes ONE
// frontage-independent figure for RS1/RS2/RS3/RT3.5/RT4, so the null was not a
// "varies" case at all — it was a missing lookup that rendered downstream as
// "no district height limit available", the permissive direction, on the four
// lowest-density district families in Chicago.
//
// OLD (WRONG) VALUE FOR ALL FIVE: null.
// Re-read against the live ordinance text on codelibrary.amlegal.com, Chicago
// Zoning Ordinance §17-2-0300 Bulk and density standards, on 2026-08-05. The
// verbatim RS1 row is:
//   "RS1 | Principal residential buildings: 30
//          Principal nonresidential buildings: None"
// The figure carried is the PRINCIPAL RESIDENTIAL one; the "None" in every row
// belongs to the nonresidential column and must never be read as our answer.
describe('resolveChicago — residential height (§17-2-0311-A)', () => {
  it.each([
    ['RS-1', 30],
    ['RS-2', 30],
    ['RS-3', 30],
    ['RT-3.5', 35],
    ['RT-4', 38],
  ])('%s → heightFt %i (was null before 2026-08-05)', (zone, heightFt) => {
    expect(resolveChicago(zone).heightFt).toBe(heightFt)
    expect(resolveChicago(zone).heightFt).not.toBeNull()
  })

  // Not a rounding difference between neighbouring districts: RT3.5 and RT4 are
  // genuinely 35 and 38, and RS1/RS2/RS3 are genuinely all 30 despite three
  // different FARs. Pin the shape so a future "tidy-up" can't smooth it.
  it('RS1, RS2 and RS3 share 30 ft even though their FARs differ', () => {
    const rs = ['RS-1', 'RS-2', 'RS-3'].map(resolveChicago)
    expect(rs.map((r) => r.heightFt)).toEqual([30, 30, 30])
    expect(rs.map((r) => r.far)).toEqual([0.5, 0.65, 0.9])
  })

  // §17-2-0311-A gives RM4.5/RM5 45 ft under 32 ft of lot frontage and 47 ft at
  // or above it; RM5.5 is 47 ft at/under 75 ft and 60 ft over. This module is
  // never given lot frontage, so publishing either endpoint would be a guess
  // and publishing the larger would be rule 6. Null is correct HERE — and the
  // basis records that it is a "varies", not a lookup miss.
  it.each([
    ['RM-4.5', 'varies-by-lot-frontage'],
    ['RM-5', 'varies-by-lot-frontage'],
    ['RM-5.5', 'varies-by-lot-frontage'],
  ])('%s height varies by lot frontage → null, basis %s', (zone, basis) => {
    expect(resolveChicago(zone).heightFt).toBeNull()
    expect(CHICAGO_RESIDENTIAL[zone].heightBasis).toBe(basis)
  })

  // §17-2-0311-A RM6/RM6.5: "Principal residential buildings: None (tall
  // buildings require Planned Development approval…)". The code imposes no
  // height cap. Same null on the wire as a "varies", but a DIFFERENT basis —
  // rule 5: a known absence and a missing lookup must be distinguishable.
  it.each(['RM-6', 'RM-6.5'])('%s has no height limit in the code, not a gap', (zone) => {
    expect(resolveChicago(zone).heightFt).toBeNull()
    expect(CHICAGO_RESIDENTIAL[zone].heightBasis).toBe('no-limit-in-code')
  })

  // RT4A has no row in §17-2-0311-A. The only height §17-2-0311 attaches to
  // accessible-unit buildings is the §17-2-0311-B(2) exemption — 42 ft, and
  // only for RT4 buildings of ≤19 units with ≥25% Type A units. That is a
  // conditional exemption, not a district-wide by-right ceiling, so 42 must NOT
  // be published as RT4A's height.
  it('RT-4A publishes no height (and never the conditional 42 ft)', () => {
    const r = resolveChicago('RT-4A')
    expect(r.heightFt).toBeNull()
    expect(r.heightFt).not.toBe(42)
    expect(CHICAGO_RESIDENTIAL['RT-4A'].heightBasis).toBe('not-listed-in-table')
  })

  // Every row of §17-2-0311-A ends "Principal nonresidential buildings: None".
  // Reading that column instead of the residential one would put null on RS1.
  it('no residential district silently borrows the nonresidential "None"', () => {
    for (const zone of ['RS-1', 'RS-2', 'RS-3', 'RT-3.5', 'RT-4']) {
      expect(CHICAGO_RESIDENTIAL[zone].heightBasis).toBe('published')
    }
  })
})

// Rule 14: the height disposition is a required property of every residential
// entry, so a new district cannot be added with its height quietly dropped. The
// type already forbids it; this asserts the table has no gap at runtime too.
describe('CHICAGO_RESIDENTIAL — every district states its height disposition', () => {
  it('covers all 11 R districts of §17-2-0304-A / §17-2-0311-A', () => {
    expect(Object.keys(CHICAGO_RESIDENTIAL).sort()).toEqual(
      [
        'RM-4.5',
        'RM-5',
        'RM-5.5',
        'RM-6',
        'RM-6.5',
        'RS-1',
        'RS-2',
        'RS-3',
        'RT-3.5',
        'RT-4',
        'RT-4A',
      ].sort(),
    )
  })

  it('every entry carries a basis, a citation note, and a consistent height', () => {
    for (const [district, r] of Object.entries(CHICAGO_RESIDENTIAL)) {
      expect(r.heightBasis, district).toBeTruthy()
      expect(r.note, district).toMatch(/§17-2-03/)
      // 'published' is the ONLY basis allowed to carry a number, and it must.
      if (r.heightBasis === 'published') expect(typeof r.heightFt, district).toBe('number')
      else expect(r.heightFt, district).toBeNull()
    }
  })

  it('CHICAGO_BASE_FAR is derived from it, so the two cannot disagree', () => {
    for (const [district, r] of Object.entries(CHICAGO_RESIDENTIAL)) {
      expect(CHICAGO_BASE_FAR[district], district).toBe(r.far)
    }
    expect(Object.keys(CHICAGO_BASE_FAR).length).toBe(Object.keys(CHICAGO_RESIDENTIAL).length)
  })
})

describe('resolveChicago — unknown / "varies" → null (never fabricated)', () => {
  it('unknown district → both null, WITH a reason', () => {
    // ⚠️ The numbers still must not be fabricated — but a bare null said nothing
    // about WHY, so a Planned Development (whose envelope comes from its own
    // approved plan, an ANSWER) rendered identically to a string we cannot read.
    expect(resolveChicago('PD-1')).toMatchObject({ far: null, heightFt: null, farBasis: 'planned-development' })
    expect(resolveChicago('POS-1')).toMatchObject({ far: null, heightFt: null, farBasis: 'unrecognised-district' })
  })
  it('an out-of-range dash suffix (no published row) → null FAR', () => {
    expect(resolveChicago('B3-4').far).toBeNull() // no dash-4 in §17-3-0403-A
    expect(resolveChicago('DX-99').far).toBeNull()
  })
  it('null / empty / garbage input → null, and says the district was unreadable', () => {
    for (const z of [null, undefined, '', 'not-a-zone']) {
      expect(resolveChicago(z)).toMatchObject({
        far: null,
        heightFt: null,
        heightBasis: 'unrecognised-district',
        farBasis: 'unrecognised-district',
      })
    }
  })

  it('⚠️ every result carries a basis — a bare null is unrepresentable', () => {
    // rule 20: pinned over a NON-EMPTY set that includes each shape the resolver
    // can take, so this cannot pass by finding nothing.
    const zones = ['RS-3', 'RT-4', 'B3-2', 'B3-4', 'DX-12', 'M1-1', 'PD 1043', 'POS-1', 'not-a-zone']
    for (const z of zones) {
      const r = resolveChicago(z)
      expect(r.heightBasis, z).toBeDefined()
      expect(r.farBasis, z).toBeDefined()
    }
    // ⚠️ And the four null-height causes are genuinely DISTINCT — the point of
    // the field. B3-2 has no row; DX is a class this module does not read for
    // height; a PD is answered by its own plan; garbage is a gap in our reading.
    expect(resolveChicago('B3-2').heightBasis).toBe('not-listed-in-table')
    expect(resolveChicago('DX-12').heightBasis).toBe('class-not-read')
    expect(resolveChicago('RS-3').heightBasis).toBe('published')
    expect(resolveChicago('not-a-zone').heightBasis).toBe('unrecognised-district')
  })
  it('is case- and whitespace-insensitive', () => {
    expect(resolveChicago('  b3-2  ').far).toBe(2.2)
  })
})

describe('CHICAGO_LIMITS static table stays in lock-step with resolveChicago', () => {
  it('covers ≥20 common districts', () => {
    expect(Object.keys(CHICAGO_LIMITS).length).toBeGreaterThanOrEqual(20)
  })
  it('each stored entry equals the resolver output for that district', () => {
    for (const [district, limits] of Object.entries(CHICAGO_LIMITS)) {
      expect(limits).toEqual(resolveChicago(district))
    }
  })
})

describe('CHICAGO_BASE_FAR is still exported for the provider', () => {
  it('exposes the residential base FAR table', () => {
    expect(CHICAGO_BASE_FAR['RM-5']).toBe(2.0)
    expect(CHICAGO_BASE_FAR['RM-4.5']).toBe(1.7)
  })
})

// Chicago's GIS spells the same residential district three ways. `RM-4.5` (470
// parcels) resolved; `RM4.5` (8) and `RM4-.5` (1) fell through to a null FAR and
// then to the lot-area placeholder — a gap where the answer was knowable.
//
// Found by scripts/enumerate-parser-domains.ts against the live layer, which is
// the only thing that could have found it: no null is *wrong* here, no test
// covered a spelling nobody knew existed, and the value is a legal string for
// the field. Same class as the LA qualifier defect.
describe('punctuation variants of a residential class resolve to the same FAR', () => {
  it.each([
    ['RM4.5', 1.7],
    ['RM4-.5', 1.7],
    ['RM5.5', 2.5],
    ['rm4.5', 1.7],
  ])('%s → FAR %s', (zone, far) => {
    expect(resolveChicago(zone).far).toBe(far)
  })

  it('agrees with the canonical hyphenated spelling', () => {
    expect(resolveChicago('RM4.5')).toEqual(resolveChicago('RM-4.5'))
    expect(resolveChicago('RM5.5')).toEqual(resolveChicago('RM-5.5'))
  })

  // The normalization must carry the §17-2-0311-A height too, not just FAR —
  // otherwise the `RM4.5`-spelled parcels behave differently from `RS1`-spelled
  // ones on height.
  it('carries the height through the unhyphenated spelling', () => {
    expect(resolveChicago('RS1').heightFt).toBe(30)
    expect(resolveChicago('RT3.5').heightFt).toBe(35)
    expect(resolveChicago('RT4')).toEqual(resolveChicago('RT-4'))
  })

  // The normalization is only safe while stripping hyphens keeps every
  // residential key distinct. Adding a district that collides would silently
  // publish one district's FAR for another — so the collision is a test
  // failure, not a comment (rule 14).
  it('no two residential districts collide once hyphens are stripped', () => {
    const stripped = Object.keys(CHICAGO_BASE_FAR).map((k) => k.replace(/-/g, ''))
    expect(new Set(stripped).size).toBe(stripped.length)
  })

  // The hyphen is SEMANTIC for B/C/D/M — "B3-2" splits on it. Stripping there
  // would turn a suffix into part of the prefix.
  it('does not disturb B/C/D/M, where the hyphen separates prefix from suffix', () => {
    expect(resolveChicago('B3-2').far).toBe(2.2)
    expect(resolveChicago('DX-7').far).toBe(7)
    expect(resolveChicago('B32').far).toBeNull()
  })

  // PD/PMD/POS/T carry no by-right FAR. Null is the ANSWER, not a lookup miss,
  // and normalization must not invent one for them.
  it.each(['PD 1024', 'PMD13', 'POS-1', 'POS-2', 'T'])('%s still resolves to no FAR', (zone) => {
    expect(resolveChicago(zone).far).toBeNull()
  })
})
