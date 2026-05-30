import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <Reveal>
      <section className="border-t border-piranha-charcoal/15 pt-8">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-xl text-piranha-gold tabular-nums">{n}</span>
          <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal sm:text-3xl">{title}</h2>
        </div>
        <div className="mt-5 space-y-4 leading-relaxed text-piranha-charcoal/75">{children}</div>
      </section>
    </Reveal>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-piranha-charcoal/10 bg-white/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-piranha-charcoal/10 text-left text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">
            {head.map((h, i) => (
              <th key={h} className={`px-5 py-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-piranha-charcoal/5 last:border-0">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-5 py-3 ${ci === 0 ? 'font-medium text-piranha-charcoal' : 'text-right tabular-nums text-piranha-charcoal/75'}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Methodology() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-16 py-10 sm:py-16">
        <PageHeading eyebrow="Methodology" title="How we do the math.">
          Every number on a result comes from a formula and a public dataset, not a black box.
          Here is exactly how the verdict, the cost, and the timeline are calculated, with the
          tables we use. These are estimates, labeled as estimates, and meant to be checked
          against the city.
        </PageHeading>

        <div className="space-y-14">
          <Section n="01" title="What we compute">
            <p>Each analysis answers three questions about your parcel and your plan:</p>
            <ul className="space-y-2">
              <li>
                <span className="font-semibold text-piranha-charcoal">Feasibility.</span> Can you
                build this here, by right, with relief, or not at all?
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Cost.</span> A rough
                order-of-magnitude to build it.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Timeline.</span> How long
                from design to move-in.
              </li>
            </ul>
            <p>
              Alongside those, we surface the regulatory hurdles your project triggers. The
              sections below show the math for each.
            </p>
          </Section>

          <Section n="02" title="Feasibility, the verdict">
            <p>
              We compare your project against the parcel&rsquo;s zoning on four fronts, then the
              verdict is the worst of them.
            </p>
            <ul className="space-y-2">
              <li>
                <span className="font-semibold text-piranha-charcoal">Use.</span> Is your use
                allowed in the district? If not, it needs a use variance.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Floor-area ratio (FAR).</span>{' '}
                How much total floor area you can build per square foot of land. We divide your gross
                floor area by the lot size and compare it to the district&rsquo;s limit. A FAR of 2.0
                on a 5,000 sq ft lot allows 10,000 sq ft of building.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Height.</span> Your proposed
                height (feet, or stories &times; 11 ft) against the district limit.
              </li>
              <li>
                <span className="font-semibold text-piranha-charcoal">Existing housing.</span>{' '}
                Whether you are tearing down homes to build fewer (below).
              </li>
            </ul>
            <p>
              For FAR and height, anything within the limit is as-of-right. Up to 1.5&times; over
              is treated as needing relief (a variance). Beyond 1.5&times; we call it prohibited,
              because that overage takes a rezoning, not a variance. Where a city&rsquo;s public
              data doesn&rsquo;t carry a FAR or height limit, that line reads &ldquo;not in public
              data&rdquo; and doesn&rsquo;t decide the verdict.
            </p>
            <p className="font-semibold text-piranha-charcoal">The housing rule</p>
            <p>
              Demolishing an established multifamily building (3 or more units) to build fewer units
              is never a simple by-right teardown. We downgrade those to &ldquo;needs relief.&rdquo;
              A large net loss of housing, 10 or more existing units, or a building of 5+ units
              collapsed to a single home, reads as prohibited: no-net-loss rules, rent regulation,
              and tenant protections generally bar it outright.
            </p>
          </Section>

          <Section n="03" title="Cost">
            <p>
              Hard cost is your gross floor area times a per-square-foot rate for the use, times a
              city construction index. Soft costs are a share of hard cost, and permitting is a
              filing fee plus a rate on construction value.
            </p>
            <p className="rounded-xl bg-piranha-charcoal/[0.04] px-5 py-3 font-mono text-sm text-piranha-charcoal/80">
              hard = area &times; rate(use) &times; city index &times; height factor<br />
              soft = 25% of hard<br />
              permit = $100 + $10 per $1,000 of hard cost (+$600 if relief is required)<br />
              total = hard + soft + permit
            </p>
            <p className="rounded-xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.04] px-5 py-3 text-sm text-piranha-charcoal/80">
              This is construction cost. It does not include land or acquisition, which in the
              priciest markets often costs more than the building itself.
            </p>
            <p className="pt-2 font-semibold text-piranha-charcoal">Base rate by use (Boston, 2025)</p>
            <Table
              head={['Use', '$ / sq ft']}
              rows={[
                ['Residential', '$350'],
                ['Mixed-use', '$375'],
                ['Commercial', '$400'],
                ['Institutional', '$450'],
              ]}
            />
            <p className="pt-2 font-semibold text-piranha-charcoal">City construction index</p>
            <p>
              Hard construction costs run higher in some metros than others. We scale the base rate
              by this index (Boston is the reference at 1.00). It covers construction only, not
              land, which varies far more.
            </p>
            <Table
              head={['City', 'Index']}
              rows={[
                ['New York', '1.18'],
                ['San Francisco', '1.13'],
                ['Boston', '1.00'],
                ['Seattle', '1.00'],
                ['Chicago', '0.92'],
              ]}
            />
            <p className="pt-2 font-semibold text-piranha-charcoal">Height premium</p>
            <p>
              Taller buildings cost more per square foot (structure, elevators, fire and life
              safety). We apply a factor by height.
            </p>
            <Table
              head={['Building height', 'Factor']}
              rows={[
                ['Up to 4 stories', '1.00'],
                ['5 to 8 stories', '1.15'],
                ['9 to 20 stories', '1.35'],
                ['Over 20 stories', '1.60'],
              ]}
            />
          </Section>

          <Section n="04" title="Timeline">
            <p>
              The timeline is the full life-cycle, from architectural design through demolition and
              building permits, site preparation, and construction, to move-in. We start from a
              typical duration by city and building type.
            </p>
            <p className="text-sm text-piranha-charcoal/60">
              Building type: single-family is 1 unit, multi-family is 2 to 4, apartment is 5 or
              more. Commercial and institutional use the apartment column.
            </p>
            <Table
              head={['City', 'Single', 'Multi', 'Apartment']}
              rows={[
                ['New York', 18, 24, 36],
                ['San Francisco', 24, 30, 42],
                ['Boston', 14, 18, 26],
                ['Seattle', 14, 18, 24],
                ['Chicago', 11, 15, 20],
              ]}
            />
            <p>Then we adjust:</p>
            <ul className="space-y-2">
              <li>
                A vacant lot trims the demolition phase (1 to 4 months, by city), since there is
                nothing to tear down.
              </li>
              <li>Additions, ADUs, and changes of use run shorter than a full ground-up build.</li>
              <li>A project that needs a variance adds roughly 6 months for the hearing cycle.</li>
              <li>A prohibited project shows no timeline.</li>
            </ul>
            <p className="text-sm text-piranha-charcoal/55">
              These are typical estimates, blended from public permitting data and industry norms.
              Complex projects in the slower cities can run well beyond them.
            </p>
          </Section>

          <Section n="05" title="The hurdles">
            <p>
              Beyond the zoning verdict, we flag the approvals a project tends to trigger: historic
              review, inclusionary or affordability requirements, environmental review (CEQA, ULURP),
              parking rules, demolition and housing-replacement, and private deed or HOA
              restrictions. These are qualitative flags that tell you where the friction is. They
              inform the verdict and the timeline framing rather than adding fixed months to the
              total.
            </p>
          </Section>

          <Section n="06" title="Where the data comes from">
            <p>
              Every parcel is read live from its own city&rsquo;s public records: zoning districts,
              parcel boundaries and lot size, existing-use and unit records, FEMA flood-hazard
              zones, and local historic districts where published. Addresses come from reverse
              geocoding. Coverage depth varies by city, and we note when a field is not in the
              public data.
            </p>
          </Section>

          <Section n="07" title="What this is not">
            <p>
              The Piranha Project produces estimates, not legal, engineering, or financial advice.
              Public data has gaps, rules change, and some cities don&rsquo;t publish FAR or height
              limits, so those checks can be inconclusive. Always confirm zoning, fees, and
              permitting with the relevant city department before relying on these figures. Curious
              about a specific result? The{' '}
              <Link className="text-piranha-burgundy underline underline-offset-2" to="/ask">
                Q&amp;A
              </Link>{' '}
              walks through what each verdict means.
            </p>
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
