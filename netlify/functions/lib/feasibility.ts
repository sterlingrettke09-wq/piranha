import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, ApprovalPath, CheckStatus, FeasibilityCheck } from '../../../src/types/analysis'
import { resolveZoningLimits } from './zoningLimits'
import { FT_PER_STORY } from './assumptions'

const SEVERITY: Record<CheckStatus, number> = {
  AS_OF_RIGHT: 0,
  INDETERMINATE: 1,
  NEEDS_RELIEF: 2,
  PROHIBITED: 3,
}

export interface Feasibility {
  overall: CheckStatus
  checks: FeasibilityCheck[]
  path: ApprovalPath
}

export function assessFeasibility(parcel: ParcelInfo, project: AnalysisInput): Feasibility {
  const limits = resolveZoningLimits(parcel.zoning)
  const checks: FeasibilityCheck[] = []

  // USE
  if (!limits.allowedUses) {
    checks.push({ dimension: 'use', status: 'INDETERMINATE', proposed: project.use, allowed: 'not derivable', note: 'Allowed uses not derivable from available zoning data.' })
  } else if (limits.allowedUses.includes(project.use)) {
    checks.push({ dimension: 'use', status: 'AS_OF_RIGHT', proposed: project.use, allowed: limits.allowedUses.join(', '), note: null })
  } else {
    checks.push({ dimension: 'use', status: 'NEEDS_RELIEF', proposed: project.use, allowed: limits.allowedUses.join(', '), note: 'Proposed use is not listed for this district; a use variance would be required.' })
  }

  // FAR
  if (limits.maxFAR == null || parcel.lot.sizeSqFt == null) {
    checks.push({ dimension: 'far', status: 'INDETERMINATE', proposed: `${project.gfa.toLocaleString()} sf`, allowed: 'not derivable', note: 'FAR cannot be evaluated without lot size and a district FAR limit.' })
  } else {
    const proposedFAR = project.gfa / parcel.lot.sizeSqFt
    const status: CheckStatus = proposedFAR <= limits.maxFAR ? 'AS_OF_RIGHT' : 'NEEDS_RELIEF'
    checks.push({ dimension: 'far', status, proposed: `FAR ${proposedFAR.toFixed(2)}`, allowed: `max FAR ${limits.maxFAR.toFixed(2)}`, note: status === 'NEEDS_RELIEF' ? 'Proposed floor area exceeds the district FAR; dimensional relief would be required.' : null })
  }

  // HEIGHT
  const effHeight = project.heightFt ?? (project.stories != null ? project.stories * FT_PER_STORY : null)
  if (limits.maxHeightFt == null || effHeight == null) {
    checks.push({ dimension: 'height', status: 'INDETERMINATE', proposed: effHeight != null ? `${effHeight} ft` : 'unspecified', allowed: limits.maxHeightFt != null ? `max ${limits.maxHeightFt} ft` : 'not derivable', note: 'Height cannot be evaluated without both a proposed height and a district height limit.' })
  } else {
    const status: CheckStatus = effHeight <= limits.maxHeightFt ? 'AS_OF_RIGHT' : 'NEEDS_RELIEF'
    checks.push({ dimension: 'height', status, proposed: `${effHeight} ft`, allowed: `max ${limits.maxHeightFt} ft`, note: status === 'NEEDS_RELIEF' ? 'Proposed height exceeds the district limit; dimensional relief would be required.' : null })
  }

  const overall = checks.reduce<CheckStatus>(
    (worst, c) => (SEVERITY[c.status] > SEVERITY[worst] ? c.status : worst),
    'AS_OF_RIGHT',
  )
  const path: ApprovalPath = overall === 'PROHIBITED' ? 'prohibited' : overall === 'NEEDS_RELIEF' ? 'variance' : 'as_of_right'
  return { overall, checks, path }
}
