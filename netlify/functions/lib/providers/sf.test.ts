import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSfParcelInfo } from './sf'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import { sfRoutes } from './__fixtures__/sf'

// SF coordinates inside the SF bbox (Mission District-ish).
const LAT = 37.76
const LNG = -122.42

describe('getSfParcelInfo', () => {
  beforeEach(() => {
    // reverseGeocode only fetches Mapbox when a token is set; leave it unset so
    // the happy path is deterministic and never touches api.mapbox.com. SF only
    // reverse-geocodes when the parcel street is missing, which it isn't here.
    vi.stubEnv('MAPBOX_TOKEN', '')
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('happy path: assembles address, parcel id, zoning, lot area, height', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(sfRoutes))
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res
    // Address assembled from from_st + street + st_type.
    expect(info.address).toBe('123 Main St')
    expect(info.parcelId).toBe('0123A045')
    expect(info.zoning.districtCode).toBe('RH-2')
    expect(info.zoning.subdistrict).toBe('RH-2')
    // Height from the Height Districts layer (gen_hght).
    expect(info.zoning.maxHeightFt).toBe(40)
    // SF is form-based, not FAR-based.
    expect(info.zoning.maxFAR).toBeNull()
    // Lot area from the polygon rings (EPSG:2227 US ft): 50 x 100 = 5000 sqft.
    expect(info.lot.sizeSqFt).toBe(5000)
    // Land use → existing use + units.
    expect(info.existing?.landUse).toBe('Residential building')
    expect(info.existing?.units).toBe(2)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.overlays.historicDistrict).toBeNull()
  })

  it('treats the gen_hght 9999 no-limit sentinel as null height', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...sfRoutes, '/MapServer/5/query': { features: [{ attributes: { gen_hght: 9999 } }] } }),
    )
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
  })

  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...sfRoutes,
        '/MapServer/17/query': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('0123A045')
  })

  it('returns UPSTREAM_ERROR 502 when the parcels dataset returns a 200 ArcGIS error body', async () => {
    // The snap helper retries once, so route serves the error body on every call.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...sfRoutes, '/MapServer/23/query': ARCGIS_ERROR_200 }),
    )
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcels dataset is empty (exact + buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...sfRoutes, '/MapServer/23/query': { features: [] } }),
    )
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
