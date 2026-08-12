// THE INVARIANT: a failed OPTIONAL overlay read must not silently REMOVE a
// requirement. Either the layer answered and the hurdle's absence is a finding,
// or it did not answer and the report says so.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WENT WRONG
//
// `hurdles.ts` tests three overlay fields as booleans — `historicDistrict`,
// `coastalZone`, `floodZone` — and each is an `X | null` whose null collapses
// "the layer answered and nothing covers this parcel" with "the layer did not
// answer". On the second one the hurdle simply did not appear, and the months it
// carries left the timeline with it. Nothing in the response said a check had
// been skipped, so the report read exactly like a parcel that is genuinely clear
// — the shape CLAUDE.md rule 18 is about.
//
// Measured 2026-08-12 through the real `analyze` handler against live services,
// one layer faulted per run, each row re-run in isolation (rule 10):
//
//   LA, 1126 Abbot Kinney Blvd (C2-1-O-CA, live `coastalZone: true`)
//       control        AS_OF_RIGHT  57 mo  3 hurdles
//       COASTAL-FAIL   AS_OF_RIGHT  48 mo  2 hurdles   ← the CDP row, and its
//                                                        whole serial 9 months
//
//   Boston, 26 Exeter St (Back Bay Architectural District, restaurant standing)
//       control        NEEDS_RELIEF 55 mo  6 hurdles
//       HIST-FAIL      AS_OF_RIGHT  51 mo  4 hurdles   ← a transport failure
//                                                        upgraded the verdict
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE TABLE COVERS EVERY LIVE CITY
//
// Unlike `failedFetchClaims.test.ts`, whose pairs are provider-specific because
// only two cities have a fee area, these three consumers are city-agnostic:
// `hurdles.ts` reads all three fields for every city, so every provider that
// fetches those layers is exposed. `CASES` must therefore equal `LIVE_CITIES`
// exactly — a new city cannot be added without deciding what its historic and
// flood reads publish on failure.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
//   1. `CASES` is pinned to `LIVE_CITIES` by exact membership, both directions.
//   2. Every perturbation asserts `hits > 0`: the fault substring really routed
//      a request. A renamed upstream URL turns the probe into a no-op that
//      passes by testing nothing — the failure that makes an instrument
//      worthless (rule 11). This is what pins the layer URLs.
//   3. Both directions per case. The HEALTHY run must NOT mark the layer, and
//      an EMPTY answer must not either, so "mark everything always" — which
//      would bury every report under disclosures nobody reads — cannot pass.
//   4. `historic: null` ("this provider queries no historic layer") is not taken
//      on trust: those cities are asserted to mark NOTHING when every other
//      layer is faulted, and the count of them is pinned, so quietly dropping a
//      city's historic read to silence a failure goes red.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'
import { probe } from './__fixtures__/upstreamProbe'
import { assessHurdles } from '../hurdles'
import type { ParcelInfo, UnresolvedOverlay } from '../../../../src/types/parcel'
import type { AnalysisInput } from '../../../../src/types/analysis'

interface Case {
  city: string
  lat: number
  lng: number
  /** URL substrings of EVERY read feeding `historicDistrict`. `null` means this
   *  provider queries no historic layer at all — a coverage gap, not a fetch
   *  that can fail, and checked as such below. */
  historic: readonly string[] | null
  /** Why there is no historic read. Required whenever `historic` is null, so the
   *  entry cannot be a shrug. */
  historicAbsent?: string
  /** Providers reading the CA Coastal Zone polygon. */
  coastal?: readonly string[]
}

// Every city's flood read is the same FEMA NFHL service (`_endpoints.ts`), so
// one substring faults it everywhere. Asserted per city all the same: a
// provider that stopped reading it would otherwise pass by never being probed.
const FEMA = 'hazards.fema.gov'
const COASTAL_ZONE = 'Coastal_Zone_Polygon'

const CASES: Case[] = [
  { city: 'boston', lat: 42.3601, lng: -71.0589, historic: ['Historic_Districts_BLC'] },
  { city: 'nyc', lat: 40.7549, lng: -73.9857, historic: ['v_GFT_Historic_Districts'] },
  { city: 'chicago', lat: 41.8855, lng: -87.6248, historic: ['Zoning_update/MapServer/6'] },
  { city: 'sf', lat: 37.7749, lng: -122.4194, historic: ['PlanningData/MapServer/17'] },
  { city: 'seattle', lat: 47.608, lng: -122.3331, historic: ['Zoning_Overlays-Historic-Special_Review_Districts'] },
  { city: 'dc', lat: 38.8951, lng: -77.0364, historic: ['Zone_Mapservice/MapServer/6'] },
  {
    city: 'austin',
    lat: 30.2672,
    lng: -97.7431,
    historic: null,
    // A real coverage gap, and deliberately NOT laundered into this mechanism:
    // `HISTORIC_BODY.austin` in hurdles.ts describes an (H)/(HD) Certificate of
    // Appropriateness that can never fire, because the provider queries no
    // historic layer. That is a missing feature. Marking it `unresolved` would
    // report a transport failure that did not happen, on every Austin parcel.
    historicAbsent: 'providers/austin.ts queries no historic layer — a coverage gap, not a failing read',
  },
  { city: 'la', lat: 34.0522, lng: -118.2437, historic: ['NavigateLA/MapServer/75'], coastal: [COASTAL_ZONE] },
  { city: 'denver', lat: 39.7392, lng: -104.9903, historic: ['ODC_HIST_LANDMARKDISTRICT_A'] },
  { city: 'minneapolis', lat: 44.9778, lng: -93.265, historic: ['HPC_Districts'] },
  { city: 'philadelphia', lat: 39.9526, lng: -75.1635, historic: ['HistoricDistricts_Local'] },
  // Two layers feed one field, so a null is an answer only when both answered
  // (CLAUDE.md rule 13). Each is faulted separately below.
  { city: 'miami', lat: 25.7743, lng: -80.1918, historic: ['HEP/MapServer/4', 'HEP/MapServer/3'] },
  {
    city: 'sandiego',
    lat: 32.7157,
    lng: -117.1611,
    historic: ['Historic_Preservation_Resources'],
    coastal: [COASTAL_ZONE],
  },
  { city: 'sanjose', lat: 37.3382, lng: -121.8863, historic: ['PLN_Geocortex_Public_PRD/MapServer/34'] },
  { city: 'nashville', lat: 36.1627, lng: -86.7816, historic: ['ZoningOverlayDistricts/MapServer/0'] },
  // -HOD-G and -HOD-S: the two genuinely historic overlay layers, both feeding
  // the one field.
  {
    city: 'raleigh',
    lat: 35.7813,
    lng: -78.6423,
    historic: ['Planning/Overlays/MapServer/7', 'Planning/Overlays/MapServer/8'],
  },
  { city: 'milwaukee', lat: 43.0396, lng: -87.9204, historic: ['special_districts/MapServer/17'] },
  { city: 'columbus', lat: 39.9644, lng: -83.0014, historic: ['Applications/Zoning/MapServer/14'] },
  { city: 'charlotte', lat: 35.2246, lng: -80.8443, historic: ['Accela/Accela/MapServer/12'] },
  { city: 'atlanta', lat: 33.7583, lng: -84.3898, historic: ['LandUsePlanning/MapServer/6'] },
  { city: 'dallas', lat: 32.779, lng: -96.8017, historic: ['sdc_public/Zoning/MapServer/2'] },
  {
    city: 'lasvegas',
    lat: 36.1729,
    lng: -115.1541,
    historic: null,
    // Settled rather than pending, unlike Austin's: no layer on the City's GIS
    // publishes the HD-O boundary (19 service folders enumerated twice), so the
    // provider sets `historicDistrict = null` unconditionally and issues no
    // request. See the refusal recorded in providers/lasvegas.ts.
    historicAbsent: 'no City of Las Vegas layer publishes the HD-O boundary — a documented refusal',
  },
  { city: 'phoenix', lat: 33.4934, lng: -112.0844, historic: ['HistoricProperties/MapServer/0'] },
]

const run = (c: Case, opts: Parameters<typeof probe>[2] = {}) =>
  probe(getParcelInfo, { city: c.city, lat: c.lat, lng: c.lng }, opts)

const withHistoric = CASES.filter((c): c is Case & { historic: readonly string[] } => c.historic != null)
const withCoastal = CASES.filter((c): c is Case & { coastal: readonly string[] } => c.coastal != null)

describe('an optional overlay read whose failure would remove a requirement', () => {
  afterEach(() => vi.restoreAllMocks())

  it('covers exactly the live cities', () => {
    expect(CASES.length).toBeGreaterThan(0)
    expect(CASES.map((c) => c.city).sort()).toEqual([...LIVE_CITIES].sort())
  })

  // The two "no historic read" entries are pinned by NAME, not by count alone:
  // adding a third has to be a deliberate edit here, and dropping a city's
  // historic fetch to make a failure go away turns this red.
  it('pins which cities query no historic layer at all, and why', () => {
    expect(CASES.filter((c) => c.historic == null).map((c) => c.city)).toEqual(['austin', 'lasvegas'])
    for (const c of CASES.filter((c) => c.historic == null)) expect(c.historicAbsent).toBeTruthy()
  })

  it('pins which cities read the Coastal Zone', () => {
    expect(withCoastal.map((c) => c.city)).toEqual(['la', 'sandiego'])
  })

  // ── Control: a healthy run marks nothing ──────────────────────────────────
  // Without this, every case below passes by marking unconditionally — which
  // would put a "could not be checked" row on every report in every city and
  // make the disclosure meaningless.
  it.each(CASES)('$city: a healthy run marks no overlay unresolved', async (c) => {
    const r = await run(c)
    expect(r.ok).toBe(true)
    expect(r.unresolved).not.toContain('historic')
    expect(r.unresolved).not.toContain('flood')
    expect(r.unresolved).not.toContain('coastal')
  })

  // ── Control: an EMPTY answer is an answer ─────────────────────────────────
  // The distinction the whole file exists for. The layer responds, nothing
  // covers the parcel, and that must NOT be marked — otherwise the fix trades a
  // silent omission for a permanent refusal to answer.
  it.each(withHistoric)('$city: an empty answer from every historic layer is not a gap', async (c) => {
    const r = await run(c, { empty: c.historic })
    expect(r.ok).toBe(true)
    expect(r.hits).toBeGreaterThan(0)
    expect(r.unresolved).not.toContain('historic')
  })

  it.each(CASES)('$city: an empty FEMA answer is not a gap', async (c) => {
    const r = await run(c, { empty: FEMA })
    expect(r.ok).toBe(true)
    expect(r.hits).toBeGreaterThan(0)
    expect(r.unresolved).not.toContain('flood')
  })

  // ── The perturbations ─────────────────────────────────────────────────────
  // Siblings answer EMPTY while one layer is faulted: the harness answers every
  // layer with a feature, so faulting one of a joint pair alone would leave the
  // other returning a district name — a resolved field, correctly unmarked.
  it.each(withHistoric.flatMap((c) => c.historic.map((layer) => ({ ...c, layer }))))(
    '$city: a failed $layer read is recorded as an unresolved historic',
    async (c) => {
      const r = await run(c, { fail: c.layer, empty: c.historic.filter((l) => l !== c.layer) })
      expect(r.ok).toBe(true)
      expect(r.hits).toBeGreaterThan(0)
      expect(r.historicDistrict).toBeNull()
      expect(r.unresolved).toContain('historic')
    },
  )

  it.each(CASES)('$city: a failed FEMA read is recorded as an unresolved flood', async (c) => {
    const r = await run(c, { fail: FEMA })
    expect(r.ok).toBe(true)
    expect(r.hits).toBeGreaterThan(0)
    expect(r.unresolved).toContain('flood')
  })

  it.each(withCoastal)('$city: a failed Coastal Zone read is recorded as an unresolved coastal', async (c) => {
    const r = await run(c, { fail: COASTAL_ZONE })
    expect(r.ok).toBe(true)
    expect(r.hits).toBeGreaterThan(0)
    expect(r.unresolved).toContain('coastal')
  })

  // The other half of the joint dependency (CLAUDE.md rule 13): a sibling layer
  // that ANSWERS settles the question, so the field is resolved and must not be
  // marked. Without this the fix would report a gap while holding an answer.
  it.each(withHistoric.filter((c) => c.historic.length > 1))(
    '$city: a sibling historic layer that answers still resolves the field',
    async (c) => {
      for (const layer of c.historic) {
        const r = await run(c, { fail: layer })
        expect(r.ok).toBe(true)
        expect(r.hits).toBeGreaterThan(0)
        expect(r.historicDistrict).not.toBeNull()
        expect(r.unresolved).not.toContain('historic')
      }
    },
  )

  // A city with no historic read must not acquire the mark from ANY failure —
  // guarantee 4. Faulting every other city's historic layer at once is the
  // broadest available "something upstream broke" and still must not produce a
  // historic gap here, because there is no historic request to fail.
  it.each(CASES.filter((c) => c.historic == null))(
    '$city: queries no historic layer, so nothing can mark one unresolved',
    async (c) => {
      const r = await run(c, { fail: FEMA })
      expect(r.ok).toBe(true)
      expect(r.hits).toBeGreaterThan(0)
      expect(r.unresolved).toContain('flood') // non-vacuous: the run really did fault something
      expect(r.unresolved).not.toContain('historic')
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// What the mark PRODUCES. The provider half above is only half the fix: a mark
// nothing renders is the defect one layer along (CLAUDE.md rule 11).

const parcel = (overlays: Partial<ParcelInfo['overlays']> = {}): ParcelInfo => ({
  address: '1 Test St',
  addressBasis: 'record',
  parcelId: 'T1',
  coordinates: [-71.06, 42.36],
  zoning: { districtCode: 'B-2-65', subdistrict: null, article: null, maxHeightFt: 65, maxFAR: 2, allowedUses: ['residential'] },
  lot: { sizeSqFt: 10000, lotType: null },
  overlays: { historicDistrict: null, floodZone: null, ...overlays },
  sources: {},
  fetchedAt: new Date().toISOString(),
})

const project: AnalysisInput = {
  parcelId: 'T1',
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  lat: 42.36,
  lng: -71.06,
  use: 'residential',
  gfa: 20000,
  gfaBasis: 'envelope',
  units: 15,
}

const rowsFor = (city: string, unresolved: readonly UnresolvedOverlay[]) =>
  assessHurdles(city, parcel({ unresolved }), { ...project, city })

describe('the unresolved mark reaches the report', () => {
  it('publishes one "could not be checked" row per unresolved overlay', () => {
    const none = assessHurdles('la', parcel(), { ...project, city: 'la' })
    expect(none.some((h) => h.status === 'unchecked')).toBe(false)

    const marked = rowsFor('la', ['historic', 'coastal', 'flood'])
    const unchecked = marked.filter((h) => h.status === 'unchecked').map((h) => h.label)
    expect(unchecked).toEqual([
      'Historic designation could not be checked',
      'Coastal Zone status could not be checked',
      'FEMA flood zone could not be checked',
    ])
  })

  it('names the withheld months without adding them', () => {
    const marked = rowsFor('la', ['historic', 'coastal', 'flood'])
    const by = (re: RegExp) => marked.find((h) => re.test(h.label))
    // `addsMonths` would put the time in the timeline, asserting a requirement
    // that probably does not apply. `excludedMonths` only lets the UI mark the
    // figure as a floor.
    for (const h of marked.filter((x) => x.status === 'unchecked')) expect(h.addsMonths).toBeUndefined()
    // The Coastal Development Permit is serial: its 9 months add in full, which
    // is why a failed coastal read moved a live LA estimate 57 → 48 months.
    expect(by(/Coastal Zone status/)?.excludedMonths).toBe(9)
    expect(by(/Historic designation/)?.excludedMonths).toBe(3)
    // The flood hurdle carries no months, so the timeline is NOT marked — only
    // the cost is unstated. Over-marking would misdescribe what is unknown.
    expect(by(/FEMA flood zone/)?.excludedMonths).toBeUndefined()
  })

  it('uses the city-specific historic figure and body, not a generic one', () => {
    // DC's historic review is 4 months in HISTORIC_MONTHS, Boston's falls back
    // to 3 — the withheld figure has to be the city's own or the disclosure
    // understates in exactly the cities where the review is longest.
    expect(rowsFor('dc', ['historic']).find((h) => /Historic designation/.test(h.label))?.excludedMonths).toBe(4)
    expect(
      rowsFor('dc', ['historic']).find((h) => /Historic designation/.test(h.label))?.note,
    ).toMatch(/Historic Preservation Review Board/)
  })

  it('does not replace a POSITIVE finding with a disclosure', () => {
    // A district name that arrived is an answer whatever else failed. Without
    // this, the fix would trade a silent omission for a silent downgrade.
    const inDistrict = assessHurdles(
      'boston',
      parcel({ historicDistrict: 'Historic Beacon Hill District', unresolved: ['historic'] }),
      project,
    )
    expect(inDistrict.find((h) => /Historic district design review/.test(h.label))?.status).toBe('required')
    expect(inDistrict.some((h) => /Historic designation could not be checked/.test(h.label))).toBe(false)
  })

  it('does not disclose a flood gap when the layer answered with a benign zone', () => {
    const zoneX = assessHurdles('boston', parcel({ floodZone: 'X' }), project)
    expect(zoneX.some((h) => h.status === 'unchecked')).toBe(false)
  })
})
