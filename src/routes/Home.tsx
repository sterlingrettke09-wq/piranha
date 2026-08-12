import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CinematicIntro } from '../components/CinematicIntro'
import { Reveal } from '../components/Reveal'
import { ArrowLink } from '../components/ArrowLink'
import { cityName } from '../config/cities'
import { CITY_CLAIMS, coverageFacts, rangeSentence } from '../config/coverageClaim'
import { listReports, removeReport, clearAll, type RecentReport } from '../lib/recentReports'
import { VERDICT } from '../lib/verdictLabels'
import { formatEstimate } from '../lib/format'

/** "3h ago" / "2d ago" / "just now" — compact relative time for recent cards. */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return `${Math.floor(day / 30)}mo ago`
}

/** "Pick up where you left off" — the recent-reports row (WO-8.3). Renders
 *  nothing when the buffer is empty. Reads localStorage on mount; the ✕ and
 *  clear-all mutate it and re-render via local state. */
function RecentReportsRow() {
  const [reports, setReports] = useState<RecentReport[]>(() => listReports())
  if (reports.length === 0) return null

  const remove = (url: string) => {
    removeReport(url)
    setReports(listReports())
  }
  const clear = () => {
    clearAll()
    setReports([])
  }

  return (
    <section className="bg-piranha-bone px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
                Pick up where you left off
              </p>
              <h2 className="mt-3 font-serif text-[clamp(1.6rem,3vw,2.4rem)] leading-tight tracking-tight text-piranha-charcoal">
                Reports you’ve run.
              </h2>
            </div>
            <button
              type="button"
              onClick={clear}
              className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/45 transition-colors hover:text-piranha-burgundy"
            >
              Clear all
            </button>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <div
              key={r.url}
              className="tpp-card-interactive group relative rounded-2xl border border-piranha-charcoal/12 bg-white p-5 hover:border-piranha-charcoal/25"
            >
              <button
                type="button"
                onClick={() => remove(r.url)}
                aria-label={`Remove ${r.address}`}
                className="absolute right-3 top-3 rounded-full p-1 text-piranha-charcoal/30 transition-colors hover:text-piranha-burgundy"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
              <Link to={r.url} className="block pr-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/45">
                  {cityName(r.city)}
                  {r.pinned ? ' · Pinned' : ''}
                </p>
                <p className="mt-2 font-serif text-lg leading-snug tracking-tight text-piranha-charcoal">
                  {r.address}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-piranha-charcoal/60">
                  <span className="font-medium text-piranha-burgundy">{VERDICT[r.verdict].short}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatEstimate(r.totalCost)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-piranha-charcoal/40">{relativeTime(r.ts)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const DARK = 'bg-[#1a1412]'

const FEATURES = [
  {
    n: '01',
    title: 'Every hurdle',
    body: 'Historic review, affordability mandates, environmental review, parking, prevailing wage, private covenants — for your exact parcel.',
  },
  {
    n: '02',
    title: 'What it costs',
    body: 'Hard costs, soft costs, fees, and the price of clearing each approval. Every assumption shown.',
  },
  {
    n: '03',
    title: 'How long it takes',
    body: 'Months to a permit on the path your project actually lands on.',
  },
]

const STEPS = [
  { n: '01', title: 'Pick your parcel', body: 'Search any address or drop a pin.' },
  { n: '02', title: 'Tell us the plan', body: 'Use, size, height, funding. A minute, tops.' },
  { n: '03', title: 'See where you stand', body: 'What you can build, the approvals, the cost, the time.' },
]

// The city list was two hand-written launch waves of five, frozen at the count
// that existed when they were written — so this section showed fewer than half
// the registry, under a heading asserting we were live in them. Derived now;
// there is no second list, and the heading states wiring rather than delivery.
const HOME_CITIES = CITY_CLAIMS

const STATS = [
  // "Cities live, and counting" claimed something the measurement contradicts
  // for three of them. `wired` is what this number actually counts, and the
  // rate each city delivers is one click away rather than asserted here.
  { figure: String(coverageFacts().wired), label: 'Cities wired to their own public records' },
  { figure: '9', label: 'Kinds of red tape we surface, with more coming' },
  { figure: '100%', label: 'Built from public records' },
]

export default function Home() {
  return (
    <>
      <CinematicIntro />

      {/* ── Manifesto (dark) — escalating statements ─────────────── */}
      <section className={`${DARK} px-6 py-20 text-center sm:py-24`}>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-gold">
              Regulatory intelligence for builders
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="mt-7 font-serif text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[1.04] tracking-tight text-piranha-bone">
              Building in America’s greatest cities has become almost impossible.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-piranha-bone/80">
              Zoning is only the start. A stack of other rules piles on cost and time before you
              break ground.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-10 max-w-2xl font-serif text-[clamp(1.8rem,3.6vw,2.9rem)] leading-[1.12] tracking-tight text-piranha-bone">
              We map all of it, in plain English.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-10 flex flex-col items-center gap-5">
              <ArrowLink to="/map" tone="light">
                Try it out
              </ArrowLink>
              <Link
                to="/red-tape"
                className="text-sm font-semibold uppercase tracking-[0.12em] text-piranha-gold underline underline-offset-4 transition-colors hover:text-piranha-bone"
              >
                Read the Red Tape Index →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Feature cards (white on dark) ────────────────────────── */}
      <section className={`${DARK} px-6 pb-24`}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              Every rule. Every fee. Every month. Counted.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((c, i) => (
              <Reveal key={c.title} variant="float" delay={i * 100}>
                <div className="tpp-card flex h-full flex-col rounded-2xl bg-white p-9">
                  <span className="font-serif text-2xl text-piranha-gold">{c.n}</span>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-piranha-charcoal">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-piranha-charcoal/65">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pick up where you left off (light) — only when non-empty ── */}
      <RecentReportsRow />

      {/* ── How it works (light) ─────────────────────────────────── */}
      <section className="bg-piranha-bone px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
              How it works
            </p>
            <h2 className="mt-4 max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              Click a parcel. Get the verdict.
            </h2>
          </Reveal>
          {/* The three steps share one gold thread that draws itself across as
              the row reveals — address, plan, verdict are one motion, not
              three orphaned cards. (tpp-bar-fill animates width on reveal.) */}
          <Reveal>
            <div className="relative mt-16">
              <span
                aria-hidden="true"
                className="tpp-bar-fill absolute -top-px left-0 hidden h-[2px] bg-piranha-gold sm:block"
                style={{ '--bar-w': '100%', transitionDelay: '200ms', transitionDuration: '1.4s' } as React.CSSProperties}
              />
              <div className="grid gap-12 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <Reveal key={s.n} delay={i * 160}>
                    <div className="border-t border-piranha-charcoal/15 pt-5">
                      <span className="font-serif text-xl text-piranha-gold">{s.n}</span>
                      <h3 className="mt-3 font-semibold text-piranha-charcoal">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-piranha-charcoal/65">{s.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-12 text-sm leading-relaxed text-piranha-charcoal/65">
              Weighing two sites?{' '}
              <Link to="/map" className="text-piranha-burgundy underline underline-offset-2 hover:text-piranha-charcoal">
                Run one, then line a second up against it.
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Stats (dark) ─────────────────────────────────────────── */}
      <section className={`${DARK} px-6 py-20`}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              A full picture, from public record.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-12 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div className="border-t border-piranha-bone/20 pt-5">
                  <p className="font-serif text-6xl tracking-tight text-piranha-bone sm:text-7xl">{s.figure}</p>
                  <p className="mt-3 text-sm uppercase tracking-[0.14em] text-piranha-bone/70">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-10 text-sm leading-relaxed text-piranha-bone/75">
              Which city asks the least?{' '}
              <Link to="/red-tape" className="text-piranha-gold underline underline-offset-2 hover:text-piranha-bone">
                The Red Tape Index ranks the cities we can measure.
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Cities (dark) ────────────────────────────────────────── */}
      <section className={`${DARK} border-t border-piranha-bone/10 px-6 py-20`}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-gold">
              Where we’re wired
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              We’ll add more as we expand.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-10 space-y-6">
              <div className="flex flex-wrap gap-x-9 gap-y-3">
                {HOME_CITIES.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/map?city=${c.slug}`}
                    title={c.detail}
                    className="font-serif text-2xl tracking-tight text-piranha-bone/75 transition-colors hover:text-piranha-gold sm:text-3xl"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-piranha-bone/60">
                Wired is not the same as answering. {rangeSentence()}{' '}
                <Link to="/cities" className="text-piranha-gold underline underline-offset-2 hover:text-piranha-bone">
                  Every city’s measured rate is on the coverage page.
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA (light) ──────────────────────────────────── */}
      <section className="bg-piranha-bone px-6 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="mx-auto block h-px w-16 bg-piranha-gold/70" />
            <h2 className="mt-10 font-serif text-[clamp(2.2rem,5vw,4rem)] leading-[1.06] tracking-tight text-piranha-charcoal">
              Find out what it really takes to build.
            </h2>
            <div className="mt-12 flex justify-center">
              <ArrowLink to="/map" tone="dark">
                Try it out
              </ArrowLink>
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                to="/result?city=boston&parcelId=0304578000&projectType=new&funding=private&lat=42.351159&lng=-71.066392&use=residential&gfa=12000&units=10&stories=4"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-piranha-burgundy underline underline-offset-2 transition-colors hover:text-piranha-charcoal"
              >
                See a sample report →
              </Link>
            </div>
            <p className="mt-12 text-xs text-piranha-charcoal/45">
              Estimates built from public data, not legal advice.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
