// San Jose residential floor area — Municipal Code Title 20 (Zoning),
// § 20.30.200 (Development standards) and § 20.100.1030 (Single-family house
// permit required).
// Source: https://sanjose-ca.elaws.us/code/coor_title20_ch20.30_pt3_sec20.30.200
//         https://sanjose-ca.elaws.us/code/coor_title20_ch20.100_pt9_sec20.100.1030
//
// WHY THIS MODULE EXISTS, AND WHY IT PUBLISHES NO FAR NUMBER
// San Jose was the last wired city resolving nothing: 15 developable parcels,
// 15 gaps. The reason turned out not to be a table nobody had transcribed.
//
// THE SLOT EXISTS AND IT DOES NOT HOLD A RATIO. § 20.30.200's development
// standards table has a row labelled "Floor area ratio". Its cell reads, in
// full: "See Part 9 of Chapter 20.100 for single-family house permit criteria
// that may apply". One cell, spanning every residential district, exactly like
// the "Parking / See Chapter 20.90" row above it. So this is NOT the rule-5
// case where a code has no slot for the value — the slot is there and it points
// somewhere else.
//
// FOLLOWING THE POINTER YIELDS A PERMIT TRIGGER, NOT A CAP. Chapter 20.100
// Part 9 has § 20.100.1020 "Floor area ratio defined" and § 20.100.1030
// "Single-family house permit required". The number appears in 1030(C)(1), in
// the list of conditions under which NO permit is required:
//
//   "The issuance of the building permit will result in a single-family house
//    in any residential district with a floor area ratio equal to or less than
//    forty-five hundredths OR height equal to or less than thirty feet and/or
//    equal to or less than two stories; or the site is not an historic
//    resource…"
//
// ⚠️ READ THE CONJUNCTION. It is "or", not "and". A house may exceed 0.45 and
// still need no permit, provided it stays at or under thirty feet and two
// storeys. So 0.45 does not cap anything by itself — it is one disjunct of an
// exemption test. Publishing it as `maxFAR` would report a discretionary permit
// threshold as a by-right envelope ceiling, which is rule 6's error with an
// extra step: it would assume both a programme the user has not chosen AND a
// reading of the clause the clause does not support.
//
// THEREFORE: `farUnconstrained` for the residential districts. San Jose's code
// states no by-right maximum floor-area ratio for them; floor area is governed
// by the height, storey, setback and lot-area standards in the same table. That
// is the same finding already recorded for Raleigh, DC and Philadelphia — an
// ANSWER, not a missing lookup.
//
// The 0.45 figure is preserved below as what it actually is, so the hurdles
// path can use it later without anyone having to re-derive it from the code.
//
// CORROBORATED FROM A SECOND CHAPTER. ../providers/sanjose.ts already records
// a separate reading of Chapter 20.55 (urban villages), and § 20.55.040.D
// reaches the same conclusion by another route: "For projects that are 100%
// Residential the standard for du/ac shall apply" — density, not floor-area
// ratio, is the instrument for a wholly residential project. Two chapters,
// read independently, agreeing. That is the kind of check rule 9 asks for.
//
// SCOPE READ (rule 23): § 20.30.200 and § 20.100.1030 — the Chapter 20.30
// RESIDENTIAL districts. Out of scope here, and each for a different reason:
//   · Chapter 20.55 (urban villages) — READ, and its FARs are deliberately
//     WITHHELD rather than unknown. UVC 8.0, UV 10.0, MUC 0.25—4.5, UR 1.0—4.0,
//     TR 2.0—12.0, MUN 0.25—2.0 all exist, and each is conditional on a
//     programme the user has not chosen (rule 6). The reasoning lives at the
//     `maxFAR` line in ../providers/sanjose.ts; do not duplicate it here.
//   · Chapter 20.40 (commercial / public-quasi-public), 20.50 (industrial),
//     20.70 (downtown, the DC districts), 20.75 (pedestrian-oriented, MS-C /
//     MS-G) — NOT read. Gaps.
//   · Chapter 20.60 (PD — planned development), where standards come from the
//     approved PD permit rather than the code. § 20.100.1030(C)(2) says the
//     same: "The site is located in a planned development zoning district. All
//     construction… shall be governed by the provisions of Part 8".

/**
 * § 20.100.1030(C)(1). The floor-area ratio below which a single-family house
 * in ANY residential district needs no single-family house permit.
 *
 * THIS IS NOT A MAXIMUM AND MUST NOT BE PUBLISHED AS ONE. It is one disjunct
 * of an exemption test whose other branch is a height/storey limit. Exported
 * for the hurdles path, which is where a discretionary-permit trigger belongs.
 */
export const SFH_PERMIT_FAR_THRESHOLD = 0.45

/** The height/storey branch of the same exemption test. */
export const SFH_PERMIT_HEIGHT_FT = 30
export const SFH_PERMIT_STORIES = 2

const TABLE = 'San Jose Municipal Code § 20.30.200, Development standards table (residential zoning districts)'

export interface SanJoseZone {
  /** Base-district height ceiling in feet, as § 20.30.200 states it. */
  maxHeightFt: number | null
  /** Storey count the table states directly. Carried rather than derived — a
   *  derived count round-trips through a floor-to-floor constant (rule 12). */
  maxStories: number | null
  /** True where the code states no by-right maximum FAR. See the header. */
  farUnconstrained: boolean
}

/**
 * The eight residential districts of § 20.30.200, read from the table's own
 * column header row: R-1-8 | R-1-5 | R-1-2 | R-1-1 | R-1-RR | R-2 | R-M | R-MH.
 *
 * Note the ordering is NOT by lot size — R-1-8's minimum lot area is 5,445 sq
 * ft and R-1-5's is 8,000. Reading the columns in size order would silently
 * transpose the first two districts.
 */
const ZONES: Readonly<Record<string, SanJoseZone>> = Object.freeze({
  'R-1-8': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  'R-1-5': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  'R-1-2': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  'R-1-1': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  'R-1-RR': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  'R-2': { maxHeightFt: 35, maxStories: 2.5, farUnconstrained: true },
  // R-M's height cell reads "45 or established in Chapter 20.85", and its
  // storey cell reads "Not applicable". 45 is carried as the base figure; the
  // Chapter 20.85 alternative is an OVERLAY that has not been read, and the
  // provider's separate height-district layer is what resolves it in practice.
  'R-M': { maxHeightFt: 45, maxStories: null, farUnconstrained: true },
  'R-MH': { maxHeightFt: 45, maxStories: 3, farUnconstrained: true },
})

export const SAN_JOSE_ZONE_CODES: readonly string[] = Object.freeze(Object.keys(ZONES))

export interface SanJoseLimits {
  maxFAR: number | null
  farUnconstrained: boolean
  maxHeightFt: number | null
  maxStories: number | null
  source: string | null
}

const UNRESOLVED: SanJoseLimits = Object.freeze({
  maxFAR: null,
  farUnconstrained: false,
  maxHeightFt: null,
  maxStories: null,
  source: null,
})

/**
 * Normalise a ZONING / ZONINGABBREV value to a table key.
 *
 * Returns null for every district outside § 20.30.200 — commercial,
 * industrial, downtown, pedestrian-oriented and planned-development codes are
 * OUT OF THE SCOPE THAT WAS READ and must keep reading as gaps. A `(PD)` suffix
 * disqualifies a code even when its base looks residential, because
 * § 20.100.1030(C)(2) hands those parcels to the approved PD permit.
 */
export function sanJoseZoneKey(code: string | null | undefined): string | null {
  if (!code) return null
  const z = String(code).trim().toUpperCase().replace(/\s+/g, '')
  if (!z) return null
  // Planned development in any form — A(PD), R-1-8(PD), PD — is governed by its
  // permit, never by this table.
  if (/\(PD\)|^PD\b|^A\(PD\)/.test(z)) return null
  return z in ZONES ? z : null
}

/**
 * Resolve a San Jose residential district.
 *
 * `maxFAR` is ALWAYS null here and `farUnconstrained` is always true for a
 * district this module knows — that is the finding, not a placeholder. The
 * distinction that matters downstream is between this (an answer) and an
 * unknown district (a gap), which returns `farUnconstrained: false`.
 */
export function resolveSanJose(code: string | null | undefined): SanJoseLimits {
  const key = sanJoseZoneKey(code)
  if (!key) return UNRESOLVED
  const z = ZONES[key]
  return {
    maxFAR: null,
    farUnconstrained: z.farUnconstrained,
    maxHeightFt: z.maxHeightFt,
    maxStories: z.maxStories,
    source: TABLE,
  }
}
