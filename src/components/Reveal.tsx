import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** 'up' = fade + rise; 'float' = scale up + de-blur ("float to the front"). */
  variant?: 'up' | 'float'
  /** Stagger delay in ms. */
  delay?: number
  className?: string
}

/** Reveals its children once when scrolled into view (IntersectionObserver). */
export function Reveal({ children, variant = 'up', delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
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
