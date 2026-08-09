import { describe, it, expect, vi, afterEach } from 'vitest'
import { getColumbusParcelInfo } from './columbus'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  columbusRoutes,
  columbusRoutesUCT,
  columbusRoutesLUCRPD,
  columbusRoutesDD,
  columbusRoutesOffSchedule,
  columbusRoutesUniversity,
  columbusRoutesOutsideCity,
  columbusRoutesCondoStack,
} from './__fixtures__/columbus'

// These tests drive the REAL entry point, `getColumbusParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live story count
// FIRST and the table's own tests called the resolver directly and passed
// throughout. A height assertion is only meaningful at the boundary a user hits.

// 148 Dakota Ave, Franklinton.
const LAT = 39.956
const LNG = -83.027

describe('getColumbusParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (R2F): address, parcel id, lot from ACRES, uses, assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutes))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.address).toBe('148 DAKOTA AVE')
    expect(info.parcelId).toBe('010-009995')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('R2F')

    // ACRES 0.09916554 x 43,560 = 4,319.65 -> 4,320.
    expect(info.lot.sizeSqFt).toBe(4320)
    expect(info.zoning.allowedUses).toEqual(['residential'])
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1893)
    expect(info.existing?.assessedValue).toBe(380400)
    expect(info.existing?.assessedValueBasis).toContain('improvement')
    // Top-level value is the Auditor's TOTAL appraised (market) figure.
    expect(info.assessedValue).toBe(398900)
    // The owner name drives a boolean only and never leaves the server.
    expect(JSON.stringify(info)).not.toContain('PRIVATE OWNER')
  })

  // ── LOT AREA: the decoy field must be unreachable ────────────────────────
  it('never reads STATEDAREA — it is square feet on most parcels and acres on some', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutes))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // The fixture's STATEDAREA is 4320 — the same number ACRES produces here,
    // which is exactly why this parcel alone could not discriminate. So assert
    // on the request instead: the field is never even asked for.
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const parcelQuery = calls.map((c) => String(c[0])).find((u) => u.includes('MapServer/5/query'))
    expect(parcelQuery).toBeTruthy()
    expect(parcelQuery).toContain('ACRES')
    expect(parcelQuery).not.toContain('STATEDAREA')
  })

  it('the Easton case: ACRES and STATEDAREA differ by 43,560x and ACRES wins', async () => {
    // 846 S High St: ACRES 0.26539562 (= 11,561 sf) and STATEDAREA 11561. The
    // Easton mall parcel is the inverse (STATEDAREA 61.71 against ACRES 60.99),
    // so a provider that guessed the unit would be wrong on one of the two.
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesUCT))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(11561)
  })

  // ════════════════════════════════════════════════════════════════════════
  // TWO CODES, ONE CITY — at the boundary a user actually hits
  // ════════════════════════════════════════════════════════════════════════

  it('a Title 34 (UCT) parcel publishes 5 stories AND 60 ft — both code-stated', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesUCT))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // C.C. Title 34 E.20.060, Division D: Stories 5 max, Height 60' max.
    expect(res.info.zoning.maxStories).toBe(5)
    expect(res.info.zoning.maxHeightFt).toBe(60)
    // What a floor-to-floor convention would have manufactured.
    expect(res.info.zoning.maxHeightFt).not.toBe(55) // 5 x 11
    expect(res.info.zoning.maxHeightFt).not.toBe(65) // 5 x 13
    // The bonus row (7 stories / 85') is earned under Ch. G.30 and must never
    // be the ceiling.
    expect(res.info.zoning.maxHeightFt).not.toBe(85)
    expect(res.info.zoning.maxStories).not.toBe(7)
    expect(res.info.zoning.article).toContain('earned, not by-right')
    expect(res.info.zoning.article).toContain('2024 Zoning Code')
  })

  // THE COLLISION. LUCRPD is Title 33's University-College Research Park, and a
  // prefix match on "UCR" would send it through Title 34's Urban Core table and
  // publish 12 stories / 150 ft for a parcel the map caps at 110 feet. 46
  // polygons carry UCRPD or LUCRPD.
  it('LUCRPD resolves 110 ft from the mapped height district, NOT Urban Core', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesLUCRPD))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('LUCRPD')
    expect(res.info.zoning.maxHeightFt).toBe(110) // C.C. 3309.14(C)
    expect(res.info.zoning.maxHeightFt).not.toBe(150) // Title 34 E.20.070
    // Title 33 states no story count anywhere — it must not appear.
    expect(res.info.zoning.maxStories).toBeUndefined()
    expect(res.info.zoning.article).toContain('Title 33')
  })

  it('a Title 33 parcel never publishes a story count', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutes))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(35)
    expect(res.info.zoning.maxStories).toBeUndefined()
    // And no arithmetic anywhere turned 35 ft into a floor count.
    for (const k of [10, 11, 12, 13, 14]) {
      expect(res.info.zoning.maxStories).not.toBe(Math.floor(35 / k))
    }
  })

  // ════════════════════════════════════════════════════════════════════════
  // GAPS RENDER AS GAPS
  // ════════════════════════════════════════════════════════════════════════

  it('an off-schedule height symbol yields NO height and says why', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesOffSchedule))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // The map says H-65. Ord. 0538-2025 § 2, which placed this polygon, says
    // "a Height District of sixty (60) feet is hereby established". Neither
    // number may be published.
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.maxHeightFt).not.toBe(65)
    expect(res.info.zoning.article).toContain('No height limit published')
    expect(res.info.zoning.article).toContain('3309.14')
    // The ordinance is linked so a reader can go and check.
    expect(res.info.sources.zoningOrdinance).toContain('legistar')
  })

  it('H-UNLTD downtown is a gap, not an unlimited height', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesDD))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('DD')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.article).toContain('H-UNLTD')
    expect(JSON.stringify(res.info)).not.toContain('heightUnconstrained')
    // The Downtown District still has a known FAR absence — the height gap and
    // the FAR answer are independent.
    expect(res.info.zoning.farUnconstrained).toBe(true)
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR: rule 5, at the boundary
  // ════════════════════════════════════════════════════════════════════════

  it('a Title 33 base district reports the FAR absence, never a 1.0 fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutes))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
  })

  // C.C. Ch. 3325 imposes a real FAR inside the University District overlay,
  // and C.C. 3304.03(H) applies it to 2024 Zoning Code parcels too. So the
  // absence claim must be WITHHELD on a Title 34 parcel there — which is a
  // combination that exists in the live data (1494 N High St).
  it('inside the University District overlay, farUnconstrained is withheld', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesUniversity))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('UCR')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('Floor-area ratio unresolved')
    expect(res.info.zoning.article).toContain('3325')
    // Height is unaffected — Ch. 3325 is a FAR/design overlay.
    expect(res.info.zoning.maxHeightFt).toBe(150)
    expect(res.info.zoning.maxStories).toBe(12)
  })

  it('a site-specific (limited/planned) district is a FAR gap with the ceiling labelled', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesLUCRPD))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('Site-specific zoning')
    expect(res.info.zoning.article).toContain('BELOW the figures shown')
  })

  // ════════════════════════════════════════════════════════════════════════
  // JURISDICTION AND STABILITY
  // ════════════════════════════════════════════════════════════════════════

  // The county parcel layer answers for Dublin, Grove City, Gahanna and the
  // rest; the zoning layer does not. Without the Corporate Boundary gate a
  // suburban address returns a real parcel with a real lot size and a null
  // district — a correct render of a gap, and a useless answer for land the
  // tool does not cover.
  it('a parcel outside the city limits is refused, not answered', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesOutsideCity))
    const res = await getColumbusParcelInfo(40.0992, -83.1141)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
    expect(res.message).toContain('outside the City of Columbus')
    // Nothing about the Dublin parcel escapes.
    expect(JSON.stringify(res)).not.toContain('273-009979')
  })

  // Twelve condominium parcels on one footprint. `nearestFeatureSet()` cannot
  // break the tie (identical centroids) and the server's ordering is not
  // contractual — the same point returned a different first feature after the
  // layer was republished. A deterministic pick is the only reproducible answer.
  it('a stack of condo parcels resolves deterministically, not to features[0]', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesCondoStack))
    const first = await getColumbusParcelInfo(LAT, LNG)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // The fixture leads with 010-350327 (verbatim post-republish order).
    expect(first.info.parcelId).not.toBe('010-350327')
    expect(first.info.parcelId).toBe('010-350320')
    expect(first.info.address).toBe('2755 TENNYSON BLVD #A')

    // And it is the same answer every time.
    const second = await getColumbusParcelInfo(LAT, LNG)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.info.parcelId).toBe(first.info.parcelId)
    // Whichever unit is picked, the numbers the engine consumes are identical
    // across the stack — which is what makes an arbitrary-but-stable pick safe.
    expect(second.info.lot.sizeSqFt).toBe(first.info.lot.sizeSqFt)
  })

  it('the jurisdiction gate degrades OPEN when the boundary layer fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...columbusRoutes,
        'Applications/Zoning/MapServer/21': () => {
          throw new Error('boundary layer down')
        },
      }),
    )
    const res = await getColumbusParcelInfo(LAT, LNG)
    // Refusing a real Columbus address because an optional layer timed out
    // would be worse than the thing the gate prevents.
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R2F')
  })

  // ════════════════════════════════════════════════════════════════════════
  // OVERLAYS AND UPSTREAM FAILURE
  // ════════════════════════════════════════════════════════════════════════

  // Layer 14 mixes Historic Districts, Individual Listings and Design Review
  // Areas. At the Statehouse it returns the Design Review Area FIRST. Taking
  // features[0] would publish "Downtown District — Downtown Commission" as a
  // historic district, on the single most prominent parcel in the city.
  it('a design review area is never reported as a historic district', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesDD))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toContain('Ohio Statehouse')
    expect(res.info.overlays.historicDistrict).not.toContain('Downtown Commission')
    // But the review body is still surfaced, because it gates a permit.
    expect(res.info.zoning.article).toContain('Downtown Commission')
  })

  it('a real historic district is reported with its commission', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesUCT))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Brewery District — Historic Resources Commission')
  })

  it('a 200-with-error-JSON body from the parcel layer is an upstream failure, not "no parcel"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...columbusRoutes, 'Applications/Zoning/MapServer/5': ARCGIS_ERROR_200 }),
    )
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('no parcel at the point is a 404, with no fabricated zoning attached', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...columbusRoutes, 'Applications/Zoning/MapServer/5': { features: [] } }),
    )
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
  })

  it('a zoning-layer failure leaves a gap, never a substantive answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...columbusRoutes,
        'Applications/Zoning/MapServer/20': () => {
          throw new Error('zoning down')
        },
      }),
    )
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxStories).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
    // The parcel facts still stand.
    expect(res.info.lot.sizeSqFt).toBe(4320)
  })

  it('government ownership is flagged as a boolean and the name is discarded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutesLUCRPD))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
    expect(JSON.stringify(res.info)).not.toContain('STATE OF OHIO')
  })

  it('exercises exactly the endpoints it declares as sources', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(columbusRoutes))
    const res = await getColumbusParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const urls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
      String(c[0]),
    )
    for (const src of Object.values(res.info.sources)) {
      if (!src.startsWith('http')) continue
      // zoningOrdinance is a Legistar link, not a queried endpoint.
      if (src.includes('legistar')) continue
      expect(urls.some((u) => u.startsWith(src)), src).toBe(true)
    }
  })
})
