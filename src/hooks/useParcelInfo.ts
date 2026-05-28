import { useEffect, useState } from 'react'
import type { ParcelInfo, ParcelError } from '../types/parcel'

type Resolved =
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

interface Args {
  lat: number
  lng: number
}

export function useParcelInfo(args: Args | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  const lat = args?.lat
  const lng = args?.lng
  const key = lat !== undefined && lng !== undefined ? `${lat},${lng},${retryCount}` : null

  useEffect(() => {
    if (key === null || lat === undefined || lng === undefined) return
    let cancelled = false
    fetch(`/api/parcel?lat=${lat}&lng=${lng}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
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
  }, [key, lat, lng])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
