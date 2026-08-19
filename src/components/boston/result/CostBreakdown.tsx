import type { AnalysisResult } from '../../../types/analysis'
import { formatEstimate } from '../../../lib/format'

// The cost model is order-of-magnitude, so every figure renders at 3 sig figs
// with a magnitude suffix ($4.18M / $425k / $425/sq ft) rather than to the dollar.
const usd = (n: number): string => formatEstimate(n)

interface Props {
  costs: AnalysisResult['costs']
  /** Set when no published rate covers this product, so the construction lines
   *  are null. Renders the REASON in place of the total — a dash alone would
   *  read as a rendering fault rather than a stated limit. */
  costUnavailable?: AnalysisResult['costUnavailable']
  gfa: number
  units?: number
  /** A teardown is required but its floor area isn't in the city's data, so the
   *  demolition cost couldn't be sized — show "not estimated" rather than omit it. */
  demolitionRequired?: boolean
}

export function CostBreakdown({ costs, gfa, units, demolitionRequired, costUnavailable }: Props) {
  const rows: { label: string; value: number | null }[] = [
    ...(costs.demolition > 0
      ? [{ label: 'Demolish existing building', value: costs.demolition }]
      : demolitionRequired
        ? // Teardown detected but the city's data carries no building size, so the
          // demolition cost couldn't be sized. Show the gap as a visible line — not
          // a silent omission — so a developer reading the table sees it (WO-5.9).
          [{ label: 'Demolition — not estimated (no building-size data for this city)', value: null }]
        : []),
    { label: 'Construction (hard)', value: costs.hard },
    { label: 'Soft costs', value: costs.soft },
    { label: 'Permitting & approvals', value: costs.permit },
    ...(costs.impact != null && costs.impact > 0
      ? [{ label: 'Affordable-housing / linkage fee', value: costs.impact }]
      : []),
  ]
  // Per-sq-ft / per-unit reflect the building you're putting up — exclude
  // demolition and the impact fee, which would otherwise inflate the rate.
  // Every operand is checked: subtracting a null coerces to a number in JS and
  // would print a confident rate derived from a missing total.
  const construction =
    costs.total == null || costs.impact == null ? null : costs.total - costs.demolition - costs.impact
  const perSqft = construction != null && gfa > 0 ? construction / gfa : null
  const perUnit = construction != null && units && units > 0 ? construction / units : null

  return (
    <div className="overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-white/60">
      <div className="border-b border-piranha-charcoal/10 bg-piranha-charcoal/[0.03] px-6 py-6">
        <p className="text-xs uppercase tracking-[0.14em] text-piranha-charcoal/50">
          Estimated total · excludes land
        </p>
        {costs.total == null ? (
          <p className="mt-2 font-serif text-3xl tracking-tight text-piranha-charcoal/70 sm:text-4xl">
            Not estimated
          </p>
        ) : (
          <p className="mt-2 font-serif text-4xl tracking-tight text-piranha-charcoal tabular-nums sm:text-5xl">
            {usd(costs.total)}
          </p>
        )}
        {costUnavailable && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-piranha-charcoal/60">
            {costUnavailable.reason}
          </p>
        )}
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
            className={`flex items-baseline justify-between gap-3 px-6 py-3.5 ${
              i > 0 ? 'border-t border-piranha-charcoal/10' : ''
            }`}
          >
            {/* min-w-0 lets the long "Demolition — not estimated…" label wrap
                instead of forcing the row wider than 360px; the value never
                shrinks below its content. */}
            <dt className="min-w-0 text-piranha-charcoal/65">{r.label}</dt>
            <dd className="shrink-0 font-medium text-piranha-charcoal tabular-nums">
              {r.value === null ? <span className="text-piranha-charcoal/45">—</span> : usd(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
