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
    // RH-2 has no residential FAR because § 124(b) EXEMPTS Residential Uses —
    // an answer, not a gap. (The comment that used to sit here, "SF is
    // form-based, not FAR-based", is the unsourced claim retracted in
    // zoning/sf.ts; it survived here after being corrected there.) The flag is
    // the whole point of the fix, so pin it rather than just the null.
    expect(info.zoning.maxFAR).toBeNull()
    expect(info.zoning.farUnconstrained).toBe(true)
    // Per-USE: the same RH-2 lot still carries the 1.8 Table 124 figure for
    // non-residential work, so a commercial project can't inherit the null.
    expect(info.zoning.farByUse?.commercial).toBe(1.8)
    // Lot area from the polygon rings (EPSG:2227 US ft): 50 x 100 = 5000 sqft.
    expect(info.lot.sizeSqFt).toBe(5000)
    // Land use → existing use + units.
    expect(info.existing?.landUse).toBe('Residential building')
    expect(info.existing?.units).toBe(2)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.overlays.historicDistrict).toBeNull()
  })

  // gen_hght's non-numeric height districts are repdigit sentinels. All nine
  // observed in a distinct-value query of layer 5 on 2026-08-05, with their
  // `height` labels: 1111 USCG/Caltrans, 2222 None Stated, 3333 Job Corps,
  // 4444 Special Height District, 5555 CP, 6666 HP, 7777 HP-RA, 8888 MB-RA,
  // 9999 OS. None is a height in feet.
  it.each([1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999])(
    'treats the gen_hght %s sentinel as null height',
    async (sentinel) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        mockArcgisFetch({ ...sfRoutes, '/MapServer/5/query': { features: [{ attributes: { gen_hght: sentinel } }] } }),
      )
      const res = await getSfParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.zoning.maxHeightFt).toBeNull()
    },
  )

  it('keeps gen_hght 1000 — the real "1000-S-2" district, previously dropped', async () => {
    // WHAT SHIPPED: `ghRaw < 1000`, which excluded the single polygon whose
    // `height` label reads "1000-S-2" and published maxHeightFt null for it.
    // The lowest sentinel is 1111, so the boundary belongs at <= 1000.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...sfRoutes, '/MapServer/5/query': { features: [{ attributes: { gen_hght: 1000 } }] } }),
    )
    const res = await getSfParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(1000)
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
