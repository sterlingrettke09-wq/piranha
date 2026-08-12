import { describe, it, expect } from 'vitest'
import {
  canonicalAddress,
  addressesAgree,
  checkAddress,
  addressCheckNote,
  NO_RECORD_ADDRESS,
} from './addressMatch'

// ⚠️ EVERY CASE BELOW IS DERIVED FROM A STATED RULE IN addressMatch.ts, NOT FROM
// THE 200-PARCEL SAMPLE. That ordering is the whole methodological point: a
// comparison tuned until a sample passes has been fitted to the instrument, and
// the sample can then only report the fit. The rules were written first, these
// tests hold them, and the measurement afterwards reports what they cost.
//
// A test here asserting that two strings DISAGREE is an interpretation, and
// CLAUDE.md rule 15 says a well-explained interpretation is the hardest kind to
// overturn — so each such case names the rule it comes from rather than
// asserting a bare expectation.

const rec = (address: string) => ({ address, addressBasis: 'record' as const })

describe('canonicalAddress', () => {
  it('N1 cuts the geocoder locality tail at the first comma', () => {
    expect(canonicalAddress('2750 Faiss Drive, Las Vegas, Nevada 89134')).toEqual({
      houseNumber: '2750',
      street: ['FAISS', 'DR'],
    })
  })

  it('N1 drops a trailing ZIP a record appends without a comma', () => {
    expect(canonicalAddress('264 BROOKLINE AV 02115')?.street).toEqual(['BROOKLINE', 'AVE'])
    expect(canonicalAddress('264 BROOKLINE AV 02115-1234')?.street).toEqual(['BROOKLINE', 'AVE'])
  })

  it('N2 folds case and drops periods', () => {
    expect(canonicalAddress('100 N. Main St.')).toEqual(canonicalAddress('100 n main st'))
  })

  it('N3 drops a secondary unit, however it is written', () => {
    const base = canonicalAddress('8300 Sawyer Brown Road')
    expect(canonicalAddress('8300 Sawyer Brown Road APT 301')).toEqual(base)
    expect(canonicalAddress('8300 Sawyer Brown Road #301')).toEqual(base)
    expect(canonicalAddress('8300 Sawyer Brown Road Ste 301')).toEqual(base)
  })

  it('N4 strips a zero pad but keeps the number exact', () => {
    expect(canonicalAddress('002750 FAISS DR')?.houseNumber).toBe('2750')
    expect(canonicalAddress('10515 S 44TH LN')?.houseNumber).toBe('10515')
  })

  it('N4 keeps a hyphenated house number literal (Queens 41-15, ranges)', () => {
    expect(canonicalAddress('41-15 Main Street')?.houseNumber).toBe('41-15')
    expect(canonicalAddress('100-104 Main Street')?.houseNumber).toBe('100-104')
  })

  it('N5 canonicalises directionals without dropping them', () => {
    expect(canonicalAddress('100 North Main Street')?.street).toEqual(['N', 'MAIN', 'ST'])
    expect(canonicalAddress('100 SW Main St')?.street).toEqual(['SW', 'MAIN', 'ST'])
  })

  it('N6 folds street-type spellings onto one abbreviation', () => {
    for (const [a, b] of [
      ['1 Elm Street', '1 ELM ST'],
      ['1 Elm Avenue', '1 ELM AV'],
      ['1 Elm Boulevard', '1 ELM BLVD'],
      ['1 Elm Parkway', '1 ELM PKY'],
      ['1 Elm Terrace', '1 ELM TERR'],
    ]) {
      expect(canonicalAddress(a)).toEqual(canonicalAddress(b))
    }
  })

  it('N6 maps SAINT onto ST so a saint-name street agrees', () => {
    expect(canonicalAddress('100 Saint Marks Place')).toEqual(canonicalAddress('100 ST MARKS PL'))
  })

  it('N7 strips the ordinal suffix from a numbered street', () => {
    expect(canonicalAddress('651 24th Avenue South')).toEqual(canonicalAddress('651 24 AVE S'))
    expect(canonicalAddress('1 Fifth Avenue')).toEqual(canonicalAddress('1 5TH AVE'))
  })

  it('returns null for strings that cannot identify a parcel', () => {
    // Austin's SITUS: a bare house number with no street.
    expect(canonicalAddress('13424')).toBeNull()
    // An assessor placeholder for unaddressed land.
    expect(canonicalAddress('0 INGRAM RD')).toBeNull()
    // A street with no number identifies a road, not a lot.
    expect(canonicalAddress('SAWYER BROWN RD')).toBeNull()
    expect(canonicalAddress('Selected location')).toBeNull()
    expect(canonicalAddress('')).toBeNull()
    expect(canonicalAddress(null)).toBeNull()
  })
})

describe('addressesAgree', () => {
  it('agrees across the cosmetic differences N5–N7 exist for', () => {
    expect(addressesAgree('2750 Faiss Drive, Las Vegas, Nevada 89134', '002750 FAISS DR')).toBe(true)
    expect(addressesAgree('264 Brookline Avenue, Boston, Massachusetts', '264 BROOKLINE AV 02115')).toBe(true)
    expect(addressesAgree('651 24th Avenue South, Minneapolis, Minnesota', '651 24TH AVE S')).toBe(true)
  })

  it('N8 lets the RECORD carry more — an embedded city, a unit remnant', () => {
    expect(addressesAgree('10515 South 44th Lane', '10515 S 44TH LN LAVEEN 85339')).toBe(true)
    expect(addressesAgree('8300 Sawyer Brown Road', '8300 SAWYER BROWN RD A-301')).toBe(true)
  })

  it('N8 does NOT let the SEARCH carry more — the asymmetry is deliberate', () => {
    // Dropping the tail on this side would let a genuinely different street
    // pass: "100 MAIN ST N" and "100 MAIN ST" can be two streets.
    expect(addressesAgree('100 Main Street North', '100 MAIN ST')).toBe(false)
  })

  it('N4 treats a neighbouring house number as a disagreement', () => {
    // The measured defect: the geocoder landing on the lot next door.
    expect(addressesAgree('10515 South 44th Lane', '10507 S 44TH LN')).toBe(false)
    expect(addressesAgree('264 Brookline Avenue', '259 BROOKLINE AV')).toBe(false)
  })

  it('N5 keeps opposite directionals apart', () => {
    expect(addressesAgree('100 West Main Street', '100 E MAIN ST')).toBe(false)
  })

  it('distinguishes streets that differ only in type', () => {
    expect(addressesAgree('100 Park Avenue', '100 PARK ST')).toBe(false)
  })

  it('never agrees when either side cannot identify a parcel', () => {
    expect(addressesAgree('100 Main Street', 'Selected location')).toBe(false)
    expect(addressesAgree('100 Main Street', '13424')).toBe(false)
  })
})

describe('checkAddress', () => {
  it('a map click is NOT-SEARCHED, which is not agreement', () => {
    expect(checkAddress(null, rec('1 Main St'), 'boston')).toEqual({ kind: 'not-searched' })
    expect(checkAddress('   ', rec('1 Main St'), 'boston')).toEqual({ kind: 'not-searched' })
  })

  it('a record address that matches is silent', () => {
    expect(checkAddress('1 Main Street, Boston, Massachusetts', rec('1 MAIN ST'), 'boston')).toEqual({
      kind: 'match',
    })
  })

  it('a record address that differs is a mismatch carrying both strings', () => {
    const c = checkAddress('264 Brookline Avenue', rec('259 BROOKLINE AV'), 'boston')
    expect(c).toEqual({ kind: 'mismatch', searched: '264 Brookline Avenue', record: '259 BROOKLINE AV' })
  })

  // A real Las Vegas parcel (26,081 sq ft, R-PD4) whose record carries no
  // address: the panel says "Selected location" and nothing on screen
  // contradicts what the user typed. Silence must not read as agreement.
  it('a parcel with NO address is its own state, not a match', () => {
    const c = checkAddress('2750 Faiss Drive', { address: 'Selected location', addressBasis: 'none' }, 'lasvegas')
    expect(c).toEqual({ kind: 'unverifiable', why: 'no-record-address', searched: '2750 Faiss Drive', city: 'lasvegas' })
  })

  // Rule 11: comparing a forward geocode with a reverse geocode of the point it
  // produced measures Mapbox against itself.
  it('a reverse-geocoded address is never compared', () => {
    const c = checkAddress('1 Congress Avenue', { address: '1 Congress Ave', addressBasis: 'geocode' }, 'austin')
    expect(c).toEqual({ kind: 'unverifiable', why: 'geocoded', searched: '1 Congress Avenue', city: 'austin' })
  })

  it('an unusable record address is unverifiable, not a mismatch', () => {
    expect(checkAddress('1 Main Street', rec('13424'), 'austin')).toMatchObject({
      kind: 'unverifiable',
      why: 'record-not-an-address',
    })
  })
})

describe('addressCheckNote', () => {
  const note = (c: Parameters<typeof addressCheckNote>[0]) => addressCheckNote(c)

  it('says nothing when there is nothing to say', () => {
    expect(note({ kind: 'not-searched' })).toBeNull()
    expect(note({ kind: 'match' })).toBeNull()
  })

  it('names BOTH strings in the mismatch warning', () => {
    const n = note({ kind: 'mismatch', searched: '264 Brookline Avenue', record: '259 BROOKLINE AV' })
    expect(n?.tone).toBe('warn')
    expect(n?.text).toContain('264 Brookline Avenue')
    expect(n?.text).toContain('259 BROOKLINE AV')
  })

  it('a city with no address field is told WHY, in its own terms', () => {
    const n = note({ kind: 'unverifiable', why: 'geocoded', searched: '1 Congress Avenue', city: 'austin' })
    expect(n?.text).toContain(NO_RECORD_ADDRESS.austin)
    expect(n?.text).toContain('1 Congress Avenue')
  })

  it('a geocoded address in a city with a record field still says something', () => {
    // sf falls back to a reverse geocode per-parcel; there is no registry entry
    // and the note must not become empty (rule 20 — a check that can pass by
    // finding nothing is not a check).
    const n = note({ kind: 'unverifiable', why: 'geocoded', searched: '1 Market Street', city: 'sf' })
    expect(n?.text).toContain('geocoder')
    expect(n?.text).toContain('1 Market Street')
  })

  it('the four unverifiable reasons do not collapse into one line', () => {
    const texts = (['geocoded', 'no-record-address', 'record-not-an-address', 'search-not-an-address'] as const).map(
      (why) => note({ kind: 'unverifiable', why, searched: '1 Main St', city: 'boston' })!.text,
    )
    expect(new Set(texts).size).toBe(texts.length)
  })
})
