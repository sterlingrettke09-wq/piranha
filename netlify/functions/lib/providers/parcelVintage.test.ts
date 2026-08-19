import { describe, it, expect, beforeEach } from 'vitest'
import {
  yearFromLayerName, newestParcelLayer, resolveCookParcelLayer, parcelVintageFor,
  resetVintageCache, COOK_PINNED_YEAR, COOK_PARCEL_SERVICE, VINTAGE_CACHE_MS,
  VERSIONED_PARCEL_CITIES, CITIES_WITH_DECLARED_VINTAGE,
} from './parcelVintage'
import { CITIES } from '../../../../src/config/cities'

// The live layer list, transcribed 2026-08-19. Kept verbatim — including the
// `Parcels 2012A` and the id numbering that is NOT the year until 2022 — because
// a tidied fixture would let a resolver that assumes id === year pass.
const LIVE_SHAPE = {
  layers: [
    { id: 0, name: 'Parcels 2000' },
    { id: 12, name: 'Parcels 2012' },
    { id: 13, name: 'Parcels 2012A' },
    { id: 18, name: 'Parcels 2017' },
    { id: 20, name: 'Parcels 2018' },
    { id: 21, name: 'Parcel 2019' },
    { id: 23, name: 'Parcel 2021' },
    { id: 2022, name: 'Parcel 2022' },
    { id: 2025, name: 'Parcel 2025' },
    { id: 19, name: 'Parcel History 2000-2023' },
  ],
}

const okFetch = (body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch

beforeEach(() => resetVintageCache())

describe('reading a year off a layer name', () => {
  it('handles both spellings the service uses', () => {
    expect(yearFromLayerName('Parcels 2000')).toBe(2000)
    expect(yearFromLayerName('Parcel 2025')).toBe(2025)
    expect(yearFromLayerName('Parcels 2012A')).toBe(2012)
  })

  it('refuses anything that is not a year-labelled parcel layer', () => {
    expect(yearFromLayerName('Right Of Way')).toBeNull()
    expect(yearFromLayerName('Tax Map Sheet Index')).toBeNull()
    expect(yearFromLayerName('')).toBeNull()
  })
})

describe('picking the newest layer', () => {
  it('⚠️ picks by NAME, because the id is not the year', () => {
    // Cook County numbers 2000-2021 as ids 0-23 and only then starts using the
    // year as the id. A resolver that took the largest id would pick 2025 today
    // and would pick id 24 — whatever that turns out to be — tomorrow.
    const newest = newestParcelLayer(LIVE_SHAPE)
    expect(newest).toEqual({ id: 2025, year: 2025 })
    const withNext = newestParcelLayer({ layers: [...LIVE_SHAPE.layers, { id: 24, name: 'Parcel 2026' }] })
    expect(withNext).toEqual({ id: 24, year: 2026 })
    expect(withNext!.id).toBeLessThan(2025) // the id really is smaller than the previous year's
  })

  it('excludes the history index, which also starts with "Parcel "', () => {
    // "Parcel History 2000-2023" parses as 2000 under a looser rule. Excluded by
    // name rather than by trusting the max never to select it.
    const only = newestParcelLayer({ layers: [{ id: 19, name: 'Parcel History 2000-2023' }] })
    expect(only).toBeNull()
  })

  it('returns null for a list with no parcel layers — not a guess', () => {
    expect(newestParcelLayer({ layers: [{ id: 1, name: 'Lots' }] })).toBeNull()
    expect(newestParcelLayer({})).toBeNull()
  })
})

describe('resolving against the service', () => {
  it('reports the resolved year and the layer it will query', async () => {
    const v = await resolveCookParcelLayer(0, okFetch({ layers: [{ id: 24, name: 'Parcel 2026' }] }))
    expect(v.basis).toBe('resolved')
    expect(v.year).toBe('2026')
    expect(v.layerUrl).toBe(`${COOK_PARCEL_SERVICE}/24`)
  })

  it('⚠️ marks a fallback AS a fallback, so a frozen year is never mistaken for a current one', async () => {
    // rule 5: a failed fetch must not become a substantive answer. The pinned
    // year is still returned — refusing outright would take Chicago offline for
    // a metadata blip — but it can never read as "2025 is current".
    const boom = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    const v = await resolveCookParcelLayer(0, boom)
    expect(v.basis).toBe('pinned-fallback')
    expect(v.year).toBe(String(COOK_PINNED_YEAR))
    expect(v.why).toMatch(/network down/)
  })

  it('falls back on an HTTP error and on an ArcGIS 200-with-error body', async () => {
    const http500 = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
    expect((await resolveCookParcelLayer(0, http500)).why).toMatch(/HTTP 500/)
    resetVintageCache()
    // ArcGIS answers 200 with an error envelope; treating that as a layer list
    // would produce "no year-labelled layer" and hide the real cause.
    const soft = okFetch({ error: { code: 400, message: 'bad' } })
    const v = await resolveCookParcelLayer(0, soft)
    expect(v.basis).toBe('pinned-fallback')
  })

  it('memoises per instance but not forever', async () => {
    let calls = 0
    const counting = (async () => {
      calls++
      return new Response(JSON.stringify({ layers: [{ id: 7, name: 'Parcel 2030' }] }), { status: 200 })
    }) as unknown as typeof fetch
    await resolveCookParcelLayer(0, counting)
    await resolveCookParcelLayer(1000, counting)
    expect(calls).toBe(1)
    // A long-lived warm instance must eventually notice a new tax year rather
    // than holding its first answer until it is recycled.
    await resolveCookParcelLayer(VINTAGE_CACHE_MS + 1, counting)
    expect(calls).toBe(2)
  })
})

describe('per-city vintage', () => {
  it('answers not-versioned for a city whose fabric carries no year', async () => {
    // An ANSWER, not a gap. `undefined` here would mean "not read".
    const v = await parcelVintageFor('denver')
    expect(v).toEqual({ basis: 'not-versioned', year: null, layerUrl: null })
  })

  it('⚠️ throws on an undeclared city rather than defaulting it', async () => {
    // "Nobody looked at this city" and "this city's fabric carries no year" must
    // not render the same, so there is no default.
    await expect(parcelVintageFor('atlantis')).rejects.toThrow(/not declared/)
  })

  it('resolves for Chicago', async () => {
    const v = await parcelVintageFor('chicago', 0, okFetch(LIVE_SHAPE))
    expect(v.basis).toBe('resolved')
    expect(v.year).toBe('2025')
  })
})

describe('the declared-city registry stays in step with the app', () => {
  it('covers every live city, so none can be silently undeclared', () => {
    // rule 20: pin the inventory. A registry that stopped being updated would
    // otherwise throw at runtime for a newly added city, in production.
    const live = CITIES.filter((c) => c.live).map((c) => c.slug).sort()
    expect(live.length).toBeGreaterThan(20)
    for (const slug of live) {
      expect(CITIES_WITH_DECLARED_VINTAGE.has(slug), `${slug} is not declared in parcelVintage.ts`).toBe(true)
    }
  })

  it('and every versioned city is itself declared', () => {
    for (const slug of VERSIONED_PARCEL_CITIES) {
      expect(CITIES_WITH_DECLARED_VINTAGE.has(slug), slug).toBe(true)
    }
    // Chicago is the only one found so far. If a second city turns out to
    // version its fabric, this goes red and someone states it deliberately.
    expect([...VERSIONED_PARCEL_CITIES]).toEqual(['chicago'])
  })
})
