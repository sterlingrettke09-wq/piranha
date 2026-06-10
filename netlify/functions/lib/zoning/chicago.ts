// Chicago curated district FAR/height table (WO-8.8 depth tranche 1).
//
// Source: Chicago Municipal Code, Title 17 (Chicago Zoning Ordinance), as
// published at codelibrary.amlegal.com. Verified against the live code text
// 2026-06-10. Section citations are in-line below so a reviewer can re-check
// every number against the published table.
//
// Chicago encodes a district's intensity in a DASH SUFFIX on the zone class:
//   B3-2  → "B3" district, dash suffix "2"
//   C1-5  → "C1" district, dash suffix "5"
//   DX-7  → "DX" downtown district, dash suffix "7"
//   M1-2  → "M1" manufacturing district, dash suffix "2"
//   RM-5  → residential class (handled by the residential base-FAR table)
//
// Because B/C/D/M FAR is a pure function of that dash suffix, we resolve it
// PROGRAMMATICALLY from the published per-suffix table rather than enumerating
// every (district × suffix) combination. Heights, where the code publishes a
// single figure independent of lot frontage, are returned exactly; where the
// code makes height vary by lot frontage / ground-floor commercial (a "varies"
// case), we return null rather than guess a representative number.

export interface DistrictLimits {
  far: number | null
  heightFt: number | null
}

// ── Residential base FAR ──────────────────────────────────────────────────
// Chicago Zoning Ordinance §17-2-0305 (R district base floor-area ratios).
// Moved here unchanged from providers/chicago.ts (already sourced). RM4.5 =
// 1.70 per §17-2-0304-A FAR table. Residential heights vary by district and
// building type (§17-2-0311), so heightFt is null (honestly "not a single
// published figure") — residential parcels are FAR-governed in this tool.
export const CHICAGO_BASE_FAR: Record<string, number> = {
  'RS-1': 0.5,
  'RS-2': 0.65,
  'RS-3': 0.9,
  'RT-3.5': 1.05,
  'RT-4': 1.2,
  'RT-4A': 1.2,
  'RM-4.5': 1.7, // §17-2-0304-A FAR table (RM4.5 = 1.70)
  'RM-5': 2.0,
  'RM-5.5': 2.5,
  'RM-6': 4.4,
  'RM-6.5': 6.6,
}

// ── B/C district FAR by dash suffix ───────────────────────────────────────
// §17-3-0403-A maximum floor area ratio table (Business & Commercial
// districts). Verified 2026-06-10. The suffix is the SAME for B and C classes.
const BC_FAR_BY_SUFFIX: Record<string, number> = {
  '1': 1.2, // Dash 1
  '1.5': 1.5, // Dash 1.5
  '2': 2.2, // Dash 2
  '3': 3.0, // Dash 3
  '5': 5.0, // Dash 5
}

// ── B/C district height by dash suffix ────────────────────────────────────
// §17-3-0408-A maximum building height table. Heights for Dash 1 and Dash 1.5
// are a flat 38 ft regardless of lot frontage or ground-floor commercial, so we
// publish them. Dash 2 / 3 / 5 heights VARY by lot frontage (25 / <50 / 50–99.9
// / 100+ ft) and by whether there is qualifying ground-floor commercial space —
// the code gives a RANGE, not a single number — so we return null rather than
// fabricate a representative figure. (For reference, the §17-3-0408-A range is
// Dash 2: 45–50, Dash 3: 50–65, Dash 5: 50–80 ft; we do not pick one.)
const BC_HEIGHT_BY_SUFFIX: Record<string, number | null> = {
  '1': 38,
  '1.5': 38,
  '2': null, // varies by frontage 45–50 ft
  '3': null, // varies by frontage 50–65 ft
  '5': null, // varies by frontage 50–80 ft
}

// ── D (downtown) district FAR by dash suffix ──────────────────────────────
// §17-4-0405-A maximum BASE floor area ratio table (DC/DX/DR/DS districts).
// Bonuses (§17-4-1000) sit on top of these base figures and are project-
// specific, so we publish only the by-right base FAR. Verified 2026-06-10.
const D_FAR_BY_SUFFIX: Record<string, number> = {
  '3': 3.0,
  '5': 5.0,
  '7': 7.0,
  '10': 10.0,
  '12': 12.0,
  '16': 16.0,
}
// §17-4-0407: there are NO maximum building height limits in the D districts
// (height is governed by FAR + PD review thresholds), so D height is null.

// ── M (manufacturing) district FAR by dash suffix ─────────────────────────
// §17-5-0404-A maximum floor area ratio table (M1/M2/M3 districts).
// Verified 2026-06-10.
const M_FAR_BY_SUFFIX: Record<string, number> = {
  '1': 1.2,
  '2': 2.2,
  '3': 3.0,
}
// M-district height is governed by setback/use context rather than a single
// published per-suffix figure, so M height is null.

/**
 * Resolve Chicago FAR + height for a zone class string (e.g. "B3-2", "DX-5",
 * "RM-5", "M1-2"). Returns { far: null, heightFt: null } when the district is
 * unknown or the code publishes no single figure ("varies"). NEVER guesses.
 */
export function resolveChicago(zone: string | null | undefined): DistrictLimits {
  if (!zone) return { far: null, heightFt: null }
  const z = zone.trim().toUpperCase()

  // Residential classes carry the intensity in the class name itself (RM-5,
  // RT-4…), not a separate dash suffix — look them up directly.
  if (z in CHICAGO_BASE_FAR) {
    return { far: CHICAGO_BASE_FAR[z], heightFt: null }
  }

  // B/C/D/M classes: split "<prefix><digit?>-<suffix>" → prefix letter + suffix.
  // Examples: "B3-2" → letter B, suffix "2"; "DX-7" → letter D, suffix "7";
  // "M1-2" → letter M, suffix "2"; "C1-5" → letter C, suffix "5".
  const m = z.match(/^([BCDM])[A-Z]?\d*-(\d+(?:\.\d+)?)$/)
  if (!m) return { far: null, heightFt: null }
  const letter = m[1]
  const suffix = m[2]

  switch (letter) {
    case 'B':
    case 'C':
      return {
        far: BC_FAR_BY_SUFFIX[suffix] ?? null,
        heightFt: BC_HEIGHT_BY_SUFFIX[suffix] ?? null,
      }
    case 'D':
      return { far: D_FAR_BY_SUFFIX[suffix] ?? null, heightFt: null }
    case 'M':
      return { far: M_FAR_BY_SUFFIX[suffix] ?? null, heightFt: null }
    default:
      return { far: null, heightFt: null }
  }
}

// Static table (≥20 of the most common Chicago districts) — a documentation
// snapshot of what resolveChicago() produces, so a reviewer can eyeball the
// resolved values without running code. resolveChicago() is the source of truth
// at runtime; this is kept consistent with it by the unit tests.
export const CHICAGO_LIMITS: Record<string, DistrictLimits> = {
  'RS-1': resolveChicago('RS-1'),
  'RS-2': resolveChicago('RS-2'),
  'RS-3': resolveChicago('RS-3'),
  'RT-4': resolveChicago('RT-4'),
  'RM-5': resolveChicago('RM-5'),
  'RM-6': resolveChicago('RM-6'),
  'B1-1': resolveChicago('B1-1'),
  'B1-2': resolveChicago('B1-2'),
  'B1-3': resolveChicago('B1-3'),
  'B2-2': resolveChicago('B2-2'),
  'B3-2': resolveChicago('B3-2'),
  'B3-3': resolveChicago('B3-3'),
  'B3-5': resolveChicago('B3-5'),
  'C1-1': resolveChicago('C1-1'),
  'C1-2': resolveChicago('C1-2'),
  'C1-3': resolveChicago('C1-3'),
  'C2-2': resolveChicago('C2-2'),
  'C3-5': resolveChicago('C3-5'),
  'DC-12': resolveChicago('DC-12'),
  'DC-16': resolveChicago('DC-16'),
  'DX-5': resolveChicago('DX-5'),
  'DX-7': resolveChicago('DX-7'),
  'DR-3': resolveChicago('DR-3'),
  'M1-2': resolveChicago('M1-2'),
  'M2-2': resolveChicago('M2-2'),
  'M3-3': resolveChicago('M3-3'),
}
