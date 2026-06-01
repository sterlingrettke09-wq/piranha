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

  // Demolition honesty. Prefer recorded building area, else estimate from units.
  const existingSf = parcel.existing?.buildingAreaSqFt ?? (parcel.existing?.units ?? 0) * 1000
  let demoNote = ''
  if (project.projectType === 'new') {
    if (c.costs.demolition > 0 && existingSf > project.gfa * 1.5) {
      demoNote = ` Note: this means demolishing the existing ${existingSf.toLocaleString()} sf building to build ${project.gfa.toLocaleString()} sf — far less than what stands there now.`
    } else if (opts.includesDemolition && c.costs.demolition === 0) {
      // We know a building must come down but can't size it from public data.
      demoNote = ` An existing building must be demolished first; its floor area isn’t in this city’s public data, so demolition cost and time are not included above — budget for them separately.`
    } else if (parcel.existing === undefined) {
      // This city's data carries no existing-structure info at all.
      demoNote = ` This assumes a cleared site; if a building currently stands here, add demolition cost and time.`
    }
  }

  const months = opts.timelineMonths ?? c.timeline.months
  let timeline = ''
  if (months > 0) {
    const demo = c.costs.demolition > 0 ? ', including demolishing the existing building first' : ''
    if (f.overall === 'INDETERMINATE') {
      timeline = ` If it can be permitted, plan on roughly ${months} months from design to move-in${demo}.`
    } else {
      const phrase =
        c.timeline.path === 'variance'
          ? ' through the city’s special-approval process'
          : c.timeline.path === 'as_of_right'
            ? ' on the standard permit path'
            : ''
      timeline = ` Plan on roughly ${months} months from design to move-in${phrase}${demo}.`
    }
  }

  return lead + reason + caveat + cost + demoNote + timeline
}
