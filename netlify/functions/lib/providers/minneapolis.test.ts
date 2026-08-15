import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMinneapolisParcelInfo } from './minneapolis'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'
import { assessDevelopability } from '../../../../src/lib/developability'

// Endpoint URL substrings the Minneapolis provider hits (see minneapolis.ts):
//   PARCELS    = Hennepin LAND_PROPERTY → 'LAND_PROPERTY' (queried in UTM 15N via
//                fetchFeaturesXYSnap; the mock intercepts fetch regardless of SR)
//   ZONING     = Planning_Primary_Zoning → 'Planning_Primary_Zoning'
//   BUILT_FORM = Planning_Zoning_Built_Form → 'Planning_Zoning_Built_Form'
//   HISTORIC   = HPC_Districts → 'HPC_Districts'
//   FLOOD      = FEMA NFHL → 'NFHL'
//   PARKS      = .../Parks/FeatureServer → 'Parks/FeatureServer'

const LAT = 44.9778
const LNG = -93.265

// `Partial<typeof …>`, not `Record<string, unknown>`: an override must name a
// field the fixture declares, so a misspelled key is a compile error rather
// than a silent no-op that leaves the base value asserted.
const MPLS_PARCEL = {
  HOUSE_NO: '350',
  STREET_NM: 'S  5TH  ST',
  MUNIC_NM: 'MINNEAPOLIS',
  ZIP_CD: '55415',
  PARCEL_AREA: 7200,
  PID: '2202924320045',
  BUILD_YR: 1990,
  BLDG_MV1: 1200000,
  OWNER_NM: 'PRIVATE OWNER LLC',
}
const mplsParcel = (over: Partial<typeof MPLS_PARCEL> = {}) =>
  featureSet({ ...MPLS_PARCEL, ...over })

const mplsZoning = (code = 'CM4') => featureSet({ Land_Use_Code: code, Land_Use: 'Commercial Mixed' })
const mplsForm = (abbrv = 'BFC6') => featureSet({ Abbrv: abbrv, Built_Form: 'Corridor 6' })

afterEach(() => vi.restoreAllMocks())

describe('getMinneapolisParcelInfo — happy path', () => {
  it('assembles address from HOUSE_NO/STREET_NM and trusts PARCEL_AREA as sq ft', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel(),
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
        'Parks/FeatureServer': featureSet(),
      }),
    )

    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Address = "<HOUSE_NO> <STREET_NM>" with collapsed whitespace.
    expect(res.info.address).toBe('350 S 5TH ST')
    expect(res.info.parcelId).toBe('2202924320045')
    expect(res.info.zoning.districtCode).toBe('CM4')
    // NOTE: PARCEL_AREA is consumed verbatim as square feet (no acres→sqft
    // conversion in the provider); pins current behavior.
    expect(res.info.lot.sizeSqFt).toBe(7200)
    // Built-form Abbrv BFC6 → 84 ft from MPLS_BUILT_FORM_FT.
    expect(res.info.zoning.maxHeightFt).toBe(84)
    // BFC6 (Corridor 6) + CM4 primary: Table 540-2's "All other districts"
    // column, 3.4. Null until 2026-08-15, when the Corridor/Transit/Core/
    // Production/Parks rows were read from the adopted Chapter 540 ordinance.
    // This is the joint dependency working end to end — neither layer alone
    // gives 3.4 (CLAUDE.md rule 13).
    expect(res.info.zoning.maxFAR).toBe(3.4)
    // CM prefix → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    expect(res.info.zoning.article).toBe('Commercial Mixed')
    expect(res.info.overlays.floodZone).toBe('X')
    // Existing building derived from BLDG_MV1 > 0 / BUILD_YR.
    expect(res.info.existing?.yearBuilt).toBe(1990)
    expect(res.info.existing?.numBuildings).toBe(1)
    // BLDG_MV1 → assessedValue, flagged as improvement-only (building, not total).
    expect(res.info.existing?.assessedValue).toBe(1200000)
    expect(res.info.existing?.assessedValueBasis).toBe('improvement only')
  })

  it('Core 50 (BFC50) built form yields a null max height', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel(),
        Planning_Primary_Zoning: mplsZoning('DT1'),
        Planning_Zoning_Built_Form: mplsForm('BFC50'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': featureSet(),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // DT prefix → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  it('a PARKS overlay match marks the parcel as public open space', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel({ BLDG_MV1: 0, BUILD_YR: 0 }),
        Planning_Primary_Zoning: mplsZoning('UN1'),
        Planning_Zoning_Built_Form: mplsForm('BFPR'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': featureSet({ PARK_NAME1: 'Loring' }),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.landUse).toBe('Loring (public park)')
    // ⚠️ THE LABEL IS NOT THE POINT — THE BLOCK IS. This assertion previously
    // stopped at the string, under a comment claiming the gate caught it, and
    // the claim was false: the suffix in use matched nothing in PUBLIC_LANDUSE
    // and Minneapolis parks came back developable for as long as the layer had
    // been read (CLAUDE.md rule 15 — a well-explained test defending a wrong
    // interpretation). Assert the OUTCOME, at the same function analyze.ts
    // calls, so no future relabelling can quietly disarm it again.
    const dev = assessDevelopability({
      districtCode: res.info.zoning.districtCode,
      landUse: res.info.existing?.landUse ?? null,
      ownerPublic: res.info.existing?.ownerPublic ?? false,
    })
    expect(dev.developable).toBe(false)
    expect(dev.kind).toBe('public')
  })

  it('detects a government owner via OWNER_NM and surfaces ownerPublic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel({ OWNER_NM: 'CITY OF MINNEAPOLIS' }),
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': featureSet(),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
  })
})

describe('getMinneapolisParcelInfo — resilience', () => {
  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel(),
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
        'Parks/FeatureServer': featureSet(),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('2202924320045')
  })

  // The park layer used to sit in that same optional group, and this test used
  // to assert it could fail without consequence. It cannot: it is the only
  // signal that blocks a Minneapolis park, so its failure has to REFUSE rather
  // than degrade into a developable verdict for parkland. Historic and flood
  // stay optional above, which is the contrast that makes the categories real.
  it('returns UPSTREAM_ERROR when the park layer rejects — it is a hard-block input', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: mplsParcel(),
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': () => {
          throw new Error('parks down')
        },
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: ARCGIS_ERROR_200,
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': featureSet(),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        LAND_PROPERTY: featureSet(),
        Planning_Primary_Zoning: mplsZoning('CM4'),
        Planning_Zoning_Built_Form: mplsForm('BFC6'),
        HPC_Districts: featureSet(),
        NFHL: featureSet(),
        'Parks/FeatureServer': featureSet(),
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
