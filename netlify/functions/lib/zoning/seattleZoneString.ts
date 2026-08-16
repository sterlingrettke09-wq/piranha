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
// ⚠️ THIS MODULE DOES NOT ESTABLISH THE BASE-ZONE HEIGHTS. The LR/MR/HR figures
// the provider falls back to (30/40/50/85/240) are PRE-EXISTING and carry no
// citation — providers/seattle.ts says the tiers "get the SMC base-height by
// tier" and cites nothing, and zoning/seattle.ts cites SMC 23.45.510, which is
// the FAR table, not height. Sourcing them against SMC 23.45.514 is separate
// work and is deliberately NOT done here: this change makes an MIO-prefixed code
// behave exactly like its bare equivalent, which is a strict improvement whether
// or not the bare figure is later corrected. Fixing two things at once would
// leave neither measured.

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

/**
 * The base-zone height limit a Seattle zone string encodes, in feet, or null
 * where the string carries none.
 *
 * Reads the TRAILING in-range number of the BASE token — never a number that
 * belongs to the MIO overlay or to a parenthetical suffix.
 *
 * Returns null for industrial "U/##" (e.g. "IG1 U/85"), where height is
 * unlimited for industrial uses and the number caps only non-industrial ones:
 * reporting it as the max would publish a wrongly-low ceiling.
 */
export function seattleBaseHeightFt(zone: string | null | undefined): number | null {
  if (!zone) return null
  const z = String(zone).toUpperCase()
  if (/\bU\s*\//.test(z)) return null
  const base = seattleBaseZoneToken(z)
  const nums = (base.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (nums.length) return nums[nums.length - 1]
  // Tier defaults for base zones that carry no numeric suffix. UNCITED and
  // pre-existing — see the warning in this file's header. They are reached now
  // for MIO-prefixed strings, which is the fix: previously the overlay height
  // shadowed them entirely.
  if (/\bLR1\b/.test(base)) return 30
  if (/\bLR2\b/.test(base)) return 40
  if (/\bLR3\b/.test(base)) return 50
  if (/\bMR\b/.test(base)) return 85
  if (/\bHR\b/.test(base)) return 240
  return null
}
