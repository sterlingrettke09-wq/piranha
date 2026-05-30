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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-piranha-bone/15 bg-piranha-charcoal text-piranha-bone shadow-2xl">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed text-piranha-bone/85">
          The Piranha Project gives general regulatory <span className="font-semibold text-piranha-bone">estimates</span> built from public
          data, not legal, engineering, or financial advice. Always verify with the
          relevant city department before relying on anything here.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-piranha-burgundy px-5 py-2 text-xs font-semibold uppercase tracking-wider text-piranha-bone transition-colors hover:bg-piranha-burgundy/85"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
