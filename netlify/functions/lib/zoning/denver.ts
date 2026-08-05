// Denver curated district FAR/height table (WO-8.8 depth tranche 1).
//
// Source: Denver Zoning Code (DZC), Articles 3–9 (Neighborhood Context
// chapters) and Article 13 (Rules of Measurement / Definitions), as published
// at denvergov.org. Verified 2026-06-10.
//
// KEY DEPTH FACT — Denver is a FORM-BASED code. The common form-based districts
// (Suburban SU/TU, Urban RH/RO, the Mixed-Use MX/MS/MU/RX families, Downtown
// D-*) are governed by HEIGHT (in stories) + setbacks + bulk-plane, NOT by a
// floor-area ratio. There is no FAR table for these districts to "look up." So
// the honest curated table here is { far: null } with a derived height, and
// that null is itself DEPTH: it tells the feasibility engine to check height
// (which IS published) and lets the envelope label the district
// "height-governed" instead of pretending a FAR exists.
//
// Denver encodes maximum height as the TRAILING STORIES NUMBER in the code:
//   C-MX-5   → 5 stories
//   G-MU-3   → 3 stories
//   U-RH-2.5 → 2.5 stories
// The live ZONING service carries this in HEIGHT_STORIES, which the provider
// already uses.
//
// ⚠️ CORRECTED 2026-08-05 — DO NOT RE-DERIVE FEET FROM STORIES.
// This file used to publish height as `stories × 12`. That was wrong, and the
// DZC says so in print: the building-form tables carry TWO separate rows,
// "Stories (max)" AND "Feet (max)", and the printed feet are LARGER than 12×
// the printed stories in every Urban Center district:
//
//   district    published (stories × 12)   DZC "Feet (max)"
//   C-MX-5              60 ft                    70 ft
//   C-MX-8              96 ft                   110 ft
//   C-MX-12            144 ft                   150 ft
//   C-RX-5              60 ft                    70 ft
//
// Verified 2026-08-05 by reading DZC Article 7 (Urban Center (C-) Neighborhood
// Context), Division 7.3, Sec. 7.3.3 "Building Form Standards for Primary
// Structures", §7.3.3.3.D "General" (printed page 7.3-13) and §7.3.3.3.I
// "Shopfront" (printed page 7.3-23), in the officially republished PDF
// (June 25, 2010 | Republished February 25, 2025). CLAUDE.md rule 12: carry the
// figure the code states; never convert through a unit the code does not use.
//
// The DZC prints a second height row, "Stories/Feet, with incentives (max)"
// (C-MX-5 → 7/95', C-MX-8 → 12/150', C-MX-12 → 16/200'), governed by Sec.
// 10.12.1, Height Incentives. Those are EARNED, not by-right, and this table
// must never carry them — CLAUDE.md rule 6.

/** Where `heightFt` came from.
 *  - 'code-stated'      the DZC prints this exact number in a "Feet (max)" row.
 *  - 'derived-estimate' no printed feet has been read for this district yet, so
 *                       the value is still stories × DENVER_FT_PER_STORY. This
 *                       is a GAP wearing a number, not an answer (rule 5), and
 *                       it is labelled so it can never again pass for the
 *                       former. */
export type HeightBasis = 'code-stated' | 'derived-estimate'

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
  /** Story count the CODE states (Denver encodes it as the trailing token:
   *  C-MX-5 → 5). Carried so consumers never re-derive it from feet — doing so
   *  divides by a DIFFERENT floor-to-floor constant and drifts. Measured
   *  2026-08-04: C-MX-12 came back as 13 stories, C-MX-16 as 17, C-MX-20 as 21. */
  stories?: number | null
  /** See HeightBasis. Absent only where heightFt is null. */
  heightBasis?: HeightBasis
  /** TRUE where the DZC imposes no FAR on this district at all — a KNOWN
   *  absence. Distinct from `far: null` alone, which this file also uses for
   *  "unresolved" (Former Chapter 59, unrecognised codes). Without this flag
   *  both states collapse and `defaultSpec` falls back to an unsourced FAR-1.0
   *  assumption on every Denver parcel. See docs/plans/2026-08-04-far-unconstrained-sweep.md */
  farUnconstrained?: boolean
}

// The form-based districts below are height/setback/bulk-plane governed with no
// FAR anywhere in the DZC — sourced to Articles 3–9 (Neighborhood Context
// chapters) building-form standards, verified 2026-06-10 and re-confirmed for
// this classification 2026-08-04. This is the "known absence" case.
const FORM_BASED: Pick<DistrictLimits, 'far' | 'farUnconstrained'> = {
  far: null,
  farUnconstrained: true,
}

// Unresolved: we could not establish whether a FAR applies. NOT the same claim.
const FAR_UNRESOLVED: Pick<DistrictLimits, 'far' | 'farUnconstrained'> = { far: null }

/** Legacy floor-to-floor estimate. NOT a DZC figure — the code fixes no single
 *  ft/story. Still exported because `providers/denver.ts` converts the live
 *  HEIGHT_STORIES field with it, but NOTHING in the curated table below may use
 *  it: a district whose printed "Feet (max)" has been read carries that number
 *  instead. Every district still routed through it is a known gap, flagged
 *  `heightBasis: 'derived-estimate'`. */
export const DENVER_FT_PER_STORY = 12

/** A form-based district whose DZC building-form table states BOTH numbers.
 *  Feet is a REQUIRED argument read off the code's own "Feet (max)" row — it is
 *  deliberately impossible to construct a code-stated entry without supplying
 *  it, because computing it from `stories` is the exact defect this replaced
 *  (`storeys(n)` emitted `n × 12` and published 60/96/144 ft where the DZC
 *  prints 70/110/150). Rule 12: carry the figure the code states.
 *  @param stories the code's "Stories (max)" row
 *  @param feet    the code's "Feet (max)" row — by-right, never the incentive row */
function coded(stories: number, feet: number): DistrictLimits {
  return { ...FORM_BASED, stories, heightFt: feet, heightBasis: 'code-stated' }
}

/** A form-based district whose story count is code-stated (the trailing token)
 *  but whose printed "Feet (max)" has NOT been read from the DZC yet. The
 *  height is the legacy stories × 12 estimate and is flagged as such, so it is
 *  greppable and cannot be mistaken for a sourced figure. Articles 3-6 have the
 *  same two-row tables Article 7 does, and spot-checking them shows the same
 *  drift (DZC Art. 6 §6.3.3.3, Apartment form: G-MU-5 prints 65', not 60'), so
 *  every entry below is a candidate for `coded()` once its article is read. */
function storiesOnlyFeetUnverified(stories: number): DistrictLimits {
  return {
    ...FORM_BASED,
    stories,
    heightFt: Math.round(stories * DENVER_FT_PER_STORY),
    heightBasis: 'derived-estimate',
  }
}

export const DENVER_LIMITS: Record<string, DistrictLimits> = {
  // ── Articles 3-6 (Suburban S-, Urban Edge E-, Urban U-, General Urban G-) ──
  // Story counts are code-stated; printed "Feet (max)" NOT yet read. See
  // storiesOnlyFeetUnverified(). These heights are estimates, flagged as such.
  'U-SU-A': storiesOnlyFeetUnverified(2.5), // single-unit
  'U-SU-B': storiesOnlyFeetUnverified(2.5),
  'U-TU-B': storiesOnlyFeetUnverified(2.5), // two-unit
  'E-SU-D': storiesOnlyFeetUnverified(2.5),
  'S-SU-D': storiesOnlyFeetUnverified(2.5),
  'U-RH-2.5': storiesOnlyFeetUnverified(2.5),
  'U-RH-3A': storiesOnlyFeetUnverified(3),
  'U-RO-3': storiesOnlyFeetUnverified(3),
  'U-MX-2': storiesOnlyFeetUnverified(2),
  'U-MX-3': storiesOnlyFeetUnverified(3),
  'U-MS-3': storiesOnlyFeetUnverified(3),
  'U-MS-5': storiesOnlyFeetUnverified(5),
  'G-MU-3': storiesOnlyFeetUnverified(3),
  'G-MU-5': storiesOnlyFeetUnverified(5),
  'G-RH-3': storiesOnlyFeetUnverified(3),
  'S-MX-3': storiesOnlyFeetUnverified(3),
  'S-MX-5': storiesOnlyFeetUnverified(5),
  'S-MX-8': storiesOnlyFeetUnverified(8),

  // ── Article 7, Urban Center (C-) — READ FROM THE CODE 2026-08-05 ──
  // DZC Art. 7, Div. 7.3, Sec. 7.3.3, §7.3.3.3.D "General", printed p. 7.3-13.
  // Columns: C-MX-3 | C-RX-5/C-MX-5 | C-RX-8/C-MX-8 | C-RX-12/C-MX-12 | C-MX-16 | C-MX-20
  //   Stories (max)   3     5      8     12     16     20
  //   Feet (max)     45'   70'   110'   150'   200'   250'
  // (The "Stories/Feet, with incentives" row — 4/55', 7/95', 12/150', 16/200',
  //  22/275', 30/375' — is Sec. 10.12.1 Height Incentives: earned, NOT by-right.)
  'C-MX-3': coded(3, 45),
  'C-MX-5': coded(5, 70), // was 60 ft (5 × 12)
  'C-MX-8': coded(8, 110), // was 96 ft (8 × 12)
  'C-MX-12': coded(12, 150), // was 144 ft (12 × 12)
  'C-MX-16': coded(16, 200),
  'C-MX-20': coded(20, 250),
  // C-RX shares the C-MX column in the same "General" table, same page.
  'C-RX-5': coded(5, 70), // was 60 ft (5 × 12)
  'C-RX-8': coded(8, 110),
  'C-RX-12': coded(12, 150),
  // Main Street takes the Shopfront form: §7.3.3.3.I, printed p. 7.3-23.
  // Columns: C-MX-3 | C-MS-5/C-MX-5 | C-MS-8/C-MX-8 | C-MS-12/C-MX-12 | ...
  //   Stories (max)     3       5        8       12
  //   Feet (min/max) na/45' 24'/70' 24'/110' 24'/150'   ← max carried; min ignored
  'C-MS-5': coded(5, 70), // was 60 ft (5 × 12)
  'C-MS-8': coded(8, 110),
  'C-MS-12': coded(12, 150),
}

/**
 * Resolve Denver FAR + height for a zone code.
 *
 * FAR is always null for the form-based code (Denver does not regulate these
 * districts by floor-area ratio — see file header).
 *
 * Height comes from the curated table where the district's printed "Feet (max)"
 * has been read from the DZC (`heightBasis: 'code-stated'` — all of Article 7).
 * Otherwise the trailing stories token gives the story count and the height
 * falls back to the stories × 12 estimate, flagged `'derived-estimate'`.
 * Callers that need a sourced height MUST check heightBasis; the two are not
 * interchangeable. Returns { far: null, heightFt: null } when the code is
 * unknown or carries no parseable stories token. NEVER guesses a FAR.
 *
 * Legacy "Former Chapter 59" districts put a district CLASS in the trailing
 * number (not a story count); callers that know they are in a Former-Chapter-59
 * context should pass `formerChapter59: true` so we do not misread it as height.
 */
export function resolveDenver(
  zone: string | null | undefined,
  opts: { formerChapter59?: boolean } = {},
): DistrictLimits {
  // No zone supplied — nothing was resolved. NOT a known absence.
  if (!zone) return { ...FAR_UNRESOLVED, heightFt: null }
  const z = zone.trim().toUpperCase()

  // Documentation-snapshot hit (exact match) — keeps the static table and the
  // resolver in lock-step for the common codes.
  if (z in DENVER_LIMITS) return DENVER_LIMITS[z]

  // Former Chapter 59 (pre-2010 recode) trailing numbers are class codes, not
  // story counts — never read a height from them.
  //
  // ⚠️ MUST STAY UNRESOLVED, NOT "unconstrained". Chapter 59 was a conventional
  // Euclidean code that DID impose FAR in some districts, and we do not carry
  // that table. Marking these form-based would assert a known absence we have
  // not established — precisely the failure this sweep exists to prevent.
  if (opts.formerChapter59) return { ...FAR_UNRESOLVED, heightFt: null }

  // Trailing numeric stories token (e.g. G-MU-3, C-MX-5, U-RH-2.5). A parseable
  // stories suffix identifies a post-2010 form-based district: height-governed,
  // no FAR (DZC Arts. 3–9).
  const m = z.match(/-(\d+(?:\.\d+)?)$/)
  if (m) {
    const n = Number(m[1])
    // Stories are code-stated; feet are NOT — this branch cannot know which
    // article's table the code belongs to, so it must not claim a sourced feet.
    if (n >= 1 && n <= 60) return storiesOnlyFeetUnverified(n)
  }
  // Single/two-unit or row-house letter-suffix districts cap at ~2.5 st / 30 ft.
  if (/-(SU|TU)-/.test(z) || /-RH-/.test(z)) return storiesOnlyFeetUnverified(2.5)

  // Unrecognised code — unresolved, and it must not be flagged as unconstrained.
  return { ...FAR_UNRESOLVED, heightFt: null }
}
