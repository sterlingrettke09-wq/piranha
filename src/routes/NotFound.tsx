import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { cityName } from '../config/cities'
import { listReports, removeReport, type RecentReport } from '../lib/recentReports'
import { VERDICT } from '../lib/verdictLabels'
import { formatEstimate } from '../lib/format'

/** "Looking for one of these?" — the recent-reports list on the 404 page
 *  (WO-8.6e), reusing the same localStorage buffer as Home. Renders nothing
 *  when empty. */
function RecentList() {
  const [reports, setReports] = useState<RecentReport[]>(() => listReports())
  if (reports.length === 0) return null

  const remove = (url: string) => {
    removeReport(url)
    setReports(listReports())
  }

  return (
    <div className="mx-auto mt-14 max-w-xl text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-piranha-burgundy">
        Looking for one of these?
      </p>
      <ul className="mt-4 divide-y divide-piranha-charcoal/10 rounded-2xl border border-piranha-charcoal/12 bg-white">
        {reports.map((r) => (
          <li key={r.url} className="flex items-center gap-3 px-5 py-3.5">
            <Link to={r.url} className="min-w-0 flex-1">
              <p className="truncate font-serif text-base tracking-tight text-piranha-charcoal">
                {r.address}
              </p>
              <p className="mt-0.5 truncate text-sm text-piranha-charcoal/60">
                {cityName(r.city)} · <span className="text-piranha-burgundy">{VERDICT[r.verdict].short}</span> ·{' '}
                {r.totalCost == null ? 'Not estimated' : formatEstimate(r.totalCost)}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => remove(r.url)}
              aria-label={`Remove ${r.address}`}
              className="shrink-0 rounded-full p-1 text-piranha-charcoal/30 transition-colors hover:text-piranha-burgundy"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-piranha-charcoal/60">
        Or{' '}
        <Link to="/map" className="text-piranha-burgundy underline underline-offset-2 hover:text-piranha-charcoal">
          start fresh from the map
        </Link>
        .
      </p>
    </div>
  )
}

export default function NotFound() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-serif text-6xl tracking-tight text-piranha-burgundy">404</p>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">This page swam off</h1>
        <p className="mt-3 text-piranha-charcoal/70">
          The page you’re looking for doesn’t exist. Let’s get you back to solid ground.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-md bg-piranha-burgundy px-5 py-2.5 text-sm font-medium text-piranha-bone hover:bg-piranha-burgundy/90"
          >
            Go home
          </Link>
          <Link
            to="/map"
            className="rounded-md border border-piranha-charcoal/20 px-5 py-2.5 text-sm font-medium text-piranha-charcoal hover:border-piranha-charcoal/40"
          >
            Analyze a parcel
          </Link>
        </div>

        <RecentList />
      </div>
    </PageContainer>
  )
}
