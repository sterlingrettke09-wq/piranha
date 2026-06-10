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

export default function Terms() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-16 py-10 sm:py-16">
        <PageHeading eyebrow="Terms" title="The deal, in plain English.">
          By using The Piranha Project you’re agreeing to a few common-sense terms. We’ve
          written them the way we write everything else here: short, direct, and without
          the small print.
        </PageHeading>

        <div className="space-y-14">
          <Section n="01" title="Estimates, not advice">
            <p>
              Everything this tool produces is an estimate to help you get oriented. It is
              not legal, engineering, or financial advice, and it is not a substitute for a
              professional. Don’t make a binding decision on a number you saw here without
              confirming it yourself.
            </p>
          </Section>

          <Section n="02" title="Where the data comes from">
            <p>
              Our results are built from public records — each city’s own zoning, parcel,
              and permitting data, plus federal flood maps. Public data has gaps, and it can
              be wrong, out of date, or stale. We do our best, but we can’t guarantee any
              figure is current or correct.
            </p>
            <p>
              Always verify zoning, fees, and permitting with the relevant city department
              before you act on anything you see here.
            </p>
          </Section>

          <Section n="03" title="No warranty">
            <p>
              The tool is provided “as is,” without warranties of any kind. We don’t promise
              it will be accurate, available, or fit for your particular purpose.
            </p>
          </Section>

          <Section n="04" title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, The Piranha Project and Louisburg
              Strategies are not liable for any loss or damage arising from your use of, or
              reliance on, this tool or its estimates.
            </p>
          </Section>

          <Section n="05" title="Acceptable use">
            <p>
              Use the tool for its intended purpose: understanding what it takes to build on
              a specific property. Don’t scrape it, abuse it, overload it, or run automated
              bulk access against it. We may rate-limit or block use that does.
            </p>
          </Section>

          <Section n="06" title="Changes">
            <p>
              We may update these terms at any time without notice. The current version
              always lives at this page.
            </p>
            <p className="text-sm text-piranha-charcoal/55">
              These terms are informational and are not a substitute for legal review. See
              also our{' '}
              <Link className="text-piranha-burgundy underline" to="/privacy">
                Privacy
              </Link>{' '}
              page.
            </p>
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
