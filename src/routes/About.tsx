import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section className="border-t border-piranha-charcoal/15 pt-8">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-xl text-piranha-gold">{n}</span>
          <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal sm:text-3xl">{title}</h2>
        </div>
        <div className="mt-5 space-y-4 leading-relaxed text-piranha-charcoal/75">{children}</div>
      </section>
    </Reveal>
  )
}

export default function About() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-16 py-10 sm:py-16">
        <PageHeading eyebrow="About" title="Built to bite through red tape.">
          The Piranha Project is a tool for everyone, from real-estate builders and investors
          to the people who just don’t understand why nothing has been built in their zip code
          in half a decade. It answers one deceptively hard question:{' '}
          <span className="font-semibold text-piranha-charcoal">
            “Can I build this here, and what will it take?”
          </span>{' '}
          It draws on each city’s own public data, so you can see every hurdle there is.
        </PageHeading>

        <div className="space-y-14">
          <Section n="01" title="Why “Piranha”">
            <p>
              Small, fast, and relentless. Building in many American cities has become a maze of
              overlapping rules, fees, and waiting periods that stall good projects and drive up
              the cost of everything we build. We expose that maze, put a number on it, and push
              to reform the rules that no longer make sense.
            </p>
          </Section>

          <Section n="02" title="How it works">
            <p>Every analysis runs three checks and shows its math:</p>
            <ul className="space-y-3">
              <li>
                <span className="font-semibold text-piranha-charcoal">Feasibility.</span> Your
                project’s use, size, and height against the property’s zoning limits: build
                as-of-right, need a variance, can’t build it, or the data wasn’t clear enough to
                say.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Cost.</span> Construction
                (hard) costs by use, soft costs as a share of hard, permitting fees, and a
                variance filing fee when relief is required.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Timeline.</span> The
                typical months to approval for the path your project lands on.
              </li>
            </ul>
            <p>
              Every assumption behind a number is shown on the result and labeled as an estimate.
              Curious about a specific verdict? The{' '}
              <Link className="text-piranha-burgundy underline" to="/ask">
                Q&amp;A
              </Link>{' '}
              walks through what each one means.
            </p>
          </Section>

          <Section n="03" title="Data sources">
            <p>
              Live today across five cities (Boston, New York, Chicago, San Francisco, and
              Seattle), each wired from that city’s own public data: zoning districts, parcels,
              and FEMA flood-hazard zones, plus local historic districts where available.
              Coverage depth varies by city, and we’re adding more rule types as we go.
            </p>
          </Section>

          <Section n="04" title="Limitations">
            <p>
              Public data has gaps, and rules change. The Piranha Project produces estimates,
              not legal, engineering, or financial advice. Always verify zoning, fees, and
              permitting with the relevant city department before relying on these figures.
            </p>
          </Section>

          <Section n="05" title="Author’s note">
            <p>
              Sterling Rettke is the principal consultant at Louisburg Strategies. He built The
              Piranha Project after reading <em>Abundance</em> by Ezra Klein and Derek Thompson,
              and being genuinely radicalized by how hard it has become to build housing in our
              biggest cities. A lot of it is fixable; it just takes the will to actually fix it.
              There are many moving players and decades-old rules that need to be seriously
              reconsidered.
            </p>
            <p>
              He made this to put it all in the open, in plain language anyone can understand. A
              small push, he hopes, toward getting our cities back on track and making the second
              third of this century a time of booming infrastructure and housing.
            </p>
            <p>
              Read more of his writing at{' '}
              <a
                className="text-piranha-burgundy underline"
                href="https://sterlingrettke.com/writing"
                target="_blank"
                rel="noopener noreferrer"
              >
                sterlingrettke.com/writing
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
