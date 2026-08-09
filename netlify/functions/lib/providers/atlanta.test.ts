import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAtlantaParcelInfo } from './atlanta'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  atlantaRoutes,
  atlantaRoutesNc11,
  atlantaRoutesHoward,
  atlantaRoutesHosea,
  atlantaRoutesWaldo,
  atlantaRoutesGrantPark,
  atlantaRoutesOi,
  atlantaRoutesPdH,
  atlantaRoutesSpi,
  atlantaRoutesNoZoning,
  atlantaOverlayInmanPark,
} from './__fixtures__/atlanta'

// These tests drive the REAL entry point, `getAtlantaParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live story count
// FIRST and the table's own tests called the resolver directly and passed
// throughout. A limit assertion is only meaningful at the boundary a user hits.

// Ponce City Market, 675 Ponce De Leon Ave NE.
const LAT = 33.77245
const LNG = -84.3658

describe('getAtlantaParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (MRC-3-C): address, parcel id, lot in sq ft, uses, appraised value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.address).toBe('675 PONCE DE LEON AVE NE')
    expect(info.parcelId).toBe('14 001700100034')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('MRC-3-C')

    // SHAPE.AREA IS square feet: the layer's native SR is EPSG:6447 (NAD83(2011)
    // Georgia West, US survey feet). Verified externally by requesting geometry
    // at outSR=6447 and shoelacing the rings — 561,670.27 against a stored
    // 561,670.265245609, ratio 1.000000, on 4 of 4 sampled parcels. No
    // conversion happens, so no conversion can drift.
    expect(info.lot.sizeSqFt).toBe(561670)

    expect(info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    expect(info.assessedValue).toBe(320000000)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.units).toBe(259)
    expect(info.existing?.assessedValueBasis).toContain('appraised')
    expect(info.sources.zoningCode).toContain('municode.com')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — the unit the code uses, end to end
  // ════════════════════════════════════════════════════════════════════════

  it('MRC-3 publishes 225 ft — the figure §16-34.028(2)b states', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(225)
  })

  // THE MIAMI-21 CASE, at the boundary. Atlanta's Part 16 regulates height in
  // FEET; the story counts in Chapter 35 live only in a statement of intent.
  // Nothing in the pipeline may turn a height into a story count or back.
  it('never publishes a story count for any Atlanta district', async () => {
    for (const routes of [atlantaRoutes, atlantaRoutesHoward, atlantaRoutesOi, atlantaRoutesWaldo]) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes))
      const res = await getAtlantaParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.zoning.maxStories ?? null).toBeNull()
      expect('maxStories' in res.info.zoning).toBe(false)
      vi.restoreAllMocks()
    }
  })

  // §16-10.008, verbatim: "Maximum height limitations. None, except as required
  // in section 16-10.006." That is an ANSWER. ParcelInfo has no
  // `heightUnconstrained` field, so the only way to keep it from rendering as
  // "we could not find a height" is to say it in `article` — and this test is
  // what stops that sentence being dropped as decoration.
  it('O-I: the code states NO maximum height, and the output says so', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesOi))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.article).toContain('imposes NO maximum building height')
    expect(res.info.zoning.article).toContain('not a gap in our data')
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR: per use, per denominator, and never collapsed
  // ════════════════════════════════════════════════════════════════════════

  it('MRC-3 keeps 4.0 / 3.2 / 7.2 apart and publishes no single district FAR', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.farByUse).toEqual({ residential: 3.2, commercial: 4.0, mixed: 7.2 })
    // The limbs differ, so there is no "the MRC-3 FAR" to publish.
    expect(res.info.zoning.maxFAR).toBeNull()
    // §16-34.028(1)(b)'s 8.2 is the BONUS ceiling, earned with deed-restricted
    // affordable housing and open space. It must never appear as an allowance.
    expect(JSON.stringify(res.info.zoning.farByUse)).not.toContain('8.2')
  })

  it('states which lot-area denominator each ratio uses, in the code\'s own terms', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesOi))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // O-I §16-10.007(1): nonresidential 3.0 × NET; residential sector 5 × GROSS.
    expect(res.info.zoning.article).toContain('nonresidential 3 × net lot area')
    expect(res.info.zoning.article).toContain('residential 3.2 × gross lot area')
    expect(res.info.zoning.article).toContain('§16-28.010(1)')
  })

  it('R-4 family: one ratio for all uses, so a single maxFAR is published', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHoward))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 12,534 sq ft ≥ the 7,500 sq ft R-4A minimum → §16-06A.008(5)a, FAR 0.50.
    expect(res.info.lot.sizeSqFt).toBe(12534)
    expect(res.info.zoning.maxFAR).toBe(0.5)
    expect(res.info.zoning.farByUse?.residential).toBe(0.5)
    expect(res.info.zoning.maxHeightFt).toBe(35)
    // The substandard-lot branch must NOT fire on a conforming lot.
    expect(res.info.zoning.farFloorSqFt).toBeUndefined()
  })

  // ════════════════════════════════════════════════════════════════════════
  // The lot-size-conditional branch, resolved from the parcel's own area
  // ════════════════════════════════════════════════════════════════════════

  // 1789 Hosea L Williams Dr SE is 7,473 sq ft — 27 sq ft under the R-4A
  // minimum — so §16-06A.008(5)b applies: "the lesser of either: 3,750 square
  // feet of floor area; or … 0.65 of the net lot area". On this lot the fixed
  // limb is smaller, so the effective ratio is BELOW the 0.65 the chapter
  // prints. Publishing 0.65 here would allow 4,857 sq ft against a code cap of
  // 3,750 — a 30% overstatement, of exactly the shape rule 18 describes.
  it('R-4A on a substandard lot: the lesser limb binds, not the printed 0.65', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHosea))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const lot = res.info.lot.sizeSqFt!
    expect(lot).toBe(7473)
    expect(res.info.zoning.maxFAR).not.toBe(0.65)
    expect(res.info.zoning.maxFAR).not.toBe(0.5)
    expect(res.info.zoning.maxFAR! * lot).toBeCloseTo(3750, 6)
    expect(res.info.zoning.farByUse?.residential).toBe(res.info.zoning.maxFAR)

    // And it must SAY so. A bare 0.502 next to a district whose chapter prints
    // 0.50 and 0.65 reads as a rounding artefact; the disclosure is what makes
    // it legible as the code's own "lesser of" arithmetic on this lot.
    expect(res.info.zoning.article).toContain('under the district minimum of 7,500 sq ft')
    expect(res.info.zoning.article).toContain('LESSER of 3,750 sq ft or FAR 0.65')
    expect(res.info.zoning.article).toContain('effective FAR of 0.502')
  })

  // §16-07.008(5)b(2): "If the floor area ratio does not allow at least 1,800
  // square feet of floor area, a dwelling … of such size may be built." A floor
  // UNDER the cap, which is exactly what farFloorSqFt means — and it is R-5's
  // alone, so it must not leak onto R-4A.
  it('R-5 on a substandard lot carries the 1,800 sq ft guaranteed floor', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesWaldo))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(7414)
    expect(res.info.zoning.farFloorSqFt).toBe(1800)
    expect(res.info.zoning.maxFAR! * 7414).toBeCloseTo(3750, 6)
  })

  it('R-4A on a substandard lot does NOT get R-5\'s guaranteed floor', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHosea))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.farFloorSqFt).toBeUndefined()
  })

  it('R-5 surfaces the duplex 0.60 as an alternative, never as the headline', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesGrantPark))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 1,509,955 sq ft — a conforming lot, so the headline is §16-07.008(5)a.
    expect(res.info.zoning.maxFAR).toBe(0.5)
    expect(res.info.zoning.farAlternatives).toEqual([
      expect.objectContaining({ label: 'Duplex', far: 0.6 }),
    ])
  })

  // ════════════════════════════════════════════════════════════════════════
  // Gaps must render as gaps (rule 5)
  // ════════════════════════════════════════════════════════════════════════

  // NC-11 is a district Part 16 has and this build did not read. It must come
  // back with the district code visible and nothing asserted about it — above
  // all it must NOT acquire `farUnconstrained`, which would tell a reader the
  // code imposes no FAR when nobody has looked.
  it('an uncurated district (NC-11) is a GAP, not an absence', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesNc11))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('NC-11')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.farByUse).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
    // The address and lot still resolve — a zoning gap is not a parcel failure.
    expect(res.info.address).toBe('1019 VIRGINIA AVE NE')
    expect(res.info.lot.sizeSqFt).toBe(3418)
  })

  it('an uncurated SPI subarea is likewise a gap, and publishes no FAR', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesSpi))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('SPI-21 SA2')
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxFAR).toBeNull()

    // ⚠️ RECORDED, NOT ASSERTED-AS-CORRECT. MARTA is the Metropolitan Atlanta
    // Rapid Transit Authority — a public transit authority — but the shared
    // `isGovernmentOwner` vocabulary in src/lib/developability.ts matches
    // "transit authority", "MBTA" and "MTA" and does not match the bare
    // acronym "MARTA", so this parcel does NOT read as publicly owned. That is
    // an under-firing gate on real public land, and it is pinned here so the
    // behaviour is visible rather than assumed. Fixing it means widening a
    // shared block-regex, which this task may not do and which the repo's own
    // convention says needs a test showing it cannot catch a legitimate private
    // parcel first.
    expect(res.info.existing?.ownerPublic).toBeUndefined()
  })

  // Fulton parcel numbers carry internal DOUBLE spaces as part of the
  // identifier: '14 0107  LL0020'. Normalising them the way display text is
  // normalised would mint '14 0107 LL0020', which matches nothing upstream —
  // and it would look completely fine in the UI, which is why it needs a test
  // rather than an eyeball (rule 18).
  it('preserves the internal double space in a Fulton parcel number', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesSpi))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.parcelId).toBe('14 0107  LL0020')
    expect(res.info.parcelId).not.toBe('14 0107 LL0020')
  })

  it('still trims a DeKalb parcel number, which is single-spaced', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHoward))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.parcelId).toBe('15 211 02 096')
  })

  it('a point with no zoning polygon returns a gap, never a substantive answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesNoZoning))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toBeNull()
  })

  // PD-H's intensity comes from the ordinance that approved the plan. A FAR DOES
  // bind — it is a Table I sector — so this must read as incomplete, not as
  // "no FAR applies here".
  it('PD-H reads as plan-governed, and does not claim the FAR is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesPdH))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('PD-H')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('Planned Development district')
    expect(res.info.zoning.article).toContain('not from a district table')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Conditional zoning — 8.5% of the city's acreage
  // ════════════════════════════════════════════════════════════════════════

  it('labels a "-C" parcel so the base figures are not read as this site\'s', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('Conditional zoning')
    expect(res.info.zoning.article).toContain('Clerk of Council')
  })

  it('does not put a conditional warning on a non-conditional parcel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHoward))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).not.toContain('Conditional zoning')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The DeKalb-side appraisal hole
  // ════════════════════════════════════════════════════════════════════════

  // Measured against the live layer 2026-08-08: of 171,077 rows with
  // SITECITY='ATLANTA', 14,170 carry TOT_APPR null — 13,092 of 13,092 rows with
  // the DeKalb land-lot prefix '15 ', 1,011 of 1,011 with the other DeKalb
  // prefix '18 ', and 67 placeholder rows whose PARCELID reads 'NO ID' or
  // 'FULTON COUNTY'. Zero of the 147,078 Fulton rows (prefixes '14 ' and '17 ')
  // are null. It is a clean geographic hole, and it must render as absent rather
  // than as zero — a 0 would read as a worthless parcel.
  it('a DeKalb parcel returns a null appraisal, never a zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesHoward))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.assessedValue).toBeNull()
    expect(res.info.existing?.assessedValue ?? null).toBeNull()
    expect(res.info.existing?.units ?? null).toBeNull()
    // The parcel itself is fine — address, lot and zoning all resolved.
    expect(res.info.address).toBe('152 HOWARD STREET NE')
    expect(res.info.lot.sizeSqFt).toBe(12534)
  })

  // TOT_APPR is the county's APPRAISED market value; CNTASSDVAL is the Georgia
  // 40% assessed value and is 2.5x smaller. Verified arithmetically rather than
  // from memory of Georgia law: over 500 sampled live rows, LANDASSESS/LANDAPPR
  // has a median of exactly 0.400 and is 0.400 on 498 of them. Labelling the
  // wrong one would understate the land-cost proxy by 60%.
  it('labels the value as appraised market value, not the 40% assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.assessedValueBasis).toContain('NOT the Georgia 40% assessed value')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Overlays
  // ════════════════════════════════════════════════════════════════════════

  it('populates historicDistrict only from the Historic District layer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutesGrantPark))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Grant Park Historic District — Sub Area 2')
    expect(res.info.existing?.ownerPublic).toBe(true)
  })

  // The BeltLine overlay is a real overlay with real consequences, but calling
  // it "historic" would be false, and downstream code treats historicDistrict as
  // a preservation-review trigger. It goes to subdistrict instead.
  it('does not let the BeltLine overlay masquerade as a historic district', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.zoning.subdistrict).toBe('BELTLINE')
  })

  // Measured: a point in Inman Park returns TWO overlay polygons at once
  // (BeltLine and HC-20L). The provider must not assume exactly one comes back.
  it('survives a point covered by more than one overlay polygon', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...atlantaRoutes, 'LandUsePlanning/MapServer/1': atlantaOverlayInmanPark }),
    )
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.subdistrict).toBe('BELTLINE')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Upstream failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('reports an upstream failure as 502, not as "no parcel here"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...atlantaRoutes,
        'AdministrativeArea/TaxParcel/MapServer/0': () => {
          throw new Error('parcel service down')
        },
      }),
    )
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  // ArcGIS reports a malformed query or a renamed field as HTTP 200 with an
  // error body. Read as a feature set it has no `.features`, which would look
  // exactly like clicking open water.
  it('treats a 200-with-error-JSON parcel response as an upstream failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...atlantaRoutes, 'AdministrativeArea/TaxParcel/MapServer/0': ARCGIS_ERROR_200 }),
    )
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  it('degrades gracefully when only the optional overlay layers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...atlantaRoutes,
        'LandUsePlanning/MapServer/1': () => {
          throw new Error('overlay down')
        },
        'LandUsePlanning/MapServer/6': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('fema down')
        },
      }),
    )
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('MRC-3-C')
    expect(res.info.zoning.maxHeightFt).toBe(225)
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
  })

  it('returns NO_PARCEL when the parcel layer has nothing at the point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...atlantaRoutes, 'AdministrativeArea/TaxParcel/MapServer/0': { features: [] } }),
    )
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('never returns the owner name, only the derived public-ownership boolean', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(atlantaRoutes))
    const res = await getAtlantaParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(JSON.stringify(res.info)).not.toContain('JAMESTOWN')
  })
})
