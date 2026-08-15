// Minneapolis FAR — Built Form Overlay Districts.
//
// Source of record: **Minneapolis Code of Ordinances, Title 20 — Zoning Code,
// effective July 1, 2023**, Chapter 540 Article II, §540.110 — Table 540-2
// (Maximum Floor Area Ratio, pp.127-128) and Table 540-3 (Maximum Floor Area
// Ratio for Cluster Developments, p.128). Read from the ordinance PDF
// 2026-08-05, page images rendered and read directly rather than trusting a
// text-layer extraction of a merged-cell table.
//
// ── THE HANDBOOK IS WRONG ON ONE CELL — DO NOT "CORRECT" BACK TO IT ─────────
// This module previously cited the *Built Form Districts Handbook* (Oct 2023)
// as its source. On the Interior 2 page that handbook transposes two columns:
// it prints "UN, RM: 0.8 / All other districts: 1.4" under **Cluster
// Developments** and "0.5" under **Institutional and Civic Uses**. The
// ordinance says the opposite — §540.110(a) excludes cluster developments from
// Table 540-2 entirely, and Table 540-3 gives Interior 2 a flat 0.5. The
// handbook's own Interior 1 and Interior 3 pages agree with the ordinance;
// only Interior 2 is transposed. The handbook is a summary document; the
// ordinance governs. We shipped the handbook's 0.8/1.4 as our cluster figure.
//
// ── WHY THIS LOOKS NOTHING LIKE THE OTHER CITIES ────────────────────────────
// Two traps sit in front of anyone doing this work, and both were walked into
// before being caught (see docs/plans/2026-08-04-far-unconstrained-sweep.md):
//
// 1. **Municode Chapter 546 is the WRONG CODE.** It publishes R1/R1A/R2/R2B/
//    R3-R6 with clean FAR values. The live GIS publishes
//    UN1-3 / CM1-4 / DT1-2 / PR1-2 / RM1-3 / TR1. Minneapolis comprehensively
//    rezoned; encoding Ch. 546 would have matched ZERO parcels.
//
// 2. **FAR is not in the base district at all.** It lives in the BUILT FORM
//    overlay — a second layer the provider already fetches and already reads
//    for height, and never read for FAR.
//
// ── THE SHAPE: FAR = f(built form × use × PRIMARY zoning) ───────────────────
// The "UN, RM" split in the handbook refers to the PRIMARY zoning district
// (Urban Neighborhood / Residence Mixed), not the overlay — so both layers are
// needed to resolve one number. That is why this takes two arguments.
//
// ── SCOPE: Interior 1/2/3 ONLY ──────────────────────────────────────────────
// The Corridor (BFC3/4/6), Core 50 (BFC50), Transit (BFT10/15/20/30A/30B),
// Production (BFPR) and Parks (BFPA) districts publish a **Base FAR plus an
// earned premium system** (max 2-3 premiums at 0.3 / 0.4 / 0.65 / 0.75 / 0.8 /
// 1.0 each, varying by district). The base figures did not linearise from the
// handbook's multi-column layout and are NOT guessed here — those districts
// return null and remain `published-not-fetched`. Premiums are earned, not
// by-right, so when they are encoded they belong in `farAlternatives`, not in
// the headline.

export interface MinneapolisFar {
  /** By-right FAR for the base case (a 1-3 unit dwelling). Null when unresolved. */
  maxFAR: number | null
  /** Other programs the code allows on the same parcel, as ratios. */
  alternatives: Array<{ label: string; far: number }>
}

const NONE: MinneapolisFar = { maxFAR: null, alternatives: [] }

/**
 * Cluster-development FAR — **Table 540-3**, effective July 1, 2023:
 *
 *   | Built Form Overlay District | Maximum FAR (Multiplier) |
 *   | Interior 1 / Interior 2     | 0.5   (one merged cell)  |
 *   | All other districts         | 0.7                      |
 *
 * Table 540-3 has exactly ONE value column. The primary zoning district does
 * not appear in it, so this takes only the built form — which makes the bug it
 * replaces unrepresentable: no UN/RM branch can reach a cluster figure at all.
 * (Rule 14 — a structure, not a comment.)
 *
 * A cluster development is a separate development type the applicant elects,
 * not the general case (§540.110(a) applies Table 540-2 to "principal
 * structures, except cluster developments"), so this is an ALTERNATIVE — it
 * never becomes `maxFAR`. Rule 6 cuts both ways: we do not swap in the larger
 * program, and we do not swap in the smaller one either.
 */
function clusterFar(builtForm: 'BFI1' | 'BFI2' | 'BFI3'): number {
  // Interior 1 and Interior 2 share one merged 0.5 cell; Interior 3 falls in
  // the "All other districts" row at 0.7.
  return builtForm === 'BFI3' ? 0.7 : 0.5
}

/** Primary zoning district categories Table 540-2 groups as "UN, RM". */
function isUnRm(primaryZone: string | null | undefined): boolean {
  const z = (primaryZone ?? '').trim().toUpperCase()
  return /^UN\d?/.test(z) || /^RM\d?/.test(z)
}

/**
 * Resolve Minneapolis FAR from the Built Form overlay abbreviation (`Abbrv` on
 * the Planning_Zoning_Built_Form layer) and the primary zoning code
 * (`Land_Use_Code` on Planning_Primary_Zoning).
 *
 * Returns all-null for any district whose table has not been read. Never
 * guesses — an unresolved built form is a GAP, not an absence of FAR.
 */
export function resolveMinneapolisFar(
  builtForm: string | null | undefined,
  primaryZone: string | null | undefined,
): MinneapolisFar {
  const bf = (builtForm ?? '').trim().toUpperCase()
  if (!bf) return NONE
  const unRm = isUnRm(primaryZone)

  // Interior 1 — Table 540-2, Interior 1 row:
  //   UN, RM            All uses except Institutional and Civic Uses: 0.5
  //                     Institutional and Civic Uses: 0.8
  //   All other         Residential buildings with 1-3 units: 0.5
  //                     All other buildings: 1.4
  // 4+ unit dwellings are generally NOT allowed here (Handbook fn.13), so no
  // multifamily alternative is offered. Institutional/civic uses are a further
  // category we do not enumerate — that is an unlisted category, not a claim
  // that none exists.
  if (bf === 'BFI1') {
    return {
      maxFAR: 0.5,
      alternatives: [
        { label: 'Cluster development', far: clusterFar('BFI1') }, // Table 540-3
        { label: 'Other uses', far: unRm ? 0.5 : 1.4 },
      ],
    }
  }

  // Interior 2 — Table 540-2, Interior 2 row:
  //   UN, RM            Residential buildings with 1-3 units 0.5
  //                     All other buildings: 0.8
  //   All other         Residential buildings with 1-3 units: 0.5
  //                     All other buildings: 1.4
  // Cluster developments are NOT in Table 540-2 (§540.110(a) excludes them);
  // Table 540-3 gives Interior 2 a flat 0.5 with no UN/RM split. We previously
  // published 0.8 (UN/RM) / 1.4 (other) here, copied from the transposed
  // Interior 2 cell of the Oct 2023 handbook. See the header note.
  if (bf === 'BFI2') {
    return {
      maxFAR: 0.5,
      alternatives: [
        { label: 'Cluster development', far: clusterFar('BFI2') }, // Table 540-3
        { label: 'Other uses', far: unRm ? 0.8 : 1.4 },
      ],
    }
  }

  // Interior 3 — Table 540-2, Interior 3 row. The only Interior district that
  // gives 2- and 3-unit dwellings MORE floor area than a single-family house
  // as-of-right, which is exactly the reform this tool exists to show.
  //   Single-family dwellings (and state credentialed care facilities serving
  //   6 or fewer persons): 0.5 · Two-family: 0.6 · Three-family: 0.7
  //   All other uses: UN/RM 1.4 · all other districts 1.6
  // Cluster: Table 540-3 "All other districts" row = 0.7.
  if (bf === 'BFI3') {
    const multi = unRm ? 1.4 : 1.6
    return {
      maxFAR: 0.5,
      alternatives: [
        { label: 'Two-family', far: 0.6 },
        { label: 'Three-family', far: 0.7 },
        { label: 'Cluster development', far: clusterFar('BFI3') }, // Table 540-3
        { label: '4+ units', far: multi },
      ],
    }
  }

  // ── Corridor / Transit / Core 50 / Production / Parks ─────────────────────
  //
  // READ 2026-08-15 from Table 540-2 itself. The note this replaces said the
  // base figures "did not linearise from the handbook's multi-column layout" —
  // that was true OF THE HANDBOOK, and the mistake was reading the summary
  // document instead of the ordinance. The ordinance's own Table 540-2 states
  // each of these as a plain two-value row and extracts cleanly:
  //
  //   Corridor 3   UN, RM 1.5   All other districts 1.9
  //   Corridor 4   UN, RM 2.0   All other districts 2.4
  //   Corridor 6   UN, RM 3.0   All other districts 3.4
  //   Transit 10   UN, RM 5.0   All other districts 5.4
  //   Transit 15   UN, RM 6.0   All other districts 6.4
  //   Transit 20   UN, RM 7.0   All other districts 7.4
  //   Transit 30   UN, RM 10.0  All other districts 10.4
  //   Core 50      All primary districts 16.0
  //   Production   All primary districts 3.0
  //   Parks        UN  Residential buildings with 1-3 units 0.5
  //                    All other uses: 0.8
  //                All other districts 2.0
  //
  // ⚠️ SOURCED FROM THE ADOPTED PDF, NOT THE DRAFT. minneapolis2040.com serves
  // two Chapter 540 files; media/1906 opens with the word "DRAFT" and media/1972
  // is the adopted text. They differ in length (43 vs 47 pages). Encoding the
  // draft would have published proposed figures as current ones.
  //
  // ⚠️ PARKS GROUPS ON "UN" ALONE, not "UN, RM" like every other row. Reusing
  // isUnRm() there would put an RM parcel on the 0.5/0.8 rows when the table
  // puts it under "All other districts" at 2.0 — a fourfold understatement.
  //
  // PREMIUMS ARE NOT ENCODED. Article III lets these districts earn additional
  // floor area; earned floor area is not by-right, so it belongs in
  // `alternatives` and only once Article III has been read. Its absence here is
  // a gap in the ALTERNATIVES, not in the headline.
  const CORRIDOR_TRANSIT: Record<string, [unRm: number, other: number]> = {
    BFC3: [1.5, 1.9],
    BFC4: [2.0, 2.4],
    BFC6: [3.0, 3.4],
    BFT10: [5.0, 5.4],
    BFT15: [6.0, 6.4],
    BFT20: [7.0, 7.4],
    // Transit 30 is mapped as two abbreviations but is ONE row in Table 540-2.
    BFT30A: [10.0, 10.4],
    BFT30B: [10.0, 10.4],
  }
  const ct = CORRIDOR_TRANSIT[bf]
  if (ct) {
    return {
      maxFAR: unRm ? ct[0] : ct[1],
      // Table 540-3, "All other districts": every district below Interior 3
      // takes the 0.7 cluster figure.
      alternatives: [{ label: 'Cluster development', far: 0.7 }],
    }
  }

  // "All primary districts" — one value, no UN/RM split to get wrong.
  if (bf === 'BFC50') return { maxFAR: 16.0, alternatives: [{ label: 'Cluster development', far: 0.7 }] }
  if (bf === 'BFPR') return { maxFAR: 3.0, alternatives: [{ label: 'Cluster development', far: 0.7 }] }

  // Parks. The UN row splits by unit count; everything else is a flat 2.0.
  if (bf === 'BFPA') {
    const un = /^UN\d?/.test((primaryZone ?? '').trim().toUpperCase())
    return un
      ? {
          maxFAR: 0.5,
          alternatives: [
            { label: 'Other uses', far: 0.8 },
            { label: 'Cluster development', far: 0.7 },
          ],
        }
      : { maxFAR: 2.0, alternatives: [{ label: 'Cluster development', far: 0.7 }] }
  }

  // An overlay abbreviation this module does not know is a GAP, never a zero.
  return NONE
}
