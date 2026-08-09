import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCharlotteParcelInfo, aggregateCards } from './charlotte'
import { mockArcgisFetch, ARCGIS_ERROR_200, featureSet } from './__fixtures__'
import {
  charlotteRoutes,
  charlotteRoutesTryon,
  charlotteRoutesUncc,
  charlotteRoutesTodNc,
  charlotteRoutesOutsideCity,
  charlotteParcelTryon,
  charlotteParcelUncc,
  charlotteZoningN1C,
} from './__fixtures__/charlotte'

// These tests drive the REAL entry point, `getCharlotteParcelInfo`, rather than
// the zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live figure FIRST
// and the table's own tests called the resolver directly and passed throughout.
// A height assertion is only meaningful at the boundary a user hits.

// 1918 Dilworth Rd West.
const LAT = 35.2035
const LNG = -80.8503

describe('getCharlotteParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (N1-C(HDO)): address, pid, lot in sq ft, uses, assessed value', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutes))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    // Assembled from five separate component fields, including the directional
    // WORD in `stsuffix` — Dilworth Rd West is a different street from
    // Dilworth Rd East, so dropping it would name the wrong road.
    expect(info.address).toBe('1918 DILWORTH RD WEST')
    expect(info.parcelId).toBe('12108812')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('N1-C(HDO)')

    // 0.33204 acres x 43,560 = 14,463.66 -> 14,464 sq ft. Cross-checked live
    // against the layer's own EPSG:2264 polygon area, 14,463.49 sq ft — two
    // independent computations of the same area, agreeing to 0.2 sq ft.
    expect(info.lot.sizeSqFt).toBe(14464)

    expect(info.zoning.allowedUses).toEqual(['residential', 'institutional'])
    expect(info.assessedValue).toBe(1222500)
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.yearBuilt).toBe(1930)
    expect(info.existing?.units).toBe(1)
    expect(info.existing?.buildingAreaSqFt).toBe(2972)
    expect(info.existing?.numBuildings).toBe(1)
    // netbldgvalue is the improvement half only, and says so.
    expect(info.existing?.assessedValue).toBe(497800)
    expect(info.existing?.assessedValueBasis).toContain('improvement')
    expect(info.overlays.historicDistrict).toBe('Dilworth — Local historic district')
  })

  it('never returns the owner name — only a derived boolean', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...charlotteRoutes,
        'Accela/Accela/MapServer/16': featureSet({
          ...(charlotteParcelTryon.features[0].attributes as Record<string, unknown>),
          ownerlastname: 'CITY OF CHARLOTTE',
          ownerfirstname: null,
        }),
      }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(JSON.stringify(res.info)).not.toContain('CITY OF CHARLOTTE')
    expect(res.info.existing?.ownerPublic).toBe(true)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height at the boundary — the unit the code uses, and the use it names
  // ════════════════════════════════════════════════════════════════════════

  it('N1-C publishes 40 ft — the RESIDENTIAL row, not the 48 ft nonresidential row', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutes))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // UDO Table 4-3: row A (residential) 40, row B (nonresidential and
    // mixed-use) 48. Publishing the larger assumes a programme the user has not
    // chosen (CLAUDE.md rule 6).
    expect(res.info.zoning.maxHeightFt).toBe(40)
    expect(res.info.zoning.maxHeightFt).not.toBe(48)
    // The other row is not hidden — it is named in the label.
    expect(res.info.zoning.article).toContain('48 ft nonresidential')
  })

  it('carries FEET through untouched — no story count is ever emitted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutes))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Charlotte's UDO states height in feet and ONLY in feet — there is no
    // "stories" row in any Building Height Standards table — so there is
    // nothing to convert and nothing to round-trip (CLAUDE.md rule 12, the
    // Miami-21 87-storey defect). `maxStories` must be absent, not guessed at.
    expect(res.info.zoning.maxStories).toBeUndefined()
    expect(res.info.zoning.article ?? '').not.toMatch(/\b(storey|story|stories)\b/i)
    // 40 / 11 and 40 / 12 — what a floor-to-floor convention would have shipped.
    expect(JSON.stringify(res.info.zoning)).not.toContain('"maxStories"')
  })

  it('TOD-NC publishes 75 ft by right and never the 100 ft bonus', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutesTodNc))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(75)
    expect(res.info.zoning.maxHeightFt).not.toBe(100)
    // The bonus exists and the label says so — with the word that makes it not
    // a by-right figure.
    expect(res.info.zoning.article).toContain('100 ft')
    expect(res.info.zoning.article).toContain('EARNED')
  })

  // ════════════════════════════════════════════════════════════════════════
  // FAR: a known absence, and never a fallback
  // ════════════════════════════════════════════════════════════════════════

  it('asserts the FAR absence on a UDO parcel and never an assumed 1.0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutes))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
  })

  it('a site-plan-governed parcel asserts NOTHING about FAR', async () => {
    // UMUD-O is a pre-UDO optional district. UDO Sec. 1.4.C leaves it under the
    // superseded 1992 ordinance plus its site plan, and that ordinance has not
    // been read here — so the FAR absence (a claim about the UDO) must not be
    // asserted, and `farUnconstrained` must be absent rather than true.
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutesTryon))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.allowedUses).toBeNull()
    // …and the reason is stated, so a reader can tell an answer from a failure.
    expect(res.info.zoning.article).toContain('Sec. 1.4.C')
    expect(res.info.zoning.article).toContain('site plan')
    // The layer's link to the rezoning petition is surfaced, because on this
    // parcel that petition IS the binding standard.
    expect(res.info.sources.zoningPetition).toContain('2019-161')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The multi-card join — the defect a single call always looks fine for
  // ════════════════════════════════════════════════════════════════════════

  it('sums value across TAX ACCOUNTS and building area across CARDS', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutesTryon))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    // Three rows, two tax accounts. `totalvalue` is 279,675,400 on BOTH rows of
    // taxpid 12512108 and 9,500,500 on 12512109, so the answer is the sum over
    // DISTINCT accounts: 289,175,900.
    expect(info.assessedValue).toBe(289175900)
    // Taking features[0] gives 9,500,500 — a 29x understatement — and summing
    // every row gives 568,851,300, which double-counts the big account. Both
    // are pinned out.
    expect(info.assessedValue).not.toBe(9500500)
    expect(info.assessedValue).not.toBe(568851300)

    // `heatedarea` is per CARD, so it sums across all three rows.
    expect(info.existing?.buildingAreaSqFt).toBe(28182 + 500133 + 766567)
    expect(info.existing?.numBuildings).toBe(3)
    // Improvement value likewise deduplicated on the account.
    expect(info.existing?.assessedValue).toBe(8379800 + 248776400)
    expect(info.existing?.assessedValueBasis).toContain('2 tax accounts')

    // One parcel, one lot area — `totalac` repeats identically on every card
    // and must not be summed.
    expect(info.lot.sizeSqFt).toBe(Math.round(2.97801 * 43560))
    expect(info.parcelId).toBe('12512C97')
  })

  it('takes the EARLIEST year built on a multi-building parcel', async () => {
    // "Whichever card the server ordered first" is not a fact about the parcel;
    // the oldest structure is, and it is what bears on demolition and historic
    // review. The UNCC fixture's three cards read 1966 / 1985 / 1966.
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutesUncc))
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.yearBuilt).toBe(1966)
  })

  it('aggregateCards is exercised directly on the two shapes that differ', () => {
    // The unit-level companion to the boundary test above, kept because the
    // grain mismatch is the whole defect: value fields repeat per account,
    // building fields vary per card.
    const cards = charlotteParcelTryon.features.map((f) => f.attributes)
    const agg = aggregateCards(cards)
    expect(agg.accountCount).toBe(2)
    expect(agg.totalValue).toBe(289175900)
    expect(agg.heatedAreaSqFt).toBe(1294882)
    expect(agg.buildingCount).toBe(3)

    // The UNCC fixture is three of the live 52 rows, all on one account.
    const uncc = aggregateCards(charlotteParcelUncc.features.map((f) => f.attributes))
    expect(uncc.accountCount).toBe(1)
    expect(uncc.totalValue).toBe(246391200)
    expect(uncc.heatedAreaSqFt).toBe(30753 + 8037 + 32480)
    expect(uncc.units).toBe(3)

    // An empty card list asserts nothing rather than zero — a parcel with no
    // assessor record is not a parcel worth $0.
    const none = aggregateCards([])
    expect(none.totalValue).toBeNull()
    expect(none.units).toBeNull()
    expect(none.earliestYearBuilt).toBeNull()
    expect(none.buildingCount).toBeNull()
  })

  it('does not mix two parcels when the query returns cards from both', async () => {
    // A buffered snap can straddle a boundary. Aggregating across pids would
    // add a neighbour's building and a neighbour's assessment into this
    // parcel's totals — an error in the same direction as the double-count
    // above and just as invisible in a single call. Driven through the entry
    // point, not through aggregateCards, because the pid filter lives there.
    const tryonCards = charlotteParcelTryon.features.map((f) => f.attributes)
    const neighbour = { ...tryonCards[0], pid: 'OTHER99', taxpid: 'OTHER99', totalvalue: 50000000, heatedarea: 99999 }
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...charlotteRoutesTryon,
        'Accela/Accela/MapServer/16': { features: [...tryonCards, neighbour].map((attributes) => ({ attributes })) },
      }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.parcelId).toBe('12512C97')
    expect(res.info.assessedValue).toBe(289175900)
    expect(res.info.existing?.buildingAreaSqFt).toBe(1294882)
    expect(res.info.existing?.numBuildings).toBe(3)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Jurisdiction: outside Charlotte must be a GAP, not a fabricated answer
  // ════════════════════════════════════════════════════════════════════════

  it('a Huntersville parcel returns real parcel data and NO zoning verdict', async () => {
    // The parcel layer is county-wide; the Charlotte zoning layer stops at the
    // city limits and returns zero features there (probed live at
    // 35.4107,-80.8428). That must surface as a gap, and it must never quietly
    // become a substantive answer.
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(charlotteRoutesOutsideCity))
    const res = await getCharlotteParcelInfo(35.4107, -80.8428)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res
    expect(info.address).toBe('14632 S OLD STATESVILLE RD')
    expect(info.zoning.districtCode).toBe('Unknown')
    expect(info.zoning.maxHeightFt).toBeNull()
    expect(info.zoning.maxFAR).toBeNull()
    expect(info.zoning.farUnconstrained).toBeUndefined()
    expect(info.zoning.allowedUses).toBeNull()
    expect(info.zoning.article).toBeNull()
    // The parcel record itself is real and is still returned.
    expect(info.lot.sizeSqFt).toBe(Math.round(0.1992 * 43560))
    expect(info.assessedValue).toBe(682600)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Upstream failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('treats a 200-with-error-JSON parcel body as an upstream failure, not "no parcel"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...charlotteRoutes, 'Accela/Accela/MapServer/16': ARCGIS_ERROR_200 }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL when the parcel layer legitimately has nothing there', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...charlotteRoutes, 'Accela/Accela/MapServer/16': { features: [] } }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('a failed ZONING fetch renders as a gap, never as a substantive answer', async () => {
    // CLAUDE.md rule 5: a failed fetch must never silently become an answer.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...charlotteRoutes,
        'PLN/Zoning/MapServer/0': () => {
          throw new Error('zoning down')
        },
      }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('Unknown')
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    // The parcel half still resolves.
    expect(res.info.parcelId).toBe('12108812')
  })

  it('degrades gracefully when the optional historic and flood layers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...charlotteRoutes,
        'Accela/Accela/MapServer/12': () => {
          throw new Error('historic down')
        },
        NFHL: ARCGIS_ERROR_200,
      }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBe(40)
    // The (HDO) marker in the zoning string still names the overlay, so the
    // subdistrict label survives the historic layer being down — but it is NOT
    // promoted to `historicDistrict`, which downstream code reads as a
    // preservation-review trigger sourced from the historic layer.
    expect(res.info.zoning.subdistrict).toBe('Historic District Overlay')
  })

  it('names the overlay from the zoning string when the historic layer is silent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...charlotteRoutes,
        'Accela/Accela/MapServer/12': { features: [] },
        'PLN/Zoning/MapServer/0': charlotteZoningN1C,
      }),
    )
    const res = await getCharlotteParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // UDO Sec. 14.2 spells it "Historic District Overlay"; the label is taken
    // from the article, not guessed from the letters.
    expect(res.info.zoning.subdistrict).toBe('Historic District Overlay')
  })
})
