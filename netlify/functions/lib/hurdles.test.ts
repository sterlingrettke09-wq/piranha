import { describe, it, expect } from 'vitest'
import { assessHurdles } from './hurdles'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'
import { CITIES_WITH_SPECIFIC_HURDLES } from '../../../src/config/cities'

function parcel(over: Partial<ParcelInfo>): ParcelInfo {
  return {
    address: '1 Test St',
    parcelId: '1',
    coordinates: [-71.07, 42.358],
    zoning: { districtCode: 'H-2-65', subdistrict: null, article: null, maxHeightFt: 65, maxFAR: 2, allowedUses: ['residential'] },
    lot: { sizeSqFt: 2000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-05-29T00:00:00Z',
    ...over,
  }
}

function project(over: Partial<AnalysisInput>): AnalysisInput {
  return { parcelId: '1', city: 'boston', projectType: 'new', funding: 'private', lat: 42.358, lng: -71.07, use: 'residential', gfa: 8000, ...over }
}

const cats = (hs: ReturnType<typeof assessHurdles>) => hs.map((h) => h.category)

describe('assessHurdles — Boston', () => {
  it('flags historic design review when in a historic district', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: 'Historic Beacon Hill District', floodZone: null } }), project({}))
    expect(cats(hs)).toContain('historic')
    expect(hs.find((h) => h.category === 'historic')?.status).toBe('required')
  })

  it('flags IDP inclusionary for 10+ residential units', () => {
    const hs = assessHurdles('boston', parcel({}), project({ use: 'residential', units: 40 }))
    expect(cats(hs)).toContain('affordability')
  })

  it('does NOT flag IDP for a small (under-10-unit) project', () => {
    const hs = assessHurdles('boston', parcel({}), project({ use: 'residential', units: 4 }))
    expect(cats(hs)).not.toContain('affordability')
  })

  it('flags Article 80 large-project review at 50k+ sf', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 60000 }))
    expect(cats(hs)).toContain('review')
  })

  it('flags Article 80 SMALL project review for 15+ units even under 20k sf', () => {
    // bostonplans.org (verified 2026-06-10): Small Project Review applies at
    // 20,000+ sf OR 15+ dwelling units — the unit trigger alone is enough.
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 14000, units: 16 }))
    expect(hs.some((h) => /Small Project Review/.test(h.label))).toBe(true)
  })

  it('does NOT fire Article 80 for a small low-unit project', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 8000, units: 6 }))
    expect(hs.some((h) => /Project Review/.test(h.label))).toBe(false)
  })

  it('always includes a private deed/HOA info note', () => {
    const hs = assessHurdles('boston', parcel({}), project({}))
    expect(cats(hs)).toContain('private')
  })

  it('escalates the private note to "likely" at Louisburg Square', () => {
    const hs = assessHurdles('boston', parcel({ coordinates: [-71.0699, 42.3586] }), project({ lat: 42.3586, lng: -71.0699 }))
    const priv = hs.find((h) => h.category === 'private')
    expect(priv?.status).toBe('likely')
    expect(priv?.label.toLowerCase()).toContain('square')
  })

  it('flags FEMA flood when in a real flood zone', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: null, floodZone: 'AE' } }), project({}))
    expect(cats(hs)).toContain('flood')
  })

  it('does not flag flood for minimal-hazard zone X', () => {
    const hs = assessHurdles('boston', parcel({ overlays: { historicDistrict: null, floodZone: 'X' } }), project({}))
    expect(cats(hs)).not.toContain('flood')
  })
})

describe('assessHurdles — other cities', () => {
  it('NYC: MIH for 10+ units; ULURP + CEQR only on the DISCRETIONARY path (WO-5.7)', () => {
    // ULURP applies to discretionary actions — an as-of-right 60k sf building
    // never runs it. The old GFA-only trigger over-penalized as-of-right NYC
    // projects by 7 months.
    const aor = assessHurdles('nyc', parcel({}), project({ city: 'nyc', units: 40, gfa: 60000 }), { path: 'as_of_right' })
    expect(aor.map((h) => h.label).join(' | ')).toMatch(/Mandatory Inclusionary/)
    expect(aor.some((h) => /ULURP/.test(h.label))).toBe(false)

    const disc = assessHurdles('nyc', parcel({}), project({ city: 'nyc', units: 40, gfa: 60000 }), { path: 'variance' })
    const labels = disc.map((h) => h.label).join(' | ')
    expect(labels).toMatch(/ULURP/)
    expect(cats(disc)).toContain('environmental')
  })

  it('SF: inclusionary + CEQA always flagged', () => {
    const hs = assessHurdles('sf', parcel({}), project({ city: 'sf', units: 20 }))
    expect(cats(hs)).toContain('affordability')
    expect(hs.some((h) => /CEQA/.test(h.label))).toBe(true)
  })

  it('Chicago: ARO for 10+ residential units', () => {
    const hs = assessHurdles('chicago', parcel({}), project({ city: 'chicago', units: 30 }))
    expect(hs.some((h) => /ARO/.test(h.label))).toBe(true)
  })

  it('Seattle: MHA + SEPA over threshold', () => {
    const hs = assessHurdles('seattle', parcel({}), project({ city: 'seattle', units: 30, gfa: 40000 }))
    expect(hs.some((h) => /MHA/.test(h.label))).toBe(true)
    expect(hs.some((h) => /SEPA/.test(h.label))).toBe(true)
  })

  it('Seattle: design-review suspension surfaces as INFO with no added months', () => {
    // CB 121048 (Sept 2025) made design review voluntary pending HB 1293 rules.
    const hs = assessHurdles('seattle', parcel({}), project({ city: 'seattle', projectType: 'new' }))
    const dr = hs.find((h) => /Design review/.test(h.label))
    expect(dr?.status).toBe('info')
    expect(dr?.addsMonths).toBeUndefined()
    // Not shown for renovations — it's framed around new development filings.
    const reno = assessHurdles('seattle', parcel({}), project({ city: 'seattle', projectType: 'addition' }))
    expect(reno.some((h) => /Design review/.test(h.label))).toBe(false)
  })
})

describe('assessHurdles — historic review body', () => {
  const BODIES: Record<string, RegExp> = {
    boston: /Boston Landmarks/i,
    nyc: /Landmarks Preservation Commission|Certificate of Appropriateness/i,
    chicago: /Commission on Chicago Landmarks/i,
    sf: /Historic Preservation Commission/i,
    seattle: /Landmarks Preservation Board|review board/i,
  }
  for (const [city, re] of Object.entries(BODIES)) {
    it(`${city} names its historic review body`, () => {
      const hs = assessHurdles(city, parcel({ overlays: { historicDistrict: 'Some Historic District', floodZone: null } }), project({ city }))
      const h = hs.find((x) => x.category === 'historic')
      expect(h, `expected a historic hurdle for ${city}`).toBeTruthy()
      expect(h?.note).toMatch(re)
    })
  }
})

describe('assessHurdles — parking', () => {
  const ALL_CITIES = ['boston', 'nyc', 'chicago', 'sf', 'seattle', 'dc', 'austin', 'la', 'denver', 'minneapolis']

  it('every one of the ten cities emits a parking hurdle', () => {
    for (const city of ALL_CITIES) {
      const hs = assessHurdles(city, parcel({}), project({ city }))
      const p = hs.find((h) => h.category === 'parking')
      expect(p, `expected a parking hurdle for ${city}`).toBeTruthy()
      expect(p?.label.length, `parking label for ${city}`).toBeGreaterThan(0)
      expect(p?.note.length, `parking note for ${city}`).toBeGreaterThan(0)
    }
  })

  it('the four abolished cities read as abolished and as a cost saver', () => {
    for (const city of ['minneapolis', 'sf', 'austin', 'denver']) {
      const p = assessHurdles(city, parcel({}), project({ city })).find((h) => h.category === 'parking')
      expect(p?.label, city).toMatch(/abolished/i)
      expect(p?.note, city).toMatch(/cost saver/i)
    }
  })

  it('SF still notes minimums were removed citywide', () => {
    const sf = assessHurdles('sf', parcel({}), project({ city: 'sf' }))
    const p = sf.find((h) => h.category === 'parking')
    // SF abolished citywide — the label says "abolished citywide", the note "removed... citywide".
    expect(`${p?.label} ${p?.note}`).toMatch(/abolished citywide|minimums citywide|removed/i)
  })

  it('NYC no longer claims MINIMUMS were eliminated citywide (the old bug)', () => {
    const nyc = assessHurdles('nyc', parcel({}), project({ city: 'nyc' }))
    const p = nyc.find((h) => h.category === 'parking')
    expect(p, 'expected an NYC parking hurdle').toBeTruthy()
    const text = `${p?.label} ${p?.note}`
    // The old, wrong copy claimed parking minimums were "eliminated citywide".
    // The corrected copy scopes elimination to Zone 1 (the Manhattan core).
    expect(text).not.toMatch(/minimums (were )?eliminated citywide/i)
    expect(text).not.toMatch(/eliminated (mandatory )?parking minimums citywide/i)
    expect(p?.note).toMatch(/Zone 1|Manhattan/i)
  })
})

describe('assessHurdles — labor / DEI', () => {
  it('flags prevailing wage + MWBE goals for large projects', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 80000 }))
    const labor = hs.find((h) => h.category === 'labor')
    expect(labor).toBeTruthy()
    expect(labor?.note).toMatch(/prevailing wage|MWBE|minority/i)
  })

  it('does NOT flag labor for a small private project', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 6000, units: 2, funding: 'private' }))
    expect(cats(hs)).not.toContain('labor')
  })

  it('flags the public-funding process (required) for any publicly funded project', () => {
    const hs = assessHurdles('boston', parcel({}), project({ gfa: 6000, units: 2, funding: 'public' }))
    const labor = hs.find((h) => h.category === 'labor')
    expect(labor?.status).toBe('required')
    expect(labor?.note).toMatch(/procurement|prevailing-wage|Davis-Bacon/i)
  })
})

describe('assessHurdles — demolition / existing structure', () => {
  it('flags demolition + replacing-housing for a SFH replacing an apartment building', () => {
    const hs = assessHurdles(
      'seattle',
      parcel({ existing: { landUse: 'Apartment' } }),
      project({ city: 'seattle', projectType: 'new', use: 'residential', units: 1 }),
    )
    expect(cats(hs)).toContain('demolition')
    const labels = hs.map((h) => h.label).join(' | ')
    expect(labels).toMatch(/Demolition/)
    expect(labels).toMatch(/Replacing existing housing/)
    // Replacing-housing is now category 'review' (so its no-net-loss delay counts
    // toward the discretionary timeline); the demolition hurdle no longer carries
    // its own addsMonths (the demo phase is in the per-city timeline baseline).
    const replace = hs.find((h) => h.label === 'Replacing existing housing')
    expect(replace?.category).toBe('review')
    expect(replace?.addsMonths).toBe(6)
  })

  it('does NOT flag demolition on a vacant lot', () => {
    const hs = assessHurdles('seattle', parcel({ existing: { landUse: 'Vacant(Single-family)' } }), project({ city: 'seattle', projectType: 'new' }))
    expect(cats(hs)).not.toContain('demolition')
  })

  it('does NOT flag demolition for an addition (not new construction)', () => {
    const hs = assessHurdles('boston', parcel({ existing: { landUse: 'Apartment', units: 12 } }), project({ projectType: 'addition' }))
    expect(cats(hs)).not.toContain('demolition')
  })
})

describe('assessHurdles — tenant-protection teardown (LA RSO / SF Rent Ordinance)', () => {
  const laTeardown = (h: ReturnType<typeof assessHurdles>) => h.find((x) => /RSO \+ Ellis Act/.test(x.label))
  const sfTeardown = (h: ReturnType<typeof assessHurdles>) => h.find((x) => /Rent Ordinance \+ Section 317/.test(x.label))

  it('LA pre-1978 multifamily teardown → hurdle present, status likely, 6 months', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Apartment', yearBuilt: 1965 } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 20 }),
    )
    const h = laTeardown(hs)
    expect(h, 'expected an LA RSO/Ellis hurdle').toBeTruthy()
    expect(h?.status).toBe('likely')
    expect(h?.addsMonths).toBe(6)
    expect(h?.note).toMatch(/Rent Stabilization Ordinance|RSO/)
    expect(h?.note).toMatch(/Ellis Act/)
    // Year is KNOWN → assertive copy, not the confirm branch.
    expect(h?.note).toMatch(/predates October 1, 1978/)
  })

  it('LA 1985 multifamily building → teardown hurdle ABSENT (post-RSO)', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Apartment', yearBuilt: 1985 } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 20 }),
    )
    expect(laTeardown(hs)).toBeFalsy()
  })

  it('LA multifamily, yearBuilt unknown → present with confirm language', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Apartment' } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 20 }),
    )
    const h = laTeardown(hs)
    expect(h, 'expected an LA RSO/Ellis hurdle on unknown year').toBeTruthy()
    expect(h?.note).toMatch(/confirm the building’s RSO status/)
  })

  it('LA duplex (units=2, no regex match) still trips the rental-multifamily floor', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Duplex', units: 2 } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 8 }),
    )
    expect(laTeardown(hs)).toBeTruthy()
  })

  it('LA single-family teardown → NO rent-control hurdle (not rental multifamily)', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Single Family Residence' } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 4 }),
    )
    expect(laTeardown(hs)).toBeFalsy()
  })

  it('LA fires even when the project ADDS units (trigger is lost tenancies, not net loss)', () => {
    const hs = assessHurdles(
      'la',
      parcel({ existing: { landUse: 'Apartment', units: 4, yearBuilt: 1960 } }),
      project({ city: 'la', projectType: 'new', use: 'residential', units: 40 }),
    )
    expect(laTeardown(hs)).toBeTruthy()
  })

  it('SF multifamily teardown → hurdle present, confirm language (SF data carries no yearBuilt)', () => {
    const hs = assessHurdles(
      'sf',
      parcel({ existing: { landUse: 'Residential building', units: 6 } }),
      project({ city: 'sf', projectType: 'new', use: 'residential', units: 12 }),
    )
    const h = sfTeardown(hs)
    expect(h, 'expected an SF Rent Ordinance/317 hurdle').toBeTruthy()
    expect(h?.status).toBe('likely')
    expect(h?.addsMonths).toBe(6)
    expect(h?.note).toMatch(/Rent Ordinance/)
    expect(h?.note).toMatch(/Section 317/)
    expect(h?.note).toMatch(/confirm the building’s rent-control status/)
  })

  it('SF post-1980 multifamily (if year ever known) → teardown ABSENT', () => {
    const hs = assessHurdles(
      'sf',
      parcel({ existing: { landUse: 'Residential building', units: 6, yearBuilt: 1995 } }),
      project({ city: 'sf', projectType: 'new', use: 'residential', units: 12 }),
    )
    expect(sfTeardown(hs)).toBeFalsy()
  })

  it('does NOT fire on an ADDITION (only new construction tears anything down)', () => {
    const la = assessHurdles('la', parcel({ existing: { landUse: 'Apartment' } }), project({ city: 'la', projectType: 'addition' }))
    const sf = assessHurdles('sf', parcel({ existing: { landUse: 'Residential building', units: 6 } }), project({ city: 'sf', projectType: 'addition' }))
    expect(laTeardown(la)).toBeFalsy()
    expect(sfTeardown(sf)).toBeFalsy()
  })

  it('leak guard: non-LA/SF cities never emit a rent-control teardown hurdle', () => {
    for (const city of ['boston', 'nyc', 'chicago', 'seattle', 'dc', 'austin', 'denver', 'minneapolis']) {
      const hs = assessHurdles(
        city,
        parcel({ existing: { landUse: 'Apartment', units: 8, yearBuilt: 1955 } }),
        project({ city, projectType: 'new', use: 'residential', units: 4 }),
      )
      expect(laTeardown(hs), `${city} leaked LA hurdle`).toBeFalsy()
      expect(sfTeardown(hs), `${city} leaked SF hurdle`).toBeFalsy()
    }
  })
})

describe('assessHurdles — Boston abutter appeals (MGL c.40A §17)', () => {
  const abutter = (h: ReturnType<typeof assessHurdles>) => h.find((x) => /Abutter appeal/.test(x.label))

  it('variance (discretionary) path → abutter hurdle present, info status, no addsMonths', () => {
    const hs = assessHurdles('boston', parcel({}), project({ city: 'boston' }), { path: 'variance' })
    const h = abutter(hs)
    expect(h, 'expected an abutter-appeal hurdle on the variance path').toBeTruthy()
    expect(h?.status).toBe('info')
    expect(h?.addsMonths).toBeUndefined()
    expect(h?.note).toMatch(/40A/)
    expect(h?.note).toMatch(/courthouse/)
  })

  it('as-of-right path → abutter hurdle ABSENT (no discretionary approval, no appeal)', () => {
    const hs = assessHurdles('boston', parcel({}), project({ city: 'boston' }), { path: 'as_of_right' })
    expect(abutter(hs)).toBeFalsy()
  })

  it('no path supplied → abutter hurdle ABSENT (defaults to non-discretionary)', () => {
    const hs = assessHurdles('boston', parcel({}), project({ city: 'boston' }))
    expect(abutter(hs)).toBeFalsy()
  })

  it('leak guard: variance path in non-Boston cities never emits the abutter hurdle', () => {
    for (const city of ['nyc', 'chicago', 'sf', 'seattle', 'la', 'dc', 'austin', 'denver', 'minneapolis']) {
      const hs = assessHurdles(city, parcel({}), project({ city }), { path: 'variance' })
      expect(abutter(hs), `${city} leaked the Boston abutter hurdle`).toBeFalsy()
    }
  })
})

describe('assessHurdles — project type', () => {
  it('ADU adds ADU-specific rules', () => {
    const hs = assessHurdles('boston', parcel({}), project({ projectType: 'adu' }))
    expect(hs.some((h) => /ADU/.test(h.label))).toBe(true)
  })
  it('change of use adds code-upgrade hurdle', () => {
    const hs = assessHurdles('boston', parcel({}), project({ projectType: 'change_of_use' }))
    expect(hs.some((h) => /Change-of-use/.test(h.label))).toBe(true)
  })
})

// Rule 14: the coverage claim shown to users must be impossible to falsify by
// forgetting to update it. `CITIES_WITH_SPECIFIC_HURDLES` drives Compare's
// "partial" marker and the standing disclaimer; if someone encodes a new city's
// mandates here and does not add it to the list, that city keeps being labelled
// incomplete — and, worse, the reverse omission would label an unencoded city
// complete. So the list is checked against the branches in this module's source.
describe('the published hurdle-coverage list matches the code', () => {
  it('equals the set of cities this module actually branches on', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./hurdles.ts', import.meta.url), 'utf8')
    const branched = [...src.matchAll(/city === '([a-z]+)'/g)].map((m) => m[1])
    expect([...new Set(branched)].sort()).toEqual([...CITIES_WITH_SPECIFIC_HURDLES].sort())
  })
})
