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

  // Austin — PUD. § 25-2 Subchapter B Art. 2 SubPart C § 3.2.1: the site
  // development regulations "are established by the ordinance zoning property
  // as a PUD district, the accompanying land use plan, and this section", and
  // § 3.2.2(C) requires that land use plan to state "for multifamily
  // development, the maximum floor to area ratio". So the figure exists and is
  // per-development.
  //
  // NOT added on the strength of zoningLimits.ts's note that "PUD/DR/AV/P vary
  // case-by-case" — that is a repo note, not a citation, and it was the reason
  // Austin was left out of this registry on 2026-08-15.
  austin: {
    match: (c) => /^PUD\b/.test(norm(c)),
    alwaysMatch: ['PUD'],
    neverMatch: ['SF-2', 'SF-6', 'MF-3', 'CBD', 'GR', 'LO', 'DR', 'RR', 'CS', 'P'],
    governedBy: 'the ordinance zoning the property as a PUD and its accompanying land use plan',
    citation:
      'Austin Land Development Code § 25-2, Subchapter B, Article 2, SubPart C § 3.2.1: "The permitted uses, conditional uses, and site development regulations for a planned unit development (PUD) district are established by the ordinance zoning property as a PUD district, the accompanying land use plan, and this section."',
  },

  // Los Angeles — the "D" Development Limitation. It appears after the height
  // district in the zone string (C2-2D, R3-1D) and is imposed by the ordinance
  // that applied it, per LAMC § 12.32. It REDUCES what the height district
  // would otherwise allow: a D limitation on a C2 lot in Height District 2 can
  // take the FAR from 6:1 down to 3:1.
  //
  // So the base figure is an upper bound, not the answer, and the binding
  // number is in the ordinance. Publishing the height district's FAR for a D
  // parcel would overstate it — by 2x in that example.
  //
  // ⚠️ NOT the same shape as Charlotte's `conditional`, which layers conditions
  // on top of figures that still bind. Here the district figure does not bind
  // at all once a D limitation exists.
  la: {
    // Anchored to the height-district token so it cannot catch a stray D.
    //
    // ⚠️ WIDENED 2026-08-17, found by the enumeration sweep. The first version
    // was `-[1-4]D`, requiring the D immediately after the height-district
    // digit — which misses the RESTRICTIVE districts, where LA writes the D
    // after the qualifier: "1VL"+D, "1L"+D, "1XL"+D, "1SS"+D. Measured against
    // the live layer: 71 of 2,128 distinct ZONE_CMPLT values are 1VLD/1LD/
    // 1XLD/1SSD, and every one was falling through to a GAP instead of
    // reporting that its limit is in the ordinance that imposed the D.
    //
    // The optional group cannot loosen the match: a D is still required, so
    // "C2-1VL", "R1-1XL", "C4-1L" and "R3-1SS" — all in neverMatch — stay out.
    match: (c) => /-[1-4](VL|L|XL|SS)?D(?=$|-)/.test(norm(c)),
    alwaysMatch: [
      'C2-2D', 'C2-2D-CPIO', 'R3-1D', '[Q]C4-2D-O', 'C4-3D-SN',
      // The restrictive-district forms, taken from the live enumeration.
      '(Q)C2-1VLD', '(Q)C2-1LD', '(Q)C1-1VLD-RIO', '(Q)A1-1VLD', '(Q)C1.5-1VLD',
    ],
    neverMatch: [
      'C2-2', 'C2-1', 'C4-2', 'R3-1', 'R1-1', 'R1-1-CUGU', 'RS-1', 'RA-1', 'M1-1',
      // The restrictive height-district variants end in letters too and must
      // not be read as a D limitation.
      'C2-1VL', 'R1-1XL', 'C4-1L', 'R3-1SS',
    ],
    governedBy: 'the ordinance that imposed the D Development Limitation on this property',
    citation:
      'LAMC § 12.32: a "D" Development Limitation is adopted on a property or neighbourhood to impose further restrictions on the height, floor area and setbacks of a building, and appears after the height district designation. It reduces the floor-area ratio the height district would otherwise permit — e.g. a C2 lot in Height District 2 from 6:1 to 3:1 — so the binding figure is in that ordinance rather than in § 12.21.1.',
  },

  // Denver — PUD and PUD-G. DZC § 9.6.1.C.1 requires every PUD District Plan to
  // include "Building form standards, including building height, siting, and
  // design element standards formatted similarly to the Primary Building Form
  // Standards found in Articles 3 through 7" — so the height a PUD parcel is
  // held to is in its own plan, not in any district table.
  //
  // Read from Article 9 of the CURRENT code: "DENVER ZONING CODE, June 25, 2010
  // | Republished February 25, 2025", the republication carrying the 2024 text
  // amendment bundle. Two earlier documents were rejected on vintage before this
  // one — a redline amendment, and the original 2010 Article 9 with no
  // republication line (CLAUDE.md rule 7: a cited-but-stale figure is worse than
  // an uncited one, because the citation stops the next reader re-checking).
  //
  // ⚠️ P-1 IS THE NEAR-MISS. Denver publishes exactly three P-prefixed codes —
  // P-1, PUD, PUD-G — and P-1 is an ordinary parking district with its own
  // published standards. Anchoring on `^PUD` keeps it out; it is in neverMatch
  // for that reason.
  denver: {
    match: (c) => /^PUD(\b|-)/.test(norm(c)),
    alwaysMatch: ['PUD', 'PUD-G'],
    neverMatch: ['P-1', 'C-MX-5', 'G-MU-3', 'U-SU-A', 'S-MX-2A', 'D-C', 'CMP-H', 'R-2-A', 'B-8-A', 'OS-A'],
    governedBy: 'the approved PUD District Plan for this site',
    citation:
      'Denver Zoning Code § 9.6.1.C.1 (Required PUD District Plan Elements): "all PUD District Plans shall include or address the following elements… c. Building form standards, including building height, siting, and design element standards formatted similarly to the Primary Building Form Standards found in Articles 3 through 7." Article 9, June 25 2010 | Republished February 25 2025.',
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
