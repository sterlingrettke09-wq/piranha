import type { ReactNode } from 'react'
import { Reveal } from '../../Reveal'

/** Numbered editorial section for the feasibility report — gold numeral,
 *  Caslon title, hairline rule. Matches the About page's register. */
export function ReportSection({
  n,
  title,
  kicker,
  children,
}: {
  n: string
  title: string
  kicker?: string
  children: ReactNode
}) {
  return (
    <Reveal>
      <section className="border-t border-piranha-charcoal/15 pt-8">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-xl text-piranha-gold tabular-nums">{n}</span>
          <div>
            <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal sm:text-3xl">
              {title}
            </h2>
            {kicker && <p className="mt-1 text-sm text-piranha-charcoal/55">{kicker}</p>}
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </Reveal>
  )
}
