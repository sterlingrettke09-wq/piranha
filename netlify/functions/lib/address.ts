// Where a parcel's address came from — emitted as ONE value with the address.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE PROVENANCE IS NOT OPTIONAL
//
// The front-door defect this exists for: a user types an address, the geocoder
// returns a point, and the point lands on a DIFFERENT parcel than the address
// belongs to. 34 of 200 measured round trips did exactly that (frontdoor
// REPORT.md §2), every one returning ok: true. The check is to compare what was
// searched against the address the parcel itself carries.
//
// That comparison is only meaningful against the PARCEL RECORD's address. Four
// providers fall back to `reverseGeocode(lat, lng)` when the record carries none
// (austin, chicago, sanjose always; sf when the record's street is blank), and
// comparing a forward geocode of the user's text with a reverse geocode of the
// resulting point compares Mapbox with Mapbox — an instrument against itself,
// which agrees precisely when it is wrong in a self-consistent way. That is
// CLAUDE.md rule 11: it would measure the probe, not the pipeline.
//
// So `address` alone cannot be compared, and a consumer holding only a string
// has no way to know which kind it has. The two facts travel together.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A HELPER RATHER THAN A FIELD EACH PROVIDER SETS BY HAND
//
// Rule 14: convert a caught error into an impossible state. A hand-written
// `address: buildAddress(parcel) ?? 'Selected location'` can silently carry the
// wrong basis, or (once the field is required) be given whichever literal makes
// tsc quiet. These two functions emit the pair, so the basis cannot disagree
// with where the string came from — the same move as the `storeys(n)` helper.
// `providers/addressBasis.test.ts` drives every live city through the real entry
// point and asserts the pair is consistent.
import type { ParcelInfo } from '../../../src/types/parcel'

/** Shown when neither the parcel record nor a geocode produced an address. */
export const NO_ADDRESS = 'Selected location'

type Addressed = Pick<ParcelInfo, 'address' | 'addressBasis'>

// `unknown` because every call site is a raw ArcGIS attribute. The falsy guard
// reproduces the `attrs.FIELD ? String(attrs.FIELD) : placeholder` each provider
// wrote by hand, so a 0 or an empty string still means "no address" and this
// change moves no city's rendered string.
const clean = (raw: unknown): string => (!raw ? '' : String(raw).replace(/\s+/g, ' ').trim())

/**
 * The address came from the parcel record's OWN field(s). This is the only
 * basis a searched address can be checked against.
 *
 * Note what is NOT decided here: whether the string is usable for identifying a
 * parcel. Records carry bare numbers (Austin's SITUS), lone street names and
 * "0 INGRAM RD", and those still display. Usability is a question for the
 * comparison (`src/lib/addressMatch.ts`), which has to answer it for the
 * searched string too; deciding it here would change what the panel shows.
 */
export function recordAddress(raw: unknown): Addressed {
  const s = clean(raw)
  return s ? { address: s, addressBasis: 'record' } : { address: NO_ADDRESS, addressBasis: 'none' }
}

/**
 * The address came from a reverse geocode of the queried point, because the
 * parcel record carried none. Displayable, and deliberately NOT comparable.
 */
export function geocodedAddress(raw: unknown): Addressed {
  const s = clean(raw)
  return s ? { address: s, addressBasis: 'geocode' } : { address: NO_ADDRESS, addressBasis: 'none' }
}
