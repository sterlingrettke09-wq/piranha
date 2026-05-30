import { Link } from 'react-router-dom'
import { CinematicIntro } from '../components/CinematicIntro'
import { Reveal } from '../components/Reveal'
import { ArrowLink } from '../components/ArrowLink'
import { CITIES } from '../config/cities'

const DARK = 'bg-[#1a1412]'

const FEATURES = [
  {
    n: '01',
    title: 'Every hurdle',
    body: 'Beyond zoning — historic review, affordability mandates, environmental review, parking rules, prevailing-wage rules, and private covenants — surfaced for your exact parcel.',
  },
  {
    n: '02',
    title: 'What it costs',
    body: 'Hard costs, soft costs, permit fees, and the cost of clearing each approval your project triggers — a rough order of magnitude, with every assumption shown.',
  },
  {
    n: '03',
    title: 'How long it takes',
    body: 'The months to a permit on the path your project actually lands on — as-of-right, or the longer road through variances and public review.',
  },
]

const STEPS = [
  { n: '01', title: 'Pick your parcel', body: 'Drop a pin or search any address — we pull its zoning and property record.' },
  { n: '02', title: 'Tell us the plan', body: 'What you want to build: use, size, height, and how it’s funded. A minute, tops — no account, no consultant.' },
  { n: '03', title: 'See where you stand', body: 'What you’re allowed to build, the approvals it triggers, what they’ll cost, and how long they’ll take.' },
]

const STATS = [
  { figure: '5', label: 'Cities live, and counting' },
  { figure: '9', label: 'Kinds of red tape we surface, with more coming' },
  { figure: '100%', label: 'Built from public records' },
]

export default function Home() {
  return (
    <>
      <CinematicIntro />

      {/* ── Manifesto (dark) — escalating statements ─────────────── */}
      <section className={`${DARK} px-6 py-32 text-center sm:py-40`}>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-gold">
              Regulatory intelligence for builders
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="mt-9 font-serif text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[1.04] tracking-tight text-piranha-bone">
              Building in most of America’s greatest cities has become almost impossible.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-10 max-w-xl text-lg leading-relaxed text-piranha-bone/65">
              Most of the talk is about zoning — but zoning is only the start. Historic boards,
              affordability mandates, environmental review, parking rules, fees, and private
              covenants each pile on cost, time, and doubt, and most of it stays invisible until
              you’re already committed.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-14 max-w-2xl font-serif text-[clamp(1.8rem,3.6vw,2.9rem)] leading-[1.12] tracking-tight text-piranha-bone">
              The Piranha Project maps the whole thing — in plain English, through a nonpartisan
              lens, so you can see what building here really takes.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-12 flex justify-center">
              <ArrowLink to="/boston" tone="light">
                Try it out
              </ArrowLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Feature cards (white on dark) ────────────────────────── */}
      <section className={`${DARK} px-6 pb-32`}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              Everything between you and a finished building.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {FEATURES.map((c, i) => (
              <Reveal key={c.title} variant="float" delay={i * 120}>
                <div className="flex h-full flex-col rounded-2xl bg-white p-9">
                  <span className="font-serif text-2xl text-piranha-gold">{c.n}</span>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-piranha-charcoal">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-piranha-charcoal/65">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (light) ─────────────────────────────────── */}
      <section className="bg-piranha-bone px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
              How it works
            </p>
            <h2 className="mt-4 max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-charcoal">
              From an address to an answer.
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

      {/* ── Stats (dark) ─────────────────────────────────────────── */}
      <section className={`${DARK} px-6 py-28`}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-2xl font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              A full picture, from public record.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 120}>
                <div className="border-t border-piranha-bone/20 pt-5">
                  <p className="font-serif text-6xl tracking-tight text-piranha-bone sm:text-7xl">{s.figure}</p>
                  <p className="mt-3 text-sm uppercase tracking-[0.14em] text-piranha-bone/55">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cities (dark) ────────────────────────────────────────── */}
      <section className={`${DARK} border-t border-piranha-bone/10 px-6 py-28`}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-gold">
              Where we’re live
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-piranha-bone">
              Five cities, each on its own public data.
            </h2>
            <p className="mt-4 text-piranha-bone/55">We’ll add more as we expand.</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              {CITIES.map((c) => (
                <Link
                  key={c.slug}
                  to={`/boston?city=${c.slug}`}
                  className="font-serif text-3xl tracking-tight text-piranha-bone/75 transition-colors hover:text-piranha-gold sm:text-4xl"
                >
                  {c.name}
                </Link>
              ))}
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
              <ArrowLink to="/boston" tone="dark">
                Try it out
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
