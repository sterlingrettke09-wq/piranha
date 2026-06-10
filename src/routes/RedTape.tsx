import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import { getCity } from '../config/cities'
import { computeRedTapeIndex, REFERENCE } from '../lib/redTapeIndex'

// The Red Tape Index — a shareable ranking of the cities we cover, ordered by
// how much process and fee a single reference project carries. Every figure is
// computed live from the same constants that drive every report (see /math), so
// the table reorders itself the moment a constant changes; nothing here is
// hand-typed.

const EM_DASH = '—'

function fmtMonths(n: number): string {
  return `${n} mo`
}

function fmtFee(perSqFt: number): string {
  return perSqFt > 0 ? `$${perSqFt.toFixed(2)}` : EM_DASH
}

function fmtScore(n: number): string {
  return n.toFixed(0)
}

export default function RedTape() {
  const ranked = computeRedTapeIndex()

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-14 py-10 sm:py-16">
        <PageHeading eyebrow="The Red Tape Index" title="Ranking ten cities by the cost of permission.">
          Pick one project — a mid-rise apartment building, about 40,000 square feet, ground-up
          new construction — and ask the same question of every city we cover: how many months of
          process, and how much in fees, before you can build it? This is that answer, ranked from
          least red tape to most.
        </PageHeading>

        <Reveal>
          <section className="space-y-4 leading-relaxed text-piranha-charcoal/75">
            <p>
              Every number below is computed from the same constants as every report we produce —{' '}
              <Link className="text-piranha-burgundy underline underline-offset-2" to="/math">
                see the methodology
              </Link>
              . There are no hand-typed figures on this page: change a timeline or a fee in the
              engine and this ranking reorders itself.
            </p>
            <p>
              <span className="font-semibold text-piranha-charcoal">Months of process</span> is the
              full by-right life-cycle for an apartment-tier project in that city, plus the time a
              single dimensional variance typically adds.{' '}
              <span className="font-semibold text-piranha-charcoal">Fees</span> is the affordable-
              housing or linkage fee, in dollars per square foot, that this reference project would
              actually owe — an em-dash where none applies to a residential building of this size.
              The composite normalizes both to a 0–100 scale across the ten cities, weights months
              at 70 percent and fees at 30 percent, and ranks ascending. Lower is freer to build.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <div className="overflow-x-auto rounded-2xl border border-piranha-charcoal/10 bg-white/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-piranha-charcoal/10 text-left text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-5 py-3 font-semibold">City</th>
                  <th className="px-5 py-3 text-right font-semibold">Process</th>
                  <th className="px-5 py-3 text-right font-semibold">+ Variance</th>
                  <th className="px-5 py-3 text-right font-semibold">Fee / sf</th>
                  <th className="px-5 py-3 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.slug} className="border-b border-piranha-charcoal/5 last:border-0">
                    <td className="px-5 py-3 font-serif tabular-nums text-piranha-gold">{r.rank}</td>
                    <td className="px-5 py-3 font-medium text-piranha-charcoal">{getCity(r.slug).name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                      {fmtMonths(r.lifecycleMonths)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                      {fmtMonths(r.reliefAddMonths)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                      {fmtFee(r.feePerSqFt)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-piranha-charcoal">
                      {fmtScore(r.score)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal>
          <section className="space-y-4 border-t border-piranha-charcoal/15 pt-8 text-sm leading-relaxed text-piranha-charcoal/65">
            <p>
              The reference project: {REFERENCE.label.toLowerCase()}. A lower score means fewer
              months and lighter fees standing between an idea and a building — not that a city is
              better or worse to live in, only that it asks less of someone trying to add housing.
            </p>
            <p>
              These are estimates, labeled as estimates, drawn entirely from public data and the
              engine&rsquo;s published constants. Want to see the same math run against a real
              parcel?{' '}
              <Link className="text-piranha-burgundy underline underline-offset-2" to="/map">
                Pick an address
              </Link>
              .
            </p>
          </section>
        </Reveal>
      </div>
    </PageContainer>
  )
}
