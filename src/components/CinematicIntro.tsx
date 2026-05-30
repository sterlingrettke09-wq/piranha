import { useEffect, useRef, useState } from 'react'
import { FishSchool } from './FishSchool'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * Scroll-pinned opener (Orchestra-style). One tall section with a sticky stage:
 *   p 0.00–0.30  the piranha photo collapses on itself and fades…
 *   p 0.20–0.45  …revealing the title + swimming school…
 *   p 0.70–1.00  …which then collapse inward as the first page rises up.
 */
export function CinematicIntro() {
  const [reduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  // Play only on the first load of a browser session; skip on later navigations.
  const [show] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return !window.sessionStorage.getItem('tpp_intro_seen')
    } catch {
      return true
    }
  })
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    try {
      window.sessionStorage.setItem('tpp_intro_seen', '1')
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [])

  const sectionRef = useRef<HTMLDivElement | null>(null)
  const photoRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLDivElement | null>(null)
  const schoolRef = useRef<HTMLDivElement | null>(null)
  const cueRef = useRef<HTMLDivElement | null>(null)
  const photoGone = useRef(false)

  useEffect(() => {
    if (reduce) return
    const section = sectionRef.current
    if (!section) return

    let raf = 0
    const apply = () => {
      const rect = section.getBoundingClientRect()
      const total = section.offsetHeight - window.innerHeight
      const p = clamp01(-rect.top / Math.max(1, total))

      if (photoRef.current) {
        const f = smooth(0, 0.26, p)
        if (f >= 0.999) photoGone.current = true
        const gone = photoGone.current
        photoRef.current.style.opacity = gone ? '0' : String(1 - f)
        photoRef.current.style.transform = `scale(${1 - 0.16 * (gone ? 1 : f)})`
      }
      if (titleRef.current) {
        // Title is set on the photo from the start; it only expands away on exit.
        const out = smooth(0.62, 0.9, p)
        titleRef.current.style.opacity = String(1 - out)
        titleRef.current.style.transform = `scale(${1 + 0.55 * out})`
      }
      if (schoolRef.current) {
        // The school zooms continuously from the moment you start scrolling — an
        // Orchestra-style fly-in — then fades as the first page arrives.
        const e = smooth(0.18, 1, p)
        schoolRef.current.style.transform = `scale(${1 + 1.1 * e})`
        schoolRef.current.style.opacity = String(1 - smooth(0.86, 1, p))
      }
      if (cueRef.current) {
        cueRef.current.style.opacity = String(1 - smooth(0.02, 0.12, p))
      }
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduce])

  const Photo = !photoFailed ? (
    <>
      <img
        src="/images/piranha-hero.jpg"
        alt=""
        aria-hidden="true"
        onError={() => setPhotoFailed(true)}
        className="tpp-kenburns h-full w-full object-cover"
      />
      {/* Cinematic grade: bottom-anchored gradient for title legibility + an
          edge vignette so the frame feels composed, not flat. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55))]" />
    </>
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#16110f]">
      <img src="/logo/piranha-fish-burgundy.png" alt="" aria-hidden="true" className="tpp-kenburns w-[min(64vw,460px)]" />
    </div>
  )

  // Already seen this session — skip the intro entirely; the page starts at the hero.
  if (!show) return null

  // Reduced motion: a calm, static title over the school. No scroll choreography.
  if (reduce) {
    return (
      <section className="relative h-screen overflow-hidden bg-[#16110f]">
        <FishSchool className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-serif text-5xl tracking-tight text-piranha-bone drop-shadow-lg sm:text-7xl">
            The Piranha Project
          </h1>
          <p className="mt-5 text-sm uppercase tracking-[0.28em] text-piranha-bone/70">
            Bite through the red tape
          </p>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} className="relative h-[300vh] bg-[#16110f]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* School (behind), collapses inward at the end */}
        <div ref={schoolRef} className="absolute inset-0 z-10 will-change-transform">
          <FishSchool className="absolute inset-0 h-full w-full" />
        </div>

        {/* Opening photo, collapses on itself (one-way) to reveal the school */}
        <div ref={photoRef} className="absolute inset-0 z-30 will-change-transform">
          {Photo}
        </div>

        {/* Title — set on the photo from the first frame, then over the school */}
        <div
          ref={titleRef}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center will-change-transform"
        >
          <div className="tpp-intro-rise flex flex-col items-center">
            <span className="mb-6 text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-piranha-gold">
              Regulatory intelligence for builders
            </span>
            <h1 className="font-serif text-6xl leading-[0.95] tracking-tight text-piranha-bone drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-8xl">
              The Piranha Project
            </h1>
            <span className="mt-7 h-px w-16 bg-piranha-gold/70" />
            <p className="mt-6 text-sm uppercase tracking-[0.3em] text-piranha-bone/75">
              Bite through the red tape
            </p>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          ref={cueRef}
          className="absolute bottom-10 left-1/2 z-50 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-piranha-bone/70"
        >
          Scroll ↓
        </div>
      </div>
    </section>
  )
}
