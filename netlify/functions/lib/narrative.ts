import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, CheckStatus } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

const VERDICT_LEAD: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'appears buildable without special permission',
  NEEDS_RELIEF: 'would need the city’s permission',
  PROHIBITED: 'appears to be not allowed',
  INDETERMINATE: 'cannot be fully determined from available data',
}

interface NarrativeOpts {
  /** Full life-cycle months (design → move-in). Falls back to the cost estimate. */
  timelineMonths?: number
  /** Whether the life-cycle includes demolishing an existing building first. */
  includesDemolition?: boolean
  /** Whether FAR/height could be evaluated. When false, an as-of-right read is hedged. */
  envelopeKnown?: boolean
}

export function buildNarrative(
  parcel: ParcelInfo,
  project: AnalysisInput,
  f: Feasibility,
  c: CostEstimate,
  opts: NarrativeOpts = {},
): string {
  const hedged = f.overall === 'AS_OF_RIGHT' && opts.envelopeKnown === false
  const verdictLead = hedged
    ? 'fits the district’s allowed use, though public data has no FAR or height limit to check the size against'
    : VERDICT_LEAD[f.overall]
  const lead = `A ${project.gfa.toLocaleString()} sf ${project.use} project at ${parcel.address} (district ${parcel.zoning.districtCode}) ${verdictLead}.`

  const blockers = f.checks.filter((ch) => ch.status === 'NEEDS_RELIEF' || ch.status === 'PROHIBITED')
  const reason = blockers.length
    ? ` Constraints: ${blockers.map((b) => `${b.dimension} (${b.proposed} vs ${b.allowed})`).join('; ')}.`
    : ''

  const unknowns = f.checks.filter((ch) => ch.status === 'INDETERMINATE').map((ch) => ch.dimension)
  const caveat = unknowns.length
    ? ` The following could not be evaluated and are treated conservatively: ${unknowns.join(', ')}.`
    : ''

  const demoPart = c.costs.demolition > 0 ? `, demolition ${usd(c.costs.demolition)}` : ''
  const cost = ` Estimated cost is ${usd(c.costs.total)} (hard ${usd(c.costs.hard)}, soft ${usd(c.costs.soft)}, permitting ${usd(c.costs.permit)}${demoPart}).`

  // Flag the unusual case of razing a much larger existing building to build less.
  const existingSf = parcel.existing?.buildingAreaSqFt ?? 0
  const teardown =
    c.costs.demolition > 0 && existingSf > project.gfa * 1.5
      ? ` Note: this means demolishing the existing ${existingSf.toLocaleString()} sf building to build ${project.gfa.toLocaleString()} sf — far less than what stands there now.`
      : ''

  const months = opts.timelineMonths ?? c.timeline.months
  const path = c.timeline.path.replace(/_/g, '-')
  let timeline = ''
  if (months > 0) {
    const demo = opts.includesDemolition ? ', including demolishing the existing building first' : ''
    timeline = ` Plan on roughly ${months} months from design to move-in on the ${path} path${demo}.`
  }

  return lead + reason + caveat + cost + teardown + timeline
}
