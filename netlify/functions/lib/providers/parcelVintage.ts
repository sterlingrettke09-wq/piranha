// WHICH VINTAGE OF THE PARCEL FABRIC A CITY IS BEING READ AT.
//
// ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
//
// `providers/chicago.ts` read `parcelHistorical/MapServer/2025` — a hardcoded
// year. Cook County publishes the parcel fabric as ONE LAYER PER TAX YEAR:
// twenty-six of them, 2000 through 2025, plus a "Parcel History 2000-2023"
// layer carrying `LastTaxed`. That is the county stating, in its own data model,
// that the fabric changes between years.
//
// So the pin was not a risk. It was a SCHEDULED BREAK: the day Cook County
// publishes `Parcel 2026`, every Chicago answer silently keeps reading the
// previous year's parcels, and a watchlist checking a frozen year would report
// "no change" forever with nothing on screen saying why. That is worse than no
// watchlist, because it looks like it is working.
//
// ── WHAT IS FIXED, AND WHAT IS DELIBERATELY NOT ─────────────────────────────
//
// Fixed: the year is RESOLVED from the service's own layer list rather than
// typed here, and the resolved year is CARRIED on the answer so it can be stored
// on a watchlist row and compared later.
//
// Not fixed, on purpose: this does not switch Chicago to Cook County's
// `parcel_current_beta` or `CookViewer3Parcels` services, which do exist and are
// not year-versioned. Both key on `PARID` — a FOURTEEN-digit PIN — while this
// layer keys on the ten-digit `PIN10`, and their counts (1,872,370 and 1,865,097)
// against this layer's 1,432,483 are consistent with the extra records being
// individual condominium units rather than land parcels. Moving to them would
// change what a "parcel" IS and what a watchlist row identifies, which is a
// different decision from un-pinning a year, and one of them is named "beta".
//
// ── AND WHY A CITY WITHOUT A VERSIONED FABRIC SAYS SO ───────────────────────
//
// `undefined` would mean "not read" (rule 5). Every covered city is declared
// below, so a city with no versioned parcel layer returns `not-versioned` — an
// answer — and a city missing from the registry is a gap that fails loudly
// rather than reading as "no vintage applies here".

export const COOK_PARCEL_SERVICE =
  'https://gis.cookcountyil.gov/traditional/rest/services/parcelHistorical/MapServer'

/** The year this file was last verified as published, and the floor a
 *  resolution failure falls back to.
 *
 *  ⚠️ A FLOOR, NOT A CHOICE. It is only ever used when the layer list could not
 *  be read, and the result then carries `basis: 'pinned-fallback'` so a frozen
 *  year is never mistaken for a resolved one — a failed fetch must not become a
 *  substantive answer. `scripts/verify-parcel-vintage.ts` fails when the live
 *  service has published a year beyond this, so the floor going stale is visible
 *  rather than silent. */
export const COOK_PINNED_YEAR = 2025
/** The layer id for the pinned year. ⚠️ Cook County's layer ids are NOT the
 *  year: 2000-2021 use ids 0-23 (with a `Parcels 2012A` in the middle) and only
 *  2022-2025 happen to use the year as the id. Nothing may assume id === year. */
export const COOK_PINNED_LAYER_ID = 2025

export type VintageBasis =
  /** Read from the service's own layer list on this request. */
  | 'resolved'
  /** The layer list could not be read; the pinned floor is in use. The answer is
   *  still usable, and it is explicitly NOT a statement that this is current. */
  | 'pinned-fallback'
  /** This city's parcel layer is not versioned by year. An ANSWER, not a gap. */
  | 'not-versioned'

export interface ParcelVintage {
  basis: VintageBasis
  /** The tax year, as the source labels it. Null when `not-versioned`. */
  year: string | null
  /** The layer actually queried, so a stored row records what it was read from. */
  layerUrl: string | null
  /** Present only on `pinned-fallback`: why resolution failed. */
  why?: string
}

/** Cities whose parcel fabric is published per year. Everything else is declared
 *  `not-versioned` by `parcelVintageFor`, and an unknown city throws — silence
 *  must not read as "no vintage applies". */
export const VERSIONED_PARCEL_CITIES = new Set(['chicago'])

/** Every covered city, so `parcelVintageFor` can tell "not versioned" from
 *  "nobody has checked this city". Kept in sync by a test against
 *  `src/config/cities.ts`. */
export const CITIES_WITH_DECLARED_VINTAGE = new Set([
  'atlanta', 'austin', 'boston', 'charlotte', 'chicago', 'columbus', 'dallas', 'dc',
  'denver', 'la', 'lasvegas', 'miami', 'milwaukee', 'minneapolis', 'nashville', 'nyc',
  'philadelphia', 'phoenix', 'raleigh', 'sandiego', 'sanjose', 'seattle', 'sf',
])

/** Parses `Parcel 2025` / `Parcels 2018` / `Parcels 2012A` and returns the year.
 *  Exported because the id-is-not-the-year trap is exactly the kind of thing a
 *  test should hold still. */
export function yearFromLayerName(name: string): number | null {
  const m = /^Parcels?\s+(\d{4})/.exec(name.trim())
  if (!m) return null
  const y = Number(m[1])
  return Number.isFinite(y) ? y : null
}

interface ServiceMeta {
  layers?: Array<{ id: number; name: string }>
}

/** The newest year-labelled parcel layer, by NAME. Returns null when the list
 *  contains none, which is a different thing from the fetch failing. */
export function newestParcelLayer(meta: ServiceMeta): { id: number; year: number } | null {
  let best: { id: number; year: number } | null = null
  for (const l of meta.layers ?? []) {
    const y = yearFromLayerName(String(l.name ?? ''))
    // "Parcel History 2000-2023" starts with "Parcel " and would parse as 2000
    // under a looser rule; it is a history INDEX, not a year's fabric, so it is
    // excluded by name rather than by hoping the max never picks it.
    if (y == null || /history/i.test(String(l.name ?? ''))) continue
    if (best == null || y > best.year) best = { id: Number(l.id), year: y }
  }
  return best
}

// One resolution per warm instance, with a ceiling so a long-lived instance
// eventually notices a new tax year rather than holding the first answer forever.
let cached: { at: number; v: ParcelVintage } | null = null
export const VINTAGE_CACHE_MS = 6 * 60 * 60 * 1000

/** For tests: drop the memoised resolution. */
export function resetVintageCache(): void {
  cached = null
}

export async function resolveCookParcelLayer(
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<ParcelVintage> {
  if (cached && now - cached.at < VINTAGE_CACHE_MS) return cached.v

  const fallback = (why: string): ParcelVintage => ({
    basis: 'pinned-fallback',
    year: String(COOK_PINNED_YEAR),
    layerUrl: `${COOK_PARCEL_SERVICE}/${COOK_PINNED_LAYER_ID}`,
    why,
  })

  let v: ParcelVintage
  try {
    const res = await fetchImpl(`${COOK_PARCEL_SERVICE}?f=json`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) {
      v = fallback(`layer list returned HTTP ${res.status}`)
    } else {
      const meta = (await res.json()) as ServiceMeta & { error?: unknown }
      const newest = meta.error ? null : newestParcelLayer(meta)
      v = newest
        ? { basis: 'resolved', year: String(newest.year), layerUrl: `${COOK_PARCEL_SERVICE}/${newest.id}` }
        : fallback('layer list carried no year-labelled parcel layer')
    }
  } catch (e) {
    v = fallback(e instanceof Error ? e.message : String(e))
  }
  cached = { at: now, v }
  return v
}

/** The vintage for any covered city. Throws on an unknown slug rather than
 *  returning `not-versioned`, because "we never looked at this city" and "this
 *  city's fabric carries no year" must not render the same. */
export async function parcelVintageFor(
  city: string,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<ParcelVintage> {
  if (!CITIES_WITH_DECLARED_VINTAGE.has(city)) {
    throw new Error(`parcelVintageFor: ${city} is not declared — add it rather than defaulting it`)
  }
  if (!VERSIONED_PARCEL_CITIES.has(city)) {
    return { basis: 'not-versioned', year: null, layerUrl: null }
  }
  return resolveCookParcelLayer(now, fetchImpl)
}
