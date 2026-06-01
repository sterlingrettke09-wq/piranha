import type { AnalysisResult } from '../../../types/analysis'

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Props {
  costs: AnalysisResult['costs']
  gfa: number
  units?: number
}

export function CostBreakdown({ costs, gfa, units }: Props) {
  const rows: { label: string; value: number }[] = [
    ...(costs.demolition > 0 ? [{ label: 'Demolish existing building', value: costs.demolition }] : []),
    { label: 'Construction (hard)', value: costs.hard },
    { label: 'Soft costs', value: costs.soft },
    { label: 'Permitting & approvals', value: costs.permit },
  ]
  const perSqft = gfa > 0 ? costs.total / gfa : null
  const perUnit = units && units > 0 ? costs.total / units : null

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
            <dd className="font-medium text-piranha-charcoal tabular-nums">{usd(r.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
