import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CITIES, PRIMARY_CITY_SLUGS } from '../config/cities'

// Header "Cities" dropdown — selecting a city navigates to its dashboard
// (?city=slug), which the dashboard reads from the URL.
export function CitiesNav({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const onCities = location.pathname.startsWith('/map')
  const current = params.get('city') ?? 'boston'

  function close(focusTrigger = false) {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function go(slug: string) {
    setOpen(false)
    navigate(`/map?city=${slug}`)
  }

  // Move focus into the menu when it opens (keyboard accessibility).
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  // Escape closes (returning focus to the trigger); arrows / Home / End move
  // focus between items — standard menu keyboard behaviour.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[Math.max(idx - 1, 0)]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
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
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            className="absolute left-0 sm:left-auto sm:right-0 z-30 mt-2 w-52 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-piranha-charcoal/10 bg-piranha-bone py-1 shadow-lg"
          >
            {CITIES.filter((c) => PRIMARY_CITY_SLUGS.includes(c.slug)).map((c) => (
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
                navigate('/cities')
              }}
              className="mt-1 block w-full border-t border-piranha-charcoal/10 px-4 py-2 text-left text-sm font-medium text-piranha-burgundy transition-colors hover:bg-piranha-charcoal/5"
            >
              See all cities →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
