import { useEffect, useState } from 'react'
import type { AnalysisResult, AnalysisError, AnalysisInput } from '../types/analysis'

type Resolved =
  | { status: 'loaded'; data: AnalysisResult }
  | { status: 'error'; error: AnalysisError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

function toQuery(input: AnalysisInput): string {
  const p = new URLSearchParams()
  p.set('lat', String(input.lat))
  p.set('lng', String(input.lng))
  p.set('parcelId', input.parcelId)
  p.set('use', input.use)
  p.set('gfa', String(input.gfa))
  if (input.units != null) p.set('units', String(input.units))
  if (input.stories != null) p.set('stories', String(input.stories))
  if (input.heightFt != null) p.set('heightFt', String(input.heightFt))
  return p.toString()
}

export function useAnalysis(input: AnalysisInput | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  const qs = input ? toQuery(input) : null
  const key = qs ? `${qs},${retryCount}` : null

  useEffect(() => {
    if (key === null || qs === null) return
    let cancelled = false
    fetch(`/api/analyze?${qs}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        setResult({
          key,
          value: res.ok
            ? { status: 'loaded', data: body as AnalysisResult }
            : { status: 'error', error: body as AnalysisError },
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
  }, [key, qs])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
