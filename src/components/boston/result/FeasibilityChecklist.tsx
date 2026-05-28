import type { FeasibilityCheck, CheckStatus } from '../../../types/analysis'

const DOT: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'bg-emerald-500',
  NEEDS_RELIEF: 'bg-amber-500',
  PROHIBITED: 'bg-rose-500',
  INDETERMINATE: 'bg-piranha-charcoal/30',
}

const DIMENSION_LABEL: Record<FeasibilityCheck['dimension'], string> = {
  use: 'Use',
  far: 'Floor-area ratio',
  height: 'Height',
}

export function FeasibilityChecklist({ checks }: { checks: FeasibilityCheck[] }) {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">How we got there</h3>
      <ul className="divide-y divide-piranha-charcoal/10 rounded-lg border border-piranha-charcoal/10">
        {checks.map((c) => (
          <li key={c.dimension} className="flex gap-3 p-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-piranha-charcoal">{DIMENSION_LABEL[c.dimension]}</span>
                <span className="text-sm text-piranha-charcoal/60">
                  proposed {c.proposed} · allowed {c.allowed}
                </span>
              </div>
              {c.note && <p className="mt-1 text-sm text-piranha-charcoal/70">{c.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
