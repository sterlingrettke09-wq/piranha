import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDallasParcelInfo } from './dallas'
import { mockArcgisFetch, ARCGIS_ERROR_200 } from './__fixtures__'
import {
  dallasRoutes,
  dallasRoutesCa1,
  dallasRoutesMf3,
  dallasRoutesCr,
  dallasRoutesPd269,
  dallasRoutesCd7,
  dallasRoutesWmu5,
  dallasRoutesChap51,
  dallasRoutesCondo,
  dallasRoutesHighlandPark,
  dallasRoutesCityLimitsDown,
  dallasRoutesNullCityAttribute,
  dallasRoutesMu3,
  dallasRoutesMuTypo,
} from './__fixtures__/dallas'

// These tests drive the REAL entry point, `getDallasParcelInfo`, rather than the
// zoning resolver underneath it (CLAUDE.md rule 11). The distinction is not
// academic: Denver's curated table was corrected while every real parcel kept
// publishing the old height, because the provider consulted a live story count
// FIRST and the table's own tests called the resolver directly and passed
// throughout. A limit assertion is only meaningful at the boundary a user hits.

// 7322 Thurston Dr — the R-7.5(A) probe parcel.
const LAT = 32.833874
const LNG = -96.851017

describe('getDallasParcelInfo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('happy path (R-7.5(A)): address, account, lot in sq ft, uses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutes))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { info } = res

    expect(info.address).toBe('7322 THURSTON DR')
    expect(info.parcelId).toBe('00000213379000000')
    expect(info.coordinates).toEqual([LNG, LAT])
    expect(info.zoning.districtCode).toBe('R-7.5(A)')

    // AREA_FEET IS square feet: the layer's native SR is EPSG:2276 (NAD83 Texas
    // North Central, US survey feet). Verified externally by requesting geometry
    // at outSR=2276 and shoelacing the rings — ratio 1.000000 on 4 of 4 sampled
    // parcels, and invariant to the query's outSR. No conversion happens here,
    // so no conversion can drift.
    expect(info.lot.sizeSqFt).toBe(7610)

    expect(info.zoning.allowedUses).toEqual(['residential'])
    expect(info.overlays.floodZone).toBe('X')
    expect(info.existing?.landUse).toBe('SINGLE FAMILY RESIDENCES')
    expect(info.sources.appraisalDistrict).toContain('dallascad.org')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The FAR slot, at the boundary, answered both ways
  // ════════════════════════════════════════════════════════════════════════

  // §51A-4.112(f)(4)(D), verbatim: "Floor area ratio. No maximum floor area
  // ratio." The slot exists and the code fills it with "no maximum" — an ANSWER
  // (rule 5), which must never fall through to an assumed FAR of 1.0.
  it('R-7.5(A): the code states no FAR, and the output says so in words', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutes))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
    expect(res.info.zoning.article).toContain('NO maximum floor area ratio')
    expect(res.info.zoning.article).toContain('No maximum floor area ratio')
  })

  // The refusal, at the same boundary. Without a district that says no, the
  // claim above is unfalsifiable.
  it('MF-3(A): the same slot holds 2.0, and the output REFUSES the unconstrained claim', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMf3))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('MF-3(A)')
    expect(res.info.zoning.maxFAR).toBe(2.0)
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxHeightFt).toBe(90)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Height and stories: both stated, neither derived
  // ════════════════════════════════════════════════════════════════════════

  // Dallas prints feet in slot (E) and stories in slot (H). Publishing a story
  // count derived from feet is the Miami-21 defect; publishing feet derived from
  // stories is the same defect running the other way.
  it('CR publishes both the code\'s 54 ft and the code\'s 4 stories, unmodified', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCr))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(54)
    expect(res.info.zoning.maxStories).toBe(4)
    // 54/4 = 13.5, and no constant reproduces every district — so the pair being
    // consistent with SOME ratio is not evidence either was derived. What makes
    // it safe is that both came from the table with their own citations, which
    // the article carries.
    expect(res.info.zoning.article).toContain('not derived from it')
  })

  // §51A-4.124(a)(4)(E), verbatim: "Height. Maximum structure height is any
  // legal height." ParcelInfo has no `heightUnconstrained` field, so the only
  // way to keep this from rendering as "we could not find a height" is to say it
  // in `article` — and this test is what stops that sentence being dropped.
  it('CA-1(A): the code states NO maximum height, and the output says so', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCa1))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.article).toContain('imposes NO maximum structure height')
    expect(res.info.zoning.article).toContain('not a gap in our data')
    expect(res.info.zoning.maxFAR).toBe(20)
  })

  // MU-1's story slot states 7 stories at 90 ft and 9 at 120 ft — both
  // mixed-use-project heights. At the 80 ft base neither limb applies, so no
  // story figure is published and the reason is stated. "Not stated" and "no
  // maximum" render identically as a bare null.
  it('MU-1: a story slot that does not reach the base case publishes nothing, and explains why', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMuTypo))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(80)
    expect('maxStories' in res.info.zoning).toBe(false)
    expect(res.info.zoning.article).toContain('stated only for the mixed-use-project heights')
    // …against the district that really does have no story maximum.
    expect(res.info.zoning.article).not.toContain('no maximum number of stories')
  })

  it('R-7.5(A): the code states no story maximum, and that is said differently', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutes))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect('maxStories' in res.info.zoning).toBe(false)
    expect(res.info.zoning.article).toContain('states no maximum number of stories')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The both-fields resolution path (rule 13)
  // ════════════════════════════════════════════════════════════════════════

  // One live polygon carries LONG_ZONE_DIST 'MU=1' and ZONE_DIST 'MU-1'. The
  // user is shown the mapped label, because that is what the city's zoning map
  // prints; the limits come from the field that resolves.
  it('resolves a malformed mapped label through ZONE_DIST, and still shows the label', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMuTypo))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('MU=1')
    expect(res.info.zoning.maxFAR).toBe(0.8)
    expect(res.info.zoning.article).toContain('Mixed use district 1')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Per-program FAR sub-caps
  // ════════════════════════════════════════════════════════════════════════

  // §51A-4.122(b)(4)(D): "(i) 0.5 for office uses; and (ii) 0.75 for all uses
  // combined." The fixture is an OFFICE BUILDING, so the 0.5 is the number that
  // actually binds this site — and the engine applies 0.75. Saying so is the
  // only honest render available without widening the shared type.
  it('CR: publishes the combined 0.75 and states the office sub-cap in words', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCr))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBe(0.75)
    expect(res.info.zoning.article).toContain('ALL USES COMBINED')
    expect(res.info.zoning.article).toContain('0.5 for office uses')
    // And it must NOT quietly become a per-use FAR the engine would apply — the
    // code's limb vocabulary does not map onto this type's four keys.
    expect(res.info.zoning.farByUse).toBeUndefined()
  })

  // ════════════════════════════════════════════════════════════════════════
  // Alternatives are elected programs, never the headline (rule 6)
  // ════════════════════════════════════════════════════════════════════════

  it('MU-3: the base 3.2 is the headline and the MUP tiers ride as alternatives', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMu3))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBe(3.2)
    expect(res.info.zoning.farAlternatives?.map((a) => a.far)).toEqual([3.6, 4.0, 4.0, 4.5])
    expect(res.info.zoning.article).toContain('approved by the building official')
    expect(res.info.zoning.maxHeightFt).toBe(270)
    expect(res.info.zoning.maxStories).toBe(20)
  })

  // Division 51A-4.1100's mixed-income tables and Division 51A-4.900's SAH
  // ladders are conditioned on deed-restricted affordable units. They are not
  // by-right allowances and must appear nowhere in the output.
  it('no affordability-conditioned bonus reaches the output', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMf3))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // MF-3(A)'s mixed-income tiers are 90/105/120 ft with 100/120/150 du/acre.
    expect(res.info.zoning.maxHeightFt).toBe(90)
    expect(res.info.zoning.farAlternatives).toBeUndefined()
    expect(res.info.zoning.article).not.toContain('Income band')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Gaps must render as gaps (rule 5)
  // ════════════════════════════════════════════════════════════════════════

  // WMU-5 is a real mapped district in Article XIII that this build did not
  // read. It must come back with the code visible and nothing asserted about it
  // — above all it must NOT acquire `farUnconstrained`, which would tell a
  // reader the code imposes no FAR when nobody has looked.
  it('an uncurated district (WMU-5) is a GAP, not an absence', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesWmu5))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('WMU-5')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
    expect(res.info.zoning.article).toBeNull()
    // The parcel itself still resolves — a zoning gap is not a parcel failure.
    expect(res.info.address).toBe('1801 E WHEATLAND RD')
    expect(res.info.lot.sizeSqFt).toBe(2794146)
  })

  // "GR Chap 51" is a district of the FORMER Dallas Development Code. Chapter
  // 51A establishes no GR district at all, so a 51A lookup must miss — and it
  // must miss on the family fallback too, or the Chapter 51 label would quietly
  // acquire Chapter 51A figures.
  it('a superseded Chapter 51 district resolves to nothing through EITHER field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesChap51))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('GR Chap 51')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.allowedUses).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // The jurisdiction gate
  // ════════════════════════════════════════════════════════════════════════

  // Highland Park is an independent city entirely surrounded by Dallas, so it
  // sits in the middle of any Dallas bounding box. The parcel layer covers it
  // (it is regional); the zoning layer stops at the city limits.
  //
  // A zoning gap alone was NOT enough. Before the gate, this returned ok:true
  // with a real address and a real lot area and only the district missing — and
  // a lot area is all the cost engine needs to print a confident dollar figure
  // for land this tool does not cover. Refusing is the only honest render.
  it('a parcel inside an enclave city is REFUSED, not answered with a zoning gap', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesHighlandPark))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('OUT_OF_BBOX')
    expect(res.message).toContain('outside the City of Dallas')
    // Nothing about the Highland Park parcel escapes — not the account, not the
    // address, and above all not the lot area.
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('600865000B0010000')
    expect(serialized).not.toContain('MOCKINGBIRD')
    expect(serialized).not.toContain('422633')
  })

  // ⚠️ THE REASON THE GATE IS A POLYGON AND NOT `CITY = 'DALLAS'`. Cross-tabbing
  // both instruments against the zoning layer over 119 random in-bbox points
  // that returned a parcel (2026-08-09, two seeds) gave 119/119 for the polygon
  // and 118/119 for the attribute. This is the one that differed: a parcel row
  // whose every attribute is null, at a point the zoning layer resolves to
  // TH-3(A) and the city-limits polygon contains. An attribute gate refuses it.
  it('a Dallas parcel with a null CITY attribute is still answered', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesNullCityAttribute))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('TH-3(A)')
    expect(res.info.lot.sizeSqFt).toBe(6019)
    // The row carries no account number, and an absent id is an empty string
    // here — never a fabricated one.
    expect(res.info.parcelId).toBe('')
  })

  // Degrading OPEN is a deliberate choice, matching columbus.ts: refusing a real
  // Dallas address because an optional boundary layer timed out is a worse
  // failure than the one the gate prevents, and an out-of-city point still
  // surfaces as a zoning gap without it.
  it('the jurisdiction gate degrades OPEN when the city-limits layer fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCityLimitsDown))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('R-7.5(A)')
  })

  // The gate must read the point itself. A buffered retry would pull the city
  // limits 30 m across the line and open the gate for the enclave it exists to
  // close — the exact defect phoenix.ts records against its zoning fetch.
  it('the city-limits query carries no distance= buffer', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      urls.push(String(input))
      return mockArcgisFetch(dallasRoutes)(input)
    })
    await getDallasParcelInfo(LAT, LNG)
    const cityUrls = urls.filter((u) => u.includes('Basemap/CityLimits/MapServer/0'))
    expect(cityUrls.length).toBeGreaterThan(0)
    for (const u of cityUrls) expect(u).not.toContain('distance=')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Districts governed by an ordinance outside Chapter 51A
  // ════════════════════════════════════════════════════════════════════════

  // 18% of Dallas's zoned acreage is PD. Its limits exist — §51A-4.702(a)(5)
  // codifies them in Chapter 51P — so this must read as incomplete, not as "no
  // FAR applies here".
  it('PD-269 reads as plan-governed and does not claim the FAR is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesPd269))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('PD-269')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('Planned Development district')
    expect(res.info.zoning.article).toContain('Chapter 51P')
    expect(res.info.zoning.article).toContain('incomplete, not absent')
    // The PD Subdistricts layer's tract label, with its trailing space trimmed.
    expect(res.info.zoning.subdistrict).toBe('PD-269 (Tract A)')
  })

  it('CD-7 reads as ordinance-governed, and cites the conservation-district section', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCd7))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('CD-7')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.article).toContain('Conservation District')
    expect(res.info.zoning.article).toContain('51A-4.505')
    expect(res.info.zoning.subdistrict).toBe('Bishop Eighth Conservation District')
  })

  // ════════════════════════════════════════════════════════════════════════
  // The condominium footprint, and the id that is not an id
  // ════════════════════════════════════════════════════════════════════════

  // Measured: 3,660 of 500,142 parcel rows carry the literal string 'MULTIPLE'
  // in ACCT with null address, owner and classification. Publishing 'MULTIPLE'
  // as a parcel id would look completely fine in the UI and match nothing at the
  // appraisal district — which is why it needs a test rather than an eyeball.
  it('never publishes the literal string MULTIPLE as a parcel id', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCondo))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.parcelId).toBe('')
    expect(res.info.parcelId).not.toBe('MULTIPLE')
    // The rest of the row is still usable: real geometry, real area, real zoning.
    expect(res.info.lot.sizeSqFt).toBe(237085)
    expect(res.info.zoning.districtCode).toBe('CA-1(A)')
    expect(res.info.address).toBe('Selected location')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Fields this layer does not have
  // ════════════════════════════════════════════════════════════════════════

  // All 43 columns were enumerated from the layer's schema: there is no
  // appraised value, no assessed value, no year built and no unit count. A zero
  // would read as a worthless or vacant parcel; a proxy would be an invented
  // number wearing a citation.
  it('publishes no value and no unit count, because the layer carries neither', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutes))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.assessedValue).toBeUndefined()
    expect(res.info.existing?.assessedValue).toBeUndefined()
    expect(res.info.existing?.units).toBeUndefined()
    expect(res.info.existing?.yearBuilt).toBeUndefined()
    // …and points at where those figures actually live.
    expect(res.info.sources.appraisalDistrict).toContain('dallascad.org')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Uses, read rather than inferred
  // ════════════════════════════════════════════════════════════════════════

  // CR prints "(I) Residential uses." in its main-use list and the only item
  // under it is a college dormitory. A district that looks residential-capable
  // and permits no dwelling is the Atlanta I-1 shape, and the tool must not
  // assert a housing right that does not exist.
  it('CR permits no dwelling, so residential is withheld', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCr))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'institutional'])
  })

  it('CA-1(A) permits dwellings and commerce, so it carries both plus mixed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCa1))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.allowedUses).toEqual(['residential', 'commercial', 'mixed', 'institutional'])
  })

  // ════════════════════════════════════════════════════════════════════════
  // Overlays
  // ════════════════════════════════════════════════════════════════════════

  it('populates historicDistrict only from the Historic Overlay layer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesCa1))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('West End Historic District')
  })

  it('a PD subdistrict is not allowed to masquerade as a historic district', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesPd269))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
  })

  it('surfaces a recorded specific use permit without claiming it changes the envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesChap51))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.article).toContain('Electric Substation')
    expect(res.info.zoning.article).toContain('does not change the district\'s dimensional standards')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Upstream failure modes
  // ════════════════════════════════════════════════════════════════════════

  it('reports an upstream failure as 502, not as "no parcel here"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...dallasRoutes,
        'Basemap/DallasTaxParcels/MapServer/0': () => {
          throw new Error('parcel service down')
        },
      }),
    )
    const res = await getDallasParcelInfo(LAT, LNG)
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
      mockArcgisFetch({ ...dallasRoutes, 'Basemap/DallasTaxParcels/MapServer/0': ARCGIS_ERROR_200 }),
    )
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })

  it('degrades gracefully when only the optional overlay layers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        ...dallasRoutesCa1,
        'sdc_public/Zoning/MapServer/9': () => {
          throw new Error('pd subdistricts down')
        },
        'sdc_public/Zoning/MapServer/2': () => {
          throw new Error('historic down')
        },
        'sdc_public/Zoning/MapServer/4': () => {
          throw new Error('sup down')
        },
        NFHL: () => {
          throw new Error('fema down')
        },
      }),
    )
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.districtCode).toBe('CA-1(A)')
    expect(res.info.zoning.maxFAR).toBe(20)
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
  })

  it('returns NO_PARCEL when the parcel layer has nothing at the point', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({ ...dallasRoutes, 'Basemap/DallasTaxParcels/MapServer/0': { features: [] } }),
    )
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })

  it('never returns the taxpayer name, only the derived public-ownership boolean', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockArcgisFetch(dallasRoutesMf3))
    const res = await getDallasParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(JSON.stringify(res.info)).not.toContain('MAEDC')
  })
})
