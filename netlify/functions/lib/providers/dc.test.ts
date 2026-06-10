import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDcParcelInfo } from './dc'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'

// Endpoint URL substrings the DC provider hits (see dc.ts):
//   PARCELS  = .../Property_and_Land/MapServer/40  → 'MapServer/40'
//   ZONING   = .../DCOZ/Zone_Mapservice/MapServer/24 → 'MapServer/24'
//   HISTORIC = .../DCOZ/Zone_Mapservice/MapServer/6  → 'MapServer/6'
//   FLOOD    = FEMA NFHL → 'NFHL'
// (ZONING and HISTORIC share the 'Zone_Mapservice' base, so we route on the
// distinct trailing layer id.)

const LAT = 38.9072
const LNG = -77.0369

const dcParcel = (over: Record<string, unknown> = {}) =>
  featureSet({
    PREMISEADD: '1350 PENNSYLVANIA AVE NW WASHINGTON DC 20004',
    SSL: '0295    0805',
    LANDAREA: 12500,
    USECODE: '012',
    SALETYPE: 'Improved',
    CLASSTYPE: '2 - Commercial',
    OWNERNAME: 'PRIVATE HOLDINGS LLC',
    ...over,
  })

const dcZoning = (code = 'MU-4A') => featureSet({ Zoning: code, Zone_District: 'Mixed-Use' })

afterEach(() => vi.restoreAllMocks())

describe('getDcParcelInfo — happy path', () => {
  it('normalizes a private MU-4A parcel with lettered-subzone fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4A'),
        'MapServer/6': featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
      }),
    )

    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // PREMISEADD trimmed at "WASHINGTON DC".
    expect(res.info.address).toBe('1350 PENNSYLVANIA AVE NW')
    expect(res.info.parcelId).toBe('0295    0805')
    expect(res.info.zoning.districtCode).toBe('MU-4A')
    // LANDAREA → lot size sq ft.
    expect(res.info.lot.sizeSqFt).toBe(12500)
    expect(res.info.overlays.floodZone).toBe('X')
    // Lettered-subzone parent fallback: 'MU-4A' isn't in DC_LIMITS but 'MU-4' is
    // (h:50, f:2.5) — code strips the trailing A to the numbered parent.
    expect(res.info.zoning.maxHeightFt).toBe(50)
    expect(res.info.zoning.maxFAR).toBe(2.5)
    // MU prefix → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  it('pins an exact-match base zone (MU-7 → h:65, f:5.0) without fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-7'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(65)
    expect(res.info.zoning.maxFAR).toBe(5.0)
  })

  it('detects a government owner via OWNERNAME and surfaces ownerPublic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel({ OWNERNAME: 'DISTRICT OF COLUMBIA' }),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
  })

  it('surfaces a historic district name when the layer matches', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet({ HistDistrict_NAME: 'Downtown Historic District' }),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Downtown Historic District')
  })
})

describe('getDcParcelInfo — resilience', () => {
  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('0295    0805')
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': ARCGIS_ERROR_200,
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': featureSet(), // empty for both exact + buffered snap query
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
