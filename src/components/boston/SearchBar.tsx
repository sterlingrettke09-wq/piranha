import { SearchBox } from '@mapbox/search-js-react'
import { getCity } from '../../config/cities'

interface SearchBarProps {
  city: string
  onSelect: (lat: number, lng: number) => void
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function SearchBar({ city, onSelect }: SearchBarProps) {
  // No Mapbox token (local dev without env, or a misconfigured deploy) — render
  // a disabled look-alike instead of vanishing, so the search slot still reads
  // as a real control and the user knows map clicks remain available.
  if (!TOKEN) {
    return (
      <input
        type="text"
        disabled
        aria-label="Address search"
        placeholder="Search unavailable — map clicks still work"
        className="w-full cursor-not-allowed rounded-md border border-piranha-charcoal/15 bg-white/80 px-4 py-2.5 text-sm text-piranha-charcoal/50 shadow-lg placeholder:text-piranha-charcoal/40"
      />
    )
  }

  const current = getCity(city)
  const { bbox, center, name } = current

  return (
    <div>
      <SearchBox
        accessToken={TOKEN}
        options={{
          bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
          country: 'us',
          proximity: { lng: center[0], lat: center[1] },
          types: 'address',
        }}
        placeholder={`Search ${name} address`}
        onRetrieve={(res) => {
          const f = res.features?.[0]
          if (!f) return
          const [lng, lat] = f.geometry.coordinates
          onSelect(lat, lng)
        }}
      />
      <p className="mt-1.5 text-xs text-piranha-charcoal/40">
        Searches are logged anonymously to improve coverage.
      </p>
    </div>
  )
}
