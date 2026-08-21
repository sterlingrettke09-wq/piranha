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

// ⚠️ ONE ANALYSIS BEACON PER DISTINCT RESULT, module-scoped like the lookup
// beacon in useParcelInfo. Without it a re-render or a retry would log the same
// analysis repeatedly and inflate whichever city happened to be slow.
const loggedAnalyses = new Set<string>()

/** Test seam only — the dedupe set is module-scoped by design, and a suite that
 *  could not clear it would pass on its first case and silently skip the rest. */
export function __resetAnalysisLogForTests(): void {
  loggedAnalyses.clear()
}

/** ⚠️ THE ONLY WRITER OF `kind: 'analysis'`. Every row in the search log said
 *  `lookup` because nothing ever sent anything else, and six of the ten
 *  `SearchEntry` fields had no writer at all — so the log could say which
 *  addresses were clicked and nothing about what anyone tried to build.
 *
 *  Fire-and-forget and deliberately unconditional on success: an analysis that
 *  ERRORS is still a thing someone tried, and dropping it would bias the log
 *  toward the cities whose data pipelines work. Errors are logged with the
 *  verdict omitted rather than with a fabricated one. */
export function logAnalysis(qs: string, result: Resolved): void {
  // ⚠️ READ FROM `qs`, NOT FROM `input`. The query string IS the request, so the
  // beacon reports exactly what was asked for and there is no second source that
  // could drift from it. It also keeps `input` out of the effect's dependencies
  // — it is an object literal from the caller, so depending on it would re-fire
  // the fetch on every render.
  const asked = new URLSearchParams(qs)
  const city = asked.get('city')
  const parcelId = asked.get('parcelId')
  if (!city || !parcelId) return
  const dedupeKey = `${city},${parcelId},${asked.get('projectType')},${asked.get('use')},${asked.get('gfa')}`
  if (loggedAnalyses.has(dedupeKey)) return
  loggedAnalyses.add(dedupeKey)
  const q = new URLSearchParams({
    city,
    // The resolved street address when we have one; the parcel id is the
    // fallback so an errored analysis still identifies its parcel.
    address: result.status === 'loaded' ? result.data.parcel.address : parcelId,
    kind: 'analysis',
  })
  for (const f of ['use', 'projectType', 'gfa', 'units'] as const) {
    const v = asked.get(f)
    if (v != null && v !== '') q.set(f, v)
  }
  if (result.status === 'loaded') {
    q.set('verdict', result.data.feasibility.overall)
    q.set('months', String(result.data.timeline.months))
  }
  fetch(`/api/log-search?${q.toString()}`, { keepalive: true }).catch(() => {})
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
        const value: Resolved = res.ok
          ? { status: 'loaded', data: body as AnalysisResult }
          : { status: 'error', error: body as AnalysisError }
        // ⚠️ After the abort check, so a superseded request never logs — the
        // same reason the request itself is aborted rather than ignored.
        logAnalysis(qs, value)
        setResult({ key, value })
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
