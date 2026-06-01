import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  BOSTON_CENTER,
  BOSTON_ZOOM,
  BRAND_OVERRIDES,
  ZONING_RASTER_URL,
} from '../../styles/bostonMapStyle'

interface MapProps {
  onPointSelect: (lat: number, lng: number) => void
  focusedPoint: { lat: number; lng: number } | null
  center?: [number, number]
  zoom?: number
  /** Boston-only zoning raster overlay. */
  showZoningRaster?: boolean
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function Map({
  onPointSelect,
  focusedPoint,
  center = BOSTON_CENTER,
  zoom = BOSTON_ZOOM,
  showZoningRaster = true,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!TOKEN) return
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom,
      attributionControl: true,
    })
    mapRef.current = map

    // Zoom in / out controls (the "magnifier"). Compass hidden — zoom is the ask.
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('style.load', () => {
      BRAND_OVERRIDES.forEach(({ layerId, property, value }) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, property as never, value as never)
        }
      })
      if (showZoningRaster && ZONING_RASTER_URL && !ZONING_RASTER_URL.startsWith('<')) {
        map.addSource('boston-zoning', {
          type: 'raster',
          tiles: [ZONING_RASTER_URL],
          tileSize: 256,
        })
        map.addLayer({
          id: 'boston-zoning',
          type: 'raster',
          source: 'boston-zoning',
          paint: { 'raster-opacity': 0.45 },
        })
      }
    })

    map.on('click', (e) => {
      onPointSelect(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onPointSelect, center, zoom, showZoningRaster])

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
