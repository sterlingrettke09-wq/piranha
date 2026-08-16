// ONE reading of a Seattle zone string, because there were two and they disagreed
// on 39 of the 285 codes the live layer actually publishes.
//
// ── THE DEFECT ────────────────────────────────────────────────────────────────
// `seattleMaxHeightFt` in providers/seattle.ts took the LAST 2–3 digit number in
// the string. Its comment explained that this avoids picking up the MIO (Major
// Institution Overlay) height, and that reasoning is sound ONLY when the base
// zone carries a trailing number of its own: in "MIO-105-NC3-65" the last number
// is the NC3 base height, 65.
//
// It fails completely for base zones with NO numeric suffix — LR1, LR2, LR3, MR,
// HR, NR. There the MIO height is the ONLY number in the string, so it is also
// the last one, and it was published as the by-right height. The function's own
// LR1/LR2/LR3/MR/HR fallbacks were unreachable for those strings, because
// `nums.length` was already non-zero.
//
// MEASURED against the live layer (Current_Land_Use_Zoning_Detail_2/FeatureServer/0,
// ZONING field) on 2026-08-16, verified non-truncated by two independent queries
// (returnDistinctValues and a groupBy count both return 285 distinct values):
//
//   · 39 of 285 distinct codes parsed differently between the two implementations
//   · 28 of the 39 OVERSTATED height, 11 UNDERSTATED
//   · 40 groups / 192 polygons of 3,627 — 5.3% of Seattle's zoning polygons
//
//   MIO-240-LR2 (M)  published 240 ft where the base zone is LR2   (6.0x)
//   MIO-160-LR1 (M)  published 160 ft where the base zone is LR1   (5.3x)
//   MIO-160-HR (M)   published 160 ft where the base zone is HR    (UNDERstates)
//   LR2 (0.75)       published  75 ft — the parenthetical's digits read as height
//
// Height feeds maxStories, the envelope and cost, so an LR1 parcel under a 160 ft
// institutional overlay was being priced as a 160 ft site.
//
// ── WHY IT SURVIVED ───────────────────────────────────────────────────────────
// zoning/seattle.ts did it correctly — strip the MIO prefix, strip parentheticals,
// then read the trailing number — and its docstring claimed to "mirror the
// provider's suffix parsing". Nothing enforced that claim, and it could not have:
// `seattleMaxHeightFt` was module-private, so the two were uncheckable against
// each other BY CONSTRUCTION. That is a stronger failure than duplication —
// the enforcement was not skipped, it was unavailable.
//
// Same shape as the gfaBasis triplication fixed in the same session, and the same
// remedy: one exported function, both callers wired to it, and a wiring test that
// fails if either reimplements it (CLAUDE.md rule 14).
//
// ── THE TIER HEIGHTS, NOW SOURCED (2026-08-16) ───────────────────────────────
//
// These were five uncited constants — 30/40/50/85/240 — shipped on the strength
// of a comment saying the tiers "get the SMC base-height by tier". Read against
// the code, EVERY ONE was wrong:
//
//   zone   shipped   SMC 23.45.514 with MHA   without MHA
//   LR1      30              32                   32
//   LR2      40              40                   32
//   LR3      50        40 outside / 50 inside     32 / 40
//   MR       85              80                   60
//   HR      240             440                  440
//
// MR 85 is not a figure in the code at all. HR 240 understated a 440 ft zone by
// 45%. LR3 outside a centre without MHA overstated by 56%.
//
// ⚠️ READ THE VERSION BEFORE THE TABLE. The first read of 23.45.514 came back
// LR1 30 / cottage housing 22 / HR 440 — from Municode's **May 21, 2019
// ARCHIVE**, served from a versioned URL with the section flagged "modified".
// Encoding it would have replaced uncited-but-maybe-right numbers with
// CITED-AND-STALE ones, which is strictly worse: a citation stops the next
// reader re-checking. The tell was `VERSION: MAY 21, 2019 (ARCHIVE)` in the page
// chrome, not in the text being extracted. A primary source has a version, and
// reading the wrong one produces a defensible-looking wrong answer.
//
// A search summary also suggested the Midrise tiers had been renumbered to
// "MR1 65 / MR2 85". The code has a single MR at 80/60. It stayed flagged as
// unverified and never reached the module.
//
// ⚠️ HEIGHT IS A JOINT DEPENDENCY: zone x MHA suffix x urban-centre membership.
// Both extra inputs were ALREADY resolved and passed to the FAR path — the
// height path simply never consulted them (CLAUDE.md rule 13; third instance of
// a field fetched, read for one purpose, and not read for another).

/** The MIO prefix: "MIO-105-NC3-65" → the 105 is the Major Institution Overlay
 *  height, not the base zone's. Stripped before any height is read. */
const MIO_PREFIX = /^MIO-\d{1,3}-/

/** Parenthetical suffixes: "(M)", "(M1)", "(M2)" carry no digits, but the live
 *  feed also publishes "LR2 (0.75)", whose "75" was being read as a height.
 *  SMC 23.30.010.B describes incentive-zoning suffixes as "numerical suffixes
 *  enclosed in parentheses", so the parentheses are the reliable marker. */
const PARENTHETICAL = /\([^)]*\)/g

/**
 * Strip ONLY the MIO overlay prefix. "MIO-160-LR1 (M)" → "LR1 (M)".
 *
 * Kept separate from the parenthetical strip on purpose: zoning/seattle.ts must
 * read the MHA suffix — "(M)", "(M1)", "(M2)" — off the string BEFORE the
 * parentheses are removed, because that suffix is load-bearing at Table A's
 * 40-foot row. Collapsing both strips into one helper silently deleted the MHA
 * suffix and moved nine NC/C districts off their correct FAR; the existing
 * Seattle tests caught it immediately.
 */
export function stripMioPrefix(zone: string): string {
  return zone.trim().toUpperCase().replace(MIO_PREFIX, '').trim()
}

/**
 * Strip the overlay prefix AND any parenthetical suffix, leaving the base zone
 * token. "MIO-160-LR1 (M)" → "LR1"; "MIO-105-NC3-65" → "NC3-65".
 *
 * This is the form the HEIGHT read needs. Do not use it where the MHA suffix
 * still matters — see stripMioPrefix above.
 */
export function seattleBaseZoneToken(zone: string): string {
  return stripMioPrefix(zone).replace(PARENTHETICAL, ' ').trim()
}

/** TRUE when the zone carries a Mandatory Housing Affordability suffix —
 *  "(M)", "(M1)", "(M2)". Load-bearing for BOTH height and FAR, which is why it
 *  lives beside the other zone-string reads rather than in one consumer. */
export function hasMhaSuffix(zone: string): boolean {
  return /\(\s*M[12]?\s*\)/.test(zone)
}

/** Whether the parcel sits inside a Regional or Urban Center. `null`/`undefined`
 *  mean the boundary layer did not answer — never "outside". */
export type SeattleCenter = 'inside' | 'outside' | null | undefined

/** SMC 23.45.514 Table A (LR) and Table B (MR/HR), read from the CURRENT code on
 *  2026-08-16. One citation per figure; see the table in this file's header. */
export const SMC_HEIGHT_SRC =
  'Seattle Municipal Code § 23.45.514, Table A for 23.45.514 (structure height for LR zones) and Table B for 23.45.514 (MR and HR), read 2026-08-16'

/**
 * The base-zone height limit a Seattle zone string encodes, in feet, or null
 * where the code does not settle one.
 *
 * Reads the TRAILING in-range number of the BASE token — never a number that
 * belongs to the MIO overlay or to a parenthetical suffix. Where the base zone
 * carries no number, falls to the SMC 23.45.514 tier tables, which depend on the
 * MHA suffix and, for LR3, on urban-centre membership.
 *
 * Returns null for industrial "U/##" (e.g. "IG1 U/85"), where height is
 * unlimited for industrial uses and the number caps only non-industrial ones.
 */
export function seattleBaseHeightFt(
  zone: string | null | undefined,
  center?: SeattleCenter,
): number | null {
  if (!zone) return null
  const z = String(zone).toUpperCase()
  if (/\bU\s*\//.test(z)) return null
  const base = seattleBaseZoneToken(z)
  const nums = (base.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (nums.length) return nums[nums.length - 1]

  // The MHA suffix is read off the ORIGINAL string: seattleBaseZoneToken strips
  // parentheticals, which is where it lives.
  const mha = hasMhaSuffix(z)

  // Table A. Both dwelling-unit-type rows agree everywhere except one cell.
  if (/\bLR1\b/.test(base)) return 32
  if (/\bLR2\b/.test(base)) return mha ? 40 : 32
  if (/\bLR3\b/.test(base)) {
    if (center === 'inside') {
      // ⚠️ THE ONE CELL WHERE DWELLING-UNIT TYPE CHANGES THE ANSWER, and we do
      // not model unit type. Table A, LR3-in-centres, WITHOUT an MHA suffix:
      // "Attached and detached dwelling units" takes footnote 1 (32 ft) and
      // "Stacked dwelling units" takes footnote 2 (40 ft). Everywhere else the
      // two rows are identical.
      //
      // Carrying the LOWER figure, because reporting the higher would assume a
      // stacked-unit program the user has not chosen (CLAUDE.md rule 6). If unit
      // type is ever modelled, THIS is the cell to revisit.
      return mha ? 50 : 32
    }
    if (center === 'outside') return mha ? 40 : 32
    // Centre unresolved and the answer differs by centre. Refuse rather than
    // pick one — the same choice the FAR path makes for LR3 (multifamilyFar).
    return null
  }
  // Table B.
  if (/\bMR\b/.test(base)) return mha ? 80 : 60
  if (/\bHR\b/.test(base)) return 440
  return null
}
