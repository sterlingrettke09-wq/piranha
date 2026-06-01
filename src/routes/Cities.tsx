import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import { CITIES } from '../config/cities'

// On-brand gradient heroes, cycled per card. Keeps the page premium with no
// external image dependencies; real city photos can drop in here later.
const HEROES = [
  'from-piranha-burgundy via-[#5a1422] to-piranha-charcoal',
  'from-piranha-charcoal via-[#2a1a1e] to-piranha-burgundy',
  'from-[#3a2230] via-piranha-burgundy to-[#1a1a1a]',
  'from-piranha-charcoal via-[#1f1c2e] to-[#3a2230]',
  'from-[#4a1726] via-[#2a1518] to-piranha-charcoal',
]

export default function Cities() {
  return (
    <PageContainer>
      <PageHeading eyebrow="Coverage" title="Ten cities, live.">
        Pick any property in a covered city and we’ll tell you what you can build, what
        approvals you’d need, what it would cost, and how long it would take.
      </PageHeading>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c, i) => (
          <Reveal key={c.slug} delay={(i % 3) * 70}>
            <Link
              to={`/map?city=${c.slug}`}
              className="group relative block h-56 overflow-hidden rounded-2xl shadow-[0_18px_50px_-24px_rgba(26,26,26,0.55)]"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${HEROES[i % HEROES.length]} transition-transform duration-700 ease-out group-hover:scale-105`}
              />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,165,92,0.18),transparent_60%)]" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-piranha-bone/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-piranha-bone backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live
                </span>
                <div>
                  <h2 className="font-serif text-3xl leading-none tracking-tight text-piranha-bone">{c.name}</h2>
                  <p className="mt-2 max-w-[16rem] text-sm leading-snug text-piranha-bone/70">{c.tagline}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-gold">
                    Open the map
                    <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}

        {/* Request-a-city card. */}
        <Reveal>
          <Link
            to="/request-city"
            className="group flex h-56 flex-col justify-between rounded-2xl border border-dashed border-piranha-charcoal/25 p-6 transition-colors hover:border-piranha-burgundy/50 hover:bg-piranha-burgundy/[0.03]"
          >
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-piranha-charcoal/45">
              Don’t see your city?
            </span>
            <div>
              <h2 className="font-serif text-3xl leading-none tracking-tight text-piranha-charcoal">Request a city</h2>
              <p className="mt-2 max-w-[16rem] text-sm leading-snug text-piranha-charcoal/60">
                Tell us where you want to build and we’ll try to add it to our database.
              </p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-burgundy">
                Add my city
                <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">→</span>
              </span>
            </div>
          </Link>
        </Reveal>
      </div>
    </PageContainer>
  )
}
