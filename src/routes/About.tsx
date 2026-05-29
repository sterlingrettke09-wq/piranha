import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">{title}</h2>
      <div className="space-y-3 text-piranha-charcoal/80 leading-relaxed">{children}</div>
    </section>
  )
}

export default function About() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-12">
        <header className="space-y-3">
          <h1 className="font-serif text-4xl tracking-tight text-piranha-charcoal sm:text-5xl">
            Built to bite through red tape.
          </h1>
          <p className="text-lg leading-relaxed text-piranha-charcoal/80">
            The Piranha Project is a tool for real-estate builders and investors. It
            answers one deceptively hard question —{' '}
            <span className="font-semibold text-piranha-charcoal">
              “Can I build this here, and what will it take?”
            </span>{' '}
            — using each city’s own public data, so you can see every hurdle before you
            spend a dollar.
          </p>
        </header>

        <Section title="Why “Piranha”">
          <p>
            Small, fast, and relentless. Building in many American cities has become a
            maze of overlapping rules, fees, and waiting periods that stall good
            projects and drive up the cost of everything we build. We expose that maze,
            put a number on it, and push to reform the rules that no longer make sense.
          </p>
        </Section>

        <Section title="How it works">
          <p>Every analysis runs three checks and shows its math:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-piranha-charcoal">Feasibility</span> —
              we check your project’s use, size, and height against the property’s
              zoning limits and tell you whether you can build as-of-right, need a
              variance, can’t build it, or whether the data wasn’t clear enough to say.
            </li>
            <li>
              <span className="font-semibold text-piranha-charcoal">Cost</span> —
              construction (hard) costs by use, soft costs as a share of hard, and
              permitting fees, plus a variance filing fee when relief is required.
            </li>
            <li>
              <span className="font-semibold text-piranha-charcoal">Timeline</span> —
              the typical months to approval for the path your project lands on.
            </li>
          </ul>
          <p>
            Every assumption behind a number is shown on the result itself and labeled
            as an estimate. Curious about a specific verdict? The{' '}
            <Link className="text-piranha-burgundy underline" to="/ask">
              Q&amp;A
            </Link>{' '}
            walks through what each one means.
          </p>
        </Section>

        <Section title="Data sources">
          <p>
            Live today: Boston — the city’s zoning subdistricts and parcels, FEMA
            flood-hazard zones, and Boston Landmarks historic districts. New York City,
            Chicago, San Francisco, and Seattle are next, each wired from that city’s
            own public data.
          </p>
        </Section>

        <Section title="Limitations">
          <p>
            Public data has gaps, and rules change. The Piranha Project produces
            estimates, not legal, engineering, or financial advice. Always verify
            zoning, fees, and permitting with the relevant city department before
            relying on these figures.
          </p>
        </Section>

        <Section title="Made by">
          <p>Louisburg Strategies. v0.2.</p>
        </Section>
      </div>
    </PageContainer>
  )
}
