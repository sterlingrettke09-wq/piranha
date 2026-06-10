import type { CheckStatus } from '../../../types/analysis'
import { VERDICT } from '../../../lib/verdictLabels'

// Per-status visual styling (dot / accent / tint / left rule) lives here; the
// copy (headline, sub, word) comes from the shared verdictLabels module so no
// two surfaces drift. The `rule` is a colored left accent bar that gives the
// banner real presence and signals the verdict status at a glance.
const STYLE: Record<CheckStatus, { dot: string; accent: string; tint: string; rule: string }> = {
  AS_OF_RIGHT: {
    dot: 'bg-emerald-600',
    accent: 'text-emerald-700',
    tint: 'from-emerald-600/10',
    rule: 'bg-emerald-600',
  },
  NEEDS_RELIEF: {
    dot: 'bg-amber-500',
    accent: 'text-amber-700',
    tint: 'from-amber-500/10',
    rule: 'bg-amber-500',
  },
  PROHIBITED: {
    dot: 'bg-rose-600',
    accent: 'text-rose-700',
    tint: 'from-rose-600/10',
    rule: 'bg-rose-600',
  },
  INDETERMINATE: {
    dot: 'bg-piranha-charcoal/40',
    accent: 'text-piranha-charcoal/60',
    tint: 'from-piranha-charcoal/5',
    rule: 'bg-piranha-charcoal/30',
  },
}

// When the verdict is "as-of-right" but neither FAR nor height could be
// evaluated, we only know the use fits. Say exactly that, without the
// confident green pass.
const LIMITED = {
  word: 'No blocker found',
  headline: 'No zoning blocker found in the public data.',
  sub: 'The use fits this district. FAR and height limits aren’t published for this parcel, so the size and bulk still need to be confirmed with the city.',
  dot: 'bg-piranha-gold',
  accent: 'text-piranha-charcoal/70',
  tint: 'from-piranha-gold/10',
  rule: 'bg-piranha-gold',
}

export function VerdictBanner({
  overall,
  envelopeKnown = true,
}: {
  overall: CheckStatus
  envelopeKnown?: boolean
  /** City slug — retained for callers; the verdict copy itself is city-agnostic
   *  and the relief-odds context now lives in the RealityCheck band (WO-8.2),
   *  so this banner no longer renders a relief sub-line of its own. */
  city?: string
}) {
  const limited = overall === 'AS_OF_RIGHT' && !envelopeKnown
  const copy = VERDICT[overall]
  const style = STYLE[overall]

  const word = limited ? LIMITED.word : copy.word
  const headline = limited ? LIMITED.headline : copy.headline
  const sub = limited ? LIMITED.sub : copy.sub
  const dot = limited ? LIMITED.dot : style.dot
  const accent = limited ? LIMITED.accent : style.accent
  const tint = limited ? LIMITED.tint : style.tint
  const rule = limited ? LIMITED.rule : style.rule

  return (
    <div
      className={`tpp-card relative overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-gradient-to-br ${tint} to-transparent p-8 pl-9 sm:p-10 sm:pl-11`}
    >
      {/* Colored status rule down the left edge — instant verdict signal. */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${rule}`} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>{word}</span>
      </div>
      <h2 className="mt-5 max-w-2xl font-serif text-[clamp(2.1rem,4.5vw,3.4rem)] leading-[1.06] tracking-tight text-piranha-charcoal">
        {headline}
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-charcoal/70">{sub}</p>
    </div>
  )
}
