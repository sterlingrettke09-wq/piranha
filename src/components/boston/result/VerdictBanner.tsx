import type { CheckStatus } from '../../../types/analysis'
import { VERDICT } from '../../../lib/verdictLabels'

// Per-status visual styling (stamp / tint / left rule) lives here; the copy
// (headline, sub, word) comes from the shared verdictLabels module so no two
// surfaces drift. `stamp` colors the rubber-stamp seal (border + ink); `rule`
// is the colored left accent bar that signals the status at a glance.
const STYLE: Record<CheckStatus, { stamp: string; tint: string; rule: string }> = {
  AS_OF_RIGHT: {
    stamp: 'border-emerald-700/80 text-emerald-700',
    tint: 'from-emerald-600/10',
    rule: 'bg-emerald-600',
  },
  NEEDS_RELIEF: {
    stamp: 'border-amber-600/80 text-amber-700',
    tint: 'from-amber-500/10',
    rule: 'bg-amber-500',
  },
  PROHIBITED: {
    stamp: 'border-rose-700/80 text-rose-700',
    tint: 'from-rose-600/10',
    rule: 'bg-rose-600',
  },
  INDETERMINATE: {
    stamp: 'border-piranha-charcoal/40 text-piranha-charcoal/60',
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
  stamp: 'border-piranha-gold/90 text-piranha-charcoal/75',
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
  const stamp = limited ? LIMITED.stamp : style.stamp
  const tint = limited ? LIMITED.tint : style.tint
  const rule = limited ? LIMITED.rule : style.rule

  return (
    <div
      className={`tpp-card relative overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-gradient-to-br ${tint} to-transparent p-8 pl-9 sm:p-10 sm:pl-11`}
    >
      {/* Colored status rule down the left edge — instant verdict signal. */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${rule}`} aria-hidden="true" />
      {/* The verdict, stamped. A double-ringed inspector's seal that lands
          (tpp-stamp) once per page view and settles slightly crooked. */}
      <span
        className={`tpp-stamp inline-block rounded-md border-[3px] px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.2em] shadow-[inset_0_0_0_2px_rgba(245,240,229,0.9),inset_0_0_0_3px_currentColor] ${stamp}`}
      >
        {word}
      </span>
      <h2 className="mt-6 max-w-2xl font-serif text-[clamp(2.1rem,4.5vw,3.4rem)] leading-[1.06] tracking-tight text-piranha-charcoal">
        {headline}
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-charcoal/70">{sub}</p>
    </div>
  )
}
