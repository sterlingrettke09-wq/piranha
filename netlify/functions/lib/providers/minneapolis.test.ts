import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMinneapolisParcelInfo } from './minneapolis'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'

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
    expect(res.info.zoning.maxFAR).toBeNull()
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
    // Park name flows into existing.landUse as "<name> (park)" so the
    // developability gate's public-land check catches it.
    expect(res.info.existing?.landUse).toBe('Loring (park)')
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
  it('still ok:true with null overlays when historic + flood + parks reject', async () => {
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
        'Parks/FeatureServer': () => {
          throw new Error('parks down')
        },
      }),
    )
    const res = await getMinneapolisParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('2202924320045')
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
