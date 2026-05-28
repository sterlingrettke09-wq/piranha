import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Wordmark } from './Wordmark'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/boston', label: 'Boston' },
  { to: '/ask', label: 'Ask' },
  { to: '/about', label: 'About' },
]

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-piranha-bone text-piranha-charcoal">
      <header className="border-b border-piranha-charcoal/10 bg-piranha-bone">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-8">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `text-sm font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'text-piranha-burgundy'
                      : 'text-piranha-charcoal hover:text-piranha-burgundy'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-12">{children}</div>
      </main>

      <footer className="border-t border-piranha-charcoal/10 bg-piranha-charcoal text-piranha-bone">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-3">
          <p className="text-sm leading-relaxed max-w-3xl">
            Piranha provides general regulatory information, not legal advice.
            Always verify with the relevant city department.
          </p>
          <p className="text-xs text-piranha-bone/60">
            v0.1 — built by Louisburg Strategies
          </p>
        </div>
      </footer>
    </div>
  )
}
