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
}

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
  'U-SU-A': { far: null, heightFt: 30 }, // single-unit, ~2.5 stories / 30 ft
  'U-SU-B': { far: null, heightFt: 30 },
  'U-TU-B': { far: null, heightFt: 30 }, // two-unit
  'E-SU-D': { far: null, heightFt: 30 },
  'S-SU-D': { far: null, heightFt: 30 },
  // Urban row-house / residential-office.
  'U-RH-2.5': { far: null, heightFt: ft(2.5) }, // 2.5 stories → 30 ft
  'U-RH-3A': { far: null, heightFt: ft(3) },
  'U-RO-3': { far: null, heightFt: ft(3) },
  // Mixed-use / main-street families (story suffix governs height).
  'U-MX-2': { far: null, heightFt: ft(2) },
  'U-MX-3': { far: null, heightFt: ft(3) },
  'U-MS-3': { far: null, heightFt: ft(3) },
  'U-MS-5': { far: null, heightFt: ft(5) },
  'G-MU-3': { far: null, heightFt: ft(3) },
  'G-MU-5': { far: null, heightFt: ft(5) },
  'G-RH-3': { far: null, heightFt: ft(3) },
  'C-MX-5': { far: null, heightFt: ft(5) },
  'C-MX-8': { far: null, heightFt: ft(8) },
  'C-MX-12': { far: null, heightFt: ft(12) },
  'C-MS-5': { far: null, heightFt: ft(5) },
  'C-RX-5': { far: null, heightFt: ft(5) },
  'S-MX-3': { far: null, heightFt: ft(3) },
  'S-MX-5': { far: null, heightFt: ft(5) },
  'S-MX-8': { far: null, heightFt: ft(8) },
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
  if (!zone) return { far: null, heightFt: null }
  const z = zone.trim().toUpperCase()

  // Documentation-snapshot hit (exact match) — keeps the static table and the
  // resolver in lock-step for the common codes.
  if (z in DENVER_LIMITS) return DENVER_LIMITS[z]

  // Former Chapter 59 (pre-2010 recode) trailing numbers are class codes, not
  // story counts — never read a height from them.
  if (opts.formerChapter59) return { far: null, heightFt: null }

  // Trailing numeric stories token (e.g. G-MU-3, C-MX-5, U-RH-2.5).
  const m = z.match(/-(\d+(?:\.\d+)?)$/)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 60) return { far: null, heightFt: ft(n) }
  }
  // Single/two-unit or row-house letter-suffix districts cap at ~2.5 st / 30 ft.
  if (/-(SU|TU)-/.test(z) || /-RH-/.test(z)) return { far: null, heightFt: 30 }

  return { far: null, heightFt: null }
}
