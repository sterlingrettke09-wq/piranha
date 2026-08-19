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

import { cityName } from '../../../../src/config/cities'

// ── ⚠️ TWO LAYERS, BECAUSE BOTH APPLY ──────────────────────────────────────
//
// The first shape here had one authority per city: state OR local OR unread. It
// could not express the case that actually holds for all five preempted cities —
// a state floor AND a local ordinance, together.
//
// They do different jobs. The state floor is what the city may not go BELOW; the
// local ordinance is what the city actually allows, which is usually more. So the
// buildable figure is `max(local, floor)` per dimension, and neither source gives
// it alone. San Diego is the proof: state law forbids a cap under 850 sq ft and
// SDMC § 141.0302(a)(7)(B) allows 1,200 — reporting the floor as the answer
// understates by 41%, in the direction that reads as authoritative (rule 18).
//
// Same shape as the `heightUnconstrained` gap one week earlier: a fact that was
// establishable and had nowhere in the type to live.

/** The state statute that preempts, where one does. */
export interface StateFloorLayer {
  state: string
  citation: string
  /** The date the statute text was read, not the date it was enacted. */
  readOn: string
  floors: AduFloors
  protections: string[]
}

/** ⚠️ `baseline` AGAIN, ONE LAYER DOWN — the same mistake, caught the same way.
 *
 *  The state floors needed it because the largest figure was the most heavily
 *  conditioned. Local caps have the identical shape and it was missed until the
 *  code was run: Seattle's largest is 1,500 sq ft, which requires ALL THREE of an
 *  LR zone, a frequent transit service area, and a lot not purchased for more
 *  than $1,000 in twenty years. Almost no lot qualifies, and "up to 1,500 sq ft"
 *  was the headline.
 *
 *  Twice now, so it is the pattern rather than an incident: in a list of
 *  alternatives the biggest number is usually the one with the most conditions
 *  attached, and picking a maximum to summarise by selects for exactly that.
 *
 * ── AND THE THREE STATES, BECAUSE `null` WAS DOING TWO JOBS ────────────────
 *
 *  The first version used `value: null` to mean "the ordinance states no
 *  maximum" — an answer, and the most permissive rule San Diego has. But it is
 *  indistinguishable from "our reading did not find a maximum for this case",
 *  which is a gap in US. Same distinction as `not-read` one level down: there it
 *  is the whole ordinance, here it is one provision inside a section we did read.
 *
 *  So a union, and the asymmetry is enforced by the shape rather than by care:
 *  `no-maximum` REQUIRES a cite, because you may only claim the code states none
 *  if you read the provision that says so. `not-found` CANNOT carry one — there
 *  is no source for a thing you did not find (rule 14: make the wrong state
 *  uncompilable rather than commenting on it). */
export type LocalCap =
  /** The ordinance states a figure. */
  | { kind: 'capped'; sqFt: number; condition: string; cite: string; baseline?: boolean }
  /** The ordinance affirmatively states NO maximum for this configuration. */
  | { kind: 'no-maximum'; condition: string; cite: string; baseline?: boolean }
  /** We read the section and located no rule covering this configuration. A gap
   *  in the reading, never a permission. */
  | { kind: 'not-found'; condition: string }

/** The city's own ordinance. */
export interface LocalLayer {
  kind: 'read'
  citation: string
  readOn: string
  /** What the city allows, one entry per configuration the ordinance names. */
  maxSizeSqFt: LocalCap[]
  /** Height as the ordinance states it. Storeys and feet are kept apart and
   *  never converted (rule 12).
   *
   *  ⚠️ `maxHeightFt` was ADDED FOR SAN JOSÉ — the third city read and the third
   *  structural surprise. San Diego and Seattle both DEFER height to the base
   *  zone, so two cities in a row needed no figure and the type quietly implied
   *  none exists. San José states four: 18 ft one-storey detached, 25 ft
   *  two-storey detached, no more than two storeys detached, 25 ft attached.
   *  Each new city has exposed a shape its predecessors did not need. */
  maxHeightFt: AduFloor[]
  maxStories: { value: number; condition: string; cite: string } | null
  heightDefersToBaseZone: { cite: string } | null
  notes: string[]
  /** ⚠️ REQUIRED, so a local ordinance cannot be encoded without it. */
  pending: PendingCheck
}

/** ⚠️ THE CODIFIED TEXT IS NOT NECESSARILY CURRENT LAW.
 *
 *  Municode showed Seattle codified through one ordinance while listing
 *  seventeen more as pending, with effective dates running to 2027-01-01. Reading
 *  the codified section and stopping there would publish superseded text that
 *  looks current — the Seattle-2019-archive failure, and it applies to EVERY
 *  Municode city rather than to Seattle specifically.
 *
 *  So the check is a required field rather than a habit. `amendingThisSection`
 *  empty is a RESULT (the pending list was read and touches nothing here), and it
 *  is not the same as `not-checked`, which is an admission. */
export type PendingCheck =
  | {
      kind: 'checked'
      on: string
      /** Where the pending list was read. */
      source: string
      codifiedThrough: string
      /** Pending ordinances that amend THIS section. Empty means the list was
       *  read and none do — a finding, not an absence of effort. */
      amendingThisSection: string[]
      note?: string
    }
  | { kind: 'not-checked'; detail: string }

export type LocalRead = LocalLayer | { kind: 'not-read'; detail: string }

export interface AduRules {
  city: string
  /** Null where no state statute preempts — an answer for most cities, since
   *  most states have none. Distinct from not having looked. */
  stateFloor: StateFloorLayer | null
  local: LocalRead
}

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
const CA: StateFloorLayer = {
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
const WA: StateFloorLayer = {
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

// ── SAN DIEGO — the local ordinance, read 2026-08-19 ────────────────────────
// SDMC ch. 14 art. 1 div. 3, § 141.0302, from the city's own PDF (493,073 bytes,
// footer dated 7-2026). The ordinance is materially MORE permissive than the
// state floor, which is the whole reason this layer exists.
const SANDIEGO_LOCAL: LocalLayer = {
  kind: 'read',
  citation: 'San Diego Municipal Code § 141.0302 (Accessory Dwelling Units and Junior Accessory Dwelling Units)',
  readOn: '2026-08-19',
  maxSizeSqFt: [
    // The general case, and therefore the baseline: a purpose-built ADU. The
    // three `no-maximum` entries below are all CONVERSIONS.
    { kind: 'capped', sqFt: 1200, condition: 'An attached or detached ADU may be up to 1,200 sq ft', cite: '§ 141.0302(a)(7)(B)', baseline: true },
    // ⚠️ `no-maximum` IS AN ANSWER, and it is the most permissive rule in the
    // section: a conversion inside the existing house has none at all. Each of
    // these three carries the provision that SAYS so — that is what separates
    // them from a configuration the reading simply did not cover.
    { kind: 'no-maximum', condition: 'built inside an existing or proposed single dwelling unit structure', cite: '§ 141.0302(a)(7)(C)' },
    { kind: 'no-maximum', condition: 'built inside an existing accessory structure, plus 150 sq ft for ingress and egress only', cite: '§ 141.0302(a)(7)(D)' },
    { kind: 'no-maximum', condition: 'built inside an existing multiple dwelling unit structure', cite: '§ 141.0302(a)(7)(E)' },
  ],
  // San Diego states no height in FEET for ADUs — it defers to the base zone.
  maxHeightFt: [],
  maxStories: { value: 2, condition: 'detached, on a lot permitting single but not multiple dwelling units', cite: '§ 141.0302(a)(8)(A)' },
  // ⚠️ Height in FEET is not stated for ADUs — the section defers to the base
  // zone. So no figure is invented here; the base-zone limit the rest of this
  // engine already resolves is the one that applies, floored by the state.
  heightDefersToBaseZone: { cite: '§ 141.0302(a)(8)(C)' },
  // ⚠️ NOT CHECKED, and said so rather than assumed. San Diego was read from a
  // city-published PDF whose footer is dated 7-2026; that PDF carries no pending
  // list, and no separate amendment docket was consulted. The reading is real and
  // its currency is unverified — two different things.
  pending: {
    kind: 'not-checked',
    detail: 'Read from a city PDF dated 7-2026 that carries no pending-ordinance list. No amendment docket was consulted, so the text is current as published and its currency is unverified.',
  },
  notes: [
    'No minimum lot size is required for an ADU (§ 141.0302(a)(5)).',
    'ADUs are not subject to the base zone density limits (§ 141.0302(a)(6)).',
    'An 800 sq ft ADU is exempt from maximum lot coverage, floor area ratio, front yard setback and minimum open space of the base zone — the city adopting Gov. Code § 66321(b)(3) directly (§ 141.0302(a)(4)).',
    'Street side yard setback is 4 feet or the base zone minimum, whichever is LESS (§ 141.0302(a)(9)(B)).',
    'Minimum ADU size is 150 sq ft (§ 141.0302(a)(7)(A)).',
  ],
}

// ── SEATTLE — the local ordinance, read 2026-08-19 ──────────────────────────
// SMC 23.42.022, via Municode. ⚠️ NOT 23.44.041: Seattle keeps ADUs in Chapter
// 23.42 (General Use Provisions), not in the neighbourhood-residential chapter,
// so two guessed node ids missed the section by CHAPTER and not merely by id.
const SEATTLE_LOCAL: LocalLayer = {
  kind: 'read',
  citation: 'Seattle Municipal Code § 23.42.022 (Accessory dwelling units) — Ord. 127376 § 21, 2025; Ord. 127211 § 5, 2025',
  readOn: '2026-08-19',
  maxSizeSqFt: [
    { kind: 'capped', sqFt: 1000, condition: 'An ADU with up to two bedrooms may be up to 1,000 sq ft', cite: '§ 23.42.022.G.1.a', baseline: true },
    { kind: 'capped', sqFt: 1200, condition: 'three or more bedrooms', cite: '§ 23.42.022.G.1.b' },
    {
      kind: 'capped',
      sqFt: 1500,
      // Kept verbatim because the third limb is unusual enough that a paraphrase
      // would read as an error: the lot must not have been purchased for more
      // than $1,000 in the past twenty years.
      condition:
        'ALL THREE must hold — the lot is in an LR zone, is in a frequent transit service area, and has not been purchased for more than $1,000 in the past 20 years',
      cite: '§ 23.42.022.G.1.c',
    },
  ],
  // Seattle states neither a height in feet nor a storey count for ADUs.
  maxHeightFt: [],
  maxStories: null,
  // ⚠️ § 23.42.022.E: an ADU is "subject to the same standards as principal
  // dwelling units" unless otherwise provided, and the section provides no
  // height. So height defers to the zone — the same shape San Diego has, reached
  // by a different route, and no figure is invented for either.
  heightDefersToBaseZone: { cite: '§ 23.42.022.E' },
  notes: [
    'ADUs are allowed as a housing use in every zone where housing uses are allowed (§ 23.42.022.A).',
    'No lot may have more than two ADUs, and they may be attached, detached or stacked (§ 23.42.022.C, .D).',
    'No off-street motor vehicle parking is required for an ADU (§ 23.42.022.I).',
    'Excluded from the floor-area limit: up to 250 sq ft of an attached garage, all underground storeys, and up to 35 sq ft for long-term bicycle parking (§ 23.42.022.G.2).',
    'An attached ADU may exceed 1,000 sq ft where the portion of the structure it occupies existed as of 2023-07-23 (§ 23.42.022.H.4).',
    'Converting an existing accessory structure is permitted notwithstanding lot coverage, yard and setback provisions (§ 23.42.022.H.3.b).',
    'ADUs count toward density (§ 23.42.022.J), and this section prevails over conflicting Title 23 provisions other than Chapter 23.60A (§ 23.42.022.L).',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-19',
    source: 'Municode "what\'s changed" list for the Seattle Municipal Code',
    codifiedThrough: 'Ordinance No. 127423, passed 2026-04-14 (Supp. 44, Update 1; content updated 2026-07-15)',
    // Read and CLEAN — a result, not an absence of effort. Seventeen ordinances
    // were pending with effective dates to 2027-01-01; the only one touching
    // Chapter 23.42 is Ord. 127436, amending §§ 23.42.054 and 23.42.056
    // (transitional encampments), which does not reach § 23.42.022.
    amendingThisSection: [],
    note: '17 ordinances pending, effective dates to 2027-01-01. The only one touching Chapter 23.42 is Ord. 127436 (§§ 23.42.054, 23.42.056 — transitional encampments), which does not reach § 23.42.022.',
  },
}

// ── SAN JOSÉ — the local ordinance, read 2026-08-19 ─────────────────────────
// SJMC § 20.80.175, Title 20 ch. 20.80 Part 2.75, via Municode. The section
// opens by citing Gov. Code §§ 66314 and 66321 directly — the city adopting the
// recodified chapter by reference, which independently confirms that § 65852.2
// is the wrong citation.
const SANJOSE_LOCAL: LocalLayer = {
  kind: 'read',
  citation: 'San José Municipal Code § 20.80.175 (Accessory Dwelling Units — General), Title 20 ch. 20.80 Part 2.75; Ord. 29447',
  readOn: '2026-08-19',
  maxSizeSqFt: [
    { kind: 'capped', sqFt: 1000, condition: 'An ADU on a lot of up to 9,000 sq ft may be up to 1,000 sq ft', cite: '§ 20.80.175.D.1.b (Table 20-55)', baseline: true },
    { kind: 'capped', sqFt: 1200, condition: 'on a lot greater than 9,000 sq ft', cite: '§ 20.80.175.D.1.c (Table 20-55)' },
    { kind: 'no-maximum', condition: 'conversion of an existing DETACHED accessory structure', cite: '§ 20.80.175.D.1.d' },
  ],
  maxHeightFt: [
    { value: 18, condition: 'detached, one storey', cite: '§ 20.80.175.D.2.a', baseline: true },
    { value: 25, condition: 'detached, two storeys — roof height above grade', cite: '§ 20.80.175.D.2.b' },
    { value: 25, condition: 'attached — roof height above grade, and no more than two storeys', cite: '§ 20.80.175.D.2.d' },
  ],
  maxStories: { value: 2, condition: 'detached', cite: '§ 20.80.175.D.2.c' },
  heightDefersToBaseZone: null,
  notes: [
    'Single-family lot: one attached OR one detached ADU, plus one junior ADU, in any order — two units total. Multifamily lot: one attached or detached ADU per lot (§ 20.80.175.B).',
    'An ADU is not counted in residential density for General Plan conformance (§ 20.80.175.C).',
    'Side and rear setbacks are ZERO; the front setback is the zoning district\'s, unless that would prohibit an 800 sq ft ADU. A second storey needs 4 ft from side and rear lot lines (§ 20.80.175.D.3).',
    'A converted existing structure may keep its existing setbacks (§ 20.80.175.D.3.d).',
    // ⚠️ A RATIO, NOT A FIGURE, and the type cannot hold it — recorded rather
    // than dropped. On a 1,400 sq ft primary this caps an attached ADU at 700 sq
    // ft, which is BELOW California's 850 sq ft floor. Whether § 66321(b)(2)
    // voids it to that extent is a question about the statute's reach that this
    // tool does not adjudicate; it is flagged so a reader can.
    '⚠️ An ATTACHED ADU is separately capped at 50% of the existing primary dwelling (§ 20.80.175.D.1.a). That is a ratio, not a figure, so it is not computed here — and on a small primary it can fall below the 850 sq ft state floor. Whether the floor overrides it is a question for the city.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-19',
    source: 'Municode code home page for the San José Code of Ordinances',
    codifiedThrough: 'Ordinance No. 31330, enacted 2026-06-16 (Supp. No. 5, Update 3; content updated 2026-07-21)',
    amendingThisSection: [],
    // ⚠️ WEAKER EVIDENCE THAN SEATTLE'S, and said so. Seattle displayed a list of
    // seventeen pending ordinances that could be read and found not to touch the
    // section. San José's page displays NO pending list at all, so the absence
    // may mean none are pending or may mean this view does not show them.
    note: 'The page displayed no pending-ordinance list at all. That is weaker than Seattle, where a list of 17 existed and was read — here the absence of a list is not the same as a list containing nothing.',
  },
}

const NOT_READ_LOCAL = (city: string): LocalRead => ({
  kind: 'not-read',
  detail: `${city}'s own ADU ordinance has not been read into this tool.`,
})

/** ⚠️ EVERY LIVE CITY IS LISTED. A city missing from this map would fall through
 *  to a default, and a default here is the thing that must not exist: silence
 *  would render as "no state law applies", which is a claim. */
const BY_CITY: Readonly<Record<string, AduRules>> = Object.freeze({
  la: { city: 'la', stateFloor: CA, local: NOT_READ_LOCAL('Los Angeles') },
  sf: { city: 'sf', stateFloor: CA, local: NOT_READ_LOCAL('San Francisco') },
  sanjose: { city: 'sanjose', stateFloor: CA, local: SANJOSE_LOCAL },
  sandiego: { city: 'sandiego', stateFloor: CA, local: SANDIEGO_LOCAL },
  seattle: { city: 'seattle', stateFloor: WA, local: SEATTLE_LOCAL },
  ...Object.fromEntries(
    ([
      ['atlanta', 'Atlanta'], ['austin', 'Austin'], ['boston', 'Boston'], ['charlotte', 'Charlotte'],
      ['chicago', 'Chicago'], ['columbus', 'Columbus'], ['dallas', 'Dallas'], ['dc', 'Washington, DC'],
      ['denver', 'Denver'], ['lasvegas', 'Las Vegas'], ['miami', 'Miami'], ['milwaukee', 'Milwaukee'],
      ['minneapolis', 'Minneapolis'], ['nashville', 'Nashville'], ['nyc', 'New York City'],
      ['philadelphia', 'Philadelphia'], ['phoenix', 'Phoenix'], ['raleigh', 'Raleigh'],
    ] as const).map(([slug, name]) => [
      slug,
      // ⚠️ `stateFloor: null` here means NO STATE STATUTE WAS FOUND TO PREEMPT,
      // which is a finding about the state. The local ordinance is separately
      // unread. Two different absences, kept apart.
      { city: slug, stateFloor: null, local: NOT_READ_LOCAL(name) } satisfies AduRules,
    ]),
  ),
})

export function aduRulesFor(city: string): AduRules {
  return BY_CITY[city] ?? { city, stateFloor: null, local: NOT_READ_LOCAL(city) }
}

/** Cities whose LOCAL ordinance has been read. Separate from the state list —
 *  conflating them would let one city's reading imply another's (rule 20). */
export const ADU_LOCAL_READ: readonly string[] = Object.freeze(
  Object.entries(BY_CITY).filter(([, r]) => r.local.kind === 'read').map(([c]) => c).sort(),
)
/** Cities with a state statute that preempts. */
export const ADU_STATE_PREEMPTED: readonly string[] = Object.freeze(
  Object.entries(BY_CITY).filter(([, r]) => r.stateFloor != null).map(([c]) => c).sort(),
)

// ── THE EFFECTIVE ANSWER ────────────────────────────────────────────────────

export type EffectiveSource = 'local' | 'state-floor' | 'local-no-maximum' | 'floor-only' | 'unresolved'

export interface EffectiveSize {
  /** Square feet. `null` with source `local-no-maximum` means the ordinance
   *  states none — an answer. `null` with `unresolved` means nobody knows. */
  value: number | null
  source: EffectiveSource
  why: string
}

/** ⚠️ `max(local, floor)`, and the asymmetry is the point.
 *
 *  A state floor is a MINIMUM the city cannot go below, so a local cap beneath it
 *  is void to that extent and the floor governs. A local cap ABOVE it is simply
 *  what the city allows, and the floor does nothing. Taking the floor in both
 *  directions would understate; taking the local figure in both would publish a
 *  cap the state has already struck down.
 *
 *  And a local rule stating NO maximum beats any number — it is not a missing
 *  value, and treating it as one would be the rule 5 collapse. */
export function effectiveMaxSize(r: AduRules): EffectiveSize {
  const floor = r.stateFloor?.floors.sizeSqFt.find((f) => f.baseline) ?? null
  if (r.local.kind !== 'read') {
    return floor == null
      ? { value: null, source: 'unresolved', why: `Neither a state floor nor ${cityName(r.city)}'s own ordinance has been established.` }
      : {
          value: floor.value,
          source: 'floor-only',
          why: `Only the state floor is known (${floor.cite}). This is the MINIMUM the city cannot refuse, not what it allows — the local ordinance has not been read.`,
        }
  }
  // ⚠️ THE BASELINE, NOT THE BIGGEST. A `no-maximum` only leads when it is the
  // general case; San Diego's is a CONVERSION rule, so "the city states no
  // maximum" as a headline would describe a configuration most projects are not.
  const baseline = r.local.maxSizeSqFt.find((m) => m.kind !== 'not-found' && m.baseline === true)
  if (baseline?.kind === 'no-maximum') {
    return {
      value: null,
      source: 'local-no-maximum',
      why: `The city states no maximum (${baseline.cite}: ${baseline.condition}).`,
    }
  }
  if (baseline?.kind === 'capped') {
    const others = r.local.maxSizeSqFt.length - 1
    const more = others > 0 ? ` ${others} other configuration${others === 1 ? '' : 's'} the ordinance names allow more — see the full list.` : ''
    const floorNote =
      floor != null && baseline.sqFt < floor.value
        ? ` But this sits below the state floor of ${floor.value.toLocaleString()} sq ft (${floor.cite}), so it is void to that extent and the floor governs.`
        : ''
    return floor != null && baseline.sqFt < floor.value
      ? { value: floor.value, source: 'state-floor', why: `The city's baseline cap is ${baseline.sqFt.toLocaleString()} sq ft (${baseline.cite}).${floorNote}` }
      : {
          value: baseline.sqFt,
          source: 'local',
          why: `${baseline.condition} (${baseline.cite})${floor != null ? `, at or above the ${floor.value.toLocaleString()} sq ft state floor (${floor.cite})` : ''}.${more}`,
        }
  }
  const stated = r.local.maxSizeSqFt.find((m) => m.kind === 'no-maximum')
  if (stated) {
    return {
      value: null,
      source: 'local-no-maximum',
      why: `The city states no maximum for this case (${stated.cite}: ${stated.condition}). Other configurations have caps — see the full list.`,
    }
  }
  // No baseline declared — fall back to the largest capped figure, which is the
  // behaviour `baseline` exists to correct. Reached only for an entry nobody has
  // marked, and the symmetry test below requires every read city to mark one.
  const caps2 = r.local.maxSizeSqFt.filter((m): m is Extract<LocalCap, { kind: 'capped' }> => m.kind === 'capped')
  // ⚠️ ONLY `capped` ENTRIES COUNT. A `not-found` is a hole in our reading and
  // must never be treated as a permission — with nothing capped, the local layer
  // tells us nothing and the state floor is all we have.
  if (caps2.length === 0) {
    return floor == null
      ? { value: null, source: 'unresolved', why: `${cityName(r.city)}'s ordinance was read but no size rule was located in it.` }
      : {
          value: floor.value,
          source: 'floor-only',
          why: `The ordinance was read but no size rule was located in it, so only the state floor is known (${floor.cite}) — a MINIMUM, not what the city allows.`,
        }
  }
  const biggestLocal = caps2.reduce((m, x) => (x.sqFt > m.sqFt ? x : m))
  if (floor == null) {
    return { value: biggestLocal.sqFt, source: 'local', why: `${r.local.citation}, ${biggestLocal.cite}.` }
  }
  return biggestLocal.sqFt >= floor.value
    ? {
        value: biggestLocal.sqFt,
        source: 'local',
        why: `The city allows more than the state floor requires (${biggestLocal.sqFt.toLocaleString()} sq ft at ${biggestLocal.cite}, against a ${floor.value.toLocaleString()} sq ft floor at ${floor.cite}), so the local figure governs.`,
      }
    : {
        value: floor.value,
        source: 'state-floor',
        why: `The city's cap of ${biggestLocal.sqFt.toLocaleString()} sq ft sits below the state floor of ${floor.value.toLocaleString()} sq ft (${floor.cite}), so it is void to that extent and the floor governs.`,
      }
}

/** One line for the report. Says which instrument governs, and where the answer
 *  rests only on a state floor, that the figure is a minimum rather than a cap. */
export function summariseAdu(r: AduRules): string {
  const size = effectiveMaxSize(r)
  if (size.source === 'unresolved') {
    // The DISPLAY name, not the slug: "not a finding that denver has no ADU
    // rules" reads as a bug in a sentence whose whole job is to be trusted.
    return `Accessory dwelling unit rules for this city have not been read into this tool. That is a gap in our coverage, not a finding that ${cityName(r.city)} has no ADU rules — nobody has looked.`
  }
  if (size.source === 'floor-only') {
    const f = r.stateFloor!
    const h = f.floors.heightFt.find((x) => x.baseline)!
    return (
      `${f.state} state law sets what this city must allow, and these are FLOORS rather than limits — ` +
      `the city may permit more and its own ordinance has not been read. Unconditionally: a ` +
      `${(size.value as number).toLocaleString()} sq ft ADU at ${h.value} ft (${h.condition}) cannot be refused.`
    )
  }
  const head =
    size.source === 'local-no-maximum'
      ? 'The city states no maximum size for an ADU built inside an existing structure.'
      : `Up to ${(size.value as number).toLocaleString()} sq ft.`
  const stories =
    r.local.kind === 'read' && r.local.maxStories
      ? ` Detached ADUs may be ${r.local.maxStories.value} storeys (${r.local.maxStories.cite}).`
      : ''
  const height =
    r.local.kind === 'read' && r.local.heightDefersToBaseZone
      ? ` The ordinance states no height in feet for ADUs — it defers to the base zone (${r.local.heightDefersToBaseZone.cite}), floored by state law.`
      : ''
  return `${head} ${size.why}${stories}${height}`
}
