import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map, type ParcelShapeFeature } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'
import { CityIntro } from '../components/boston/CityIntro'
import { introSeen } from '../components/boston/introSeen'
import { getCity, isCitySlug, DEFAULT_CITY } from '../config/cities'
import { quantizeCoord } from '../lib/coords'
import { decodeJsonB64 } from '../lib/b64'
import type { AnalysisInput } from '../types/analysis'

interface Selection {
  lat: number
  lng: number
  city: string
}

export default function BostonDashboard() {
  const [params, setParams] = useSearchParams()
  const rawCity = params.get('city')
  // An unknown ?city= slug (typo, dead link) silently rendered Boston while the
  // URL kept claiming another city. Normalize the URL instead so what you see
  // and what you share always match.
  const unknownCity = rawCity !== null && !isCitySlug(rawCity)
  const city = rawCity !== null && isCitySlug(rawCity) ? rawCity : DEFAULT_CITY
  const current = getCity(city)
  useEffect(() => {
    if (unknownCity) {
      const next = new URLSearchParams(params)
      next.delete('city')
      setParams(next, { replace: true })
    }
  }, [unknownCity, params, setParams])
  // When arriving from a result's "Compare another parcel" link, cmp carries the
  // first parcel's full project spec (base64). The panel CTA then routes to /compare.
  const cmp = params.get('cmp')

  const [selected, setSelected] = useState<Selection | null>(null)
  // Quantize at the source: every downstream URL (parcel fetch, wizard link,
  // result link, compare encoding) inherits cache-friendly coordinates.
  const handleSelect = useCallback(
    (lat: number, lng: number) => setSelected({ lat: quantizeCoord(lat), lng: quantizeCoord(lng), city }),
    [city],
  )

  // The dashboard map mounts immediately if the intro has already played this
  // session; otherwise it waits for the intro to reach its hand-off frame, so
  // the two mapbox instances never run concurrently through the dive. Recompute
  // on city change during render (before CityIntro's effect marks it seen).
  const [prevCity, setPrevCity] = useState(city)
  const [showMap, setShowMap] = useState(() => introSeen(city))
  if (city !== prevCity) {
    setPrevCity(city)
    setShowMap(introSeen(city))
  }

  // Drop a stale selection when the city changes (header dropdown navigation).
  const activeSelection = selected && selected.city === city ? selected : null

  // Selected-parcel polygon (WO-8.1a). Fetched from /api/parcel-shape on every
  // selection — abortable, and keyed on the SAME quantized coords as the parcel
  // fetch so the two collapse onto one CDN cache entry. The fetched shape is
  // tagged with the selection key it belongs to; rendering derives the live
  // shape from that key, so a stale or deselected/city-changed selection clears
  // the outline WITHOUT a synchronous setState in the effect body.
  const selectionKey = activeSelection
    ? `${activeSelection.city},${activeSelection.lat},${activeSelection.lng}`
    : null
  const [shapeResult, setShapeResult] = useState<{ key: string; shape: ParcelShapeFeature | null } | null>(null)
  useEffect(() => {
    if (!selectionKey || !activeSelection) return
    const ctrl = new AbortController()
    const url = `/api/parcel-shape?city=${encodeURIComponent(activeSelection.city)}&lat=${activeSelection.lat}&lng=${activeSelection.lng}`
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ParcelShapeFeature>) : null))
      .then((shape) => {
        if (!ctrl.signal.aborted) setShapeResult({ key: selectionKey, shape })
      })
      .catch(() => {
        // 404 (no parcel) or network error → no outline; the pin still marks it.
      })
    return () => ctrl.abort()
  }, [selectionKey, activeSelection])
  // Only show a shape that matches the CURRENT selection (clears on city change /
  // deselect / a newer click whose fetch hasn't resolved yet).
  const selectedShape = shapeResult && shapeResult.key === selectionKey ? shapeResult.shape : null

  // cmp carries the first parcel's AnalysisInput (no address field) — name it by
  // parcelId so the banner is honest about which parcel you're comparing against.
  const cmpInput = cmp ? decodeJsonB64<AnalysisInput>(cmp) : null
  const cmpLabel = cmpInput?.parcelId ? `parcel ${cmpInput.parcelId}` : 'your first parcel'

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      <CityIntro key={city} city={current} onReveal={() => setShowMap(true)} />
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0">
        {showMap && (
          <Map
            key={city}
            center={current.center}
            zoom={current.zoom}
            onPointSelect={handleSelect}
            focusedPoint={activeSelection}
            selectedShape={selectedShape}
            zoningLayer={current.zoningLayer}
          />
        )}
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[26rem] max-w-[calc(100%-2rem)] space-y-2">
        <SearchBar key={city} city={city} onSelect={handleSelect} />
        {cmp && (
          <div className="flex items-center gap-2 rounded-full bg-piranha-burgundy px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-piranha-bone shadow-lg">
            <span className="flex-1 text-center">Comparing against {cmpLabel} — pick a second parcel</span>
            <button
              type="button"
              aria-label="Cancel comparing"
              onClick={() => {
                const next = new URLSearchParams(params)
                next.delete('cmp')
                setParams(next)
              }}
              className="-mr-1 shrink-0 rounded-full px-1.5 leading-none text-piranha-bone/80 transition-colors hover:text-piranha-bone"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div
        className={`absolute z-10 md:right-4 md:top-4 md:bottom-4 md:left-auto md:w-[420px] md:max-h-none left-0 right-0 bottom-0 max-h-[60vh] ${
          activeSelection ? 'block' : 'hidden md:block'
        }`}
      >
        <ParcelPanel selected={activeSelection} city={city} cmp={cmp} />
      </div>
    </div>
  )
}
