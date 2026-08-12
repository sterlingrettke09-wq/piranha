import { describe, it, expect } from 'vitest'
import { buildDefaultSpec } from './defaultSpec'
import type { ParcelInfo } from '../types/parcel'

function parcel(over: Partial<ParcelInfo> = {}): ParcelInfo {
  return {
    address: '1 Main St',
    addressBasis: 'record',
    parcelId: 'PID-1',
    coordinates: [-71.05, 42.36], // [lng, lat]
    zoning: {
      districtCode: 'R-2',
      subdistrict: null,
      article: null,
      maxHeightFt: null,
      maxFAR: null,
      allowedUses: null,
    },
    lot: { sizeSqFt: null, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-06-10',
    ...over,
  }
}

describe('buildDefaultSpec', () => {
  it('envelope known: derives gfa from 85% of floor area, units, stories', () => {
    const p = parcel({
      envelope: {
        maxFloorAreaSqFt: 20000,
        maxHeightFt: 80,
        maxStories: 8,
        maxUnits: 14,
        allowedUses: ['residential', 'commercial'],
        farBasis: 'residential',
      },
    })
    const spec = buildDefaultSpec(p, 'boston')!
    expect(spec).not.toBeNull()
    // 20000 * 0.85 = 17000 → nearest 500 = 17000
    expect(spec.gfa).toBe(17000)
    expect(spec.use).toBe('residential')
    // residential: floor(17000 / 1300) = 13, min 1
    expect(spec.units).toBe(13)
    // maxStories 8 capped at 6
    expect(spec.stories).toBe(6)
    expect(spec.projectType).toBe('new')
    expect(spec.funding).toBe('private')
    expect(spec.parcelId).toBe('PID-1')
    // coordinates [lng, lat] → lat/lng pulled correctly
    expect(spec.lat).toBe(42.36)
    expect(spec.lng).toBe(-71.05)
  })

  it('envelope unknown + lot known: falls back to lot × 1.0 FAR', () => {
    const p = parcel({ lot: { sizeSqFt: 5200, lotType: null } })
    const spec = buildDefaultSpec(p, 'boston')!
    expect(spec).not.toBeNull()
    // 5200 * 1.0 = 5200 → nearest 500 = 5000
    expect(spec.gfa).toBe(5000)
    // no allowedUses → defaults to residential
    expect(spec.use).toBe('residential')
    expect(spec.units).toBe(Math.floor(5000 / 1300)) // 3
    // no envelope → no stories
    expect(spec.stories).toBeUndefined()
  })

  it('neither envelope nor lot: returns null', () => {
    expect(buildDefaultSpec(parcel(), 'boston')).toBeNull()
  })

  it('non-residential district: picks mixed, then commercial, never invents residential units', () => {
    // mixed allowed but no residential → mixed
    const mixed = buildDefaultSpec(
      parcel({
        envelope: {
          maxFloorAreaSqFt: 10000,
          maxHeightFt: null,
          maxStories: null,
          maxUnits: null,
          allowedUses: ['commercial', 'mixed'],
          farBasis: 'district',
        },
      }),
      'boston',
    )!
    expect(mixed.use).toBe('mixed')
    // 10000 * 0.85 = 8500 gfa; mixed units = floor(8500 * 0.85 / 1300)
    expect(mixed.gfa).toBe(8500)
    expect(mixed.units).toBe(Math.floor((8500 * 0.85) / 1300)) // 5

    // commercial-only → commercial, no units
    const commercial = buildDefaultSpec(
      parcel({
        envelope: {
          maxFloorAreaSqFt: 10000,
          maxHeightFt: null,
          maxStories: null,
          maxUnits: null,
          allowedUses: ['commercial'],
          farBasis: 'district',
        },
      }),
      'boston',
    )!
    expect(commercial.use).toBe('commercial')
    expect(commercial.units).toBeUndefined()
  })

  it('floors at 1000 where NO envelope bounds it, and caps at 200000', () => {
    // No envelope resolved → nothing to clamp against, so the floor still
    // applies exactly as before. This is the path most parcels take.
    const tiny = buildDefaultSpec(parcel({ lot: { sizeSqFt: 200, lotType: null } }), 'boston')!
    expect(tiny.gfa).toBe(1000)

    const huge = buildDefaultSpec(
      parcel({
        envelope: {
          maxFloorAreaSqFt: 1_000_000,
          maxHeightFt: null,
          maxStories: null,
          maxUnits: null,
          allowedUses: ['residential'],
          farBasis: 'residential',
        },
      }),
      'boston',
    )!
    // 1,000,000 * 0.85 = 850,000 → clamp to 200,000
    expect(huge.gfa).toBe(200000)
  })

  it('units always at least 1 for residential even on a tiny lot', () => {
    const spec = buildDefaultSpec(parcel({ lot: { sizeSqFt: 300, lotType: null } }), 'boston')!
    expect(spec.gfa).toBe(1000) // clamped
    // floor(1000/1300) = 0 → max(1, 0) = 1
    expect(spec.units).toBe(1)
  })
})

// ---- The proposal may never exceed the envelope it was derived from ----
// Found live, not by reading code: four parcels in the 575-parcel smoke sample
// proposed 1,000 sf against envelopes of 303 / 717 / 388 / 956 sf, and the
// overage was published as the CITY's restriction — three PROHIBITED and one
// NEEDS_RELIEF carrying $514,780 and 22 months.
//
// These assertions are about a relationship (proposal ≤ envelope), not about a
// number, which is what makes them hard to defeat by accident: rounding, the
// 0.85 factor and both band ends can all change without touching the invariant,
// and any change that breaks it goes red (rule 14 — a structure, not a comment).
describe('buildDefaultSpec — the envelope bounds the default program', () => {
  const withEnvelope = (maxFloorAreaSqFt: number | null, lotSqFt = 5000) =>
    parcel({
      lot: { sizeSqFt: lotSqFt, lotType: null },
      envelope: {
        maxFloorAreaSqFt,
        maxHeightFt: 35,
        maxStories: 3,
        maxUnits: null,
        allowedUses: ['residential'],
        farBasis: 'district',
      },
    })

  // The exact four parcels, by their measured envelopes.
  it.each([
    ['atlanta RG-2', 303, 870],
    ['atlanta C-1', 717, 1030],
    ['boston 2F-5000', 388, 775],
    ['chicago RS-3', 956, 1062],
  ])('%s: an envelope of %i sf yields no instant report at all', (_label, env, lot) => {
    expect(buildDefaultSpec(withEnvelope(env, lot), 'boston')).toBeNull()
  })

  it('proposes at the envelope when the envelope is exactly the minimum program', () => {
    const spec = buildDefaultSpec(withEnvelope(1000), 'boston')!
    expect(spec.gfa).toBe(1000)
  })

  it('rounding alone cannot cross the envelope', () => {
    // 1,480 × 0.85 = 1,258 → nearest 500 = 1,500, which is over the envelope
    // with the floor playing no part. A fix that only moved the floor would
    // still publish 1,500 here.
    const spec = buildDefaultSpec(withEnvelope(1480), 'boston')!
    expect(spec.gfa).toBeLessThanOrEqual(1480)
  })

  it('never proposes more floor area than the envelope allows — swept, not sampled', () => {
    // Rule 20: a sweep that silently stopped matching would pass by finding
    // nothing, so both halves of the outcome are pinned by count.
    let declined = 0
    let proposed = 0
    for (let env = 1; env <= 6000; env++) {
      const spec = buildDefaultSpec(withEnvelope(env), 'boston')
      if (spec === null) {
        declined++
        continue
      }
      proposed++
      expect(spec.gfa).toBeLessThanOrEqual(env)
      expect(spec.gfa).toBeGreaterThan(0) // analyze.ts rejects gfa <= 0 as BAD_INPUT
    }
    // Declines are exactly the envelopes below GFA_MIN — 1…999.
    expect(declined).toBe(999)
    expect(proposed).toBe(5001)
  })

  it('a lot area is not a ceiling — the no-envelope path is untouched', () => {
    // Rule 5: `assumed-far-1.0` / `assumed-unconstrained` mean no floor-area
    // limit resolved, so there is nothing to bound the proposal against and the
    // band applies as it always did. Capping by lot area here would turn a
    // labelled assumption into a limit the code never stated.
    const noFar = buildDefaultSpec(parcel({ lot: { sizeSqFt: 200, lotType: null } }), 'boston')!
    expect(noFar.gfa).toBe(1000)
    expect(noFar.gfa).toBeGreaterThan(200)
    expect(noFar.gfaBasis).toBe('assumed-far-1.0')

    const unconstrained = buildDefaultSpec(
      parcel({
        lot: { sizeSqFt: 200, lotType: null },
        envelope: {
          maxFloorAreaSqFt: null, maxHeightFt: 40, maxStories: 3, maxUnits: null,
          allowedUses: ['residential'], farBasis: 'unconstrained',
        },
      }),
      'denver',
    )!
    expect(unconstrained.gfa).toBe(1000)
    expect(unconstrained.gfaBasis).toBe('assumed-unconstrained')
  })

  it('the ceiling still binds, and still sits under the envelope', () => {
    const spec = buildDefaultSpec(withEnvelope(5_000_000, 5_000_000), 'nyc')!
    expect(spec.gfa).toBe(200000)
    expect(spec.gfa).toBeLessThan(5_000_000)
  })
})

// ---- Defect 7: the FAR-1.0 fallback must travel labelled ----
// The 2026-08-04 sweep found most null FARs are MISSING LOOKUPS (San Diego,
// San Jose and Nashville publish no FAR in GIS though their codes have one),
// not districts that genuinely lack a FAR. So this path usually covers a gap,
// and an unlabelled guess reaching cost/units/fees is the defect.
describe('buildDefaultSpec — gfaBasis labels the assumption', () => {
  const base = {
    address: 'x', addressBasis: 'record' as const, parcelId: 'p', coordinates: [-97.7, 30.3] as [number, number],
    zoning: { districtCode: 'R-1', subdistrict: null, article: null, maxHeightFt: 40, maxFAR: null, allowedUses: ['residential'] },
    lot: { sizeSqFt: 10000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {}, fetchedAt: '2026-08-04T00:00:00.000Z',
  }

  it("marks 'envelope' when a published floor-area limit drove the number", () => {
    const spec = buildDefaultSpec(
      { ...base, envelope: { maxFloorAreaSqFt: 20000, maxHeightFt: 40, maxStories: 3, maxUnits: 13, allowedUses: ['residential'], farBasis: 'district' } } as never,
      'boston',
    )
    expect(spec?.gfaBasis).toBe('envelope')
  })

  it("marks 'assumed-far-1.0' when NO floor-area limit was resolvable", () => {
    const spec = buildDefaultSpec(
      { ...base, envelope: { maxFloorAreaSqFt: null, maxHeightFt: 40, maxStories: 3, maxUnits: null, allowedUses: ['residential'], farBasis: null } } as never,
      'sandiego',
    )
    expect(spec?.gfaBasis).toBe('assumed-far-1.0')
    expect(spec?.gfa).toBe(10000) // lot * 1.0 — the guess, now labelled
  })

  it('distinguishes a STATED absence of FAR from an unresolved one', () => {
    // ⚠️ CORRECTED 2026-08-05 by the fail-closed audit. This previously asserted
    // that an unconstrained district ALSO gets 'assumed-far-1.0' — i.e. that the
    // two unknowns are the same. They are not: one is the code's answer, the
    // other is our ignorance, and collapsing them is what made five defect
    // classes default permissive. Rule 15 — the test was encoding the wrong
    // interpretation.
    const spec = buildDefaultSpec(
      { ...base, envelope: { maxFloorAreaSqFt: null, maxHeightFt: 60, maxStories: 5, maxUnits: null, allowedUses: ['residential'], farBasis: 'unconstrained' } } as never,
      'denver',
    )
    expect(spec?.gfaBasis).toBe('assumed-unconstrained')
  })

  it('the two bases are always distinguishable', () => {
    const fromEnv = buildDefaultSpec(
      { ...base, envelope: { maxFloorAreaSqFt: 20000, maxHeightFt: 40, maxStories: 3, maxUnits: 13, allowedUses: ['residential'], farBasis: 'district' } } as never, 'boston')
    const fromLot = buildDefaultSpec(
      { ...base, envelope: { maxFloorAreaSqFt: null, maxHeightFt: 40, maxStories: 3, maxUnits: null, allowedUses: ['residential'], farBasis: null } } as never, 'sandiego')
    expect(fromEnv?.gfaBasis).not.toBe(fromLot?.gfaBasis)
  })
})
