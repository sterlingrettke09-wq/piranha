export type Use = 'residential' | 'commercial' | 'mixed' | 'institutional'
export type CheckStatus = 'AS_OF_RIGHT' | 'NEEDS_RELIEF' | 'PROHIBITED' | 'INDETERMINATE'
export type ApprovalPath = 'as_of_right' | 'variance' | 'prohibited'

export interface AnalysisInput {
  parcelId: string
  city: string
  lat: number
  lng: number
  use: Use
  gfa: number
  units?: number
  stories?: number
  heightFt?: number
}

export interface FeasibilityCheck {
  dimension: 'use' | 'far' | 'height'
  status: CheckStatus
  proposed: string
  allowed: string
  note: string | null
}

export interface AnalysisResult {
  parcel: { address: string; parcelId: string; districtCode: string }
  project: AnalysisInput
  feasibility: { overall: CheckStatus; checks: FeasibilityCheck[] }
  costs: { hard: number; soft: number; permit: number; total: number; currency: 'USD' }
  timeline: { months: number; path: ApprovalPath }
  narrative: string
  assumptions: Record<string, string>
  disclaimers: string[]
  generatedAt: string
}

export interface AnalysisError {
  code: 'BAD_INPUT' | 'NO_PARCEL' | 'OUT_OF_BBOX' | 'UPSTREAM_ERROR' | 'INTERNAL'
  message: string
}

export const USES: Use[] = ['residential', 'commercial', 'mixed', 'institutional']
