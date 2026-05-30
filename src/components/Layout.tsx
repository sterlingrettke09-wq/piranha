import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { CitiesNav } from './CitiesNav'
import { DisclaimerNotice } from './DisclaimerNotice'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/ask', label: 'Ask' },
  { to: '/news', label: 'News' },
  { to: '/about', label: 'About' },
]

// On the dark Home header, links go bone/gold; everywhere else charcoal/burgundy.
const makeLinkClass = (dark: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold uppercase tracking-wider transition-colors ${
      isActive
        ? dark
          ? 'text-piranha-gold'
          : 'text-piranha-burgundy'
        : dark
          ? 'text-piranha-bone/80 hover:text-piranha-bone'
          : 'text-piranha-charcoal hover:text-piranha-burgundy'
    }`

export function Layout({ children }: LayoutProps) {
  const dark = useLocation().pathname === '/'
  const linkClass = makeLinkClass(dark)
  return (
    <div className="min-h-screen flex flex-col bg-piranha-bone text-piranha-charcoal">
      <header
        className={`border-b ${
          dark ? 'border-piranha-bone/10 bg-[#1a1412]' : 'border-piranha-charcoal/10 bg-piranha-bone'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Wordmark light={dark} />
          <nav className="flex items-center gap-8">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <CitiesNav light={dark} />
            {navItems
              .filter((i) => i.to !== '/')
              .map(({ to, label }) => (
                <NavLink key={to} to={to} className={linkClass}>
                  {label}
                </NavLink>
              ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-piranha-charcoal/10 bg-piranha-charcoal text-piranha-bone">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-3">
          <p className="text-sm leading-relaxed max-w-3xl">
            The Piranha Project provides general regulatory information, not legal
            advice. Estimates are built from public data, so always verify with the
            relevant city department.
          </p>
          <p className="text-xs text-piranha-bone/60">
            <NavLink to="/math" className="underline underline-offset-2 hover:text-piranha-bone">
              Methodology
            </NavLink>
            <span className="mx-2">·</span>
            v1 · built by Louisburg Strategies
          </p>
        </div>
      </footer>

      <DisclaimerNotice />
    </div>
  )
}
