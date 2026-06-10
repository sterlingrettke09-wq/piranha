// Seattle commercial/NC FAR table (WO-8.8 depth tranche 2).
//
// Source: Seattle Municipal Code (SMC) Title 23, Subtitle III, Chapter 23.47A
// (Commercial), Section 23.47A.013 "Floor area ratio," Table A. Verified against
// the live code text 2026-06-10 (Municode supplement 43, codified through the
// MHA ordinances). Section citations are in-line below.
//
// THE GAP THIS FILLS — FAR for NC/C zones. The Seattle provider derives HEIGHT
// from the trailing suffix (NC3-65 → 65 ft) but leaves maxFAR null, because the
// King County / Seattle GeoData zoning feed carries the zone string, not an FAR.
// SMC 23.47A.013 Table A publishes the by-right FAR for NC1/NC2/NC3/C1/C2 zones
// as a pure function of the HEIGHT-LIMIT SUFFIX (the trailing number in the zone
// code). So we resolve FAR programmatically from that suffix, exactly as the
// provider already parses height.
//
// SCOPE — Table A is the FAR limit OUTSIDE a Station Area Overlay District. A
// HIGHER FAR (Table B) applies INSIDE Station Area Overlays, and per-neighborhood
// overrides exist. We cannot tell from the bare zone code whether a lot is in an
// overlay, so we publish the LOWER Table-A figure: understating the envelope is
// the safe failure direction (it can push a verdict toward NEEDS_RELIEF, never
// the reverse). Multifamily LR/MR/HR FAR (SMC 23.45) and Seattle-Mixed SM FAR
// (SMC 23.48) are separate tables and stay null here (resolveSeattle skips them).

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
}

// ── NC/C FAR by height-limit suffix (SMC 23.47A.013 Table A, outside Station
//    Area Overlay Districts) ──────────────────────────────────────────────────
// Verified 2026-06-10. Key = the height-limit number (feet) in the zone suffix.
//
// Footnote 1 on the 40-ft row: a zone WITHOUT a mandatory-housing-affordability
// (MHA) suffix has a max FAR of 3.25, not 3.0. We cannot reliably tell MHA status
// from the bare/normalized code (the provider strips the M/M1/M2 suffix), so we
// store the LOWER 3.0 — the conservative bound. Footnote 2 on the 200-ft row
// (FAR 12 within the First Hill/Capitol Hill Regional Center with ≥4 FAR
// residential) is a location-conditioned bonus, not a flat figure, so we store
// the base 8.25.
const NC_FAR_BY_HEIGHT: Record<number, number> = {
  30: 2.5, // SMC 23.47A.013 Table A
  40: 3.0, // SMC 23.47A.013 Table A (3.25 if no MHA suffix — store the conservative 3.0)
  55: 3.75, // SMC 23.47A.013 Table A
  65: 4.5, // SMC 23.47A.013 Table A
  75: 5.5, // SMC 23.47A.013 Table A
  85: 5.75, // SMC 23.47A.013 Table A
  95: 6.25, // SMC 23.47A.013 Table A
  145: 7.0, // SMC 23.47A.013 Table A
  200: 8.25, // SMC 23.47A.013 Table A (12 within First Hill/Capitol Hill RC w/≥4 FAR resid — store base 8.25)
}

// Zone-prefix families that 23.47A.013 Table A governs. SM (Seattle Mixed) and
// the LR/MR/HR multifamily zones have their own FAR tables (SMC 23.48 / 23.45)
// not replicated here, so they are excluded — resolveSeattle returns null FAR.
const NC_C_PREFIXES = ['NC1', 'NC2', 'NC3', 'C1', 'C2']

function isNcOrC(zone: string): boolean {
  // Match a leading NC1/NC2/NC3/C1/C2 token. The C-family check guards against
  // "C-something" that isn't C1/C2 by requiring the digit.
  return NC_C_PREFIXES.some((p) => zone === p || zone.startsWith(p + '-') || zone.startsWith(p + ' '))
}

/**
 * Resolve the Seattle by-right FAR for a commercial/NC zone code (e.g. "NC3-65",
 * "C1-40", "NC2-40 (M1)"). Mirrors the provider's suffix parsing: strips MIO/M
 * affordability suffixes and reads the TRAILING height-limit number, then looks
 * up SMC 23.47A.013 Table A.
 *
 * Returns { far: null } for any zone that is NOT an NC1/NC2/NC3/C1/C2 zone
 * (LR/MR/HR multifamily, SM Seattle-Mixed, downtown, industrial — those have
 * separate or no FAR tables), and for any height suffix with no published Table-A
 * row. Height is always null here (the provider already derives it). NEVER
 * guesses a FAR.
 */
export function resolveSeattle(zone: string | null | undefined): DistrictLimits {
  if (!zone) return { far: null, heightFt: null }
  let z = zone.trim().toUpperCase()

  // Strip a leading MIO (Major Institution Overlay) prefix the way the provider
  // does, so "MIO-105-NC3-65" reads as the NC3-65 base zone.
  z = z.replace(/^MIO-\d{1,3}-/, '')

  if (!isNcOrC(z)) return { far: null, heightFt: null }

  // Trailing 2-3 digit height-limit token (NC3-65 → 65, C1-40 → 40). Take the
  // LAST in-range number, matching the provider's height parse — this ignores a
  // leading MIO height that survived and any MHA "M1"/"M2" digit.
  const nums = (z.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (!nums.length) return { far: null, heightFt: null }
  const height = nums[nums.length - 1]

  const far = NC_FAR_BY_HEIGHT[height] ?? null
  return { far, heightFt: null }
}

// Static documentation snapshot of resolveSeattle() output for the common NC/C
// variants, so a reviewer can eyeball resolved FAR without running code.
// resolveSeattle() is the runtime source of truth; the unit tests keep this in
// lock-step. ≥10 zone variants per WO scope.
export const SEATTLE_FAR: Record<string, DistrictLimits> = {
  'NC1-30': resolveSeattle('NC1-30'),
  'NC1-40': resolveSeattle('NC1-40'),
  'NC2-40': resolveSeattle('NC2-40'),
  'NC2-55': resolveSeattle('NC2-55'),
  'NC2-65': resolveSeattle('NC2-65'),
  'NC3-55': resolveSeattle('NC3-55'),
  'NC3-65': resolveSeattle('NC3-65'),
  'NC3-75': resolveSeattle('NC3-75'),
  'NC3-85': resolveSeattle('NC3-85'),
  'NC3-95': resolveSeattle('NC3-95'),
  'NC3-145': resolveSeattle('NC3-145'),
  'NC3-200': resolveSeattle('NC3-200'),
  'C1-40': resolveSeattle('C1-40'),
  'C1-65': resolveSeattle('C1-65'),
  'C2-40': resolveSeattle('C2-40'),
  'C2-65': resolveSeattle('C2-65'),
}
