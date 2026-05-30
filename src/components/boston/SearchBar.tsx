import { SearchBox } from '@mapbox/search-js-react'
import { getCity } from '../../config/cities'

interface SearchBarProps {
  city: string
  onSelect: (lat: number, lng: number) => void
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function SearchBar({ city, onSelect }: SearchBarProps) {
  if (!TOKEN) return null

  const current = getCity(city)
  const { bbox, center, name } = current

  return (
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
  )
}
