import { useState } from 'react'
import { Link } from 'react-router-dom'

// Encode a flat object as application/x-www-form-urlencoded for Netlify Forms.
// (Same helper pattern as RequestCity.tsx — kept local so each form is
// self-contained.)
function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

type Status = 'idle' | 'submitting' | 'done' | 'error'

interface EmailReportProps {
  /** The parcel address — captured so the owner knows which report to send. */
  address: string
  /** City slug, for routing/segmentation in the form log. */
  city: string
  /** Overall feasibility verdict (e.g. AS_OF_RIGHT), captured as intent signal. */
  verdict: string
}

export function EmailReport({ address, city, verdict }: EmailReportProps) {
  const [email, setEmail] = useState('')
  const [botField, setBotField] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('submitting')
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode({
        'form-name': 'report-email',
        'bot-field': botField,
        email: email.trim(),
        address,
        city,
        verdict,
        url: window.location.href,
      }),
    })
      .then((r) => setStatus(r.ok ? 'done' : 'error'))
      .catch(() => setStatus('error'))
  }

  return (
    <div className="print-hide rounded-2xl border border-piranha-charcoal/10 bg-white/50 p-5">
      {status === 'done' ? (
        <p className="text-sm font-medium text-piranha-charcoal">
          Sent — check your inbox soon.
        </p>
      ) : (
        <form
          name="report-email"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={submit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          {/* Netlify form plumbing. */}
          <input type="hidden" name="form-name" value="report-email" />
          <input type="hidden" name="address" value={address} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="verdict" value={verdict} />
          <p className="hidden">
            <label>
              Leave this empty
              <input name="bot-field" value={botField} onChange={(e) => setBotField(e.target.value)} />
            </label>
          </p>

          <label htmlFor="report-email" className="text-sm font-medium text-piranha-charcoal/80 sm:shrink-0">
            Email me this report
          </label>
          <input
            id="report-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full flex-1 rounded-xl border border-piranha-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-piranha-charcoal placeholder:text-piranha-charcoal/35 focus:border-piranha-burgundy focus:outline-none focus:ring-1 focus:ring-piranha-burgundy"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="rounded-full bg-piranha-burgundy px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-bone transition-colors hover:bg-piranha-charcoal disabled:opacity-60 sm:shrink-0"
          >
            {status === 'submitting' ? 'Sending…' : 'Send it'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="mt-3 text-sm text-rose-700">Something went wrong. Please try again in a moment.</p>
      )}
      {status !== 'done' && (
        <p className="mt-3 text-xs text-piranha-charcoal/45">
          No spam — see our{' '}
          <Link className="underline underline-offset-2 hover:text-piranha-burgundy" to="/privacy">
            privacy policy
          </Link>
          .
        </p>
      )}
    </div>
  )
}
