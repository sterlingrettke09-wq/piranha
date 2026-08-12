import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { ParcelInfo } from '../../../src/types/parcel'
import { impactFee, feeAreaRead, MIXED_RESIDENTIAL_SHARE, constructionTax, CONSTRUCTION_TAX_MIN_VALUE } from '../../../src/config/estimates'
import {
  costPerSqFtByUse,
  cityCostIndex,
  heightCostFactor,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
  timelineMonthsByPath,
  ftPerStory,
  demoCostPerSqFt,
  projectFactor,
} from './assumptions'

export interface CostEstimate {
  costs: { hard: number; soft: number; permit: number; demolition: number; impact: number; total: number; currency: 'USD' }
  timeline: { months: number; path: Feasibility['path'] }
  /** A linkage/impact fee we can't bake in (uncheckable trigger) — surfaced as a note. */
  impactNote?: string
}

export interface CostOpts {
  /** Sq ft of existing building to demolish first. When > 0, a demolition cost
   *  is added — otherwise the quote silently ignores tearing down what's there. */
  demolitionSqFt?: number | null
  /** The parcel's overlays, NOT a bare fee-area string. Passing the overlays
   *  means the fee-area lookup arrives with its resolution state attached
   *  (`feeAreaRead`): a string alone cannot say whether "no area" means the
   *  layer answered or the layer failed, and Denver billed a $307,000-lighter
   *  total off exactly that ambiguity. */
  overlays?: ParcelInfo['overlays']
}

export function estimateCost(
  project: AnalysisInput,
  feasibility: Feasibility,
  opts: CostOpts = {},
): CostEstimate {
  const cityIdx = cityCostIndex[project.city] ?? 1.0
  // ceil, not round: a 53 ft commercial building IS a 5-story (concrete-tier)
  // building — rounding down let boundary heights land in the cheaper wood tier.
  const stories = project.stories ?? (project.heightFt != null ? Math.ceil(project.heightFt / ftPerStory(project.use)) : null)
  // Renovations / ADUs / changes-of-use cost less per sq ft than ground-up new
  // construction. Scale by the same project-scope factor the timeline uses, so
  // cost and schedule stay consistent. (new = 1.0.)
  const scope = projectFactor[project.projectType ?? 'new'] ?? 1
  const hard = Math.round(
    project.gfa * costPerSqFtByUse[project.use] * cityIdx * heightCostFactor(stories) * scope,
  )
  const soft = Math.round(hard * softCostPct)
  const demoSf = opts.demolitionSqFt ?? 0
  // Demo rate scales with size: small/residential teardowns run ~$10/sf; large
  // concrete/steel structures ~$18/sf (phased demo, hauling). Linearly
  // interpolated between 5k and 20k sf — the old step tiers made one square
  // foot at the 20k boundary worth $120,000.
  const demoRate =
    demoSf <= 0 ? demoCostPerSqFt
    : demoSf <= 5000 ? 10
    : demoSf >= 20000 ? 18
    : 10 + ((demoSf - 5000) / 15000) * 8
  const demolition = demoSf > 0 ? Math.round(demoSf * demoRate * cityIdx) : 0
  const constructionValue = hard
  let permit = Math.round(PERMIT_BASE_FEE + (constructionValue / 1000) * PERMIT_RATE_PER_1000)
  if (feasibility.path === 'variance') permit += VARIANCE_FILING_FEE
  // Affordable-housing / linkage fee. Baked into the total only when we can verify
  // the trigger (use + size); otherwise surfaced as an informational note.
  const fee = impactFee(
    project.city,
    project.use,
    project.gfa,
    project.units ?? null,
    opts.overlays ? feeAreaRead(opts.overlays) : undefined,
  )
  // Mixed-use projects trigger COMMERCIAL-class fees (linkage etc.), which
  // shouldn't bill the residential floors — apply them to the nonresidential
  // share of GFA only.
  const feeGfa = project.use === 'mixed' ? Math.round(project.gfa * (1 - MIXED_RESIDENTIAL_SHARE)) : project.gfa
  const linkage = fee && fee.applied ? Math.round(fee.perSqFt * feeGfa) : 0
  // Percentage-of-construction-cost development taxes (Philadelphia's 1%
  // Development Impact Tax) can't be expressed per sq ft, so they're computed
  // against construction value and added to the same impact line. For mixed-use
  // the tax is residential-only, so it applies to the residential share.
  const tax = constructionTax(project.city, project.use)
  const taxMin = CONSTRUCTION_TAX_MIN_VALUE[project.city] ?? 0
  const taxableValue = project.use === 'mixed' ? Math.round(hard * MIXED_RESIDENTIAL_SHARE) : hard
  const constructionTaxAmt =
    tax && taxableValue > taxMin ? Math.round(taxableValue * tax.pct) : 0
  const impact = linkage + constructionTaxAmt
  const notes: string[] = []
  // A fee whose RATE could not be resolved prints its label alone. Printing
  // "roughly $6.14/sq ft" beside a label that says the rate is unknown would
  // re-publish the guess the label just withdrew (CLAUDE.md rule 21).
  if (fee && !fee.applied) {
    notes.push(
      fee.perSqFt == null
        ? `${fee.label} — not included in the total above.`
        : `${fee.label}: roughly $${fee.perSqFt}/sq ft — not included in the total above.`,
    )
  }
  if (constructionTaxAmt > 0 && tax) notes.push(`Includes the ${tax.label}.`)
  const impactNote = notes.length > 0 ? notes.join(' ') : undefined
  const total = hard + soft + permit + demolition + impact
  return {
    costs: { hard, soft, permit, demolition, impact, total, currency: 'USD' },
    timeline: { months: timelineMonthsByPath[feasibility.path], path: feasibility.path },
    impactNote,
  }
}
