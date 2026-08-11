import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAustinParcelInfo } from './austin'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'
import type { GeoJsonFeatureCollection } from './__fixtures__'

// Endpoint URL substrings the Austin provider hits (see austin.ts):
//   PARCELS = .../EXTERNAL_tcad_parcel/... → 'EXTERNAL_tcad_parcel'
//   ZONING  = .../Current_Zoning_gdb/...   → 'Current_Zoning_gdb'
//   FLOOD   = FEMA NFHL → 'NFHL'
//   GEOCODE = Mapbox Geocoding v6 reverse → 'api.mapbox.com'
// Austin derives its street address by reverse-geocoding the click point (its
// SITUS field is house-number-only). We make that deterministic by stubbing
// MAPBOX_TOKEN and routing a v6 reverse response.

const LAT = 30.2672
const LNG = -97.7431

// `Partial<typeof …>`, not `Record<string, unknown>`: an override must name a
// field the fixture declares, so a misspelled key is a compile error rather
// than a silent no-op that leaves the base value asserted.
const AUSTIN_PARCEL = { SITUS: '123', PID_10: '0203140112', Shape__Area: 8712 }
const austinParcel = (over: Partial<typeof AUSTIN_PARCEL> = {}) =>
  featureSet({ ...AUSTIN_PARCEL, ...over })

const austinZoning = (base = 'MF-4') =>
  featureSet({ BASE_ZONE: base, ZONE_NAME: 'Multifamily Residence', ZONING_ZTYPE: 'Base' })

// Mapbox reverse geocode — GeoJSON, and annotated so `propertiez`/`featurez`
// is a compile error here rather than an unrouted mock at runtime.
const mapboxV6: GeoJsonFeatureCollection = { features: [{ properties: { name: '123 Congress Ave' } }] }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs() // restoreAllMocks does NOT reset stubEnv; clear MAPBOX_TOKEN
})

describe('getAustinParcelInfo — happy path', () => {
  it('normalizes an MF-4 multifamily parcel with reverse-geocoded address', async () => {
    vi.stubEnv('MAPBOX_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: austinParcel(),
        Current_Zoning_gdb: austinZoning('MF-4'),
        NFHL: featureSet({ FLD_ZONE: 'AE' }),
        'api.mapbox.com': mapboxV6,
      }),
    )

    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Address comes from the mocked Mapbox v6 reverse geocode (name field).
    expect(res.info.address).toBe('123 Congress Ave')
    expect(res.info.parcelId).toBe('0203140112')
    expect(res.info.zoning.districtCode).toBe('MF-4')
    // Shape__Area is trusted as sq ft directly.
    expect(res.info.lot.sizeSqFt).toBe(8712)
    // austinLimits['MF-4'] → h 60, f 0.75.
    expect(res.info.zoning.maxHeightFt).toBe(60)
    expect(res.info.zoning.maxFAR).toBe(0.75)
    // MF prefix → residential, mixed.
    expect(res.info.zoning.allowedUses).toEqual(['residential', 'mixed'])
    expect(res.info.zoning.subdistrict).toBe('Base')
    expect(res.info.zoning.article).toBe('Multifamily Residence')
    expect(res.info.overlays.floodZone).toBe('AE')
    // No published historic layer for Austin.
    expect(res.info.overlays.historicDistrict).toBeNull()
  })

  it('falls back to "Selected location" when no MAPBOX_TOKEN is set', async () => {
    vi.stubEnv('MAPBOX_TOKEN', '')
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: austinParcel(),
        Current_Zoning_gdb: austinZoning('MF-4'),
        NFHL: featureSet(),
        // no mapbox route needed — reverseGeocode short-circuits on empty token.
      }),
    )
    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.address).toBe('Selected location')
  })

  // Was 'pins a downtown CBD zone (h null, f 8.0)'. The height half of that
  // title was retracted 2026-08-05: LDC § 25-2-492(D) states 350 ft for CBD
  // (Ord. No. 20251023-063, Pt. 1, 11-3-25). See austinZoningTable.test.ts.
  it('pins a downtown CBD zone (h 350, f 8.0) and commercial uses', async () => {
    vi.stubEnv('MAPBOX_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: austinParcel(),
        Current_Zoning_gdb: austinZoning('CBD'),
        NFHL: featureSet(),
        'api.mapbox.com': mapboxV6,
      }),
    )
    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(350)
    expect(res.info.zoning.maxFAR).toBe(8.0)
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })
})

describe('getAustinParcelInfo — resilience', () => {
  it('still ok:true with null flood overlay when flood rejects', async () => {
    vi.stubEnv('MAPBOX_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: austinParcel(),
        Current_Zoning_gdb: austinZoning('MF-4'),
        NFHL: () => {
          throw new Error('flood down')
        },
        'api.mapbox.com': mapboxV6,
      }),
    )
    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('0203140112')
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.stubEnv('MAPBOX_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: ARCGIS_ERROR_200,
        Current_Zoning_gdb: austinZoning('MF-4'),
        NFHL: featureSet(),
        'api.mapbox.com': mapboxV6,
      }),
    )
    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.stubEnv('MAPBOX_TOKEN', 'test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        EXTERNAL_tcad_parcel: featureSet(),
        Current_Zoning_gdb: austinZoning('MF-4'),
        NFHL: featureSet(),
        'api.mapbox.com': mapboxV6,
      }),
    )
    const res = await getAustinParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})
