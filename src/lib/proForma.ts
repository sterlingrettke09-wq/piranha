// PRO FORMA, REVENUE-FREE — the cost side of a deal, and nothing more.
//
// ── WHAT IS DELIBERATELY MISSING, AND WHY IT IS NOT A SMALLER PRO FORMA ─────
//
// No rents. No sale prices. No cap rate. No yield, no IRR, no residual land
// value, no "is this deal good".
//
// That is not a phase-one simplification — it is the only honest version
// available. This repo carries no revenue data at any granularity, and rents do
// not exist as an open per-parcel dataset the way NAHB's construction costs or a
// city's permit feed do. A pro forma missing those two inputs is not a partial
// pro forma; it is one where the two numbers that DETERMINE the answer would
// have to be invented, and an invented cap rate wearing a computed IRR is
// exactly what CLAUDE.md rule 4 exists to stop. The return would look sourced
// because everything around it is.
//
// So the revenue side is a STATED BLANK: the fields are named, the arithmetic
// that would use them is described, and the user fills them in themselves.
//
// ── CARRY COST IS THE ONE FINANCING NUMBER, AND THE USER SUPPLIES THE RATE ──
//
// Months × rate × loan. It is what connects the timeline leg to dollars, and it
// is computable here precisely BECAUSE the two things this repo cannot source —
// the rate and the loan — come from the caller rather than from a table.
//
// ⚠️ AND IT IS REPORTED AS A RANGE, NOT A FIGURE. A construction loan draws down
// over the build; the balance is not outstanding in full from day one. Two
// conventions bracket it:
//
//   full balance     principal × rate × months/12   — the whole loan, the whole
//                                                     time. An upper bound.
//   average balance  half of that                   — a linear draw, the common
//                                                     convention.
//
// Picking one silently would be inventing a drawdown schedule, which is a real
// modelling assumption with a 2x spread. Both endpoints are returned, each
// labelled with the assumption that produces it, and neither is called "the"
// carry cost.

// ⚠️ A STRUCTURAL INPUT, NOT `CostEstimate`, and the direction of the import is
// the reason. This file lives in `src/` so the client can build a pro forma from
// an analysis it already has — no second round trip, no endpoint, because the
// arithmetic needs nothing but numbers. `netlify/` imports from `src/`, never the
// reverse, so naming the server's type here would invert that.
//
// Both `CostEstimate` and `AnalysisResult` satisfy this shape, so either can be
// passed directly and TypeScript checks the fit.
export interface CostSide {
  costs: {
    hard: number | null
    soft: number | null
    permit: number | null
    demolition: number
    impact: number | null
    total: number | null
  }
  timeline: { months: number }
}

export interface ProFormaInputs {
  /** Annual interest rate as a percentage, e.g. 8.5. From the caller — this repo
   *  sources no rate and must not default one. */
  annualRatePct: number | null
  /** The loan principal in dollars. From the caller for the same reason: a
   *  loan-to-cost ratio is a financing assumption, not a fact about the parcel. */
  loanAmount: number | null
  /** Optional: land/acquisition price, which the tool never knows. Included in
   *  total development cost when given, and named as absent when not. */
  landCost?: number | null
}

export interface CarryCost {
  months: number
  annualRatePct: number
  loanAmount: number
  /** Whole loan outstanding for the whole period. The upper bound. */
  fullBalance: number
  /** Linear draw — half the full-balance figure. The common convention. */
  averageBalance: number
}

export type CarryUnavailable = {
  /** Which inputs were missing. Named individually so the UI can ask for exactly
   *  what it needs rather than saying "incomplete". */
  missing: Array<'annualRatePct' | 'loanAmount' | 'months'>
  detail: string
}

export interface ProForma {
  /** Straight from `estimateCost` — never recomputed. A second derivation of the
   *  same number is a second chance for the two to disagree. */
  development: {
    hard: number | null
    soft: number | null
    permit: number | null
    demolition: number
    impact: number | null
    /** Construction-side total, as the cost engine reports it. EXCLUDES land and
     *  carry — both are named separately below rather than folded in, because a
     *  single "total" that silently includes an assumption is unauditable. */
    constructionTotal: number | null
  }
  land: { amount: number | null; note: string }
  carry: CarryCost | CarryUnavailable
  /** Construction + land + carry. Null when any component is null — a total that
   *  quietly drops a missing addend is worse than no total (`?? 0` is how a
   *  missing figure becomes free). Two values, because carry is a range. */
  totalDevelopmentCost: { low: number | null; high: number | null }
  /** Per-unit and per-sq-ft, on the SAME range. Null where the total is. */
  perUnit: { low: number | null; high: number | null; units: number | null }
  perSqFt: { low: number | null; high: number | null; gfa: number }
  /** ⚠️ The revenue side, as a stated blank. Never computed, never estimated. */
  revenue: {
    status: 'not-modelled'
    detail: string
    /** What the user would have to supply, and what each would produce. Listed
     *  so the omission is legible as a decision rather than an oversight. */
    needs: Array<{ field: string; unlocks: string }>
  }
}

export const REVENUE_NEEDS: ProForma['revenue']['needs'] = [
  { field: 'Rent per sq ft per month, or sale price per unit', unlocks: 'gross revenue' },
  { field: 'Vacancy and operating expense assumptions', unlocks: 'net operating income' },
  { field: 'Exit cap rate', unlocks: 'stabilised value, yield-on-cost and residual land value' },
]

/** ⚠️ NO `?? 0` ANYWHERE IN THIS FUNCTION. A null addend means the total cannot
 *  be produced, and defaulting it to zero renders a missing figure as free —
 *  the exact failure the cost engine was rewritten to avoid. */
function sumOrNull(parts: Array<number | null>): number | null {
  return parts.some((p) => p == null) ? null : (parts as number[]).reduce((a, b) => a + b, 0)
}

export function carryCost(
  months: number,
  inputs: Pick<ProFormaInputs, 'annualRatePct' | 'loanAmount'>,
): CarryCost | CarryUnavailable {
  const missing: CarryUnavailable['missing'] = []
  if (inputs.annualRatePct == null || !Number.isFinite(inputs.annualRatePct) || inputs.annualRatePct < 0) {
    missing.push('annualRatePct')
  }
  if (inputs.loanAmount == null || !Number.isFinite(inputs.loanAmount) || inputs.loanAmount <= 0) {
    missing.push('loanAmount')
  }
  if (!Number.isFinite(months) || months <= 0) missing.push('months')
  if (missing.length) {
    // ⚠️ NAME WHAT IS ACTUALLY MISSING. The `missing` array was already precise
    // and this sentence was not: with a rate supplied and no loan it still read
    // "needs an interest rate and a loan amount", sending the reader back to a
    // field they had already filled. The structured state and the prose have to
    // agree, or the prose is the one people act on.
    const LABEL = {
      annualRatePct: 'an interest rate',
      loanAmount: 'a loan amount',
      months: 'a timeline in months',
    } as const
    const names = missing.map((m) => LABEL[m])
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const why = missing.includes('months')
      ? ''
      : ' We do not supply either — a rate is a market fact this tool does not carry, and a loan-to-cost ratio is a financing decision, not a fact about the parcel.'
    return { missing, detail: `Carry cost needs ${list} from you.${why}` }
  }
  const rate = inputs.annualRatePct as number
  const principal = inputs.loanAmount as number
  const full = principal * (rate / 100) * (months / 12)
  return {
    months,
    annualRatePct: rate,
    loanAmount: principal,
    fullBalance: Math.round(full),
    // Half, and it is a NAMED convention rather than a fudge: a linear draw over
    // the period leaves an average balance of half the principal. Reported
    // alongside the full-balance figure so neither is presented as the answer.
    averageBalance: Math.round(full / 2),
  }
}

export interface ProFormaOpts {
  /** Unit count, for per-unit figures. Null when the project states none — and
   *  then per-unit is null rather than dividing by one. */
  units: number | null
  gfaSqFt: number
}

export function buildProForma(
  estimate: CostSide,
  opts: ProFormaOpts,
  inputs: ProFormaInputs,
): ProForma {
  const c = estimate.costs
  const carry = carryCost(estimate.timeline.months, inputs)
  const land = inputs.landCost ?? null

  const carryLow = 'averageBalance' in carry ? carry.averageBalance : null
  const carryHigh = 'fullBalance' in carry ? carry.fullBalance : null

  const low = sumOrNull([c.total, land, carryLow])
  const high = sumOrNull([c.total, land, carryHigh])

  const per = (v: number | null, d: number | null): number | null =>
    v == null || d == null || d <= 0 ? null : Math.round(v / d)

  return {
    development: {
      hard: c.hard,
      soft: c.soft,
      permit: c.permit,
      demolition: c.demolition,
      impact: c.impact,
      constructionTotal: c.total,
    },
    land: {
      amount: land,
      note:
        land == null
          ? 'Land is not included. This tool does not know what you paid or would pay for this parcel, and an assessed value is not a price.'
          : 'Land is the figure you supplied, not a valuation by this tool.',
    },
    carry,
    totalDevelopmentCost: { low, high },
    perUnit: { low: per(low, opts.units), high: per(high, opts.units), units: opts.units },
    perSqFt: { low: per(low, opts.gfaSqFt), high: per(high, opts.gfaSqFt), gfa: opts.gfaSqFt },
    revenue: {
      status: 'not-modelled',
      detail:
        'There is no revenue side here, and that is deliberate rather than unfinished. This tool carries no rents, sale prices or cap rates — they are not published per parcel the way zoning and construction costs are — and inventing them would produce a return figure that looks sourced because everything around it is.',
      needs: REVENUE_NEEDS,
    },
  }
}

/** One line, and it says what the number does NOT include. A "total development
 *  cost" that silently omits land reads as complete. */
export function summariseProForma(p: ProForma): string {
  if (p.totalDevelopmentCost.low == null) {
    const why: string[] = []
    if (p.development.constructionTotal == null) why.push('construction cost could not be priced for this product')
    if ('missing' in p.carry) why.push(p.carry.detail.replace(/^Carry cost needs /, 'carry needs ').replace(/\..*$/, ''))
    if (p.land.amount == null) why.push('land is not included')
    return `No total yet — ${why.join('; ')}.`
  }
  const { low, high } = p.totalDevelopmentCost
  const range =
    low === high ? `$${low.toLocaleString()}` : `$${low.toLocaleString()}–$${(high as number).toLocaleString()}`
  const spread = 'months' in p.carry ? ' The range is the drawdown assumption, not a cost uncertainty.' : ''
  const noLand = p.land.amount == null ? ' Land is not included.' : ''
  return `${range} of development cost, before any revenue.${spread}${noLand}`
}
