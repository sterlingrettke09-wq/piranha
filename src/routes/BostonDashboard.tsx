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
      <div className="absolute right-4 top-4 bottom-4 z-10 w-[420px] max-w-[calc(100%-2rem)]">
        <ParcelPanel selected={selected} />
      </div>
    </div>
  )
}
