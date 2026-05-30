import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { Button } from '../components/ui/Button'
import { PiranhaIntro } from '../components/PiranhaIntro'

const STEPS = [
  {
    n: '1',
    title: 'Search an address',
    body: 'Drop a pin on any parcel, or search by address, to pull its zoning and parcel record.',
  },
  {
    n: '2',
    title: 'Describe your project',
    body: 'Use, size, and height — three quick steps. No account, no consultant.',
  },
  {
    n: '3',
    title: 'Get the verdict',
    body: 'What the rules allow, the approvals you’ll need, what it costs to clear them, and how long it takes.',
  },
]

export default function Home() {
  return (
    <>
      <PiranhaIntro />
      <PageContainer>
      <section className="mx-auto max-w-3xl py-20 text-center">
        <img
          src="/logo/piranha-fish-burgundy.png"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-7 w-16 sm:w-20"
        />
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-piranha-burgundy">
          Regulatory intelligence for builders
        </p>
        <h1 className="font-serif text-[2.6rem] leading-[1.06] tracking-tight text-piranha-charcoal sm:text-6xl">
          Ever wonder why it’s nearly impossible to build in many American cities?
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-piranha-charcoal/75">
          The wondering is over. The Piranha Project shows you every regulatory hurdle
          between you and a finished building — what it costs to clear, how long it takes
          to permit, and the rules standing in the way.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-piranha-charcoal">
          <span className="font-semibold">We show you the red tape and help you bite
          through it</span> — while figuring out how to reform the NIMBY-driven,
          anti-growth laws behind it.
        </p>

        <div className="mt-10">
          <Link to="/boston">
            <Button size="lg">Start an analysis →</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-4xl border-t border-piranha-charcoal/10 pt-12">
        <h2 className="text-center font-serif text-2xl tracking-tight text-piranha-charcoal">
          How it works
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="space-y-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-piranha-burgundy font-semibold text-piranha-bone">
                {s.n}
              </span>
              <h3 className="font-semibold text-piranha-charcoal">{s.title}</h3>
              <p className="text-sm leading-relaxed text-piranha-charcoal/70">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mx-auto mt-16 max-w-2xl text-center text-sm text-piranha-charcoal/55">
        Estimates built from public data — not legal advice.
      </p>
      </PageContainer>
    </>
  )
}
