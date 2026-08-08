// Raleigh curated district height table — City of Raleigh Unified Development
// Ordinance (UDO).
//
// SOURCE. Every figure below was transcribed on 2026-08-07 from the OFFICIAL
// consolidated UDO text published by the City at
//   https://udo.raleighnc.gov/udo-book/print-all-chapters
// (the whole ordinance in one document — 1.71M characters of extracted text,
// fetched from the site's own print index rather than a guessed chapter path;
// CLAUDE.md rule 8). Not a mirror, not a summary, not Municode. Currency at the
// time of reading: Supplement 28 on Sec. 3.3.2, text change TC-1-25 on
// Sec. 2.2.8 and Sec. 4.6.2. Each value carries its section beside it.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — THE RALEIGH UDO IMPOSES NO FLOOR AREA RATIO. This is an ANSWER, not
// a lookup failure (CLAUDE.md rule 5), and it survives the slot test on the
// document's own structure rather than on a reader failing to find something:
//
//   · Every district dimensional table in Chapters 2, 3 and 4 is built from the
//     same lettered sections — Lot Dimensions / Building Setbacks / Parking
//     Setbacks / Height / Transparency / Allowed Building Elements. There is no
//     FAR row in ANY of them. The slot does not exist, in any chapter.
//   · Searched the entire ordinance text: the string "floor area ratio" occurs
//     exactly TWICE, both inside one traffic level-of-service site-plan
//     provision ("The office floor area ratio does not exceed 0.5; or / The
//     floor area ratio for commercial uses does not exceed 0.25"), which is a
//     trip-generation threshold for approving a site plan at a failing
//     intersection — not a district bulk standard. "Floor Area Ratio" never
//     appears as a heading.
//
// So `farUnconstrained: true` everywhere: floor area here is governed by
// height, setbacks and (in CM) building coverage. It must NEVER be allowed to
// fall through to an assumed FAR of 1.0.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — RALEIGH REGULATES IN BOTH FEET AND STORIES, AND THE TWO ARE NOT
// CONVERTIBLE. This module contains NO feet-per-story constant, and none may
// ever be added. Sec. 3.3.2's own table makes the reason arithmetical:
//
//     designation   stories   feet        implied ft/story
//     -3            3         50'         16.67
//     -4            4         68'         17.00
//     -5            5         80'         16.00
//
// Three different ratios in three adjacent columns. No single constant
// reproduces them, so any derivation of one unit from the other is guaranteed
// wrong — and would be wrong in the direction that publishes a taller building
// than the code allows. This is CLAUDE.md rule 12 (the Miami-21 87-story
// round-trip) with the disproof already in the source document. Carry what the
// code prints; where the code prints only one unit, the other stays null.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — THE MIXED-USE HEIGHT DESIGNATION STATES FEET ONLY UP TO -5.
// Sec. 3.3.1 enumerates the designations in prose and Sec. 3.3.2 tabulates
// them; the two agree, and a worked example in 3.3.1 confirms both:
//
//   VERBATIM, Sec. 3.3.1: "Each Mixed Use District must include one of the
//   following height designations. The designation establishes the maximum
//   height in stories and feet for each mixed use district. For example, CX-5
//   has a maximum height limit of 5 stories and 80 feet.
//       -3   3 stories / 50 feet max
//       -4   4 stories / 68 feet max
//       -5   5 stories / 80 feet max
//       -7   7 stories
//       -12  12 stories
//       -20  20 stories
//       -30  30 stories
//       -40  40 stories"
//
// and Sec. 3.3.2's table row A2 "Building height (max feet)" reads
// 50' | 68' | 80' | — | — | — | — | — across those same eight columns.
//
// ⚠️ The prose list is the load-bearing evidence here, NOT the table's blank
// cells (CLAUDE.md: "A blank cell is not this"). The list is an enumeration in
// which the feet component is simply not part of the -7-and-above designation,
// stated three times over in two forms. Even so, this module does not claim
// "no feet limit applies" for -7 and above — it reports the story count the
// code states and leaves feet null. That is the same claim either way and
// cannot overstate the envelope, because `maxStories` binds.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — R-DISTRICT HEIGHT IS STATED PER BUILDING TYPE, SO THE HEADLINE MUST
// NOT BE THE MAXIMUM ACROSS TYPES (CLAUDE.md rule 6). Article 2.2, read in
// full, is not one number per district:
//
//   district  Detached  Attached  Townhouse  Apartment  Civic    Open Lot  Tiny
//             2.2.1     2.2.2     2.2.3      2.2.4      2.2.5    2.2.6     2.2.8
//   R-1       40'/3     —         —          —          40'/3    40'/3     26'/2
//   R-2       40'/3     40'/3     40'/3      —          40'/3    40'/3     26'/2
//   R-4       40'/3     40'/3     40'/3      —          40'/3    40'/3     26'/2
//   R-6       40'/3     40'/3     45'/3      —          40'/3    40'/3     26'/2
//   R-10      40'/3     40'/3     45'/3      45'/3      45'/3    40'/3     26'/2
//
// The headline is 40 ft / 3 stories in all five districts — the detached-house
// figure, which is also the lowest of the common types. The 45-ft entries ride
// in `alternatives` as programs the applicant may elect. Publishing 45 as R-6's
// or R-10's ceiling would assume a townhouse or apartment program the user has
// not chosen, which is the Austin 0.40-or-0.65 mistake.
//
// The scouting note that fed this module said "R-1/R-2/R-4/R-6/R-10 detached,
// attached, townhouse, civic: 40'/3" — that is WRONG for townhouse in R-6 and
// R-10 (45') and wrong for civic in R-10 (45'). It was a plausible-looking
// summary and it did not survive contact with the table (CLAUDE.md rule 18).
//
// ⚠️ R-1 CARRIES A 68'/4 FIGURE THAT MUST NEVER BE PUBLISHED. Sec. 2.2.9
// General Building states 68'/4 stories in R-1, followed immediately by:
// "General Building type allowed in the above zoning district only as part of a
// governmental water or wastewater treatment plant use described in Sec.
// 6.3.3.E." It is not a development program a user can elect, so it is
// deliberately absent from `alternatives` and pinned absent by a test.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — WHAT THE OVERLAYS AND OPTIONS DO AND DO NOT CHANGE. Checked, because
// each is a live rule-6 hazard:
//
//   · Frequent Transit Development Option (Sec. 2.7.1) — does NOT raise height.
//     Its own height rows E1-E3 read 40'/3 detached-attached, 45'/3
//     townhouse-apartment, 26'/2 tiny house: the same figures Article 2.2
//     already states. What it relaxes is lot area, lot width and site area per
//     dwelling unit. A DENSITY option, not a height option.
//   · Transit Overlay District -TOD (Sec. 5.5.1.I) — in a RESIDENTIAL district
//     it applies mandatorily where mapped: single- and two-unit living limited
//     to 3 stories and 40 feet, "All other principal building types shall be
//     limited to 4 stories and 60 feet in height." In a MIXED USE district it
//     is elective and conditional: stories "may be increased by fifty percent
//     (50%)" only where the added stories are residential AND 20% of the units
//     in them are deed-restricted affordable at 60% AMI for 30 years, or by 30%
//     for wholly non-residential structures. Those are EARNED bonuses and this
//     module never returns them. The provider surfaces -TOD presence instead.
//   · Conditional-use districts (the "-CU" suffix, on 1,386 of 3,580 mapped
//     polygons) carry per-case conditions recorded in a signed ordinance that
//     can cap height, units or use BELOW the base district. The base figure is
//     therefore a ceiling the site may not actually have; the provider labels
//     it and links the ordinance rather than publishing an unqualified maximum.

/** What the UDO prints for a district. Feet and stories are INDEPENDENT
 *  readings, each nullable, and neither is ever computed from the other —
 *  there is no feet-per-story constant in this module by construction. */
export interface RaleighLimits {
  /** Maximum height in FEET, exactly as the UDO prints it. `null` means the
   *  UDO states no feet figure for this district (every mixed-use designation
   *  of -7 and above), NOT that we failed to look it up. */
  heightFt: number | null
  /** Maximum height in STORIES, exactly as the UDO prints it. `null` means the
   *  UDO states no story count (MH caps feet only). */
  stories: number | null
  /** UDO section(s) the figures above were transcribed from. Required on every
   *  resolved district — a value without a citation cannot be constructed. */
  source: string
  /** The UDO imposes no floor-area ratio here — a KNOWN absence (see FACT 1).
   *  True for every district the UDO governs; false only when the code string
   *  resolved to nothing at all, where we assert nothing. */
  farUnconstrained: boolean
  /** True where the district has NO by-right dimensional standards because an
   *  approved master plan governs (PD). An ANSWER — "the base code sets no
   *  height here" — not a failed lookup. Renders differently from a gap. */
  masterPlanGoverned?: boolean
  /** True where by-right standards exist but an adopted master plan may modify
   *  them (CMP, Sec. 4.6.2). The figures are real; they are also overridable. */
  masterPlanMayModify?: boolean
  /** Other building types the UDO allows in this district, each with its own
   *  height. ALTERNATIVES the applicant elects — never a range around the
   *  headline and never a ceiling (CLAUDE.md rule 6). */
  alternatives?: RaleighAlternative[]
  /** Maximum building coverage as a fraction of lot area, where the district
   *  table states one (CM only, Sec. 4.2.2 A3: 5%). Raleigh has no FAR, so on
   *  CM this is the instrument that actually binds floor area. */
  maxBuildingCoverage?: number
}

export interface RaleighAlternative {
  /** Building type as the UDO names it, e.g. "Townhouse". */
  label: string
  heightFt: number | null
  stories: number | null
  source: string
}

/** The base district vocabulary, as mapped. Measured 2026-08-07 against the
 *  live layer: `ZONE_TYPE` takes exactly these 18 values and no others. */
export type RaleighBaseDistrict =
  | 'R-1' | 'R-2' | 'R-4' | 'R-6' | 'R-10'
  | 'RX-' | 'OP-' | 'OX-' | 'NX-' | 'CX-' | 'DX-' | 'IX-'
  | 'AP' | 'CM' | 'CMP' | 'IH' | 'MH' | 'PD'

/** Everything a zoning code string decomposes into. `base` is null when the
 *  string matched no known district — an unresolved GAP, distinct from every
 *  resolved answer above. */
export interface RaleighZoneParts {
  /** Base district, e.g. 'R-10' or 'CX-'. Null when unrecognised. */
  base: RaleighBaseDistrict | null
  /** Height designation for mixed-use codes (3, 4, 5, 7, 12, 20, 30, 40). */
  heightDesignation: number | null
  /** Frontage suffix, e.g. 'SH'. Null where the code carries none. */
  frontage: string | null
  /** The code carries the "-CU" conditional-use suffix: a signed ordinance
   *  records conditions that may bind BELOW the base district. */
  conditional: boolean
}

// ── Constructors ────────────────────────────────────────────────────────────
// Rule 14: convert the caught error into an impossible state rather than a
// comment. Every entry is built by one of these four, each of which takes ONLY
// figures the UDO prints and a mandatory citation. There is deliberately no
// constructor that accepts a story count and produces feet (or the reverse),
// so the Miami/Denver derivation defect cannot be reintroduced by writing a
// new table row — it would have to be reintroduced by writing a new
// constructor, which is a visible, reviewable act.

/** The UDO prints BOTH a feet cap and a story cap for this district. */
function feetAndStories(heightFt: number, stories: number, source: string): RaleighLimits {
  return { heightFt, stories, source, farUnconstrained: true }
}

/** The UDO prints a story cap and NO feet cap (mixed-use -7 and above). */
function storiesOnly(stories: number, source: string): RaleighLimits {
  return { heightFt: null, stories, source, farUnconstrained: true }
}

/** The UDO prints a feet cap and NO story cap (MH, Sec. 4.5.3.B). */
function feetOnly(heightFt: number, source: string): RaleighLimits {
  return { heightFt, stories: null, source, farUnconstrained: true }
}

/** No by-right dimensional standards; an approved master plan governs (PD). */
function masterPlanGoverned(source: string): RaleighLimits {
  return { heightFt: null, stories: null, source, farUnconstrained: true, masterPlanGoverned: true }
}

// ── Mixed-use height designations — UDO Sec. 3.3.1 and Sec. 3.3.2 (Supp. 28) ──
// Keyed by the numeric designation carried in the code string (CX-5 → 5) and,
// independently, by the live layer's HEIGHT field. Feet exist only for 3/4/5.
export const RALEIGH_HEIGHT_DESIGNATIONS: Record<number, RaleighLimits> = {
  3: feetAndStories(50, 3, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1/A2 (-3: 3 stories / 50 feet max)'),
  4: feetAndStories(68, 4, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1/A2 (-4: 4 stories / 68 feet max)'),
  5: feetAndStories(80, 5, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1/A2 (-5: 5 stories / 80 feet max)'),
  // Sec. 3.3.1 states these as stories alone; Sec. 3.3.2 row A2 carries no feet
  // for them. Reported as stories, feet null. NEVER stories × a constant.
  7: storiesOnly(7, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1 (-7: 7 stories; no feet stated)'),
  12: storiesOnly(12, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1 (-12: 12 stories; no feet stated)'),
  20: storiesOnly(20, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1 (-20: 20 stories; no feet stated)'),
  30: storiesOnly(30, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1 (-30: 30 stories; no feet stated)'),
  40: storiesOnly(40, 'UDO Sec. 3.3.1 & Sec. 3.3.2 A1 (-40: 40 stories; no feet stated)'),
}

// ── Residential districts — UDO Article 2.2, Conventional Development Option ──
// Headline = Sec. 2.2.1 Detached House. See FACT 4 for the full per-type grid
// and for why the 45-ft figures are alternatives rather than the headline.
const DETACHED = 'UDO Sec. 2.2.1 D1, Detached House (40 ft / 3 stories)'

function residential(alternatives: RaleighAlternative[] = []): RaleighLimits {
  const base = feetAndStories(40, 3, DETACHED)
  return alternatives.length > 0 ? { ...base, alternatives } : base
}

export const RALEIGH_RESIDENTIAL: Record<string, RaleighLimits> = {
  'R-1': residential(),
  'R-2': residential(),
  'R-4': residential(),
  // Sec. 2.2.3 E1: townhouse rises to 45' in R-6 and R-10 (it is 40' in R-2/R-4).
  'R-6': residential([
    { label: 'Townhouse', heightFt: 45, stories: 3, source: 'UDO Sec. 2.2.3 E1' },
  ]),
  // R-10 is the only R district in which the Apartment building type appears at
  // all (Sec. 2.2.4 has a single column, R-10), and its civic column also rises.
  'R-10': residential([
    { label: 'Townhouse', heightFt: 45, stories: 3, source: 'UDO Sec. 2.2.3 E1' },
    { label: 'Apartment', heightFt: 45, stories: 3, source: 'UDO Sec. 2.2.4 D1' },
    { label: 'Civic building', heightFt: 45, stories: 3, source: 'UDO Sec. 2.2.5 D1' },
  ]),
}

// ── Special districts — UDO Chapter 4 ────────────────────────────────────────
export const RALEIGH_SPECIAL: Record<string, RaleighLimits> = {
  // Sec. 4.3.1 C1 (Detached House) and Sec. 4.3.2 D1 (General Building) both
  // read "All structures (max) 40'/3 stories" — the two building types the AP
  // district has, and they agree, so there is no rule-6 spread here.
  AP: feetAndStories(40, 3, 'UDO Sec. 4.3.1 C1 & Sec. 4.3.2 D1 (AP: 40 ft / 3 stories)'),

  // Sec. 4.2.2 is a single Open Lot table. C1 "All buildings/structures (max)
  // 40'/3 stories"; A3 "Building coverage (max) 5%". With no FAR anywhere in
  // the UDO, that 5% coverage cap is what actually binds floor area on CM land.
  CM: {
    ...feetAndStories(40, 3, 'UDO Sec. 4.2.2 C1 (CM: 40 ft / 3 stories)'),
    maxBuildingCoverage: 0.05,
  },

  // Sec. 4.6.1.C, verbatim: "Building height: 50 feet or 3 stories maximum."
  // Sec. 4.6.2.A lets a City-Council-approved Campus Master Plan modify the
  // district dimensional standards, so the figure is real but overridable.
  CMP: {
    ...feetAndStories(50, 3, 'UDO Sec. 4.6.1.C (CMP: 50 feet or 3 stories maximum)'),
    masterPlanMayModify: true,
  },

  // Sec. 4.4.1 D1 "All structures (max) 50' / 3 stories".
  IH: feetAndStories(50, 3, 'UDO Sec. 4.4.1 D1 (IH: 50 ft / 3 stories)'),

  // Sec. 4.5.3.B, verbatim and complete: "No building or structure may exceed a
  // height of 40 feet." Feet, with NO story count anywhere in Article 4.5 —
  // so `stories` stays null. Deriving one would be inventing a number.
  MH: feetOnly(40, 'UDO Sec. 4.5.3.B (MH: "No building or structure may exceed a height of 40 feet")'),

  // Sec. 4.7.1: "A PD District is a customized zoning district that must be
  // approved along with a Planned Development Master Plan". Sec. 4.7.2 lets the
  // approved plan modify Chapters 2 and 3 wholesale. There is no by-right base
  // height to report — the same shape as Nashville's SP districts.
  //
  // farUnconstrained stays TRUE here, and that is a claim about the UDO, not a
  // guess about the master plan: Sec. 4.7.2 permits a PD to MODIFY listed UDO
  // chapters, and no UDO chapter contains a floor-area-ratio instrument for it
  // to modify (FACT 1). A PD cannot mint a FAR that the ordinance does not have.
  PD: masterPlanGoverned('UDO Sec. 4.7.1 & Sec. 4.7.2 (PD: approved master plan governs)'),
}

/** Unresolved — the code string matched no district. Asserts NOTHING: not a
 *  height, not a story count, and specifically NOT `farUnconstrained`. A gap
 *  must never render as the known absence in FACT 1. */
const UNRESOLVED: RaleighLimits = {
  heightFt: null,
  stories: null,
  source: '',
  farUnconstrained: false,
}

/** UDO Sec. 3.1.2, "Use and Base Dimensions" — the seven mixed-use prefixes,
 *  verbatim: "(RX-, OP-, OX-, NX-, CX-, DX-, IX-)". */
const MIXED_USE_PREFIXES = ['RX', 'OP', 'OX', 'NX', 'CX', 'DX', 'IX'] as const
/** UDO Sec. 3.1.2, "Frontage" — the eight frontages, verbatim: "(-PK, -DE,
 *  -PL, -GR, -UL, -UG, -SH, -GP)". Confirmed 2026-08-07 as exactly the set the
 *  live layer carries in FRONTAGE, no more and no less. */
const FRONTAGES = ['PK', 'DE', 'PL', 'GR', 'UL', 'UG', 'SH', 'GP'] as const

// Built FROM the arrays above so the vocabulary has exactly one definition.
// A second, hand-maintained copy inside a regex literal is how a district
// silently stops resolving when the list is edited and the pattern is not.
const MIXED_USE_RE = new RegExp(`^(${MIXED_USE_PREFIXES.join('|')})-(\\d{1,2})(?:-([A-Z]{2}))?$`)

/**
 * Decompose a Raleigh zoning code string into its UDO components.
 *
 * UDO Sec. 3.1.2: a Mixed Use District is "Use and Base Dimensions (RX-, OP-,
 * OX-, NX-, CX-, DX-, IX-); Height (-3, -4, -5, -7, -12, -20, -30, -40); and
 * Frontage (-PK, -DE, -PL, -GR, -UL, -UG, -SH, -GP)", with the height
 * designation mandatory and the frontage optional. Residential and special
 * districts carry no such components. Any code may carry a trailing "-CU".
 *
 * Returns `base: null` for anything unrecognised rather than guessing.
 */
export function parseRaleighZone(code: string | null | undefined): RaleighZoneParts {
  const empty: RaleighZoneParts = { base: null, heightDesignation: null, frontage: null, conditional: false }
  if (!code) return empty
  let z = code.trim().toUpperCase()
  if (!z) return empty

  // The conditional-use suffix is always last (e.g. "CX-12-UG-CU", "R-10-CU").
  const conditional = /-CU$/.test(z)
  if (conditional) z = z.slice(0, -3)

  // Residential districts FIRST: R-10 also ends in a number, and reading that
  // number as a mixed-use height designation would publish 10 stories for a
  // district whose trailing digit is a density/lot-size tier — the Denver "B-3"
  // failure mode. Sec. 2.1.1 names exactly five; anything else is not an R
  // district.
  if (/^R-(1|2|4|6|10)$/.test(z)) {
    return { base: z as RaleighBaseDistrict, heightDesignation: null, frontage: null, conditional }
  }

  if (/^(AP|CM|CMP|IH|MH|PD)$/.test(z)) {
    return { base: z as RaleighBaseDistrict, heightDesignation: null, frontage: null, conditional }
  }

  const mu = z.match(MIXED_USE_RE)
  if (mu) {
    const prefix = mu[1] as (typeof MIXED_USE_PREFIXES)[number]
    const designation = Number(mu[2])
    const frontage = mu[3] ?? null
    // Only the eight designations Sec. 3.1.2 lists are valid. A code carrying
    // anything else is not a district we recognise — say so rather than
    // inventing a height for it.
    if (!(designation in RALEIGH_HEIGHT_DESIGNATIONS)) return { ...empty, conditional }
    if (frontage && !FRONTAGES.includes(frontage as (typeof FRONTAGES)[number])) {
      return { ...empty, conditional }
    }
    return { base: `${prefix}-` as RaleighBaseDistrict, heightDesignation: designation, frontage, conditional }
  }

  return { ...empty, conditional }
}

/**
 * Resolve the height limits the Raleigh UDO states for a zoning code.
 *
 * Mixed-use districts resolve from the height designation carried in the code
 * itself (Sec. 3.3.1/3.3.2); residential and special districts resolve from the
 * curated Chapter 2 / Chapter 4 tables above. Every resolved result carries a
 * UDO citation and `farUnconstrained: true`.
 *
 * An unrecognised code returns nulls with `farUnconstrained: false` — a GAP,
 * which must not render as FACT 1's known absence.
 *
 * NEVER derives feet from stories or stories from feet (FACT 2), and never
 * returns a bonus, incentive or overlay figure (FACT 5).
 */
export function resolveRaleigh(code: string | null | undefined): RaleighLimits {
  const parts = parseRaleighZone(code)
  if (!parts.base) return UNRESOLVED

  if (parts.heightDesignation != null) {
    return RALEIGH_HEIGHT_DESIGNATIONS[parts.heightDesignation]
  }
  return RALEIGH_RESIDENTIAL[parts.base] ?? RALEIGH_SPECIAL[parts.base] ?? UNRESOLVED
}

/**
 * Coarse use vocabulary for a Raleigh district.
 *
 * Sourced to the UDO's Allowed Principal Use Table (Sec. 6.1.4), read
 * 2026-08-07 — not inferred from the district's name. Its columns are
 * R-1 | R-2 | R-4 | R-6 | R-10 | RX- | OP- | OX- | NX- | CX- | DX- | IX- |
 * CM | AP | IH | MH, with P permitted, L limited, S special, "--" not allowed.
 * CMP and PD have no column because a master plan sets their uses.
 *
 * ⚠️ OP- IS NOT RESIDENTIAL, and this is the one mapping a name-based guess
 * gets wrong. "Office Park" looks like the other mixed-use districts and sits
 * in the same chapter, but its column reads "--" for Single-unit living,
 * Two-unit living, Multi-unit living AND Group Living. Reading the OP- prefix
 * as mixed-use would assert housing rights the code does not grant.
 *
 * Returns null rather than guessing where the code is unrecognised, or where
 * the district's real answer cannot be expressed in this four-token vocabulary.
 */
export function usesForZone(code: string | null | undefined): string[] | null {
  const { base } = parseRaleighZone(code)
  if (!base) return null

  switch (base) {
    // Sec. 6.1.4: single-unit living P in all five; multi-unit living is "--"
    // in R-1, L in R-2/R-4, P in R-6/R-10. Coarsely: residential.
    case 'R-1':
    case 'R-2':
    case 'R-4':
    case 'R-6':
    case 'R-10':
      return ['residential']

    // Sec. 6.1.4 MH column: Single-unit living P, Manufactured home
    // development L. No office, no retail.
    case 'MH':
      return ['residential']

    // Residential Mixed Use: single-unit P, multi-unit P, Office L, Medical L.
    case 'RX-':
      return ['residential', 'mixed', 'commercial']

    // Office/Neighbourhood/Commercial/Downtown Mixed Use: household living P
    // AND Office P — genuinely mixed.
    case 'OX-':
    case 'NX-':
    case 'CX-':
    case 'DX-':
      return ['commercial', 'mixed', 'residential']

    // Office Park. See the warning above: every household-living row is "--".
    // Office P, Medical P, Light Manufacturing P, Civic P.
    case 'OP-':
      return ['commercial', 'institutional']

    // Industrial Mixed Use: Office P, Light Manufacturing P, Civic P;
    // single- and two-unit living "--" and multi-unit living only L. Residential
    // is not asserted, because it is not permitted by right.
    case 'IX-':
      return ['commercial', 'institutional']

    // Heavy Industrial: Office P, Light Manufacturing P, Civic P; no household
    // living of any kind.
    case 'IH':
      return ['commercial', 'institutional']

    // Agricultural Productive: Agriculture P, Single-unit living P (Sec. 4.3.1
    // allows one detached house per agriculture tract), Civic P.
    case 'AP':
      return ['residential', 'institutional']

    // Campus. No Sec. 6.1.4 column; Sec. 4.6.1.A requires the district be under
    // one entity with "a significant governmental interest or be a hospital,
    // college or university", and Sec. 4.6.2.B lets the Campus Master Plan set
    // the use table.
    case 'CMP':
      return ['institutional']

    // Conservation Management. Its Sec. 6.1.4 column is "--" for every
    // household-living, office, retail and even Civic row; the district's only
    // building type is Open Lot at 5% coverage (Sec. 4.2.2) with 30% of the
    // land in tree conservation (Sec. 4.2.1). The honest answer is "essentially
    // no principal use by right", which this four-token vocabulary cannot say —
    // and 'institutional' would assert a civic use the table explicitly denies.
    // So: null. A gap render is correct; a wrong assertion is not.
    case 'CM':
      return null

    // Planned Development: the approved master plan sets the uses (Sec. 4.7.2),
    // so the base code says nothing. Same treatment as Nashville's SP.
    case 'PD':
      return null
  }
}

/** Human-readable district name, as the live layer's own ZONE_TYPE_DECODE
 *  spells it. Used for the `article` label; measured against the layer
 *  2026-08-07 rather than transcribed by hand. */
export const RALEIGH_DISTRICT_NAMES: Record<RaleighBaseDistrict, string> = {
  'R-1': 'Residential-1',
  'R-2': 'Residential-2',
  'R-4': 'Residential-4',
  'R-6': 'Residential-6',
  'R-10': 'Residential-10',
  'RX-': 'Residential Mixed Use',
  'OP-': 'Office Park',
  'OX-': 'Office Mixed Use',
  'NX-': 'Neighborhood Mixed Use',
  'CX-': 'Commercial Mixed Use',
  'DX-': 'Downtown Mixed Use',
  'IX-': 'Industrial Mixed Use',
  AP: 'Agricultural Productive',
  CM: 'Conservation Management',
  CMP: 'Campus',
  IH: 'Heavy Industrial',
  MH: 'Manufactured Housing',
  PD: 'Planned Development',
}

/** Frontage suffix → the name UDO Sec. 3.1.2 / Article 3.4 gives it. */
export const RALEIGH_FRONTAGE_NAMES: Record<string, string> = {
  PK: 'Parkway',
  DE: 'Detached',
  PL: 'Parking Limited',
  GR: 'Green',
  UL: 'Urban Limited',
  UG: 'Urban General',
  SH: 'Shopfront',
  GP: 'Green Plus',
}
