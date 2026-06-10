// Single source of truth for the estimate constants used by BOTH the analysis
// engine (netlify/functions) and the public Methodology page (/math). Keeping
// them here means the published tables can never drift from what the engine
// actually computes. All figures are labeled estimates, meant to be tuned.
import type { ProjectType, Use } from '../types/analysis'

// BUMP THIS whenever any constant in this file (or the cost/timeline logic
// that consumes it) changes. It's appended to /api/analyze URLs as a cache
// key, so tuned numbers propagate immediately instead of serving stale cached
// verdicts for up to 24h (+7d stale-while-revalidate).
export const ESTIMATES_VERSION = 4

// Human-readable vintage of the cost tables, surfaced on the result page so the
// data provenance can't silently drift from the figures above. Sourced from the
// comments on costPerSqFtByUse (RSMeans 2026 building models) and cityCostIndex
// (RSMeans City Cost Index, 2021 location factors).
export const COST_DATA_VINTAGE = 'RSMeans 2026 base rates · 2021 city cost indices'

export type BuildingTier = 'single' | 'multi' | 'apartment'

// ---- Construction cost ----
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
// Source: RSMeans City Cost Index, 2021 location factors.
export const cityCostIndex: Record<string, number> = {
  nyc: 1.34, // Manhattan ~138; outer boroughs ~131
  sf: 1.3, // 129.8
  chicago: 1.2, // 119.5 — unionized trades
  boston: 1.14, // 114.3
  la: 1.12, // 111.8
  minneapolis: 1.07, // 107.0
  seattle: 1.07, // 106.7
  dc: 0.95, // ~95 — low construction labor; land is the real cost
  denver: 0.91, // 91.5
  austin: 0.83, // 82.9
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
// Floor-to-floor height (ft), incl. structure. 11 ft is the residential standard
// (9–11 ft typical); commercial/office runs ~13 ft. FT_PER_STORY is the residential
// default (used for the use-agnostic envelope); ftPerStory(use) is use-aware for
// cost/feasibility. Source: CRE floor-to-floor design standards (AdventuresinCRE).
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
  dc: { single: 16, multi: 26, apartment: 40 },
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
// Sources (re-verified 2026-06-10 against primary fee schedules):
//   • Boston BPDA development linkage — $23.09/sf other-commercial ≥50k sf
//     (2023 ordinance, phased; lab $30.78). VERIFIED.
//   • LA City Planning AHLF "Updated Fee Schedule Effective July 1, 2025"
//     (Table per LAMC §19.18; CPI-adjusted each 7/1). Tiers Low/Medium/Medium-
//     High/High: residential 6+ units $10.32/$12.90/$15.47/$23.20; nonresidential
//     $3.86/$5.16/n-a/$6.44. We bill the MEDIUM tier below.
//   • Denver CPD Affordable Housing (Linkage) Fee schedule, current 7/1/2025
//     column: ≤9-unit residential ≤1,600 sf/unit $5.00/sf; commercial typical
//     $6.00, high $9.00. VERIFIED exact.
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
      // Residential <10 units is citywide-uniform ($5/sf, ≤1,600 sf/unit); 10+
      // units fall under the inclusionary build mandate (no fee). Commercial
      // varies by EHA market area: High $9, Typical $6 — now parcel-exact.
      if (use === 'residential') {
        // Unit count unknown: we can't tell the <10-unit fee tier from the 10+
        // inclusionary-mandate tier — surface as informational, don't guess.
        if (units == null)
          return { perSqFt: 5, applied: false, label: 'Denver affordable-housing fee — unit count needed to determine the tier' }
        return units >= 10 ? null : { perSqFt: 5, applied: true, label: 'Denver affordable-housing fee' }
      }
      if (!commercial) return null
      const rate = feeArea === 'High' ? 9 : 6
      return { perSqFt: rate, applied: true, label: `Denver affordable-housing fee (${feeArea ?? 'Typical'} market)` }
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
// used to estimate how many units a buildable envelope implies. The median
// multifamily NET unit is ~1,000 sf (Statista 2023); at ~75% net-to-gross
// efficiency that grosses up to ~1,300 sf/unit.
export const avgUnitGrossSqFt = 1300
