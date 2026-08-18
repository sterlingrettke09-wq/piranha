import { PageContainer } from '../components/PageContainer'
import { PageHeading } from '../components/PageHeading'
import { AskAssistant } from '../components/AskAssistant'
import {
  citiesSentence,
  coverageFacts,
  silentSentence,
  WITHHELD_SENTENCE,
} from '../config/coverageClaim'

interface QA {
  q: string
  a: React.ReactNode
}

const FAQ: QA[] = [
  {
    q: 'What does this tool do?',
    a: 'Whether you can build what you have in mind, the approvals it needs, what it costs, and how long the permit takes.',
  },
  {
    q: 'What do the results mean?',
    a: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><span className="font-semibold">You can build it.</span> It fits the rules, so you can go straight to permits without asking for special permission.</li>
        <li><span className="font-semibold">Needs city permission.</span> You can probably build it, but first you’ll have to ask the city to approve an exception.</li>
        <li><span className="font-semibold">Not allowed.</span> The rules don’t allow this here, and an exception is unlikely to help.</li>
        <li><span className="font-semibold">Can’t tell.</span> The public data was missing something we needed, so we don’t guess.</li>
      </ul>
    ),
  },
  {
    q: 'What’s a variance?',
    a: 'It’s permission to bend one of the zoning rules, such as building taller or larger than the rules normally allow. You have to apply for it and make your case to the city, which adds time and can add cost and some uncertainty. That’s why the estimate changes when one is needed.',
  },
  {
    q: 'Where do the numbers come from?',
    a: 'Public city and government data. Each city’s official zoning and property maps, plus federal flood maps and local historic-district records. Sources are linked on every result.',
  },
  {
    q: 'How accurate are the cost estimates?',
    a: 'Estimates, not quotes. Built from construction cost per square foot, soft costs, and the city’s published permit fees. Every assumption is listed on the result.',
  },
  {
    q: 'Why does it sometimes say it can’t tell?',
    a: 'The public record does not always carry the number. A park has no height limit on file. That parcel returns “not known”, never an assumed one.',
  },
  {
    q: 'Can I share or change an analysis?',
    a: 'Yes. Every result has its own link you can copy and send to anyone, and “Edit inputs” lets you tweak the project and run it again.',
  },
  {
    q: 'Which cities are covered?',
    // Derived end to end. This answer used to interpolate the city count and
    // then enumerate a hand-written list frozen at an earlier, smaller roster —
    // a derived number disagreeing with a typed list inside one sentence — and
    // it called all of them covered when the sample says several resolve
    // nothing. `silentSentence()` is empty when no city is silent, so the
    // clause disappears rather than going stale.
    a: [
      `${coverageFacts().wired} cities: ${citiesSentence()}.`,
      // rangeSentence() removed 2026-08-18: envelope percentages are depth the
      // assistant supplies on request; the Q&A is surface-level and the number
      // read as a completeness claim the coverage matrix contradicts.
      silentSentence(),
      WITHHELD_SENTENCE,
      'Per-city rates are on the coverage page.',
    ]
      .filter(Boolean)
      .join(' '),
  },
  {
    q: 'Is the assistant always right?',
    a: 'No. The assistant above is an AI giving general guidance, and it can be wrong. It’s a starting point. Double-check anything important with the city.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. It’s general information built from public data. Not legal, engineering, or financial advice. Always confirm with the city before relying on it.',
  },
]

export default function Ask() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-12 py-10 sm:py-16">
        <PageHeading eyebrow="Help" title="Questions &amp; answers">
          How the analysis works, what the verdicts mean, and where the numbers come from.
          Have something not covered here? Ask the assistant below, or read the common
          questions.
        </PageHeading>

        <AskAssistant />

        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
            Common questions
          </p>
          <div className="overflow-hidden rounded-2xl border border-piranha-charcoal/10 divide-y divide-piranha-charcoal/10">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-6 transition-colors open:bg-piranha-charcoal/[0.02]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-lg tracking-tight text-piranha-charcoal marker:content-['']">
                  {item.q}
                  <span className="text-piranha-gold transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <div className="mt-4 leading-relaxed text-piranha-charcoal/75">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
