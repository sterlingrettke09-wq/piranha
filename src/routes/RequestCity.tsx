import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'

// Encode a flat object as application/x-www-form-urlencoded for Netlify Forms.
function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

type Status = 'idle' | 'submitting' | 'done' | 'error'

export default function RequestCity() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const [botField, setBotField] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !city.trim()) return
    setStatus('submitting')
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode({
        'form-name': 'request-city',
        'bot-field': botField,
        email: email.trim(),
        city: city.trim(),
        notes: notes.trim(),
      }),
    })
      .then((r) => setStatus(r.ok ? 'done' : 'error'))
      .catch(() => setStatus('error'))
  }

  const inputCls =
    'w-full rounded-xl border border-piranha-charcoal/15 bg-white/70 px-4 py-3 text-piranha-charcoal placeholder:text-piranha-charcoal/35 focus:border-piranha-burgundy focus:outline-none focus:ring-1 focus:ring-piranha-burgundy'

  return (
    <PageContainer>
      <PageHeading eyebrow="Coverage" title="Request a city.">
        We are live in Boston, New York, Chicago, San Francisco, and Seattle, with
        Washington, Austin, Los Angeles, Denver, and Minneapolis next. Tell us where
        you want to build and we will let you know when it opens.
      </PageHeading>

      <Reveal className="mt-12 max-w-xl">
        {status === 'done' ? (
          <div className="rounded-2xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.05] p-8">
            <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">You are on the list.</h2>
            <p className="mt-3 text-piranha-charcoal/70">
              We will email you the moment {city.trim() || 'your city'} goes live.
            </p>
            <Link
              to="/map"
              className="mt-6 inline-flex rounded-full border border-piranha-charcoal/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70 transition-colors hover:border-piranha-charcoal/40"
            >
              ← Back to the map
            </Link>
          </div>
        ) : (
          <form
            name="request-city"
            method="POST"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={submit}
            className="space-y-5"
          >
            {/* Netlify form plumbing. */}
            <input type="hidden" name="form-name" value="request-city" />
            <p className="hidden">
              <label>
                Leave this empty
                <input name="bot-field" value={botField} onChange={(e) => setBotField(e.target.value)} />
              </label>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="city" className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/55">
                Which city?
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Miami, Houston, Jersey City"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/55">
                Your email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/55">
                What are you trying to build? <span className="font-normal normal-case text-piranha-charcoal/40">(optional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="A few words on your project helps us prioritize."
                className={inputCls}
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-rose-700">Something went wrong. Please try again in a moment.</p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="group inline-flex items-center gap-3 rounded-full bg-piranha-burgundy px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-bone transition-colors hover:bg-piranha-charcoal disabled:opacity-60"
            >
              {status === 'submitting' ? 'Sending…' : 'Join the waitlist'}
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
                →
              </span>
            </button>
          </form>
        )}
      </Reveal>
    </PageContainer>
  )
}
