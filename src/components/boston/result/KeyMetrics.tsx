import type { AnalysisResult } from '../../../types/analysis'
import { formatEstimate } from '../../../lib/format'
import { useCountUp } from '../../../lib/countUp'

interface Props {
  costs: AnalysisResult['costs']
  timeline: AnalysisResult['timeline']
  hurdles: AnalysisResult['hurdles']
  /** When the verdict couldn't be determined, the timeline is conditional. */
  indeterminate?: boolean
}

/** Three headline figures, editorial register — the first thing the eye lands on. */
export function KeyMetrics({ costs, timeline, hurdles, indeterminate }: Props) {
  const requiredCount = hurdles.filter((h) => h.status === 'required').length

  // Count-up animation, fired on mount (the band sits at the fold). Each numeral
  // animates from 0 to its value then holds; the displayed string is formatted
  // through the SAME util used at rest, so the settled figure is identical to
  // the static render. Reduced motion → instant (useCountUp returns the target).
  const hasMonths = timeline.months > 0
  const costValue = useCountUp(costs.total)
  const monthsValue = useCountUp(hasMonths ? timeline.months : 0)
  const hurdleValue = useCountUp(hurdles.length)

  const hurdleLabel =
    hurdles.length === 0
      ? 'Approvals beyond zoning'
      : requiredCount > 0
        ? `Approvals to clear, ${requiredCount} required`
        : 'Approvals to weigh'

  const metrics = [
    {
      figure: formatEstimate(costValue),
      label: 'Construction cost, excludes land',
    },
    {
      figure: hasMonths ? `${Math.round(monthsValue)}` : 'N/A',
      suffix: hasMonths ? (timeline.months === 1 ? ' mo' : ' mos') : '',
      label: indeterminate ? 'Est. months, if permittable' : 'From design to move-in',
    },
    {
      figure: String(Math.round(hurdleValue)),
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
