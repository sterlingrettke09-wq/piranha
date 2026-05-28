import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, CheckStatus } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

const VERDICT_LEAD: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'appears buildable as-of-right',
  NEEDS_RELIEF: 'would require zoning relief',
  PROHIBITED: 'appears to be prohibited',
  INDETERMINATE: 'cannot be fully determined from available data',
}

export function buildNarrative(parcel: ParcelInfo, project: AnalysisInput, f: Feasibility, c: CostEstimate): string {
  const lead = `A ${project.gfa.toLocaleString()} sf ${project.use} project at ${parcel.address} (district ${parcel.zoning.districtCode}) ${VERDICT_LEAD[f.overall]}.`

  const blockers = f.checks.filter((ch) => ch.status === 'NEEDS_RELIEF' || ch.status === 'PROHIBITED')
  const reason = blockers.length
    ? ` Constraints: ${blockers.map((b) => `${b.dimension} (${b.proposed} vs ${b.allowed})`).join('; ')}.`
    : ''

  const unknowns = f.checks.filter((ch) => ch.status === 'INDETERMINATE').map((ch) => ch.dimension)
  const caveat = unknowns.length
    ? ` The following could not be evaluated and are treated conservatively: ${unknowns.join(', ')}.`
    : ''

  const cost = ` Estimated cost is ${usd(c.costs.total)} (hard ${usd(c.costs.hard)}, soft ${usd(c.costs.soft)}, permitting ${usd(c.costs.permit)}), with an approval timeline of roughly ${c.timeline.months} months on the ${c.timeline.path.replace(/_/g, '-')} path.`

  return lead + reason + caveat + cost
}
