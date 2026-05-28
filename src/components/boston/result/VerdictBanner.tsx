import type { CheckStatus } from '../../../types/analysis'

const COPY: Record<CheckStatus, { label: string; sub: string; cls: string }> = {
  AS_OF_RIGHT: {
    label: 'Likely buildable as-of-right',
    sub: 'The proposal appears to fit the zoning envelope without discretionary relief.',
    cls: 'bg-emerald-50 border-emerald-600/30 text-emerald-900',
  },
  NEEDS_RELIEF: {
    label: 'Buildable with zoning relief',
    sub: 'The proposal exceeds at least one limit and would require a variance or other approval.',
    cls: 'bg-amber-50 border-amber-600/30 text-amber-900',
  },
  PROHIBITED: {
    label: 'Not permitted as proposed',
    sub: 'The use or scale conflicts with the district in a way relief is unlikely to cure.',
    cls: 'bg-rose-50 border-rose-600/30 text-rose-900',
  },
  INDETERMINATE: {
    label: 'Indeterminate from available data',
    sub: 'Public data did not provide the limits needed to judge one or more dimensions.',
    cls: 'bg-piranha-charcoal/5 border-piranha-charcoal/20 text-piranha-charcoal',
  },
}

export function VerdictBanner({ overall }: { overall: CheckStatus }) {
  const c = COPY[overall]
  return (
    <div className={`rounded-xl border p-5 ${c.cls}`}>
      <h2 className="font-serif text-2xl tracking-tight">{c.label}</h2>
      <p className="mt-1 text-sm opacity-90">{c.sub}</p>
    </div>
  )
}
