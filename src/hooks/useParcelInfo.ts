import { useEffect, useState } from 'react'
import type { ParcelInfo, ParcelError } from '../types/parcel'
import { quantizeCoord } from '../lib/coords'

type Resolved =
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

interface Args {
  lat: number
  lng: number
  city?: string
}

// Addresses already logged this page-load. Both the dashboard panel AND the
// wizard header resolve the same parcel, so without this the search log (and
// the Admin "most searched" stats) counted every selection at least twice.
const loggedAddresses = new Set<string>()

export function useParcelInfo(args: Args | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  // Quantized defensively here too: callers that build Args from URL params
  // (the wizard) bypass the dashboard's click-source quantization.
  const lat = args ? quantizeCoord(args.lat) : undefined
  const lng = args ? quantizeCoord(args.lng) : undefined
  const city = args?.city ?? 'boston'
  const key = lat !== undefined && lng !== undefined ? `${city},${lat},${lng},${retryCount}` : null

  useEffect(() => {
    if (key === null || lat === undefined || lng === undefined) return
    // Abort the in-flight request when the selection changes or the component
    // unmounts — rapid map clicking shouldn't stack up server work.
    const ctrl = new AbortController()
    fetch(`/api/parcel?city=${encodeURIComponent(city)}&lat=${lat}&lng=${lng}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json()
        if (ctrl.signal.aborted) return
        // Fire-and-forget: log each resolved search/click once per page-load
        // (uncached beacon, so it records even when the parcel response is
        // served from CDN cache).
        if (res.ok && (body as ParcelInfo).address) {
          const addr = (body as ParcelInfo).address
          const logKey = `${city},${addr}`
          if (!loggedAddresses.has(logKey)) {
            loggedAddresses.add(logKey)
            fetch(`/api/log-search?city=${encodeURIComponent(city)}&address=${encodeURIComponent(addr)}&kind=lookup`, {
              keepalive: true,
            }).catch(() => {})
          }
        }
        setResult({
          key,
          value: res.ok
            ? { status: 'loaded', data: body as ParcelInfo }
            : { status: 'error', error: body as ParcelError },
        })
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setResult({
          key,
          value: {
            status: 'error',
            error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Network error' },
          },
        })
      })
    return () => {
      ctrl.abort()
    }
  }, [key, lat, lng, city])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
