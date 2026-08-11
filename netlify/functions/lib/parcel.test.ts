import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../parcel'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './providers/__fixtures__'
import { bostonRoutes } from './providers/__fixtures__/boston'
import { LIVE_CITIES } from './parcel'
import {
  CITIES,
  CITIES_WITH_SPECIFIC_HURDLES,
  CITIES_WITH_MEASURED_PERMITS,
} from '../../../src/config/cities'
import { cityCostIndex } from '../../../src/config/estimates'
import { isInBbox } from '../../../src/types/parcel'
import { invokeWithQuery } from './testing/invokeHandler'

const callHandler = (qs: Record<string, string> = {}) => invokeWithQuery(handler, qs)

describe('parcel handler — input validation', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'B-2-65' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { PID: '0304567000', ST_NUM: '1', ST_NAME: 'City Hall Sq' } }]
        }))
      }
      if (u.includes('Historic')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      if (u.includes('NFHL')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { FLD_ZONE: 'X' } }]
        }))
      }
      throw new Error('Unexpected fetch URL: ' + u)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('rejects missing lat/lng with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({})
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.code).toBe('OUT_OF_BBOX')
  })

  it('rejects non-numeric lat with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({ lat: 'banana', lng: '-71.06' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })

  it('rejects out-of-bbox coords (DC) with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({ lat: '38.89', lng: '-77.03' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })

  it('accepts in-bbox coords (Boston City Hall) without 400', async () => {
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).not.toBe(400)
  })
})

describe('parcel handler — normalization', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      // Match each endpoint and return canned data.
      // Use ENDPOINTS constants in real code; literal substrings here.
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'B-2-65', District: 'Downtown', Article: 'Article 8' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { PID: '0304567000', ST_NUM: '1', ST_NAME: 'City Hall Sq', LAND_SF: 12450 } }]
        }))
      }
      if (u.includes('Historic')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      if (u.includes('NFHL')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { FLD_ZONE: 'X' } }]
        }))
      }
      throw new Error('Unexpected fetch URL: ' + u)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('joins all 4 datasets into ParcelInfo', async () => {
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.address).toBe('1 City Hall Sq')
    expect(body.parcelId).toBe('0304567000')
    expect(body.zoning.districtCode).toBe('B-2-65')
    expect(body.zoning.article).toBe('Article 8')
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBe('X')
    expect(body.lot.sizeSqFt).toBe(12450)
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)

    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('Zoning'))).toBe(true)
    expect(calls.some((u) => u.includes('Parcels_24_detailed'))).toBe(true)
    expect(calls.some((u) => u.includes('Historic'))).toBe(true)
    expect(calls.some((u) => u.includes('NFHL'))).toBe(true)
  })
})

describe('parcel handler — zoning dimensional limits', () => {
  afterEach(() => vi.restoreAllMocks())

  it('populates maxHeightFt/maxFAR/allowedUses from real zoning fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: '1', District: 'Stuart Street District', Article: 'Article 43', HeightMax: 155, FARMax: 10, Use_: 'Mixed-Use' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '1', ST_NUM: '1', ST_NAME: 'Stuart St', LAND_SF: 5000 } }] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3493', lng: '-71.0712' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.maxHeightFt).toBe(155)
    expect(body.zoning.maxFAR).toBe(10)
    expect(body.zoning.allowedUses).toEqual(['mixed', 'residential', 'commercial'])
  })

  it('leaves limits null when the zoning service omits them (e.g. Open Space)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'OS-UP', District: 'Open Space', HeightMax: null, FARMax: null, Use_: 'Open Space' } }]
        }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '2', ST_NUM: '0', ST_NAME: 'Cambridge St', LAND_SF: 1000 } }] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.maxHeightFt).toBeNull()
    expect(body.zoning.maxFAR).toBeNull()
    // Use_ "Open Space" still maps to a use list even when dimensions are null.
    expect(body.zoning.allowedUses).toEqual(['institutional'])
  })
})

describe('parcel handler — NYC (MapPLUTO)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('normalizes a MapPLUTO lot into ParcelInfo with per-use FAR', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('MAPPLUTO')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { BBL: '1009950005', Address: '1472 BROADWAY', ZoneDist1: 'C6-7', ResidFAR: 10, CommFAR: 15, FacilFAR: 15, LotArea: 45800, AssessTot: 12500000 } }],
        }))
      }
      if (u.includes('NFHL')) return new Response(JSON.stringify({ features: [{ attributes: { FLD_ZONE: 'X' } }] }))
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ city: 'nyc', lat: '40.7549', lng: '-73.9857' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.address).toBe('1472 BROADWAY')
    expect(body.parcelId).toBe('1009950005')
    expect(body.zoning.districtCode).toBe('C6-7')
    expect(body.zoning.maxHeightFt).toBeNull()
    expect(body.zoning.maxFAR).toBe(15)
    // mixed = min(resid, comm): the conservative bound (WO-5.1) — NYC mixed-use
    // FAR is district-specific and never simply the higher single-use max.
    expect(body.zoning.farByUse).toEqual({ residential: 10, commercial: 15, institutional: 15, mixed: 10 })
    expect(body.zoning.allowedUses).toContain('commercial')
    expect(body.lot.sizeSqFt).toBe(45800)
    expect(body.overlays.floodZone).toBe('X')
    // PLUTO AssessTot → existing.assessedValue, labelled as a ≈45%-of-market proxy.
    expect(body.existing?.assessedValue).toBe(12500000)
    expect(body.existing?.assessedValueBasis).toBe('assessed (≈45% of market for most classes)')
  })

  it('rejects NYC coords outside the NYC bbox with 400', async () => {
    const res = await callHandler({ city: 'nyc', lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })
})

describe('parcel handler — resilience', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns 200 with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({ features: [{ attributes: { Name: 'R-1' } }] }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [{ attributes: { PID: '99', ST_NUM: '99', ST_NAME: 'Main' } }] }))
      }
      throw new Error('upstream offline')
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.zoning.districtCode).toBe('R-1')
    expect(body.address).toBe('99 Main')
    expect(body.parcelId).toBe('99')
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBeNull()
  })

  it('returns 502 when zoning upstream rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) throw new Error('zoning down')
      return new Response(JSON.stringify({ features: [{ attributes: { PID: '1', ST_NUM: '1', ST_NAME: 'x' } }] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
  })

  it('returns 502 (NOT 404) when a required dataset returns HTTP 200 with an ArcGIS error body', async () => {
    // The signature failure mode of a renamed field / re-indexed layer. If
    // this ever reads as NO_PARCEL again, a citywide breakage looks identical
    // to clicking open water. See WO-1.1.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...bostonRoutes, Parcels_24_detailed: ARCGIS_ERROR_200 }),
    )
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
  })

  it('fixture harness happy path matches the inline-mock expectations', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(bostonRoutes))
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.parcelId).toBe('0304567000')
    expect(body.zoning.districtCode).toBe('B-2-65')
    expect(body.existing?.buildingAreaSqFt).toBe(3600)
    // Boston TOTAL_VALUE → existing.assessedValue, labelled as the county total.
    expect(body.existing?.assessedValue).toBe(985000)
    expect(body.existing?.assessedValueBasis).toBe('total assessed (county)')
  })

  it('logs a schema_drift event when a critical field is ABSENT from the parcel attrs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // LAND_SF removed entirely (renamed upstream), not null — null is real data.
    const { LAND_SF: _dropped, ...rest } = (
      bostonRoutes.Parcels_24_detailed.features[0].attributes as Record<string, unknown> & { LAND_SF: number }
    )
    void _dropped
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...bostonRoutes, Parcels_24_detailed: { features: [{ attributes: rest }] } }),
    )
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200) // degraded, not broken
    expect(logSpy.mock.calls.some(([arg]) =>
      typeof arg === 'object' && arg !== null &&
      (arg as { event?: string }).event === 'schema_drift' &&
      (arg as { field?: string }).field === 'LAND_SF',
    )).toBe(true)
  })

  it('does NOT log schema_drift on a complete fixture', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(bostonRoutes))
    await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(logSpy.mock.calls.some(([arg]) =>
      typeof arg === 'object' && arg !== null && (arg as { event?: string }).event === 'schema_drift',
    )).toBe(false)
  })

  it('returns 404 when parcels dataset has no feature at point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({ features: [{ attributes: { Name: 'OS' } }] }))
      }
      if (u.includes('Parcels_24_detailed')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      return new Response(JSON.stringify({ features: [] }))
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).code).toBe('NO_PARCEL')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRING BUNDLE
//
// Adding a city touches several files that have no compile-time relationship to
// one another, and until 2026-08-09 nothing checked that they moved together.
// `parkingRules.test.ts` covered the parking table and `redTapeIndex.test.ts`
// the lifecycle gaps, but the DISPATCHER and the COST INDEX were unguarded: a
// `CITIES` entry with `live: true` and no dispatcher row typechecks perfectly
// and fails only in front of a user, as `OUT_OF_BBOX` for a city the app is
// advertising in its own menu.
//
// These are the same shape as the guards this repo already relies on
// (`hurdles.test.ts` reading branches back out of the code,
// `citiesWithoutParkingRule` deriving its list rather than holding one): the
// registry is the single source of truth and everything else is checked
// AGAINST it, in both directions, so neither an orphan nor an omission passes.
describe('city registry — every live city is wired end to end', () => {
  it('every live registry city has a dispatcher row, and no dispatcher row is an orphan', () => {
    const live = CITIES.filter((c) => c.live).map((c) => c.slug).sort()
    expect([...LIVE_CITIES].sort()).toEqual(live)
  })

  // Without this, a missing index silently becomes `undefined` in the cost
  // multiplication. That is not a crash — it is a NaN or a dropped factor,
  // which is a plausible-looking number, and rule 18 says those are the ones
  // that survive review.
  it('every live registry city has a cost index, and no cost index is an orphan', () => {
    const live = CITIES.filter((c) => c.live).map((c) => c.slug).sort()
    expect(Object.keys(cityCostIndex).sort()).toEqual(live)
    for (const slug of live) {
      const v = cityCostIndex[slug]
      expect(typeof v, `${slug} cost index`).toBe('number')
      expect(Number.isFinite(v), `${slug} cost index`).toBe(true)
      // A location factor is a multiplier around 1.0. The band is deliberately
      // wide — it is here to catch a percentage pasted in unscaled (86.0 rather
      // than 0.86), which is the actual failure mode of this table's source.
      expect(v, `${slug} cost index looks unscaled`).toBeGreaterThan(0.5)
      expect(v, `${slug} cost index looks unscaled`).toBeLessThan(2)
    }
  })

  // The bbox is the coarse first cut, never the jurisdiction gate — but a bbox
  // that is inverted or empty refuses the whole city, so it is worth pinning.
  it('every live city has a non-degenerate bbox and a landmark inside it', () => {
    for (const c of CITIES.filter((x) => x.live)) {
      expect(c.bbox.north, `${c.slug} bbox`).toBeGreaterThan(c.bbox.south)
      expect(c.bbox.east, `${c.slug} bbox`).toBeGreaterThan(c.bbox.west)
      const [lng, lat] = c.landmark
      expect(isInBbox(c.bbox, lat, lng), `${c.slug} landmark outside its own bbox`).toBe(true)
      const [clng, clat] = c.center
      expect(isInBbox(c.bbox, clat, clng), `${c.slug} center outside its own bbox`).toBe(true)
    }
  })

  // Both `CITIES_WITH_*` lists drive a "partial coverage" marker in Compare, so
  // a typo in either reads as a coverage claim about a city that does not
  // exist. `hurdles.test.ts` and `timeline.test.ts` check each list against
  // what is actually encoded; this checks the slugs are real.
  it('no coverage list names a slug that is not in the registry', () => {
    const known = new Set(CITIES.map((c) => c.slug))
    for (const slug of CITIES_WITH_SPECIFIC_HURDLES) {
      expect(known.has(slug), `CITIES_WITH_SPECIFIC_HURDLES names unknown slug ${slug}`).toBe(true)
    }
    for (const slug of CITIES_WITH_MEASURED_PERMITS) {
      expect(known.has(slug), `CITIES_WITH_MEASURED_PERMITS names unknown slug ${slug}`).toBe(true)
    }
  })
})
