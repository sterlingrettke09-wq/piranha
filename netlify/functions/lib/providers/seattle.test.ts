import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSeattleParcelInfo } from './seattle'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import { seattleRoutes, seattleRoutesMio, seattleRoutesIndustrial } from './__fixtures__/seattle'

// Inside the Seattle bbox (downtown).
const LAT = 47.61
const LNG = -122.33

describe('getSeattleParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (NC3-65): address, PIN, zoning, height regex → 65, SQFTLOT lot, MHA feeArea', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(seattleRoutes))
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res
    expect(info.address).toBe('123 Pike St')
    expect(info.parcelId).toBe('1234567890')
    expect(info.zoning.districtCode).toBe('NC3-65')
    // seattleMaxHeightFt('NC3-65'): only '65' is a 2-3 digit number in range → 65.
    expect(info.zoning.maxHeightFt).toBe(65)
    // usesForZone: NC prefix → commercial + mixed + residential.
    expect(info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    // Lot size straight from the SQFTLOT attribute.
    expect(info.lot.sizeSqFt).toBe(4800)
    // MHA fee area passes through to overlays.feeArea.
    expect(info.overlays.feeArea).toBe('High')
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.landUse).toBe('Apartment')
  })

  it('MIO-105-NC3-65: height regex grabs the LARGEST number → 105, NOT the NC3 base height 65', async () => {
    // NOTE (suspected bug): seattleMaxHeightFt takes Math.max of every 2-3 digit
    // number in the zone string. For an MIO (Master/Institution Overlay) layered
    // over a base zone like "MIO-105-NC3-65", the 105 is the MIO institutional
    // height, while the by-right base height for a non-institutional project is
    // the NC3-65's 65. The code reports 105, which overstates the by-right cap
    // for a typical NC3 development. This test PINS that current behavior; it does
    // not endorse it. See seattle.ts seattleMaxHeightFt (lines ~31-46).
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(seattleRoutesMio))
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('MIO-105-NC3-65')
    expect(res.info.zoning.maxHeightFt).toBe(105)
  })

  it('industrial U/## rule: height is unlimited by-right → maxHeightFt null', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(seattleRoutesIndustrial))
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('IG1 U/85')
    // 'U/' present → returns null (no by-right cap), NOT 85.
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // usesForZone: IG prefix → commercial + institutional.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'institutional'])
  })

  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...seattleRoutes,
        'Zoning_Overlays-Historic': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
  })

  it('returns UPSTREAM_ERROR 502 when the parcels dataset returns a 200 ArcGIS error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...seattleRoutes, Parcel_Boundary: ARCGIS_ERROR_200 }),
    )
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcels dataset is empty (exact + buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...seattleRoutes, Parcel_Boundary: { features: [] } }),
    )
    const res = await getSeattleParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
