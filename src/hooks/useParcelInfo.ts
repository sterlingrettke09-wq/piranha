import { useEffect, useState } from 'react'
import type { ParcelInfo, ParcelError } from '../types/parcel'

type Resolved =
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

interface Args {
  lat: number
  lng: number
  city?: string
}

export function useParcelInfo(args: Args | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  const lat = args?.lat
  const lng = args?.lng
  const city = args?.city ?? 'boston'
  const key = lat !== undefined && lng !== undefined ? `${city},${lat},${lng},${retryCount}` : null

  useEffect(() => {
    if (key === null || lat === undefined || lng === undefined) return
    let cancelled = false
    fetch(`/api/parcel?city=${encodeURIComponent(city)}&lat=${lat}&lng=${lng}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        // Fire-and-forget: log every resolved search/click (uncached beacon, so
        // it records even when the parcel response is served from CDN cache).
        if (res.ok && (body as ParcelInfo).address) {
          const addr = (body as ParcelInfo).address
          fetch(`/api/log-search?city=${encodeURIComponent(city)}&address=${encodeURIComponent(addr)}&kind=lookup`, {
            keepalive: true,
          }).catch(() => {})
        }
        setResult({
          key,
          value: res.ok
            ? { status: 'loaded', data: body as ParcelInfo }
            : { status: 'error', error: body as ParcelError },
        })
      })
      .catch((err) => {
        if (cancelled) return
        setResult({
          key,
          value: {
            status: 'error',
            error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Network error' },
          },
        })
      })
    return () => {
      cancelled = true
    }
  }, [key, lat, lng, city])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
