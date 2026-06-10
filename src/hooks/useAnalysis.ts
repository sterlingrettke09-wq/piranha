import { useEffect, useState } from 'react'
import type { AnalysisResult, AnalysisError, AnalysisInput } from '../types/analysis'
import { quantizeCoord } from '../lib/coords'
import { ESTIMATES_VERSION } from '../config/estimates'

type Resolved =
  | { status: 'loaded'; data: AnalysisResult }
  | { status: 'error'; error: AnalysisError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

// Exported for tests (cache-key shape is behavior worth pinning).
export function toQuery(input: AnalysisInput): string {
  const p = new URLSearchParams()
  p.set('city', input.city)
  p.set('projectType', input.projectType)
  p.set('funding', input.funding)
  p.set('lat', String(quantizeCoord(input.lat)))
  p.set('lng', String(quantizeCoord(input.lng)))
  p.set('parcelId', input.parcelId)
  p.set('use', input.use)
  p.set('gfa', String(input.gfa))
  if (input.units != null) p.set('units', String(input.units))
  if (input.stories != null) p.set('stories', String(input.stories))
  if (input.heightFt != null) p.set('heightFt', String(input.heightFt))
  // Cache-buster: the CDN caches analyze responses for 24h with the estimate
  // constants baked in. Bumping ESTIMATES_VERSION changes every cache key, so
  // a tuned cost model reaches users immediately.
  p.set('v', String(ESTIMATES_VERSION))
  return p.toString()
}

export function useAnalysis(input: AnalysisInput | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  const qs = input ? toQuery(input) : null
  const key = qs ? `${qs},${retryCount}` : null

  useEffect(() => {
    if (key === null || qs === null) return
    // Abort superseded requests (input change, retry, unmount) instead of just
    // ignoring their results — an analyze call fans out to several upstream
    // services, so cancelled requests are real wasted server work.
    const ctrl = new AbortController()
    fetch(`/api/analyze?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json()
        if (ctrl.signal.aborted) return
        setResult({
          key,
          value: res.ok
            ? { status: 'loaded', data: body as AnalysisResult }
            : { status: 'error', error: body as AnalysisError },
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
  }, [key, qs])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
