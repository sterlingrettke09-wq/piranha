import { useState } from 'react'

const KEY = 'tpp_disclaimer_ack'

function acknowledged(): boolean {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}

// First-visit acknowledgment that the tool gives estimates, not advice.
// A bottom bar rather than a blocking modal so it never fights the intro.
export function DisclaimerNotice() {
  const [ack, setAck] = useState(acknowledged)
  if (ack) return null

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setAck(true)
  }

  return (
    // Cookie-bar slim: one short line + a small OK, floating as a pill so it
    // reads as a passing notice, not a wall. The full disclaimer lives at /terms.
    <div className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-4">
      <div className="flex max-w-xl items-center gap-3 rounded-full border border-piranha-bone/15 bg-piranha-charcoal/95 py-2 pl-4 pr-2 text-xs text-piranha-bone/85 shadow-2xl backdrop-blur">
        <p>
          Estimates from public data — not legal advice.{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-piranha-bone">
            Details
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-piranha-burgundy px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-piranha-bone transition-colors hover:bg-piranha-burgundy/85"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
