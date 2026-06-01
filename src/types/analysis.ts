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
  units?: number
  stories?: number
  heightFt?: number
}

export interface FeasibilityCheck {
  dimension: 'use' | 'far' | 'height' | 'housing'
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
  /** Estimated months this hurdle adds to approval, if any. */
  addsMonths?: number
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
      maxUnits: number | null
      allowedUses: string[] | null
    }
    existing?: {
      landUse?: string | null
      yearBuilt?: number | null
      buildingAreaSqFt?: number | null
      units?: number | null
      stories?: number | null
      numBuildings?: number | null
    }
  }
  project: AnalysisInput
  /** When false, the parcel isn't usable for analysis. 'public' = government/park/
   *  federal land you can't build on; 'no_coverage' = parcel found but no zoning
   *  (likely a neighboring city we don't cover). The UI shows the reason. */
  developable?: boolean
  developableNote?: string | null
  developableKind?: 'public' | 'no_coverage' | null
  feasibility: { overall: CheckStatus; checks: FeasibilityCheck[]; envelopeKnown?: boolean }
  hurdles: Hurdle[]
  costs: { hard: number; soft: number; permit: number; demolition: number; total: number; currency: 'USD' }
  timeline: { months: number; path: ApprovalPath; tier?: 'single' | 'multi' | 'apartment' }
  narrative: string
  assumptions: Record<string, string>
  sources: Record<string, string>
  disclaimers: string[]
  generatedAt: string
}

export interface AnalysisError {
  code: 'BAD_INPUT' | 'NO_PARCEL' | 'OUT_OF_BBOX' | 'UPSTREAM_ERROR' | 'INTERNAL'
  message: string
}

export const USES: Use[] = ['residential', 'commercial', 'mixed', 'institutional']
