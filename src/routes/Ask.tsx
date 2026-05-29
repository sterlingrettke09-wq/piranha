import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { AskAssistant } from '../components/AskAssistant'

interface QA {
  q: string
  a: React.ReactNode
}

const FAQ: QA[] = [
  {
    q: 'What does this tool do?',
    a: 'Pick any property and we tell you four things: whether you can build what you have in mind, what approvals you’d need, roughly what it would cost, and how long it would take to get permitted.',
  },
  {
    q: 'What do the results mean?',
    a: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><span className="font-semibold">As-of-right</span> — you can build it without special permission. Go straight to permits.</li>
        <li><span className="font-semibold">Buildable with relief</span> — you can probably build it, but first you’ll have to ask the city for an exception (a variance).</li>
        <li><span className="font-semibold">Not permitted</span> — the rules don’t allow this here, and an exception is unlikely to help.</li>
        <li><span className="font-semibold">Can’t tell</span> — the public data was missing something we needed, so we don’t guess.</li>
      </ul>
    ),
  },
  {
    q: 'What’s a variance?',
    a: 'It’s permission to bend one of the zoning rules — like building taller or larger than the rules normally allow. You have to apply for it and make your case to the city, which adds time, cost, and some uncertainty. That’s why the estimate changes when one is needed.',
  },
  {
    q: 'Where do the numbers come from?',
    a: 'Public city and government data. For Boston, that’s the city’s official zoning and property maps, plus federal flood maps and historic-district records. We link to our sources on every result.',
  },
  {
    q: 'How accurate are the cost estimates?',
    a: 'They’re ballpark figures, not quotes. We use standard construction costs per square foot, typical soft costs, and the city’s published permit fees. Treat them as a starting point — we show every assumption so you can check our math.',
  },
  {
    q: 'Why does it sometimes say it can’t tell?',
    a: 'Because the public data doesn’t always include the number we need — a park, for example, has no height limit on file. Rather than make one up, we flag it and stay cautious.',
  },
  {
    q: 'Can I share or change an analysis?',
    a: 'Yes. Every result has its own link you can copy and send to anyone, and “Edit inputs” lets you tweak the project and run it again.',
  },
  {
    q: 'Which cities are covered?',
    a: 'Boston is live now, and more cities are on the way.',
  },
  {
    q: 'Is the assistant always right?',
    a: 'No. The assistant above is an AI (Google Gemini) giving general guidance, and it can be wrong. It’s a starting point — double-check anything important with the city.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. It’s general information built from public data — not legal, engineering, or financial advice. Always confirm with the city before relying on it.',
  },
]

export default function Ask() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-serif text-4xl tracking-tight text-piranha-charcoal sm:text-5xl">
            Questions &amp; answers
          </h1>
          <p className="text-piranha-charcoal/70">
            How the analysis works, what the verdicts mean, and where the numbers come
            from. Have something not covered here?{' '}
            <Link className="text-piranha-burgundy underline" to="/about">
              Read more about the project
            </Link>
            .
          </p>
        </header>

        <AskAssistant />

        <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">
          Common questions
        </h2>

        <div className="divide-y divide-piranha-charcoal/10 rounded-lg border border-piranha-charcoal/10">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="cursor-pointer font-semibold text-piranha-charcoal marker:content-['']">
                {item.q}
              </summary>
              <div className="mt-3 leading-relaxed text-piranha-charcoal/80">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
