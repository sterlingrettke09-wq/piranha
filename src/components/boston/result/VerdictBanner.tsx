import type { CheckStatus } from '../../../types/analysis'

const COPY: Record<
  CheckStatus,
  { eyebrow: string; label: string; sub: string; dot: string; accent: string; tint: string }
> = {
  AS_OF_RIGHT: {
    eyebrow: 'The verdict',
    label: 'You can likely build this.',
    sub: 'The proposal appears to fit the zoning here without needing special permission from the city.',
    dot: 'bg-emerald-600',
    accent: 'text-emerald-700',
    tint: 'from-emerald-600/10',
  },
  NEEDS_RELIEF: {
    eyebrow: 'The verdict',
    label: 'Buildable, with the city’s permission.',
    sub: 'The proposal goes past at least one limit, so you’d have to ask the city to approve an exception first.',
    dot: 'bg-amber-500',
    accent: 'text-amber-700',
    tint: 'from-amber-500/10',
  },
  PROHIBITED: {
    eyebrow: 'The verdict',
    label: 'You can’t build this here.',
    sub: 'The use or scale conflicts with the rules for this area in a way an exception is unlikely to fix.',
    dot: 'bg-rose-600',
    accent: 'text-rose-700',
    tint: 'from-rose-600/10',
  },
  INDETERMINATE: {
    eyebrow: 'The verdict',
    label: 'We can’t tell from the public data.',
    sub: 'The records didn’t include the limits we’d need to judge one or more parts of this.',
    dot: 'bg-piranha-charcoal/40',
    accent: 'text-piranha-charcoal/60',
    tint: 'from-piranha-charcoal/5',
  },
}

const STATUS_WORD: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'You can build it',
  NEEDS_RELIEF: 'Needs city permission',
  PROHIBITED: 'Not allowed',
  INDETERMINATE: 'Can’t tell',
}

// When the verdict is "as-of-right" but neither FAR nor height could be
// evaluated, we only know the use fits. Say exactly that, without the
// confident green pass.
const LIMITED = {
  word: 'No blocker found',
  label: 'No zoning blocker found in the public data.',
  sub: 'The use fits this district. FAR and height limits aren’t published for this parcel, so the size and bulk still need to be confirmed with the city.',
  dot: 'bg-piranha-gold',
  accent: 'text-piranha-charcoal/70',
  tint: 'from-piranha-gold/10',
}

export function VerdictBanner({
  overall,
  envelopeKnown = true,
}: {
  overall: CheckStatus
  envelopeKnown?: boolean
}) {
  const limited = overall === 'AS_OF_RIGHT' && !envelopeKnown
  const c = limited ? LIMITED : COPY[overall]
  const word = limited ? LIMITED.word : STATUS_WORD[overall]
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-gradient-to-br ${c.tint} to-transparent p-8 sm:p-10`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${c.accent}`}>
          {word}
        </span>
      </div>
      <h2 className="mt-5 max-w-2xl font-serif text-[clamp(1.9rem,4vw,3rem)] leading-[1.08] tracking-tight text-piranha-charcoal">
        {c.label}
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-charcoal/70">{c.sub}</p>
    </div>
  )
}
