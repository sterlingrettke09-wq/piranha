import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-piranha-burgundy text-piranha-bone hover:bg-piranha-charcoal active:bg-piranha-charcoal',
  secondary:
    'bg-piranha-charcoal text-piranha-bone hover:bg-piranha-burgundy',
  ghost:
    'bg-transparent text-piranha-charcoal border border-piranha-charcoal hover:bg-piranha-charcoal hover:text-piranha-bone',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold tracking-wide uppercase transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-piranha-gold focus-visible:ring-offset-2 focus-visible:ring-offset-piranha-bone ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
