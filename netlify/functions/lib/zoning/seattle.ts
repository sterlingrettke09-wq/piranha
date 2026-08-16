import { stripMioPrefix, hasMhaSuffix } from './seattleZoneString'
// Seattle commercial/NC FAR table (WO-8.8 depth tranche 2).
//
// Source: Seattle Municipal Code (SMC) Title 23, Subtitle III, Chapter 23.47A
// (Commercial), Section 23.47A.013 "Floor area ratio," Table A. Re-read verbatim
// from the codified text 2026-08-05 (Municode, current through Ord. 127376 §50,
// 2025 — the ordinance-history line printed at the end of 23.47A.013). Section
// citations are in-line below.
//
// THE GAP THIS FILLS — FAR for NC/C zones. The Seattle provider derives HEIGHT
// from the trailing suffix (NC3-65 → 65 ft) but leaves maxFAR null, because the
// King County / Seattle GeoData zoning feed carries the zone string, not an FAR.
// SMC 23.47A.013 Table A publishes the by-right FAR for NC1/NC2/NC3/C1/C2 zones
// as a pure function of the HEIGHT-LIMIT SUFFIX (the trailing number in the zone
// code), with ONE exception at the 40-foot row (footnote 1, handled below). So we
// resolve FAR programmatically from that suffix, exactly as the provider already
// parses height.
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
  /** Ratios the code allows under a DENSER programme than the headline. Never
   *  folded into `far` — reporting the larger assumes a programme the user has
   *  not chosen (rule 6). */
  farAlternatives?: readonly { label: string; far: number; source: string }[]
  /** Floor-area ALLOWANCE in square feet, where the code caps at "the greater
   *  of the ratio or a fixed value". */
  farFloorSqFt?: number | null
}

// ── NR, Neighborhood Residential (SMC 23.44.050, Table A for 23.44.050) ──────
//
// NR was 15 of Seattle's 17 developable gaps — 88% of the city's shortfall in
// one district — because this module only ever handled NC/C.
//
// ⚠️ THE FAR IS KEYED BY THE DENSITY OF THE PROPOSED DEVELOPMENT, NOT BY THE
// DISTRICT. Table A's rows are "dwelling units per lot size" bands, so a bare NR
// parcel has no single by-right ratio: the applicant's programme picks the row.
// The LEAST DENSE row is therefore the headline, and the rest are alternatives
// (rule 6) — reporting 1.6 as "the" NR FAR would assume a programme nobody has
// chosen and flow into unit counts, fees and hurdles.
const NR_SRC = 'Seattle Municipal Code § 23.44.050.B, Table A for 23.44.050 (floor area ratio in NR zones)'

/** Table A verbatim. The headline is the first row; the rest are programme
 *  choices. The 1.0 and 1.2 figures are each conditioned on § 23.44.050.D in
 *  addition to the density band, so they are labelled as such. */
export const NR_FAR_BASE = 0.6
export const NR_FAR_ALTERNATIVES: readonly { label: string; far: number; source: string }[] = Object.freeze([
  { label: '1 unit per 4,000–2,201 sq ft of lot', far: 0.8, source: NR_SRC },
  { label: '1 unit per 4,000–2,201 sq ft, meeting § 23.44.050.D', far: 1.0, source: NR_SRC },
  { label: '1 unit per 2,200–1,601 sq ft', far: 1.0, source: NR_SRC },
  { label: '1 unit per 2,200–1,601 sq ft, meeting § 23.44.050.D', far: 1.2, source: NR_SRC },
  { label: '1 unit per 1,600 sq ft or denser', far: 1.6, source: NR_SRC },
  {
    label: 'affordable housing under § 23.44.170',
    far: 2.0,
    source: 'Seattle Municipal Code § 23.44.170.B.1 — an ELECTIVE standard in lieu of § 23.44.050.B, available only on a lot meeting § 23.44.170.A',
  },
])

/** § 23.44.050.B: "structures on lots with less than 5,000 square feet of lot
 *  area can include up to 2,500 square feet of total chargeable floor area or
 *  the amount … allowed by the FAR limit …, whichever is greater." */
export const NR_SMALL_LOT_FLOOR_SQFT = 2_500
export const NR_SMALL_LOT_THRESHOLD_SQFT = 5_000

// ── LR / MR / HR, Multifamily (SMC 23.45.510, Table A and Table B) ──────────
//
// ⚠️ LR3's ROW SPLITS ON A GEOGRAPHIC FACT, NOT A PROGRAMME CHOICE. The table
// has separate rows for "LR3 outside regional centers and urban centers" (MHA
// 1.8) and "LR3 inside regional centers and urban centers" (MHA 2.3). That is a
// joint dependency (rule 13): the zone string alone cannot resolve it, and the
// two figures differ by 28%.
//
// The city publishes the boundary as `Centers_Boundaries_2044`, adopted by
// Ordinance 127375 and effective 2026-01-21. Its PLACE_TYPE_NAME values are
// Regional Center, Urban Center, Neighborhood Center, Manufacturing Industrial
// Center and Outside Centers — enumerated from the layer rather than assumed.
//
// ⚠️ ONLY "Regional Center" AND "Urban Center" COUNT AS INSIDE. The code names
// those two; a Neighborhood Center is not one of them and takes the OUTSIDE
// row. Matching on the word "Center" would put those parcels on 2.3 instead of
// 1.8.
//
// Without MHA, LR3 is 1.2 either way, so only its stacked-dwelling ALTERNATIVE
// needs the boundary. With MHA the base itself needs it, and the resolver
// refuses rather than pick a row.
export type SeattleCenter = 'inside' | 'outside' | null | undefined

const MF_SRC = 'Seattle Municipal Code § 23.45.510.B, Table A for 23.45.510 (FAR limits in LR and MR zones)'
const HR_SRC = 'Seattle Municipal Code § 23.45.510.C, Table B for 23.45.510 (FAR limits in HR zones)'

/** PLACE_TYPE_NAME values that satisfy the code's "regional centers and urban
 *  centers". Exported so the provider cannot drift from this list. */
export const SEATTLE_INSIDE_CENTER_TYPES: readonly string[] = Object.freeze(['REGIONAL CENTER', 'URBAN CENTER'])

/** Table A / Table B, verbatim. `stacked` is a programme choice and therefore
 *  an alternative, never the headline (rule 6). */
function multifamilyFar(zone: string, mha: boolean, center: SeattleCenter): DistrictLimits | null {
  const alt = (label: string, far: number) => ({ label, far, source: MF_SRC })

  if (/^LR1(?=$|[\s(-])/.test(zone)) {
    return mha
      ? { far: 1.3, heightFt: null, farAlternatives: [alt('stacked dwelling units', 1.5)] }
      : { far: 1.0, heightFt: null }
  }

  if (/^LR2(?=$|[\s(-])/.test(zone)) {
    return mha
      ? {
          far: 1.4,
          heightFt: null,
          farAlternatives: [
            alt('stacked dwelling units', 1.6),
            // Footnote 1: 1.8 for stacked units with an outdoor amenity area of
            // at least 35% of lot area, min 20 ft in width and depth, at or
            // within 4 ft of grade. Three conditions the applicant elects.
            alt('stacked dwelling units with a § 23.45.522 outdoor amenity area (footnote 1)', 1.8),
          ],
        }
      : { far: 1.1, heightFt: null }
  }

  if (/^LR3(?=$|[\s(-])/.test(zone)) {
    if (!mha) {
      // 1.2 on both rows, so the base resolves without the boundary; only the
      // stacked figure differs (1.3 outside, 1.5 inside).
      const stacked = center === 'inside' ? 1.5 : center === 'outside' ? 1.3 : null
      return {
        far: 1.2,
        heightFt: null,
        ...(stacked != null ? { farAlternatives: [alt('stacked dwelling units', stacked)] } : {}),
      }
    }
    // With MHA the BASE differs by row. Refuse rather than pick one.
    if (center === 'inside') return { far: 2.3, heightFt: null }
    if (center === 'outside') return { far: 1.8, heightFt: null }
    return { far: null, heightFt: null }
  }

  if (/^MR(?=$|[\s(-])/.test(zone)) {
    return { far: mha ? 4.5 : 3.2, heightFt: null }
  }

  if (/^HR(?=$|[\s(-])/.test(zone)) {
    // Table B: base 7, maximum 15 "allowed pursuant to Section 23.45.516 and
    // Chapter 23.58A". The extra is EARNED, so the base is the headline.
    return {
      far: 7,
      heightFt: null,
      farAlternatives: [{ label: 'extra floor area earned under § 23.45.516 and Ch. 23.58A', far: 15, source: HR_SRC }],
    }
  }

  return null
}

/** Matches the NR district and its live-feed variants. Deliberately does NOT
 *  match NC/C — `isNcOrC` owns those — nor anything merely starting with N. */
const NR_RE = /^NR(?=$|[\s(-])/

// ── NC/C FAR by height-limit suffix (SMC 23.47A.013 Table A, outside Station
//    Area Overlay Districts) ──────────────────────────────────────────────────
// Re-read verbatim 2026-08-05. Key = the height-limit number (feet) in the zone
// suffix; value = the FAR printed in that row of Table A.
//
// Footnote 2 on the 200-ft row (FAR 12 within the First Hill/Capitol Hill
// Regional Center where the development contains at least 4 FAR of residential
// uses) is a location- and program-conditioned figure, not a flat by-right one,
// so we store the base 8.25. Footnote 1 on the 40-ft row is NOT a bonus and is
// handled in farForHeight() below.
const NC_FAR_BY_HEIGHT: Record<number, number> = {
  30: 2.5, // SMC 23.47A.013 Table A
  40: 3.0, // SMC 23.47A.013 Table A — applies to zones WITH an MHA suffix; see NC_FAR_40_NO_MHA
  55: 3.75, // SMC 23.47A.013 Table A
  65: 4.5, // SMC 23.47A.013 Table A
  75: 5.5, // SMC 23.47A.013 Table A
  85: 5.75, // SMC 23.47A.013 Table A
  95: 6.25, // SMC 23.47A.013 Table A
  145: 7.0, // SMC 23.47A.013 Table A
  200: 8.25, // SMC 23.47A.013 Table A (12 within First Hill/Capitol Hill RC w/≥4 FAR resid — store base 8.25)
}

// Footnote 1 to Table A for 23.47A.013, verbatim: "Except that zones without a
// mandatory housing affordability suffix have a maximum FAR of 3.25". So the
// printed 3.0 is the MHA-suffixed figure and 3.25 is the by-right maximum for an
// unsuffixed 40-foot NC/C zone — two genuinely different rows, not a bonus tier.
// The footnote marker appears on the 40-foot row ONLY; every other row of Table A
// is the same with or without the suffix.
//
// Previously this module stored 3.0 for every 40-foot zone on the theory that MHA
// status could not be read from the code. That was false: the provider passes the
// RAW `ZONING` string from the Seattle GeoData feed straight through (see
// netlify/functions/lib/providers/seattle.ts), and that feed spells the suffix out
// — "NC2-40 (M)" / "NC1-40 (M1)" / "NC1-40 (M2)" alongside plain "NC2-40",
// "C1-40", "NC3P-40". A live distinct-value query on the feed on 2026-08-05
// returned both forms, and roughly a third of the 40-foot NC/C polygons sampled
// carried no MHA suffix at all.
const NC_FAR_40_NO_MHA = 3.25

// SMC 23.30.010.B, verbatim: "Mandatory housing affordability suffixes include
// (M), (M1), and (M2)." Anything else in parentheses (e.g. the incentive-zoning
// "LR2 (0.75)") is not an MHA suffix.
// hasMhaSuffix now lives in ./seattleZoneString — the MHA suffix drives BOTH
// height and FAR, and two readings of it is the pair this file already learned
// to avoid.

// Zone-prefix families that 23.47A.013 Table A governs, per SMC 23.47A.002.A
// (this chapter describes the standards for NC1, NC2, NC3, C1 and C2). SM
// (Seattle Mixed) and the LR/MR/HR multifamily zones have their own FAR tables
// (SMC 23.48 / 23.45) not replicated here, so they are excluded — resolveSeattle
// returns null FAR.
//
// The optional trailing "P" is the PEDESTRIAN DESIGNATION (NC1P/NC2P/NC3P/C1P/
// C2P). It does not take the district out of 23.47A.013:
//   * SMC 23.30.010.B — a letter suffix denotes a different zone, but "each
//     reference in this Title 23 to any zoning designation in subsection
//     23.30.010.A without a suffix ... includes any zoning classifications
//     created by the addition to that designation of one or more suffixes." So
//     23.47A.013's "NC zones and C zones" reaches NC3P.
//   * SMC 23.47A.013 itself names both forms in one breath in subsection F.2 —
//     "a NC3-200 or NC3P-200 zoned area" — and subsection E.1.a imposes the
//     Table C minimum FAR specifically on pedestrian-designated zones.
// Before this was fixed the P families fell through to far: null; a live query of
// the Seattle GeoData zoning feed on 2026-08-05 found P-designated polygons at
// roughly 28% of all NC/C polygons in the sample returned.
const NC_C_RE = /^(?:NC[123]|C[12])P?(?=$|[-\s])/

function isNcOrC(zone: string): boolean {
  return NC_C_RE.test(zone)
}

// Table A lookup for one height-limit row. Returns null (a GAP, never a guess)
// for a height with no published row — no interpolation between rows.
function farForHeight(height: number, mha: boolean): number | null {
  const base = NC_FAR_BY_HEIGHT[height]
  if (base === undefined) return null
  // Footnote 1 to Table A for 23.47A.013 — the 40-foot row only.
  if (height === 40 && !mha) return NC_FAR_40_NO_MHA
  return base
}

/**
 * Resolve the Seattle by-right FAR for a commercial/NC zone code (e.g. "NC3-65",
 * "C1-40", "NC2-40 (M1)", "NC3P-95 (M2)"). Mirrors the provider's suffix parsing:
 * strips a MIO prefix and reads the TRAILING height-limit number, then looks up
 * SMC 23.47A.013 Table A. Reads the (M)/(M1)/(M2) mandatory-housing-affordability
 * suffix, which Table A's footnote 1 makes load-bearing at the 40-foot row.
 *
 * Returns { far: null } for any zone that is NOT an NC1/NC2/NC3/C1/C2 zone
 * (LR/MR/HR multifamily, SM Seattle-Mixed, downtown, industrial — those have
 * separate or no FAR tables), and for any height suffix with no published Table-A
 * row. Height is always null here (the provider already derives it). NEVER
 * guesses a FAR.
 */
export function resolveSeattle(
  zone: string | null | undefined,
  center?: SeattleCenter,
): DistrictLimits {
  if (!zone) return { far: null, heightFt: null }
  let z = zone.trim().toUpperCase()

  // Strip the MIO (Major Institution Overlay) prefix so "MIO-105-NC3-65" reads
  // as the NC3-65 base zone. Shared with the provider — this file used to do it
  // inline and claim in its docstring to "mirror the provider's suffix parsing",
  // a claim nothing enforced and which was false on 39 live codes.
  //
  // PREFIX ONLY. The MHA suffix "(M)"/"(M1)"/"(M2)" must survive to hasMhaSuffix
  // below; the parentheticals are dropped later, once it has been read.
  z = stripMioPrefix(z)

  if (NR_RE.test(z)) {
    return {
      far: NR_FAR_BASE,
      heightFt: null,
      farAlternatives: NR_FAR_ALTERNATIVES,
      // Applied unconditionally because it can only ever bind below the code's
      // own 5,000 sq ft threshold: at the 0.6 headline the ratio yields 2,500
      // sq ft at a 4,167 sq ft lot, so any lot large enough to clear the
      // threshold already clears the floor.
      farFloorSqFt: NR_SMALL_LOT_FLOOR_SQFT,
    }
  }

  const mf = multifamilyFar(z, hasMhaSuffix(z), center)
  if (mf) return mf

  if (!isNcOrC(z)) return { far: null, heightFt: null }

  // Read the MHA suffix off the FULL string, then drop every parenthetical before
  // hunting for the height. SMC 23.47A.002.B contemplates NC/C zones "having an
  // incentive zoning suffix", and SMC 23.30.010.B describes those as "numerical
  // suffixes enclosed in parentheses" — the live feed spells one as "LR2 (0.75)".
  // Left in place, such a parenthetical's digits would be picked up as the height
  // limit, since the parse takes the LAST in-range number.
  const mha = hasMhaSuffix(z)
  // Already stripped by seattleBaseZoneToken above; kept as a no-op guard in
  // case this function is ever called with a raw string again.
  const bare = z.replace(/\([^)]*\)/g, ' ')

  // Trailing 2-3 digit height-limit token (NC3-65 → 65, C1-40 → 40). Take the
  // LAST in-range number, matching the provider's height parse — this ignores a
  // leading MIO height that survived.
  const nums = (bare.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (!nums.length) return { far: null, heightFt: null }
  const height = nums[nums.length - 1]

  return { far: farForHeight(height, mha), heightFt: null }
}

// Static documentation snapshot of resolveSeattle() output for the common NC/C
// variants, so a reviewer can eyeball resolved FAR without running code.
// resolveSeattle() is the runtime source of truth; the unit tests keep this in
// lock-step. Zone strings are spelled exactly as the Seattle GeoData zoning feed
// spells them, MHA parenthetical included.
export const SEATTLE_FAR: Record<string, DistrictLimits> = {
  'NC1-30': resolveSeattle('NC1-30'),
  'NC1-40': resolveSeattle('NC1-40'), // no MHA suffix → 3.25 (Table A footnote 1)
  'NC1-40 (M)': resolveSeattle('NC1-40 (M)'), // MHA-suffixed → 3.0
  'NC2-40': resolveSeattle('NC2-40'),
  'NC2-40 (M2)': resolveSeattle('NC2-40 (M2)'),
  'NC2-55 (M)': resolveSeattle('NC2-55 (M)'),
  'NC2-65': resolveSeattle('NC2-65'),
  'NC3-55 (M)': resolveSeattle('NC3-55 (M)'),
  'NC3-65': resolveSeattle('NC3-65'),
  'NC3-75 (M1)': resolveSeattle('NC3-75 (M1)'),
  'NC3-95 (M)': resolveSeattle('NC3-95 (M)'),
  'NC3-145 (M)': resolveSeattle('NC3-145 (M)'),
  'NC3-200 (M)': resolveSeattle('NC3-200 (M)'),
  'C1-40': resolveSeattle('C1-40'),
  'C1-40 (M)': resolveSeattle('C1-40 (M)'),
  'C1-65': resolveSeattle('C1-65'),
  'C2-40': resolveSeattle('C2-40'),
  'C2-65 (M1)': resolveSeattle('C2-65 (M1)'),
  // Pedestrian-designated variants — same Table A rows as their non-P twins.
  'NC1P-55 (M)': resolveSeattle('NC1P-55 (M)'),
  'NC2P-40': resolveSeattle('NC2P-40'),
  'NC2P-65': resolveSeattle('NC2P-65'),
  'NC3P-40': resolveSeattle('NC3P-40'),
  'NC3P-75 (M2)': resolveSeattle('NC3P-75 (M2)'),
  'NC3P-200 (M)': resolveSeattle('NC3P-200 (M)'),
  'C1P-40 (M)': resolveSeattle('C1P-40 (M)'),
  'C2P-55 (M)': resolveSeattle('C2P-55 (M)'),
}
