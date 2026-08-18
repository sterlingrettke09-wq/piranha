import type { ParcelInfo } from './parcel'
export type Use = 'residential' | 'commercial' | 'mixed' | 'institutional'
export type ProjectType = 'new' | 'addition' | 'adu' | 'change_of_use'
export const PROJECT_TYPES: ProjectType[] = ['new', 'addition', 'adu', 'change_of_use']
export type Funding = 'private' | 'public'
export const FUNDING_TYPES: Funding[] = ['private', 'public']
export type CheckStatus = 'AS_OF_RIGHT' | 'NEEDS_RELIEF' | 'PROHIBITED' | 'INDETERMINATE'
export type ApprovalPath = 'as_of_right' | 'variance' | 'prohibited'

export interface AnalysisInput {
  parcelId: string
  city: string
  projectType: ProjectType
  /** Whether the project taps public money/land (triggers procurement, prevailing wage, etc.). */
  funding: Funding
  lat: number
  lng: number
  use: Use
  gfa: number
  /** Where `gfa` came from. 'envelope' = derived from a published zoning limit.
   *  'assumed-far-1.0' = NO floor-area limit was resolvable, so lot area was
   *  used as a stand-in — an unsourced assumption, not a code limit, and it
   *  must be disclosed wherever the resulting numbers are shown. Usually this
   *  means the city's FAR exists but isn't published in GIS (San Diego, San
   *  Jose, Nashville), not that the district is unconstrained. */
  /** 'assumed-unconstrained' = the code affirmatively imposes NO FAR, so lot
   *  area is a placeholder under a stated absence. 'assumed-far-1.0' = we could
   *  not resolve a FAR at all — a guess made in ignorance, and the state that
   *  should fail closed. Keeping these apart is the fail-closed audit's finding. */
  gfaBasis?:
    | 'envelope'
    | 'assumed-unconstrained'
    | 'assumed-planned-development'
    | 'assumed-basis-unavailable'
    | 'assumed-basis-elective'
    | 'assumed-far-1.0'
  units?: number
  stories?: number
  heightFt?: number
}

export interface FeasibilityCheck {
  dimension: 'use' | 'far' | 'height' | 'housing' | 'historic'
  status: CheckStatus
  proposed: string
  allowed: string
  note: string | null
}

/** `required` / `likely` / `info` are claims ABOUT THE PARCEL, of decreasing
 *  force. `unchecked` is not on that scale at all: it says a check we normally
 *  perform could not be performed on this request, so the rows below it are
 *  known-incomplete.
 *
 *  It exists because the alternative was silence. An optional overlay read
 *  returns `X | null`, and on the null the hurdle it would have produced simply
 *  did not appear — measured 2026-08-12 at the analyze handler with one layer
 *  faulted per run: LA's Coastal Development Permit row vanished and the
 *  estimate went 57 → 48 months (the permit's whole serial 9), and a Back Bay
 *  teardown went NEEDS_RELIEF 55 mo → AS_OF_RIGHT 51 mo when Boston's historic
 *  layer timed out. Both read exactly like a parcel that is genuinely clear.
 *
 *  ⚠️ AN `unchecked` ROW IS NOT AN APPROVAL, so it must not be counted as one.
 *  `KeyMetrics` and `Compare` both publish a hurdle COUNT, and folding these
 *  rows into it would make a city with a failed lookup appear to demand MORE
 *  approvals than the same city on a healthy run — a false claim in the
 *  opposite direction from the one being fixed. They mark the count as a floor
 *  instead. */
export type HurdleStatus = 'required' | 'likely' | 'info' | 'unchecked'

// A non-zoning regulatory hurdle — historic review, affordability mandates,
// environmental review, fees, private governance, etc.
export interface Hurdle {
  category:
    | 'historic'
    | 'affordability'
    | 'review'
    | 'environmental'
    | 'fees'
    | 'private'
    | 'flood'
    | 'labor'
    | 'parking'
    | 'demolition'
  label: string
  status: HurdleStatus
  note: string
  /** True when this process runs IN SERIES with the main entitlement (e.g. a
   *  Coastal Development Permit) — its months add in full instead of being
   *  folded into the nested max-plus-overlap combine in analyze.ts. */
  serial?: boolean
  /** Estimated months this hurdle adds to approval, if any. */
  addsMonths?: number
  /** Months this hurdle WOULD add if it turns out to apply — carried only on
   *  `status: 'unchecked'` rows, and deliberately NOT summed into the timeline.
   *
   *  The distinction is the point. `addsMonths` is time we are asserting the
   *  project will take; this is time we are declining to assert, because the
   *  layer that decides whether the requirement applies did not answer. Adding
   *  it would manufacture months for a rule that probably does not apply (most
   *  parcels are not historic and not coastal) — CLAUDE.md rule 1. Dropping it
   *  entirely would leave the reader with a bare number and no idea in which
   *  direction it is wrong, which is rule 7's failure.
   *
   *  So it does exactly one job: it lets the UI mark the timeline as a FLOOR,
   *  and lets the note name the size of what is missing. A row with no months
   *  attached (flood) correctly leaves the timeline unmarked. */
  excludedMonths?: number
  /** TRUE when this hurdle fires on a SIZE threshold (floor area or unit count).
   *  If the size itself was assumed because no FAR resolved, a 'required'
   *  status here would be a regulatory claim built on a placeholder — so those
   *  are downgraded to 'info' rather than asserted. */
  sizeDependent?: boolean
}

/** A soft, non-blocking flag for parcels that look like a stadium, arena,
 *  hospital, university, museum, or convention center — sites that are rarely
 *  open to private redevelopment. The analysis still runs; the UI shows a
 *  prominent warning above the report (the user can read on / "analyze anyway"). */
export type SiteAdvisoryCategory = 'venue' | 'hospital' | 'university' | 'museum' | 'transit' | 'civic'
export interface SiteAdvisory {
  category: SiteAdvisoryCategory
  /** Short noun phrase, e.g. "a stadium or arena". */
  label: string
  /** Full sentence shown in the warning banner. */
  note: string
}

export interface AnalysisResult {
  parcel: {
    address: string
    parcelId: string
    districtCode: string
    lotSqFt: number | null
    allowedUses: string[] | null
    maxFAR: number | null
    maxHeightFt: number | null
    floodZone: string | null
    historicDistrict: string | null
    /** Max by-right envelope (estimated), so Compare can show capacity even for
     *  height-governed cities where FAR is null. */
    envelope?: {
      maxFloorAreaSqFt: number | null
      maxHeightFt: number | null
      maxStories: number | null
      storiesBasis?: 'stated' | 'derived'
      maxUnits: number | null
      allowedUses: string[] | null
      /** 'unconstrained' = the code imposes no FAR here (an ANSWER); null = we
       *  could not resolve one (a GAP). Both carry a null floor area, so the UI
       *  must not render them the same.
       *
       *  ⚠️ DERIVED FROM ParcelInfo, NOT RESTATED. This used to be a second copy
       *  of that union with a comment saying it "mirrors" it — and a mirror is a
       *  claim, checked by nobody. Adding 'basis-elective' on 2026-08-18 updated
       *  one copy and the build broke only because `analyze.ts` assigns a
       *  ParcelInfo envelope straight into this shape; had the two been joined by
       *  anything looser, the new state would have been silently unrepresentable
       *  here while being set upstream. Same defect gfaBasis.ts was built to
       *  remove, one field over. */
      farBasis: NonNullable<ParcelInfo['envelope']>['farBasis']
      floorAreaFromAllowance?: boolean
      /** Other programs the code allows — alternatives to the headline, not a
       *  range around it. */
      alternatives?: Array<{ label: string; maxFloorAreaSqFt: number; source?: string }>
    }
    existing?: {
      landUse?: string | null
      yearBuilt?: number | null
      buildingAreaSqFt?: number | null
      units?: number | null
      stories?: number | null
      numBuildings?: number | null
      ownerPublic?: boolean
      /** County assessor's total/improvement value, in dollars — a coarse
       *  LAND-COST PROXY only; assessor values typically lag market prices
       *  substantially. Never used in the cost math. */
      assessedValue?: number | null
      /** Qualifier for what `assessedValue` measures (semantics differ by
       *  city); printed by the UI as the muted qualifier. */
      assessedValueBasis?: string | null
    }
  }
  project: AnalysisInput
  /** When false, the parcel isn't usable for analysis. 'public' = government/park/
   *  federal land you can't build on; 'no_coverage' = parcel found but no zoning
   *  (likely a neighboring city we don't cover). The UI shows the reason. */
  developable?: boolean
  developableNote?: string | null
  developableKind?: 'public' | 'no_coverage' | null
  /** Non-blocking "this looks like a stadium / hospital / campus" flag. */
  advisory?: SiteAdvisory | null
  feasibility: { overall: CheckStatus; checks: FeasibilityCheck[]; envelopeKnown?: boolean }
  /** Historical board grant rate for variance-type relief in this city —
   *  context, not a prediction for any specific project. Attached only when the
   *  verdict needs relief (feasibility.path === 'variance') and the city's
   *  offline relief pipeline produced a trustworthy figure; absent otherwise. */
  reliefOdds?: { grantRate: number; n: number; window: string; vintage: string; label?: string }
  hurdles: Hurdle[]
  costs: { hard: number; soft: number; permit: number; demolition: number; impact: number; total: number; currency: 'USD' }
  timeline: {
    months: number
    path: ApprovalPath
    tier?: 'single' | 'multi' | 'apartment'
    /** Empirical filing→issuance permit time from the city's open permit data,
     *  when available for new construction. A SUBSET of `months` (permit leg
     *  only), shown alongside the full-lifecycle estimate — never replaces it. */
    measured?: { medianMonths: number; p80Months: number; n: number; vintage: string }
    /** Present when the city publishes measured permit timing BY BUILDING SIZE
     *  and this project's size band was withheld from it (sample under the
     *  publication floor). `measured` is undefined in that case ON PURPOSE — the
     *  city-wide aggregate is a different population, not a weaker answer to the
     *  same question. Render it as "not measured for this size"; a blank reads as
     *  fast. `n` is null when the suppressed sample size was never recorded. */
    measuredTierWithheld?:
      | {
          tier: 'single' | 'multi' | 'apartment'
          /** The tier WAS counted; the count is too small to publish. */
          basis: 'thin-sample'
          n: number | null
          minPublishableN: number
        }
      | {
          tier: 'single' | 'multi' | 'apartment'
          /** The tier CANNOT be counted from the feed — no n, no floor. The
           *  copy for this arm must not mention either, and must not refer to a
           *  city-wide median, which a tier-only city does not have. */
          basis: 'unenumerable'
          reason: string
        }
  }
  narrative: string
  assumptions: Record<string, string>
  sources: Record<string, string>
  disclaimers: string[]
  generatedAt: string
}

export interface AnalysisError {
  code: 'BAD_INPUT' | 'NO_PARCEL' | 'OUT_OF_BBOX' | 'UPSTREAM_ERROR' | 'RATE_LIMITED' | 'INTERNAL'
  message: string
}

export const USES: Use[] = ['residential', 'commercial', 'mixed', 'institutional']
