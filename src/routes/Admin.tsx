import { useCallback, useEffect, useMemo, useState } from 'react'

interface SearchEntry {
  ts: string
  city: string
  address: string
  use?: string
  projectType?: string
  gfa?: number
  units?: number
  verdict?: string
  months?: number
}

const KEY_STORE = 'tpp_admin_key'

const VERDICT_LABEL: Record<string, string> = {
  AS_OF_RIGHT: 'As-of-right',
  NEEDS_RELIEF: 'Needs relief',
  PROHIBITED: 'Not permitted',
  INDETERMINATE: 'Indeterminate',
}

const CITY_LABEL: Record<string, string> = {
  boston: 'Boston',
  nyc: 'New York',
  chicago: 'Chicago',
  sf: 'San Francisco',
  seattle: 'Seattle',
}

function fmt(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

export default function Admin() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_STORE) ?? '')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'locked' | 'loading' | 'ready' | 'error'>('locked')
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [error, setError] = useState('')
  const [now] = useState(() => Date.now())

  const load = useCallback((passphrase: string) => {
    setStatus('loading')
    setError('')
    fetch('/.netlify/functions/searches-log', { headers: { 'x-admin-key': passphrase } })
      .then(async (r) => {
        if (r.status === 401) throw new Error('That passphrase didn’t match.')
        if (r.status === 503) throw new Error('The log isn’t configured yet (set ADMIN_KEY in Netlify).')
        if (!r.ok) throw new Error('Could not load the log.')
        return r.json() as Promise<{ count: number; entries: SearchEntry[] }>
      })
      .then((data) => {
        localStorage.setItem(KEY_STORE, passphrase)
        setKey(passphrase)
        setEntries(data.entries)
        setStatus('ready')
      })
      .catch((e: Error) => {
        setError(e.message)
        setStatus('error')
      })
  }, [])

  // Auto-load if a passphrase is already remembered. Deferred to a timer so the
  // fetch's setState doesn't fire synchronously inside the effect body.
  useEffect(() => {
    if (!key) return
    const t = setTimeout(() => load(key), 0)
    return () => clearTimeout(t)
  }, [key, load])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) load(input.trim())
  }

  function signOut() {
    localStorage.removeItem(KEY_STORE)
    setKey('')
    setEntries([])
    setInput('')
    setStatus('locked')
  }

  const unlocked = status === 'ready'

  const stats = useMemo(() => {
    if (!entries.length) return null
    const byCity: Record<string, number> = {}
    const byAddress: Record<string, number> = {}
    let last7 = 0
    for (const e of entries) {
      byCity[e.city] = (byCity[e.city] ?? 0) + 1
      const k = `${e.address} · ${CITY_LABEL[e.city] ?? e.city}`
      byAddress[k] = (byAddress[k] ?? 0) + 1
      const t = new Date(e.ts).getTime()
      if (!Number.isNaN(t) && now - t < 7 * 86_400_000) last7 += 1
    }
    return {
      cities: Object.entries(byCity).sort((a, b) => b[1] - a[1]),
      topAddresses: Object.entries(byAddress).sort((a, b) => b[1] - a[1]).slice(0, 5),
      last7,
    }
  }, [entries, now])

  function exportCsv() {
    const head = ['timestamp', 'city', 'address', 'use', 'projectType', 'gfa', 'units', 'verdict', 'months']
    const cell = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`
    const lines = [
      head.join(','),
      ...entries.map((e) =>
        [e.ts, e.city, e.address, e.use, e.projectType, e.gfa, e.units, e.verdict, e.months].map(cell).join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'piranha-searches.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
            Private
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] tracking-tight text-piranha-charcoal">
            Search log
          </h1>
          <p className="mt-3 text-sm text-piranha-charcoal/55">
            Every analysis run, newest first. Visible only with the passphrase.
          </p>
        </div>
        {unlocked && (
          <div className="flex items-center gap-3 text-sm">
            <span className="tabular-nums text-piranha-charcoal/55">{entries.length} entries</span>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-full border border-piranha-charcoal/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70 hover:border-piranha-charcoal/40"
              >
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-piranha-charcoal/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70 hover:border-piranha-charcoal/40"
            >
              Lock
            </button>
          </div>
        )}
      </header>

      {unlocked && stats && (
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-piranha-charcoal/45">Total searches</p>
            <p className="mt-2 font-serif text-4xl tracking-tight text-piranha-charcoal tabular-nums">{entries.length}</p>
            <p className="mt-1 text-xs text-piranha-charcoal/55 tabular-nums">{stats.last7} in the last 7 days</p>
          </div>
          <div className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-piranha-charcoal/45">By city</p>
            <ul className="mt-2 space-y-1 text-sm">
              {stats.cities.map(([slug, n]) => (
                <li key={slug} className="flex justify-between">
                  <span className="text-piranha-charcoal/75">{CITY_LABEL[slug] ?? slug}</span>
                  <span className="tabular-nums text-piranha-charcoal/55">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-piranha-charcoal/45">Most searched</p>
            <ul className="mt-2 space-y-1 text-sm">
              {stats.topAddresses.map(([addr, n]) => (
                <li key={addr} className="flex justify-between gap-2">
                  <span className="truncate text-piranha-charcoal/75">{addr}</span>
                  <span className="shrink-0 tabular-nums text-piranha-charcoal/55">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!unlocked && (
        <form onSubmit={submit} className="mt-12 max-w-sm">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/55">
            Passphrase
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="mt-2 w-full rounded-xl border border-piranha-charcoal/20 bg-white px-4 py-3 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none"
            placeholder="Enter passphrase"
          />
          <button
            type="submit"
            disabled={status === 'loading' || !input.trim()}
            className="mt-4 rounded-full bg-piranha-burgundy px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-bone transition-colors hover:bg-piranha-charcoal disabled:opacity-40"
          >
            {status === 'loading' ? 'Unlocking…' : 'Unlock'}
          </button>
          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
        </form>
      )}

      {unlocked && entries.length === 0 && (
        <p className="mt-12 rounded-2xl border border-piranha-charcoal/10 bg-white/50 p-8 text-piranha-charcoal/65">
          No searches logged yet. Run an analysis and it will show up here.
        </p>
      )}

      {unlocked && entries.length > 0 && (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-piranha-charcoal/10 bg-white/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-piranha-charcoal/10 text-left text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-5 py-3 font-semibold">City</th>
                <th className="px-5 py-3 font-semibold">Address</th>
                <th className="px-5 py-3 font-semibold">Wanted to build</th>
                <th className="px-5 py-3 font-semibold">Verdict</th>
                <th className="px-5 py-3 text-right font-semibold">Months</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b border-piranha-charcoal/5 last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-piranha-charcoal/55 tabular-nums">{fmt(e.ts)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-piranha-charcoal/75">{CITY_LABEL[e.city] ?? e.city}</td>
                  <td className="px-5 py-3 font-medium text-piranha-charcoal">{e.address}</td>
                  <td className="px-5 py-3 text-piranha-charcoal/70">
                    {[
                      e.use,
                      e.projectType,
                      e.gfa ? `${e.gfa.toLocaleString()} sq ft` : null,
                      e.units ? `${e.units} units` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-piranha-charcoal/70">
                    {e.verdict ? (VERDICT_LABEL[e.verdict] ?? e.verdict) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/70">
                    {e.months ? e.months : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
