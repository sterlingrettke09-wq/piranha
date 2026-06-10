import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import { getCity } from '../config/cities'
import { computeRedTapeIndex, REFERENCE, type RankedCity } from '../lib/redTapeIndex'
import { storyFor } from '../lib/cityStories'

// The Red Tape Index — a shareable ranking of the cities we cover, ordered by
// how much process and fee a single reference project carries. Every figure is
// computed live from the same constants that drive every report (see /math), so
// the table reorders itself the moment a constant changes; nothing here is
// hand-typed. Each row expands into a plain-English story (WO-8.7a) and a
// "Run a parcel in {city}" funnel CTA (WO-8.7b) — also fully computed.

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

function fmtPct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/** The concrete, sourced stat chips a city's story references — only the ones
 *  the data actually carries, so a city with no measured permit time simply
 *  shows fewer chips (never a fabricated one). */
function StatChips({ city }: { city: RankedCity }) {
  const chips: { label: string; value: string }[] = []
  if (city.measuredMedianMonths != null) {
    chips.push({
      label: 'Measured permit',
      value: `${city.measuredMedianMonths} mo median${city.measuredPermitN ? ` · n=${city.measuredPermitN.toLocaleString()}` : ''}`,
    })
  }
  if (city.reliefGrantRate != null) {
    chips.push({
      label: 'Board says yes',
      value: `${fmtPct(city.reliefGrantRate)}${city.reliefN ? ` · n=${city.reliefN.toLocaleString()}` : ''}`,
    })
  }
  chips.push({ label: 'By-right lifecycle', value: `${city.lifecycleMonths} mo` })
  chips.push({ label: '+ One variance', value: `${city.reliefAddMonths} mo` })
  if (city.feePerSqFt > 0) {
    chips.push({ label: 'Fee / sf', value: `$${city.feePerSqFt.toFixed(2)}` })
  }
  chips.push({ label: 'Parking mandate', value: city.parkingLabel })

  return (
    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
      {chips.map((c) => (
        <div key={c.label}>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/45">
            {c.label}
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums text-piranha-charcoal">{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function RedTape() {
  const ranked = computeRedTapeIndex()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-14 py-10 sm:py-16">
        <PageHeading eyebrow="The Red Tape Index" title="Ranking ten cities by the cost of permission.">
          Pick one project — a mid-rise apartment building, about 40,000 square feet, ground-up
          new construction — and ask the same question of every city we cover: how many months of
          process, and how much in fees, before you can build it? This is that answer, ranked from
          least red tape to most. Open any city for the story behind its number.
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
            <p>
              <span className="font-semibold text-piranha-charcoal">Parking mandate</span> shows
              whether a city still forces off-street parking on new housing — a flagship reform that
              can swing project cost — read from each city&rsquo;s own ordinance (see the per-parcel
              detail in any report). It&rsquo;s shown here for context only and is{' '}
              <span className="font-semibold text-piranha-charcoal">not</span> folded into the score;
              the composite remains months and fees alone.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <div className="tpp-card overflow-x-auto rounded-2xl border border-piranha-charcoal/10 bg-white/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-piranha-charcoal/10 text-left text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-5 py-3 font-semibold">City</th>
                  <th className="px-5 py-3 text-right font-semibold">Process</th>
                  <th className="px-5 py-3 text-right font-semibold">+ Variance</th>
                  <th className="px-5 py-3 text-right font-semibold">Fee / sf</th>
                  <th className="px-5 py-3 font-semibold">Parking mandate</th>
                  <th className="px-5 py-3 text-right font-semibold">Score</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Expand</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const name = getCity(r.slug).name
                  const isOpen = open === r.slug
                  const panelId = `story-${r.slug}`
                  return (
                    <Fragment key={r.slug}>
                      <tr
                        className={`border-b border-piranha-charcoal/5 last:border-0 ${
                          isOpen ? 'bg-piranha-bone/60' : ''
                        }`}
                      >
                        <td className="px-5 py-3 font-serif tabular-nums text-piranha-gold">{r.rank}</td>
                        <td className="px-5 py-3 font-medium text-piranha-charcoal">{name}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                          {fmtMonths(r.lifecycleMonths)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                          {fmtMonths(r.reliefAddMonths)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-piranha-charcoal/75">
                          {fmtFee(r.feePerSqFt)}
                        </td>
                        <td
                          className={`px-5 py-3 ${
                            r.parkingStatus === 'abolished'
                              ? 'font-medium text-piranha-gold'
                              : 'text-piranha-charcoal/75'
                          }`}
                        >
                          {r.parkingLabel}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-piranha-charcoal">
                          {fmtScore(r.score)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : r.slug)}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-piranha-burgundy transition-colors hover:text-piranha-charcoal"
                          >
                            {isOpen ? 'Less' : 'Story'}
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-piranha-charcoal/5 last:border-0">
                          <td colSpan={8} className="bg-piranha-bone/60 px-5 pb-6 pt-1">
                            <div id={panelId} className="max-w-2xl">
                              <p className="font-serif text-lg leading-relaxed tracking-tight text-piranha-charcoal">
                                {storyFor(r, ranked)}
                              </p>
                              <StatChips city={r} />
                              <Link
                                to={`/map?city=${r.slug}`}
                                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-piranha-burgundy px-5 py-2.5 text-sm font-semibold text-piranha-bone transition-colors hover:bg-piranha-charcoal"
                              >
                                Run a parcel in {name}
                                <span aria-hidden="true">→</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
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
