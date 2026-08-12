import { describe, it, expect, vi, afterEach } from 'vitest'
import { getLasVegasParcelInfo } from './lasvegas'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  LAS_VEGAS_PARCEL_ROUTE,
  LAS_VEGAS_ZONING_ROUTE,
  lasVegasRoutesProvidence,
  lasVegasRoutesNellis,
  lasVegasRoutesMain,
  lasVegasRoutesSilverDollar,
  lasVegasRoutesWashington,
  lasVegasRoutesBonitosSuenos,
  lasVegasRoutesPalomino,
  lasVegasRoutesPublicOwner,
  lasVegasRoutesRoad,
  lasVegasRoutesNorthLasVegas,
  lasVegasRoutesStrip,
  lasVegasRoutesBlankStrCityInCity,
  lasVegasRoutesJurisdictionsDown,
  lasVegasZoningUdr,
  lasVegasZoningRpd7,
  LAS_VEGAS_JURISDICTIONS_ROUTE,
} from './__fixtures__/lasvegas'

// These tests drive the REAL entry point, `getLasVegasParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live story count
// FIRST and the table's own tests called the resolver directly and passed
// throughout. A limit assertion is only meaningful at the boundary a user hits.

// The null-inventory probe point: 4617 Providence Ln, the polygon's own centroid.
const LAT = 36.169485
const LNG = -115.203709

describe('getLasVegasParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (R-1): address, parcel id, lot in sq ft, uses, assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.address).toBe('4617 PROVIDENCE LN')
    expect(info.parcelId).toBe('13931210029')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('R-1')
    expect(info.zoning.subdistrict).toBe('Single Family Residential')

    // SHAPE_Area IS square feet: the layer's native SR is EPSG:3421 (NAD83 /
    // Nevada East, US survey feet). Verified externally by shoelacing the rings
    // in that SR and, independently, by a geodesic computation on the same
    // polygons returned in 4326 — agreement to 0.02% on 3 of 3 sampled parcels.
    expect(info.lot.sizeSqFt).toBe(7064)

    expect(info.zoning.allowedUses).toEqual(['residential'])
    // Nevada 35%-of-taxable assessed value: 33,950 land + 20,515 improvements.
    expect(info.assessedValue).toBe(54465)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1961)
    expect(info.existing?.units).toBe(1)
  })

  // ════════════════════════════════════════════════════════════════════════
  // THE FIELD THAT ISN'T WHAT IT LOOKS LIKE — the Miami `FLR` trap
  // ════════════════════════════════════════════════════════════════════════

  // `LOTSQFT` is the Assessor's RESIDENTIAL BUILDING floor area, not the lot.
  // Measured three ways against the live layer 2026-08-09: geometry ÷ LOTSQFT
  // has a median of 2.320 over 100 consecutive single-family parcels and never
  // lands within 2% of 1.0; `LOTSQFT > 0 AND CONSTYR = 0` matches exactly ZERO
  // of the city's 291,830 parcels; and 262,381 of the 262,392 rows with a
  // positive LOTSQFT carry a residential land-use code.
  //
  // Reading it as the lot would have understated this house's lot by 4.2x, and
  // it would have looked entirely plausible in the UI — which is why it needs a
  // test rather than an eyeball (rule 18).
  it('never reads LOTSQFT as the lot area — it is the building floor area', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(7064)
    expect(res.info.lot.sizeSqFt).not.toBe(1690)
    expect(res.info.existing?.buildingAreaSqFt).toBe(1690)
  })

  // The other half of the same defect: on a commercial parcel LOTSQFT is 0, so
  // reading it as the lot would return a lot of ZERO for essentially every
  // non-residential parcel in Las Vegas — and a zero lot silently zeroes every
  // downstream area, cost and unit figure.
  it('a commercial parcel still gets a real lot, even though LOTSQFT is 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesNellis))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(33045)
    expect(res.info.existing?.buildingAreaSqFt ?? null).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // ADDRESS1 is the OWNER'S MAILING address, and often a person's name
  // ════════════════════════════════════════════════════════════════════════

  // Measured: this parcel's ADDRESS1 is '1580 S JONES BLVD' while the site is
  // 1395 N NELLIS BLVD. On other rows ADDRESS1 reads 'RODRIGUEZ PABLO CESAR' or
  // 'C/O WESTLAND REAL ESTATE GROUP'. Using it would publish an owner's home
  // address — sometimes their name — as the site address of a stranger's parcel.
  it('composes the SITE address from street components, never from ADDRESS1', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesNellis))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.address).toBe('1395 N NELLIS BLVD')
    // And it must not be the fixed-width `ADDRESS` column either.
    expect(res.info.address).not.toContain('001395')
  })

  it('does not emit an address for a right-of-way parcel with no street name', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesRoad))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.address).toBe('Selected location')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The jurisdiction gate
  // ════════════════════════════════════════════════════════════════════════

  it('a North Las Vegas parcel is REFUSED, not answered with a zoning gap', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesNorthLasVegas))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
    expect(res.message).toContain('outside the City of Las Vegas')
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('13911815003')
    expect(serialized).not.toContain('119526')
  })

  // The Strip is unincorporated Clark County. This is the case that shows why a
  // zoning gap alone was not enough: the row carries an 847,887 sq ft lot and
  // $199M of assessed value — everything the cost engine needs to print a
  // confident dollar figure for land Las Vegas does not zone.
  it('a Strip parcel in unincorporated Clark County is REFUSED', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesStrip))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('16216214001')
    expect(serialized).not.toContain('847887')
    expect(serialized).not.toContain('LAS VEGAS             BLVD')
  })

  // ⚠️ THE REASON THE GATE IS A POLYGON AND NOT `STRCITY = 'LV'`. STRCITY is the
  // SITE ADDRESS's city and is blank on every unaddressed parcel — i.e. on
  // vacant land, which is what a feasibility tool is asked about. An attribute
  // gate refuses this parcel; the City zones it R-PD12 and the jurisdiction
  // polygon contains it.
  it('an unaddressed in-city parcel with a blank STRCITY is still answered', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch(lasVegasRoutesBlankStrCityInCity),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-PD12')
    expect(res.info.parcelId).toBe('16308115000')
    expect(res.info.lot.sizeSqFt).toBe(344850)
  })

  // Degrading OPEN is deliberate, matching columbus.ts and dallas.ts. Note the
  // asymmetry it encodes: "fulfilled with zero features" is a real answer and
  // closes the gate, a rejection does not — a failed fetch must never become a
  // substantive answer in either direction (CLAUDE.md rule 5).
  it('the jurisdiction gate degrades OPEN when the Jurisdictions layer fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch(lasVegasRoutesJurisdictionsDown),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-1')
  })

  // The layer holds seven jurisdictions, so presence is NOT the signal here the
  // way it is in Dallas and Phoenix — the NAME must be compared. A gate reading
  // "any feature" would pass every point in the valley.
  it('the gate compares the jurisdiction NAME, not merely feature presence', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...lasVegasRoutesProvidence,
        [LAS_VEGAS_JURISDICTIONS_ROUTE]: {
          features: [{ attributes: { NAME: 'City of Henderson' } }],
        },
      }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
  })

  // The gate must read the point itself. A buffered retry reaches 30 m across
  // the line and hands the neighbouring city's land a Las Vegas answer.
  it('the Jurisdictions query carries no distance= buffer', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      urls.push(String(input))
      return mockArcgisFetch(lasVegasRoutesProvidence)(input)
    })
    await getLasVegasParcelInfo(LAT, LNG)
    const gateUrls = urls.filter((u) => u.includes(LAS_VEGAS_JURISDICTIONS_ROUTE))
    expect(gateUrls.length).toBeGreaterThan(0)
    for (const u of gateUrls) expect(u).not.toContain('distance=')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — the unit the code uses, end to end
  // ════════════════════════════════════════════════════════════════════════

  it('R-1 publishes 2 stories AND 35 ft, both as LVMC 19.06.070 Table 3 prints them', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(35)
    expect(res.info.zoning.maxStories).toBe(2)
  })

  // THE MIAMI-21 CASE, at the boundary. The Form-Based Code states a story
  // maximum and NO feet; the only feet in its building-form table are
  // floor-to-floor minima. Nothing in the pipeline may turn one into the other.
  it('a Form-Based Code zone publishes stories and NO height in feet', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesMain))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('T5-M')
    expect(res.info.zoning.maxStories).toBe(5)
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // 5 stories × any plausible floor-to-floor convention.
    for (const c of [9, 10, 11, 12, 13]) expect(res.info.zoning.maxHeightFt).not.toBe(5 * c)
    // …and the output must SAY the code states no feet, or a null height reads
    // as "we could not find one".
    expect(res.info.zoning.article).toContain('regulates this zone in STORIES')
    expect(res.info.zoning.article).toContain('none is derived')
  })

  // R-4's Table 3 prints "NA" in every height row. That is published text, not a
  // missing lookup — and it is also not a statement that nothing binds. Both
  // readings have to be refused at once.
  it('an "NA" height table publishes no number and claims no absence, and says which', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesSilverDollar))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-4')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.maxStories ?? null).toBeNull()
    expect(res.info.zoning.article).toContain('prints "NA" in every row')
    expect(res.info.zoning.article).toContain('it is not a gap in our data')
    expect(res.info.zoning.article).toContain('no maximum is published either way')
    // The mixed-use footnote rides as disclosure, never as the figure.
    expect(res.info.zoning.article).toContain('revitalization area')
  })

  // C-PB's table says 5 stories / 85 ft, and footnote 3 cuts commercial and
  // retail uses to 2 / 35. Publishing 5/85 to someone planning retail overstates
  // the envelope by 2.4x, so the lower limb must appear in the output.
  it('C-PB surfaces the lower commercial/retail height limb alongside the table figure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesWashington))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxStories).toBe(5)
    expect(res.info.zoning.maxHeightFt).toBe(85)
    expect(res.info.zoning.article).toContain('commercial and retail uses')
    expect(res.info.zoning.article).toContain('2 stories / 35 ft')
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR: a known absence, and the places it must be refused
  // ════════════════════════════════════════════════════════════════════════

  it('publishes the FAR absence as an ANSWER, with what governs instead', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
    expect(res.info.zoning.article).toContain('imposes NO floor-area ratio')
    expect(res.info.zoning.article).toContain('not a gap in our data')
    // The slot-test citation, so the claim can be checked rather than trusted.
    expect(res.info.zoning.article).toContain('§19.08.040(A)')
    // And what actually binds: R-1's Table 1 row B, 50% lot coverage.
    expect(res.info.zoning.article).toContain('maximum lot coverage (50%')
  })

  // P-C covers 13,755 acres — 17.9% of the city — and its standards live in a
  // Planned Community Program adopted by ordinance. An unread plan may impose a
  // floor-area limit, so this must read as INCOMPLETE, never as "no FAR here".
  it('a plan-governed district is incomplete, not unconstrained', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesBonitosSuenos))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('P-C')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.maxStories ?? null).toBeNull()
    expect(res.info.zoning.allowedUses).toBeNull()
    expect(res.info.zoning.article).toContain('Plan-governed district')
    expect(res.info.zoning.article).toContain('INCOMPLETE, not absent')
    // The parcel itself still resolves — a zoning gap is not a parcel failure.
    expect(res.info.address).toBe('1048 BONITOS SUENOS ST')
    expect(res.info.lot.sizeSqFt).toBe(5000)
  })

  it('R-PD carries the code\'s own density numeral and still publishes no limits', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...lasVegasRoutesBonitosSuenos, [LAS_VEGAS_ZONING_ROUTE]: lasVegasZoningRpd7 }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-PD7')
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('7 units per gross acre')
  })

  // R-A ("Ranch Acres") is not in §19.00.100(B)'s roster and the string appears
  // nowhere in Title 19. It must come back with the code visible, nothing
  // asserted, and above all no `farUnconstrained`.
  it('a classification Title 19 no longer establishes is a GAP, not an absence', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesPalomino))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-A')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.maxStories ?? null).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
    expect(res.info.zoning.article).toContain('§19.00.100(C)')
    expect(res.info.address).toBe('2694 PALOMINO LN')
    expect(res.info.lot.sizeSqFt).toBe(11597)
  })

  // The parcel layer is COUNTY-WIDE (834,987 rows) while the zoning layer stops
  // at the city limits, so a Henderson or Paradise address returns a real parcel
  // and no zoning. That must never quietly become a substantive answer.
  it('a point with no zoning polygon returns a gap, never a substantive answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesRoad))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toBeNull()
    expect(res.info.zoning.subdistrict).toBeNull()
  })

  it('resolves a U(...) holding zone to the U district the code establishes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...lasVegasRoutesPalomino, [LAS_VEGAS_ZONING_ROUTE]: lasVegasZoningUdr }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('U(DR)')
    expect(res.info.zoning.maxHeightFt).toBe(35)
    expect(res.info.zoning.maxStories).toBe(2)
    expect(res.info.zoning.article).toContain('§19.00.100(B)(1)')
    expect(res.info.zoning.article).toContain('not a separate zoning district')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Existing structure
  // ════════════════════════════════════════════════════════════════════════

  // Grouped over the city's 291,830 parcels, CAPACITY's mean is 1.00 on LUCODE
  // 110, 1.98 on 120, 3.99 on 140 and 32.02 on 150 — a unit count on residential
  // land uses. On LUCODE 335 (offices) it means 1.79 and on 240 (industrial)
  // 0.98, which are not unit counts at all.
  it('reads CAPACITY as units on residential land use, and refuses to elsewhere', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesSilverDollar))
    const apartments = await getLasVegasParcelInfo(LAT, LNG)
    expect(apartments.ok).toBe(true)
    if (!apartments.ok) return
    expect(apartments.info.existing?.units).toBe(133)
    vi.restoreAllMocks()

    // LUCODE 370, a commercial parcel whose CAPACITY is the default 1. A '1'
    // here would flow into the no-net-loss check as a dwelling that is not there.
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesNellis))
    const shop = await getLasVegasParcelInfo(LAT, LNG)
    expect(shop.ok).toBe(true)
    if (!shop.ok) return
    expect(shop.info.existing?.units ?? null).toBeNull()
  })

  // Nevada assesses at 35% of taxable value (NRS 361.225), and these columns are
  // the assessed figures — established arithmetically: LANDVAL1 ÷ 0.35 is a
  // whole multiple of $100 on 766 of 800 sampled City rows, against 20 of 756
  // for IMPVAL. The 35% is never divided out; the label is what stops the number
  // being read as market value.
  it('labels the value as the Nevada 35% assessed figure, and does not convert it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.assessedValue).toBe(54465)
    expect(res.info.existing?.assessedValueBasis).toContain('35%')
    expect(res.info.existing?.assessedValueBasis).toContain('not market value')
    expect(res.info.existing?.assessedValueBasis).toContain('assessment year 2027')
    // NOT the grossed-up taxable value.
    expect(res.info.assessedValue).not.toBe(Math.round(54465 / 0.35))
  })

  it('never returns the owner name, only the derived public-ownership boolean', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesPublicOwner))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
    expect(JSON.stringify(res.info)).not.toContain('CITY OF LAS VEGAS')
  })

  it('does not mark a privately owned parcel as public', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesPalomino))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBeUndefined()
  })

  // ════════════════════════════════════════════════════════════════════════
  // Overlays
  // ════════════════════════════════════════════════════════════════════════

  // LVMC 19.10.150 establishes an HD-O Historic Designation Overlay, but no
  // layer on the City's GIS publishes it (all 19 service folders enumerated
  // 2026-08-09). Clark County's "Historic Neighborhood Overlay District" layer
  // was tested and rejected: eight of its polygon centroids returned NO City of
  // Las Vegas zoning and parcels whose STRCITY reads 'PAR' (Paradise). A null
  // here means "not published", not "this parcel is not in one".
  it('returns no historic district for any Las Vegas parcel — a data gap, stated', async () => {
    for (const routes of [lasVegasRoutesProvidence, lasVegasRoutesMain, lasVegasRoutesNellis]) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes))
      const res = await getLasVegasParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.overlays.historicDistrict).toBeNull()
      vi.restoreAllMocks()
    }
  })

  it('surfaces the parcel\'s own entitlement case numbers as a ceiling caveat', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesNellis))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('Special Use Permit SUP-61064')
    expect(res.info.zoning.article).toContain('Variance VAR-76590')
    expect(res.info.zoning.article).toContain('a ceiling this site may not have')
  })

  it('does not invent an entitlement caveat on a parcel with none', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(lasVegasRoutesProvidence))
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).not.toContain('Special Use Permit')
    expect(res.info.zoning.article).not.toContain('Variance')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Upstream failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('reports an upstream failure as 502, not as "no parcel here"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...lasVegasRoutesProvidence,
        [LAS_VEGAS_PARCEL_ROUTE]: () => {
          throw new Error('parcel service down')
        },
      }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
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
      mockArcgisFetch({ ...lasVegasRoutesProvidence, [LAS_VEGAS_PARCEL_ROUTE]: ARCGIS_ERROR_200 }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  it('degrades gracefully when only the flood layer fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...lasVegasRoutesProvidence,
        NFHL: () => {
          throw new Error('fema down')
        },
      }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-1')
    expect(res.info.zoning.maxHeightFt).toBe(35)
    expect(res.info.overlays.floodZone).toBeNull()
  })

  // ⚠️ THIS TEST USED TO ASSERT THE DEFECT. It read the districtCode as
  // 'Unknown' and called that "a gap", with a rationale citing CLAUDE.md rule 5
  // — but 'Unknown' is exactly what assessDevelopability turns into
  // `no_coverage`, a geographic claim about the parcel, with cost, timeline and
  // hurdles zeroed by analyze.ts. A green test with a well-written reason is the
  // hardest kind to overturn (rule 15); this is the corrected assertion. The
  // EMPTY-answer case above is unchanged, because that one really is a gap.
  it('a zoning-layer outage REFUSES — it is not the Henderson gap', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...lasVegasRoutesProvidence,
        [LAS_VEGAS_ZONING_ROUTE]: () => {
          throw new Error('zoning down')
        },
      }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
    expect(res.message).toMatch(/Las Vegas/)
    expect(res.message).not.toMatch(/coverage|neighbou?ring|unincorporated/i)
  })

  it('returns NO_PARCEL when the parcel layer has nothing at the point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...lasVegasRoutesProvidence, [LAS_VEGAS_PARCEL_ROUTE]: { features: [] } }),
    )
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('reads only the five endpoints it declares', async () => {
    const seen: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      seen.push(String(input))
      return mockArcgisFetch(lasVegasRoutesProvidence)(input)
    })
    const res = await getLasVegasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Nothing may reach the Clark County services — the county's parcel fabric
    // and its lookalike historic overlay are both deliberately unused.
    expect(seen.some((u) => u.includes('clarkcountynv.gov'))).toBe(false)
    expect(Object.keys(res.info.sources).sort()).toEqual([
      'flood',
      'jurisdictions',
      'parcels',
      'zoning',
      'zoningCode',
    ])
  })
})
