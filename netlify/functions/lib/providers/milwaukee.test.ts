import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMilwaukeeParcelInfo, selectParcel, ringAreaSqFt } from './milwaukee'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  milwaukeeRoutes,
  milwaukeeRoutesScott,
  milwaukeeRoutesWater,
  milwaukeeRoutesCityHall,
  milwaukeeRoutesReedSt,
  milwaukeeRoutesCondo,
  milwaukeeRoutesZoningDefect,
  milwaukeeRoutesNoZoning,
  milwaukeeParcelCondoStack,
  milwaukeeSproz,
  milwaukeeNc,
} from './__fixtures__/milwaukee'

// These tests drive the REAL entry point, `getMilwaukeeParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live figure FIRST
// and the table's own tests called the resolver directly and passed throughout.

// 2318 N Sherman Bl.
const LAT = 43.0611
const LNG = -87.967

describe('getMilwaukeeParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (RS5): address, taxkey, lot in sq ft, uses, assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutes))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    // MPROP_full carries no pre-assembled ADDRESS, so this is composed from
    // HOUSE_NR_LO / SDIR / STREET / STTYPE — and must reproduce exactly what
    // MPROP_lite's own ADDRESS field says.
    expect(info.address).toBe('2318 N SHERMAN BL')
    expect(info.parcelId).toBe('3271717000')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('RS5')

    // LOT_AREA is square feet. Verified externally by shoelacing the returned
    // rings in the layer's own EPSG:32054 (NAD27 Wisconsin South, US feet) —
    // median ratio 1.0000 across 25 sampled parcels. No conversion happens, so
    // no conversion can drift.
    expect(info.lot.sizeSqFt).toBe(8150)
    expect(info.lot.lotType).toBeNull()

    expect(info.zoning.allowedUses).toEqual(['residential'])
    expect(info.assessedValue).toBe(128800)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1930)
    expect(info.existing?.units).toBe(1)
    expect(info.existing?.buildingAreaSqFt).toBe(2120)
    // NR_STORIES arrives as the STRING '1.5' and is the EXISTING building's
    // storey count — genuinely fractional, and never rounded into an integer.
    expect(info.existing?.stories).toBe(1.5)
    expect(info.existing?.assessedValueBasis).toContain('2026')
    // Owner drives a boolean only; the name never leaves the server.
    expect(JSON.stringify(info)).not.toContain('PRIVATE OWNER')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — the unit the code uses, end to end
  // ════════════════════════════════════════════════════════════════════════

  it('RS5 publishes 45 ft and NO story count — Ch. 295 states none', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutes))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Table 295-505-2, "Height, maximum (ft.)": 45.
    expect(res.info.zoning.maxHeightFt).toBe(45)
    // Chapter 295 regulates height in feet only. Table 295-505-2's "Max. no. of
    // stories without side or rear setback adjustment" row says 3 for RS5, and
    // that is a SETBACK trigger — publishing it here would be a fabricated
    // storey limit.
    expect(res.info.zoning.maxStories).toBeUndefined()
    expect(JSON.stringify(res.info.zoning)).not.toMatch(/maxStories/)
  })

  it('RT4 publishes 48 ft, not the 45 ft of every district beside it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesScott))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('RT4')
    expect(res.info.zoning.maxHeightFt).toBe(48)
    expect(res.info.lot.sizeSqFt).toBe(3500)
  })

  // ════════════════════════════════════════════════════════════════════════
  // A stated "none" must not render as a failed lookup (rule 5)
  // ════════════════════════════════════════════════════════════════════════

  it('C9F(B) carries maxHeightFt null but SAYS the code states no maximum', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesWater))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('C9F(B)')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // ParcelInfo has no `heightUnconstrained` field, so the ANSWER rides in the
    // article. Without this the parcel is indistinguishable from one whose
    // zoning lookup failed.
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('the code states NO maximum height')
    expect(article).toContain('an answer, not a missing lookup')
    expect(article).toContain('295-705-1')
  })

  it('downtown floor area is disclosed as a formula and never as a ratio', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesWater))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    // ⚠️ THE DECISIVE ONE. Table 295-705-1 has a floor-area slot and it is
    // FILLED, so downtown is a GAP, not FACT 1's known absence. Claiming
    // farUnconstrained here would tell the reader the code lets you build any
    // floor area you like in the C9 districts.
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('8(W)+20(X)+10(Y)+0.2(Z)')
    expect(article).toContain('9(W)+10(X)+5(Y)+0.2(Z)')
    expect(article).toContain('12(W)+0.2(Z)')
    expect(article).toContain('unpriced')
    // No collapsed number may appear in its place.
    expect(article).not.toMatch(/base FAR|FAR of 8|floor area ratio of 8/i)
  })

  it('every farUnconstrained district reports maxFAR null WITH the flag set', async () => {
    for (const routes of [milwaukeeRoutes, milwaukeeRoutesScott, milwaukeeRoutesReedSt]) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(routes))
      const res = await getMilwaukeeParcelInfo(LAT, LNG)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.info.zoning.maxFAR).toBeNull()
      // Without this flag, maxFAR null falls back to an unsourced FAR of 1.0.
      expect(res.info.zoning.farUnconstrained).toBe(true)
      vi.restoreAllMocks()
    }
  })

  // ════════════════════════════════════════════════════════════════════════
  // Per-use height tables at the boundary (rule 6)
  // ════════════════════════════════════════════════════════════════════════

  it('IM publishes the LOWEST stated figure and names the others', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesReedSt))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Table 295-805-2 states three figures for IM: 85 ft for an industrial
    // building (new construction only), 60 ft for a non-industrial one via
    // LB2, and 48 ft for a single- or two-family dwelling via RT4.
    expect(res.info.zoning.maxHeightFt).toBe(48)
    expect(res.info.zoning.maxHeightFt).not.toBe(85)
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('85 ft')
    expect(article).toContain('60 ft')
    expect(article).toContain('48 ft')
    expect(article).toMatch(/new construction only/i)
    expect(article).toContain('295-805-2')
  })

  // ════════════════════════════════════════════════════════════════════════
  // A parcel stack must not be an arbitrary pick (the San Diego defect)
  // ════════════════════════════════════════════════════════════════════════

  it('a condominium stack resolves to ONE deterministic parcel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesCondo))
    const first = await getMilwaukeeParcelInfo(LAT, LNG)
    const second = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.info.parcelId).toBe(second.info.parcelId)
    // Lowest TAXKEY, not features[0] — the fixture is deliberately NOT in
    // TAXKEY order, and the live server does not guarantee one.
    expect(first.info.parcelId).toBe('3960391110')
    expect(milwaukeeParcelCondoStack.features[0].attributes.TAXKEY).toBe('3960393110')
  })

  it("a condo unit's lot size comes from the shared polygon, not the unit row", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesCondo))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // All 15 units at 311 E Chicago St share one 21,651 sq ft ring; the unit
    // rows carry per-unit LOT_AREA values of 566-2,255. Publishing 1,352 sq ft
    // as the development site would understate it by 16x.
    expect(res.info.lot.sizeSqFt).toBe(21651)
    expect(res.info.lot.sizeSqFt).not.toBe(1352)
    expect(res.info.lot.lotType).toContain('Condominium unit')
  })

  it('PARCEL_TYPE null is a real fee parcel, not a shell to be discarded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesReedSt))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 200 S Rite-Hite Wa: a 128-unit apartment building assessed at $68.8M
    // whose PARCEL_TYPE is null. A `PARCEL_TYPE === 0` filter would drop it.
    expect(res.info.parcelId).toBe('4281163000')
    expect(res.info.address).toBe('200 S RITE-HITE WA')
    expect(res.info.existing?.units).toBe(128)
    expect(res.info.lot.lotType).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // The tax-exempt trap — a $0 valuation would look like an answer
  // ════════════════════════════════════════════════════════════════════════

  it('a tax-exempt parcel reports the exempt valuation, never $0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesCityHall))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // City Hall: C_A_TOTAL is the string '0', C_A_EXM_TOTAL is 10,966,000.
    expect(res.info.assessedValue).toBe(10966000)
    expect(res.info.assessedValue).not.toBe(0)
    expect(res.info.existing?.assessedValueBasis).toContain('exempt')
    expect(res.info.existing?.ownerPublic).toBe(true)
    expect(JSON.stringify(res.info)).not.toContain('CITY OF MILWAUKEE')
  })

  it('recovers a lot size from the polygon when LOT_AREA is zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesCityHall))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 8,044 of 146,811 fee parcels (5.5%) carry LOT_AREA null or <= 0. Zero
    // must never be published as a lot size.
    expect(res.info.lot.sizeSqFt).toBe(21651)
    expect(res.info.lot.sizeSqFt).not.toBe(0)
  })

  it('reports no lot size rather than zero when neither source works', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...milwaukeeRoutes,
        'parcels_mprop/MapServer/2': (url: string) =>
          url.includes('where=TAXKEY')
            ? { features: [] }
            : { features: [{ attributes: { TAXKEY: '1', HOUSE_NR_LO: 1, STREET: 'MAIN', STTYPE: 'ST', LOT_AREA: 0 } }] },
      }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBeNull()
  })

  it('rejects an impossible LOT_AREA and measures the polygon instead', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...milwaukeeRoutes,
        'parcels_mprop/MapServer/2': (url: string) =>
          url.includes('where=TAXKEY')
            ? {
                features: [
                  {
                    attributes: { TAXKEY: '1' },
                    geometry: { rings: [[[0, 0], [100, 0], [100, 216.51], [0, 216.51], [0, 0]]] },
                  },
                ],
              }
            : {
                features: [
                  {
                    attributes: {
                      TAXKEY: '1',
                      PARCEL_TYPE: 0,
                      HOUSE_NR_LO: 722,
                      SDIR: 'E',
                      STREET: 'JUNEAU',
                      STTYPE: 'AV',
                      // The real corrupt value on 722 E Juneau: roughly seven
                      // times the land area of the entire city.
                      LOT_AREA: 19_070_000_000,
                    },
                  },
                ],
              },
      }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.lot.sizeSqFt).toBe(21651)
    expect(res.info.lot.sizeSqFt).not.toBe(19_070_000_000)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Overlays that can supersede the base district
  // ════════════════════════════════════════════════════════════════════════

  it('a Development Incentive Zone qualifies the height and links the file', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesReedSt))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('Development Incentive Zone')
    expect(article).toContain('Reed Street Yards')
    expect(article).toMatch(/supercede the standards of the underlying district/)
    expect(article).toContain('295-1007-3-a')
    // The DIZ genuinely returns two features here, one per Council file. The
    // name must appear once, not twice.
    expect(article.match(/Reed Street Yards/g)).toHaveLength(1)
    expect(res.info.sources.overlayStandards).toBe(
      'http://milwaukee.legistar.com/gateway.aspx?M=L2&FileID=090353',
    )
    // The base figure still resolves — an overlay can only alter it, and we do
    // not know how.
    expect(res.info.zoning.maxHeightFt).toBe(48)
  })

  it('a Site Plan Review overlay and an NC overlay are disclosed too', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...milwaukeeRoutes,
        'planning/zoning/MapServer/9': milwaukeeSproz,
        'planning/zoning/MapServer/8': milwaukeeNc,
      }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const article = res.info.zoning.article ?? ''
    expect(article).toContain('Site Plan Review overlay zone')
    expect(article).toContain('Messmer High School')
    expect(article).toContain('295-1009-3-a')
    expect(article).toContain('Neighborhood Conservation overlay zone')
    expect(article).toContain('Brewers Hill / Harambee')
  })

  it('a non-overlay parcel carries no supersession notice and no link', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutes))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.sources.overlayStandards).toBeUndefined()
    expect(res.info.zoning.article ?? '').not.toContain('supercede')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Historic: LOCAL designation only
  // ════════════════════════════════════════════════════════════════════════

  it('reports the LOCAL historic district, which is the review trigger', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutes))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Sherman Boulevard')
    expect(res.info.zoning.subdistrict).toBe('Sherman Boulevard')
  })

  it('never queries the National Register districts layer', async () => {
    // Layer 18 on the same service is the NATIONAL REGISTER districts. National
    // listing alone imposes no local design review on private work, so putting
    // it in `historicDistrict` would be false in a field downstream code reads
    // as a preservation-review gate. mockArcgisFetch throws on an unrouted URL,
    // so a call to layer 18 would fail this test outright; this asserts the
    // intent explicitly as well.
    const seen: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      seen.push(String(input))
      return mockArcgisFetch(milwaukeeRoutes)(input)
    })
    await getMilwaukeeParcelInfo(LAT, LNG)
    expect(seen.some((u) => u.includes('special_districts/MapServer/18'))).toBe(false)
    expect(seen.some((u) => u.includes('special_districts/MapServer/17'))).toBe(true)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Gaps must not render as answers (rule 5 / rule 18)
  // ════════════════════════════════════════════════════════════════════════

  it("a parcel the City flags as a zoning DEFECT yields a gap, and says so", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesZoningDefect))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { zoning } = res.info
    expect(zoning.districtCode).toBe('X')
    expect(zoning.maxHeightFt).toBeNull()
    expect(zoning.maxFAR).toBeNull()
    expect(zoning.farUnconstrained).toBeUndefined()
    expect(zoning.allowedUses).toBeNull()
    expect(zoning.article).toContain('A problem has been identified')
    // The parcel facts we DO have still come through.
    expect(res.info.lot.sizeSqFt).toBe(8150)
  })

  it('a zoning fetch that comes back empty yields no zoning claims', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutesNoZoning))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { zoning } = res.info
    expect(zoning.districtCode).toBe('Unknown')
    expect(zoning.maxHeightFt).toBeNull()
    expect(zoning.maxStories).toBeUndefined()
    expect(zoning.farUnconstrained).toBeUndefined()
    expect(zoning.allowedUses).toBeNull()
    // The decisive one: an unresolved district must NOT claim the chapter's
    // known FAR absence. Both carry maxFAR null; only one is a claim.
    expect(res.info.assessedValue).toBe(128800)
  })

  it('a zoning fetch returning an ArcGIS error body yields no zoning claims', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...milwaukeeRoutes, 'planning/zoning/MapServer/12': ARCGIS_ERROR_200 }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
  })

  // ════════════════════════════════════════════════════════════════════════
  // Failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('returns UPSTREAM_ERROR 502 when the parcel layer returns a 200 error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...milwaukeeRoutes, 'parcels_mprop/MapServer/2': ARCGIS_ERROR_200 }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when the parcel layer is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...milwaukeeRoutes, 'parcels_mprop/MapServer/2': { features: [] } }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('still ok:true with null overlays when every optional fetch rejects', async () => {
    const down = () => {
      throw new Error('overlay down')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...milwaukeeRoutes,
        'planning/zoning/MapServer/4': down,
        'planning/zoning/MapServer/9': down,
        'planning/zoning/MapServer/8': down,
        'special_districts/MapServer/17': down,
        NFHL: down,
      }),
    )
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    // A failed overlay fetch must not break the zoning answer.
    expect(res.info.zoning.maxHeightFt).toBe(45)
  })

  it('names its upstream sources', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(milwaukeeRoutes))
    const res = await getMilwaukeeParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.sources.parcels).toContain('milwaukeemaps.milwaukee.gov')
    // MPROP_full (layer 2), not _lite (layer 1) — only _full carries the
    // exempt-value columns.
    expect(res.info.sources.parcels).toContain('parcels_mprop/MapServer/2')
    expect(res.info.sources.zoning).toContain('planning/zoning/MapServer/12')
    expect(new Date(res.info.fetchedAt).toString()).not.toBe('Invalid Date')
  })
})

describe('selectParcel', () => {
  const row = (TAXKEY: string, PARCEL_TYPE: number | null) => ({ attributes: { TAXKEY, PARCEL_TYPE } })

  it('prefers a fee parcel over a condominium unit', () => {
    expect(selectParcel([row('9', 1), row('5', 0), row('1', 1)])?.TAXKEY).toBe('5')
  })

  it('treats PARCEL_TYPE null as a fee parcel, not as a shell', () => {
    expect(selectParcel([row('9', 1), row('5', null)])?.TAXKEY).toBe('5')
  })

  it('is order-independent — the server does not guarantee one', () => {
    const rows = [row('3', 1), row('1', 1), row('2', 1)]
    expect(selectParcel(rows)?.TAXKEY).toBe('1')
    expect(selectParcel([...rows].reverse())?.TAXKEY).toBe('1')
  })

  it('returns null on an empty or absent feature list', () => {
    expect(selectParcel([])).toBeNull()
    expect(selectParcel(undefined)).toBeNull()
  })
})

describe('ringAreaSqFt', () => {
  it('measures a simple ring in the projection unit, with no conversion factor', () => {
    // EPSG:32054 is US survey feet, so the shoelace result IS square feet.
    expect(ringAreaSqFt([[[0, 0], [100, 0], [100, 216.51], [0, 216.51], [0, 0]]])).toBeCloseTo(21651, 2)
  })

  it('nets a hole out of the outer ring', () => {
    const outer = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
    const hole = [[10, 10], [10, 20], [20, 20], [20, 10], [10, 10]]
    expect(ringAreaSqFt([outer, hole])).toBeCloseTo(9900, 6)
  })

  it('returns null rather than zero for a missing or degenerate ring', () => {
    expect(ringAreaSqFt(undefined)).toBeNull()
    expect(ringAreaSqFt([])).toBeNull()
    expect(ringAreaSqFt([[[0, 0], [1, 1], [0, 0]]])).toBeNull()
  })
})
