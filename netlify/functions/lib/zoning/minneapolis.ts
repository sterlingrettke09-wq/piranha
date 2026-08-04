// Minneapolis FAR — Built Form Overlay Districts.
//
// Source: City of Minneapolis, **Built Form Districts Handbook** (Oct 2023),
// district pages for Interior 1 / 2 / 3, read from the primary PDF 2026-08-04.
// The handbook reproduces Table 540-2 of the zoning code.
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

/** Primary zoning districts the handbook groups as "UN, RM". */
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

  // Interior 1 — Handbook p.2. "1-3 Unit Dwellings: 0.5". All Other Uses:
  // UN/RM 0.5, all other districts 1.4. 4+ unit dwellings are generally NOT
  // allowed here, so no multifamily alternative is offered.
  if (bf === 'BFI1') {
    return { maxFAR: 0.5, alternatives: [{ label: 'Other uses', far: unRm ? 0.5 : 1.4 }] }
  }

  // Interior 2 — Handbook p.3. "1-3 Unit Dwellings: 0.5". Cluster developments
  // and all other uses: UN/RM 0.8, all other districts 1.4.
  if (bf === 'BFI2') {
    const other = unRm ? 0.8 : 1.4
    return {
      maxFAR: 0.5,
      alternatives: [
        { label: 'Cluster development', far: other },
        { label: 'Other uses', far: other },
      ],
    }
  }

  // Interior 3 — Handbook p.4. The only Interior district that gives 2- and
  // 3-unit dwellings MORE floor area than a single-family house as-of-right,
  // which is exactly the reform this tool exists to show.
  //   1-3 Unit: single-family 0.5 · two-family 0.6 · three-family 0.7
  //   4+ Unit / All Other: UN/RM 1.4 · all other districts 1.6
  //   Cluster: 0.7
  if (bf === 'BFI3') {
    const multi = unRm ? 1.4 : 1.6
    return {
      maxFAR: 0.5,
      alternatives: [
        { label: 'Two-family', far: 0.6 },
        { label: 'Three-family', far: 0.7 },
        { label: 'Cluster development', far: 0.7 },
        { label: '4+ units', far: multi },
      ],
    }
  }

  // Corridor / Core 50 / Transit / Production / Parks — base FAR plus an earned
  // premium system, not yet read from Table 540-2. UNRESOLVED, deliberately.
  return NONE
}
