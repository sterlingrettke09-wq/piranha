import type { AnalysisResult } from '../../../types/analysis'

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function CostBreakdown({ costs }: { costs: AnalysisResult['costs'] }) {
  const rows: { label: string; value: number }[] = [
    { label: 'Construction (hard)', value: costs.hard },
    { label: 'Soft costs', value: costs.soft },
    { label: 'Permitting & approvals', value: costs.permit },
  ]
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">Estimated cost</h3>
      <dl className="rounded-lg border border-piranha-charcoal/10">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between border-b border-piranha-charcoal/10 px-4 py-3 last:border-0">
            <dt className="text-piranha-charcoal/70">{r.label}</dt>
            <dd className="font-medium text-piranha-charcoal tabular-nums">{usd(r.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between bg-piranha-charcoal/5 px-4 py-3">
          <dt className="font-semibold text-piranha-charcoal">Total</dt>
          <dd className="font-semibold text-piranha-charcoal tabular-nums">{usd(costs.total)}</dd>
        </div>
      </dl>
    </section>
  )
}
