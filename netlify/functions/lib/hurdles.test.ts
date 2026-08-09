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

  // SMC 25.05.800.A screens by use: "residential or mixed-use development" on
  // the number of dwelling units (Table A), "office, school, commercial,
  // recreational, service, or storage buildings" on gross floor area (Table B).
  // A unit count is a residential measure, so the unit limb must not reach a
  // non-residential project. `units` is independent of `use` in AnalysisInput,
  // so all of these are reachable, not theoretical.
  const seattleSepa = (over: Partial<AnalysisInput>) =>
    assessHurdles('seattle', parcel({}), project({ city: 'seattle', ...over })).some((h) => /SEPA/.test(h.label))

  it('Seattle SEPA: the UNIT limb is residential — 20 units fires for residential and mixed use', () => {
    expect(seattleSepa({ use: 'residential', units: 20, gfa: 8000 })).toBe(true)
    // Mixed use is named in the same clause as residential, so it fires too.
    expect(seattleSepa({ use: 'mixed', units: 20, gfa: 8000 })).toBe(true)
  })

  it('Seattle SEPA: a COMMERCIAL project at the same unit count must NOT fire', () => {
    // 20 units, floor area held under the Table B limb so only the unit limb
    // could fire it. Table A is residential; commercial is measured in sq ft.
    expect(seattleSepa({ use: 'commercial', units: 20, gfa: 8000 })).toBe(false)
    expect(seattleSepa({ use: 'commercial', units: 200, gfa: 8000 })).toBe(false)
    expect(seattleSepa({ use: 'institutional', units: 20, gfa: 8000 })).toBe(false)
  })

  it('Seattle SEPA: the FLOOR-AREA limb stays open to every non-residential use', () => {
    // Table B lists "office, school, commercial, recreational, service or
    // storage" buildings — a school is `institutional` in our Use union, so
    // guarding this limb to `commercial` would under-fire on the source's own
    // list. Units held under the Table A limb so only floor area can fire it.
    expect(seattleSepa({ use: 'commercial', units: 0, gfa: 12000 })).toBe(true)
    expect(seattleSepa({ use: 'institutional', units: 0, gfa: 12000 })).toBe(true)
  })

  it('Seattle SEPA: under both limbs, nothing fires', () => {
    expect(seattleSepa({ use: 'residential', units: 19, gfa: 8000 })).toBe(false)
    expect(seattleSepa({ use: 'commercial', units: 19, gfa: 8000 })).toBe(false)
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

  // ---- The `gfa >= 50000 || units >= 25` subsidy-strings gate takes NO use
  // guard. Decided in the unit-gate sweep, not skipped: San José's TDM gate
  // needed `isResidential &&` because § 20.90.900.B.2's exemption list is
  // written in HOME END USES. This gate has no source threshold at all — no
  // entry in docs/HURDLE-PROPOSALS.md, no citation — so there is no home-end-use
  // limb to respect. 50,000 sf OR 25 units is this repo's own size proxy for
  // "big enough to plausibly chase a subsidy", which is why the row is 'info'
  // and hedged in its own label rather than asserting that a rule applies.
  //
  // The subject matter is use-agnostic in the research we do have: the strings
  // attach to taking city money, not to building housing (Minneapolis § 38.30's
  // "City business subsidy … given to a business"; Miami's preemption carve-out
  // for "an employer receiving a direct tax abatement or subsidy"; San José's
  // subsidy definition scoped to a "Private Construction Project"; DC's First
  // Source dollar tiers). Guarding it would UNDER-fire on exactly the reader it
  // is written for.
  const subsidy = (over: Partial<AnalysisInput>) =>
    assessHurdles('sf', parcel({}), project({ city: 'sf', funding: 'private', ...over })).find((h) =>
      /^Subsidy strings/.test(h.label),
    )

  it('fires subsidy strings for a COMMERCIAL project on the unit limb alone — the 25 is not a residential threshold', () => {
    // gfa under 50,000 so only `units >= 25` can carry it. A commercial or
    // institutional developer pursuing TIF or an abatement gets the same
    // prevailing-wage/MWBE strings; withholding the note would be an under-fire.
    expect(subsidy({ use: 'commercial', gfa: 20000, units: 25 })?.status).toBe('info')
    expect(subsidy({ use: 'institutional', gfa: 20000, units: 25 })?.note).toMatch(/prevailing-wage|MWBE/i)
    // …and for residential and mixed at the same count, so the gate is not
    // silently use-split in either direction.
    expect(subsidy({ use: 'residential', gfa: 20000, units: 25 })?.status).toBe('info')
    expect(subsidy({ use: 'mixed', gfa: 20000, units: 25 })?.status).toBe('info')
  })

  it('fires subsidy strings on the floor-area limb for any use, with no units at all', () => {
    // `units` is optional and independent of `use`; the 50,000 sf limb must not
    // depend on a unit count being supplied.
    expect(subsidy({ use: 'commercial', gfa: 50000 })?.status).toBe('info')
    expect(subsidy({ use: 'residential', gfa: 50000 })?.status).toBe('info')
  })

  it('holds the unit limb at exactly 25 and stays silent below it', () => {
    expect(subsidy({ use: 'commercial', gfa: 20000, units: 24 })).toBeFalsy()
    expect(subsidy({ use: 'residential', gfa: 20000, units: 24 })).toBeFalsy()
    expect(subsidy({ use: 'commercial', gfa: 49999, units: 0 })).toBeFalsy()
  })

  it('never doubles up: a publicly funded project gets the required process, not the heads-up', () => {
    expect(subsidy({ use: 'commercial', gfa: 200000, units: 100, funding: 'public' })).toBeFalsy()
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

  it('every unit-count gate is a DWELLING-unit gate: a commercial project at the same count fires none', () => {
    // `units` arrives off the query string independent of `use` (analyze.ts
    // reads them separately), so a commercial or institutional project can carry
    // a unit count. Each Minneapolis unit threshold is written in residential
    // unit types, so none of them may read that count:
    //   · Table 550-1  — "four (4) or more new or additional DWELLING UNITS OR
    //     ROOMING UNITS", and administratively "fewer than twenty (20)" of same
    //   · Table 555-10 — "fifty (50) or more and less than two hundred fifty
    //     (250) new or additional dwelling units or rooming units"
    //   · UHP § III(A)(1)(viii) — a 100-unit project's INCLUSIONARY ZONING
    //     requirement, which § 550.810(a) attaches to dwelling units only
    // 300 units clears all four thresholds at once, so one project proves it.
    for (const use of ['commercial', 'institutional'] as const) {
      const hs = mpls({ use, units: 300, gfa: 300000 })
      expect(byLabel(hs, /Site plan review/), `${use} / site plan review`).toBeFalsy()
      expect(byLabel(hs, /Travel demand management/), `${use} / TDM`).toBeFalsy()
      // ...and on a teardown of a 1920s apartment building, no replacement duty.
      const td = mpls({ use, units: 300, gfa: 300000, projectType: 'new' }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } })
      expect(byLabel(td, /No net loss/), `${use} / no net loss`).toBeFalsy()
      // The use-blind rows are NOT narrowed with them: the demolition screen
      // reaches every principal building (§ 599.910(a)), and the parking and
      // prevailing-wage absences are findings about the city, not about units.
      expect(byLabel(td, /screened for historic significance/)?.status, `${use} / demo screen`).toBe('required')
      expect(byLabel(hs, /No prevailing-wage rule/)?.status, `${use} / labour absence`).toBe('info')
    }
    // The residential control at the identical unit count — the guards narrow
    // the gates, they do not disable them.
    const res = mpls({ use: 'residential', units: 300, gfa: 300000 })
    expect(byLabel(res, /Site plan review/)?.status).toBe('required')
    expect(byLabel(res, /Travel demand management/)?.status).toBe('required')
    const resTd = mpls({ use: 'residential', units: 300, gfa: 300000, projectType: 'new' }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } })
    expect(byLabel(resTd, /No net loss/)?.status).toBe('required')
  })

  it('mixed use still fires every unit gate — its dwellings are dwelling units', () => {
    // The guard is `isResidential`, which includes 'mixed'. A commercial ground
    // floor under apartments does not exempt the apartments from Table 550-1.
    const hs = mpls({ use: 'mixed', units: 300, gfa: 300000 })
    expect(byLabel(hs, /Site plan review/)?.status).toBe('required')
    expect(byLabel(hs, /Travel demand management/)?.note).toMatch(/MAJOR/)
    const td = mpls({ use: 'mixed', units: 300, gfa: 300000, projectType: 'new' }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } })
    expect(byLabel(td, /No net loss/)?.status).toBe('required')
  })

  it('the boundaries survive the use guard: 4/20/50/250/100 still land where the source puts them', () => {
    // Adding a guard must not move a threshold. Pinned on the residential path,
    // one below and one at each line the code states.
    expect(byLabel(mpls({ use: 'residential', units: 3 }), /Site plan review/)).toBeFalsy()
    expect(byLabel(mpls({ use: 'residential', units: 4 }), /Site plan review/)?.status).toBe('required')
    expect(byLabel(mpls({ use: 'residential', units: 19 }), /Site plan review/)?.note).toMatch(/administrative/)
    expect(byLabel(mpls({ use: 'residential', units: 20 }), /Site plan review/)?.note).toMatch(/NOT eligible for administrative review/)
    expect(byLabel(mpls({ use: 'residential', units: 49 }), /Travel demand management/)).toBeFalsy()
    expect(byLabel(mpls({ use: 'residential', units: 50 }), /Travel demand management/)?.note).toMatch(/MINOR/)
    expect(byLabel(mpls({ use: 'residential', units: 249 }), /Travel demand management/)?.note).toMatch(/MINOR/)
    expect(byLabel(mpls({ use: 'residential', units: 250 }), /Travel demand management/)?.note).toMatch(/MAJOR/)
    const nnl = (units: number) =>
      byLabel(mpls({ use: 'residential', units, projectType: 'new' }, { existing: { landUse: 'Apartment', units: 20, yearBuilt: 1920 } }), /No net loss/)
    expect(nnl(99)).toBeFalsy()
    expect(nnl(100)?.status).toBe('required')
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

  it('the /MIN 10-unit gate is residential-only: a commercial project at 10 units does NOT fire', () => {
    // AnalysisInput.units is optional and INDEPENDENT of use, so a commercial
    // or institutional project can carry a unit count. § 14-533(2) defines the
    // trigger entirely in home end uses — "ten or more dwelling units, twenty
    // or more sleeping units" — so 10 is a RESIDENTIAL threshold, not an
    // any-use one. The guard is the enclosing `if (isResidential)` block, and
    // this pins it: without it, a 10-unit office project would be told it owes
    // 15% affordable dwelling units it does not have.
    expect(byLabel(phl({ use: 'commercial', units: 10 }), /Mixed Income Neighborhoods/)).toBeFalsy()
    expect(byLabel(phl({ use: 'commercial', units: 400 }), /Mixed Income Neighborhoods/)).toBeFalsy()
    expect(byLabel(phl({ use: 'institutional', units: 10 }), /Mixed Income Neighborhoods/)).toBeFalsy()
    // 'mixed' stays in: a mixed-use building with 10+ dwelling units is a
    // Residential Housing Project. Its escape is the use-based exemption the
    // note carries (under 25% of GFA residential), not the unit count.
    expect(byLabel(phl({ use: 'mixed', units: 10 }), /Mixed Income Neighborhoods/)?.status).toBe('likely')
    expect(byLabel(phl({ use: 'mixed', units: 10 }), /Mixed Income Neighborhoods/)?.note).toMatch(
      /under 25% of gross floor area is residential/,
    )
  })

  it('records the /MIN sleeping-unit limb as an UNDER-fire, not an invented threshold', () => {
    // § 14-533(2) is a THREE-limbed definition the gate collapses to one:
    // "ten or more dwelling units, twenty or more sleeping units, or both",
    // and "itself, or in combination with any closely related development".
    // AnalysisInput carries no sleeping-unit count and no related-development
    // field, so a 20-sleeping-unit / 0-dwelling-unit project (or a 6-unit
    // phase of a 30-unit assemblage) is MISSED. That is a known under-fire,
    // recorded rather than papered over by lowering the dwelling-unit number —
    // guessing a proxy threshold would be inventing one.
    expect(byLabel(phl({ use: 'residential', units: 0 }), /Mixed Income Neighborhoods/)).toBeFalsy()
    // The note must at least name both limbs so a reader can self-check.
    const min = byLabel(phl({ use: 'residential', units: 10 }), /Mixed Income Neighborhoods/)
    expect(min?.note).toMatch(/20 or more sleeping units/)
    expect(min?.note).toMatch(/closely related development/)
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

  // USE GUARD, decided per source rather than applied defensively.
  // § 17.84.113: a "large residential project" is "a residential project that
  // has ten (10) or more single family or multi-family dwelling units" — 10 is
  // a dwelling-unit count, not a project of any use that happens to have ten
  // units. `units` arrives off the query string independent of `use`
  // (analyze.ts reads them separately), so a commercial project can carry one
  // and the gate must not fire on it. The guard is the enclosing
  // `if (isResidential)` block, not an inline test; this pins the behaviour so
  // a refactor that hoists the gate out of that block fails here.
  it('green building is a RESIDENTIAL threshold — a commercial project at the same unit count does not fire', () => {
    expect(byLabel(sj({ use: 'residential', units: 10 }), /Green building certification/)?.status).toBe('required')
    expect(byLabel(sj({ use: 'commercial', units: 10 }), /Green building certification/)).toBeFalsy()
    expect(byLabel(sj({ use: 'commercial', units: 400 }), /Green building certification/)).toBeFalsy()
    // The two absences above are non-vacuous: the same commercial call still
    // returns San José rows, so the green-building row is missing because the
    // use guard excluded it, not because the call produced nothing. Without
    // this, a `toBeFalsy()` would pass just as happily on an empty result.
    expect(byLabel(sj({ use: 'commercial', units: 10 }), /Site Development Permit/)?.status).toBe('required')
    // Mixed use still fires: its dwelling units ARE dwelling units, the same
    // reading that keeps mixed use inside the TDM row's home-end-use limb.
    expect(byLabel(sj({ use: 'mixed', units: 10 }), /Green building certification/)?.status).toBe('required')
  })

  // The already-corrected TDM gate, held to the same standard so both San José
  // unit-count rows are pinned rather than only the one under review.
  it('TDM is a RESIDENTIAL threshold — a commercial project at 26 units does not fire', () => {
    expect(byLabel(sj({ use: 'commercial', units: 26 }), /Transportation Demand Management/)).toBeFalsy()
    expect(byLabel(sj({ use: 'commercial', units: 26 }), /Site Development Permit/)?.status).toBe('required')
    expect(byLabel(sj({ use: 'mixed', units: 26 }), /Transportation Demand Management/)?.status).toBe('required')
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

  // USE GUARD, pinned rather than added: `units` is optional and independent of
  // `use`, so a commercial project can carry a unit count (this is what
  // over-fired San José's TDM gate). Nashville's five-unit floor is written in
  // residential units — § 17.40.055 reaches "all proposed residential
  // development that seeks to increase development entitlements", and
  // § 17.40.780(B) exempts "For residential uses, developments fewer than five
  // units". So the threshold is residential-only, and the gate is already
  // residential-only: it sits inside the `if (isResidential)` block. No
  // `isResidential &&` was added — it would be redundant. This test is what
  // keeps that structural guard from being refactored away silently.
  it('the five-unit inclusionary floor is residential-only — a commercial project at the same unit count does not fire it', () => {
    const inc = (use: AnalysisInput['use'], units: number) =>
      byLabel(
        assessHurdles('nashville', parcel({}), project({ city: 'nashville', use, units }), { path: 'variance' }),
        /Inclusionary housing — only if you seek more than base zoning/,
      )
    // Same unit count, same discretionary path — only the use differs.
    expect(inc('residential', 5)?.status).toBe('likely')
    expect(inc('commercial', 5)).toBeFalsy()
    expect(inc('commercial', 40)).toBeFalsy()
    // Mixed use carries dwelling units, so it IS residential development here.
    expect(inc('mixed', 5)?.status).toBe('likely')
    // The state-law absence row is inside the same residential block: a
    // commercial project is not told about an inclusionary rule at all.
    expect(byLabel(
      assessHurdles('nashville', parcel({}), project({ city: 'nashville', use: 'commercial', units: 40 }), { path: 'variance' }),
      /State law bars mandatory inclusionary zoning/,
    )).toBeFalsy()
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

describe('assessHurdles — Raleigh', () => {
  const ACRE = 43560
  const ral = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('raleigh', parcel({ zoning: { districtCode: 'RX-3', subdistrict: null, article: null, maxHeightFt: 50, maxFAR: null, allowedUses: null }, ...p }), project({ city: 'raleigh', ...over }))

  it('resolves a plausible project, headed by the two absences', () => {
    const hs = ral({ use: 'residential', units: 90, gfa: 90000 })
    expect(hs.length).toBeGreaterThan(5)
    // ABSENCE 1 — no inclusionary requirement, and it must be framed as a rule
    // Raleigh has not adopted, NOT as one the State forbids.
    const aff = byLabel(hs, /No inclusionary requirement/)
    expect(aff?.status).toBe('info')
    expect(aff?.note).toMatch(/42-14\.1/)
    expect(aff?.note).toMatch(/has not prohibited it by name/)
    expect(aff?.note).not.toMatch(/state law bars|barred by state law|prohibits mandatory inclusionary/i)
    // ABSENCE 2 — parking, carried by PARKING_RULES and never duplicated here.
    expect(hs.filter((h) => h.category === 'parking')).toHaveLength(1)
    expect(byLabel(hs, /Abolished citywide/)?.note).toMatch(/7\.1\.1/)
    // The administrative-approval finding is the structural headline.
    const sp = byLabel(hs, /Site plan review is administrative/)
    expect(sp?.status).toBe('info')
    expect(sp?.note).toMatch(/10\.2\.8/)
    expect(byLabel(hs, /Thoroughfare and open space facility fees/)?.status).toBe('required')
    expect(byLabel(hs, /Stormwater control permit/)?.note).toMatch(/3\.6 pounds per acre per year/)
    expect(byLabel(hs, /Infrastructure sufficiency/)?.status).toBe('required')
  })

  // No dollar figure for the facility fees is asserted anywhere: Sec. 8.9.1.C
  // sends the reader to a fee schedule the ordinance does not contain, and a
  // plausible number here would be a fabrication wearing a citation (rule 4).
  it('the facility-fee row names no rate, and is not size-gated', () => {
    const fee = byLabel(ral({ use: 'residential', units: 2, gfa: 3000 }), /Thoroughfare and open space facility fees/)
    expect(fee?.status).toBe('required')
    expect(fee?.sizeDependent).toBeFalsy()
    expect(fee?.note).toMatch(/City of Raleigh Fee Schedule/)
    expect(fee?.note).not.toMatch(/\$[\d,]/)
    // …and it does not fire on a change of use, which Sec. 8.9.2 treats apart.
    expect(byLabel(ral({ projectType: 'change_of_use', gfa: 30000 }), /Thoroughfare and open space facility fees/)).toBeFalsy()
  })

  // Sec. 10.2.8.C.1.d joins its two conditions with "and". The size limb alone
  // cannot make the notice REQUIRED, because the 100-foot proximity to R-1/R-2/
  // R-4/R-6/R-10 is not in any field we hold.
  it('the post-approval notice is conjunctive: size gates it, adjacency keeps it "likely"', () => {
    expect(byLabel(ral({ gfa: 24999 }), /Post-approval mailed notice/)).toBeFalsy()
    const n = byLabel(ral({ gfa: 25000 }), /Post-approval mailed notice/)
    expect(n?.status).toBe('likely')
    expect(n?.sizeDependent).toBe(true)
    expect(n?.note).toMatch(/within 100 feet of a property that is zoned R-1, R-2, R-4, R-6 or R-10/)
    expect(n?.note).toMatch(/confirm it/)
  })

  // The affordability bonus is an ELECTION with a mapped-area precondition, so
  // it can never be 'required' — and it starts above twelve units, not at it.
  it('the Frequent Transit affordability trade starts above 12 units and stays conditional', () => {
    expect(byLabel(ral({ use: 'residential', units: 12 }), /Frequent Transit Development Option/)).toBeFalsy()
    const h = byLabel(ral({ use: 'residential', units: 13 }), /Frequent Transit Development Option/)
    expect(h?.status).toBe('likely')
    expect(h?.sizeDependent).toBe(true)
    expect(h?.note).toMatch(/twenty percent \(20%\) of the residential units over twelve \(12\)/)
    expect(h?.note).toMatch(/Frequent Transit Area/)
    // USE GUARD: `units` is independent of `use`, so a commercial project can
    // carry a unit count. Sec. 2.7.1 note G4 is written for "a development site
    // utilizing this option in a residential zoning district" — the enclosing
    // isResidential check is what keeps this off a commercial project.
    expect(byLabel(ral({ use: 'commercial', units: 40 }), /Frequent Transit Development Option/)).toBeFalsy()
    expect(byLabel(ral({ use: 'commercial', units: 40 }), /No inclusionary requirement/)).toBeFalsy()
  })

  // Two acres is the line in Sec. 9.1.2 and Sec. 9.1.10 alike; four acres is
  // where the -TOD carve-out at Sec. 5.5.1.I can no longer reach.
  it('tree conservation fires at 2 acres and hardens at 4', () => {
    const at = (acres: number, over: Partial<AnalysisInput> = {}) =>
      byLabel(ral(over, { lot: { sizeSqFt: Math.round(acres * ACRE), lotType: null } }), /Tree conservation area/)
    expect(at(1.99)).toBeFalsy()
    expect(at(2)?.status).toBe('likely')
    expect(at(2)?.note).toMatch(/less than 4 acres/)
    expect(at(4)?.status).toBe('required')
    expect(at(4)?.note).not.toMatch(/confirm whether the -TOD is mapped/)
    // The trigger is LOT area, so it must not be softened by a placeholder GFA.
    expect(at(4)?.sizeDependent).toBeFalsy()
    // It is a new-construction gate; a change of use disturbs no trees.
    expect(at(4, { projectType: 'change_of_use' })).toBeFalsy()
  })

  it('the tree percentage follows the district, and R-10 is not R-1', () => {
    const pct = (districtCode: string) =>
      byLabel(
        ral({}, { lot: { sizeSqFt: 5 * ACRE, lotType: null }, zoning: { districtCode, subdistrict: null, article: null, maxHeightFt: 40, maxFAR: null, allowedUses: null } }),
        /Tree conservation area/,
      )?.note
    expect(pct('R-1')).toMatch(/15% for the district mapped here/)
    expect(pct('R-2')).toMatch(/15% for the district mapped here/)
    // R-10 must take the 10% row — a naive /^R-1/ prefix test would misread it.
    expect(pct('R-10')).toMatch(/10% for the district mapped here/)
    expect(pct('DX-12')).toMatch(/10% for the district mapped here/)
  })

  // 12,000 sq ft is UNCOVERED area, not lot area — lot size is a proxy and the
  // note has to say so, or a reader corrects in the wrong direction.
  it('the erosion plan keys on 12,000 sq ft and labels lot area as a proxy', () => {
    expect(byLabel(ral({}, { lot: { sizeSqFt: 12000, lotType: null } }), /Erosion and sedimentation control plan/)).toBeFalsy()
    const e = byLabel(ral({}, { lot: { sizeSqFt: 12001, lotType: null } }), /Erosion and sedimentation control plan/)
    expect(e?.status).toBe('likely')
    expect(e?.note).toMatch(/UNCOVERED, not in lot area or floor area/)
    expect(e?.sizeDependent).toBeFalsy()
  })

  // The -TOD row reads the overlay the provider actually fetches. A miss must be
  // a silent non-render, never a guess — so no -TOD label, no row.
  it('the Transit Overlay row renders only when the overlay is actually mapped', () => {
    expect(byLabel(ral({}), /Transit Overlay District/)).toBeFalsy()
    const tod = byLabel(
      ral({}, { zoning: { districtCode: 'RX-3', subdistrict: 'Transit Overlay District', article: null, maxHeightFt: 50, maxFAR: null, allowedUses: null } }),
      /Transit Overlay District \(-TOD\) standards/,
    )
    expect(tod?.status).toBe('required')
    expect(tod?.note).toMatch(/5\.5\.1/)
    expect(tod?.note).toMatch(/at least 2 storeys/)
  })

  it('the rezoning row is discretionary-only; the appeal window is not', () => {
    const disc = assessHurdles('raleigh', parcel({}), project({ city: 'raleigh', use: 'residential', units: 40 }), { path: 'variance' })
    const rz = byLabel(disc, /Conditional rezoning/)
    expect(rz?.status).toBe('likely')
    expect(rz?.note).toMatch(/second neighbourhood meeting|SECOND neighbourhood meeting/)
    expect(rz?.note).toMatch(/24 months/)
    const aor = assessHurdles('raleigh', parcel({}), project({ city: 'raleigh', use: 'residential', units: 40 }), { path: 'as_of_right' })
    expect(byLabel(aor, /Conditional rezoning/)).toBeFalsy()
    // …but Raleigh's appeal clock opens on an ordinary as-of-right permit.
    const appeal = byLabel(aor, /Third-party appeal window/)
    expect(appeal?.status).toBe('info')
    expect(appeal?.addsMonths).toBeUndefined()
  })

  it('the historic demolition delay is an overlay power, not a citywide screen', () => {
    const teardown = (historicDistrict: string | null) =>
      assessHurdles(
        'raleigh',
        parcel({ overlays: { historicDistrict, floodZone: null }, existing: { landUse: 'Single Family', yearBuilt: 1912, units: 1 } }),
        project({ city: 'raleigh', projectType: 'new', use: 'residential', units: 4 }),
      )
    expect(byLabel(teardown(null), /up to 365 days/)).toBeFalsy()
    const inHod = byLabel(teardown('Oakwood Historic Overlay District'), /up to 365 days/)
    expect(inHod?.status).toBe('required')
    expect(inHod?.note).toMatch(/may not be denied except as provided below for Statewide Significance/)
    // The pending-designation freeze applies on any teardown.
    expect(byLabel(teardown(null), /pending historic designation/i)?.status).toBe('info')
  })

  // Rule 11, pinned. Raleigh's UDO was first read from the consolidated
  // print-all-chapters export, which strips the A./B./C. labels off subsection
  // headings — so counting paragraphs off it invents sub-letters that point at
  // real provisions saying something else. Four were wrong before the
  // per-section pages on udo.raleighnc.gov were checked. This test is the
  // structure that stops them coming back: it names the letters that were
  // VERIFIED and fails on the ones that were wrong.
  it('the citations use the verified subsection letters, not the flattened-export guesses', () => {
    const all = [
      ...assessHurdles(
        'raleigh',
        parcel({ lot: { sizeSqFt: 300000, lotType: null }, overlays: { historicDistrict: 'Oakwood Historic Overlay District', floodZone: null }, existing: { landUse: 'Single Family', yearBuilt: 1912, units: 1 }, zoning: { districtCode: 'RX-3', subdistrict: 'Transit Overlay District', article: null, maxHeightFt: 50, maxFAR: null, allowedUses: null } }),
        project({ city: 'raleigh', use: 'residential', units: 200, gfa: 250000 }),
        { path: 'variance' },
      ),
    ]
      .map((h) => h.note)
      .join('\n')

    // Verified against the per-section pages.
    for (const cite of [
      'Sec. 10.2.8.D.1.d', // Approval Process is D, not C
      'Sec. 10.2.8.D.1.f',
      'Sec. 10.2.8.F', //   Expiration of a Site Plan is F, not E
      'Sec. 10.2.15.E.1', // Demolition of Buildings is E, not F
      'Sec. 10.2.15.E.2',
      'Sec. 5.5.1.H.3', //  -TOD Height is H, not G
      'Sec. 5.5.1.I',
      'Sec. 9.2.2.C.1',
      'Sec. 9.2.2.B.1.a',
    ]) {
      expect(all, `expected the note text to cite ${cite}`).toContain(cite)
    }

    // The four wrong pointers, and the sub-items on sections whose top level is
    // NUMBERED rather than lettered — none may reappear.
    for (const wrong of [
      'Sec. 10.2.8.C.1',
      'Sec. 10.2.15.F.',
      'Sec. 5.5.1.G',
      'Sec. 5.4.1.G',
      'Sec. 8.2.1.A',
      'Sec. 8.9.1.A',
      'Sec. 8.9.1.B',
      'Sec. 8.9.1.C',
      'Sec. 8.11.2.A',
      'Sec. 9.4.6.B',
    ]) {
      expect(all, `${wrong} does not exist as printed — do not cite it`).not.toContain(wrong)
    }
  })

  it('the Certificate of Appropriateness copy is Raleigh’s, not the generic fallback', () => {
    const h = byLabel(
      ral({}, { overlays: { historicDistrict: 'Oakwood Historic Overlay District', floodZone: null } }),
      /Historic district design review/,
    )
    expect(h?.note).toMatch(/Historic Development Commission/)
    expect(h?.note).toMatch(/5\.4\.1\.C\.1/)
    // The 180-day figure at Sec. 10.2.15.D.1 is a CEILING on the Committee, so
    // it must not have become the published duration for the review.
    expect(h?.addsMonths).toBe(3)
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

// Raleigh, on its own, because its answer to "what duration does the code
// publish?" is NOTHING — and that is a finding, not a gap. The UDO states three
// numbers that read like durations and none of them is one: the 180-day cap on
// a Certificate of Appropriateness decision (Sec. 10.2.15.D.1), the 60 days a
// Planning Commission has to recommend, and the 60 days Council has to schedule
// its hearing (Sec. 10.2.4.E.2.d, .E.3). Each is a ceiling on a body, not an
// expected elapsed time, and summing two ceilings would publish a number no
// source states. So every Raleigh addsMonths must trace to a MODULE-level row.
describe('Raleigh — no invented durations', () => {
  function expectedMonths(label: string): number | undefined {
    if (/^Historic district design review$/.test(label)) return 3 // module default; no override
    if (/^Replacing existing housing$/.test(label)) return 6
    if (/^Public-funding process/.test(label)) return 4
    if (/^Coastal Development Permit$/.test(label)) return 9
    return undefined
  }

  const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
    { p: {}, j: { use: 'residential', units: 40, gfa: 60000 } },
    { p: {}, j: { use: 'commercial', units: 0, gfa: 120000, funding: 'public' } },
    { p: { lot: { sizeSqFt: 300000, lotType: null } }, j: { use: 'mixed', units: 200, gfa: 250000 } },
    { p: { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1930 } }, j: { projectType: 'new', use: 'residential', units: 4 } },
    { p: { overlays: { historicDistrict: 'Oakwood Historic Overlay District', floodZone: 'AE' } }, j: { projectType: 'new', use: 'residential', units: 12 } },
    { p: { zoning: { districtCode: 'RX-3', subdistrict: 'Transit Overlay District', article: null, maxHeightFt: 50, maxFAR: null, allowedUses: null } }, j: { use: 'residential', units: 60, gfa: 80000 } },
  ]

  it('every addsMonths traces to a published duration', () => {
    for (const s of scenarios) {
      for (const path of ['as_of_right', 'variance'] as const) {
        const hs = assessHurdles('raleigh', parcel(s.p), project({ city: 'raleigh', ...s.j }), { path })
        for (const h of hs) {
          expect(h.addsMonths, `raleigh / ${h.label}`).toBe(expectedMonths(h.label))
        }
      }
    }
  })

  it('every size-triggered hurdle carries sizeDependent, and no other one does', () => {
    const hs = assessHurdles(
      'raleigh',
      parcel({ lot: { sizeSqFt: 300000, lotType: null }, overlays: { historicDistrict: 'Oakwood Historic Overlay District', floodZone: null } }),
      project({ city: 'raleigh', use: 'residential', units: 200, gfa: 250000 }),
    )
    // Unit- and floor-area triggers, tagged.
    for (const re of [/Frequent Transit Development Option/, /Post-approval mailed notice/]) {
      const h = byLabel(hs, re)
      expect(h, `raleigh expected a hurdle matching ${re}`).toBeTruthy()
      expect(h?.sizeDependent, `raleigh / ${h?.label}`).toBe(true)
    }
    // LOT-area and always-on triggers, untagged. The tree and erosion rows key
    // on measured lot area, not on a floor area that may be a placeholder, so
    // softening them against gfaBasis would be softening the wrong input.
    const untagged = hs.filter((h) =>
      /No inclusionary requirement|Thoroughfare and open space facility fees|Site plan review is administrative|Third-party appeal window|Infrastructure sufficiency|Tree conservation area|Stormwater control permit|Erosion and sedimentation control plan/.test(h.label),
    )
    expect(untagged.length, 'raleigh expected several untagged rows').toBeGreaterThan(4)
    for (const h of untagged) expect(h.sizeDependent, `raleigh / ${h.label}`).toBeFalsy()
  })

  it('a placeholder GFA downgrades Raleigh’s size-triggered rows but not its lot-area ones', () => {
    const soft = assessHurdles(
      'raleigh',
      parcel({ lot: { sizeSqFt: 300000, lotType: null } }),
      project({ city: 'raleigh', use: 'residential', units: 200, gfa: 250000, gfaBasis: 'assumed-far-1.0' }),
    )
    // Both Raleigh size-triggered rows are already 'likely', which
    // softenSizeDependent leaves alone — their own text hedges. What must hold
    // is that nothing REQUIRED here rests on the placeholder.
    expect(byLabel(soft, /Frequent Transit Development Option/)?.status).toBe('likely')
    expect(byLabel(soft, /Post-approval mailed notice/)?.status).toBe('likely')
    // …and the lot-area rows keep their strength, because lot area was measured.
    expect(byLabel(soft, /Tree conservation area/)?.status).toBe('required')
    expect(byLabel(soft, /Stormwater control permit/)?.status).toBe('required')
  })
})

// ─── The 2026-08-08 cohort ───────────────────────────────────────────────────
// ⚠️ THE SCOPE NOTE THAT USED TO STAND HERE — "four cities encoded for PARKING
// ONLY" — IS RETRACTED, and is left visible rather than overwritten because the
// same sentence stood in three files at once (see the corrected block above the
// constants in hurdles.ts, and src/config/cities.ts). All four now carry their
// non-parking rows as well.
//
// The describes below are therefore in two layers. The original per-city blocks
// pin the parcel-conditional PARKING rows and are unchanged — they remain the
// record of the first pass. The "beyond parking" / "non-parking" blocks that
// follow each of them pin the 2026-08-08 encoding of the rest. Underneath both,
// the shared cohort describe pins the two properties that hold across every city
// in this module: no invented duration, and every size-triggered row tagged.

const zone = (districtCode: string, over: Partial<ParcelInfo['zoning']> = {}): Partial<ParcelInfo> => ({
  zoning: { districtCode, subdistrict: null, article: null, maxHeightFt: 60, maxFAR: null, allowedUses: null, ...over },
})

describe('assessHurdles — Milwaukee', () => {
  const mke = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('milwaukee', parcel({ ...zone('RM6'), ...p }), project({ city: 'milwaukee', ...over }))

  it('resolves a plausible project and states the district ratio', () => {
    const hs = mke({ use: 'residential', units: 40, gfa: 52000 })
    expect(hs.length).toBeGreaterThan(4)
    const min = byLabel(hs, /Off-street parking minimum/)
    expect(min?.status).toBe('required')
    expect(min?.label).toMatch(/2 spaces per 3 dwelling units/)
    expect(min?.note).toMatch(/295-403-2-a/)
    // The other dwelling-type rows must travel with it — a reader on the
    // multi-family row needs to know the others carry no minimum at all.
    expect(min?.note).toMatch(/no min\.; max\. of 4 spaces/)
    // The citywide rule is carried separately by PARKING_RULES and still fires.
    expect(hs.filter((h) => h.category === 'parking').length).toBeGreaterThan(2)
  })

  it('reads the 1:1 and 2:3 columns of Table 295-403-2-a off the district', () => {
    for (const [code, ratio] of [['RM2', /1 space per dwelling unit/], ['RB1', /1 space per dwelling unit/], ['RM7', /2 spaces per 3/], ['CS', /2 spaces per 3/]] as const) {
      const h = byLabel(mke({ use: 'residential', units: 20 }, zone(code)), /Off-street parking minimum/)
      expect(h?.label, code).toMatch(ratio)
    }
  })

  // THE HEADLINE MILWAUKEE FINDING, and the one a paraphrase destroys: downtown
  // is exempt EXCEPT C9A, and C9A is the high-density residential district. A
  // branch that matched /^C9/ and stopped would publish "no parking required"
  // for exactly the downtown district that builds apartments.
  it('C9A keeps its minimum while every other downtown district loses it', () => {
    for (const code of ['C9A(A)', 'C9A(B)']) {
      const hs = mke({ use: 'residential', units: 60 }, zone(code))
      expect(byLabel(hs, /Off-street parking minimum/)?.label, code).toMatch(/2 spaces per 3/)
      expect(byLabel(hs, /No off-street parking required in this district/), code).toBeUndefined()
    }
    for (const code of ['C9B(A)', 'C9C', 'C9F(C)', 'C9H']) {
      const hs = mke({ use: 'residential', units: 60 }, zone(code))
      const none = byLabel(hs, /No off-street parking required in this district/)
      expect(none?.status, code).toBe('info')
      expect(none?.note, code).toMatch(/Except for within the C9A district/)
      expect(byLabel(hs, /Off-street parking minimum/), code).toBeUndefined()
    }
  })

  it('the RED redevelopment district is the second exempting limb', () => {
    const none = byLabel(mke({ use: 'residential', units: 30 }, zone('RED')), /No off-street parking required/)
    expect(none?.status).toBe('info')
    expect(none?.note).toMatch(/RED redevelopment district/)
  })

  // The minimum is written per dwelling-type ROW, so the strength of the claim
  // has to track the program. A duplex is on a row that reads "no min.".
  it('the status tracks the dwelling-type row, not the district alone', () => {
    expect(byLabel(mke({ use: 'residential', units: 12 }), /Off-street parking minimum/)?.status).toBe('required')
    expect(byLabel(mke({ use: 'residential', units: 2 }), /Off-street parking minimum/)?.status).toBe('info')
    // Unknown count → never a hard requirement.
    expect(byLabel(mke({ use: 'residential', units: 0 }), /Off-street parking minimum/)?.status).toBe('likely')
  })

  // Disjunctive, and the second limb is the broad one. A note that quoted only
  // the boundary limb would understate this by most of the city.
  it('quotes all three limbs of the 25% reduction, and only where a minimum exists', () => {
    const red = byLabel(mke({ use: 'residential', units: 40 }), /25% parking reduction/)
    expect(red?.status).toBe('likely')
    expect(red?.note).toMatch(/one or more of the following criteria/)
    expect(red?.note).toMatch(/Capitol Drive/)
    expect(red?.note).toMatch(/within 1,000 feet of any regularly scheduled bus stop/)
    expect(red?.note).toMatch(/1,320 feet/)
    // No minimum in a downtown district ⇒ nothing to reduce ⇒ no row.
    expect(byLabel(mke({ use: 'residential', units: 40 }, zone('C9C')), /25% parking reduction/)).toBeUndefined()
  })
})

// ─── Milwaukee beyond parking ────────────────────────────────────────────────
// The parking block above stays as the record of the first pass. These pin the
// 2026-08-08 encoding of chs. 119, 120, 200, 218, 290, 295, 355 and Wis. Stat.
// § 66.1015.
describe('assessHurdles — Milwaukee, beyond parking', () => {
  const mke2 = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('milwaukee', parcel({ ...zone('RM6'), ...p }), project({ city: 'milwaukee', ...over }))

  // THE HEADLINE. An absence somebody established, rendered as an answer —
  // and it must never soften into "confirm whether an inclusionary rule
  // applies", because the statute names the thing and forbids it.
  it('states the Wisconsin inclusionary-zoning ban as an ANSWER, for residential only', () => {
    const h = byLabel(mke2({ use: 'residential', units: 40, gfa: 52000 }), /State law bars inclusionary zoning/)
    expect(h?.status).toBe('info')
    expect(h?.category).toBe('affordability')
    expect(h?.note).toMatch(/66\.1015\(3\)\(b\)/)
    expect(h?.note).toMatch(/No city, village, town, or county may enact, impose, or enforce/)
    // The rezoning-conditioned workaround Nashville allows is closed here, and
    // the case that closed it must travel with the row.
    expect(h?.note).toMatch(/Apartment Ass’n of South Central Wisconsin/)
    expect(h?.addsMonths).toBeUndefined()
    // A commercial project has no affordability question to answer.
    expect(byLabel(mke2({ use: 'commercial', units: 0, gfa: 60000 }), /State law bars inclusionary zoning/)).toBeUndefined()
  })

  it('always says permits are administrative — and names all four doors discretion enters through', () => {
    const h = byLabel(mke2({ use: 'residential', units: 12 }), /permits are administrative/)
    expect(h?.status).toBe('info')
    expect(h?.note).toMatch(/295-301/)
    // The caveat is the row. Without it the claim is true of the base case and
    // false of any parcel carrying an overlay or a designation.
    for (const door of [/Site Plan Review/, /Development Incentive/, /Neighborhood Conservation/, /historic designation/, /special use/, /rezoning/]) {
      expect(h?.note, String(door)).toMatch(door)
    }
  })

  // ⚠️ CROSS-MODULE STRING COUPLING. These three phrases are written into
  // `zoning.article` by `buildArticle` in providers/milwaukee.ts and are matched
  // here; neither overlay is on `parcel.overlays`. The provider end is pinned by
  // providers/milwaukee.test.ts ("a Site Plan Review overlay and an NC overlay
  // are disclosed too"). Change the phrasing in either file and one of the two
  // suites fails — which is the point, because a silent drift here renders as
  // "no overlay", the shape ledger rule 9 warns about.
  const SPROZ_ARTICLE =
    'Multi-family residential. Site Plan Review overlay zone (Messmer High School): under Milwaukee Code s. 295-1009-3-a the zone’s design standards may set building height and bulk and "shall supercede the standards of the underlying district".'
  const DIZ_ARTICLE =
    'Multi-family residential. Development Incentive Zone (30th Street Industrial Corridor): under Milwaukee Code s. 295-1007-3-a the zone’s performance standards may set building height and bulk and "shall supercede the standards of the underlying district".'
  const NC_ARTICLE =
    'Multi-family residential. Neighborhood Conservation overlay zone (Brewers Hill / Harambee): an adopted neighborhood conservation plan and guidelines apply (Milwaukee Code s. 295-1003).'

  it('Site Plan Review overlay fires off the phrase the provider writes into zoning.article', () => {
    const on = byLabel(
      mke2({ use: 'residential', units: 40 }, zone('RM6', { article: SPROZ_ARTICLE })),
      /Site Plan Review overlay/,
    )
    expect(on?.status).toBe('required')
    expect(on?.note).toMatch(/295-1009-2-d/)
    // It must also warn that the base district's height and bulk may not govern.
    expect(on?.note).toMatch(/supercede the standards of the underlying district/)
    // No article, no row — a miss is a false negative and never an assertion.
    expect(byLabel(mke2({ use: 'residential', units: 40 }), /Site Plan Review overlay/)).toBeUndefined()
  })

  it('DIZ fires — but honours the single-family / 2-family exemption on the face of the same sentence', () => {
    const big = byLabel(mke2({ use: 'residential', units: 40 }, zone('RM6', { article: DIZ_ARTICLE })), /Development Incentive Zone/)
    expect(big?.status).toBe('required')
    expect(big?.note).toMatch(/295-1007-2-e/)
    expect(big?.note).toMatch(/single-family or 2-family dwellings shall be exempt/)
    // The exemption is part of the condition, not a caveat in prose: a duplex
    // must not be told a permit is being held.
    for (const u of [1, 2]) {
      expect(
        byLabel(mke2({ use: 'residential', units: u }, zone('RM6', { article: DIZ_ARTICLE })), /Development Incentive Zone/),
        `residential ${u} units`,
      ).toBeUndefined()
    }
    // …but the exemption names DWELLINGS, so a two-unit MIXED program is still in.
    expect(byLabel(mke2({ use: 'mixed', units: 2 }, zone('RM6', { article: DIZ_ARTICLE })), /Development Incentive Zone/)).toBeTruthy()
    // The exemption limb is a unit count, so a placeholder unit count must not
    // leave a hard requirement standing.
    expect(big?.sizeDependent).toBe(true)
    const soft = byLabel(
      assessHurdles(
        'milwaukee',
        parcel(zone('RM6', { article: DIZ_ARTICLE })),
        project({ city: 'milwaukee', use: 'residential', units: 40, gfa: 60000, gfaBasis: 'assumed-far-1.0' }),
      ),
      /Development Incentive Zone/,
    )
    expect(soft?.status).toBe('info')
  })

  it('NC overlay is “likely”, because the binding content is in a plan we do not hold', () => {
    const h = byLabel(mke2({ use: 'residential', units: 40 }, zone('RM6', { article: NC_ARTICLE })), /Neighborhood Conservation overlay/)
    expect(h?.status).toBe('likely')
    expect(h?.note).toMatch(/295-1003-1/)
    expect(h?.note).toMatch(/modifications to base district standards/)
  })

  it('states the Architectural Review Board districts without asserting them for a parcel', () => {
    const h = byLabel(mke2({}), /Architectural Review Board districts/)
    // Defined by Common Council resolution, not by any layer we fetch — so this
    // can only ever be 'info', and the row must say we hold no boundary.
    expect(h?.status).toBe('info')
    expect(h?.note).toMatch(/200-61-5/)
    expect(h?.note).toMatch(/HOLDS NO BOUNDARY/i)
    // …and that it is a carve-OUT of the historic ordinance, not an addition to it.
    expect(h?.note).toMatch(/320-21-2-a/)
  })

  it('historic demolition: the 8-month deferral is quoted and NOT scheduled', () => {
    const hs = assessHurdles(
      'milwaukee',
      parcel({ ...zone('RM6'), overlays: { historicDistrict: 'Brewers Hill Historic District', floodZone: null }, existing: { landUse: 'Single family', units: 1, yearBuilt: 1890 } }),
      project({ city: 'milwaukee', projectType: 'new', use: 'residential', units: 12 }),
    )
    const h = byLabel(hs, /Historic demolition/)
    expect(h?.status).toBe('required')
    expect(h?.note).toMatch(/for up to 8 months/)
    expect(h?.note).toMatch(/320-21-11-f-1/)
    // A deferral ceiling is not a schedule. This is the assertion that keeps it
    // out of the timeline.
    expect(h?.addsMonths).toBeUndefined()
    // The financing condition and the digital-twin documentation both bite on
    // schedule and cost, so they must survive any future trim of the note.
    expect(h?.note).toMatch(/all debt and equity financing/)
    expect(h?.note).toMatch(/permanent digital twin/)
    // No teardown, no row.
    expect(
      byLabel(
        assessHurdles(
          'milwaukee',
          parcel({ ...zone('RM6'), overlays: { historicDistrict: 'Brewers Hill Historic District', floodZone: null } }),
          project({ city: 'milwaukee', projectType: 'addition', use: 'residential', units: 12 }),
        ),
        /Historic demolition/,
      ),
    ).toBeUndefined()
  })

  it('the historic row itself takes the module default of 3 months — no Milwaukee override', () => {
    // Every Milwaukee figure in ch. 320 subch. 21 is a shot clock or a deferral
    // ceiling, so HISTORIC_MONTHS deliberately has no milwaukee entry.
    const h = byLabel(
      assessHurdles(
        'milwaukee',
        parcel({ ...zone('RM6'), overlays: { historicDistrict: 'Brewers Hill Historic District', floodZone: null } }),
        project({ city: 'milwaukee', use: 'residential', units: 12 }),
      ),
      /^Historic district design review$/,
    )
    expect(h?.addsMonths).toBe(3)
    expect(h?.note).toMatch(/320-21-11-a/)
    expect(h?.note).toMatch(/certificate of appropriateness/i)
  })

  describe('deconstruction (s. 218-10)', () => {
    const demo = (existing: NonNullable<ParcelInfo['existing']>, historic: string | null = null) =>
      assessHurdles(
        'milwaukee',
        parcel({ ...zone('RM6'), existing, overlays: { historicDistrict: historic, floodZone: null } }),
        project({ city: 'milwaukee', projectType: 'new', use: 'residential', units: 8, gfa: 10000 }),
      )

    it('is REQUIRED where the year limb holds — pre-1930 and 1–4 units', () => {
      const h = byLabel(demo({ landUse: 'Duplex', units: 2, yearBuilt: 1912 }), /Deconstruction required/)
      expect(h?.status).toBe('required')
      expect(h?.note).toMatch(/built in 1929 or earlier/)
      expect(h?.note).toMatch(/85% landfill diversion rate/)
      expect(h?.note).toMatch(/certified deconstruction contractor/)
      // The trigger is the EXISTING building's occupancy and year, not the
      // project's floor area, so the tag that softens placeholder-size claims
      // must NOT be set (same reasoning as Raleigh's lot-area tree row).
      expect(h?.sizeDependent).toBeFalsy()
      expect(h?.addsMonths).toBeUndefined()
    })

    it('is only LIKELY where it fires on the historic-district limb alone', () => {
      const h = byLabel(demo({ landUse: 'Single family', units: 1, yearBuilt: 1975 }, 'Brewers Hill Historic District'), /Deconstruction required/)
      expect(h?.status).toBe('likely')
    })

    it('does not fire above 4 units, below 1, or on a modern non-historic house', () => {
      // "Primary dwelling structure" is 1–4 units by definition (s. 218-10-2-c).
      expect(byLabel(demo({ landUse: 'Apartment', units: 12, yearBuilt: 1905 }), /Deconstruction required/)).toBeUndefined()
      // An unknown unit count could be a 40-unit block — a false negative, and
      // never a false positive.
      expect(byLabel(demo({ landUse: 'Apartment', buildingAreaSqFt: 9000, yearBuilt: 1905 }), /Deconstruction required/)).toBeUndefined()
      expect(byLabel(demo({ landUse: 'Single family', units: 1, yearBuilt: 1996 }), /Deconstruction required/)).toBeUndefined()
    })
  })

  it('stormwater uses lot area as a labelled PROXY, above half an acre only', () => {
    const big = byLabel(
      assessHurdles('milwaukee', parcel({ ...zone('RM6'), lot: { sizeSqFt: 30000, lotType: null } }), project({ city: 'milwaukee', projectType: 'new', use: 'residential', units: 30 })),
      /Stormwater management plan/,
    )
    expect(big?.status).toBe('likely')
    expect(big?.note).toMatch(/120-7-2/)
    // The proxy must be disclosed as one — the live limbs are disturbed area
    // and impervious increase, neither of which we hold.
    expect(big?.note).toMatch(/lot area is only a proxy/i)
    expect(
      byLabel(
        assessHurdles('milwaukee', parcel({ ...zone('RM6'), lot: { sizeSqFt: 6000, lotType: null } }), project({ city: 'milwaukee', projectType: 'new', use: 'residential', units: 2 })),
        /Stormwater management plan/,
      ),
    ).toBeUndefined()
  })

  it('erosion control and landscaping fire on new construction only', () => {
    const nw = mke2({ projectType: 'new', use: 'residential', units: 12 })
    expect(byLabel(nw, /Erosion control plan/)?.status).toBe('likely')
    expect(byLabel(nw, /Erosion control plan/)?.note).toMatch(/4,000 square feet or more/)
    const land = byLabel(nw, /Landscaping and canopy trees/)
    expect(land?.status).toBe('required')
    expect(land?.note).toMatch(/295-405-1-b-1/)
    expect(land?.note).toMatch(/every 4 parking spaces or fraction thereof/)
    // The second finding in that row is an ABSENCE somebody looked for, and the
    // scope of the look is part of the claim.
    expect(land?.note).toMatch(/no tree-preservation ordinance/i)
    expect(land?.note).toMatch(/Scope of that absence check/)

    const add = mke2({ projectType: 'addition', use: 'residential', units: 12 })
    expect(byLabel(add, /Erosion control plan/)).toBeUndefined()
    expect(byLabel(add, /Landscaping and canopy trees/)).toBeUndefined()
  })

  it('records the impact-fee absence with the scope of the check, and the subdivision exaction that IS there', () => {
    const h = byLabel(mke2({}), /No development impact fees/)
    expect(h?.status).toBe('info')
    expect(h?.note).toMatch(/119-12-1/)
    expect(h?.note).toMatch(/at the subdivider’s own expense/)
    // An absence is only an answer once someone has looked, and the note must
    // say how far the looking went.
    expect(h?.note).toMatch(/Scope of this absence check/)
  })

  it('rezoning and special use are discretionary-only, and neither invents a clock', () => {
    const aor = mke2({ use: 'residential', units: 40 })
    expect(byLabel(aor, /Rezoning or planned development/)).toBeUndefined()
    expect(byLabel(aor, /Special use permit/)).toBeUndefined()

    const hs = assessHurdles('milwaukee', parcel(zone('RM6')), project({ city: 'milwaukee', use: 'residential', units: 40 }), { path: 'variance' })
    const rez = byLabel(hs, /Rezoning or planned development/)
    expect(rez?.status).toBe('likely')
    expect(rez?.note).toMatch(/295-307-3/)
    // The protest-petition supersession is the applicant-favourable half and is
    // easy to lose in a trim; it is the difference between a neighbour veto and
    // a simple majority.
    expect(rez?.note).toMatch(/66\.10015\(3\)\(a\)/)
    expect(rez?.addsMonths).toBeUndefined()

    const su = byLabel(hs, /Special use permit/)
    expect(su?.status).toBe('likely')
    expect(su?.note).toMatch(/295-311-2-c/)
    expect(su?.note).toMatch(/30 days have elapsed/)
    // A 30-day agency comment WINDOW is not a scheduled delay.
    expect(su?.addsMonths).toBeUndefined()
  })

  it('the $1M city-assistance strings fire only on public funding, and stay “likely”', () => {
    expect(byLabel(mke2({ funding: 'private', use: 'residential', units: 40, gfa: 60000 }), /Community-participation requirements/)).toBeUndefined()
    const h = byLabel(mke2({ funding: 'public', use: 'residential', units: 40, gfa: 60000 }), /Community-participation requirements/)
    // We do not hold the assistance amount, which IS the threshold limb — so
    // this can never be 'required' off `funding === 'public'` alone.
    expect(h?.status).toBe('likely')
    expect(h?.note).toMatch(/\$1 million or more/)
    expect(h?.note).toMatch(/355-1-2/)
    expect(h?.note).toMatch(/presumed to be 40%/)
    expect(h?.addsMonths).toBeUndefined()
  })

  it('no row in the Milwaukee branch publishes a duration', () => {
    // Milwaukee's code is full of numbers — 10 days, 15 days, 30 days, 45 days,
    // 5 weeks, 8 months — and every one is a shot clock on the city or a
    // deferral ceiling. The only addsMonths a Milwaukee analysis may carry come
    // from the module's shared rows.
    // Deliberately UNANCHORED on the right: the shared public-funding row's
    // label carries a parenthetical suffix, and an anchored alternative would
    // silently fail to match it and then fail on its legitimate 4 months.
    const shared = /^(Historic district design review$|Replacing existing housing$|Public-funding process|Coastal Development Permit$|Demolition of the existing building$)/
    const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
      { p: zone('RM6', { article: SPROZ_ARTICLE }), j: { use: 'residential', units: 40, gfa: 60000 } },
      { p: zone('RM6', { article: DIZ_ARTICLE }), j: { use: 'mixed', units: 2, gfa: 9000, funding: 'public' } },
      { p: zone('RM6', { article: NC_ARTICLE }), j: { use: 'commercial', units: 0, gfa: 120000 } },
      {
        p: { ...zone('RT4'), lot: { sizeSqFt: 40000, lotType: null }, overlays: { historicDistrict: 'Brewers Hill Historic District', floodZone: null }, existing: { landUse: 'Duplex', units: 2, yearBuilt: 1901 } },
        j: { projectType: 'new', use: 'residential', units: 24 },
      },
    ]
    for (const s of scenarios) {
      for (const path of ['as_of_right', 'variance'] as const) {
        for (const h of assessHurdles('milwaukee', parcel(s.p), project({ city: 'milwaukee', ...s.j }), { path })) {
          if (shared.test(h.label)) continue
          expect(h.addsMonths, `milwaukee / ${h.label}`).toBeUndefined()
        }
      }
    }
  })

  it('a fully loaded Milwaukee parcel produces the whole set', () => {
    const hs = assessHurdles(
      'milwaukee',
      parcel({
        ...zone('RM6', { article: `${SPROZ_ARTICLE} ${DIZ_ARTICLE} ${NC_ARTICLE}` }),
        lot: { sizeSqFt: 40000, lotType: null },
        overlays: { historicDistrict: 'Brewers Hill Historic District', floodZone: 'AE' },
        existing: { landUse: 'Duplex', units: 2, yearBuilt: 1901 },
      }),
      project({ city: 'milwaukee', projectType: 'new', use: 'residential', units: 24, gfa: 30000, funding: 'public' }),
      { path: 'variance' },
    )
    // All three overlays are read off ONE article string — this is why the gate
    // is on `article` and not on `subdistrict`, which carries at most one.
    for (const re of [/Site Plan Review overlay/, /Development Incentive Zone/, /Neighborhood Conservation overlay/]) {
      expect(byLabel(hs, re), String(re)).toBeTruthy()
    }
    for (const re of [/Deconstruction required/, /Historic demolition/, /Stormwater management plan/, /Erosion control plan/, /Landscaping and canopy trees/, /No development impact fees/, /Rezoning or planned development/, /Special use permit/, /Community-participation requirements/, /State law bars inclusionary zoning/]) {
      expect(byLabel(hs, re), String(re)).toBeTruthy()
    }
    expect(cats(hs)).toContain('affordability')
    expect(cats(hs)).toContain('demolition')
    expect(cats(hs)).toContain('environmental')
    expect(cats(hs)).toContain('fees')
    expect(cats(hs)).toContain('labor')
  })
})

describe('assessHurdles — Columbus', () => {
  const col = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('columbus', parcel({ ...zone('R3'), ...p }), project({ city: 'columbus', ...over }))

  it('resolves a plausible project and carries both codes’ answers', () => {
    const hs = col({ use: 'residential', units: 40, gfa: 52000 })
    expect(hs.length).toBeGreaterThan(4)
    const dep = byLabel(hs, /depends on which of Columbus/)
    expect(dep?.note).toMatch(/E\.20\.030\.E\.1/)
    expect(dep?.note).toMatch(/3312\.49 Table 2/)
    expect(dep?.note).toMatch(/1\.5 per unit/)
  })

  // ⚠️ THE LOAD-BEARING ONE. Which code governs is a joint dependency decided by
  // the layer's category field, which ParcelInfo does not carry. This row must
  // therefore never harden into 'required', and it must say why — including the
  // UCRPD/LUCRPD trap that makes the district string an unsafe substitute.
  it('never asserts a Columbus minimum as required, in any district or size', () => {
    for (const code of ['R3', 'R4', 'UCR', 'UCRPD', 'LUCRPD', 'C4', 'Unknown']) {
      for (const units of [0, 2, 40, 300]) {
        const dep = byLabel(col({ use: 'residential', units }, zone(code)), /depends on which of Columbus/)
        expect(dep?.status, `${code} @ ${units}`).toBe('likely')
      }
    }
    expect(byLabel(col({ use: 'residential', units: 40 }), /depends on which of Columbus/)?.note).toMatch(/UCRPD and LUCRPD/)
  })

  it('the Downtown District answers instead of deferring', () => {
    const hs = col({ use: 'residential', units: 40 }, zone('DD'))
    const dd = byLabel(hs, /Downtown District/)
    expect(dd?.status).toBe('info')
    expect(dd?.note).toMatch(/There are no requirements for off-street parking within the downtown district/)
    expect(dd?.note).toMatch(/3359\.27/)
    // …and the two-code row must not also fire, or the page says both.
    expect(byLabel(hs, /depends on which of Columbus/)).toBeUndefined()
  })

  it('states the Special Parking Areas, including the clause that closes the variance route', () => {
    const spa = byLabel(col({ use: 'residential', units: 40 }), /Special Parking Areas/)
    expect(spa?.status).toBe('info')
    expect(spa?.note).toMatch(/no further reduction or variance/)
    expect(spa?.note).toMatch(/is thereby excluded/)
  })

  // ── The Title 33 / Title 34 discriminator ─────────────────────────────────
  // MEASURED as a biconditional against GENERAL_ZONING_CATEGORY across all
  // 18,804 polygons (2026-08-08). It is an EXACT-SET test and must stay one:
  // UCRPD and LUCRPD are Title 33 research-park districts that a prefix match
  // would sweep into Title 34 and hand a "no minimum, Chapter 4310 instead"
  // answer they do not have.
  it('the Title 34 set is exact — UCRPD and LUCRPD are NOT Title 34', () => {
    for (const code of ['UGN-1', 'UGN-2', 'UCT', 'UCR', 'UCR-R', 'CAC', 'RAC']) {
      const hs = col({ use: 'residential', units: 40 }, zone(code))
      expect(byLabel(hs, /Parking Impact Study/), code).toBeTruthy()
      // Title 33-only rows must be absent on a Title 34 parcel.
      expect(byLabel(hs, /On-lot tree requirement/), code).toBeUndefined()
    }
    for (const code of ['UCRPD', 'LUCRPD', 'R3', 'C4', 'Unknown']) {
      const hs = col({ use: 'residential', units: 40 }, zone(code))
      expect(byLabel(hs, /Parking Impact Study/), code).toBeUndefined()
      expect(byLabel(hs, /On-lot tree requirement/), code).toBeTruthy()
    }
    // Case and whitespace are normalised, so a lower-cased feed still resolves.
    expect(byLabel(col({ use: 'residential', units: 40 }, zone(' ucr-r ')), /Parking Impact Study/)).toBeTruthy()
  })

  // ── Affordability: the absence, and the sentence it must not contain ──────
  it('the inclusionary absence is a rule Columbus has not adopted, not one Ohio forbids', () => {
    const a = byLabel(col({ use: 'residential', units: 40 }), /No inclusionary requirement/)
    expect(a?.status).toBe('info')
    expect(a?.note).toMatch(/4565\.01/)
    expect(a?.note).toMatch(/Participation in the Height Bonus Program is voluntary/)
    // Rule 8: say which check was run. Chapter 713 was read; the rest was not.
    expect(a?.note).toMatch(/Chapter 713/)
    expect(a?.note).toMatch(/the rest of the Revised Code was not searched/)
    // Nashville's sentence, which Columbus has not earned.
    expect(a?.note).not.toMatch(/Ohio law (prohibits|bars|forbids)|State law bars|prohibits any local government/i)
    // A commercial project has no affordability row at all.
    expect(byLabel(col({ use: 'commercial', units: 40 }), /No inclusionary requirement/)).toBeUndefined()
  })

  // ── Affordability: the CRA set-aside, conjunctive three ways ──────────────
  it('the CRA set-aside fires at 4 units, never as required, and names both unheld limbs', () => {
    expect(byLabel(col({ use: 'residential', units: 3 }), /CRA tax abatement/)).toBeUndefined()
    const c = byLabel(col({ use: 'residential', units: 4 }), /CRA tax abatement/)
    expect(c?.status).toBe('likely')
    expect(c?.sizeDependent).toBe(true)
    expect(c?.note).toMatch(/four \(4\) or more Housing Units within post-1994 CRAs/)
    // Limb (a): the chapter is opt-in. Limb (c): the CRA boundary/designation.
    expect(c?.note).toMatch(/opt-in/)
    expect(c?.note).toMatch(/not in this parcel record/)
    // The Market Ready terms must not be published as the citywide answer.
    expect(c?.note).toMatch(/4565\.08 and 4565\.09/)
    expect(c?.note).toMatch(/do not price the Market Ready figures as the citywide answer/)
    // The anti-gaming clause.
    expect(c?.note).toMatch(/shall not be artificially divided/)
    // Residential-only: a commercial project at the same count fires nothing.
    expect(byLabel(col({ use: 'commercial', units: 400 }), /CRA tax abatement/)).toBeUndefined()
  })

  // ── The process Title 34 substitutes for the minimum it abolished ─────────
  it('the Parking Impact Study quotes both applicability limbs and stays likely', () => {
    const p = byLabel(col({ use: 'residential', units: 40 }, zone('UCT')), /Parking Impact Study/)
    expect(p?.status).toBe('likely')
    expect(p?.note).toMatch(/4310\.02/)
    expect(p?.note).toMatch(/no minimum vehicular parking requirement/)
    // Limb (B) is a variance to the PARKING minimum, not any variance.
    expect(p?.note).toMatch(/request for variance to the minimum parking requirements/)
    expect(p?.note).toMatch(/not to zoning generally/)
    // The Director's determination is why this is not 'required'.
    expect(p?.note).toMatch(/The Director must determine when a Parking Impact Study is required/)
    // No rate is asserted — the figures are in the Director's rules.
    expect(p?.note).toMatch(/actual costs incurred by the City/)
    expect(p?.note).not.toMatch(/\$\d/)
  })

  // ── Parkland dedication: rezoning AND over one acre AND Title 33 ──────────
  it('parkland dedication needs all three limbs, and is not sizeDependent', () => {
    const big = { lot: { sizeSqFt: 100000, lotType: null } } // ~2.3 acres
    const small = { lot: { sizeSqFt: 40000, lotType: null } } // under an acre
    const j = { use: 'residential' as const, units: 60 }
    const fire = (p: Partial<ParcelInfo>, path: 'as_of_right' | 'variance') =>
      byLabel(
        assessHurdles('columbus', parcel({ ...zone('R3'), ...p }), project({ city: 'columbus', ...j }), { path }),
        /Parkland dedication/,
      )
    const h = fire({ ...zone('R3'), ...big }, 'variance')
    expect(h?.status).toBe('likely')
    expect(h?.sizeDependent).toBeFalsy() // lot area, not floor area
    expect(h?.note).toMatch(/rezoning of land in excess of one acre/)
    expect(h?.note).toMatch(/\$400\.00 per acre/)
    expect(h?.note).toMatch(/3304\.04\(B\)/)
    // Each limb removed in turn kills the row.
    expect(fire({ ...zone('R3'), ...big }, 'as_of_right')).toBeUndefined() // no rezoning
    expect(fire({ ...zone('R3'), ...small }, 'variance')).toBeUndefined() // under an acre
    expect(fire({ ...zone('UCT'), ...big }, 'variance')).toBeUndefined() // Title 34
  })

  // ── Area commission: advisory, but it can postpone you ────────────────────
  it('the area commission row carries BOTH sides and fires on a rezoning or a demolition', () => {
    const a = byLabel(
      assessHurdles('columbus', parcel(zone('R3')), project({ city: 'columbus', use: 'residential', units: 40 }), { path: 'variance' }),
      /Area commission review/,
    )
    expect(a?.status).toBe('likely')
    expect(a?.note).toMatch(/shall be advisory only/)
    expect(a?.note).toMatch(/may be grounds for postponement/)
    expect(a?.addsMonths).toBeUndefined()
    // The demolition-permit limb, on the as-of-right path.
    const t = byLabel(
      col({ projectType: 'new', use: 'residential', units: 40 }, { existing: { landUse: 'Single Family', numBuildings: 1 } }),
      /Area commission review/,
    )
    expect(t?.status).toBe('likely')
    // Neither limb: a by-right build on a vacant lot gets no row.
    expect(byLabel(col({ use: 'residential', units: 40 }), /Area commission review/)).toBeUndefined()
  })

  // ── Design review: gated on held data, and the miss direction is safe ─────
  it('the design-review districts are matched, and DD gets the envelope sentence', () => {
    for (const code of ['DD', 'EFD']) {
      const d = byLabel(col({ use: 'residential', units: 40 }, zone(code)), /Design review district/)
      expect(d?.status, code).toBe('required')
      expect(d?.note, code).toMatch(/Any activity requiring a certificate of zoning clearance/)
      expect(d?.note, code).toMatch(/exclusively interior to a building does not require/)
      expect(d?.addsMonths, code).toBeUndefined() // 30 days is an appeal window
    }
    // The DD chapter states no height and no FAR, so design review IS the envelope.
    expect(byLabel(col({ use: 'residential', units: 40 }, zone('DD')), /Design review district/)?.note).toMatch(/what actually decides how big the building is/)
    expect(byLabel(col({ use: 'residential', units: 40 }, zone('EFD')), /Design review district/)?.note).not.toMatch(/what actually decides how big the building is/)
    // The subdistrict label is the third route in (University Impact District).
    expect(
      byLabel(col({ use: 'residential', units: 40 }, zone('C4', { subdistrict: 'University Impact District Review Board' })), /Design review district/),
    ).toBeTruthy()
    expect(byLabel(col({ use: 'residential', units: 40 }, zone('R3')), /Design review district/)).toBeUndefined()
  })

  // ── Demolition: an OVERLAY power, never a citywide screen ─────────────────
  it('the demolition certificate fires only on a mapped condition, not on every teardown', () => {
    const ex = { existing: { landUse: 'Single Family', numBuildings: 1, yearBuilt: 1910 } }
    const j = { projectType: 'new' as const, use: 'residential' as const, units: 20 }
    // Plain old building on an ordinary parcel: NO certificate row. Columbus has
    // no citywide age or National-Register demolition trigger.
    expect(byLabel(col(j, { ...zone('R3'), ...ex }), /Certificate of appropriateness before a demolition permit/)).toBeUndefined()
    for (const p of [
      { ...zone('DD'), ...ex },
      { ...zone('EFD'), ...ex },
      { ...zone('R3'), ...ex, overlays: { historicDistrict: 'German Village Historic District', floodZone: null } },
    ]) {
      const d = byLabel(col(j, p), /Certificate of appropriateness before a demolition permit/)
      expect(d?.status, JSON.stringify(p.zoning?.districtCode)).toBe('required')
      expect(d?.note).toMatch(/4113\.79\(B\)/)
      expect(d?.note).toMatch(/definite plans for reuse of the site/)
      expect(d?.note).toMatch(/commence within 14 calendar days/)
      expect(d?.note).toMatch(/overlay power, not a citywide screen/)
      expect(d?.addsMonths).toBeUndefined()
    }
    // No teardown, no row — a vacant DD lot demolishes nothing.
    expect(byLabel(col(j, zone('DD')), /Certificate of appropriateness before a demolition permit/)).toBeUndefined()
  })

  // ── Pedestrian infrastructure: 50 is a RESIDENTIAL unit threshold ─────────
  it('off-site pedestrian infrastructure exceeds 50 units, and 50 is a dwelling-unit count', () => {
    expect(byLabel(col({ use: 'residential', units: 50 }), /Off-site pedestrian infrastructure/)).toBeUndefined()
    const h = byLabel(col({ use: 'residential', units: 51 }), /Off-site pedestrian infrastructure/)
    expect(h?.status).toBe('likely')
    expect(h?.sizeDependent).toBe(true)
    expect(h?.note).toMatch(/residential: 50 units/)
    expect(h?.note).toMatch(/20,000 square feet/) // the ungated retail limb, stated
    expect(h?.note).toMatch(/nearest transit stop for each cardinal direction/)
    // A commercial project carrying a unit count off the query string must not
    // fire the RESIDENTIAL limb — but its own 30,000 sq ft limb still can.
    expect(byLabel(col({ use: 'commercial', units: 400, gfa: 20000 }), /Off-site pedestrian infrastructure/)).toBeUndefined()
    expect(byLabel(col({ use: 'commercial', units: 0, gfa: 40000 }), /Off-site pedestrian infrastructure/)).toBeTruthy()
    // Mixed use is NOT measured on gfa — we hold no split — but its dwellings count.
    expect(byLabel(col({ use: 'mixed', units: 10, gfa: 400000 }), /Off-site pedestrian infrastructure/)).toBeUndefined()
    expect(byLabel(col({ use: 'mixed', units: 200, gfa: 400000 }), /Off-site pedestrian infrastructure/)).toBeTruthy()
    // Only new construction.
    expect(byLabel(col({ projectType: 'addition', use: 'residential', units: 200 }), /Off-site pedestrian infrastructure/)).toBeUndefined()
  })

  // ── Traffic: stated, never gated on a floor-area proxy ────────────────────
  it('the traffic study is info at every size, with both studies’ conditions named', () => {
    for (const gfa of [2000, 50000, 500000]) {
      const t = byLabel(col({ use: 'commercial', units: 0, gfa }), /Traffic impact or access study/)
      expect(t?.status, String(gfa)).toBe('info')
    }
    const t = byLabel(col({ use: 'residential', units: 40 }), /Traffic impact or access study/)
    expect(t?.note).toMatch(/200 or more estimated non-pass-by trip ends/)
    expect(t?.note).toMatch(/site modification criteria AND meets one or more of the following location criteria/)
    expect(t?.note).toMatch(/High Injury Network/)
    expect(t?.note).toMatch(/LOS D overall and LOS E per movement/)
  })

  // ── Trees: the limb is the LOT'S ZONING, which we do not resolve ──────────
  it('the tree row quotes the residentially-zoned-lot limb rather than gating a requirement on use', () => {
    const t = byLabel(col({ use: 'residential', units: 40 }), /On-lot tree requirement/)
    expect(t?.status).toBe('likely') // NOT 'required' — the gate is a proxy
    expect(t?.sizeDependent).toBeFalsy() // one tree from the first unit; no threshold
    expect(t?.note).toMatch(/On a residentially zoned lot/)
    expect(t?.note).toMatch(/the trigger is that the LOT is residentially zoned/)
    expect(t?.note).toMatch(/3304\.04\(D\)/)
    // Rule 5: it must not read as an established absence of a preservation rule.
    expect(t?.note).toMatch(/does not say Columbus has no tree-preservation ordinance/)
    expect(byLabel(col({ use: 'commercial', units: 0, gfa: 40000 }), /On-lot tree requirement/)).toBeUndefined()
  })

  // ── Flood: the determination is the CITY's, not FEMA's ────────────────────
  it('the floodplain row names Chapter 1150 and the Department of Public Utilities', () => {
    const f = byLabel(
      col({ use: 'residential', units: 40 }, { ...zone('R3'), overlays: { historicDistrict: null, floodZone: 'AE' } }),
      /City floodplain determination/,
    )
    expect(f?.status).toBe('likely')
    expect(f?.note).toMatch(/shall in no case grant any permit/)
    expect(f?.note).toMatch(/Chapter 1150/)
    expect(f?.note).toMatch(/not the FEMA zone/)
    // Rule 8: ch. 1150 itself was not read, and the row says so.
    expect(f?.note).toMatch(/the chapter itself was not/)
    expect(byLabel(col({ use: 'residential', units: 40 }), /City floodplain determination/)).toBeUndefined()
    expect(
      byLabel(col({ use: 'residential', units: 40 }, { ...zone('R3'), overlays: { historicDistrict: null, floodZone: 'X' } }), /City floodplain determination/),
    ).toBeUndefined()
  })

  // ── EV: applies at every size; the unheld limb is "do you build parking" ──
  it('the EV row is not size-triggered and states the 2028 table without quoting it', () => {
    for (const units of [1, 3, 4, 400]) {
      const e = byLabel(col({ use: 'residential', units }), /EV-ready and EV-charging parking/)
      expect(e?.status, String(units)).toBe('likely')
      expect(e?.sizeDependent, String(units)).toBeFalsy()
    }
    const e = byLabel(col({ use: 'residential', units: 40 }), /EV-ready and EV-charging parking/)
    expect(e?.note).toMatch(/One EV Ready outlet per dwelling unit/)
    expect(e?.note).toMatch(/EV Capable 20%/)
    expect(e?.note).toMatch(/if vehicular parking is provided/)
    expect(e?.note).toMatch(/permanent supportive housing/)
    // The 2028 table is named, and no figure from it is published.
    expect(e?.note).toMatch(/January 1, 2028/)
    expect(e?.note).toMatch(/3312\.58/)
    expect(byLabel(col({ projectType: 'addition', use: 'residential', units: 40 }), /EV-ready and EV-charging parking/)).toBeUndefined()
  })

  // ── The administrative-review absence, and its four exceptions ────────────
  it('site plan review reads as administrative and names every board that is an exception', () => {
    const s = byLabel(col({ use: 'residential', units: 40 }), /Site plan review is administrative/)
    expect(s?.status).toBe('info')
    expect(s?.note).toMatch(/4113\.29\(A\)/)
    expect(s?.note).toMatch(/size is not on that list|size alone never buys you a hearing/)
    for (const re of [/3116\.04/, /3359/, /3323/, /3325/]) expect(s?.note, String(re)).toMatch(re)
  })

  // ── Historic: the body is named, and Columbus publishes no clock ──────────
  it('names the Columbus review commission and falls through to the standing 3 months', () => {
    const h = col({ use: 'residential', units: 40 }, { overlays: { historicDistrict: 'German Village Historic District', floodZone: null } }).find(
      (x) => x.category === 'historic',
    )
    expect(h?.note).toMatch(/certificate of appropriateness/i)
    expect(h?.note).toMatch(/3116\.04/)
    expect(h?.note).toMatch(/shall issue no permit for the construction, reconstruction, alteration or demolition/)
    // No HISTORIC_MONTHS override: Columbus's code sets no clock on the commission.
    expect(h?.addsMonths).toBe(3)
  })

  // ── Rule 1 / the parent instruction, checked once across the whole branch ─
  it('no Columbus hurdle publishes a duration, and no row invents an Ohio prohibition', () => {
    const scenarios: Array<[Partial<AnalysisInput>, Partial<ParcelInfo>]> = [
      [{ use: 'residential', units: 200, gfa: 260000 }, { ...zone('UCT'), lot: { sizeSqFt: 100000, lotType: null } }],
      [{ use: 'commercial', units: 0, gfa: 120000 }, zone('DD')],
      [{ projectType: 'new', use: 'residential', units: 40 }, { ...zone('R3'), existing: { landUse: 'Apartment', units: 8, yearBuilt: 1912 } }],
      [{ use: 'mixed', units: 300, gfa: 400000 }, { ...zone('EFD'), overlays: { historicDistrict: null, floodZone: 'AE' } }],
    ]
    for (const [j, p] of scenarios) {
      for (const path of ['as_of_right', 'variance'] as const) {
        for (const h of assessHurdles('columbus', parcel(p), project({ city: 'columbus', ...j }), { path })) {
          // The only months in a Columbus report come from the module's shared
          // rows — the historic default, replacing housing, public funding.
          if (!/^(Historic district design review|Replacing existing housing|Public-funding process)/.test(h.label)) {
            expect(h.addsMonths, h.label).toBeUndefined()
          }
          expect(`${h.label} ${h.note}`, h.label).not.toMatch(/Ohio law (prohibits|bars|forbids)/i)
        }
      }
    }
  })
})

describe('assessHurdles — Charlotte', () => {
  const clt = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('charlotte', parcel({ ...zone('N2-B'), ...p }), project({ city: 'charlotte', ...over }))

  it('resolves a plausible project and maps the district to its tier', () => {
    const hs = clt({ use: 'residential', units: 60, gfa: 70000 })
    expect(hs.length).toBeGreaterThan(4)
    const t = byLabel(hs, /Tier 2 district/)
    expect(t?.status).toBe('required')
    expect(t?.note).toMatch(/19\.2\.A\.1\.b/)
  })

  it('reads Table 19-1’s tier header rows off the district code', () => {
    for (const code of ['ML-1', 'OFC', 'OG', 'MHP', 'N2-A']) {
      expect(byLabel(clt({ use: 'residential', units: 30 }, zone(code)), /Tier 1 district/), code).toBeTruthy()
    }
    for (const code of ['N2-C', 'IMU', 'CAC-1', 'CG', 'CR', 'NC']) {
      expect(byLabel(clt({ use: 'residential', units: 30 }, zone(code)), /Tier 2 district/), code).toBeTruthy()
    }
    for (const code of ['CAC-2', 'TOD-UC', 'TOD-TR', 'RAC', 'UC', 'UE']) {
      expect(byLabel(clt({ use: 'residential', units: 30 }, zone(code)), /Tier 3 district/), code).toBeTruthy()
    }
  })

  // Tier 3's minimum column is blank in 99 of 105 rows, and the six that are not
  // are conditional on a 400-foot WALKING distance we cannot measure. So the row
  // must be informational with the whole condition on its face — never a
  // required minimum resting on an unevaluable limb.
  it('Tier 3 states the 400-foot limb rather than gating on a proxy', () => {
    const t3 = byLabel(clt({ use: 'residential', units: 80 }, zone('TOD-CC')), /Tier 3 district/)
    expect(t3?.status).toBe('info')
    expect(t3?.note).toMatch(/400' walking distance of a Neighborhood 1 Place Type/)
    expect(t3?.note).toMatch(/99 of the 105/)
    expect(t3?.note).toMatch(/Multi-Family Stacked/)
  })

  // The tier header names "Neighborhood 1 Zoning Districts" as a class without
  // enumerating it. Enumerating it ourselves would be assembling a legal claim
  // from two sources; the deliberate result is no row at all.
  it('an unenumerated Neighborhood 1 district gets no tier row, not a guessed one', () => {
    for (const code of ['N1-A', 'N1-C', 'N1-F', 'R-4', 'Unknown']) {
      const hs = clt({ use: 'residential', units: 30 }, zone(code))
      expect(byLabel(hs, /Tier [123] district/), code).toBeUndefined()
      // The citywide rule still renders, so the user is not left with nothing.
      expect(hs.some((h) => h.category === 'parking'), code).toBe(true)
    }
  })

  // ZoneDes is a compound string; the tier must survive its markers.
  it('resolves the tier through conditional/overlay markers on ZoneDes', () => {
    for (const zd of ['CAC-2(CD)', 'UC (CD)', 'TOD-NC(EX) HDO']) {
      expect(byLabel(clt({ use: 'residential', units: 30 }, zone(zd)), /Tier 3 district/), zd).toBeTruthy()
    }
  })

  it('states both relief routes, and that the transit election is all-or-nothing', () => {
    const r = byLabel(clt({ use: 'residential', units: 30 }), /Two routes out of the tier minimums/)
    expect(r?.status).toBe('info')
    expect(r?.note).toMatch(/one-half mile walking distance of an existing rapid transit station/)
    expect(r?.note).toMatch(/shall be used in their entirety/)
    expect(r?.note).toMatch(/Parking Demand Management Assessment/)
  })

  // Rule 15/17, and the interpretation this test used to encode has been
  // OVERTURNED. It previously asserted that no Charlotte hurdle may mention a
  // Session Law at all, because at the time the reported North Carolina
  // preemption had no citation in this repo. It now does: the enacted vehicle is
  // Session Law 2026-39 (House Bill 162), ratified 1 July 2026 and approved
  // 6 July 2026, read at ncleg.gov 2026-08-08 from the Session Laws index. The
  // bill everyone cites — House Bill 369, the "Parking Lot Reform and
  // Modernization Act" — NEVER PASSED: ncleg's own bill page shows its last
  // action as "Re-ref Com On Rules and Operations of the Senate on 6/10/2026".
  // So the protection is narrowed to what it was always for: cite the enacted
  // vehicle or say nothing, and never cite the bill that failed.
  it('cites the enacted session law, never the bill that failed', () => {
    const hs = clt({ use: 'residential', units: 60, gfa: 70000 }, { existing: { landUse: 'Warehouse', yearBuilt: 1968, buildingAreaSqFt: 9000 } })
    for (const h of hs) {
      const text = `${h.label} ${h.note}`
      expect(text, h.label).not.toMatch(/HB ?369|House Bill 369|Parking Lot Reform and Modernization/i)
      // Any preemption or session-law claim must name the enacted vehicle.
      if (/preempt|Session Law/i.test(text)) expect(text, h.label).toMatch(/Session Law 2026-39 \(House Bill 162\)/)
    }
  })
})

describe('assessHurdles — Charlotte (non-parking hurdles)', () => {
  const ACRE = 43560
  const clt2 = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('charlotte', parcel({ ...zone('N2-B'), ...p }), project({ city: 'charlotte', ...over }))
  const teardown = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    clt2({ projectType: 'new', use: 'residential', units: 40, gfa: 52000, ...over }, { existing: { landUse: 'Single Family', yearBuilt: 1948, units: 1 }, ...p })

  it('resolves a plausible project, headed by the two absences', () => {
    const hs = clt2({ use: 'residential', units: 60, gfa: 70000 })
    expect(hs.length).toBeGreaterThan(10)
    // ABSENCE 1 — no inclusionary mandate, framed as a rule Charlotte has not
    // adopted, NOT as one the State forbids. Same statute as Raleigh, same care.
    const aff = byLabel(hs, /No inclusionary requirement/)
    expect(aff?.status).toBe('info')
    expect(aff?.note).toMatch(/42-14\.1/)
    expect(aff?.note).toMatch(/has not prohibited it by name/)
    expect(aff?.note).not.toMatch(/state law bars|barred by state law|prohibits mandatory inclusionary/i)
    // ABSENCE 2 — no design board and no site-plan hearing, established by the
    // Article 35 slot test.
    const rev = byLabel(hs, /Plan review is administrative/)
    expect(rev?.status).toBe('info')
    expect(rev?.note).toMatch(/Sec\. 37\.9/)
    expect(rev?.note).toMatch(/Alternative Compliance Review Board/)
    expect(rev?.note).toMatch(/no jurisdiction with respect to alternative compliance/)
  })

  it('names the two-agency handoff to Mecklenburg County', () => {
    const h = byLabel(clt2({ use: 'residential', units: 12 }), /Building permits come from Mecklenburg County/)
    expect(h?.status).toBe('info')
    expect(h?.note).toMatch(/14\.2\.S\.1/)
    expect(h?.note).toMatch(/shall not issue a Certificate of Occupancy or Certificate of Compliance/)
  })

  // The fee scales with METER SIZE, so it is neither unit- nor floor-area-keyed
  // and must not be tagged sizeDependent. And it must not assert a stable rate:
  // Council resets the schedule annually and the ordinance contains no amount.
  it('the system development fee is new-construction-gated, meter-keyed, and dated', () => {
    const f = byLabel(clt2({ projectType: 'new', use: 'residential', units: 12 }), /Water and sewer system development fees/)
    expect(f?.status).toBe('required')
    expect(f?.sizeDependent).toBeFalsy()
    expect(f?.note).toMatch(/162A-213\(a\)/)
    expect(f?.note).toMatch(/proof of collection of the system development fee prior to issuance of the building permit/)
    expect(f?.note).toMatch(/METER SIZE/)
    // Every dollar figure carries the date it was read and the instruction to
    // re-read — a bare rate here would be a fabrication wearing a citation.
    expect(f?.note).toMatch(/2026-08-08/)
    expect(f?.note).toMatch(/Get the current schedule/)
    // The impact-fee absence is a GAP, and must never render as an answer.
    expect(f?.note).toMatch(/gap in what has been read/)
    expect(f?.note).not.toMatch(/Charlotte charges no impact fees/)
    // It is a new-connection gate; a change of use makes none.
    expect(byLabel(clt2({ projectType: 'change_of_use', gfa: 30000 }), /Water and sewer system development fees/)).toBeFalsy()
  })

  // Sec. 32.1.B puts the CTR thresholds in the Streets Manual, not the UDO.
  // Stating a unit or square-foot figure here would be inventing one.
  it('the CTR states no threshold, because the ordinance states none', () => {
    const c = byLabel(clt2({ use: 'residential', units: 300, gfa: 400000 }), /Comprehensive Transportation Review/)
    expect(c?.status).toBe('likely')
    expect(c?.sizeDependent).toBeFalsy()
    expect(c?.note).toMatch(/Charlotte Streets Manual/)
    expect(c?.note).toMatch(/Multimodal Assessments, Transportation Demand Management \(TDM\), and Traffic Impact Studies \(TIS\)/)
    // No number may be asserted for the trigger.
    expect(c?.note).not.toMatch(/\d[\d,]*\s*(dwelling units|square feet) or more/)
  })

  // CONJUNCTIVE, and the row most likely to be got wrong. Neither limb of Sec.
  // 32.4.C.1.a is in the parcel record, so the new-stop duty may never harden
  // into a gate on a proxy — both limbs must appear on the row's face.
  it('the bus-stop row quotes both limbs and never gates on one', () => {
    const b = byLabel(clt2({ use: 'residential', units: 300, gfa: 400000 }), /Bus stop and amenities/)
    expect(b?.status).toBe('info')
    expect(b?.sizeDependent).toBeFalsy()
    expect(b?.note).toMatch(/meets all the following/)
    expect(b?.note).toMatch(/MTC adopted Transit Service Plan/)
    expect(b?.note).toMatch(/minimum number of daily trips/)
    // The retention limb IS resolvable on project type, and its double negative
    // is the part a reader loses.
    expect(b?.note).toMatch(/unless part of a multi-dwelling development/)
    expect(b?.note).toMatch(/CATS Director/)
    // Status must not change with size — the trip limb is not ours to evaluate.
    expect(byLabel(clt2({ use: 'residential', units: 2, gfa: 3000 }), /Bus stop and amenities/)?.status).toBe('info')
  })

  it('new streets fire on project type, and the 125-unit collector limb stays quoted, not gated', () => {
    const s = byLabel(clt2({ use: 'residential', units: 4, gfa: 6000 }), /New streets, dedications/)
    expect(s?.status).toBe('likely')
    expect(s?.sizeDependent).toBeFalsy()
    expect(s?.note).toMatch(/New streets are required when either of the following occur/)
    // Quoted inside, because the collector limb ALSO requires an arterial
    // intersection — using 125 units as the gate would be broader than Sec.
    // 32.5.E.2.a, which is conjunctive at the top.
    expect(s?.note).toMatch(/More than 125 dwelling units/)
    expect(s?.note).toMatch(/directly intersects with an arterial/)
    expect(s?.note).toMatch(/reserved for 18 months/)
    expect(byLabel(clt2({ projectType: 'addition', gfa: 40000 }), /New streets, dedications/)).toBeFalsy()
  })

  // The status splits at four units because a project over four cannot be inside
  // the Sec. 20.15.A.3.b exemption at all; at or below four the exemption turns
  // on lot configuration we do not hold, so the row stays 'likely' and says why.
  it('green area hardens above four units and stays conditional at or below', () => {
    const small = byLabel(clt2({ use: 'residential', units: 4, gfa: 6000 }), /Green area: 15% of the site/)
    expect(small?.status).toBe('likely')
    expect(small?.sizeDependent).toBe(true)
    expect(small?.note).toMatch(/three or more contiguous\/adjacent lots/)
    expect(small?.note).toMatch(/Part of a multi-dwelling development/)

    const big = byLabel(clt2({ use: 'residential', units: 5, gfa: 8000 }), /Green area: 15% of the site/)
    expect(big?.status).toBe('required')
    expect(big?.note).toMatch(/cannot reach this project/)
    expect(big?.note).toMatch(/15% or more of a development site/)
    // Non-residential cannot be inside a single-family/duplex/triplex/quadraplex
    // exemption whatever its unit count says.
    expect(byLabel(clt2({ use: 'commercial', units: 0, gfa: 60000 }), /Green area: 15% of the site/)?.status).toBe('required')
    // The park dedication is an alternative means of compliance, folded in here
    // rather than given a row of its own — it is not an exaction.
    expect(big?.note).toMatch(/Mecklenburg County Park and Recreation/)
    // Tree compliance plan travels with it.
    expect(big?.note).toMatch(/tree compliance plan/)
  })

  // The asymmetry between Sec. 20.14 and Sec. 20.15 is real: the heritage-tree
  // section has NO small-residential exemption. A single new house is inside it.
  it('heritage trees reach a one-house project, unlike green area', () => {
    const h = byLabel(clt2({ use: 'residential', units: 1, gfa: 2200 }), /Heritage trees/)
    expect(h?.status).toBe('required')
    expect(h?.sizeDependent).toBeFalsy()
    expect(h?.note).toMatch(/DBH of 30 inches or greater/)
    expect(h?.note).toMatch(/NO small-residential exemption/)
    // The fee is set by Council and is not in the ordinance — assert no amount.
    expect(h?.note).toMatch(/per the fee established by City Council/)
    expect(h?.note).not.toMatch(/\$[\d,]/)
  })

  // A conjunctive EXEMPTION inverts to a disjunctive REQUIREMENT. Neither limb
  // is in our data, and lot area bounds neither — so the row may never gate on
  // lot size, and its status must not move with it.
  it('the stormwater row states the inverted exemption and never gates on lot area', () => {
    const at = (sqFt: number) => byLabel(clt2({ use: 'residential', units: 40 }, { lot: { sizeSqFt: sqFt, lotType: null } }), /Stormwater management permit/)
    expect(at(2000)?.status).toBe('likely')
    expect(at(20 * ACRE)?.status).toBe('likely')
    expect(at(2000)?.note).toMatch(/cumulatively disturbs less than one acre and cumulatively creates less than 5,000 square feet/)
    expect(at(2000)?.note).toMatch(/EITHER an acre is disturbed OR 5,000 sq ft/)
    // All three density breaks, not one — they differ threefold across the city.
    expect(at(2000)?.note).toMatch(/24% BUA/)
    expect(at(2000)?.note).toMatch(/12% built-upon area/)
    expect(at(2000)?.note).toMatch(/10% BUA/)
    expect(at(2000)?.sizeDependent).toBeFalsy()
  })

  // One acre, measured in DISTURBED area. Lot area is an explicit proxy and the
  // note has to say so, or a reader corrects in the wrong direction (rule 7).
  it('the erosion plan keys on an acre and labels lot area as a proxy', () => {
    const at = (sqFt: number) => byLabel(clt2({}, { lot: { sizeSqFt: sqFt, lotType: null } }), /Erosion and sedimentation control plan/)
    expect(at(ACRE)).toBeFalsy()
    const e = at(ACRE + 1)
    expect(e?.status).toBe('likely')
    expect(e?.sizeDependent).toBeFalsy()
    expect(e?.note).toMatch(/DISTURBED, not in lot area and not in floor area/)
    expect(e?.note).toMatch(/NCG01/)
    // Sec. 28.4's 30 days is a decision clock on the reviewer, never a schedule.
    expect(e?.addsMonths).toBeUndefined()
  })

  // Relief, not an obligation — and it can only help a site that already carries
  // built-upon area, so it is teardown-gated.
  it('the redevelopment stormwater credit fires only on a teardown, and cites the enacted law', () => {
    expect(byLabel(clt2({ projectType: 'new', use: 'residential', units: 40 }), /credits your existing pavement/)).toBeFalsy()
    const c = byLabel(teardown(), /credits your existing pavement/)
    expect(c?.status).toBe('info')
    expect(c?.note).toMatch(/Session Law 2026-39 \(House Bill 162\)/)
    expect(c?.note).toMatch(/square-foot-for-square-foot basis/)
    expect(c?.note).toMatch(/within 12 months of the effective date/)
    // Charlotte's own UDO defers to the statute by name — that is why it bites.
    expect(c?.note).toMatch(/143-214\.7/)
    expect(c?.addsMonths).toBeUndefined()
  })

  // Rule 5, and the reason this row is deliberately NOT gated on the FEMA zone:
  // a FEMA-clear parcel can still sit in the community floodplain, and the
  // generic `FEMA flood zone X` row would otherwise imply FEMA is the answer.
  it('the community-floodplain gap renders even when FEMA shows nothing', () => {
    const clear = byLabel(clt2({ use: 'residential', units: 40 }), /COMMUNITY floodplain wider than FEMA/)
    expect(clear?.status).toBe('info')
    expect(clear?.note).toMatch(/community base flood elevation plus two feet of freeboard/)
    expect(clear?.note).toMatch(/separate layer we do not fetch/)
    expect(clear?.note).toMatch(/SWIM/)
    // …and it still renders alongside a FEMA hit rather than being replaced.
    const inZone = clt2({ use: 'residential', units: 40 }, { overlays: { historicDistrict: null, floodZone: 'AE' } })
    expect(byLabel(inZone, /^FEMA flood zone AE$/)).toBeTruthy()
    expect(byLabel(inZone, /COMMUNITY floodplain wider than FEMA/)).toBeTruthy()
  })

  // THE INDENTATION TRAP. Table 19-2 keys on SPACES PROVIDED, and the
  // unit-count substitution at Sec. 19.3.A.2.b.i sits under item 2 — the
  // residential component of MIXED-USE developments — only. So this row may
  // never be unit-gated and may never be tagged sizeDependent.
  it('EV charging keys on provided spaces, not on units', () => {
    const small = byLabel(clt2({ use: 'residential', units: 2, gfa: 3000 }), /EV charging stations/)
    const large = byLabel(clt2({ use: 'residential', units: 400, gfa: 500000 }), /EV charging stations/)
    for (const h of [small, large]) {
      expect(h?.status).toBe('likely')
      expect(h?.sizeDependent).toBeFalsy()
      expect(h?.note).toMatch(/Total Number of Provided Off-Street Parking Spaces/)
    }
    // The substitution reaches mixed-use and nothing else.
    expect(large?.note).toMatch(/does not reach a stand-alone multi-family stacked building/)
    const mixed = byLabel(clt2({ use: 'mixed', units: 200, gfa: 260000 }), /EV charging stations/)
    expect(mixed?.note).toMatch(/the number of residential units shall be considered as the number of provided off-street parking spaces/)
    // Not a residential project, not this row.
    expect(byLabel(clt2({ use: 'commercial', units: 0, gfa: 80000 }), /EV charging stations/)).toBeFalsy()
    expect(byLabel(clt2({ projectType: 'change_of_use', use: 'residential', units: 40 }), /EV charging stations/)).toBeFalsy()
  })

  // The demolition delay is an OVERLAY power. Asserting it citywide would be the
  // over-broad gate this file has had to unwind before.
  it('the 365-day demolition delay needs the mapped overlay; the pending-designation freeze does not', () => {
    expect(byLabel(teardown(), /up to 365 days/)).toBeFalsy()
    const inHd = byLabel(teardown({}, { overlays: { historicDistrict: 'Fourth Ward — Local historic district', floodZone: null } }), /up to 365 days/)
    expect(inHd?.status).toBe('required')
    expect(inHd?.note).toMatch(/may not be denied/)
    expect(inHd?.note).toMatch(/valid for 12 months/)
    // 365 days is a CEILING on a delay that may be waived entirely.
    expect(inHd?.addsMonths).toBeUndefined()
    // The pending-designation freeze is deliberately ungated by overlay — the
    // situation it describes is the one where no overlay exists yet.
    const pending = byLabel(teardown(), /pending historic designation freezes demolition/)
    expect(pending?.status).toBe('info')
    expect(pending?.note).toMatch(/up to 180 days/)
    expect(pending?.note).toMatch(/deliberate neglect/)
    // Neither fires without a teardown.
    expect(byLabel(clt2({ projectType: 'new', use: 'residential', units: 40 }), /pending historic designation/)).toBeFalsy()
  })

  it('the Certificate of Appropriateness copy is Charlotte’s, not the generic fallback', () => {
    const h = byLabel(
      clt2({ use: 'residential', units: 20 }, { overlays: { historicDistrict: 'Dilworth — Local historic district', floodZone: null } }),
      /Historic district design review/,
    )
    expect(h?.note).toMatch(/Historic District Commission/)
    expect(h?.note).toMatch(/whether or not a building permit is required/)
    expect(h?.note).toMatch(/Mecklenburg County Land Use and Environmental Services Agency/)
    // Sec. 14.2.L.6.a.i's 180 days is a CEILING on the Commission, so it must
    // not have become the published duration — the module default stands.
    expect(h?.addsMonths).toBe(3)
  })

  it('the rezoning row is discretionary-only and publishes no duration', () => {
    const aor = clt2({ use: 'residential', units: 80, gfa: 100000 })
    expect(byLabel(aor, /Conditional rezoning/)).toBeFalsy()
    const disc = assessHurdles('charlotte', parcel(zone('N2-B')), project({ city: 'charlotte', use: 'residential', units: 80, gfa: 100000 }), { path: 'variance' })
    const rz = byLabel(disc, /Conditional rezoning/)
    expect(rz?.status).toBe('likely')
    expect(rz?.note).toMatch(/another community meeting shall be held/)
    expect(rz?.note).toMatch(/shall be considered to have made a favorable recommendation/)
    // The EX district cannot buy height — the trap a reader reaches for first.
    expect(rz?.note).toMatch(/No modifications shall be made to maximum height regulations/)
    expect(rz?.addsMonths).toBeUndefined()
  })

  // The whole-file property, restated for the rows added here: exactly one row
  // is size-triggered, and it is the one whose STATUS turns on a unit count.
  it('exactly one Charlotte row is sizeDependent, and it is the green-area row', () => {
    const hs = assessHurdles(
      'charlotte',
      parcel({ ...zone('N2-B'), lot: { sizeSqFt: 5 * ACRE, lotType: null }, overlays: { historicDistrict: 'Fourth Ward — Local historic district', floodZone: 'AE' }, existing: { landUse: 'Single Family', yearBuilt: 1948, units: 1 } }),
      project({ city: 'charlotte', use: 'mixed', units: 200, gfa: 260000 }),
      { path: 'variance' },
    )
    const tagged = hs.filter((h) => h.sizeDependent)
    expect(tagged.map((h) => h.label)).toEqual(['Green area: 15% of the site, plus a tree compliance plan'])
  })

  // Charlotte's gfaBasis is 'assumed-unconstrained' — the UDO imposes no FAR
  // anywhere (zoning/charlotte.ts FACT 1) — so the green-area row is never
  // softened in practice. The tag is still correct, and this pins the behaviour
  // under the placeholder basis so a future basis change cannot pass silently.
  it('a placeholder GFA softens the green-area row, an unconstrained one does not', () => {
    const un = byLabel(
      assessHurdles('charlotte', parcel(zone('N2-B')), project({ city: 'charlotte', use: 'residential', units: 60, gfa: 78000, gfaBasis: 'assumed-unconstrained' })),
      /Green area: 15% of the site/,
    )
    expect(un?.status).toBe('required')
    expect(un?.note).not.toMatch(/placeholder size/)

    const soft = byLabel(
      assessHurdles('charlotte', parcel(zone('N2-B')), project({ city: 'charlotte', use: 'residential', units: 60, gfa: 78000, gfaBasis: 'assumed-far-1.0' })),
      /Green area: 15% of the site/,
    )
    expect(soft?.status).toBe('info')
    expect(soft?.note).toMatch(/placeholder size/)
  })

  // No row here may publish a duration. Charlotte states exactly three numbers
  // and all three are the wrong kind — a 180-day ceiling, a 30-day decision shot
  // clock, and a 30-day deemed-favourable deadline on a board.
  it('no Charlotte-specific row carries addsMonths', () => {
    const shared = /^(Historic district design review|Replacing existing housing|Public-funding process|Coastal Development Permit)/
    const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
      { p: {}, j: { use: 'residential', units: 200, gfa: 260000 } },
      { p: { lot: { sizeSqFt: 10 * ACRE, lotType: null } }, j: { use: 'commercial', units: 0, gfa: 120000, funding: 'public' } },
      { p: { existing: { landUse: 'Apartment', units: 12, yearBuilt: 1930 } }, j: { projectType: 'new', use: 'mixed', units: 4 } },
      { p: { overlays: { historicDistrict: 'Fourth Ward — Local historic district', floodZone: 'AE' } }, j: { projectType: 'new', use: 'residential', units: 12 } },
    ]
    for (const s of scenarios) {
      for (const path of ['as_of_right', 'variance'] as const) {
        for (const h of assessHurdles('charlotte', parcel({ ...zone('N2-B'), ...s.p }), project({ city: 'charlotte', ...s.j }), { path })) {
          if (shared.test(h.label)) continue
          expect(h.addsMonths, `charlotte / ${h.label}`).toBeUndefined()
        }
      }
    }
  })
})

describe('assessHurdles — Atlanta', () => {
  const atl = (over: Partial<AnalysisInput> = {}, p: Partial<ParcelInfo> = {}) =>
    assessHurdles('atlanta', parcel({ ...zone('MRC-2'), ...p }), project({ city: 'atlanta', ...over }))

  it('resolves a plausible project and quotes the whole transit condition', () => {
    const hs = atl({ use: 'residential', units: 60, gfa: 70000 })
    expect(hs.length).toBeGreaterThanOrEqual(4)
    const t = byLabel(hs, /^No parking required within 2,640 feet/)
    expect(t?.status).toBe('info')
    expect(t?.note).toMatch(/16-28\.014\(14\)/)
    // Every limb of the condition, not just the distance.
    expect(t?.note).toMatch(/Buckhead Parking Overlay/)
    expect(t?.note).toMatch(/operational or under construction/)
    expect(t?.note).toMatch(/exclusive right-of-way for at least 75 percent/)
    // …and the exchange: the section imposes maxima where it removes minima.
    expect(t?.note).toMatch(/1\.25 spaces per one-bedroom/)
    // The three excepted areas must NOT read as re-imposing minimums.
    expect(t?.note).toMatch(/do not put minimums back/)
  })

  // The exemption attaches to the BUILDING. Reporting only its first half would
  // hand a developer an exemption the code withdraws the moment they demolish.
  it('the pre-1965 exemption flips to a forfeiture warning on a teardown', () => {
    const old = { existing: { landUse: 'Apartment', units: 6, yearBuilt: 1928 } }
    const keep = byLabel(atl({ projectType: 'addition', use: 'residential', units: 8 }, old), /Pre-1965 building/)
    expect(keep?.status).toBe('info')
    expect(keep?.note).toMatch(/Residential uses: No parking is required/)
    expect(keep?.note).toMatch(/1,200 square feet/)

    const teardown = byLabel(atl({ projectType: 'new', use: 'residential', units: 40 }, old), /forfeits its parking exemption/)
    expect(teardown?.status).toBe('info')
    expect(teardown?.note).toMatch(/attaches to the BUILDING/)
  })

  it('does not claim the pre-1965 exemption for a newer or undated building', () => {
    for (const ex of [{ landUse: 'Apartment', units: 6, yearBuilt: 1992 }, { landUse: 'Apartment', units: 6 }]) {
      const hs = atl({ projectType: 'addition', use: 'residential', units: 8 }, { existing: ex })
      expect(byLabel(hs, /Pre-1965|forfeits its parking exemption/), JSON.stringify(ex)).toBeUndefined()
    }
  })

  it('reads the BeltLine Overlay off the parcel’s overlay label, with its three excepted uses', () => {
    // Anchored: the citywide rule's own headline also contains "BeltLine
    // Overlay", so an unanchored match finds PARKING_RULES rather than the
    // parcel row and the test would pass without the branch existing at all.
    const b = byLabel(atl({ use: 'residential', units: 60 }, zone('MRC-2', { subdistrict: 'Beltline' })), /^BeltLine Overlay: no minimum/)
    expect(b?.status).toBe('info')
    expect(b?.note).toMatch(/there will be no minimum parking requirement/)
    expect(b?.note).toMatch(/Delivery-based commercial kitchens/)
    // The label is suppressed when a historic district is also mapped, so the
    // row's ABSENCE must be disclosed as a false negative rather than read as
    // evidence the overlay is absent (rule 5).
    expect(b?.note).toMatch(/absence is not evidence/)
    expect(byLabel(atl({ use: 'residential', units: 60 }), /^BeltLine Overlay: no minimum/)).toBeUndefined()
  })
})

// The two properties that must hold for all four, checked together so a new row
// in any branch is caught by one test rather than four.
describe('Milwaukee / Columbus / Charlotte / Atlanta — no invented durations', () => {
  // Almost nothing the four cities' research states carries a duration: a
  // parking minimum is a cost and an envelope constraint, not a review that
  // takes months. So every addsMonths in these branches must trace to a figure
  // enumerated HERE, and any number that doesn't is a fabrication.
  //
  // The one exception, and it is a published figure rather than an estimate:
  // Atlanta overrides the shared historic-review default via HISTORIC_MONTHS.
  // Type III applications — which is what ground-up new construction is —
  // have hearings that "shall be held within 90 days from the date on which
  // the director receives in due form a complete application", and the
  // commission "shall make a decision on said applications within 21 days of
  // the date of the final public hearing" (Atlanta Code § 16-20.008(c)(3)).
  // 111 days. Keyed on CITY, not on label alone: three cities already override
  // this row, so a label-only helper silently accepts whatever any of them
  // emits — which is exactly how the 3-vs-4 mismatch got here.
  function expectedMonths(city: string, label: string): number | undefined {
    if (/^Historic district design review$/.test(label)) return city === 'atlanta' ? 4 : 3
    if (/^Replacing existing housing$/.test(label)) return 6
    if (/^Public-funding process/.test(label)) return 4
    if (/^Coastal Development Permit$/.test(label)) return 9
    return undefined
  }

  const cities = ['milwaukee', 'columbus', 'charlotte', 'atlanta'] as const
  const scenarios: Array<{ p: Partial<ParcelInfo>; j: Partial<AnalysisInput> }> = [
    { p: zone('RM6'), j: { use: 'residential', units: 40, gfa: 60000 } },
    { p: zone('C9A(A)'), j: { use: 'mixed', units: 200, gfa: 250000, funding: 'public' } },
    { p: zone('DD'), j: { use: 'commercial', units: 0, gfa: 120000 } },
    { p: zone('TOD-CC'), j: { use: 'residential', units: 1, gfa: 1800 } },
    { p: { ...zone('MRC-2', { subdistrict: 'Beltline' }), existing: { landUse: 'Apartment', units: 12, yearBuilt: 1928 } }, j: { projectType: 'new', use: 'residential', units: 40 } },
    { p: { ...zone('N2-B'), overlays: { historicDistrict: 'A Local Historic District', floodZone: 'AE' } }, j: { projectType: 'addition', use: 'residential', units: 12 } },
    { p: zone('RED'), j: { projectType: 'adu', use: 'residential', units: 1, gfa: 700 } },
  ]

  it('every addsMonths traces to a published duration', () => {
    for (const city of cities) {
      for (const s of scenarios) {
        for (const path of ['as_of_right', 'variance'] as const) {
          const hs = assessHurdles(city, parcel(s.p), project({ city, ...s.j }), { path })
          for (const h of hs) {
            expect(h.addsMonths, `${city} / ${h.label}`).toBe(expectedMonths(city, h.label))
          }
        }
      }
    }
  })

  // The tag exists to soften a claim that rests on a placeholder FLOOR AREA.
  // Milwaukee's and Columbus's minimums key on the unit count, which is derived
  // from floor area when no FAR resolves — so both are tagged. Charlotte's and
  // Atlanta's key on the district, the existing building's age and an overlay,
  // none of which is a size, so none of theirs may be.
  it('every size-triggered row carries sizeDependent, and no other one does', () => {
    const tagged = [
      { city: 'milwaukee', p: zone('RM6'), re: /Off-street parking minimum/ },
      { city: 'columbus', p: zone('R3'), re: /depends on which of Columbus/ },
    ] as const
    for (const t of tagged) {
      const h = byLabel(assessHurdles(t.city, parcel(t.p), project({ city: t.city, use: 'residential', units: 40, gfa: 60000 })), t.re)
      expect(h, `${t.city} expected a row matching ${t.re}`).toBeTruthy()
      expect(h?.sizeDependent, `${t.city} / ${h?.label}`).toBe(true)
    }

    const untaggedRe =
      // "BeltLine Overlay" is anchored because the citywide rule's headline
      // contains it too — an unanchored alternative would inflate `seen` with
      // PARKING_RULES rows and let the branch's own rows go unchecked.
      /No off-street parking required in this district|25% parking reduction|Downtown District|Special Parking Areas|Tier [123] district|Two routes out of the tier minimums|2,640 feet of high-capacity transit|Pre-1965 building|forfeits its parking exemption|BeltLine Overlay: no minimum/
    let seen = 0
    for (const city of cities) {
      for (const s of scenarios) {
        for (const h of assessHurdles(city, parcel(s.p), project({ city, ...s.j }))) {
          if (!untaggedRe.test(h.label)) continue
          seen++
          expect(h.sizeDependent, `${city} / ${h.label}`).toBeFalsy()
        }
      }
    }
    expect(seen, 'expected the untagged parking rows to actually fire').toBeGreaterThan(10)
  })

  // A placeholder GFA must not leave a hard parking requirement standing: the
  // unit count it produces is `lot × 1.0 ÷ 1300`, and Milwaukee's minimum is a
  // legal claim keyed on that count.
  it('a placeholder GFA downgrades Milwaukee’s unit-keyed minimum', () => {
    const soft = assessHurdles(
      'milwaukee',
      parcel(zone('RM6')),
      project({ city: 'milwaukee', use: 'residential', units: 40, gfa: 60000, gfaBasis: 'assumed-far-1.0' }),
    )
    const min = byLabel(soft, /Off-street parking minimum/)
    expect(min?.status).toBe('info')
    expect(min?.note).toMatch(/placeholder size/)
    // The district-keyed rows are untouched — the district was measured.
    const dt = byLabel(
      assessHurdles('milwaukee', parcel(zone('C9C')), project({ city: 'milwaukee', use: 'residential', units: 40, gfa: 60000, gfaBasis: 'assumed-far-1.0' })),
      /No off-street parking required/,
    )
    expect(dt?.status).toBe('info')
    expect(dt?.note).not.toMatch(/placeholder size/)
  })

  it('every one of the four emits the citywide parking rule alongside the parcel rows', () => {
    for (const city of cities) {
      const hs = assessHurdles(city, parcel(zone('RM6')), project({ city, use: 'residential', units: 40, gfa: 60000 }))
      // The generic "not yet checked" fallback must be gone for all four.
      expect(hs.some((h) => /not yet checked/.test(h.label)), city).toBe(false)
      expect(hs.filter((h) => h.category === 'parking').length, city).toBeGreaterThan(0)
    }
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
