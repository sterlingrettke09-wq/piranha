import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { BOSTON_CENTER, BOSTON_ZOOM, BRAND_OVERRIDES } from '../../styles/bostonMapStyle'

interface MapProps {
  onPointSelect: (lat: number, lng: number) => void
  focusedPoint: { lat: number; lng: number } | null
  /**
   * Initial view only, read once at map creation. To move an existing map,
   * pass a new `focusedPoint` — or remount with a `key` (the dashboard keys
   * this component by city) for a different city's view.
   */
  center?: [number, number]
  zoom?: number
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function Map({
  onPointSelect,
  focusedPoint,
  center = BOSTON_CENTER,
  zoom = BOSTON_ZOOM,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  // Kept in refs so the create-once effect below genuinely runs once: the
  // click handler always sees the latest callback, and a caller passing a new
  // inline `center` array or arrow function can't tear down and rebuild the
  // whole (expensive) Mapbox GL instance on every render.
  const onPointSelectRef = useRef(onPointSelect)
  useEffect(() => {
    onPointSelectRef.current = onPointSelect
  }, [onPointSelect])
  const initialViewRef = useRef({ center, zoom })

  useEffect(() => {
    if (!TOKEN) return
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialViewRef.current.center,
      zoom: initialViewRef.current.zoom,
      attributionControl: true,
    })
    mapRef.current = map

    // Zoom in / out controls (the "magnifier"). Compass hidden — zoom is the ask.
    // Bottom-left stays clear of the centered search bar (mobile) and the
    // right-side parcel panel (desktop).
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-left')

    map.on('style.load', () => {
      BRAND_OVERRIDES.forEach(({ layerId, property, value }) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, property as never, value as never)
        }
      })
    })

    map.on('click', (e) => {
      onPointSelectRef.current(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusedPoint) return
    map.flyTo({ center: [focusedPoint.lng, focusedPoint.lat], zoom: 17, essential: true })
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new mapboxgl.Marker({ color: '#7A1B2E' })
      .setLngLat([focusedPoint.lng, focusedPoint.lat])
      .addTo(map)
  }, [focusedPoint])

  if (!TOKEN) {
    return (
      <div className="h-full grid place-items-center bg-piranha-charcoal/5">
        <div className="text-center max-w-sm p-6">
          <p className="font-semibold uppercase tracking-wider text-sm text-piranha-burgundy">
            Map unavailable
          </p>
          <p className="text-sm mt-2 text-piranha-charcoal/70">
            VITE_MAPBOX_TOKEN is not configured. Add it to .env to enable the map.
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}
