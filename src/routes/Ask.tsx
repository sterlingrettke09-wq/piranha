import { Link } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { AskAssistant } from '../components/AskAssistant'

interface QA {
  q: string
  a: React.ReactNode
}

const FAQ: QA[] = [
  {
    q: 'What does The Piranha Project tell me?',
    a: 'For a given parcel, it tells you whether your project is buildable under current zoning, what approvals it would need, a ballpark of what it will cost, and how long approval typically takes.',
  },
  {
    q: 'What do the verdicts mean?',
    a: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><span className="font-semibold">As-of-right</span> — fits the zoning envelope; no discretionary relief needed.</li>
        <li><span className="font-semibold">Buildable with relief</span> — exceeds at least one limit; a variance or other approval would be required.</li>
        <li><span className="font-semibold">Not permitted</span> — conflicts with the district in a way relief is unlikely to cure.</li>
        <li><span className="font-semibold">Indeterminate</span> — the public data didn’t provide a limit we needed, so we don’t guess.</li>
      </ul>
    ),
  },
  {
    q: 'What’s the difference between as-of-right and a variance?',
    a: 'As-of-right means the zoning code already allows what you’re proposing — you go straight to permitting. A variance is a discretionary exception you have to apply and argue for when a project exceeds a limit (height, floor-area ratio, use). Variances add cost, time, and uncertainty, which is why the timeline and permitting estimates change when one is required.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Public sources. In Boston today: BPDA zoning subdistricts and parcels, FEMA flood-hazard zones, and Boston Landmarks historic districts. Sources are linked on every result.',
  },
  {
    q: 'How accurate are the cost estimates?',
    a: 'They’re labeled estimates, not bids. Hard costs use per-square-foot figures by use type, soft costs are a share of hard costs, and permitting uses published fee formulas. Treat them as a starting point for diligence — every assumption is shown on the result so you can sanity-check it.',
  },
  {
    q: 'Why does it sometimes say “indeterminate” or “not derivable”?',
    a: 'Because the public data doesn’t always carry the limit we need. Open Space parcels, for example, have no height or floor-area ratio in the zoning layer. Rather than invent a number, we mark that dimension indeterminate and treat it conservatively.',
  },
  {
    q: 'Can I share or edit an analysis?',
    a: 'Yes. Every result has its own URL — copy it to share, or use “Edit inputs” to change the project and re-run. The inputs live in the link, so a shared analysis reproduces exactly.',
  },
  {
    q: 'What cities are covered?',
    a: 'Boston is live. We’re adding more cities — and more rule types beyond zoning — before broad launch.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. The Piranha Project provides general regulatory information built from public data. It is not legal, engineering, or financial advice. Verify with the relevant city department before relying on any figure.',
  },
  {
    q: 'Is there an AI assistant?',
    a: 'A natural-language assistant — ask a question, get an answer with sources — is coming. For now, this page covers the common questions.',
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
