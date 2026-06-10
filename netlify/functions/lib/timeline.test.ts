import { describe, it, expect } from 'vitest'
import { resolveTimeline, buildingTier } from './timeline'
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
