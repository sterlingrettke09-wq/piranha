import { describe, it, expect, vi, afterEach } from 'vitest'
import { bostonBaseDistrict, resolveBostonFar } from './boston'
import { getParcelInfo } from '../parcel'
import { mockArcgisFetch, featureSet } from '../providers/__fixtures__'
import { resolveZoningLimits } from '../zoningLimits'

// SOURCE for every figure below: Boston Zoning Code, ARTICLE 13 — TABLES,
// "TABLE B — DIMENSIONAL REGULATIONS", column "FLOOR AREA RATIO maximum (1)",
// read 2026-08-05 from Municode Update 46 ("Codified through Text Amd. No. 494,
// effective January 12, 2026"). The naming rule is ARTICLE 3, Section 3-1:
// "Each of the residential, business, and industrial classes is further
// subdivided into subdistricts, which are identified by a number specifying the
// maximum allowed floor area ratio and some of which have a second number
// specifying a height limit."

afterEach(() => vi.restoreAllMocks())

describe('bostonBaseDistrict — Art. 3 § 3-1A overlay/height-suffix stripping', () => {
  it('keeps a bare base district unchanged', () => {
    expect(bostonBaseDistrict('B-1')).toBe('B-1')
    expect(bostonBaseDistrict('R-.8')).toBe('R-.8')
    expect(bostonBaseDistrict('MER-2')).toBe('MER-2')
  })

  it('drops the limited-height suffix of § 3-1A(i)', () => {
    // Table B header note: "If a district with a second numerical suffix (e.g.,
    // H-2-55) is not listed in this Table, see footnote (15) and Section
    // 3-1A (i)." Footnote (15): "the second number is the maximum height in
    // feet" — so it is a height cap, never part of the FAR key.
    expect(bostonBaseDistrict('B-1-55')).toBe('B-1')
    expect(bostonBaseDistrict('H-2-55')).toBe('H-2')
    expect(bostonBaseDistrict('B-8-120c')).toBe('B-8')
    expect(bostonBaseDistrict('B-6-90a')).toBe('B-6')
  })

  it('drops the planned-development-area "D" of § 3-1A(a)', () => {
    expect(bostonBaseDistrict('I-2-D-65')).toBe('I-2')
    expect(bostonBaseDistrict('H-2-D-65')).toBe('H-2')
  })

  it('drops the restricted-roof-structure asterisk of § 3-1A(g)', () => {
    expect(bostonBaseDistrict('B-2*')).toBe('B-2')
  })

  it('returns null for names that are not § 3-1 class subdistricts', () => {
    // Section 3-1 confines the number-is-FAR rule to the residential, business
    // and industrial classes. Neighborhood, downtown, mixed use and Harborpark
    // districts "are divided into variously titled subdistricts and subareas,
    // as set forth in the applicable articles of this code."
    for (const name of [
      'R1', // Art. 60 Greater Mattapan
      'R2', // Art. 60 Greater Mattapan
      'S0', // Art. 26 Squares + Streets
      'S3',
      'MFR', // Art. 60
      'MU-4', // Art. 53 East Boston
      'NS-1', // Art. 69 Hyde Park
      'LI-2', // Art. 69 Hyde Park
      '1F-6000', // trailing number is a minimum LOT SIZE, not a FAR
      '3F-4000',
      'EBR-2.5', // Art. 53 East Boston
      'OS-P', // Art. 33 open space subdistrict
      'OS',
      'CPS',
      'WMU', // Art. 53 waterfront mixed use
      'CHARLESTOWN NAVY YARD SUBDISTRICT',
      'Unknown',
      '',
    ]) {
      expect(bostonBaseDistrict(name), name).toBeNull()
    }
  })
})

describe('resolveBostonFar — Art. 13 Table B, FLOOR AREA RATIO maximum', () => {
  // Verbatim column readings. Every district states ONE FAR across all of its
  // "TYPE OF USE" rows, so there is no larger-of-two alternative in play.
  const TABLE_B: Array<[string, number]> = [
    ['S-.3', 0.3],
    ['S-.5', 0.5],
    ['R-.5', 0.5],
    ['R-.8', 0.8],
    ['H-1', 1.0],
    ['H-1-40', 1.0],
    ['H-1-50', 1.0],
    ['H-2', 2.0],
    ['H-2-65', 2.0],
    ['H-3', 3.0],
    ['H-3-65', 3.0],
    ['H-4', 4.0],
    ['H-5', 5.0],
    ['L-.5', 0.5],
    ['L-1', 1.0],
    ['L-2', 2.0],
    ['L-2-65', 2.0],
    ['B-1', 1.0],
    ['B-2', 2.0],
    ['B-3-65', 3.0],
    ['B-4', 4.0],
    ['B-6-90a', 6.0],
    ['B-6-90b', 6.0],
    ['B-8', 8.0],
    ['B-8-120a', 8.0],
    ['B-8-120b', 8.0],
    ['B-8-120c', 8.0],
    ['B-10', 10.0],
    ['M-1', 1.0],
    ['M-2', 2.0],
    ['M-4', 4.0],
    ['M-8', 8.0],
    ['I-2', 2.0],
    ['MER-2', 2.0],
    ['W-2', 2.0],
  ]

  it.each(TABLE_B)('%s → FAR %f', (code, far) => {
    expect(resolveBostonFar(code)).toBe(far)
  })

  it('gives each B district its OWN FAR, not one constant for the letter', () => {
    // ⚠️ SHIPPED DEFECT. zoningLimits.ts seeds FAR from the leading letter
    // alone (FAMILY_FAR.B = 2.0), so every B subdistrict without a published
    // FARMax got 2.0. Table B states 1.0 / 2.0 / 3.0 / 4.0 / 6.0 / 8.0 / 10.0 —
    // a per-letter constant is wrong in both directions and can only be right
    // for B-2 by coincidence.
    expect(TABLE_B.filter(([c]) => c.startsWith('B-')).map(([, f]) => f)).toEqual([
      1.0, 2.0, 3.0, 4.0, 6.0, 6.0, 8.0, 8.0, 8.0, 8.0, 10.0,
    ])
  })

  it('returns null for a class district Table B does not list', () => {
    // Section 3-1's general rule would imply 1.0 for "R-1"; Table B states no
    // row for it. A rule-derived number is not a read one (CLAUDE.md rule 4).
    expect(resolveBostonFar('R-1')).toBeNull()
    expect(resolveBostonFar('B-5')).toBeNull()
    expect(resolveBostonFar('H-6')).toBeNull()
  })

  it('returns null for the neighborhood-article subdistricts', () => {
    for (const name of ['R1', 'R2', 'S0', 'S1', 'S2', 'S3', 'S4', 'MFR', 'MU-7', 'OS-P']) {
      expect(resolveBostonFar(name), name).toBeNull()
    }
  })
})

// ---- End-to-end through the real /api/parcel entry point (CLAUDE.md rule 11).
// A resolver hand-called in isolation proves nothing about what ships: the
// provider is what fills `zoning.maxFAR`, and `resolveZoningLimits` is what the
// envelope reads. Exercise both.

const LAT = 42.321685
const LNG = -71.046567

const parcelFixture = (over: Record<string, unknown> = {}) =>
  featureSet({
    PID: '1303448000',
    ST_NUM: '150',
    ST_NAME: 'Mount Vernon St',
    LAND_SF: 752109,
    LU_DESC: 'Commercial',
    OWNER: 'PRIVATE OWNER LLC',
    NUM_BLDGS: 1,
    ...over,
  })

const zoningFixture = (over: Record<string, unknown> = {}) =>
  featureSet({
    Name: 'B-1-55',
    District: 'Harborpark: Dorchester Bay/Neponset River Waterfront',
    Article: '42A',
    HeightMax: null,
    FARMax: null,
    Use_: 'Commercial',
    ...over,
  })

const routes = (zoning: object, parcel: object = parcelFixture()) => ({
  Zoning_Subdistricts_Urban: zoning,
  Parcels_24_detailed: parcel,
  Historic_Districts_BLC: featureSet(),
  NFHL: featureSet({ FLD_ZONE: 'X' }),
})

describe('Boston /api/parcel — Table B reaches the published envelope', () => {
  it('B-1-55 on Columbia Point publishes FAR 1.0, not the seeded 2.0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes(zoningFixture())))

    const res = await getParcelInfo('boston', LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('B-1-55')
    // ⚠️ WAS null here, which let FAMILY_FAR.B = 2.0 answer downstream.
    // Art. 13 Table B, district B-1: FAR maximum 1.0.
    expect(res.info.zoning.maxFAR).toBe(1)
    // Footnote (15): the second number IS the height in feet. Unchanged — that
    // path was already right, and is left in zoningLimits.ts rather than
    // re-derived here (CLAUDE.md rule 12).
    expect(res.info.envelope?.maxHeightFt).toBe(55)
    expect(res.info.envelope?.farBasis).toBe('district')
    // ⚠️ WAS 1,504,218 sf and 1,157 units on the live parcel (measured
    // 2026-08-05) — exactly double, because the seed FAR was double.
    expect(res.info.envelope?.maxFloorAreaSqFt).toBe(752109)
    expect(res.info.envelope?.maxUnits).toBe(578)
  })

  it('a published FARMax still outranks the table', async () => {
    // B-8-120a publishes FARMax 8 on the live layer. The provider must keep
    // taking BPDA's number; the table only fills a null.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch(routes(zoningFixture({ Name: 'B-8-120a', FARMax: 8, HeightMax: 120 }))),
    )
    const res = await getParcelInfo('boston', LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBe(8)
    expect(res.info.zoning.maxHeightFt).toBe(120)
  })

  it('leaves an Article 60 subdistrict without a published FAR as a GAP', async () => {
    // Greater Mattapan's R2 is governed by Article 60's own Table D, not
    // Table B. The table must not invent a figure for it — null here is an
    // honest gap, distinct from an answer (CLAUDE.md rule 5).
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch(
        routes(
          zoningFixture({
            Name: 'R2',
            District: 'Greater Mattapan Neighborhood',
            Article: '60',
            HeightMax: 35,
            NumFloorsMax: 3,
            Use_: 'Medium Residential',
          }),
        ),
      ),
    )
    const res = await getParcelInfo('boston', LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
  })

  it('the seed constants in zoningLimits.ts still answer where the table is silent', () => {
    // Documenting the layering, not endorsing it. FAMILY_FAR in zoningLimits.ts
    // is unchanged and still seeds an unsourced FAR from the leading letter for
    // every subdistrict this table stays silent on — Art. 60 R1/R2 → 1.0,
    // Art. 26 S0–S4 → 0.5, and all OS-* → 0.1. Those figures appear nowhere in
    // the code and remain OPEN; fixing them means editing zoningLimits.ts,
    // which is out of scope for this change.
    expect(resolveZoningLimits({ districtCode: 'R2', maxFAR: null, maxHeightFt: 35, allowedUses: null }, 'boston').maxFAR).toBe(1.0)
    expect(resolveZoningLimits({ districtCode: 'B-1-55', maxFAR: 1, maxHeightFt: null, allowedUses: null }, 'boston').maxFAR).toBe(1)
  })
})
