import { useEffect, useState } from 'react'
import { PageContainer } from '../components/PageContainer'
import type { NewsItem, Jurisdiction, NewsCategory } from '../types/news'

const JUR_LABEL: Record<Jurisdiction, string> = {
  federal: 'Federal',
  state: 'State',
  boston: 'Boston',
  nyc: 'New York',
  sf: 'San Francisco',
  seattle: 'Seattle',
  chicago: 'Chicago',
}

const CAT_LABEL: Record<NewsCategory, string> = {
  zoning: 'Zoning',
  permitting: 'Permitting',
  tax: 'Tax',
  incentive: 'Incentive',
  tenant: 'Tenant',
  other: 'Other',
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
        active
          ? 'border-piranha-burgundy bg-piranha-burgundy text-piranha-bone'
          : 'border-piranha-charcoal/20 text-piranha-charcoal/70 hover:border-piranha-charcoal/40'
      }`}
    >
      {children}
    </button>
  )
}

export default function News() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [err, setErr] = useState(false)
  const [jur, setJur] = useState<'all' | Jurisdiction>('all')
  const [cat, setCat] = useState<'all' | NewsCategory>('all')

  useEffect(() => {
    let cancelled = false
    fetch('/data/news/feed.json')
      .then((r) => r.json())
      .then((d: NewsItem[]) => {
        if (!cancelled) setItems([...d].sort((a, b) => b.date.localeCompare(a.date)))
      })
      .catch(() => {
        if (!cancelled) setErr(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const all = items ?? []
  const jurisdictions = Array.from(new Set(all.map((i) => i.jurisdiction)))
  const categories = Array.from(new Set(all.map((i) => i.category)))
  const filtered = all.filter(
    (i) => (jur === 'all' || i.jurisdiction === jur) && (cat === 'all' || i.category === cat),
  )

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-serif text-4xl tracking-tight text-piranha-charcoal sm:text-5xl">
              Policy feed
            </h1>
            <span className="text-xs uppercase tracking-wider text-piranha-charcoal/40">Updated biweekly</span>
          </div>
          <p className="text-piranha-charcoal/70">
            Recent zoning, permitting, and housing-policy moves across our cities and the
            states above them — in plain English, always linked to the source.
          </p>
        </header>

        {all.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Chip active={jur === 'all'} onClick={() => setJur('all')}>All places</Chip>
              {jurisdictions.map((j) => (
                <Chip key={j} active={jur === j} onClick={() => setJur(j)}>{JUR_LABEL[j]}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={cat === 'all'} onClick={() => setCat('all')}>All topics</Chip>
              {categories.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{CAT_LABEL[c]}</Chip>
              ))}
            </div>
          </div>
        )}

        {err && <p className="text-piranha-charcoal/60">Couldn’t load the feed right now.</p>}
        {!err && items === null && <div className="h-40 animate-pulse rounded-xl bg-piranha-charcoal/5" />}
        {items !== null && filtered.length === 0 && (
          <p className="text-piranha-charcoal/60">Nothing matches that filter yet.</p>
        )}

        <div className="space-y-5">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-xl border border-piranha-charcoal/10 bg-white/60 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-piranha-charcoal/50">{fmtDate(item.date)}</span>
                <span className="rounded-full bg-piranha-burgundy/10 px-2 py-0.5 font-medium text-piranha-burgundy">
                  {JUR_LABEL[item.jurisdiction]}
                </span>
                <span className="rounded-full bg-piranha-charcoal/5 px-2 py-0.5 font-medium text-piranha-charcoal/60">
                  {CAT_LABEL[item.category]}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-xl tracking-tight text-piranha-charcoal">{item.headline}</h2>
              <p className="mt-2 leading-relaxed text-piranha-charcoal/80">{item.summary}</p>
              <p className="mt-2 text-sm text-piranha-charcoal/60">
                <span className="font-semibold text-piranha-charcoal/75">Why it matters for building:</span>{' '}
                {item.why_it_matters}
              </p>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-piranha-burgundy hover:underline"
              >
                {item.source_name} →
              </a>
            </article>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
