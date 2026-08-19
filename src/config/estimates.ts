// Single source of truth for the estimate constants used by BOTH the analysis
// engine (netlify/functions) and the public Methodology page (/math). Keeping
// them here means the published tables can never drift from what the engine
// actually computes. All figures are labeled estimates, meant to be tuned.
import type { ProjectType, Use } from '../types/analysis'
import type { ParcelInfo } from '../types/parcel'

// BUMP THIS whenever any constant in this file (or the cost/timeline logic
// that consumes it) changes. It's appended to /api/analyze URLs as a cache
// key, so tuned numbers propagate immediately instead of serving stale cached
// verdicts for up to 24h (+7d stale-while-revalidate).
export const ESTIMATES_VERSION = 9

// Human-readable vintage of the cost tables, surfaced on the result page so the
// data provenance can't silently drift from the figures above.
//
// ⚠️ CORRECTED 2026-08-04. This previously read "RSMeans 2026 base rates · 2021
// city cost indices", which was FALSE for the first half and shipped to users.
// The city cost indices ARE sourced — verified figure-by-figure against the
// free 2021 RSMeans City Cost Index for all 15 cities. The BASE RATES are not:
// costPerSqFtByUse has no verified derivation, and the "RSMeans 2026" comment on
// it was an unsupported attribution rather than a citation. A number that is
// merely plausible must not be published wearing a source's name.
export const COST_DATA_VINTAGE =
  'Base rates: internal estimates, provenance unverified · City indices: RSMeans City Cost Index, 2021'

export type BuildingTier = 'single' | 'multi' | 'apartment'

// ---- Construction cost ----
//
// ⚠️ KNOWN UNRESOLVED DEFECTS (logged 2026-08-03). Read before tuning anything
// here or in netlify/functions/lib/cost.ts.
//
// 0. THE CONSTANTS BELOW ARE APPROXIMATELY 2.3x A SOURCED NATIONAL FIGURE.
//    Measured 2026-08-03 against RSMeans' own public model pages at National, US:
//      Apartment 4-7 Story  bare $145.01 -> total $193.94
//      Apartment 1-3 Story  bare $146.52 -> total $195.97
//      Office 5-10 Story    bare $159.35 -> total $211.14
//    This file documents costPerSqFtByUse as BARE ("labor + materials only,
//    excluding land and soft costs"), so the like-for-like comparison is:
//      residential 340 vs bare 145.01  ->  +134.5%
//      commercial  390 vs bare 159.35  ->  +144.7%
//    (Against the fee-inclusive totals it is +75.3% / +84.7%. State which basis
//    you are claiming; do not quote the larger number unexamined.)
//    Combined with the derivation finding in the ledger — four constants, no
//    common method, spread -12% to +48% against medians, one inverting — these
//    were never derived. They were selected as midpoints of a marketing-page
//    range whose upper bound is doing the work.
//
//    ⚠️ THIS IS EVIDENCE THAT 340 IS WRONG. IT IS NOT THE REPLACEMENT VALUE.
//
//    ⚠️ NO LONGER UNCONTESTED (2026-08-05). That conclusion rested on ONE
//    external benchmark. A second one now disagrees with the first by roughly
//    2× on the same product class: Cumming Q4 2025's LOWEST apartment low-bound
//    across the ten metros is Nashville $280/sf — still 1.93× the RSMeans bare
//    $145.01 and 1.43× its fee-inclusive $195.97. So 340 is condemned by one
//    published source and corroborated by another.
//    Per rule 1, NO DIRECTION is asserted here: the reconciliation is almost
//    certainly a scope difference between an RSMeans national-average Square
//    Foot model and a Cumming metro "typical construction cost range", plus the
//    GC/OH&P question that is open on BOTH sides — but that is a mechanism
//    argued aloud, and nothing has measured it. Do not treat defect 0 as settled
//    in either direction until the two benchmarks are reconciled.
//    The comparison is against ONE model at national average, in one specific
//    configuration. Do NOT lift 145.01 into this table. The replacement must come
//    from the estimator's model set matched to OUR tier definitions, at a
//    resolved geography basis (see C, unresolved). A well-sourced comparison
//    becoming an unsourced substitution is the last place this can go wrong.
//
// 1. BUILDING TIER IS IGNORED BY COST. `buildingTier()` classifies a project as
//    single / multi / apartment and is consulted ONLY by timeline.ts. cost.ts
//    never reads it, so a detached house and a 200-unit tower both start from
//    costPerSqFtByUse.residential. That constant is sourced-as MID-RISE
//    MULTIFAMILY, which carries elevators, rated corridors, standpipes, and
//    structured parking that stick-frame detached construction does not.
//    ⚠️ DIRECTION RETRACTED 2026-08-03. This entry previously asserted that
//    small-scale infill is biased HIGH, reasoning from construction type (Type V
//    vs Type III, no elevator, no rated corridors). MEASUREMENT KILLED IT:
//    RSMeans Apartment 1-3 Story totals $195.97 and Apartment 4-7 Story totals
//    $193.94 — the LOW-RISE is $2/sf MORE. Economy of scale roughly cancels the
//    construction-type premium. There is no tier premium for multi-family.
//    THE DEFECT STANDS, THE DIRECTION DOES NOT: cost.ts still ignores tier and
//    the classifier still runs unconsulted. For DETACHED housing the question is
//    genuinely open — that is a separate RSMeans data set (Residential models,
//    with their own Architect/Designer Fees page) and the multi-family result
//    must not be assumed to transfer.
//    Do NOT wire tier into cost until per-tier constants are
//    SOURCED — three plausible-looking constants derived the way this one was
//    would remove the visible symptom while making the basis worse.
//
// 2. PARKING NEVER REACHES COST. PARKING_RULES drives hurdles, the Red Tape
//    Index, realityCheck and SiteFacts — but not cost.ts. Structured parking is
//    a large multifamily $/sf swing, so cities that abolished minimums (Austin,
//    Denver, San Jose, Minneapolis, SF) price identically to cities that kept
//    them (Miami). Same defect shape as (1): a classifier that runs and is not
//    consulted.
//
// 3. SITEWORK IS ABSENT ENTIRELY. cost.ts totals hard + soft + permit +
//    demolition + impact. There is no excavation/sitework term, and RSMeans
//    square-foot totals are understood to exclude it. Biases estimates LOW on
//    urban infill; magnitude unquantified (0 to -15%).
//
// 4. SOFT-COST OVERLAP IS UNQUANTIFIED, NOT SETTLED. If the $/sf figures below
//    already embed contractor overhead/profit and A&E, softCostPct double-counts
//    the A&E share. Bounded 0-7%, NOT established: the premise comes from the
//    Gordian Square Foot Estimating Manual, while these constants came from a
//    public RSMeans article that documents no inclusions or exclusions. Do not
//    cut softCostPct in isolation — (3) runs the opposite direction.
//
// 4b. FEE STRUCTURE — RESOLVED for the commercial models (2026-08-03).
//    From RSMeans' public model pages, fees are applied IN PARALLEL on the bare
//    subtotal, NOT compounded: subtotal + (25% x subtotal) + (arch% x subtotal).
//    Verified arithmetically: 146.52 + 36.63 + 12.82 = 195.97.
//    Contractor fee is 25% throughout. ARCHITECTURAL FEE VARIES BY BUILDING TYPE:
//    6% office, 7% apartment, 9% hospital. There is no single "7%" — the figure
//    inherited from the Penn State text happens to be the apartment value.
//    STILL OPEN: the RESIDENTIAL data set has its own Architect/Designer Fees
//    page and no public model page exists for it, so its fee treatment is
//    unverified. Do not assume the commercial structure transfers.
//
//    WIRING REQUIREMENT — MAKE THIS STRUCTURAL, NOT VIGILANT. When the fee rule
//    is implemented, put it behind a PER-MODEL-FAMILY LOOKUP (commercial vs
//    residential) even if both families turn out to have identical structure.
//    Assumption-propagation has already been caught twice in this file; the third
//    guard should be a shape the code enforces, not a comment someone has to
//    remember. A single shared constant would let a future divergence be absorbed
//    silently — a lookup makes it a visible gap instead.
//
// 4c. UNION vs OPEN SHOP is a real dimension we do not model at all.
//    Apartment 1-3 Story: union bare $146.52 vs open shop $131.58 = 1.114.
//    This plausibly underlies the CCI's installation column (Philadelphia 136.9,
//    Washington 88.0). If a city-selected model ALSO applies a labor basis, then
//    multiplying by CCI on top could double-count. Unresolved — see the C test.
//
// 5. PROJECT SIZE MODIFIER IS MISSING ENTIRELY. RSMeans varies $/sf by project
//    size: divide your area by the TYPICAL size for that building type to get a
//    Size Factor, then read a Cost Multiplier off the Area Conversion Scale.
//    Explicit bounds: Size Factor < 0.50 -> multiplier 1.1; > 3.5 -> 0.90.
//    Typical sizes (2024 Square Foot Project Size Modifier, free PDF):
//      Multi-Family Housing 53,600 sf · Office 21,000 sf · Schools 69,900 sf ·
//      Retail 22,000 sf · Mixed Use 29,800 sf.
//    Source: https://www.rsmeans.com/media/wysiwyg/quarterly_updates/2024-Square-Foot-Project-Size-Modifiers.pdf
//
//    RANK: SMALLEST DEFECT ON THIS LIST. The multiplier is clamped at both ends
//    (1.1 floor, 0.90 ceiling), so the entire range is 20 points wide and the
//    worst-case error from omitting it is 10%. It sits below (0), (1), (3) and
//    the vintage question. Do not let it move up the queue for being the newest.
//
//    APPLICABILITY UNCONFIRMED: the Area Conversion Scale is documented against
//    the COMMERCIAL Square Foot models. The Residential data set has different
//    structure and it is not established that the scale applies there. Verify
//    before wiring.
//
//    NOT AN EXAMPLE OF THIS DEFECT: an Austin HOME triplex (~3,000 sf) against
//    Multi-Family's 53,600 sf typical gives a Size Factor of ~0.056 — seventeen
//    times below typical. The 1.1 clamp there is not a value; it is RSMeans
//    DECLINING TO EXTRAPOLATE. A project that far outside the model's domain
//    needs a DIFFERENT MODEL (the Residential data set), not a size modifier.
//    That case belongs to defect (1), wrong model family.
//
// LICENSING — CLEARED 2026-08-03. An earlier review of the Gordian/RSMeans user
// agreement flagged its restriction on using RSMeans Data "as a component of or
// as a basis for any material or product offered for sale, license or
// distribution," and on that basis this file previously carried a recommendation
// NOT to obtain a trial or licence. THAT RECOMMENDATION IS RETRACTED. The owner
// obtained clearance from counsel and directly from RSMeans covering use of
// RSMeans-derived constants in this product. Do not re-derive the block from the
// clause alone — it was reviewed and resolved.
// SCOPE CAUTION: the clearance covers the use as understood on 2026-08-03. A
// future Data Online subscription is a SEPARATE INSTRUMENT with its own terms;
// today's clearance does not automatically travel to it. Re-check before
// building on any newly licensed feed.
//
// For a DETACHED single-family estimate, defects (1) and (4) share a sign
// (both high) and (3) opposes them. The earlier "roughly a wash" framing was
// not supported and should not be repeated.
//
// HARD construction cost ($/sf), U.S. NATIONAL average — labor + materials only,
// excluding land and soft costs. Scaled per metro by cityCostIndex below (which
// is also national-based), so the two numbers are independently sourced.
// ⚠️ PROVENANCE — read COST_DATA_VINTAGE above before adding a source name here.
// These lines used to read "Source: RSMeans 2026 building models" and tag each
// constant "RSMeans 2026". That attribution was WITHDRAWN on 2026-08-04 as an
// unsupported claim, and the withdrawal is recorded at the top of this file —
// but the retracted version survived here, in the header a reader hits first and
// on the constants themselves. Rule 17: a retraction must reach every place the
// claim appears, and headers outrank bodies. These constants have NO named
// source. They are internal estimates.
//
// CORROBORATED, NOT SOURCED (2026-08-05). Checked against Cumming Group Market
// Analysis Q4 2025 p.27 "Location Cost Impact", per-city, scope-matched to our
// `hard` line (Cumming excludes land, professional fees, permits, FF&E, soft
// costs and sitework — all separate addends here or absent from the model):
//   · residential — inside Cumming's published range for 3 of the 10 cities and
//     below the low bound by 0.3–9.0% for the rest; worst case Denver −9.0%. At
//     the 5–8 storey tier (heightCostFactor 1.12) ALL TEN land inside the range,
//     so the residual low bias is a tier artifact, not a base-rate error.
//   · commercial — inside Cumming's office Shell & Core range in 8 of the 10;
//     over the top bound only in Nashville (+5.2%) and San Francisco (+1.4%).
//     Sits between S&C and S&C+TI in all ten, which is where a complete-building
//     rate belongs.
//   · institutional — inside Cumming's K-12 range in all ten cities.
//   · mixed 365 — UNCHECKED. Cumming publishes no mixed-use row. (Withdrawn
//     2026-08-19; `mixed` is now unpriced. See costPerSqFtByProduct.)
// An independent published source agreeing within tolerance is corroboration. It
// is not provenance, and it must not be written up as one.
//
// ⚠️ CITY COUNT CORRECTED 2026-08-19, and it is the smaller half of the finding.
// Every "of 9" and "all nine" above read ten in the source table — Washington DC
// was omitted from the count. The percentages were right and every conclusion
// reproduces; only the denominator was wrong. What made it findable at all is
// that the ranges are now stored: `src/config/cummingRanges.ts` holds the
// per-city table and `cummingCheck.test.ts` recomputes each bullet above from it,
// so these sentences are no longer the only record of the comparison.
//
// NOTE: "institutional" reflects schools/civic (~$450); hospitals run far higher
// (~$700–975/sf), a known limitation of one bucket — Cumming confirms it.
// ══════════════════════════════════════════════════════════════════════════
// ⚠️ DEFECT — A DETACHED HOUSE IS PRICED AT AN APARTMENT RATE. Found 2026-08-19
// while re-keying these constants by product type.
//
// `residential: 340` is corroborated — but corroborated against Cumming's
// APARTMENT ranges, and the note above records that it lands inside the range in
// all nine metros only at the 5–8 storey tier (heightCostFactor 1.12, so ~381).
// Meanwhile `heightFactorTiers` gives "Up to 4 stories" a factor of 1.00.
//
// So today a detached single-family house resolves to 340 x cityIdx x 1.00, and a
// mid-rise apartment to 340 x cityIdx x 1.12. The two differ ONLY by a height
// factor, and both are anchored to a base validated against apartment product.
// Detached wood-frame construction has no elevator core, no double-loaded
// corridor and no podium; it is not 89% of a mid-rise rate.
//
// THE CAUSE IS THE KEY, NOT THE NUMBER. `Use` distinguishes residential /
// commercial / mixed / institutional and says nothing about product type, while
// every published cost source — Cumming, RSMeans, NAHB — is organised BY product
// type. A constant keyed differently from every source that could validate it
// cannot be validated except by accident, which is what "corroborated in 3 of 4
// buckets" actually describes.
//
// Re-keying by product type is therefore not a refactor. It is the change that
// makes the numbers checkable, and it splits `residential` into three buckets
// whose real rates differ by more than any factor in this file.
// ══════════════════════════════════════════════════════════════════════════

export const costPerSqFtByUse: Record<Use, number> = {
  residential: 340, // internal estimate; corroborated vs Cumming Q4 2025 (see above)
  commercial: 390, // internal estimate; corroborated vs Cumming Q4 2025 office S&C
  mixed: 365, // blend of residential + ground-floor commercial
  institutional: 450, // schools/civic; healthcare is materially higher
}

// ── COST BY PRODUCT TYPE (2026-08-19) ─────────────────────────────────────
// Keyed the way every published source publishes, so a figure can be checked
// against one. See the defect note above for why `Use` alone could not be.

/** Product types as the cost literature organises them. `mixed` is kept as a
 *  product because the site models mixed-use projects — not because anyone
 *  publishes a rate for it. */
export type CostProduct =
  | 'detached'
  | 'small-multi'
  | 'apartment'
  | 'office'
  | 'institutional'
  | 'mixed'

/** A rate WITH ITS PROVENANCE STATE, because the three states below must not
 *  render the same (rule 5) and one of them must not produce a number at all.
 *
 *  'corroborated' — a figure checked against a published, scope-matched source.
 *                   Still not provenance: agreement is not derivation, and the
 *                   file says so. It is the strongest state anything here has.
 *  'provisional'  — a figure carried forward from the old use-keyed constant
 *                   whose validation belongs to a DIFFERENT product. It ships
 *                   only so that re-keying does not delete a number nobody asked
 *                   to lose, and it is the slot a real source drops into.
 *  unsourced      — no published source covers this product at this scope.
 *  unpriced       — the code/model needs a figure and none exists to have. */
export type CostRate =
  | {
      kind: 'rate'
      perSqFt: number
      provenance: 'corroborated' | 'provisional'
      source: string
    }
  | { kind: 'unsourced'; reason: string }
  | { kind: 'unpriced'; reason: string }

// The per-city ranges themselves live in `cummingRanges.ts`; `cummingCheck.test.ts`
// recomputes every claim below from them rather than restating a verdict.
const CUMMING =
  'Cumming Group Market Analysis Q4 2025 p.27 (Location Cost Impact), scope-matched to the hard line — Cumming excludes land, professional fees, permits, FF&E, soft costs and sitework'

export const costPerSqFtByProduct: Readonly<Record<CostProduct, CostRate>> = Object.freeze({
  // Its validated home: 340 was checked against Cumming's APARTMENT ranges, and
  // lands inside all ten metros at the 5–8 storey tier.
  // ── APARTMENT RE-VALIDATED AGAINST CUMMING, 2026-08-19 ────────────────────
  // Asked for once the key was corrected, and the answer has three parts.
  //
  // 1. THE ARITHMETIC DID NOT CHANGE; THE VALIDITY DID. Comparing 340 to
  //    Cumming's apartment ranges is the same comparison it always was — neither
  //    number moved. What moved is what it licenses. Before the re-key, 340 also
  //    priced detached houses and 2–4 unit buildings, so "inside Cumming's
  //    APARTMENT range for 3 of 9 cities" said nothing whatsoever about
  //    two-thirds of what the constant was used for. It now serves one product
  //    and the check covers all of it. The corroboration got stronger by being
  //    narrowed, without a figure moving — which is what re-keying was for.
  //
  // 2. ⚠️ WITHDRAWN THE SAME DAY, BY ME, AND THE WITHDRAWAL WAS THE ERROR.
  //    What stood here argued that the "tier artifact" explanation below was
  //    contradicted by RSMeans, on the grounds that its 1-3 storey apartment
  //    model ($146.52 bare) prices above its 4-7 storey model ($145.01) — taller
  //    apparently cheaper, against a modelled +12%.
  //
  //    Those two figures are not comparable as they stand. RSMeans prices
  //    building AREA separately from height, and the two models are 22,500 and
  //    60,000 S.F. against a Multi-Family typical size of 53,600 — size factors
  //    0.42 and 1.12, carrying cost multipliers of 1.10 and ~0.99. Normalised,
  //    they read $133.2 and $146.5, a premium of ~10%, not a discount of 1%. The
  //    full three-point series and its arithmetic are recorded at
  //    heightFactorTiers below.
  //
  //    So the premium is real, ~1.09–1.10 at 4-7 storeys against this file's
  //    1.12, and the "tier artifact" explanation stands. Apartment's
  //    corroboration is NOT weakened by RSMeans; it is supported by it.
  //
  // 3. ✅ RESOLVED THE SAME DAY — the ranges are now stored, and this paragraph
  //    used to say the check could not be re-run. It could not, because only the
  //    conclusion had been kept and not the numbers it was drawn from; the report
  //    had to be re-obtained to re-examine a claim already in the repo.
  //
  //    Cumming publishes its quarterly market analysis openly, so the Q4 2025
  //    edition was reachable without credentials. Its per-city ranges are in
  //    `src/config/cummingRanges.ts` and `cummingCheck.test.ts` recomputes the
  //    comparison from them on every run. The verdict is no longer written down
  //    anywhere; it is derived. This is the general fix for "corroboration is not
  //    provenance": store the source's numbers, never your reading of them.
  //
  //    Also unsettleable from the record: buildingTier puts 5+ units in
  //    'apartment', so a five-unit two-storey walkup takes this rate at factor
  //    1.00 — and nothing here says whether Cumming's apartment ranges describe
  //    walkups or mid-rise. That is the same product-vs-key question one level
  //    down from the one just fixed.
  apartment: { kind: 'rate', perSqFt: 340, provenance: 'corroborated', source: CUMMING },
  office: { kind: 'rate', perSqFt: 390, provenance: 'corroborated', source: `${CUMMING} — inside the office Shell & Core range in 8 of the 10 cities, and between S&C and S&C+TI in all ten, which is where a complete-building rate belongs` },
  institutional: { kind: 'rate', perSqFt: 450, provenance: 'corroborated', source: `${CUMMING} — inside the K-12 range in all ten cities; hospitals run far higher and are a known limitation of one bucket` },

  // ⚠️⚠️ 340 → 152, AND THIS IS THE MEASUREMENT THE RE-KEY WAS FOR.
  //
  // NAHB's Cost of Constructing a Home in 2024 (published 2025-01-20, survey
  // conducted autumn 2024) puts the average construction cost of a typical
  // single-family home at $428,215 over an average finished area of 2,647 sq ft
  // — $161.77/sf as published.
  //
  // THAT IS NOT SCOPE-MATCHED TO THIS LINE, and the difference is four published
  // line items. NAHB's Section I "Site Work" contains building permit fees
  // ($7,640), impact fee ($6,367), water & sewer fees and inspections ($6,260)
  // and architecture/engineering ($6,480) — every one of which this model adds
  // SEPARATELY, as the permit line, the impact line, and softCostPct. Leaving
  // them in would bill each of them twice.
  //
  //   published gross                              $161.77/sf
  //   less permits + impact + water/sewer + A&E    $151.67/sf   <- this figure
  //   less ALL of Section I                        $149.41/sf
  //
  // The middle figure is used: Section I's fifth member is "Other" ($5,972) under
  // a heading whose other four are fees and design, so it may be genuine site
  // work. Keeping it is the choice that does not UNDERSTATE, which is the
  // direction that flatters a cost estimate (rule 7).
  //
  // ⚠️ AND IT RESOLVES THE CONTRADICTION THIS FILE REFUSED TO SETTLE. The header
  // records RSMeans bare at $145.01 condemning 340, and Cumming's $280 apartment
  // low-bound corroborating it, with no direction asserted because the
  // reconciliation was "almost certainly a scope difference". It was a PRODUCT
  // difference. NAHB scope-matched ($151.67) and RSMeans bare ($145.01) agree
  // within 4.6% on DETACHED; Cumming's $280+ is metro APARTMENT. Two independent
  // sources measuring the same product agree; the third was measuring another
  // one. Nothing was wrong with either source — the constant was keyed so that
  // they appeared to disagree.
  //
  // Derived from published figures, all four cited above and all from one table,
  // so this is a derivation with every input sourced rather than a composite with
  // one (rule 3).
  // ── STEP 5: VALIDATED AGAINST PERMIT-DECLARED VALUATIONS, 2026-08-19 ──────
  // An outside measurement, because two published sources agreeing is still two
  // documents (rule 9). LA's building-permit feed is the only one of the six
  // permit datasets read by this project that carries BOTH a declared valuation
  // and a floor area — Austin, Seattle and SF have one or neither.
  //
  //   data.lacity.org pi9x-tg5x, permit_type='Bldg-New',
  //   use_desc='Dwelling - Single Family', issued 2024-01-01 onward, n=3,344
  //     p25 $111/sf   median $138/sf   p75 $185/sf   (as declared, in LA)
  //   ÷ LA cityCostIndex 1.12 →
  //     p25  $99/sf   median $123/sf   p75 $165/sf   (national-equivalent)
  //
  // $152 sits INSIDE that band and ABOVE its median.
  //
  // ⚠️ THE DIRECTION IS STATED AND NOT CORRECTED FOR (rule 7). Permit valuations
  // are declared by the applicant for fee assessment and are widely understood to
  // understate actual construction cost; the magnitude of that understatement is
  // not something this source can tell us. So the median is a FLOOR, not an
  // estimate, and this check can only bound from BELOW. It cannot confirm $152 —
  // it can only fail it, and it does not.
  //
  // WHAT IT DOES SETTLE is the figure it replaced. At 340 national, LA detached
  // resolved to $381/sf against a declared p75 of $185 — more than double the
  // 75th percentile of what LA builders themselves declare. A rate above the p75
  // of its own city's declarations is not a defensible estimate in any direction.
  //
  // Limits: one city, and a high-index one. A second city with both fields would
  // strengthen it; none of the other five feeds has both.
  detached: {
    kind: 'rate',
    perSqFt: 152,
    provenance: 'corroborated',
    source:
      'NAHB, Cost of Constructing a Home in 2024 (Special Study, 20 Jan 2025): $428,215 average construction cost over 2,647 sq ft average finished area, less the Section I items this model bills separately (permit fees $7,640, impact fee $6,367, water & sewer $6,260, architecture/engineering $6,480) = $151.67/sf. Independently within 4.6% of the RSMeans bare figure recorded above.',
  },

  // The gap this re-key was expected to create, and it is a real one: NAHB covers
  // detached, Cumming covers apartment, and 2–4 unit sits between them. An
  // interpolation between two sources that each measure a different product is
  // an invented conversion factor (rule 4) — so this stays empty rather than
  // being filled with the arithmetic mean of two things neither of which is it.
  'small-multi': {
    kind: 'unsourced',
    reason:
      'No published source covers 2–4 unit construction at this scope. NAHB measures detached single-family and Cumming measures apartment; a figure between them would be interpolated, not sourced.',
  },

  // Was 365, described in-file as a "blend of residential + ground-floor
  // commercial" — a composite whose basis was never checked, and Cumming
  // publishes no mixed-use row to check it against.
  mixed: {
    kind: 'unpriced',
    reason:
      'No source publishes a mixed-use rate at this scope. The former 365 was a blend of two other constants rather than a measurement, and blending them again would reproduce that.',
  },
})

/** The building tiers the timeline already classifies parcels into. Repeated as
 *  a string union rather than imported, because this file is `src/config` and the
 *  classifier lives under `netlify/` — but the MEMBERS must match, and
 *  estimates.test.ts pins that they do rather than trusting the comment. */
export type CostTier = 'single' | 'multi' | 'apartment'

/**
 * Which product a project is, from the use it declares and the tier its unit
 * count puts it in.
 *
 * This is the whole point of the re-key: `use` alone cannot tell a detached
 * house from a mid-rise, and every source that could price either is organised
 * by exactly that distinction.
 */
export function costProductFor(use: Use, tier: CostTier | null): CostProduct {
  if (use === 'commercial') return 'office'
  if (use === 'institutional') return 'institutional'
  if (use === 'mixed') return 'mixed'
  // residential splits three ways.
  //
  // ⚠️ A NULL TIER RESOLVES TO 'detached' ONLY AS A TYPE-LEVEL TOTALITY — the
  // rate lookup refuses it outright, see costRateFor. Until 2026-08-19 detached
  // and apartment carried the SAME number, so this default cost nothing and
  // nobody had to choose. They now differ by 2.2x, and every available default
  // is wrong in a direction: apartment overstates a house, detached understates
  // a block of flats, and understating is the direction that flatters a cost
  // estimate (rule 7). So neither is picked.
  if (tier === 'apartment') return 'apartment'
  if (tier === 'multi') return 'small-multi'
  return 'detached'
}

/** The rate for a project, with its provenance state attached. Never a bare
 *  number: two of the six products have no rate to give, and a caller that
 *  cannot see that would publish a total built on nothing. */
export function costRateFor(use: Use, tier: CostTier | null): CostRate {
  // An unresolved unit count on a residential project cannot pick a rate: the
  // three residential products span 152 to 340, so the choice IS the answer.
  // Refusing is not defensive tidiness — it is the only option that does not
  // publish a 2.2x error as a figure.
  if (use === 'residential' && tier == null) {
    return {
      kind: 'unsourced',
      reason:
        'The number of homes in this project could not be determined, and the construction rate depends on it — a detached house and an apartment building differ by more than double per square foot.',
    }
  }
  return costPerSqFtByProduct[costProductFor(use, tier)]
}

// Relative HARD-construction cost by metro = RSMeans City Cost Index "total"
// (materials + labor) ÷ 100, so U.S. national average = 1.00. Pairs with the
// national $/sf above. Hard cost only — NOT land or market price, which is why
// "expensive" cities like DC come out low: DC's cost is land, and its
// construction labor (non-union VA/MD pool) is cheap. Chicago (1.20) outranks
// LA (1.12) on heavily unionized trades.
// Source: RSMeans "City Cost Indexes - V2" 2021 location factors, published
// free by RSMeans at:
//   https://www.rsmeans.com/media/wysiwyg/quarterly_updates/2021-CCI-LocationFactors-V2.pdf
// Values are the WEIGHTED AVERAGE (A-G) "TOTAL" column for each city's 3-digit
// ZIP group, divided by 100. Verified 2026-08-03 by extracting the table
// directly; every pre-existing value below matched it exactly, which confirms
// this PDF is the original source for the first ten cities.
// WATCH: city names collide across states in this table. Always match on the
// ZIP group, never the name alone. Re-enumerated 2026-08-08 while adding
// Columbus OH, and the trap is bigger than this note used to say — there are
// FIVE Columbuses, spanning 79.6 to 92.3, a 16% spread:
//   Miami OK   743        = 80.3   (vs Miami FL 330-332,340 = 85.1)
//   Columbus MS 397       = 79.6
//   Columbus GA 318-319   = 86.4
//   Columbus NE 686       = 88.1
//   Columbus IN 472       = 89.1
//   Columbus OH 430-432   = 92.3   ← the one this file wants
// Charlotte has near-name rather than same-name company: Charlottesville VA
// 229 = 88.7 and Charlottetown (Canadian table) = 95.8. A `grep -i charlotte`
// returns all three.
// Every row below was matched by locating its ZIP group AND confirming the
// all-caps STATE header immediately above it in the same column.
export const cityCostIndex: Record<string, number> = {
  nyc: 1.32, // 100-102 New York = 132.2 (Brooklyn 112 = 133.1, Queens 110 = 131.8)
  sf: 1.3, // 941 = 129.8
  sanjose: 1.27, // 951 = 126.9 — Bay Area trade labor, second only to SF
  chicago: 1.2, // 606-607 = 119.5 — unionized trades
  philadelphia: 1.16, // 190-191 = 115.8 — installation 136.9, a strong union market
  boston: 1.14, // 024 = 114.3
  la: 1.12, // 900-902 = 111.8
  sandiego: 1.09, // 919-921 = 109.4
  minneapolis: 1.07, // 554-555 = 107.0
  seattle: 1.07, // 980-981 = 106.7
  // ── 2026-08-09 cohort: lasvegas, phoenix, dallas ─────────────────────────
  // All three re-verified 2026-08-09 by downloading the cited PDF and reading
  // the rows out of the weighted-average (A-G) TOTAL column directly, rather
  // than by trusting the extraction that proposed them. The same pull
  // reproduced ELEVEN values already committed here — SF 129.8, LA 111.8,
  // San Diego 109.4, Milwaukee 103.9, Columbus 92.3, Atlanta 89.2,
  // Nashville 89.0, Charlotte 87.0, Miami 85.1, Raleigh 84.4, Austin 82.9 —
  // which is what makes the three below evidence rather than plausible digits
  // (CLAUDE.md rule 16).
  //
  // ⚠️ A TRAP THAT WOULD HAVE PRODUCED PLAUSIBLE WRONG NUMBERS. The same PDF
  // also carries SUMMARY location-factor tables near the end, two columns of
  // bare decimals, and they are a DIFFERENT series. Phoenix reads .84/.87
  // there, Dallas .84/.86, Las Vegas 1.03/1.05 — close enough to pass a glance.
  // Raleigh is the one that gives it away: the summary reads .94 against the
  // 0.84 committed above and confirmed in the main table. Read the main table's
  // TOTAL column, as every row in this file does.
  //
  // ⚠️ NAME COLLISION, LIVE, IN THIS DOCUMENT, AND THE WORST ONE YET. "Las
  // Vegas" occurs TWICE as a ZIP-group row: 877 Las Vegas (NEW MEXICO) = 86.3
  // and 889-891 Las Vegas (NEVADA) = 105.4. That is a 22% spread — the Miami-OK
  // trap one notch worse — and a name match alone picks the wrong one half the
  // time. Both were read; the ZIP group decides.
  lasvegas: 1.05, // 889-891 = 105.4 (NEVADA) — mat. 104.2 / inst. 107.0. NOT 877 Las Vegas NM = 86.3
  // ── 2026-08-08 cohort: milwaukee, columbus, charlotte, atlanta ────────────
  // All four extracted in ONE pull from the PDF cited above, by the same method
  // (the "TOTAL" column of the location-factor table, ÷100), and reconciled
  // against known-good rows in that same pull BEFORE any of them was trusted
  // (CLAUDE.md rule 16). The pull reproduced, exactly, eight values already
  // committed in this file: SF 129.8, LA 111.8, San Diego 109.4, DC 95.5,
  // Nashville 89.0, Miami 85.1, Raleigh 84.4 and Austin 82.9. An extraction
  // that cannot reproduce the rows this table was built from is reading a
  // different table, and that check is what makes the four new numbers below
  // evidence rather than plausible digits.
  milwaukee: 1.04, // 530,532 = 103.9 (WISCONSIN block) — mat. 97.9 / inst. 111.7
  dc: 0.95, // 200-205 = ~95 — low construction labor; land is the real cost
  columbus: 0.92, // 430-432 = 92.3 (OHIO block) — NOT Columbus MS/GA/NE/IN, see WATCH
  denver: 0.91, // 802-803 = 91.5
  nashville: 0.89, // 370-372 = 89.0
  atlanta: 0.89, // 300-303,399 = 89.2 (GEORGIA block)
  charlotte: 0.87, // 281-282 = 87.0 (NORTH CAROLINA block) — NOT Charlottesville VA 229 = 88.7
  // 850,853 = 87.0 (mat. 98.4 / inst. 72.1). The adjacent row is 851,852
  // Mesa/Tempe = 86.4 — different cities in the same metro, sharing neither ZIP
  // group nor value, which is exactly why the ZIP group is what gets matched.
  // The lookalike "Phenix City" (Alabama, 368 = 86.1) is a different spelling.
  phoenix: 0.87,
  // 752-753 = 86.0 (mat. 100.1 / inst. 67.4). "Dallas" appears as a ZIP-group
  // row exactly ONCE in the whole document; 750 McKinney (83.2) and 751
  // Waxahachie (83.3) are separate suburbs with their own rows.
  dallas: 0.86,
  miami: 0.85, // 330-332,340 = 85.1 (NOT Miami OK 743 = 80.3)
  // 275-276 = 84.4. Extracted 2026-08-07 from the same PDF cited above, by the
  // same method, and reconciled against three known-good rows in the SAME pull
  // before being trusted (CLAUDE.md rule 16): Nashville 89.0, Austin 82.9 and
  // Miami 85.1 all reproduced the values already committed here, which is what
  // establishes that the extraction is reading the table this file was built
  // from rather than a lookalike. "RALEIGH" occurs exactly twice in the
  // document, both in the North Carolina block, so the name-collision trap the
  // note above warns about does not arise here — and the ZIP group was still
  // matched (275-276), not the name.
  raleigh: 0.84,
  austin: 0.83, // 786-787 = 82.9
}

// High-rise construction costs more per sq ft (structure, elevators, life-safety),
// but the premium plateaus rather than compounds. Source: RSMeans 2026 by-height
// models — the big step is the wood→concrete jump at 4→5 stories; towers amortize
// cores/elevators over more floor area, so the top tier is ~+45%, not +60%.
// ── THE HEIGHT PREMIUM, SETTLED 2026-08-19 — AND A SELF-CORRECTION ────────
// This file recorded that RSMeans priced Apartment 1-3 Story at $146.52 bare and
// Apartment 4-7 Story at $145.01, i.e. taller marginally CHEAPER, and that was
// used to doubt the 1.12 premium and, through it, apartment's corroboration.
//
// ⚠️ THAT COMPARISON WAS CONFOUNDED, AND SO WAS THE DOUBT. RSMeans model pages
// are each priced at their own building AREA, and RSMeans prices area as a
// SEPARATE effect via the Square Foot Project Size Modifier — Size Factor =
// project area ÷ the type's typical size, then a cost multiplier off the Area
// Conversion Scale. Multi-Family Housing's typical size is 53,600 S.F. The three
// apartment models are 22,500 / 60,000 / 145,000 S.F., so they sit at size
// factors 0.42, 1.12 and 2.71 — a 6.4x spread that the raw $/sf figures fold in
// silently.
//
//   model        area      size factor   multiplier        published   normalised
//   1-3 story    22,500    0.42          1.10 (STATED)     $146.52     $133.2
//   4-7 story    60,000    1.12          ~0.99             $145.01     $146.5
//   8-24 story   145,000   2.71          ~0.92             $171.32     $186.2
//
// The 1-3 model is the SMALLEST building carrying the HIGHEST size multiplier —
// which is precisely what made it look dear beside 4-7 and produced the apparent
// flatness. Control for size and the premium is real and monotonic.
//
//   implied height factor, 1-3 = 1.000:   4-7 ≈ 1.09–1.10 · 8-24 ≈ 1.37–1.43
//   this file:                            5-8 = 1.12      · 9-20 = 1.28
//
// Two multipliers are read off a published CURVE rather than a table, so they are
// ranges, not points; the only exact one is 1.10, which the PDF states outright
// for size factors below 0.50. The conclusion is robust across the whole
// interpolation band, which is why it is stated at all.
//
// SO: the 5-8 tier is about right, marginally high (1.12 against ~1.09–1.10),
// and the 9-20 tier is LOW (1.28 against ~1.37–1.43). No change is made here —
// one product's model series is not a basis for re-cutting tiers that apply to
// all six, and rule 1 forbids moving a number on a mechanism argued rather than
// measured across its own domain. Recorded as a measured direction with its
// magnitude, which is what a future change would need.
//
// ⚠️ AND APARTMENT'S CORROBORATION IS RESTORED. The note above withdrew
// confidence in the "tier artifact" explanation because RSMeans appeared to
// contradict the premium. It does not — it supports it, once size is controlled.
// The withdrawal was mine and it was wrong; the original reasoning stands.
//
// The general form is worth more than the number: a published $/sf figure that
// carries an unstated second variable is not a measurement of the first one. The
// vendor publishes the size instrument separately precisely because size is a
// distinct effect, and using the headline figures without it compares buildings
// that differ in two ways while attributing the difference to one.

export const heightFactorTiers: { label: string; max: number | null; factor: number }[] = [
  { label: 'Up to 4 stories', max: 4, factor: 1.0 },
  { label: '5 to 8 stories', max: 8, factor: 1.12 },
  { label: '9 to 20 stories', max: 20, factor: 1.28 },
  { label: 'Over 20 stories', max: null, factor: 1.45 },
]
export function heightCostFactor(stories: number | null): number {
  if (stories == null) return 1.0
  for (const t of heightFactorTiers) {
    if (t.max == null || stories <= t.max) return t.factor
  }
  return 1.0
}

// Soft costs (A&E, permitting consultants, legal, developer OH — NOT financing,
// which is excluded everywhere, matching the disclaimers) as a share of HARD
// cost. Industry standard is 20–30% of hard cost; 0.25 is a defensible mid-range
// blended value. Source: NMHC Housing Affordability Toolkit; Multifamily.loans.
export const softCostPct = 0.25

// Residential share of GFA assumed for a mixed-use building (ground-floor
// commercial under residential floors). Used to avoid billing commercial-class
// impact fees on the residential floors of a mixed project (and by the
// envelope's unit math).
export const MIXED_RESIDENTIAL_SHARE = 0.85
// Nominal/representative permit fees — NOT a sourced per-city fee schedule.
// Real schedules vary (Chicago is sf-based w/ ~$602 min, DC ~$0.03/cu-ft, etc.),
// but building-permit fees are rounding-error against multimillion-dollar
// construction value, so a flat ~1%-of-value proxy is adequate here.
export const PERMIT_BASE_FEE = 100 // flat building-permit filing fee (USD)
export const PERMIT_RATE_PER_1000 = 10 // $ per $1,000 of construction value
export const VARIANCE_FILING_FEE = 600 // variance filing + intake (USD)
// Floor-to-floor height (ft), incl. structure. 11 ft residential, ~13 ft
// commercial. Source: CRE floor-to-floor design standards (AdventuresinCRE) —
// a DESIGN CONVENTION, not a zoning code.
//
// ⚠️ This is an assumption that reaches substantive output, not a display
// nicety. Verified 2026-08-04:
//   • defaultSpec.stories → cost.ts heightCostFactor(stories) — the tier step
//     at 4→5 stories is 12%, so the constant can move published cost.
//   • feasibility.ts converts stories→height for the height check, which
//     decides AS_OF_RIGHT vs NEEDS_RELIEF.
//
// Where a CODE states stories directly, carry that instead and never round-trip
// (CLAUDE.md rule 12) — `zoning.maxStories` exists for exactly this, and Miami
// and Denver now use it. This constant is the fallback for cities that publish
// only feet, and `envelope.storiesBasis` marks when it was used.
export const FT_PER_STORY = 11
export function ftPerStory(use: Use): number {
  return use === 'residential' ? 11 : 13
}

// ---- Timeline: full life-cycle months (design → permit review → site prep →
// construction → move-in) for a STANDARD, by-right project on a buildable
// (cleared) lot. A teardown adds demoMonthsByCity below; discretionary review
// (variance, ULURP/CEQR, Article 80, historic, coastal) is added on top by the
// hurdle engine — so a complex project runs LONGER than these floors.
//
// Grounded, not guessed:
//  • Single-family: U.S. Census Survey of Construction 2023 — ~10 months from
//    permit to completion alone (8.9 for-sale → 15.2 owner-built); + design and
//    permit review puts a realistic floor near 14–16 months, more where permit
//    queues are long (Seattle SDCI, NYC DOB), and ~2.5 yrs in SF.
//  • Mid-rise multifamily ("multi"): ~24–34 months (12–20 mo build + design/permit).
//  • High-rise / apartment tower: industry data shows 2–4 yrs typical, trending
//    to 4–5+ yrs — so 38–66 months, NYC and SF at the top.
export const lifecycleMonths: Record<string, Record<BuildingTier, number>> = {
  austin: { single: 15, multi: 24, apartment: 38 },
  denver: { single: 15, multi: 24, apartment: 38 },
  minneapolis: { single: 16, multi: 24, apartment: 38 },
  chicago: { single: 16, multi: 26, apartment: 40 },
  // Nashville: Census SOC puts the South at the fastest construction durations in
  // the country, and Tennessee has no CEQA-style environmental review — but Metro
  // permitting is strained by sustained growth, which offsets the advantage.
  // CALIBRATION against the peer set, not a published end-to-end figure; Metro
  // Codes publishes review targets, not lifecycle months.
  nashville: { single: 16, multi: 25, apartment: 40 },
  // Philadelphia: fast by-right permitting (zoning 4-6 wks, building ~20 days) with
  // no Article 80-style large-project review, but Northeast construction durations
  // are the nation's slowest, which claws the advantage back on bigger projects.
  // Sources: Philadelphia L&I permit timelines; U.S. Census Survey of Construction,
  // NORTHEAST region, 2024 annual — single-family 13.5 mo and multifamily 23.4 mo
  // AUTHORIZATION->COMPLETION. Both are sums of the two published length-of-time
  // tables, which is what "authorization to completion" means; SOC publishes no
  // single end-to-end column. Index: census.gov/construction/nrc/data/time.html.
  //   avg_authtostart_cust.xlsx + avg_starttocomp_cust.xlsx, sheet "Northeast",
  //   row 2024, col "Buildings with 1 unit / Total 1":        2.0 + 11.5 = 13.5
  //   same sheet/row, col "Buildings with 2 units or more / Total 2": 4.3 + 19.1 = 23.4
  // Both cells re-read against the live workbooks 2026-08-10 and reconcile exactly.
  // The neighbouring "Northeast is the nation's slowest" claim checks out on the
  // same row: 1-unit start->completion 2024 is Northeast 11.5 vs West 8.8, Midwest
  // 8.2, South 6.7, U.S. 7.7.
  // ⚠️ 23.4 ALSO appears as Northeast / 2020 / "5 to 9 units" start->completion, and
  // a 2026-08-10 scoping pass read it as that and reported the citation broken. It
  // is a coincidence: 13.5 and 23.4 are the SAME region, SAME year, SAME two-table
  // sum, and a single coincidence does not reproduce a matched pair. Do not "fix"
  // this figure to 2020 5-9 units.
  // NOTE: pinned to 2024. SOC 2025 annual is now published and differs (Northeast
  // 1-unit 13.0, 2+ units 21.9) — this citation is a dated reading, not "latest".
  // NOTE: the multi (2-4) figure is interpolated between Chicago/DC 26 and the
  // single-family floor — no Philadelphia-specific 2-4 unit duration is published.
  philadelphia: { single: 16, multi: 25, apartment: 40 },
  dc: { single: 16, multi: 26, apartment: 40 },
  // Miami: fastest-in-nation Southern construction (U.S. Census Survey of
  // Construction, SOUTH region, 2024 annual — single-family 8.1 mo
  // AUTHORIZATION->completion: avg_authtostart_cust.xlsx 1.4 +
  // avg_starttocomp_cust.xlsx 6.7, sheet "South", row 2024, col "Buildings with
  // 1 unit / Total 1"; index census.gov/construction/nrc/data/time.html), offset
  // by genuinely slow City of Miami permitting (reported waits up to 18 months for
  // affordable housing; the mayor took office on a permitting-reform platform) plus
  // High-Velocity Hurricane Zone engineering (175+ mph design, Miami-Dade NOA
  // product approvals, PE-stamped drawings). Nets out to the Boston/Seattle/LA tier.
  //
  // ⚠️ CORRECTED 2026-08-10 — this comment read "8.1 mo start->completion" and named
  // the WRONG LEG. 8.1 is authorization->completion; the published start->completion
  // cell for South / 2024 / 1-unit Total is 6.7. The number was right and its label
  // was wrong, which is the harder version to catch: a reader checking 8.1 against
  // the start-to-completion table finds no such cell and has no way to tell whether
  // the figure or the label drifted. Same basis as the Philadelphia row above, so the
  // two are now stated identically. (A 2026-08-10 scoping pass proposed substituting
  // 7.6 — that is South 1-unit start->completion for 2022 AND 2023, not 2024, so
  // taking it would have swapped a mislabelled-but-correct figure for a wrong one.)
  // "Fastest in nation" holds on both legs: South 2024 1-unit is 6.7 start->comp and
  // 8.1 auth->comp, below Midwest 8.2/9.1, West 8.8/10.2, Northeast 11.5/13.5 and
  // U.S. 7.7/9.1. Pinned to 2024; SOC 2025 annual is published and gives South 6.6 /
  // 8.1 — the auth->completion figure is unchanged, the start->completion leg is not.
  miami: { single: 18, multi: 28, apartment: 46 },
  // San Diego: DSD has publicly declared its permitting backlog eliminated
  // (>50% of permits same-day; Affordable Housing Permit Now averaging 9 days),
  // so it is no longer an LA/SF-tier outlier — but Title 24/CalGreen, coastal
  // overlays, and California construction labor keep it above Denver/Austin.
  // NOTE: DSD publishes stage timings and a dashboard, not end-to-end months;
  // these integers are calibration against the peer set, not a published figure.
  sandiego: { single: 17, multi: 28, apartment: 44 },
  // San Jose: PBCE publishes ~8-16 weeks standard residential plan review (with a
  // standing advisory to add 2-3 weeks) plus 5-day express tracks, so permitting
  // sits between San Diego and Seattle. Bay Area trade-labor scarcity, Title 24 /
  // CalGreen commissioning, and Type I podium construction push the 5+ tier toward
  // Miami/LA — but nowhere near SF, whose discretionary-review-by-default culture
  // San Jose's by-right path avoids. Calibration against peers, not a published
  // end-to-end figure (no city publishes one).
  sanjose: { single: 18, multi: 29, apartment: 46 },
  boston: { single: 18, multi: 28, apartment: 44 }, // large projects trigger Article 80
  seattle: { single: 18, multi: 30, apartment: 44 }, // SDCI permit queues run long
  la: { single: 18, multi: 30, apartment: 48 }, // discretionary-heavy entitlement
  nyc: { single: 20, multi: 34, apartment: 54 }, // DOB + ULURP for larger projects
  // SF is the slowest-permitting major US city: discretionary review, CEQA, and
  // Planning Commission routinely push even modest projects past 3 years.
  sf: { single: 30, multi: 46, apartment: 66 },
  // ⚠️ NO ROW FOR raleigh, milwaukee, columbus, charlotte, atlanta, dallas,
  // lasvegas OR phoenix, AND THAT IS DELIBERATE FOR ALL EIGHT. Each is live and
  // fully wired (provider, zoning module, dispatcher, cost index, probe), so a
  // missing row here is a decision rather than an oversight, and this is where
  // a reader will look for it.
  //
  // ⚠️ AMENDED AGAIN 2026-08-09, when Dallas, Las Vegas and Phoenix were wired.
  // Note that this sentence has now been wrong twice by going stale — see the
  // 2026-08-08 amendment below — which is the argument for counting the cities
  // rather than gesturing at them. Nothing about the three new cities was
  // measured either: no permit feed was examined for any of them at this stage,
  // so there is not even an argument to reject.
  //
  // ⚠️ AMENDED 2026-08-08 — this note used to read "every OTHER city in the
  // registry has a row here". That was true of the 16-city registry and became
  // FALSE the moment Milwaukee, Columbus, Charlotte and Atlanta were wired.
  // Rule 17: a claim has to be corrected everywhere it appears, and a stale
  // "every other city" is exactly the sentence a later reader would rely on to
  // conclude the gap set is a single special case.
  //
  // There is no measurement behind a lifecycle figure for ANY of the five. What
  // is available in each case is an argument — Southern metro, no state
  // environmental-review statute, fast Census SOC construction durations,
  // therefore "about Nashville's 16/25/40"; or, for Milwaukee and Columbus, a
  // Midwest peer-set gesture at Minneapolis. That is a mechanism argued aloud,
  // and CLAUDE.md rule 1 gives it no direction at all, not a hedged one.
  // Nashville's and Minneapolis's own rows are peer-set CALIBRATIONS rather than
  // published figures; copying a calibration sideways would make the new number
  // a derivative of a derivative wearing the same font as Boston's. Four cities
  // at once makes that worse, not more acceptable — a shared method would look
  // like a methodology and would still be four invented numbers.
  //
  // Consequence, and it is the intended one: `lifecycleFallback` below carries
  // the timeline (it is the documented behaviour for exactly this case), the
  // assumptions disclosure says so in words instead of claiming a city-specific
  // estimate — see `assumptionsSummary`, which branches on membership in THIS
  // table — and `computeRedTapeIndex` omits them rather than ranking them on an
  // invented duration. Removing this gap needs a real source, not a session.
}
export const lifecycleFallback: Record<BuildingTier, number> = { single: 16, multi: 26, apartment: 40 }

// Months the life-cycle gains when an existing building must come down first
// (a vacant lot skips this): demolition permit + asbestos/abatement survey +
// utility disconnects + clearing. A teardown is rarely a quick add-on in a major
// city, so these are months, not weeks.
// Sourced from each city's demolition-permit process (permit + asbestos survey +
// utility disconnect + clearing). SF carries §311 notice + historic-resource
// eval; Denver's mandatory 21-day landmark posting pushes past 2 mo; LA's LADBS
// plan-check is faster than assumed. Boston (Article 85) and Chicago (2003
// Demolition-Delay Ordinance) can add a 90-day historic hold on flagged
// buildings — surfaced as a conditional hurdle, not baked into the base here.
export const demoMonthsByCity: Record<string, number> = {
  boston: 3,
  nyc: 4,
  chicago: 3,
  sf: 5, // §311 + historic eval + CEQA risk (was 4 — too low)
  seattle: 3,
  dc: 3,
  austin: 2,
  la: 3, // LADBS plan-check 1–4 wks (was 4 — too high)
  denver: 3, // 21-day landmark posting + 10-day screen (was 2)
  minneapolis: 2,
  // Post-2013 Market Street collapse rules add a site-specific safety plan, an
  // engineering survey, a separate demolition-contractor license, and a mandatory
  // asbestos inspection + DPH abatement permit on top of a 2-4 week permit.
  philadelphia: 3,
  // Asbestos survey mandatory for ALL demolitions; DERM/RER Notice of Demolition
  // filed 10 working days before start; FPL power and TECO gas disconnect letters
  // required before the permit issues.
  miami: 3,
  // Three stacked steps: APCD Rule 1206 asbestos survey required regardless of
  // building age (+10 working days' notice); SDMC 143.0210(d) triggers a
  // Potential Historical Resource Review for any structure 45 YEARS OR OLDER — a
  // broader screen than most peers, and much of San Diego's stock predates 1981.
  // The demo permit itself issues in ~2 business days.
  sandiego: 3,
  // BAAQMD Reg. 11 Rule 2 requires a Cal-OSHA-certified asbestos survey and a
  // J-number notification at least 10 working days before EVERY demolition
  // regardless of asbestos content; San Jose adds a PCB screening form and a
  // historic report for any structure over 45 years old. A plain single-family
  // teardown needs no Planning clearance when the replacement permit is approved,
  // so this is the modal case, not the historic-review worst case.
  sanjose: 3,
  // Tennessee (TDEC) requires an asbestos survey and notification before
  // demolition, and Metro's historic-preservation / neighborhood-conservation
  // overlays cover a large share of the urban core — a demolition inside one
  // needs Historic Zoning Commission review. 3 is the modal case; the overlay
  // path runs longer and is surfaced separately as a hurdle.
  nashville: 3,
}
export const demoMonthsFallback = 3

// Demolition cost per sq ft of EXISTING building removed (structural teardown,
// haul-off, disposal). Source: Angi/CommLoan 2025–26 — residential & small
// commercial cluster $4–$12/sf; large concrete/steel runs higher. $12 is a
// defensible blended base, scaled by the city construction index.
// (Hazmat/asbestos abatement on pre-1980 buildings adds ~$2.5/sf — a future
// conditional adder once year-built is threaded into the cost model.)
export const demoCostPerSqFt = 12

// Scope as a fraction of a full ground-up new build of the same size. Sources:
// RSMeans renovation factors; Gensler/NAIOP adaptive-reuse (~30% cheaper than
// new → 0.65); Terner Center ADU survey ($250/sf median — an ADU costs the SAME
// or MORE per sf than a house, so the factor is ~1.0, NOT a discount).
export const projectFactor: Record<ProjectType, number> = {
  new: 1,
  addition: 0.65,
  adu: 1.0, // ADUs are per-sf parity with new build (fixed costs over tiny area)
  change_of_use: 0.65, // adaptive reuse ≈ 30% cheaper than new, not 50%
}

// Months a DISCRETIONARY approval (variance / special permit / design review)
// adds on top of the by-right baseline, per city. A dimensional variance is a
// single quick hearing in fast cities (Chicago/Minneapolis ~3) but attaches
// lengthy discretionary review even to small projects elsewhere (SF ~12, LA ~10).
// Sources: Terner Center (SF ~27-mo entitlement), UCLA Anderson (LA), CBC (NYC
// ULURP/CEQR), Seattle design-review data, BPDA Article 80, city planning depts.
// NOTE: this is the SIMPLE-variance tier. A major rezoning / ULURP / CEQA-EIR or
// SEPA path runs far longer; that larger entitlement is layered on separately by
// the hurdle engine, not captured here.
export const reliefAddMonthsByCity: Record<string, number> = {
  sf: 12,
  la: 10,
  seattle: 9,
  nyc: 7,
  boston: 6,
  dc: 5,
  austin: 4,
  denver: 4,
  chicago: 3,
  minneapolis: 3,
  // Practitioner guidance is "allow four months for a normal, uncomplicated
  // variance": refusal -> ZBA appeal -> mandatory RCO notice at least 45 days
  // before the hearing -> RCO meeting -> hearing -> decision. The RCO mandate is
  // what keeps Philadelphia above Chicago/Minneapolis 3.
  philadelphia: 4,
  // Miami 21 routes most dimensional deviations to an administrative WAIVER
  // (Art. 7.1.2.5 — Zoning Administrator decides within 10 calendar days, 15-day
  // appeal window), not a full Variance. A true PZAB variance runs roughly double
  // (filing only in the first five working days of a month, then a public
  // hearing). This is the waiver-dominant blend.
  miami: 4,
  // SDMC 112.0502 runs Process One (ministerial) through Five (City Council);
  // a typical variance/deviation or Site Development Permit lands at Process Two
  // or Three. The city states complete-submittal-to-decision averages four to six
  // months, so 5 is the midpoint. A Coastal Development Permit in an appealable
  // area adds materially more — surfaced as a hurdle, not baked in here.
  sandiego: 5,
  // Discretionary approval in San Jose (CUP / Planned Development / variance)
  // triggers CEQA. Most infill clears via a Class 32 categorical exemption
  // (~1-2 months), but an Initial Study/MND adds ~6+, and a PD Permit pairs with
  // a PD rezoning needing both Planning Commission and City Council. CEQA
  // exposure is why this exceeds non-California peers of similar capacity.
  sanjose: 7,
  // Metro's Board of Zoning Appeals hears standard variances on a regular
  // calendar, and Tennessee has no CEQA-equivalent to layer on. Anything
  // non-standard is instead routed to a Specific Plan (SP) rezoning, which needs
  // Planning Commission plus Metro Council and runs materially longer — that
  // heavier path is not what this constant models.
  nashville: 4,
}
export const reliefAddMonthsFallback = 6

// Affordable-housing / linkage / impact fees ($/sf of GFA), verified against each
// city's ordinance / fee schedule (2024–26). Conditional by use & size.
//   applied:true  → baked into the cost total (we can check the trigger).
//   applied:false → INFORMATIONAL only — the trigger (Seattle MHA zone, SF office-
//     vs-retail) can't be detected per parcel, so we surface it as a note instead
//     of risking an overstated total.
// 5 cities have NO flat citywide linkage fee (NYC/Chicago/DC/Austin/Minneapolis):
// their inclusionary requirements are unit set-asides, not per-sf fees.
// NOTE: LA / Seattle fees are tiered by market area / zone, so a single value
// can't capture the full schedule. Where we DO bake a number into the total (LA),
// it is the published MEDIUM-tier rate, stated as such below — not an average or
// guess. Seattle is informational-only and uses representative midpoints. Boston
// ($23.09), Denver, and SF ($85.90 large office) are exact published rates.
// Sources (re-verified 2026-07-07 against primary fee schedules):
//   • Boston BPDA development linkage — $23.09/sf other-commercial ≥50k sf
//     (2023 ordinance, phased; lab $30.78). VERIFIED current (no FY27 change).
//   • LA City Planning AHLF "Updated Fee Schedule Effective July 1, 2025"
//     (Table per LAMC §19.18; CPI-adjusted each 7/1). Tiers Low/Medium/Medium-
//     High/High: residential 6+ units $10.32/$12.90/$15.47/$23.20; nonresidential
//     $3.86/$5.16/n-a/$6.44. We bill the MEDIUM tier below. WATCH: LAMC mandates
//     a 7/1/2026 CPI bump but no 2026 schedule is published yet (checked
//     2026-07-07) — the 2025 memo remains the latest official rates; re-check
//     planning.lacity.gov for the 2026 memo.
//   • Denver CPD Affordable Housing (Linkage) Fee schedule, current 7/1/2026
//     column (annual CPI-U): ≤9-unit residential ≤1,600 sf/unit $5.12/sf;
//     commercial typical $6.14, high $9.21. VERIFIED exact.
//   • Seattle SDCI MHA "Adjusted Payment Calculation Amounts" (Ch. 23.58B/C),
//     3/1/2026 column. Residential by area/M-M1-M2 ranges $10.78–$50.46;
//     commercial $7.87–$32.66. Midpoints below are informational. VERIFIED.
//   • SF Planning Citywide Development Impact Fee Register (eff. 1/1/2026,
//     Table 413.5A): new-construction office ≥50k gsf $85.90, <50k $77.30,
//     lab $47.35. VERIFIED exact.
/** A fee that lands in the total carries a rate; one that cannot be priced
 *  carries `applied: false` and MAY carry `perSqFt: null` — the "unpriced,
 *  disclosed" shape (CLAUDE.md rule 4). Written as a union so `applied: true`
 *  with an unknown rate is not representable: a caller reaching for
 *  `fee.perSqFt` to bill it has already had to narrow on `applied`. */
export type ImpactFee =
  | { applied: true; perSqFt: number; label: string }
  | { applied: false; perSqFt: number | null; label: string }

/** What a per-parcel fee-area lookup returned. THREE states, because two of
 *  them used to be one value and that is the whole defect:
 *
 *    · `area`        — the layer answered and named an area for this parcel
 *    · `none`        — the layer answered and no area covers this parcel
 *    · `unavailable` — the layer did not answer. NOT a finding about the
 *                      parcel, so nothing derived from it may be published as
 *                      one: no rate, and no area name in a label.
 *
 *  Measured 2026-08-12 at the analyze handler with only Denver's EHA layer
 *  faulted: `undefined` fell through to the Typical rate and billed
 *  $614,000 where the parcel's own area billed $921,000 — $307,000 removed
 *  from a published total by a timeout, with nothing in the output saying a
 *  lookup had failed. Seattle's MHA layer, same run: the published rate went
 *  from $45/sf to $28/sf for a parcel measured in "High Areas". */
export type FeeAreaRead =
  | { kind: 'area'; area: string }
  | { kind: 'none' }
  | { kind: 'unavailable' }

/** Build the fee-area read from a parcel's overlays. ONE construction site, so
 *  a caller cannot pass a fee area while dropping the fact that the lookup for
 *  it failed. */
export function feeAreaRead(overlays: ParcelInfo['overlays']): FeeAreaRead {
  if (overlays.unresolved?.includes('feeArea')) return { kind: 'unavailable' }
  return overlays.feeArea ? { kind: 'area', area: overlays.feeArea } : { kind: 'none' }
}

// Some cities levy a development tax as a PERCENTAGE OF CONSTRUCTION COST rather
// than per square foot, so it can't be expressed through impactFee() above.
// Philadelphia Code Ch. 19-4400 (Development Impact Tax): 1% of construction cost
// on residential new construction and improvements over $15,000; non-residential
// is exempt. Mandatory and citywide — distinct from the VOLUNTARY Mixed Income
// Housing bonus (§14-702(7), $25–30/sf of bonus floor area only), which we do not
// model because it buys extra floor area rather than gating a by-right project.
export interface ConstructionTax {
  pct: number
  label: string
}
export function constructionTax(city: string, use: Use): ConstructionTax | null {
  if (city === 'philadelphia' && (use === 'residential' || use === 'mixed')) {
    return { pct: 0.01, label: 'Philadelphia Development Impact Tax (1% of construction cost, residential)' }
  }
  return null
}
/** Construction value over which a city's construction tax applies (USD). */
export const CONSTRUCTION_TAX_MIN_VALUE: Record<string, number> = { philadelphia: 15000 }
export function impactFee(
  city: string,
  use: Use,
  gfa: number,
  units: number | null,
  /** Defaults to `none` — "the layer answered and no area covers this parcel".
   *  A caller that HAS a parcel must pass `feeAreaRead(parcel.overlays)` so a
   *  failed lookup cannot arrive here disguised as an empty answer. */
  feeArea: FeeAreaRead = { kind: 'none' },
): ImpactFee | null {
  const commercial = use === 'commercial' || use === 'mixed' || use === 'institutional'
  switch (city) {
    case 'boston':
      return commercial && gfa >= 50000
        ? { perSqFt: 23.09, applied: true, label: 'Boston development linkage (commercial ≥ 50k sf)' }
        : null
    case 'la':
      // LA AHLF is tiered by market area (Low / Medium / Medium-High / High); the
      // per-parcel market area isn't resolved here, so we FLATTEN to the published
      // MEDIUM-tier rate from the City Planning fee schedule effective 7/1/2025:
      // residential (6+ units) $12.90/sf, nonresidential $5.16/sf. Low areas are
      // lower ($10.32 / $3.86); High areas materially higher ($23.20 / $6.44), so
      // a High-area project is UNDER-billed by this single figure — surfaced as a
      // floor, not a ceiling. Nonresidential exempt below 15k sf (ordinance).
      if (use === 'residential') return { perSqFt: 12.9, applied: true, label: 'LA affordable-housing linkage fee (Medium market area; varies by area)' }
      return commercial && gfa >= 15000
        ? { perSqFt: 5.16, applied: true, label: 'LA affordable-housing linkage fee (nonres ≥ 15k sf; Medium market area)' }
        : null
    case 'denver': {
      // Residential <10 units is citywide-uniform ($5.12/sf, ≤1,600 sf/unit); 10+
      // units fall under the inclusionary build mandate (no fee). Commercial
      // varies by EHA market area: High $9.21, Typical $6.14 — parcel-exact.
      // Rates per the CPD schedule effective 7/1/2026 (annual CPI-U adjustment).
      if (use === 'residential') {
        // Unit count unknown: we can't tell the <10-unit fee tier from the 10+
        // inclusionary-mandate tier — surface as informational, don't guess.
        if (units == null)
          return { perSqFt: 5.12, applied: false, label: 'Denver affordable-housing fee — unit count needed to determine the tier' }
        return units >= 10 ? null : { perSqFt: 5.12, applied: true, label: 'Denver affordable-housing fee' }
      }
      if (!commercial) return null
      // ⚠️ THE MARKET AREA IS A MEASUREMENT, AND A FAILED MEASUREMENT IS NOT
      // "Typical". This line read `feeArea === 'High' ? 9.21 : 6.14` with the
      // label `(${feeArea ?? 'Typical'} market)`, so a Denver EHA outage billed
      // the Typical rate on a High-area parcel — measured 2026-08-12 at the
      // analyze handler on a 100,000 sf D-C parcel at Union Station: impact
      // $921,000 → $614,000 and total $45,638,500 → $45,331,500, `applied:
      // true`, no note. An unresolvable rate is unpriced and DISCLOSED, exactly
      // as the unit-count tier above already is (CLAUDE.md rules 4 and 5).
      //
      // The fix cannot be a `?? 'Typical'` here or anywhere downstream: at this
      // layer the two causes of a missing area are indistinguishable, which is
      // why `FeeAreaRead` carries the distinction from the provider.
      if (feeArea.kind === 'unavailable') {
        return {
          perSqFt: null,
          applied: false,
          label:
            'Denver affordable-housing fee — the city’s EHA market-area layer didn’t answer, so we can’t tell which rate applies here (Typical $6.14/sq ft, High $9.21/sq ft)',
        }
      }
      // Distinct values on the live EHA layer are exactly {High, Typical}
      // (queried 2026-08-12), and both polygons cover the city: five in-city
      // probes each returned one, two out-of-city probes returned none. So
      // `none` is "the point is outside the mapped market areas", not "High" —
      // it keeps the Typical rate it has always had, but the label no longer
      // claims the layer said so.
      if (feeArea.kind === 'none') {
        return {
          perSqFt: 6.14,
          applied: true,
          label: 'Denver affordable-housing fee (Typical rate; no EHA market area mapped at this point)',
        }
      }
      return {
        perSqFt: feeArea.area === 'High' ? 9.21 : 6.14,
        applied: true,
        label: `Denver affordable-housing fee (${feeArea.area} market)`,
      }
    }
    // Nashville: no mandatory per-sq-ft affordable-housing fee. Tennessee law
    // constrains mandatory inclusionary zoning, and Metro relies on voluntary
    // incentives and the Barnes Housing Trust Fund instead — so there is nothing
    // to bill here, which is a finding rather than a gap.
    // San Jose: NOT modelled. It has a mandatory commercial linkage fee, a 15%
    // inclusionary requirement with an in-lieu alternative, and construction
    // taxes (SJMC Ch. 4.46 / 4.54 / 4.64) — but sanjoseca.gov returns 403 to
    // automated fetch, so the only retrievable dollar figures date to 2020-2023
    // schedules that escalate annually by a construction cost index. Publishing
    // those as current would repeat the stale-fee failure fixed in Denver.
    case 'sandiego': {
      // SDMC 142.1301 et seq: 10% of units at <=60% AMI for 55 years, triggered at
      // 10+ units citywide (5+ inside the Coastal Overlay Zone). The in-lieu fee is
      // $25.92/sq ft of net market-rate building area effective 7/1/2026 (CCI-
      // adjusted annually; was $25.00 eff. 7/1/2024). Informational: it is the
      // ALTERNATIVE to building the units, so billing it as a certainty would
      // overstate a project that simply includes the affordable units.
      // NOTE: San Diego also levies a commercial Housing Impact Fee (SDMC 98.0610,
      // ~1.5% of construction cost, CPI-adjusted). Its live Appendix A schedule
      // could not be retrieved, so no commercial rate is modelled here rather than
      // publishing figures traceable only to the 2013 nexus study.
      if (use !== 'residential' && use !== 'mixed') return null
      if ((units ?? 0) < 10) return null
      return {
        perSqFt: 25.92,
        applied: false,
        label: 'San Diego inclusionary in-lieu fee (10%+ affordable, or pay in lieu)',
      }
    }
    case 'seattle': {
      // MHA payment-in-lieu varies by fee area AND zone suffix (M / M1 / M2), so
      // there is no single per-area number — these are representative midpoints
      // across the M–M2 tiers. Informational only (applied:false): the trigger
      // (MHA zone) + build-affordable-units opt-out can't be resolved per parcel.
      // Source: SDCI MHA rate table (SMC 23.58B/23.58C), eff. 3/1/2026.
      const SEA: Record<string, { r: number; c: number }> = {
        'Low Areas': { r: 16, c: 11 },
        'Medium Areas': { r: 28, c: 15 },
        'High Areas': { r: 45, c: 19 },
        'Downtown / South Lake Union Areas': { r: 32, c: 22 },
      }
      // Milder than Denver — `applied: false` keeps every branch out of the
      // total — but the RATE is still a per-parcel claim. Measured 2026-08-12
      // with only the MHA layer faulted, on a Capitol Hill parcel the control
      // run resolved to "High Areas": the published line went from "roughly
      // $45/sq ft" to "roughly $28/sq ft", a 38% drop manufactured by a
      // timeout. The dollars are informational, but $28 is not less of an
      // assertion for being outside the total, so an unresolved lookup prints
      // the published spread instead of a point.
      if (feeArea.kind === 'unavailable') {
        return {
          perSqFt: null,
          applied: false,
          label:
            // The spread is the PUBLISHED one across areas and M/M1/M2 suffixes
            // (SDCI MHA rate table, eff. 3/1/2026 — the same source the
            // midpoints below come from), not the spread of our midpoints:
            // quoting our own four numbers would understate what is unknown.
            'Seattle MHA — the city’s MHA fee-area layer didn’t answer, so the per-area rate is unknown here (published range: residential $10.78–$50.46/sq ft, commercial $7.87–$32.66/sq ft)',
        }
      }
      // `none` — the layer answered and this parcel is in no MHA fee area —
      // keeps the Medium-tier midpoint it has always used. That default is a
      // separate (pre-existing) question about what to show a parcel outside
      // the MHA geography; it is not a failed read, and is left as found.
      const a = (feeArea.kind === 'area' && SEA[feeArea.area]) || { r: 28, c: 15 }
      return {
        perSqFt: use === 'residential' ? a.r : a.c,
        applied: false,
        label: `Seattle MHA${feeArea.kind === 'area' ? ` (${feeArea.area})` : ''} — applies in MHA zones, or build affordable units instead`,
      }
    }
    case 'sf': {
      // Jobs-Housing Linkage (flat citywide office fee), tiered by size. Rates per
      // the SF Citywide Development Impact Fee Register republished eff. 1/1/2026
      // (large-office tier itself dates to the 2021 schedule): office ≥ 50k gsf
      // $85.90/gsf; 25k–50k gsf $77.30; lab/retail lower. Informational only —
      // the per-parcel office-vs-lab-vs-retail split can't be detected.
      if (!commercial || gfa < 25000) return null
      const large = gfa >= 50000
      return {
        perSqFt: large ? 85.9 : 77.3,
        applied: false,
        label: `SF Jobs-Housing Linkage — office (${large ? '≥ 50k gsf' : '25–50k gsf'}; lab/retail lower)`,
      }
    }
    default:
      return null
  }
}

// Gross residential area per dwelling unit (incl. circulation/common area) —
// used to estimate how many units a buildable envelope implies.
//
// ⚠️ DEFECT 6 — HALF-SOURCED, AND THE SOURCED HALF LAUNDERS THE OTHER.
// The ~1,000 sf median multifamily NET unit is cited (Statista 2023). The
// ~75% net-to-gross efficiency that turns it into 1,300 is **asserted, with no
// source**, and 1300 is simply 1000 / 0.75 rounded. A citation on one input of
// a two-input derivation makes the whole composite read as sourced — see
// CLAUDE.md rule 3. Stated plainly here so the comment stops doing that.
//
// NOT DELETABLE — checked 2026-08-04 rather than assumed. It reaches:
//   • defaultSpec.units → impactFee(...)          → FEE DOLLARS
//   • envelope.maxUnits                            → published unit count
//   • analyze.ts demolitionSqFt (units × this)     → demolition cost
//   • feasibility.ts effectiveExUnits              → housing/affordability checks
//   • narrative.ts existing floor area
// Real net-to-gross varies with building form (double-loaded corridor vs point
// access block vs walk-up), so 0.75 may well be reasonable — which is exactly
// why it needs a source rather than a defence. Surfaced in the assumptions
// panel so a user can see the number that produced their unit count.
export const avgUnitGrossSqFt = 1300
