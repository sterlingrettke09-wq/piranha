import type { AnalysisResult } from '../../../types/analysis'

const PATH_LABEL: Record<AnalysisResult['timeline']['path'], string> = {
  as_of_right: 'As-of-right permitting',
  variance: 'Variance / discretionary approval',
  prohibited: 'No viable approval path',
}

export function Timeline({ timeline }: { timeline: AnalysisResult['timeline'] }) {
  const hasMonths = timeline.months > 0
  return (
    <div className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 px-6 py-6">
      <div className="flex items-end gap-3">
        <span className="font-serif text-5xl leading-none tracking-tight text-piranha-charcoal tabular-nums sm:text-6xl">
          {hasMonths ? timeline.months : 'N/A'}
        </span>
        {hasMonths && (
          <span className="pb-1 text-lg text-piranha-charcoal/45">
            {timeline.months === 1 ? 'month' : 'months'}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-piranha-charcoal/55">
        {PATH_LABEL[timeline.path]}
      </p>
    </div>
  )
}
