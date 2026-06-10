import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getChicagoParcelInfo } from './chicago'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import { chicagoRoutesRM5, chicagoRoutesB32 } from './__fixtures__/chicago'
import { resolveZoningLimits } from '../zoningLimits'

// Inside the Chicago bbox (the Loop).
const LAT = 41.88
const LNG = -87.63

describe('getChicagoParcelInfo', () => {
  beforeEach(() => {
    // No Mapbox token → reverseGeocode returns null without fetching, so the
    // address is the deterministic 'Selected location' fallback.
    vi.stubEnv('MAPBOX_TOKEN', '')
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('happy path (RM-5): zoning, base FAR 2.0, residential uses, lot area, residential existing use', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(chicagoRoutesRM5))
    const res = await getChicagoParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res
    expect(info.parcelId).toBe('1701234567')
    expect(info.zoning.districtCode).toBe('RM-5')
    // chicagoBaseFAR: RM-5 → 2.0
    expect(info.zoning.maxFAR).toBe(2.0)
    // usesForZone: 'R' prefix → residential + institutional
    expect(info.zoning.allowedUses).toEqual(['residential', 'institutional'])
    // Lot area from rings (Cook County US ft): 25 x 125 = 3125 sqft.
    expect(info.lot.sizeSqFt).toBe(3125)
    // AssessorBLDGclass '211' starts with '2' → Residential building.
    expect(info.existing?.landUse).toBe('Residential building')
    // No Mapbox token → fallback address.
    expect(info.address).toBe('Selected location')
    expect(info.overlays.floodZone).toBe('X')
  })

  it('B3-2: commercial uses but null FAR (only residential RM/RS/RT classes carry a base FAR)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(chicagoRoutesB32))
    const res = await getChicagoParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('B3-2')
    // At the PROVIDER level chicagoBaseFAR only fills residential classes, so the
    // raw provider FAR for a B-class is still null…
    expect(res.info.zoning.maxFAR).toBeNull()
    // …but WO-8.8's curated Title 17 table fills it downstream: resolving the
    // B3-2 district now yields the §17-3-0403-A dash-2 FAR of 2.2 (was null).
    const resolved = resolveZoningLimits(res.info.zoning, 'chicago')
    expect(resolved.maxFAR).toBe(2.2)
    // usesForZone: 'B' prefix → commercial + mixed + residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...chicagoRoutesRM5,
        '/MapServer/6/query': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getChicagoParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
  })

  it('returns UPSTREAM_ERROR 502 when the parcels dataset returns a 200 ArcGIS error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...chicagoRoutesRM5, '/MapServer/2025/query': ARCGIS_ERROR_200 }),
    )
    const res = await getChicagoParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcels dataset is empty (exact + buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...chicagoRoutesRM5, '/MapServer/2025/query': { features: [] } }),
    )
    const res = await getChicagoParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
