import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-white border border-piranha-charcoal/10 p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
