import type { AnalysisResult } from '../../../types/analysis'

const PATH_LABEL: Record<AnalysisResult['timeline']['path'], string> = {
  as_of_right: 'On the standard permit path',
  variance: 'Through the city’s special-approval process',
  prohibited: 'No viable approval path',
}

const TIER_LABEL: Record<NonNullable<AnalysisResult['timeline']['tier']>, string> = {
  single: 'a single-family home',
  multi: 'a multifamily building',
  apartment: 'an apartment-scale building',
}

// "Time-as-life" — translate the raw month count into something a person feels.
// Muted, print-visible, computed purely from the months figure (X = years to
// one decimal, N = whole years = floor(m/12)). The grade-by-move-in framing
// only fires for the long (≥48mo) projects where the human scale lands.
function timeAsLife(months: number): string | null {
  if (months <= 0) return null
  const years = Math.round((months / 12) * 10) / 10
  const wholeYears = Math.floor(months / 12)
  if (months >= 48) {
    return `That's ${years.toFixed(1)} years. A kid starting kindergarten today would be in grade ${wholeYears} by move-in.`
  }
  if (months >= 24) {
    return `That's ${years.toFixed(1)} years from first sketch to keys.`
  }
  return 'Under two years. Fast, by big-city standards.'
}

export function Timeline({
  timeline,
  indeterminate,
}: {
  timeline: AnalysisResult['timeline']
  indeterminate?: boolean
}) {
  const hasMonths = timeline.months > 0
  const pathLabel = indeterminate ? 'Not yet confirmed buildable' : PATH_LABEL[timeline.path]
  const lifeLine = hasMonths ? timeAsLife(timeline.months) : null
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
        {pathLabel}
      </p>
      {lifeLine && (
        <p className="mt-3 text-sm italic leading-relaxed text-piranha-charcoal/45">
          {lifeLine}
        </p>
      )}
      {hasMonths && (
        <p className="mt-4 border-t border-piranha-charcoal/10 pt-4 text-sm leading-relaxed text-piranha-charcoal/60">
          {timeline.tier ? `Estimated as ${TIER_LABEL[timeline.tier]}, ` : 'Estimated '}
          covering the whole arc: design, permits, site work, and construction. Coastal and
          discretionary cities run longer on complex projects.
        </p>
      )}
    </div>
  )
}
