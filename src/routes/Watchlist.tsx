import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import { CITIES } from '../config/cities'
import {
  getSession, listWatchlist, removeWatch, requestSignIn, signOut,
  type SessionUser, type WatchRow,
} from '../lib/watchlistClient'

const cityLabel = (slug: string) => CITIES.find((c) => c.slug === slug)?.name ?? slug

const inputCls =
  'w-full rounded-xl border border-piranha-charcoal/15 bg-white/70 px-4 py-3 text-piranha-charcoal placeholder:text-piranha-charcoal/35 focus:border-piranha-burgundy focus:outline-none focus:ring-1 focus:ring-piranha-burgundy'
const btnCls =
  'rounded-xl bg-piranha-burgundy px-6 py-3 text-white transition hover:bg-piranha-burgundy/90 disabled:opacity-50'

function fmt(n: number | null, suffix = ''): string {
  return n == null ? '—' : `${n.toLocaleString()}${suffix}`
}

/** ⚠️ Every row says WHEN it was last checked and against WHICH fabric.
 *
 *  A watchlist whose rows do not show their own freshness is the failure this
 *  feature was built to avoid: a list that reports "no change" forever because
 *  it is reading a frozen year looks exactly like a list where nothing changed.
 *  Cook County publishes one parcel layer per tax year, so for Chicago the year
 *  is a real fact about the answer and not decoration. */
function Provenance({ row }: { row: WatchRow }) {
  const v = row.parcelVintage
  const checked =
    row.resolution === 'unchecked'
      ? 'Not re-checked yet'
      : row.lastCheckedAt
        ? `Checked ${new Date(row.lastCheckedAt).toLocaleDateString()}`
        : 'Not re-checked yet'

  return (
    <p className="mt-3 text-xs text-piranha-charcoal/45">
      {checked}
      {v.basis === 'resolved' && v.year ? ` · read against the ${v.year} parcel map` : null}
      {v.basis === 'pinned-fallback' ? (
        <span className="text-piranha-burgundy/80">
          {' '}· the parcel map’s year could not be confirmed when this was saved
        </span>
      ) : null}
      {row.resolution === 'not-in-layer' ? (
        <span className="text-piranha-burgundy">
          {' '}· this parcel is no longer in the city’s records — usually a subdivision or a merge
        </span>
      ) : null}
      {row.resolution === 'check-failed' ? (
        <span className="text-piranha-charcoal/60">
          {' '}· the last check could not reach the city’s service, so nothing is known either way
        </span>
      ) : null}
    </p>
  )
}

function Row({ row, onRemove }: { row: WatchRow; onRemove: (r: WatchRow) => void }) {
  const s = row.snapshot
  return (
    <li className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-lg tracking-tight text-piranha-charcoal">
            {row.address ?? `Parcel ${row.parcelId}`}
          </p>
          <p className="mt-1 text-sm text-piranha-charcoal/55">
            {cityLabel(row.city)} · parcel {row.parcelId}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(row)}
          className="shrink-0 rounded-lg border border-piranha-charcoal/15 px-3 py-1.5 text-sm text-piranha-charcoal/70 transition hover:border-piranha-burgundy/40 hover:text-piranha-burgundy"
        >
          Stop watching
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {/* A dash is "not resolved", never zero — the same distinction the diff
            relies on to avoid alerting when an upstream simply went quiet. */}
        <div><dt className="text-piranha-charcoal/45">Zoning</dt><dd className="text-piranha-charcoal">{s.districtCode ?? '—'}</dd></div>
        <div><dt className="text-piranha-charcoal/45">Max height</dt><dd className="text-piranha-charcoal">{fmt(s.maxHeightFt, ' ft')}</dd></div>
        <div><dt className="text-piranha-charcoal/45">Max FAR</dt><dd className="text-piranha-charcoal">{s.maxFAR ?? '—'}</dd></div>
        <div><dt className="text-piranha-charcoal/45">Lot</dt><dd className="text-piranha-charcoal">{fmt(s.lotSqFt, ' sf')}</dd></div>
      </dl>

      <Provenance row={row} />
    </li>
  )
}

function SignIn() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'network-error'>('idle')
  const linkExpired = params.get('signin') === 'expired'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    setState(await requestSignIn(email.trim()) === 'sent' ? 'sent' : 'network-error')
  }

  if (state === 'sent') {
    return (
      <div className="rounded-2xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.05] p-8">
        <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">Check your email.</h2>
        {/* ⚠️ Deliberately says "if there is an account". The endpoint answers the
            same way for every outcome so that this page cannot be used to find
            out whether an address is registered, and the copy has to match — a
            confident "we sent it" would leak exactly what the 204 protects. */}
        <p className="mt-3 text-piranha-charcoal/70">
          If <span className="text-piranha-charcoal">{email.trim()}</span> can receive mail from us, a
          sign-in link is on its way. It works once and expires in fifteen minutes.
        </p>
        <button type="button" onClick={() => setState('idle')} className="mt-6 text-sm text-piranha-burgundy underline underline-offset-4">
          Use a different address
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-xl">
      {linkExpired ? (
        <p className="mb-6 rounded-xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.05] px-4 py-3 text-sm text-piranha-charcoal/80">
          That sign-in link has expired or was already used. Links work once — request a new one.
        </p>
      ) : null}
      <label htmlFor="wl-email" className="block text-sm text-piranha-charcoal/60">Email</label>
      <input
        id="wl-email" type="email" required value={email} autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com" className={`mt-2 ${inputCls}`}
      />
      <p className="mt-3 text-sm text-piranha-charcoal/50">
        No password. We email you a link that signs you in.
      </p>
      {state === 'network-error' ? (
        <p className="mt-3 text-sm text-piranha-burgundy">Could not reach the server. Try again.</p>
      ) : null}
      <button type="submit" disabled={state === 'sending'} className={`mt-6 ${btnCls}`}>
        {state === 'sending' ? 'Sending…' : 'Email me a link'}
      </button>
    </form>
  )
}

export default function Watchlist() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [rows, setRows] = useState<WatchRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // `null` = still checking. Distinct from "checked, signed out", so the page
  // does not flash a sign-in form at someone who is already signed in.
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const u = await getSession()
    setUser(u)
    if (!u) {
      setRows(null)
      setReady(true)
      return
    }
    const r = await listWatchlist()
    if (r.kind === 'ok') {
      setRows(r.rows)
      setLoadError(null)
    } else if (r.kind === 'signed-out') {
      setUser(null)
      setRows(null)
    } else {
      // An empty list and a failed load must not render the same (rule 5): one
      // says "you are watching nothing", the other says "we do not know".
      setRows(null)
      setLoadError(r.detail)
    }
    setReady(true)
  }, [])

  // Deferred to a timer so the fetch's setState does not fire synchronously
  // inside the effect body — the same shape Admin.tsx uses for its auto-load.
  useEffect(() => {
    const t = setTimeout(() => void load(), 0)
    return () => clearTimeout(t)
  }, [load])

  async function remove(row: WatchRow) {
    const ok = await removeWatch(row.city, row.parcelId)
    if (ok) setRows((prev) => (prev ?? []).filter((r) => !(r.city === row.city && r.parcelId === row.parcelId)))
  }

  return (
    <PageContainer>
      <PageHeading eyebrow="Watchlist" title="Parcels you are watching.">
        A watched parcel is a piece of ground, not an address and not a plan. We store what its
        answer was when you added it, so a later change is something we can point at rather than
        something you have to notice.
      </PageHeading>

      <Reveal className="mt-12">
        {!ready ? (
          <p className="text-piranha-charcoal/50">Loading…</p>
        ) : !user ? (
          <SignIn />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-piranha-charcoal/10 pb-4">
              <p className="text-sm text-piranha-charcoal/60">
                Signed in as <span className="text-piranha-charcoal">{user.email}</span>
              </p>
              <button
                type="button"
                onClick={async () => { await signOut(); await load() }}
                className="text-sm text-piranha-charcoal/60 underline underline-offset-4 transition hover:text-piranha-burgundy"
              >
                Sign out
              </button>
            </div>

            {loadError ? (
              <div className="mt-8 rounded-2xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.05] p-6">
                <p className="text-piranha-charcoal/80">Your watchlist could not be loaded. {loadError}</p>
                <p className="mt-2 text-sm text-piranha-charcoal/55">
                  This is not the same as an empty list — nothing has been removed.
                </p>
                <button type="button" onClick={() => void load()} className="mt-4 text-sm text-piranha-burgundy underline underline-offset-4">
                  Try again
                </button>
              </div>
            ) : rows && rows.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-piranha-charcoal/10 bg-white/50 p-8">
                <h2 className="font-serif text-xl tracking-tight text-piranha-charcoal">Nothing watched yet.</h2>
                <p className="mt-3 text-piranha-charcoal/65">
                  Run an address through the map and add the parcel from its report.
                </p>
                <Link to="/map" className="mt-6 inline-block text-piranha-burgundy underline underline-offset-4">
                  Open the map
                </Link>
              </div>
            ) : (
              <ul className="mt-8 space-y-4">
                {(rows ?? []).map((r) => (
                  <Row key={`${r.city} ${r.parcelId}`} row={r} onRemove={(x) => void remove(x)} />
                ))}
              </ul>
            )}
          </>
        )}
      </Reveal>
    </PageContainer>
  )
}
