import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { CitiesNav } from './CitiesNav'
import { CITIES, PRIMARY_CITY_SLUGS } from '../config/cities'
import { DisclaimerNotice } from './DisclaimerNotice'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/red-tape', label: 'Red Tape Index' },
  { to: '/ask', label: 'Ask' },
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
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  const mobileLink = `block py-3 text-base font-semibold uppercase tracking-wider transition-colors ${
    dark ? 'text-piranha-bone/85' : 'text-piranha-charcoal'
  }`

  return (
    <div className="min-h-screen flex flex-col bg-piranha-bone text-piranha-charcoal">
      <header
        className={`print-hide border-b ${
          dark ? 'border-piranha-bone/10 bg-[#1a1412]' : 'border-piranha-charcoal/10 bg-piranha-bone'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Wordmark light={dark} />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <CitiesNav light={dark} />
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className={`md:hidden -mr-2 p-2 ${dark ? 'text-piranha-bone' : 'text-piranha-charcoal'}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <nav
            className={`md:hidden border-t px-6 pb-6 pt-2 ${
              dark ? 'border-piranha-bone/10 bg-[#1a1412]' : 'border-piranha-charcoal/10 bg-piranha-bone'
            }`}
          >
            <NavLink to="/" end onClick={close} className={mobileLink}>
              Home
            </NavLink>

            <div className={`border-t py-2 ${dark ? 'border-piranha-bone/10' : 'border-piranha-charcoal/10'}`}>
              <p className={`pt-2 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-piranha-gold' : 'text-piranha-burgundy'}`}>
                Cities
              </p>
              <div className="mt-1">
                {CITIES.filter((c) => PRIMARY_CITY_SLUGS.includes(c.slug)).map((c) => (
                  <NavLink
                    key={c.slug}
                    to={`/map?city=${c.slug}`}
                    onClick={close}
                    className={`block py-2 text-sm font-medium ${dark ? 'text-piranha-bone/80' : 'text-piranha-charcoal/80'}`}
                  >
                    {c.name}
                  </NavLink>
                ))}
                <NavLink
                  to="/cities"
                  onClick={close}
                  className={`block py-2 text-sm font-medium ${dark ? 'text-piranha-gold' : 'text-piranha-burgundy'}`}
                >
                  See all cities →
                </NavLink>
              </div>
            </div>

            <div className={`border-t ${dark ? 'border-piranha-bone/10' : 'border-piranha-charcoal/10'}`}>
              {navItems.map(({ to, label }) => (
                <NavLink key={to} to={to} onClick={close} className={mobileLink}>
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* One slim row: disclaimer (compressed — the full version lives at /terms)
          + links. Height matters: BostonDashboard's map calc assumes ~3.5rem. */}
      <footer className="print-hide border-t border-piranha-charcoal/10 bg-piranha-charcoal text-piranha-bone">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-xs text-piranha-bone/60">
          <span>
            Estimates from public records — not legal advice.{' '}
            <NavLink to="/terms" className="underline underline-offset-2 hover:text-piranha-bone">
              Verify with your city
            </NavLink>
            .
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-x-2">
            <NavLink to="/red-tape" className="underline underline-offset-2 hover:text-piranha-bone">
              Red Tape Index
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/math" className="underline underline-offset-2 hover:text-piranha-bone">
              Methodology
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/privacy" className="underline underline-offset-2 hover:text-piranha-bone">
              Privacy
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/terms" className="underline underline-offset-2 hover:text-piranha-bone">
              Terms
            </NavLink>
            <span aria-hidden>·</span>
            <span>built by Louisburg Strategies</span>
          </span>
        </div>
      </footer>

      <DisclaimerNotice />
    </div>
  )
}
