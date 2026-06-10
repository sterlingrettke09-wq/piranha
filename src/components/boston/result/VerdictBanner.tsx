import type { CheckStatus } from '../../../types/analysis'
import { VERDICT } from '../../../lib/verdictLabels'
import { cityName } from '../../../config/cities'

// Per-status visual styling (dot / accent / tint) lives here; the copy
// (headline, sub, word) comes from the shared verdictLabels module so no two
// surfaces drift.
const STYLE: Record<CheckStatus, { dot: string; accent: string; tint: string }> = {
  AS_OF_RIGHT: { dot: 'bg-emerald-600', accent: 'text-emerald-700', tint: 'from-emerald-600/10' },
  NEEDS_RELIEF: { dot: 'bg-amber-500', accent: 'text-amber-700', tint: 'from-amber-500/10' },
  PROHIBITED: { dot: 'bg-rose-600', accent: 'text-rose-700', tint: 'from-rose-600/10' },
  INDETERMINATE: {
    dot: 'bg-piranha-charcoal/40',
    accent: 'text-piranha-charcoal/60',
    tint: 'from-piranha-charcoal/5',
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
}

export function VerdictBanner({
  overall,
  envelopeKnown = true,
  city,
  reliefOdds,
}: {
  overall: CheckStatus
  envelopeKnown?: boolean
  city?: string
  /** Historical board grant rate for variance-type relief in this city. When
   *  present on a NEEDS_RELIEF verdict, renders one muted context sub-line.
   *  Context, not a per-project prediction; never shown without real data. */
  reliefOdds?: { grantRate: number; n: number; window: string; vintage: string }
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

  // Historical board grant rate, shown only on a NEEDS_RELIEF verdict and only
  // when the city's offline relief pipeline produced a real figure. Context, not
  // a per-project prediction — never a placeholder when data is absent.
  const reliefLine =
    overall === 'NEEDS_RELIEF' && reliefOdds && city
      ? `${cityName(city)}'s board granted ${Math.round(reliefOdds.grantRate * 100)}% of ` +
        `variance requests (${reliefOdds.window}, n=${reliefOdds.n}).`
      : null

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-gradient-to-br ${tint} to-transparent p-8 sm:p-10`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>{word}</span>
      </div>
      <h2 className="mt-5 max-w-2xl font-serif text-[clamp(1.9rem,4vw,3rem)] leading-[1.08] tracking-tight text-piranha-charcoal">
        {headline}
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-charcoal/70">{sub}</p>
      {reliefLine && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-piranha-charcoal/55 print:text-piranha-charcoal/70">
          {reliefLine}
        </p>
      )}
    </div>
  )
}
