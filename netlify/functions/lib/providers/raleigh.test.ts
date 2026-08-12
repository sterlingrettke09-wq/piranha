import { describe, it, expect, vi, afterEach } from 'vitest'
import { getRaleighParcelInfo } from './raleigh'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  raleighRoutes,
  raleighRoutesOakwood,
  raleighRoutesConditional,
  raleighRoutesDx20,
  raleighRoutesCx5,
  raleighRoutesTod,
  raleighRoutesNoZoning,
  raleighHodStreetside,
  raleighNcod,
} from './__fixtures__/raleigh'

// These tests drive the REAL entry point, `getRaleighParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted the live story
// count FIRST and the table's own tests called the resolver directly and passed
// throughout. A height assertion is only meaningful at the boundary a user hits.

// Inside Raleigh (2000 Fairview Rd).
const LAT = 35.804513
const LNG = -78.646281

describe('getRaleighParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (NX-3-UG): address, PIN, lot in sq ft, uses, assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutes))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.address).toBe('2000 FAIRVIEW RD')
    expect(info.parcelId).toBe('1704478963')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('NX-3-UG')

    // Lot area comes from Shape_Area, which IS square feet: the parcel layer is
    // EPSG:2264 (NC State Plane, US survey feet). Verified externally by
    // shoelacing the returned rings in that projection — 25/25 parcels matched
    // Shape_Area to 4 dp. No conversion happens, so no conversion can drift.
    expect(info.lot.sizeSqFt).toBe(5325)

    // The acres column would have produced 0.12 x 43,560 = 5,227 — a 98 sq ft
    // error from the deed's 2-dp rounding. Shape_Area must win.
    expect(info.lot.sizeSqFt).not.toBe(5227)

    expect(info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    expect(info.assessedValue).toBe(1960588)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1925)
    expect(info.existing?.units).toBe(5)
    expect(info.existing?.buildingAreaSqFt).toBe(9532)
    expect(info.existing?.numBuildings).toBe(1)
    // BLDG_VAL is the improvement half only, and says so.
    expect(info.existing?.assessedValue).toBe(1333348)
    expect(info.existing?.assessedValueBasis).toContain('improvement')
    // Owner drives a boolean only; the name never leaves the server.
    expect(JSON.stringify(info)).not.toContain('ROMAS REALTY')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — the unit the code uses, end to end
  // ════════════════════════════════════════════════════════════════════════

  it('NX-3-UG publishes 50 ft AND 3 stories — both figures the UDO prints', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutes))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // UDO Sec. 3.3.1 / 3.3.2: "-3  3 stories / 50 feet max".
    expect(res.info.zoning.maxHeightFt).toBe(50)
    expect(res.info.zoning.maxStories).toBe(3)
    // 3 x 11 and 3 x 12 — what a floor-to-floor convention would have shipped.
    expect(res.info.zoning.maxHeightFt).not.toBe(33)
    expect(res.info.zoning.maxHeightFt).not.toBe(36)
  })

  it('CX-5 publishes 80 ft / 5 stories, not a converted story count', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesCx5))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Sec. 3.3.1 names this one explicitly: "CX-5 has a maximum height limit of
    // 5 stories and 80 feet."
    expect(res.info.zoning.maxHeightFt).toBe(80)
    expect(res.info.zoning.maxStories).toBe(5)
    expect(res.info.zoning.maxHeightFt).not.toBe(60) // 5 x 12
    expect(res.info.zoning.maxHeightFt).not.toBe(55) // 5 x 11
  })

  // THE MIAMI-21 CASE, at the boundary. DX-20 is a district the code states in
  // stories alone. Miami published 87 stories for an 80-story district by
  // multiplying to feet with one constant and dividing back with another. Here
  // the provider must hand the story count through untouched and leave feet
  // null rather than manufacture one.
  it('DX-20 carries 20 stories with feet null — the code states no feet', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesDx20))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxStories).toBe(20)
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // Every product a conversion would have produced.
    for (const c of [10, 11, 12, 13, 14, 15, 16, 17]) {
      expect(res.info.zoning.maxHeightFt).not.toBe(20 * c)
    }
  })

  // R districts are where HEIGHT is null on the wire, so the curated Chapter 2
  // table is the only thing standing between the user and a missing answer.
  it('R-10 resolves 40 ft / 3 stories from the code even though HEIGHT is null on the wire', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesOakwood))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-10')
    expect(res.info.zoning.maxHeightFt).toBe(40) // Sec. 2.2.1 D1
    expect(res.info.zoning.maxStories).toBe(3)
    // The trailing "10" is a density tier, not a storey count (the Denver
    // "B-3" failure: a class code multiplied into a fabricated height).
    expect(res.info.zoning.maxStories).not.toBe(10)
    expect(res.info.zoning.maxHeightFt).not.toBe(120)
  })

  // CLAUDE.md rule 6, at the boundary. R-10's townhouse, apartment and civic
  // columns all read 45'; publishing 45 as the parcel's height would assume a
  // program the user has not chosen. The alternatives must still be VISIBLE.
  it('R-10 headlines 40 ft, never 45, but names the 45 ft programs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesOakwood))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).not.toBe(45)
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('Townhouse option')
    expect(article).toContain('Apartment option')
    expect(article).toContain('45 ft')
    expect(article).toContain('Sec. 2.2.4')
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR — the known absence must never become an assumed 1.0
  // ════════════════════════════════════════════════════════════════════════

  it('every resolved district reports maxFAR null WITH farUnconstrained set', async () => {
    for (const routes of [raleighRoutes, raleighRoutesOakwood, raleighRoutesDx20, raleighRoutesCx5]) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes))
      const res = await getRaleighParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.zoning.maxFAR).toBeNull()
      // Without this flag, maxFAR null falls back to an unsourced FAR of 1.0.
      expect(res.info.zoning.farUnconstrained).toBe(true)
      vi.restoreAllMocks()
    }
  })

  // ════════════════════════════════════════════════════════════════════════
  // A gap must not render as an answer (CLAUDE.md rule 5 / rule 18)
  // ════════════════════════════════════════════════════════════════════════

  // The parcel layer is county-wide; the zoning layer stops at the city limits.
  // So a click in Cary returns real property data and no zoning. That has to
  // read as "we don't know", never as a Raleigh UDO answer applied to a parcel
  // Raleigh does not regulate.
  it('a parcel with no Raleigh zoning yields a GAP, not a fabricated answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesNoZoning))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { zoning } = res.info
    expect(zoning.districtCode).toBe('Unknown')
    expect(zoning.maxHeightFt).toBeNull()
    expect(zoning.maxStories).toBeUndefined()
    expect(zoning.maxFAR).toBeNull()
    expect(zoning.allowedUses).toBeNull()
    // The decisive one: an unresolved district must NOT claim the UDO's known
    // FAR absence. Both carry maxFAR null; only one of them is a claim.
    expect(zoning.farUnconstrained).toBeUndefined()
    // The parcel facts we DO have still come through.
    expect(res.info.lot.sizeSqFt).toBe(5325)
    expect(res.info.assessedValue).toBe(1960588)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Conditional-use districts — 39% of mapped polygons
  // ════════════════════════════════════════════════════════════════════════

  it('a -CU parcel qualifies the height and links the signed ordinance', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesConditional))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.zoning.districtCode).toBe('R-10-CU')
    // The base district still resolves — conditions can only bind BELOW it.
    expect(info.zoning.maxHeightFt).toBe(40)

    // But the figure must never be presented as this site's unqualified
    // ceiling. The notice names the case and says which way conditions cut.
    const article = info.zoning.article ?? ''
    expect(article).toContain('Conditional-use district')
    expect(article).toContain('Z-106-1998')
    expect(article).toMatch(/BELOW the base district/)

    // And the ordinance itself is one click away rather than an abstraction.
    expect(info.sources.zoningConditions).toBe(
      'https://cityofraleigh0drupal.blob.core.usgovcloudapi.net/drupal-prod/COR22/Z-106-98-ORD.pdf',
    )
  })

  it('a non-conditional parcel carries no conditions link and no notice', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutes))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.sources.zoningConditions).toBeUndefined()
    expect(res.info.zoning.article ?? '').not.toContain('Conditional-use')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Overlays
  // ════════════════════════════════════════════════════════════════════════

  it('a general historic overlay populates historicDistrict and subdistrict', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesOakwood))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Oakwood — General Historic Overlay District')
    expect(res.info.zoning.subdistrict).toBe('Oakwood — General Historic Overlay District')
  })

  it('a streetside historic overlay also counts as historic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...raleighRoutes, 'Planning/Overlays/MapServer/8': raleighHodStreetside }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Glenwood-Brooklyn — Streetside Historic Overlay District')
  })

  // NCOD and TOD are real overlays with real consequences, but neither is a
  // preservation-review trigger. Calling either "historic" would be false in a
  // field downstream code reads as exactly that. This is the Nashville defect
  // (an unrelated overlay type winning the historic slot) in reverse.
  it('neighborhood-conservation and transit overlays are NOT reported as historic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...raleighRoutesTod, 'Planning/Overlays/MapServer/9': raleighNcod }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    // They are still surfaced — just in the right slot.
    expect(res.info.zoning.subdistrict).toBe('Trailwood — Neighborhood Conservation Overlay District')
  })

  // UDO Sec. 5.5.1.I lets a mixed-use district's stories rise by 50% inside a
  // -TOD, but only where the added stories are residential AND 20% of their
  // units are deed-restricted affordable at 60% AMI for 30 years. Earned,
  // conditional, elective — never a by-right ceiling (CLAUDE.md rule 6).
  it('the transit overlay never raises the published by-right height', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutesTod))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // CX-5 stays 5 stories / 80 ft with the overlay present.
    expect(res.info.zoning.maxStories).toBe(5)
    expect(res.info.zoning.maxHeightFt).toBe(80)
    // +50% => 7.5 -> 8 stories; +30% => 6.5 -> 7. Neither may appear.
    expect(res.info.zoning.maxStories).not.toBe(8)
    expect(res.info.zoning.maxStories).not.toBe(7)
    // The overlay is still disclosed.
    expect(res.info.zoning.subdistrict).toBe('Transit Overlay District')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('still ok:true with null overlays when every optional fetch rejects', async () => {
    const down = () => {
      throw new Error('overlay down')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...raleighRoutes,
        'Planning/Overlays/MapServer/7': down,
        'Planning/Overlays/MapServer/8': down,
        'Planning/Overlays/MapServer/9': down,
        'Planning/Overlays/MapServer/10': down,
        NFHL: down,
      }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    // A failed overlay fetch must not silently become "no historic district
    // here" in a way that also breaks the zoning answer.
    expect(res.info.zoning.maxHeightFt).toBe(50)
  })

  // ⚠️ THIS TEST USED TO ASSERT THE DEFECT. It read the districtCode as
  // 'Unknown' and called that "a gap", with a rationale citing CLAUDE.md rule 5
  // — but 'Unknown' is exactly what assessDevelopability turns into
  // `no_coverage`, a geographic claim about the parcel, with cost, timeline and
  // hurdles zeroed by analyze.ts. A green test with a well-written reason is the
  // hardest kind to overturn (rule 15); this is the corrected assertion. The
  // EMPTY-answer case above is unchanged, because that one really is a gap.
  it('a zoning fetch that returns an ArcGIS error body REFUSES', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...raleighRoutes, 'Planning/Zoning/MapServer/0': ARCGIS_ERROR_200 }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
    expect(res.message).toMatch(/Raleigh/)
    expect(res.message).not.toMatch(/coverage|neighbou?ring|unincorporated/i)
  })

  it('returns UPSTREAM_ERROR 502 when the parcel layer returns a 200 ArcGIS error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...raleighRoutes, 'Property/Property/MapServer/0': ARCGIS_ERROR_200 }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcel layer is empty (exact + buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...raleighRoutes, 'Property/Property/MapServer/0': { features: [] } }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('falls back to DEED_ACRES only when Shape_Area is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...raleighRoutes,
        'Property/Property/MapServer/0': {
          features: [{ attributes: { PIN_NUM: '1', SITE_ADDRESS: '1 MAIN ST', Shape_Area: null, DEED_ACRES: 0.5 } }],
        },
      }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(21780) // 0.5 x 43,560
  })

  it('reports no lot size rather than zero when neither area field is usable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...raleighRoutes,
        'Property/Property/MapServer/0': {
          features: [{ attributes: { PIN_NUM: '1', SITE_ADDRESS: '1 MAIN ST', Shape_Area: null, DEED_ACRES: null } }],
        },
      }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBeNull()
  })

  it('flags a government owner without returning the owner name', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...raleighRoutes,
        'Property/Property/MapServer/0': {
          features: [
            {
              attributes: {
                PIN_NUM: '1',
                SITE_ADDRESS: '222 W HARGETT ST',
                Shape_Area: 40000,
                OWNER: 'RALEIGH CITY OF',
                TOTAL_VALUE_ASSD: 20542761,
                LAND_CLASS_DECODE: 'Commercial',
              },
            },
          ],
        },
      }),
    )
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
    expect(JSON.stringify(res.info)).not.toContain('RALEIGH CITY OF')
  })

  it('names its upstream sources', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(raleighRoutes))
    const res = await getRaleighParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.sources.parcels).toContain('maps.raleighnc.gov')
    expect(res.info.sources.zoning).toContain('Planning/Zoning/MapServer/0')
    expect(new Date(res.info.fetchedAt).toString()).not.toBe('Invalid Date')
  })
})
