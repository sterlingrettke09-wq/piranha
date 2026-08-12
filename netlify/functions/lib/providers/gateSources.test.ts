// Every jurisdiction gate publishes its own source, and only a gate does.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS GUARDS
//
// A gate that REFUSES a parcel — "that point is in Mecklenburg County but
// outside Charlotte's zoning jurisdiction" — is making a claim about where the
// land is, and it is the most consequential claim in the report: it deletes
// every other one. Every lesser claim carries its source in `sources`, and this
// one did not. Three of the twelve gates published a URL at all, under three
// different keys (`cityLimits`, `cityBoundary`, `jurisdictions`), so a reader
// comparing two reports could not distinguish "this city sources its gate under
// another name" from "this city has no gate" — rule 5 inside the source list.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT RUNS THE REAL ENTRY POINT (rule 11)
//
// The question is what a REPORT publishes, and `sources` is copied into the
// report by analyze.ts, not assembled there. Asserting against a provider's
// internal constant — or against `cityLimitsSource` itself — would measure the
// layer that was just written rather than the pipeline: a provider that never
// spreads the helper in would pass every such test. So each city is driven
// through `getParcelInfo` AND through the analyze handler, and the assertions
// read the two payloads a user can actually receive.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (rule 20)
//
//   1. The observed set is compared with `GATED_CITIES` IN BOTH DIRECTIONS. A
//      13th gated city that forgets to publish goes red; so does a `cityLimits`
//      key pasted into an ungated provider.
//   2. `GATED_CITIES` and `LIVE_CITIES` are both asserted non-empty, and the
//      run set is pinned to `LIVE_CITIES` — so an empty registry, or a probe
//      that stopped producing parcels, fails instead of reporting nothing.
//   3. Every run must have succeeded. A refusal publishes no `sources` at all,
//      and twelve refusals would otherwise satisfy "no ungated city publishes
//      the key" perfectly.
//   4. The published URL is compared with the registry's by string equality,
//      not merely asserted present — the point of deriving it is that the URL
//      published and the URL queried are one value.
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'
import {
  CITY_LIMITS_SOURCE_KEY,
  GATED_CITIES,
  JURISDICTIONS,
  cityLimitsGate,
} from '../jurisdiction'
import { handler as analyzeHandler } from '../../analyze'
import { invokeHandler } from '../testing/invokeHandler'
import { synth } from './__fixtures__/upstreamProbe'
import { CITIES } from '../../../../src/config/cities'

/** Each live city's own dashboard centre — in its bbox by construction, and a
 *  single source of truth this file cannot drift from (src/config/cities.ts). */
const POINTS = new Map(
  CITIES.filter((c) => c.live).map((c) => [c.slug, { lng: c.center[0], lat: c.center[1] }]),
)

const PROJECT = { use: 'residential', gfa: '60000', units: '60', projectType: 'new', funding: 'private' }

interface Run {
  city: string
  /** `sources` as `/api/parcel` publishes it. */
  parcel: Record<string, string>
  /** `sources` as `/api/analyze` publishes it — the report. */
  report: Record<string, string>
}

/** Drive one city through BOTH published entry points under one mock, so the
 *  two payloads describe the same upstream world. */
async function run(city: string, n: number): Promise<Run> {
  const at = POINTS.get(city)
  if (!at) throw new Error(`no centre for ${city}`)
  vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) =>
    new Response(JSON.stringify(synth(String(input))), { status: 200 })) as typeof fetch)
  // A fresh client IP per call: analyze.ts rate-limits 20/min per IP, and a
  // shared IP would turn most of this table into RATE_LIMITED non-answers.
  const res = await invokeHandler(analyzeHandler, {
    queryStringParameters: { city, lat: String(at.lat), lng: String(at.lng), ...PROJECT },
    headers: { 'x-forwarded-for': `10.7.${(n >> 8) & 255}.${n & 255}` },
  })
  const info = await getParcelInfo(city, at.lat, at.lng)
  vi.restoreAllMocks()
  const body = JSON.parse(res.body) as { sources?: Record<string, string> }
  if (!info.ok) throw new Error(`${city}: the probe produced no parcel (${info.code})`)
  if (!body.sources) throw new Error(`${city}: analyze published no sources (${res.statusCode})`)
  return { city, parcel: info.info.sources, report: body.sources }
}

describe('every gated city publishes its jurisdiction gate in `sources`', () => {
  let RUNS: Run[] = []

  beforeAll(async () => {
    // `reverseGeocode` returns before fetching without a token, which would
    // leave the address-deriving providers on a different code path here than
    // in production.
    vi.stubEnv('MAPBOX_TOKEN', 'probe-token')
    RUNS = []
    let n = 0
    for (const city of LIVE_CITIES) RUNS.push(await run(city, n++))
  }, 120_000)
  afterAll(() => vi.unstubAllEnvs())
  afterEach(() => vi.restoreAllMocks())

  // Rule 20. Everything below iterates `RUNS`; an empty or partial `RUNS` would
  // make all of it vacuous, so the set is pinned before anything reads it.
  it('ran every live city, and there are gated and ungated cities to compare', () => {
    expect(RUNS.map((r) => r.city).sort()).toEqual([...LIVE_CITIES].sort())
    expect(LIVE_CITIES.length).toBeGreaterThan(0)
    expect(GATED_CITIES.length).toBeGreaterThan(0)
    expect(Object.keys(JURISDICTIONS).length).toBeGreaterThan(GATED_CITIES.length)
  })

  // The inventory, in BOTH directions and against `GATED_CITIES` itself rather
  // than a list written here. A 13th gate that forgets to publish goes red, and
  // so does the key appearing anywhere it should not.
  it('the set that publishes the key is exactly the set that has a gate', () => {
    const publishes = RUNS.filter((r) => CITY_LIMITS_SOURCE_KEY in r.report).map((r) => r.city).sort()
    expect(publishes).toEqual([...GATED_CITIES].sort())
    // and the parcel payload agrees with the report — analyze copies `sources`,
    // so a divergence here means it stopped doing that.
    const onParcel = RUNS.filter((r) => CITY_LIMITS_SOURCE_KEY in r.parcel).map((r) => r.city).sort()
    expect(onParcel).toEqual([...GATED_CITIES].sort())
  })

  it.each(GATED_CITIES)('%s: publishes the SAME url the gate queries', (city) => {
    const r = RUNS.find((x) => x.city === city)!
    const url = cityLimitsGate(city)!.url
    expect([city, r.report[CITY_LIMITS_SOURCE_KEY]]).toEqual([city, url])
    expect([city, r.parcel[CITY_LIMITS_SOURCE_KEY]]).toEqual([city, url])
    expect([city, /^https:\/\//.test(url)]).toEqual([city, true])
  })

  // The check that would have caught the three spellings. It is not enough that
  // `cityLimits` is present: the gate's URL must not ALSO be published under
  // some other name, because a reader scanning for the gate would find the
  // alias and a scanner keying on the name would not.
  it.each(GATED_CITIES)('%s: the gate url appears under that key and no other', (city) => {
    const r = RUNS.find((x) => x.city === city)!
    const url = cityLimitsGate(city)!.url
    const keys = Object.entries(r.report).filter(([, v]) => v === url).map(([k]) => k).sort()
    // Nashville is the one city where a second key legitimately holds the same
    // URL: its gate is in-band, reading the satellite-city label off Metro's own
    // zoning layer, so `zoning` and `cityLimits` ARE the same service and citing
    // anything else for the gate would cite the wrong layer.
    expect([city, keys]).toEqual([city, city === 'nashville' ? ['cityLimits', 'zoning'] : ['cityLimits']])
  })

  // A city with no gate makes no jurisdiction claim, so it has nothing to
  // source — and must not be handed a key with a bbox-derived or borrowed URL
  // in it. This is the copy-paste direction of the guard.
  it.each(LIVE_CITIES.filter((c) => JURISDICTIONS[c].kind === 'none'))(
    '%s: has no gate, so publishes no gate source',
    (city) => {
      const r = RUNS.find((x) => x.city === city)!
      expect([city, CITY_LIMITS_SOURCE_KEY in r.report]).toEqual([city, false])
      expect([city, CITY_LIMITS_SOURCE_KEY in r.parcel]).toEqual([city, false])
      // Nor under either of the two names that were in use before this key
      // existed — a rename is only done once if the old spellings stay gone.
      expect([city, 'cityBoundary' in r.report, 'jurisdictions' in r.report]).toEqual([city, false, false])
    },
  )

  // The retired spellings, pinned across the whole table rather than only on the
  // two providers that carried them (rule 17: a retraction has to hold
  // everywhere the claim could reappear).
  it('no city publishes the gate under either retired key', () => {
    const strays = RUNS.filter((r) => 'cityBoundary' in r.report || 'jurisdictions' in r.report)
    expect(strays.map((r) => r.city)).toEqual([])
  })
})
