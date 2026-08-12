import { useCallback, useEffect, useRef, useState } from 'react'
import { SearchBox } from '@mapbox/search-js-react'
import { getCity } from '../../config/cities'
import { MIN_QUERY, SLOW_MS, STALL_MS, searchBoxOptions, statusFor, type Hop } from './searchStatus'

interface SearchBarProps {
  city: string
  /** `searchedAddress` is the address the GEOCODER returned for the picked
   *  suggestion — not the raw keystrokes. The panel compares it against the
   *  address the parcel record carries (src/lib/addressMatch.ts); comparing the
   *  half-typed query instead would report the user's typing, not the pipeline. */
  onSelect: (lat: number, lng: number, searchedAddress?: string) => void
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Two things this component does that are NOT obvious, both of them corrections
// to a measured defect, and both stated in full in ./searchStatus.ts next to the
// code they govern rather than restated here:
//
//   · the Search Box gets NO `bbox`. Mapbox's bbox substitutes an address rather
//     than filtering one out, which published a report for a parcel 6 km from
//     the address that was typed. `searchBoxOptions` carries the measurement.
//   · four different geocode failures used to render as nothing at all, and as
//     the same nothing. `statusFor` carries that one, and `searchStatus.test.ts`
//     holds the arms apart.
//
// What is left here is the wiring: which callbacks map to which state, and the
// two timers, because a request that never settles fires no callback at all —
// a state defined by nothing happening cannot be detected by waiting for
// something to happen.

export function SearchBar({ city, onSelect }: SearchBarProps) {
  // The status is stored WITH the city it describes and read back only for the
  // current one, so a city change resets it by derivation — no effect, no
  // setState during render, and no frame in which the new city is shown under
  // the old city's error message. It also makes a stall timer that outlives its
  // city harmless: its write lands under the old key and is never read.
  // (`<SearchBar key={city}>` remounts today and would cover this on its own;
  // this holds if that key is ever removed, which is exactly the kind of change
  // nobody would connect to a stale error message.)
  const [saved, setSaved] = useState<{ city: string; hop: Hop }>({ city, hop: { kind: 'idle' } })
  const hop: Hop = saved.city === city ? saved.hop : { kind: 'idle' }
  const setHop = useCallback((next: Hop) => setSaved({ city, hop: next }), [city])

  // Two timers, one per stage of "nothing has come back yet". They are always
  // armed and cleared together, so there is one place a leak could be.
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const clearStall = useCallback(() => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }, [])

  // ⚠️ THE UNHANDLED REJECTION, AND WHY IT IS SWALLOWED BY IDENTITY.
  //
  // `SearchSession.suggest` fires a `suggesterror` event AND returns a promise
  // that rejects with the same Error instance. The web component calls it
  // without a `.catch`, so on an HTTP 500 the browser logs an unhandled
  // rejection — a library-internal floating promise this component cannot
  // reach.
  //
  // What it CAN do is prove the error was handled: the instance the promise
  // rejects with is the very object `onSuggestError` was just handed (one
  // `fire()`, one argument, listeners in registration order — the component's
  // listener is attached at connect, before the per-call promise's). So only a
  // rejection whose reason is an error THIS COMPONENT ALREADY SURFACED is
  // suppressed. Anything else — an unrelated rejection anywhere on the page —
  // is left alone, which a blanket handler would not do.
  const surfaced = useRef(new WeakSet<object>())
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: unknown = e.reason
      if (typeof reason === 'object' && reason !== null && surfaced.current.has(reason)) e.preventDefault()
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  useEffect(() => clearStall, [clearStall])

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
  const { center, name } = current


  return (
    <div>
      <SearchBox
        accessToken={TOKEN}
        options={searchBoxOptions(center)}
        placeholder={`Search ${name} address`}
        onChange={(value) => {
          clearStall()
          if (value.trim().length < MIN_QUERY) {
            setHop({ kind: 'idle' })
            return
          }
          setHop({ kind: 'searching' })
          timers.current = [
            setTimeout(() => setHop({ kind: 'slow' }), SLOW_MS),
            setTimeout(() => setHop({ kind: 'stalled' }), STALL_MS),
          ]
        }}
        onSuggest={(res) => {
          clearStall()
          // An ANSWER. Zero suggestions is a fact about the query, and it is
          // deliberately not the same state as a failure below.
          setHop((res.suggestions?.length ?? 0) > 0 ? { kind: 'results' } : { kind: 'none' })
        }}
        onSuggestError={(error) => {
          clearStall()
          if (typeof error === 'object' && error !== null) surfaced.current.add(error)
          setHop({ kind: 'failed' })
        }}
        onClear={() => {
          clearStall()
          setHop({ kind: 'idle' })
        }}
        onRetrieve={(res) => {
          clearStall()
          const f = res.features?.[0]
          if (!f) return
          setHop({ kind: 'idle' })
          const [lng, lat] = f.geometry.coordinates
          // The street line Mapbox resolved the pick to. `address` is the street
          // portion; `full_address` appends city/state/zip, which the comparison
          // cuts at the first comma anyway (rule N1) — either is accepted, and
          // the fallback order is "most specific first".
          const p = f.properties as { address?: string; full_address?: string; name?: string } | undefined
          const searched = p?.address ?? p?.full_address ?? p?.name
          // Handed on unfiltered and unclamped. Whether this point is servable
          // is a question for `getParcelInfo` and the city's jurisdiction gate,
          // which own a real boundary; clipping it here would be a rectangle
          // pretending to be a city — the mistake note 1 exists to undo.
          //
          // The address rides along UNVERIFIED for the same reason: whether it
          // belongs to the parcel at this point is a comparison the panel makes
          // once the parcel record is in hand, and it is a WARNING, never a
          // filter — see src/lib/addressMatch.ts for why refusing here would be
          // the worse error.
          onSelect(lat, lng, searched)
        }}
      />
      {/* aria-live so the three failure states reach a screen reader, which
          previously got the same nothing as everyone else. */}
      <p role="status" aria-live="polite" className="mt-1.5 text-xs text-piranha-charcoal/40">
        {statusFor(hop)}
      </p>
    </div>
  )
}
