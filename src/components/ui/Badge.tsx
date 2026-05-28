import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'burgundy' | 'charcoal' | 'gold' | 'bone'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  children: ReactNode
}

const toneClasses: Record<Tone, string> = {
  burgundy: 'bg-piranha-burgundy text-piranha-bone',
  charcoal: 'bg-piranha-charcoal text-piranha-bone',
  gold: 'bg-piranha-gold text-piranha-charcoal',
  bone: 'bg-piranha-bone text-piranha-charcoal border border-piranha-charcoal/30',
}

export function Badge({
  tone = 'burgundy',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
