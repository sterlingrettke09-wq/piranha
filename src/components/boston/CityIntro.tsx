import { useEffect, useState } from 'react'
import type { City } from '../../config/cities'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Cinematic city entry — flies over a dark map of the actual city, then
 * dissolves into the dashboard. Plays once per city per browser session.
 * Self-contained: give it `key={city.slug}` so it re-runs when the city changes.
 */
export function CityIntro({ city }: { city: City }) {
  const [done, setDone] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return !!window.sessionStorage.getItem(`tpp_city_${city.slug}`)
    } catch {
      return false
    }
  })
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (done) return
    try {
      window.sessionStorage.setItem(`tpp_city_${city.slug}`, '1')
    } catch {
      // ignore
    }
    const reduce = prefersReduced()
    const tExit = setTimeout(() => setExiting(true), reduce ? 80 : 2100)
    const tDone = setTimeout(() => setDone(true), reduce ? 200 : 3000)
    return () => {
      clearTimeout(tExit)
      clearTimeout(tDone)
    }
  }, [done, city.slug])

  if (done) return null

  const [lng, lat] = city.center
  const mapUrl = TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lng},${lat},12.4,0/1600x900@2x?access_token=${TOKEN}`
    : null

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => setDone(true), 700)
  }

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[60] cursor-pointer overflow-hidden bg-[#10100f] transition-opacity duration-700 ease-in-out ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {mapUrl && (
        <img src={mapUrl} alt="" aria-hidden className="tpp-kenburns h-full w-full object-cover opacity-95" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55))]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="tpp-intro-rise flex flex-col items-center">
          <span className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-piranha-gold">
            Now entering
          </span>
          <h1 className="font-serif text-6xl leading-[0.95] tracking-tight text-piranha-bone drop-shadow-[0_2px_24px_rgba(0,0,0,0.7)] sm:text-8xl">
            {city.name}
          </h1>
          <span className="mt-7 h-px w-16 bg-piranha-gold/70" />
          <p className="mt-6 max-w-md text-sm uppercase tracking-[0.22em] text-piranha-bone/70">
            {city.tagline}
          </p>
        </div>
      </div>
    </div>
  )
}
