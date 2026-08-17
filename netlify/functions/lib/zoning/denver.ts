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
  /** TRUE where the district's building form standards are set by an authority
   *  rather than published in a table — OS-A, where DZC § 9.3.3.1 gives City
   *  Council and the Manager of Parks and Recreation that role. Same standing as
   *  Phoenix's `planGoverned`: a limit EXISTS and is not in any district table,
   *  which is an answer rather than a failure to look. */
  planGoverned?: boolean
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

// ── PROTECTED DISTRICTS, and the distance that reduces a height ──────────────
//
// Several Denver height tables publish a general maximum and a LOWER cap within
// a stated distance of a "Protected District" — CMP-H 200' but 75' within 125';
// CMP-EI/EI2 and the CMP-NWC family 150' but 75' within 175'; I-A/I-B no general
// maximum at all but 75' within 175'. Without knowing that distance the answer
// is not determinable, which is why those districts refuse rather than publish
// their unconditioned figure.
//
// The term is DEFINED, and by enumeration rather than description — DZC Article
// 13 § 13.3 (June 25, 2010 | Republished February 25, 2025): "Protected
// District: Any one of the following zone districts:" followed by 31 named
// districts, then item 32 — "Any zone district retained from Former Chapter 59,
// mapped on the Official Map, and considered a 'protected Zone District' under
// Section 59-96 of the Former Chapter 59."
//
// So the set spans BOTH codes. Former Chapter 59 § 59-96(a) supplies the rest:
// "Within one hundred seventy-five (175) feet of any zone lot designated as
// RS-4, R-X, R-0, R-1, R-2, R-2-A or R-2-B (hereinafter called the protected
// districts)…". Read from Supplement 103, May 2010.
//
// ⚠️ ENUMERATED, NOT PATTERNED. Every entry is listed because the code lists
// them: U-SU-A is protected and U-SU-A1 is not; E-SU-Dx is and E-MX-2x is not.
// A regex over "SU" or "RH" would be a guess wearing a citation, and this list
// is exactly the kind that a prefix rule gets wrong (rule 27).
export const DENVER_PROTECTED_DISTRICTS: ReadonlySet<string> = new Set([
  // DZC Article 13 § 13.3, items 1-31.
  'S-SU-A', 'S-SU-D', 'S-SU-F', 'S-SU-FX', 'S-SU-FA', 'S-SU-I', 'S-SU-IX', 'S-RH-2.5',
  'E-SU-A', 'E-SU-B', 'E-SU-D', 'E-SU-DX', 'E-SU-G', 'E-TU-B', 'E-TU-C', 'E-RH-2.5', 'E-MU-2.5',
  'U-SU-A', 'U-SU-A2', 'U-SU-B', 'U-SU-B2', 'U-SU-C', 'U-SU-C2', 'U-SU-E', 'U-SU-H',
  'U-TU-B', 'U-TU-B2', 'U-TU-C', 'U-RH-2.5', 'U-RH-3A', 'G-RH-3',
  // Item 32, resolved through Former Chapter 59 § 59-96(a).
  'RS-4', 'R-X', 'R-0', 'R-1', 'R-2', 'R-2-A', 'R-2-B',
])

/** TRUE when a zone code is a Protected District, case- and space-insensitively. */
export function isDenverProtectedDistrict(code: string | null | undefined): boolean {
  if (!code) return false
  return DENVER_PROTECTED_DISTRICTS.has(String(code).trim().toUpperCase())
}

/** The GENERAL maximum height for districts whose figure is conditioned on
 *  Protected District proximity. Article 9, read 2026-08-17.
 *
 *  Kept OUT of DENVER_LIMITS deliberately: an entry there is an unconditional
 *  answer, and publishing 200' for a CMP-H parcel that is actually capped at 75'
 *  would be a 2.7x overstatement — the Seattle MIO magnitude. These resolve only
 *  once the proximity is known. */
const CMP_GENERAL_HEIGHT_FT: Readonly<Record<string, number>> = Object.freeze({
  'CMP-H': 200,      // § 9.2.3
  'CMP-H2': 140,     // § 9.2.3
  'CMP-EI': 150,     // § 9.2.4
  'CMP-EI2': 150,    // § 9.2.4
  'CMP-NWC': 150,    // § 9.2.6
  'CMP-NWC-C': 150,  // § 9.2.6
  'CMP-NWC-G': 150,  // § 9.2.6
  'CMP-NWC-F': 150,  // § 9.2.6
  'CMP-NWC-R': 40,   // § 9.2.6 — 40' generally AND within the buffer.
})

/**
 * The height for a district whose figure depends on Protected District
 * proximity, in feet — or null where that proximity is not known.
 *
 * `nearProtected` is deliberately THREE-STATE:
 *   true      — a Protected District lies within the district's buffer.
 *   false     — the layer ANSWERED and none does.
 *   null/undefined — nobody asked, or the query FAILED.
 *
 * ⚠️ A FAILED SPATIAL QUERY MUST NOT READ AS "false". The two produce
 * different heights — 75' versus up to 200' — so collapsing them would turn an
 * unknown into a confident number in the flattering direction, which is the
 * Phoenix shape this repo already carries a warning about. Hence null, not a
 * boolean default.
 */
export function denverHeightNearProtected(
  code: string | null | undefined,
  nearProtected: boolean | null | undefined,
): { heightFt: number | null; source: string } | null {
  const z = String(code ?? '').trim().toUpperCase()
  const general = CMP_GENERAL_HEIGHT_FT[z]
  if (general == null) return null
  const rule = denverProtectedDistrictRule(z)
  // CMP-NWC-R has no reduction: its figure is 40' either way, so it resolves
  // WITHOUT the proximity being known. Anything else needs the answer.
  if (rule == null) return { heightFt: general, source: `DZC Article 9 § 9.2.6 — ${z} is ${general} ft, with no Protected District reduction` }
  if (nearProtected == null) return { heightFt: null, source: `${z} is ${general} ft generally and ${rule.maxFt} ft within ${rule.withinFt} ft of a Protected District; that distance is unresolved` }
  return nearProtected
    ? { heightFt: rule.maxFt, source: `${rule.source} — within ${rule.withinFt} ft of a Protected District` }
    : { heightFt: general, source: `DZC Article 9 — ${z} general maximum; no Protected District within ${rule.withinFt} ft` }
}

/** How far a Protected District reduces this district's height, and to what.
 *  Null where the district carries no such rule. Figures read from Article 9. */
export function denverProtectedDistrictRule(
  code: string | null | undefined,
): { withinFt: number; maxFt: number; source: string } | null {
  const z = String(code ?? '').trim().toUpperCase()
  const SRC13 = 'DZC Article 13 § 13.3 (Protected District) with Former Chapter 59 § 59-96(a); distance and cap from Article 9'
  if (z === 'CMP-H' || z === 'CMP-H2') return { withinFt: 125, maxFt: 75, source: `${SRC13}, Division 9.2 § 9.2.3` }
  if (/^CMP-(EI2?|NWC(-[CGFR])?)$/.test(z)) {
    // CMP-NWC-R is 40' generally AND 40' near a Protected District — no
    // reduction, so it is excluded rather than given a 75' cap it never has.
    if (z === 'CMP-NWC-R') return null
    return { withinFt: 175, maxFt: 75, source: `${SRC13}, Division 9.2 §§ 9.2.4, 9.2.6` }
  }
  if (z === 'I-A' || z === 'I-B') return { withinFt: 175, maxFt: 75, source: `${SRC13}, Division 9.1` }
  return null
}

// ── CAMPUS (CMP) — READ, AND DELIBERATELY NOT RESOLVED ───────────────────────
//
// The hypothesis was that CMP districts are plan-governed, which would make them
// a planned-development registry entry. WRONG, and Article 9 settled it: Division
// 9.2 gives each campus district its own SECTION with a published height table.
// They are a curation job, not a reason code.
//
// DZC Article 9, Division 9.2 (June 25, 2010 | Republished February 25, 2025),
// read from the complete PDF with Content-Length verified against bytes received:
//
//   district      Feet (max)    within a Protected District
//   CMP-H            200'        75'  (within 125')   § 9.2.3
//   CMP-H2           140'        75'  (within 125')   § 9.2.3
//   CMP-EI           150'        75'  (within 175')   § 9.2.4
//   CMP-EI2          150'        75'  (within 175')   § 9.2.4
//   CMP-NWC          150'        75'  (within 175')   § 9.2.6
//   CMP-NWC-C        150'        75'                  § 9.2.6
//   CMP-NWC-G        150'        75'                  § 9.2.6
//   CMP-NWC-F        150'        75'                  § 9.2.6
//   CMP-NWC-R         40'        40'                  § 9.2.6
//
// ⚠️ NOT ENCODED, AND THE REASON IS THE POINT. The reduction is a LOCATIONAL
// fact — is this parcel within 125'/175' of a Protected District — and we do not
// hold it. Publishing 200' for a CMP-H parcel that is actually capped at 75'
// would overstate by 2.7x, which is the Seattle MIO magnitude, and it would be a
// NEW error: these districts resolve to nothing today, so encoding the base max
// naively makes the tool worse for the parcels nearest the reduction.
//
// Same choice zoning/seattle.ts makes for LR3 when the urban-centre boundary is
// unresolved — "Refuse rather than pick one" — because the code answers
// differently depending on a fact nobody has read.
//
// TO CLOSE IT: "Protected District" is a defined term in the DZC and the
// reduction is a distance from a mapped boundary, so this is resolvable with a
// spatial query against Denver's own zoning layer rather than by reading more
// code. That is the work, and the table above means the reading is already done.

export const DENVER_LIMITS: Record<string, DistrictLimits> = {
  // ── Article 9, Division 9.3 OPEN SPACE (OS-A, OS-B, OS-C) ──────────────────
  //
  // ⚠️ THESE ARE CURRENT DZC DISTRICTS, NOT FORMER CHAPTER 59. They have ZERO
  // occurrences in the Former Chapter 59 document (Supplement 103, May 2010) —
  // the legacy open-space district is OS-1. They were triaged into the legacy
  // family on the strength of the "OS-" prefix, and reading the former code is
  // what disproved it.
  //
  // OS-B / OS-C — Division 9.3, GENERAL building form:
  //     Stories (max) 3 · Feet, pitched or Low-Slope Roof (max) 40'
  // Unconditional: no Protected District row, no incentive row.
  'OS-B': { far: null, heightFt: 40, stories: 3, heightBasis: 'code-stated', farUnconstrained: true },
  'OS-C': { far: null, heightFt: 40, stories: 3, heightBasis: 'code-stated', farUnconstrained: true },

  // OS-A — no published form standards at all. § 9.3.3.1: "In the OS-A zone
  // district, the City Council shall have final approval authority over the form
  // of certain building according to D.R.M.C., Chapter 39 (Parks). For all other
  // buildings or structures, the Manager of Parks and Recreation shall determine
  // all applicable building form standards." Subsection B extends that to
  // landscaping, parking and signage.
  //
  // So a limit EXISTS and is set by an authority rather than a table — the
  // planned-development shape with a different decision-maker. `planGoverned`
  // rather than a fabricated height.
  'OS-A': { far: null, heightFt: null, planGoverned: true },

  // ── Article 9, Division 9.1 INDUSTRIAL (I-A, I-B) and Division 9.? MHC ──────
  //
  // Read from Article 9 of the current code (June 25, 2010 | Republished
  // February 25, 2025), Content-Length verified against bytes received.
  //
  // I-A / I-B — SITING table, ZONE LOT row:
  //     Floor Area Ratio (FAR) (max)   I-MX-3  I-MX-5  I-MX-8  I-MX-12  I-A  I-B
  //                                      na      na      na      na     2.0  2.0
  // An unconditional, published ratio. The I-MX columns read "na" in the SAME
  // row, which is the slot filled with an explicit absence rather than a blank.
  //
  // ⚠️ HEIGHT IS DELIBERATELY NOT CARRIED FOR I-A / I-B. The HEIGHT table gives
  // "na" for both Stories and Feet — no general maximum — but the next row is
  // "Feet within 175' of a Protected District (max) = 75'". Publishing "no height
  // limit" would be wrong for any industrial parcel near a protected district,
  // and these resolve to nothing today, so it would be a NEW error rather than
  // an inherited one. Same refusal as CMP above and as Seattle's LR3 without a
  // resolved centre: the answer depends on a distance nobody has measured.
  'I-A': { far: 2.0, heightFt: null },
  'I-B': { far: 2.0, heightFt: null },

  // MHC — Manufactured Home Community. The only primary building form allowed is
  // the Manufactured Home, whose HEIGHT table is a single unconditional figure:
  // "Feet (max) 20'". No stories row, no Protected District row.
  //
  // `farUnconstrained` by the SLOT TEST (CLAUDE.md rule 5), not by absence of a
  // number: the INDUSTRIAL siting table carries a "ZONE LOT / Floor Area Ratio
  // (FAR) (max)" row, and the MHC siting table has no ZONE LOT section at all.
  // The document's own structure is positive evidence that no FAR applies here,
  // rather than a reader failing to find one.
  'MHC': { far: null, heightFt: 20, heightBasis: 'code-stated', farUnconstrained: true },

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
  //
  // ⚠️ THE OPTIONAL TRAILING LETTER IS LOAD-BEARING. This was anchored to
  // end-of-string, so `S-MX-2` resolved and `S-MX-2A` did not — 23 of Denver's
  // 184 live codes are special-purpose variants (S-MX-2A, E-MX-2X, S-CC-5X,
  // M-RX-5A…) and every one fell through to unresolved.
  //
  // DZC Article 2 § 2.3.1.2.B gives the naming convention: the third number is
  // "Maximum Building Height in stories", and an "OCCASIONAL LAST NUMBER OR
  // LETTER" is "an indicator of special regulations… x = Special provisions
  // tailored to that zone district. A = Special provisions, especially design
  // standards or allowed building forms".
  //
  // NOT TAKEN ON THAT INFERENCE. Article 3's own tables were read, because
  // "allowed building forms" could plausibly move height and 23 plausible wrong
  // heights is the expensive direction:
  //     S-MX-2x  2 st / 30'     S-MX-2   2 st / 30'     S-MX-2A   2 st / 30'
  //     S-MX-3A  3 st / 45'     S-MX-5A  5 st / 70'     S-MX-8A   8 st / 110'
  //     S-MX-12A 12 st / 150'
  // The suffixed rows carry the SAME stories and feet as the base at every
  // tier. (Feet are still not claimed here — see the note below.)
  const m = z.match(/-(\d+(?:\.\d+)?)[A-Z]?$/)
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
