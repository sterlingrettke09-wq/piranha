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
// already uses. This module re-exports the same stories→feet derivation so the
// height logic lives next to the (null) FAR table, per WO-8.8's "tables in
// lib/zoning/<city>.ts" structure. DZC Art. 13 §13.3 measures overall height in
// stories; the tool assumes ~12 ft/story (a standard floor-to-floor estimate;
// the code does not fix a single ft/story, so this is a labeled estimate).

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
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

export const DENVER_FT_PER_STORY = 12

// Whole-number stories for the most common form-based districts, taken from the
// trailing stories token of each code (DZC building-form height tables). FAR is
// null for every one of them — Denver does not regulate these districts by FAR.
// This is a documentation snapshot; resolveDenver() below is the runtime source
// of truth (it can also read the live HEIGHT_STORIES field). Stored heights here
// are stories × DENVER_FT_PER_STORY.
function ft(stories: number): number {
  return Math.round(stories * DENVER_FT_PER_STORY)
}

export const DENVER_LIMITS: Record<string, DistrictLimits> = {
  // Suburban / Urban single- & two-unit (letter or low-story suffix), ~2.5 st.
  'U-SU-A': { ...FORM_BASED, heightFt: 30 }, // single-unit, ~2.5 stories / 30 ft
  'U-SU-B': { ...FORM_BASED, heightFt: 30 },
  'U-TU-B': { ...FORM_BASED, heightFt: 30 }, // two-unit
  'E-SU-D': { ...FORM_BASED, heightFt: 30 },
  'S-SU-D': { ...FORM_BASED, heightFt: 30 },
  // Urban row-house / residential-office.
  'U-RH-2.5': { ...FORM_BASED, heightFt: ft(2.5) }, // 2.5 stories → 30 ft
  'U-RH-3A': { ...FORM_BASED, heightFt: ft(3) },
  'U-RO-3': { ...FORM_BASED, heightFt: ft(3) },
  // Mixed-use / main-street families (story suffix governs height).
  'U-MX-2': { ...FORM_BASED, heightFt: ft(2) },
  'U-MX-3': { ...FORM_BASED, heightFt: ft(3) },
  'U-MS-3': { ...FORM_BASED, heightFt: ft(3) },
  'U-MS-5': { ...FORM_BASED, heightFt: ft(5) },
  'G-MU-3': { ...FORM_BASED, heightFt: ft(3) },
  'G-MU-5': { ...FORM_BASED, heightFt: ft(5) },
  'G-RH-3': { ...FORM_BASED, heightFt: ft(3) },
  'C-MX-5': { ...FORM_BASED, heightFt: ft(5) },
  'C-MX-8': { ...FORM_BASED, heightFt: ft(8) },
  'C-MX-12': { ...FORM_BASED, heightFt: ft(12) },
  'C-MS-5': { ...FORM_BASED, heightFt: ft(5) },
  'C-RX-5': { ...FORM_BASED, heightFt: ft(5) },
  'S-MX-3': { ...FORM_BASED, heightFt: ft(3) },
  'S-MX-5': { ...FORM_BASED, heightFt: ft(5) },
  'S-MX-8': { ...FORM_BASED, heightFt: ft(8) },
}

/**
 * Resolve Denver FAR + height for a zone code.
 *
 * FAR is always null for the form-based code (Denver does not regulate these
 * districts by floor-area ratio — see file header). Height is derived from the
 * trailing stories token (e.g. "C-MX-5" → 5 → 60 ft, "U-RH-2.5" → 2.5 → 30 ft);
 * single/two-unit (SU/TU) and row-house (RH) letter-suffix districts cap at
 * ~2.5 stories / 30 ft. Returns { far: null, heightFt: null } when the code is
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
    if (n >= 1 && n <= 60) return { ...FORM_BASED, heightFt: ft(n) }
  }
  // Single/two-unit or row-house letter-suffix districts cap at ~2.5 st / 30 ft.
  if (/-(SU|TU)-/.test(z) || /-RH-/.test(z)) return { ...FORM_BASED, heightFt: 30 }

  // Unrecognised code — unresolved, and it must not be flagged as unconstrained.
  return { ...FAR_UNRESOLVED, heightFt: null }
}
