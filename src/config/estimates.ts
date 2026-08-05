// Single source of truth for the estimate constants used by BOTH the analysis
// engine (netlify/functions) and the public Methodology page (/math). Keeping
// them here means the published tables can never drift from what the engine
// actually computes. All figures are labeled estimates, meant to be tuned.
import type { ProjectType, Use } from '../types/analysis'

// BUMP THIS whenever any constant in this file (or the cost/timeline logic
// that consumes it) changes. It's appended to /api/analyze URLs as a cache
// key, so tuned numbers propagate immediately instead of serving stale cached
// verdicts for up to 24h (+7d stale-while-revalidate).
export const ESTIMATES_VERSION = 8

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
// Source: RSMeans 2026 building models — apartment 4–7 story ≈ $340/sf, office
// 5–10 story ≈ $390/sf. NOTE: "institutional" reflects schools/civic (~$450);
// hospitals run far higher (~$700–975/sf), a known limitation of one bucket.
export const costPerSqFtByUse: Record<Use, number> = {
  residential: 340, // RSMeans 2026 mid-rise multifamily, national avg
  commercial: 390, // RSMeans 2026 office 5–10 story, national avg
  mixed: 365, // blend of residential + ground-floor commercial
  institutional: 450, // schools/civic; healthcare is materially higher
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
// WATCH: city names collide across states in this table (Miami OK 743 = 80.3,
// Columbus GA 318-319 = 86.4, Columbus IN 472 = 89.1). Always match on the ZIP
// group, never the name alone.
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
  dc: 0.95, // 200-205 = ~95 — low construction labor; land is the real cost
  denver: 0.91, // 802-803 = 91.5
  nashville: 0.89, // 370-372 = 89.0
  miami: 0.85, // 330-332,340 = 85.1 (NOT Miami OK 743 = 80.3)
  austin: 0.83, // 786-787 = 82.9
}

// High-rise construction costs more per sq ft (structure, elevators, life-safety),
// but the premium plateaus rather than compounds. Source: RSMeans 2026 by-height
// models — the big step is the wood→concrete jump at 4→5 stories; towers amortize
// cores/elevators over more floor area, so the top tier is ~+45%, not +60%.
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
  // Sources: Philadelphia L&I permit timelines; Census SOC 2024 Northeast
  // (single-family 13.5 mo authorization->completion, multifamily 23.4 mo).
  // NOTE: the multi (2-4) figure is interpolated between Chicago/DC 26 and the
  // single-family floor — no Philadelphia-specific 2-4 unit duration is published.
  philadelphia: { single: 16, multi: 25, apartment: 40 },
  dc: { single: 16, multi: 26, apartment: 40 },
  // Miami: fastest-in-nation Southern construction (Census SOC 2024 South
  // single-family 8.1 mo start->completion) offset by genuinely slow City of
  // Miami permitting (reported waits up to 18 months for affordable housing;
  // the mayor took office on a permitting-reform platform) plus High-Velocity
  // Hurricane Zone engineering (175+ mph design, Miami-Dade NOA product
  // approvals, PE-stamped drawings). Nets out to the Boston/Seattle/LA tier.
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
export interface ImpactFee {
  perSqFt: number
  applied: boolean
  label: string
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
export function impactFee(city: string, use: Use, gfa: number, units: number | null, feeArea?: string): ImpactFee | null {
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
      const rate = feeArea === 'High' ? 9.21 : 6.14
      return { perSqFt: rate, applied: true, label: `Denver affordable-housing fee (${feeArea ?? 'Typical'} market)` }
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
      const a = (feeArea && SEA[feeArea]) || { r: 28, c: 15 }
      return {
        perSqFt: use === 'residential' ? a.r : a.c,
        applied: false,
        label: `Seattle MHA${feeArea ? ` (${feeArea})` : ''} — applies in MHA zones, or build affordable units instead`,
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
