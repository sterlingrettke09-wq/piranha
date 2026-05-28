import { useEffect, useState } from 'react'
import type { ParcelInfo, ParcelError } from '../types/parcel'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError }

interface Args {
  lat: number
  lng: number
}

export function useParcelInfo(args: Args | null): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: 'idle' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!args) {
      setState({ status: 'idle' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/parcel?lat=${args.lat}&lng=${args.lng}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        if (res.ok) {
          setState({ status: 'loaded', data: body as ParcelInfo })
        } else {
          setState({ status: 'error', error: body as ParcelError })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Network error' },
        })
      })
    return () => {
      cancelled = true
    }
  }, [args?.lat, args?.lng, retryCount])

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
