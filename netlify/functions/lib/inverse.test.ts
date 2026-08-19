import { describe, it, expect } from 'vitest'
import { whatWouldItTake, summariseInverse, type Target } from './inverse'
import { RELIEF_FACTOR_FAR, RELIEF_FACTOR_HEIGHT } from './feasibility'
import { avgUnitGrossSqFt } from '../../../src/config/estimates'
import type { ParcelInfo } from '../../../src/types/parcel'

const parcel = (z: Partial<ParcelInfo['zoning']> = {}, lotSqFt: number | null = 10000): ParcelInfo =>
  ({
    address: '1 Main St', addressBasis: 'record', parcelId: '1', coordinates: [-104.9, 39.7],
    zoning: {
      districtCode: 'R-2', subdistrict: null, article: null,
      maxHeightFt: 40, maxFAR: 1.0, allowedUses: ['residential', 'mixed'],
      ...z,
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    existing: { landUse: null },
    sources: {}, fetchedAt: '2026-08-19T00:00:00.000Z',
  }) as ParcelInfo

const ask = (t: Partial<Target>, p = parcel()) =>
  whatWouldItTake(p, 'denver', { use: 'residential', ...t })

const dim = (r: ReturnType<typeof ask>, d: string) => r.constraints.find((c) => c.dimension === d)

describe('no target', () => {
  it('says there is nothing to work back from, which is not "it fits"', () => {
    const r = ask({})
    expect(r.empty).toBe(true)
    expect(r.binding).toBeNull()
    expect(summariseInverse(r)).toMatch(/nothing to work back from/)
    // ⚠️ must NOT read as a clean bill of health.
    expect(summariseInverse(r)).not.toMatch(/fits/)
  })
})

describe('a unit target becomes a floor area, visibly', () => {
  it('uses the engine\'s own constant and SHOWS the derivation', () => {
    // If this used a different sq-ft-per-unit than the cost and feasibility
    // passes, the inverse would contradict the report on the same parcel.
    const r = ask({ units: 40 })
    expect(r.derivation[0]).toContain(`${(40 * avgUnitGrossSqFt).toLocaleString()} sq ft`)
    expect(r.derivation[0]).toContain(avgUnitGrossSqFt.toLocaleString())
    // 40 × 1300 = 52,000 sf on a 10,000 sf lot → FAR 5.2 against a limit of 1.0
    expect(dim(r, 'far')?.required).toBeCloseTo(5.2, 2)
    expect(dim(r, 'far')?.allowed).toBe(1)
  })

  it('prefers an explicit floor area over deriving one', () => {
    const r = ask({ units: 40, gfaSqFt: 9000 })
    expect(r.derivation.some((d) => d.includes('units →'))).toBe(false)
    expect(dim(r, 'far')?.required).toBeCloseTo(0.9, 3)
  })
})

describe('classifying the gap', () => {
  it('says nothing is needed when the target fits', () => {
    const r = ask({ gfaSqFt: 9000 })
    expect(dim(r, 'far')?.relief).toBe('none')
    expect(r.binding).toBeNull()
    expect(summariseInverse(r)).toMatch(/fits within what the district allows/)
  })

  it('calls a modest overage a variance, at exactly the forward pass\'s threshold', () => {
    // Pinned to the shared constant rather than a literal, so raising the factor
    // in feasibility.ts cannot silently leave the two directions disagreeing.
    const atLimit = 10000 * 1.0 * RELIEF_FACTOR_FAR
    expect(dim(ask({ gfaSqFt: atLimit }), 'far')?.relief).toBe('dimensional-variance')
    expect(dim(ask({ gfaSqFt: atLimit + 100 }), 'far')?.relief).toBe('beyond-variance')
  })

  it('and the same for height', () => {
    const at = 40 * RELIEF_FACTOR_HEIGHT
    expect(dim(ask({ heightFt: at }), 'height')?.relief).toBe('dimensional-variance')
    expect(dim(ask({ heightFt: at + 1 }), 'height')?.relief).toBe('beyond-variance')
  })

  it('names the instrument differently for the two grades', () => {
    expect(dim(ask({ gfaSqFt: 11000 }), 'far')?.note).toMatch(/a variance/)
    expect(dim(ask({ gfaSqFt: 52000 }), 'far')?.note).toMatch(/rezoning or a planned development/)
  })
})

describe('⚠️ an unresolved limit is not an absent constraint', () => {
  it('reports unknown, not none, when the FAR could not be read', () => {
    // The single most important behaviour here. "You need a height variance" is a
    // false completeness claim if nobody could read the FAR — it might be the
    // harder problem, and the user goes to the wrong hearing.
    const r = ask({ gfaSqFt: 52000, heightFt: 50 }, parcel({ maxFAR: null }))
    expect(dim(r, 'far')?.relief).toBe('unknown')
    expect(r.unresolved).toContain('far')
    expect(summariseInverse(r)).toMatch(/does not cover far/)
  })

  it('says so in the SAME sentence as the recommendation, not underneath it', () => {
    // Splitting a confident headline from a caveat is how a partial answer gets
    // read as a whole one.
    const r = ask({ gfaSqFt: 52000, heightFt: 200 }, parcel({ maxFAR: null }))
    const s = summariseInverse(r)
    expect(s).toMatch(/variance|rezoning/)
    expect(s).toMatch(/may be the harder problem/)
  })

  it('excludes an unknown constraint from being called the binding one', () => {
    const r = ask({ gfaSqFt: 52000 }, parcel({ maxFAR: null }))
    expect(r.binding).toBeNull()
    expect(summariseInverse(r)).toMatch(/Nothing that could be checked/)
    // and never the flat "fits by right" sentence
    expect(summariseInverse(r)).not.toMatch(/^This fits/)
  })

  it('distinguishes a district with NO far from one whose far is unreadable', () => {
    // rule 5: 'unconstrained' is an answer, null is a gap, and they must not
    // render the same. Here one of them ends the enquiry and the other does not.
    const none = ask({ gfaSqFt: 999999 }, parcel({ maxFAR: null, farUnconstrained: true }))
    expect(dim(none, 'far')?.relief).toBe('no-limit')
    expect(none.unresolved).not.toContain('far')
    expect(dim(none, 'far')?.note).toMatch(/no floor-area ratio/)

    const gap = ask({ gfaSqFt: 999999 }, parcel({ maxFAR: null }))
    expect(dim(gap, 'far')?.relief).toBe('unknown')
    expect(gap.unresolved).toContain('far')
  })

  it('a missing lot size blocks FAR without pretending the district has none', () => {
    const r = ask({ gfaSqFt: 50000 }, parcel({}, null))
    expect(dim(r, 'far')?.relief).toBe('unknown')
    expect(dim(r, 'far')?.note).toMatch(/lot size is not on record/)
  })
})

describe('⚠️ storeys and feet are never converted', () => {
  it('compares storeys to a stated storey limit', () => {
    const r = ask({ stories: 12 }, parcel({ maxStories: 8, maxHeightFt: null }))
    expect(dim(r, 'height')?.allowed).toBe(8)
    expect(dim(r, 'height')?.relief).toBe('dimensional-variance')
  })

  it('refuses to check a storey target against a limit stated in feet', () => {
    // Dividing a published height by a floor-to-floor convention is the round
    // trip that published 87 storeys for a district whose code says 80.
    const r = ask({ stories: 12 }, parcel({ maxHeightFt: 100, maxStories: null }))
    expect(dim(r, 'height')?.relief).toBe('unknown')
    expect(dim(r, 'height')?.note).toMatch(/invent a floor-to-floor height/)
    expect(r.unresolved).toContain('height')
  })

  it('and refuses the mirror case too', () => {
    const r = ask({ heightFt: 140 }, parcel({ maxStories: 8, maxHeightFt: null }))
    expect(dim(r, 'height')?.relief).toBe('unknown')
    expect(dim(r, 'height')?.note).toMatch(/invent a floor-to-floor height/)
  })

  it('⚠️ separates "the code sets no height limit" from "we could not read one"', () => {
    // These were indistinguishable until `heightUnconstrained` was added to the
    // shared type on 2026-08-19. Three zoning modules had already established the
    // fact with citations and had nowhere to put it, so sixteen Atlanta subareas
    // whose code says "Maximum Building Height: None" reached the engine as a
    // GAP. Same distinction `farUnconstrained` has always had; height simply
    // never got the flag.
    const gap = ask({ heightFt: 200 }, parcel({ maxHeightFt: null, maxStories: null }))
    expect(dim(gap, 'height')?.relief).toBe('unknown')
    expect(gap.unresolved).toContain('height')

    const stated = ask({ heightFt: 200 }, parcel({ maxHeightFt: null, maxStories: null, heightUnconstrained: true }))
    expect(dim(stated, 'height')?.relief).toBe('no-limit')
    // And it must NOT sit in `unresolved` — that would make a complete answer
    // read as a partial one.
    expect(stated.unresolved).not.toContain('height')
    expect(dim(stated, 'height')?.note).toMatch(/imposes no maximum building height/)
  })

  it('and a district with no height limit still names what does govern', () => {
    // "No ceiling" is not "nothing stops you". Setbacks and a transitional height
    // plane near a protected district still apply, and Atlanta's own module says
    // so — the answer would be misleading without it.
    const r = ask({ heightFt: 900 }, parcel({ maxHeightFt: null, maxStories: null, heightUnconstrained: true }))
    expect(dim(r, 'height')?.note).toMatch(/Setbacks and any transitional height plane/)
  })
})

describe('use', () => {
  it('passes a listed use without ceremony', () => {
    expect(dim(ask({ gfaSqFt: 5000 }), 'use')?.relief).toBe('none')
  })

  it('treats an unlisted use as beyond a dimensional variance', () => {
    const r = whatWouldItTake(parcel(), 'denver', { use: 'commercial', gfaSqFt: 5000 })
    expect(dim(r, 'use')?.relief).toBe('beyond-variance')
    expect(dim(r, 'use')?.note).toMatch(/use variance or a rezoning/)
    expect(r.binding?.dimension).toBe('use')
  })

  it('reports unreadable uses as unknown rather than as permitted', () => {
    const r = ask({ gfaSqFt: 5000 }, parcel({ allowedUses: null }))
    expect(dim(r, 'use')?.relief).toBe('unknown')
    expect(r.unresolved).toContain('use')
  })
})

describe('which constraint binds', () => {
  it('picks the hardest, not the first', () => {
    // FAR needs a variance; height is 5x and needs a rezoning. Telling someone to
    // seek a FAR variance would be true and useless.
    const r = ask({ gfaSqFt: 11000, heightFt: 200 })
    expect(r.binding?.dimension).toBe('height')
    expect(r.binding?.relief).toBe('beyond-variance')
  })

  it('breaks a tie on how far over the target is', () => {
    const r = ask({ gfaSqFt: 11000, heightFt: 44 }) // both variance-grade
    expect(dim(r, 'far')?.relief).toBe('dimensional-variance')
    expect(dim(r, 'height')?.relief).toBe('dimensional-variance')
    expect(r.binding?.dimension).toBe('far') // 1.10x vs 1.10x — far listed first on equal ratio
    expect(r.binding?.ratio).toBeGreaterThanOrEqual(dim(r, 'height')!.ratio!)
  })

  it('mentions that other constraints also bind, so one fix does not read as enough', () => {
    const r = ask({ gfaSqFt: 11000, heightFt: 200 })
    expect(summariseInverse(r)).toMatch(/1 other constraint also binds/)
  })

  it('a district with no FAR does not become the binding constraint', () => {
    const r = ask({ gfaSqFt: 999999 }, parcel({ maxFAR: null, farUnconstrained: true }))
    expect(r.binding).toBeNull()
  })

  it('⚠️ and "no FAR here" does not get summarised as a clean pass', () => {
    // Caught live: 40 units on Denver's D-CV returned "fits within what the
    // district allows by right" while the FAR line directly beneath said height,
    // setbacks and coverage govern instead — neither of which was checked,
    // because the target named neither. An answer about FAR is not an answer
    // about the parcel.
    const r = ask({ gfaSqFt: 999999 }, parcel({ maxFAR: null, farUnconstrained: true }))
    const s = summariseInverse(r)
    expect(s).not.toMatch(/fits within what the district allows by right/)
    expect(s).toMatch(/something else governs/)
    expect(s).toMatch(/not named a height/)
  })

  it('and a genuinely clean pass still reads as one', () => {
    const r = ask({ gfaSqFt: 9000, heightFt: 30 })
    expect(summariseInverse(r)).toBe('This fits within what the district allows by right.')
  })
})
