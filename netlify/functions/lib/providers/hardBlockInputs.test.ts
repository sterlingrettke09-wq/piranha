// THE INVARIANT: any input to a hard block must come from a read that can REFUSE.
// If it cannot refuse, the block is advisory rather than a block.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WENT WRONG
//
// `assessDevelopability` (src/lib/developability.ts) is the only thing standing
// between a user and a priced development scenario for a courthouse. It HARD
// BLOCKS on three inputs — `ownerPublic`, `landUse`, `districtCode` — and each of
// those is derived from an upstream read inside a provider.
//
// Which read was never a stated property of the field. It was whatever each
// provider happened to do, and providers diverged. Counted off the table below:
// 17 of the 23 live cities carry `ownerPublic`, and 15 derived it from a
// REQUIRED read (`readRequired`, which refuses) while Philadelphia derived it
// from the OPA assessor join and San Diego from the city-land layer — both
// inside a `Promise.allSettled` that fails silently to `null`. `landUse` was
// worse and had not been looked at: 19 cities carry it, 4 sourced it from an
// optional read (Philadelphia, San Diego, SF's land-use layer, Minneapolis's
// park layer). `districtCode` was already clean — upstreamSplit.test.ts is why.
//
// Measured 2026-08-11 on a city-owned Philadelphia parcel, faulting ONLY that
// one layer at the `analyze` handler:
//
//     control    developable:false — "government-owned"
//     OPA-FAIL   developable:true  — full report, costs.total $16,829,936
//
// A timeout erased a hard block and published a priced project for a government
// building, and nothing in the output signalled that a check had not run. That
// is CLAUDE.md rule 5's corollary (a failed fetch must never silently become a
// substantive answer) meeting rule 18 (the surviving errors are the ones that
// produced plausible output — nobody interrogates a full report).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A TABLE AND NOT A COMMENT (CLAUDE.md rule 14)
//
// "Source this from a required read" as a comment is exactly what let the two
// providers diverge in the first place. What follows is the INVENTORY: for every
// live city, for every hard-block input, the upstream reads it is derived from.
// Every one of them is then faulted at the real entry point and must refuse.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
//   1. `CASES` must cover exactly `LIVE_CITIES`, and the per-input declarations
//      are a `Record<HardBlockInput, …>` — so adding a city, or adding a fourth
//      input to `assessDevelopability`, is a failure until someone states where
//      it comes from. The `HARD_BLOCK_INPUTS` list is checked against the
//      function's own parameter type at COMPILE time, in both directions.
//   2. Each hard-block input is separately shown to still BE a hard block, with
//      the value that trips it. An input that quietly stopped blocking would
//      otherwise make every perturbation below vacuous.
//   3. Every perturbation asserts `hits > 0` — the routing substring really
//      matched a request. A renamed upstream URL turns the probe into a no-op.
//   4. `from: []` ("this provider never sets it") is not taken on trust. The
//      control run injects a government owner name into the field the provider
//      reads, and a city claiming not to carry `ownerPublic` must still not
//      produce one. That also pins the owner FIELD NAME per city: a renamed
//      upstream field silently disables the block, and this goes red instead.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'
import { assessDevelopability } from '../../../../src/lib/developability'
import { probe, type Injection } from './__fixtures__/upstreamProbe'

// ─────────────────────────────────────────────────────────────────────────────
// The inputs themselves, pinned against the function's own signature.

type HardBlockInput = keyof Parameters<typeof assessDevelopability>[0]

const HARD_BLOCK_INPUTS = ['districtCode', 'landUse', 'ownerPublic'] as const
type Listed = (typeof HARD_BLOCK_INPUTS)[number]

// Compile-time, BOTH directions. Add a parameter to `assessDevelopability` and
// the first line stops compiling until it is listed here; list something that is
// not a parameter and the second stops compiling. This is the structure that
// replaces "remember to update the test".
const _everyInputIsListed: Exclude<HardBlockInput, Listed>[] = []
const _everyListedIsAnInput: Exclude<Listed, HardBlockInput>[] = []
void _everyInputIsListed
void _everyListedIsAnInput

/** A value that demonstrably trips the block, per input. Guarantee 2. */
const TRIPS: Record<Listed, Parameters<typeof assessDevelopability>[0]> = {
  districtCode: { districtCode: 'OS-1' },
  landUse: { districtCode: 'R-1', landUse: 'Public park' },
  ownerPublic: { districtCode: 'R-1', ownerPublic: true },
}

// ─────────────────────────────────────────────────────────────────────────────
// The inventory.

interface Src {
  /** URL substrings of the reads this input is derived from, in this provider.
   *  Every one is faulted below and must make the provider REFUSE. Empty means
   *  the provider never sets the field. */
  from: readonly string[]
  /** Set ONLY where a failed read legitimately does not refuse, and the reason
   *  must name a second source for the same fact — never convenience. Counted
   *  and pinned below, so adding one is a deliberate act. */
  advisory?: string
  /** Why this provider carries no such input. Documentation; the control run is
   *  what actually checks it. */
  absent?: string
}

interface Case extends Record<Listed, Src> {
  city: string
  lat: number
  lng: number
  /** The field the government-owner heuristic reads, and the layer carrying it.
   *  A government name is injected here in the control run, so this pins the
   *  field name as well as the wiring. `null` where the provider derives
   *  `ownerPublic` from something other than an owner name. */
  ownerField: { layer: string; field: string } | null
  /** Layers that only return a feature when the parcel IS public — Minneapolis's
   *  park boundaries, San Diego's city-owned property. The harness answers every
   *  layer with a feature, so an "ordinary private parcel" control has to say
   *  which layers answer EMPTY. Emptying them is the right control anyway: that
   *  is exactly what an ordinary parcel looks like upstream. */
  publicOnlyLayers?: readonly string[]
}

const CASES: Case[] = [
  {
    city: 'boston',
    lat: 42.3601,
    lng: -71.0589,
    districtCode: { from: ['Zoning_Subdistricts_Urban_20240719'] },
    landUse: { from: ['Parcels_24_detailed'] },
    ownerPublic: { from: ['Parcels_24_detailed'] },
    ownerField: { layer: 'Parcels_24_detailed', field: 'OWNER' },
  },
  {
    city: 'nyc',
    lat: 40.7549,
    lng: -73.9857,
    // NYC reads all three off ONE PLUTO fetch, which is why it never had this
    // defect: there is no second, weaker read for them to diverge into.
    districtCode: { from: ['MAPPLUTO'] },
    landUse: { from: ['MAPPLUTO'] },
    ownerPublic: { from: ['MAPPLUTO'] },
    ownerField: { layer: 'MAPPLUTO', field: 'OwnerName' },
  },
  {
    city: 'chicago',
    lat: 41.8855,
    lng: -87.6248,
    districtCode: { from: ['Zoning_update/MapServer/15'] },
    landUse: { from: ['parcelHistorical'] },
    ownerPublic: { from: [], absent: 'The Cook County parcel layer read here carries no owner name.' },
    ownerField: null,
  },
  {
    city: 'sf',
    lat: 37.7749,
    lng: -122.4194,
    districtCode: { from: ['PlanningData/MapServer/3'] },
    // FIXED 2026-08-11 — this was an `allSettled` read. Exactly one value in
    // SF_LANDUSE is a hard block: code OPENSPACE -> 'Open space' -> PUBLIC_LANDUSE.
    // Measured, not assumed. A timeout on this layer published a priced scenario
    // for parkland.
    landUse: { from: ['PlanningData/MapServer/35'] },
    ownerPublic: { from: [], absent: 'No owner field on any SF layer this provider reads.' },
    ownerField: null,
  },
  {
    city: 'seattle',
    lat: 47.608,
    lng: -122.3331,
    districtCode: { from: ['Current_Land_Use_Zoning_Detail_2'] },
    landUse: { from: ['Parcel_Boundary'] },
    ownerPublic: { from: [], absent: 'The King County parcel layer read here carries no owner name.' },
    ownerField: null,
  },
  {
    city: 'dc',
    lat: 38.8951,
    lng: -77.0364,
    districtCode: { from: ['Zone_Mapservice/MapServer/24'] },
    landUse: { from: ['Property_and_Land/MapServer/40'] },
    ownerPublic: { from: ['Property_and_Land/MapServer/40'] },
    ownerField: { layer: 'Property_and_Land/MapServer/40', field: 'OWNERNAME' },
  },
  {
    city: 'austin',
    lat: 30.2672,
    lng: -97.7431,
    districtCode: { from: ['Current_Zoning_gdb'] },
    landUse: { from: [], absent: 'Austin sets no `existing` block at all — no use field is read.' },
    ownerPublic: { from: [], absent: 'Same: no owner field is read.' },
    ownerField: null,
  },
  {
    city: 'la',
    lat: 34.0522,
    lng: -118.2437,
    districtCode: { from: ['NavigateLA/MapServer/71'] },
    landUse: { from: ['LACounty_Parcel'] },
    ownerPublic: { from: [], absent: 'The LA County parcel layer read here exposes use, not owner.' },
    ownerField: null,
  },
  {
    city: 'denver',
    lat: 39.7392,
    lng: -104.9903,
    districtCode: { from: ['Zoning/MapServer/1'] },
    landUse: { from: ['Zoning/MapServer/0'] },
    ownerPublic: { from: ['Zoning/MapServer/0'] },
    ownerField: { layer: 'Zoning/MapServer/0', field: 'OWNER_NAME' },
  },
  {
    city: 'minneapolis',
    lat: 44.9778,
    lng: -93.265,
    districtCode: { from: ['Planning_Primary_Zoning'] },
    // FIXED 2026-08-11, and it was worse than optional — it was DEAD. The label
    // was "<name> (park)", which PUBLIC_LANDUSE does not match: there is no bare
    // \bpark\b token, deliberately, so that "Trailer park" cannot block a private
    // lot. Measured at the real helper — assessDevelopability(landUse:'Loring
    // (park)') returned developable TRUE. And nothing else covered it:
    // isGovernmentOwner('MINNEAPOLIS PARK & RECREATION BOARD') is false (MPRB,
    // not the City, is the owner of record) and the zoning layer reports an
    // ordinary residential code over parkland. Minneapolis parks were unblocked.
    landUse: { from: ['Parks/FeatureServer'] },
    ownerPublic: { from: ['LAND_PROPERTY'] },
    ownerField: { layer: 'LAND_PROPERTY', field: 'OWNER_NM' },
    publicOnlyLayers: ['Parks/FeatureServer'],
  },
  {
    city: 'philadelphia',
    lat: 39.9526,
    lng: -75.1635,
    districtCode: { from: ['Zoning_BaseDistricts'] },
    // FIXED 2026-08-11 — the measured defect at the top of this file. Both
    // inputs come off the OPA assessor join, which was an `allSettled` read.
    landUse: { from: ['OPA_PROPERTIES_PUBLIC'] },
    ownerPublic: { from: ['OPA_PROPERTIES_PUBLIC'] },
    ownerField: { layer: 'OPA_PROPERTIES_PUBLIC', field: 'owner_1' },
  },
  {
    city: 'miami',
    lat: 25.7743,
    lng: -80.1918,
    districtCode: { from: ['ZoningMiami21'] },
    landUse: { from: ['MD_LandInformation/MapServer/26'] },
    ownerPublic: { from: ['MD_LandInformation/MapServer/26'] },
    ownerField: { layer: 'MD_LandInformation/MapServer/26', field: 'TRUE_OWNER1' },
  },
  {
    city: 'sandiego',
    lat: 32.7157,
    lng: -117.1611,
    districtCode: { from: ['Zoning_Base'] },
    // The city-land layer supplies the "(city-owned)" label; the SANDAG parcel
    // layer supplies the assessor-use-code fallback.
    landUse: { from: ['Regulatory/MapServer/3', 'Hosted/Parcels'] },
    // FIXED 2026-08-11. San Diego publishes NO owner name on any reachable
    // layer, so this ONE layer is the entire ownership signal — and it was an
    // `allSettled` read. It remains an INCOMPLETE signal (city land only, never
    // county/state/federal/port/school), which is a different thing from a
    // signal that did not run: the curated civic list in src/lib/siteFlags.ts is
    // what covers the rest, and that has not changed.
    ownerPublic: { from: ['Regulatory/MapServer/3'] },
    ownerField: null,
    publicOnlyLayers: ['Regulatory/MapServer/3'],
  },
  {
    city: 'sanjose',
    lat: 37.3382,
    lng: -121.8863,
    districtCode: { from: ['MapServer/128'] },
    landUse: { from: [], absent: 'San Jose sets `existing: undefined` — no use or owner data is read.' },
    ownerPublic: { from: [], absent: 'Same.' },
    ownerField: null,
  },
  {
    city: 'nashville',
    lat: 36.1627,
    lng: -86.7816,
    // THE ONE ADVISORY READ IN THE PORTFOLIO, and it is earned rather than
    // assumed: the parcel layer carries a denormalised `Zoning` copy that agreed
    // with the authoritative layer at every verified test point, so a zoning
    // outage has a SECOND SOURCE for the same fact. That is what makes a
    // block input advisory — not that refusing would be inconvenient. The
    // conditional refusal (both sources empty) lives in upstreamSplit.test.ts.
    districtCode: {
      from: ['Zoning/MapServer/14'],
      advisory: 'the parcel layer carries a denormalised Zoning copy that covers a zoning outage',
    },
    landUse: { from: ['Cadastral/Parcels'] },
    ownerPublic: { from: ['Cadastral/Parcels'] },
    ownerField: { layer: 'Cadastral/Parcels', field: 'Owner' },
  },
  {
    city: 'raleigh',
    lat: 35.7813,
    lng: -78.6423,
    districtCode: { from: ['Planning/Zoning/MapServer/0'] },
    landUse: { from: ['Property/Property/MapServer/0'] },
    ownerPublic: { from: ['Property/Property/MapServer/0'] },
    ownerField: { layer: 'Property/Property/MapServer/0', field: 'OWNER' },
  },
  {
    city: 'milwaukee',
    lat: 43.0396,
    lng: -87.9204,
    districtCode: { from: ['planning/zoning/MapServer/12'] },
    landUse: { from: [], absent: 'Milwaukee sets landUse null — the parcel layer carries no use label.' },
    ownerPublic: { from: ['parcels_mprop'] },
    ownerField: { layer: 'parcels_mprop', field: 'OWNER_NAME_1' },
  },
  {
    city: 'columbus',
    lat: 39.9644,
    lng: -83.0014,
    districtCode: { from: ['MapServer/20'] },
    landUse: { from: ['MapServer/5'] },
    ownerPublic: { from: ['MapServer/5'] },
    ownerField: { layer: 'MapServer/5', field: 'OWNERNME1' },
  },
  {
    city: 'charlotte',
    lat: 35.2246,
    lng: -80.8443,
    districtCode: { from: ['PLN/Zoning/MapServer/0'] },
    landUse: { from: ['Accela/Accela/MapServer/16'] },
    ownerPublic: { from: ['Accela/Accela/MapServer/16'] },
    ownerField: { layer: 'Accela/Accela/MapServer/16', field: 'ownerlastname' },
  },
  {
    city: 'atlanta',
    lat: 33.7583,
    lng: -84.3898,
    districtCode: { from: ['LandUsePlanning/MapServer/0'] },
    landUse: { from: ['TaxParcel/MapServer/0'] },
    ownerPublic: { from: ['TaxParcel/MapServer/0'] },
    ownerField: { layer: 'TaxParcel/MapServer/0', field: 'OWNERNME1' },
  },
  {
    city: 'dallas',
    lat: 32.779,
    lng: -96.8017,
    districtCode: { from: ['sdc_public/Zoning/MapServer/15'] },
    landUse: { from: ['DallasTaxParcels'] },
    ownerPublic: { from: ['DallasTaxParcels'] },
    ownerField: { layer: 'DallasTaxParcels', field: 'TAXPANAME1' },
  },
  {
    city: 'lasvegas',
    lat: 36.1729,
    lng: -115.1541,
    districtCode: { from: ['DevelopmentServices/Zoning/MapServer/0'] },
    landUse: { from: [], absent: 'Las Vegas publishes no landUse — LUCODE feeds unit logic only.' },
    ownerPublic: { from: ['Parcel_Info/MapServer/0'] },
    ownerField: { layer: 'Parcel_Info/MapServer/0', field: 'OWNER' },
  },
  {
    city: 'phoenix',
    lat: 33.4934,
    lng: -112.0844,
    districtCode: { from: ['Zoning/MapServer/0'] },
    landUse: { from: ['COUNTY_PARCELS/MapServer/3'] },
    ownerPublic: { from: ['COUNTY_PARCELS/MapServer/3'] },
    ownerField: { layer: 'COUNTY_PARCELS/MapServer/3', field: 'OWNER' },
  },
]

/** The exceptions, pinned by MEMBERSHIP so that adding one is deliberate. */
const EXPECTED_ADVISORY = ['nashville.districtCode'] as const

const GOV_OWNER_PROBE = 'CITY OF PROBE'

/** A government owner name in the exact field this provider reads. */
const ownerInjection = (c: Case): readonly Injection[] =>
  c.ownerField ? [{ substr: c.ownerField.layer, attrs: { [c.ownerField.field]: GOV_OWNER_PROBE } }] : []

/** What an ORDINARY PRIVATE parcel looks like upstream: every layer answers,
 *  and the public-only layers answer with nothing. */
const asPrivateParcel = (c: Case) => ({ empty: c.publicOnlyLayers ?? [] })

const run = (c: { city: string; lat: number; lng: number }, opts: Parameters<typeof probe>[2] = {}) =>
  probe(getParcelInfo, c, opts)

describe('hard-block inputs come from reads that can refuse', () => {
  afterEach(() => vi.restoreAllMocks())

  // ── Guarantee 1: the inventory is complete ────────────────────────────────
  it('covers exactly the cities the dispatcher serves', () => {
    expect(CASES.map((c) => c.city).sort()).toEqual([...LIVE_CITIES].sort())
    expect(CASES.length).toBeGreaterThan(0)
  })

  it('names every hard-block input, and only those', () => {
    // The compile-time check above is the real guard; this pins the membership
    // at runtime too, so a reader sees the inventory being asserted.
    expect([...HARD_BLOCK_INPUTS].sort()).toEqual(['districtCode', 'landUse', 'ownerPublic'])
    expect(Object.keys(TRIPS).sort()).toEqual([...HARD_BLOCK_INPUTS].sort())
  })

  // ── Guarantee 2: each named input IS still a hard block ───────────────────
  // Without this the file could go green over three inputs that no longer block
  // anything — an empty set of real blocks, vacuously all sourced correctly.
  it.each(HARD_BLOCK_INPUTS)('%s still hard-blocks', (input) => {
    const r = assessDevelopability(TRIPS[input])
    expect(r.developable).toBe(false)
    expect(r.reason).toBeTruthy()
  })

  it('pins which reads are legitimately advisory', () => {
    const advisory = CASES.flatMap((c) =>
      HARD_BLOCK_INPUTS.filter((k) => c[k].advisory).map((k) => `${c.city}.${k}`),
    )
    expect(advisory).toEqual([...EXPECTED_ADVISORY])
  })

  // ── Controls: the blocks are reachable end-to-end ─────────────────────────
  it.each(CASES)('$city: a healthy run publishes a real district', async (c) => {
    const r = await run(c, asPrivateParcel(c))
    expect(r.ok).toBe(true)
    // Not 'Unknown' — otherwise the perturbations below would compare one gap
    // against another and could not tell them apart.
    expect(r.district).toBe('X1')
  })

  // Guarantee 4, and the assertion that pins each city's owner FIELD NAME: a
  // government name goes into exactly that field and `ownerPublic` must come
  // back true. Rename the field upstream and the block silently stops firing in
  // production; here it goes red.
  it.each(CASES.filter((c) => c.ownerPublic.from.length > 0))(
    '$city: a government owner reaches the block, and the block stops',
    async (c) => {
      const r = await run(c, { ...asPrivateParcel(c), inject: ownerInjection(c) })
      expect(r.ok).toBe(true)
      // San Diego has no owner NAME anywhere; its signal is the presence of a
      // city-owned polygon, so it is the one city whose public case is made by
      // letting that layer answer rather than by injecting a name.
      if (!c.ownerField) {
        const pub = await run(c, {})
        expect(pub.ownerPublic).toBe(true)
        expect(assessDevelopability({ districtCode: pub.district, ownerPublic: pub.ownerPublic }).developable).toBe(
          false,
        )
        return
      }
      expect(r.ownerPublic).toBe(true)
      // …and the gate really stops on it, at the same function analyze.ts calls.
      expect(assessDevelopability({ districtCode: r.district, ownerPublic: r.ownerPublic }).developable).toBe(false)
    },
  )

  // A layer that only answers for PUBLIC parcels must, when it answers, actually
  // stop the analysis. Sourcing it from a required read is not enough on its own:
  // Minneapolis's park layer was required-able and still useless, because the
  // label it produced ("<name> (park)") matched nothing in PUBLIC_LANDUSE. The
  // read semantics and the gate have to be checked separately — reintroducing the
  // old label passes every other assertion in this file and fails only this one.
  it.each(CASES.filter((c) => (c.publicOnlyLayers?.length ?? 0) > 0))(
    '$city: when a public-only layer answers, the gate really stops',
    async (c) => {
      const r = await run(c, {})
      expect(r.ok).toBe(true)
      const dev = assessDevelopability({
        districtCode: r.district,
        landUse: r.landUse,
        ownerPublic: r.ownerPublic,
      })
      expect(dev.developable).toBe(false)
      expect(dev.kind).toBe('public')
    },
  )

  // The other direction: a city declaring it carries NO ownership signal must
  // not produce one even with a government name pushed at every layer.
  // `from: []` is checked, not trusted.
  it.each(CASES.filter((c) => c.ownerPublic.from.length === 0))(
    '$city: declares no ownership signal, and produces none',
    async (c) => {
      const r = await run(c, {
        ...asPrivateParcel(c),
        inject: [
          { substr: 'http', attrs: { OWNER: GOV_OWNER_PROBE, OWNERNAME: GOV_OWNER_PROBE, OwnerName: GOV_OWNER_PROBE } },
        ],
      })
      expect(r.ok).toBe(true)
      expect(r.ownerPublic).toBeUndefined()
      expect(c.ownerPublic.absent).toBeTruthy()
    },
  )

  it.each(CASES.filter((c) => c.landUse.from.length === 0))(
    '$city: declares no land-use signal, and produces none',
    async (c) => {
      const r = await run(c, asPrivateParcel(c))
      expect(r.ok).toBe(true)
      expect(r.landUse).toBeNull()
      expect(c.landUse.absent).toBeTruthy()
    },
  )

  // ── THE INVARIANT ─────────────────────────────────────────────────────────
  // Every declared source, faulted alone, at the real entry point.
  const SOURCES = CASES.flatMap((c) =>
    HARD_BLOCK_INPUTS.flatMap((input) =>
      c[input].from.map((substr) => ({ city: c.city, lat: c.lat, lng: c.lng, input, substr, src: c[input] })),
    ),
  )

  it('has sources to check — the perturbation set is not empty', () => {
    // Rule 20 one level in: if `SOURCES` ever came out empty — a refactor of the
    // table shape, a filter that stopped matching — the `it.each` below would
    // register zero tests and this file would pass having checked nothing.
    // Every city declares at least a districtCode source, so the floor is exact.
    expect(SOURCES.length).toBeGreaterThanOrEqual(CASES.length)
  })

  it.each(SOURCES)('$city: a failed $input read ($substr) refuses rather than unblocking', async (s) => {
    const r = await run(s, { fail: s.substr })
    // The substring really routed; a stale URL fails loudly rather than testing
    // nothing.
    expect(r.hits).toBeGreaterThan(0)
    if (s.src.advisory) {
      // A second source covers the same fact, so the analysis proceeds.
      expect(r.ok).toBe(true)
      return
    }
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
    // The refusal must attribute the failure to the SERVICE, and must not
    // restate the claim it replaces (CLAUDE.md rule 21).
    expect(r.message).not.toMatch(/coverage|neighbou?ring city|unincorporated|undevelopable|government-owned/i)
  })

  // ── The half that must NOT change ────────────────────────────────────────
  // A parcel that is genuinely not government-owned still gets a full report.
  // This is the common path, and over-correcting into a refusal here would be a
  // worse failure than the one being fixed.
  it.each(CASES)('$city: an ordinary private parcel is unchanged', async (c) => {
    const r = await run(c, asPrivateParcel(c))
    expect(r.ok).toBe(true)
    expect(r.ownerPublic).toBeUndefined()
    expect(assessDevelopability({ districtCode: r.district, landUse: r.landUse, ownerPublic: false }).developable).toBe(
      true,
    )
  })

  // An EMPTY (but successful) answer from an ownership read is an ANSWER: this
  // parcel is not government-owned, and the report must proceed. Only a FAILED
  // fetch refuses. That is the state split, one field over from zoning's.
  it.each(CASES.filter((c) => c.ownerPublic.from.length > 0))(
    '$city: an EMPTY ownership answer still yields a report',
    async (c) => {
      const r = await run(c, { empty: [...c.ownerPublic.from, ...(c.publicOnlyLayers ?? [])] })
      expect(r.hits).toBeGreaterThan(0)
      // Most providers read ownership off the parcel layer itself, where an
      // empty answer is legitimately NO_PARCEL rather than "not public".
      if (!r.ok) {
        expect(r.code).toBe('NO_PARCEL')
        return
      }
      expect(r.ownerPublic).toBeUndefined()
    },
  )
})
