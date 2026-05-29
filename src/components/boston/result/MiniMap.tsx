import { useState } from 'react'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Static Mapbox image of the parcel location — context for a shared result.
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const [failed, setFailed] = useState(false)
  if (!TOKEN || failed) return null
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `pin-s+7a1b2e(${lng},${lat})/${lng},${lat},14,0/640x280@2x?access_token=${TOKEN}`
  return (
    <img
      src={url}
      alt="Map of the parcel location"
      className="h-48 w-full rounded-xl border border-piranha-charcoal/10 object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
