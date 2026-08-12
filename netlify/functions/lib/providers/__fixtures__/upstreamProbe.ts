// The shared perturbation harness for the provider-wide invariant tests.
//
// Two test files drive every live provider through the REAL entry point,
// `getParcelInfo(city, lat, lng)` (CLAUDE.md rule 11), with at most one upstream
// layer perturbed:
//
//   · upstreamSplit.test.ts   — a failed ZONING read must not become a coverage
//                               claim about the parcel.
//   · hardBlockInputs.test.ts — every input to a hard block must come from a
//                               read that can REFUSE.
//
// They share this file rather than each carrying a copy, because the harness is
// itself an instrument and an instrument that exists twice can disagree with
// itself (CLAUDE.md rule 11: the fourth measurement error in this repo was
// committed by the script written to enforce rule 11). One `synth`, one router.
//
// `synth` builds a feature from the query's OWN `outFields`, so it encodes no
// city's schema and cannot drift away from one: whatever a provider asks for, it
// gets back as 'X1'. Only values that must clear a documented guard are named
// individually below. Tests that need a specific value — a government owner
// name, a mapped land-use code — pass it through `inject` rather than teaching
// this function about a city.

/** Attribute overrides for the synthesized feature, keyed by URL substring. */
export interface Injection {
  /** Substring identifying the layer whose features get these attributes. */
  substr: string
  /** Field name → value. The key `*` sets EVERY field the layer asked for.
   *
   *  The wildcard exists for one job: making a control run DISTINGUISHABLE
   *  without teaching this fixture a city's schema. Where a provider composes
   *  one published field out of several layers — Dallas's PD subdistrict,
   *  Columbus's overlay clauses, San Jose's General Plan designation — every
   *  contributor answers the uniform 'X1', so faulting one of them produces a
   *  payload identical to the control and the layer reads as publishing
   *  nothing. It publishes plenty; the probe just could not see it. */
  attrs: Record<string, unknown>
}

export interface ProbeOptions {
  /** Requests matching this substring THROW — a transport failure. */
  fail?: string
  /** Requests matching any of these substrings return a valid, successful, EMPTY
   *  answer. The distinction between this and `fail` is the whole subject of
   *  both files: an empty answer is an ANSWER, a failed one is not. */
  empty?: string | readonly string[]
  inject?: readonly Injection[]
  /** Count `hits` against THIS substring rather than against `fail`/`empty`.
   *
   *  A run that empties four layers at once reports four layers' worth of hits,
   *  so `hits > 0` would no longer prove that the ONE layer under test routed a
   *  request — the guarantee the whole count exists for. Naming the layer makes
   *  the count answer the question actually being asked, including on a CONTROL
   *  run, where nothing is perturbed and there is otherwise nothing to count. */
  pin?: string
}

const matches = (url: string, pat: string | readonly string[] | undefined): boolean =>
  pat == null ? false : typeof pat === 'string' ? url.includes(pat) : pat.some((p) => url.includes(p))

const RINGS = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]

export function synth(url: string, inject: readonly Injection[] = []): unknown {
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
  // Caller-supplied values win over the generic 'X1', and are applied only to
  // fields the layer was actually asked for — so an injection naming a field
  // this provider does not read cannot fake a result. A test that depends on the
  // injection landing must assert the downstream effect, not the injection.
  for (const inj of inject) {
    if (!url.includes(inj.substr)) continue
    for (const [k, v] of Object.entries(inj.attrs)) {
      if (k === '*') for (const f of Object.keys(attrs)) attrs[f] = v
      else if (k in attrs) attrs[k] = v
    }
  }
  const geom = u.searchParams.get('returnGeometry') === 'true'
  return { features: [geom ? { attributes: attrs, geometry: { rings: RINGS } } : { attributes: attrs }] }
}

export interface RunResult {
  /** How many requests the `fail`/`empty` substring actually routed. Asserting
   *  this is > 0 is what stops a renamed upstream URL turning a perturbation
   *  into a no-op that passes by testing nothing (CLAUDE.md rule 20). */
  hits: number
  ok: boolean
  code: string | null
  message: string
  district: string | null
  landUse: string | null
  ownerPublic: boolean | undefined
  /** The overlay reads this provider marked as FAILED (see
   *  `ParcelInfo['overlays'].unresolved`). `[]` where the provider set none —
   *  never `undefined`, so a test asserting "not marked" and a test asserting
   *  "provider absent from the response" cannot be written the same way. */
  unresolved: readonly string[]
  historicDistrict: string | null
  feeArea: string | undefined
}

type Dispatcher = (city: string, lat: number, lng: number) => Promise<
  | {
      ok: true
      info: {
        zoning: { districtCode: string }
        overlays: { historicDistrict: string | null; feeArea?: string; unresolved?: readonly string[] }
        existing?: { landUse?: string | null; ownerPublic?: boolean }
      }
    }
  | { ok: false; code: string; message: string }
>

/**
 * Route every upstream request according to `opts`, and return a reader for the
 * number of requests the pinned substring matched.
 *
 * One router for both entry points. `publishProbe` calls the analyze handler and
 * the dispatcher under a SINGLE installed mock, so the two payloads it compares
 * describe the same upstream world — installing the mock twice would let the two
 * halves of one measurement disagree.
 */
async function install(opts: ProbeOptions): Promise<() => number> {
  let hits = 0
  const counted = opts.pin ?? opts.fail ?? opts.empty
  const { vi } = await import('vitest')
  vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
    const url = String(input)
    if (matches(url, counted)) hits++
    if (matches(url, opts.fail)) throw new Error('probe: transport failure')
    if (matches(url, opts.empty)) return new Response(JSON.stringify({ features: [] }), { status: 200 })
    return new Response(JSON.stringify(synth(url, opts.inject ?? [])), { status: 200 })
  }) as typeof fetch)
  return () => hits
}

/**
 * Run one city through the dispatcher with at most one layer perturbed.
 *
 * `getParcelInfo` is passed in rather than imported so this file stays a
 * fixture: the tests own the entry point they are measuring.
 */
export async function probe(
  getParcelInfo: Dispatcher,
  c: { city: string; lat: number; lng: number },
  opts: ProbeOptions = {},
): Promise<RunResult> {
  const counter = await install(opts)
  const res = await getParcelInfo(c.city, c.lat, c.lng)
  const hits = counter()
  return {
    hits,
    ok: res.ok,
    code: res.ok ? null : res.code,
    message: res.ok ? '' : res.message,
    district: res.ok ? res.info.zoning.districtCode : null,
    landUse: res.ok ? (res.info.existing?.landUse ?? null) : null,
    ownerPublic: res.ok ? res.info.existing?.ownerPublic : undefined,
    unresolved: res.ok ? (res.info.overlays.unresolved ?? []) : [],
    historicDistrict: res.ok ? res.info.overlays.historicDistrict : null,
    feeArea: res.ok ? res.info.overlays.feeArea : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The PUBLISHED surface.
//
// `probe` measures what the provider RETURNS. That is the right instrument for a
// required read, whose failure is meant to become a refusal the dispatcher
// itself emits. It is the wrong one for an optional read, because the question
// there — what does this failure PUBLISH — is answered by the two payloads a
// user can actually receive, and neither is `ParcelInfo` alone:
//
//   · /api/parcel  returns the whole `ParcelInfo`, including the overlay labels
//     (`zoning.subdistrict`, `zoning.article`) that `/api/analyze` never copies.
//   · /api/analyze returns the report — hurdles, months, costs, verdict — and
//     drops most of `ParcelInfo`.
//
// A layer whose failure is invisible in one is routinely visible in the other:
// Dallas's PD-subdistrict label and San Jose's General Plan designation move
// only the parcel payload, while Milwaukee's overlay hurdles move only the
// report. Measuring either alone reports "publishes nothing" for a layer that
// publishes something — rule 11, at the boundary between two endpoints.

/** Both payloads of one request, with the two timestamps removed. */
export interface PublishRun {
  hits: number
  /** `/api/parcel` — the `ParcelInfo`, or `{ error: <code> }` on a refusal. */
  parcel: Record<string, unknown>
  /** `/api/analyze` — the report body, parsed. */
  report: Record<string, unknown>
  /** Both payloads together: the whole published surface, for equality. */
  raw: string
}

/** Drop one key. `generatedAt` and `fetchedAt` are wall-clock stamps, and two
 *  payloads that differ only there are the same payload. */
const strip = (o: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== key))

/**
 * Run one city through BOTH published entry points with at most one layer
 * perturbed. The handler and the dispatcher are passed in for the same reason
 * `probe` takes `getParcelInfo`: the tests own the entry points they measure.
 */
export async function publishProbe(
  deps: {
    getParcelInfo: Dispatcher
    /** Invoke the real analyze handler with this query string. */
    analyze: (qs: Record<string, string>) => Promise<{ body: string }>
  },
  c: { city: string; lat: number; lng: number },
  project: Record<string, string>,
  opts: ProbeOptions = {},
): Promise<PublishRun> {
  const counter = await install(opts)
  const res = await deps.analyze({ city: c.city, lat: String(c.lat), lng: String(c.lng), ...project })
  const info = await deps.getParcelInfo(c.city, c.lat, c.lng)
  const hits = counter()
  const report = strip(JSON.parse(res.body) as Record<string, unknown>, 'generatedAt')
  const parcel = info.ok
    ? strip(JSON.parse(JSON.stringify(info.info)) as Record<string, unknown>, 'fetchedAt')
    : { error: info.code }
  return { hits, parcel, report, raw: JSON.stringify({ parcel, report }) }
}
