import type { AnalysisResult } from '../../../types/analysis'

function usdCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

interface Props {
  costs: AnalysisResult['costs']
  timeline: AnalysisResult['timeline']
  hurdles: AnalysisResult['hurdles']
}

/** Three headline figures, editorial register — the first thing the eye lands on. */
export function KeyMetrics({ costs, timeline, hurdles }: Props) {
  const requiredCount = hurdles.filter((h) => h.status === 'required').length
  const hurdleFigure = hurdles.length === 0 ? '0' : String(hurdles.length)
  const hurdleLabel =
    hurdles.length === 0
      ? 'Approvals beyond zoning'
      : requiredCount > 0
        ? `Approvals to clear, ${requiredCount} required`
        : 'Approvals to weigh'

  const metrics = [
    {
      figure: usdCompact(costs.total),
      label: 'All-in cost, order of magnitude',
    },
    {
      figure: timeline.months > 0 ? `${timeline.months}` : 'N/A',
      suffix: timeline.months > 0 ? (timeline.months === 1 ? ' mo' : ' mos') : '',
      label: 'From design to move-in',
    },
    {
      figure: hurdleFigure,
      label: hurdleLabel,
    },
  ]

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-piranha-charcoal/10 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-piranha-bone px-6 py-7">
          <p className="font-serif text-5xl leading-none tracking-tight text-piranha-charcoal tabular-nums">
            {m.figure}
            {m.suffix && <span className="text-2xl text-piranha-charcoal/45">{m.suffix}</span>}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-piranha-charcoal/55">
            {m.label}
          </p>
        </div>
      ))}
    </div>
  )
}
