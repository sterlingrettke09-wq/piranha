import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAnalysis } from '../hooks/useAnalysis'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { AnalysisInput, AnalysisResult, CheckStatus } from '../types/analysis'
import { decodeJsonB64 } from '../lib/b64'
import { VERDICT } from '../lib/verdictLabels'
import { formatEstimate } from '../lib/format'
import { hasCitySpecificHurdles, hasMeasuredPermitTiming } from '../config/cities'
import { summarizeUnchecked } from '../lib/uncheckedHurdles'

function decode<T>(s: string | null): T | null {
  if (!s) return null
  return decodeJsonB64<T>(s)
}

// Verdict copy comes from the shared module (`VERDICT[status].short`); only the
// per-status text color is local to this table.
const VERDICT_CLS: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'text-emerald-700',
  NEEDS_RELIEF: 'text-amber-700',
  PROHIBITED: 'text-rose-700',
  INDETERMINATE: 'text-piranha-charcoal/60',
}

const usd = (n: number) => formatEstimate(n)

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
      render: (d) => (
        <span className={`font-semibold ${VERDICT_CLS[d.feasibility.overall]}`}>
          {VERDICT[d.feasibility.overall].short}
        </span>
      ),
    },
    {
      // Before the cost, unconditionally. The result page surfaces the lot area
      // above its estimates for a reason (a 2 sq ft Las Vegas sliver publishing
      // AS_OF_RIGHT and $482,996 off correct geometry and correct arithmetic),
      // and a disclosure that holds on one surface and not the other is the same
      // defect with a smaller audience — this table publishes the cost too.
      // No threshold: every parcel shows its lot, so the reader decides.
      label: 'Lot size',
      render: (d) =>
        d.parcel.lotSqFt != null ? (
          <span className="tabular-nums">{d.parcel.lotSqFt.toLocaleString()} sq ft</span>
        ) : (
          // A gap, not a claim the parcel has no area.
          <span className="text-piranha-charcoal/45">not on file</span>
        ),
    },
    { label: 'Construction cost', render: (d) => <span className="tabular-nums">{usd(d.costs.total)}</span> },
    {
      // Some cities carry a measured filing→issuance permit leg from their own
      // open-data portal; the rest are estimate-only. Unmarked, the difference
      // reads as one city being faster than another when it is really one being
      // unmeasured — absence of a finding rendering as a finding of absence, same
      // as the hurdle count above.
      //
      // ⚠️ THE TOOLTIP USED TO NAME A CAUSE, and the cause was wrong for some of
      // the cities it rendered on: "This city publishes no permit application
      // date." True of Boston, DC, Minneapolis, San Jose and Columbus. FALSE of
      // NYC (withdrawn 2026-08-09 — its filing dates are present and clean; what
      // was withdrawn is a median conditional on issuance), false of SF, LA and
      // Chicago (each withdrawn on a measured disqualifier), false of Atlanta and
      // Milwaukee (pipelines that refuse by design), and false of Charlotte (no
      // building-permit dataset at all). One string cannot carry six different
      // reasons, so it no longer tries to carry any: it states what is true of
      // every unmarked city — no measured figure is published — and points at the
      // per-city record. Disclosure copy is code; a claim can be true in one file
      // and false in the branch it is copied to.
      label: 'Timeline',
      render: (d) => {
        if (d.timeline.months <= 0) return <span className="tabular-nums">N/A</span>
        // A check that could not be performed is a THIRD kind of caveat on this
        // cell, and the one that moves the number most: LA's Coastal
        // Development Permit is serial, so a failed coastal read took 9 months
        // out of a 57-month estimate with nothing on the page saying so. It
        // wins the cell because it is the larger and more specific claim — the
        // measured/estimated distinction still holds but is the smaller error.
        const excluded = summarizeUnchecked(d.hurdles).excludedMonths
        if (excluded > 0)
          return (
            <span
              className="tabular-nums text-piranha-charcoal/70"
              title={`At least this long. A city data service did not respond while this report was generated, so an approval we could not check may add up to ${excluded} more months. It is NOT included in this figure — the requirement may not apply here, and assuming it does would invent time. The full report names the check.`}
            >
              {d.timeline.months} mo<span className="ml-1 align-super text-[0.65em]">unchecked</span>
            </span>
          )
        return hasMeasuredPermitTiming(d.project.city) ? (
          <span className="tabular-nums">{d.timeline.months} mo</span>
        ) : (
          <span
            className="tabular-nums text-piranha-charcoal/70"
            title="Estimated. We publish no measured filing-to-issuance figure for this city — for some the data has no application date, for others a figure was measured and withdrawn. Either way this is a lifecycle estimate, not a measurement, and it is not comparable to a city showing a measured figure."
          >
            {d.timeline.months} mo<span className="ml-1 align-super text-[0.65em]">est</span>
          </span>
        )
      },
    },
    {
      // A bare count read across cities invites the comparison "DC needs fewer
      // approvals than Boston". For cities whose specific mandates we have not
      // encoded, the count is a FLOOR and the difference is our coverage, not
      // the city's rules — so the number is marked rather than left to be read
      // as complete.
      // ⚠️ SECOND REASON THE COUNT CAN BE A FLOOR, and it is per-REQUEST rather
      // than per-city: an `unchecked` row means a city overlay layer did not
      // answer on this run, so a requirement may exist that nothing here could
      // see. Those rows are excluded from the number — counting them would make
      // an outage read as MORE approvals than a healthy run — and marked
      // 'unchecked' rather than 'partial', because the two are not the same
      // claim. 'partial' says our coverage of this city is incomplete and will
      // say so tomorrow too; 'unchecked' says a service was down for this
      // report and a reload may resolve it.
      label: 'Approvals to clear',
      render: (d) => {
        const s = summarizeUnchecked(d.hurdles)
        const unchecked = s.unchecked.length
        const n = s.counted.length
        if (unchecked > 0)
          return (
            <span
              className="tabular-nums text-piranha-charcoal/70"
              title={`At least this many. ${unchecked} ${unchecked === 1 ? 'check' : 'checks'} could not be performed for this parcel — a city data service did not respond while the report was generated, so a requirement may apply that is not counted here. The full report lists which. Reloading may resolve it.`}
            >
              {n}+<span className="ml-1 align-super text-[0.65em]">unchecked</span>
            </span>
          )
        return hasCitySpecificHurdles(d.project.city) ? (
          <span className="tabular-nums">{n}</span>
        ) : (
          <span
            className="tabular-nums text-piranha-charcoal/70"
            title="At least this many. City-specific requirements (inclusionary housing, large-project review) are not yet encoded for this city, so this is a floor — not a complete list."
          >
            {n}+<span className="ml-1 align-super text-[0.65em]">partial</span>
          </span>
        )
      },
    },
    {
      label: 'Most you can build',
      render: (d) => {
        const e = d.parcel.envelope
        if (e?.maxFloorAreaSqFt != null)
          return <span className="tabular-nums">{e.maxFloorAreaSqFt.toLocaleString()} sq ft</span>
        if (e?.maxStories != null) return <span className="tabular-nums">{e.maxStories} stories</span>
        if (e?.maxHeightFt != null) return <span className="tabular-nums">{e.maxHeightFt} ft</span>
        return <span className="text-piranha-charcoal/45">—</span>
      },
    },
    {
      // Coarse land-cost proxy from county assessor records — never used in the
      // cost math; em-dash where the provider carries no value.
      label: 'Assessed value (county)',
      render: (d) => {
        const v = d.parcel.existing?.assessedValue
        return v != null ? (
          <span className="tabular-nums">{usd(v)}</span>
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

      <div className="mt-6 rounded-xl border border-piranha-charcoal/15 bg-piranha-burgundy/[0.04] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-burgundy">
          How to read this
        </p>
        <p className="mt-1 text-sm text-piranha-charcoal/70">
          Both columns run the same project spec; only the parcel differs.
        </p>
      </div>

      {/* At 360px three columns inside ~312px of content would crush the
          addresses and values. Scroll the table horizontally instead: the outer
          wrapper clips + scrolls, the inner block holds a min-width so the grid
          keeps legible column sizes and the user swipes to see Parcel B. The
          right-edge fade is a subtle "there's more →" affordance. */}
      <div className="relative mt-6">
        <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-piranha-charcoal/10 bg-white/60">
          <div className="min-w-[34rem]">
            <div className="grid grid-cols-[minmax(7rem,1fr)_1fr_1fr] border-b border-piranha-charcoal/10">
              <Cell muted>
                <span className="text-xs uppercase tracking-[0.12em]">Parcel</span>
              </Cell>
              {cols.map((c) => (
                <Cell key={c.side}>
                  <span className="font-serif text-lg leading-tight tracking-tight">
                    {c.state.status === 'loaded'
                      ? c.state.data.parcel.address
                      : c.side === 'A'
                        ? 'Parcel A'
                        : 'Parcel B'}
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
        </div>
        {/* Scroll affordance — a soft fade at the right edge on narrow viewports
            where the table overflows; hidden once there's room (md+). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-piranha-bone/80 to-transparent md:hidden"
        />
      </div>

      <p className="mt-4 text-xs text-piranha-charcoal/45">
        Estimates from public records, not advice.
      </p>
      <div className="mt-8 flex gap-5 text-xs font-semibold uppercase tracking-[0.12em]">
        <Link to={`/map?city=${proj.city}`} className="text-piranha-charcoal/60 hover:text-piranha-burgundy">
          ← Back to map
        </Link>
      </div>
    </div>
  )
}
