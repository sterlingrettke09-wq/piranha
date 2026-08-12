// THE INVARIANT: every live city states where its parcel address comes from,
// and the three that cannot supply one are named rather than discovered.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS FOR
//
// The within-city half of the front-door defect: a searched address is compared
// against the address the parcel record carries, and a disagreement warns the
// user (src/lib/addressMatch.ts). That comparison is only valid against a RECORD
// address. Four providers reverse-geocode when the record has none — austin,
// chicago and sanjose always, sf when the record's street is blank — and
// comparing a forward geocode of the user's text with a reverse geocode of the
// point it produced compares Mapbox with Mapbox (CLAUDE.md rule 11).
//
// The two strings are indistinguishable on the panel, so the provenance has to
// travel with the address. `lib/address.ts` emits the pair; this file drives
// every live city through the REAL entry point and pins which one it emits.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
//   1. The expectation table must cover exactly `LIVE_CITIES` — a new city is a
//      failure until someone states which kind of address it publishes.
//   2. The inventory is PINNED, not merely consistent: exactly three cities may
//      publish a geocoded address, and they are named. A provider that quietly
//      starts reverse-geocoding — or stops — goes red rather than silently
//      changing what the panel is allowed to claim.
//   3. `NO_RECORD_ADDRESS` (the copy the user reads, in src/lib) is asserted to
//      be exactly that set. The explanation and the behaviour cannot drift
//      apart, which is the failure mode rule 17 is about.
//   4. A failed geocode must publish 'none', never 'record'. Otherwise the
//      placeholder would present itself as comparable and every search in those
//      cities would silently "agree" with a string nobody read off a parcel.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'
import { getCity } from '../../../../src/config/cities'
import { NO_RECORD_ADDRESS } from '../../../../src/lib/addressMatch'
import { NO_ADDRESS } from '../address'
import { probe, type Injection } from './__fixtures__/upstreamProbe'

/**
 * The cities whose parcel layer carries no usable address, so the provider
 * reverse-geocodes the point instead.
 *
 * Established by reading each provider's own source AND measured against the
 * layers on 2026-08-12: Austin's TCAD `SITUS` held a bare house number on
 * 149/149 parcels sampled, San Jose's parcel layer has six fields and none is an
 * address, and the Cook County layer this build reads carries none.
 *
 * `sf` is deliberately NOT here: it publishes a record address when the record
 * has a street and falls back per-parcel, so its basis is a fact about the
 * PARCEL rather than the city. That is exactly why the basis is per-response and
 * this list is only for the copy.
 */
const GEOCODED_CITIES = ['austin', 'chicago', 'sanjose'] as const

/**
 * Cities whose address is composed from ATOMIC components with a numeric house
 * number, which the harness's uniform 'X1' cannot satisfy.
 *
 * Las Vegas builds its site address from STRNO/STRDIR/STRNAME/STRTYPE and
 * deliberately refuses to emit an address for a row whose STRNO is not a
 * positive integer — that is how it avoids publishing a right-of-way parcel's
 * lone street type as an address. So the fixture has to supply a house number,
 * and this is the fixture's limitation being named rather than the provider's
 * guard being weakened for it.
 */
const HOUSE_NUMBER_INJECTIONS: Record<string, readonly Injection[]> = {
  lasvegas: [{ substr: 'Parcel_Info', attrs: { STRNO: 1234 } }],
}

const pointFor = (city: string) => {
  const [lng, lat] = getCity(city).center
  return { city, lat, lng }
}

afterEach(() => vi.restoreAllMocks())

describe('address provenance', () => {
  it('the copy registry names exactly the cities that reverse-geocode', () => {
    expect(Object.keys(NO_RECORD_ADDRESS).sort()).toEqual([...GEOCODED_CITIES].sort())
    // Rule 20: an empty registry would make every assertion here vacuous, and
    // the note the user reads would quietly become a generic shrug.
    expect(GEOCODED_CITIES.length).toBeGreaterThan(0)
    for (const c of GEOCODED_CITIES) expect(NO_RECORD_ADDRESS[c].length).toBeGreaterThan(20)
  })

  it('every live city is accounted for', () => {
    for (const c of GEOCODED_CITIES) expect(LIVE_CITIES).toContain(c)
    // Nothing to add per city beyond membership — the assertion below runs over
    // LIVE_CITIES itself, so a new city is covered the moment it is dispatched.
    expect(LIVE_CITIES.length).toBe(23)
  })

  for (const city of LIVE_CITIES) {
    const geocoded = (GEOCODED_CITIES as readonly string[]).includes(city)

    it(`${city} publishes a ${geocoded ? 'GEOCODED' : 'RECORD'} address`, async () => {
      const r = await probe(getParcelInfo, pointFor(city), { inject: HOUSE_NUMBER_INJECTIONS[city] })
      expect(r.ok).toBe(true)
      expect(r.addressBasis).toBe(geocoded ? 'geocode' : 'record')
      // A basis is a claim about the string next to it, so the two must agree:
      // anything but 'none' means a real address was published.
      expect(r.address).not.toBe(NO_ADDRESS)
    })
  }

  for (const city of GEOCODED_CITIES) {
    it(`${city} publishes 'none', never 'record', when the geocode fails`, async () => {
      const r = await probe(getParcelInfo, pointFor(city), { fail: 'api.mapbox.com' })
      expect(r.hits).toBeGreaterThan(0)
      expect(r.ok).toBe(true)
      expect(r.address).toBe(NO_ADDRESS)
      // The placeholder must never present itself as comparable — a 'record'
      // here would make every search in this city agree with a string nobody
      // read off a parcel (CLAUDE.md rule 5, inside the address field).
      expect(r.addressBasis).toBe('none')
    })
  }
})
