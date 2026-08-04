import { describe, it, expect } from 'vitest'
import { resolveDenver, DENVER_LIMITS } from './denver'

// Defect-7 sweep, Denver. The DZC is form-based: Articles 3-9 govern by height,
// setbacks and bulk plane, with no FAR. That is a KNOWN ABSENCE and must be
// distinguishable from "we did not resolve a FAR" — otherwise defaultSpec falls
// back to an unsourced FAR-1.0 assumption.
// See docs/plans/2026-08-04-far-unconstrained-sweep.md

describe('Denver — form-based districts are UNCONSTRAINED (known absence)', () => {
  it('marks every curated district unconstrained', () => {
    const codes = Object.keys(DENVER_LIMITS)
    expect(codes.length).toBeGreaterThan(20)
    for (const code of codes) {
      expect(DENVER_LIMITS[code].farUnconstrained, code).toBe(true)
      expect(DENVER_LIMITS[code].far, code).toBeNull()
    }
  })

  it('marks a parseable stories suffix unconstrained', () => {
    // Not in the curated table, but a valid post-2010 form-based code.
    const r = resolveDenver('C-MX-16')
    expect(r.farUnconstrained).toBe(true)
    expect(r.far).toBeNull()
    expect(r.heightFt).toBe(192)
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
