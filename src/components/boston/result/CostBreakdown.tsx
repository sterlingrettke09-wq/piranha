import type { AnalysisResult } from '../../../types/analysis'
import { formatEstimate } from '../../../lib/format'

// The cost model is order-of-magnitude, so every figure renders at 3 sig figs
// with a magnitude suffix ($4.18M / $425k / $425/sq ft) rather than to the dollar.
const usd = (n: number): string => formatEstimate(n)

interface Props {
  costs: AnalysisResult['costs']
  gfa: number
  units?: number
  /** A teardown is required but its floor area isn't in the city's data, so the
   *  demolition cost couldn't be sized — show "not estimated" rather than omit it. */
  demolitionRequired?: boolean
}

export function CostBreakdown({ costs, gfa, units, demolitionRequired }: Props) {
  const rows: { label: string; value: number | null }[] = [
    ...(costs.demolition > 0
      ? [{ label: 'Demolish existing building', value: costs.demolition }]
      : demolitionRequired
        ? [{ label: 'Demolish existing building', value: null }] // required, not sized
        : []),
    { label: 'Construction (hard)', value: costs.hard },
    { label: 'Soft costs', value: costs.soft },
    { label: 'Permitting & approvals', value: costs.permit },
    ...(costs.impact > 0 ? [{ label: 'Affordable-housing / linkage fee', value: costs.impact }] : []),
  ]
  // Per-sq-ft / per-unit reflect the building you're putting up — exclude
  // demolition and the impact fee, which would otherwise inflate the rate.
  const construction = costs.total - costs.demolition - costs.impact
  const perSqft = gfa > 0 ? construction / gfa : null
  const perUnit = units && units > 0 ? construction / units : null

  return (
    <div className="overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-white/60">
      <div className="border-b border-piranha-charcoal/10 bg-piranha-charcoal/[0.03] px-6 py-6">
        <p className="text-xs uppercase tracking-[0.14em] text-piranha-charcoal/50">
          Estimated total · excludes land
        </p>
        <p className="mt-2 font-serif text-4xl tracking-tight text-piranha-charcoal tabular-nums sm:text-5xl">
          {usd(costs.total)}
        </p>
        {(perSqft || perUnit) && (
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-piranha-charcoal/60">
            {perSqft && (
              <span>
                <span className="font-semibold text-piranha-charcoal tabular-nums">
                  {usd(perSqft)}
                </span>{' '}
                / sq ft
              </span>
            )}
            {perUnit && (
              <span>
                <span className="font-semibold text-piranha-charcoal tabular-nums">
                  {usd(perUnit)}
                </span>{' '}
                / unit
              </span>
            )}
          </div>
        )}
      </div>
      <dl>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-baseline justify-between px-6 py-3.5 ${
              i > 0 ? 'border-t border-piranha-charcoal/10' : ''
            }`}
          >
            <dt className="text-piranha-charcoal/65">{r.label}</dt>
            <dd className="font-medium text-piranha-charcoal tabular-nums">
              {r.value === null ? <span className="text-piranha-charcoal/45">Not estimated</span> : usd(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
