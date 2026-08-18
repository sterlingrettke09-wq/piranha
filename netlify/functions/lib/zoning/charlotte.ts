// Charlotte curated district height table — City of Charlotte Unified
// Development Ordinance (UDO).
//
// SOURCE. Every figure below was transcribed on 2026-08-08 from the OFFICIAL
// UDO published by the City of Charlotte at
//   https://charlotteudo.org/articles/
// reached from the site's own article index (rule 8 — no guessed chapter
// paths), one article page per Part. Not Municode, not a mirror, not a summary.
// Currency at the time of reading, as the publisher states it on its own
// landing page: "Effective June 1, 2023", most recent text amendment 2025-118
// adopted 23 March 2026, "a living document that continues to be updated
// through text amendments".
//
// The height figures were read out of the articles' HTML <table> markup with a
// <tr>/<td> parser that PRESERVES EMPTY CELLS, never from flattened page text.
// That is not fussiness: flattening Table 7-1's coverage row turns
// `60 | — | 60 | — | —` into `60 60` and silently reassigns a value to the
// wrong district. Table 5-3's bonus row (blank for N2-A and N2-B, 100 for
// N2-C) and Table 13-2's minimum-height row (blank for TOD-TR) have the same
// shape. Table 13-2 was additionally cross-read against the article's own
// downloadable PDF (admin.charlotteudo.org/assets/43d7fb0c-…, 18pp,
// pdftotext -layout) and the two agree on all four columns.
//
// Every value carries its section and table beside it.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 1 — THE CHARLOTTE UDO IMPOSES NO FLOOR AREA RATIO ANYWHERE. This is an
// ANSWER, not a lookup failure (CLAUDE.md rule 5), and it rests on the
// document's own structure rather than on a reader failing to find something:
//
//   · SEARCHED THE WHOLE ORDINANCE. All 39 articles were fetched and converted
//     to text — 1,780,151 characters — and the strings "floor area ratio",
//     "FAR" and "F.A.R." occur ZERO times. Not once, in any article, in any
//     sense. (Raleigh's equivalent search found two incidental hits; Charlotte
//     has none at all.)
//   · THE SLOT DOES NOT EXIST. Every district article is built from the same
//     lettered table series, and the place a FAR row would sit is occupied by
//     something else: Lot Standards (min lot area / min lot width / MAXIMUM
//     BUILDING COVERAGE), Building Siting, Building Height, Building
//     Articulation, Transparency. Charlotte regulates bulk by COVERAGE +
//     SETBACKS + HEIGHT. There is no FAR row to be blank.
//
// So `farUnconstrained: true` on every district the UDO governs. It must NEVER
// fall through to an assumed FAR of 1.0.
//
// Note the second half of that, because it is a real absence too: Articles
// 9–13 (IMU, NC, CAC, RAC/UE/UC, TOD) have NO Lot Standards table at all — no
// minimum lot area, no lot width, and no maximum building coverage. In those
// districts floor area is bound by height, setbacks and open space only. Where
// the code DOES state a coverage cap it is carried in `coverage` below, because
// with no FAR that cap is the instrument that actually binds floor area.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 2 — CHARLOTTE REGULATES HEIGHT IN FEET, AND ONLY IN FEET. The UDO states
// no story count for any district — there is no "stories" row in any Building
// Height Standards table (4-3, 5-3, 6-3, 7-3, 8-3, 9-2, 10-2, 11-2, 12-2,
// 13-2). `maxStories` therefore stays null and is never derived: there is no
// figure to round-trip, and inventing a feet-per-storey constant is the Miami-21
// 87-storey defect (CLAUDE.md rule 12). This module contains no such constant
// and a test asserts every entry's height is in feet with no story count.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 3 — HEIGHT IS STATED PER USE IN N1 AND N2, SO IT MUST NOT BE COLLAPSED
// TO ONE NUMBER (CLAUDE.md rule 6). Table 4-3 has two rows, not one:
//
//     Table 4-3            N1-A  N1-B  N1-C  N1-D  N1-E  N1-F
//     A  Residential        48    48    40    40    40    48
//     B  Nonres & Mixed     48    48    48    48    48    48
//
// In N1-C, N1-D and N1-E the two differ by 8 feet. Publishing the larger as
// "the" limit assumes a nonresidential or mixed-use programme the user has not
// chosen — the Austin 0.40-or-0.65 mistake. Both are kept, keyed by use;
// `heightFtFor(limits, 'residential')` is what the feasibility path should ask
// for, because the default spec proposes dwellings.
//
// Table 5-3 splits the same way (N2-A 48/48, N2-B 48/48, N2-C 65/65 — equal in
// every N2 column, but structurally per-use and read as such). Articles 6–13
// state ONE "Maximum Building Height (feet)" row that is not use-split; that
// single figure is recorded for both uses, which is transcription, not
// inference. Where a district permits no dwelling at all (ML-1, ML-2 — see
// `usesForZone`), that fact lives in the use vocabulary, not in a nulled height.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 4 — THE "MAXIMUM HEIGHT WITH BONUS" ROW IS AN EARNED PROGRAMME AND IS
// NEVER THE HEADLINE. Section 16.3 verbatim: "Additional building height or a
// reduction in required on-site open space shall be allowed through a VOLUNTARY
// bonus system. In order to obtain a development bonus, one or more actions in
// Table 16-1 are required" — the actions being on-site affordable housing at
// stated AMI averages for a 30-year affordability period, and similar. "one
// point is required for one foot of additional building height."
//
// That is the same shape as Raleigh's -TOD affordability bonus, and it gets the
// same treatment: `bonusHeightFt` is recorded so the module can SAY the bonus
// exists, and it is never returned as `heightFt`. A test pins that.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 5 — ABOUT A QUARTER OF CHARLOTTE HAS NO BY-RIGHT UDO ENVELOPE AT ALL,
// AND THAT IS AN ANSWER WITH A CITATION, NOT A GAP IN OUR DATA. UDO Section
// 1.4.C, verbatim:
//
//   "1. The following shall apply to a conditional zoning district in place
//    prior to the effective date of June 1, 2023 of this UDO:
//      a. If vesting has not expired, the regulations of all development
//         ordinances in effect on the date of such conditional zoning district
//         approval, as well as the conditional zoning site plan and
//         site-specific conditions; or
//      b. If vesting has expired, the regulations of all development ordinances
//         in effect immediately prior to the effective date of June 1, 2023 of
//         this UDO, as well as the conditional zoning site plan and
//         site-specific conditions.
//    2. A conditional zoning district approved after the effective date … but
//       under the regulations of the prior Zoning Ordinance shall meet the
//       regulations of all development ordinances in effect prior to [it] …
//    3. A conditional zoning district approved after the effective date … and
//       under the regulations of this UDO shall meet the regulations of this
//       UDO as well as the conditional zoning site plan and site-specific
//       conditions.
//    4. The above shall include any optional and EX zoning districts."
//
// So a legacy conditional/optional district (B-1(CD), UR-2(CD), MUDD-O,
// UMUD-O, R-12MF(CD) …) is governed by the SUPERSEDED 1992 ordinance plus its
// approved site plan. There is no UDO number to publish, and reaching for the
// nearest UDO district would emit a confident height for Uptown, South End and
// most mixed-use corridors. Those resolve to `basis: 'site-plan'` — heights
// null, `farUnconstrained` FALSE (we have not read the 1992 ordinance and
// assert nothing about it) — and a test pins them to nothing, the same move as
// the superseded Minneapolis Chapter 546 codes.
//
// ⚠️ RezoneDate DOES NOT DISCRIMINATE, and the tempting assumption that it does
// is wrong. Measured live 2026-08-08 against the zoning layer: UR-2(CD) runs to
// 2024-12-16 and B-1(CD) to 2025-09-15 — both AFTER the UDO's effective date —
// which is exactly Section 1.4.C.2. What discriminates is the district
// VOCABULARY: a petition processed under the UDO carries a UDO district code
// (N2-A(CD), CG(CD), IMU(CD): all ≥ 2023-06-01), and a petition processed under
// the prior ordinance keeps its prior code.
//
// A UDO-coded conditional district (N2-A(CD)) therefore DOES get the UDO
// figures per 1.4.C.3 — with the site plan and conditions on top. Section
// 37.2.C.2 makes clear conditions ADD ("individualized additional site-specific
// commitments" that "address the conformance of the development … or the
// impacts reasonably expected"), so the district figure is a ceiling the site
// may not actually have. It is labelled as such and never as a plain maximum.
//
// ─────────────────────────────────────────────────────────────────────────────
// FACT 6 — WHAT THE OVERLAYS AND SUFFIXES DO AND DO NOT DO. Checked one by one
// against Article 14 and Article 37; NOT inferred from their names, because two
// of these read the opposite way from how they look.
//
//   · (EX) Exception district — Sec. 37.2.C.3.b.i(A), verbatim: "No
//     modifications shall be made to maximum height regulations, with the
//     exception of the height transition limitations when adjacent to the
//     Neighborhood 1 Place Type." An EX district CANNOT raise or lower the
//     district maximum height. The base figure stands unqualified.
//   · (CCO) Cottage Court Overlay — Sec. 14.6.D.1: "All standards of the base
//     zoning district apply, with the following exceptions:" and the exceptions
//     enumerated are lot area, lot width, setbacks and building coverage.
//     HEIGHT IS NOT AMONG THEM, so the base district height applies unchanged.
//     ⚠️ Sec. 14.6.E.1.b states "All residential buildings shall not exceed 24
//     feet in height" — that is an ELIGIBILITY CONDITION for the voluntary
//     small-unit bonus in 14.6.E, not a cap on the overlay. Reading it as a cap
//     would have published 24 ft against a code that says 48. Pinned by a test.
//   · (HDO) Historic District Overlay — Sec. 14.2 is design review by
//     Certificate of Appropriateness (Sec. 14.2.D) and states NO numeric height
//     standard. It does not change the envelope; the provider surfaces the
//     district's presence instead.
//   · (ANDO) Airport Noise Disclosure Overlay, Sec. 14.9 — disclosure. No
//     height standard.
//   · Sec. 14.1, verbatim, covering all of them: overlays "may grant additional
//     uses or ADD development requirements upon the underlying zoning."
//   · (PED-O) / (TS-O) — pre-UDO overlays, handled by Table 3-1 (see below).
//   · The 200-FOOT NEIGHBOURHOOD 1 STEP-DOWN, a footnote on every height table
//     from Article 5 onward and on Table 4-3 row B: within 200 ft of the lot
//     line of residential uses or vacant land in a Neighborhood 1 Place Type,
//     the first 100 ft of a structure is capped at 50 ft and 100–200 ft at
//     65 ft. It can bind far below the district figure, it depends on the
//     adopted Policy Map rather than on anything in the parcel record, and this
//     module does not attempt to evaluate it — `neighborhood1StepDown` marks
//     the districts where it applies so the provider can say so in words.

/** What the UDO prints for a district. Feet only — Charlotte states no story
 *  count anywhere (FACT 2), and nothing here is ever derived from anything
 *  else. */
export interface CharlotteLimits {
  /** Maximum building height in FEET for a RESIDENTIAL building, exactly as the
   *  UDO prints it. Null means the UDO states no figure for this use — not that
   *  we failed to look it up. */
  residentialFt: number | null
  /** Maximum building height in FEET for a NONRESIDENTIAL or MIXED-USE
   *  building, exactly as the UDO prints it. */
  nonresidentialFt: number | null
  /** TRUE where the UDO's own height cell reads "Unlimited" (UC only, Table
   *  12-2 row B). An ANSWER — "height does not bind here" — which must not be
   *  confused with the null above. */
  heightUnconstrained: boolean
  /** Minimum building height in feet, where the district states one. */
  minHeightFt: number | null
  /** "Maximum Height with Bonus" from the district table — a VOLUNTARY,
   *  EARNED Section 16.3 programme (FACT 4). Recorded so the module can say the
   *  bonus exists; NEVER returned as the by-right height. */
  bonusHeightFt: number | null
  /** TOD-UC only, Table 13-2 note 4: "The height limit is 300 feet. If located
   *  within 1/4 mile walking distance of a rapid transit station, the maximum
   *  height with bonus is unlimited." Still a bonus, still never the headline. */
  bonusUnlimitedNearRapidTransit?: boolean
  /** Maximum building coverage, where the district's Lot Standards table states
   *  one. With no FAR anywhere in the UDO (FACT 1) this is the instrument that
   *  binds floor area. Absent where the district article states none. */
  coverage?: CharlotteCoverage
  /** The UDO imposes no floor-area ratio here — the KNOWN absence of FACT 1.
   *  True for every district the UDO governs; FALSE for a site-plan-governed
   *  legacy district (whose binding standard is the 1992 ordinance, unread here)
   *  and false for an unresolved code, where we assert nothing at all. */
  farUnconstrained: boolean
  /** UDO section and table the figures above were transcribed from. Empty only
   *  on the unresolved sentinel. */
  source: string
  /** Where this answer came from. Four outcomes that must render differently:
   *   'udo'            — a district established by UDO Sec. 3.3; figures apply.
   *   'udo-translated' — a pre-UDO conventional code that UDO Table 3-1
   *                      translates to a UDO district (Sec. 3.2: "The new
   *                      standards set forth in this Ordinance … shall apply").
   *   'site-plan'      — a conditional/optional/EX legacy district: Sec. 1.4.C
   *                      hands it to the superseded ordinance plus its approved
   *                      site plan. An ANSWER about why there is no number.
   *   'unresolved'     — the code string matched nothing. A GAP. */
  basis: 'udo' | 'udo-translated' | 'site-plan' | 'unresolved'
  /** The district the figures belong to, once translation has been applied. */
  district: CharlotteBaseDistrict | null
  /** For 'udo-translated': the pre-UDO code as the map still spells it. */
  translatedFrom?: string
  /** Set where the height figure applies only to a named building type rather
   *  than to every building in the district (MHP). */
  heightAppliesTo?: string
  /** The 200-ft Neighborhood 1 Place Type step-down applies in this district
   *  (FACT 6). Not evaluated here — flagged so it can be disclosed. */
  neighborhood1StepDown: boolean
  /** An approved conditional-zoning site plan and site-specific conditions also
   *  apply and may bind BELOW these figures (Sec. 1.4.C.3, Sec. 37.2.C.2). */
  conditional?: boolean
  /** An Exception (EX) district. Sec. 37.2.C.3.b.i(A) forbids modifying maximum
   *  height, so the figures stand — recorded for disclosure only. */
  exception?: boolean
}

/** Maximum building coverage as the district's Lot Standards table states it.
 *  N1's cell is conditional on lot size and is kept that way rather than
 *  flattened to one percentage. */
export type CharlotteCoverage =
  | { kind: 'flat'; pct: number; source: string }
  | {
      kind: 'by-lot-size'
      thresholdSqFt: number
      pctAtOrAbove: number
      pctBelow: number
      source: string
    }

/** The 30 base zoning districts UDO Sec. 3.3 establishes, in its order. This
 *  list is the ordinance's own exhaustive roster — a code that is not in it and
 *  not in Table 3-1 is not a UDO district, which is what makes MX-1/MX-2/MX-3,
 *  CC, NS, R-20MF, TOC-NC and R-I gaps rather than lookups we gave up on. */
export type CharlotteBaseDistrict =
  | 'N1-A' | 'N1-B' | 'N1-C' | 'N1-D' | 'N1-E' | 'N1-F'
  | 'N2-A' | 'N2-B' | 'N2-C'
  | 'CG' | 'CR'
  | 'IC-1' | 'IC-2' | 'OFC' | 'OG' | 'RC'
  | 'ML-1' | 'ML-2'
  | 'IMU'
  | 'NC'
  | 'CAC-1' | 'CAC-2'
  | 'RAC' | 'UE' | 'UC'
  | 'TOD-UC' | 'TOD-NC' | 'TOD-CC' | 'TOD-TR'
  | 'MHP'

// ── Constructors ────────────────────────────────────────────────────────────
// CLAUDE.md rule 14: make the caught error an impossible state, not a comment.
// Every row below is built by one of these, each of which takes only figures
// the UDO prints plus a mandatory citation. There is deliberately NO
// constructor that accepts a story count, and none that derives one unit from
// another — the Miami/Denver round-trip cannot be reintroduced by adding a row,
// only by adding a constructor, which is a visible and reviewable act.

type Extras = Partial<
  Pick<
    CharlotteLimits,
    'minHeightFt' | 'bonusHeightFt' | 'bonusUnlimitedNearRapidTransit' | 'coverage' | 'heightAppliesTo'
  >
> & { neighborhood1StepDown?: boolean }

/** The district table states ONE maximum building height covering every use. */
function height(ft: number, source: string, extra: Extras = {}): CharlotteLimits {
  return {
    residentialFt: ft,
    nonresidentialFt: ft,
    heightUnconstrained: false,
    minHeightFt: extra.minHeightFt ?? null,
    bonusHeightFt: extra.bonusHeightFt ?? null,
    ...(extra.bonusUnlimitedNearRapidTransit ? { bonusUnlimitedNearRapidTransit: true } : {}),
    ...(extra.coverage ? { coverage: extra.coverage } : {}),
    ...(extra.heightAppliesTo ? { heightAppliesTo: extra.heightAppliesTo } : {}),
    farUnconstrained: true,
    source,
    basis: 'udo',
    district: null,
    neighborhood1StepDown: extra.neighborhood1StepDown ?? true,
  }
}

/** The district table states height PER USE — a residential row and a
 *  nonresidential/mixed-use row (Tables 4-3 and 5-3 only). */
function heightByUse(
  residentialFt: number | null,
  nonresidentialFt: number | null,
  source: string,
  extra: Extras = {},
): CharlotteLimits {
  return { ...height(0, source, extra), residentialFt, nonresidentialFt }
}

/** The district table's own height cell reads "Unlimited" (UC). An answer. */
function heightUnlimited(source: string, extra: Extras = {}): CharlotteLimits {
  return {
    ...height(0, source, extra),
    residentialFt: null,
    nonresidentialFt: null,
    heightUnconstrained: true,
  }
}

const N1_COVERAGE: CharlotteCoverage = {
  kind: 'by-lot-size',
  thresholdSqFt: 10000,
  pctAtOrAbove: 40,
  pctBelow: 50,
  source: 'UDO Table 4-1 row E ("Lots 10,000 square feet and greater: 40 / Lots Less than 10,000 square feet: 50")',
}

const flat = (pct: number, source: string): CharlotteCoverage => ({ kind: 'flat', pct, source })

// ── The 30 base districts ───────────────────────────────────────────────────

export const CHARLOTTE_DISTRICTS: Record<CharlotteBaseDistrict, CharlotteLimits> = {
  // ── Article 4, Sec. 4.3.D, Table 4-3 — Neighborhood 1 ────────────────────
  // Row A "Maximum Building Height – Residential (feet)", row B "Maximum
  // Building Height – Nonresidential and Mixed-Use (feet)". Note 3 on row B
  // ("Building height may be increased by one foot for each additional one foot
  // of building setback … to a maximum height of 65 feet") is an elective
  // setback trade, not a by-right figure, and is deliberately not encoded.
  // Table 4-3 has no bonus row.
  'N1-A': heightByUse(48, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-A: 48 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),
  'N1-B': heightByUse(48, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-B: 48 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),
  'N1-C': heightByUse(40, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-C: 40 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),
  'N1-D': heightByUse(40, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-D: 40 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),
  'N1-E': heightByUse(40, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-E: 40 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),
  'N1-F': heightByUse(48, 48, 'UDO Sec. 4.3.D, Table 4-3 rows A/B (N1-F: 48 ft residential, 48 ft nonresidential/mixed-use)', { coverage: N1_COVERAGE }),

  // ── Article 5, Sec. 5.3.D, Table 5-3 — Neighborhood 2 ────────────────────
  // Row C "Maximum Building Height with Bonus (feet) (Section 16.3)" is BLANK
  // for N2-A and N2-B and reads 100 only for N2-C. Read from the table markup,
  // not from flattened text, precisely so the 100 could not slide left.
  'N2-A': heightByUse(48, 48, 'UDO Sec. 5.3.D, Table 5-3 rows A/B (N2-A: 48 ft residential, 48 ft nonresidential/mixed-use; row C bonus blank)', { coverage: flat(50, 'UDO Table 5-1 row E (N2-A: 50%)') }),
  'N2-B': heightByUse(48, 48, 'UDO Sec. 5.3.D, Table 5-3 rows A/B (N2-B: 48 ft residential, 48 ft nonresidential/mixed-use; row C bonus blank)', { coverage: flat(60, 'UDO Table 5-1 row E (N2-B: 60%)') }),
  'N2-C': heightByUse(65, 65, 'UDO Sec. 5.3.D, Table 5-3 rows A/B (N2-C: 65 ft), row C (bonus 100 ft)', { bonusHeightFt: 100 }),

  // ── Article 6, Sec. 6.3.D, Table 6-3 — Commercial ────────────────────────
  CG: height(50, 'UDO Sec. 6.3.D, Table 6-3 row A (CG: 50 ft), row B (bonus 65 ft)', { bonusHeightFt: 65 }),
  CR: height(50, 'UDO Sec. 6.3.D, Table 6-3 row A (CR: 50 ft), row B (bonus 65 ft)', { bonusHeightFt: 65 }),

  // ── Article 7, Sec. 7.3.D, Table 7-3 — Campus ────────────────────────────
  // Table 7-1 row C states coverage for IC-1 and OFC only; the IC-2, OG and RC
  // cells are blank. Note 2 on that row: structured parking up to 10% of lot
  // area is excluded from the coverage calculation.
  'IC-1': height(50, 'UDO Sec. 7.3.D, Table 7-3 row A (IC-1: 50 ft), row B (bonus 80 ft)', { bonusHeightFt: 80, coverage: flat(60, 'UDO Table 7-1 row C (IC-1: 60%; note 2 excludes structured parking up to 10% of lot area)') }),
  'IC-2': height(120, 'UDO Sec. 7.3.D, Table 7-3 row A (IC-2: 120 ft), row B (bonus 250 ft)', { bonusHeightFt: 250 }),
  OFC: height(50, 'UDO Sec. 7.3.D, Table 7-3 row A (OFC: 50 ft), row B (bonus 80 ft)', { bonusHeightFt: 80, coverage: flat(60, 'UDO Table 7-1 row C (OFC: 60%; note 2 excludes structured parking up to 10% of lot area)') }),
  OG: height(50, 'UDO Sec. 7.3.D, Table 7-3 row A (OG: 50 ft), row B (bonus 80 ft)', { bonusHeightFt: 80 }),
  RC: height(120, 'UDO Sec. 7.3.D, Table 7-3 row A (RC: 120 ft), row B (bonus 250 ft)', { bonusHeightFt: 250 }),

  // ── Article 8, Sec. 8.3.D, Table 8-3 — Manufacturing and Logistics ───────
  // Table 8-3 has ONE row (A). There is no bonus row for ML — checked in the
  // markup, not assumed from the neighbouring articles that do have one.
  'ML-1': height(80, 'UDO Sec. 8.3.D, Table 8-3 row A (ML-1: 80 ft; table has no bonus row)'),
  'ML-2': height(80, 'UDO Sec. 8.3.D, Table 8-3 row A (ML-2: 80 ft; table has no bonus row)'),

  // ── Article 9, Sec. 9.3.C, Table 9-2 — Innovation Mixed-Use ──────────────
  IMU: height(80, 'UDO Sec. 9.3.C, Table 9-2 row B (IMU: 80 ft), row A (min 24 ft), row C (bonus 120 ft)', { minHeightFt: 24, bonusHeightFt: 120 }),

  // ── Article 10, Sec. 10.3.C, Table 10-2 — Neighborhood Center ────────────
  NC: height(65, 'UDO Sec. 10.3.C, Table 10-2 row B (NC: 65 ft), row A (min 16 ft), row C (bonus 80 ft)', { minHeightFt: 16, bonusHeightFt: 80 }),

  // ── Article 11, Sec. 11.3.C, Table 11-2 — Community Activity Center ──────
  // Row A (minimum height) is BLANK for CAC-1 and reads 24 for CAC-2.
  'CAC-1': height(80, 'UDO Sec. 11.3.C, Table 11-2 row B (CAC-1: 80 ft), row C (bonus 120 ft); row A minimum blank', { bonusHeightFt: 120 }),
  'CAC-2': height(120, 'UDO Sec. 11.3.C, Table 11-2 row B (CAC-2: 120 ft), row A (min 24 ft), row C (bonus 200 ft)', { minHeightFt: 24, bonusHeightFt: 200 }),

  // ── Article 12, Sec. 12.3.C, Table 12-2 — Regional Activity Center ───────
  RAC: height(150, 'UDO Sec. 12.3.C, Table 12-2 row B (RAC: 150 ft), row A (min 40 ft), row C (bonus 275 ft)', { minHeightFt: 40, bonusHeightFt: 275 }),
  UE: height(150, 'UDO Sec. 12.3.C, Table 12-2 row B (UE: 150 ft), row A (min 24 ft), row C (bonus 300 ft)', { minHeightFt: 24, bonusHeightFt: 300 }),
  // Row B for UC reads the word "Unlimited"; row C (bonus) is blank, which is
  // consistent — there is nothing for a bonus to add to.
  UC: heightUnlimited('UDO Sec. 12.3.C, Table 12-2 row B (UC: "Unlimited"), row A (min 40 ft); row C bonus blank', { minHeightFt: 40 }),

  // ── Article 13, Sec. 13.3.C, Table 13-2 — Transit Oriented Development ───
  // Cross-read against the article PDF; HTML and PDF agree on all four columns.
  // Row A (minimum height) is BLANK for TOD-TR.
  'TOD-TR': height(50, 'UDO Sec. 13.3.C, Table 13-2 row B (TOD-TR: 50 ft), row C (bonus 75 ft); row A minimum blank', { bonusHeightFt: 75 }),
  'TOD-CC': height(90, 'UDO Sec. 13.3.C, Table 13-2 row B (TOD-CC: 90 ft), row A (min 24 ft), row C (bonus 130 ft)', { minHeightFt: 24, bonusHeightFt: 130 }),
  'TOD-NC': height(75, 'UDO Sec. 13.3.C, Table 13-2 row B (TOD-NC: 75 ft), row A (min 24 ft), row C (bonus 100 ft)', { minHeightFt: 24, bonusHeightFt: 100 }),
  'TOD-UC': height(130, 'UDO Sec. 13.3.C, Table 13-2 row B (TOD-UC: 130 ft), row A (min 40 ft), row C (bonus 300 ft, note 4: unlimited within 1/4 mile walking distance of a rapid transit station)', { minHeightFt: 40, bonusHeightFt: 300, bonusUnlimitedNearRapidTransit: true }),

  // ── Article 14, Sec. 14.8 — Manufactured Home Park ───────────────────────
  // MHP is the one base district with NO "Building Height Standards" table.
  // Table 14-1 (district bulk) and Table 14-2 (manufactured home stand) are all
  // there is, and Table 14-2's only height row is "Maximum Manufactured Home
  // Height 24'". So: 24 ft applies to a manufactured home, and the UDO states
  // no maximum building height for anything else in the district — the
  // nonresidential figure is a genuine absence, not a lookup we skipped.
  MHP: heightByUse(24, null, 'UDO Sec. 14.8.D, Table 14-2 ("Maximum Manufactured Home Height 24\'"); the MHP district has no Building Height Standards table and states no maximum for other structures', { heightAppliesTo: 'manufactured home', neighborhood1StepDown: false }),
}

/** Unresolved — the code string matched no district. Asserts NOTHING: not a
 *  height, not a coverage cap, and specifically NOT `farUnconstrained`. A GAP
 *  must never render as FACT 1's known absence. */
const UNRESOLVED: CharlotteLimits = {
  residentialFt: null,
  nonresidentialFt: null,
  heightUnconstrained: false,
  minHeightFt: null,
  bonusHeightFt: null,
  farUnconstrained: false,
  source: '',
  basis: 'unresolved',
  district: null,
  neighborhood1StepDown: false,
}

/** A conditional / optional / EX district carried over from the pre-UDO
 *  ordinance. The binding standard is the superseded ordinance plus the
 *  approved site plan (Sec. 1.4.C). An ANSWER about WHY there is no by-right
 *  number — and `farUnconstrained` stays FALSE, because FACT 1 is a claim about
 *  the UDO and this parcel is not governed by it. */
function sitePlanGoverned(): CharlotteLimits {
  return {
    ...UNRESOLVED,
    basis: 'site-plan',
    source:
      'UDO Sec. 1.4.C (a conditional, optional or EX zoning district in place before June 1, 2023, or approved since under the prior Zoning Ordinance, is governed by the development ordinances in effect at approval plus the conditional zoning site plan and site-specific conditions)',
  }
}

// ── UDO Table 3-1: Zoning Districts Translation ─────────────────────────────
// Sec. 3.2, verbatim: "The conventional zoning district classifications in
// effect before the effective date of June 1, 2023 of this Ordinance are
// translated as shown in Table 3-1: Zoning Districts Translation to the zoning
// districts of this Ordinance. The new standards set forth in this Ordinance
// for these zoning districts shall apply to all properties within such zoning
// districts."
//
// This is a translation the ORDINANCE performs, not one we infer — so a parcel
// the map still labels "R-3" is legally N1-A and its UDO figures apply. It is
// nevertheless kept distinct (`basis: 'udo-translated'`, `translatedFrom`) so a
// reader can see that the map string and the governing district differ.
//
// ⚠️ Sec. 3.2 says CONVENTIONAL classifications. It does not reach conditional
// or optional districts, and Sec. 1.4.C sends those the other way — which is
// why the live map still carries B-1(CD) and UR-2(CD) unchanged while every
// bare 'B-1', 'B-2', 'MUDD', 'UMUD', 'INST', 'O-1' and 'I-1' has disappeared
// from it (measured 2026-08-08 across all 218 distinct ZoneDes values).
export const CHARLOTTE_TRANSLATIONS: Record<string, CharlotteBaseDistrict> = {
  'B-1': 'CG',
  'B-2': 'CG',
  'B-D': 'ML-1',
  BP: 'OFC',
  'I-1': 'ML-1',
  'I-2': 'ML-2',
  INST: 'IC-1',
  MUDD: 'CAC-2',
  'O-1': 'OFC',
  'O-2': 'OFC',
  'O-3': 'OFC',
  'R-3': 'N1-A',
  'R-4': 'N1-B',
  'R-5': 'N1-C',
  'R-6': 'N1-D',
  'R-8': 'N1-D',
  'R-8MF': 'N2-A',
  'R-12MF': 'N2-B',
  'R-17MF': 'N2-B',
  'R-22MF': 'N2-B',
  'R-43MF': 'N2-B',
  'TOD-CC': 'TOD-CC',
  'TOD-NC': 'TOD-NC',
  'TOD-TR': 'TOD-TR',
  'TOD-UC': 'TOD-UC',
  'RE-1': 'RC',
  'RE-2': 'RC',
  UMUD: 'UC',
  'UR-1': 'N1-E',
  'UR-2': 'N2-B',
  'UR-3': 'N2-C',
  'UR-C': 'N2-C',
  'R-MH': 'MHP',
  'U-I': 'ML-1',
}

// Table 3-1's PED row, transcribed in full because it is a three-clause cell
// and collapsing it is exactly the Philadelphia "70% of Lot Area" failure:
//
//   PED | "All districts except R-3, R-4, R-5, R-6, R-8, R-8MF, R-12MF,
//         R-17MF, R-22MF, R-43MF, TOD-TR, TOD-NC, TOD-CC, TOD-UC, and MUDD
//         Zoning Districts: NC / R-8MF, R-12MF, R-17MF, R-22MF, and R-43MF
//         Zoning Districts: N2-C / R-3, R-4, R-5, R-6, R-8, TOD-TR, TOD-NC,
//         TOD-CC, TOD-UC, and MUDD Zoning Districts: The zoning translation for
//         the district applies"
//       | Exception: "Translation does not apply where PED Overlay is in
//         conjunction with a conditional or optional district"
//
// The TS row reads "District eliminated", with the same conditional/optional
// exception — so a conventional district carrying TS simply keeps its own
// translation.
const PED_TO_N2C = new Set(['R-8MF', 'R-12MF', 'R-17MF', 'R-22MF', 'R-43MF'])
const PED_KEEPS_OWN_TRANSLATION = new Set([
  'R-3', 'R-4', 'R-5', 'R-6', 'R-8', 'TOD-TR', 'TOD-NC', 'TOD-CC', 'TOD-UC', 'MUDD',
])

/** Every token that may legitimately appear after the base code in a `ZoneDes`
 *  string, and what it means. A token that is NOT in here makes the whole code
 *  UNRESOLVED — the parser fails closed. That is deliberate: 'BVO' and 'INNOV'
 *  appear in the live layer and appear NOWHERE in the UDO's 39 articles, so
 *  nothing is known about whether they cap height. Publishing the base
 *  district's figure next to an unexplained suffix is precisely the
 *  plausible-looking answer CLAUDE.md rule 18 is about. */
const MARKERS = {
  // Conditional zoning district (Sec. 37.2.C.2).
  CD: 'conditional',
  // ⚠️ NOT a typo in this file. The live layer carries exactly one polygon
  // whose ZoneDes is the malformed string 'N2-B(CD0' — measured 2026-08-08,
  // returnCountOnly = 1. It is an unclosed '(CD' with a zero for the paren.
  // Accepted explicitly, with a test, rather than left to fall into the
  // unresolved bucket where it would look like an unknown district.
  CD0: 'conditional',
  // Exception district (Sec. 37.2.C.3). Cannot modify maximum height.
  EX: 'exception',
  // Optional district — pre-UDO instrument; Sec. 1.4.C.4 groups it with
  // conditional districts.
  O: 'optional',
  // Site plan amendment marker carried by the layer, not a zoning instrument.
  SPA: 'note',
  // UDO Article 14 overlays. None changes the district maximum height (FACT 6).
  HDO: 'overlay',
  'HDO-S': 'overlay',
  ANDO: 'overlay',
  CCO: 'overlay',
  MHO: 'overlay',
  NCO: 'overlay',
  RIO: 'overlay',
  // Pre-UDO overlays handled by Table 3-1.
  PED: 'ped',
  'PED-O': 'ped',
  TS: 'ts',
  'TS-O': 'ts',
  // Pre-UDO watershed overlays. Table 3-1: "District eliminated — The
  // regulations of Article 23 shall apply". Article 23 governs water-supply
  // watershed protection (built-upon area), not building height.
  LWPA: 'overlay',
  LLWPA: 'overlay',
} as const

export interface CharlotteZoneParts {
  /** The code left after markers are stripped, e.g. 'N1-C' or 'UR-2'. Null when
   *  the string produced nothing usable. */
  code: string | null
  /** Markers recognised, in the order they appeared. */
  markers: string[]
  conditional: boolean
  optional: boolean
  exception: boolean
  /** A PED overlay is present (changes which district Table 3-1 lands on). */
  ped: boolean
  /** Tokens the parser did not recognise. Non-empty ⇒ the code is UNRESOLVED. */
  unknownTokens: string[]
  /** EVERY token after the leading code, in the order the string carried them,
   *  recognised or not.
   *
   *  ⚠️ EXISTS SO THERE IS ONE TOKENIZER. providers/charlotte.ts ran its own
   *  `zoneDes.toUpperCase().split(/[()\s]+/).filter(Boolean).slice(1)` to find
   *  overlay names — character-for-character the split below, in a second place.
   *  Measured before collapsing: the two agreed on all 218 live ZoneDes values,
   *  so nothing had drifted. That is precisely the state Seattle's two height
   *  parsers were in before they diverged on the one family nobody probed, and
   *  the MIO overlay shipped as a by-right height up to 6x too high.
   *
   *  `markers` and `unknownTokens` cannot be concatenated to reconstruct this —
   *  that reorders, and the provider emits overlay labels in string order. */
  tail: string[]
}

/**
 * Split a Charlotte `ZoneDes` string into a base code and its markers.
 *
 * `ZoneDes` is a compound, hand-maintained string and the live layer's 218
 * distinct values (measured 2026-08-08 over 5,680 polygons) include a stray
 * space ('N2-A (CD)'), markers appended without parentheses ('CG(CD)ANDO',
 * 'RC(CD)EX'), markers separated by a space ('NC(EX) HDO', 'MX-2 INNOV') and
 * one malformed paren ('N2-B(CD0'). Splitting on parentheses AND whitespace
 * handles all of them uniformly.
 *
 * Fails closed: any token that is neither the leading code nor a known marker
 * lands in `unknownTokens`, and `resolveCharlotte` then returns a GAP.
 */
export function parseCharlotteZone(zoneDes: string | null | undefined): CharlotteZoneParts {
  const empty: CharlotteZoneParts = {
    code: null,
    markers: [],
    conditional: false,
    optional: false,
    exception: false,
    ped: false,
    unknownTokens: [],
    tail: [],
  }
  if (!zoneDes) return empty
  const tokens = zoneDes
    .toUpperCase()
    .split(/[()\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return empty

  let code: string | null = tokens[0]
  const parts: CharlotteZoneParts = { ...empty, code, markers: [], unknownTokens: [], tail: tokens.slice(1) }

  // A trailing '-O' on the leading token is the pre-UDO "optional" suffix
  // (MUDD-O, UMUD-O). No UDO district and no Table 3-1 left-column code ends in
  // '-O', so this cannot eat a real district name.
  if (code && /-O$/.test(code) && code.length > 2) {
    code = code.slice(0, -2)
    parts.optional = true
  }
  parts.code = code

  for (const tok of tokens.slice(1)) {
    const kind = (MARKERS as Record<string, string | undefined>)[tok]
    if (!kind) {
      parts.unknownTokens.push(tok)
      continue
    }
    parts.markers.push(tok)
    if (kind === 'conditional') parts.conditional = true
    else if (kind === 'optional') parts.optional = true
    else if (kind === 'exception') parts.exception = true
    else if (kind === 'ped') parts.ped = true
  }
  return parts
}

/**
 * Resolve what the Charlotte UDO states for a `ZoneDes` string.
 *
 * Four outcomes, which must render differently (see `basis`):
 *   · a UDO Sec. 3.3 district        → its Article 4–14 figures
 *   · a Table 3-1 conventional code  → the translated district's figures
 *   · a conditional/optional/EX legacy district → nothing, with Sec. 1.4.C as
 *     the reason the by-right number does not exist
 *   · anything else                  → a GAP that asserts nothing
 *
 * Never derives a story count, never returns a Section 16.3 bonus height, and
 * never falls back to a nearby district.
 */
export function resolveCharlotte(zoneDes: string | null | undefined): CharlotteLimits {
  const parts = parseCharlotteZone(zoneDes)
  if (!parts.code) return UNRESOLVED
  // An unexplained token means we cannot account for the whole string, and a
  // partial account is not an answer.
  if (parts.unknownTokens.length > 0) return UNRESOLVED

  const legacyMarked = parts.conditional || parts.optional

  // A UDO district established by Sec. 3.3.
  const udo = (CHARLOTTE_DISTRICTS as Record<string, CharlotteLimits | undefined>)[parts.code]
  if (udo) {
    // Sec. 1.4.C.3: a conditional district approved under the UDO meets the UDO
    // AND its site plan. The figures apply; the site plan may bind below them.
    return {
      ...udo,
      district: parts.code as CharlotteBaseDistrict,
      ...(parts.conditional || parts.optional ? { conditional: true } : {}),
      ...(parts.exception ? { exception: true } : {}),
    }
  }

  // A pre-UDO conventional classification. Sec. 3.2 translates it; Sec. 1.4.C
  // does NOT translate its conditional/optional variants.
  const translationKey = parts.code
  const hasTranslation = translationKey in CHARLOTTE_TRANSLATIONS
  if (hasTranslation && !legacyMarked) {
    let target: CharlotteBaseDistrict
    if (parts.ped && !PED_KEEPS_OWN_TRANSLATION.has(translationKey)) {
      target = PED_TO_N2C.has(translationKey) ? 'N2-C' : 'NC'
    } else {
      target = CHARLOTTE_TRANSLATIONS[translationKey]
    }
    return {
      ...CHARLOTTE_DISTRICTS[target],
      district: target,
      basis: 'udo-translated',
      translatedFrom: translationKey,
      source: `${CHARLOTTE_DISTRICTS[target].source} — reached via UDO Sec. 3.2 / Table 3-1, which translates the pre-UDO "${translationKey}"${parts.ped ? ' with PED Overlay' : ''} classification to ${target}`,
      ...(parts.exception ? { exception: true } : {}),
    }
  }

  // A conditional / optional / EX district the UDO does not govern.
  if (legacyMarked || parts.exception) return sitePlanGoverned()

  // Everything else: a code that is in neither Sec. 3.3 nor Table 3-1.
  return UNRESOLVED
}

/**
 * The maximum height the UDO states for a district AND a use.
 *
 * CLAUDE.md rule 6: a per-use table must stay keyed by use. Asking for
 * 'residential' in N1-C returns 40 ft, not the 48 ft the nonresidential row
 * carries — the larger figure assumes a programme the user has not chosen.
 * Returns null where the UDO states no figure for that use, and null (never a
 * number) where height is unconstrained; read `heightUnconstrained` for that.
 */
export function heightFtFor(
  limits: CharlotteLimits,
  use: 'residential' | 'nonresidential',
): number | null {
  return use === 'residential' ? limits.residentialFt : limits.nonresidentialFt
}

/**
 * Maximum building coverage as a fraction of lot area, for a given lot size.
 *
 * N1's cell is conditional on lot size (Table 4-1 row E), so a lot size is
 * required to answer it; passing none returns null rather than picking one of
 * the two percentages. Returns null where the district's article states no
 * coverage standard — Articles 9–13 have no Lot Standards table at all, which
 * is an absence in the code, not a missing lookup.
 */
export function coverageFractionFor(
  limits: CharlotteLimits,
  lotSqFt: number | null | undefined,
): number | null {
  const c = limits.coverage
  if (!c) return null
  if (c.kind === 'flat') return c.pct / 100
  if (lotSqFt == null || !Number.isFinite(lotSqFt) || lotSqFt <= 0) return null
  return (lotSqFt >= c.thresholdSqFt ? c.pctAtOrAbove : c.pctBelow) / 100
}

/**
 * Coarse use vocabulary for a Charlotte district.
 *
 * Read out of UDO Table 15-1 "Use Matrix" (Sec. 15.2) on 2026-08-08 — the two
 * halves of the matrix parsed from the table markup, with the column map taken
 * from the matrix's own repeated section-header rows rather than from its
 * top header row. That detail is load-bearing: the top header row omits its
 * leading label cell (the "Uses" cell above it carries a rowspan), so reading
 * columns from it shifts every district by one and produces a matrix in which
 * CG permits a Manufactured Home Park and N1-A does not. Caught by a sanity
 * check on two known-good cells before any of it was used (CLAUDE.md rule 16 —
 * the instrument is the suspect first).
 *
 * Sec. 15.2.B legend: "X" permitted by right; "PC" allowed subject to
 * prescribed conditions; "C" requires a conditional rezoning; a shaded blank
 * cell means not allowed. Only X and PC count as allowed here — "C" is not a
 * by-right use.
 *
 * ⚠️ N1 AND N2 ARE NOT COMMERCIAL, and this is the mapping a reading of the
 * raw matrix gets wrong. Office, retail, restaurant/bar, personal service,
 * specialty food, art gallery, arts-or-fitness studio and medical/dental office
 * all show "PC" in the N1 and N2 columns — but Sec. 15.4's prescribed condition
 * for each reads, verbatim, "In a Neighborhood 1 or Neighborhood 2 zoning
 * district a[n] <use> is only permitted as a Neighborhood Commercial
 * Establishment per the prescribed conditions for that use." That is a
 * corner-store carve-out, not general commercial, so N1 and N2 are reported as
 * residential and institutional only.
 *
 * ⚠️ ML-1 AND ML-2 PERMIT NO DWELLING AT ALL. Every one of the nine residential
 * rows is blank in both columns. Reporting them as residential would assert a
 * housing right the code does not grant.
 */
const USES_RESIDENTIAL_INSTITUTIONAL = ['residential', 'institutional']
const USES_EMPLOYMENT = ['commercial', 'institutional']
const USES_MIXED = ['commercial', 'mixed', 'residential', 'institutional']

const CHARLOTTE_USES: Record<CharlotteBaseDistrict, string[]> = {
  'N1-A': USES_RESIDENTIAL_INSTITUTIONAL,
  'N1-B': USES_RESIDENTIAL_INSTITUTIONAL,
  'N1-C': USES_RESIDENTIAL_INSTITUTIONAL,
  'N1-D': USES_RESIDENTIAL_INSTITUTIONAL,
  'N1-E': USES_RESIDENTIAL_INSTITUTIONAL,
  'N1-F': USES_RESIDENTIAL_INSTITUTIONAL,
  'N2-A': USES_RESIDENTIAL_INSTITUTIONAL,
  'N2-B': USES_RESIDENTIAL_INSTITUTIONAL,
  'N2-C': USES_RESIDENTIAL_INSTITUTIONAL,
  // Table 15-1 MHP column: Dwelling – Manufactured Home and Manufactured Home
  // Park are "X"; every commercial row is blank.
  MHP: USES_RESIDENTIAL_INSTITUTIONAL,
  CG: USES_MIXED,
  CR: USES_MIXED,
  'IC-1': USES_MIXED,
  'IC-2': USES_MIXED,
  OFC: USES_MIXED,
  OG: USES_MIXED,
  RC: USES_MIXED,
  'ML-1': USES_EMPLOYMENT,
  'ML-2': USES_EMPLOYMENT,
  IMU: USES_MIXED,
  NC: USES_MIXED,
  'CAC-1': USES_MIXED,
  'CAC-2': USES_MIXED,
  RAC: USES_MIXED,
  UE: USES_MIXED,
  UC: USES_MIXED,
  'TOD-UC': USES_MIXED,
  'TOD-NC': USES_MIXED,
  'TOD-CC': USES_MIXED,
  'TOD-TR': USES_MIXED,
}

/** Returns null rather than guessing where the code resolved to nothing, and
 *  null for a site-plan-governed district, whose permitted uses come from its
 *  approved site plan and the superseded ordinance — not from Table 15-1. */
export function usesForZone(zoneDes: string | null | undefined): string[] | null {
  const limits = resolveCharlotte(zoneDes)
  if (!limits.district) return null
  return CHARLOTTE_USES[limits.district] ?? null
}

/** Human-readable district name, exactly as UDO Sec. 3.3 spells it. */
export const CHARLOTTE_DISTRICT_NAMES: Record<CharlotteBaseDistrict, string> = {
  'N1-A': 'Neighborhood 1',
  'N1-B': 'Neighborhood 1',
  'N1-C': 'Neighborhood 1',
  'N1-D': 'Neighborhood 1',
  'N1-E': 'Neighborhood 1',
  'N1-F': 'Neighborhood 1',
  'N2-A': 'Neighborhood 2',
  'N2-B': 'Neighborhood 2',
  'N2-C': 'Neighborhood 2',
  CG: 'General Commercial',
  CR: 'Regional Commercial',
  'IC-1': 'Institutional Campus',
  'IC-2': 'Institutional Campus',
  OFC: 'Office Flex Campus',
  OG: 'Office General',
  RC: 'Research Campus',
  'ML-1': 'Manufacturing and Logistics',
  'ML-2': 'Manufacturing and Logistics',
  IMU: 'Innovation Mixed-Use',
  NC: 'Neighborhood Center',
  'CAC-1': 'Community Activity Center',
  'CAC-2': 'Community Activity Center',
  RAC: 'Regional Activity Center',
  UE: 'Uptown Edge',
  UC: 'Uptown Core',
  'TOD-UC': 'Transit Urban Center',
  'TOD-NC': 'Transit Neighborhood Center',
  'TOD-CC': 'Transit Community Center',
  'TOD-TR': 'Transit Transition',
  MHP: 'Manufactured Home Park',
}

/** The UDO Article 14 overlay codes, with the name the article gives them.
 *  None of them changes a district's maximum building height (FACT 6). */
/**
 * ⚠️ TWO LIVE TOKENS ARE KNOWN TO NEITHER VOCABULARY: `BVO` and `INNOV`.
 *
 * Found 2026-08-17 by running all 218 live ZoneDes values through both the
 * marker table and this overlay table and asking which tokens neither claims.
 * Every token this table names is also a MARKER, so the two never disagree —
 * but `BVO` and `INNOV` fall through both and land in `unknownTokens`, and a
 * non-empty `unknownTokens` makes the whole string UNRESOLVED by design.
 *
 * That is why these six live codes resolve nothing:
 *   CAC-1 BVO · N2-B BVO · MX-1(INNOV) · MX-2 INNOV · MX-2(INNOV) · MX-3(INNOV)
 *
 * NOT guessed at. `BVO` and `INNOV` are not in UDO Article 14's overlay list as
 * read for this table, and inventing an expansion for either — "Bonus Village",
 * "Innovative" — would be a name invented to fit an abbreviation, which is rule
 * 27 with less evidence than a prefix. They stay unknown until Article 14 (or
 * the UDO's definitions) is read for them specifically.
 *
 * The refusal is doing real work here: an unrecognised token means we cannot
 * account for the whole string, and a district whose modifiers we cannot read
 * is not a district whose limits we can publish.
 */
export const CHARLOTTE_OVERLAY_NAMES: Record<string, string> = {
  HDO: 'Historic District Overlay',
  'HDO-S': 'Streetside Historic District Overlay',
  NCO: 'Neighborhood Character Overlay',
  RIO: 'Residential Infill Overlay',
  CCO: 'Cottage Court Overlay',
  MHO: 'Manufactured Home Overlay',
  ANDO: 'Airport Noise Disclosure Overlay',
}
