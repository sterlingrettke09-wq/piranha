import type { Hurdle, HurdleStatus } from '../../../types/analysis'

const DOT: Record<HurdleStatus, string> = {
  required: 'bg-rose-500',
  likely: 'bg-amber-500',
  info: 'bg-piranha-charcoal/30',
}

const STATUS_LABEL: Record<HurdleStatus, string> = {
  required: 'Required',
  likely: 'Likely',
  info: 'Heads-up',
}

export function HurdlesSection({ hurdles }: { hurdles: Hurdle[] }) {
  if (!hurdles || hurdles.length === 0) return null
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">Beyond zoning — the red tape</h3>
      <ul className="divide-y divide-piranha-charcoal/10 rounded-lg border border-piranha-charcoal/10">
        {hurdles.map((h, i) => (
          <li key={i} className="flex gap-3 p-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[h.status]}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-piranha-charcoal">{h.label}</span>
                <span className="text-xs uppercase tracking-wider text-piranha-charcoal/50">
                  {STATUS_LABEL[h.status]}
                </span>
                {h.addsMonths ? (
                  <span className="text-sm text-piranha-charcoal/60">+{h.addsMonths} mo</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-piranha-charcoal/70">{h.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
