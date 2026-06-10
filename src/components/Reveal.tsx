import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** 'up' = fade + rise; 'float' = scale up + de-blur ("float to the front"). */
  variant?: 'up' | 'float'
  /** Stagger delay in ms. */
  delay?: number
  className?: string
}

/**
 * Reveals its children once when scrolled into view (IntersectionObserver).
 *
 * Reliability guarantees (a reveal that never fires is worse than no reveal —
 * it leaves content stuck at opacity 0):
 *   - If IntersectionObserver is unavailable, content is visible immediately.
 *   - A short failsafe timer reveals anything still hidden, so a missed
 *     observer callback can never trap content off-screen.
 *   - A low threshold + negative-bottom rootMargin reveals slightly BEFORE the
 *     block fully enters, so nothing lingers half-faded at the fold.
 */
export function Reveal({ children, variant = 'up', delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Start hidden only when we actually have a working observer to reveal us;
  // otherwise render visible from first paint (SSR-safe + no-JS-friendly).
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return

    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setVisible(true)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal()
            io.disconnect()
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
    )
    io.observe(el)

    // Failsafe: if the observer never fires (tab restore, layout quirk, a
    // block that mounts already past the viewport without an intersection
    // callback), reveal anyway so content can't stay invisible.
    const failsafe = window.setTimeout(reveal, 1500)

    return () => {
      io.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [])

  const base = variant === 'float' ? 'reveal-float' : 'reveal'
  return (
    <div
      ref={ref}
      className={`${base} ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
