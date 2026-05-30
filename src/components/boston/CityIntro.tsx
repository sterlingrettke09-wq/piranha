import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { City } from '../../config/cities'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Cinematic city entry — a live satellite map that dives from a high sky view
 * down into the city with a 3D tilt + terrain, then dissolves into the
 * dashboard. Plays once per city per browser session. Give it `key={city.slug}`.
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
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (done) return
    try {
      window.sessionStorage.setItem(`tpp_city_${city.slug}`, '1')
    } catch {
      // ignore
    }

    const reduce = prefersReduced()
    const [clng, clat] = city.center
    const [llng, llat] = city.landmark ?? city.center
    const canDive = !!TOKEN && !reduce && !!mapEl.current && !mapRef.current

    let fallbackExit: ReturnType<typeof setTimeout> | null = null

    if (canDive) {
      mapboxgl.accessToken = TOKEN as string
      const map = new mapboxgl.Map({
        container: mapEl.current as HTMLDivElement,
        style: 'mapbox://styles/mapbox/satellite-v9',
        // Start: high and tilted over the landmark.
        center: [llng, llat],
        zoom: Math.max(3, city.zoom - 3.6),
        pitch: 46,
        bearing: -12,
        interactive: false,
        attributionControl: false,
      })
      mapRef.current = map
      map.on('load', () => {
        try {
          map.addSource('tpp-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          })
          map.setTerrain({ source: 'tpp-dem', exaggeration: 1.3 })
        } catch {
          // terrain optional
        }
        // Dive down AND flatten to the dashboard's exact camera, so the
        // hand-off is just the satellite dissolving into the live map — no jump.
        map.flyTo({
          center: [clng, clat],
          zoom: city.zoom,
          pitch: 0,
          bearing: 0,
          duration: 4200,
          curve: 1.45,
          essential: true,
        })
        // Begin the crossfade the moment the camera settles at the dashboard frame.
        map.once('moveend', () => {
          setExiting(true)
          setTimeout(() => setDone(true), 1000)
        })
      })
      // Safety net if 'moveend' never fires.
      fallbackExit = setTimeout(() => {
        setExiting(true)
        setTimeout(() => setDone(true), 1000)
      }, 6000)
    }

    const fast = reduce || !TOKEN
    const tExit = fast ? setTimeout(() => setExiting(true), 80) : null
    const tDone = fast ? setTimeout(() => setDone(true), 220) : null
    return () => {
      if (tExit) clearTimeout(tExit)
      if (tDone) clearTimeout(tDone)
      if (fallbackExit) clearTimeout(fallbackExit)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [done, city.slug, city.center, city.landmark, city.zoom])

  if (done) return null

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => setDone(true), 700)
  }

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[60] cursor-pointer overflow-hidden bg-[#10100f] transition-opacity duration-1000 ease-in-out ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div ref={mapEl} className="absolute inset-0 h-full w-full" />
      {/* Legibility vignette behind the title; keeps the city visible. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_center,rgba(0,0,0,0.55),rgba(0,0,0,0.12)_55%,transparent_78%)]" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="tpp-intro-rise flex flex-col items-center">
          <span className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-piranha-gold">
            Now entering
          </span>
          <h1 className="font-serif text-6xl leading-[0.95] tracking-tight text-piranha-bone drop-shadow-[0_2px_24px_rgba(0,0,0,0.8)] sm:text-8xl">
            {city.name}
          </h1>
        </div>
      </div>
    </div>
  )
}
