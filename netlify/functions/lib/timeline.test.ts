import { describe, it, expect } from 'vitest'
import { resolveTimeline, buildingTier, measuredFor } from './timeline'
import type { Feasibility } from './feasibility'
import type { AnalysisInput } from '../../src/types/analysis'

const project = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  parcelId: 'T1',
  lat: 42.34,
  lng: -71.07,
  use: 'commercial',
  gfa: 15_000,
  ...over,
})

const feas = (path: Feasibility['path']) => ({ path }) as Feasibility

describe('buildingTier', () => {
  it('commercial and institutional are always apartment-tier', () => {
    expect(buildingTier(project({ use: 'commercial' }))).toBe('apartment')
    expect(buildingTier(project({ use: 'institutional' }))).toBe('apartment')
  })
  it('residential tiers by unit count; mixed defaults to multi', () => {
    expect(buildingTier(project({ use: 'residential', units: 1 }))).toBe('single')
    expect(buildingTier(project({ use: 'residential', units: 3 }))).toBe('multi')
    expect(buildingTier(project({ use: 'residential', units: 6 }))).toBe('apartment')
    expect(buildingTier(project({ use: 'mixed' }))).toBe('multi') // units default 3
  })
})

describe('resolveTimeline', () => {
  it('prohibited path → 0 months', () => {
    const t = resolveTimeline('boston', project(), feas('prohibited'), false)
    expect(t.months).toBe(0)
  })

  it('Boston apartment-tier new build on a cleared lot = the lifecycle baseline (44)', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), false)
    expect(t.months).toBe(44)
    expect(t.includesDemolition).toBe(false)
  })

  it('a teardown adds the per-city demolition phase (+3 in Boston)', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), true)
    expect(t.months).toBe(47)
    expect(t.includesDemolition).toBe(true)
  })

  it('large teardowns add scaled months above 50k sf', () => {
    // (150,000 − 50,000) / 100,000 × 3 = 3 extra
    const t = resolveTimeline('boston', project(), feas('by-right'), true, 150_000)
    expect(t.months).toBe(50)
  })

  it('the large-teardown adder caps at 18 months', () => {
    const t = resolveTimeline('boston', project(), feas('by-right'), true, 1_000_000)
    expect(t.months).toBe(44 + 3 + 18)
  })

  it('demolition months are NOT added for addition/renovation projects', () => {
    const t = resolveTimeline('boston', project({ projectType: 'addition', use: 'residential', units: 3 }), feas('by-right'), true)
    // boston multi 28 × 0.65 = 18.2 → 18; hasExistingBuilding true but projectType ≠ new
    expect(t.months).toBe(18)
    expect(t.includesDemolition).toBe(false)
  })

  it('unknown city falls back to the generic lifecycle table', () => {
    const t = resolveTimeline('atlantis', project(), feas('by-right'), false)
    expect(t.months).toBe(40) // fallback apartment tier
  })

  it('discretionary/variance time is NOT added here (analyze.ts owns it)', () => {
    const byRight = resolveTimeline('boston', project(), feas('by-right'), false)
    const variance = resolveTimeline('boston', project(), feas('variance'), false)
    expect(variance.months).toBe(byRight.months)
    expect(variance.path).toBe('variance')
  })
})

describe('measured permit timing', () => {
  // SF + Seattle landed real data from their open portals (see scripts/permits).
  // Assert SHAPE, not exact numbers — the figures refresh quarterly and the test
  // must survive a re-run of the pipeline.
  const expectMeasuredShape = (m: unknown) => {
    expect(m).toBeDefined()
    const v = m as { medianMonths: number; p80Months: number; n: number; vintage: string }
    expect(typeof v.medianMonths).toBe('number')
    expect(typeof v.p80Months).toBe('number')
    expect(v.p80Months).toBeGreaterThanOrEqual(v.medianMonths)
    expect(v.n).toBeGreaterThanOrEqual(30)
    expect(typeof v.vintage).toBe('string')
    expect(v.vintage.length).toBeGreaterThan(0)
  }

  it('a city present in permitStats → measured is populated for a new build', () => {
    const t = resolveTimeline('sf', project({ city: 'sf' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Seattle (also present) → measured is populated', () => {
    const t = resolveTimeline('seattle', project({ city: 'seattle' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Chicago (landed via chicago.mjs) → measured is populated', () => {
    const t = resolveTimeline('chicago', project({ city: 'chicago' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Austin (landed via austin.mjs) → measured is populated', () => {
    const t = resolveTimeline('austin', project({ city: 'austin' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Los Angeles (landed via la.mjs) → measured is populated', () => {
    const t = resolveTimeline('la', project({ city: 'la' }), feas('by-right'), false)
    expectMeasuredShape(t.measured)
  })

  it('a city absent from permitStats → measured is undefined', () => {
    // 'atlantis' is not a real city and will never be in the artifact.
    const t = resolveTimeline('atlantis', project({ city: 'atlantis' }), feas('by-right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('an addition/renovation never gets a measured permit line, even for a present city', () => {
    const t = resolveTimeline(
      'sf',
      project({ city: 'sf', projectType: 'addition', use: 'residential', units: 3 }),
      feas('by-right'),
      false,
    )
    expect(t.measured).toBeUndefined()
  })

  it('measured is carried through on the prohibited path too (UI gates on months, not measured)', () => {
    const t = resolveTimeline('sf', project({ city: 'sf' }), feas('prohibited'), false)
    expect(t.months).toBe(0)
    // present + new → measured still resolved; the component only renders it when months > 0.
    expectMeasuredShape(t.measured)
  })

  it('measuredFor mirrors the artifact: present cities resolve, unknown cities do not', () => {
    expect(measuredFor('sf')).toBeDefined()
    expect(measuredFor('atlantis')).toBeUndefined()
  })
})
