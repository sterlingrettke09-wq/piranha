import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CITIES } from '../config/cities'

// Header "Cities" dropdown — selecting a city navigates to its dashboard
// (?city=slug), which the dashboard reads from the URL.
export function CitiesNav({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()

  const onCities = location.pathname.startsWith('/map')
  const current = params.get('city') ?? 'boston'

  function go(slug: string) {
    setOpen(false)
    navigate(`/map?city=${slug}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`whitespace-nowrap text-sm font-semibold uppercase tracking-wider transition-colors ${
          onCities
            ? light
              ? 'text-piranha-gold'
              : 'text-piranha-burgundy'
            : light
              ? 'text-piranha-bone/80 hover:text-piranha-bone'
              : 'text-piranha-charcoal hover:text-piranha-burgundy'
        }`}
      >
        Cities <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 sm:left-auto sm:right-0 z-30 mt-2 w-52 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-piranha-charcoal/10 bg-piranha-bone py-1 shadow-lg"
          >
            {CITIES.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="menuitem"
                onClick={() => go(c.slug)}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                  onCities && current === c.slug
                    ? 'font-semibold text-piranha-burgundy'
                    : 'text-piranha-charcoal hover:bg-piranha-charcoal/5'
                }`}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/request-city')
              }}
              className="mt-1 block w-full border-t border-piranha-charcoal/10 px-4 py-2 text-left text-sm text-piranha-charcoal/55 transition-colors hover:bg-piranha-charcoal/5 hover:text-piranha-burgundy"
            >
              Request a city →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
