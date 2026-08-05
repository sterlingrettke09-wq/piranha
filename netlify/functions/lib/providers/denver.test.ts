import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDenverParcelInfo } from './denver'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'
import { resolveZoningLimits } from '../zoningLimits'

// Endpoint URL substrings the Denver provider hits (see denver.ts):
//   PARCELS  = .../Zoning/MapServer/0 → 'MapServer/0'
//   ZONING   = .../Zoning/MapServer/1 → 'MapServer/1'
//   HISTORIC = ODC_HIST_LANDMARKDISTRICT_A → 'ODC_HIST_LANDMARKDISTRICT_A'
//   FLOOD    = FEMA NFHL → 'NFHL'
//   EHA      = EHA_WebService → 'EHA_WebService'

const LAT = 39.7392
const LNG = -104.9903

const denverParcel = (over: Record<string, unknown> = {}) =>
  featureSet({
    SITUS_ADDRESS_LINE1: '1437  Bannock   St',
    LAND_AREA: 9500,
    SCHEDNUM: '0234512018000',
    D_CLASS_CN: 'COMMERCIAL',
    APPRAISED_IMP_VALUE: 450000,
    COM_ORIG_YEAR_BUILT: 1958,
    RES_ORIG_YEAR_BUILT: 0,
    OWNER_NAME: 'PRIVATE OWNER LLC',
    ...over,
  })

const denverZoning = (over: Record<string, unknown> = {}) =>
  featureSet({
    ZONE_DISTRICT: 'C-MX-5',
    ZONE_DESCRIPTION: 'Urban Center, Mixed Use',
    OVERLAY_DISTRICT: null,
    HEIGHT_STORIES: 5,
    ...over,
  })

afterEach(() => vi.restoreAllMocks())

describe('getDenverParcelInfo — happy path', () => {
  it('prefers the code-stated height over a HEIGHT_STORIES derivation for a C-MX-5 parcel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({ HEIGHT_STORIES: 5 }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
        EHA_WebService: featureSet({ MarketArea: 'High' }),
      }),
    )

    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // SITUS_ADDRESS_LINE1 collapses runs of whitespace.
    expect(res.info.address).toBe('1437 Bannock St')
    expect(res.info.parcelId).toBe('0234512018000')
    expect(res.info.zoning.districtCode).toBe('C-MX-5')
    expect(res.info.lot.sizeSqFt).toBe(9500)
    // ⚠️ Was `5 stories × 12 ft/story = 60`. That assertion — and this test's own
    // former title — DEFENDED the production defect: the provider derived feet
    // from the live HEIGHT_STORIES field before consulting the curated table, so
    // correcting the table changed nothing for real parcels. DZC Art. 7
    // § 7.3.3.3.D prints C-MX-5 at 70 ft. A figure read from the code outranks
    // one manufactured from a story count (rules 11 and 12).
    expect(res.info.zoning.maxHeightFt).toBe(70)
    expect(res.info.zoning.maxFAR).toBeNull() // form-based code, no FAR
    // Resolving through the curated table keeps FAR null (Denver is
    // height-governed) while the code-stated 70 ft carries through — the honest
    // "height-governed district" shape, not a fabricated FAR.
    const resolved = resolveZoningLimits(res.info.zoning, 'denver')
    expect(resolved.maxFAR).toBeNull()
    expect(resolved.maxHeightFt).toBe(70)
    // -MX → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    // EHA market area feeds overlays.feeArea.
    expect(res.info.overlays.feeArea).toBe('High')
    // Existing structure derived from APPRAISED_IMP_VALUE > 0.
    expect(res.info.existing?.yearBuilt).toBe(1958)
    expect(res.info.existing?.landUse).toBe('Commercial')
    expect(res.info.existing?.numBuildings).toBe(1)
    // APPRAISED_IMP_VALUE → assessedValue, flagged as improvement-only (not a total).
    expect(res.info.existing?.assessedValue).toBe(450000)
    expect(res.info.existing?.assessedValueBasis).toBe('improvement only')
  })

  it('Former-Chapter-59 guard: returns null height despite a trailing number in the code', async () => {
    // HEIGHT_STORIES absent → falls through; description marks Former Chapter 59,
    // whose trailing number is a district CLASS not a story count → height null.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({
          ZONE_DISTRICT: 'B-3',
          ZONE_DESCRIPTION: 'Former Chapter 59 — B-3 Business',
          HEIGHT_STORIES: null,
        }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // NOTE: pins the guard — B-3 has a trailing "3" but Former Chapter 59
    // description suppresses the story-count interpretation.
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // Legacy B- prefix still maps to commercial/mixed/residential uses.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  // ⚠️ This test asserted `maxHeightFt === 36` and was titled "still derives a
  // height from the trailing token" — it PINNED a fabrication. `B-3` is a former
  // Chapter 59 code whose "3" is a district CLASS, not a story count, and the
  // guard fired only when ZONE_DESCRIPTION happened to contain the phrase
  // "former chapter 59". Described as plain "Business", the parcel published
  // 3 × 12 = 36 ft out of a number that means nothing of the kind.
  // The guard is now structural (code shape, not description text), so the
  // description being absent no longer opens the fabricating branch.
  it('a legacy code fabricates NO height even when the description omits "Former Chapter 59"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({
          ZONE_DISTRICT: 'B-3',
          ZONE_DESCRIPTION: 'Business',
          HEIGHT_STORIES: null,
        }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
  })

  it('detects a government owner via OWNER_NAME and surfaces ownerPublic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel({ OWNER_NAME: 'CITY OF DENVER' }),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
  })
})

describe('getDenverParcelInfo — resilience', () => {
  it('still ok:true with null overlays when historic + flood + eha reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
        EHA_WebService: () => {
          throw new Error('eha down')
        },
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.overlays.feeArea).toBeUndefined()
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': ARCGIS_ERROR_200,
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': featureSet(),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
