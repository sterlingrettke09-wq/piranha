import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map, type ParcelShapeFeature } from '../components/boston/Map'
import { SearchBar } from '../components/boston/SearchBar'
import { ParcelPanel } from '../components/boston/ParcelPanel'
import { CityIntro } from '../components/boston/CityIntro'
import { introSeen } from '../components/boston/introSeen'
import { getCity, isCitySlug, DEFAULT_CITY } from '../config/cities'
import { EXAMPLE_PARCELS } from '../config/exampleParcels'
import { quantizeCoord } from '../lib/coords'
import { decodeJsonB64 } from '../lib/b64'
import { useParcelInfo } from '../hooks/useParcelInfo'
import type { AnalysisInput } from '../types/analysis'

interface Selection {
  lat: number
  lng: number
  city: string
  /** The address the GEOCODER returned for the search that produced this point,
   *  when a search produced it. Absent for a map click, the example-parcel
   *  button and any other non-search selection — and absent is NOT "agreed":
   *  `checkAddress` renders it as `not-searched` and says nothing, because
   *  there is no user expectation to contradict. */
  searchedAddress?: string
}

export default function BostonDashboard() {
  const [params, setParams] = useSearchParams()
  const rawCity = params.get('city')
  // An unknown ?city= slug (typo, dead link) silently rendered Boston while the
  // URL kept claiming another city. Normalize the URL instead so what you see
  // and what you share always match.
  const unknownCity = rawCity !== null && !isCitySlug(rawCity)
  const city = rawCity !== null && isCitySlug(rawCity) ? rawCity : DEFAULT_CITY
  const current = getCity(city)
  useEffect(() => {
    if (unknownCity) {
      const next = new URLSearchParams(params)
      next.delete('city')
      setParams(next, { replace: true })
    }
  }, [unknownCity, params, setParams])
  // When arriving from a result's "Compare another parcel" link, cmp carries the
  // first parcel's full project spec (base64). The panel CTA then routes to /compare.
  const cmp = params.get('cmp')

  const [selected, setSelected] = useState<Selection | null>(null)
  // Quantize at the source: every downstream URL (parcel fetch, wizard link,
  // result link, compare encoding) inherits cache-friendly coordinates.
  const handleSelect = useCallback(
    (lat: number, lng: number, searchedAddress?: string) =>
      setSelected({ lat: quantizeCoord(lat), lng: quantizeCoord(lng), city, searchedAddress }),
    [city],
  )

  // The dashboard map mounts immediately if the intro has already played this
  // session; otherwise it waits for the intro to reach its hand-off frame, so
  // the two mapbox instances never run concurrently through the dive. Recompute
  // on city change during render (before CityIntro's effect marks it seen).
  const [prevCity, setPrevCity] = useState(city)
  const [showMap, setShowMap] = useState(() => introSeen(city))
  if (city !== prevCity) {
    setPrevCity(city)
    setShowMap(introSeen(city))
  }

  // Drop a stale selection when the city changes (header dropdown navigation).
  const activeSelection = selected && selected.city === city ? selected : null

  // Selected-parcel polygon (WO-8.1a). Fetched from /api/parcel-shape on every
  // selection — abortable, and keyed on the SAME quantized coords as the parcel
  // fetch so the two collapse onto one CDN cache entry. The fetched shape is
  // tagged with the selection key it belongs to; rendering derives the live
  // shape from that key, so a stale or deselected/city-changed selection clears
  // the outline WITHOUT a synchronous setState in the effect body.
  const selectionKey = activeSelection
    ? `${activeSelection.city},${activeSelection.lat},${activeSelection.lng}`
    : null
  const [shapeResult, setShapeResult] = useState<{ key: string; shape: ParcelShapeFeature | null } | null>(null)
  useEffect(() => {
    if (!selectionKey || !activeSelection) return
    const ctrl = new AbortController()
    const url = `/api/parcel-shape?city=${encodeURIComponent(activeSelection.city)}&lat=${activeSelection.lat}&lng=${activeSelection.lng}`
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ParcelShapeFeature>) : null))
      .then((shape) => {
        if (!ctrl.signal.aborted) setShapeResult({ key: selectionKey, shape })
      })
      .catch(() => {
        // 404 (no parcel) or network error → no outline; the pin still marks it.
      })
    return () => ctrl.abort()
  }, [selectionKey, activeSelection])
  // Only show a shape that matches the CURRENT selection (clears on city change /
  // deselect / a newer click whose fetch hasn't resolved yet).
  const selectedShape = shapeResult && shapeResult.key === selectionKey ? shapeResult.shape : null

  // The selected parcel's by-right envelope, for the map's 3D rise. The panel
  // resolves the same parcel via useParcelInfo; calling it here too is cheap —
  // the /api/parcel response is CDN-cached on the SAME quantized key, and the
  // hook's log-once guard means the search isn't double-counted. We read only
  // the envelope's known height/stories; when height is unknown we pass null so
  // the map shows the flat outline with no extrusion and no chip (never a guess).
  const parcelState = useParcelInfo(activeSelection ? { ...activeSelection, city } : null)
  const envelope =
    parcelState.status === 'loaded'
      ? {
          maxHeightFt: parcelState.data.envelope?.maxHeightFt ?? null,
          maxStories: parcelState.data.envelope?.maxStories ?? null,
        }
      : null

  // cmp carries the first parcel's AnalysisInput (no address field) — name it by
  // parcelId so the banner is honest about which parcel you're comparing against.
  const cmpInput = cmp ? decodeJsonB64<AnalysisInput>(cmp) : null
  const cmpLabel = cmpInput?.parcelId ? `parcel ${cmpInput.parcelId}` : 'your first parcel'

  // ── Mobile bottom sheet (WO-8.5a) ─────────────────────────────────────────
  // On <md the panel is a peek-state sheet: ~35vh (address + key status + the
  // primary CTA poking above the fold) that drags/taps up to ~85vh. The map
  // stays interactive in peek (the sheet only covers the bottom third and the
  // backdrop isn't a blocking scrim). Desktop (md+) ignores all of this and
  // keeps the right-rail via the md: classes on the wrapper.
  const PEEK_VH = 35
  const EXPANDED_VH = 85
  const [sheetExpanded, setSheetExpanded] = useState(false)
  // Live drag offset in px (0 = at the current snap target). Cleared on release.
  const [dragOffset, setDragOffset] = useState(0)
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null)
  const suppressClickRef = useRef(false)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // A new selection re-peeks the sheet so the fresh address + CTA are framed.
  // Derived during render (mirrors the prevCity/showMap pattern above) rather
  // than in an effect, so the peek is applied in the same commit as the
  // selection change — no extra render, no setState-in-effect.
  const [sheetSelectionKey, setSheetSelectionKey] = useState(selectionKey)
  if (selectionKey !== sheetSelectionKey) {
    setSheetSelectionKey(selectionKey)
    if (selectionKey) setSheetExpanded(false)
  }

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])
  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    // Up-drag (negative) when peeked should expand; down-drag when expanded
    // should collapse. Track the raw delta; snap on release.
    setDragOffset(e.clientY - dragRef.current.startY)
  }, [])
  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const delta = e.clientY - dragRef.current.startY
      const wasDrag = Math.abs(delta) >= 6
      dragRef.current = null
      setDragOffset(0)
      // Only snap on a real drag past the threshold. A tap (tiny delta) is left
      // to the synthetic `click` handler so keyboard activation and tap share one
      // toggle path and never double-fire.
      const THRESHOLD = 40
      if (!wasDrag) return
      // A drag fires a synthetic click afterward; suppress it so the drag's snap
      // isn't immediately undone by a toggle.
      suppressClickRef.current = true
      if (delta < -THRESHOLD) setSheetExpanded(true)
      else if (delta > THRESHOLD) setSheetExpanded(false)
    },
    [],
  )
  // Taps and keyboard activation toggle the sheet here. A real drag also fires a
  // synthetic click afterward; endDrag set suppressClickRef so that one click is
  // consumed and the drag's snap stands.
  const onHandleClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setSheetExpanded((v) => !v)
  }, [])

  return (
    <div className="relative h-[calc(100vh-4rem-3.5rem)]">
      <CityIntro key={city} city={current} onReveal={() => setShowMap(true)} />
      {/* 4rem header + ~3.5rem slim footer. Adjust if footer height changes. */}
      <div className="absolute inset-0">
        {showMap && (
          <Map
            key={city}
            center={current.center}
            zoom={current.zoom}
            onPointSelect={handleSelect}
            focusedPoint={activeSelection}
            selectedShape={selectedShape}
            envelope={envelope}
            zoningLayer={current.zoningLayer}
          />
        )}
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[26rem] max-w-[calc(100%-2rem)] space-y-2">
        <SearchBar key={city} city={city} onSelect={handleSelect} />
        {/* No address in mind? One tap runs a verified demo parcel for this
            city — the fastest path from landing to a real verdict. Hidden the
            moment anything is selected. */}
        {!activeSelection && EXAMPLE_PARCELS[city] && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() =>
                handleSelect(EXAMPLE_PARCELS[city].lat, EXAMPLE_PARCELS[city].lng)
              }
              className="tpp-press rounded-full border border-piranha-charcoal/15 bg-piranha-bone/95 px-4 py-1.5 text-xs font-medium text-piranha-charcoal/70 shadow-lg backdrop-blur transition-colors hover:border-piranha-burgundy/40 hover:text-piranha-burgundy"
            >
              No address in mind? Try {EXAMPLE_PARCELS[city].label} →
            </button>
          </div>
        )}
        {cmp && (
          <div className="flex items-center gap-2 rounded-full bg-piranha-burgundy px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-piranha-bone shadow-lg">
            <span className="flex-1 text-center">Comparing against {cmpLabel} — pick a second parcel</span>
            <button
              type="button"
              aria-label="Cancel comparing"
              onClick={() => {
                const next = new URLSearchParams(params)
                next.delete('cmp')
                setParams(next)
              }}
              className="-mr-1 shrink-0 rounded-full px-1.5 leading-none text-piranha-bone/80 transition-colors hover:text-piranha-bone"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div
        // md+: the original right-rail, untouched. <md: a bottom sheet whose
        // height is driven by inline style (peek vs expanded vh, plus the live
        // drag offset) — the md: utilities reset every mobile property so the
        // desktop rail is unaffected by the sheet's inline height/transform.
        style={
          {
            // Only consulted under md via the CSS var; harmless on desktop where
            // height is `auto` from md:h-auto. translateY tracks the active drag.
            '--sheet-h': `${sheetExpanded ? EXPANDED_VH : PEEK_VH}vh`,
            transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
          } as React.CSSProperties
        }
        className={`absolute z-10 left-0 right-0 bottom-0 flex h-[var(--sheet-h)] flex-col ${
          reducedMotion || dragOffset ? '' : 'transition-[height,transform] duration-300 ease-out'
        } md:right-4 md:top-4 md:bottom-4 md:left-auto md:h-auto md:transform-none md:transition-none ${
          activeSelection ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Drag handle — mobile only. A real button so it's keyboard- and
            screen-reader-operable; aria-expanded reflects the sheet state. It
            sits ABOVE the panel in the flex column so it never overlaps content;
            the panel below takes the remaining height and scrolls internally. */}
        <button
          type="button"
          aria-label={sheetExpanded ? 'Collapse parcel details' : 'Expand parcel details'}
          aria-expanded={sheetExpanded}
          onClick={onHandleClick}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex h-9 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl border border-b-0 border-piranha-charcoal/10 bg-piranha-bone/95 backdrop-blur-sm md:hidden"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-piranha-charcoal/25" />
        </button>
        <div className="min-h-0 flex-1">
          <ParcelPanel
            selected={activeSelection}
            city={city}
            cmp={cmp}
            searchedAddress={activeSelection?.searchedAddress}
          />
        </div>
      </div>
    </div>
  )
}
