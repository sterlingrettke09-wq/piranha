import { describe, it, expect } from 'vitest'
import {
  PHOENIX_DISTRICT_CODES,
  normalizePhoenixZone,
  resolvePhoenix,
  usesForZone,
  type PhoenixLimits,
} from './phoenix'

// The 75 distinct ZONING values the live layer served on 2026-08-09, with the
// acreage each covers. Captured by paging the whole layer (9,649 polygons,
// 359,403 acres) and summing its own ACRES column — a snapshot of the city's
// mapped vocabulary, kept here so a coverage claim is checked against what the
// service actually publishes rather than against this module's own key list.
const LIVE_VOCABULARY: ReadonlyArray<readonly [string, number]> = [
  ['S-1', 66895.0], ['R1-6', 58269.0], ['RE-35', 40115.4], ['R1-10', 23979.3], ['A-1', 22113.4],
  ['R1-8', 20484.3], ['PUD', 17507.4], ['C-2', 13945.9], ['R-3', 10837.7], ['A-2', 10608.1],
  ['RE-43', 9134.0], ['R-2', 6581.9], ['IND.PK.', 6552.7], ['R1-18', 6336.4], ['PCD', 5061.7],
  ['R-5', 5046.2], ['R-4', 3815.9], ['R1-14', 3304.1], ['R-3A', 2931.3], ['C-3', 2885.0],
  ['CP/GCP', 2879.7], ['C-1', 1881.4], ['COUNTY', 1852.7], ['CP/BP', 1620.2], ['RE-24', 1594.8],
  ['R-4A', 1208.7], ['PSC', 969.1], ['C-O', 966.0], ['PAD-9', 728.8], ['FH', 701.3],
  ['PAD-14', 631.3], ['PAD-10', 593.4], ['GC', 588.1], ['RH', 509.6], ['PAD-6', 485.6],
  ['', 479.7], ['PAD-7', 463.4], ['PAD-8', 439.3], ['PAD-2', 415.4], ['DTC-BCORE', 368.6],
  ['WU', 364.5], ['P-1', 342.6], ['RSC', 271.4], ['PAD-11', 233.9], ['PAD-5', 218.1],
  ['PAD-15', 181.2], ['DTC-WARE', 169.4], ['PAD-13', 149.8], ['MUA', 145.5], ['PAD-12', 125.2],
  ['S-2', 120.3], ['C-O/G-O', 112.6], ['R-O', 111.1], ['PAD-3', 110.1], ['DTC-ROOS', 108.4],
  ['PAD-4', 92.5], ['DTC-GTWY', 82.5], ['DTC-VANB', 76.3], ['DTC-W-EV', 74.2], ['P-2', 55.2],
  ['DTC-BIO', 53.0], ['DTC-S-ROO', 48.1], ['DTC-TwnPk', 47.8], ['PSCOD', 45.2], ['DTC-E-EV', 40.9],
  ['C-O/M-O', 36.4], ['DTC-E-ROO', 33.9], ['DTC-COM-2', 31.1], ['DTC-CENTP', 30.3],
  ['DTC-EEVER', 27.6], ['DTC-McD-2', 23.1], ['DTC-McD-1', 21.8], ['UR', 19.0],
  ['DTC-COMM1', 12.1], ['GCP', 6.2],
]

/** Every entry the table resolves, as (code, limits) pairs. Derived from the
 *  exported code list rather than from a literal, so a district added to the
 *  table without a citation cannot slip past the invariants below. */
const RESOLVED: Array<[string, PhoenixLimits]> = PHOENIX_DISTRICT_CODES.map((c) => [c, resolvePhoenix(c)])

describe('resolvePhoenix — height is carried in the unit the code prints', () => {
  // ════════════════════════════════════════════════════════════════════════
  // THE MIAMI-21 / DENVER CASE, made arithmetically impossible.
  // ════════════════════════════════════════════════════════════════════════

  // Phoenix's own table disproves a feet-per-storey constant more sharply than
  // Raleigh's did: R1-6 prints 2 stories AND 30 feet in its Standard column and
  // 3 stories AND 30 feet in its PRD column. The same feet, two storey counts.
  // No constant can reproduce both, so no constant can be introduced later
  // without failing here.
  it('no feet-per-storey constant reproduces the stated pairs', () => {
    const pairs: Array<{ what: string; ft: number; stories: number }> = []
    for (const [code, l] of RESOLVED) {
      if (l.height?.ft != null && l.height.stories != null) {
        pairs.push({ what: `${code} standard`, ft: l.height.ft, stories: l.height.stories })
      }
      for (const a of l.heightAlternatives ?? []) {
        if (a.ft != null && a.stories != null) {
          pairs.push({ what: `${code} ${a.label}`, ft: a.ft, stories: a.stories })
        }
      }
    }
    expect(pairs.length).toBeGreaterThan(10)

    // Sweep every plausible floor-to-floor convention at 0.01 ft resolution.
    // None may reproduce all of the code's own pairs.
    for (let c = 8.0; c <= 20.0; c += 0.01) {
      const reproduces = pairs.every((p) => Math.round(p.ft / c) === p.stories)
      expect(reproduces, `a constant of ${c.toFixed(2)} ft/storey reproduced every stated pair`).toBe(false)
    }

    // And state the disproof directly, so the reason survives even if the sweep
    // is ever loosened: R1-6 prints the same feet against two storey counts.
    const r16 = resolvePhoenix('R1-6')
    expect(r16.height?.ft).toBe(30)
    expect(r16.height?.stories).toBe(2)
    expect(r16.heightAlternatives?.[0].ft).toBe(30)
    expect(r16.heightAlternatives?.[0].stories).toBe(3)
  })

  // §619.B.6 states feet and NOTHING else; §618 Table 618.1 states both at the
  // same 48 feet. Publishing a storey count for R-4A would mean inventing one,
  // and the neighbouring district is the proof that the code caps storeys when
  // it means to.
  it('R-4A carries 48 ft with NO storey count, beside R-5 at 48 ft WITH one', () => {
    const r4a = resolvePhoenix('R-4A')
    expect(r4a.height?.ft).toBe(48)
    expect(r4a.height?.stories).toBeNull()

    const r5 = resolvePhoenix('R-5')
    expect(r5.height?.ft).toBe(48)
    expect(r5.height?.stories).toBe(4)
  })

  it('every district stated in storeys alone would keep ft null (none exist today)', () => {
    // Recorded as an invariant rather than as a fact about the current table:
    // if a future Phoenix district ever prints storeys with no feet, it must
    // arrive with ft null rather than with feet back-derived from the storeys.
    for (const [code, l] of RESOLVED) {
      if (l.height?.stories != null && l.height.ft == null) {
        expect(l.height.source, `${code} states storeys only and must cite that`).toMatch(/stor/i)
      }
    }
  })

  it('the module source contains no feet-per-storey constant', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./phoenix.ts', import.meta.url), 'utf8'),
    )
    // A constructor that takes only one member of the pair is how the Denver and
    // Miami defects were reintroduced elsewhere. There is exactly one height
    // constructor and it takes both.
    expect(src).not.toMatch(/FT_PER_STOR/i)
    expect(src).not.toMatch(/ft\s*\/\s*stor(y|ey)\s*=/i)
    expect(src.match(/const storeyed = /g)?.length ?? 0).toBe(1)
  })
})

describe('resolvePhoenix — the standard option is the headline (rule 6)', () => {
  // PRD buys its extra storey with common open space, perimeter setbacks and
  // design review. Publishing it would assume a programme the user has not
  // chosen — the Austin 0.40-vs-0.65 defect.
  it('a PRD height never becomes the district height', () => {
    for (const [code, l] of RESOLVED) {
      const prd = (l.heightAlternatives ?? []).find((a) => /Planned Residential Development/.test(a.label))
      if (!prd) continue
      expect(l.height, `${code} has a PRD limb but no standard height`).not.toBeNull()
      if (prd.stories != null && l.height?.stories != null) {
        expect(prd.stories, `${code}: PRD storeys must be >= standard`).toBeGreaterThanOrEqual(
          l.height.stories,
        )
      }
      if (prd.ft != null && l.height?.ft != null) {
        expect(prd.ft).toBeGreaterThanOrEqual(l.height.ft)
      }
    }
  })

  it('R1-10, R1-8 and R1-6 publish 2 storeys, not the PRD 3', () => {
    for (const code of ['R1-10', 'R1-8', 'R1-6']) {
      const l = resolvePhoenix(code)
      expect(l.height?.stories, code).toBe(2)
      expect(l.heightAlternatives?.[0].stories, code).toBe(3)
    }
  })

  // C-1/C-2/C-3 §§622–624.E.3 allow 4 storeys / 56 ft, but only in a General
  // Plan "core area", on Central Avenue between Camelback and Harrison, or under
  // a pre-1988 stipulated site plan. None of those has been measured for a
  // parcel, so the figure is disclosed and never published as the district's.
  it('the C-district core-area limb is disclosed, never the headline', () => {
    for (const code of ['C-1', 'C-2', 'C-3']) {
      const l = resolvePhoenix(code)
      expect(l.height?.ft, code).toBe(30)
      expect(l.height?.stories, code).toBe(2)
      const core = l.heightAlternatives?.[0]
      expect(core?.ft, code).toBe(56)
      expect(core?.stories, code).toBe(4)
      expect(core?.source, code).toMatch(/core area/i)
    }
  })

  // Each C district's core-area item sits at a DIFFERENT letter in its own E.3
  // list. A shared citation would be right once and wrong twice, which is the
  // copied-disclosure failure rule 9's corollary names.
  it('each C district cites its own section, not a copied one', () => {
    expect(resolvePhoenix('C-1').heightAlternatives?.[0].source).toContain('§622.E.3.f')
    expect(resolvePhoenix('C-2').heightAlternatives?.[0].source).toContain('§623.E.3.d')
    expect(resolvePhoenix('C-3').heightAlternatives?.[0].source).toContain('§624.E.3.g')
    expect(resolvePhoenix('C-1').height?.source).toContain('§622.E.4.a')
    expect(resolvePhoenix('C-2').height?.source).toContain('§623.E.4.a')
    expect(resolvePhoenix('C-3').height?.source).toContain('§624.E.4.a')
  })

  // §627 and §628 allow 80 ft "with use permit with a specific plan of
  // development" and 110 ft for a warehouse on a Council finding. Those are
  // DISCRETIONARY approvals, not programmes an applicant may elect, and they
  // must never be published — the same call Raleigh made on R-1's 68 ft
  // treatment-plant figure.
  it('never publishes a figure that requires a use permit or a Council finding', () => {
    for (const [code, l] of RESOLVED) {
      const heights = [l.height, ...(l.heightAlternatives ?? []), ...(l.heightConditional?.limbs ?? [])]
      for (const h of heights) {
        if (!h) continue
        expect(h.ft, `${code} published a discretionary height`).not.toBe(80)
        expect(h.ft, `${code} published a discretionary height`).not.toBe(110)
        expect(h.ft, `${code} published a discretionary height`).not.toBe(42)
      }
    }
    expect(resolvePhoenix('A-1').height?.ft).toBe(56)
    expect(resolvePhoenix('A-1').heightAlternatives).toBeNull()
    expect(resolvePhoenix('A-2').height?.ft).toBe(56)
    expect(resolvePhoenix('A-2').heightAlternatives).toBeNull()
  })
})

describe('resolvePhoenix — FAR: an answer, a refusal, and a gap must differ', () => {
  // The slot test, positively: a district whose own standards enumeration has no
  // floor-area-ratio item, in an ordinance that defines FAR at §202 and prints
  // it as a table row where it does apply.
  it('R1-6 and the other read districts state NO floor-area ratio at all', () => {
    for (const code of ['R1-6', 'S-1', 'RE-35', 'R-5', 'C-2', 'A-1', 'UR', 'MUA']) {
      const l = resolvePhoenix(code)
      expect(l.farUnconstrained, code).toBe(true)
      expect(l.maxFAR, code).toBeNull()
    }
  })

  // ⚠️ THE REFUSAL, and it is the point of the pairing above. §626.H.1's
  // Commerce Park table HAS a FAR row — Single User 0.5, Research Park 1.0 —
  // and the two mapped options hold an em dash in it. An em dash in a cell whose
  // neighbours hold numbers is a blank, and a blank cell does not pass the slot
  // test. So neither may claim the code imposes no FAR.
  it('CP/BP and CP/GCP REFUSE farUnconstrained, because the slot exists and is empty', () => {
    for (const code of ['CP/BP', 'CP/GCP']) {
      const l = resolvePhoenix(code)
      expect(l.farUnconstrained, code).toBe(false)
      expect(l.maxFAR, code).toBeNull()
      // And it must say WHY, in the table's own terms, or the false and the
      // refused states are indistinguishable to a reader.
      expect(l.farSource, code).toMatch(/em dash/i)
      expect(l.farSource, code).toMatch(/0\.5/)
      expect(l.name, code).toContain('Commerce Park')
    }
  })

  // FH §657.C.6 carries a literal "floor area ratio of 0.1", and it is a
  // TRANSFER credit off this land rather than a cap on building here. Publishing
  // it as maxFAR would be a number in the right units and the wrong meaning.
  it('FH does not publish its §657 transfer ratio as a maxFAR', () => {
    const fh = resolvePhoenix('FH')
    expect(fh.maxFAR).toBeNull()
    expect(fh.farUnconstrained).toBe(false)
    expect(fh.restrictedNote).toMatch(/transferred to the adjoining/)
    expect(fh.restrictedNote).toMatch(/transfer credit off this land, NOT a floor-area cap/)
  })

  // A district nobody has read must assert nothing — least of all that the code
  // imposes no limit.
  it('an unread district is a GAP, never an absence', () => {
    for (const code of ['DTC-BCORE', 'DTC-WARE', 'WU', 'IND.PK.', 'PSCOD', 'GCP', 'NOT-A-DISTRICT', '']) {
      const l = resolvePhoenix(code)
      expect(l.name, code).toBeNull()
      expect(l.height, code).toBeNull()
      expect(l.heightConditional, code).toBeNull()
      expect(l.maxFAR, code).toBeNull()
      expect(l.farUnconstrained, code).toBe(false)
      expect(l.lotCoverageUnconstrained, code).toBe(false)
      expect(l.maxLotCoveragePct, code).toBeNull()
      expect(l.planGoverned, code).toBe(false)
      expect(l.source, code).toBe('')
    }
  })

  it('plan-governed districts are incomplete, not unconstrained', () => {
    for (const code of ['PUD', 'PCD', 'PAD-2', 'PAD-9', 'PAD-15']) {
      const l = resolvePhoenix(code)
      expect(l.planGoverned, code).toBe(true)
      expect(l.farUnconstrained, code).toBe(false)
      expect(l.height, code).toBeNull()
      expect(l.maxFAR, code).toBeNull()
      expect(l.source, code).not.toBe('')
    }
  })

  it('a county island asserts nothing about Phoenix limits', () => {
    const l = resolvePhoenix('COUNTY')
    expect(l.countyJurisdiction).toBe(true)
    expect(l.farUnconstrained).toBe(false)
    expect(l.height).toBeNull()
    expect(l.planGoverned).toBe(false)
  })

  // UR §642.G says it in words: "There shall be no maximum lot coverage
  // requirements." That is the same kind of claim as farUnconstrained and is
  // made only where the code states it.
  it('lotCoverageUnconstrained is set on UR alone, and cites the sentence', () => {
    const withFlag = RESOLVED.filter(([, l]) => l.lotCoverageUnconstrained).map(([c]) => c)
    expect(withFlag).toEqual(['UR'])
    expect(resolvePhoenix('UR').lotCoverageSource).toContain('no maximum lot coverage requirements')
    expect(resolvePhoenix('UR').maxLotCoveragePct).toBeNull()
  })
})

describe('resolvePhoenix — C-O: a known limit we cannot pick between', () => {
  // §621.B and §621.C state different heights and the discriminator is the date
  // the rezoning application was filed. That fact is in no dataset. This is
  // neither an answer nor a gap, and it must not render as either.
  it('bare C-O publishes no height but records all three limbs', () => {
    const l = resolvePhoenix('C-O')
    expect(l.height).toBeNull()
    expect(l.heightConditional).not.toBeNull()
    expect(l.heightConditional?.discriminator).toMatch(/January 8, 1986/)
    expect(l.heightConditional?.limbs).toHaveLength(3)
    const feet = l.heightConditional!.limbs.map((x) => x.ft)
    expect(feet).toEqual([56, 25, 56])
    // The name resolves, so this is visibly not an unread district.
    expect(l.name).toContain('C-O')
    expect(l.source).not.toBe('')
  })

  it('the two mapped C-O options DO resolve, and to different heights', () => {
    expect(resolvePhoenix('C-O/G-O').height?.ft).toBe(25)
    expect(resolvePhoenix('C-O/G-O').maxLotCoveragePct).toBe(40)
    expect(resolvePhoenix('C-O/M-O').height?.ft).toBe(56)
    expect(resolvePhoenix('C-O/M-O').height?.stories).toBe(4)
    expect(resolvePhoenix('C-O/M-O').maxLotCoveragePct).toBe(50)
  })
})

describe('resolvePhoenix — citations and structure', () => {
  it('every resolved district carries a source, and every height cites a section', () => {
    for (const [code, l] of RESOLVED) {
      expect(l.source, `${code} has no source`).not.toBe('')
      expect(l.name, `${code} has no name`).not.toBeNull()
      if (l.height) expect(l.height.source, `${code} height has no citation`).toMatch(/§\d/)
      for (const a of l.heightAlternatives ?? []) {
        expect(a.source, `${code} alternative "${a.label}" has no citation`).toMatch(/§\d/)
      }
      if (l.maxLotCoveragePct != null) {
        expect(l.lotCoverageSource, `${code} coverage has no citation`).toMatch(/§\d/)
      }
      if (l.maxUnitsPerGrossAcre != null || l.minLotAreaPerUnitSqFt != null) {
        expect(l.densitySource, `${code} density has no citation`).toMatch(/§\d/)
      }
    }
  })

  // A district that publishes a height but no coverage and no density is
  // usually a half-read district wearing a resolved result. This invariant
  // earned its keep: it failed on PSC, and §637.C.2 turned out to state a 25%
  // site coverage limit that the first reading had missed.
  //
  // Four districts are exempt, and each exemption was CHECKED against the
  // source rather than assumed. §638 (RSC), §640 (P-2), §627 (A-1) and §628
  // (A-2) were re-read in full on 2026-08-09 and scanned for "coverage",
  // "intensity", "density", "lot area" and "floor area ratio": §638 and §640
  // contain none of them at all, and §627/§628's only hits are the word
  // "intensity" in prose ("uses of similar intensity", "intensive use of
  // property") and a parking-lot-area table heading. Their dimensional controls
  // are height and setbacks. Recorded with the source because rule 15 says an
  // absence assertion is an interpretation, and an unexplained exemption list is
  // how a half-read district gets defended by a green test.
  const NO_INTENSITY_CONTROL_IN_SOURCE = new Set(['RSC', 'P-2', 'A-1', 'A-2'])
  it('a resolved dimensional district carries an intensity control, not just a height', () => {
    for (const [code, l] of RESOLVED) {
      if (NO_INTENSITY_CONTROL_IN_SOURCE.has(code)) continue
      // C-O is exempt for the same reason it publishes no height: its coverage
      // figure differs per regime too (50% / 40% / 50%), and picking one would
      // be the choice §621 refuses to let us make.
      if (
        l.planGoverned ||
        l.countyJurisdiction ||
        l.noPrincipalBuilding ||
        l.heightConditional != null ||
        code === 'FH'
      ) {
        continue
      }
      const hasIntensity =
        l.maxLotCoveragePct != null ||
        l.lotCoverageUnconstrained ||
        l.maxUnitsPerGrossAcre != null ||
        l.minLotAreaPerUnitSqFt != null ||
        l.maxFAR != null
      expect(hasIntensity, `${code} publishes a height and no intensity control`).toBe(true)
    }
  })

  // The live layer's values are clean base codes — the historic and transit
  // designations live in separate columns. Stripping a suffix speculatively is
  // how 'R-LC' became 'R-L' in another city, so nothing is stripped here.
  it('normalisation upper-cases and collapses whitespace, and strips nothing', () => {
    expect(normalizePhoenixZone(' r1-6 ')).toBe('R1-6')
    expect(normalizePhoenixZone('DTC-TwnPk')).toBe('DTC-TWNPK')
    expect(normalizePhoenixZone('  ')).toBe('')
    expect(normalizePhoenixZone(null)).toBe('')
    // 'C-O' must not become 'C' by a "-O suffix" rule, and 'CP/GCP' must not be
    // split on the slash.
    expect(resolvePhoenix('C-O').name).toContain('Commercial Office')
    expect(resolvePhoenix('CP/GCP').name).toContain('General Commerce')
  })
})

describe('resolvePhoenix — coverage against the live vocabulary (rule 11)', () => {
  // Run through the exported entry point over the values the SERVICE serves, not
  // over this module's own key list — the layer, not the instrument.
  it('resolves 89% of mapped acreage and leaves the rest visibly unresolved', () => {
    const total = LIVE_VOCABULARY.reduce((s, [, a]) => s + a, 0)
    let curated = 0
    let planned = 0
    let county = 0
    let gap = 0
    const gapCodes: string[] = []
    for (const [code, acres] of LIVE_VOCABULARY) {
      const l = resolvePhoenix(code)
      if (l.planGoverned) planned += acres
      else if (l.countyJurisdiction) county += acres
      else if (l.name != null) curated += acres
      else {
        gap += acres
        gapCodes.push(code)
      }
    }
    expect(Math.round(total)).toBe(359403)
    expect(curated / total).toBeGreaterThan(0.89)
    expect(planned / total).toBeGreaterThan(0.07)
    expect(Math.round(county)).toBe(1853)
    expect(gap / total).toBeLessThan(0.03)
    // Named so the gap is a list someone can work through, not a percentage.
    expect(gapCodes.filter((c) => c.startsWith('DTC-'))).toHaveLength(17)
    expect(gapCodes).toContain('WU')
    expect(gapCodes).toContain('IND.PK.')
    expect(gapCodes).toContain('PSCOD')
    expect(gapCodes).toContain('GCP')
    expect(gapCodes).toContain('')
  })

  it('every live value either resolves or returns the empty UNRESOLVED shape', () => {
    for (const [code] of LIVE_VOCABULARY) {
      const l = resolvePhoenix(code)
      if (l.name == null) {
        expect(l.source, code).toBe('')
        expect(l.farUnconstrained, code).toBe(false)
      } else {
        expect(l.source, code).not.toBe('')
      }
    }
  })
})

describe('usesForZone', () => {
  // §621.C.3.a(1) lists "All uses listed in Residential Office District, EXCEPT
  // residential uses". A tool about new housing must not assert a residential
  // right the office districts do not grant.
  it('the C-O office districts are not residential', () => {
    for (const code of ['C-O', 'C-O/G-O', 'C-O/M-O']) {
      expect(usesForZone(code), code).toEqual(['commercial'])
    }
  })

  it('the residential districts are residential', () => {
    for (const code of ['S-1', 'RE-43', 'R1-6', 'R-3', 'R-4A', 'UR']) {
      expect(usesForZone(code), code).toContain('residential')
    }
  })

  it('R-5 and the C districts carry mixed use, R-O carries office', () => {
    expect(usesForZone('R-5')).toEqual(['residential', 'commercial', 'mixed'])
    expect(usesForZone('C-2')).toEqual(['commercial', 'mixed', 'residential'])
    expect(usesForZone('R-O')).toEqual(['residential', 'commercial'])
  })

  // A-1 and A-2 cover 32,722 acres and their use lists were NOT read. Null is
  // the honest state; guessing "commercial" from the district name is the move
  // that misclassified Atlanta's I-1.
  it('returns null where the use section was not read, rather than guessing', () => {
    for (const code of ['A-1', 'A-2', 'CP/BP', 'CP/GCP', 'S-2', 'RH', 'PSC', 'RSC', 'MUA', 'GC', 'P-1', 'P-2', 'FH']) {
      expect(usesForZone(code), code).toBeNull()
    }
    for (const code of ['PUD', 'PCD', 'PAD-9', 'COUNTY', 'DTC-BCORE', 'WU']) {
      expect(usesForZone(code), code).toBeNull()
    }
  })
})
