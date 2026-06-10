import { Link } from 'react-router-dom'
import type { AnalysisResult } from '../../../types/analysis'
import { cityName } from '../../../config/cities'
import { buildRealityCards } from '../../../lib/realityCheck'
import { useCountUp } from '../../../lib/countUp'

// Each card's `big` is a pre-formatted string — sometimes a leading numeral
// ("8 mo", "72%"), sometimes purely lexical ("None", "Relaxed"). Animate only
// the numeral, preserving everything around it; lexical figures render verbatim
// with no animation. Fired on mount (the band is at the fold). Reduced motion →
// useCountUp returns the target immediately, so the string is unchanged at rest.
function CountUpBig({ value }: { value: string }) {
  const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/s)
  const target = match ? Number(match[1]) : NaN
  const animated = useCountUp(Number.isFinite(target) ? target : 0)
  if (!match || !Number.isFinite(target)) return <>{value}</>
  const decimals = match[1].includes('.') ? match[1].split('.')[1].length : 0
  return (
    <>
      {animated.toFixed(decimals)}
      {match[2]}
    </>
  )
}

// WO-8.2 — the "Reality check" band. The differentiated, city-specific data
// (measured permit time, board relief odds, parking reform) was previously
// buried in footnotes while the estimates dominated. This band makes it loud:
// a full-width, bone-on-charcoal inversion of the page, rendered immediately
// after the VerdictBanner and before the estimates. Cards only appear when real
// data backs them (see buildRealityCards); zero cards → the band renders null.
//
// Print: the charcoal ink-flood is overridden to a light, bordered block so the
// PDF doesn't burn a page of toner — see the `print:` utilities below.

export function RealityCheck({ result }: { result: AnalysisResult }) {
  const cards = buildRealityCards(result)
  if (cards.length === 0) return null

  const city = result.project.city
  const name = cityName(city)

  return (
    <section
      aria-label="Reality check"
      style={{ background: 'linear-gradient(135deg, #1A1414, #2A1218)' }}
      className="tpp-card relative overflow-hidden rounded-2xl text-piranha-bone print:border print:border-piranha-charcoal/30 print:!bg-white print:!bg-none print:text-piranha-charcoal"
    >
      {/* Faint gold top rule — a hairline of brand color across the dark band. */}
      <span
        className="absolute inset-x-0 top-0 h-0.5 bg-piranha-gold/70 print:hidden"
        aria-hidden="true"
      />
      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-piranha-gold print:text-piranha-burgundy">
          Reality check
        </p>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-piranha-bone/65 print:text-piranha-charcoal/65">
          What the records actually show in {name} — not the model’s estimate.
        </p>

        <div className="mt-6 grid gap-px overflow-hidden rounded-xl bg-piranha-gold/20 sm:grid-cols-2 lg:grid-cols-3 print:gap-4 print:bg-transparent">
          {cards.map((card) => (
            <div
              key={card.id}
              style={{ background: '#231114' }}
              className="flex flex-col p-5 print:rounded-lg print:border print:border-piranha-charcoal/20 print:!bg-white"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-piranha-bone/55 print:text-piranha-charcoal/55">
                {card.kicker}
              </p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-serif text-5xl leading-none tracking-tight tabular-nums">
                  <CountUpBig value={card.big} />
                </span>
                {card.unit && (
                  <span className="text-sm text-piranha-bone/55 print:text-piranha-charcoal/55">
                    {card.unit}
                  </span>
                )}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-piranha-bone/55 print:text-piranha-charcoal/55">
                {card.sub}
              </p>
              <p className="mt-3 border-t border-piranha-bone/15 pt-3 text-sm leading-relaxed text-piranha-bone/85 print:border-piranha-charcoal/15 print:text-piranha-charcoal/80">
                {card.soWhat}
              </p>
              <Link
                to="/red-tape"
                className="print-hide mt-3 inline-flex text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-piranha-gold transition-colors hover:text-piranha-bone"
              >
                → how {name} compares
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
