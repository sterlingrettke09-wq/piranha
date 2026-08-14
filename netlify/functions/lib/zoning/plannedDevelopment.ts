// Planned-development districts — the third state between an answer and a gap.
//
// WHAT THIS IS FOR
// A parcel in a planned-development district has a floor-area limit. It is just
// not in any district table: it is in the ordinance that created that specific
// district, one ordinance per development. Dallas says so in as many words —
// § 51A-4.702(a)(4), "The ordinance establishing a PD must specify regulations
// governing building height, floor area, lot area, lot coverage, density,
// yards…", and (a)(5), "The regulations of each PD ordinance shall be codified
// in Chapter 51P."
//
// Until now those parcels counted as GAPS, which reads as "we could not find
// it". That is wrong in a way that matters: nobody could find it, because there
// is nothing of that kind to find. The honest rendering is "the limit for this
// parcel is set by its own ordinance, not by a district table" — which is an
// ANSWER about how the parcel is regulated, and it is the reason a city like
// Chicago can never reach 100% by any amount of table-reading. 1,457 of
// Chicago's district classes are PD or PMD.
//
// THIS IS NOT AN EXCUSE TO STOP. A PD parcel is still unresolved for envelope
// purposes; what changes is that it stops being counted as a failure to look.
// Resolving one for real means reading its individual ordinance, which is a
// per-parcel document and out of scope for a district table.
//
// ⚠️ MATCHING IS PER-CITY AND DELIBERATELY NARROW. A global /PD/ regex would
// catch DC's PDR (Production, Distribution and Repair) and Nashville's PUD-less
// districts, and turning a legitimate by-right district into "governed by an
// ordinance" would SUPPRESS a real answer — the expensive direction. Every rule
// below carries the codes it must match and the codes it must not, and the
// tests assert both. Never widen one of these without adding to `neverMatch`.

export interface PlannedDevelopmentRule {
  /** True when this district's standards come from a per-project ordinance. */
  match: (code: string) => boolean
  /** Real district codes in this city that MUST match. */
  alwaysMatch: readonly string[]
  /** Real district codes in this city that MUST NOT match. The over-match
   *  guard — this is the half that prevents suppressing a live answer. */
  neverMatch: readonly string[]
  /** What governs instead, in the city's own vocabulary. */
  governedBy: string
  /** Primary source for the claim that the ordinance governs. */
  citation: string
}

const norm = (code: string): string => String(code).trim().toUpperCase().replace(/\s+/g, ' ')

const RULES: Readonly<Record<string, PlannedDevelopmentRule>> = Object.freeze({
  // Chicago — PD and PMD. The ledger's live field query counted 1,457 of these
  // classes, and recorded that no by-right FAR exists for any of them.
  chicago: {
    match: (c) => /^(PD|PMD)\b|^(PD|PMD)[\s-]?\d/.test(norm(c)),
    alwaysMatch: ['PD', 'PD 1103', 'PD-1103', 'PMD', 'PMD 11'],
    neverMatch: ['B3-2', 'RS-3', 'DX-12', 'M1-1', 'RT-4', 'C1-2', 'POS-1'],
    governedBy: 'the planned development ordinance for this specific PD',
    citation:
      'Chicago Zoning Ordinance Title 17 Ch. 17-13-0600; live field query 2026 counted 1,457 PD/PMD classes with no by-right FAR.',
  },

  // Dallas — PD, 999 distinct districts over 18% of the city, each codified as
  // its own ordinance in Chapter 51P.
  dallas: {
    match: (c) => /^PD(\s|-|$)/.test(norm(c)),
    alwaysMatch: ['PD', 'PD 193', 'PD-193'],
    neverMatch: ['R-7.5(A)', 'MF-2', 'CR', 'LO-1', 'IR', 'CS', 'MU-1', 'P(A)'],
    governedBy: 'the PD ordinance for this district, codified in Dallas City Code Chapter 51P',
    citation:
      'Dallas City Code § 51A-4.702(a)(4): "The ordinance establishing a PD must specify regulations governing building height, floor area, lot area, lot coverage, density, yards…"; (a)(5): "The regulations of each PD ordinance shall be codified in Chapter 51P."',
  },

  // Columbus — CPD and the four PUD densities. The module already records, per
  // district, that "the approved CPD text governs" / "the approved plan governs".
  columbus: {
    match: (c) => /^(CPD|PUD\d*)\b/.test(norm(c)),
    alwaysMatch: ['CPD', 'PUD2', 'PUD4', 'PUD6', 'PUD8'],
    neverMatch: ['R4', 'C4', 'M', 'AR-1', 'ARLD', 'L-C4', 'R-2F'],
    governedBy: 'the approved CPD text or PUD plan for this site',
    citation:
      'Columbus City Code § 3309.10 (Commercial Planned Development) and § 3309.08 with Ch. 3345 (Planned Unit Development) — the approved text/plan governs.',
  },

  // Las Vegas — PD only.
  //
  // ⚠️ R-PD IS DELIBERATELY EXCLUDED. LVMC 19.10.050(A) states a by-right
  // density for it — "(Example: R-PD4 allows up to four units per gross acre.)"
  // — so R-PD{n} is a district with a published standard, not one whose numbers
  // exist only in an adopted plan. Folding it in here would suppress a figure
  // the code actually publishes. It is in `neverMatch` for exactly that reason.
  lasvegas: {
    match: (c) => /^PD\b/.test(norm(c)),
    alwaysMatch: ['PD'],
    neverMatch: ['R-PD4', 'R-PD2', 'R-PD46', 'R-1', 'C-1', 'M-1', 'R-E', 'C-V'],
    governedBy: 'the adopted plan for this Planned Development District',
    citation:
      'LVMC 19.10.040(E)(2): "No use, type of development or development standard is presumptively permitted within the PD District unless it already has been included in the adopted plan for the District."',
  },

  // Atlanta — the three Planned Development district types.
  atlanta: {
    match: (c) => /^PD-(H|MU|OC)\b/.test(norm(c)),
    alwaysMatch: ['PD-H', 'PD-MU', 'PD-OC'],
    neverMatch: ['R-4', 'C-1', 'I-1', 'MR-3', 'MRC-2', 'SPI-1', 'BeltLine'],
    governedBy: 'the approved planned development application for this site',
    citation: 'Atlanta Code of Ordinances Part III Ch. 19, 19A, 19B and 19C (Planned Development districts).',
  },

  // San Jose — any code carrying a (PD) suffix, plus bare PD.
  sanjose: {
    match: (c) => /\(PD\)|^PD\b/.test(norm(c)),
    alwaysMatch: ['A(PD)', 'CO(PD)', 'CIC(PD)', 'R-1-8(PD)', 'PD'],
    neverMatch: ['R-1-8', 'R-2', 'R-M', 'CN', 'CG', 'IP', 'LI', 'DC', 'MS-G', 'PQP'],
    governedBy: 'the approved planned development permit for this site',
    citation:
      'San Jose Municipal Code § 20.100.1030(C)(2): "The site is located in a planned development zoning district. All construction in a planned development zoning district shall be governed by the provisions of Part 8 of this chapter…"',
  },

  // Nashville — SP, the Specific Plan district. Named differently, same shape.
  nashville: {
    match: (c) => /^SP\b|^SP-/.test(norm(c)),
    alwaysMatch: ['SP', 'SP-2019-123'],
    neverMatch: ['RS10', 'MUG', 'CL', 'IWD', 'RM20-A', 'DTC', 'AG', 'SCN'],
    governedBy: 'the site-specific SP ordinance for this parcel',
    citation:
      'Metro Code § 17.12.020, Table 17.12.020C Note 5: "Development standards shall be as specifically listed in the site specific SP ordinance."',
  },
})

/** Cities with a planned-development rule. Pinned by a test (rule 20). */
export const PD_CITIES: readonly string[] = Object.freeze(Object.keys(RULES))

/** The rule for a city, or null where none has been established. */
export function plannedDevelopmentRule(city: string): PlannedDevelopmentRule | null {
  return RULES[String(city).trim().toLowerCase()] ?? null
}

/**
 * Does this parcel sit in a district whose standards come from its own
 * ordinance rather than a district table?
 *
 * A city with no rule here returns false — an ESTABLISHED absence is not
 * assumed for cities nobody has checked. False here means "not known to be a
 * planned development", and those parcels keep reading as ordinary gaps.
 */
export function isPlannedDevelopment(city: string, code: string | null | undefined): boolean {
  if (!code) return false
  const rule = plannedDevelopmentRule(city)
  if (!rule) return false
  return rule.match(code)
}

/** The ordinance sentence for a PD parcel, or null when it is not one. */
export function plannedDevelopmentSource(city: string, code: string | null | undefined): string | null {
  if (!isPlannedDevelopment(city, code)) return null
  const rule = plannedDevelopmentRule(city)!
  return `Limits are set by ${rule.governedBy}, not by a district table. ${rule.citation}`
}
