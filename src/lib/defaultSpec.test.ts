import { describe, it, expect } from 'vitest'
import { buildDefaultSpec } from './defaultSpec'
import type { ParcelInfo } from '../types/parcel'

function parcel(over: Partial<ParcelInfo> = {}): ParcelInfo {
  return {
    address: '1 Main St',
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

  it('clamps: gfa floors at 1000 and caps at 200000', () => {
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

// ---- Defect 7: the FAR-1.0 fallback must travel labelled ----
// The 2026-08-04 sweep found most null FARs are MISSING LOOKUPS (San Diego,
// San Jose and Nashville publish no FAR in GIS though their codes have one),
// not districts that genuinely lack a FAR. So this path usually covers a gap,
// and an unlabelled guess reaching cost/units/fees is the defect.
describe('buildDefaultSpec — gfaBasis labels the assumption', () => {
  const base = {
    address: 'x', parcelId: 'p', coordinates: [-97.7, 30.3] as [number, number],
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
