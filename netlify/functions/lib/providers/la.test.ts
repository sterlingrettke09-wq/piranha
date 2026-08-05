import { describe, it, expect, vi, afterEach } from 'vitest'
import { getLaParcelInfo } from './la'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import { laRoutes, laRoutesC42 } from './__fixtures__/la'

// Inside the LA bbox (downtown LA).
const LAT = 34.05
const LNG = -118.24

describe('getLaParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path ([Q]R3-1): address trim, APN, [Q] zone, base-controlled FAR, lot area from 2229 rings', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(laRoutes))
    const res = await getLaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res
    // SitusFullAddress collapsed + split at "LOS ANGELES CA".
    expect(info.address).toBe('123 MAIN ST')
    expect(info.parcelId).toBe('5555001001')
    // districtCode keeps the raw ZONE_CMPLT including the [Q] qualifier.
    expect(info.zoning.districtCode).toBe('[Q]R3-1')
    // laLimits: [Q] stripped → R3-1, tok '1' = HD1. R3 is NOT in the
    // base-controlled R-zone regex (RA|RE|RS|R1|RD|RW|R2), so HD1 FAR 3.0 applies.
    expect(info.zoning.maxFAR).toBe(3.0)
    // CORRECTED 2026-08-05 — this asserted null (no height limit published) on
    // the strength of Height District 1 carrying no cap of its own. It does not,
    // but the base zone does: LAMC § 12.21.1 preamble, "In the A1, A2, RZ, RMP,
    // and RW2 Zones, and in those portions of the RD and R3 Zones, which are
    // also in Height District No. 1, no Building or Structure shall exceed 45
    // feet in height." R3-1 is one of the commonest zone strings in the city.
    expect(info.zoning.maxHeightFt).toBe(45)
    // usesForZone: strip [Q] → R3 → residential + mixed.
    expect(info.zoning.allowedUses).toEqual(['residential', 'mixed'])
    // ZONING_DESCRIPTION surfaced as article.
    expect(info.zoning.article).toBe('Multiple Dwelling Zone')
    // Lot area from polygon geometry in EPSG:2229 ft: 100 x 200 = 20000 sqft.
    expect(info.lot.sizeSqFt).toBe(20000)
    // UseDescription preferred for existing use.
    expect(info.existing?.landUse).toBe('Five or More Apartments')
    expect(info.overlays.floodZone).toBe('X')
    expect(info.overlays.historicDistrict).toBeNull()
    expect(info.overlays.coastalZone).toBeFalsy()
  })

  it('C4-2: height-district 2 resolves FAR 6.0 and commercial uses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(laRoutesC42))
    const res = await getLaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('C4-2')
    // laLimits: C4-2, tok '2' = HD2 → FAR 6.0, no height cap.
    expect(res.info.zoning.maxFAR).toBe(6.0)
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // usesForZone: C → commercial + mixed + residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  it('still ok:true with null overlays when HPOZ + flood + coastal reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...laRoutes,
        'NavigateLA/MapServer/75/query': () => {
          throw new Error('hpoz down')
        },
        Coastal_Zone_Polygon: () => {
          throw new Error('coastal down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getLaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.overlays.coastalZone).toBeFalsy()
  })

  it('returns UPSTREAM_ERROR 502 when the parcels dataset returns a 200 ArcGIS error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...laRoutes, 'LACounty_Parcel/MapServer/0/query': ARCGIS_ERROR_200 }),
    )
    const res = await getLaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcels dataset is empty (exact + buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...laRoutes, 'LACounty_Parcel/MapServer/0/query': { features: [] } }),
    )
    const res = await getLaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
