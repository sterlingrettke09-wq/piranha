import { SearchBox } from '@mapbox/search-js-react'
import { BOSTON_BBOX } from '../../types/parcel'

interface SearchBarProps {
  onSelect: (lat: number, lng: number) => void
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function SearchBar({ onSelect }: SearchBarProps) {
  if (!TOKEN) return null

  return (
    <SearchBox
      accessToken={TOKEN}
      options={{
        bbox: [BOSTON_BBOX.west, BOSTON_BBOX.south, BOSTON_BBOX.east, BOSTON_BBOX.north],
        country: 'us',
        proximity: { lng: -71.0589, lat: 42.3601 },
        types: 'address',
      }}
      placeholder="Search Boston address"
      onRetrieve={(res) => {
        const f = res.features?.[0]
        if (!f) return
        const [lng, lat] = f.geometry.coordinates
        onSelect(lat, lng)
      }}
    />
  )
}
