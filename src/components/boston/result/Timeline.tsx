import type { AnalysisResult } from '../../../types/analysis'

const PATH_LABEL: Record<AnalysisResult['timeline']['path'], string> = {
  as_of_right: 'As-of-right permitting',
  variance: 'Variance / discretionary approval',
  prohibited: 'No viable approval path',
}

export function Timeline({ timeline }: { timeline: AnalysisResult['timeline'] }) {
  return (
    <section className="space-y-2">
      <h3 className="font-serif text-xl tracking-tight">Time to approval</h3>
      <p className="text-piranha-charcoal/80">
        <span className="text-2xl font-semibold text-piranha-charcoal">
          {timeline.months > 0 ? `~${timeline.months} months` : 'N/A'}
        </span>
        <span className="ml-2 text-sm text-piranha-charcoal/60">{PATH_LABEL[timeline.path]}</span>
      </p>
    </section>
  )
}
