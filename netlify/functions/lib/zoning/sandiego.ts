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
//     OP/OC/OR/OF. Still unread; assigning 0.45 or 0.10 to OR-1-1 would be a
//     guess between two real figures.
//
//     ⚠️ THE REASON THIS NOTE ORIGINALLY GAVE IS NO LONGER TRUE. It said the
//     four-row column header does not survive text extraction. Under
//     `pdftotext -layout` it does — demonstrated on 2026-08-17 against Table
//     131-05C, whose header resolves to six columns (1st & 2nd >> CN-, 3rd >>
//     1-, 4th >> 1…6) with six values in every data row and six matching codes
//     in the live enumeration. The blocker was a statement about a TOOL, it was
//     accurate when written, and it silently became a permanent exclusion.
//     Divisions 2 and 5 are now blocked only on the reading time, not on the
//     extraction.
//   · Division 5 (commercial) — § 131.0546 exists and its tables state FARs
//     from 0.75 to 4.0. PARTLY READ: Table 131-05C (CN) is encoded above and
//     Table 131-05E (CC) was already. Table 131-05D (CR, CO, CV, CP) remains,
//     and the caution below still applies to it — the values vary across every
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
//   · Chapter 15 PLANNED DISTRICTS — 83 of the 183 live ZONE_NAME values, the
//     single largest block. Enumerated and mapped to their articles below.
// A parcel in any of those resolves to null here and must keep reading as a
// GAP. Absence within a scope is not absence.
//
// ── CHAPTER 15 PLANNED DISTRICTS: READ 2026-08-17, AND NOT WHAT WAS ASSUMED ──
//
// ⚠️ THIS NOTE PREVIOUSLY DESCRIBED THESE AS DISTRICTS WHOSE FARS ARE SET BY
// THEIR OWN ORDINANCES — the Denver-PUD / Dallas-PD shape, where a limit exists
// outside any district table and the honest output is `planGoverned`. That was
// the reading the phrase invited and it is wrong in the way that matters: the
// "planned-district ordinances" ARE Chapter 15 of this Municipal Code, and each
// article publishes Property Development Regulations in tables, in the code, for
// named zones. All ten articles read below carry height and floor-area
// provisions; Centre City alone mentions floor area 109 times.
//
// So these are CURATABLE GAPS, not answers. Enrolling them in
// `isPlannedDevelopment` would assert "the limit is in a document you must go
// and read" about figures that are in the code we already read for this city —
// a fabricated known absence, which is the error the header of this file exists
// to warn about.
//
// The article map, from the live enumeration (83 codes / 10 articles):
//   Art  3  Carmel Valley            20  CVPD-*
//   Art  4  Cass Street               1  CSPD-CASS-STREET
//   Art  5  Central Urbanized        13  CUPD-*
//   Art  6  Centre City              10  CCPD-*
//   Art  7  Gaslamp Quarter           1  GQPD-GASLAMP-QTR
//   Art  9  La Jolla                  9  LJPD-1 … LJPD-6A
//   Art 10  La Jolla Shores           7  LJSPD-*
//   Art 11  Marina                    1  MPD-MARINA   ⚠️ see below
//   Art 13  Mission Beach             6  MBPD-*
//   Art 16  Old Town San Diego       15  OTCC-* OTMCR-* OTOP-* OTRM-* OTRS-*
//
// ⚠️ A PREFIX IS NOT A FAMILY (rule 27), TWICE OVER.
//   · Old Town's fifteen codes carry no "PD" in their names and were triaged
//     into a different bucket for that reason alone. They are Article 16 of this
//     very chapter, and all fifteen are named verbatim in it — including
//     `OTOP 1-1`, printed with a SPACE where the layer uses a hyphen.
//   · Their shape instead matches the Chapter 13 base zones (`OTRS-1-1` beside
//     `RS-1-1`), which is what made the misgrouping plausible.
//
// ⚠️ MPD-MARINA IS A LIVE CODE FOR A REPEALED DISTRICT. Article 11 and its
// Division 3 both read "(Repealed 6-21-2019 by O-21086 N.S., effective
// 8-8-2019.)" and contain no standards at all — yet the zoning layer still
// publishes MPD-MARINA. Its editor's note adds that the repealing amendments
// "will not apply within the Coastal Overlay Zone until the California Coastal
// Commission certifies it as a Local Coastal Program Amendment", so what governs
// such a parcel depends on a certification status nothing here reads. It stays a
// gap, and it is not the same kind of gap as the other 82.
//
// NEITHER PUBLISHED INDEX IS COMPLETE, which is worth recording because rule 8
// says to read indexes rather than guess paths. The Municipal Code Table of
// Contents lists Article 16 but omits Articles 2 (Barrio Logan) and 11 (Marina);
// the Chapter 15 web page lists 2 and 11 but omits 16. Article 16 was confirmed
// to exist — 95 pages, dated 7-2026 — only after the two indexes disagreed and
// the section number the ToC itself gives (§1516.0101) was tested directly. Two
// indexes, each authoritative-looking, each missing something the other had.

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
  /** THIS ZONE ADOPTS ANOTHER ZONE'S DEVELOPMENT REGULATIONS BY REFERENCE, which
   *  is how every Chapter 15 planned district states its bulk limits: "the use
   *  and development regulations of Land Development Code Chapter 13, Article 1,
   *  Division 4 (Residential Base Zones) for the RS-1-14 zone shall apply"
   *  (§153.0302). Modelled as a reference rather than a copied figure, because
   *  that is what the ordinance does — so a correction to the base zone reaches
   *  every planned district that adopts it, and a base zone we cannot yet resolve
   *  makes its dependants honestly unresolved rather than silently wrong. */
  incorporates?: string
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

/**
 * CN neighbourhood-commercial max FAR — § 131.0531, Table 131-05C.
 *
 * COLUMN ALIGNMENT RECONCILED THREE WAYS before any value was taken, which is
 * the check that would have caught the DC MU-column off-by-one without anyone
 * reading carefully:
 *   · the table's own four-row Zone Designator header resolves to six columns,
 *     "1st & 2nd >> CN-", "3rd >> 1-", "4th >> 1 2 3 4 5 6"
 *   · every data row in the table carries exactly six values
 *   · the live ZONE_NAME enumeration carries exactly six CN codes, CN-1-1…CN-1-6
 * Three independent counts agreeing is what makes the row assignment safe.
 *
 * The Max Floor Area Ratio row reads 1.0 in all six columns, each carrying
 * footnote 3.
 *
 * ⚠️ THE BONUSES ARE NOT ENCODED. The table also carries "Floor Area Ratio Bonus
 * for Residential Mixed Use" (0.5 / 0.75 / 0.75 / 1.2 / 1.2 / 1.2, § 131.0546(a))
 * and a child-care bonus (§ 131.0546(b)). Whether those ADD to the 1.0 or replace
 * it is stated in § 131.0546, which has not been read — and a bonus recorded
 * without knowing that is a number with no defined meaning. Same refusal as La
 * Jolla's § 159.0307(c)(2) bonus density.
 */
const CN_FAR: Readonly<Record<string, number>> = Object.freeze({
  'CN-1-1': 1.0, 'CN-1-2': 1.0, 'CN-1-3': 1.0,
  'CN-1-4': 1.0, 'CN-1-5': 1.0, 'CN-1-6': 1.0,
})
const CN_TABLE =
  'San Diego Municipal Code § 131.0531, Table 131-05C (Development Regulations for CN Zones, 7-2026) — Max Floor Area Ratio row'
const CN_OTAY =
  'San Diego Municipal Code § 131.0531, Table 131-05C footnote 3: "Within the Otay Mesa Community Plan area, the maximum floor area ratio is 0.30."'

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
  // ── CARMEL VALLEY PLANNED DISTRICT (Chapter 15, Article 3, Division 3) ─────
  // Twenty live codes, and the chapter states almost no figures of its own:
  // ELEVEN of its sections adopt a Chapter 13 base zone by reference and then
  // list exceptions. The division numbers came from the code's own Table of
  // Contents PDF, not from a guessed path (rule 8).
  //
  // ⚠️ THE REFERENCE IS PHRASED TWO WAYS AND THE FIRST SCAN SAW ONE. "…for the
  // RS-1-14 zone SHALL APPLY" (§153.0302) and "…for the CN-1-2 zone APPLY in the
  // Neighborhood Commercial zone" (§153.0304) are the same instrument; a regex
  // for the first reported four sections as having no base zone, and they have
  // one. Checked because the alternative was recording an absence.
  //
  // WHAT RESOLVES TODAY: SF and MF, because RS-1-14 (0.6) and RM-1-1 (0.75) are
  // Chapter 13 rows this module already reads, and both are LOT-INDEPENDENT —
  // verified across 3,000/6,000/12,000/40,000 sq ft, since the RS lot-area bands
  // that make other RS zones parcel-dependent do not reach RS-1-14.
  //
  // WHAT DOES NOT, AND WHY THAT IS THE RIGHT ANSWER: NC adopts CN-1-2, VC adopts
  // CV-1-1, and TC and SC adopt CC-1-3 — none of which this module resolves yet.
  // Encoding the reference anyway means they resolve the day those base zones
  // land, and stay honestly unresolved until then. Copying figures would have
  // hidden the dependency.
  //
  // NOT ENCODED AT ALL, and each for its own reason: EP states only a use
  // restriction (schools and parks); OS states an open-space preservation
  // condition; SP adopts "the RM zones" in the PLURAL, which names no single row
  // — an ambiguity in the source, not a gap in the reading.
  //
  // Heights are not modelled in this city — SanDiegoLimits carries FAR only — so
  // the SF 35 ft, MF 50 ft / 4 storeys and EC east-of-El-Camino-Real figures are
  // read and recorded here rather than encoded.
  'CVPD-SF': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-SF1': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-SF1A': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-SF2': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-SF3': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-SF4': { far: null, incorporates: 'RS-1-14', source: 'SDMC ch.15 art.3 div.3 §153.0302' },
  'CVPD-MF1': { far: null, incorporates: 'RM-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0303' },
  'CVPD-MF2': { far: null, incorporates: 'RM-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0303' },
  'CVPD-MF3': { far: null, incorporates: 'RM-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0303' },
  'CVPD-MF4': { far: null, incorporates: 'RM-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0303' },
  'CVPD-MFL': { far: null, incorporates: 'RM-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0303' },
  'CVPD-NC': { far: null, incorporates: 'CN-1-2', source: 'SDMC ch.15 art.3 div.3 §153.0304' },
  'CVPD-VC': { far: null, incorporates: 'CV-1-1', source: 'SDMC ch.15 art.3 div.3 §153.0305' },
  'CVPD-TC': { far: null, incorporates: 'CC-1-3', source: 'SDMC ch.15 art.3 div.3 §153.0306' },
  'CVPD-SC': { far: null, incorporates: 'CC-1-3', source: 'SDMC ch.15 art.3 div.3 §153.0307' },
  // Employment Center adopts CC-1-3 for use, then OVERRIDES the ratio outright:
  // "Maximum Floor Area Ratio. The maximum floor area ratio shall be 0.5". The
  // stated figure wins over the incorporation, so this is a flat row.
  'CVPD-EC': { far: 0.5, source: 'SDMC ch.15 art.3 div.3 §153.0309(b)(1)' },
  // Mixed-Use Center states its own ratio and one ALTERNATIVE keyed to a unit
  // count. 1.25 is not the headline (rule 6) — a 4-unit building does not get it.
  'CVPD-MC': {
    far: 1.2,
    alternatives: [{ label: '8 to 10 dwelling units', far: 1.25 }],
    source: 'SDMC ch.15 art.3 div.3 §153.0311(c)(3)',
  },

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

  // ── CHAPTER 15 PLANNED DISTRICTS, read 2026-08-17 ────────────────────────
  //
  // Each article's Division 3 was fetched from the Chapter 15 page with its byte
  // count verified against Content-Length, and each carries its own amendment
  // vintage in the document header — recorded per entry, because these articles
  // are revised independently and one stamped 2014 is a stable article rather
  // than a stale copy.
  //
  // Only the FAR is encoded: SanDiegoLimits carries no height field, and this
  // module's target is the FAR column.

  // CSPD — Cass Street (Ch 15 Art 4, doc vintage 8-2018), § 154.0303(c):
  //   (1) "The maximum floor area ratio (FAR) shall be 1.0 for any exclusively
  //       commercial use building. The floor area ratio may be increased to 2.0
  //       for mixed use projects combining commercial and residential
  //       development, provided that the residential component shall be a
  //       minimum of 1.0 FAR and shall not exceed 1.5 FAR."
  //   (2) "The maximum floor area ratio for exclusively residential development
  //       shall be 1.5."
  // The 1.0 is the base: the other two require choosing a use programme, and
  // reporting 2.0 as the ceiling would assume one (rule 6).
  'CSPD-CASS-STREET': {
    far: 1.0,
    alternatives: [
      { label: 'exclusively residential', far: 1.5 },
      { label: 'mixed use (residential component 1.0–1.5)', far: 2.0 },
    ],
    source: 'SDMC § 154.0303(c) (Cass Street Planned District, Ch 15 Art 4 Div 3)',
  },

  // MBPD — Mission Beach (Ch 15 Art 13, doc vintage 2-2025).
  // Residential subdistricts, § 1513.0304(g)(1): "The basic maximum floor area
  // ratio shall be 1.1 for 1 to 7 dwelling units. The maximum floor area ratio
  // shall be 1.25. for 8 to 10 dwelling units." Unit count is the applicant's
  // choice, so 1.1 is the base and 1.25 the alternative — the same treatment the
  // RM entries below give San Diego's base-zone unit bands.
  'MBPD-R-N': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }], source: 'SDMC § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },
  'MBPD-R-S': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }], source: 'SDMC § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },

  // Commercial subdistricts, § 1513.0307(d): residential development is sent
  // back to § 1513.0304(g), so the 1.1/1.25 pair applies unchanged; (d)(2)
  // states nonresidential at "basic floor area ratio shall be 1.25", raisable to
  // 1.75 on an off-street parking condition. Base stays the lowest figure any
  // permitted programme can reach.
  'MBPD-VC-N': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }, { label: 'exclusively nonresidential', far: 1.25 }, { label: 'nonresidential with the § 1513.0307(d)(2)(B) parking provision', far: 1.75 }], source: 'SDMC § 1513.0307(d) with § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },
  'MBPD-VC-S': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }, { label: 'exclusively nonresidential', far: 1.25 }, { label: 'nonresidential with the § 1513.0307(d)(2)(B) parking provision', far: 1.75 }], source: 'SDMC § 1513.0307(d) with § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },
  'MBPD-NC-N': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }, { label: 'exclusively nonresidential', far: 1.25 }, { label: 'nonresidential with the § 1513.0307(d)(2)(B) parking provision', far: 1.75 }], source: 'SDMC § 1513.0307(d) with § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },
  'MBPD-NC-S': { far: 1.1, alternatives: [{ label: '8–10 dwelling units', far: 1.25 }, { label: 'exclusively nonresidential', far: 1.25 }, { label: 'nonresidential with the § 1513.0307(d)(2)(B) parking provision', far: 1.75 }], source: 'SDMC § 1513.0307(d) with § 1513.0304(g)(1) (Mission Beach, Ch 15 Art 13 Div 3)' },

  // LJSPD — La Jolla Shores (Ch 15 Art 10, doc vintage 4-2024).
  //
  // § 1510.0304(i)(1)(A): the single-family zone's "maximum permitted floor area
  // ratio is based on the lot area in accordance with Table 131-04J" — the SAME
  // table RS_FAR_BY_LOT_AREA above already implements for the RS base zones.
  // Verified band by band against the article's own printed table: 0.70 / 0.65 /
  // 0.60 / 0.59 … 0.45, identical. Reused rather than re-transcribed.
  'LJSPD-SF': { far: null, farByLotArea: true, source: 'SDMC § 1510.0304(i)(1)(A) → Table 131-04J (La Jolla Shores, Ch 15 Art 10 Div 3)' },

  // ⚠️ THE SLOT TEST, on two parallel sections of one article. § 1510.0304
  // (Single-Family Zone – Development Regulations) lists nine lettered items and
  // the ninth is "(i) Maximum Floor Area Ratio". § 1510.0306 (Multi Family
  // Zones – Development Regulations) lists seven, in the same order and the same
  // categories — density, siting, building heights, lot coverage, off-street
  // parking, signs, landscape — and has NO floor-area item.
  //
  // That is the document's own structure as positive evidence, not a reader
  // failing to find something: the item is present exactly where the instrument
  // applies. It is the Milwaukee PK distinction passing rather than failing —
  // there IS a structure here whose emptiness can be read.
  'LJSPD-MF1': { far: null, farUnconstrained: true, source: 'SDMC § 1510.0306 (La Jolla Shores multi-family, Ch 15 Art 10 Div 3) — the development-regulation list carries no floor-area item, where § 1510.0304(i) does for the single-family zone' },
  'LJSPD-MF2': { far: null, farUnconstrained: true, source: 'SDMC § 1510.0306 (La Jolla Shores multi-family, Ch 15 Art 10 Div 3) — the development-regulation list carries no floor-area item, where § 1510.0304(i) does for the single-family zone' },

  // LJPD — La Jolla (Ch 15 Art 9, doc vintage 1-2014). Table 159-03D "Maximum
  // Base Density", column "Maximum Base Floor Area Ratio (FAR) Permitted Per
  // Lot", read directly from the article:
  //     Zone 1  1.3   Zone 2  1.3   Zone 3  1.3
  //     Zone 4  1.0   Zone 5  1.5   Zone 6  No restriction
  //
  // BASE, not bonus. § 159.0307(c)(2) "Maximum Bonus Density" raises these for
  // mixed-use projects meeting a residential percentage; that is a programme the
  // user has not chosen, so it is not the headline (rule 6). The bonus rules are
  // condition-heavy and are NOT encoded as alternatives here — they were not read
  // closely enough to state a figure, and a half-read bonus is worse than none.
  'LJPD-1': { far: 1.3, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — maximum base FAR per lot' },
  'LJPD-2': { far: 1.3, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — maximum base FAR per lot' },
  'LJPD-3': { far: 1.3, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — maximum base FAR per lot' },
  'LJPD-4': { far: 1.0, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — maximum base FAR per lot' },
  'LJPD-5': { far: 1.5, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — maximum base FAR per lot' },
  // ⚠️ "No restriction" IN THE TABLE'S OWN WORDS — a stated absence, the same
  // shape as Philadelphia RM-1's "No Limit", and stronger than an empty cell.
  // The row exists and is filled with a refusal to restrict.
  'LJPD-6': { far: null, farUnconstrained: true, source: 'SDMC Table 159-03D (La Jolla, Ch 15 Art 9 Div 3) — the Zone 6 FAR cell reads "No restriction"' },

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
  ...Object.fromEntries(Object.keys(CN_FAR).map((z) => [z, { far: null, commercial: true, source: CN_TABLE }])),
})

/**
 * Chapter 15 planned-district families, each mapped to the article that
 * publishes its Property Development Regulations.
 *
 * EXPORTED SO IT CAN BE PINNED. The inventory is a measurement against the live
 * layer (183 distinct ZONE_NAME values on 2026-08-17, of which these match 83),
 * and a regex that silently stopped matching would return the group to the
 * undifferentiated gap pile — green, and reading as though nothing had changed
 * (rule 20). The test asserts the exact membership, not just a count.
 *
 * `repealed` marks a family whose article carries no standards at all. It is NOT
 * a licence to publish anything: the parcel is still a gap, and a narrower one,
 * because the repeal's reach into the Coastal Overlay Zone depends on a Coastal
 * Commission certification nothing here reads.
 */
export const SAN_DIEGO_PLANNED_DISTRICTS: readonly {
  match: RegExp
  article: string
  name: string
  repealed?: string
}[] = Object.freeze([
  { match: /^CVPD-/, article: 'Ch 15 Art 3', name: 'Carmel Valley' },
  { match: /^CSPD-/, article: 'Ch 15 Art 4', name: 'Cass Street' },
  { match: /^CUPD-/, article: 'Ch 15 Art 5', name: 'Central Urbanized' },
  { match: /^CCPD-/, article: 'Ch 15 Art 6', name: 'Centre City' },
  { match: /^GQPD-/, article: 'Ch 15 Art 7', name: 'Gaslamp Quarter' },
  { match: /^LJPD-/, article: 'Ch 15 Art 9', name: 'La Jolla' },
  { match: /^LJSPD-/, article: 'Ch 15 Art 10', name: 'La Jolla Shores' },
  { match: /^MPD-/, article: 'Ch 15 Art 11', name: 'Marina', repealed: 'O-21086 N.S., effective 8-8-2019' },
  { match: /^MBPD-/, article: 'Ch 15 Art 13', name: 'Mission Beach' },
  // No "PD" in these names, and they are Article 16 of this same chapter. Their
  // shape matches the Chapter 13 base zones instead (OTRS-1-1 beside RS-1-1),
  // which is exactly why they were grouped elsewhere first (rule 27).
  { match: /^OT(CC|MCR|OP|RM|RS)-/, article: 'Ch 15 Art 16', name: 'Old Town San Diego' },
])

/** True where this code belongs to a Chapter 15 planned district. Says nothing
 *  about whether a limit is obtainable — every one of these is currently a GAP,
 *  and deliberately not `planGoverned`: the standards are published tables in
 *  Chapter 15, so the honest state is "not yet curated", not "look elsewhere". */
export function sanDiegoPlannedDistrict(
  code: string | null | undefined,
): (typeof SAN_DIEGO_PLANNED_DISTRICTS)[number] | null {
  const z = String(code ?? '').trim().toUpperCase()
  if (!z) return null
  return SAN_DIEGO_PLANNED_DISTRICTS.find((d) => d.match.test(z)) ?? null
}

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

  // Incorporation by reference (§153.0302 and its siblings). ONE hop only: the
  // base zones are Chapter 13 rows that state their own figures, so a chain
  // would mean a planned district adopting another planned district, which
  // nothing in the enumeration does. Guarded rather than assumed — an
  // unterminated chain would recurse.
  if (zone.incorporates) {
    const base = ZONES[zone.incorporates]
    if (!base || base.incorporates) return UNRESOLVED
    const inner = resolveSanDiego(zone.incorporates, lotSqFt, communityPlan)
    if (inner.maxFAR == null && !inner.farUnconstrained) return UNRESOLVED
    return { ...inner, source: `${zone.source} (adopts ${zone.incorporates}: ${inner.source})` }
  }

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
  // CC and CN are the same instrument in two tables, and each states the Otay
  // Mesa override in its OWN footnote — 131-05E note 4 for CC, 131-05C note 3
  // for CN. Same figure, different citation, so the source is selected with the
  // value rather than hardcoded to one table.
  const base = CC_FAR[key] ?? CN_FAR[key]
  if (base == null) return UNRESOLVED
  const isCn = CN_FAR[key] != null
  if (cp === CP_OTAY_MESA) {
    return {
      maxFAR: CC_OTAY_MESA_FAR,
      farUnconstrained: false,
      farAlternatives: [],
      source: isCn ? CN_OTAY : CC_OTAY,
    }
  }
  return { maxFAR: base, farUnconstrained: false, farAlternatives: [], source: isCn ? CN_TABLE : CC_TABLE }
}
