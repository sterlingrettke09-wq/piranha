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

// A dimensional variance can bridge a modest overage of a zoning limit. Beyond
// this multiple it's not realistically grantable as relief — it would take a
// rezoning or special district — so we call it prohibited rather than feed a
// false "buildable with relief" verdict.
const RELIEF_FACTOR = 1.5

// Classify a proposed value against a limit: within → as-of-right, modestly over
// → relief, grossly over → prohibited.
function classifyOverage(proposed: number, limit: number): CheckStatus {
  if (proposed <= limit) return 'AS_OF_RIGHT'
  if (proposed <= limit * RELIEF_FACTOR) return 'NEEDS_RELIEF'
  return 'PROHIBITED'
}

export interface Feasibility {
  overall: CheckStatus
  checks: FeasibilityCheck[]
  path: ApprovalPath
  // True when at least one of FAR/height was decidable. When false, an
  // "as-of-right" verdict reflects use only and shouldn't be stated with full
  // confidence (the size/bulk envelope is unknown for this city's data).
  envelopeKnown?: boolean
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

  // FAR — prefer a use-specific limit (e.g. NYC Resid/Comm/Facil FAR) when present.
  const farForUse = parcel.zoning.farByUse?.[project.use] ?? limits.maxFAR
  if (farForUse == null || parcel.lot.sizeSqFt == null) {
    checks.push({ dimension: 'far', status: 'INDETERMINATE', proposed: `${project.gfa.toLocaleString()} sf`, allowed: 'not derivable', note: 'FAR cannot be evaluated without lot size and a district FAR limit.' })
  } else {
    const proposedFAR = project.gfa / parcel.lot.sizeSqFt
    const status = classifyOverage(proposedFAR, farForUse)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed floor area exceeds the district FAR; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed floor area is ${(proposedFAR / farForUse).toFixed(1)}× the district FAR — far beyond what a variance can grant. On this lot it would require a rezoning or special district, so it isn't buildable as proposed.`
          : null
    checks.push({ dimension: 'far', status, proposed: `FAR ${proposedFAR.toFixed(2)}`, allowed: `max FAR ${farForUse.toFixed(2)}`, note })
  }

  // HEIGHT
  const effHeight = project.heightFt ?? (project.stories != null ? project.stories * FT_PER_STORY : null)
  if (limits.maxHeightFt == null || effHeight == null) {
    checks.push({ dimension: 'height', status: 'INDETERMINATE', proposed: effHeight != null ? `${effHeight} ft` : 'unspecified', allowed: limits.maxHeightFt != null ? `max ${limits.maxHeightFt} ft` : 'not derivable', note: 'Height cannot be evaluated without both a proposed height and a district height limit.' })
  } else {
    const status = classifyOverage(effHeight, limits.maxHeightFt)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed height exceeds the district limit; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed height is ${(effHeight / limits.maxHeightFt).toFixed(1)}× the district limit — well past what a variance grants; it would require a rezoning, so it isn't buildable as proposed.`
          : null
    checks.push({ dimension: 'height', status, proposed: `${effHeight} ft`, allowed: `max ${limits.maxHeightFt} ft`, note })
  }

  // HOUSING — demolishing existing homes to build fewer is not an as-of-right
  // teardown. No-net-loss rules, rent regulation, and tenant protections make
  // shrinking the housing on a lot a major discretionary action, and often a
  // non-starter when an established multifamily building is involved.
  const ex = parcel.existing
  const exUnits = ex?.units ?? 0
  const exLu = ex?.landUse ?? ''
  const multifamilyExisting =
    exUnits >= 3 || /apartment|condo|multi|triplex|fourplex|elevator|tenement|flats|housing/i.test(exLu)
  const proposedResUnits =
    project.use === 'residential' || project.use === 'mixed' ? (project.units ?? 1) : 0
  if (
    project.projectType === 'new' &&
    multifamilyExisting &&
    exUnits > 0 &&
    proposedResUnits < exUnits
  ) {
    // Severe: tearing down an apartment-scale building, or collapsing a sizable
    // building down to a single home. Smaller reductions are "needs relief".
    const severe = exUnits >= 10 || (exUnits >= 5 && proposedResUnits <= 1)
    const status: CheckStatus = severe ? 'PROHIBITED' : 'NEEDS_RELIEF'
    const note = severe
      ? `This parcel holds roughly ${exUnits} homes. Tearing down established multifamily housing to build ${proposedResUnits || 'no'} ${proposedResUnits === 1 ? 'unit' : 'units'} is a large net loss of housing. No-net-loss rules, rent regulation, and tenant protections generally bar this outright, so it is not buildable as proposed.`
      : `Replacing ${exUnits} existing homes with ${proposedResUnits} reduces the housing on this lot. Cities with no-net-loss rules require discretionary approval for this, and it may not be granted.`
    checks.push({
      dimension: 'housing',
      status,
      proposed: `${proposedResUnits} ${proposedResUnits === 1 ? 'unit' : 'units'}`,
      allowed: `${exUnits} existing`,
      note,
    })
  }

  // Overall reflects the worst DECISIVE check. A single indeterminate dimension
  // (e.g. NYC height, which public data doesn't carry) shouldn't drag an
  // otherwise-clear verdict to "indeterminate" — it still shows in the checklist.
  // Only when no dimension is decisive does the verdict become indeterminate.
  const decisive = checks.filter((c) => c.status !== 'INDETERMINATE')
  const overall: CheckStatus =
    decisive.length === 0
      ? 'INDETERMINATE'
      : decisive.reduce<CheckStatus>(
          (worst, c) => (SEVERITY[c.status] > SEVERITY[worst] ? c.status : worst),
          'AS_OF_RIGHT',
        )
  const path: ApprovalPath = overall === 'PROHIBITED' ? 'prohibited' : overall === 'NEEDS_RELIEF' ? 'variance' : 'as_of_right'
  const envelopeKnown = checks.some(
    (c) => (c.dimension === 'far' || c.dimension === 'height') && c.status !== 'INDETERMINATE',
  )
  return { overall, checks, path, envelopeKnown }
}
