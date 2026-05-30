import { Link } from 'react-router-dom'

/** Orchestra-style arrow pill. `tone="light"` for dark backgrounds. */
export function ArrowLink({
  to,
  children,
  tone = 'dark',
}: {
  to: string
  children: React.ReactNode
  tone?: 'dark' | 'light'
}) {
  const styles =
    tone === 'light'
      ? 'border-piranha-bone/40 text-piranha-bone hover:bg-piranha-bone hover:text-piranha-charcoal'
      : 'border-piranha-charcoal/25 text-piranha-charcoal hover:bg-piranha-charcoal hover:text-piranha-bone'
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-3 rounded-full border px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${styles}`}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1.5">
        →
      </span>
    </Link>
  )
}
