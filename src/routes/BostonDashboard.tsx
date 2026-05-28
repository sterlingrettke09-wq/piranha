import { useCallback, useState } from 'react'
import { Map } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'

interface Selection {
  lat: number
  lng: number
}

export default function BostonDashboard() {
  const [selected, setSelected] = useState<Selection | null>(null)
  const handleSelect = useCallback((lat: number, lng: number) => {
    setSelected({ lat, lng })
  }, [])

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0">
        <Map onPointSelect={handleSelect} focusedPoint={selected} />
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[28rem] max-w-[calc(100%-2rem)]">
        <SearchBar onSelect={handleSelect} />
      </div>
      <div
        className={`absolute z-10 md:right-4 md:top-4 md:bottom-4 md:left-auto md:w-[420px] md:max-h-none left-0 right-0 bottom-0 max-h-[60vh] ${
          selected ? 'block' : 'hidden md:block'
        }`}
      >
        <ParcelPanel selected={selected} />
      </div>
    </div>
  )
}
