// Does the parcel we are about to report on belong to the address that was
// searched? — the within-city half of the front-door defect.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE DEFECT
//
// A user types an address, Mapbox returns a coordinate, and the parcel at that
// coordinate is not the one the address belongs to. Re-measured 2026-08-12 at
// the real entry point over 230 sampled parcels (170 servable after the
// jurisdiction gate): 21 landed on a DIFFERENT parcel, every one returning
// ok: true with a real lot area, a real assessed value and a runnable report.
// Nothing downstream can tell.
//
// The jurisdiction gate does not touch this class — the point is inside the
// city. And it is not one mechanism but two, which matters because they need
// different words:
//
//   · the geocoder lands near the lot line and on the wrong side of it. 31 of
//     200 points in the first round fell within 5 m of a lot line, which is the
//     band where a metre of error changes which parcel is reported.
//   · the PARCEL LAYER'S OWN ADDRESS is attached to the wrong geometry. A US
//     Census cross-check (an outside instrument — rule 9) put the two geocoders
//     within 50 m of each other in 17 of 27 checkable cases, i.e. they agree and
//     the parcel record is what is wrong. DC returns TWO parcels 2 km apart for
//     '5739 BLAINE ST NE'; Denver two 4 km apart for '1001 S RACE ST'.
//
// ⚠️ ONE FINDING FROM THE FIRST ROUND IS RETRACTED HERE. It reported that Las
// Vegas failed every one of its round trips and diagnosed lots too small for the
// geocoder's error. That was the INSTRUMENT: the harness fed Mapbox the layer's
// stored string, and Las Vegas stores a zero-padded house number ("002750 FAISS
// DR") that no user ever types. Asking the same 25 parcels the way a person
// would — the only change — moved Las Vegas from 0 of 13 to 12 of 13 landing
// back on the lot, and 13 of 13 agreeing on the address. Confirmed at the real
// UI: typing "2750 Faiss Dr" returns the parcel recorded as 2750 FAISS DR.
// Las Vegas was the only city storing a padded number, so nothing else moved.
// CLAUDE.md rule 11 — the measurement described the probe.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARN, DO NOT REFUSE — AND WHY THAT IS NOT TIMIDITY
//
// A mismatch is not proof of error. Assessors and geocoders disagree about
// abbreviation, unit suffixes, directionals and embedded city names constantly,
// and a parcel legitimately carries a different address from the one searched
// whenever the search names one of several addresses on a lot, a corner lot's
// other frontage, or a condo unit in a building.
//
// So the two errors are not symmetric. Refusing on a false mismatch denies a
// correct answer to someone who typed a correct address — worse than the defect
// for the common case, and the failure would be invisible to us because the user
// simply leaves. A warning that NAMES BOTH STRINGS hands the judgement to the
// only party who knows which address they meant. It also degrades honestly when
// the comparison is wrong: a false warning costs a glance, a false refusal costs
// the answer.
//
// The refusal already exists for the class where the tool genuinely cannot
// answer — outside the city (netlify/functions/lib/jurisdiction.ts). This is the
// class where it can answer and might be answering about the wrong lot.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE THIRD STATE, AND WHAT IT RESTS ON
//
// A parcel with NO address is not a match and not a mismatch. It is where the
// panel prints "Selected location", and silence there reads as agreement with
// whatever the user typed. So it gets its own arm and its own copy (CLAUDE.md
// rule 5: an absence and an answer must not render the same).
//
// ⚠️ WHAT THIS ARM IS AND IS NOT SUPPORTED BY, stated because the support it
// originally had was withdrawn above. The corrected round trip contains ZERO
// instances of it — no search in the corpus landed on an address-less parcel —
// so no rate is claimed. What IS established is that the state exists and is
// reachable: a map click in Las Vegas returns a 26,081 sq ft R-PD4 parcel whose
// record carries no address (verified live at the panel, 2026-08-12), and
// Charlotte's own city-centre point returns a record reading "S COLLEGE ST",
// a street with no house number, which cannot identify a lot either. Rendering
// those as agreement is the failure the arm prevents; how often a SEARCH reaches
// one is not measured, and the sample cannot answer it — the sampler selected
// only parcels that had a usable address, so counting them in it would measure
// the sampler (rule 11).
//
// Same for a city whose parcel records carry no address at all. Austin's SITUS
// held a bare number on 149/149 sampled parcels and San Jose's layer has no
// address field; both providers reverse-geocode the point instead, so the
// address on screen came from Mapbox and comparing it to a Mapbox forward
// geocode of the user's text compares the instrument with itself (rule 11).
// `ParcelInfo.addressBasis` is what makes that visible here, and
// `NO_RECORD_ADDRESS` is what lets the copy say WHY rather than shrug.

import type { ParcelInfo } from '../types/parcel'

// ─────────────────────────────────────────────────────────────────────────────
// THE NORMALISATION RULES.
//
// ⚠️ THESE WERE WRITTEN AND TESTED BEFORE THE MEASUREMENT, AND MUST NOT BE
// TUNED UNTIL A SAMPLE PASSES. Tuning a comparison against the 200-parcel round
// trip would fit the instrument to the sample and report the fit as validation.
// Every rule below is a statement about how US street addresses are written by
// geocoders and by assessors; `addressMatch.test.ts` has a case per rule, drawn
// from the rule and not from the sample. The measurement then reports what the
// stated rules cost — see the false-warning rate, which is the number that
// decides whether warning was the right call.
//
// N1. LOCALITY TAIL. A geocoder returns "<street>, <city>, <state> <zip>".
//     Everything from the first comma is dropped. Some records append locality
//     with no comma at all (Phoenix "… LAVEEN 85339", Boston "… AV 02115"), so
//     trailing ZIP / ZIP+4 tokens are dropped too, and N8 covers the rest.
// N2. CASE AND PUNCTUATION. Uppercase; drop '.' and ','; collapse whitespace.
// N3. SECONDARY UNITS. From the first #/APT/UNIT/STE/SUITE/FL/RM/LOT/BLDG/SPC/
//     TRLR token to the end is dropped. A unit is not part of the parcel's
//     identity — a condo tower is one lot — and the two sides disagree about it
//     constantly ("8300 SAWYER BROWN RD A-301" vs "8300 Sawyer Brown Road").
// N4. HOUSE NUMBER. The leading token, with leading zeros stripped: Las Vegas
//     stores "002750 FAISS DR", and a fixed-width zero pad is a storage
//     artifact, not part of the number. Compared EXACTLY thereafter — "10515 S
//     44TH LN" vs "10507 S 44TH LN" is precisely the neighbouring-lot error
//     this exists to catch, so nothing about it may be approximate.
//     A hyphenated number ("41-15" in Queens, "100-104" as a range) is compared
//     literally on both sides; ranges are not expanded, and the known cost is a
//     warning on a range record whose typed number sits inside it.
// N5. DIRECTIONALS to a single token (NORTH→N, SOUTHWEST→SW). They are
//     load-bearing — 100 W Main and 100 E Main are different streets — so they
//     are canonicalised, never dropped.
// N6. STREET TYPES to one USPS-style abbreviation (STREET/STR→ST, AVENUE/AV→
//     AVE, …). This is the single most common cosmetic difference between an
//     assessor's string and a geocoder's. SAINT→ST as well, so "100 SAINT MARKS
//     PL" and "100 ST MARKS PLACE" agree.
// N7. ORDINALS. The ordinal suffix is stripped from a numeric ordinal (5TH→5,
//     23RD→23) because a numbered street is written both ways ("5 AVENUE" in
//     MapPLUTO, "5th Avenue" from Mapbox), and FIRST…TENTH map to 1…10. The
//     spelled list stops at TENTH deliberately: beyond it the forms are rare
//     and each one added is a chance to collide with a real street name.
// N8. THE RECORD MAY CARRY MORE; THE SEARCH MAY NOT. After N1–N7 the two token
//     lists match if they are equal OR if the searched list is a PREFIX of the
//     record's. Records append city names, jurisdictions and unit remnants that
//     a geocoder's street line never carries, and the asymmetry is what lets
//     "10515 S 44TH LN LAVEEN" match "10515 S 44th Lane" without a per-city
//     list of city names. It is deliberately one-directional: a searched string
//     with a token the record lacks ("100 MAIN ST N" vs "100 MAIN ST") is a
//     MISMATCH, because dropping the tail on that side would let a genuinely
//     different street pass.
//
// What these rules do NOT do, stated so nobody reads more into a match than is
// there: they do not verify the parcel, only that the address on it is written
// the same way. Where a layer attaches the right address to the wrong geometry
// — the DC and Denver duplicates above — the comparison MATCHES and the report
// is still about the wrong lot. 13 of the 34 measured wrong-parcel cases are of
// that kind. This check catches the other class; nothing here catches that one.

const DIRECTIONALS: Record<string, string> = {
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
  NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW', N: 'N', S: 'S', E: 'E', W: 'W',
}

/** Synonym → canonical. USPS Publication 28's common suffixes, plus the
 *  assessor spellings seen in the layers these providers read (AV, STR, PKY). */
const STREET_TYPES: Record<string, string> = {
  STREET: 'ST', STR: 'ST', ST: 'ST', SAINT: 'ST',
  AVENUE: 'AVE', AVEN: 'AVE', AV: 'AVE', AVE: 'AVE',
  BOULEVARD: 'BLVD', BOUL: 'BLVD', BLVD: 'BLVD',
  ROAD: 'RD', RD: 'RD',
  DRIVE: 'DR', DRV: 'DR', DR: 'DR',
  LANE: 'LN', LN: 'LN',
  COURT: 'CT', CRT: 'CT', CT: 'CT',
  PLACE: 'PL', PL: 'PL',
  TERRACE: 'TER', TERR: 'TER', TER: 'TER',
  PARKWAY: 'PKWY', PKY: 'PKWY', PARKWY: 'PKWY', PKWY: 'PKWY',
  CIRCLE: 'CIR', CIRC: 'CIR', CIR: 'CIR',
  HIGHWAY: 'HWY', HIWAY: 'HWY', HWY: 'HWY',
  SQUARE: 'SQ', SQR: 'SQ', SQ: 'SQ',
  TRAIL: 'TRL', TRL: 'TRL',
  WAY: 'WAY', WY: 'WAY',
  EXPRESSWAY: 'EXPY', EXPY: 'EXPY',
  FREEWAY: 'FWY', FWY: 'FWY',
  ALLEY: 'ALY', ALY: 'ALY',
  PLAZA: 'PLZ', PLZ: 'PLZ',
  LOOP: 'LOOP',
  CROSSING: 'XING', XING: 'XING',
  EXTENSION: 'EXT', EXT: 'EXT',
  TURNPIKE: 'TPKE', TPKE: 'TPKE',
  BEND: 'BND', BND: 'BND',
  COVE: 'CV', CV: 'CV',
  PASS: 'PASS',
  RUN: 'RUN',
  ROW: 'ROW',
  WALK: 'WALK',
}

const SPELLED_ORDINALS: Record<string, string> = {
  FIRST: '1', SECOND: '2', THIRD: '3', FOURTH: '4', FIFTH: '5',
  SIXTH: '6', SEVENTH: '7', EIGHTH: '8', NINTH: '9', TENTH: '10',
}

/** N3: from any of these to the end of the string is a secondary unit. */
const UNIT_TOKENS = new Set([
  'APT', 'UNIT', 'STE', 'SUITE', 'FL', 'FLOOR', 'RM', 'ROOM',
  'LOT', 'BLDG', 'BUILDING', 'SPC', 'SPACE', 'TRLR', 'DEPT', 'PH',
])

const ZIP = /^\d{5}(-\d{4})?$/

export interface CanonicalAddress {
  /** N4. Leading zeros stripped. */
  houseNumber: string
  /** N5–N7, in order. */
  street: readonly string[]
}

/**
 * Reduce an address string to (house number, street tokens) per N1–N7.
 * Returns null when the string is not an address that can identify a parcel:
 * no house number, a zero house number (assessor placeholder for unaddressed
 * land), or no street token at all (Austin's bare-number SITUS).
 */
export function canonicalAddress(raw: string | null | undefined): CanonicalAddress | null {
  if (!raw) return null
  const head = String(raw).split(',')[0] // N1
  let tokens = head
    .toUpperCase()
    .replace(/[.,]/g, '') // N2
    .split(/\s+/)
    .filter(Boolean)
  // N3 — a '#' may be its own token or glued to the number ('#4B').
  const unitAt = tokens.findIndex((t) => t.startsWith('#') || UNIT_TOKENS.has(t))
  if (unitAt > 0) tokens = tokens.slice(0, unitAt)
  // N1 — trailing ZIP / ZIP+4, however many.
  while (tokens.length && ZIP.test(tokens[tokens.length - 1])) tokens.pop()
  if (tokens.length < 2) return null
  const [first, ...rest] = tokens
  // N4 — the house number must LEAD, and must be a number (possibly hyphenated
  // or with a trailing letter: '12A', '41-15').
  if (!/^\d/.test(first)) return null
  const houseNumber = first.replace(/^0+(?=\d)/, '')
  if (/^0+$/.test(houseNumber)) return null
  const street = rest.map((t) => {
    if (DIRECTIONALS[t]) return DIRECTIONALS[t] // N5
    if (STREET_TYPES[t]) return STREET_TYPES[t] // N6
    if (SPELLED_ORDINALS[t]) return SPELLED_ORDINALS[t] // N7
    const ord = t.match(/^(\d+)(ST|ND|RD|TH)$/) // N7
    return ord ? ord[1] : t
  })
  return street.length ? { houseNumber, street } : null
}

/**
 * N8. `searched` is the geocoder's street line; `record` is the parcel's own.
 * The asymmetry is deliberate and stated in N8 — do not make this symmetric to
 * quiet a warning.
 */
export function addressesAgree(searched: string, record: string): boolean {
  const a = canonicalAddress(searched)
  const b = canonicalAddress(record)
  if (!a || !b) return false
  if (a.houseNumber !== b.houseNumber) return false
  if (a.street.length > b.street.length) return false
  return a.street.every((t, i) => t === b.street[i])
}

// ─────────────────────────────────────────────────────────────────────────────
// CITIES WHOSE PARCEL RECORDS CANNOT ANSWER THIS QUESTION AT ALL.
//
// Not "we didn't get one this time" — the layer has no usable address field, so
// no parcel in the city is checkable and the provider reverse-geocodes instead.
// Stated per city rather than inferred, and pinned by
// `providers/addressBasis.test.ts`, which drives every live city through the
// real entry point and asserts that exactly these three publish a geocoded
// address (rule 20: the inventory is pinned, so a provider that quietly starts
// or stops reverse-geocoding fails rather than passing silently).
export const NO_RECORD_ADDRESS: Record<string, string> = {
  austin:
    "Austin's parcel records (TCAD) carry a house number with no street — a bare number on all 149 parcels sampled 2026-08-12",
  chicago:
    "the Cook County parcel layer this build reads carries no address field",
  sanjose:
    "San Jose's parcel layer has six fields and none is an address",
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DECISION.

export type AddressCheck =
  /** No address was searched — a map click, or a link into the wizard. There is
   *  nothing to compare against, which is not the same as agreement. */
  | { kind: 'not-searched' }
  | { kind: 'match' }
  | { kind: 'mismatch'; searched: string; record: string }
  /** The comparison could not be made. `why` decides the copy; every arm of it
   *  is a real state some city is in on some parcel. */
  | { kind: 'unverifiable'; why: UnverifiableReason; searched: string; city: string }

export type UnverifiableReason =
  /** `addressBasis: 'none'` — the record carried no address (Las Vegas's
   *  blank-address common-area parcels; any city's unaddressed land). */
  | 'no-record-address'
  /** `addressBasis: 'geocode'` — the address shown is a reverse geocode, so
   *  comparing it would compare Mapbox with Mapbox. */
  | 'geocoded'
  /** The record has an address but it cannot identify a parcel — no house
   *  number, a zero house number, or a number with no street. */
  | 'record-not-an-address'
  /** The searched string did not reduce to a house number and a street. */
  | 'search-not-an-address'

/**
 * Compare the address the user searched with the address the parcel carries.
 *
 * `searched` is the string the geocoder RETURNED for the user's query (the
 * retrieved feature's address), not the raw keystrokes — the raw text is
 * whatever someone half-typed before picking a suggestion, and comparing it
 * would report the user's typing rather than the pipeline.
 */
export function checkAddress(
  searched: string | null | undefined,
  info: Pick<ParcelInfo, 'address' | 'addressBasis'>,
  city: string,
): AddressCheck {
  if (!searched?.trim()) return { kind: 'not-searched' }
  const s = searched.trim()
  if (info.addressBasis !== 'record') {
    return {
      kind: 'unverifiable',
      why: info.addressBasis === 'geocode' ? 'geocoded' : 'no-record-address',
      searched: s,
      city,
    }
  }
  if (!canonicalAddress(s)) return { kind: 'unverifiable', why: 'search-not-an-address', searched: s, city }
  if (!canonicalAddress(info.address))
    return { kind: 'unverifiable', why: 'record-not-an-address', searched: s, city }
  return addressesAgree(s, info.address)
    ? { kind: 'match' }
    : { kind: 'mismatch', searched: s, record: info.address }
}

/**
 * The line the panel shows, or null when there is nothing to say.
 *
 * ⚠️ BOTH STRINGS ARE NAMED IN THE MISMATCH COPY, and that is the point of
 * warning rather than refusing: the user is the only one who knows which
 * address they meant, and they cannot judge a disagreement they cannot see.
 * `addressMatch.test.ts` asserts each arm is distinct and that the mismatch line
 * contains both strings verbatim.
 */
export function addressCheckNote(check: AddressCheck): { tone: 'warn' | 'note'; text: string } | null {
  switch (check.kind) {
    case 'not-searched':
    case 'match':
      return null
    case 'mismatch':
      return {
        tone: 'warn',
        text: `You searched ${check.searched}, but the parcel at that point is recorded as ${check.record}. Address searches can land on a neighbouring lot — check the outline on the map before relying on this report.`,
      }
    case 'unverifiable': {
      const why =
        check.why === 'geocoded'
          ? (NO_RECORD_ADDRESS[check.city] ??
            'this parcel record carried no address, so the one shown came from a geocoder')
          : check.why === 'no-record-address'
            ? 'this parcel record carries no address'
            : check.why === 'record-not-an-address'
              ? "this parcel record's address has no street"
              : 'that search did not resolve to a street address'
      return {
        tone: 'note',
        text: `We can't confirm this is the parcel for ${check.searched} — ${why}. Check the outline on the map.`,
      }
    }
  }
}
