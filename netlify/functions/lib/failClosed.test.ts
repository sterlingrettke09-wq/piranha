import { describe, it, expect } from 'vitest'
import { assessFeasibility } from './feasibility'
import { assessHurdles } from './hurdles'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { ParcelInfo } from '../../../src/types/parcel'

// FAIL-CLOSED AUDIT (2026-08-05). Five defect classes ran permissive because
// "we could not resolve a constraint" collapsed into "there is no constraint".
// The boundary: does the output make a claim about what the CODE PERMITS?
//   verdicts + size-triggered required hurdles → block / downgrade
//   cost + timeline estimates                  → keep, disclosed
// `assumed-unconstrained` passes everything: the code affirmatively says no FAR.

const parcel = (o: Partial<ParcelInfo['zoning']> = {}): ParcelInfo =>
  ({
    address: 'x', addressBasis: 'record', parcelId: 'p', coordinates: [-71.06, 42.36],
    zoning: {
      districtCode: 'R-1', subdistrict: null, article: null,
      maxHeightFt: 60, maxFAR: 2, allowedUses: ['residential'], ...o,
    },
    lot: { sizeSqFt: 10000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {}, fetchedAt: '2026-08-05T00:00:00.000Z',
  })

const spec = (gfaBasis: AnalysisInput['gfaBasis'], over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  parcelId: 'p', city: 'boston', projectType: 'new', funding: 'private',
  lat: 42.36, lng: -71.06, use: 'residential', gfa: 10000, units: 20, gfaBasis, ...over,
})

describe('verdicts refuse to run on an assumed floor area', () => {
  it('assumed-far-1.0 forces INDETERMINATE — no claim about the law', () => {
    const f = assessFeasibility(parcel(), spec('assumed-far-1.0'))
    expect(f.overall).toBe('INDETERMINATE')
    expect(f.path).toBe('as_of_right') // path stays non-prohibitive; the VERDICT is what's withheld
  })

  it('explains why, rather than going silent', () => {
    const f = assessFeasibility(parcel(), spec('assumed-far-1.0'))
    const note = f.checks.find((c) => c.allowed === 'not published for this district')?.note ?? ''
    expect(note).toMatch(/placeholder/i)
    expect(note).toMatch(/not a code limit/i)
  })

  it('assumed-unconstrained does NOT block — the code affirmatively says no FAR', () => {
    const f = assessFeasibility(parcel(), spec('assumed-unconstrained'))
    expect(f.overall).not.toBe('INDETERMINATE')
  })

  it('an envelope-derived size keeps its verdict', () => {
    const f = assessFeasibility(parcel(), spec('envelope'))
    expect(f.overall).not.toBe('INDETERMINATE')
  })
})

describe('size-triggered REQUIRED hurdles downgrade on an assumed size', () => {
  const hurdlesFor = (b: AnalysisInput['gfaBasis']) =>
    assessHurdles('boston', parcel(), spec(b, { gfa: 30000, units: 20 }), { path: 'as_of_right' })

  it('a required size-dependent hurdle becomes info, not a legal claim', () => {
    const sized = hurdlesFor('assumed-far-1.0').filter((h) => h.sizeDependent)
    expect(sized.length).toBeGreaterThan(0)
    for (const h of sized) expect(h.status).toBe('info')
  })

  it('names the uncertainty rather than deleting the hurdle', () => {
    const sized = hurdlesFor('assumed-far-1.0').filter((h) => h.sizeDependent)
    for (const h of sized) expect(h.note).toMatch(/placeholder size/i)
  })

  it('keeps them REQUIRED when the size came from the envelope', () => {
    const sized = hurdlesFor('envelope').filter((h) => h.sizeDependent)
    expect(sized.length).toBeGreaterThan(0)
    expect(sized.some((h) => h.status === 'required')).toBe(true)
  })

  it('keeps them REQUIRED under a stated absence of FAR', () => {
    const sized = hurdlesFor('assumed-unconstrained').filter((h) => h.sizeDependent)
    expect(sized.some((h) => h.status === 'required')).toBe(true)
  })

  it('leaves already-hedged hurdles alone — they hedge in their own text', () => {
    const all = hurdlesFor('assumed-far-1.0')
    const untagged = all.filter((h) => !h.sizeDependent)
    // Nothing untagged was rewritten by the pass.
    for (const h of untagged) expect(h.note).not.toMatch(/placeholder size/i)
  })
})
