import type { CheckStatus } from '../../../types/analysis'

const COPY: Record<
  CheckStatus,
  { eyebrow: string; label: string; sub: string; dot: string; accent: string; tint: string }
> = {
  AS_OF_RIGHT: {
    eyebrow: 'The verdict',
    label: 'Likely buildable as-of-right.',
    sub: 'The proposal appears to fit the zoning envelope without discretionary relief.',
    dot: 'bg-emerald-600',
    accent: 'text-emerald-700',
    tint: 'from-emerald-600/10',
  },
  NEEDS_RELIEF: {
    eyebrow: 'The verdict',
    label: 'Buildable, with zoning relief.',
    sub: 'The proposal exceeds at least one limit and would need a variance or other approval.',
    dot: 'bg-amber-500',
    accent: 'text-amber-700',
    tint: 'from-amber-500/10',
  },
  PROHIBITED: {
    eyebrow: 'The verdict',
    label: 'Not permitted as proposed.',
    sub: 'The use or scale conflicts with the district in a way relief is unlikely to cure.',
    dot: 'bg-rose-600',
    accent: 'text-rose-700',
    tint: 'from-rose-600/10',
  },
  INDETERMINATE: {
    eyebrow: 'The verdict',
    label: 'Indeterminate from public data.',
    sub: 'The records did not provide the limits needed to judge one or more dimensions.',
    dot: 'bg-piranha-charcoal/40',
    accent: 'text-piranha-charcoal/60',
    tint: 'from-piranha-charcoal/5',
  },
}

const STATUS_WORD: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'As-of-right',
  NEEDS_RELIEF: 'Needs relief',
  PROHIBITED: 'Not permitted',
  INDETERMINATE: 'Indeterminate',
}

export function VerdictBanner({ overall }: { overall: CheckStatus }) {
  const c = COPY[overall]
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-gradient-to-br ${c.tint} to-transparent p-8 sm:p-10`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${c.accent}`}>
          {STATUS_WORD[overall]}
        </span>
      </div>
      <h2 className="mt-5 max-w-2xl font-serif text-[clamp(1.9rem,4vw,3rem)] leading-[1.08] tracking-tight text-piranha-charcoal">
        {c.label}
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-charcoal/70">{c.sub}</p>
    </div>
  )
}
