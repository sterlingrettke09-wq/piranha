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
  /** The ordinance states a figure. */
  | { kind: 'capped'; sqFt: number; condition: string; cite: string; baseline?: boolean }
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
  | { kind: 'not-numeric'; rule: string; condition: string; cite: string; baseline?: boolean }
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
  /** The statute states a number. */
  | { form: 'figure'; value: number; condition: string; cite: string; baseline?: boolean }
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
      { form: 'figure', value: 850, condition: 'a city may not cap an ADU below this', cite: '§ 66321(b)(2)(A)', baseline: true },
      { form: 'figure', value: 1000, condition: 'for an ADU with more than one bedroom', cite: '§ 66321(b)(2)(B)' },
      {
        form: 'figure',
        value: 800,
        condition:
          'must be buildable with four-foot side and rear setbacks regardless of lot coverage, FAR, open space, front setbacks or minimum lot size',
        cite: '§ 66321(b)(3)',
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
    { value: '1 ADU + 1 JADU', condition: 'within the existing or proposed space of a single-family dwelling or accessory structure (up to 150 sq ft of expansion, for ingress and egress only)', cite: '§ 66323(a)(1)' },
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
      { form: 'figure', value: 1000, condition: 'a city may not cap gross floor area below this', cite: 'RCW 36.70A.681(1)(f)', baseline: true },
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
  size: {
    kind: 'reserved-to-city',
    cite: 'M.G.L. c. 40A § 3',
    detail:
      'The statute states no size. It provides that an ADU "may be subject to reasonable regulations, including ... regulations concerning dimensional setbacks and the bulk and height of structures" — an express reservation to the municipality.',
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
  ny: noProvision('New York', 'General City Law article 5-A (Buildings and Use Districts) — the zoning article of the law applicable to cities', 'seven sections and none of the chapter\u2019s 22 article titles mention accessory dwellings'),
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
    { kind: 'capped', sqFt: 1000, condition: 'An ADU on a lot of up to 9,000 sq ft may be up to 1,000 sq ft', cite: '§ 20.80.175.D.1.b (Table 20-55)', baseline: true },
    { kind: 'capped', sqFt: 1200, condition: 'on a lot greater than 9,000 sq ft', cite: '§ 20.80.175.D.1.c (Table 20-55)' },
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
      baseline: true,
    },
    {
      kind: 'capped',
      sqFt: 1000,
      condition: 'STATE-MANDATED programme (§ 207.2): the same, for an ADU with more than one bedroom',
      cite: '§ 207.2(c)(1)',
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
    local: NOT_READ_LOCAL('Boston'),
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
    stateApplies: {
      kind: 'not-established',
      why: 'Colorado binds a "subject jurisdiction" — a municipality of 1,000 or more INSIDE a metropolitan planning organisation. Denver clears the population half plainly. The MPO half has not been checked against the statute\u2019s own test and must not be assumed from size.',
    },
    local: NOT_READ_LOCAL('Denver'),
  },

  // ── Read, and the state does not preempt ─────────────────────────────────
  miami: { city: 'miami', state: FL, stateApplies: NA, local: NOT_READ_LOCAL('Miami') },
  charlotte: { city: 'charlotte', state: NO_PROVISION.nc, stateApplies: NA, local: NOT_READ_LOCAL('Charlotte') },
  raleigh: { city: 'raleigh', state: NO_PROVISION.nc, stateApplies: NA, local: NOT_READ_LOCAL('Raleigh') },
  austin: { city: 'austin', state: NO_PROVISION.tx, stateApplies: NA, local: NOT_READ_LOCAL('Austin') },
  dallas: { city: 'dallas', state: NO_PROVISION.tx, stateApplies: NA, local: NOT_READ_LOCAL('Dallas') },
  columbus: { city: 'columbus', state: NO_PROVISION.oh, stateApplies: NA, local: NOT_READ_LOCAL('Columbus') },
  milwaukee: { city: 'milwaukee', state: NO_PROVISION.wi, stateApplies: NA, local: NOT_READ_LOCAL('Milwaukee') },
  minneapolis: { city: 'minneapolis', state: NO_PROVISION.mn, stateApplies: NA, local: NOT_READ_LOCAL('Minneapolis') },
  dc: { city: 'dc', state: NO_PROVISION.dc, stateApplies: NA, local: NOT_READ_LOCAL('Washington, DC') },
  chicago: { city: 'chicago', state: NO_PROVISION.il, stateApplies: NA, local: NOT_READ_LOCAL('Chicago') },
  nyc: { city: 'nyc', state: NO_PROVISION.ny, stateApplies: NA, local: NOT_READ_LOCAL('New York City') },
  philadelphia: { city: 'philadelphia', state: NO_PROVISION.pa, stateApplies: NA, local: NOT_READ_LOCAL('Philadelphia') },

  // ── Georgia and Tennessee: whole-code searches, both clean ──────────────
  atlanta: { city: 'atlanta', state: NO_PROVISION.ga, stateApplies: NA, local: NOT_READ_LOCAL('Atlanta') },
  nashville: { city: 'nashville', state: NO_PROVISION.tn, stateApplies: NA, local: NOT_READ_LOCAL('Nashville') },
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
        `No maximum size can be published for it, and it is often TIGHTER than the state floor rather than looser.` +
        (floor != null
          ? ` The ${floor.value.toLocaleString()} sq ft state floor (${floor.cite}) still applies as a minimum the city cannot refuse.`
          : ''),
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
      `${(size.value as number).toLocaleString()} sq ft ADU ${heightPhrase} cannot be refused.`
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
