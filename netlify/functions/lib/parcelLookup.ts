// RE-FINDING A WATCHED PARCEL BY ITS ID.
//
// ── WHY THIS IS NOT THE REPORT'S QUERY ──────────────────────────────────────
//
// The report resolves a parcel from a POINT: the user clicks a map, the provider
// runs a point-in-polygon, and everything downstream follows. A watchlist row is
// keyed on `(city, parcelId)` — deliberately, because a point moves relative to
// boundaries and an address re-geocodes — so re-finding it is a different query
// against the same layer: `WHERE <idField> = <id>`.
//
// That difference is the whole reason `not-in-layer` can be a real state. A
// point always lands somewhere; an id either matches a row or it does not, and
// "it does not" is a fact about the parcel rather than about where someone
// clicked.
//
// ── THE LAYER AND FIELD COME FROM THE PROVIDERS ─────────────────────────────
//
// Each provider exports `PARCEL_SOURCE`, so nothing here is transcribed. The
// provider URLs are built from per-file base constants and a second hand-typed
// copy is exactly the mistake this repo has paid for three times. Chicago's is a
// FUNCTION rather than a constant, because Cook County publishes one parcel layer
// per tax year and the layer is resolved per request.
//
// ── AND A CITY WITH NO LOOKUP SAYS SO ───────────────────────────────────────
//
// `no-lookup` is its own state. It is not `unreachable` — nothing failed — and
// it is not `not-in-layer` — nobody looked. Collapsing it into either would put
// a permanent "check failed" on rows that were never checkable, or announce that
// a parcel had vanished from a layer nobody queried.

import type { ParcelVintage } from './providers/parcelVintage'
import { PARCEL_SOURCE as atlanta } from './providers/atlanta'
import { PARCEL_SOURCE as austin } from './providers/austin'
import { PARCEL_SOURCE as charlotte } from './providers/charlotte'
import { PARCEL_SOURCE as chicago } from './providers/chicago'
import { PARCEL_SOURCE as columbus } from './providers/columbus'
import { PARCEL_SOURCE as dallas } from './providers/dallas'
import { PARCEL_SOURCE as dc } from './providers/dc'
import { PARCEL_SOURCE as denver } from './providers/denver'
import { PARCEL_SOURCE as la } from './providers/la'
import { PARCEL_SOURCE as lasvegas } from './providers/lasvegas'
import { PARCEL_SOURCE as miami } from './providers/miami'
import { PARCEL_SOURCE as milwaukee } from './providers/milwaukee'
import { PARCEL_SOURCE as minneapolis } from './providers/minneapolis'
import { PARCEL_SOURCE as nashville } from './providers/nashville'
import { PARCEL_SOURCE as nyc } from './providers/nyc'
import { PARCEL_SOURCE as philadelphia } from './providers/philadelphia'
import { PARCEL_SOURCE as phoenix } from './providers/phoenix'
import { PARCEL_SOURCE as raleigh } from './providers/raleigh'
import { PARCEL_SOURCE as sandiego } from './providers/sandiego'
import { PARCEL_SOURCE as sanjose } from './providers/sanjose'
import { PARCEL_SOURCE as seattle } from './providers/seattle'
import { PARCEL_SOURCE as sf } from './providers/sf'

interface StaticSource { layer: string; idField: string }
interface DynamicSource { idField: string; resolveLayer: () => Promise<ParcelVintage> }
type Source = StaticSource | DynamicSource

/** ⚠️ BOSTON IS ABSENT, DELIBERATELY. Its parcel read goes through
 *  `_endpoints.ts` rather than a provider module, so it exports no
 *  `PARCEL_SOURCE`, and inventing one here would be the transcription this file
 *  exists to avoid. Boston rows report `no-lookup` — an honest state — until the
 *  Boston path exports the same pair the other twenty-two do. */
export const PARCEL_SOURCES: Readonly<Record<string, Source>> = Object.freeze({
  atlanta, austin, charlotte, chicago, columbus, dallas, dc, denver, la, lasvegas,
  miami, milwaukee, minneapolis, nashville, nyc, philadelphia, phoenix, raleigh,
  sandiego, sanjose, seattle, sf,
})

export type LookupResult =
  /** The service answered and exactly one row carries this id. */
  | { kind: 'found'; attributes: Record<string, unknown>; rings: number[][][] | null; vintage: ParcelVintage }
  /** The service ANSWERED and no row carries this id. A fact about the parcel. */
  | { kind: 'absent'; vintage: ParcelVintage }
  /** More than one row carries this id, so "the" parcel is undefined.
   *
   *  ⚠️ MEASURED, and the first measurement was WRONG — see below, because the
   *  correction matters more than the number.
   *
   *  Standing result, sampled across each layer on 2026-08-19: LA's `APN` is
   *  unique on every sample of 2,432,668 rows, Miami's `FOLIO` on every sample of
   *  596,113, and Chicago's `PIN10` on all but one — `1716405037` genuinely
   *  carries two rows, a real ten-digit land id shared by two polygons. Charlotte
   *  and Columbus each showed one duplicate too.
   *
   *  ⚠️ AN EARLIER RUN REPORTED LA AND MIAMI AS HAVING ALMOST NO UNIQUE IDS, and
   *  that was the sampler, not the cities. It drew its ids from the FIRST PAGE of
   *  each layer, which is exactly where degenerate rows collect: LA's first
   *  fourteen carry a placeholder APN. Spread across the layer the picture
   *  reverses completely. Third time in this repo that a result implying a lot of
   *  work has turned out to be the instrument (rule 25).
   *
   *  The state stays regardless, because Chicago's duplicate is real: taking
   *  `features[0]` would watch whichever row the service returned first and
   *  report a change every time that ordering moved. */
  | { kind: 'ambiguous'; matches: number; vintage: ParcelVintage }
  /** The service did not answer. A fact about the network. */
  | { kind: 'unreachable'; detail: string }
  /** No by-id lookup is wired for this city. Nobody looked. */
  | { kind: 'no-lookup'; detail: string }

/** ⚠️ SQL STRING LITERAL, AND THE ONLY ESCAPING THAT MATTERS. Real ids carry
 *  spaces (DC `0295    0805`), letters (Charlotte `12512C97`) and leading zeros,
 *  and at least one city could publish an apostrophe. Doubling is the ANSI
 *  escape; anything cleverer here would be a second parser. */
const sqlQuote = (v: string) => `'${v.replace(/'/g, "''")}'`

async function layerFor(src: Source): Promise<{ url: string; vintage: ParcelVintage } | null> {
  if ('layer' in src) {
    return { url: src.layer, vintage: { basis: 'not-versioned', year: null, layerUrl: src.layer } }
  }
  const v = await src.resolveLayer()
  return v.layerUrl ? { url: v.layerUrl, vintage: v } : null
}

export async function findParcelById(
  city: string,
  parcelId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const src = PARCEL_SOURCES[city]
  if (!src) {
    return { kind: 'no-lookup', detail: `no by-id parcel lookup is wired for ${city}` }
  }
  let resolved: { url: string; vintage: ParcelVintage } | null
  try {
    resolved = await layerFor(src)
  } catch (e) {
    return { kind: 'unreachable', detail: e instanceof Error ? e.message : String(e) }
  }
  if (!resolved) return { kind: 'unreachable', detail: 'the parcel layer could not be resolved' }

  // ⚠️ GEOMETRY, NOT JUST ATTRIBUTES, and the reason is a defect found by running
  // this against live services. The first version read the parcel row's own
  // columns and tried to build a snapshot from them. San Francisco's `blklot`
  // lookup then reported a lot area of 2.7e-7, because `Shape__Area` on that
  // layer is in SQUARE DEGREES — an unlabelled unit that a regex matching
  // "shape area" turns into square feet by assumption. That is rule 12 exactly:
  // converting through a unit the code does not use.
  //
  // There is no fix at the attribute level. A parcel layer does not carry zoning,
  // height, FAR or developability at all, so an attribute read cannot reproduce
  // the snapshot the report stored — and the fields it cannot see would either
  // diff as losses or be silently carried through, making a checker that can
  // never fire. So the id lookup returns GEOMETRY, and the runner takes an
  // interior point and re-runs the real pipeline at it (rule 11).
  const qs = new URLSearchParams({
    where: `${src.idField} = ${sqlQuote(parcelId)}`,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  })
  try {
    const res = await fetchImpl(`${resolved.url}/query?${qs}`, { headers: { accept: 'application/json' } })
    if (!res.ok) return { kind: 'unreachable', detail: `HTTP ${res.status}` }
    const body = (await res.json()) as {
      error?: { code: number; message: string }
      features?: Array<{ attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }>
    }
    // ⚠️ ArcGIS answers 200 WITH an error envelope. Reading that as "no features"
    // would turn every malformed query and every throttle into "this parcel has
    // left the layer" — the single most alarming thing this system can say.
    if (body.error) return { kind: 'unreachable', detail: `service ${body.error.code}: ${body.error.message}` }
    if (!Array.isArray(body.features)) {
      return { kind: 'unreachable', detail: 'the service answered without a feature list' }
    }
    if (body.features.length === 0) return { kind: 'absent', vintage: resolved.vintage }
    if (body.features.length > 1) {
      return { kind: 'ambiguous', matches: body.features.length, vintage: resolved.vintage }
    }
    const f = body.features[0]
    return f?.attributes
      ? { kind: 'found', attributes: f.attributes, rings: f.geometry?.rings ?? null, vintage: resolved.vintage }
      : { kind: 'absent', vintage: resolved.vintage }
  } catch (e) {
    return { kind: 'unreachable', detail: e instanceof Error ? e.message : String(e) }
  }
}

/** Cities this can re-find a parcel in. Exported so a coverage claim is a
 *  measurement of the registry rather than a sentence someone wrote. */
export const CITIES_WITH_ID_LOOKUP = Object.freeze(Object.keys(PARCEL_SOURCES).sort())
