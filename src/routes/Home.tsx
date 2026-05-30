import { Link } from 'react-router-dom'
import { CinematicIntro } from '../components/CinematicIntro'
import { Reveal } from '../components/Reveal'
import { ArrowLink } from '../components/ArrowLink'
import { CITIES } from '../config/cities'

const FEATURES = [
  {
    n: '01',
    title: 'See every hurdle',
    body: 'Beyond zoning — historic review, affordability mandates, environmental review, parking rules, prevailing-wage rules, and private covenants — surfaced for your exact parcel.',
  },
  {
    n: '02',
    title: 'Price the red tape',
    body: 'Hard costs, soft costs, permit fees, and the cost of clearing each approval your project triggers. A rough order of magnitude, with every assumption shown.',
  },
  {
    n: '03',
    title: 'Time the approvals',
    body: 'How long to a permit on the path your project actually lands on — as-of-right, or the longer road through variances and public review.',
  },
]

const STEPS = [
  { n: '01', title: 'Search an address', body: 'Drop a pin on any parcel, or search by address, to pull its zoning and parcel record.' },
  { n: '02', title: 'Describe your project', body: 'Type, funding, use, size, and height — a few quick steps. No account, no consultant.' },
  { n: '03', title: 'Get the verdict', body: 'What the rules allow, the approvals you’ll need, what it costs to clear them, and how long it takes.' },
]

const STATS = [
  { figure: '5', label: 'Cities live, and expanding' },
  { figure: '9', label: 'Kinds of red tape we surface, and counting' },
  { figure: '100%', label: 'Built from public records' },
]

export default function Home() {
  return (
    <>
      <CinematicIntro />

      {/* ── Thesis cascade — escalating centered statements ──────── */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-piranha-burgundy">
            Regulatory intelligence for builders
          </p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mt-8 font-serif text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[1.04] tracking-tight text-piranha-charcoal">
            Building in America’s great cities has become almost impossible.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-10 max-w-xl text-lg leading-relaxed text-piranha-charcoal/70">
            Zoning is only the start. Historic boards, affordability mandates, environmental
            review, parking rules, fees, and private covenants each pile on cost, time, and
            doubt — most of it invisible until you’re already committed.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-14 max-w-2xl font-serif text-[clamp(1.8rem,3.6vw,2.9rem)] leading-[1.12] tracking-tight text-piranha-charcoal">
            The Piranha Project maps the entire gauntlet — for any parcel, in language anyone
            can read.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-12 flex justify-center">
            <ArrowLink to="/boston" size="lg">
              Start an analysis
            </ArrowLink>
          </div>
        </Reveal>
      </section>

      {/* ── What you get — three feature blocks ──────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-center font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              See it. Price it. Time it.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-piranha-charcoal/10 md:grid-cols-3">
            {FEATURES.map((c, i) => (
              <Reveal key={c.title} delay={i * 120}>
                <div className="h-full bg-piranha-bone p-8">
                  <span className="font-serif text-2xl text-piranha-gold">{c.n}</span>
                  <h3 className="mt-4 font-serif text-2xl tracking-tight text-piranha-charcoal">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-piranha-charcoal/70">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-piranha-burgundy">
              How it works
            </p>
            <h2 className="mt-4 max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              Three steps to a verdict.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="border-t border-piranha-charcoal/15 pt-5">
                  <span className="font-serif text-xl text-piranha-gold">{s.n}</span>
                  <h3 className="mt-3 font-semibold text-piranha-charcoal">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-piranha-charcoal/65">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              A full picture, from public record.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 120}>
                <div className="border-t border-piranha-charcoal/15 pt-5">
                  <p className="font-serif text-6xl tracking-tight text-piranha-charcoal sm:text-7xl">{s.figure}</p>
                  <p className="mt-3 text-sm uppercase tracking-[0.14em] text-piranha-charcoal/55">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cities ───────────────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-piranha-burgundy">
              Where we’re live
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              Five cities, each on its own public data.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              {CITIES.map((c) => (
                <Link
                  key={c.slug}
                  to={`/boston?city=${c.slug}`}
                  className="font-serif text-3xl tracking-tight text-piranha-charcoal/80 transition-colors hover:text-piranha-burgundy sm:text-4xl"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="border-t border-piranha-charcoal/10 px-6 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="mx-auto block h-px w-16 bg-piranha-gold/70" />
            <h2 className="mt-10 font-serif text-[clamp(2.2rem,5vw,4rem)] leading-[1.06] tracking-tight text-piranha-charcoal">
              Find out what it really takes to build.
            </h2>
            <div className="mt-12 flex justify-center">
              <ArrowLink to="/boston" size="lg">
                Start an analysis
              </ArrowLink>
            </div>
            <p className="mt-12 text-xs text-piranha-charcoal/45">
              Estimates built from public data — not legal advice.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
