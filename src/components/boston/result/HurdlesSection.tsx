import type { Hurdle, HurdleStatus } from '../../../types/analysis'

const STATUS: Record<HurdleStatus, { label: string; dot: string; chip: string }> = {
  required: {
    label: 'Required',
    dot: 'bg-rose-600',
    chip: 'bg-rose-600/10 text-rose-700',
  },
  likely: {
    label: 'Likely',
    dot: 'bg-amber-500',
    chip: 'bg-amber-500/10 text-amber-700',
  },
  info: {
    label: 'Heads-up',
    dot: 'bg-piranha-charcoal/30',
    chip: 'bg-piranha-charcoal/5 text-piranha-charcoal/60',
  },
}

export function HurdlesSection({ hurdles }: { hurdles: Hurdle[] }) {
  if (!hurdles || hurdles.length === 0) {
    return (
      <p className="rounded-2xl border border-piranha-charcoal/10 bg-white/50 p-6 leading-relaxed text-piranha-charcoal/70">
        Nothing beyond the zoning review surfaced for this parcel. That is rare, and worth
        confirming with the city before you rely on it.
      </p>
    )
  }
  return (
    <ol className="space-y-3">
      {hurdles.map((h, i) => {
        const s = STATUS[h.status]
        return (
          <li
            key={i}
            className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-5 transition-colors hover:border-piranha-charcoal/20"
          >
            <div className="flex items-start gap-4">
              <span className="mt-1 font-serif text-lg text-piranha-charcoal/30 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-semibold text-piranha-charcoal">{h.label}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                  {h.addsMonths ? (
                    <span className="text-sm text-piranha-charcoal/55 tabular-nums">
                      +{h.addsMonths} mo
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 leading-relaxed text-piranha-charcoal/70">{h.note}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
