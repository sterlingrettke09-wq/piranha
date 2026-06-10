import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  BOSTON_CENTER,
  BOSTON_ZOOM,
  BRAND,
  BRAND_OVERRIDES,
  classifyZoningFamily,
  ZONING_FAMILY_COLORS,
  ZONING_FAMILY_LABELS,
  type ZoningFamily,
} from '../../styles/bostonMapStyle'

export interface ParcelShapeFeature {
  type: 'Feature'
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  properties: { parcelId: string | null }
}

interface MapProps {
  onPointSelect: (lat: number, lng: number) => void
  focusedPoint: { lat: number; lng: number } | null
  /** The snapped parcel polygon for the current selection, or null to clear. */
  selectedShape?: ParcelShapeFeature | null
  /** City's zoning-district overlay layer, or undefined to disable the overlay. */
  zoningLayer?: { url: string; codeField: string }
  /**
   * Initial view only, read once at map creation. To move an existing map,
   * pass a new `focusedPoint` — or remount with a `key` (the dashboard keys
   * this component by city) for a different city's view.
   */
  center?: [number, number]
  zoom?: number
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Source/layer ids. Selected-parcel highlight sits ABOVE the zoning fill so the
// burgundy outline reads over the translucent district color.
const ZONING_SRC = 'tpp-zoning'
const ZONING_FILL = 'tpp-zoning-fill'
const SELECTED_SRC = 'tpp-selected-parcel'
const SELECTED_FILL = 'tpp-selected-fill'
const SELECTED_LINE = 'tpp-selected-line'

const ZONING_MIN_ZOOM = 14
const MOVE_DEBOUNCE_MS = 400
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// A data-driven fill-color expression keyed off the per-feature family we tag
// during fetch (see fetchZoning). Built once; the colors come from the shared
// palette so the legend and the map can never drift.
const familyColorExpression = (): mapboxgl.Expression => {
  const cases: (string | string[])[] = ['match', ['get', '_family']]
  for (const fam of Object.keys(ZONING_FAMILY_COLORS) as ZoningFamily[]) {
    cases.push(fam, ZONING_FAMILY_COLORS[fam])
  }
  cases.push(ZONING_FAMILY_COLORS.other) // default
  return cases as unknown as mapboxgl.Expression
}

export function Map({
  onPointSelect,
  focusedPoint,
  selectedShape = null,
  zoningLayer,
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

  // Overlay state lives in refs for the same reason: the moveend handler (wired
  // ONCE inside the create-once effect) reads the latest zoning config and abort
  // controller without re-binding. Re-binding map events on every render would
  // either leak listeners or fight the create-once contract.
  const zoningLayerRef = useRef(zoningLayer)
  const zoningAbortRef = useRef<AbortController | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const styleReadyRef = useRef(false)
  const [legendOpen, setLegendOpen] = useState(false)
  // Whether the overlay can show at the current zoom — drives the legend pill's
  // visibility. Updated from the (once-wired) zoom handler.
  const [overlayActive, setOverlayActive] = useState(false)

  // Ensure the overlay + selected sources/layers exist on the current style.
  function ensureLayers(map: mapboxgl.Map) {
    if (!map.getSource(ZONING_SRC)) {
      map.addSource(ZONING_SRC, { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: ZONING_FILL,
        type: 'fill',
        source: ZONING_SRC,
        paint: { 'fill-color': familyColorExpression(), 'fill-opacity': 0.18 },
      })
    }
    if (!map.getSource(SELECTED_SRC)) {
      map.addSource(SELECTED_SRC, { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: SELECTED_FILL,
        type: 'fill',
        source: SELECTED_SRC,
        paint: { 'fill-color': BRAND.burgundy, 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: SELECTED_LINE,
        type: 'line',
        source: SELECTED_SRC,
        paint: { 'line-color': BRAND.burgundy, 'line-width': 2.5 },
      })
    }
  }

  // Keep the selected polygon in a ref so the create-once style.load handler can
  // re-apply it after a style reload without depending on render state.
  const selectedShapeRef = useRef<ParcelShapeFeature | null>(selectedShape)
  function applySelected(map: mapboxgl.Map, shape: ParcelShapeFeature | null) {
    const src = map.getSource(SELECTED_SRC) as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    src.setData(shape ?? EMPTY_FC)
  }

  // Fetch the zoning districts intersecting the current viewport and tag each
  // feature with its family for the data-driven fill. Aborts the prior request.
  async function fetchZoning(map: mapboxgl.Map) {
    const cfg = zoningLayerRef.current
    const src = map.getSource(ZONING_SRC) as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    if (!cfg || map.getZoom() < ZONING_MIN_ZOOM) {
      src.setData(EMPTY_FC)
      return
    }
    zoningAbortRef.current?.abort()
    const ctrl = new AbortController()
    zoningAbortRef.current = ctrl

    const b = map.getBounds()
    if (!b) return
    const envelope = {
      xmin: b.getWest(),
      ymin: b.getSouth(),
      xmax: b.getEast(),
      ymax: b.getNorth(),
      spatialReference: { wkid: 4326 },
    }
    const base = cfg.url.endsWith('/') ? cfg.url.slice(0, -1) : cfg.url
    const u = new URL(base + '/query')
    u.searchParams.set('where', '1=1')
    u.searchParams.set('geometry', JSON.stringify(envelope))
    u.searchParams.set('geometryType', 'esriGeometryEnvelope')
    u.searchParams.set('inSR', '4326')
    u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
    u.searchParams.set('outFields', cfg.codeField)
    u.searchParams.set('returnGeometry', 'true')
    u.searchParams.set('outSR', '4326')
    u.searchParams.set('f', 'geojson')
    u.searchParams.set('resultRecordCount', '400')

    try {
      const res = await fetch(u.toString(), { signal: ctrl.signal })
      if (!res.ok) return
      const fc = (await res.json()) as GeoJSON.FeatureCollection
      if (ctrl.signal.aborted || !fc || fc.type !== 'FeatureCollection') return
      for (const f of fc.features ?? []) {
        const code = (f.properties?.[cfg.codeField] as string | undefined) ?? null
        f.properties = { ...(f.properties ?? {}), _family: classifyZoningFamily(code), _code: code }
      }
      // The source can vanish if the style reloaded mid-flight.
      const live = map.getSource(ZONING_SRC) as mapboxgl.GeoJSONSource | undefined
      live?.setData(fc)
    } catch {
      // Network/CORS failure → leave the last data (or empty); no overlay ≠ broken map.
    }
  }

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

    const onStyleLoad = () => {
      BRAND_OVERRIDES.forEach(({ layerId, property, value }) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, property as never, value as never)
        }
      })
      // (Re)create our sources/layers after every style load and re-apply the
      // current selection + zoning so a style reload doesn't drop the overlay.
      ensureLayers(map)
      styleReadyRef.current = true
      applySelected(map, selectedShapeRef.current)
      void fetchZoning(map)
    }
    map.on('style.load', onStyleLoad)

    map.on('click', (e) => {
      onPointSelectRef.current(e.lngLat.lat, e.lngLat.lng)
    })

    // Debounced viewport refetch — wired once, reads the latest config via ref.
    const onMoveEnd = () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
      moveTimerRef.current = setTimeout(() => void fetchZoning(map), MOVE_DEBOUNCE_MS)
    }
    map.on('moveend', onMoveEnd)

    // Zoom drives whether the overlay (and its legend pill) can appear.
    const onZoom = () => {
      const active = !!zoningLayerRef.current && map.getZoom() >= ZONING_MIN_ZOOM
      setOverlayActive(active)
    }
    map.on('zoom', onZoom)

    // Hover affordance: pointer cursor + a code chip popup over the overlay.
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'tpp-zoning-popup' })
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onMove = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const code = (f?.properties?._code as string | undefined) ?? null
      if (!code) {
        popup.remove()
        return
      }
      const chip = `<span style="display:inline-block;font:600 11px/1.4 system-ui,sans-serif;letter-spacing:0.04em;color:#1A1A1A">${escapeHtml(code)}</span>`
      popup.setLngLat(e.lngLat).setHTML(chip).addTo(map)
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    }
    map.on('mouseenter', ZONING_FILL, onEnter)
    map.on('mousemove', ZONING_FILL, onMove)
    map.on('mouseleave', ZONING_FILL, onLeave)

    return () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
      zoningAbortRef.current?.abort()
      popup.remove()
      map.remove()
      mapRef.current = null
      styleReadyRef.current = false
    }
  }, [])

  // React to a new/cleared selection (does NOT touch the create-once instance).
  useEffect(() => {
    selectedShapeRef.current = selectedShape
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    applySelected(map, selectedShape)
  }, [selectedShape])

  // React to a city's zoning config change (the dashboard remounts by city via
  // `key`, so this mostly covers the first paint). Refetch with the new layer.
  useEffect(() => {
    zoningLayerRef.current = zoningLayer
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    setOverlayActive(!!zoningLayer && map.getZoom() >= ZONING_MIN_ZOOM)
    void fetchZoning(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoningLayer?.url])

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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Collapsible zoning legend — bottom-right, above the Mapbox attribution.
          Hidden until the overlay can show (zoom ≥ 14 with a configured layer). */}
      {overlayActive && (
        <div className="pointer-events-auto absolute bottom-8 right-2 z-10">
          {legendOpen ? (
            <div className="rounded-lg bg-piranha-bone/95 px-3 py-2 text-[11px] shadow-md ring-1 ring-piranha-charcoal/10 backdrop-blur">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70">Zoning</span>
                <button
                  type="button"
                  aria-label="Collapse zoning legend"
                  onClick={() => setLegendOpen(false)}
                  className="leading-none text-piranha-charcoal/50 hover:text-piranha-charcoal"
                >
                  ✕
                </button>
              </div>
              <ul className="space-y-1">
                {(Object.keys(ZONING_FAMILY_COLORS) as ZoningFamily[]).map((fam) => (
                  <li key={fam} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: ZONING_FAMILY_COLORS[fam] }}
                    />
                    <span className="text-piranha-charcoal/75">{ZONING_FAMILY_LABELS[fam]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLegendOpen(true)}
              className="rounded-full bg-piranha-bone/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70 shadow-md ring-1 ring-piranha-charcoal/10 backdrop-blur hover:text-piranha-charcoal"
            >
              Zoning
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
