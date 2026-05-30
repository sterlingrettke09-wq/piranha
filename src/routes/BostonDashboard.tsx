import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'
import { CityIntro } from '../components/boston/CityIntro'
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

  const [selected, setSelected] = useState<Selection | null>(null)
  const handleSelect = useCallback(
    (lat: number, lng: number) => setSelected({ lat, lng, city }),
    [city],
  )

  // Drop a stale selection when the city changes (header dropdown navigation).
  const activeSelection = selected && selected.city === city ? selected : null

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      <CityIntro key={city} city={current} />
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0">
        <Map
          key={city}
          center={current.center}
          zoom={current.zoom}
          showZoningRaster={city === 'boston'}
          onPointSelect={handleSelect}
          focusedPoint={activeSelection}
        />
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[26rem] max-w-[calc(100%-2rem)]">
        <SearchBar key={city} city={city} onSelect={handleSelect} />
      </div>
      <div
        className={`absolute z-10 md:right-4 md:top-4 md:bottom-4 md:left-auto md:w-[420px] md:max-h-none left-0 right-0 bottom-0 max-h-[60vh] ${
          activeSelection ? 'block' : 'hidden md:block'
        }`}
      >
        <ParcelPanel selected={activeSelection} city={city} />
      </div>
    </div>
  )
}
