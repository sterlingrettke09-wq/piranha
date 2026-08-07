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

// ---------------------------------------------------------------------------
// Austin / DC / Denver — encoded from docs/HURDLE-PROPOSALS.md.
// ---------------------------------------------------------------------------

const labels = (hs: ReturnType<typeof assessHurdles>) => hs.map((h) => h.label)
const byLabel = (hs: ReturnType<typeof assessHurdles>, re: RegExp) => hs.find((h) => re.test(h.label))

describe('assessHurdles — Austin', () => {
  const austin = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('austin', parcel(p), project({ city: 'austin', ...over }))

  it('resolves a plausible project: fees, the administrative-review absence, and no inclusionary mandate', () => {
    const hs = austin({ use: 'residential', units: 24, gfa: 30000 })
    expect(hs.length).toBeGreaterThan(4)
    expect(labels(hs).join(' | ')).toMatch(/Street impact fee/)
    expect(labels(hs).join(' | ')).toMatch(/Water and wastewater/)
    expect(labels(hs).join(' | ')).toMatch(/Parkland dedication/)
    // ABSENCES — the most valuable rows. Austin has no inclusionary mandate at
    // any size (LDC § 25-1-720(A)) and no hearing by default (§ 25-5-142).
    const inclusionary = byLabel(hs, /No mandatory inclusionary/)
    expect(inclusionary?.status).toBe('info')
    expect(inclusionary?.note).toMatch(/25-1-720/)
    const siteplan = byLabel(hs, /Site plan review is administrative/)
    expect(siteplan?.status).toBe('info')
    expect(siteplan?.note).toMatch(/25-5-142/)
  })

  it('C&D diversion fires above 5,000 sq ft and carries sizeDependent', () => {
    const big = byLabel(austin({ gfa: 30000 }), /materials diversion/)
    expect(big?.sizeDependent).toBe(true)
    expect(big?.status).toBe('required')
    expect(byLabel(austin({ gfa: 4000 }), /materials diversion/)).toBeFalsy()
  })

  it('50-year historic screen: fires on an old teardown, silent on a new building', () => {
    const old = byLabel(
      austin({ projectType: 'new', units: 30 }, { existing: { landUse: 'Apartment', units: 8, yearBuilt: 1940 } }),
      /50 years or older/,
    )
    expect(old?.status).toBe('likely')
    expect(old?.addsMonths).toBe(4)
    expect(old?.note).toMatch(/25-11-213/)
    const recent = byLabel(
      austin({ projectType: 'new', units: 30 }, { existing: { landUse: 'Apartment', units: 8, yearBuilt: 2015 } }),
      /50 years or older/,
    )
    expect(recent).toBeFalsy()
    // Unknown year must NOT wave it through.
    const unknown = byLabel(austin({ projectType: 'new', units: 30 }, { existing: { landUse: 'Apartment', units: 8 } }), /50 years or older/)
    expect(unknown?.note).toMatch(/no year built/)
  })

  it('120-day tenant notice fires on a rental-multifamily teardown only', () => {
    const h = byLabel(austin({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 6 } }), /120-day tenant notice/)
    expect(h?.status).toBe('required')
    expect(h?.addsMonths).toBe(4)
    expect(h?.sizeDependent).toBeFalsy() // the EXISTING building triggers it, not project size
    expect(byLabel(austin({ projectType: 'new' }, { existing: { landUse: 'Vacant Land' } }), /120-day tenant notice/)).toBeFalsy()
  })

  // The statutory gate is FIVE existing residential units (§ 25-1-711(C)(2)) —
  // restored from the full source, which the truncated table had reduced to
  // "multiple residential units" plus a "confirm the threshold" hedge.
  it('the tenant-notice threshold is five EXISTING units, and an unknown count is not waved through', () => {
    const five = byLabel(austin({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 5 } }), /120-day tenant notice/)
    expect(five?.note).toMatch(/at least five residential units/)
    expect(five?.note).toMatch(/270 days/) // mobile home parks
    // A known 2–4 unit building is BELOW the threshold: no hurdle.
    expect(byLabel(austin({ projectType: 'new', units: 40 }, { existing: { landUse: 'Duplex', units: 4 } }), /120-day tenant notice/)).toBeFalsy()
    // An unknown unit count still fires, hedged — an absent record is not an absence.
    const unknown = byLabel(austin({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment' } }), /120-day tenant notice/)
    expect(unknown?.status).toBe('required')
    expect(unknown?.note).toMatch(/no unit count/)
  })

  it('carries the restored parkland arithmetic and the Save Our Springs caps', () => {
    const hs = austin({ use: 'residential', units: 24, gfa: 30000 })
    const park = byLabel(hs, /Parkland dedication/)
    expect(park?.note).toMatch(/0\.005 acre per multifamily unit/)
    expect(park?.note).toMatch(/0\.004 per hotel\/motel room/)
    expect(park?.note).toMatch(/10% of gross site area/)
    expect(park?.note).toMatch(/1 \(suburban\), 4 \(urban\) or 40 \(central business district\)/)
    const sos = byLabel(hs, /Save Our Springs/)
    expect(sos?.note).toMatch(/15%/)
    expect(sos?.note).toMatch(/20%/)
    expect(sos?.note).toMatch(/25%/)
    expect(sos?.note).toMatch(/net site area/i)
    expect(sos?.note).toMatch(/not waivable/)
  })

  it('the valid petition names the three-fourths bar and the 200-foot radius', () => {
    const disc = assessHurdles('austin', parcel({}), project({ city: 'austin' }), { path: 'variance' })
    const vp = byLabel(disc, /Valid petition/)
    expect(vp?.note).toMatch(/20%/)
    expect(vp?.note).toMatch(/200 feet/)
    expect(vp?.note).toMatch(/three-fourths/)
    expect(vp?.note).toMatch(/9 of 11/)
  })

  it('C&D diversion states the 50% / 2.5 lb baseline, and fires on the demolition limb below 5,000 sq ft', () => {
    const big = byLabel(austin({ gfa: 30000 }), /materials diversion/)
    expect(big?.note).toMatch(/50%/)
    expect(big?.note).toMatch(/2\.5 lb/)
    expect(big?.note).toMatch(/75% and 95%/)
    // Second limb of § 25-11-39(C): a commercial or multifamily demolition permit,
    // at any size. It is NOT size-triggered, so it must not carry sizeDependent.
    const demoLimb = byLabel(
      austin({ projectType: 'new', use: 'residential', units: 8, gfa: 3000 }, { existing: { landUse: 'Apartment', units: 6 } }),
      /materials diversion/,
    )
    expect(demoLimb?.status).toBe('required')
    expect(demoLimb?.sizeDependent).toBe(false)
    // A small single-family teardown hits neither limb.
    expect(
      byLabel(austin({ projectType: 'new', use: 'residential', units: 1, gfa: 2000 }, { existing: { landUse: 'Single Family Residence', units: 1 } }), /materials diversion/),
    ).toBeFalsy()
  })

  it('the 50-year screen publishes its 60 / 75 / 180-day bounds', () => {
    const old = byLabel(
      austin({ projectType: 'new', units: 30 }, { existing: { landUse: 'Apartment', units: 8, yearBuilt: 1940 } }),
      /50 years or older/,
    )
    expect(old?.note).toMatch(/60 days/)
    expect(old?.note).toMatch(/75 days/)
    expect(old?.note).toMatch(/180 days/)
    expect(old?.note).toMatch(/25-11-214/)
  })

  it('the valid-petition protest right is discretionary-only', () => {
    const disc = assessHurdles('austin', parcel({}), project({ city: 'austin' }), { path: 'variance' })
    expect(byLabel(disc, /Valid petition/)?.status).toBe('info')
    const aor = assessHurdles('austin', parcel({}), project({ city: 'austin' }), { path: 'as_of_right' })
    expect(byLabel(aor, /Valid petition/)).toBeFalsy()
  })

  it('names the Historic Landmark Commission in a historic district', () => {
    const hs = austin({}, { overlays: { historicDistrict: 'Hyde Park Historic District', floodZone: null } })
    expect(byLabel(hs, /Historic district design review/)?.note).toMatch(/Historic Landmark Commission/)
  })
})

describe('assessHurdles — DC', () => {
  const dc = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('dc', parcel(p), project({ city: 'dc', ...over }))

  it('resolves a plausible project: IZ, DCEPA screening, Green Area Ratio, First Source', () => {
    const hs = dc({ use: 'residential', units: 40, gfa: 40000 })
    const iz = byLabel(hs, /Inclusionary Zoning/)
    expect(iz?.status).toBe('required')
    expect(iz?.sizeDependent).toBe(true)
    expect(iz?.note).toMatch(/11-C DCMR § 1001\.2/)
    expect(byLabel(hs, /Environmental Policy Act/)?.status).toBe('likely')
    expect(byLabel(hs, /Green Area Ratio/)?.status).toBe('required')
    expect(byLabel(hs, /First Source/)?.status).toBe('info')
  })

  it('does not assert IZ below 10 units', () => {
    expect(byLabel(dc({ use: 'residential', units: 6 }), /Inclusionary Zoning/)).toBeFalsy()
  })

  it('every floor-area / unit-count trigger carries sizeDependent', () => {
    // Mixed use, because the Green Building Act reaches the NONRESIDENTIAL
    // portion only — a purely residential building of any size is outside it.
    const hs = dc({ use: 'mixed', units: 60, gfa: 80000 }, { lot: { sizeSqFt: 200000, lotType: null } })
    for (const re of [/Inclusionary Zoning/, /Large Tract Review/, /Green Construction Code/, /Green Building Act/]) {
      expect(byLabel(hs, re)?.sizeDependent, String(re)).toBe(true)
    }
    // …and a placeholder size downgrades every one of them to 'info' (rule 1).
    const soft = assessHurdles(
      'dc',
      parcel({ lot: { sizeSqFt: 200000, lotType: null } }),
      project({ city: 'dc', use: 'mixed', units: 60, gfa: 80000, gfaBasis: 'assumed-far-1.0' }),
    )
    for (const re of [/Inclusionary Zoning/, /Green Construction Code/, /Green Building Act/]) {
      expect(byLabel(soft, re)?.status, String(re)).toBe('info')
    }
  })

  it('Large Tract Review fires at 3 acres, not below', () => {
    const big = byLabel(dc({}, { lot: { sizeSqFt: 140000, lotType: null } }), /Large Tract Review/)
    expect(big?.addsMonths).toBe(2)
    expect(byLabel(dc({}, { lot: { sizeSqFt: 100000, lotType: null } }), /Large Tract Review/)).toBeFalsy()
  })

  it('stormwater retention fires at 5,000 sq ft of land, not below', () => {
    expect(byLabel(dc({}, { lot: { sizeSqFt: 6000, lotType: null } }), /Stormwater Retention/)?.status).toBe('required')
    expect(byLabel(dc({}, { lot: { sizeSqFt: 3000, lotType: null } }), /Stormwater Retention/)).toBeFalsy()
  })

  it('tenant protections fire on a rental teardown: 180-day notice + TOPA', () => {
    const hs = dc({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 12 } })
    expect(byLabel(hs, /180-day notice/)?.addsMonths).toBe(6)
    expect(byLabel(hs, /TOPA/)?.status).toBe('likely')
    const vacant = dc({ projectType: 'new' }, { existing: { landUse: 'Vacant Land' } })
    expect(byLabel(vacant, /180-day notice/)).toBeFalsy()
    expect(byLabel(vacant, /TOPA/)).toBeFalsy()
  })

  it('historic-district demolition carries the public-interest test; HPRB + CFA named', () => {
    const hs = dc(
      { projectType: 'new' },
      { overlays: { historicDistrict: 'Capitol Hill Historic District', floodZone: null }, existing: { landUse: 'Row dwelling' } },
    )
    const demo = byLabel(hs, /necessary in the public interest/)
    expect(demo?.status).toBe('required')
    expect(demo?.addsMonths).toBe(4)
    const hist = byLabel(hs, /Historic district design review/)
    expect(hist?.note).toMatch(/Historic Preservation Review Board/)
    expect(hist?.note).toMatch(/Commission of Fine Arts/)
    expect(hist?.addsMonths).toBe(4) // DC's researched figure, not the module default of 3
    // Restored: the 120-day statutory clock, and DC's compatibility standard.
    expect(hist?.note).toMatch(/120 days/)
    expect(hist?.note).toMatch(/compatibility, not appropriateness/)
    expect(demo?.note).toMatch(/120-day clock/)
    expect(demo?.note).toMatch(/special merit/)
  })

  it('IZ carries the 8% / 10% set-aside and the MFI bands', () => {
    const iz = byLabel(dc({ use: 'residential', units: 40, gfa: 40000 }), /Inclusionary Zoning/)
    expect(iz?.note).toMatch(/10% of residential gross floor area/)
    expect(iz?.note).toMatch(/8%/)
    expect(iz?.note).toMatch(/50 ft/)
    expect(iz?.note).toMatch(/60% of MFI/)
    expect(iz?.note).toMatch(/80%/)
    expect(iz?.note).toMatch(/3-year window/)
    expect(iz?.note).toMatch(/no in-lieu fee/)
  })

  // SCOPE CORRECTION: § 6-1451.03(b)'s LEED mandate is written for NONRESIDENTIAL
  // projects. The truncated encoding applied it to any project ≥ 50,000 sq ft.
  it('the Green Building Act reaches the nonresidential portion only', () => {
    expect(byLabel(dc({ use: 'residential', units: 200, gfa: 250000 }), /Green Building Act/)).toBeFalsy()
    const mixed = byLabel(dc({ use: 'mixed', units: 200, gfa: 250000 }), /Green Building Act/)
    expect(mixed?.status).toBe('required')
    expect(mixed?.note).toMatch(/\$7\.50 per sq ft/)
    expect(mixed?.note).toMatch(/\$10 per sq ft/)
    expect(mixed?.note).toMatch(/\$3 million/)
    expect(mixed?.note).toMatch(/two years/)
    expect(byLabel(dc({ use: 'commercial', units: 0, gfa: 40000 }), /Green Building Act/)).toBeFalsy()
  })

  it('Large Tract Review has a second, commercial 50,000 sq ft limb', () => {
    // Small site, big commercial building: the land limb misses, the GFA limb hits.
    const comm = byLabel(dc({ use: 'commercial', units: 0, gfa: 60000 }, { lot: { sizeSqFt: 20000, lotType: null } }), /Large Tract Review/)
    expect(comm?.status).toBe('required')
    expect(comm?.note).toMatch(/50,000 sq ft/)
    expect(comm?.addsMonths).toBe(2)
    // A purely residential project below three acres is outside it entirely.
    expect(byLabel(dc({ use: 'residential', units: 60, gfa: 60000 }, { lot: { sizeSqFt: 20000, lotType: null } }), /Large Tract Review/)).toBeFalsy()
    // The land limb still states its own threshold, and the exemptions.
    const land = byLabel(dc({}, { lot: { sizeSqFt: 140000, lotType: null } }), /Large Tract Review/)
    expect(land?.note).toMatch(/three acres/)
    expect(land?.note).toMatch(/200 feet/)
    expect(land?.note).toMatch(/not an approval or denial/)
  })

  it('TOPA and First Source carry their restored statutory numbers', () => {
    const topa = byLabel(dc({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 12 } }), /TOPA/)
    expect(topa?.note).toMatch(/45 days/)
    expect(topa?.note).toMatch(/120 days to negotiate/)
    expect(topa?.note).toMatch(/15 years/)
    expect(topa?.addsMonths).toBeUndefined() // the clock only runs if tenants organise
    const fs = byLabel(dc({}), /First Source/)
    expect(fs?.note).toMatch(/51% of new hires/)
    expect(fs?.note).toMatch(/\$5,000,000/)
    expect(fs?.note).toMatch(/20% of journey-worker hours/)
    expect(fs?.note).toMatch(/70% of common-laborer hours/)
  })

  // ---- Restored-source sweep (2026-08-06). Each of the three below was encoded
  // from the `[:90]`-truncated trigger table and fired BROADER than 11-C DCMR /
  // the D.C. Code. Each test pins the tightened gate AND a case that must now
  // NOT fire — the half a green test usually leaves out.
  const dcZoned = (code: string, over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    dc(over, { zoning: { districtCode: code, subdistrict: null, article: null, maxHeightFt: 50, maxFAR: 1.8, allowedUses: ['residential'] }, ...p })

  it('the Green Area Ratio does NOT apply in the R and RF house-form zones', () => {
    // 11-C DCMR § 601.2: "all new buildings on properties in all zones EXCEPT
    // the R and RF zones". The gate fired on every new DC building.
    for (const zone of ['R-1A', 'R-2', 'R-3', 'RF-1', 'RF-4', 'RF-1/CAP', 'R-3/NO']) {
      expect(byLabel(dcZoned(zone, { projectType: 'new' }), /Green Area Ratio/), zone).toBeFalsy()
    }
    // …and it still applies everywhere else, including RA (Residential
    // Apartment), which is NOT an R or RF zone despite the leading R.
    for (const zone of ['RA-1', 'RA-2', 'MU-4', 'NC-1', 'PDR-2', 'D-4']) {
      expect(byLabel(dcZoned(zone, { projectType: 'new' }), /Green Area Ratio/)?.status, zone).toBe('required')
    }
    // An unresolved district code keeps firing: the exemption applies only where
    // the zone is affirmatively known to be R or RF (a gap is not an answer).
    expect(byLabel(dcZoned('Unknown', { projectType: 'new' }), /Green Area Ratio/)?.status).toBe('required')
  })

  it('the historic-district demolition finding needs a building to demolish', () => {
    const hd = { overlays: { historicDistrict: 'Capitol Hill Historic District', floodZone: null } }
    // Vacant lot in a historic district: nothing is being demolished, so
    // § 6-1104's public-interest finding does not apply…
    const vacant = dc({ projectType: 'new' }, { ...hd, existing: { landUse: 'Vacant Land' } })
    expect(byLabel(vacant, /necessary in the public interest/)).toBeFalsy()
    expect(byLabel(dc({ projectType: 'new' }, hd), /necessary in the public interest/)).toBeFalsy()
    // …while the design review that DOES apply to new construction still fires.
    expect(byLabel(vacant, /Historic district design review/)?.status).toBe('required')
    // A real teardown still carries it.
    expect(
      byLabel(dc({ projectType: 'new' }, { ...hd, existing: { landUse: 'Row dwelling' } }), /necessary in the public interest/)?.status,
    ).toBe('required')
  })

  it('TOPA excludes a multifamily building whose CO is within the prior 15 years', () => {
    // § 42-3404.02b(b)(20), added by the RENTAL Act of 2025.
    const recent = dc({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 12, yearBuilt: 2020 } })
    expect(byLabel(recent, /TOPA/)).toBeFalsy()
    // The 180-day notice is a different statute with no such exclusion — it must
    // still fire on the same parcel.
    expect(byLabel(recent, /180-day notice/)?.addsMonths).toBe(6)
    // Older building: TOPA applies. Unknown year: TOPA applies (a missing year
    // must not buy the exclusion).
    expect(byLabel(dc({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1985 } }), /TOPA/)?.status).toBe('likely')
    expect(byLabel(dc({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 12 } }), /TOPA/)?.status).toBe('likely')
  })

  // Restored-source sweep (2026-08-07), unreached-gate batch. 21 DCMR § 599
  // triggers on the area an activity DISTURBS; the gate read lot area instead.
  it('stormwater retention needs an activity that disturbs land, not just a big lot', () => {
    const big = { lot: { sizeSqFt: 6000, lotType: null } }
    // MUST NOT FIRE: a change of use disturbs no land at all, so the § 599
    // definition is never met however large the lot is.
    expect(byLabel(dc({ projectType: 'change_of_use' }, big), /Stormwater Retention/)).toBeFalsy()
    // Ground-up construction works the whole site: lot area is a sound stand-in
    // for disturbed area, and the requirement is asserted.
    expect(byLabel(dc({ projectType: 'new' }, big), /Stormwater Retention/)?.status).toBe('required')
    // An addition or an ADU disturbs an unknown fraction of the lot. The hurdle
    // stays — under-firing is the worse direction — but it stops asserting
    // 'required' off a quantity the source does not measure.
    for (const pt of ['addition', 'adu'] as const) {
      const h = byLabel(dc({ projectType: pt }, big), /Stormwater Retention/)
      expect(h?.status, pt).toBe('likely')
      expect(h?.note, pt).toMatch(/area your work actually disturbs/)
    }
    // The ground-up note carries no such hedge, and the lot floor still holds.
    expect(byLabel(dc({ projectType: 'new' }, big), /Stormwater Retention/)?.note).not.toMatch(/actually disturbs/)
    expect(byLabel(dc({ projectType: 'addition' }, { lot: { sizeSqFt: 3000, lotType: null } }), /Stormwater Retention/)).toBeFalsy()
  })

  it('stormwater states the 1.2-inch retention, and DCEPA names both exemptions', () => {
    const sw = byLabel(dc({}, { lot: { sizeSqFt: 6000, lotType: null } }), /Stormwater Retention/)
    expect(sw?.note).toMatch(/1\.2-inch/)
    expect(sw?.note).toMatch(/Stormwater Retention Credits/)
    const epa = byLabel(dc({}), /Environmental Policy Act/)
    expect(epa?.note).toMatch(/Central Employment Area/)
    expect(epa?.note).toMatch(/R-1 through R-5-A/)
    expect(epa?.note).toMatch(/\$2\.6M/)
  })
})

describe('assessHurdles — Denver', () => {
  const denver = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('denver', parcel(p), project({ city: 'denver', ...over }))

  it('resolves a plausible project: MAH, linkage fee, site development plan, minimum wage', () => {
    const hs = denver({ use: 'residential', units: 30, gfa: 30000 })
    const mah = byLabel(hs, /Mandatory Affordable Housing/)
    expect(mah?.status).toBe('required')
    expect(mah?.sizeDependent).toBe(true)
    // A purely residential 10+ unit project is subject to MAH, so its floor area
    // is exempt from the linkage fee — you pay one or the other (§ 27-154(k)).
    expect(byLabel(hs, /linkage fee/)).toBeFalsy()
    expect(byLabel(denver({ use: 'mixed', units: 30, gfa: 30000 }), /linkage fee/)?.sizeDependent).toBe(true)
    expect(byLabel(hs, /Site Development Plan/)?.status).toBe('required')
    const wage = byLabel(hs, /minimum wage/)
    expect(wage?.status).toBe('info')
    expect(wage?.note).toMatch(/ch\. 58/)
  })

  it('MAH does not fire below 10 units, and a duplex escapes Site Development Plan review', () => {
    const hs = denver({ use: 'residential', units: 2, gfa: 3000 })
    expect(byLabel(hs, /Mandatory Affordable Housing/)).toBeFalsy()
    expect(byLabel(hs, /Site Development Plan/)).toBeFalsy()
  })

  it('Green Buildings Ordinance fires at 25,000 sq ft with sizeDependent', () => {
    const h = byLabel(denver({ gfa: 30000 }), /Green Buildings Ordinance/)
    expect(h?.sizeDependent).toBe(true)
    expect(byLabel(denver({ gfa: 20000 }), /Green Buildings Ordinance/)).toBeFalsy()
  })

  it('Large Development Review fires only over 5 acres', () => {
    expect(byLabel(denver({}, { lot: { sizeSqFt: 250000, lotType: null } }), /Large Development Review/)?.status).toBe('likely')
    expect(byLabel(denver({}, { lot: { sizeSqFt: 100000, lotType: null } }), /Large Development Review/)).toBeFalsy()
  })

  it('Design Advisory Board fires only in the listed downtown districts', () => {
    const dz = parcel({ zoning: { districtCode: 'D-CPV-T', subdistrict: null, article: null, maxHeightFt: 200, maxFAR: 5, allowedUses: ['residential'] } })
    expect(byLabel(assessHurdles('denver', dz, project({ city: 'denver' })), /Design Advisory Board/)?.status).toBe('required')
    expect(byLabel(denver({}), /Design Advisory Board/)).toBeFalsy()
  })

  it('landmark demolition screen fires on every teardown, not on a vacant lot', () => {
    const teardown = denver({ projectType: 'new', units: 20 }, { existing: { landUse: 'Single Family Residence' } })
    expect(byLabel(teardown, /Landmark demolition screen/)?.status).toBe('required')
    expect(byLabel(denver({ projectType: 'new' }, { existing: { landUse: 'Vacant Land' } }), /Landmark demolition screen/)).toBeFalsy()
  })

  it('names the Landmark Preservation Commission in a designated district', () => {
    const hs = denver({}, { overlays: { historicDistrict: 'Potter Highlands Historic District', floodZone: null } })
    expect(byLabel(hs, /Historic district design review/)?.note).toMatch(/Landmark Preservation Commission/)
  })

  it('MAH carries its market-area percentages and the 99-year term', () => {
    const mah = byLabel(denver({ use: 'residential', units: 30, gfa: 30000 }), /Mandatory Affordable Housing/)
    expect(mah?.note).toMatch(/99 years/)
    expect(mah?.note).toMatch(/8% \(Typical\) or 10% \(High\)/)
    expect(mah?.note).toMatch(/12% \/ 15%/)
    expect(mah?.note).toMatch(/at one location/i)
  })

  it('the linkage fee publishes its per-square-foot schedule', () => {
    const fee = byLabel(denver({ use: 'commercial', units: 0, gfa: 30000 }), /linkage fee/)
    expect(fee?.note).toMatch(/\$5\.00\/sq ft/)
    expect(fee?.note).toMatch(/1,600 sq ft/)
    expect(fee?.note).toMatch(/\$8\.00\/sq ft/)
    expect(fee?.note).toMatch(/\$6\.00\/sq ft/)
    expect(fee?.note).toMatch(/\$9\.00\/sq ft/)
    expect(fee?.note).toMatch(/9 dwelling units or fewer/)
    // Mixed use at 10+ units: the fee survives, but only on commercial floor area.
    expect(byLabel(denver({ use: 'mixed', units: 30, gfa: 30000 }), /linkage fee/)?.note).toMatch(/only the commercial floor area/)
  })

  it('the landmark demolition screen publishes its 10 / 21 / 60 / 90-day clocks', () => {
    const h = byLabel(denver({ projectType: 'new', units: 20 }, { existing: { landUse: 'Single Family Residence' } }), /Landmark demolition screen/)
    expect(h?.note).toMatch(/10 working days/)
    expect(h?.note).toMatch(/21 calendar days/)
    expect(h?.note).toMatch(/60 days/)
    expect(h?.note).toMatch(/90 days/)
    expect(h?.note).toMatch(/Certificate of Demolition Eligibility/)
    expect(h?.note).toMatch(/5 years/)
    // Denver publishes DAYS, never months — converting would invent a figure.
    expect(h?.addsMonths).toBeUndefined()
  })

  it('the Cherry Creek North board is matched, not just the downtown districts', () => {
    const ccn = parcel({ zoning: { districtCode: 'C-CCN-5', subdistrict: null, article: null, maxHeightFt: 70, maxFAR: 3, allowedUses: ['residential'] } })
    const h = byLabel(assessHurdles('denver', ccn, project({ city: 'denver' })), /Design Advisory Board/)
    expect(h?.status).toBe('required')
    expect(h?.note).toMatch(/Cherry Creek North Design Advisory Board/)
    const dz = parcel({ zoning: { districtCode: 'D-GT', subdistrict: null, article: null, maxHeightFt: 200, maxFAR: 5, allowedUses: ['residential'] } })
    expect(byLabel(assessHurdles('denver', dz, project({ city: 'denver' })), /Design Advisory Board/)?.note).toMatch(/Downtown Design Advisory Board/)
  })

  // Restored-source sweep (2026-08-06): the ordinance reaches "new buildings and
  // additions" of 25,000 sq ft, plus existing buildings of that size on a roof
  // replacement. The gate fired on floor area alone.
  it('the Green Buildings Ordinance reaches new buildings and additions, not any 25,000 sq ft project', () => {
    expect(byLabel(denver({ projectType: 'new', gfa: 30000 }), /Green Buildings Ordinance/)?.status).toBe('required')
    expect(byLabel(denver({ projectType: 'addition', gfa: 30000 }), /Green Buildings Ordinance/)?.status).toBe('required')
    // A change of use inside an existing 30,000 sq ft building adds no new
    // building and no addition — the cool-roof requirement does not attach to it.
    expect(byLabel(denver({ projectType: 'change_of_use', gfa: 30000 }), /Green Buildings Ordinance/)).toBeFalsy()
    expect(byLabel(denver({ projectType: 'adu', gfa: 30000 }), /Green Buildings Ordinance/)).toBeFalsy()
    // The floor-area threshold itself is unchanged.
    expect(byLabel(denver({ projectType: 'new', gfa: 20000 }), /Green Buildings Ordinance/)).toBeFalsy()
  })

  it('the Green Buildings Ordinance names the cool roof and the second compliance path', () => {
    const h = byLabel(denver({ gfa: 30000 }), /Green Buildings Ordinance/)
    expect(h?.note).toMatch(/cool roof/)
    expect(h?.note).toMatch(/Green Building Fund/)
    expect(h?.note).toMatch(/5%/)
    const wage = byLabel(denver({}), /minimum wage/)
    expect(wage?.note).toMatch(/four hours a week/)
    expect(wage?.note).toMatch(/not a prevailing-wage rule/)
  })
})

// Rule 2: addsMonths ONLY where a duration was actually published. Anything
// this batch encoded without a researched duration must carry NO months —
// "this feels slow" is not a measurement. The shared module hurdles (historic
// design review, replacing existing housing, the public-funding process) predate
// this batch and keep their own values; everything else must be undefined.
describe('Austin / DC / Denver — no invented durations', () => {
  function expectedMonths(city: string, label: string): number | undefined {
    if (/^Historic district design review$/.test(label)) return city === 'dc' ? 4 : 3
    if (/^Replacing existing housing$/.test(label)) return 6
    if (/^Public-funding process/.test(label)) return 4
    // Researched durations, this batch:
    if (/^Historic review of any building 50 years or older$/.test(label)) return 4 // austin
    if (/^120-day tenant notice/.test(label)) return 4 // austin
    if (/^Large Tract Review/.test(label)) return 2 // dc
    if (/^Demolition in a historic district/.test(label)) return 4 // dc
    if (/^Demolishing occupied rental housing/.test(label)) return 6 // dc
    return undefined
  }

  const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
    { p: {}, j: { use: 'residential', units: 40, gfa: 60000 } },
    { p: {}, j: { use: 'commercial', units: 0, gfa: 120000, funding: 'public' } },
    { p: { lot: { sizeSqFt: 300000, lotType: null } }, j: { use: 'mixed', units: 200, gfa: 250000 } },
    { p: { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1930 } }, j: { projectType: 'new', use: 'residential', units: 4 } },
    { p: { overlays: { historicDistrict: 'A Historic District', floodZone: 'AE' } }, j: { projectType: 'new', use: 'residential', units: 12 } },
  ]

  for (const city of ['austin', 'dc', 'denver']) {
    it(`${city}: every addsMonths traces to a published duration`, () => {
      for (const s of scenarios) {
        for (const path of ['as_of_right', 'variance'] as const) {
          const hs = assessHurdles(city, parcel(s.p), project({ city, ...s.j }), { path })
          for (const h of hs) {
            expect(h.addsMonths, `${city} / ${h.label}`).toBe(expectedMonths(city, h.label))
          }
        }
      }
    })
  }

  // Rule 1: anything triggered by unit count or floor area must be tagged, or
  // softenSizeDependent() cannot fail it closed when the size is a placeholder.
  const SIZE_TRIGGERED: Record<string, RegExp[]> = {
    austin: [/materials diversion/],
    dc: [/Inclusionary Zoning/, /Large Tract Review/, /Green Construction Code/, /Green Building Act/],
    denver: [/Mandatory Affordable Housing/, /linkage fee/, /Green Buildings Ordinance/],
  }

  for (const [city, res] of Object.entries(SIZE_TRIGGERED)) {
    it(`${city}: every size-triggered hurdle carries sizeDependent`, () => {
      // Mixed use: DC's Green Building Act reaches only the nonresidential
      // portion, and Denver's linkage fee exempts residential floor area already
      // subject to Mandatory Affordable Housing — a purely residential project
      // would legitimately produce neither hurdle.
      const hs = assessHurdles(
        city,
        parcel({ lot: { sizeSqFt: 300000, lotType: null } }),
        project({ city, use: 'mixed', units: 200, gfa: 250000 }),
      )
      for (const re of res) {
        const h = byLabel(hs, re)
        expect(h, `${city} expected a hurdle matching ${re}`).toBeTruthy()
        expect(h?.sizeDependent, `${city} / ${h?.label}`).toBe(true)
      }
      // Conversely, a hurdle that fires regardless of size must NOT be tagged —
      // the tag is what a placeholder size downgrades, so over-tagging hides
      // requirements that genuinely apply.
      const alwaysOn = hs.filter((h) => /Street impact fee|Water and wastewater|Site Development Plan|minimum wage|First Source|Green Area Ratio/.test(h.label))
      expect(alwaysOn.length, `${city} expected at least one always-on hurdle`).toBeGreaterThan(0)
      for (const h of alwaysOn) expect(h.sizeDependent, `${city} / ${h.label}`).toBeFalsy()
    })
  }
})

// ---------------------------------------------------------------------------
// Minneapolis / Philadelphia / Miami — encoded from docs/HURDLE-PROPOSALS.md.
// ---------------------------------------------------------------------------

describe('assessHurdles — Minneapolis', () => {
  const mpls = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('minneapolis', parcel(p), project({ city: 'minneapolis', ...over }))

  it('resolves a plausible project: IZ, site plan review, parkland, and the labour absence', () => {
    const hs = mpls({ use: 'residential', units: 60, gfa: 60000 })
    const iz = byLabel(hs, /Inclusionary Zoning: 8%/)
    expect(iz?.status).toBe('required')
    expect(iz?.sizeDependent).toBe(true)
    expect(iz?.note).toMatch(/550\.810/)
    // The set-aside terms, restored from the full source: depth, duration, the
    // two alternatives, and both cash-in-lieu rates.
    expect(iz?.note).toMatch(/60% of Area Median Income/)
    expect(iz?.note).toMatch(/20 years/)
    expect(iz?.note).toMatch(/7% at 50% AMI/)
    expect(iz?.note).toMatch(/4% at 30% AMI/)
    expect(iz?.note).toMatch(/\$15 per square foot/)
    expect(iz?.note).toMatch(/\$22 per square foot/)
    expect(byLabel(hs, /Site plan review/)?.addsMonths).toBe(2)
    expect(byLabel(hs, /Travel demand management/)?.status).toBe('required')
    const park = byLabel(hs, /Parkland dedication/)
    expect(park?.note).toMatch(/598\.370/)
    // Both dedication rates and the ordinance's own cash figure — carried WITH
    // its CPI caveat, because the current published amount could not be read.
    expect(park?.note).toMatch(/\.0066 acres/)
    expect(park?.note).toMatch(/\.01 acres/)
    expect(park?.note).toMatch(/\$1,500 per non-exempt unit/)
    expect(park?.note).toMatch(/CPI-U/)
    // ABSENCES — the most valuable rows.
    const labor = byLabel(hs, /No prevailing-wage rule/)
    expect(labor?.status).toBe('info')
    expect(labor?.note).toMatch(/38\.30/)
    expect(labor?.note).toMatch(/\$100,000/) // the living-wage ordinance's own floor
    const eaw = byLabel(hs, /State environmental review \(EAW\)/)
    expect(eaw?.status).toBe('info')
    expect(eaw?.note).toMatch(/375 attached/)
    // The other three EAW/EIS branches, all lost to truncation.
    expect(eaw?.note).toMatch(/150 attached/) // not consistent with the comp plan
    expect(eaw?.note).toMatch(/1,500 attached/) // mandatory EIS
    expect(eaw?.note).toMatch(/4410\.4400/)
    expect(byLabel(hs, /Mississippi River Corridor/)?.status).toBe('info')
  })

  it('the 50-unit inclusionary floor: mandate above, stated absence below', () => {
    const small = mpls({ use: 'residential', units: 30 })
    expect(byLabel(small, /Inclusionary Zoning: 8%/)).toBeFalsy()
    const absence = byLabel(small, /does not bite below 50 rental units/)
    expect(absence?.status).toBe('info')
    expect(absence?.note).toMatch(/for-sale/)
  })

  it('site plan review fires at 4 units, not at 3', () => {
    expect(byLabel(mpls({ use: 'residential', units: 4 }), /Site plan review/)?.sizeDependent).toBe(true)
    expect(byLabel(mpls({ use: 'residential', units: 3 }), /Site plan review/)).toBeFalsy()
    expect(byLabel(mpls({ use: 'residential', units: 40 }), /Travel demand management/)).toBeFalsy()
  })

  it('site plan review carries its SECOND threshold: administrative under 20, hearing at 20', () => {
    // Table 550-1 + footnote 2. The truncated table carried the 4-unit trigger
    // only, so the row read as one undifferentiated review at every size.
    const small = byLabel(mpls({ use: 'residential', units: 6 }), /Site plan review/)
    expect(small?.note).toMatch(/administrative/)
    expect(small?.note).toMatch(/starts at 20/)
    const big = byLabel(mpls({ use: 'residential', units: 20 }), /Site plan review/)
    expect(big?.note).toMatch(/NOT eligible for administrative review/)
    expect(big?.note).toMatch(/City Planning Commission/)
    // Both branches carry the one duration the research published, and no more.
    expect(small?.addsMonths).toBe(2)
    expect(big?.addsMonths).toBe(2)
    expect(big?.note).toMatch(/15\.99/)
  })

  it('travel demand management steps from a minor plan to a major one at 250 units', () => {
    const minor = byLabel(mpls({ use: 'residential', units: 60 }), /Travel demand management/)
    expect(minor?.note).toMatch(/MINOR/)
    expect(minor?.note).toMatch(/4 points/)
    expect(minor?.note).toMatch(/250/)
    const major = byLabel(mpls({ use: 'residential', units: 250 }), /Travel demand management/)
    expect(major?.note).toMatch(/MAJOR/)
    expect(major?.note).toMatch(/6 points/)
    expect(major?.note).toMatch(/licensed engineer/)
  })

  it('the TDM row carries its softener on BOTH branches, and starts at 50 units exactly', () => {
    // The source states "A written exemption request is possible" as a property
    // of the TDM requirement, not of the major plan — but it was written into
    // the 250+ branch only, so a 60-unit project was told the plan was
    // unconditional. Same shape as ledger rule 17: text true in one context and
    // silently absent from the sibling context a reader actually lands in.
    const minor = byLabel(mpls({ use: 'residential', units: 60 }), /Travel demand management/)
    const major = byLabel(mpls({ use: 'residential', units: 250 }), /Travel demand management/)
    expect(minor?.note).toMatch(/written exemption request/)
    expect(major?.note).toMatch(/written exemption request/)
    // Boundary, pinned exactly: Table 555-10 reads "fifty (50) or more".
    expect(byLabel(mpls({ use: 'residential', units: 50 }), /Travel demand management/)?.status).toBe('required')
    expect(byLabel(mpls({ use: 'residential', units: 49 }), /Travel demand management/)).toBeFalsy()
  })

  it('demolition screen on every teardown; no-net-loss only at 100+ units over an old building', () => {
    const teardown = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } })
    const screen = byLabel(teardown, /screened for historic significance/)
    expect(screen?.status).toBe('required')
    // The HPC consequence, restored: a denial carries a 90-day delay, and the
    // commission can condition approval on up to 90 days more.
    expect(screen?.note).toMatch(/90-day demolition delay/)
    expect(screen?.note).toMatch(/Heritage Preservation Commission/)
    const nnl = byLabel(teardown, /No net loss/)
    expect(nnl?.status).toBe('required')
    expect(nnl?.sizeDependent).toBe(true)
    // The rule is a MAXIMUM of two quantities, not a flat 8% — the point of
    // the row, and the part the truncated table dropped.
    expect(nnl?.note).toMatch(/GREATER of 8%/)
    // Under 100 units → no replacement duty asserted.
    const small = mpls({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } })
    expect(byLabel(small, /No net loss/)).toBeFalsy()
    // A recent building is under the 50-year line.
    const recent = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 2015 } })
    expect(byLabel(recent, /No net loss/)).toBeFalsy()
    // Unknown year must NOT wave it through.
    const unknown = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Apartment', units: 20 } })
    expect(byLabel(unknown, /No net loss/)?.note).toMatch(/no year built/)
    // Vacant lot → neither.
    const vacant = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Vacant Land' } })
    expect(byLabel(vacant, /screened for historic significance/)).toBeFalsy()
  })

  it('administrative site plan review is CONJUNCTIVE: under 20 units AND no other public hearing', () => {
    // Table 550-1: "may be reviewed administratively if BOTH of the following
    // apply: (1) no other land use application requiring a public hearing.
    // (2) fewer than twenty (20) new or additional dwelling units". Only the
    // unit half was encoded, so a 6-unit project needing a variance was told
    // its review was administrative — "no hearing, no commission" — which is
    // false: the variance is itself heard in public.
    const asOfRight = byLabel(mpls({ use: 'residential', units: 6 }), /Site plan review/)
    expect(asOfRight?.note).toMatch(/BOTH conditions/)
    expect(asOfRight?.note).toMatch(/This project meets both, so the review is administrative/)
    const withVariance = byLabel(
      assessHurdles('minneapolis', parcel({}), project({ city: 'minneapolis', use: 'residential', units: 6 }), { path: 'variance' }),
      /Site plan review/,
    )
    expect(withVariance?.note).toMatch(/NOT eligible for administrative review/)
    expect(withVariance?.note).toMatch(/City Planning Commission/)
    // The one published duration is unchanged on every branch.
    expect(withVariance?.addsMonths).toBe(2)
  })

  it('parkland dedication needs a net increase in dwelling units', () => {
    // § 598.370(a) fires on "a net increase in residential dwelling units", and
    // every item on its exclusion list adds none. The gate read residential use.
    expect(byLabel(mpls({ use: 'residential', units: 12 }), /Parkland dedication/)?.status).toBe('required')
    const noNewUnits = mpls({ use: 'residential', projectType: 'addition', units: 0, gfa: 30000 })
    expect(byLabel(noNewUnits, /Parkland dedication/)).toBeFalsy()
    // Not a magnitude threshold — the research row states sizeDependent False,
    // and softenSizeDependent must not reach it.
    expect(byLabel(mpls({ use: 'residential', units: 12 }), /Parkland dedication/)?.sizeDependent).toBeFalsy()
    // The EAW absence is NOT gated on the unit test — it is a finding about
    // residential development as such.
    expect(byLabel(noNewUnits, /State environmental review \(EAW\)/)?.status).toBe('info')
  })

  it('no net loss counts demolished DWELLING units — a warehouse teardown raises none', () => {
    // "If a project with 100 or more units will demolish units that are 50 or
    // more years old". Demolishing a non-residential building demolishes no
    // dwelling units, so the requirement stays at the ordinary 8%.
    const warehouse = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Warehouse', units: 0, yearBuilt: 1920 } })
    expect(byLabel(warehouse, /No net loss/)).toBeFalsy()
    // The demolition SCREEN is not narrowed with it — that one really does
    // reach every principal building (§ 599.910(a)).
    expect(byLabel(warehouse, /screened for historic significance/)?.status).toBe('required')
    // Fails closed: a positive unit count on a non-residential label still
    // fires, and so does an unlabelled building.
    const mixed = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Commercial', units: 6, yearBuilt: 1920 } })
    expect(byLabel(mixed, /No net loss/)?.status).toBe('required')
    const unlabelled = mpls({ projectType: 'new', units: 120 }, { existing: { buildingAreaSqFt: 9000, yearBuilt: 1920 } })
    expect(byLabel(unlabelled, /No net loss/)?.status).toBe('required')
    // A single-family house is still a dwelling unit.
    const house = mpls({ projectType: 'new', units: 120 }, { existing: { landUse: 'Single Family Residence', yearBuilt: 1920 } })
    expect(byLabel(house, /No net loss/)?.status).toBe('required')
  })

  it('the inclusionary mandate discloses the tenure half of its trigger', () => {
    // UHP § III reaches RENTAL projects only and exempts all for-sale projects
    // until further notice. There is no tenure field on AnalysisInput, so the
    // qualifier cannot be gated on — it must at least be stated, not implied by
    // one capitalised word buried mid-note.
    const iz = byLabel(mpls({ use: 'residential', units: 60 }), /Inclusionary Zoning: 8%/)
    expect(iz?.note).toMatch(/TENURE IS PART OF THE TRIGGER/)
    expect(iz?.note).toMatch(/for-sale projects — condominiums and for-sale townhomes — are exempt/)
  })

  it('the major TDM plan carries the building-conversion exception on its row', () => {
    const major = byLabel(mpls({ use: 'residential', units: 250 }), /Travel demand management/)
    expect(major?.note).toMatch(/except as otherwise authorized in this table for building conversions/)
  })

  it('does NOT name a historic review body — none was researched for Minneapolis', () => {
    // Rule 4: no citation, no claim. The generic copy is correct here; an
    // invented commission name would read as sourced six months from now.
    const hs = mpls({}, { overlays: { historicDistrict: 'Milwaukee Avenue Historic District', floodZone: null } })
    const h = byLabel(hs, /Historic district design review/)
    expect(h?.status).toBe('required')
    expect(h?.note).toMatch(/local historic-district commission/)
  })
})

describe('assessHurdles — Philadelphia', () => {
  const phl = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('philadelphia', parcel(p), project({ city: 'philadelphia', ...over }))

  it('resolves a plausible project: impact tax, stormwater, and the inclusionary absence', () => {
    const hs = phl({ use: 'residential', units: 40, gfa: 40000 }, { lot: { sizeSqFt: 12000, lotType: null } })
    const tax = byLabel(hs, /Development Impact Tax/)
    expect(tax?.status).toBe('required')
    // The rate as the Code states it, not just the rounded percentage.
    expect(tax?.note).toMatch(/\$1\.00 per \$100/)
    expect(byLabel(hs, /stormwater review/)?.status).toBe('likely')
    const absence = byLabel(hs, /No citywide inclusionary mandate/)
    expect(absence?.status).toBe('info')
    expect(absence?.note).toMatch(/14-702\(7\)\(a\)/)
    const min = byLabel(hs, /Mixed Income Neighborhoods/)
    expect(min?.status).toBe('likely')
    // /MIN set-asides — restored from the full source (§ 14-533(3)(a)-(b)).
    expect(min?.note).toMatch(/15%/)
    expect(min?.note).toMatch(/20%/)
    expect(min?.note).toMatch(/\$10,900 per permitted dwelling unit/)
  })

  it('the /MIN overlay is a Residential Housing Project rule: 10 units, not any size', () => {
    // § 14-533(2): "ten or more dwelling units, twenty or more sleeping units".
    // The truncated table lost the number and this fired on every residential
    // project, however small.
    expect(byLabel(phl({ use: 'residential', units: 10 }), /Mixed Income Neighborhoods/)?.sizeDependent).toBe(true)
    expect(byLabel(phl({ use: 'residential', units: 9 }), /Mixed Income Neighborhoods/)).toBeFalsy()
  })

  it('Civic Design Review: required over 100,000 sq ft / 100 units, likely in the halved band', () => {
    const byArea = byLabel(phl({ gfa: 150000, units: 10 }), /Civic Design Review/)
    expect(byArea?.status).toBe('required')
    expect(byArea?.sizeDependent).toBe(true)
    expect(byArea?.addsMonths).toBe(5)
    expect(byLabel(phl({ gfa: 20000, units: 140 }), /Civic Design Review/)?.status).toBe('required')
    // Table 14-304-2 Case 2 HALVES both figures where the site affects a
    // property in a Residential district. We hold no adjacency data, so the
    // 50k–100k sq ft / 50–100 unit band is 'likely' with the condition named.
    const halved = byLabel(phl({ gfa: 40000, units: 60 }), /Civic Design Review/)
    expect(halved?.status).toBe('likely')
    expect(halved?.note).toMatch(/50,000 sq ft/)
    expect(halved?.note).toMatch(/200 ft/)
    // Below both cases, nothing fires.
    expect(byLabel(phl({ gfa: 40000, units: 40 }), /Civic Design Review/)).toBeFalsy()
  })

  it('the Project Information Form trigger is conjunctive, not size alone', () => {
    // § 18-502(2): over 2,500 sq ft AND (Council ordinance | ZBA special
    // exception or variance | meets the CDR criteria). The truncated table
    // carried only the size half, so this asserted a filing on every
    // as-of-right project over 2,500 sq ft.
    expect(byLabel(phl({ gfa: 40000, units: 40 }), /Project Information Form/)).toBeFalsy()
    const disc = assessHurdles(
      'philadelphia',
      parcel({}),
      project({ city: 'philadelphia', gfa: 40000, units: 40 }),
      { path: 'variance' },
    )
    const pif = byLabel(disc, /Project Information Form/)
    expect(pif?.status).toBe('required')
    expect(pif?.sizeDependent).toBe(true)
    // The CDR arm fires it on a purely as-of-right permit.
    expect(byLabel(phl({ gfa: 150000, units: 40 }), /Project Information Form/)?.status).toBe('required')
    // Size floor still binds, and so does the three-or-fewer-units exemption.
    expect(byLabel(phl({ gfa: 2000 }), /Project Information Form/)).toBeFalsy()
    const tiny = assessHurdles(
      'philadelphia',
      parcel({}),
      project({ city: 'philadelphia', use: 'residential', gfa: 4000, units: 3 }),
      { path: 'variance' },
    )
    expect(byLabel(tiny, /Project Information Form/)).toBeFalsy()
  })

  it('stormwater respects its threshold and names the PCSM step-up', () => {
    expect(byLabel(phl({}, { lot: { sizeSqFt: 3000, lotType: null } }), /stormwater review/)).toBeFalsy()
    const sw = byLabel(phl({}, { lot: { sizeSqFt: 20000, lotType: null } }), /stormwater review/)
    expect(sw?.note).toMatch(/15,000 sq ft/)
    expect(sw?.note).toMatch(/45 days/)
  })

  it('RCO notice fires on a variance AND on the Civic Design Review trigger', () => {
    const disc = assessHurdles('philadelphia', parcel({}), project({ city: 'philadelphia' }), { path: 'variance' })
    const dh = byLabel(disc, /RCO neighborhood notice/)
    expect(dh?.status).toBe('required')
    expect(dh?.note).toMatch(/250 ft/)
    expect(dh?.note).toMatch(/45 days/)
    // A variance is a trigger at any size, so that path is NOT size-gated.
    expect(dh?.sizeDependent).toBeFalsy()
    const aor = assessHurdles('philadelphia', parcel({}), project({ city: 'philadelphia' }), { path: 'as_of_right' })
    expect(byLabel(aor, /RCO neighborhood notice/)).toBeFalsy()
    // § 14-303(12)(a)(.3): meeting the CDR criteria is an independent trigger.
    const big = assessHurdles(
      'philadelphia',
      parcel({}),
      project({ city: 'philadelphia', gfa: 150000 }),
      { path: 'as_of_right' },
    )
    const bh = byLabel(big, /RCO neighborhood notice/)
    expect(bh?.status).toBe('required')
    expect(bh?.sizeDependent).toBe(true) // fired purely on size → fails closed
  })

  it('the three demolition rows fire on a teardown only', () => {
    const hs = phl({ projectType: 'new', units: 20 }, { existing: { landUse: 'Row dwelling' } })
    const demo = byLabel(hs, /Licensed demolition contractor/)
    expect(demo?.status).toBe('required')
    expect(demo?.note).toMatch(/21 days/)
    expect(demo?.note).toMatch(/500 sq ft/) // § A-301.1 permit trigger
    expect(demo?.note).toMatch(/250 ft/) // informational-bulletin radius
    expect(byLabel(hs, /former house of worship/)?.status).toBe('info')
    const ahp = byLabel(hs, /AHP overlay/)
    expect(ahp?.status).toBe('info')
    // Sequencing, not unit count — the replacement permit must come FIRST.
    expect(ahp?.note).toMatch(/ALREADY been issued/)
    const vacant = phl({ projectType: 'new' }, { existing: { landUse: 'Vacant Land' } })
    expect(byLabel(vacant, /Licensed demolition contractor/)).toBeFalsy()
  })

  it('the house-of-worship row carries its 50-year half, and an unknown age does not clear it', () => {
    // § A-303.5 is conjunctive: current-or-former religious use AND at least
    // 50 years old. The truncated table carried only the use half.
    const old = phl({ projectType: 'new' }, { existing: { landUse: 'Row dwelling', yearBuilt: 1910 } })
    const h = byLabel(old, /former house of worship/)
    expect(h?.note).toMatch(/at least 50 years old/)
    expect(h?.note).toMatch(/30 days/) // the RCO must meet within 30 days of notice
    expect(h?.note).toMatch(/1910/)
    // Unknown year built must NOT wave it through.
    const unknown = phl({ projectType: 'new' }, { existing: { landUse: 'Row dwelling' } })
    expect(byLabel(unknown, /former house of worship/)?.note).toMatch(/no year built/)
    // A building known to be under 50 cannot be caught by it.
    const recent = phl({ projectType: 'new' }, { existing: { landUse: 'Row dwelling', yearBuilt: 2015 } })
    expect(byLabel(recent, /former house of worship/)).toBeFalsy()
  })

  it('Civic Design Review counts only floor area OUTSIDE an existing structure', () => {
    // Table 14-304-2 fires on "new construction or an expansion" and excludes
    // "any floor area within an existing structure" and "any dwelling units
    // within an existing structure". A conversion inside an existing building
    // creates neither, however large it is — the gate read gfa alone.
    expect(byLabel(phl({ gfa: 150000, units: 140 }), /Civic Design Review/)?.status).toBe('required')
    const conversion = phl({ projectType: 'change_of_use', gfa: 150000, units: 140 })
    expect(byLabel(conversion, /Civic Design Review/)).toBeFalsy()
    // ...and with CDR gone, the two rows that trigger off it go too.
    expect(byLabel(conversion, /RCO neighborhood notice/)).toBeFalsy()
    expect(byLabel(conversion, /Project Information Form/)).toBeFalsy()
    // An expansion is expressly in scope.
    expect(byLabel(phl({ projectType: 'addition', gfa: 150000, units: 140 }), /Civic Design Review/)?.status).toBe('required')
  })

  it('Civic Design Review does not reach the SP districts § 14-304(5)(b)(.1) excludes', () => {
    // Both cases open "located in any district, except as provided in
    // § 14-304(5)(b)(.1)" — SP-ENT, SP-PO and SP-STA are excluded outright.
    for (const districtCode of ['SP-ENT', 'SP-PO', 'SP-STA']) {
      const hs = phl(
        { gfa: 150000, units: 140 },
        { zoning: { districtCode, subdistrict: null, article: null, maxHeightFt: null, maxFAR: null, allowedUses: null } },
      )
      expect(byLabel(hs, /Civic Design Review/), districtCode).toBeFalsy()
    }
    // A district that merely starts with the same letters is not excluded — the
    // industrial exclusion is "certain I-1/I-2/I-3/I-P buildings" in the source
    // and is deliberately NOT gated on.
    const industrial = phl(
      { gfa: 150000, units: 140 },
      { zoning: { districtCode: 'I-2', subdistrict: null, article: null, maxHeightFt: null, maxFAR: null, allowedUses: null } },
    )
    expect(byLabel(industrial, /Civic Design Review/)?.status).toBe('required')
  })

  it('RCO notice and the PIF follow CDR into the halved Case 2 band, at Case 2’s own confidence', () => {
    // § 14-303(12)(a)(.3) and § 18-502(2)(c) both read "meets the requirements
    // for Civic Design Review in § 14-304(5)" — Case 1 OR Case 2. Reading only
    // Case 1 made both rows NARROWER than the source: a project in the halved
    // band was never told either might apply. UNDER-firing, so the fix adds a
    // row rather than removing one, and it carries Case 2's 'likely'.
    const halved = phl({ gfa: 60000, units: 60 })
    expect(byLabel(halved, /Civic Design Review/)?.status).toBe('likely')
    const rco = byLabel(halved, /RCO neighborhood notice/)
    expect(rco?.status).toBe('likely')
    expect(rco?.note).toMatch(/Case 2/)
    expect(rco?.sizeDependent).toBe(true)
    const pif = byLabel(halved, /Project Information Form/)
    expect(pif?.status).toBe('likely')
    expect(pif?.note).toMatch(/Case 2 threshold/)
    // Case 1 is still 'required', and below both cases nothing fires.
    expect(byLabel(phl({ gfa: 150000 }), /RCO neighborhood notice/)?.status).toBe('required')
    expect(byLabel(phl({ gfa: 150000 }), /Project Information Form/)?.status).toBe('required')
    expect(byLabel(phl({ gfa: 40000, units: 40 }), /RCO neighborhood notice/)).toBeFalsy()
    expect(byLabel(phl({ gfa: 40000, units: 40 }), /Project Information Form/)).toBeFalsy()
  })

  it('the 21-day demolition posting carries its three stated exceptions', () => {
    const demo = byLabel(phl({ projectType: 'new', units: 20 }, { existing: { landUse: 'Row dwelling' } }), /Licensed demolition contractor/)
    expect(demo?.note).toMatch(/imminently dangerous/)
    expect(demo?.note).toMatch(/14-303\(13\)/)
    expect(demo?.note).toMatch(/subject of a Zoning Board variance/)
  })

  it('names the Philadelphia Historical Commission in a historic district', () => {
    const hs = phl({}, { overlays: { historicDistrict: 'Rittenhouse-Fitler Historic District', floodZone: null } })
    expect(byLabel(hs, /Historic district design review/)?.note).toMatch(/Philadelphia Historical Commission/)
  })
})

describe('assessHurdles — Miami', () => {
  const mia = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('miami', parcel(p), project({ city: 'miami', ...over }))

  it('resolves a plausible project: three stacked impact fees and the tree permit', () => {
    const hs = mia({ use: 'residential', units: 40, gfa: 40000 })
    expect(byLabel(hs, /City of Miami development impact fees/)?.status).toBe('required')
    expect(byLabel(hs, /multimodal mobility impact fee/)?.note).toMatch(/33E-2\(c\)/)
    expect(byLabel(hs, /educational facilities impact fee/)?.note).toMatch(/33K-1\(c\)/)
    expect(byLabel(hs, /Downtown DRI/)?.status).toBe('info')
    expect(byLabel(hs, /Tree removal permit/)?.status).toBe('likely')
  })

  it('every fee row carries the amount the code states — all four lost it to truncation', () => {
    const hs = mia({ use: 'residential', units: 40, gfa: 40000 })
    // City: four fees, and the rate tiers by units per building (Ord. 12750).
    const city = byLabel(hs, /City of Miami development impact fees/)
    expect(city?.note).toMatch(/\$3,959\.00/) // parks, 10+ unit building
    expect(city?.note).toMatch(/\$409\.00/) // fire-rescue, same tier
    expect(city?.note).toMatch(/\$6,818\.00/) // parks, single-family tier
    // County mobility: a per-unit range across four context zones.
    const mobility = byLabel(hs, /multimodal mobility impact fee/)
    expect(mobility?.note).toMatch(/\$4,465/)
    expect(mobility?.note).toMatch(/\$5,115/)
    expect(mobility?.note).toMatch(/Context Zone/)
    // Schools: a formula, not a flat fee.
    const schools = byLabel(hs, /educational facilities impact fee/)
    expect(schools?.note).toMatch(/\$0\.90/)
    expect(schools?.note).toMatch(/\$600\.00/)
    expect(schools?.note).toMatch(/2% administrative fee/)
    expect(schools?.note).toMatch(/3,800 sq ft/)
    // Downtown DRI: the codified coefficient, carried WITH its escalator, since
    // the amount actually collected today is higher and was not read.
    const dri = byLabel(hs, /Downtown DRI/)
    expect(dri?.note).toMatch(/\$0\.3846/)
    expect(dri?.note).toMatch(/CPI/)
    // Trees: the replacement schedule is priced.
    expect(byLabel(hs, /Tree removal permit/)?.note).toMatch(/\$6,000\.00/)
  })

  it('the DRI and tree rows carry the exception clause their own source opens with', () => {
    // Both verbatims are qualified and both qualifiers were dropped: § 13-56
    // opens "Except as may be provided section 13-58, no ... permits shall be
    // issued", and the tree article applies to all property "unless expressly
    // exempted by law". Neither exception was read, so each is named as an
    // unresolved GAP rather than either asserted or silently discarded
    // (ledger rule 5). No gate condition changed — these rows fire exactly
    // where they did before, so the boundary tests below still hold.
    const hs = mia({ use: 'residential', units: 40, gfa: 40000 })
    const dri = byLabel(hs, /Downtown DRI/)
    expect(dri?.status).toBe('info')
    expect(dri?.note).toMatch(/Except as may be provided section 13-58/)
    expect(dri?.note).toMatch(/NOT read here/)
    const trees = byLabel(hs, /Tree removal permit/)
    expect(trees?.status).toBe('likely')
    expect(trees?.note).toMatch(/unless expressly exempted by law/)
    expect(trees?.note).toMatch(/NOT read here/)
    // Neither row is size- or use-triggered in its source, so neither may carry
    // the sizeDependent tag that a placeholder floor area would downgrade.
    expect(dri?.sizeDependent).toBeFalsy()
    expect(trees?.sizeDependent).toBeFalsy()
    // ...and neither invents a duration.
    expect(dri?.addsMonths).toBeUndefined()
    expect(trees?.addsMonths).toBeUndefined()
  })

  it('the three absences are encoded as findings, not omissions', () => {
    const hs = mia({ use: 'residential', units: 40 })
    const inclusionary = byLabel(hs, /No mandatory inclusionary requirement/)
    expect(inclusionary?.status).toBe('info')
    expect(inclusionary?.note).toMatch(/3\.15/)
    const env = byLabel(hs, /No state environmental review act/)
    expect(env?.status).toBe('info')
    expect(env?.note).toMatch(/380\.06/)
    const labor = byLabel(hs, /No local prevailing-wage rule/)
    expect(labor?.status).toBe('info')
    expect(labor?.note).toMatch(/218\.077/)
  })

  it('UDRB referral fires over 200,000 sq ft with sizeDependent', () => {
    const h = byLabel(mia({ gfa: 250000 }), /Urban Development Review Board/)
    expect(h?.status).toBe('likely')
    expect(h?.sizeDependent).toBe(true)
    expect(byLabel(mia({ gfa: 150000 }), /Urban Development Review Board/)).toBeFalsy()
  })

  // REWRITTEN. The previous version of this test was called "historic delay on
  // any teardown" and asserted exactly that — a green test defending an
  // over-broad gate (ledger rule 15). § 23-6.2(b)(4)b.4's six-month arm reaches
  // "demolition or relocation of a CONTRIBUTING structure or landscape feature",
  // which presupposes a designated historic district or site; the gate read
  // `teardown` alone, so every Miami teardown in the city carried it.
  it('the six-month demolition deferral needs a designated historic district, not just a teardown', () => {
    const historic = mia(
      { projectType: 'new', units: 40 },
      { existing: { landUse: 'Apartment', units: 8 }, overlays: { historicDistrict: 'Morningside Historic District', floodZone: null } },
    )
    const delay = byLabel(historic, /Historic demolition delay/)
    expect(delay?.status).toBe('likely')
    expect(delay?.addsMonths).toBeUndefined() // the research row published no duration
    expect(delay?.note).toMatch(/six months/)
    expect(delay?.note).toMatch(/CONTRIBUTING/)
    // Outside a district the six-month arm must NOT fire.
    const plain = mia({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 8 } })
    expect(byLabel(plain, /Historic demolition delay/)).toBeFalsy()
    // ...but the 45-day archaeological arm of the same provision does not turn
    // on a district, so it keeps a row rather than vanishing with the fix.
    const dig = byLabel(plain, /Archaeological zone/)
    expect(dig?.status).toBe('info')
    expect(dig?.note).toMatch(/45 calendar days/)
    expect(dig?.addsMonths).toBeUndefined()
  })

  it('no-relocation absence: rental multifamily only, and only outside a historic district', () => {
    const rental = mia({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 8 } })
    expect(byLabel(rental, /No tenant relocation/)?.status).toBe('info')
    const sfh = mia({ projectType: 'new', units: 4 }, { existing: { landUse: 'Single Family Residence' } })
    expect(byLabel(sfh, /No tenant relocation/)).toBeFalsy()
    // The trigger says "outside a designated historic district" in as many
    // words — inside one, demolition runs the certificate-of-appropriateness
    // process and the flat absence is not the whole story.
    const inDistrict = mia(
      { projectType: 'new', units: 40 },
      { existing: { landUse: 'Apartment', units: 8 }, overlays: { historicDistrict: 'Morningside Historic District', floodZone: null } },
    )
    expect(byLabel(inDistrict, /No tenant relocation/)).toBeFalsy()
  })

  it('city impact fees need a NET INCREASE in dwelling units, not just residential use', () => {
    // § 13-6: a permit for additions, remodels or rehabilitation "which result
    // in ... no net increase in the number of residential dwelling units" is
    // exempt. The gate read residential use alone.
    expect(byLabel(mia({ use: 'residential', units: 12 }), /City of Miami development impact fees/)?.status).toBe('required')
    const noNewUnits = mia({ use: 'residential', projectType: 'addition', units: 0, gfa: 30000 })
    expect(byLabel(noNewUnits, /City of Miami development impact fees/)).toBeFalsy()
    // The county school fee is NOT narrowed with it — § 33K-5 also reaches
    // "expansions of existing units", so a unit test there would under-fire.
    expect(byLabel(noNewUnits, /educational facilities impact fee/)?.status).toBe('required')
    // And the county mobility fee is charged on any development activity.
    expect(byLabel(noNewUnits, /multimodal mobility impact fee/)?.status).toBe('required')
  })

  it('the no-CEQA absence is stated with its condition, not as a flat exemption', () => {
    // § 380.06(12)(a) is conjunctive: a development EXCEEDING the § 380.0651
    // statewide guidelines is still reviewed by the local government under
    // § 163.3184(4), and only comprehensive-plan consistency removes that.
    const env = byLabel(mia({ use: 'residential', units: 40 }), /No state environmental review act/)
    expect(env?.status).toBe('info')
    expect(env?.note).toMatch(/380\.06/)
    expect(env?.note).toMatch(/380\.0651/)
    expect(env?.note).toMatch(/163\.3184\(4\)/)
    expect(env?.note).toMatch(/consistent with the comprehensive plan|consistency/)
  })

  it('names the HEPB in a historic district', () => {
    const hs = mia({}, { overlays: { historicDistrict: 'Morningside Historic District', floodZone: null } })
    expect(byLabel(hs, /Historic district design review/)?.note).toMatch(/Historic and Environmental Preservation Board/)
  })
})

// Rules 1 and 2 again, for this batch. Same shape as the Austin/DC/Denver block
// above: no duration that the research did not publish, and every size trigger
// tagged so softenSizeDependent() can fail it closed.
describe('Minneapolis / Philadelphia / Miami — no invented durations', () => {
  function expectedMonths(label: string): number | undefined {
    if (/^Historic district design review$/.test(label)) return 3 // module default; no override researched
    if (/^Replacing existing housing$/.test(label)) return 6
    if (/^Public-funding process/.test(label)) return 4
    // Researched durations, this batch — exactly two rows published one:
    if (/^Site plan review$/.test(label)) return 2 // minneapolis § 550.510
    if (/^Civic Design Review$/.test(label)) return 5 // philadelphia § 14-304(5)(b)
    return undefined
  }

  const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
    { p: {}, j: { use: 'residential', units: 40, gfa: 60000 } },
    { p: {}, j: { use: 'commercial', units: 0, gfa: 250000, funding: 'public' } },
    { p: { lot: { sizeSqFt: 300000, lotType: null } }, j: { use: 'mixed', units: 200, gfa: 250000 } },
    { p: { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1930 } }, j: { projectType: 'new', use: 'residential', units: 120 } },
    { p: { overlays: { historicDistrict: 'A Historic District', floodZone: 'AE' } }, j: { projectType: 'new', use: 'residential', units: 12 } },
  ]

  for (const city of ['minneapolis', 'philadelphia', 'miami']) {
    it(`${city}: every addsMonths traces to a published duration`, () => {
      for (const s of scenarios) {
        for (const path of ['as_of_right', 'variance'] as const) {
          const hs = assessHurdles(city, parcel(s.p), project({ city, ...s.j }), { path })
          for (const h of hs) {
            expect(h.addsMonths, `${city} / ${h.label}`).toBe(expectedMonths(h.label))
          }
        }
      }
    })
  }

  const SIZE_TRIGGERED: Record<string, RegExp[]> = {
    minneapolis: [/Inclusionary Zoning: 8%/, /Site plan review/, /Travel demand management/, /State environmental review \(EAW\)/],
    philadelphia: [
      /Civic Design Review/,
      /Mixed Income Neighborhoods/,
      /Project Information Form/,
      /stormwater review/,
      // Fires here purely on the CDR size trigger (as_of_right), so it is
      // size-gated on this path and must fail closed with the rest.
      /RCO neighborhood notice/,
    ],
    miami: [/Urban Development Review Board/],
  }

  for (const [city, res] of Object.entries(SIZE_TRIGGERED)) {
    it(`${city}: every size-triggered hurdle carries sizeDependent`, () => {
      const hs = assessHurdles(
        city,
        parcel({ lot: { sizeSqFt: 300000, lotType: null } }),
        project({ city, use: 'residential', units: 200, gfa: 250000 }),
      )
      for (const re of res) {
        const h = byLabel(hs, re)
        expect(h, `${city} expected a hurdle matching ${re}`).toBeTruthy()
        expect(h?.sizeDependent, `${city} / ${h?.label}`).toBe(true)
      }
      // Conversely: a hurdle that fires regardless of size must NOT be tagged.
      const alwaysOn = hs.filter((h) =>
        /Parkland dedication|No prevailing-wage|Mississippi River|Development Impact Tax|No citywide inclusionary|impact fee|Downtown DRI|No state environmental|Tree removal|No local prevailing-wage/.test(h.label),
      )
      expect(alwaysOn.length, `${city} expected at least one always-on hurdle`).toBeGreaterThan(0)
      for (const h of alwaysOn) expect(h.sizeDependent, `${city} / ${h.label}`).toBeFalsy()
    })
  }

  // Rule 1 end to end: a placeholder size must downgrade every required,
  // size-triggered row in this batch to 'info' rather than assert it.
  it('a placeholder GFA downgrades this batch’s size-triggered mandates', () => {
    const soft = (city: string) =>
      assessHurdles(
        city,
        parcel({ lot: { sizeSqFt: 300000, lotType: null } }),
        project({ city, use: 'residential', units: 200, gfa: 250000, gfaBasis: 'assumed-far-1.0' }),
      )
    expect(byLabel(soft('minneapolis'), /Inclusionary Zoning: 8%/)?.status).toBe('info')
    expect(byLabel(soft('minneapolis'), /Site plan review/)?.status).toBe('info')
    expect(byLabel(soft('philadelphia'), /Civic Design Review/)?.status).toBe('info')
    expect(byLabel(soft('philadelphia'), /Project Information Form/)?.status).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// San Diego / San José / Nashville — encoded from docs/HURDLE-PROPOSALS.md.
// ---------------------------------------------------------------------------

describe('assessHurdles — San Diego', () => {
  const sd = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('sandiego', parcel(p), project({ city: 'sandiego', ...over }))

  it('resolves a plausible project: inclusionary, Mobility Choices, ESL, CEQA, impact fees', () => {
    const hs = sd({ use: 'residential', units: 24, gfa: 30000 })
    expect(hs.length).toBeGreaterThan(5)
    const inc = byLabel(hs, /Inclusionary Affordable Housing/)
    expect(inc?.status).toBe('required')
    expect(inc?.sizeDependent).toBe(true)
    expect(inc?.note).toMatch(/142\.1302/)
    expect(byLabel(hs, /Mobility Choices/)?.note).toMatch(/143\.1102/)
    expect(byLabel(hs, /Environmentally Sensitive Lands/)?.status).toBe('likely')
    // CEQA is discretionary-path only (§ 128.0202(b)) — see the dedicated test.
    const disc = assessHurdles('sandiego', parcel({}), project({ city: 'sandiego', use: 'residential', units: 24, gfa: 30000 }), {
      path: 'variance',
    })
    expect(byLabel(disc, /CEQA/)?.note).toMatch(/128\.0202/)
    expect(byLabel(hs, /Development Impact Fees/)?.status).toBe('required')
    // ABSENCE-shaped info row: the CPIO overlay is mapped, not size-driven.
    expect(byLabel(hs, /Community Plan Implementation Overlay/)?.status).toBe('info')
  })

  it('inclusionary fires at 10 units citywide — but at 5 in the Coastal Overlay Zone', () => {
    expect(byLabel(sd({ use: 'residential', units: 9 }), /Inclusionary Affordable Housing/)).toBeFalsy()
    expect(byLabel(sd({ use: 'residential', units: 10 }), /Inclusionary Affordable Housing/)?.status).toBe('required')
    const coastal = byLabel(
      sd({ use: 'residential', units: 6 }, { overlays: { historicDistrict: null, floodZone: null, coastalZone: true } }),
      /Inclusionary Affordable Housing/,
    )
    expect(coastal?.status).toBe('required')
    expect(coastal?.note).toMatch(/5 dwelling units/)
  })

  it('45-year screening: fires on an old building, silent on a recent one, never waved through on an unknown year', () => {
    const old = byLabel(sd({ projectType: 'new' }, { existing: { landUse: 'Apartment', units: 8, yearBuilt: 1950 } }), /45-year historical/)
    expect(old?.status).toBe('required')
    expect(old?.note).toMatch(/143\.0212/)
    expect(byLabel(sd({ projectType: 'new' }, { existing: { landUse: 'Apartment', units: 8, yearBuilt: 2015 } }), /45-year historical/)).toBeFalsy()
    const unknown = byLabel(sd({ projectType: 'new' }, { existing: { landUse: 'Apartment', units: 8 } }), /45-year historical/)
    expect(unknown?.note).toMatch(/no year built/)
  })

  it('dwelling-unit protection on a residential teardown; coastal replacement only at 3+ existing units', () => {
    const hs = sd({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 8 } })
    expect(byLabel(hs, /Dwelling Unit Protection/)?.status).toBe('required')
    expect(byLabel(hs, /Coastal Overlay Zone affordable housing replacement/)).toBeFalsy()
    const coastal = sd(
      { projectType: 'new', units: 40 },
      { existing: { landUse: 'Apartment', units: 8 }, overlays: { historicDistrict: null, floodZone: null, coastalZone: true } },
    )
    const repl = byLabel(coastal, /Coastal Overlay Zone affordable housing replacement/)
    expect(repl?.status).toBe('required')
    expect(repl?.sizeDependent).toBe(true)
    // Two existing units is below the 3-unit trigger.
    const duplex = sd(
      { projectType: 'new', units: 40 },
      { existing: { landUse: 'Apartment', units: 2 }, overlays: { historicDistrict: null, floodZone: null, coastalZone: true } },
    )
    expect(byLabel(duplex, /Coastal Overlay Zone affordable housing replacement/)).toBeFalsy()
    // Vacant land triggers neither.
    const vacant = sd({ projectType: 'new' }, { existing: { landUse: 'Vacant Land' } })
    expect(byLabel(vacant, /Dwelling Unit Protection/)).toBeFalsy()
  })

  // Restored from the untruncated proposal: § 143.1102 exempts residential
  // development of four or fewer dwelling units OUTRIGHT, so this is a numeric
  // gate, not the "confirm whether yours falls inside the exception" hedge the
  // truncated table produced.
  it('Mobility Choices exempts four-or-fewer-unit residential and fires from the fifth unit', () => {
    expect(byLabel(sd({ use: 'residential', units: 4 }), /Mobility Choices/)).toBeFalsy()
    const five = byLabel(sd({ use: 'residential', units: 5 }), /Mobility Choices/)
    expect(five?.status).toBe('required')
    expect(five?.sizeDependent).toBe(true)
    expect(five?.note).toMatch(/four or fewer/)
    // The exemption is residential-only — a commercial building has no unit floor.
    expect(byLabel(sd({ use: 'commercial', units: 0, gfa: 20000 }), /Mobility Choices/)?.status).toBe('required')
  })

  it('carries the inclusionary set-aside and in-lieu fee the code states, not just the trigger', () => {
    const inc = byLabel(sd({ use: 'residential', units: 24 }), /Inclusionary Affordable Housing/)
    expect(inc?.note).toMatch(/10% of its units at 30% of 60% of median income/)
    expect(inc?.note).toMatch(/55 years/)
    expect(inc?.note).toMatch(/\$25\.00 per square foot/)
    expect(inc?.note).toMatch(/142\.1304/)
    expect(inc?.note).toMatch(/142\.1306/)
  })

  it('coastal replacement takes the multi-structure threshold: 3 units in one building, 5 across two', () => {
    const coastalZone = { historicDistrict: null, floodZone: null, coastalZone: true }
    const repl = (units: number, numBuildings?: number) =>
      byLabel(
        sd(
          { projectType: 'new', units: 40 },
          { existing: { landUse: 'Apartment', units, ...(numBuildings === undefined ? {} : { numBuildings }) }, overlays: coastalZone },
        ),
        /Coastal Overlay Zone affordable housing replacement/,
      )
    expect(repl(3, 1)?.status).toBe('required')
    // Four units spread over two structures is below BOTH limbs of § 143.0815(b)(3).
    expect(repl(4, 2)).toBeFalsy()
    expect(repl(5, 2)?.status).toBe('required')
    expect(repl(5, 2)?.note).toMatch(/at least 5 dwelling units where two or more structures/)
    // Unknown building count falls back to the single-structure limb (fails closed).
    expect(repl(3)?.status).toBe('required')
  })

  it('Process Four historical-resource permit needs a designated resource AND multiple units', () => {
    const hs = sd({ use: 'residential', units: 20 }, { overlays: { historicDistrict: 'Sherman Heights Historic District', floodZone: null } })
    const p4 = byLabel(hs, /Process Four/)
    expect(p4?.status).toBe('required')
    expect(p4?.note).toMatch(/143\.0210/)
    expect(byLabel(sd({ use: 'residential', units: 20 }), /Process Four/)).toBeFalsy()
  })

  // ---- Sweep of the untruncated § sources against the encoded gates. ----

  // UNDER-fire, the rarer and worse direction: § 143.0210(e)(2)(B) reads
  // "Multiple dwelling unit residential, COMMERCIAL, OR INDUSTRIAL development
  // on any size lot, or any subdivision on any size lot". The residential-only
  // gate meant a commercial project on a historical-resource parcel was never
  // told a Process Four hearing applies.
  it('Process Four also reaches a commercial project on a historical-resource parcel', () => {
    const histo = { overlays: { historicDistrict: 'Sherman Heights Historic District', floodZone: null } }
    const comm = byLabel(sd({ use: 'commercial', units: 0, gfa: 40000 }, histo), /Process Four/)
    expect(comm?.status).toBe('required')
    expect(comm?.note).toMatch(/commercial or industrial/)
    // A single dwelling is still outside it — the row says MULTIPLE dwelling unit.
    expect(byLabel(sd({ use: 'residential', units: 1 }, histo), /Process Four/)).toBeFalsy()
  })

  // OVER-fire: the permit assignment read was Table 143-01A ROW 3, which is the
  // MULTIPLE DWELLING UNIT row. The unconditional push published a Process Three
  // claim for single-dwelling and commercial projects off rows nobody read.
  it('the ESL Site Development Permit rides on the multiple-dwelling-unit row it cites', () => {
    const esl = byLabel(sd({ use: 'residential', units: 12 }), /Environmentally Sensitive Lands/)
    expect(esl?.status).toBe('likely')
    expect(esl?.sizeDependent).toBe(true)
    expect(esl?.note).toMatch(/Table 143-01A row 3/)
    // Must NOT fire: one dwelling, and a wholly commercial project.
    expect(byLabel(sd({ use: 'residential', units: 1 }), /Environmentally Sensitive Lands/)).toBeFalsy()
    expect(byLabel(sd({ use: 'commercial', units: 0, gfa: 40000 }), /Environmentally Sensitive Lands/)).toBeFalsy()
  })

  // OVER-fire: § 128.0202(b) says an activity is NOT subject to CEQA if it does
  // not involve the exercise of discretionary powers. The row fired on every
  // project, telling as-of-right applicants they carried environmental review.
  it('CEQA fires on the discretionary path only', () => {
    const aor = assessHurdles('sandiego', parcel({}), project({ city: 'sandiego', use: 'residential', units: 24 }), { path: 'as_of_right' })
    expect(byLabel(aor, /CEQA/)).toBeFalsy()
    const disc = assessHurdles('sandiego', parcel({}), project({ city: 'sandiego', use: 'residential', units: 24 }), { path: 'variance' })
    const ceqa = byLabel(disc, /CEQA/)
    expect(ceqa?.status).toBe('likely')
    expect(ceqa?.note).toMatch(/128\.0202/)
    // The things that push a nominally as-of-right project off the ministerial
    // path are named rather than dropped with the gate.
    expect(ceqa?.note).toMatch(/environmentally sensitive lands/i)
    expect(ceqa?.note).toMatch(/Type B/)
  })

  // OVER-fire: § 142.0640 exempts the first two ADUs on a premises outright.
  it('Development Impact Fees skip an ADU, which the code exempts', () => {
    expect(byLabel(sd({ projectType: 'adu', use: 'residential', units: 1 }), /Development Impact Fees/)).toBeFalsy()
    expect(byLabel(sd({ use: 'residential', units: 24 }), /Development Impact Fees/)?.status).toBe('required')
  })

  // § 142.1302 applies the inclusionary division "except as provided in Section
  // 142.1303", which was not read. The gate stays as-is — no threshold invented
  // — but the unread exception is disclosed rather than silently assumed away.
  it('the inclusionary row discloses the § 142.1303 exception it does not implement', () => {
    expect(byLabel(sd({ use: 'residential', units: 24 }), /Inclusionary Affordable Housing/)?.note).toMatch(/142\.1303/)
  })
})

describe('assessHurdles — San José', () => {
  const sj = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('sanjose', parcel(p), project({ city: 'sanjose', ...over }))

  it('resolves a plausible project: inclusionary, SDP, CEQA, construction taxes, park fee', () => {
    const hs = sj({ use: 'residential', units: 30, gfa: 40000 })
    const inc = byLabel(hs, /Inclusionary Housing Ordinance/)
    expect(inc?.status).toBe('required')
    expect(inc?.sizeDependent).toBe(true)
    expect(inc?.note).toMatch(/5\.08\.320/)
    expect(byLabel(hs, /Site Development Permit/)?.status).toBe('required')
    expect(byLabel(hs, /CEQA/)?.note).toMatch(/21\.04\.010/)
    expect(byLabel(hs, /Stacked San José construction taxes/)?.note).toMatch(/4\.46\.050/)
    expect(byLabel(hs, /Park impact fee/)?.sizeDependent).toBe(true)
    expect(byLabel(hs, /Green building certification/)?.status).toBe('required')
    // ABSENCES: the subsidy-only labour rule and the dormant all-electric chapter.
    expect(byLabel(hs, /Prevailing wage and 30% local hire/)?.status).toBe('info')
    const allElectric = byLabel(hs, /All-electric mandate/)
    expect(allElectric?.status).toBe('info')
    expect(allElectric?.note).toMatch(/17\.845\.010/)
  })

  it('thresholds: inclusionary at 20 units, green building at 10, TDM at 26', () => {
    expect(byLabel(sj({ use: 'residential', units: 19 }), /Inclusionary Housing Ordinance/)).toBeFalsy()
    expect(byLabel(sj({ use: 'residential', units: 9 }), /Green building certification/)).toBeFalsy()
    expect(byLabel(sj({ use: 'residential', units: 10 }), /Green building certification/)?.sizeDependent).toBe(true)
    expect(byLabel(sj({ use: 'residential', units: 25 }), /Transportation Demand Management/)).toBeFalsy()
    const tdm = byLabel(sj({ use: 'residential', units: 26 }), /Transportation Demand Management/)
    expect(tdm?.sizeDependent).toBe(true)
    expect(tdm?.note).toMatch(/16 units/)
  })

  it('the Site Development Permit exempts only the single-dwelling case', () => {
    expect(byLabel(sj({ use: 'residential', units: 1 }), /Site Development Permit/)).toBeFalsy()
    expect(byLabel(sj({ use: 'residential', units: 2 }), /Site Development Permit/)?.status).toBe('required')
  })

  it('demolition permit on any teardown; Ellis Act only over existing rental housing', () => {
    const rental = sj({ projectType: 'new', units: 40 }, { existing: { landUse: 'Apartment', units: 6 } })
    expect(byLabel(rental, /Demolition needs its own development permit/)?.status).toBe('required')
    const ellis = byLabel(rental, /Ellis Act withdrawal/)
    expect(ellis?.status).toBe('likely')
    expect(ellis?.addsMonths).toBe(4)
    expect(ellis?.sizeDependent).toBeFalsy() // the EXISTING building triggers it
    const shop = sj({ projectType: 'new', units: 40 }, { existing: { landUse: 'Retail Store', buildingAreaSqFt: 4000 } })
    expect(byLabel(shop, /Demolition needs its own development permit/)?.status).toBe('required')
    expect(byLabel(shop, /Ellis Act withdrawal/)).toBeFalsy()
  })

  // Restored from the untruncated proposal: § 17.23.1150.C reaches buildings of
  // THREE or more rental units. The truncated encoding fired on any rental
  // multifamily, which starts at 2 — over-firing on a duplex.
  it('the Ellis Act row respects the ordinance’s 3-unit floor, and still fires on an unknown count', () => {
    const ellis = (units?: number) =>
      byLabel(
        assessHurdles(
          'sanjose',
          parcel({ existing: { landUse: 'Apartment', ...(units === undefined ? {} : { units }) } }),
          project({ city: 'sanjose', projectType: 'new', units: 40 }),
        ),
        /Ellis Act withdrawal/,
      )
    expect(ellis(2)).toBeFalsy()
    expect(ellis(3)?.status).toBe('likely')
    expect(ellis(3)?.note).toMatch(/three or more units/)
    expect(ellis(3)?.note).toMatch(/120 days/)
    expect(ellis(3)?.note).toMatch(/September 7, 1979/)
    // No unit count on the record: the land use says rental multifamily, so it
    // still fires rather than being waved through on a missing number.
    expect(ellis(undefined)?.status).toBe('likely')
  })

  it('carries the numbers behind the inclusionary set-aside and the construction taxes', () => {
    const hs = sj({ use: 'residential', units: 30, gfa: 40000 })
    const inc = byLabel(hs, /Inclusionary Housing Ordinance/)
    expect(inc?.note).toMatch(/15% of for-sale units/)
    expect(inc?.note).toMatch(/120% of Area Median Income/)
    expect(inc?.note).toMatch(/5% at 60% AMI and 5% at 80% AMI/)
    const tax = byLabel(hs, /Stacked San José construction taxes/)
    expect(tax?.note).toMatch(/1\.75% and 2\.75%/)
    expect(tax?.note).toMatch(/88% of the building official’s valuation/)
    expect(tax?.note).toMatch(/\$75–\$150 per unit/)
    expect(tax?.note).toMatch(/\$90–\$180 per unit/)
    // The green-building row names the certifications, not just "certification".
    expect(byLabel(hs, /Green building certification/)?.note).toMatch(/LEED Certified or GreenPoint Rated/)
  })

  it('names the HP permit in a historic district; the linkage fee is commercial-only', () => {
    const hs = sj({}, { overlays: { historicDistrict: 'Hensley Historic District', floodZone: null } })
    expect(byLabel(hs, /Historic district design review/)?.note).toMatch(/Historic Preservation \(HP\) permit/)
    expect(byLabel(sj({ use: 'residential', units: 30 }), /Commercial linkage fee/)).toBeFalsy()
    expect(byLabel(sj({ use: 'commercial', gfa: 60000 }), /Commercial linkage fee/)?.status).toBe('info')
  })

  // OVER-fire: § 20.90.900.B.2's exemption list is written in HOME END USES —
  // "fewer than 16 single-family detached housing units" or "fewer than 26 units
  // of all other home end uses" — so 26 is a residential threshold. `units` is
  // read off the query string independently of `use`, so the unguarded
  // `units >= 26` published a home-end-use trigger against a wholly commercial
  // project, whose TDM threshold is floor-area based and was never read.
  it('the TDM threshold is a home-end-use one: a commercial project does NOT fire on 26 units', () => {
    // Must NOT fire — the 26 is not a non-residential threshold.
    expect(byLabel(sj({ use: 'commercial', gfa: 200000, units: 30 }), /Transportation Demand Management/)).toBeFalsy()
    expect(byLabel(sj({ use: 'commercial', gfa: 200000 }), /Transportation Demand Management/)).toBeFalsy()
    // Still fires for residential and for mixed-use, whose dwellings are a home end use.
    expect(byLabel(sj({ use: 'residential', units: 26 }), /Transportation Demand Management/)?.status).toBe('required')
    expect(byLabel(sj({ use: 'mixed', units: 26, gfa: 60000 }), /Transportation Demand Management/)?.status).toBe('required')
  })

  // The dormant all-electric chapter's operative clause has a purpose qualifier
  // on its legislative limb — "modified by the legislature TO AUTHORIZE LOCAL
  // CONTROL OF NATURAL GAS INFRASTRUCTURE" (§ 17.845.030.A). Dropping it told the
  // reader any legislative amendment would switch the ban on.
  it('states the all-electric chapter’s operative clause with its purpose qualifier', () => {
    const ae = byLabel(sj({ use: 'residential', units: 30 }), /All-electric mandate/)
    expect(ae?.status).toBe('info')
    expect(ae?.note).toMatch(/to authorize local control of natural gas infrastructure/)
    expect(ae?.note).toMatch(/or other similar legislation/)
  })

  // The construction-tax percentages are levied on the building "or portion
  // thereof" designed for residential purposes (§§ 4.46.050.A.1, 4.47.040.A.1).
  // On a mixed-use building the base is the residential portion, not the whole
  // valuation — the note asserted ~3.96% of the whole.
  it('scopes the construction-tax percentages to the residential portion', () => {
    const tax = byLabel(sj({ use: 'mixed', units: 30, gfa: 60000 }), /Stacked San José construction taxes/)
    expect(tax?.status).toBe('required')
    expect(tax?.note).toMatch(/portion thereof/)
    expect(tax?.note).toMatch(/the base is the residential portion/)
  })

  // OVER-fire: § 21.04.010.A attaches CEQA to DISCRETIONARY approvals, and the
  // only thing making an ordinary San José project discretionary is the Site
  // Development Permit — which § 20.100.610.A.1 exempts for one one-family
  // dwelling on a single lot. CEQA was firing where the SDP row did not.
  it('CEQA carries the Site Development Permit’s own single-dwelling exception', () => {
    expect(byLabel(sj({ use: 'residential', units: 1 }), /Site Development Permit/)).toBeFalsy()
    expect(byLabel(sj({ use: 'residential', units: 1 }), /CEQA/)).toBeFalsy()
    expect(byLabel(sj({ use: 'residential', units: 2 }), /CEQA/)?.status).toBe('likely')
    expect(byLabel(sj({ use: 'commercial', gfa: 60000 }), /CEQA/)?.status).toBe('likely')
  })
})

describe('assessHurdles — Nashville', () => {
  const nash = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('nashville', parcel(p), project({ city: 'nashville', ...over }))

  it('resolves a plausible project, headed by the state-law absence', () => {
    const hs = nash({ use: 'residential', units: 90, gfa: 90000 })
    expect(hs.length).toBeGreaterThan(5)
    const state = byLabel(hs, /State law bars mandatory inclusionary zoning/)
    expect(state?.status).toBe('info')
    expect(state?.note).toMatch(/66-35-102/)
    expect(byLabel(hs, /Multimodal transportation analysis/)?.status).toBe('required')
    expect(byLabel(hs, /Planning Commission final site plan/)?.status).toBe('likely')
    expect(byLabel(hs, /Hillside development standards/)?.note).toMatch(/17\.28\.020/)
    expect(byLabel(hs, /Tree density requirement/)?.status).toBe('required')
    // ABSENCE: the sidewalk requirement is on the books but not in force.
    const sidewalk = byLabel(hs, /Sidewalk construction or in-lieu fee/)
    expect(sidewalk?.status).toBe('info')
    expect(sidewalk?.note).toMatch(/17\.20\.120/)
  })

  it('the multimodal analysis fires above 75 units, not at 75', () => {
    expect(byLabel(nash({ use: 'residential', units: 75 }), /Multimodal transportation analysis/)).toBeFalsy()
    const h = byLabel(nash({ use: 'residential', units: 76 }), /Multimodal transportation analysis/)
    expect(h?.sizeDependent).toBe(true)
    // …and on non-residential floor area over 50,000 sq ft.
    expect(byLabel(nash({ use: 'commercial', units: 0, gfa: 60000 }), /Multimodal transportation analysis/)?.status).toBe('required')
    expect(byLabel(nash({ use: 'commercial', units: 0, gfa: 40000 }), /Multimodal transportation analysis/)).toBeFalsy()
  })

  it('inclusionary and the SP rezoning are discretionary-only', () => {
    const disc = assessHurdles('nashville', parcel({}), project({ city: 'nashville', use: 'residential', units: 40 }), { path: 'variance' })
    expect(byLabel(disc, /Inclusionary housing — only if you seek more than base zoning/)?.status).toBe('likely')
    expect(byLabel(disc, /Specific Plan \(SP\) rezoning/)?.status).toBe('likely')
    const aor = assessHurdles('nashville', parcel({}), project({ city: 'nashville', use: 'residential', units: 40 }), { path: 'as_of_right' })
    expect(byLabel(aor, /Inclusionary housing — only if you seek more/)).toBeFalsy()
    expect(byLabel(aor, /Specific Plan \(SP\) rezoning/)).toBeFalsy()
    // The state-law absence is stated on BOTH paths — it is the standing rule.
    expect(byLabel(aor, /State law bars mandatory inclusionary zoning/)?.status).toBe('info')
  })

  // Restored from the untruncated proposal: § 17.40.780(B) exempts developments
  // of fewer than five residential units outright, and § 17.40.790.A states the
  // set-aside band. Neither survived the truncated table.
  it('the inclusionary incentive has a five-unit floor and states its set-aside band', () => {
    const disc = (units: number) =>
      byLabel(
        assessHurdles('nashville', parcel({}), project({ city: 'nashville', use: 'residential', units }), { path: 'variance' }),
        /Inclusionary housing — only if you seek more than base zoning/,
      )
    expect(disc(4)).toBeFalsy()
    const five = disc(5)
    expect(five?.status).toBe('likely')
    expect(five?.sizeDependent).toBe(true)
    expect(five?.note).toMatch(/fewer than five residential units are exempt/)
    expect(five?.note).toMatch(/7\.5%–17\.5% of residential floor area/)
    expect(five?.note).toMatch(/17\.40\.790/)
    // The sunset question the research could not resolve is carried, not dropped.
    expect(five?.note).toMatch(/17\.40\.820/)
  })

  // UNDER-stated scope: the source trigger for § 17.20.120 has TWO limbs — the
  // multi-family / non-residential one AND "new single- or two-family
  // construction in the UZO or a designated center". Only the first was carried,
  // so a small-scale builder read the row as inapplicable to them. The row is
  // unconditional, so nothing widened here — the copy now states both limbs.
  it('the sidewalk row names both limbs of the exaction’s scope', () => {
    const note = (over: Partial<AnalysisInput>) => byLabel(nash(over), /Sidewalk construction or in-lieu fee/)?.note ?? ''
    for (const over of [{ use: 'residential' as const, units: 90 }, { use: 'residential' as const, units: 2 }, { use: 'commercial' as const, gfa: 60000 }]) {
      expect(note(over)).toMatch(/multi-family and non-residential development/)
      expect(note(over)).toMatch(/single- or two-family construction inside the Urban Zoning Overlay or a designated center/)
      // Still an absence, not a cost line: the injunction claim must survive.
      expect(note(over)).toMatch(/no longer enforced under a permanent injunction/)
    }
  })

  it('carries the sidewalk in-lieu cap, the tree factors, and the floodplain variance limit', () => {
    const hs = nash({ use: 'residential', units: 90, gfa: 90000 })
    const sidewalk = byLabel(hs, /Sidewalk construction or in-lieu fee/)
    expect(sidewalk?.note).toMatch(/three percent of the total construction value/)
    expect(sidewalk?.note).toMatch(/3:20-cv-00922/)
    const trees = byLabel(hs, /Tree density requirement/)
    expect(trees?.note).toMatch(/22 units per acre/)
    expect(trees?.note).toMatch(/must reach 14/)
    expect(trees?.note).toMatch(/6 inches DBH/)
    const flood = byLabel(nash({}, { overlays: { historicDistrict: null, floodZone: 'AE' } }), /Preserved floodplain/)
    expect(flood?.note).toMatch(/no more than twenty percent/)
    // The multimodal row carries the trip thresholds, not just the unit count.
    expect(byLabel(hs, /Multimodal transportation analysis/)?.note).toMatch(/750 or more daily trips or 100 or more peak-hour trips/)
  })

  it('Council demolition review on a teardown; the preservation permit runs 1 month', () => {
    const teardown = nash({ projectType: 'new', units: 40 }, { existing: { landUse: 'Single Family Residential', units: 1, yearBuilt: 1925 } })
    expect(byLabel(teardown, /Metro Council demolition review/)?.status).toBe('likely')
    expect(byLabel(nash({}), /Metro Council demolition review/)).toBeFalsy()
    // Moratorium row is a standing warning, not teardown-only.
    expect(byLabel(nash({}), /Permit moratorium while a historic overlay is pending/)?.status).toBe('info')
    const hist = byLabel(nash({}, { overlays: { historicDistrict: 'Edgefield Historic District', floodZone: null } }), /Historic district design review/)
    expect(hist?.note).toMatch(/Metro Historic Zoning Commission/)
    expect(hist?.addsMonths).toBe(1) // § 17.40.420.A–B, the one researched duration
  })

  it('the preserved-floodplain row rides on a real flood zone', () => {
    const flooded = nash({}, { overlays: { historicDistrict: null, floodZone: 'AE' } })
    expect(byLabel(flooded, /Preserved floodplain/)?.status).toBe('likely')
    expect(byLabel(nash({}), /Preserved floodplain/)).toBeFalsy()
  })

  // OVER-fire: § 17.28.020.A applies the hillside standards to "new construction
  // on land in an UNDEVELOPED STATE where natural slopes are of fifteen percent
  // or greater" — two conditions. The gate implemented neither, so every
  // Nashville project, teardowns included, was told the standards apply.
  it('hillside standards need new construction on undeveloped land', () => {
    const green = byLabel(nash({ projectType: 'new', use: 'residential', units: 12 }), /Hillside development standards/)
    expect(green?.status).toBe('likely')
    expect(green?.note).toMatch(/undeveloped state/)
    // Must NOT fire: a parcel already carrying a building is not undeveloped…
    expect(
      byLabel(
        nash({ projectType: 'new', use: 'residential', units: 12 }, { existing: { landUse: 'Retail Store', buildingAreaSqFt: 4000 } }),
        /Hillside development standards/,
      ),
    ).toBeFalsy()
    // …and an addition or a change of use is not new construction.
    expect(byLabel(nash({ projectType: 'addition' }), /Hillside development standards/)).toBeFalsy()
    expect(byLabel(nash({ projectType: 'change_of_use' }), /Hillside development standards/)).toBeFalsy()
  })

  // OVER-fire: § 17.20.140.B.2 is a NONRESIDENTIAL floor-area test, but the gate
  // measured `project.gfa` — the whole building — whenever the use included a
  // commercial component, so a mixed-use project was matched on its residential
  // floor area. No gfa split exists, so the limb is restricted to a wholly
  // non-residential project; the >75-unit limb still catches large mixed ones.
  it('the multimodal 50,000 sq ft limb is non-residential floor area, not total gfa', () => {
    expect(byLabel(nash({ use: 'commercial', units: 0, gfa: 60000 }), /Multimodal transportation analysis/)?.status).toBe('required')
    // Must NOT fire: a mixed-use building of 60,000 sq ft and 60 units is under
    // the unit trigger, and its non-residential area is not 60,000 sq ft.
    expect(byLabel(nash({ use: 'mixed', units: 60, gfa: 60000 }), /Multimodal transportation analysis/)).toBeFalsy()
    // The unit limb is unchanged and still reaches mixed use.
    expect(byLabel(nash({ use: 'mixed', units: 120, gfa: 60000 }), /Multimodal transportation analysis/)?.status).toBe('required')
  })
})

// Rules 1 and 2 again, for this batch. Same shape as the two blocks above: no
// duration the research did not publish, and every size trigger tagged so
// softenSizeDependent() can fail it closed.
describe('San Diego / San José / Nashville — no invented durations', () => {
  function expectedMonths(city: string, label: string): number | undefined {
    if (/^Historic district design review$/.test(label)) return city === 'nashville' ? 1 : 3
    if (/^Replacing existing housing$/.test(label)) return 6
    if (/^Public-funding process/.test(label)) return 4
    if (/^Coastal Development Permit$/.test(label)) return 9 // module-level, predates this batch
    // Researched durations, this batch — exactly one row published one:
    if (/^Ellis Act withdrawal/.test(label)) return 4 // san josé §§ 17.23.1130.E–H
    return undefined
  }

  const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
    { p: {}, j: { use: 'residential', units: 40, gfa: 60000 } },
    { p: {}, j: { use: 'commercial', units: 0, gfa: 120000, funding: 'public' } },
    { p: { lot: { sizeSqFt: 300000, lotType: null } }, j: { use: 'mixed', units: 200, gfa: 250000 } },
    { p: { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1930 } }, j: { projectType: 'new', use: 'residential', units: 4 } },
    { p: { overlays: { historicDistrict: 'A Historic District', floodZone: 'AE' } }, j: { projectType: 'new', use: 'residential', units: 12 } },
    { p: { overlays: { historicDistrict: null, floodZone: null, coastalZone: true } }, j: { use: 'residential', units: 30, gfa: 40000 } },
  ]

  for (const city of ['sandiego', 'sanjose', 'nashville']) {
    it(`${city}: every addsMonths traces to a published duration`, () => {
      for (const s of scenarios) {
        for (const path of ['as_of_right', 'variance'] as const) {
          const hs = assessHurdles(city, parcel(s.p), project({ city, ...s.j }), { path })
          for (const h of hs) {
            expect(h.addsMonths, `${city} / ${h.label}`).toBe(expectedMonths(city, h.label))
          }
        }
      }
    })
  }

  const SIZE_TRIGGERED: Record<string, RegExp[]> = {
    // ESL joined this list when its gate was tightened to Table 143-01A row 3
    // (multiple dwelling unit development) — it now reads a unit count.
    sandiego: [/Inclusionary Affordable Housing/, /Mobility Choices/, /Process Four/, /Environmentally Sensitive Lands/],
    sanjose: [/Inclusionary Housing Ordinance/, /Park impact fee/, /Green building certification/, /Transportation Demand Management/],
    nashville: [/Multimodal transportation analysis/],
  }

  for (const [city, res] of Object.entries(SIZE_TRIGGERED)) {
    it(`${city}: every size-triggered hurdle carries sizeDependent`, () => {
      const hs = assessHurdles(
        city,
        parcel({ lot: { sizeSqFt: 300000, lotType: null }, overlays: { historicDistrict: 'A Historic District', floodZone: null } }),
        project({ city, use: 'residential', units: 200, gfa: 250000 }),
      )
      for (const re of res) {
        const h = byLabel(hs, re)
        expect(h, `${city} expected a hurdle matching ${re}`).toBeTruthy()
        expect(h?.sizeDependent, `${city} / ${h?.label}`).toBe(true)
      }
      // Conversely: a hurdle that fires regardless of size must NOT be tagged.
      const alwaysOn = hs.filter((h) =>
        /Development Impact Fees|Community Plan Implementation|Stacked San José|Prevailing wage and 30%|All-electric mandate|State law bars|Sidewalk construction|Tree density|Hillside development/.test(h.label),
      )
      expect(alwaysOn.length, `${city} expected at least one always-on hurdle`).toBeGreaterThan(0)
      for (const h of alwaysOn) expect(h.sizeDependent, `${city} / ${h.label}`).toBeFalsy()
    })
  }

  // Rule 1 end to end: a placeholder size must downgrade this batch's required,
  // size-triggered rows to 'info' rather than assert them.
  it('a placeholder GFA downgrades this batch’s size-triggered mandates', () => {
    const soft = (city: string) =>
      assessHurdles(
        city,
        parcel({ lot: { sizeSqFt: 300000, lotType: null } }),
        project({ city, use: 'residential', units: 200, gfa: 250000, gfaBasis: 'assumed-far-1.0' }),
      )
    expect(byLabel(soft('sandiego'), /Inclusionary Affordable Housing/)?.status).toBe('info')
    expect(byLabel(soft('sandiego'), /Mobility Choices/)?.status).toBe('info')
    expect(byLabel(soft('sanjose'), /Inclusionary Housing Ordinance/)?.status).toBe('info')
    expect(byLabel(soft('sanjose'), /Green building certification/)?.status).toBe('info')
    expect(byLabel(soft('nashville'), /Multimodal transportation analysis/)?.status).toBe('info')
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
