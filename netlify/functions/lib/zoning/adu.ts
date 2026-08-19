// ACCESSORY DWELLING UNITS — and the first place this tool reads a source ABOVE
// the city.
//
// ── WHY THAT IS THE WHOLE DESIGN PROBLEM ────────────────────────────────────
//
// Everywhere else in this repo the binding rule is the municipal code. For ADUs
// in several states it is not: the legislature has set floors the city may not
// go below, and the city's own ordinance is void to the extent it conflicts. So
// the first question for each city is not "what does the code say" but "WHICH
// code governs" — and answering that wrongly produces a confident number from
// the wrong instrument.
//
// ⚠️ AND A STATE FLOOR IS A FLOOR, NOT AN ENVELOPE. This is the distinction the
// feature most easily gets wrong, because the numbers look like limits and are
// not. California forbids a city from capping an ADU below 850 sq ft; it does not
// stop the city allowing 1,200. Reporting "850 sq ft" as the answer would
// UNDERSTATE what is buildable, and understating reads as authoritative in
// exactly the way rule 18 warns about — a plausible number in the right units.
//
// So the state cases carry `kind: 'state-floor'` and every figure on them is
// named as a minimum the city cannot reduce. What the city actually allows on
// top of that is a separate reading, per city, and is NOT claimed here.
//
// ── WHAT WAS READ, AND WHEN ─────────────────────────────────────────────────
//
// California and Washington were read from the statute text on 2026-08-19. The
// other eighteen cities are `not-established`: nobody has read them, which is
// distinct from a city having no ADU rules, and neither is claimed.
//
// ⚠️ The California chapter was RECODIFIED. ADU law moved out of Gov. Code
// § 65852.2 into Chapter 13 (§ 66310–66342), "added by Stats. 2024, Ch. 7,
// Sec. 20", and § 66321 was further amended by Stats. 2025, Ch. 520 (SB 543),
// effective 2026-01-01. Citing the old section would have looked right and
// pointed at a repealed provision — the citation was read off the live page
// rather than recalled.

/** Which body of law binds ADUs on this parcel. */
export type AduAuthority =
  /** A state statute sets minimums the city may not go below. The figures are
   *  FLOORS: the city may permit more, and frequently does. */
  | {
      kind: 'state-floor'
      state: string
      citation: string
      /** The date the statute text was read, not the date it was enacted. */
      readOn: string
      floors: AduFloors
      /** Conditions the state imposes on the city, which are not size limits but
       *  change what the applicant faces. */
      protections: string[]
    }
  /** The municipal code is the binding instrument and has been read. */
  | { kind: 'local'; citation: string; readOn: string; floors: AduFloors; protections: string[] }
  /** ⚠️ NOBODY HAS READ THIS CITY. Not "this city has no ADU rules" — that would
   *  be a finding, and no one has looked. */
  | { kind: 'not-established'; detail: string }

/** ⚠️ `baseline` MARKS THE FLOOR THAT APPLIES WITHOUT FURTHER QUALIFICATION, and
 *  it exists because summarising by the LARGEST figure was wrong.
 *
 *  California's biggest size floor is 1,000 sq ft — but only for an ADU with more
 *  than one bedroom. Its tallest height floor is 25 ft — but only for an ATTACHED
 *  ADU, and only "or the primary dwelling's own limit, whichever is LOWER". Both
 *  are the most heavily conditioned entries in their lists, and leading with them
 *  reads as "here is what you are entitled to" when neither is unconditional.
 *
 *  That is CLAUDE.md rule 6 in mirror image: reporting a maximum across
 *  alternatives as though it were the figure, when the user has not chosen the
 *  programme it depends on. The baseline entry is what the city cannot refuse
 *  outright; the rest are named alongside it with their conditions intact. */
export interface AduFloor {
  value: number
  condition: string
  cite: string
  /** True on the one entry that applies with no further qualification. */
  baseline?: boolean
}

export interface AduFloors {
  /** Minimum maximum-size the city must allow, in sq ft of interior livable
   *  space. Several states state more than one; each is kept with its own
   *  condition rather than collapsed to the largest. */
  sizeSqFt: AduFloor[]
  /** Minimum height the city must allow, in feet, by configuration. */
  heightFt: AduFloor[]
  /** How many units the city must allow, and on what. */
  count: Array<{ value: number | string; condition: string; cite: string }>
  /** Maximum setback the city may require, in feet. Null where the statute sets
   *  none — an answer, distinct from not having read it. */
  maxSetbackFt: { value: number; cite: string } | null
}

// ── CALIFORNIA ──────────────────────────────────────────────────────────────
// Gov. Code ch. 13 (§ 66310–66342). Read 2026-08-19 from leginfo.legislature.ca.gov.
const CA: AduAuthority = {
  kind: 'state-floor',
  state: 'California',
  citation: 'Cal. Gov. Code §§ 66321, 66323 (Chapter 13, added by Stats. 2024, Ch. 7, Sec. 20; § 66321 amended by Stats. 2025, Ch. 520 (SB 543), effective 2026-01-01)',
  readOn: '2026-08-19',
  floors: {
    // ⚠️ 850 AND 800 ARE DIFFERENT PROVISIONS DOING DIFFERENT WORK, and
    // collapsing them to one number would lose the more useful half. § 66321(b)(2)
    // caps how low a city's MAX-SIZE ordinance may go. § 66321(b)(3) is stronger
    // and narrower: an 800 sq ft ADU with four-foot setbacks must be buildable
    // NOTWITHSTANDING lot coverage, FAR, open space, front setbacks and minimum
    // lot size. One constrains a number; the other overrides a whole family of
    // standards.
    sizeSqFt: [
      { value: 850, condition: 'a city may not cap an ADU below this', cite: '§ 66321(b)(2)(A)', baseline: true },
      { value: 1000, condition: 'for an ADU with more than one bedroom', cite: '§ 66321(b)(2)(B)' },
      {
        value: 800,
        condition:
          'must be buildable with four-foot side and rear setbacks regardless of lot coverage, FAR, open space, front setbacks or minimum lot size',
        cite: '§ 66321(b)(3)',
      },
    ],
    heightFt: [
      { value: 16, condition: 'detached, on a single-family or multifamily lot', cite: '§ 66321(b)(4)(A)', baseline: true },
      {
        value: 18,
        condition:
          'detached, within half a mile walking distance of a major transit stop or high-quality transit corridor; plus two more feet to match the primary dwelling’s roof pitch',
        cite: '§ 66321(b)(4)(B)',
      },
      { value: 18, condition: 'detached, on a lot with a multifamily multistory dwelling', cite: '§ 66321(b)(4)(C)' },
      {
        value: 25,
        condition:
          'attached to the primary dwelling — or the primary dwelling’s own limit, whichever is LOWER, and never more than two storeys',
        cite: '§ 66321(b)(4)(D)',
      },
    ],
    count: [
      { value: '1 ADU + 1 JADU', condition: 'within the existing or proposed space of a single-family dwelling or accessory structure (up to 150 sq ft of expansion, for ingress and egress only)', cite: '§ 66323(a)(1)' },
      { value: 1, condition: 'detached new construction, on a single-family lot', cite: '§ 66323(a)(2)' },
      { value: '25% of existing units, at least 1', condition: 'converted from non-livable space inside an existing multifamily building', cite: '§ 66323(a)(3)' },
      { value: 8, condition: 'detached, on a lot with an existing multifamily dwelling — never more than the number of existing units', cite: '§ 66323(a)(4)(A)(ii)' },
      { value: 2, condition: 'detached, on a lot with a proposed multifamily dwelling', cite: '§ 66323(a)(4)(A)(iii)' },
    ],
    maxSetbackFt: { value: 4, cite: '§ 66323(a)(2), § 66321(b)(3)' },
  },
  protections: [
    'The city must approve a qualifying application MINISTERIALLY — no hearing, no discretionary review (§ 66323(a)).',
    'An ADU may be rented separately from the primary residence, but not sold or conveyed separately except under Article 4 (§ 66314(d)(1)).',
    'A city may not impose a minimum lot size for an ADU (§ 66314(b)(1)).',
  ],
}

// ── WASHINGTON ──────────────────────────────────────────────────────────────
// RCW 36.70A.681. Read 2026-08-19 from app.leg.wa.gov.
const WA: AduAuthority = {
  kind: 'state-floor',
  state: 'Washington',
  citation: 'RCW 36.70A.681 — Accessory dwelling units, limitations on local regulation',
  readOn: '2026-08-19',
  floors: {
    sizeSqFt: [
      { value: 1000, condition: 'a city may not cap gross floor area below this', cite: 'RCW 36.70A.681(1)(f)', baseline: true },
    ],
    heightFt: [
      {
        value: 24,
        condition:
          'roof height — unless the principal unit’s own limit is lower, in which case the ADU may not be held below THAT',
        cite: 'RCW 36.70A.681(1)(g)',
        baseline: true,
      },
    ],
    count: [
      {
        value: 2,
        // ⚠️ The scope clause is kept. The statute binds lots "within an urban
        // growth area" in districts allowing single-family homes — dropping that
        // would state the rule more broadly than the legislature wrote it.
        condition:
          'on any lot inside an urban growth area in a district that allows single-family homes; as one attached + one detached, two attached, or two detached',
        cite: 'RCW 36.70A.681(1)(c)',
      },
    ],
    // The statute sets no maximum setback figure; it forbids setbacks MORE
    // restrictive than the principal unit's. That is a different instrument, so
    // it is a protection rather than a number, and this stays null.
    maxSetbackFt: null,
  },
  protections: [
    'No owner-occupancy requirement — the city may not require the owner to live on the lot (RCW 36.70A.681(1)(b)).',
    'Setbacks, yard coverage, tree retention, entry-door placement, aesthetic requirements and design review may not be MORE restrictive than for the principal unit (RCW 36.70A.681(1)(h)).',
    'Impact fees on an ADU may not exceed 50% of those on the principal unit (RCW 36.70A.681(1)(a)).',
    'An existing structure — including a detached garage — may be converted even if it violates current setback or lot-coverage rules (RCW 36.70A.681(1)(j)).',
    'A detached ADU may sit on a lot line abutting a public alley, unless the city routinely plows snow there (RCW 36.70A.681(1)(i)).',
    'No public street improvements may be required as a condition of permitting (RCW 36.70A.681(1)(l)).',
  ],
}

const NOT_READ = (city: string): AduAuthority => ({
  kind: 'not-established',
  detail: `This city's accessory dwelling unit rules have not been read into this tool. That is a gap in our coverage, not a finding that ${city} has no ADU rules — nobody has looked.`,
})

/** ⚠️ EVERY LIVE CITY IS LISTED. A city missing from this map would fall through
 *  to a default, and a default here is the thing that must not exist: silence
 *  would render as "no state law applies", which is a claim. */
const BY_CITY: Readonly<Record<string, AduAuthority>> = Object.freeze({
  // California — state floors read from the statute.
  la: CA, sf: CA, sanjose: CA, sandiego: CA,
  // Washington.
  seattle: WA,
  // Not read. Each is its own entry rather than a fallback, so adding a city
  // without deciding this is a compile-time omission rather than a silent pass.
  atlanta: NOT_READ('Atlanta'), austin: NOT_READ('Austin'), boston: NOT_READ('Boston'),
  charlotte: NOT_READ('Charlotte'), chicago: NOT_READ('Chicago'), columbus: NOT_READ('Columbus'),
  dallas: NOT_READ('Dallas'), dc: NOT_READ('Washington, DC'), denver: NOT_READ('Denver'),
  lasvegas: NOT_READ('Las Vegas'), miami: NOT_READ('Miami'), milwaukee: NOT_READ('Milwaukee'),
  minneapolis: NOT_READ('Minneapolis'), nashville: NOT_READ('Nashville'), nyc: NOT_READ('New York City'),
  philadelphia: NOT_READ('Philadelphia'), phoenix: NOT_READ('Phoenix'), raleigh: NOT_READ('Raleigh'),
})

export function aduAuthorityFor(city: string): AduAuthority {
  return BY_CITY[city] ?? NOT_READ(city)
}

/** Cities whose ADU rules have actually been read. Exported so a coverage claim
 *  is a measurement rather than a sentence someone wrote (rule 20). */
export const ADU_CITIES_READ: readonly string[] = Object.freeze(
  Object.entries(BY_CITY)
    .filter(([, a]) => a.kind !== 'not-established')
    .map(([c]) => c)
    .sort(),
)

/** One line for the report. Says which instrument governs, and — where it is a
 *  state floor — that the figures are minimums rather than the envelope. */
/** The unconditional floor for a dimension. Throws rather than falling back to
 *  the largest entry: a list with no baseline is a data error, and silently
 *  picking the biggest is the exact mistake this replaced. */
function baselineOf(list: AduFloor[], what: string): AduFloor {
  const b = list.find((f) => f.baseline)
  if (!b) throw new Error(`adu: no baseline ${what} floor — every list needs exactly one unconditional entry`)
  return b
}

export function summariseAdu(a: AduAuthority): string {
  if (a.kind === 'not-established') return a.detail
  const size = baselineOf(a.floors.sizeSqFt, 'size')
  const height = baselineOf(a.floors.heightFt, 'height')
  const extras = a.floors.sizeSqFt.length + a.floors.heightFt.length - 2
  const more = extras > 0 ? ` ${extras} further floors apply in specific cases — a larger unit with more than one bedroom, extra height near transit, and different rules for attached units.` : ''
  if (a.kind === 'state-floor') {
    return (
      `${a.state} state law sets what this city must allow, and these are FLOORS rather than limits — ` +
      `the city may permit more and this tool has not read whether it does. Unconditionally: a ` +
      `${size.value.toLocaleString()} sq ft ADU at ${height.value} ft (${height.condition}) cannot be ` +
      `refused on size or height grounds.${more}`
    )
  }
  return `The city's own ordinance governs: ${size.value.toLocaleString()} sq ft at ${height.value} ft (${height.condition}).${more}`
}
