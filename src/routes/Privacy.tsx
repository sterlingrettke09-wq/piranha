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

export default function Privacy() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-16 py-10 sm:py-16">
        <PageHeading eyebrow="Privacy" title="What we collect, in plain English.">
          The Piranha Project is built to answer one question about a property, not to
          build a profile of you. Here is exactly what touches our servers and where it
          goes. No legalese, no surprises.
        </PageHeading>

        <div className="space-y-14">
          <Section n="01" title="When you request a city">
            <p>
              If you fill out the “request a city” form, the email address and notes you
              type are sent to us through Netlify Forms and stored there so we can email
              you when your city goes live. That is the only place we ask for your email,
              and we use it only to reply about coverage.
            </p>
          </Section>

          <Section n="02" title="When you search an address">
            <p>
              The addresses you look up are logged on our server to help us see which
              cities and neighborhoods people care about, so we know where to improve
              coverage. Each log entry holds only a timestamp, the city, and the address
              you searched.
            </p>
            <p>
              These logs are anonymous. They are not tied to an account, and we do not
              store your IP address in the log entry. The log is visible only to the site
              owner, and we use it purely to improve coverage.
            </p>
          </Section>

          <Section n="03" title="When you ask a question">
            <p>
              If you use the Ask assistant, the question you type is sent to Google’s
              Gemini API to generate an answer. We don’t send your email or any account
              information along with it, because we don’t have one. Google processes the
              question under its own terms to produce the response.
            </p>
          </Section>

          <Section n="04" title="Maps and geocoding">
            <p>
              To show the map and turn an address into a point on it, your browser makes
              requests to Mapbox. That means Mapbox receives the map and geocoding
              requests needed to render the map you’re using.
            </p>
          </Section>

          <Section n="05" title="What we don’t do">
            <p>
              We don’t run ads. We don’t sell or rent your personal data to anyone. We
              don’t set cookies to track you across the web. There is no account to create
              and no marketing list you’re quietly added to.
            </p>
          </Section>

          <Section n="06" title="Questions or deletion">
            <p>
              Want to ask about your data, or have a request-city email removed? Write to{' '}
              <a className="text-piranha-burgundy underline" href="mailto:piranha@louisburgstrategies.com">
                piranha@louisburgstrategies.com
              </a>{' '}
              and we’ll take care of it.
            </p>
            <p className="text-sm text-piranha-charcoal/55">
              Effective date: June 9, 2026. See also our{' '}
              <Link className="text-piranha-burgundy underline" to="/terms">
                Terms
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </PageContainer>
  )
}
