import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

/** Editorial page header — gold eyebrow + large Caslon title + optional lede.
 *  Matches the homepage's register so every page reads as one premium site. */
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <Reveal>
      <header className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
          {eyebrow}
        </p>
        <h1 className="font-serif text-[clamp(2.4rem,5vw,3.9rem)] leading-[1.04] tracking-tight text-piranha-charcoal">
          {title}
        </h1>
        {children && (
          <div className="max-w-2xl text-lg leading-relaxed text-piranha-charcoal/70">{children}</div>
        )}
      </header>
    </Reveal>
  )
}
