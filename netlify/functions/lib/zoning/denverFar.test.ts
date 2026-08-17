import { describe, it, expect } from 'vitest'
import { resolveDenver, DENVER_LIMITS, DENVER_FT_PER_STORY } from './denver'

// Defect-7 sweep, Denver. The DZC is form-based: Articles 3-9 govern by height,
// setbacks and bulk plane, with no FAR. That is a KNOWN ABSENCE and must be
// distinguishable from "we did not resolve a FAR" — otherwise defaultSpec falls
// back to an unsourced FAR-1.0 assumption.
// See docs/plans/2026-08-04-far-unconstrained-sweep.md

// Article 9 districts encoded 2026-08-17 from tables that state neither a story
// count nor an unconstrained FAR. They are declared here ONCE so each guard below
// narrows for a stated reason rather than being loosened:
//   I-A, I-B  — SITING/ZONE LOT row publishes "Floor Area Ratio (FAR) (max) 2.0",
//               and the HEIGHT rows read "Stories na / Feet na" with a 75' cap
//               only within 175' of a Protected District. A FAR and no usable
//               height: the exact inverse of the form-based pattern.
//   MHC       — the Manufactured Home form's HEIGHT table is one unconditional
//               "Feet (max) 20'" with no stories row. Its siting table has no
//               ZONE LOT section at all, which is the slot test's positive
//               evidence for farUnconstrained.
const ARTICLE_9_EXCEPTIONS = new Set(['I-A', 'I-B', 'MHC'])

describe('Denver — form-based districts are UNCONSTRAINED (known absence)', () => {
  it('marks every curated district unconstrained', () => {
    // NARROWED: I-A / I-B publish FAR 2.0, so "every curated district is
    // unconstrained" is false of the table as a whole. It remains true — and is
    // still the point — for the form-based districts.
    const codes = Object.keys(DENVER_LIMITS).filter((c) => !ARTICLE_9_EXCEPTIONS.has(c))
    expect(codes.length).toBeGreaterThan(20)
    for (const code of codes) {
      expect(DENVER_LIMITS[code].farUnconstrained, code).toBe(true)
      expect(DENVER_LIMITS[code].far, code).toBeNull()
    }
    // The exceptions, asserted rather than merely skipped.
    expect(DENVER_LIMITS['I-A'].far).toBe(2.0)
    expect(DENVER_LIMITS['I-B'].far).toBe(2.0)
    expect(DENVER_LIMITS['MHC'].farUnconstrained).toBe(true)
  })

  it('marks a parseable stories suffix unconstrained', () => {
    // A valid post-2010 form-based code that is NOT in the curated table.
    const r = resolveDenver('G-MU-7')
    expect(r.farUnconstrained).toBe(true)
    expect(r.far).toBeNull()
    expect(r.heightFt).toBe(84) // 7 × 12, and flagged as an estimate:
    expect(r.heightBasis).toBe('derived-estimate')
  })

  it('C-MX-16 is now code-stated at 200 ft, not the 192 ft this once asserted', () => {
    // This case used to assert heightFt === 192 (16 × 12). DZC Art. 7
    // §7.3.3.3.D "General", p. 7.3-13, prints "Feet (max) 200'" for C-MX-16.
    const r = resolveDenver('C-MX-16')
    expect(r.heightFt).toBe(200)
    expect(r.heightFt).not.toBe(192)
    expect(r.farUnconstrained).toBe(true)
  })

  it('marks SU/TU/RH letter-suffix districts unconstrained', () => {
    for (const z of ['E-SU-G', 'U-TU-C', 'U-RH-2.5A']) {
      expect(resolveDenver(z).farUnconstrained, z).toBe(true)
    }
  })
})

describe('Denver — these must stay UNRESOLVED, not unconstrained', () => {
  it('Former Chapter 59 districts are NOT marked unconstrained', () => {
    // Chapter 59 was a conventional Euclidean code that DID impose FAR in some
    // districts. We do not carry that table, so the honest output is a gap.
    const r = resolveDenver('B-3', { formerChapter59: true })
    expect(r.farUnconstrained).toBeUndefined()
    expect(r.far).toBeNull()
    expect(r.heightFt).toBeNull()
  })

  it('an unrecognised code is NOT marked unconstrained', () => {
    const r = resolveDenver('NOT-A-REAL-ZONE-XYZ')
    expect(r.farUnconstrained).toBeUndefined()
    expect(r.far).toBeNull()
  })

  it('a missing code is NOT marked unconstrained', () => {
    expect(resolveDenver(null).farUnconstrained).toBeUndefined()
    expect(resolveDenver(undefined).farUnconstrained).toBeUndefined()
    expect(resolveDenver('').farUnconstrained).toBeUndefined()
  })
})

describe('Denver — the two null states stay distinguishable', () => {
  it('form-based and unresolved both have null FAR but differ on the flag', () => {
    const formBased = resolveDenver('C-MX-5')
    const unresolved = resolveDenver('B-3', { formerChapter59: true })
    expect(formBased.far).toBe(unresolved.far) // both null
    expect(formBased.farUnconstrained).not.toBe(unresolved.farUnconstrained)
  })

  it('never invents a FAR for any input', () => {
    for (const z of ['C-MX-5', 'B-3', 'garbage', '', 'U-SU-A']) {
      expect(resolveDenver(z).far, z).toBeNull()
    }
  })
})

// ── Story count must come from the code, never from dividing feet ──
// Denver's module multiplied stories by 12 ft; the envelope divided by 11 ft.
// The two do not cancel: C-MX-12 published 13 stories, C-MX-16 → 17, C-MX-20 → 21.
// Measured 2026-08-04. See CLAUDE.md rule 12.
describe('Denver — stories are stated, not re-derived', () => {
  it.each([['U-MX-3',3],['C-MX-5',5],['C-MX-8',8],['C-MX-12',12]])(
    '%s carries stories=%s from the curated table', (z, n) => {
      expect(resolveDenver(z as string).stories).toBe(n)
    })

  it.each([['C-MX-16',16],['C-MX-20',20],['G-MU-7',7]])(
    '%s carries stories=%s from the trailing-token branch', (z, n) => {
      expect(resolveDenver(z as string).stories).toBe(n)
    })

  it('EVERY curated entry carries a story count', () => {
    // The regression that survived the first fix: pattern branches were patched
    // and the curated table was not, so exact-match codes kept drifting.
    // ⚠️ NARROWED, NOT WEAKENED. This guard exists so a hand-written entry
    // cannot silently DROP a story count the code states — the Denver
    // story-count regression it was built for. The three Article 9 exceptions
    // are not dropped counts: the code states no storeys for them at all
    // ("Stories (max) na" for I-A/I-B; MHC's height table has no stories row).
    // Asserting they carry one would demand a figure the DZC does not print.
    for (const [code, lim] of Object.entries(DENVER_LIMITS)) {
      if (ARTICLE_9_EXCEPTIONS.has(code)) continue
      expect(lim.stories, code).toBeGreaterThan(0)
    }
    // And the exceptions must carry NO story count — so a later edit cannot
    // quietly invent one for them either.
    for (const code of ARTICLE_9_EXCEPTIONS) {
      expect(DENVER_LIMITS[code].stories ?? null, code).toBeNull()
    }
  })

  // ⚠️ The assertion that used to live here was:
  //
  //     expect(Math.round(lim.stories * DENVER_FT_PER_STORY)).toBe(lim.heightFt)
  //
  // It looped over EVERY curated entry and demanded height === stories × 12.
  // It was green, it was well explained, and it was pinning the defect in
  // place: the DZC prints C-MX-5 at 70', C-MX-8 at 110', C-MX-12 at 150', and
  // this test asserted 60/96/144. Correcting the data required deleting a
  // passing test — CLAUDE.md rule 15. Its replacement asserts the invariant
  // that is actually true: every entry declares WHERE its feet came from, and
  // only the unverified ones may equal stories × 12.
  it('every curated entry declares its height basis', () => {
    // Scoped to entries that HAVE a height. DistrictLimits documents
    // `heightBasis` as "Absent only where heightFt is null", and I-A/I-B are
    // exactly that case — the DZC prints "Feet (max) na" for them. The test was
    // stricter than the contract it was checking.
    for (const [code, lim] of Object.entries(DENVER_LIMITS)) {
      if (lim.heightFt == null) continue
      expect(['code-stated', 'derived-estimate'], code).toContain(lim.heightBasis)
    }
    // And an entry WITHOUT a height must not carry a basis either — a basis
    // describes where a figure came from, so it cannot outlive the figure.
    for (const [code, lim] of Object.entries(DENVER_LIMITS)) {
      if (lim.heightFt == null) expect(lim.heightBasis, code).toBeUndefined()
    }
  })

  it('a code-stated height is NEVER stories × 12 — that is the defect signature', () => {
    // Needs BOTH a code-stated height and a story count to compare. MHC has a
    // code-stated 20' and no storeys (its height table prints no stories row),
    // so it is out of this guard's scope rather than an exception to it.
    const coded = Object.entries(DENVER_LIMITS).filter(
      ([, l]) => l.heightBasis === 'code-stated' && l.stories != null,
    )
    expect(coded.length).toBeGreaterThanOrEqual(12) // all of Article 7
    for (const [code, lim] of coded) {
      expect(lim.heightFt, code).not.toBe(
        Math.round((lim.stories as number) * DENVER_FT_PER_STORY),
      )
      // The code's printed feet exceed the 12 ft/story estimate everywhere in
      // Article 7 — the old derivation was biased LOW, not merely different.
      expect(lim.heightFt as number, code).toBeGreaterThan(
        (lim.stories as number) * DENVER_FT_PER_STORY,
      )
    }
  })

  it('only derived-estimate entries may equal stories × 12', () => {
    for (const [code, lim] of Object.entries(DENVER_LIMITS)) {
      if (lim.heightFt === Math.round((lim.stories as number) * DENVER_FT_PER_STORY)) {
        expect(lim.heightBasis, code).toBe('derived-estimate')
      }
    }
  })

  it('unresolved codes carry NO story count', () => {
    expect(resolveDenver('B-3', { formerChapter59: true }).stories ?? null).toBeNull()
    expect(resolveDenver('NOT-A-ZONE').stories ?? null).toBeNull()
  })
})
