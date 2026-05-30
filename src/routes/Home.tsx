import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { CinematicIntro } from '../components/CinematicIntro'
import { Reveal } from '../components/Reveal'
import { CITIES } from '../config/cities'

const WHAT_WE_DO = [
  {
    title: 'See every hurdle',
    body: 'Beyond zoning — historic review, affordability mandates, environmental review, parking rules, labor and DEI requirements, and private covenants — surfaced for your exact parcel.',
  },
  {
    title: 'Price the red tape',
    body: 'Hard costs, soft costs, permit fees, and the cost of clearing each approval your project triggers. A rough order of magnitude, with every assumption shown.',
  },
  {
    title: 'Time the approvals',
    body: 'How many months to a permit on the path your project actually lands on — as-of-right, or the longer road through variances and public review.',
  },
]

const STEPS = [
  { n: '01', title: 'Search an address', body: 'Drop a pin on any parcel, or search by address, to pull its zoning and parcel record.' },
  { n: '02', title: 'Describe your project', body: 'Type, use, size, and height — a few quick steps. No account, no consultant.' },
  { n: '03', title: 'Get the verdict', body: 'What the rules allow, the approvals you’ll need, what it costs to clear them, and how long it takes.' },
]

const STATS = [
  { figure: '5', label: 'Cities live, and expanding' },
  { figure: '100%', label: 'Sourced from public data' },
  { figure: '0', label: 'Consultants required' },
]

export default function Home() {
  return (
    <>
      <CinematicIntro />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
        <img
          src="/logo/piranha-fish-burgundy.png"
          alt=""
          aria-hidden="true"
          className="mb-8 w-16 sm:w-20"
        />
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-piranha-burgundy">
          Regulatory intelligence for builders
        </p>
        <h1 className="font-serif text-[2.7rem] leading-[1.04] tracking-tight text-piranha-charcoal sm:text-[4.25rem]">
          Ever wonder why it’s nearly impossible to build in many American cities?
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-piranha-charcoal/75">
          The wondering is over. The Piranha Project shows you every regulatory hurdle
          between you and a finished building — what it costs to clear, how long it takes
          to permit, and the rules standing in the way.
        </p>
        <div className="mt-10">
          <Link to="/boston">
            <Button size="lg">Start an analysis →</Button>
          </Link>
        </div>
        <p className="mt-20 text-xs uppercase tracking-[0.22em] text-piranha-charcoal/35">
          Scroll ↓
        </p>
      </section>

      {/* ── What we do (blocks float to the front) ────────────── */}
      <section className="border-t border-piranha-charcoal/10 bg-piranha-bone px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-piranha-burgundy">
              What we do
            </p>
            <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight tracking-tight text-piranha-charcoal sm:text-5xl">
              The whole maze, mapped for one parcel.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {WHAT_WE_DO.map((c, i) => (
              <Reveal key={c.title} variant="float" delay={i * 140}>
                <div className="h-full rounded-2xl border border-piranha-charcoal/10 bg-white/50 p-8">
                  <h3 className="font-serif text-2xl tracking-tight text-piranha-charcoal">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-piranha-charcoal/70">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-piranha-burgundy">
              How it works
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-piranha-charcoal sm:text-5xl">
              Three steps to a verdict.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 140}>
                <div className="space-y-3">
                  <span className="font-serif text-3xl text-piranha-burgundy">{s.n}</span>
                  <h3 className="font-semibold text-piranha-charcoal">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-piranha-charcoal/70">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats moment (dark) ───────────────────────────────── */}
      <section className="bg-piranha-charcoal px-6 py-28 text-piranha-bone">
        <div className="mx-auto grid max-w-5xl gap-12 text-center sm:grid-cols-3">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 140}>
              <p className="font-serif text-6xl tracking-tight text-piranha-bone sm:text-7xl">{s.figure}</p>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-piranha-bone/60">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Cities ────────────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-piranha-burgundy">
              Where we’re live
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-piranha-charcoal sm:text-5xl">
              Five cities, on their own public data.
            </h2>
          </Reveal>
          <div className="mt-12 flex flex-wrap gap-4">
            {CITIES.map((c, i) => (
              <Reveal key={c.slug} delay={i * 80}>
                <Link
                  to={`/boston?city=${c.slug}`}
                  className="block rounded-full border border-piranha-charcoal/15 px-6 py-3 font-serif text-xl tracking-tight text-piranha-charcoal transition-colors hover:border-piranha-burgundy hover:text-piranha-burgundy"
                >
                  {c.name}
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA (dark) ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-piranha-burgundy px-6 py-32 text-center text-piranha-bone">
        <img
          src="/logo/piranha-fish-burgundy.png"
          alt=""
          aria-hidden="true"
          className="tpp-drift pointer-events-none absolute -right-10 top-10 w-48 opacity-10 sm:w-72"
        />
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-6xl">
            Find out what it really takes to build.
          </h2>
          <div className="mt-10">
            <Link to="/boston">
              <span className="inline-block rounded-md bg-piranha-bone px-7 py-3.5 text-sm font-semibold text-piranha-burgundy transition-colors hover:bg-white">
                Start an analysis →
              </span>
            </Link>
          </div>
          <p className="mt-10 text-xs text-piranha-bone/55">
            Estimates built from public data — not legal advice.
          </p>
        </Reveal>
      </section>
    </>
  )
}
