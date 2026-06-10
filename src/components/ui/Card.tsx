import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Interactive cards get a hover lift (2px rise + stronger shadow). Use for
   *  clickable/linked cards only — static cards stay put. */
  interactive?: boolean
}

export function Card({ className = '', interactive = false, children, ...rest }: CardProps) {
  const depth = interactive ? 'tpp-card-interactive' : 'tpp-card'
  return (
    <div
      className={`${depth} rounded-2xl bg-white border border-piranha-charcoal/10 p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
