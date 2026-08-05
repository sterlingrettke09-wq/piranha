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
  gfaBasis?: 'envelope' | 'assumed-far-1.0'
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

export type HurdleStatus = 'required' | 'likely' | 'info'

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
       *  must not render them the same. Mirrors ParcelInfo['envelope']. */
      farBasis: 'residential' | 'mixed' | 'district' | 'unconstrained' | null
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
  reliefOdds?: { grantRate: number; n: number; window: string; vintage: string }
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
