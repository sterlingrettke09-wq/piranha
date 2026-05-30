import { Link } from 'react-router-dom'

/** Understated text-with-arrow CTA (Orchestra-style). */
export function ArrowLink({
  to,
  children,
  size = 'md',
}: {
  to: string
  children: React.ReactNode
  size?: 'md' | 'lg'
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-3 font-medium text-piranha-burgundy ${
        size === 'lg' ? 'text-lg' : 'text-base'
      }`}
    >
      <span className="border-b border-piranha-burgundy/30 pb-1 transition-colors group-hover:border-piranha-burgundy">
        {children}
      </span>
      <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1.5">
        →
      </span>
    </Link>
  )
}
