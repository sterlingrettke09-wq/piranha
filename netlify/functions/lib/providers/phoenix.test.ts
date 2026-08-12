import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPhoenixParcelInfo } from './phoenix'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  phoenixRoutes,
  phoenixRoutesHistoric,
  phoenixRoutesR5,
  phoenixRoutesC3,
  phoenixRoutesRe35,
  phoenixRoutesDowntown,
  phoenixRoutesCommercePark,
  phoenixRoutesPud,
  phoenixRoutesOutsideCity,
  phoenixRoutesCityBoundaryDown,
  phoenixRoutesCityOwned,
  phoenixRoutesNoSupplement,
} from './__fixtures__/phoenix'

// These tests drive the REAL entry point, `getPhoenixParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live storey count
// FIRST and the table's own tests called the resolver directly and passed
// throughout. A limit assertion is only meaningful at the boundary a user hits.

// 805 W Amelia Ave — the probe parcel's own polygon centroid.
const LAT = 33.493479
const LNG = -112.08442

describe('getPhoenixParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (R1-6): address, APN, lot in sq ft, uses, valuation', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    // Composed from the layer's own STREET_* components. The raw ADDRESS field
    // is "805 W AMELIA AVE   PHOENIX  85013" — city and ZIP appended, runs of
    // internal spaces — and is not what a user should see.
    expect(info.address).toBe('805 W AMELIA AVE')
    expect(info.parcelId).toBe('110-11-022')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('R1-6')

    // SHAPE.STArea() IS square feet: the layer's native SR is EPSG:2868
    // (NAD83(HARN) Arizona Central, feet). Verified externally by requesting
    // geometry at outSR=2868 and shoelacing the rings — 6 of 6 sampled parcels
    // reproduced the stored value at ratio 1.000000. No conversion happens here,
    // so no conversion can drift.
    expect(info.lot.sizeSqFt).toBe(7025)

    expect(info.zoning.allowedUses).toEqual(['residential'])
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1952)
    expect(info.existing?.buildingAreaSqFt).toBe(1510)
    expect(info.existing?.stories).toBe(1)
    expect(info.assessedValue).toBe(422000)
    expect(info.sources.zoningCode).toContain('phoenix.municipal.codes')
    expect(info.sources.assessor).toContain('mcassessor.maricopa.gov')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — both units, neither derived
  // ════════════════════════════════════════════════════════════════════════

  // Table 613.1 row (10), column (A): "2 stories and 30 feet". Both figures are
  // the code's own and both must survive to the output.
  it('R1-6 publishes 30 ft AND 2 storeys, exactly as Table 613.1 states', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(30)
    expect(res.info.zoning.maxStories).toBe(2)
  })

  it('R-5 publishes 48 ft AND 4 storeys', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesR5))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(48)
    expect(res.info.zoning.maxStories).toBe(4)
  })

  // THE MIAMI-21 CASE, at the boundary. The PRD column of R1-6's own table
  // prints 3 storeys at the SAME 30 feet, so no floor-to-floor constant exists.
  // Nothing in this pipeline may turn a height into a storey count or back.
  it('never derives a storey count from feet anywhere in the output', async () => {
    // Every route whose district states feet only. `maxStories` must be ABSENT,
    // not zero and not a quotient.
    for (const routes of [phoenixRoutesCommercePark]) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes))
      const res = await getPhoenixParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.zoning.maxHeightFt).toBe(56)
      expect('maxStories' in res.info.zoning).toBe(false)
      vi.restoreAllMocks()
    }
  })

  // The article restates the conjunction in words, because the UI shows feet and
  // storeys in separate columns and the "and" is the code's.
  it('says in words that both figures are stated and neither was derived', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('2 stories and 30 ft')
    expect(res.info.zoning.article).toContain('neither was derived from the other')
    expect(res.info.zoning.article).toContain('Table 613.1')
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR: an answer, a refusal, and a gap must render differently
  // ════════════════════════════════════════════════════════════════════════

  it('R1-6: the code imposes NO floor-area ratio, and the output says so', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
    expect(res.info.zoning.article).toContain('imposes NO floor-area ratio')
    expect(res.info.zoning.article).toContain('not a gap in our data')
    // And the density that governs instead is stated, with its denominator.
    expect(res.info.zoning.article).toContain('5.5 dwelling units per GROSS acre')
  })

  // ⚠️ THE REFUSAL. §626.H.1's Commerce Park table HAS a FAR row (0.5 / 1.0 on
  // the two unmapped options) and holds an em dash on this one. A blank cell is
  // not a stated absence, so this district must NOT claim the code imposes no
  // FAR — even though 34 of its neighbours in the same table do.
  it('a Commerce Park parcel refuses farUnconstrained and explains why', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesCommercePark))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('CP/GCP')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).not.toContain('imposes NO floor-area ratio')
    expect(res.info.zoning.article).toContain('em dash')
  })

  // A district Chapter 12 governs and this build did not read. It must come back
  // with its code visible and nothing asserted — above all no farUnconstrained,
  // which would tell a reader the code imposes no FAR when nobody has looked.
  it('an uncurated Downtown Code district is a GAP, not an absence', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesDowntown))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('DTC-BCORE')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect('maxStories' in res.info.zoning).toBe(false)
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
    expect(res.info.zoning.article).toBeNull()
    // The parcel itself still resolves — a zoning gap is not a parcel failure.
    expect(res.info.address).toBe('130 N CENTRAL AVE')
    expect(res.info.lot.sizeSqFt).toBe(6915)
  })

  // PUD standards live in the applicant-authored narrative the Council approved.
  // A height, a density and a coverage limit DO apply; we cannot read them. That
  // must read as incomplete, never as unregulated.
  it('PUD reads as plan-governed, and does not claim the FAR is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesPud))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('PUD')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('not from a district table')
    expect(res.info.zoning.article).toContain('INCOMPLETE, not absent')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The county-parcels / city-zoning mismatch
  // ════════════════════════════════════════════════════════════════════════

  // The parcel layer is all 1,759,634 Maricopa County parcels; the zoning layer
  // stops at the Phoenix city limits. Scottsdale sits INSIDE PHOENIX_BBOX, so no
  // bounding box separates it.
  //
  // A zoning gap alone was NOT enough. Before the gate, this returned ok:true
  // with '5719 E THOMAS RD', a 48,454 sq ft lot and a $2.6M valuation, missing
  // only the district — and a lot area is all the cost engine needs to print a
  // confident dollar figure for land Phoenix does not zone.
  it('a real county parcel outside Phoenix is REFUSED, not answered with a gap', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesOutsideCity))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
    expect(res.message).toContain('outside the City of Phoenix')
    // Nothing about the Scottsdale parcel escapes.
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('128-43-002B')
    expect(serialized).not.toContain('THOMAS')
    expect(serialized).not.toContain('48453')
  })

  // Degrading OPEN is deliberate, matching columbus.ts: refusing a real Phoenix
  // address because an optional layer timed out is a worse failure than the one
  // the gate prevents, and an out-of-city point still surfaces as a zoning gap
  // without it.
  it('the jurisdiction gate degrades OPEN when the boundary layer fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch(phoenixRoutesCityBoundaryDown),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R1-6')
  })

  // The gate must read the point itself, for the same reason the zoning fetch
  // below does: a 30 m buffered retry is exactly what handed a Scottsdale parcel
  // a Phoenix district in the live run.
  it('queries the city-boundary layer at the EXACT point, with no buffered snap', async () => {
    const urls: string[] = []
    const inner = mockArcgisFetch(phoenixRoutes)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return inner(input)
    })
    await getPhoenixParcelInfo(LAT, LNG)
    const gateUrls = urls.filter((u) => u.includes('CityBoundary/MapServer/0'))
    expect(gateUrls.length).toBeGreaterThan(0)
    for (const u of gateUrls) expect(u).not.toContain('distance=')
  })

  // ⚠️ THE GUARD FOR A DEFECT THE FIXTURES COULD NOT SEE. The provider first
  // fetched zoning with `fetchParcelSnap`, whose buffered retry snaps to the
  // nearest polygon within 30 m. Every fixture test passed — the out-of-city
  // fixture routes zoning to zero features, so the code was never asked to
  // resolve a near-miss — and the LIVE run then returned `districtCode: R1-10`
  // for a Scottsdale parcel, complete with a Phoenix height and
  // `farUnconstrained: true`.
  //
  // A comment documents a mistake; a structure prevents it (rule 14). The
  // structure here is this assertion: the zoning request must carry no
  // `distance` parameter, so reintroducing the snap fails the suite rather than
  // waiting for someone to run the real thing again.
  it('queries the zoning layer at the EXACT point, with no buffered snap', async () => {
    const urls: string[] = []
    const inner = mockArcgisFetch(phoenixRoutes)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return inner(input)
    })
    await getPhoenixParcelInfo(LAT, LNG)
    const zoningCalls = urls.filter((u) => u.includes('/Zoning/MapServer/0/query'))
    expect(zoningCalls.length).toBeGreaterThan(0)
    for (const u of zoningCalls) {
      expect(u, 'the zoning query must not be buffered').not.toContain('distance=')
      expect(u).not.toContain('esriSRUnit_Meter')
    }
    // The PARCEL fetch keeps its snap: the parcel layer does NOT cover
    // rights-of-way (checked live at four street-centre points), so a click on a
    // street would otherwise return no parcel at all.
    expect(urls.some((u) => u.includes('COUNTY_PARCELS/MapServer/3'))).toBe(true)
  })

  // ⚠️ THE DECOY. The assessor's supplemental table publishes CITY_ZONING, which
  // looks like the district and is not: measured over 60 sampled Phoenix parcels
  // it disagrees with the City's own polygon on 4, and on the Scottsdale row it
  // reads 'S-R' — another city's vocabulary. If it ever reached the resolver,
  // this parcel would be given Phoenix limits for a Scottsdale district.
  it('never reads the assessor CITY_ZONING column, at any point in the output', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesOutsideCity))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    // Since the jurisdiction gate landed, this parcel is refused outright — so
    // the assertion is now on the whole response rather than on `info`. That is
    // a stronger claim, not a weaker one: another city's district code must not
    // appear anywhere the caller can read, refusal included.
    expect(res.ok).toBe(false)
    expect(JSON.stringify(res)).not.toContain('S-R')
  })

  it('does not request CITY_ZONING from the upstream at all', async () => {
    const urls: string[] = []
    const inner = mockArcgisFetch(phoenixRoutes)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return inner(input)
    })
    await getPhoenixParcelInfo(LAT, LNG)
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.some((u) => u.includes('CITY_ZONING'))).toBe(false)
  })

  // ════════════════════════════════════════════════════════════════════════
  // The assessor join
  // ════════════════════════════════════════════════════════════════════════

  // The geometry layer's APN is DASHED ('110-11-022'); the supplemental table's
  // own APN column is not ('11011022') and its APN_DASH column is. Joining on
  // the similarly named wrong column returns zero rows on every parcel and looks
  // completely healthy — year built, storeys and valuation would all be null
  // citywide, forever.
  it('joins the assessor table on APN_DASH, not on APN', async () => {
    const urls: string[] = []
    const inner = mockArcgisFetch(phoenixRoutes)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return inner(input)
    })
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    const supplementCall = urls.find((u) => u.includes('COUNTY_PARCELS/MapServer/4'))
    expect(supplementCall).toBeDefined()
    // URLSearchParams encodes the spaces as '+', so decode both.
    const decoded = decodeURIComponent(supplementCall!).replace(/\+/g, ' ')
    expect(decoded).toContain("where=APN_DASH = '110-11-022'")
    expect(decoded).not.toContain("where=APN =")
  })

  it('degrades when the assessor table has no row for the parcel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesNoSupplement))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.assessedValue).toBeNull()
    expect(res.info.existing?.yearBuilt ?? null).toBeNull()
    // The parcel, lot and zoning are unaffected.
    expect(res.info.lot.sizeSqFt).toBe(7025)
    expect(res.info.zoning.districtCode).toBe('R1-6')
    expect(res.info.zoning.maxHeightFt).toBe(30)
  })

  // LIVING_SPACE reads '0.00' on this 100+ unit apartment complex — it is the
  // assessor's RESIDENTIAL living-area field and is unpopulated for multi-family
  // and commercial classes. A published 0 would read as "no building here".
  it('maps a zero living area to null rather than publishing a zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesR5))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.buildingAreaSqFt ?? null).toBeNull()
    expect(res.info.existing?.yearBuilt).toBe(1985)
    expect(res.info.existing?.stories).toBe(2)
  })

  // CONST_YEAR arrives as four spaces when the assessor has no year — not null,
  // not '0'. Number('    ') is 0, which would publish year zero.
  it('treats a whitespace CONST_YEAR as absent, not as year zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesCommercePark))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.yearBuilt ?? null).toBeNull()
    expect(res.info.existing?.stories ?? null).toBeNull()
    // The right-padded valuation string still parses.
    expect(res.info.assessedValue).toBe(11907600)
  })

  // Arizona publishes TWO values per parcel and they are not close: measured
  // over 6,000 sampled Phoenix rows, LPV/FCV has a median of 0.48 and never
  // exceeded 1.0. Labelling the wrong one would understate by roughly half.
  it('labels the value as Full Cash Value, not the Limited Property Value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.assessedValueBasis).toContain('FULL CASH VALUE')
    expect(res.info.existing?.assessedValueBasis).toContain('NOT the Limited Property Value')
    // The LPV must not leak into the output under any key.
    expect(JSON.stringify(res.info)).not.toContain('162262')
  })

  // No layer on this server publishes a dwelling-unit count. The assessor's use
  // description says "APARTMENTS 100+ UNITS 2 STORY", which is a class label; a
  // parsed 100 would flow straight into the no-net-loss check.
  it('publishes no unit count, and does not mine one from the use description', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesR5))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.units).toBeUndefined()
    expect(res.info.existing?.landUse).toBe('APARTMENTS 100+ UNITS 2 STORY')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Addresses, overlays and historic
  // ════════════════════════════════════════════════════════════════════════

  // One captured row has ADDRESS = eight spaces and every STREET_* component
  // null. Whitespace-only must not become an address.
  it('falls back cleanly when the parcel has no address at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesCommercePark))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.address).toBe('Selected location')
    expect(res.info.parcelId).toBe('101-14-008S')
  })

  // The ADDRESS on a Phoenix-zoned, Phoenix-jurisdiction parcel can name a
  // different city. Nothing may read a jurisdiction out of it.
  it('does not read a jurisdiction out of the address string', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesPud))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.address).toBe('9910 W MONTEBELLO AVE')
    expect(res.info.zoning.districtCode).toBe('PUD')
  })

  // Measured: one point returns THREE overlay polygons, only the first marked
  // REGULATORY = 'Yes'. The provider must not assume exactly one comes back, and
  // must distinguish an overlay that changes the rules from one that does not.
  it('survives a point under several overlays and marks the regulatory one', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesC3))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('Transit Overlay District (TOD-1) (regulatory)')
    expect(res.info.zoning.article).toContain('TOD District - Midtown')
    expect(res.info.zoning.article).toContain('can bind BELOW the base district')
    // C-3's own standard limb, with the core-area limb disclosed but not taken.
    expect(res.info.zoning.maxHeightFt).toBe(30)
    expect(res.info.zoning.maxStories).toBe(2)
    expect(res.info.zoning.article).toContain('Core-area / Central Avenue limb')
  })

  it('a non-regulatory special planning district is still surfaced, unmarked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesRe35))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('Arcadia Camelback SPD')
    expect(res.info.zoning.article).not.toContain('Arcadia Camelback SPD (regulatory)')
    expect(res.info.zoning.maxHeightFt).toBe(30)
  })

  it('names the historic district from the register layer, not from the HP suffix', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesHistoric))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Campus Vista Historic District')
    // The zoning layer's HISTORIC='HP' is present too, but the named listing is
    // the better answer and wins.
    expect(res.info.overlays.historicDistrict).not.toContain('§810')
  })

  it('reports a bare HP zoning suffix AS a suffix when no listing is named', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...phoenixRoutesHistoric, 'HistoricProperties/MapServer/0': { features: [] } }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toContain('§810')
    expect(res.info.overlays.historicDistrict).toContain('the register listing is not named')
  })

  it('leaves historicDistrict null where neither signal is present', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutes))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // Ownership and privacy
  // ════════════════════════════════════════════════════════════════════════

  it('never returns the owner name, only the derived public-ownership boolean', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesC3))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(JSON.stringify(res.info)).not.toContain('MASYNO')
    expect(res.info.existing?.ownerPublic).toBeUndefined()
  })

  it('flags city-owned land', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(phoenixRoutesCityOwned))
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
    expect(JSON.stringify(res.info)).not.toContain('CITY OF PHOENIX')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Upstream failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('reports an upstream failure as 502, not as "no parcel here"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...phoenixRoutes,
        'COUNTY_PARCELS/MapServer/3': () => {
          throw new Error('parcel service down')
        },
      }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  // ArcGIS reports a malformed query or a renamed field as HTTP 200 with an
  // error body. Read as a feature set it has no `.features`, which would look
  // exactly like clicking open desert.
  it('treats a 200-with-error-JSON parcel response as an upstream failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...phoenixRoutes, 'COUNTY_PARCELS/MapServer/3': ARCGIS_ERROR_200 }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  it('degrades gracefully when only the optional layers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...phoenixRoutes,
        'ZoningOverlays/MapServer/0': () => {
          throw new Error('overlays down')
        },
        'HistoricProperties/MapServer/0': () => {
          throw new Error('historic down')
        },
        'COUNTY_PARCELS/MapServer/4': () => {
          throw new Error('assessor table down')
        },
        NFHL: () => {
          throw new Error('fema down')
        },
      }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R1-6')
    expect(res.info.zoning.maxHeightFt).toBe(30)
    expect(res.info.zoning.maxStories).toBe(2)
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.assessedValue).toBeNull()
  })

  it('returns NO_PARCEL when the parcel layer has nothing at the point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...phoenixRoutes, 'COUNTY_PARCELS/MapServer/3': { features: [] } }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  // ════════════════════════════════════════════════════════════════════════
  // THE ZONING STATE SPLIT
  //
  // "The service did not answer" and "the service answered and no polygon
  // covers this point" are different facts and used to render identically, as
  // `districtCode: 'Unknown'`. Downstream that is `assessDevelopability` →
  // `developable: false, kind: 'no_coverage'` → *"It may sit in a neighboring
  // city or unincorporated area that isn't in the zoning data we cover yet"*,
  // with cost, timeline and hurdles zeroed. Measured live 2026-08-11: 7 of 20
  // answered Phoenix parcels in one batch, 0 of 81 isolated calls hours later.
  //
  // These four tests pin BOTH arms. Pinning only the failure arm would let a
  // fix that refuses on every empty result pass — and that would break the
  // Scottsdale gate, which depends on an empty zoning answer meaning something.
  // ════════════════════════════════════════════════════════════════════════

  it('a zoning TRANSPORT failure refuses; it never becomes a coverage claim', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...phoenixRoutes,
        'Zoning/MapServer/0': () => {
          throw new Error('zoning service down')
        },
      }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
    // The copy is part of the fix. It must say the service failed and the answer
    // is unknown — and it must not NAME the claim it replaces, even to deny it
    // (rule 21). This assertion rejected the first draft of the message, which
    // read "it does not mean the site is outside our coverage".
    expect(res.message).toMatch(/couldn’t reach/i)
    expect(res.message).toContain('zoning')
    expect(res.message).toMatch(/don’t know|no reading/i)
    expect(res.message).not.toMatch(/neighboring city|unincorporated|coverage|unzoned|undevelopable/i)
    // And nothing answer-shaped escapes: no district, no lot, no valuation.
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('Unknown')
    expect(serialized).not.toContain('7025')
  })

  it('a 200-with-error-JSON zoning body refuses too', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...phoenixRoutes, 'Zoning/MapServer/0': ARCGIS_ERROR_200 }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  // The OTHER arm, and the reason the refusal cannot simply be "empty means
  // error". An empty zoning answer inside the city limits is a real gap, and
  // out-of-city it is what the Scottsdale gate reads.
  it('an EMPTY zoning answer is still an answer: Unknown, not a refusal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...phoenixRoutes, 'Zoning/MapServer/0': { features: [] } }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // A gap, never the known-absence flag.
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
  })

  // The retry is bounded and real, not decorative. Pinned by COUNT so it cannot
  // silently become zero retries (green because nothing failed) or an unbounded
  // loop. Two zoning queries, then the third succeeds.
  it('retries a transient zoning failure and resolves, without a second parcel query', async () => {
    let zoningCalls = 0
    let parcelCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...phoenixRoutes,
        'COUNTY_PARCELS/MapServer/3': () => {
          parcelCalls++
          return phoenixRoutes['COUNTY_PARCELS/MapServer/3']
        },
        'Zoning/MapServer/0': () => {
          zoningCalls++
          if (zoningCalls < 3) throw new Error('transient reset')
          return phoenixRoutes['Zoning/MapServer/0']
        },
      }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R1-6')
    expect(zoningCalls).toBe(3)
    // A healthy required read must not be retried — the retry is per-read, not
    // per-request.
    expect(parcelCalls).toBe(1)
  })

  it('gives up after a bounded number of zoning attempts rather than looping', async () => {
    let zoningCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...phoenixRoutes,
        'Zoning/MapServer/0': () => {
          zoningCalls++
          throw new Error('zoning service down')
        },
      }),
    )
    const res = await getPhoenixParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    expect(zoningCalls).toBe(3)
  })
})
