// San Diego residential base-zone FAR — Land Development Code, Municipal Code
// Chapter 13, Article 1, Division 4 (Residential Base Zones), 7-2026 printing.
// Source PDF: https://docs.sandiego.gov/municode/municodechapter13/ch13art01division04.pdf
//
// WHY THIS MODULE EXISTS
// San Diego's GIS publishes ZONE_NAME and nothing else — no FAR, no base-zone
// height. Every developable parcel in the 2026-08-11 sample therefore fell
// through to the assumed-FAR fallback: 0 resolved, 0 unconstrained, 11 gaps.
// The FAR is real and public; it just lives in the code's tables rather than in
// a feature service. This module is those tables.
//
// ⚠️ HOW THIS MODULE WAS NEARLY WRITTEN BACKWARDS — read before editing.
// The first read of this Division was done by fetching the PDF and asking a
// summarising model whether a FAR existed. It answered, in four separate
// places, that no table had a FAR row, that no FAR was stated for RS zones, and
// that "no section heading in this Division contains the phrase 'floor area
// ratio'". All four are false. The Division contains §131.0446, titled
// "Maximum Floor Area Ratio in Residential Zones", and the phrase occurs 23
// times. Acting on that summary would have set `farUnconstrained: true` for
// San Diego and published "the code imposes no FAR here" — a FABRICATED KNOWN
// ABSENCE, which is the most expensive class of error in this repo (rules 5,
// 18). What caught it was extracting the PDF's own text and grepping the
// section headings. **Establish an absence from the document's structure, never
// from a reader's report that it could not find something (rule 8).**
//
// SCOPE READ (rule 23). Division 4 (residential base zones) and Division 3
// (agricultural). NOT read, and therefore still gaps rather than absences:
//   · Division 2 (open space) — its Table 131-02C DOES have a "Max Floor Area
//     Ratio" row reading `-- -- 0.45 0.10 --`, so a FAR applies to some of
//     OP/OC/OR/OF. It is not encoded because the four-row column header does
//     not survive text extraction and the values differ per column; assigning
//     0.45 or 0.10 to OR-1-1 would be a guess between two real figures.
//   · Division 5 (commercial) — § 131.0546 exists and its tables state FARs
//     from 0.75 to 4.0. Same blocker, and worse: the values vary across every
//     column, so a misalignment produces a plausible wrong number rather than
//     an obvious one.
//   · Division 6 (industrial) — § 131.0632 exists and Table 131-06C reads 2.0
//     across all five zone families. The figure is NOT encoded because
//     footnotes 7 and 11 override it geographically: "Within the Kearny Mesa
//     Community Plan area, the maximum floor area ratio is 1.0" and "Within
//     the Otay Mesa Community Plan area, the maximum floor area ratio is 0.50".
//     Publishing 2.0 would overstate an Otay Mesa parcel by 4×. This is rule
//     13 — the value resolves only from the base zone AND the community plan
//     area jointly, and no community-plan layer is wired.
//   · Chapter 13 Article 2 overlay zones, including the Coastal Height Limit
//   · Planned districts (Little Italy, Barrio Logan, Centre City, …), whose
//     FARs are set by their own planned-district ordinances
// A parcel in any of those resolves to null here and must keep reading as a
// GAP. Absence within a scope is not absence.

/** One entry per residential base zone. `far` is a flat ratio; `farByLotArea`
 *  marks the six zones whose ratio is a function of lot size; `alternatives`
 *  carries ratios that depend on a PROGRAM the user has not chosen. */
export interface SanDiegoZone {
  /** Flat maximum FAR, where the code states one number for the zone. */
  far: number | null
  /** True for RS-1-2…RS-1-7, whose FAR comes from Table 131-04J by lot area. */
  farByLotArea?: boolean
  /** Alternatives the code allows under a different program — a 3-storey
   *  building, or a 3-to-7-unit one. NEVER folded into `far`: reporting the
   *  larger assumes a program the user has not selected (rule 6). */
  alternatives?: readonly { label: string; far: number }[]
  /** True where the division's own structure shows no FAR applies at all. */
  farUnconstrained?: boolean
  /** Division 6 zone: the FAR is a joint function of zone and community plan. */
  industrial?: boolean
  /** Division 5 CC zone: same joint dependency, different override figure. */
  commercial?: boolean
  /** The exact table this row was read from, for the citation trail. */
  source: string
}

const DEV_REGS = 'San Diego Municipal Code § 131.0431, Development Regulations Table for Residential Zones (7-2026)'
const FAR_SEC = 'San Diego Municipal Code § 131.0446, Maximum Floor Area Ratio in Residential Zones (7-2026)'
/** Table 131-06C's own FAR row, read with its header `1st & 2nd >> IP- IL- IH-
 *  IS- IBT-`: `2.0(11) 2.0(7)(11) 2.0(11) 2.0(11) 2.0(7)(11)`. Every base value
 *  is the SAME, so a column misalignment cannot change the answer here — the
 *  risk in this division is the two footnotes, not the columns. */
export const INDUSTRIAL_BASE_FAR = 2.0

/** § 131.0632 footnote 7. Applies to IL and IBT only — the two columns carrying
 *  a (7). */
export const KEARNY_MESA_FAR = 1.0
const FN7_FAMILIES = new Set(['IL', 'IBT'])

/**
 * The community plan names that change the industrial answer, EXACT-matched.
 *
 * ⚠️ `OTAY MESA` and `OTAY MESA-NESTOR` are two different plan areas in
 * SANDAG's layer. A substring match on "OTAY MESA" would apply the 0.50 cap to
 * Otay Mesa-Nestor, which footnote 11 does not name — understating a parcel by
 * 4×. Enumerated from the layer's own 57 distinct `cpname` values rather than
 * guessed.
 */
export const CP_KEARNY_MESA = 'KEARNY MESA'
export const CP_OTAY_MESA = 'OTAY MESA'

/**
 * Table 131-05E — the CC commercial zones. Read 2026-08-15 by RENDERING pages
 * 35 and 36 of the Division 5 PDF as images and reading them, which is the
 * method this repo already validates for merged-cell tables (see
 * ../zoning/minneapolis.ts). Neither text extraction nor pdfplumber's table
 * parser could reconstruct this header: the 4th-row numeral spans FOUR 3rd-row
 * tokens and the FAR is a single merged cell across that group.
 *
 * Key = the full district code; value = the group's Max Floor Area Ratio.
 *
 * ⚠️ TWO NEIGHBOURING ROWS ARE NOT THIS ONE. The table also carries "Floor Area
 * Ratio Bonus for Residential Mixed Use" (§ 131.0546(a)) and "Minimum Floor
 * Area Ratio for Residential Use". The first is a BONUS — an alternative, not
 * the headline (rule 6) — and the second is a MINIMUM, which would be a
 * catastrophic thing to publish as a maximum. Only the "Max Floor Area Ratio"
 * row is transcribed here.
 */
const CC_FAR: Readonly<Record<string, number>> = Object.freeze({
  // 4th >> 1  (3rd: 1- 2- 4- 5-)   Max FAR 0.75, height 30
  'CC-1-1': 0.75, 'CC-2-1': 0.75, 'CC-4-1': 0.75, 'CC-5-1': 0.75,
  // 4th >> 2  (3rd: 1- 2- 4- 5-)   Max FAR 2.0, height 60
  'CC-1-2': 2.0, 'CC-2-2': 2.0, 'CC-4-2': 2.0, 'CC-5-2': 2.0,
  // 4th >> 3  (3rd: 1- 2- 4- 5-)   Max FAR 0.75, height 45
  'CC-1-3': 0.75, 'CC-2-3': 0.75, 'CC-4-3': 0.75, 'CC-5-3': 0.75,
  // 4th >> 4  (3rd: 2- 3- 4- 5-)   Max FAR 1.0, height 30
  'CC-2-4': 1.0, 'CC-3-4': 1.0, 'CC-4-4': 1.0, 'CC-5-4': 1.0,
  // 4th >> 5  (3rd: 2- 3- 4- 5-)   Max FAR 2.0, height 100
  'CC-2-5': 2.0, 'CC-3-5': 2.0, 'CC-4-5': 2.0, 'CC-5-5': 2.0,
  // 4th >> 6  (3rd: 3- 4- 5-)      Max FAR 2.0, height 65
  'CC-3-6': 2.0, 'CC-4-6': 2.0, 'CC-5-6': 2.0,
  // 4th >> 7..11 (3rd: 3- only)
  'CC-3-7': 2.0, 'CC-3-8': 2.0, 'CC-3-9': 2.0, 'CC-3-10': 3.0, 'CC-3-11': 4.0,
})

/** Table 131-05E footnote 4, verbatim: "Within the Otay Mesa Community Plan
 *  area, the maximum floor area ratio is 0.30."
 *
 *  ⚠️ FOOTNOTE NUMBERING IS PER TABLE. The identical sentence is footnote 3 of
 *  Table 131-05C. Reading a footnote by number across tables attributes the
 *  wrong rule; this one was taken from the block that follows 131-05E.
 *
 *  Unlike the industrial footnote 11 this carries NO "unless a final map has
 *  been recorded" exception, so an Otay Mesa commercial parcel resolves
 *  cleanly at 0.30 rather than staying a gap. */
export const CC_OTAY_MESA_FAR = 0.3

const CC_TABLE =
  'San Diego Municipal Code § 131.0531, Table 131-05E (Development Regulations for CC Zones, 7-2026) — Max Floor Area Ratio row'
const CC_OTAY =
  'San Diego Municipal Code § 131.0531, Table 131-05E footnote 4: "Within the Otay Mesa Community Plan area, the maximum floor area ratio is 0.30."'

const IND_TABLE =
  'San Diego Municipal Code § 131.0632 and Table 131-06C (Development Regulations for Industrial Zones, 7-2026)'
const IND_OTAY =
  'San Diego Municipal Code § 131.0632, Table 131-06C footnote 11: "Within the Otay Mesa Community Plan area, the maximum floor area ratio is 0.50 unless a final map has been recorded prior to May 18, 2014" — the recording date is not in the parcel layer, so the figure cannot be resolved here'

const AG_TABLE =
  'San Diego Municipal Code § 131.0331, Table 131-03C (Development Regulations for Agricultural Zones, 7-2026) — the table states Max Lot Coverage and has no Max Floor Area Ratio row, and Division 3 has no maximum-FAR section'

/**
 * Table 131-04J — maximum FAR by lot area, for RS-1-2 through RS-1-7 only.
 * Read verbatim from § 131.0446(a)(1). Bands are inclusive upper bounds in
 * square feet; the final band is open-ended.
 *
 * The published table contains a typographical error at the third row, which
 * reads "4.001 - 5,000" with a decimal point. The band is 4,001–5,000; the
 * adjacent rows make the sequence unambiguous. Transcribed as intended, and
 * noted here so a later reader does not "fix" it back.
 */
export const RS_FAR_BY_LOT_AREA: readonly { maxLotSqFt: number; far: number }[] = Object.freeze([
  { maxLotSqFt: 3_000, far: 0.7 },
  { maxLotSqFt: 4_000, far: 0.65 },
  { maxLotSqFt: 5_000, far: 0.6 },
  { maxLotSqFt: 6_000, far: 0.59 },
  { maxLotSqFt: 7_000, far: 0.58 },
  { maxLotSqFt: 8_000, far: 0.57 },
  { maxLotSqFt: 9_000, far: 0.56 },
  { maxLotSqFt: 10_000, far: 0.55 },
  { maxLotSqFt: 11_000, far: 0.54 },
  { maxLotSqFt: 12_000, far: 0.53 },
  { maxLotSqFt: 13_000, far: 0.52 },
  { maxLotSqFt: 14_000, far: 0.51 },
  { maxLotSqFt: 15_000, far: 0.5 },
  { maxLotSqFt: 16_000, far: 0.49 },
  { maxLotSqFt: 17_000, far: 0.48 },
  { maxLotSqFt: 18_000, far: 0.47 },
  { maxLotSqFt: 19_000, far: 0.46 },
  { maxLotSqFt: Number.POSITIVE_INFINITY, far: 0.45 },
])

/**
 * Table 131-04K — RM-5-12 only. The FAR RISES with height rather than trading
 * against it, so the base 1.80 is the headline and the taller figures are
 * alternatives (§ 131.0446(f)).
 */
export const RM_5_12_BY_HEIGHT: readonly { label: string; far: number }[] = Object.freeze([
  { label: '5 storeys or 60 ft', far: 1.85 },
  { label: '6 storeys or 72 ft', far: 1.9 },
  { label: '7 storeys or 84 ft', far: 1.95 },
  { label: '8 storeys or 96 ft', far: 2.0 },
  { label: '9 storeys or 108 ft', far: 2.05 },
  { label: 'more than 10 storeys or 120 ft', far: 2.1 },
])

/**
 * Every residential base zone in Division 4, with the FAR its table states.
 *
 * Column alignment was verified against each table's own four-row designator
 * header (`1st & 2nd >> RM-`, `3rd >> 3- 3- 3- 4- 4- 5`, `4th >> 7 8 9 10 11
 * 12`) rather than by counting cells — an off-by-one in a multi-column zoning
 * table is silent and has already shipped once in this repo (DC's MU columns).
 */
const ZONES: Readonly<Record<string, SanDiegoZone>> = Object.freeze({
  // ── RS, single unit. Two tables: RS-1-1…1-7 and RS-1-8…1-14. ──
  // RS-1-1 states a flat 0.45; RS-1-2…1-7 read "varies(5)", footnote 5 pointing
  // at Table 131-04J.
  'RS-1-1': { far: 0.45, source: DEV_REGS },
  'RS-1-2': { far: null, farByLotArea: true, source: FAR_SEC },
  'RS-1-3': { far: null, farByLotArea: true, source: FAR_SEC },
  'RS-1-4': { far: null, farByLotArea: true, source: FAR_SEC },
  'RS-1-5': { far: null, farByLotArea: true, source: FAR_SEC },
  'RS-1-6': { far: null, farByLotArea: true, source: FAR_SEC },
  'RS-1-7': { far: null, farByLotArea: true, source: FAR_SEC },
  // RS-1-8 breaks the run at 0.45; 1-9 through 1-14 are all 0.60.
  'RS-1-8': { far: 0.45, source: DEV_REGS },
  'RS-1-9': { far: 0.6, source: DEV_REGS },
  'RS-1-10': { far: 0.6, source: DEV_REGS },
  'RS-1-11': { far: 0.6, source: DEV_REGS },
  'RS-1-12': { far: 0.6, source: DEV_REGS },
  'RS-1-13': { far: 0.6, source: DEV_REGS },
  'RS-1-14': { far: 0.6, source: DEV_REGS },

  // ── RX, small lot. § 131.0446(c) computes the ratio on the zone's MINIMUM
  // lot area (or the sub-10%-gradient area) rather than the actual lot, so the
  // ratio below is correct but the area it multiplies is not the parcel's.
  // Recorded here; the resolver does not attempt that substitution.
  'RX-1-1': { far: 0.7, source: DEV_REGS },
  'RX-1-2': { far: 0.8, source: DEV_REGS },

  // ── RT, townhouse. Two FAR rows: "1 and 2 story buildings" and "3 story
  // buildings". The storey count is the applicant's choice, so the 1–2 storey
  // figure is the base case and the 3-storey figure is an alternative.
  'RT-1-1': { far: 0.85, alternatives: [{ label: '3-storey building', far: 1.2 }], source: DEV_REGS },
  'RT-1-2': { far: 0.95, alternatives: [{ label: '3-storey building', far: 1.3 }], source: DEV_REGS },
  'RT-1-3': { far: 1.0, alternatives: [{ label: '3-storey building', far: 1.4 }], source: DEV_REGS },
  'RT-1-4': { far: 1.1, alternatives: [{ label: '3-storey building', far: 1.5 }], source: DEV_REGS },
  'RT-1-5': { far: 1.2, alternatives: [{ label: '3-storey building', far: 1.6 }], source: DEV_REGS },

  // ── RM-1 / RM-2, multiple unit. Two FAR rows: "1 to 2 dwelling units" and
  // "3 to 7 dwelling units". Unit count is a program choice, same treatment.
  // RM-1-1 is the only row where the 3-7 figure (1.0) exceeds the 1-2 figure
  // (0.75) by more than a rounding step; RM-1-3 onward the two rows agree, so
  // no alternative is emitted where it would restate the headline.
  'RM-1-1': { far: 0.75, alternatives: [{ label: '3–7 dwelling units', far: 1.0 }], source: DEV_REGS },
  'RM-1-2': { far: 0.9, alternatives: [{ label: '3–7 dwelling units', far: 1.0 }], source: DEV_REGS },
  'RM-1-3': { far: 1.05, source: DEV_REGS },
  'RM-2-4': { far: 1.2, source: DEV_REGS },
  'RM-2-5': { far: 1.35, source: DEV_REGS },
  'RM-2-6': { far: 1.5, source: DEV_REGS },

  // ── RM-3 / RM-4 / RM-5. Single FAR row, one figure per zone.
  'RM-3-7': { far: 1.8, source: DEV_REGS },
  'RM-3-8': { far: 2.25, source: DEV_REGS },
  'RM-3-9': { far: 2.7, source: DEV_REGS },
  'RM-4-10': { far: 3.6, source: DEV_REGS },
  'RM-4-11': { far: 7.2, source: DEV_REGS },
  // RM-5-12's own row reads 1.80 with footnote 35; § 131.0446(f) raises it with
  // height per Table 131-04K.
  'RM-5-12': { far: 1.8, alternatives: RM_5_12_BY_HEIGHT, source: FAR_SEC },

  // ── AG / AR, Division 3 (Agricultural Zones). NO FAR APPLIES. ──
  //
  // This is the rule-5 slot test answering in the negative, from the document's
  // own structure rather than from a reader failing to find something:
  //
  //   · Table 131-03C has NO "Max Floor Area Ratio" row. Its bulk row is "Max
  //     Lot Coverage (%)" — 10 / 20 / 10 / 20. (The table's "Min Floor Area(6)"
  //     row is a 650 sq ft MINIMUM dwelling size, not a ratio; do not read it
  //     as one.)
  //   · Division 3's section list has § 131.0344 "Maximum Structure Height in
  //     Agricultural Zones" and no maximum-floor-area-ratio section, while the
  //     divisions where FAR does apply each have one exactly where it belongs —
  //     § 131.0446 residential, § 131.0546 commercial, § 131.0632 industrial.
  //
  // Column alignment is unambiguous here, unlike the commercial tables: the
  // header reads `1st & 2nd >> AG AR`, `3rd >> 1- 1- 1- 1-`, `4th >> 1 2 1 2`.
  'AG-1-1': { far: null, farUnconstrained: true, source: AG_TABLE },
  'AG-1-2': { far: null, farUnconstrained: true, source: AG_TABLE },
  'AR-1-1': { far: null, farUnconstrained: true, source: AG_TABLE },
  'AR-1-2': { far: null, farUnconstrained: true, source: AG_TABLE },

  // ── Industrial, Division 6. FAR depends on the COMMUNITY PLAN AREA as well
  // as the zone (rule 13), so these carry no flat `far` — resolveSanDiego
  // computes them from the base figure and the two footnotes. Listed here so
  // the district is KNOWN (and so `sanDiegoZoneKey` accepts it); the value
  // comes from `industrialFar` below.
  'IP-1-1': { far: null, industrial: true, source: IND_TABLE },
  'IP-2-1': { far: null, industrial: true, source: IND_TABLE },
  'IP-3-1': { far: null, industrial: true, source: IND_TABLE },
  'IL-1-1': { far: null, industrial: true, source: IND_TABLE },
  'IL-2-1': { far: null, industrial: true, source: IND_TABLE },
  'IL-3-1': { far: null, industrial: true, source: IND_TABLE },
  'IH-1-1': { far: null, industrial: true, source: IND_TABLE },
  'IH-2-1': { far: null, industrial: true, source: IND_TABLE },
  'IS-1-1': { far: null, industrial: true, source: IND_TABLE },
  'IBT-1-1': { far: null, industrial: true, source: IND_TABLE },

  // ── CC commercial, Division 5. Like industrial, the figure depends on the
  // community plan area, so these carry no flat `far`; resolveSanDiego computes
  // them from CC_FAR and footnote 4.
  ...Object.fromEntries(Object.keys(CC_FAR).map((z) => [z, { far: null, commercial: true, source: CC_TABLE }])),
})

export const SAN_DIEGO_ZONE_CODES: readonly string[] = Object.freeze(Object.keys(ZONES))

/**
 * Normalise a ZONE_NAME from the City's zoning service to a table key.
 * Returns null for anything not a Division 4 residential base zone — including
 * commercial, industrial and planned-district codes, which are OUT OF SCOPE and
 * must stay gaps rather than silently resolving to nothing-in-particular.
 */
export function sanDiegoZoneKey(code: string | null | undefined): string | null {
  if (!code) return null
  const z = String(code).trim().toUpperCase().replace(/\s+/g, '')
  return z in ZONES ? z : null
}

export interface SanDiegoLimits {
  maxFAR: number | null
  /** The code affirmatively imposes no FAR here — an ANSWER, not a gap. */
  farUnconstrained: boolean
  farAlternatives: readonly { label: string; far: number; source: string }[]
  source: string | null
}

const UNRESOLVED: SanDiegoLimits = Object.freeze({
  maxFAR: null,
  farUnconstrained: false,
  farAlternatives: [],
  source: null,
})

/** Table 131-04J lookup. Exported so a test can pin the band edges directly. */
export function rsFarForLotArea(lotSqFt: number): number {
  for (const band of RS_FAR_BY_LOT_AREA) {
    if (lotSqFt <= band.maxLotSqFt) return band.far
  }
  // Unreachable: the final band is open-ended. Kept total rather than throwing.
  return RS_FAR_BY_LOT_AREA[RS_FAR_BY_LOT_AREA.length - 1].far
}

/**
 * Resolve a San Diego residential base zone to its FAR.
 *
 * `lotSqFt` is REQUIRED for RS-1-2…RS-1-7 and ignored elsewhere. When one of
 * those six zones is resolved without a lot size, the answer is UNRESOLVED —
 * not a default band. A guessed band is an invented number wearing a citation
 * (rule 4), and the 0.70/0.45 spread across the table is 56%.
 */
export function resolveSanDiego(
  code: string | null | undefined,
  lotSqFt: number | null | undefined,
  communityPlan?: string | null,
): SanDiegoLimits {
  const key = sanDiegoZoneKey(code)
  if (!key) return UNRESOLVED
  const zone = ZONES[key]

  if (zone.industrial) return industrialFar(key, communityPlan)
  if (zone.commercial) return commercialFar(key, communityPlan)

  const alternatives = (zone.alternatives ?? []).map((a) => ({ ...a, source: zone.source }))

  if (zone.farUnconstrained) {
    return { maxFAR: null, farUnconstrained: true, farAlternatives: [], source: zone.source }
  }

  if (zone.farByLotArea) {
    if (lotSqFt == null || !Number.isFinite(lotSqFt) || lotSqFt <= 0) return UNRESOLVED
    return {
      maxFAR: rsFarForLotArea(lotSqFt),
      farUnconstrained: false,
      farAlternatives: alternatives,
      source: zone.source,
    }
  }

  return { maxFAR: zone.far, farUnconstrained: false, farAlternatives: alternatives, source: zone.source }
}


/**
 * Industrial FAR — a joint function of the zone family and the community plan
 * area (rule 13). Table 131-06C states 2.0 for every family; two footnotes move
 * it geographically.
 *
 * THE UNKNOWN CASE FAILS CLOSED. With no community plan resolved we cannot rule
 * out Otay Mesa, where the figure may be 0.50 — a quarter of the base. So an
 * absent or failed community-plan read yields UNRESOLVED, never the base 2.0.
 * Publishing 2.0 for an Otay Mesa parcel would overstate it fourfold, and that
 * number flows into unit counts, fees and hurdles.
 */
function industrialFar(key: string, communityPlan?: string | null): SanDiegoLimits {
  // THREE STATES, and two of them are NOT the same (the state split this repo
  // runs on):
  //   · undefined — the layer was not read, or the read FAILED. Otay Mesa
  //     cannot be ruled out, so refuse.
  //   · null      — the layer ANSWERED and no plan polygon covers the point.
  //     That is a fact: the parcel is outside every community plan area, so it
  //     is outside Otay Mesa and Kearny Mesa, and the base figure applies.
  //   · a name    — match it exactly.
  // Collapsing the first two would either refuse on a real answer or publish
  // on a failed fetch; the first is merely lossy, the second is the defect.
  if (communityPlan === undefined) return UNRESOLVED
  const cp = communityPlan === null ? '' : String(communityPlan).trim().toUpperCase()

  // Otay Mesa: 0.50 "unless a final map has been recorded prior to May 18,
  // 2014". The parcel layer carries no map-recording date, so BOTH 0.50 and
  // 2.0 remain live and neither can be published. A gap, with the reason.
  if (cp === CP_OTAY_MESA) {
    return { maxFAR: null, farUnconstrained: false, farAlternatives: [], source: IND_OTAY }
  }

  const family = key.split('-')[0]
  if (cp === CP_KEARNY_MESA && FN7_FAMILIES.has(family)) {
    return { maxFAR: KEARNY_MESA_FAR, farUnconstrained: false, farAlternatives: [], source: IND_TABLE }
  }

  return { maxFAR: INDUSTRIAL_BASE_FAR, farUnconstrained: false, farAlternatives: [], source: IND_TABLE }
}


/**
 * CC commercial FAR — Table 131-05E, with footnote 4's Otay Mesa override.
 *
 * Same three-state community-plan contract as `industrialFar`, and the same
 * fail-closed reason: without the plan area Otay Mesa cannot be ruled out, and
 * the override is a QUARTER of the smallest base figure. The difference is that
 * footnote 4 has no recorded-map exception, so an Otay Mesa parcel resolves at
 * 0.30 instead of staying a gap.
 */
function commercialFar(key: string, communityPlan?: string | null): SanDiegoLimits {
  if (communityPlan === undefined) return UNRESOLVED
  const cp = communityPlan === null ? '' : String(communityPlan).trim().toUpperCase()
  const base = CC_FAR[key]
  if (base == null) return UNRESOLVED
  if (cp === CP_OTAY_MESA) {
    return { maxFAR: CC_OTAY_MESA_FAR, farUnconstrained: false, farAlternatives: [], source: CC_OTAY }
  }
  return { maxFAR: base, farUnconstrained: false, farAlternatives: [], source: CC_TABLE }
}
