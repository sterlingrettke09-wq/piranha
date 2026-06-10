// Tiny client-side error reporter. Installs window.onerror and
// unhandledrejection handlers that POST a structured payload to the
// /api/client-error beacon, where it lands in the Netlify function logs.
//
// Deliberately minimal and bulletproof: it swallows every failure (a broken
// reporter must never make the page worse), caps how many reports it sends per
// page load, and guards against reporting errors that originate inside the
// reporter itself (which would otherwise loop).

const ENDPOINT = '/api/client-error'
const MAX_REPORTS_PER_LOAD = 5

let installed = false
let reportCount = 0
let reporting = false

function report(message: string, stack?: string) {
  // Cap volume, and never report an error thrown by the reporter itself.
  if (reporting || reportCount >= MAX_REPORTS_PER_LOAD) return
  if (!message) return

  reporting = true
  reportCount += 1
  try {
    const body = JSON.stringify({
      message,
      stack,
      url: typeof location !== 'undefined' ? location.href : undefined,
    })
    // keepalive lets the request survive a navigation/unload.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow: a failed beacon must not surface to the user */
    })
  } catch {
    /* swallow everything — the reporter is best-effort */
  } finally {
    reporting = false
  }
}

export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event: ErrorEvent) => {
    try {
      const message = event.message || (event.error && String(event.error)) || 'Unknown error'
      report(message, event.error instanceof Error ? event.error.stack : undefined)
    } catch {
      /* swallow */
    }
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    try {
      const reason = event.reason
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection'
      report(message || 'Unhandled promise rejection', reason instanceof Error ? reason.stack : undefined)
    } catch {
      /* swallow */
    }
  })
}
