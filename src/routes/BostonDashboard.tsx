import { useState } from 'react'

interface Selection {
  lat: number
  lng: number
}

export default function BostonDashboard() {
  const [selected, setSelected] = useState<Selection | null>(null)
  void setSelected

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0 bg-piranha-charcoal/5 grid place-items-center">
        <p className="text-sm uppercase tracking-wider">Map placeholder — Task 15 wires Mapbox.</p>
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[28rem] max-w-[calc(100%-2rem)]">
        <div className="bg-piranha-bone border border-piranha-charcoal/10 p-3 text-sm">
          Search placeholder — Task 16 wires geocoder.
        </div>
      </div>
      {selected && (
        <div className="absolute right-4 top-4 bottom-4 z-10 w-[420px] max-w-[calc(100%-2rem)]">
          <div className="bg-piranha-bone border border-piranha-charcoal/10 h-full p-4 text-sm">
            Panel placeholder — Task 18 wires data. lat={selected.lat} lng={selected.lng}
          </div>
        </div>
      )}
    </div>
  )
}
