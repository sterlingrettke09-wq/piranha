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

// ── ⚠️ FOUR FACTS, NOT ONE NULLABLE FIELD ──────────────────────────────────
//
// This union replaced `stateFloor: StateFloorLayer | null`, and it is the main
// result of surveying the sixteen jurisdictions behind the eighteen unread
// cities. `null` was carrying four different facts that a reader cannot tell
// apart, and two of them are ANSWERS while two are not:
//
//   • Florida HAS an ADU statute (§ 163.31771) which says a local government
//     "MAY adopt an ordinance to allow" ADUs. That is the legislature declining
//     to preempt — a finding about Florida, arrived at by reading it.
//   • North Carolina's entire planning chapter was read, 494 KB of it, and
//     contains no ADU provision. Also a finding, but a different one: an
//     absence within a scope somebody named.
//   • Georgia has not been looked at. Its official code is behind LexisNexis
//     and the reachable mirrors are stale. Not a finding at all.
//   • And where a statute DOES preempt, it may bind only some cities — three of
//     the four preempting statutes carry a population or geography test.
//
// Rendering the first three identically is rule 5 at the state layer, one level
// up from where `farUnconstrained` already solved it for zoning. The old comment
// on the fallback said `stateFloor: null` meant "no state statute was found to
// preempt, which is a finding about the state" — which was simply false for
// Georgia and Tennessee, where nobody had looked.
export type StateLayer = StatePreempts | StateDeclines | StateNoProvision | StateNotEstablished

/** A state statute that sets rules the city may not go below. */
export interface StatePreempts {
  kind: 'preempts'
  state: string
  citation: string
  /** The date the statute text was read, not the date it was enacted. */
  readOn: string
  /** ⚠️ Effective date, carried because it is load-bearing. Nevada's mandate
   *  took effect 2026-07-01 and Colorado's obligations began 2025-06-30 — a
   *  statute that is on the books but not yet operative is not a floor. */
  effectiveFrom: string
  /** Who the statute binds. AZ reaches municipalities over 75,000; NV cities of
   *  60,000 or more; CO "subject jurisdictions" inside an MPO. A city failing
   *  the test is not preempted, so this cannot live in a per-state constant
   *  alone — see `AduRules.stateApplies`. */
  appliesTo: string
  size: StateDimension
  height: StateDimension
  /** How many units the city must allow, and on what. */
  count: Array<{ value: number | string; condition: string; cite: string }>
  /** Maximum setback the city may require. `parity` where the statute pegs it
   *  to the primary dwelling rather than stating a number. */
  setback: StateDimension
  protections: string[]
}

/** ⚠️ THE STATUTE EXISTS AND DECLINES. Florida § 163.31771(3): a local
 *  government "may adopt an ordinance to allow" ADUs. Enabling, not mandating.
 *  This is an answer about the state and must never render as an absence. */
export interface StateDeclines {
  kind: 'declines'
  state: string
  citation: string
  readOn: string
  /** What the statute does instead of preempting. */
  detail: string
}

/** We read a NAMED scope and found no ADU provision in it. An absence, and only
 *  as good as the scope — which is why `scopeRead` is required and is prose a
 *  reader can check rather than a boolean (rule 23). */
export interface StateNoProvision {
  kind: 'no-provision'
  state: string
  readOn: string
  scopeRead: string
  /** How the reading was verified, so a false absence from a broken fetch is
   *  visible. Texas produced five identical 250,874-byte shells before this
   *  field existed. */
  basis: string
}

/** ⚠️ NOBODY HAS LOOKED. Not a finding; the absence of one. */
export interface StateNotEstablished {
  kind: 'not-established'
  state: string
  /** Why it is still open, so this does not read as neglect when it is a
   *  blocked source. */
  detail: string
}

// ── ⚠️ A DIMENSION IS NOT ALWAYS A LIST OF NUMBERS ─────────────────────────
//
// The old shape assumed every floor was `{ value: number }`, because the only
// states read at the time were California and Washington, which both state
// constants. Two of the four preempting statutes state neither dimension as a
// number, and one addresses dimensions only to hand them back:
//
//   MA c. 40A § 3 preempts PROCESS and expressly reserves "dimensional setbacks
//   and the bulk and height of structures" to the municipality — a stated
//   answer.
//   NV § 278.257(2) lists six conditions an ordinance may not impose, and size
//   and height are not among them — the slot is filled and they are absent from
//   it, which is a structural answer of a different and weaker kind.
//
// Both leave the city free; a reader deserves to know which one they have.
export type StateDimension =
  | { kind: 'floors'; floors: AduFloor[] }
  /** The statute addresses this dimension and leaves it to the city. */
  | { kind: 'reserved-to-city'; cite: string; detail: string }
  /** The statute does not address this dimension at all. */
  | { kind: 'not-addressed'; detail: string }

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
  /** The ordinance states a figure. `measure` names its unit — see the note on
   *  `AduFloor`'s figure form; a local cap and a state floor are only comparable
   *  when both name the same measure. */
  | { kind: 'capped'; sqFt: number; condition: string; cite: string; measure?: string; baseline?: boolean }
  /** The ordinance affirmatively states NO maximum for this configuration. */
  | { kind: 'no-maximum'; condition: string; cite: string; baseline?: boolean }
  /** ⚠️ THE ORDINANCE BINDS THIS CONFIGURATION, BUT NOT WITH A NUMBER.
   *
   *  Added for San Francisco, and it is the fourth city forcing the fourth new
   *  shape. § 207.1 states no square-foot cap at all; instead § 207.1(c)(5)
   *  requires the ADU be built entirely within the buildable area of the
   *  existing lot with no vertical addition, or inside the built envelope of an
   *  existing detached garage or structure. That is a REAL limit and it is
   *  frequently TIGHTER than 850 sq ft — but it is geometric, so no figure can
   *  be published for it.
   *
   *  The three existing states all mis-describe it. `capped` needs a number we
   *  do not have. `not-found` asserts a hole in our reading, when we read the
   *  rule and understood it. And `no-maximum` is the dangerous one: it says the
   *  city states no maximum, which reads as PERMISSION and would overstate in
   *  exactly the direction rule 18 warns about. Same three-outcomes shape as
   *  rule 5 — a filled slot whose value is not a quantity is neither an absence
   *  nor a gap. */
  /** ⚠️ `measure` is OPTIONAL here for a reason worth stating. A rule can be
   *  non-numeric and still be expressed in a DEFINED unit — Minneapolis
   *  § 550.1460(2) is a max-of-a-min with no publishable figure, but every
   *  limb is in gross floor area as defined by § 565.70. Milwaukee's
   *  Table 295-505-2.5 is the opposite: the unit CHANGES between limbs of one
   *  sentence, so it carries no `measure` at all. Absent and known-mixed are
   *  different facts, and only the second is a defect in the source. */
  | { kind: 'not-numeric'; rule: string; condition: string; cite: string; measure?: string; baseline?: boolean }
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

/** ⚠️ WHETHER THE STATUTE REACHES THIS CITY, which is a separate fact from
 *  whether the statute exists. Rule 24 exactly: a reason code is a claim, and a
 *  claim true of the jurisdiction can be false of the parcel — here, of the city.
 *
 *  Arizona binds municipalities over 75,000 and Phoenix plainly clears it.
 *  Nevada binds cities of 60,000 or more and Las Vegas plainly clears it.
 *  Colorado binds "subject jurisdictions" — a municipality of 1,000 or more
 *  INSIDE A METROPOLITAN PLANNING ORGANISATION — and Denver has NOT been checked
 *  against that test. It is obviously large enough; the MPO half is the part
 *  nobody verified, and assuming it from size is how a city-level claim becomes
 *  wrong about the one city it is applied to. */
export type StateApplies =
  | { kind: 'qualifies'; why: string }
  | { kind: 'not-established'; why: string }
  /** The state layer is not a preemption, so the question does not arise. */
  | { kind: 'n-a' }

export interface AduRules {
  city: string
  /** ⚠️ Never nullable. See the union's own note — `null` was carrying four
   *  different facts, two of which are answers. */
  state: StateLayer
  /** Only meaningful when `state.kind === 'preempts'`. */
  stateApplies: StateApplies
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
// ── ⚠️ AND A FLOOR IS NOT ALWAYS A CONSTANT ────────────────────────────────
//
// Arizona § 9-461.18(A)(3) guarantees an ADU of "75% of the gross floor area of
// the single-family dwelling ... or 1,000 square feet, WHICHEVER IS LESS". That
// is a function of a parcel input, so no figure can be published for Arizona
// without the primary dwelling's size — and publishing 1,000 would OVERSTATE on
// every lot whose primary is under 1,333 sq ft.
//
// ⚠️ Note the opposition with San Francisco, because the ingredients are
// identical and the operator is not:
//
//     SF  § 207.2(d)     50% of primary OR   850 sq ft, whichever is GREATER
//     AZ  § 9-461.18(A)(3)  75% of primary OR 1,000 sq ft, whichever is LESS
//
// A ratio FLOORED by a figure, against a ratio CAPPED by one. Same two
// ingredients, opposite direction, opposite effect on a small primary dwelling.
//
// Colorado is a third form again: C.R.S. tit. 29 art. 35 does not state a floor
// at all, it forbids a local law that "does not allow for accessory dwelling
// unit sizes between five hundred and seven hundred fifty square feet". That
// bars a cap at 400 and permits one at 750, and says nothing determinate about a
// cap at 600 — so `band` carries the range AND the unresolved question, and no
// figure is derived from it (rule 4).
export type AduFloor =
  /** The statute states a number.
   *
   *  ⚠️ `measure` NAMES THE UNIT THE FIGURE IS IN, and it exists because two
   *  states measure the same thing under different labels while local codes use
   *  a third. California states every floor in "interior livable space"
   *  (§ 66313(e)–(f): interior habitable area, excluding garages). Washington
   *  says "gross floor area" — and RCW 36.70A.696(7) DEFINES that phrase to mean
   *  interior habitable area, i.e. California's measure under Washington's name.
   *  Meanwhile San Francisco caps in "Gross Floor Area" and Los Angeles in
   *  "Floor Area", neither of which is established to be either.
   *
   *  Comparing 850 against 850 across two such labels is comparing names, not
   *  quantities (rules 4 and 12). Absent, the comparison is disclosed as
   *  unverified rather than silently performed. */
  | { form: 'figure'; value: number; condition: string; cite: string; measure?: string; baseline?: boolean }
  /** The statute states a rule that resolves only against a parcel input. */
  | { form: 'derived'; rule: string; condition: string; cite: string; baseline?: boolean }
  /** The statute forbids excluding a range. NOT a floor — see above. */
  | { form: 'band'; low: number; high: number; unresolved: string; condition: string; cite: string; baseline?: boolean }
  /** The statute pegs this dimension to another use rather than to a number. */
  | { form: 'parity'; withUse: string; condition: string; cite: string; baseline?: boolean }



// ── CALIFORNIA ──────────────────────────────────────────────────────────────
// Gov. Code ch. 13 (§ 66310–66342). Read 2026-08-19 from leginfo.legislature.ca.gov.
const CA: StatePreempts = {
  kind: 'preempts',
  state: 'California',
  citation: 'Cal. Gov. Code §§ 66321, 66323 (Chapter 13, added by Stats. 2024, Ch. 7, Sec. 20; § 66321 amended by Stats. 2025, Ch. 520 (SB 543), effective 2026-01-01)',
  readOn: '2026-08-19',
  effectiveFrom: '2026-01-01',
  appliesTo: 'every city and county in the state — the chapter states no population threshold',
  // ⚠️ 850 AND 800 ARE DIFFERENT PROVISIONS DOING DIFFERENT WORK, and
  // collapsing them to one number would lose the more useful half. § 66321(b)(2)
  // caps how low a city's MAX-SIZE ordinance may go. § 66321(b)(3) is stronger
  // and narrower: an 800 sq ft ADU with four-foot setbacks must be buildable
  // NOTWITHSTANDING lot coverage, FAR, open space, front setbacks and minimum
  // lot size. One constrains a number; the other overrides a whole family of
  // standards.
  size: {
    kind: 'floors',
    floors: [
      { form: 'figure', value: 850, condition: 'a city may not cap an ADU below this', cite: '§ 66321(b)(2)(A)', measure: 'interior livable space (§ 66313(e)–(f): interior habitable area, excluding a garage or accessory structure)', baseline: true },
      { form: 'figure', value: 1000, condition: 'for an ADU with more than one bedroom', cite: '§ 66321(b)(2)(B)', measure: 'interior livable space (§ 66313(e)–(f): interior habitable area, excluding a garage or accessory structure)' },
      {
        form: 'figure',
        value: 800,
        condition:
          'must be buildable with four-foot side and rear setbacks regardless of lot coverage, FAR, open space, front setbacks or minimum lot size',
        cite: '§ 66321(b)(3)',
        measure: 'interior livable space (§ 66313(e)–(f): interior habitable area, excluding a garage or accessory structure)',
      },
    ],
  },
  height: {
    kind: 'floors',
    floors: [
      { form: 'figure', value: 16, condition: 'detached, on a single-family or multifamily lot', cite: '§ 66321(b)(4)(A)', baseline: true },
      {
        form: 'figure',
        value: 18,
        condition:
          'detached, within half a mile walking distance of a major transit stop or high-quality transit corridor; plus two more feet to match the primary dwelling\u2019s roof pitch',
        cite: '§ 66321(b)(4)(B)',
      },
      { form: 'figure', value: 18, condition: 'detached, on a lot with a multifamily multistory dwelling', cite: '§ 66321(b)(4)(C)' },
      {
        form: 'figure',
        value: 25,
        condition:
          'attached to the primary dwelling — or the primary dwelling\u2019s own limit, whichever is LOWER, and never more than two storeys',
        cite: '§ 66321(b)(4)(D)',
      },
    ],
  },
  count: [
    { value: '1 ADU + 1 JADU', condition: 'within the existing or proposed space of a single-family dwelling or accessory structure (up to 150 sq ft of expansion, for ingress and egress only). ⚠️ TWO conditions on the JADU live in the DEFINITION rather than in this operative section: § 66313(d) caps it at 500 sq ft of interior livable space AND requires it be contained entirely within a single-family residence. It may have separate sanitation facilities or share the existing structure\u2019s. Neither the figure nor the containment requirement appears in § 66323(a)(1)', cite: '§ 66323(a)(1), § 66313(d)' },
    { value: 1, condition: 'detached new construction, on a single-family lot', cite: '§ 66323(a)(2)' },
    { value: '25% of existing units, at least 1', condition: 'converted from non-livable space inside an existing multifamily building', cite: '§ 66323(a)(3)' },
    { value: 8, condition: 'detached, on a lot with an existing multifamily dwelling — never more than the number of existing units', cite: '§ 66323(a)(4)(A)(ii)' },
    { value: 2, condition: 'detached, on a lot with a proposed multifamily dwelling', cite: '§ 66323(a)(4)(A)(iii)' },
  ],
  setback: {
    kind: 'floors',
    floors: [{ form: 'figure', value: 4, condition: 'the maximum side and rear setback a city may require', cite: '§ 66323(a)(2), § 66321(b)(3)', baseline: true }],
  },
  protections: [
    'The city must approve a qualifying application MINISTERIALLY — no hearing, no discretionary review (§ 66323(a)).',
    'An ADU may be rented separately from the primary residence, but not sold or conveyed separately except under Article 4 (§ 66314(d)(1)).',
    'A city may not impose a minimum lot size for an ADU (§ 66314(b)(1)).',
  ],
}

// ── WASHINGTON ──────────────────────────────────────────────────────────────
// RCW 36.70A.681. Read 2026-08-19 from app.leg.wa.gov.
const WA: StatePreempts = {
  kind: 'preempts',
  state: 'Washington',
  citation: 'RCW 36.70A.681 — Accessory dwelling units, limitations on local regulation',
  readOn: '2026-08-19',
  effectiveFrom: '2024-06-06',
  appliesTo: 'cities and counties planning under the Growth Management Act — the count provision is further scoped to lots inside an urban growth area',
  size: {
    kind: 'floors',
    floors: [
      {
        form: 'figure',
        value: 1000,
        condition: 'a city may not cap gross floor area below this',
        cite: 'RCW 36.70A.681(1)(f)',
        // ⚠️ "Gross floor area" here is a STATUTORY TERM OF ART, not the
        // architectural one. RCW 36.70A.696(7) defines it as interior habitable
        // area excluding garages — the same substance California calls interior
        // livable space. A local cap using the ordinary meaning of the same
        // phrase is measuring something larger.
        measure: 'gross floor area AS DEFINED BY RCW 36.70A.696(7) — interior habitable area including basements and attics, excluding a garage or accessory structure',
        baseline: true,
      },
    ],
  },
  height: {
    kind: 'floors',
    floors: [
      {
        form: 'figure',
        value: 24,
        condition:
          'roof height — unless the principal unit\u2019s own limit is lower, in which case the ADU may not be held below THAT',
        cite: 'RCW 36.70A.681(1)(g)',
        baseline: true,
      },
    ],
  },
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
  // ⚠️ The statute sets no maximum setback FIGURE; it forbids setbacks more
  // restrictive than the principal unit's. Under the old shape that had to be
  // `maxSetbackFt: null` — indistinguishable from "we did not read it" — with
  // the real rule demoted to a prose protection. `parity` says it directly.
  setback: {
    kind: 'floors',
    floors: [
      {
        form: 'parity',
        withUse: 'the principal unit',
        condition: 'setbacks may not be more restrictive than for the principal unit; no figure is stated',
        cite: 'RCW 36.70A.681(1)(h)',
        baseline: true,
      },
    ],
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
// ── ARIZONA ─────────────────────────────────────────────────────────────────
// A.R.S. § 9-461.18. Found by reading the Title 9 section index, not by guessing.
const AZ: StatePreempts = {
  kind: 'preempts',
  state: 'Arizona',
  citation: 'A.R.S. § 9-461.18 — Accessory dwelling units; regulation; applicability; definitions',
  readOn: '2026-08-20',
  effectiveFrom: '2025-01-01',
  appliesTo: 'a municipality with a population of more than 75,000 (subsection H)',
  // ⚠️ THE FIRST NON-CONSTANT FLOOR IN THIS FILE. See the note on `AduFloor`.
  size: {
    kind: 'floors',
    floors: [
      {
        form: 'derived',
        rule: '75% of the gross floor area of the single-family dwelling on the same lot, or 1,000 sq ft, WHICHEVER IS LESS',
        condition: 'the size the municipality must allow; resolves only against the primary dwelling\u2019s floor area',
        cite: '§ 9-461.18(A)(3)',
        baseline: true,
      },
    ],
  },
  // ⚠️ No height figure anywhere in the section. (B)(5) pegs height, setbacks,
  // lot size, coverage and frontage to single-family standards in the same zone,
  // which resolves against the base zone this engine already computes.
  height: {
    kind: 'floors',
    floors: [
      {
        form: 'parity',
        withUse: 'single-family dwellings in the same zoning area',
        condition: 'the municipality may not set height restrictions more restrictive than for single-family dwellings',
        cite: '§ 9-461.18(B)(5)',
        baseline: true,
      },
    ],
  },
  count: [
    { value: '1 attached + 1 detached', condition: 'on any lot or parcel where a single-family dwelling is allowed, as a permitted use', cite: '§ 9-461.18(A)(1)' },
    { value: 1, condition: 'one ADDITIONAL detached ADU on a lot of one acre or more, where at least one ADU on the lot is a restricted-affordable dwelling unit', cite: '§ 9-461.18(A)(2)' },
  ],
  setback: {
    kind: 'floors',
    floors: [
      { form: 'figure', value: 5, condition: 'the maximum rear or side setback from the property line a municipality may require', cite: '§ 9-461.18(B)(6)', baseline: true },
    ],
  },
  protections: [
    '⚠️ A municipality that failed to adopt conforming regulations by 2025-01-01 must allow ADUs on ALL residentially zoned lots WITHOUT LIMITS (§ 9-461.18(F)). Whether Phoenix adopted in time determines which regime applies and has not been established here.',
    '"Permitted use" is defined to mean approval without a public hearing, variance, conditional use permit, special permit or special exception (§ 9-461.18(I)(5)).',
    'No additional parking may be required, nor fees in lieu of it (§ 9-461.18(B)(3)).',
    'No familial, marital or employment relationship may be required between the occupants (§ 9-461.18(B)(2)).',
    'The exterior design, roof pitch and finishing materials need not match the primary dwelling (§ 9-461.18(B)(4)).',
    'Long-term rental of either unit may not be prohibited, nor its advertisement (§ 9-461.18(B)(1)).',
    'A commercial building code or fire sprinkler may not be required (§ 9-461.18(D)).',
    'Does not apply on tribal land, near a military airport, or in certain airport noise areas above 65 dB (§ 9-461.18(G)).',
  ],
}

// ── COLORADO ────────────────────────────────────────────────────────────────
const CO: StatePreempts = {
  kind: 'preempts',
  state: 'Colorado',
  citation: 'C.R.S. title 29, article 35 (§§ 29-35-101 to 29-35-105), added by HB24-1152',
  readOn: '2026-08-20',
  effectiveFrom: '2025-06-30',
  appliesTo:
    'a "subject jurisdiction" — a municipality of 1,000 or more inside a metropolitan planning organisation, or the portion of a county within a census-designated place of 40,000 or more and inside an MPO',
  // ⚠️ NOT A FLOOR. Colorado states no minimum the city must allow; it forbids a
  // local law that EXCLUDES the 500–750 band. See the `band` note on AduFloor.
  size: {
    kind: 'floors',
    floors: [
      {
        form: 'band',
        low: 500,
        high: 750,
        unresolved:
          'the statute bars a local law that "does not allow for accessory dwelling unit sizes between five hundred and seven hundred fifty square feet". That plainly bars a cap at 400 and plainly permits a cap at 750 or more. Whether a cap at 600 complies is NOT resolved by the text, since such a law does allow some sizes in the band — so no figure is published for Colorado.',
        condition: 'a local law excluding this range is a prohibited "restrictive design or dimension standard"',
        cite: '§ 29-35-103(18)(b)',
        baseline: true,
      },
    ],
  },
  height: {
    kind: 'not-addressed',
    detail:
      'The list of prohibited "restrictive design or dimension standards" covers architecture and materials, size, side setbacks, rear setbacks, minimum lot size and factory-built structures. Height is not among them.',
  },
  count: [
    { value: 1, condition: 'one ADU as an accessory use to a single-unit detached dwelling, anywhere the jurisdiction allows single-unit detached dwellings, subject to an administrative approval process', cite: '§ 29-35-104' },
  ],
  setback: {
    kind: 'floors',
    floors: [
      { form: 'parity', withUse: 'the primary dwelling unit in the same zoning district', condition: 'side setbacks may not be larger than the primary dwelling\u2019s', cite: '§ 29-35-103(18)(c)', baseline: true },
      { form: 'figure', value: 5, condition: 'rear setback may not exceed the GREATER of five feet or the rear setback for other accessory building types in the same district', cite: '§ 29-35-103(18)(d)' },
    ],
  },
  protections: [
    '⚠️ Two different size numbers appear in this act doing different jobs. The MANDATE is the 500–750 band. A separate 500–800 figure belongs to the list of actions qualifying a local government as a "supportive jurisdiction" — an optional incentive tier, not the baseline obligation. Conflating them publishes the incentive number as the mandate.',
    'A minimum lot size more restrictive for an ADU than for a single-unit detached dwelling is prohibited (§ 29-35-103(18)(e)).',
    'Architectural style, building material and landscaping requirements more restrictive than for a single-unit detached dwelling are prohibited (§ 29-35-103(18)(a)).',
    '⚠️ The text read was the SESSION LAW (HB24-1152 as enacted), not the codified CRS. The codified article must be read before these figures are relied on — the Los Angeles finding is exactly this exposure.',
  ],
}

// ── MASSACHUSETTS ───────────────────────────────────────────────────────────
const MA: StatePreempts = {
  kind: 'preempts',
  state: 'Massachusetts',
  citation: 'M.G.L. c. 40A § 3, the accessory-dwelling-unit paragraph',
  readOn: '2026-08-20',
  effectiveFrom: '2025-02-02',
  appliesTo: 'any zoning ordinance or by-law, in a single-family residential zoning district',
  // ⚠️ THE EXPRESS RESERVATION. Massachusetts preempts PROCESS and then hands
  // dimensions back in the same sentence. That is a stated answer, and it is
  // different in kind from Nevada's silence — hence two dimension states.
  // ⚠️ CORRECTED 2026-08-20. This field previously asserted that the statute
  // sets out no size at all. That assertion was false, and false because the
  // reading stopped at the operative section.
  // § 3 grants the by-right use and reserves "dimensional setbacks and the bulk
  // and height of structures" to the municipality, so the operative paragraph
  // really does state no size. The number is in § 1A, in the DEFINITION of the
  // term § 3 uses: an ADU "is not larger in gross floor area than 1/2 the gross
  // floor area of the principal dwelling or 900 square feet, whichever is
  // smaller".
  //
  // ⚠️ AND IT RUNS THE OPPOSITE WAY FROM EVERY OTHER FIGURE IN THIS FILE. It is
  // not a floor. It is the ceiling of the PROTECTED CATEGORY — a unit above it
  // is simply not an "accessory dwelling unit" for the Act's purposes and gets
  // no by-right protection. And § 1A(iii) lets a municipality impose "additional
  // size restrictions", bounded only by a reasonableness standard. So
  // Massachusetts guarantees no size at all, and recording min(50%, 900) as a
  // floor would assert a right the statute does not confer.
  //
  // The dimension therefore stays `reserved-to-city` — the operative consequence
  // is that the city sets the size — but the detail carries the figure and its
  // direction, because burying it was the original error.
  size: {
    kind: 'reserved-to-city',
    cite: 'M.G.L. c. 40A §§ 1A, 3',
    detail:
      '§ 3 reserves "dimensional setbacks and the bulk and height of structures" to the municipality. § 1A caps the PROTECTED CATEGORY at the lesser of 1/2 the principal dwelling\u2019s gross floor area and 900 sq ft — a ceiling on what the by-right use covers, NOT a floor the city must allow. § 1A(iii) expressly permits a municipality to impose additional size restrictions, subject only to not "unreasonably restrict[ing] the creation or rental" of a non-short-term-rental ADU. So no size is guaranteed here.',
  },
  height: {
    kind: 'reserved-to-city',
    cite: 'M.G.L. c. 40A § 3',
    detail: 'Reserved by the same clause: "the bulk and height of structures" remain the municipality\u2019s to regulate.',
  },
  count: [
    { value: 1, condition: 'a single ADU, or its rental, in a single-family residential zoning district — no special permit or other discretionary approval may be required', cite: 'M.G.L. c. 40A § 3' },
    { value: 'more than 1 needs a special permit', condition: 'for more than one ADU in a single-family residential zoning district', cite: 'M.G.L. c. 40A § 3' },
  ],
  setback: {
    kind: 'reserved-to-city',
    cite: 'M.G.L. c. 40A § 3',
    detail: 'Expressly reserved — "regulations concerning dimensional setbacks" remain available to the municipality.',
  },
  protections: [
    'No special permit or other discretionary zoning approval may be required for a single ADU in a single-family residential district, and it may not be prohibited or unreasonably restricted.',
    'Owner occupancy of neither the ADU nor the principal dwelling may be required.',
    'Not more than ONE additional parking space may be required — and NONE where the ADU is within 0.5 miles of a commuter rail station, subway station, ferry terminal or bus station.',
    'Short-term rental may be restricted or prohibited (c. 64G § 1 definition).',
    '⚠️ THE SIZE FIGURE IS IN THE DEFINITION, NOT THE OPERATIVE SECTION, and it is a ceiling rather than a floor. M.G.L. c. 40A § 1A defines an accessory dwelling unit as one "not larger in gross floor area than 1/2 the gross floor area of the principal dwelling or 900 square feet, whichever is smaller". A unit above that is not an ADU for the Act and carries no by-right protection; it is not thereby prohibited, and the municipality may allow it under its own zoning.',
    '⚠️ A municipality MAY impose additional size restrictions below the § 1A figure (§ 1A(iii)), bounded only by "no municipality shall unreasonably restrict the creation or rental of an accessory dwelling unit that is not a short-term rental". Whether a particular local cap is "unreasonable" is a question this tool does not adjudicate.',
    '⚠️ The Executive Office of Housing and Livable Communities may issue guidelines or regulations administering this paragraph. Those have NOT been read and may carry operative detail.',
  ],
}

// ── NEVADA ──────────────────────────────────────────────────────────────────
// ⚠️ The newest instrument in the survey, in force seven weeks at time of
// reading. Any approach resting on recall would have reported Nevada as
// non-preempting with complete confidence.
const NV: StatePreempts = {
  kind: 'preempts',
  state: 'Nevada',
  citation: 'NRS 278.257 — Ordinance authorizing development and use of accessory dwelling unit on residential property (added by 2025 Nev. Stats. p. 2376)',
  readOn: '2026-08-20',
  effectiveFrom: '2026-07-01',
  appliesTo: 'a county with a population of 100,000 or more, and a city with a population of 60,000 or more (subsection 1)',
  // ⚠️ NOT ADDRESSED, and that is a structural finding rather than a failed
  // search: subsection 2 is a list of conditions the ordinance may not impose,
  // it is filled with six items, and size and height are not among them.
  size: {
    kind: 'not-addressed',
    detail:
      'Subsection 2 enumerates six conditions an ADU ordinance must not impose — separate kitchens, parking, setbacks, street improvements, rental use. Size is not among them, so Nevada leaves it to the city without saying so.',
  },
  height: {
    kind: 'not-addressed',
    detail: 'Height appears nowhere in the section, including in the subsection 2 list of prohibited conditions.',
  },
  count: [
    { value: 1, condition: 'the governing body must authorise the development and use of an accessory dwelling unit on property zoned single-family residential', cite: 'NRS 278.257(1)' },
    { value: 'no more than 2', condition: '⚠️ a CEILING on the statute, not a floor — nothing in the section authorises more than two ADUs on any residential property', cite: 'NRS 278.257(4)(b)' },
  ],
  setback: {
    kind: 'floors',
    floors: [
      {
        form: 'parity',
        withUse: 'the primary residence',
        condition: 'no side or rear setback more restrictive than the primary residence\u2019s; no figure is stated',
        cite: 'NRS 278.257(2)(c)',
        baseline: true,
      },
    ],
  },
  protections: [
    'Separate kitchen facilities may not be prohibited (NRS 278.257(2)(a)).',
    'No more than one additional parking space may be required, where existing and street parking meet anticipated need (NRS 278.257(2)(b)).',
    'Public street improvements may not be required except to repair damage caused by the construction, or for health and safety (NRS 278.257(2)(d)).',
    'Use as rental housing may not be prohibited — though transient lodging may be (NRS 278.257(2)(e)).',
    'An approved ADU need not meet commercial building code, including any commercial fire-sprinkler requirement (NRS 278.257(3)(b)).',
    'Does not apply in a region governed by an interstate-compact regional planning agency whose regional plan regulates housing — the Tahoe carve-out (NRS 278.257(5)).',
  ],
}

// ── THE STATE LAYER FOR THE REST ────────────────────────────────────────────
//
// ⚠️ THREE DIFFERENT FACTS, and the whole point of the union. Florida read and
// declined; nine states read within a stated scope and found nothing; two not
// looked at. Under the old `stateFloor: null` all three rendered identically.

/** FL — the statute exists and hands the decision to the city. */
const FL: StateDeclines = {
  kind: 'declines',
  state: 'Florida',
  citation: 'Fla. Stat. § 163.31771 — Accessory dwelling units',
  readOn: '2026-08-20',
  detail:
    'Subsection (3): "A local government MAY adopt an ordinance to allow accessory dwelling units in any area zoned for single-family residential use." Enabling, not mandating — no standard is imposed on the city. A permit application for an ADU allowed under such an ordinance must carry an affidavit that the unit will be rented at an affordable rate (subsection 4), and such units count toward the affordable-housing component of the local comprehensive plan (subsection 5).',
}

const noProvision = (state: string, scopeRead: string, basis: string): StateNoProvision => ({
  kind: 'no-provision', state, readOn: '2026-08-20', scopeRead, basis,
})

const NO_PROVISION: Readonly<Record<string, StateNoProvision>> = Object.freeze({
  nc: noProvision('North Carolina', 'G.S. Chapter 160D, "Local Planning and Development Regulation" — the whole chapter', 'rendered text of 494,602 characters, zero occurrences of "accessory dwelling"'),
  tx: noProvision('Texas', 'Local Government Code chapters 211 (Municipal Zoning Authority), 214 (Municipal Regulation of Housing) and 218 (Mixed-Use and Multifamily) — three chapters, not the whole code', 'read in the browser after curl returned five identical 250,874-byte navigation shells; ch. 211 carries the legislature\u2019s recent subchapter of zoning limits (§§ 211.051–211.058, minimum lot sizes) and has no ADU section'),
  oh: noProvision('Ohio', 'Ohio Revised Code chapter 713 (Planning Commissions)', 'full section text, 61,012 characters, zero hits'),
  wi: noProvision('Wisconsin', 'Wis. Stat. chapter 66 (General Municipality Law), titled section index — ch. 62.23, the city planning and zoning section, was NOT read', 'titled index of 51 sections, zero hits'),
  mn: noProvision('Minnesota', 'Minn. Stat. chapter 462 (Housing, Redevelopment, Planning, Zoning), titled section index', 'titled index of 208 sections, zero hits. ⚠️ An earlier probe of § 462.357 was a GUESSED section number and was discarded rather than recorded — it disproves the guess, not Minnesota (rule 8)'),
  dc: noProvision('District of Columbia', 'D.C. Code title 6 chapter 6 (Zoning and Height of Buildings)', 'chapter index, six subchapters, no ADU provision. DC zoning is delegated to the Zoning Commission and lives in 11 DCMR, which is the LOCAL instrument — DC has no legislature above it for this purpose'),
  il: noProvision('Illinois', '65 ILCS 5/11-13, Division 13 (Zoning) of the Illinois Municipal Code', 'rendered text of 64,113 characters and 103 section references, zero hits. ⚠️ Reached by clicking the index\u2019s own link after the legacy URL scheme returned a page byte-identical to one already held; the length moving 19,259 → 64,113 is what proved a different page was served'),
  ga: noProvision('Georgia', 'the entire Official Code of Georgia Annotated', 'full-code phrase search on the public-access portal the Georgia General Assembly itself links to, maintained for the Georgia Code Revision Commission: 0 documents for "accessory dwelling unit". ⚠️ Positive control — "zoning" returns 370 documents, so the search works and the zero is a measurement rather than a broken instrument'),
  tn: noProvision('Tennessee', 'the entire Tennessee Code', 'full-code phrase search on the Tennessee Code Unannotated free public access portal: 0 documents for "accessory dwelling unit". ⚠️ Positive control — "zoning" returns 235 documents, from Title 13 ch. 7 and citing Tenn. Code Ann. § 13-7-307, which also confirmed the scope was Tennessee despite stale "Georgia General Assembly" page chrome'),
  // ⚠️ TWO CHAPTERS READ, AND THE SECOND ONE BINDS WITHOUT NAMING ADUs. The
  // original scope here was the zoning enabling act alone, which is rule 23's
  // shape exactly — a thorough read of the right document that is not the only
  // document. New York's ADU absence is real, but it is an absence of the TERM.
  ny: noProvision(
    'New York',
    'General City Law article 5-A (Buildings and Use Districts) — the zoning article applicable to cities — AND the Multiple Dwelling Law (MDL), a separate chapter that is not a zoning law at all',
    'GCL: seven sections, and none of the chapter\u2019s 22 article titles mention accessory dwellings. MDL: a 182-section, 786,606-character corpus returns ZERO for "accessory dwelling" and "accessory dwelling unit", with positive controls that fired — "multiple dwelling" 639, "fireproof" 290, "basement" 99 — and the ten "accessory" hits all sit inside the § 4(31) definition of "lot". Cross-checked against a second publisher. ⚠️ BUT THE MDL STILL CONSTRAINS A NYC ADU: § 4(6) caps a "private dwelling" at not more than two FAMILIES and § 4(7) starts a "multiple dwelling" at three or more living independently, with no category between them — so a two-family house that adds a third unit is reclassified, and a habitability regime attaches that zoning never mentions. NYC DOB states this itself: a two-family building adding an attic, basement, cellar or attached ADU "will be treated as a three-family building subject to the NYS Multiple Dwelling Law", unless separated by a fire wall. ⚠️ This is NOT a floor and NOT a preemption — it runs in the RESTRICTIVE direction, which the state layer has no shape for. See scratchpad adu-reports/nyc-state-mdl.md; it must be carried into the NYC local read rather than left here.',
  ),
  pa: noProvision('Pennsylvania', 'the Pennsylvania Municipalities Planning Code (Act 247 of 1968), read whole', '398,886 characters, zero ADU occurrences. ⚠️ And it resolves on SCOPE regardless: the MPC\u2019s enacting clause empowers "cities of the second class A, and third class" and omits cities of the FIRST class entirely — the phrase appears nowhere in the act. Philadelphia is Pennsylvania\u2019s only first-class city, so the MPC does not reach it; its zoning authority runs through the First Class City Home Rule Act'),
})

// ⚠️ GA AND TN ARE THE STRONGEST RESULTS IN THE SURVEY, AND WERE ALMOST THE
// WEAKEST. Both were briefly recorded as `not-established` on the ground that
// their codes sit behind LexisNexis — which was true of the ROUTE I had tried
// and false of the resource. Georgia's own General Assembly site publishes no
// code text; its "Georgia Code" link points AT LexisNexis, so the commercial
// host IS the enacting body's designated publication, maintained for the
// Georgia Code Revision Commission. Following the legislature's own link
// rendered a public-access portal with a working full-code search.
//
// So these two are whole-code searches rather than the chapter-scoped reads
// every other `no-provision` entry rests on — a stronger instrument, reached by
// asking who publishes the code rather than by assuming a paywall.
//
// ⚠️ AND EACH CARRIES A POSITIVE CONTROL, because a search returning nothing and
// a search that is not working are indistinguishable (rule 20). "zoning"
// returns 370 in the OCGA and 235 in the Tennessee Code, the latter citing
// Tenn. Code Ann. § 13-7-307 — which also confirmed the scope was really
// Tennessee, since the page chrome still read "Georgia General Assembly".

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
  // ⚠️ BACKFILLED 2026-08-19, from `not-checked`. The earlier state was honest —
  // the PDF had been read and no docket consulted — but it was left open rather
  // than closed, and an admission that stays put indefinitely becomes furniture.
  //
  // What closed it is the division PDF's own amendment history, which nobody had
  // looked at: § 141.0302 carries amendment notes inline, and the latest inside
  // the section's own span is O-22109, effective 2026-07-15. That is a month
  // before this reading, and it is the latest amendment anywhere in the division
  // (checked across all of them, not just the ones near the section). The footer
  // revision (7-2026) agrees. The download was verified byte-identical against
  // Content-Length before parsing — rule 22, after a 37 MB PDF once arrived short
  // with HTTP 200.
  pending: {
    kind: 'checked',
    on: '2026-08-19',
    source:
      'City of San Diego municipal code index (city-clerk/officialdocs/municipal-code/chapter-14) and the Ch14Art01Division03.pdf amendment history it links',
    codifiedThrough:
      'O-22109 N.S., adopted 2026-06-15, effective 2026-07-15 — the latest amendment inside § 141.0302 and the latest anywhere in the division; PDF footer revision (7-2026)',
    amendingThisSection: [],
    note: 'San Diego publishes division PDFs with no pending-ordinance list anywhere on the code index, so `amendingThisSection: []` records that NO LIST EXISTS TO READ — the same weaker form as Los Angeles and San Francisco, not Seattle\'s read-and-empty. What carries the confidence here is instead the section\'s own inline amendment history running to an ordinance effective one month before this reading.',
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
    { kind: 'capped', sqFt: 1000, condition: 'An ADU on a lot of up to 9,000 sq ft may be up to 1,000 sq ft', cite: '§ 20.80.175.D.1.b (Table 20-55)', measure: 'floor area (SJMC § 20.80.175.D.1, Table 20-55) — ⚠️ the ordinance does NOT qualify this as gross or net, and none is read across from elsewhere', baseline: true },
    { kind: 'capped', sqFt: 1200, condition: 'on a lot greater than 9,000 sq ft', cite: '§ 20.80.175.D.1.c (Table 20-55)', measure: 'floor area (SJMC § 20.80.175.D.1, Table 20-55) — ⚠️ the ordinance does NOT qualify this as gross or net, and none is read across from elsewhere' },
    { kind: 'no-maximum', condition: 'conversion of an existing DETACHED accessory structure', cite: '§ 20.80.175.D.1.d' },
  ],
  maxHeightFt: [
    { form: 'figure', value: 18, condition: 'detached, one storey', cite: '§ 20.80.175.D.2.a', baseline: true },
    { form: 'figure', value: 25, condition: 'detached, two storeys — roof height above grade', cite: '§ 20.80.175.D.2.b' },
    { form: 'figure', value: 25, condition: 'attached — roof height above grade, and no more than two storeys', cite: '§ 20.80.175.D.2.d' },
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
    '⚠️ THE 9,000 SQ FT LOT THRESHOLD IS UNQUALIFIED, and it decides which cap applies. § 20.80.175.D.1.b–c say "a lot with an area of" and Table 20-55 heads the column "Lot size" — neither says NET nor GROSS. Net and gross lot area differ by easements and rights-of-way, so a lot near 9,000 sq ft can fall either side depending on which is meant. Reading "net" across from another city is the invented conversion rule 4 forbids, so the threshold is carried as the ordinance states it and no denominator is assumed. Same shape as Atlanta SPI-20.',
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

// ── LOS ANGELES ─────────────────────────────────────────────────────────────
//
// ⚠️ FOUND BY FOLLOWING THE CODE'S OWN CROSS-REFERENCE, NOT BY GUESSING. LA runs
// TWO zoning codes side by side under `lapz`: "CHAPTER I GENERAL PROVISIONS AND
// ZONING" (the legacy § 12.x code) and "CHAPTER 1A CITY OF LOS ANGELES ZONING
// CODE". Both are listed current through the same date, so "which instrument
// governs" had to be settled before any figure was read. The ADU standards are
// in the legacy chapter. § 12.22's Home-Sharing subdivision points at
// "Section 12.26 A.3" for ADUs, which is the PERMIT APPLICATION route; the
// substantive standards are § 12.22 A.33, and both exist.
const LA_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Los Angeles Municipal Code § 12.22 A.33 (Accessory Dwelling Units (ADU) and Junior Accessory Dwelling Units (JADU)), Ch. I Art. 2; added by Ord. No. 186,481, eff. 12/19/2019',
  readOn: '2026-08-19',
  maxSizeSqFt: [
    {
      kind: 'capped',
      sqFt: 1200,
      condition: 'Floor Area for a DETACHED ADU. Lot-wide Floor Area limits apply separately and may reduce it further',
      cite: '§ 12.22 A.33(d)(1)',
      measure: 'Floor Area (LAMC) — NOT established to equal the state\u2019s interior-livable-space measure',
      baseline: true,
    },
  ],
  // ⚠️ EMPTY IS THE READING, NOT A GAP. The only height in feet anywhere in the
  // subdivision is 16 ft at (c)(1)(iii), and that is a FLOOR the city may not
  // build below — LA restating the state guarantee inside its own ordinance. It
  // is not a cap, so putting it here would invert its meaning.
  maxHeightFt: [],
  maxStories: { value: 2, condition: 'structures containing a detached ADU', cite: '§ 12.22 A.33(d)(2)' },
  // (c)(1) requires compliance with "provisions stated in the underlying
  // applicable zone and height district" — an express deferral, same as San
  // Diego and Seattle.
  heightDefersToBaseZone: { cite: '§ 12.22 A.33(c)(1)' },
  notes: [
    'An ADU complying with this subdivision needs no discretionary planning approval — review is ministerial and limited to objective standards, and the City must act within 60 days of a complete application (§ 12.22 A.33(c)(2)).',
    'An ADU is permitted in all zones where residential uses are permitted by right (§ 12.22 A.33(c)(3)).',
    'No minimum lot size applies to an ADU, and no minimum square footage may be imposed that prohibits an efficiency unit (§ 12.22 A.33(c)(1)(i)–(ii)).',
    '⚠️ No ADU on a lot that is in BOTH a Very High Fire Hazard Severity Zone and a Hillside Area, unless it is in the Northeast LA or Silver Lake–Echo Park–Elysian Valley Community Plan Areas, or it adds sprinklers, one off-street parking space and fronts a 20 ft roadway (§ 12.22 A.33(c)(4)).',
    'Detached ADUs must also meet LAMC § 12.21 C.5. where it does not conflict, and may not sit between the primary dwelling and the front street except on a through lot or when added to a lawfully existing garage (§ 12.22 A.33(d)(3)).',
    // ⚠️ THE SAME RATIO AS SAN JOSÉ — BUT LA'S OWN TEXT SETTLES IT.
    //
    // San José caps an attached ADU at 50% of the primary and says nothing more,
    // so whether the 850 sq ft state floor overrides it on a small primary was
    // left as a question for the city. LA has the identical 50% cap at (e)(1) —
    // and then (e)(3) says NOTHING IN THIS SUBDIVISION shall prohibit an
    // attached ADU below 850 (or 1,000 with more than one bedroom). "Nothing in
    // this subdivision" reaches (e)(1). So the floor is written into the local
    // ordinance rather than only into the statute, and the resolution is the
    // source's, not ours.
    '⚠️ An ATTACHED ADU is capped at 50% of the existing primary dwelling (§ 12.22 A.33(e)(1)) — a ratio, not a figure, so it is not computed here. Unlike San José, LA bounds its own ratio: § 12.22 A.33(e)(3) states nothing in the subdivision shall prohibit an attached ADU of less than 850 sq ft, or less than 1,000 sq ft with more than one bedroom. The 50% cap therefore cannot cut below those.',
    'Movable Tiny Houses are a third ADU form with their own standards, including one per lot per twelve months (§ 12.22 A.33(f)).',
    // ⚠️ A STALE DELEGATION IN LIVE TEXT — the recodification hazard, found
    // inside a city ordinance rather than in our own citation.
    //
    // ⚠️ THIS IS A FINDING ABOUT LA'S CODE, NOT AN OPEN QUESTION ABOUT OURS, and
    // the distinction matters because the two render alike if you let them. Every
    // element is established and citable: the delegating paragraphs (b)(4)–(6),
    // the sections they name, the recodification that replaced those sections
    // (Stats. 2024 Ch. 7), and the absence of any amendment note after Ord.
    // 186,481 (2019) explaining why it never followed. Nothing here is pending
    // further reading.
    //
    // Writing it as "a question for the city" — which it said first — imported an
    // uncertainty that belongs to nobody. OUR encoding is not uncertain: LA's
    // floors come from live ch. 13 whatever the ordinance points at. Hedging a
    // settled finding is the mirror of rule 1: there the error is giving a
    // direction nothing measured, here it is withholding one that was.
    '⚠️ FINDING: Los Angeles\'s ADU ordinance delegates entire categories of ADU to a repealed statute. § 12.22 A.33(b)(4)–(6) do not merely cite California Gov. Code §§ 65852.2 and 65852.22 — they make compliance with them the approval standard. ADU law was recodified out of § 65852.2 into Gov. Code ch. 13 (§ 66310 et seq.) by Stats. 2024, Ch. 7. The section carries no amendment note after Ord. 186,481 (2019), so it never followed. This is an established defect in the city\'s code, dated and cited; it is not an uncertainty in this tool\'s reading, and the ADU floors published for LA are read from live ch. 13 regardless of what the ordinance points at.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-19',
    source: 'American Legal Publishing code library, Los Angeles overview and the § 12.22 section page',
    codifiedThrough: 'legislation effective March 31, 2026 (Municipal Code; Chapter 1A current through the same date)',
    amendingThisSection: [],
    // ⚠️ THE WEAKEST OF THE THREE, and said so rather than levelled up. Seattle
    // displayed 17 pending ordinances that could be read and found not to touch
    // the section. San José displayed no list. amlegal displays no pending list
    // for the legacy chapter at all — the only "Table of Amending Legislation"
    // is scoped to Chapter 1A, which is a different instrument — AND its
    // codified-through date is five months before the date of this reading.
    note: 'amlegal publishes no pending-ordinance list for Chapter I; its only amending-legislation table is scoped to Chapter 1A, a different instrument. So `amendingThisSection: []` here records that NO LIST EXISTS TO READ, which is weaker than San José and much weaker than Seattle. Compounding it, the codified-through date (2026-03-31) is roughly five months before this reading, so any ordinance in that window is invisible on this source.',
  },
}

// ── SAN FRANCISCO ───────────────────────────────────────────────────────────
//
// ⚠️ THE CITY CODIFIES THE TWO-LAYER DISTINCTION ITSELF. Every other city has one
// ADU section that the state floor sits underneath. San Francisco has TWO
// parallel sections — § 207.1 "Local Accessory Dwelling Unit Program" and
// § 207.2 "State Mandated Accessory Dwelling Unit Program" — which is this
// module's own state/local split written into the Planning Code.
//
// They are MUTUALLY EXCLUSIVE, not an applicant's free election: § 207.1(b)
// applies citywide "except ADUs regulated by the State-Mandated Program under
// Section 207.2". Which one governs follows from how the unit is built, so
// reporting the more generous of the two as "what San Francisco allows" would be
// rule 6 exactly — a maximum across alternatives presented as a ceiling.
const SF_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'San Francisco Planning Code §§ 207.1 (Local Accessory Dwelling Unit Program) and 207.2 (State Mandated Accessory Dwelling Unit Program), Art. 2',
  readOn: '2026-08-19',
  maxSizeSqFt: [
    {
      kind: 'capped',
      sqFt: 850,
      condition:
        'STATE-MANDATED programme (§ 207.2): a detached, new-construction Streamlined ADU with one bedroom or less, on a lot with a proposed or existing single-family dwelling',
      cite: '§ 207.2(c)(1)',
      measure: 'Gross Floor Area (San Francisco Planning Code) — NOT established to equal the state\u2019s interior-livable-space measure',
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 1000,
      condition: 'STATE-MANDATED programme (§ 207.2): the same, for an ADU with more than one bedroom',
      cite: '§ 207.2(c)(1)',
      // Same sentence as the 850 entry, so the same measure — read off the
      // source rather than inferred from the sibling.
      measure: 'Gross Floor Area (San Francisco Planning Code) — NOT established to equal the state\u2019s interior-livable-space measure',
    },
    // ⚠️ THE GOVERNING RULE OF THE LOCAL PROGRAMME, AND IT IS NOT A NUMBER.
    // Recording this as `no-maximum` would say San Francisco caps nothing, when
    // the envelope rule is frequently tighter than 850 sq ft.
    {
      kind: 'not-numeric',
      rule:
        'the ADU must be built entirely within the buildable area of the existing lot with no vertical addition, or within the built envelope of an existing authorised detached garage, storage structure or other detached structure',
      condition: 'LOCAL programme (§ 207.1), which governs wherever § 207.2 does not',
      cite: '§ 207.1(c)(5)',
    },
  ],
  maxHeightFt: [
    { form: 'figure', value: 18, condition: 'state-mandated: detached, on a lot with an existing or proposed dwelling', cite: '§ 207.2(d)(9)(A)', baseline: true },
    {
      form: 'figure',
      value: 20,
      condition: 'state-mandated: detached, where the extra two feet accommodate a roof pitch aligned with the primary dwelling\'s',
      cite: '§ 207.2(d)(9)(A)',
    },
    { form: 'figure', value: 25, condition: 'state-mandated: attached to the primary dwelling', cite: '§ 207.2(d)(9)(B)' },
    { form: 'figure', value: 16, condition: 'local programme: a detached ADU placed in the required REAR YARD, with four-foot side and rear setbacks', cite: '§ 207.1(c)' },
  ],
  maxStories: null,
  heightDefersToBaseZone: null,
  notes: [
    '⚠️ Two programmes, mutually exclusive. § 207.1 (local) applies citywide EXCEPT to ADUs regulated by § 207.2 (state-mandated), per § 207.1(b). Which governs follows from how the unit is built, not from the applicant choosing the better deal — so the two sets of figures must not be merged into one envelope.',
    '⚠️ The LOCAL programme states no square-foot cap anywhere in its nine subsections. Its binding size limit is geometric (§ 207.1(c)(5)): within the existing lot\'s buildable area with no vertical addition, or inside the built envelope of an existing detached structure. An ADU built entirely within that envelope is exempt from the notification requirements as well.',
    'LOCAL programme unit COUNT is unusually permissive: one ADU on a lot with four or fewer existing units (or where zoning permits four or fewer), and NO LIMIT on the number of ADUs on a lot with more than four units, or one undergoing seismic retrofitting (§ 207.1(c)(1)).',
    'LOCAL programme rear-yard exception: a detached ADU may sit in the required rear yard at four feet from side and rear lot lines, no more than sixteen feet tall, with Gross Floor Area not exceeding 850 sq ft (one bedroom or less) or 1,000 sq ft (more than one bedroom) — § 207.1(c).',
    '⚠️ Neither programme permits Short-Term Residential Rentals (§§ 207.1(d), 207.2(f)). Under the local programme this is recorded as a Notice of Special Restriction on the lot.',
    'An ADU may not be approved where a tenant on the lot was evicted under specified Administrative Code grounds within the preceding ten years (five for owner move-in) — § 207.1(c)(2).',
    'State-mandated ADUs need no discretionary review: no discretionary-review requests are accepted, no Planning Commission hearing is held, and Section 311 notification does not apply (§ 207.2(e)).',
    'A detached, new-construction Streamlined ADU on a MULTIFAMILY lot is bound by the § 207.2(d)(9) height limits but no square-foot cap is stated for it (§ 207.2(c)(2)).',
    // ⚠️ THE SAME RULE, DRAFTED THREE WAYS ACROSS THREE CITIES — and San
    // Francisco's is the only one that resolves inside its own sentence.
    '⚠️ The ATTACHED cap is the 50%-of-primary rule again, and San Francisco is the only one of the three that settles it in the same sentence: an attached ADU may not exceed 50% of the existing primary dwelling\'s Gross Floor Area OR 850 sq ft (1,000 sq ft with more than one bedroom), WHICHEVER IS GREATER. So the ratio can never cut below the floor here. Compare LA, where a separate paragraph does the same job, and San José, where nothing does.',
    // ⚠️ THE RECODIFICATION CHECK, PASSING — recorded because a clean negative
    // that is not written down gets re-asked, and next time someone assumes it
    // was never run.
    '✓ Recodification check: § 207.2 cites California Gov. Code §§ 66314–66333 — the LIVE chapter 13 sections. San Francisco tracked the 2024 recodification. Los Angeles\'s § 12.22 A.33 did not and still names the superseded § 65852.2, so the same check produces opposite results in two cities of the same state.',
    'The § 800/16 ft override appears here too: no standard may prevent an ADU of 800 sq ft or less, 16 feet or less in height, with four-foot side and rear setbacks (§ 207.2(d)).',
    'Planning Director Bulletin No. 3 ("State Accessory Dwelling Unit Program") is named by § 207.2(b) as the comprehensive list of applicable requirements. It has NOT been read — a further source this reading did not reach.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-19',
    source: 'American Legal Publishing code library, San Francisco overview page',
    codifiedThrough:
      'Ordinance 128-26, File No. 260540, approved July 10, 2026, effective August 10, 2026',
    amendingThisSection: [],
    // ⚠️ THE STRONGEST OF THE FOUR, and worth saying so for the same reason the
    // weak ones are flagged: an empty `amendingThisSection` means something
    // different in each city.
    note: 'The strongest vintage of the four cities read. amlegal states San Francisco current through an ordinance effective 2026-08-10 — nine days before this reading — against Los Angeles at five months stale. No pending-ordinance list is published here either, so `amendingThisSection: []` still records "no list exists to read" rather than "a list was read and was empty"; the narrow gap between the codified-through date and this reading is what carries the confidence, not a pending check.',
  },
}

// ── PHOENIX ─────────────────────────────────────────────────────────────────
//
// The first city read under a NON-CALIFORNIAN floor, and the first where the
// local cap and the state floor share a mechanism: Arizona guarantees
// min(75% of primary, 1,000 sq ft) and Phoenix caps at 75% of primary AND a
// lot-size figure. The ratio is the same 75% in both instruments.
//
// ⚠️ PHOENIX DID ADOPT, so A.R.S. § 9-461.18(F) — which would allow ADUs on all
// residential lots WITHOUT LIMITS against a city that missed the 2025-01-01
// deadline — does not apply here. § 706 was last amended by Ord. G-7317 § 11 in
// 2024, inside the deadline. That was the fork worth resolving before reading
// any figure, because the two regimes are nothing like each other.
const PHOENIX_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Phoenix Zoning Ordinance § 706.A (Accessory Dwelling Units), ch. 7 Development Standards of General Applicability; Ord. No. G-7317 § 11 (2024)',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ A COMPOUND CAP: BOTH constraints bind, so the answer is their MINIMUM
    // and neither half alone is publishable. § 706.A.8 reads "shall not have a
    // gross floor area which exceeds 75 percent of the gross floor area of the
    // primary dwelling unit, AND: a. ... 1,000 square feet. b. ... the lesser of
    // 3,000 square feet or ten percent of the net lot area."
    //
    // Publishing 1,000 (or 3,000) would overstate on every lot whose primary
    // dwelling is small enough for the ratio to bind first — the same failure as
    // publishing 1,000 for the Arizona statute.
    {
      kind: 'not-numeric',
      rule:
        'the LESSER of 75% of the primary dwelling\u2019s gross floor area and a lot-size cap — 1,000 sq ft on a lot up to 10,000 sq ft net area, or on a larger lot the lesser of 3,000 sq ft and 10% of net lot area',
      condition: 'every ADU, attached or detached; both limbs apply together',
      cite: '§ 706.A.8',
      baseline: true,
    },
    // The lot-size limb's own ceilings, recorded because they are real stated
    // figures — but they are UPPER BOUNDS on one limb, never the answer.
    {
      kind: 'capped',
      sqFt: 1000,
      condition: 'upper bound of the lot-size limb, for a lot up to 10,000 sq ft net area — the 75% ratio may bind lower',
      cite: '§ 706.A.8.a',
    },
    {
      kind: 'capped',
      sqFt: 3000,
      condition:
        'upper bound of the lot-size limb on a lot over 10,000 sq ft net area, and only where 10% of net lot area reaches 3,000 sq ft — the 75% ratio may bind lower',
      cite: '§ 706.A.8.b',
    },
  ],
  maxHeightFt: [
    { form: 'figure', value: 15, condition: 'detached, when located within a required rear or side yard — a greater height needs a use permit under § 307', cite: '§ 706.A.4.c(1)', baseline: true },
    { form: 'parity', withUse: 'the primary dwelling unit', condition: 'detached, when NOT located within any required yard — the same height the primary dwelling may reach', cite: '§ 706.A.4.c(2)' },
    { form: 'parity', withUse: 'the primary dwelling unit', condition: 'attached — the same height regulations and setbacks as the primary dwelling unit', cite: '§ 706.A.6' },
  ],
  maxStories: null,
  // ⚠️ NOT set, even though two of the three height cases defer to the primary
  // dwelling. This flag means the ordinance states NO height in feet at all;
  // Phoenix states 15 ft for the required-yard case, so setting it would erase a
  // real figure. The deferral lives on the `parity` entries instead — the form
  // added for exactly this.
  heightDefersToBaseZone: null,
  notes: [
    'Setbacks: minimum 5 ft from a street side property line, 3 ft from an interior side or rear line, none adjacent to a fully dedicated alley; front setbacks per the zoning district (§ 706.A.4.b). All within the 5 ft ceiling A.R.S. § 9-461.18(B)(6) puts on what a municipality may require.',
    'A detached ADU may sit within a required rear or side yard, or within an on-lot perimeter setback that is not also the front yard (§ 706.A.4.a).',
    '⚠️ HOW MANY ADUs IS NOT ANSWERED HERE. § 706.A.1 applies "when a lot ... is permitted one or more ADUs per the underlying zoning district" — the count comes from the district, not from this section. One attached ADU per lot is capped (§ 706.A.2.a), but the total is not stated, so the Arizona floor of one attached plus one detached is the minimum and the local total is unresolved.',
    'A garage, attached shade structure or attached carport built as part of a DETACHED ADU does not count toward the ADU\u2019s gross floor area (§ 706.A.8).',
    'Any ADU must comply with the lot coverage requirements applicable to the property (§ 706.A.7).',
    'A detached ADU may not sit between the primary dwelling and the front property line without a use permit under § 307 (§ 706.A.5).',
    'Design guidelines are marked (P) — an attached ADU must read as part of one single-family home rather than a duplex, and a detached ADU visible from the street should be residential in appearance. The ordinance states expressly that these do NOT require matching exterior design, roof pitch or finishing materials (§ 706.A.3), which is Phoenix implementing A.R.S. § 9-461.18(B)(4).',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'phoenix.municipal.codes Legislative History, "Pending Codification" filter, plus the Zoning Ordinance currency line',
    codifiedThrough: 'Phoenix Zoning Ordinance current through Ordinance G-7461, passed 2025-12-03',
    amendingThisSection: [],
    // ⚠️ THE STRONG FORM, and only the second in the file after Seattle. Phoenix
    // publishes an actual pending-codification list, it was queried, and it
    // returned nothing — which is different from Los Angeles, San Francisco and
    // San Diego, where no list exists to query.
    //
    // And the empty result was CONTROLLED: an unfiltered enactments view returns
    // 25 ordinances through G-7524 (2026-06-17), so the view works and the empty
    // filter is a measurement. Rule 20 — an empty list and a broken query look
    // identical, and on this same site a code search for "zoning" returned zero,
    // which is how the search was caught as unusable.
    note: 'STRONG form: a real "Pending Codification" list exists, was queried, and returned no enactments — verified by a positive control, since the unfiltered view returns 25 ordinances through G-7524 (2026-06-17). None of those 25 amends the Zoning Ordinance or § 706. ⚠️ Scope: the first page of the enactments list was scanned, not every page, and the Zoning Ordinance carries its own currency (G-7461) separate from the City Code.',
  },
}

// ── LAS VEGAS ───────────────────────────────────────────────────────────────
//
// ⚠️ ADOPTED ON THE DAY THE STATE MANDATE TOOK EFFECT. Ord. 6963 §§ 7–8 carry the
// date 07/01/26, which is exactly the effective date of NRS 278.257. The local
// rule exists because the statute does, and reading either alone would miss that.
//
// ⚠️ AND IT IS NOT A SECTION, IT IS A LAND USE. Las Vegas files this as
// "Residential, Accessory Dwelling Unit" — a use description inside LVMC
// 19.12.070 and a definition in 19.18.020, with no ADU-titled section anywhere in
// Title 19. A table-of-contents scan finds 19.12.020 "Accessory Uses and
// Structures", which covers garage sales and parking a car with a For Sale sign
// and has nothing to do with dwellings. The real provision was found only by a
// full-text search, and only because the search had been proved to work first.
const LASVEGAS_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'LVMC 19.12.070 "Residential, Accessory Dwelling Unit" (Permissible Use Descriptions and Applicable Conditions and Requirements), with the definition at LVMC 19.18.020; both added by Ord. 6963 §§ 7–8, effective 2026-07-01',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ THE FOURTH DRAFTING OF THE RATIO FAMILY, and the ratio is 100%: the ADU
    // may equal the primary dwelling but not exceed it. Two limbs again — the
    // district's own development standards AND the parity cap — so the answer is
    // their minimum and no figure is publishable.
    {
      kind: 'not-numeric',
      rule:
        'the LESSER of the zoning district\u2019s own development standards and the total gross floor area of the primary dwelling unit — "in no case shall the unit exceed the total gross floor area of the primary dwelling unit"',
      condition: 'every ADU; both limbs apply together and neither states a square-foot figure',
      cite: 'LVMC 19.12.070, Conditional Use Regulations 1',
      baseline: true,
    },
  ],
  // No height in feet anywhere in the provision — it routes to the district.
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: 'LVMC 19.12.070, Conditional Use Regulations 1 ("subject to the development standards of the zoning district in which it is located")' },
  notes: [
    'No more than ONE Residential, Accessory Dwelling Unit is permitted on a single lot (LVMC 19.12.070, Conditional Use Regulations 1). NRS 278.257(1) requires the city to authorise "an accessory dwelling unit" — singular — and NRS 278.257(4)(b) caps the statute\u2019s own reach at two, so one satisfies the mandate.',
    'The Special Use Permit provisions of LVMC 19.12.040(B) expressly do NOT apply (Conditional Use Regulations 2), so this is a permitted use subject to conditions rather than a discretionary approval.',
    '⚠️ PARKING SITS EXACTLY AT THE STATE CEILING, AND UNCONDITIONALLY. Las Vegas requires "one additional parking space ... beyond the number of spaces normally required". NRS 278.257(2)(b) forbids requiring more than one additional space — but only "provided that the existing parking for the primary residence and street parking satisfy the anticipated parking needs". The state cap carries a proviso the local rule does not repeat. Whether that gap matters is a legal question this tool records rather than resolves.',
    '⚠️ TWO TEXTS, AND THE DEFINITION PREVAILS. LVMC 19.12.070 states expressly that its descriptions are "for convenience of reference only" and that the LVMC 19.18.020 definition "shall prevail in the event of conflict". They differ: the description says "principal dwelling", the definition says "principal SINGLE FAMILY dwelling" and requires "full kitchen facilities". The definition governs, which also aligns with NRS 278.257(6)(c) scoping the statute to property zoned single-family residential.',
    'The ADU may be detached, attached, or built within the primary residence (LVMC 19.18.020).',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'enCodePlus Las Vegas Unified Development Code home page and the section histories',
    // ⚠️ NO "CURRENT THROUGH" LINE IS PUBLISHED. What the site states instead is a
    // LAG, verbatim: "This Code may not reflect the most current legislation
    // adopted by the City of Las Vegas. It can take up to 60 days to update this
    // document following the adoption of legislation."
    //
    // That is a different kind of disclosure from a codified-through date and it
    // must not be dressed up as one. The concrete lower bound comes from the
    // sections themselves: Ord. 6963 (2026-07-01) is present, so the code
    // includes legislation at least that recent — 50 days before this reading,
    // which is inside the window the site warns about.
    codifiedThrough:
      'no codified-through date is published; the site instead warns of up to a 60-day lag. Lower bound established from the text: Ord. 6963 (2026-07-01) is present',
    amendingThisSection: [],
    note: 'WEAK form, and weak in a way none of the others are: enCodePlus publishes no pending-ordinance list AND no codified-through date, only a self-declared lag of up to 60 days. `amendingThisSection: []` here records that no list exists to read. ⚠️ The lag matters more here than anywhere else in this file, because the governing state statute took effect 2026-07-01 and this reading is 50 days later — squarely inside the window in which an amendment could exist and not yet appear.',
  },
}

// ── BOSTON ──────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ THIS ENTRY PREVIOUSLY PUBLISHED A WRONG ANSWER IN THE BLOCKING DIRECTION,
// and the correction is recorded here because the failure was one of method, not
// of care. It said accessory dwelling units were FORBIDDEN throughout East
// Boston. They are allowed. Someone who lives there said so, and they were right.
//
// WHAT WENT WRONG. Boston's zoning code contains TWO different defined terms:
//
//   "Accessory Dwelling Unit"   — appears in only two neighborhood districts,
//                                 and East Boston's tables mark it F in every
//                                 column of all five.
//   "Additional Dwelling Unit"  — the operative instrument, appearing in at
//                                 least ELEVEN neighborhood district articles,
//                                 defined citywide and allowed in East Boston.
//
// A full-text search was run for one phrase, it returned a clean and consistent
// answer, and the absence of that PHRASE was published as the absence of the
// CONCEPT. The search was controlled, the tables were read correctly, and every
// figure quoted was accurate. None of that helped, because the wrong noun was
// searched for.
//
// ⚠️ AND THE OVERRIDE IS THE SAME SHAPE AGAIN. Even having found the right term,
// Table A still marks the use Forbidden — § 53-5.2 is a separate provision that
// reverses the table. Reading the table and stopping is exactly the § 1A error:
// a section read correctly and treated as the whole of the rule. Sixth instance,
// and the only one to reach a published answer that would have told a real owner
// their project was illegal.
const BOSTON_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Boston Zoning Code § 53-5.2 (East Boston Neighborhood District — Additional Dwelling Units), with Article 53 Table A use regulations; Text Amd. No. 472 § 2 (2024-05-01), Text Amd. No. 482 § 6 (2025-07-03)',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ NOT A FIGURE — A GEOMETRIC LIMIT, the same shape as San Francisco
    // § 207.1(c)(5). The exemption in § 53-5.2 is conditioned on the conversion
    // adding NO Gross Floor Area, so the unit must fit inside the structure that
    // already exists. That is frequently tighter than any square-foot cap, and
    // `no-maximum` would read as permission.
    {
      kind: 'not-numeric',
      rule:
        'the Additional Dwelling Unit must fit within the EXISTING envelope of the structure — the exemption requires that it "does not involve any bump out, extension or construction to the existing envelope of the structure which results in the addition of Gross Floor Area"',
      condition: 'East Boston, for the by-right route under § 53-5.2; no square-foot cap is stated anywhere',
      cite: '§ 53-5.2',
      baseline: true,
    },
  ],
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: 'Boston Zoning Code art. 53 Table F (dimensional regulations); § 53-5.2 exempts a qualifying conversion from Code requirements entirely' },
  notes: [
    '⚠️ AN ADU IS ALLOWED IN EAST BOSTON, notwithstanding the use table. § 53-5.2 provides that an Additional Dwelling Unit "shall be an Allowed Use WHERE IT MAY OTHERWISE BE CONDITIONAL OR FORBIDDEN", provided it is the addition of no more than one dwelling unit to the existing structure. The Table A entries marking the use Forbidden are expressly overridden by this section for a qualifying unit.',
    'The by-right route carries four conditions, all from § 53-5.2: no more than ONE dwelling unit added to the existing structure; no bump out, extension or construction to the existing envelope that adds Gross Floor Area; the residential structure is OWNER-OCCUPIED; and it is registered under Ch. 9-1.3 of the City of Boston Rental Registry Ordinance at the time of conversion. Meet them and the unit is "exempt from all requirements of this Code".',
    '⚠️ BOSTON USES TWO DISTINCT DEFINED TERMS AND THEY HAVE OPPOSITE EFFECTS. "Accessory Dwelling Unit" is a separate use that East Boston forbids in every column of Tables A–E. "Additional Dwelling Unit" is the instrument that permits the thing an owner would actually build. A reader — or a search — that takes the first for the second gets the answer exactly backwards.',
    '⚠️ COVERAGE IS FAR WIDER THAN THE "ACCESSORY" TERM SUGGESTS. Additional Dwelling Unit provisions appear in at least ELEVEN neighborhood district articles: 53 East Boston, 55 Jamaica Plain (defined at § 55-45 rather than § 2-1), 56 West Roxbury, 60 Greater Mattapan, 61 Audubon Circle, 62 Charlestown, 65 Dorchester, 66 Fenway, 67 Roslindale, 68 South Boston, 69 Hyde Park. Most cross-reference a citywide definition at Section 2-1.',
    'Greater Mattapan carries BOTH instruments: its accessory use table allows "Accessory Dwelling Unit(s)" in R1, R2, 2F and 3F and forbids them in MFR (art. 60 Table A), while a separate Additional Dwelling Unit provision reaches the 2F, 3F and MFR subdistricts. The MFR "F" therefore does not settle whether an Additional Dwelling Unit is permitted there.',
    'East Boston residential subdistricts: EBR-2.5 allows a maximum of two Dwelling Units and 2.5 stories; EBR-3 three units and three stories; EBR-4 multifamily and four stories (§ 53-4). Dimensional regulations are in Table F.',
    // ⚠️ SCOPE, stated rather than smoothed.
    '⚠️ ONLY EAST BOSTON\u2019S OPERATIVE PROVISION HAS BEEN READ. The other ten districts\u2019 Additional Dwelling Unit sections were located by search and NOT opened, and the citywide Section 2-1 definition they cross-reference has not been read either. Their conditions may differ from § 53-5.2\u2019s. Boston is encoded from one district\u2019s rule and the rest are located sources, not read ones.',
    '⚠️ The interaction with M.G.L. c. 40A § 3 remains unresolved. The statute bars requiring a special permit for one ADU "in a single-family residential zoning district"; Boston\u2019s East Boston subdistricts are EBR-2.5, EBR-3 and EBR-4, none of which is single-family. Whether c. 40A reaches them is statutory construction this tool records and does not answer.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Municode "Redevelopment Authority" (Boston Zoning Code) code page and full-text search',
    codifiedThrough: 'Text Amd. No. 494, effective 2026-01-12 (Update 46; online content updated 2026-03-03)',
    amendingThisSection: [],
    // ⚠️ The lesson recorded here is NOT about pending ordinances. This entry's
    // failure was never a currency problem — the correct text was in the
    // codified version the whole time, under a different name.
    note: 'Municode publishes a codified-through date but no pending-ordinance list, so `amendingThisSection: []` records that no list exists to read. The search was controlled before use ("dwelling" returns 450 results). ⚠️ NOTE WHAT THE CONTROL DID NOT CATCH: it proves the search works, not that the search term is the right one. This entry was wrong for a full commit while every instrument reported healthy — controlled search, correctly read tables, accurate quotations — because the query named the wrong defined term. A working instrument pointed at the wrong noun returns a clean, confident, wrong answer.',
  },
}

// ── DENVER ──────────────────────────────────────────────────────────────────
//
// ⚠️ THE INSTRUMENT FORK, SETTLED FIRST — and the answer is BOTH. Denver runs the
// Denver Zoning Code (2010) and Former Chapter 59 side by side for retained
// properties, which is the fork rule 27 was written about. The Citywide ADUs
// measure amended the DZC, the zoning map AND Former Chapter 59 together, so
// neither code is the whole answer and neither is stale relative to the other.
//
// Passed by City Council 2024-11-18, effective 2024-12-16. It allows ADUs in all
// residential areas — Denver CPD states this took the share of the city's land
// where an ADU is permitted from 36% to 70%.
const DENVER_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Denver Zoning Code § 11.8.2 (Accessory Dwelling Units), Article 11 Use Limitations, as republished 2025-02-25; adopted by the Citywide ADUs text amendment, Denver City Council 2024-11-18, effective 2024-12-16, which also amended Former Chapter 59',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // The § 11.8.2.1.B.2 table, all four rows. The first is the ordinary case —
    // a single-unit dwelling in an SU district on a typical lot.
    {
      kind: 'capped',
      sqFt: 864,
      condition: 'Single Unit Dwelling use in an SU zone district, attached or detached, on a zone lot of 7,000 sq ft or less',
      cite: '§ 11.8.2.1.B.2',
      measure: 'Gross Floor Area (DZC § 11.8.2.1.B.2 table heading, \u201cMAXIMUM GFA OF ADU USE\u201d)',
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 1000,
      condition: 'the same, on a zone lot GREATER than 7,000 sq ft',
      cite: '§ 11.8.2.1.B.2',
      measure: 'Gross Floor Area (DZC § 11.8.2.1.B.2 table heading, \u201cMAXIMUM GFA OF ADU USE\u201d)',
    },
    // ⚠️ THE RATIO AGAIN — SIXTH DRAFTING, AND THE OPERATOR IS FLIPPED BACK.
    // Denver uses the SAME 75% as Arizona and Phoenix and joins it to a figure
    // with "whichever is GREATER", where Arizona says "whichever is LESS". The
    // effect is opposite: Arizona's caps a small primary's ADU below 1,000,
    // Denver's guarantees 864 however small the primary. No single number is
    // publishable, because above a 1,152 sq ft primary the ratio governs.
    {
      kind: 'not-numeric',
      rule:
        '75% of the primary use\u2019s Gross Floor Area OR 864 sq ft, WHICHEVER IS GREATER — so 864 sq ft is guaranteed regardless of the primary\u2019s size, and above a primary of about 1,152 sq ft the ratio governs instead',
      condition: 'Single Unit Dwelling use in any zone district EXCEPT an SU district, ATTACHED ADU',
      cite: '§ 11.8.2.1.B.2',
    },
    // ⚠️ AN AFFIRMATIVE "NOT APPLICABLE" IN THE TABLE'S OWN MAX-GFA COLUMN — the
    // code states no maximum for this configuration rather than omitting one.
    {
      kind: 'no-maximum',
      condition:
        'Single Unit, Two Unit or Multi-Unit Dwelling use in any zone district EXCEPT an SU district, DETACHED ADU — the table prints "Not applicable" in the maximum-GFA column',
      cite: '§ 11.8.2.1.B.2',
    },
  ],
  // § 11.8.2 states no height. Height comes from the accessory building form
  // standards in the neighborhood-context articles (3–9), which vary by context.
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: 'DZC Articles 3–9, accessory building form standards for the applicable neighborhood context; § 11.8.2 states no height of its own' },
  notes: [
    'ONE ADU per Primary Dwelling Unit containing a Single Unit, Two Unit or Multi-Unit Dwelling use on a zone lot (§ 11.8.2.1.A.1).',
    '⚠️ An ADU accessory to a TWO-UNIT or MULTI-UNIT primary must be in a DETACHED accessory structure and may NOT be inside the primary structure — and the primary must take a Duplex, Row House or Town House building form (§ 11.8.2.1.A.2).',
    'Where § 11.8.2.1 conflicts with the general accessory-use conditions in Division 11.7, § 11.8.2.1 governs (§ 11.8.2.1.A.3). Division 11.7 says the same from its side: ADUs follow § 11.8.2 instead of the general limitations (§ 11.7.1.2.A).',
    'Mobile homes, recreational vehicles and trailers may not be used as ADUs (§ 11.8.2.1.B.1).',
    'An ADU may have a Partial Kitchen or a Full Kitchen but only one kitchen, and a Partial Kitchen may later be converted to a Full Kitchen (§ 11.8.2.1.C.3).',
    'No separate driveway from the one serving the primary use, except to take new access from an Alley (§ 11.8.2.1.C.1). A separate outside stairway is allowed but not on a street-facing façade (§ 11.8.2.1.C.2).',
    // ⚠️ The state-law-driven change, and the reason it changed.
    '⚠️ OWNER OCCUPANCY IS NOW ONLY AT PERMIT APPLICATION, and only in SU districts. § 11.8.2.2.B requires that at least one owner occupy the existing primary dwelling as their primary residence AT THE TIME the ADU permit application is submitted — not thereafter. Denver CPD states this change was made to comply with HB24-1152, which limits when a jurisdiction may impose an owner-occupancy requirement; previously an ADU could not be used if the owner moved off the property. Not required where the ADU is built simultaneously with a new primary structure (B.2.b), and Denver Housing Authority properties are exempt (B.1). "Primary residence" requires two of: motor vehicle registration, driver\u2019s license, Colorado ID, voter registration, tax documents, utility bill (B.2.c).',
    '⚠️ PUD PROHIBITIONS ARE NULLIFIED. A PUD District Plan that permits single-unit dwellings "shall be deemed to allow" an ADU, and the Zoning Administrator "shall not apply" an ADU prohibition in such a plan (§ 11.8.2.3.A). Standards then follow the zone district the PUD is based on, or — if it is based on none — the SU-district ADU standards for the same Blueprint Denver future neighborhood context (§ 11.8.2.3.B).',
    'ADUs may be established on an existing Carriage Lot even with no primary use on that lot, subject to § 12.10.4 (Development on Carriage Lots), which governs on conflict (§ 11.8.2.1.D).',
    '⚠️ Sixteen DZC zone districts were DELETED by the same measure — the "-1 districts" existed solely to permit ADUs and became redundant once ADUs were allowed everywhere. Affected properties were rezoned to the corresponding non-1 district with no change to any other requirement (Denver CPD, Citywide ADUs summary).',
    '⚠️ AND ONE OF THEM IS STILL LIVE IN THE MAP LAYER. Denver\u2019s zoning service returns ONE parcel coded U-SU-B1, captured 2026-08-19 — twenty months after the district was deleted from the code and its properties rezoned. So the code and the map disagree by one parcel. The repo\u2019s curated Denver table carries no "-1" district, so the Denver resolver falls through to its pattern derivation for that code and returns the same 2.5 storeys and 30 ft as U-SU-B, flagged `heightBasis: derived-estimate`. That is substantively right — Denver states the "-1 districts" were IDENTICAL to their non-1 counterparts but for the ADU allowance — though it is right by derivation rather than by knowing the mapping.',
    '⚠️ For ADU purposes the mismatch is INERT, and that is the point worth keeping. The only thing the "-1" suffix ever signified was permission to build an ADU, and ADUs are now allowed in all residential areas — so a parcel still carrying the deleted code gets the same ADU answer either way. A stale district code is not automatically a stale answer; whether it matters depends on what the code was carrying.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'denvergov.org Community Planning and Development — Denver Zoning Code page and the Citywide ADUs text amendment page',
    codifiedThrough: 'DZC Article 11 as republished 2025-02-25 (base code June 25, 2010), carrying the Citywide ADUs amendment effective 2024-12-16',
    amendingThisSection: [],
    note: 'Denver publishes text amendments as a browsable list rather than a pending-codification queue, and the article PDF carries its own republication date. `amendingThisSection: []` records that no pending list exists to read in the Municode sense. ⚠️ Two later bundles are published and were NOT opened — a 2024 Text Amendment Bundle (2025-03-24) and a 2025 Text Amendment Mini Bundle (2026-04-20) — so whether either touches § 11.8.2 is unestablished. The Article 11 PDF republished 2025-02-25 predates both.',
  },
}

// ── MIAMI ───────────────────────────────────────────────────────────────────
//
// ⚠️ MIAMI SAYS "ANCILLARY", NOT "ACCESSORY" — and the vocabulary check is what
// found it. Miami 21 § 3.18 is titled "ANCILLARY DWELLING UNIT (ADU) STANDARDS".
// The noun differs from every other city in this file while the abbreviation is
// identical, so a term-based search can miss the section and still look healthy.
// This is the check the East Boston failure forced, working as intended: run it
// before reading, not after publishing.
//
// ⚠️ AND THREE SOURCES OFFER THIS CODE, TWO OF THEM STALE.
//   • Municode carries "Miami 21 (Zoning Code)" — frozen at 2011-05-29, fifteen
//     years old, while its Code of Ordinances is current to 2026-05-26.
//   • miami21.org says of itself that it is "for educational and historical
//     purposes only".
//   • The current codification is Gridics CodeHub, and ONLY the City's own
//     Planning page names it.
// Reading Municode's copy would have missed the 2025-10-01 amendment that
// rewrote this very section.
const MIAMI_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Miami 21 § 3.18 (Ancillary Dwelling Unit (ADU) Standards) with Article 6 Table 13 (unit sizes) and Article 1 (Definitions); as amended by Ord. 14375, 2025-10-01, read from the Gridics CodeHub codification the City of Miami designates as current',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ THE SEVENTH RATIO DRAFTING, AND THE DENOMINATOR CHANGES. Every earlier
    // one was a percentage of the PRIMARY DWELLING's floor area — SF 50%, AZ and
    // Phoenix and Denver 75%, Las Vegas 100%, MA 50%. Miami's is a percentage of
    // the LOT. Both limbs bind, so the answer is their minimum, and no single
    // figure is publishable without the lot area.
    {
      kind: 'not-numeric',
      rule:
        'the LESSER of ten percent of the Lot Area and 800 sq ft — ⚠️ a percentage of the LOT, not of the principal dwelling, which is unlike every other city read here',
      condition: 'maximum size, ADU DETACHED from the Principal Building',
      cite: 'Article 6, Table 13',
      baseline: true,
    },
    {
      kind: 'not-numeric',
      rule: 'the LESSER of ten percent of the Lot Area and 500 sq ft',
      condition: 'maximum size, ADU WITHIN or ATTACHED to the Principal Building',
      cite: 'Article 6, Table 13',
    },
  ],
  // ⚠️ Height is stated in STORIES and is NOT converted (rule 12 — the Miami
  // module already carries the scar of an 80-storey district published as 87).
  maxHeightFt: [],
  maxStories: { value: 2, condition: 'Ancillary Buildings generally; ONE storey in T3-R, and in no case taller than the Principal Building', cite: '§ 3.18, Height' },
  heightDefersToBaseZone: null,
  notes: [
    '⚠️ MIAMI STATES MINIMUM UNIT SIZES, which no other city read here does. Article 6 Table 13: an Efficiency Unit at least 275 sq ft, a one-bedroom at least 450 sq ft, a two-bedroom at least 550 sq ft. These are floors on the unit itself, not floors on what the city must allow — a different kind of number from a state-law floor and not comparable to one.',
    '⚠️ THE SIZE FIGURES ARE NOT IN § 3.18. That section says only "Unit Sizes: See Article 6 ... Table 13". Reading the operative section alone and concluding no size is stated would have been wrong — the seventh instance in this work of a section read correctly not being the whole rule, and here the code itself points onward.',
    'An ADU is permitted only on Lots containing a Single-Family Residence, in the Transect Zones Article 4 Table 3 allows (§ 3.18, Allowable Locations).',
    '⚠️ RENTAL IS CONDITIONED ON HOMESTEAD STATUS. "An ADU may only be rented if the property has current proof of Homestead status", and ADUs are subject to registration and annual renewal under the City Code (§ 3.18, Ownership and Use). The Single-Family Residence and the ADU must be under the same ownership.',
    '⚠️ THE KITCHEN CRITERION AGAIN, and here it is constitutive rather than exclusionary: a set of spaces "shall be deemed an ADU" when a sleeping/living area, a shower/bathroom AND a kitchen with sink, food-preparation countertop and refrigerator are all provided separately from the principal unit (§ 3.18). LA and San Diego use the absence of a kitchen to exclude a use; Miami uses its presence to define one.',
    'Placement: the ADU sits within the Principal Building or in an Ancillary Building. A one-storey Ancillary Building may be attached or detached and follows Ancillary Building setbacks; a two-storey detached one must stand at least ten feet from the Principal Building, while a two-storey attached one follows Principal Building setbacks (§ 3.18, Placement).',
    'The ADU requires a separate entrance, which shall not face the street; a Principal Building containing an ADU must read visually as one single-family residence; an Ancillary Building elevation abutting another property may have only clerestory windows no more than 24 inches high on the second storey (§ 3.18, Entrances and Elevations).',
    '⚠️ "Ten percent of the Lot Area" does not say whether Lot Area is net or gross, and Article 1\u2019s definition of Lot Area was NOT read. That denominator decides the cap on every parcel, so it is carried as the code states it and no reading is assumed — the Atlanta SPI-20 shape (rule 5\u2019s third outcome).',
    '⚠️ Parking is set by Article 4 Table 4, which was not read. § 3.18 only adds relief where an existing Principal Building blocks the required space: it may then go in the First Layer, is exempt from driveway separation and from First Layer pervious/impervious requirements, and must use parking strips no wider than two feet.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Gridics CodeHub codification of Miami 21, and its own Amendments to Miami 21 table',
    codifiedThrough:
      'Ord. 14375 (2025-10-01), which updated ADU definitions, design standards, allowable zones, parking and unit sizes; the amendment table also lists Ord. 14420 (2025-11-20)',
    amendingThisSection: [],
    // ⚠️ The instrument here is an amendment TABLE inside the code, which is a
    // different and better thing than either a pending queue or nothing.
    note: 'Miami 21 carries its own "Amendments to Miami 21" table, which was read: Ord. 14375 (2025-10-01) is the amendment that rewrote this section, and it is present in the text used. `amendingThisSection: []` records that nothing LATER in that table names ADUs. ⚠️ THE SOURCE CHOICE IS THE RISK HERE, NOT THE PENDING LIST: Municode publishes a Miami 21 frozen at 2011-05-29 and miami21.org describes itself as historical only. Either would have looked like a normal read and returned a code predating the 2025 ADU amendment entirely.',
  },
}

// ── AUSTIN ──────────────────────────────────────────────────────────────────
//
// ⚠️ AUSTIN SAYS "SECONDARY APARTMENT", and does not use the ADU abbreviation at
// all. The vocabulary check found it: "accessory dwelling unit" returns eight
// hits, EVERY ONE inside Chapter 25-3 (Traditional Neighborhood District), a
// niche chapter — while the operative instrument is §§ 25-2-1461 to 25-2-1463 in
// Chapter 25-2, the main zoning chapter, under a different noun. Reading the
// eight hits and stopping would have produced a rule that governs almost no
// Austin parcel. Third city in a row whose noun differs (Boston "Additional",
// Miami "Ancillary", Austin "Secondary").
//
// Source designated by the city: Austin's own City and Land Development Code
// page links to Municode, so here the standing publisher check confirms the
// obvious source rather than overturning it — unlike Miami, where it mattered.
//
// ⚠️ CORRECTED 2026-08-20, AND THE CORRECTION IS THE SCOPE. A first pass encoded
// the Secondary Apartment article as Austin's ADU answer. It is not: the article
// sits inside SUBCHAPTER D, whose own § 25-2-1401 provides that the subchapter
// "applies to property that is (1) located in a neighborhood plan (NP) combining
// district". So the rule reaches NP-district property only, not the city.
//
// Reading §§ 25-2-1461 to 1463 correctly and stopping produced a citywide claim
// from a district-scoped rule — the eighth instance here of an operative section
// read accurately and treated as the whole of it, and this time the qualifying
// provision sat sixty sections earlier in the same subchapter.
//
// ⚠️ AND AUSTIN HAS A SECOND, BROADER INSTRUMENT. Its old citywide mechanism,
// § 25-2-774 "Two-Family Residential Use", is REPEALED and the section now reads
// RESERVED. What replaced it is § 25-2-773, "Duplex, Two-Unit, and Three-Unit
// Residential Uses" (Ord. No. 20231102-028), which states that it "supersedes
// the base zoning district regulations" to the extent of conflict. Austin's
// citywide answer to "may I add a unit" is therefore a UNIT-COUNT rule, not an
// accessory-dwelling rule — a different shape from every other city in this file.
const AUSTIN_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Austin City Code §§ 25-2-1461 to 25-2-1463 (Secondary Apartment Special Use) within Subchapter D (Neighborhood Plan Combining Districts), scoped by § 25-2-1401 and defined at § 25-2-1403(B)(6); as amended by Ord. No. 20250227-039 Pt. 3, effective 2025-10-01. ⚠️ The citywide unit-count instrument is § 25-2-773, recorded but not read in full',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ EIGHTH RATIO DRAFTING, AND THE FIRST EXPRESSED AS A FAR. § 25-2-1463(C)(5)(a):
    // "may not exceed 1,100 total square feet or a floor-to-area ratio of 0.15,
    // whichever is SMALLER." Structurally Miami's shape — a LOT-based ratio capped
    // by a figure — but written as a floor-area ratio rather than a percentage.
    // FAR 0.15 binds below 1,100 sq ft on any lot under about 7,333 sq ft, which
    // is a great many Austin lots, so publishing 1,100 would overstate widely.
    {
      kind: 'not-numeric',
      rule:
        'the SMALLER of 1,100 total sq ft and a floor-to-area ratio of 0.15 — the FAR is against LOT area, so it binds below 1,100 sq ft on any lot under roughly 7,333 sq ft',
      condition: '⚠️ total size of the secondary apartment — and ONLY on property in a neighborhood plan (NP) combining district, per § 25-2-1401. This is not a citywide cap',
      cite: '§ 25-2-1463(C)(5)(a)',
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 550,
      condition: 'the SECOND STORY only, if any — a separate cap that applies on top of the total',
      cite: '§ 25-2-1463(C)(5)(b)',
    },
  ],
  // ⚠️ Austin states BOTH a height in feet and a storey count, which is unusual —
  // most cities in this file state one or the other. Both are carried and nothing
  // is converted (rule 12).
  maxHeightFt: [
    { form: 'figure', value: 30, condition: 'maximum height of a secondary apartment; it is separately limited to two storeys', cite: '§ 25-2-1463(C)(4)', baseline: true },
  ],
  maxStories: { value: 2, condition: 'stated alongside the 30 ft limit, not derived from it', cite: '§ 25-2-1463(C)(4)' },
  heightDefersToBaseZone: null,
  notes: [
    '⚠️ DETACHED ONLY. A secondary apartment "must be located in a structure other than the principal structure" (§ 25-2-1463(B), repeated at (C)(1)) — so unlike most cities read here, Austin permits no attached or interior ADU under this article.',
    'Placement: at least 10 feet to the rear or side of the principal structure, or above a detached garage; it may be connected to the principal structure by a covered walkway (§ 25-2-1463(C)(2)–(3)).',
    '⚠️ SCOPE: NP COMBINING DISTRICTS ONLY. § 25-2-1401 provides that Subchapter D "applies to property that is (1) located in a neighborhood plan (NP) combining district; and (2) used or developed as a special use described in Section 25-2-1403". The district list in § 25-2-1462 operates INSIDE that limit, not instead of it — a parcel must satisfy both. A first pass here read the article without the subchapter\u2019s applicability section and stated the rule citywide.',
    'Within that scope, permitted in SF-1, SF-2, SF-3, SF-5, SF-6, MF-1 through MF-6, and the MU combining district (§ 25-2-1462). ⚠️ SF-4 is absent from that list, which is the section\u2019s own enumeration and not an omission inferred here.',
    '⚠️ AUSTIN\u2019S CITYWIDE INSTRUMENT IS A UNIT-COUNT RULE, NOT AN ADU RULE. § 25-2-774 "Two-Family Residential Use" is REPEALED and now reads RESERVED; § 25-2-773 "Duplex, Two-Unit, and Three-Unit Residential Uses" (Ord. No. 20231102-028) replaced it and "supersedes the base zoning district regulations" to the extent of conflict. It sets a minimum lot area of 5,750 sq ft, a 15 ft front setback, one street-facing entrance, 40% maximum building coverage and 45% maximum impervious cover. So the citywide answer to "may I add a unit in Austin" runs through unit counts rather than through an accessory-dwelling framework.',
    '⚠️ § 25-2-773 IS RECORDED, NOT READ IN FULL. Subsection (C) design standards were not read, and whether the two- and three-unit uses are permitted BY RIGHT in each base district was not established. It is named here because omitting it would leave the NP-only Secondary Apartment rule looking like Austin\u2019s whole answer, which is the error this note corrects.',
    'Site-wide limits accompany the unit: impervious cover may not exceed 45 percent and building cover 40 percent (§ 25-2-1463(D)–(E)). These bind the whole site, not the apartment, so they can constrain an otherwise-compliant unit.',
    'Not permitted in combination with a cottage or urban home special use (§ 25-2-1463(A)).',
    '⚠️ "SPECIAL USE" RESOLVED: it is a defined USE CATEGORY, not a discretionary approval track. § 25-2-1403(B)(6) defines the SECONDARY APARTMENT special use as "the use of a developed single-family residential lot for a second dwelling", one of seven special uses the subchapter establishes, and § 25-2-1462 says such a use "is permitted" in the listed districts. § 25-2-1402 adds that these regulations supersede other Title 25 provisions on conflict and disapply §§ 25-2-514, 25-2-775 and 25-2-776. Nothing read imposes a hearing or discretionary finding — though the permitting route itself was not traced, so this resolves the category question and not the procedure end to end.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Municode Austin Code of Ordinances — the publication Austin\u2019s own City and Land Development Code page designates',
    codifiedThrough: 'Supplement 173, codified through Ordinance No. 20260226-050, online content updated 2026-04-23',
    amendingThisSection: [],
    note: 'Municode publishes a codified-through date and supplement number but no pending-ordinance list, so `amendingThisSection: []` records that no list exists to read. The section\u2019s own source line ends at Ord. No. 20250227-039 (effective 2025-10-01), which is inside the codified-through window, so the text read is current as published.',
  },
}

// ── CHARLOTTE ───────────────────────────────────────────────────────────────
//
// ⚠️ THE PUBLISHER IS NOT MUNICODE. Charlotte's own page designates
// charlotteudo.org, which the City operates. Municode's Chapter 24 contains NO
// UDO text at all — only editor's notes pointing at read.charlotteudo.org, a host
// that returns NXDOMAIN. A reader who went to Municode by habit would find a
// chapter that looks like the right place and is empty.
const CHARLOTTE_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Charlotte Unified Development Ordinance § 15.6.F ("Dwelling – Accessory Unit (ADU)") with the § 15.3 use definition and § 17.1 accessory-structure regulations; UDO adopted 2022-08-22, effective 2023-06-01, as amended 2026-03-23',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ THE CAP REACHES ONLY AN ADU IN AN ACCESSORY STRUCTURE, and that is an
    // ANSWER rather than a gap. § 15.6.F is a six-item list; item 6 is expressly
    // conditioned "An ADU located within an accessory structure", and items 1–5
    // say nothing about size. The legacy ordinance's § 12.407 is the SAME list in
    // the same order and its item (5) is precisely the interior-ADU size cap. The
    // UDO reproduced the list and dropped that item — the slot existed in the
    // predecessor and is empty in the successor.
    {
      kind: 'not-numeric',
      rule:
        'the GREATER of 600 heated sq ft and 70% of the total floor area of the principal residential use — so 600 sq ft is a FLOOR that a small principal dwelling cannot reduce — subject to an absolute ceiling of 1,000 heated sq ft',
      condition: 'an ADU located within an ACCESSORY STRUCTURE. No size limit is stated for an ADU inside the principal dwelling',
      cite: '§ 15.6.F.6.a',
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 1000,
      condition: 'absolute ceiling overriding the greater-of comparison — "in no case shall the ADU exceed 1,000 heated square feet"',
      cite: '§ 15.6.F.6.a',
      measure: 'heated square feet (UDO usage); ⚠️ the OTHER side of the same comparison is "total floor area", which the UDO does NOT qualify — § 2.3 defines only Gross Floor Area, so the two limbs are not established to be the same measure',
    },
  ],
  // ⚠️ NO ADU HEIGHT RULE EXISTS, established by the slot test in three places:
  // § 15.6.F has no height item; § 17.1 — which § 15.6.F.6.b expressly
  // incorporates — states no accessory-structure height cap; and the legacy
  // ordinance DID state one (§ 12.407(6)(b), "no taller than the principal
  // dwelling"), which the UDO dropped.
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: 'UDO § 17.1 (accessory structure regulations), incorporated by § 15.6.F.6.b; height appears there only as a setback trigger, never as a cap' },
  notes: [
    'Only one ADU is permitted on the lot (§ 15.6.F.3). Permitted with a single-family dwelling in any district allowing one (§ 15.4.HH), and with a duplex where neither unit is on a sublot (§ 15.4.EE).',
    '⚠️ THE KITCHEN IS CONSTITUTIVE, as in LA, San Diego and Miami. The § 15.3 definition: an ADU "shall include separate cooking and sanitary facilities and is a complete, separate dwelling unit", and is not permitted in manufactured homes, recreational vehicles, travel trailers or campers. The separating criterion lives in the DEFINITION, not in § 15.6.F.',
    'The ADU is carved OUT of the accessory-structure area budget: § 17.1.F caps cumulative accessory-structure floor area at the heated first-floor area of the principal structure "excluding accessory dwelling units (ADUs)", so building an ADU does not consume the shed/garage allowance.',
    'Article 15 is genuinely citywide — § 15.1.A imposes no neighbourhood-plan or sub-area gate, and § 1.4.A extends the ordinance to the city plus its ETJ. Checked in the direction the Austin failure runs: enclosing container first.',
    // ⚠️ A SECOND LIVE INSTRUMENT THAT POINTS THE OTHER WAY.
    '⚠️ THE LEGACY 1992 ZONING ORDINANCE STILL GOVERNS SOME PARCELS, AND ITS ADU RULE IS THE REVERSE OF THE UDO\u2019S. § 1.4.C preserves the prior development ordinances for conditional, optional and EX zoning districts approved before the UDO\u2019s 2023-06-01 effective date. Legacy § 12.407 caps an INTERIOR ADU at "35% of the total floor area of the principal structure ... in no case ... exceed 800 heated square feet" and requires an accessory-structure ADU to be "no taller than the principal dwelling" — a size cap where the UDO has none, and a height cap where the UDO has none. Which instrument applies is a per-parcel question turning on district type and vesting, and is not resolved here.',
    '⚠️ The RIO overlay\u2019s building-size limits do NOT reach an ADU: § 14.5.C.1.d is limited by its own words to "All principal residential buildings", and an accessory structure containing an ADU is not one.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'charlotteudo.org — the City-operated publication its own Planning page designates — including its /versions and /text-amendments listings',
    codifiedThrough: 'UDO as amended 2026-03-23 (petition #2025-118, "Fall 2025 UDO Maintenance Text Amendment"); the PDF read carries "Amended March 23, 2026" and embedded ModDate 2026-03-24',
    amendingThisSection: [],
    // ⚠️ STRONG FORM, and unusually so: a real amendment list was read AND the
    // figures were compared across two independently produced renderings of the
    // same instrument (the consolidated PDF and the HTML article pages), which is
    // an external check rather than a re-read of one file.
    note: 'STRONG form: charlotteudo.org publishes a text-amendment list which was read, and nothing pending touches § 15.6.F. The PDF was verified byte-identical against Content-Length (26,356,549) and its ADU text compared word-for-word with the separate HTML rendering. ⚠️ Municode carries Chapter 24 with NO UDO text — only editor\u2019s notes pointing at read.charlotteudo.org, which returns NXDOMAIN — so the obvious publisher is not merely stale here but empty.',
  },
}

// ── DALLAS ──────────────────────────────────────────────────────────────────
//
// ⚠️ DALLAS HAS NO BY-RIGHT ADU ROUTE AT ALL, and that is the finding. Both
// available routes require a discretionary act by someone other than the owner:
// a petition-created mapped overlay, or a Board of Adjustment special exception.
// Every other city read in this file permits an ADU by right somewhere.
const DALLAS_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Dallas City Code § 51A-4.510 (Accessory Dwelling Unit Overlay, Ord. 30931) and § 51A-4.209(b)(6)(E) (single-family use regulations / Board of Adjustment special exception), with the parallel former-code provisions at § 51-4.201(b)(1)(E)',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ TENTH RATIO DRAFTING. "The greater of 700 square feet or 25 percent" —
    // the ratio points UP, acting as a floor beneath 700 sq ft on a small house
    // and a ceiling above it on a large one. And the two clauses take DIFFERENT
    // referents as printed: "the main structure" for detached, "the main use" for
    // attached. Recorded as drafted and not reconciled.
    {
      kind: 'not-numeric',
      rule:
        'the GREATER of 700 sq ft and 25 percent of the main structure (detached) or of the main use (attached) — ⚠️ the code prints two different referents for the two cases and this tool does not reconcile them',
      condition: 'ROUTE A only — a lot inside an adopted Accessory Dwelling Unit Overlay. Minimum floor area is 200 sq ft, stated for the detached case only',
      cite: '§ 51A-4.510(c)(2)(C)',
      baseline: true,
    },
    // ⚠️ ROUTE B STATES NO ADU SIZE AT ALL — a gap in the ADU provisions, not a
    // permission. What binds instead is the general accessory-structure cap,
    // which is a different instrument measuring a different thing.
    {
      kind: 'not-found',
      condition:
        'ROUTE B — a Board of Adjustment special exception outside any overlay. Neither § 51A-4.209(b)(6)(E)(i)–(iii) nor § 51-4.201(b)(1)(E)(i)–(ii) states any floor-area figure for an additional or accessory dwelling unit. Where the unit sits in an accessory structure the general cap applies instead: 25% of the floor area of the main building for any individual accessory structure, 50% for all of them together (§ 51A-4.209(b)(6)(E)(vii)(dd)–(ee))',
    },
  ],
  maxHeightFt: [],
  // ⚠️ Route A states a storey count and a RELATIONAL height, in no unit at all.
  // Nothing is converted; the only figure in feet nearby (15 ft) is a setback
  // trigger, not a height cap.
  maxStories: { value: 1, condition: 'ROUTE A: "Maximum number of stories for an accessory dwelling unit is one"', cite: '§ 51A-4.510(c)(2)(G)' },
  heightDefersToBaseZone: { cite: '§ 51A-4.510(c)(2)(D) — height "cannot exceed the height of the main dwelling unit", except above a detached garage where it is the maximum the zoning overlay allows; Route B likewise pegs it to the main building at § 51A-4.209(b)(6)(E)(vii)(cc)' },
  notes: [
    '⚠️ NEITHER ROUTE IS BY RIGHT. Route A requires an Accessory Dwelling Unit Overlay to have been created over the property by petition and adopted by City Council; Route B requires a Board of Adjustment special exception. This is the only city read here with no by-right path, and it is the difference between an entitlement and a discretionary approval.',
    '⚠️ WHETHER ANY ADU OVERLAY IS ACTUALLY MAPPED IS UNESTABLISHED. The overlay exists in the text; whether Council has adopted one anywhere was not determined, and the zoning map was not read. If none is mapped, Route A is available to nobody and the practical answer for every Dallas parcel is Route B.',
    '⚠️ TWO DEFINED TERMS SEPARATED BY RENTABILITY, in adjacent subparagraphs of the same section. § 51A-4.510(a)(1) defines an ACCESSORY dwelling unit as "a rentable additional dwelling unit, subordinate to the main unit"; § 51A-4.209(b)(6)(E)(i) lets the Board authorise an ADDITIONAL dwelling unit only where it will not "be used as rental accommodations". Same physical building, opposite rental status — the Boston hazard with a different separator.',
    '⚠️ The ADU term is defined ONLY inside § 51A-4.510(a)(1). The string does not appear in § 51A-2.102, the code\u2019s general Definitions section — so a reader who checks the definitions chapter first finds nothing and could conclude Dallas has no ADU concept.',
    '⚠️ NO PER-LOT ADU COUNT IS STATED in either route. The baseline single-family definition is "One dwelling unit located on a lot" (§ 51A-4.209(b)(6)(A)), and both routes authorise a second — but neither says how many. Recorded as a genuine absence rather than assumed to be one.',
    'Where § 51A-4.510 conflicts with the single-family use regulations, § 51A-4.510(c)(1)(E) provides that § 51A-4.510 controls — which matters because Route A\u2019s "greater of" allowance can exceed Route B\u2019s flat 25% accessory-structure cap on a small house.',
    'Dallas runs two codes split by rezoning/annexation date (Chapter 51A from 1987, Chapter 51 before it, per § 51A-1.102(a) / § 51-1.102(a)). Both carry the same ADU provisions and Chapter 51\u2019s overlay section incorporates Chapter 51A\u2019s by reference, so the ADU rules do not differ between them.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'American Legal Publishing (codelibrary.amlegal.com/codes/dallas) — the publisher Dallas City Hall\u2019s City Codes page designates for Volumes 1–3',
    codifiedThrough: 'Volume III (containing chs. 51 and 51A): 1/26 Supplement, current through Ordinance 33288, passed 2025-12-10. § 51A-4.510 carries (Ord. 30931) and shows no later amendment',
    amendingThisSection: [],
    note: 'American Legal publishes volume-level currency statements but no pending-ordinance list, so `amendingThisSection: []` records that no list exists to read. ⚠️ The city attaches its own disclaimer to this publisher: the code on the American Legal site "may not reflect the most current legislation adopted by the City of Dallas" and "The official printed copy of a Code of Ordinances should be consulted prior to any action being taken" — a publisher-currency warning from the city about the publisher the city designates.',
  },
}

// ── NASHVILLE ───────────────────────────────────────────────────────────────
//
// ⚠️ TWO DEFINED USES, AND THE ATTACHED ONE IS THE RESTRICTIVE ONE. Nashville
// separates "detached accessory dwelling unit" (DADU) from "accessory apartment"
// at § 17.04.060.B, and they carry different rules — the attached unit is capped
// by ratio AND limited to family-member occupancy, the detached one is capped by
// lot size and is not.
const NASHVILLE_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Metro Nashville Code § 17.16.030.G (detached accessory dwelling unit) and § 17.16.250.A (accessory apartment), with the § 17.04.060.B definitions; Title 17 Zoning Code, Supp. No. 53',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ THE NINTH OPERATOR, AND THE FIRST CONJUNCTIVE ONE. Every other city in
    // this file joins its two limbs with "whichever is greater" or "whichever is
    // less". Nashville uses "and": both limbs bind simultaneously, so the answer
    // is the minimum of a lot-keyed figure and the principal structure's size.
    {
      kind: 'not-numeric',
      rule:
        'BOTH limbs bind — the code joins them with "and", not "whichever is greater/less": 700 sq ft on a lot under 10,000 sq ft, or 850 sq ft on a lot of 10,000 sq ft or more, AND in no case exceeding the size of the principal structure',
      condition: 'DETACHED accessory dwelling unit (DADU)',
      cite: '§ 17.16.030.G.7.a (as published — see the renumbering note)',
      baseline: true,
    },
    {
      kind: 'not-numeric',
      rule: 'twenty-five percent of the gross floor area, excluding garage and utility space',
      condition: 'ACCESSORY APARTMENT — the attached/internal unit, a different defined use from the DADU',
      cite: '§ 17.16.250.A',
    },
  ],
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: '§ 17.16.030.G.7.b — the DADU "shall maintain a proportional mass, size, and height to ensure it is not taller and/or larger than the principal structure on the lot"' },
  notes: [
    '⚠️ THE SIZE UNIT IS "LIVING SPACE", WHICH THE CODE NEVER DEFINES. The phrase appears exactly once in the whole of Title 17 — in this very provision — and § 17.04.060 carries no definition of it. Metro Codes\u2019 own guidance page glosses it as "footprint", which the code text does not say. That gloss is not adopted here: a guidance page is not the ordinance, and footprint and floor area differ on any multi-storey unit.',
    '⚠️ THE DADU IS NOT AVAILABLE COUNTYWIDE, and this is the applicability answer. Title 17 as a whole reaches all land in the Metropolitan Government\u2019s jurisdiction "exclusive of incorporated municipalities" (§ 17.04.020.A) — so both the Urban Services District and the General Services District. But § 17.16.030.G.11 permits a DADU "only ... within the Urban Services District, within a Detached Accessory Dwelling Unit overlay district within the General Services District outside of the Urban Services District, or as otherwise permitted through a Specific Plan". ⚠️ The § 17.04.060 DEFINITION adds an urban-design-overlay path that the operative clause omits — the two do not match, and this tool does not reconcile them.',
    'One DADU per lot: "No more than one detached accessory dwelling unit shall be permitted on a single lot in conjunction with the principal structure", and it "cannot be divided from the property ownership of the principal dwelling" (§ 17.16.030.G.3).',
    '⚠️ The ACCESSORY APARTMENT carries an occupancy restriction the DADU does not — it is limited to family-member occupancy (§ 17.16.250.A). Two units that look alike physically are governed by different rules depending on attachment, and the occupancy limit is the sharper difference.',
    'When a DADU is present, no OTHER accessory structure on the lot may exceed 200 sq ft (§ 17.16.030.G.1.b). DADUs are expressly carved out of the general accessory-structure building-coverage control at § 17.12.050.A, which directs the reader to § 17.16.030.G instead.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Municode Code of Ordinances Title 17 (the publication Metro designates), checked against the Metro Council Legistar API (webapi.legistar.com/v1/nashville)',
    codifiedThrough: 'Supp. No. 53, codified through Ordinance No. BL2025-1141, approved 2025-12-17; online content updated 2026-06-23',
    amendingThisSection: ['BL2026-1257, passed 2026-04-21'],
    // ⚠️ THE ONLY NON-EMPTY `amendingThisSection` IN THIS FILE, and it was found
    // by querying the council's legislative API rather than by reading a
    // publisher's pending list — because Municode publishes none.
    note: '⚠️ AN ENACTED AMENDMENT IS NOT YET IN THE PUBLISHED TEXT. BL2026-1257, passed 2026-04-21, DELETES § 17.16.030.G.2 and renumbers every subsequent subsection — so the size rule cited here as G.7.a becomes G.6.a. The codified text is current only through 2025-12-17, an eight-month enactment gap, and the gap was found by querying the Metro Council Legistar API, not from any pending list. Every G-numbering recorded here is AS PUBLISHED and will shift; the substance of the size rule is unaffected by the renumbering, but a citation check against the live code will not match.',
  },
}

// ── COLUMBUS ────────────────────────────────────────────────────────────────
//
// ⚠️ TWO INSTRUMENTS, AND THE NEW ONE PERMITS WITHOUT REGULATING. Columbus is
// mid-recodification. Title 34 (2024) establishes only six mixed-use districts —
// its Articles C and D are RESERVED, there is no residential article — and
// § 3304.01 provides that unrezoned parcels "continue to be governed by" Title
// 33. So an ordinary Columbus house sits under Title 33.
//
// Title 34 marks ADU "Allowed" in every district column it has and states NO
// size, height or count rule anywhere in the title. A reader who found the newer
// code first would come away with a permission and no standards.
const COLUMBUS_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Columbus City Code § 3332.355 (Residential Districts) and § 3333.325 (Apartment Districts), both enacted by Ord. 2526-2025 (2025-11-24), under Title 33; Title 34 (2024 Zoning Code) permits the use but states no standards',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ TWELFTH SHAPE, AND THE MEASURE IS UNRESOLVABLE — the Atlanta SPI-20
    // outcome, not a mere silence. The rule caps at "65 percent of the MINIMUM
    // NET FLOOR AREA of the principal dwelling", but Chapter 3303 defines only
    // "minimum net floor area FOR LIVING QUARTERS", which is a district-required
    // CONSTANT (R-1 1,500 sq ft, R-2 720 sq ft, and so on) used that way in all
    // fifteen other Title 33 uses. Under that reading 65% never beats the
    // 1,000 sq ft limb; under an actual-area reading it often does. The city's
    // intake form glosses it "living area" — refused, because a form is not the
    // ordinance (same call as Nashville's "living space").
    {
      kind: 'not-numeric',
      rule:
        'the GREATER of 65 percent of the "minimum net floor area" of the principal dwelling and 1,000 sq ft, BUT in no case exceeding the size of the principal dwelling — a greater-of pair with a conjunctive cap on top',
      condition:
        '⚠️ the denominator is UNRESOLVABLE: "minimum net floor area" is defined in ch. 3303 only as a district-required constant "for living quarters", and the two available readings give different answers. No figure is derived',
      cite: '§ 3332.355.B.3.a (residential); § 3333.325.B.3.a (apartment) is the same rule with "or apartment house" added',
      baseline: true,
    },
  ],
  // ⚠️ A DISJUNCTION WITH NO OPERATOR — new in this file. § 3332.355.B.3.b reads
  // "An ADU must not exceed the height of the principal dwelling, or 25 feet."
  // The size rule one line ABOVE says "whichever is greater"; this rule's own
  // Exception one line BELOW says "whichever is greater". This one says neither,
  // and nothing in the text resolves which way the "or" runs. Recorded as
  // ambiguous rather than resolved in either direction.
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: { cite: '§ 3332.355.B.3.b — "must not exceed the height of the principal dwelling, or 25 feet", with no operator joining the two limbs' },
  notes: [
    '⚠️ THE HEIGHT RULE STATES NO OPERATOR, and the omission is conspicuous rather than inferred: § 3332.355.B.3.a immediately above it says "whichever is greater", and § 3332.355.B.3.b\u2019s own Exception immediately below says "whichever is greater" ("shall not exceed 25 feet in height or the height of the existing building ... whichever is greater"). Only the operative height limb omits it. Whether 25 ft is a floor or a ceiling on a tall principal dwelling is not determinable from the text.',
    '⚠️ TITLE 34 PERMITS ADUs AND REGULATES NOTHING. The 2024 Zoning Code marks the use "Allowed" in all seven of its district columns and carries no size, height or count standard anywhere in the title. Since § 3304.01 leaves unrezoned parcels under Title 33, the standards that actually bind almost every Columbus house are the Title 33 ones recorded here.',
    'Counts are per-district and are NOT uniformly one (§ 3332.355.B.2): one ADU generally; one in R-2F, where the base dwelling may be single- or two-unit; and TWO in R-4, on a lot containing a single-, two-, three- or four-unit dwelling, subject to a maximum of five dwelling units per lot. ADUs may also be added to any multiple-dwelling development subject to a five percent increase in the units the area district allows.',
    'No owner-occupancy requirement is imposed on the Title 33 ADU. ⚠️ Contrast the separately defined "ancillary dwelling unit" in the Traditional Neighborhood Development chapter (ch. 3320), an 800 sq ft use with its own rules — a second term in the same code, and the reason the vocabulary check matters here.',
    'An ADU is exempt from area-district lot width and area requirements (§ 3332.355.B.4), lot coverage on a lot with an ADU may not exceed 65 percent (§ 3332.355.B.5), it must sit on the same parcel as the principal dwelling (§ 3332.355.B.7), and no additional parking is required (§ 3332.355.B.8).',
    '⚠️ § 3370.07 cross-references a section number, "3333.335", that does not exist in the code. Reported as printed rather than silently corrected to a neighbouring section.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Municode Columbus (the publisher columbus.gov links to from both its Zoning page and its City Codes page)',
    codifiedThrough: 'Supplement 85, online content updated 2026-06-30; §§ 3332.355 and 3333.325 both enacted by Ord. 2526-2025, effective 2025-11-24',
    amendingThisSection: [],
    note: 'Municode publishes a supplement number and currency date but no pending-ordinance list, so `amendingThisSection: []` records that no list exists to read. ⚠️ Two extraction failures were caught and routed around rather than trusted: `pdftotext -layout` scrambled the InDesign-set Title 34 text and would have produced FALSE ABSENCES, and the use-table permission glyphs do not survive text extraction at all — that table was read from a 200 dpi visual render instead.',
  },
}

// ── MILWAUKEE ───────────────────────────────────────────────────────────────
//
// ⚠️ THE SAME FORMULA AS MINNEAPOLIS, TO THE CONSTANT. Milwaukee's detached cap
// is "1,300 sq. ft. ... or 16% of the lot area, whichever is greater, but not to
// exceed 1,600 sq. ft." — and Minneapolis § 550.1460(2) is 1,300, 16%, 1,600 in
// the same order with the same operators. Two cities, one formula. Milwaukee's
// ordinance is the later of the two, and the resemblance is recorded as a fact
// about the texts rather than as a claim about who copied whom.
const MILWAUKEE_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Milwaukee Code of Ordinances ch. 295, Table 295-505-2.5 (Accessory Dwelling Unit Design Standards) with §§ 295-201-5, 295-503-2-f and 295-505-2.5; created by Common Council file 240999 (Substitute 4), passed 2025-07-15, effective 2025-08-02',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ AND THE MEASURE CHANGES INSIDE THE SENTENCE. The 1,300 limb is measured
    // in "habitable and parking areas on all levels" — a term the code does not
    // define, and which INCLUDES parking — while the 1,600 limb reverts to
    // "floor area", which § 295-205-7-b defines to EXCLUDE parking. Two different
    // measures in one provision, so the two limbs are not commensurable and no
    // single figure is publishable.
    {
      kind: 'not-numeric',
      rule:
        'the GREATER of 1,300 sq ft "of habitable and parking areas on all levels" and 16% of the lot area, but not exceeding 1,600 sq ft or the floor area of the largest dwelling unit — ⚠️ the first limb is measured in a term the code never defines, which INCLUDES parking, while the cap limb uses the defined "floor area", which EXCLUDES it',
      condition: 'DETACHED accessory dwelling unit',
      cite: 'Table 295-505-2.5',
      baseline: true,
    },
    {
      kind: 'not-numeric',
      rule: '1,000 sq ft AND not larger than the largest dwelling unit — a conjunctive pair, both limbs binding',
      condition: 'INTERNAL or ATTACHED accessory dwelling unit. Internal may exceed 1,000 sq ft only where the structure existed as of the 2025-08-02 effective date, and must then sit entirely on one level and not exceed the first-floor area',
      cite: 'Table 295-505-2.5',
    },
  ],
  maxHeightFt: [],
  maxStories: null,
  heightDefersToBaseZone: null,
  notes: [
    'Minimum floor area is 300 sq ft for all three ADU types (Table 295-505-2.5).',
    '⚠️ "LOT AREA" IS RESOLVED HERE, unlike San José or Miami: ch. 295 defines "lot area", and the phrase "net lot area" occurs ZERO times chapter-wide, so the denominator carries no net/gross ambiguity.',
    'ADUs became legal citywide on 2025-08-02. The use is a LIMITED USE in all nine residential and all eight commercial districts and in IM only; it is prohibited in C9A–C9H, the other industrial districts, PK and TL.',
    // ⚠️ FOUR UNRESOLVED CONFLICTS IN THE ENACTED TEXT, recorded rather than
    // adjudicated. Each changes an answer.
    '⚠️ § 295-201-5 says an ADU must be "smaller in" floor area than the principal — a STRICT comparison — where Table 295-505-2.5 says "not larger than", which is non-strict. On an ADU exactly equal to the principal the two give opposite answers.',
    '⚠️ § 295-201-607 contemplates a board-approved ADU that fails the standards, while § 295-503-2-f-4 provides that failing them makes the unit a prohibited use. Whether a variance route exists is not resolvable from the text read.',
    '⚠️ The commercial and IM districts allow internal and attached ADUs on DUPLEX parcels, where every residential district forbids it — so the more permissive rule sits in the commercial districts, which is the reverse of the usual direction.',
    '⚠️ Subchapter 8 contains no cross-reference to the design-standards table. Recorded as a gap in the code\u2019s internal wiring, not repaired here.',
    'Chapter 295 cites Wis. Stat. § 62.23 for floodplain regulation, plan-commission referral and BOZA appeals, but never in connection with ADUs. ⚠️ § 62.23 itself was not read, so whether it bears on ADUs is unestablished.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'city.milwaukee.gov — Milwaukee publishes its own code, with no commercial publisher in the chain — cross-checked against the Common Council Legistar API',
    codifiedThrough: 'Volume 2, supplement #359, 2026-07-14. Every ADU section carries the stamp "240999 7/15/2025 8/2/2025" and none carries any entry dated after 2025-08-02',
    amendingThisSection: [],
    // ⚠️ A TRAP THAT WOULD HAVE PUBLISHED A PERMIT REQUIREMENT THAT IS NOT LAW.
    // Legistar attachment IDs increase monotonically, so "Substitute 6" looks
    // final. It is not: Substitute 4 was enacted. Sub 6 adds a special-use permit
    // for internal ADUs in RS1–RS6 districts that neither the enacted text nor
    // the published code contains.
    note: 'Milwaukee is the CITY\u2019S OWN publication; Municode\u2019s 192-client Wisconsin list was enumerated and contains no City of Milwaukee entry, so there is no commercial alternative to compare against. ⚠️ THE HIGHEST-NUMBERED SUBSTITUTE IS NOT THE LAW. Legistar carries six substitute texts for file 240999 and attachment IDs increase monotonically, so Substitute 6 looks final — but Substitute 4 was enacted, and Sub 6 contains an RS1–RS6 special-use requirement that is not in the code. Resolved against the action history (one substitution motion PREVAILED, another FAILED) and confirmed independently: the Legistar API returns MatterVersion 4, MatterPassedDate 2025-07-15, MatterDate1 2025-08-02.',
  },
}

// ── MINNEAPOLIS ─────────────────────────────────────────────────────────────
//
// ⚠️ THE CHAPTER-NUMBER TRAP, AND IT IS QUIETER THAN THE LEDGER'S VERSION. The
// ledger records a superseded Minneapolis chapter that would have matched ZERO
// parcels — a loud failure. This is worse: Ord. 2023-032 repealed former Title 20
// chs. 520–552 effective 2023-07-01, and chapter 550 means "Industrial Districts"
// in the repealed code and "Development Standards" in the current one. A misdated
// 550 citation therefore resolves to a real chapter about the wrong subject
// instead of failing. Municode still serves the repealed code at look-alike URLs.
const MINNEAPOLIS_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Minneapolis Code of Ordinances Title 20 (Zoning Code) ch. 550 art. IX, §§ 550.1400–550.1460, with the § 565.70 definition of gross floor area; current chapter 550 is "Development Standards", NOT the repealed chapter 550 "Industrial Districts"',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ TWO OPERATORS POINTING OPPOSITE WAYS IN ONE SENTENCE — the most complex
    // drafting in this file. Allowance is a MAX, the ceiling is a MIN:
    //   min( max(1,300, 0.16 × lot area), 1,600, principal GFA )
    // Reporting 1,600 alone is wrong in both directions depending on lot size.
    {
      kind: 'not-numeric',
      rule:
        'the GREATER of 1,300 sq ft and 16 percent of the lot area, then capped at the LESSER of 1,600 sq ft and the gross floor area of the principal residential structure — a max and a min in the same provision',
      condition: 'DETACHED accessory dwelling unit, gross floor area including parking areas and habitable floor area on all levels',
      cite: '§ 550.1460(2)',
      measure: 'gross floor area, a DEFINED term (§ 565.70) measured from the exterior faces of exterior walls, including qualifying basement area',
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 800,
      condition: 'ATTACHED accessory dwelling unit — a single figure with no operator and no ratio',
      cite: '§ 550.1450(1)',
      measure: 'gross floor area (§ 565.70)',
    },
    {
      kind: 'not-numeric',
      rule:
        '800 sq ft, releasable ONLY where the portion of the principal structure containing the unit existed as of January 1, 2015 — and then bounded instead by the first-floor area of the principal structure, with no upper figure',
      condition: 'INTERNAL accessory dwelling unit — the release is keyed to a date of existence of the STRUCTURE, not of the unit',
      cite: '§ 550.1440(1)',
    },
  ],
  maxHeightFt: [
    { form: 'figure', value: 21, condition: 'detached accessory dwelling unit, except as authorized by variance', cite: '§ 550.1460(1)', baseline: true },
  ],
  maxStories: null,
  heightDefersToBaseZone: null,
  notes: [
    'One ADU per zoning lot, and the use is limited by PRINCIPAL USE rather than by district: § 550.1420 allows an ADU accessory to a permitted or conditional single-family or two-family dwelling and provides that ADUs "shall be prohibited accessory to all other uses".',
    '⚠️ THREE-FAMILY DWELLINGS ARE EXCLUDED, and the code\u2019s own use table groups them with the one- and two-family uses — so the table reads as though they qualify and § 550.1420 says they do not. A reader working from the table alone gets it wrong.',
    'A separate combined-footprint control applies: the detached ADU together with all other detached accessory structures and any attached parking may not exceed the GREATER of 800 sq ft and 10 percent of the lot area (§ 550.1460(3)).',
    'Chapter 550 is citywide — § 550.20 applies it to "all structures and all land uses, except as otherwise provided" — and Article IX has no scope section of its own. So unlike Austin and Nashville there is no enclosing-scope trap here; the binding constraint is the use limit in § 550.1420.',
    '⚠️ The § 565.70 definition of gross floor area excludes detached accessory structures from the LOT\u2019S maximum floor area calculation. That exclusion does not relax the ADU\u2019s own cap in § 550.1460(2) — two different calculations, and reading the exclusion into the ADU cap would enlarge it.',
    '⚠️ Milwaukee\u2019s detached cap uses the SAME constants in the same order — 1,300 sq ft, 16% of lot area, 1,600 sq ft — with the same two operators. Recorded because the coincidence is exact and a reader comparing the two cities should know the resemblance is in the texts, not an error here.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'Municode Minneapolis — the city states verbatim that it "uses Municipal Code Corporation (Municode) to publish its City Charter and Code"',
    codifiedThrough: 'Supplement 72, online content updated 2026-08-06',
    amendingThisSection: [],
    note: 'Municode publishes a supplement number and currency date but no pending-ordinance list, so `amendingThisSection: []` records that no list exists to read. ⚠️ Both sides of the 2023 repeal were verified rather than assumed: the superseded Municode job still serves former chapter 546, and the current one does not. ⚠️ An instrument correction worth keeping: `grep -c` counts LINES, not matches, and Municode hard-wraps mid-sentence — that hid 9 of 81 ADU mentions until the scan was re-run over whitespace-normalised text.',
  },
}

// ── WASHINGTON, DC ──────────────────────────────────────────────────────────
//
// ⚠️ THE NOUN IS "ACCESSORY APARTMENT", AND "ACCESSORY DWELLING UNIT" APPEARS
// ZERO TIMES IN TITLE 11 DCMR. Searching DC's zoning code for the usual term
// returns nothing and reads as "DC has no ADU rule". The official section is
// captioned "ACCESSORY APARTMENT (R)" — confirmed at the official publisher.
//
// ⚠️ AND "ACCESSORY DWELLING UNIT" *IS* A DEFINED DC TERM — at D.C. Official
// Code § 42-3401.03, in the Rental Housing Conversion and Sale Act. A different
// body of law, a different scope, and no size figure. Two defined terms in two
// statutes: the Boston hazard, in a shape Boston did not have.
const DC_LOCAL: LocalLayer = {
  kind: 'read',
  citation:
    'Title 11 DCMR (Zoning Regulations of 2016), Subtitle U § 253 "ACCESSORY APARTMENT (R)" (eff. 2023-08-25) with Subtitle D §§ 201, 5000, 5002, 5003 (§ 5003 eff. 2026-07-10) — read from the OFFICIAL ODAI text at dcregs.dc.gov, not the DCOZ courtesy export',
  readOn: '2026-08-20',
  maxSizeSqFt: [
    // ⚠️ TWO REGIMES, AND THEY ARE NOT ALTERNATIVES THE APPLICANT ELECTS BETWEEN
    // (rule 6 does not apply here) — which one binds follows from WHERE the unit
    // is. Reporting the larger would assume a siting the user has not chosen.
    {
      kind: 'not-numeric',
      rule:
        'no absolute square-foot cap — the unit "may not occupy more than thirty-five percent (35%) of the gross floor area of the house", so the ceiling scales with the house',
      condition: 'accessory apartment INSIDE the principal dwelling. ⚠️ Cumulative with a MINIMUM house size, joined by "and": the house itself must have at least 2,000 sq ft of gross floor area in R-1 and 1,200 sq ft in R-2, exclusive of garage space',
      cite: '§ 253.7(b), with the minimum at Table U § 253.7(a)',
      measure: 'gross floor area (11-B § 100.2, measured under 11-B § 304) — ⚠️ INCLUDES basements (§ 304.7) and EXCLUDES cellars (§ 304.8), split by a five-foot test',
      baseline: true,
    },
    {
      kind: 'not-found',
      condition:
        '⚠️ accessory apartment in an ACCESSORY BUILDING — § 253.8 states NO size limit for the apartment. This is a KNOWN ABSENCE by the slot test, not a missing lookup: § 253.7 creates a size slot for the in-dwelling branch and the parallel branch at § 253.8 has none. The detached unit is bounded by the accessory-building ENVELOPE instead — a maximum BUILDING AREA of the greater of 30% of the required rear yard area or 650 sq ft (R-1/R-2), or 550 sq ft (R-3), at 11-D § 5003 — which is a FOOTPRINT, not a floor area, and must not be multiplied by the two-storey height limit to manufacture one',
    },
  ],
  // ⚠️ THE CODE STATES BOTH UNITS, SO NEITHER IS DERIVED (rule 12). "Two (2)
  // stories AND twenty-two feet (22 ft.)" — the operator is `and`, both limbs
  // bind, and no ft/storey constant is needed or permitted.
  maxHeightFt: [
    { form: 'figure', value: 22, condition: 'accessory building in an R zone — cumulative with a two-storey limit, joined by "and"', cite: '11-D § 5002.1 (eff. 2021-03-19)', baseline: true },
  ],
  maxStories: { value: 2, condition: 'accessory building in an R zone — CUMULATIVE with the 22 ft limit, not an alternative to it: the code says "two (2) stories and twenty-two feet (22 ft.)", so both bind and neither is derived from the other', cite: '11-D § 5002.1' },
  heightDefersToBaseZone: { cite: '⚠️ applies to the DETACHED case only. For an accessory apartment inside the principal dwelling, § 253 imposes no height limit at all — a no-slot absence — and the house\u2019s own zone envelope governs' },
  notes: [
    'One accessory apartment, stated three times across three subtitles and consistent in all three: § 253.1 ("One (1) accessory apartment may be established in an R zone"), 11-D § 201.1 (one principal dwelling unit AND one accessory apartment per LOT OF RECORD — additive, not an alternative), and 11-D § 5000.2(b).',
    '⚠️ OWNER-OCCUPANCY IS REQUIRED and cannot be waived: "Either the principal dwelling or accessory apartment unit shall be owner-occupied for the duration of the accessory apartment use" (§ 253.5), and § 253.10(a) provides that this requirement "shall not be waived in any R zones".',
    '⚠️ A PERSONS CAP, SEPARATE FROM THE UNIT COUNT: not more than three (3) persons may occupy the accessory apartment, except in R-1B/GT or R-3/GT where the house and apartment COMBINED may not exceed six (6) (§ 253.6).',
    '⚠️ NOT CITYWIDE — R zones only (§ 253.1), and the exclusions are express rather than inferred: prohibited in all RF zones (11-E § 201.6, 11-U § 310.1(a)), all RA zones (11-U § 410.1(a)), and on Alley Lots (11-U §§ 600.1(f)(3), 601.1(f)(3)).',
    // ⚠️ A CONFLICT THAT WAS LIVE UNTIL 2026 AND IS NOW CLOSED — and the point is
    // that reading the courtesy export alone would have produced a wrong answer.
    '⚠️ THE RF EXCLUSION WAS ONLY MADE EXPLICIT ON 2026-07-10. Before that, 11-U § 310.1(a) permitted in RF zones "any accessory use permitted in the R zones under Subtitle U § 250" — and § 250.1(a) IS the accessory apartment — which read as importing the use into RF by reference, against Subtitle E\u2019s prohibition. Subtitle A §§ 201.3–201.4 resolve conflicts only between a land-use subtitle and Subtitle C, so no stated priority rule covered an E-versus-U conflict. The 2026 rulemaking (73 DCR 009999) closed it in all three places.',
    'Georgetown is a special-exception zone in both locations (§ 253.4, R-1B/GT and R-3/GT), and there the apartment "shall only be permitted on the second story of a detached accessory building" (§ 253.9(a)) — a placement rule that operates as a height constraint.',
    '⚠️ TWO LIMITS THAT ARE FILLED BUT UNQUANTIFIED — the Atlanta SPI-20 third outcome, not absences and not gaps in the reading. An accessory building must "be secondary in size compared to the principal building" (11-D § 5000.2(c)), and the apartment must be "secondary to the principal single household dwelling unit in terms of gross floor area" (11-B § 100.2). Neither states a ratio.',
    '⚠️ AN UNRESOLVED CONSEQUENCE FOR DC\u2019S ARCHETYPAL CASE, recorded as a gap rather than guessed. The below-grade unit is the common DC form, and whether that space is a BASEMENT (inside GFA) or a CELLAR (outside it) turns on the five-foot test at 11-B § 100.2. § 253.7(b) expresses the cap as a share of GFA, so in a cellar both the unit and the denominator would exclude the space. The text does not state how that case is computed, and no agency FAQ gloss is adopted for it (rule 4).',
    '⚠️ "ACCESSORY DWELLING UNIT" OCCURS ZERO TIMES IN TITLE 11 DCMR — across 1,159 pages in two independent extractions, behind a positive control of 2,833 for "zoning" and 385 for "dwelling". The absence is of the TERM, not of the rule. And the term IS defined elsewhere in DC law, at D.C. Official Code § 42-3401.03 (Rental Housing Conversion and Sale Act), with near-identical wording, a different scope and no size figure.',
    '⚠️ THE WIDELY-CITED "450 sq. ft." DETACHED FIGURE IS SUPERSEDED. It is what the DCOZ courtesy export still shows as a single un-districted subsection. 11-D § 5003 has been amended twice since (72 DCR 009494 eff. 2025-09-05; 73 DCR 009999 eff. 2026-07-10) and is now per-district at 650/550. Caught only by reading the official publisher rather than the city\u2019s own PDF.',
  ],
  pending: {
    kind: 'checked',
    on: '2026-08-20',
    source: 'dcregs.dc.gov (ODAI) — the publisher DCOZ itself designates as official, its own copies being captioned "courtesy version" — plus the DCOZ Text Amendment Dashboard',
    codifiedThrough: 'U § 253 effective 2023-08-25 (70 DCR 011297); D § 5003 effective 2026-07-10 (73 DCR 009999); D § 5002 effective 2021-03-19',
    // ⚠️ NON-EMPTY, and the second city in the file to be so. The amendment is
    // real but touches nothing this module publishes.
    amendingThisSection: ['Z.C. Case No. 08-06R, NOPR published 2025-06-20 (72 DCR Vol 72/25) — amends § 253.13 ONLY, replacing "Department of Consumer and Regulatory Affairs" with "Department of Buildings". No figure, scope or operator changes.'],
    note: 'A maintained pending list EXISTS (the DCOZ Text Amendment Dashboard, exactly 11 cases, all enumerated) — ⚠️ its free-text search box FAILED its positive control, returning all 11 rows for a selective term, so the list was enumerated rather than searched. ⚠️ A PUBLISHER CONFLICT WAS FOUND AND RESOLVED AGAINST THE COURTESY TEXT: DCOZ\u2019s 2025-10-01 export renders Table U § 253.7(a)\u2019s second row as "R-2, R-3", which would impose a 1,200 sq ft minimum house size in R-3. The official 11U253.doc (49,664 bytes, verified against Content-Length) has exactly two data rows, R-1 and R-2, and its lead-in scopes the requirement to "the following zones" — so R-3 carries NO minimum. DCOZ\u2019s own 2024-03-04 export agrees with the official text, making the 2025 export the outlier. ⚠️ The invented R-3 row runs in the BLOCKING direction: it would disqualify small R-3 houses the code permits.',
  },
}

const NOT_READ_LOCAL = (city: string): LocalRead => ({
  kind: 'not-read',
  detail: `${city}'s own ADU ordinance has not been read into this tool.`,
})

/** ⚠️ EVERY LIVE CITY IS LISTED. A city missing from this map would fall through
 *  to a default, and a default here is the thing that must not exist: silence
 *  would render as "no state law applies", which is a claim. */
const QUALIFIES = (why: string): StateApplies => ({ kind: 'qualifies', why })
const NA: StateApplies = { kind: 'n-a' }

const BY_CITY: Readonly<Record<string, AduRules>> = Object.freeze({
  // California — no population threshold, so every city qualifies.
  la: { city: 'la', state: CA, stateApplies: QUALIFIES('the chapter states no population threshold'), local: LA_LOCAL },
  sf: { city: 'sf', state: CA, stateApplies: QUALIFIES('the chapter states no population threshold'), local: SF_LOCAL },
  sanjose: { city: 'sanjose', state: CA, stateApplies: QUALIFIES('the chapter states no population threshold'), local: SANJOSE_LOCAL },
  sandiego: { city: 'sandiego', state: CA, stateApplies: QUALIFIES('the chapter states no population threshold'), local: SANDIEGO_LOCAL },
  seattle: { city: 'seattle', state: WA, stateApplies: QUALIFIES('Seattle plans under the Growth Management Act and lies inside an urban growth area'), local: SEATTLE_LOCAL },

  // ── The four preemptions found by the 2026-08-20 survey ──────────────────
  // Local ordinances NOT yet read for any of these — the state layer is the
  // only one established, and `summariseAdu` says so.
  phoenix: {
    city: 'phoenix',
    state: AZ,
    stateApplies: QUALIFIES('Phoenix is far above the 75,000 population threshold in § 9-461.18(H)'),
    local: PHOENIX_LOCAL,
  },
  lasvegas: {
    city: 'lasvegas',
    state: NV,
    stateApplies: QUALIFIES('Las Vegas is far above the 60,000 population threshold for cities in NRS 278.257(1)'),
    local: LASVEGAS_LOCAL,
  },
  boston: {
    city: 'boston',
    state: MA,
    stateApplies: QUALIFIES('c. 40A § 3 binds any zoning ordinance or by-law; there is no population test'),
    local: BOSTON_LOCAL,
  },
  denver: {
    city: 'denver',
    state: CO,
    // ⚠️ NOT ASSUMED FROM SIZE. Rule 24: a claim true of the jurisdiction can be
    // false of the city it is applied to. Colorado's test has two halves —
    // population of 1,000 or more AND inside a metropolitan planning
    // organisation. Denver obviously clears the first. The MPO half was never
    // verified against the statute, and "it is a big city in the Denver metro"
    // is a plausible inference, not a reading. So the statute is recorded and
    // its application to Denver is not claimed.
    // ⚠️ UPGRADED 2026-08-20, and by an outside source rather than an inference.
    // This was `not-established` because Colorado's test has two halves —
    // population and MPO membership — and only the first was obvious. Denver
    // clears it on the city's OWN statement: its Community Planning and
    // Development department publishes that the Citywide ADUs measure
    // "implements state legislation (House Bill 24-1152)" and that the
    // legislation "requires Denver (along with other jurisdictions) to allow
    // accessory dwelling units in all residential districts". Denver then
    // amended its code to comply, including the owner-occupancy change the
    // statute forced.
    //
    // That is the jurisdiction asserting its own status, not this tool inferring
    // it from population — which is what rule 24 forbade. It is still the city's
    // characterisation rather than an independent test of DRCOG membership
    // against § 29-35-103, and the `why` says so.
    stateApplies: {
      kind: 'qualifies',
      why: 'Denver Community Planning and Development states the Citywide ADUs measure implements HB24-1152 and that the legislation requires Denver to allow ADUs in all residential districts; Denver amended the DZC and Former Chapter 59 accordingly, effective 2024-12-16. ⚠️ This is the city\u2019s own characterisation of its status, published by its planning department — not an independent verification of MPO membership against the statutory test in § 29-35-103.',
    },
    local: DENVER_LOCAL,
  },

  // ── Read, and the state does not preempt ─────────────────────────────────
  miami: { city: 'miami', state: FL, stateApplies: NA, local: MIAMI_LOCAL },
  charlotte: { city: 'charlotte', state: NO_PROVISION.nc, stateApplies: NA, local: CHARLOTTE_LOCAL },
  raleigh: { city: 'raleigh', state: NO_PROVISION.nc, stateApplies: NA, local: NOT_READ_LOCAL('Raleigh') },
  austin: { city: 'austin', state: NO_PROVISION.tx, stateApplies: NA, local: AUSTIN_LOCAL },
  dallas: { city: 'dallas', state: NO_PROVISION.tx, stateApplies: NA, local: DALLAS_LOCAL },
  columbus: { city: 'columbus', state: NO_PROVISION.oh, stateApplies: NA, local: COLUMBUS_LOCAL },
  milwaukee: { city: 'milwaukee', state: NO_PROVISION.wi, stateApplies: NA, local: MILWAUKEE_LOCAL },
  minneapolis: { city: 'minneapolis', state: NO_PROVISION.mn, stateApplies: NA, local: MINNEAPOLIS_LOCAL },
  dc: { city: 'dc', state: NO_PROVISION.dc, stateApplies: NA, local: DC_LOCAL },
  chicago: { city: 'chicago', state: NO_PROVISION.il, stateApplies: NA, local: NOT_READ_LOCAL('Chicago') },
  nyc: { city: 'nyc', state: NO_PROVISION.ny, stateApplies: NA, local: NOT_READ_LOCAL('New York City') },
  philadelphia: { city: 'philadelphia', state: NO_PROVISION.pa, stateApplies: NA, local: NOT_READ_LOCAL('Philadelphia') },

  // ── Georgia and Tennessee: whole-code searches, both clean ──────────────
  atlanta: { city: 'atlanta', state: NO_PROVISION.ga, stateApplies: NA, local: NOT_READ_LOCAL('Atlanta') },
  nashville: { city: 'nashville', state: NO_PROVISION.tn, stateApplies: NA, local: NASHVILLE_LOCAL },
})

/** ⚠️ The fallback is `not-established`, never `no-provision`. A city absent
 *  from the map is one nobody has considered, and saying "no state statute
 *  applies" about it would be a claim manufactured by a default. */
export function aduRulesFor(city: string): AduRules {
  return (
    BY_CITY[city] ?? {
      city,
      state: { kind: 'not-established', state: 'unknown', detail: `${city} is not in the ADU jurisdiction map; nobody has established which body of law governs.` },
      stateApplies: { kind: 'n-a' },
      local: NOT_READ_LOCAL(city),
    }
  )
}

// ── ⚠️ THE VOCABULARY CHECK ─────────────────────────────────────────────────
//
// Run 2026-08-20 across every city whose ordinance had been read, prompted by
// the East Boston failure: Boston calls the thing an "Additional Dwelling Unit",
// a search for "accessory dwelling unit" found a DIFFERENT and forbidden use,
// and the absence of the phrase was published as the absence of the concept.
//
// Every city here had been searched on a term taken from the California statute.
// The question this answers is the one that should have been asked first: WHAT
// DOES THIS JURISDICTION CALL IT, established from its own definitions.
//
// ⚠️ THE RESULT WAS CLEAN, WHICH IS WHY IT IS RECORDED. An unwritten negative
// gets re-asked, and next time someone will assume it was never run. Six of the
// seven turned up a competing term; in every case the code itself distinguishes
// them, and in four cases it does so by the SAME criterion — a kitchen.
//
// That criterion is worth carrying: an ADU must provide complete independent
// living facilities including cooking, so a use defined as having no kitchen is
// definitionally not one. Boston is the exception that motivated the sweep
// precisely because its two terms are NOT distinguished by such a test — they
// are two live routes with opposite effects.
export interface VocabularyCheck {
  /** The term the jurisdiction's own code uses. */
  canonical: string
  /** Other terms that could denote the same thing, and were checked. */
  competing: string[]
  /** How the code itself keeps them apart — or why there is nothing to keep apart. */
  distinguishedBy: string
}

export const ADU_VOCABULARY_CHECK: Readonly<Record<string, VocabularyCheck>> = Object.freeze({
  dc: {
    canonical:
      '⚠️ "Accessory apartment" — NOT "accessory dwelling unit". The official section is captioned "ACCESSORY APARTMENT (R)" (11-U § 253)',
    competing: ['Accessory dwelling unit — a defined term in a DIFFERENT statute', 'Additional dwelling unit — checked and NOT a term here', 'English basement'],
    distinguishedBy:
      '⚠️ THE USUAL NOUN RETURNS ZERO. "Accessory dwelling unit" occurs ZERO times in Title 11 DCMR — 1,159 pages, two independent extractions, behind a positive control of 2,833 for "zoning" and 385 for "dwelling" — so searching DC\u2019s zoning code for the standard term returns nothing and reads as "DC has no ADU rule". ⚠️ AND THE TERM IS DEFINED ELSEWHERE IN DC LAW: D.C. Official Code § 42-3401.03, in the Rental Housing Conversion and Sale Act, defines "accessory dwelling unit" in near-identical words but with a different scope and NO size figure. Two defined terms in two bodies of law — the Boston hazard in a shape Boston did not have, since here the competing term lives outside the zoning code entirely. "Additional dwelling unit" occurs once, as ordinary English in an apartment-house density rule, and is NOT a second track as it is in Boston. "English basement" is vernacular with zero occurrences — but it points at the split that decides DC\u2019s archetypal case: GFA includes BASEMENTS (11-B § 304.7) and excludes CELLARS (§ 304.8), separated by a five-foot test.',
  },
  columbus: {
    canonical:
      '"Accessory dwelling unit or ADU" — defined SEPARATELY in each of the two live instruments: Title 33 § 3303.01 and Title 34 § B.40.020.A',
    competing: ['Ancillary dwelling unit (§ 3320.03)', 'Additional dwelling unit — checked and NOT a term here', 'Carriage house'],
    distinguishedBy:
      '⚠️ SEPARATED BY DISTRICT FAMILY, NOT BY THE KITCHEN. "Ancillary dwelling unit" (§ 3320.03) is a genuinely distinct defined term — a flat 800 sq ft cap, an OWNER-OCCUPANCY requirement and a density exclusion, none of which the ADU sections impose — and it lives in ch. 3320 (Traditional Neighborhood Development), whose four districts are mutually exclusive with the ch. 3332/3333 districts the ADU sections govern. Reading it across would import an owner-occupancy condition Columbus does not impose. ⚠️ THE BOSTON TRAP WAS TESTED AND DOES NOT FIRE: "additional dwelling unit" occurs in Title 33 only INSIDE the ADU definition itself ("means an additional dwelling unit which has..."), as the genus of that definition — it has no entry of its own, so treating it as a second term would invent a distinction the code does not draw. ⚠️ AND THE SUBSTANCE SITS IN DIFFERENT PLACES IN THE TWO INSTRUMENTS: Title 33\u2019s definition is thin and its operative sections carry everything, while Title 34\u2019s definition carries the cooking/sanitation requirement that appears in no Title 34 operative section. Reading either instrument\u2019s definitions alone loses a requirement.',
  },
  milwaukee: {
    canonical: 'Accessory dwelling unit — defined twice (general definitions AND use definitions) at § 295-201-5, with three subtypes: Internal, Attached, Detached',
    competing: ['Additional dwelling unit — checked and NOT a term here', 'Accessory structure (§ 295-201-7)', '2-family dwelling'],
    distinguishedBy:
      '⚠️ NO COMPETING DWELLING TERM EXISTS — twelve alternates returned ZERO chapter-wide, and the two non-zero results were disposed of rather than counted: "in-law" (117 documents) is the affinity sense in pension, nepotism and liquor provisions, and "additional dwelling unit" appears only in ch. 257, a BUILDING-code chapter, never in ch. 295. ⚠️ Explicitly contrasted with Boston and Dallas, where that phrase IS a term of art with its own effect. What Milwaukee separates instead: an ADU is NOT an accessory structure (§ 295-201-7 — "An accessory structure does not contain habitable space"), so the accessory-structure design table does not govern it; and a second unit that meets lot-area-per-unit standards in a district permitting duplexes "shall be considered a 2-family dwelling and not an accessory dwelling unit", an express DEEMING RULE rather than a kitchen test. The three subtypes differ by attachment only — cooking facilities are required of all three.',
  },
  minneapolis: {
    canonical: 'Accessory dwelling unit — § 565.50, nested under "Dwelling"; 81 occurrences across Title 20',
    competing: ['Additional dwelling unit — checked and NOT a term here', 'Cluster development', 'Common lot development'],
    distinguishedBy:
      '⚠️ THE BOSTON TRAP WAS TESTED DIRECTLY AND DOES NOT FIRE, with evidence rather than a zero: "additional dwelling unit" occurs EIGHT times, and all eight are ordinary English inside "new or additional dwelling units", a COUNTING THRESHOLD for site plan review and inclusionary housing. None appears in ch. 565 (Definitions). Seventeen other alternates returned zero. The separation that IS real is by attachment, and it is substantive rather than cosmetic — internal (§ 550.1440) carries an owner-occupancy covenant in one case, attached (§ 550.1450) carries none and requires matching exterior materials, detached (§ 550.1460) has a different and larger size formula plus a 21 ft height cap. Not separated by the kitchen: "dwelling unit" is defined once (§ 565.50) with "a single kitchen facility" inside that one definition, so every ADU has one by construction. ⚠️ Cluster and common lot developments are adjacent but distinct — § 550.230 makes them exceptions to one-principal-structure-per-lot and separately provides that an ADU "shall not be considered a separate principal residential structure", i.e. a different mechanism, not a species of one.',
  },
  phoenix: {
    canonical: 'Dwelling Unit, Accessory (ADU) — the inverted form, defined at Phoenix ZO § 202',
    competing: ['Guesthouse', 'Casita'],
    distinguishedBy:
      'Nothing to distinguish: § 202 defines "Guesthouse: See \'Dwelling Unit, Accessory.\'" — an express cross-reference making them the same use. "Casita" is not a defined term.',
  },
  seattle: {
    canonical: 'accessory dwelling unit (SMC 23.42.022, and definitions at 23.58B.060, 23.58C.020, 23.60A.934)',
    competing: ['backyard cottage', 'DADU', 'AADU'],
    distinguishedBy:
      '"backyard cottage" returns hits only under Ordinances, never in code text — it is vernacular in legislative titles. The code uses "accessory dwelling unit" throughout, in 27 places.',
  },
  lasvegas: {
    canonical: 'Residential Accessory Dwelling Unit (LVMC 19.18.020; use description at 19.12.070)',
    competing: ['guest house', 'casita'],
    distinguishedBy:
      'Neither is a defined use. The sole occurrence of "casita" is inside LVMC 19.10.050, listing what a special-area district\u2019s own design standards may address — not a citywide use permission.',
  },
  sandiego: {
    canonical: 'Accessory Dwelling Units (ADUs) and Junior ADUs (SDMC § 141.0302)',
    competing: ['Companion Unit', 'Guest Quarters or Habitable Accessory Buildings (§ 141.0307)'],
    distinguishedBy:
      '⚠️ THE KITCHEN. § 141.0307 guest quarters "do not provide complete, independent living facilities", "shall not contain a kitchen", and "shall not be rented, leased, or sold as a separate dwelling unit" — the exact inverse of an ADU. And "Companion Unit" is the REPEALED former title of § 141.0302 itself, replaced by O-21254 effective 2020-11-29, so citing it would point at dead text.',
  },
  la: {
    canonical: 'Accessory Dwelling Unit (ADU), defined at LAMC § 12.03 (Chapter I) — and the SAME term in Chapter 1A',
    competing: ['Accessory Living Quarters', 'Guest House'],
    distinguishedBy:
      '⚠️ THE KITCHEN, stated twice. § 12.03 defines Accessory Living Quarters as "having no kitchen facilities and not rented or otherwise used as a separate dwelling unit", and Guest House as "a dwelling containing not more than five guest rooms or suites of rooms, but with no kitchen facilities". An ADU must include "permanent provisions for living, sleeping, eating, cooking, and sanitation". ⚠️ CHECKED IN BOTH CODES: LA runs Chapter I and Chapter 1A side by side, and a definition in one does not bind the other. Chapter 1A Article 5 (read from the City-hosted PDF, 2,018,320 bytes verified against Content-Length) uses "accessory dwelling unit" — the same noun. ⚠️ BUT SEE THE SCOPE NOTE: Chapter 1A cross-references its own § 13B.10.1.B.2(a) for ADU permits, so Chapter 1A HAS ADU provisions that have not been read, and the LA encoding cites only Chapter I § 12.22 A.33. Article 7 (Alternate Typologies) contains no ADU text; where Chapter 1A\u2019s substantive ADU standards live, and over what geography Chapter 1A governs, are both unestablished.',
  },
  sf: {
    canonical: 'Accessory Dwelling Unit — §§ 207.1(a) and 207.2(a) both name their subject "Accessory Dwelling Units (\u201cADUs\u201d), as defined in Section 102 of this Code"',
    competing: ['in-law unit', 'secondary unit'],
    distinguishedBy:
      '⚠️ THE WEAKEST ROW IN THIS TABLE, AND IT IS NOT CLOSED. Two things are established: the code names its own canonical term by cross-reference (§§ 207.1(a), 207.2(a) → § 102), and § 207.1(b) partitions the field — it applies "to the construction of ADUs on ALL lots located within the City and County of San Francisco in areas that allow residential use, EXCEPT ADUs regulated by the State-Mandated Program under Section 207.2" — with both programmes read here. But a PARTITION IS NOT A VOCABULARY CHECK: it shows the two programmes are exhaustive of ADUs, not that no differently-named use exists. An attempt to read § 102 failed — amlegal opens its window at § 101 and the 18,810 rendered characters never reach the definitions, so the zero counts obtained there measure the probe, not the code (rule 11). ⚠️ SF matters more than most for this, because its local cap is GEOMETRIC rather than numeric, so a differently-named use could carry a square-foot figure the ADU sections do not.',
  },
  sanjose: {
    canonical: 'Accessory Dwelling Unit (SJMC § 20.80.175)',
    competing: ['Guest House'],
    distinguishedBy:
      'The code names both in one sentence and treats them differently: § 20.80.160 allows Incidental Transient Occupancy in a "Guest House" and provides that it "shall not be allowed in an Accessory Dwelling Unit". Distinct co-existing categories. ⚠️ What a Guest House IS in San José was not read — only that it is not the ADU instrument.',
  },
  denver: {
    canonical: 'accessory dwelling unit — DZC Article 11 uses it 46 times; Article 13 defines "detached accessory dwelling unit"',
    competing: ['carriage house', 'granny flat', 'guest house', 'Carriage Lot'],
    distinguishedBy:
      'Nothing to distinguish on the dwelling term: "carriage house", "granny flat" and "guest house" appear ZERO times in DZC Articles 11 and 13. ⚠️ "Carriage Lot" IS a live DZC term (§ 11.8.2.1.D allows an ADU on one even with no primary use, subject to § 12.10.4) — but it names a LOT TYPE, not a dwelling, so it does not compete with the ADU term. Checked in the current code only; Former Chapter 59 was amended by the same measure and its own vocabulary was NOT separately checked.',
  },
  charlotte: {
    canonical: '"Dwelling – Accessory Unit (ADU)" — UDO § 15.6.F, defined at § 15.3',
    competing: ['accessory dwelling unit (running prose)', 'accessory structure'],
    distinguishedBy:
      '⚠️ SEPARATED BY THE KITCHEN, and the criterion lives in the DEFINITION rather than the operative section: § 15.3 provides an ADU "shall include separate cooking and sanitary facilities and is a complete, separate dwelling unit". The canonical string uses an en dash and inverted word order, but the noun is "Accessory" — the different-noun streak ends here. ⚠️ The live hazard is not vocabulary but INSTRUMENT: the legacy 1992 ordinance § 12.407 still governs pre-2023 conditional/optional/EX districts under § 1.4.C and states an interior size cap and a height cap the UDO does not.',
  },
  dallas: {
    canonical: 'ACCESSORY DWELLING UNIT (ADU) — defined ONLY at § 51A-4.510(a)(1), not in the general definitions section',
    competing: ['additional dwelling unit', 'live unit'],
    distinguishedBy:
      '⚠️ SEPARATED BY RENTABILITY, in adjacent subparagraphs of the same section. An ACCESSORY dwelling unit is "a rentable additional dwelling unit" (§ 51A-4.510(a)(1)); an ADDITIONAL dwelling unit may be authorised by the Board only where it will not "be used as rental accommodations" (§ 51A-4.209(b)(6)(E)(i)). Same building, opposite rental status — the Boston hazard with a different separator, and here the code DOES separate them in operative text. A third term, "live unit", is barred from every residential district. ⚠️ "ACCESSORY DWELLING" appears nowhere in § 51A-2.102, so the definitions chapter looks empty.',
  },
  nashville: {
    canonical: 'TWO defined uses — "detached accessory dwelling unit" (DADU) and "accessory apartment", both at § 17.04.060.B',
    competing: ['accessory apartment', 'detached accessory dwelling unit'],
    distinguishedBy:
      '⚠️ SEPARATED BY ATTACHMENT AND BY OCCUPANCY, both in the definitions. An "accessory apartment" is "attached to a single-family residence" and is limited to family-member occupancy (§ 17.16.250.A); a "detached accessory dwelling unit" is "a detached dwelling unit separate" from the principal and carries no such occupancy limit. They also differ in size rule — 25% of gross floor area for the apartment, a lot-keyed 700/850 figure for the DADU. Reading either as "the" Nashville ADU rule would misstate both the cap and who may live there.',
  },
  austin: {
    canonical: 'Secondary Apartment — Austin City Code §§ 25-2-1461 to 25-2-1463',
    competing: ['accessory dwelling unit', 'garage apartment'],
    distinguishedBy:
      '⚠️ THE OPERATIVE TERM IS NEITHER "ACCESSORY" NOR "ADU". "accessory dwelling unit" returns eight hits, every one inside Chapter 25-3 (Traditional Neighborhood District) — a niche chapter — while the governing article sits in Chapter 25-2, the main zoning chapter, under "Secondary Apartment". Austin does not use the ADU abbreviation for it at all, so unlike Miami there is not even a shared acronym to hint at the match.',
  },
  miami: {
    canonical: 'Ancillary Dwelling Unit (ADU) — Miami 21 § 3.18, defined in Article 1',
    competing: ['Accessory Dwelling Unit', 'Ancillary Building'],
    distinguishedBy:
      '⚠️ MIAMI USES A DIFFERENT NOUN WITH THE SAME ABBREVIATION. The section is "ANCILLARY Dwelling Unit (ADU) Standards"; "accessory dwelling" appears only incidentally (7 hits). The vocabulary check found the section — a term-based search taken from the California statute would have looked healthy and missed it, which is the East Boston failure mode. "Ancillary Building" is a distinct term for the STRUCTURE that may contain an ADU, not for the unit itself.',
  },
  boston: {
    canonical: 'Additional Dwelling Unit (Boston Zoning Code § 53-5.2 and ten other district articles)',
    competing: ['Accessory Dwelling Unit'],
    distinguishedBy:
      '⚠️ NOT distinguished by any definitional test — these are two live routes with OPPOSITE effects, which is why this city produced a wrong published answer. "Accessory Dwelling Unit" is forbidden in East Boston\u2019s tables; "Additional Dwelling Unit" is allowed by § 53-5.2 notwithstanding those tables. Every other city in this sweep separates its terms by a criterion; Boston does not.',
  },
})

/** Cities whose LOCAL ordinance has been read. Separate from the state list —
 *  conflating them would let one city's reading imply another's (rule 20). */
export const ADU_LOCAL_READ: readonly string[] = Object.freeze(
  Object.entries(BY_CITY).filter(([, r]) => r.local.kind === 'read').map(([c]) => c).sort(),
)
/** Cities with a state statute that preempts. */
export const ADU_STATE_PREEMPTED: readonly string[] = Object.freeze(
  Object.entries(BY_CITY).filter(([, r]) => r.state.kind === 'preempts').map(([c]) => c).sort(),
)
/** ⚠️ Cities whose STATE LAYER is still unknown. Exported so the gap is
 *  countable rather than something a reader has to notice (rule 20). */
export const ADU_STATE_NOT_ESTABLISHED: readonly string[] = Object.freeze(
  Object.entries(BY_CITY).filter(([, r]) => r.state.kind === 'not-established').map(([c]) => c).sort(),
)

// ── THE EFFECTIVE ANSWER ────────────────────────────────────────────────────

export type EffectiveSource =
  | 'local'
  | 'state-floor'
  | 'local-no-maximum'
  /** ⚠️ NOT the same as `local-no-maximum`, and collapsing them would invert the
   *  meaning. There the city states no cap (permission); here the city states a
   *  binding limit that is not a number, and the state floor is the only figure
   *  we can honestly publish alongside it. */
  | 'local-non-numeric'
  | 'floor-only'
  /** ⚠️ A state statute preempts, and states no publishable figure — because it
   *  derives one, states a band, reserves the dimension, or omits it. Distinct
   *  from `unresolved`, which is ignorance. */
  | 'state-no-figure'
  /** ⚠️ A state statute EXISTS and declines to preempt (Florida). An answer
   *  about the state, and it must never render as `unresolved`. */
  | 'state-declines'
  | 'unresolved'

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
/** ⚠️ THE PUBLISHABLE STATE SIZE FLOOR, or null with a reason.
 *
 *  Four of the six preempting statutes yield NO figure, and for four different
 *  reasons: Arizona's is derived from the primary dwelling, Colorado's is a band
 *  that does not resolve to a cap, Massachusetts reserves size to the city, and
 *  Nevada does not address it. Only California and Washington state a constant.
 *
 *  A consumer that wanted "the number" would have had to invent one for four
 *  states. This returns the reason instead. */
export function stateSizeFloor(r: AduRules): { floor: Extract<AduFloor, { form: 'figure' }> | null; why: string | null } {
  if (r.state.kind !== 'preempts') return { floor: null, why: null }
  if (r.stateApplies.kind !== 'qualifies') {
    return { floor: null, why: `${r.state.state}'s statute may not reach this city: ${r.stateApplies.kind === 'not-established' ? r.stateApplies.why : 'not applicable'}` }
  }
  const dim = r.state.size
  if (dim.kind === 'reserved-to-city') return { floor: null, why: `${r.state.state} states no ADU size — it expressly reserves bulk and dimensions to the city (${dim.cite}).` }
  if (dim.kind === 'not-addressed') return { floor: null, why: `${r.state.state}'s statute does not address ADU size. ${dim.detail}` }
  const b = dim.floors.find((f) => f.baseline) ?? dim.floors[0]
  if (b == null) return { floor: null, why: null }
  if (b.form === 'figure') return { floor: b, why: null }
  if (b.form === 'derived') return { floor: null, why: `${r.state.state} guarantees a size that is not a fixed figure — ${b.rule} (${b.cite}). It resolves only against the primary dwelling, so no state number is published here.` }
  if (b.form === 'band') return { floor: null, why: `${r.state.state} states no floor. ${b.unresolved} (${b.cite})` }
  return { floor: null, why: `${r.state.state} pegs this to ${b.withUse} rather than to a figure (${b.cite}).` }
}

/** ⚠️ ARE THE LOCAL CAP AND THE STATE FLOOR EVEN IN THE SAME UNIT?
 *
 *  `max(local, floor)` compares two integers, which is only meaningful if they
 *  measure the same thing. They frequently do not, and the labels actively
 *  mislead: Washington's statutory "gross floor area" is defined as interior
 *  habitable area, while a city using the identical phrase usually means the
 *  architectural measure taken to the exterior walls, which is larger.
 *
 *  So this never converts and never assumes. It returns a sentence to append
 *  wherever a comparison was made on an unestablished equivalence, and null when
 *  both sides name the same measure. Rule 4 — the honest output is "unpriced,
 *  disclosed", not a plausible number. */
function measureCaveat(localMeasure?: string, floorMeasure?: string): string | null {
  if (localMeasure != null && floorMeasure != null && localMeasure === floorMeasure) return null
  const named = [localMeasure ? `the city measures in ${localMeasure}` : 'the city\u2019s measure is not recorded',
                 floorMeasure ? `the state floor is stated in ${floorMeasure}` : 'the state\u2019s measure is not recorded']
  return ` ⚠️ These two figures may not be in the same unit — ${named.join(', and ')}. The comparison above rests on an equivalence this tool has not established, and no conversion between them is applied.`
}

export function effectiveMaxSize(r: AduRules): EffectiveSize {
  const { floor, why: floorWhy } = stateSizeFloor(r)
  if (r.local.kind !== 'read') {
    if (floor != null) {
      return {
        value: floor.value,
        source: 'floor-only',
        why: `Only the state floor is known (${floor.cite}). This is the MINIMUM the city cannot refuse, not what it allows — the local ordinance has not been read.`,
      }
    }
    // ⚠️ FOUR DIFFERENT NOTHINGS, and they must not read alike.
    if (r.state.kind === 'preempts') {
      return { value: null, source: 'state-no-figure', why: `${floorWhy ?? ''} The local ordinance has not been read either, so no size can be published for ${cityName(r.city)}.`.trim() }
    }
    if (r.state.kind === 'declines') {
      return { value: null, source: 'state-declines', why: `${r.state.state} has an ADU statute and it leaves the decision to the city (${r.state.citation}). ${r.state.detail} So the binding rule is ${cityName(r.city)}'s own ordinance, which has not been read.` }
    }
    if (r.state.kind === 'no-provision') {
      return { value: null, source: 'unresolved', why: `No ADU provision exists in ${r.state.scopeRead}, so the binding rule is ${cityName(r.city)}'s own ordinance — which has not been read.` }
    }
    return { value: null, source: 'unresolved', why: `Nobody has established which body of law governs ADUs in ${cityName(r.city)}. ${r.state.detail}` }
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
  // ⚠️ A NON-NUMERIC LIMIT STILL REPORTS THE FLOOR, because the floor is the one
  // figure that survives it: the state guarantee applies whatever geometry the
  // local programme imposes. Publishing `null` alone would read as "no answer",
  // and publishing it as `local-no-maximum` would read as "no limit" — the limit
  // is real, it just is not a quantity.
  if (baseline?.kind === 'not-numeric') {
    return {
      value: floor?.value ?? null,
      source: 'local-non-numeric',
      why:
        `The city's own limit for this case is not a square-foot figure — ${baseline.rule} (${baseline.cite}). ` +
        // ⚠️ THE COMPARISON SENTENCE IS CONDITIONAL ON THERE BEING SOMETHING TO
        // COMPARE TO. It was written when San Francisco was the only non-numeric
        // city, and "often TIGHTER than the state floor rather than looser" is
        // true of SF's geometric envelope under California's 850 sq ft guarantee.
        // Columbus, Milwaukee and Minneapolis are non-numeric with NO floor
        // beneath them — Ohio, Wisconsin and Minnesota all decline to preempt —
        // and the sentence rendered there names a state floor that does not
        // exist. Rule 9's corollary: disclosure copy is code, and a claim true in
        // one branch is false in the branch it is copied to.
        (floor != null
          ? `No maximum size can be published for it, and it is often TIGHTER than the state floor rather than looser.` +
            ` The ${floor.value.toLocaleString()} sq ft state floor (${floor.cite}) still applies as a minimum the city cannot refuse.`
          : `No maximum size can be published for it. The limit is real — it is simply not a quantity — and this state imposes no floor beneath it, so the city's own rule is the whole of the answer.`),
    }
  }
  if (baseline?.kind === 'capped') {
    const others = r.local.maxSizeSqFt.length - 1
    const more = others > 0 ? ` ${others} other configuration${others === 1 ? '' : 's'} the ordinance names allow more — see the full list.` : ''
    const floorNote =
      floor != null && baseline.sqFt < floor.value
        ? ` But this sits below the state floor of ${floor.value.toLocaleString()} sq ft (${floor.cite}), so it is void to that extent and the floor governs.`
        : ''
    const caveat = floor != null ? (measureCaveat(baseline.measure, floor.measure) ?? '') : ''
    return floor != null && baseline.sqFt < floor.value
      ? { value: floor.value, source: 'state-floor', why: `The city's baseline cap is ${baseline.sqFt.toLocaleString()} sq ft (${baseline.cite}).${floorNote}${caveat}` }
      : {
          value: baseline.sqFt,
          source: 'local',
          why: `${baseline.condition} (${baseline.cite})${floor != null ? `, at or above the ${floor.value.toLocaleString()} sq ft state floor (${floor.cite})` : ''}.${more}${caveat}`,
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
  const caveat2 = measureCaveat(biggestLocal.measure, floor.measure) ?? ''
  return biggestLocal.sqFt >= floor.value
    ? {
        value: biggestLocal.sqFt,
        source: 'local',
        why: `The city allows more than the state floor requires (${biggestLocal.sqFt.toLocaleString()} sq ft at ${biggestLocal.cite}, against a ${floor.value.toLocaleString()} sq ft floor at ${floor.cite}), so the local figure governs.${caveat2}`,
      }
    : {
        value: floor.value,
        source: 'state-floor',
        why: `The city's cap of ${biggestLocal.sqFt.toLocaleString()} sq ft sits below the state floor of ${floor.value.toLocaleString()} sq ft (${floor.cite}), so it is void to that extent and the floor governs.${caveat2}`,
      }
}

/** One line for the report. Says which instrument governs, and where the answer
 *  rests only on a state floor, that the figure is a minimum rather than a cap. */
export function summariseAdu(r: AduRules): string {
  const size = effectiveMaxSize(r)
  // ⚠️ THE NON-ANSWERS ARE DIFFERENT SENTENCES, and the ORDER matters — the
  // generic "nobody has looked" line used to sit first and swallow every one of
  // them. It is true of Georgia and false of Florida, Nevada and Massachusetts.
  if (size.source === 'state-declines' || size.source === 'state-no-figure') {
    return size.why
  }
  if (r.state.kind === 'no-provision' && r.local.kind !== 'read') {
    return (
      `No state ADU statute governs here — ${r.state.scopeRead} contains no ADU provision — so ` +
      `${cityName(r.city)}'s own ordinance is the binding rule, and it has not been read.`
    )
  }
  if (size.source === 'unresolved') {
    // The DISPLAY name, not the slug: "not a finding that denver has no ADU
    // rules" reads as a bug in a sentence whose whole job is to be trusted.
    return `Accessory dwelling unit rules for this city have not been read into this tool. That is a gap in our coverage, not a finding that ${cityName(r.city)} has no ADU rules — nobody has looked.`
  }
  if (size.source === 'floor-only' && r.state.kind === 'preempts') {
    const f = r.state
    // ⚠️ RE-DERIVED, NOT CAST. This branch used `size.value as number`, which is
    // safe only because `floor-only` happens to be produced with a non-null value
    // 140 lines away. That is precisely the shape that hid the crash below: a
    // cast type-checks against `number | null` and moves the failure to runtime,
    // so the invariant has to hold in a reader's head instead of in the type.
    // `stateSizeFloor` returns a narrowed figure or null, and the guard is real.
    const fig = stateSizeFloor(r).floor
    if (fig == null) return `${f.state} state law governs here, and states no publishable ADU size.`
    const hs = f.height
    const h = hs.kind === 'floors' ? (hs.floors.find((x) => x.baseline) ?? hs.floors[0]) : null
    const heightPhrase =
      h == null
        ? hs.kind === 'reserved-to-city'
          ? `${f.state} leaves height to the city (${hs.cite})`
          : `${f.state} does not address height`
        : h.form === 'figure'
          ? `at ${h.value} ft (${h.condition})`
          : h.form === 'parity'
            ? `at whatever height ${h.withUse} may reach (${h.cite})`
            : h.form === 'derived'
              ? `at a height given by ${h.rule}`
              : `within ${h.low}–${h.high} ft`
    return (
      `${f.state} state law sets what this city must allow, and these are FLOORS rather than limits — ` +
      `the city may permit more and its own ordinance has not been read. Unconditionally: a ` +
      `${fig.value.toLocaleString()} sq ft ADU ${heightPhrase} cannot be refused.`
    )
  }
  // ⚠️ THREE WAYS TO HAVE NO NUMBER, AND ONLY ONE OF THEM WAS HANDLED.
  //
  // This crashed on the first city to reach it: `local-non-numeric` yields a
  // null value, and the fallback branch cast it to a number and called
  // toLocaleString. The cast is what hid it — `size.value as number` type-checks
  // against `number | null` and defers the failure to runtime.
  //
  // ⚠️ Phoenix had the identical latent fault and never crashed, because no test
  // ran summariseAdu on a Phoenix ADU project. Rule 18's corollary exactly: the
  // absence of a wrong output is not evidence the code is right, and code that
  // did not run is not code that works. Las Vegas only differs in being
  // exercised by an existing hurdles test.
  const head =
    size.source === 'local-no-maximum'
      ? 'The city states no maximum size for an ADU built inside an existing structure.'
      : size.value == null
        ? 'No maximum size can be published for this city.'
        : `Up to ${size.value.toLocaleString()} sq ft.`
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
