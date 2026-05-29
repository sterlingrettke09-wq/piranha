import { useCallback, useState } from 'react'
import { Map } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'
import { CitySelector } from '../components/boston/CitySelector'
import { DEFAULT_CITY, getCity } from '../config/cities'
import { Button } from '../components/ui/Button'

interface Selection {
  lat: number
  lng: number
}

export default function BostonDashboard() {
  const [selected, setSelected] = useState<Selection | null>(null)
  const [city, setCity] = useState(DEFAULT_CITY)
  const handleSelect = useCallback((lat: number, lng: number) => {
    setSelected({ lat, lng })
  }, [])

  function changeCity(slug: string) {
    setCity(slug)
    setSelected(null)
  }

  const current = getCity(city)
  const live = current.live

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0">
        {live ? (
          <Map
            key={city}
            center={current.center}
            zoom={current.zoom}
            showZoningRaster={city === 'boston'}
            onPointSelect={handleSelect}
            focusedPoint={selected}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-piranha-charcoal/5 px-6">
            <div className="max-w-md text-center">
              <h2 className="font-serif text-3xl tracking-tight text-piranha-charcoal">
                {current.name} is coming soon
              </h2>
              <p className="mt-3 text-piranha-charcoal/70">
                We’re wiring up {current.name}’s zoning and parcel data. Boston and New
                York are live today — switch to explore them.
              </p>
              <div className="mt-6">
                <Button size="sm" onClick={() => changeCity('boston')}>
                  Explore Boston
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute left-4 top-4 z-20">
        <CitySelector value={city} onChange={changeCity} />
      </div>

      {live && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[24rem] max-w-[calc(100%-12rem)]">
            <SearchBar onSelect={handleSelect} />
          </div>
          <div
            className={`absolute z-10 md:right-4 md:top-4 md:bottom-4 md:left-auto md:w-[420px] md:max-h-none left-0 right-0 bottom-0 max-h-[60vh] ${
              selected ? 'block' : 'hidden md:block'
            }`}
          >
            <ParcelPanel selected={selected} city={city} />
          </div>
        </>
      )}
    </div>
  )
}
