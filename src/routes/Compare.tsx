import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAnalysis } from '../hooks/useAnalysis'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { AnalysisInput, AnalysisResult, CheckStatus } from '../types/analysis'

function decode<T>(s: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(atob(s)) as T
  } catch {
    return null
  }
}

const VERDICT: Record<CheckStatus, { label: string; cls: string }> = {
  AS_OF_RIGHT: { label: 'As-of-right', cls: 'text-emerald-700' },
  NEEDS_RELIEF: { label: 'Needs relief', cls: 'text-amber-700' },
  PROHIBITED: { label: 'Not permitted', cls: 'text-rose-700' },
  INDETERMINATE: { label: 'Indeterminate', cls: 'text-piranha-charcoal/60' },
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

type Loc = { lat: number; lng: number; parcelId?: string }

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <div className={`px-5 py-4 ${muted ? 'text-piranha-charcoal/55' : 'text-piranha-charcoal'}`}>{children}</div>
}

export default function Compare() {
  const [params] = useSearchParams()
  const inputA = useMemo(() => decode<AnalysisInput>(params.get('a')), [params])
  const locB = useMemo(() => decode<Loc>(params.get('b')), [params])
  const inputB = useMemo<AnalysisInput | null>(
    () => (inputA && locB ? { ...inputA, lat: locB.lat, lng: locB.lng, parcelId: locB.parcelId ?? '' } : null),
    [inputA, locB],
  )

  const a = useAnalysis(inputA)
  const b = useAnalysis(inputB)
  useDocumentTitle('Compare parcels')

  if (!inputA || !locB) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">Compare</p>
        <h1 className="mt-5 font-serif text-4xl tracking-tight">Pick two parcels to compare.</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          Run an analysis, then use “Compare on another parcel” to line up a second site.{' '}
          <Link className="text-piranha-burgundy underline underline-offset-2" to="/map">
            Start from the map
          </Link>
          .
        </p>
      </div>
    )
  }

  const proj = inputA
  const cols: { side: 'A' | 'B'; state: ReturnType<typeof useAnalysis> }[] = [
    { side: 'A', state: a },
    { side: 'B', state: b },
  ]

  const val = (s: ReturnType<typeof useAnalysis>, fn: (d: AnalysisResult) => React.ReactNode): React.ReactNode => {
    if (s.status === 'loaded') return fn(s.data)
    if (s.status === 'error') return <span className="text-rose-700">unavailable</span>
    return <span className="animate-pulse text-piranha-charcoal/30">…</span>
  }

  const rows: { label: string; render: (d: AnalysisResult) => React.ReactNode }[] = [
    {
      label: 'Verdict',
      render: (d) => <span className={`font-semibold ${VERDICT[d.feasibility.overall].cls}`}>{VERDICT[d.feasibility.overall].label}</span>,
    },
    { label: 'Construction cost', render: (d) => <span className="tabular-nums">{usd(d.costs.total)}</span> },
    { label: 'Timeline', render: (d) => <span className="tabular-nums">{d.timeline.months > 0 ? `${d.timeline.months} mo` : 'N/A'}</span> },
    { label: 'Approvals to clear', render: (d) => <span className="tabular-nums">{d.hurdles.length}</span> },
    {
      label: 'Buildable by right',
      render: (d) => {
        const far = d.parcel.maxFAR
        const lot = d.parcel.lotSqFt
        return far != null && lot != null ? (
          <span className="tabular-nums">{Math.round(far * lot).toLocaleString()} sq ft</span>
        ) : (
          <span className="text-piranha-charcoal/45">—</span>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">Compare</p>
      <h1 className="mt-4 font-serif text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] tracking-tight text-piranha-charcoal">
        Same project, two parcels.
      </h1>
      <p className="mt-3 text-sm text-piranha-charcoal/60">
        {proj.use} · {proj.gfa.toLocaleString()} sq ft{proj.units ? ` · ${proj.units} units` : ''} ·{' '}
        {proj.projectType.replace(/_/g, ' ')}
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-white/60">
        <div className="grid grid-cols-[minmax(7rem,1fr)_1fr_1fr] border-b border-piranha-charcoal/10">
          <Cell muted>
            <span className="text-xs uppercase tracking-[0.12em]">Parcel</span>
          </Cell>
          {cols.map((c) => (
            <Cell key={c.side}>
              <span className="font-serif text-lg leading-tight tracking-tight">
                {c.state.status === 'loaded' ? c.state.data.parcel.address : c.side === 'A' ? 'Parcel A' : 'Parcel B'}
              </span>
            </Cell>
          ))}
        </div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-[minmax(7rem,1fr)_1fr_1fr] ${i > 0 ? 'border-t border-piranha-charcoal/8' : ''}`}
          >
            <Cell muted>
              <span className="text-sm">{r.label}</span>
            </Cell>
            {cols.map((c) => (
              <Cell key={c.side}>{val(c.state, r.render)}</Cell>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-piranha-charcoal/45">
        Both columns run the same project spec; only the parcel differs. Estimates from public records, not advice.
      </p>
      <div className="mt-8 flex gap-5 text-xs font-semibold uppercase tracking-[0.12em]">
        <Link to={`/map?city=${proj.city}`} className="text-piranha-charcoal/60 hover:text-piranha-burgundy">
          ← Back to map
        </Link>
      </div>
    </div>
  )
}
