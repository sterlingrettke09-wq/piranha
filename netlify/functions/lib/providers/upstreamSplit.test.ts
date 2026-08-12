// The transport-failure state split, asserted across EVERY live provider at once.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE IS ONE TEST OVER 23 PROVIDERS RATHER THAN 23 TESTS
//
// The defect it guards is not a property of any one city. It is a property of an
// idiom — `zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null` —
// that was copied into 21 of 23 providers, mapping "the service did not answer"
// and "the service answered and nothing is here" onto the same `null`, which
// becomes `districtCode: 'Unknown'`, which `assessDevelopability` renders as
// *no_coverage* ("may sit in a neighboring city…") while analyze.ts zeroes cost,
// timeline and hurdles. A per-city test can be written and then not written for
// the next city; a table that must equal `LIVE_CITIES` cannot.
//
// It also exercises the REAL entry point, `getParcelInfo(city, lat, lng)`
// (CLAUDE.md rule 11). Calling a provider's inner helper would measure the layer
// rather than the pipeline.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
// Three things are pinned, and each closes a way this could go quietly green:
//
//   1. `CASES` must cover exactly `LIVE_CITIES`. Add a city and this file fails
//      until someone states what its zoning failure does.
//   2. Every perturbation asserts `failHits > 0` — the routing substring really
//      matched a request. A renamed upstream URL turns the probe into a no-op,
//      and without this it would pass while testing nothing.
//   3. The CONTROL run must publish a substantive districtCode. If the harness
//      stops producing a valid parcel, the whole file goes red rather than
//      "nothing to report".
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW THE HARNESS ANSWERS
//
// `synth` builds a feature from the query's OWN `outFields`, so it does not
// encode any city's schema and cannot drift away from one. Anything a provider
// asks for, it gets. A handful of fields need a specific value to get past a
// documented guard (Philadelphia's `status`, Las Vegas's jurisdiction NAME) and
// those are named individually below.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'

/** What a failed ZONING fetch must do, per city. */
type Outcome =
  | 'refuse' // the ported state split: UPSTREAM_ERROR
  | 'fallback' // Nashville only — a second source covers it; see the case note

interface Case {
  city: string
  lat: number
  lng: number
  /** URL substring identifying the zoning read. Pinned; see guarantee 2 above. */
  zoning: string
  onZoningFail: Outcome
  /** What an EMPTY (but successful) zoning answer must still produce. */
  onZoningEmpty: 'unknown' | 'fallback' | 'no-parcel'
  /** Extra REQUIRED reads this provider has beyond parcel+zoning, if any. */
  alsoRequired?: Array<{ label: string; substr: string }>
  note?: string
}

const CASES: Case[] = [
  // Boston and NYC never had the defect: Boston already refused on a rejected
  // zoning fetch, and NYC reads its district off the same PLUTO fetch that is
  // already required (so an empty PLUTO answer is NO_PARCEL, not a zoning gap).
  { city: 'boston', lat: 42.3601, lng: -71.0589, zoning: 'Zoning_Subdistricts_Urban_20240719', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'nyc', lat: 40.7549, lng: -73.9857, zoning: 'MAPPLUTO', onZoningFail: 'refuse', onZoningEmpty: 'no-parcel' },

  { city: 'chicago', lat: 41.8855, lng: -87.6248, zoning: 'Zoning_update/MapServer/15', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  {
    city: 'sf',
    lat: 37.7749,
    lng: -122.4194,
    zoning: 'PlanningData/MapServer/3',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'height districts', substr: 'PlanningData/MapServer/5' }],
  },
  { city: 'seattle', lat: 47.608, lng: -122.3331, zoning: 'Current_Land_Use_Zoning_Detail_2', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'dc', lat: 38.8951, lng: -77.0364, zoning: 'Zone_Mapservice/MapServer/24', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'austin', lat: 30.2672, lng: -97.7431, zoning: 'Current_Zoning_gdb', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'la', lat: 34.0522, lng: -118.2437, zoning: 'NavigateLA/MapServer/71', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'denver', lat: 39.7392, lng: -104.9903, zoning: 'Zoning/MapServer/1', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  {
    city: 'minneapolis',
    lat: 44.9778,
    lng: -93.265,
    zoning: 'Planning_Primary_Zoning',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    // Rule 13: height AND FAR need the built-form row together with the primary
    // zoning column, so neither layer alone answers.
    alsoRequired: [{ label: 'built form', substr: 'Planning_Zoning_Built_Form' }],
  },
  {
    city: 'philadelphia',
    lat: 39.9526,
    lng: -75.1635,
    zoning: 'Zoning_BaseDistricts',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    // The only source of Philadelphia's max height and max FAR.
    alsoRequired: [{ label: 'zoning-code characteristics', substr: 'ZoningCodeCharacteristics' }],
  },
  {
    city: 'miami',
    lat: 25.7743,
    lng: -80.1918,
    zoning: 'ZoningMiami21',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    note: 'the zoning layer IS the jurisdiction gate here — county parcels, city zoning',
  },
  { city: 'sandiego', lat: 32.7157, lng: -117.1611, zoning: 'Zoning_Base', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  {
    city: 'sanjose',
    lat: 37.3382,
    lng: -121.8863,
    zoning: 'MapServer/128',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'height district', substr: 'MapServer/84' }],
  },
  {
    city: 'nashville',
    lat: 36.1627,
    lng: -86.7816,
    zoning: 'Zoning/MapServer/14',
    // THE ONE EXCEPTION, and it is earned rather than assumed: the parcel layer
    // carries a denormalised `Zoning` copy that agreed with the authoritative
    // layer at every verified test point. A zoning outage therefore has a second
    // source. The refusal is conditional on that source ALSO being empty, which
    // the dedicated test below covers.
    onZoningFail: 'fallback',
    onZoningEmpty: 'fallback',
  },
  { city: 'raleigh', lat: 35.7813, lng: -78.6423, zoning: 'Planning/Zoning/MapServer/0', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'milwaukee', lat: 43.0396, lng: -87.9204, zoning: 'planning/zoning/MapServer/12', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'columbus', lat: 39.9644, lng: -83.0014, zoning: 'MapServer/20', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'charlotte', lat: 35.2246, lng: -80.8443, zoning: 'PLN/Zoning/MapServer/0', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'atlanta', lat: 33.7583, lng: -84.3898, zoning: 'LandUsePlanning/MapServer/0', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'dallas', lat: 32.779, lng: -96.8017, zoning: 'sdc_public/Zoning/MapServer/15', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'lasvegas', lat: 36.1729, lng: -115.1541, zoning: 'DevelopmentServices/Zoning/MapServer/0', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
  { city: 'phoenix', lat: 33.4934, lng: -112.0844, zoning: 'Zoning/MapServer/0', onZoningFail: 'refuse', onZoningEmpty: 'unknown' },
]

/** The jurisdiction gates, which answer independently of zoning and must keep
 *  producing their own copy — the Dallas / Highland Park path. */
const GATES = [
  { city: 'dallas', substr: 'CityLimits' },
  { city: 'columbus', substr: 'MapServer/21' },
  { city: 'lasvegas', substr: 'Jurisdictions' },
  { city: 'phoenix', substr: 'CityBoundary' },
] as const

const RINGS = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]

function synth(url: string): unknown {
  if (url.includes('api.mapbox.com')) {
    return { type: 'FeatureCollection', features: [{ properties: { name: '1 Probe St' } }] }
  }
  const u = new URL(url)
  const attrs: Record<string, unknown> = {}
  for (const f of (u.searchParams.get('outFields') ?? '').split(',').filter(Boolean)) {
    // Philadelphia refuses a parcel whose `status` is not 1.
    if (f === 'status') attrs[f] = 1
    // Las Vegas's gate compares the jurisdiction NAME against a literal.
    else if (f === 'NAME' && url.includes('Jurisdictions')) attrs[f] = 'City of Las Vegas'
    else attrs[f] = 'X1'
  }
  const geom = u.searchParams.get('returnGeometry') === 'true'
  return { features: [geom ? { attributes: attrs, geometry: { rings: RINGS } } : { attributes: attrs }] }
}

interface RunResult {
  hits: number
  ok: boolean
  code: string | null
  message: string
  district: string | null
}

/**
 * Run one city through the dispatcher with at most one layer perturbed.
 * `fail` makes matching requests throw (a transport failure); `empty` makes them
 * return a valid, successful, feature-less answer. The distinction between those
 * two is the whole subject of this file.
 */
async function run(
  c: Pick<Case, 'city' | 'lat' | 'lng'>,
  opts: { fail?: string; empty?: string } = {},
): Promise<RunResult> {
  let hits = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
    const url = String(input)
    if (opts.fail && url.includes(opts.fail)) {
      hits++
      throw new Error('probe: transport failure')
    }
    if (opts.empty && url.includes(opts.empty)) {
      hits++
      return new Response(JSON.stringify({ features: [] }), { status: 200 })
    }
    return new Response(JSON.stringify(synth(url)), { status: 200 })
  }) as typeof fetch)
  const res = await getParcelInfo(c.city, c.lat, c.lng)
  return {
    hits,
    ok: res.ok,
    code: res.ok ? null : res.code,
    message: res.ok ? '' : res.message,
    district: res.ok ? res.info.zoning.districtCode : null,
  }
}

describe('required-upstream state split, across every live provider', () => {
  afterEach(() => vi.restoreAllMocks())

  it('covers exactly the cities the dispatcher serves', () => {
    expect(CASES.map((c) => c.city).sort()).toEqual([...LIVE_CITIES].sort())
    expect(CASES.length).toBeGreaterThan(0)
  })

  it.each(CASES)('$city: a healthy run publishes a real district', async (c) => {
    const r = await run(c)
    expect(r.ok).toBe(true)
    // Not 'Unknown' — otherwise every perturbation below would be comparing
    // one gap against another and could not tell them apart.
    expect(r.district).toBe('X1')
  })

  it.each(CASES)('$city: a FAILED zoning fetch does not become a coverage claim', async (c) => {
    const r = await run(c, { fail: c.zoning })
    // Guarantee 2: the substring really routed. A stale URL would make this
    // whole assertion vacuous, so it fails loudly instead.
    expect(r.hits).toBeGreaterThan(0)
    if (c.onZoningFail === 'fallback') {
      // Nashville: the parcel layer's copy answers, so this is a real district
      // and not a manufactured 'Unknown'.
      expect(r.ok).toBe(true)
      expect(r.district).toBe('X1')
      return
    }
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
    // The copy must attribute the failure to the SERVICE and must not restate
    // the claim it replaces (CLAUDE.md rule 21).
    expect(r.message).not.toMatch(/coverage|neighbou?ring city|unincorporated|undevelopable/i)
  })

  it.each(CASES)('$city: an EMPTY zoning answer is still an ANSWER', async (c) => {
    // This is the half that must NOT change. A parcel genuinely outside the
    // city's zoning — Huntersville, Henderson, Manhattan Beach, Scottsdale —
    // has to keep getting the no-coverage copy, which is correct and useful.
    const r = await run(c, { empty: c.zoning })
    expect(r.hits).toBeGreaterThan(0)
    if (c.onZoningEmpty === 'no-parcel') {
      expect(r.ok).toBe(false)
      expect(r.code).toBe('NO_PARCEL')
      return
    }
    expect(r.ok).toBe(true)
    expect(r.district).toBe(c.onZoningEmpty === 'fallback' ? 'X1' : 'Unknown')
  })

  const EXTRA = CASES.flatMap((c) => (c.alsoRequired ?? []).map((r) => ({ ...c, layer: r })))
  it.each(EXTRA)('$city: a failed $layer.label read refuses too', async (c) => {
    const r = await run(c, { fail: c.layer.substr })
    expect(r.hits).toBeGreaterThan(0)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
  })

  it.each(GATES)('$city: the jurisdiction gate still answers, zoning up or down', async (g) => {
    const c = CASES.find((x) => x.city === g.city)!
    // Outside the city: the gate layer ANSWERS with zero features.
    const outside = await run(c, { empty: g.substr })
    expect(outside.hits).toBeGreaterThan(0)
    expect(outside.ok).toBe(false)
    expect(outside.code).toBe('OUT_OF_BBOX')

    // Still OUT_OF_BBOX with the zoning layer down as well. The gate is checked
    // FIRST precisely so a complete answer is not traded for "we couldn't reach
    // the service" — this is the Dallas / Highland Park path.
    const both = await run(c, { fail: c.zoning, empty: g.substr })
    expect(both.ok).toBe(false)
    expect(both.code).toBe('OUT_OF_BBOX')
  })

  it.each(GATES)('$city: the jurisdiction gate still fails OPEN when it errors', async (g) => {
    // Deliberate, and unchanged by this work: refusing a real in-city address
    // because a boundary layer timed out is worse than the thing the gate
    // prevents. A failed gate is not a finding about the parcel.
    const c = CASES.find((x) => x.city === g.city)!
    const r = await run(c, { fail: g.substr })
    expect(r.hits).toBeGreaterThan(0)
    expect(r.ok).toBe(true)
  })

  it('nashville refuses when the zoning fetch failed AND the fallback is empty', async () => {
    const c = CASES.find((x) => x.city === 'nashville')!
    let hits = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(c.zoning)) {
        hits++
        throw new Error('probe: transport failure')
      }
      const body = synth(url) as { features: Array<{ attributes: Record<string, unknown> }> }
      // Drop the parcel layer's denormalised copy — the one state the fallback
      // cannot cover, and the only one where 'Unknown' would be manufactured.
      if (url.includes('Cadastral/Parcels')) delete body.features[0].attributes.Zoning
      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch)
    const res = await getParcelInfo('nashville', c.lat, c.lng)
    expect(hits).toBeGreaterThan(0)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })
})
