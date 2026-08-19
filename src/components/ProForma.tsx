import { useMemo, useState } from 'react'
import { buildProForma, summariseProForma, type CostSide } from '../lib/proForma'

// The cost side of a deal, on the report the reader already has.
//
// ⚠️ THE DESIGN PROBLEM IS THE ABSENT REVENUE, NOT THE FORM.
//
// A page headed "pro forma" that shows only costs will be read as a pro forma
// with a bug, or worse, as one whose revenue happens to be zero. So the missing
// half is rendered as a first-class block that says what it would take to fill
// in and why it is not filled in here — not as a footnote, and never as an empty
// "Revenue: —" row, which reads as a number we failed to fetch.
//
// The inputs are all the user's. Nothing here defaults a rate, a loan-to-cost or
// a land price: those are the three numbers this tool cannot know, and supplying
// any of them would make the total look sourced.

const inputCls =
  'w-full rounded-xl border border-piranha-charcoal/15 bg-white/70 px-4 py-2.5 text-piranha-charcoal placeholder:text-piranha-charcoal/35 focus:border-piranha-burgundy focus:outline-none focus:ring-1 focus:ring-piranha-burgundy'

const usd = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString()}`)

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-piranha-charcoal/10 py-2 last:border-0">
      <span className="text-sm text-piranha-charcoal/65">
        {label}
        {hint ? <span className="ml-2 text-xs text-piranha-charcoal/40">{hint}</span> : null}
      </span>
      <span className="shrink-0 tabular-nums text-piranha-charcoal">{value}</span>
    </div>
  )
}

export function ProForma({ estimate, units, gfaSqFt }: { estimate: CostSide; units: number | null; gfaSqFt: number }) {
  const [rate, setRate] = useState('')
  const [loan, setLoan] = useState('')
  const [land, setLand] = useState('')

  const num = (s: string): number | null => {
    const t = s.replace(/[$,\s]/g, '')
    if (t === '') return null
    const n = Number(t)
    // Junk is not zero. A rate of "abc" must not become 0% and produce a
    // confident carry cost of nothing.
    return Number.isFinite(n) ? n : null
  }

  const p = useMemo(
    () =>
      buildProForma(estimate, { units, gfaSqFt }, {
        annualRatePct: num(rate),
        loanAmount: num(loan),
        landCost: num(land),
      }),
    [estimate, units, gfaSqFt, rate, loan, land],
  )

  const range = (lo: number | null, hi: number | null) =>
    lo == null ? '—' : lo === hi ? usd(lo) : `${usd(lo)} – ${usd(hi)}`

  return (
    <section className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 sm:p-8">
      <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">Development cost</h2>
      <p className="mt-2 max-w-prose text-sm text-piranha-charcoal/65">
        What it costs to build this, including the money you spend waiting. Give us a rate and a
        loan amount and we will price the carry against the timeline above.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="pf-rate" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Interest rate %</label>
          <input id="pf-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="8.5" className={`mt-1.5 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="pf-loan" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Loan amount</label>
          <input id="pf-loan" inputMode="numeric" value={loan} onChange={(e) => setLoan(e.target.value)} placeholder="2,000,000" className={`mt-1.5 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="pf-land" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Land price</label>
          <input id="pf-land" inputMode="numeric" value={land} onChange={(e) => setLand(e.target.value)} placeholder="—" className={`mt-1.5 ${inputCls}`} />
        </div>
      </div>
      <p className="mt-2 text-xs text-piranha-charcoal/45">
        All three are yours. We do not carry a market interest rate, we will not assume a
        loan-to-cost ratio, and an assessed value is not a price.
      </p>

      <div className="mt-8">
        <Row label="Hard cost" value={usd(p.development.hard)} />
        <Row label="Soft cost" value={usd(p.development.soft)} />
        <Row label="Permit fees" value={usd(p.development.permit)} />
        {p.development.demolition > 0 ? <Row label="Demolition" value={usd(p.development.demolition)} /> : null}
        <Row label="Impact / linkage fees" value={usd(p.development.impact)} />
        <Row label="Construction subtotal" value={usd(p.development.constructionTotal)} />
        <Row label="Land" value={usd(p.land.amount)} hint={p.land.amount == null ? 'not supplied' : 'your figure'} />
        {'months' in p.carry ? (
          <Row
            label="Carry"
            value={`${usd(p.carry.averageBalance)} – ${usd(p.carry.fullBalance)}`}
            hint={`${p.carry.months} months at ${p.carry.annualRatePct}%`}
          />
        ) : (
          <Row label="Carry" value="—" hint="needs a rate and a loan amount" />
        )}
      </div>

      <div className="mt-6 rounded-xl border border-piranha-charcoal/15 bg-piranha-charcoal/[0.04] p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-piranha-charcoal">Total development cost</span>
          <span className="shrink-0 font-serif text-xl tabular-nums text-piranha-charcoal">
            {range(p.totalDevelopmentCost.low, p.totalDevelopmentCost.high)}
          </span>
        </div>
        <p className="mt-2 text-sm text-piranha-charcoal/65">{summariseProForma(p)}</p>
        {p.perUnit.low != null || p.perSqFt.low != null ? (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-piranha-charcoal/10 pt-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-piranha-charcoal/45">Per unit</p>
              <p className="tabular-nums text-piranha-charcoal">
                {p.perUnit.low == null ? '— no unit count' : range(p.perUnit.low, p.perUnit.high)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-piranha-charcoal/45">Per sq ft</p>
              <p className="tabular-nums text-piranha-charcoal">{range(p.perSqFt.low, p.perSqFt.high)}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ⚠️ The missing half, as a block rather than a footnote. "Revenue: —"
          would read as a number we failed to fetch. */}
      <div className="mt-6 rounded-xl border border-dashed border-piranha-charcoal/25 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-piranha-charcoal/50">
          The revenue side is yours
        </p>
        <p className="mt-2 max-w-prose text-sm text-piranha-charcoal/70">{p.revenue.detail}</p>
        <ul className="mt-4 space-y-1.5">
          {p.revenue.needs.map((n) => (
            <li key={n.field} className="text-sm text-piranha-charcoal/70">
              <span className="text-piranha-charcoal">{n.field}</span>
              <span className="text-piranha-charcoal/45"> → {n.unlocks}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
