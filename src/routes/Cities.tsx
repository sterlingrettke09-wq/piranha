import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import {
  CITY_CLAIMS,
  coverageFacts,
  rangeSentence,
  silentSentence,
  WITHHELD_SENTENCE,
} from '../config/coverageClaim'

// On-brand gradient hero behind each photo — also the fallback if the photo
// (public/cities/<slug>.jpg) is missing or fails to load.
const HEROES = [
  'from-piranha-burgundy via-[#5a1422] to-piranha-charcoal',
  'from-piranha-charcoal via-[#2a1a1e] to-piranha-burgundy',
  'from-[#3a2230] via-piranha-burgundy to-[#1a1a1a]',
  'from-piranha-charcoal via-[#1f1c2e] to-[#3a2230]',
  'from-[#4a1726] via-[#2a1518] to-piranha-charcoal',
]

// The badge used to read "Live" on all 23 cards, with an emerald dot on every
// one. It was the same claim 23 times, and for three cities it was false.
// It now carries that city's measured rate — the number itself, not a bucket —
// so a reader deciding whether to try their address gets the thing they need
// instead of a promise. The dot only distinguishes the one state that differs
// in kind: a city where nothing resolved at all.
function RateBadge({ label, answering }: { label: string; answering: boolean }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-piranha-bone backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${answering ? 'bg-emerald-300' : 'bg-amber-300'}`} />
      <span className="tabular-nums normal-case tracking-normal">{label}</span>
    </span>
  )
}

export default function Cities() {
  const facts = coverageFacts()
  const silent = silentSentence()
  return (
    <PageContainer>
      <PageHeading eyebrow="Coverage" title={`${facts.wired} cities, measured.`}>
        Pick any property. What you can build, the approvals, the cost, the timeline.
      </PageHeading>

      <Reveal>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-piranha-charcoal/65">
          {rangeSentence()} {WITHHELD_SENTENCE}
          {silent ? ` ${silent}` : ''}{' '}
          <Link className="underline underline-offset-2 hover:text-piranha-burgundy" to="/math">
            How this is measured
          </Link>
          .
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CITY_CLAIMS.map((c, i) => (
          <Reveal key={c.slug} delay={(i % 3) * 70}>
            <Link
              to={`/map?city=${c.slug}`}
              title={c.detail}
              className="group relative block h-56 overflow-hidden rounded-2xl shadow-[0_18px_50px_-24px_rgba(26,26,26,0.55)]"
            >
              {/* Gradient base (fallback). */}
              <div className={`absolute inset-0 bg-gradient-to-br ${HEROES[i % HEROES.length]}`} />
              {/* City photo, if present, sits on top and scales on hover. */}
              <img
                src={`/cities/${c.slug}.jpg`}
                alt=""
                aria-hidden
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Darkening scrim so the text stays legible over any photo. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <RateBadge label={c.rateLabel} answering={c.verdict === 'answering'} />
                <div>
                  <h2 className="font-serif text-3xl leading-none tracking-tight text-piranha-bone drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                    {c.stateLabel}
                  </h2>
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

      <p className="mt-10 text-xs text-piranha-charcoal/40">
        City photos via Wikimedia Commons, under Creative Commons / public-domain licenses.
      </p>
    </PageContainer>
  )
}
