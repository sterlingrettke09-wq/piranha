import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'
import { CityIntro } from '../components/boston/CityIntro'
import { introSeen } from '../components/boston/introSeen'
import { getCity } from '../config/cities'

interface Selection {
  lat: number
  lng: number
  city: string
}

export default function BostonDashboard() {
  const [params] = useSearchParams()
  const city = params.get('city') ?? 'boston'
  const current = getCity(city)
  // When arriving from a result's "Compare another parcel" link, cmp carries the
  // first parcel's full project spec (base64). The panel CTA then routes to /compare.
  const cmp = params.get('cmp')

  const [selected, setSelected] = useState<Selection | null>(null)
  const handleSelect = useCallback(
    (lat: number, lng: number) => setSelected({ lat, lng, city }),
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
            showZoningRaster={city === 'boston'}
            onPointSelect={handleSelect}
            focusedPoint={activeSelection}
          />
        )}
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[26rem] max-w-[calc(100%-2rem)] space-y-2">
        <SearchBar key={city} city={city} onSelect={handleSelect} />
        {cmp && (
          <p className="rounded-full bg-piranha-burgundy px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-piranha-bone shadow-lg">
            Pick a second parcel to compare
          </p>
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
