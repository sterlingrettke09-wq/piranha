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
            The Piranha Project is a regulatory-intelligence tool for builders and
            investors. It answers a deceptively hard question —{' '}
            <span className="font-semibold text-piranha-charcoal">
              “Can I build this here, and what will it take?”
            </span>{' '}
            — using public zoning and parcel data, so you can see every hurdle before
            you commit a dollar.
          </p>
        </header>

        <Section title="Why “Piranha”">
          <p>
            Small, fast, and relentless. Building in America’s big cities has become a
            maze of overlapping rules, fees, and waiting periods that stall good
            projects and inflate the cost of everything we build. We expose that maze,
            put a number on it, and push toward reforming the rules that no longer make
            sense.
          </p>
        </Section>

        <Section title="How it works">
          <p>Every analysis runs three checks and shows its math:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-piranha-charcoal">Feasibility</span> —
              your project’s use, floor-area ratio, and height are compared against the
              parcel’s zoning limits, producing a verdict: as-of-right, needs relief,
              prohibited, or indeterminate where the data runs out.
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
            Live today: Boston — BPDA zoning subdistricts and parcels, FEMA flood-hazard
            zones, and Boston Landmarks historic districts. We’re expanding to more
            cities and more rule types as we go.
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
          <p>Louisburg Strategies. v0.1.</p>
        </Section>
      </div>
    </PageContainer>
  )
}
