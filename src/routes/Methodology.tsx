import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { Reveal } from '../components/Reveal'
import { CITIES, getCity } from '../config/cities'
import type { Use } from '../types/analysis'
import {
  COVERAGE_DIMENSIONS,
  DIMENSION_LABELS,
  ABSENCE_CODE_LEGEND,
  coverageCell,
  type AbsenceCode,
} from '../config/coverage'
import {
  envelopeSampleLabel,
  envelopeSampleDetail,
  ENVELOPE_SAMPLE_SOURCE,
  type EnvelopeSample,
} from '../config/envelopeSample'
import {
  costPerSqFtByUse,
  cityCostIndex,
  heightFactorTiers,
  lifecycleMonths,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
} from '../config/estimates'

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

// Short cell labels for the four absence codes. Styling keeps a withdrawn
// figure VISIBLE as withdrawn — we published it, measured a disqualifier, and
// took it down; rendering that as a blank would present the withdrawal as
// reduced coverage instead of what it is.
const CODE_CELL: Record<AbsenceCode, { text: string; className: string }> = {
  'not-published': { text: 'Not published', className: 'text-piranha-charcoal/45' },
  withdrawn: { text: 'Withdrawn', className: 'font-semibold text-piranha-burgundy' },
  'not-built': { text: 'Not built', className: 'text-piranha-charcoal/35' },
  conservative: { text: 'Held back', className: 'font-medium text-piranha-charcoal/70' },
}

// A covered cell that carries a measured rate renders the RATE, not a dot.
//
// The dot was the defect. Denver's envelope resolved for 2 of the 6 developable
// parcels the live sample answered for and Chicago's for 11 of 11, and both drew
// the same ●. A percentage cannot be read as "complete" the way a dot can, and
// the two states with no rate — sampled with no usable denominator, or never
// sampled — deliberately render as WORDS rather than a blank, because a blank is
// what full coverage would look like too (rule 20).
function SampleCell({ sample, dim }: { sample: EnvelopeSample; dim: string }) {
  const label = envelopeSampleLabel(sample)
  const title = envelopeSampleDetail(dim, sample)
  if (sample.kind !== 'measured') {
    return (
      <span className="text-xs font-semibold text-piranha-burgundy" title={title}>
        {label}
      </span>
    )
  }
  // Below 1.0 the cell is charcoal rather than gold: gold is this table's
  // "delivered" colour and a two-thirds miss rate has not delivered.
  const full = sample.resolved === sample.n
  return (
    <span
      className={`text-xs tabular-nums ${full ? 'font-medium text-piranha-gold' : 'text-piranha-charcoal/70'}`}
      title={title}
    >
      {label}
    </span>
  )
}

function CoverageMatrix() {
  const cities = [...CITIES].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-piranha-charcoal/10 bg-white/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-piranha-charcoal/10 text-left text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">
              <th className="px-5 py-3 font-semibold">City</th>
              {COVERAGE_DIMENSIONS.map((dim) => (
                <th key={dim} className="px-3 py-3 text-center font-semibold" title={DIMENSION_LABELS[dim].means}>
                  {DIMENSION_LABELS[dim].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.slug} className="border-b border-piranha-charcoal/5 last:border-0">
                <td className="px-5 py-2.5 font-medium text-piranha-charcoal">{c.name}</td>
                {COVERAGE_DIMENSIONS.map((dim) => {
                  const cell = coverageCell(c.slug, dim)
                  if (cell.covered && cell.sample) {
                    return (
                      <td key={dim} className="px-3 py-2.5 text-center">
                        <SampleCell sample={cell.sample} dim={c.slug} />
                      </td>
                    )
                  }
                  if (cell.covered) {
                    const held = cell.suppressedTiers.length > 0
                    return (
                      <td key={dim} className="px-3 py-2.5 text-center">
                        <span
                          className="text-piranha-gold"
                          title={
                            held
                              ? `${DIMENSION_LABELS[dim].means} — the ${cell.suppressedTiers.join(', ')} tier was measured and is withheld below the publishable sample floor`
                              : DIMENSION_LABELS[dim].means
                          }
                        >
                          ●{held ? <span className="text-piranha-charcoal/60">*</span> : null}
                        </span>
                      </td>
                    )
                  }
                  const s = CODE_CELL[cell.code]
                  return (
                    <td key={dim} className="px-3 py-2.5 text-center">
                      <span className={`text-xs ${s.className}`} title={cell.reason}>
                        {s.text}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1.5 text-sm text-piranha-charcoal/70">
        {(Object.keys(ABSENCE_CODE_LEGEND) as AbsenceCode[]).map((code) => (
          <li key={code}>
            <span className={`text-xs ${CODE_CELL[code].className}`}>{ABSENCE_CODE_LEGEND[code].label}</span>
            {' — '}
            {ABSENCE_CODE_LEGEND[code].means}
          </li>
        ))}
        <li>
          <span className="text-piranha-gold">●</span>
          {' — covered. '}
          <span className="text-piranha-gold">●</span>
          <span className="text-piranha-charcoal/60">*</span>
          {' — covered, with a measured tier withheld below the publishable sample floor (Denver’s 2–4 unit tier).'}
        </li>
        <li>
          <span className="tabular-nums text-piranha-charcoal/70">82% · n=23</span>
          {' — the zoning-envelope column is a measured rate, not a yes: the share of sampled parcels ' +
            'in that city that were developable, reached an answer, and had an envelope resolve — either from a ' +
            'published FAR and height, or from a code that affirmatively imposes none. '}
          <span className="tabular-nums text-piranha-charcoal/70">n</span>
          {' is how many parcels that share is over. Parcels the sampler drew outside the city, and parcels ' +
            'nobody can build on, are excluded from n rather than counted as failures — which is why some ' +
            'cities carry a much smaller n than others.'}
        </li>
      </ul>
      <details className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 px-5 py-4 text-sm text-piranha-charcoal/75">
        <summary className="cursor-pointer font-semibold text-piranha-charcoal">
          Every empty cell, with its reason
        </summary>
        <ul className="mt-4 space-y-3">
          {cities.flatMap((c) =>
            COVERAGE_DIMENSIONS.map((dim) => {
              const cell = coverageCell(c.slug, dim)
              if (cell.covered) return null
              return (
                <li key={`${c.slug}-${dim}`} className="leading-relaxed">
                  <span className="font-medium text-piranha-charcoal">{c.name}</span>
                  {' · '}
                  {DIMENSION_LABELS[dim].label}
                  {' · '}
                  <span className={`text-xs ${CODE_CELL[cell.code].className}`}>{CODE_CELL[cell.code].text}</span>
                  {' — '}
                  {cell.reason}
                </li>
              )
            }),
          )}
        </ul>
      </details>
    </div>
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
  // All tables below are generated from the live engine constants, so they can
  // never drift from what the analysis actually computes (or from new cities).
  const cityOrder = Object.keys(cityCostIndex).sort((a, b) => cityCostIndex[b] - cityCostIndex[a])
  const useRows: [string, string][] = (
    [
      ['Residential', 'residential'],
      ['Mixed-use', 'mixed'],
      ['Commercial', 'commercial'],
      ['Institutional', 'institutional'],
    ] as [string, Use][]
  ).map(([label, key]) => [label, `$${costPerSqFtByUse[key]}`])
  const cityIndexRows: (string | number)[][] = cityOrder.map((s) => [getCity(s).name, cityCostIndex[s].toFixed(2)])
  const heightRows: (string | number)[][] = heightFactorTiers.map((t) => [t.label, t.factor.toFixed(2)])
  const timelineRows: (string | number)[][] = cityOrder
    .filter((s) => lifecycleMonths[s])
    .map((s) => [getCity(s).name, lifecycleMonths[s].single, lifecycleMonths[s].multi, lifecycleMonths[s].apartment])
  const softPct = Math.round(softCostPct * 100)

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
                build this here, build it with the city’s permission, or not at all?
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
              For FAR and height, anything within the limit needs no special permission. Up to
              1.5&times; over is treated as needing the city&rsquo;s permission (an exception).
              Beyond 1.5&times; we call it not allowed, because that overage takes a full rezoning,
              not a one-off exception. Where a city&rsquo;s public
              data doesn&rsquo;t carry a FAR or height limit, that line reads &ldquo;not in public
              data&rdquo; and doesn&rsquo;t decide the verdict.
            </p>
            <p className="font-semibold text-piranha-charcoal">The housing rule</p>
            <p>
              Demolishing an established multifamily building (3 or more units) to build fewer units
              is never a simple teardown. We downgrade those to &ldquo;needs city permission.&rdquo;
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
              soft = {softPct}% of hard<br />
              permit = ${PERMIT_BASE_FEE} + ${PERMIT_RATE_PER_1000} per $1,000 of hard cost (+${VARIANCE_FILING_FEE} if relief is required)<br />
              total = hard + soft + permit
            </p>
            <p className="rounded-xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.04] px-5 py-3 text-sm text-piranha-charcoal/80">
              This is construction cost. It does not include land or acquisition, which in the
              priciest markets often costs more than the building itself.
            </p>
            <p className="pt-2 font-semibold text-piranha-charcoal">Base rate by use (U.S. national average)</p>
            <p className="text-sm text-piranha-charcoal/70">
              These base rates are internal estimates. We have not been able to verify where they
              were derived from, so we do not attribute them to a published cost source. Independent
              industry figures for comparable buildings run higher than these for a market-grade
              finish specification. Treat them as a rough floor, not a quote.
            </p>
            <Table head={['Use', '$ / sq ft']} rows={useRows} />
            <p className="pt-2 font-semibold text-piranha-charcoal">City construction index</p>
            <p>
              Hard construction costs run higher in some metros than others. We scale the base rate
              by this index (RSMeans City Cost Index, 2021 location factors), where the U.S. national
              average is 1.00 (so Boston is 1.14). It covers construction only, not land, which
              varies far more.
            </p>
            <Table head={['City', 'Index']} rows={cityIndexRows} />
            <p className="pt-2 font-semibold text-piranha-charcoal">Height premium</p>
            <p>
              Taller buildings cost more per square foot (structure, elevators, fire and life
              safety). We apply a factor by height.
            </p>
            <Table head={['Building height', 'Factor']} rows={heightRows} />
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
            <Table head={['City', 'Single', 'Multi', 'Apartment']} rows={timelineRows} />
            <p>Then we adjust:</p>
            <ul className="space-y-2">
              <li>
                A teardown adds a demolition phase (2 to 5 months, by city); a vacant lot skips it.
              </li>
              <li>
                Additions and changes of use run shorter than a full ground-up build; an ADU costs
                about the same per square foot (fixed costs spread over a tiny area).
              </li>
              <li>
                A project that needs discretionary approval adds time for the approvals it triggers.
                The longest single process governs; each additional triggered approval contributes
                half its time, since reviews partially overlap. A genuinely serial permit — one that
                can&rsquo;t start until another finishes, like a California Coastal Development Permit
                — adds in full. The total entitlement add is capped at 24 months; when that cap binds,
                the report says so, because heavily contested projects can exceed it.
              </li>
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
              restrictions. These flags tell you where the friction is — and the larger approvals
              (environmental review, large-project review) add time to the timeline estimate above.
            </p>
            <p>
              <span className="font-semibold text-piranha-charcoal">Parking minimums.</span> For each
              city we surface whether off-street parking is still mandated on new housing, read from
              that city&rsquo;s own zoning ordinance or reform — for example San Francisco
              (Ordinance 286-18, 2018), Minneapolis (2040 plan, 2021), Austin (2023), and Denver
              (effective August 2025) have abolished minimums citywide, while Chicago, New York,
              Seattle, Los Angeles, Boston, and Washington, DC have removed or reduced them near
              transit but keep them elsewhere. Each figure carries an as-of date. For now this is
              shown per parcel as context and is{' '}
              <span className="font-semibold text-piranha-charcoal">not</span> yet priced into the
              cost model.
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

          <Section n="07" title="What we cover, city by city">
            <p>
              Coverage is uneven, and the unevenness is information. Each filled cell in this
              matrix is derived from the same tables and data files the analysis engine computes
              from, so the matrix cannot claim more than the product delivers. Each empty cell
              carries one of four reasons, because &ldquo;we don&rsquo;t show this here&rdquo; is
              one of four different facts — and only some of them are about us.
            </p>
            <CoverageMatrix />
            <p className="text-sm text-piranha-charcoal/60">
              A withdrawn figure is one we published, then measured a disqualifier against and
              took down. Each withdrawal&rsquo;s reason states what was measured; the six permit
              withdrawals were six different defects, not one.
            </p>
            <p className="text-sm text-piranha-charcoal/60">
              The zoning-envelope column used to be a yes or a no, and that was wrong in a way
              worth stating plainly. It said whether a city&rsquo;s live data feed is wired, which
              is a fact about our plumbing, not about your parcel &mdash; so a city where the
              envelope resolves for every parcel and a city where it resolves for a third of them
              looked identical. It now reports a rate we measured by pushing{' '}
              <span className="tabular-nums">575</span> real parcels, drawn from each
              city&rsquo;s own parcel layer, through the same pipeline your search runs. Denver is
              the clearest case: its districts are being rewritten, and a parcel still carrying a
              former Chapter 59 code has no envelope for us to read. Where the envelope
              doesn&rsquo;t resolve, we withhold the verdict rather than assume a limit &mdash; so
              a low rate here means &ldquo;expect to be told we don&rsquo;t know,&rdquo; not
              &ldquo;expect a wrong answer.&rdquo; {ENVELOPE_SAMPLE_SOURCE}
            </p>
          </Section>

          <Section n="08" title="What this is not">
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
