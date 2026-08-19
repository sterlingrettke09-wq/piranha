import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { WatchParcelButton } from '../components/WatchParcelButton'
import { WhatWouldItTake } from '../components/WhatWouldItTake'
import { ProForma } from '../components/ProForma'
import { useAnalysis } from '../hooks/useAnalysis'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { recordReport, togglePin, listReports } from '../lib/recentReports'
import { AskAssistant } from '../components/AskAssistant'
import { USES, PROJECT_TYPES, FUNDING_TYPES, type AnalysisInput, type Use, type ProjectType, type Funding } from '../types/analysis'
import { Reveal } from '../components/Reveal'
import { VerdictBanner } from '../components/boston/result/VerdictBanner'
import { RealityCheck } from '../components/boston/result/RealityCheck'
import { EmailReport } from '../components/boston/result/EmailReport'
import { KeyMetrics } from '../components/boston/result/KeyMetrics'
import { MiniMap } from '../components/boston/result/MiniMap'
import { ReportSection } from '../components/boston/result/ReportSection'
import { SiteFacts } from '../components/boston/result/SiteFacts'
import { ExistingStructure } from '../components/boston/result/ExistingStructure'
import { hasExisting } from '../components/boston/result/existing'
import { FeasibilityChecklist } from '../components/boston/result/FeasibilityChecklist'
import { HurdlesSection } from '../components/boston/result/HurdlesSection'
import { CostBreakdown } from '../components/boston/result/CostBreakdown'
import { Timeline } from '../components/boston/result/Timeline'
import { NarrativeSection } from '../components/boston/result/NarrativeSection'
import { AssumptionsDisclosure } from '../components/boston/result/AssumptionsDisclosure'
import { NextSteps } from '../components/boston/result/NextSteps'
import { SourceLinks } from '../components/boston/result/SourceLinks'
import { LouisburgMark } from '../components/LouisburgMark'
import { encodeJsonB64 } from '../lib/b64'

const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  new: 'New construction',
  addition: 'Addition / renovation',
  adu: 'Accessory dwelling unit',
  change_of_use: 'Change of use',
}

function parseInput(params: URLSearchParams): AnalysisInput | null {
  const city = params.get('city') ?? 'boston'
  // Absent params get sensible defaults, but a PRESENT-and-garbled value means
  // a corrupted/tampered link — reject it (like `use` below) rather than
  // silently analyzing a different project than the link claimed.
  const ptRaw = params.get('projectType')
  if (ptRaw !== null && !(PROJECT_TYPES as string[]).includes(ptRaw)) return null
  const projectType: ProjectType = (ptRaw as ProjectType | null) ?? 'new'
  const fRaw = params.get('funding')
  if (fRaw !== null && !(FUNDING_TYPES as string[]).includes(fRaw)) return null
  const funding: Funding = (fRaw as Funding | null) ?? 'private'
  const parcelId = params.get('parcelId') ?? ''
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const use = params.get('use') as Use | null
  const gfa = Number(params.get('gfa'))
  if (parcelId === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (use === null || !USES.includes(use)) return null
  if (!Number.isFinite(gfa) || gfa <= 0) return null

  const num = (k: string): number | undefined => {
    const raw = params.get(k)
    if (raw === null || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return { city, projectType, funding, parcelId, lat, lng, use, gfa, units: num('units'), stories: num('stories'), heightFt: num('heightFt') }
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-piranha-charcoal/15 bg-white/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-piranha-charcoal/70">
      {children}
    </span>
  )
}

export default function BostonResult() {
  const [params] = useSearchParams()
  const input = useMemo(() => parseInput(params), [params])
  const state = useAnalysis(input)
  const [copied, setCopied] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  useDocumentTitle(state.status === 'loaded' ? state.data.parcel.address : 'Feasibility report')

  // The URL this report lives at — also the dedupe/pin key in recentReports.
  const reportUrl = window.location.pathname + window.location.search

  // The wizard link for the instant-report "refine" banner: the same params the
  // report was built from, minus the auto flag (the wizard shouldn't re-trigger
  // anything from it). parseInput ignores `auto` entirely, so dropping it here
  // only affects this link.
  const refineParams = useMemo(() => {
    const p = new URLSearchParams(params)
    p.delete('auto')
    return p.toString()
  }, [params])

  // Initialize the pin star from storage on mount (lazy initializer, so no
  // setState-in-effect). Recording below preserves any existing pin, so this
  // stays accurate.
  const [pinned, setPinned] = useState(
    () => listReports().find((e) => e.url === reportUrl)?.pinned ?? false,
  )

  // Record this report once it has loaded as a developable site, so the visitor
  // can return to it from Home / NotFound. Keyed on the URL so re-renders and
  // refetches don't re-record; running an effect (not inline) keeps it out of
  // render. Blocked / no-coverage results are intentionally NOT remembered.
  const loadedDevelopable =
    state.status === 'loaded' && state.data.developable !== false
  const recordKey = loadedDevelopable ? reportUrl : null
  useEffect(() => {
    if (state.status !== 'loaded' || state.data.developable === false) return
    recordReport({
      url: reportUrl,
      address: state.data.parcel.address,
      city: state.data.project.city,
      verdict: state.data.feasibility.overall,
      totalCost: state.data.costs.total,
      ts: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey])

  function onTogglePin() {
    setPinned(togglePin(reportUrl))
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setCopied(false),
    )
  }

  if (input === null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
          Feasibility report
        </p>
        <h1 className="mt-5 font-serif text-4xl tracking-tight">This link is incomplete.</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          It is missing the project details.{' '}
          <Link className="text-piranha-burgundy underline" to="/map">
            Start from the map
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="print-page mx-auto max-w-3xl px-6 pb-24 pt-10">
      {state.status === 'loading' && (
        <div className="space-y-5">
          <div className="h-5 w-48 tpp-shimmer rounded" />
          <div className="h-12 w-3/4 tpp-shimmer rounded" />
          <div className="h-64 tpp-shimmer rounded-2xl" />
          <div className="h-28 tpp-shimmer rounded-2xl" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4 rounded-2xl border border-rose-600/20 bg-rose-50/60 p-8">
          <h2 className="font-serif text-2xl tracking-tight text-rose-900">
            Couldn’t run the analysis.
          </h2>
          <p className="text-sm text-rose-900/80">{state.error.message}</p>
          <button
            type="button"
            onClick={state.retry}
            className="rounded-full bg-piranha-burgundy px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-piranha-bone hover:bg-piranha-charcoal"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'loaded' && (
        <>
          <nav className="print-hide flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em]">
            <Link
              to={`/map?city=${state.data.project.city}`}
              className="text-piranha-charcoal/60 transition-colors hover:text-piranha-burgundy"
            >
              ← Map
            </Link>
            <Link
              to={`/start?${params.toString()}`}
              className="text-piranha-charcoal/60 transition-colors hover:text-piranha-burgundy"
            >
              Edit inputs
            </Link>
            {input && (
              <Link
                to={`/map?city=${state.data.project.city}&cmp=${encodeURIComponent(encodeJsonB64(input))}`}
                className="text-piranha-charcoal/60 transition-colors hover:text-piranha-burgundy"
              >
                Compare another parcel
              </Link>
            )}
            {state.data.developable !== false && (
              <button
                type="button"
                onClick={onTogglePin}
                aria-pressed={pinned}
                title={pinned ? 'Unpin this report' : 'Pin this report so it stays in your recent list'}
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  pinned
                    ? 'text-piranha-burgundy'
                    : 'text-piranha-charcoal/60 hover:text-piranha-burgundy'
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={pinned ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {pinned ? 'Pinned' : 'Pin'}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="ml-auto rounded-full border border-piranha-charcoal/20 px-4 py-1.5 text-piranha-charcoal/70 transition-colors hover:border-piranha-charcoal/40"
            >
              Save as PDF
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-piranha-charcoal/20 px-4 py-1.5 text-piranha-charcoal/70 transition-colors hover:border-piranha-charcoal/40"
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </nav>

          {/* The report header is the first-paint moment — it must render
              instantly, NOT wrapped in a scroll-reveal (which would leave the
              top of the page blank until the observer fires). The MiniMap now
              sits BELOW the verdict band (see further down), so the verdict
              headline is the first substantial thing a visitor reads. */}
          <header className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
              Feasibility report
            </p>
            <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-tight text-piranha-charcoal">
              {state.data.parcel.address}
            </h1>
            {/* The lot area rides the identity line, so it is on screen before
                the verdict and long before the cost — on every branch, including
                the blocked / no-coverage one where KeyMetrics never mounts. It
                is unconditional: no size test decides whether a reader gets to
                see the size of the thing being priced. */}
            <p className="mt-3 text-sm text-piranha-charcoal/55">
              Parcel {state.data.parcel.parcelId} · District {state.data.parcel.districtCode} ·{' '}
              {state.data.parcel.lotSqFt != null
                ? `${state.data.parcel.lotSqFt.toLocaleString()} sq ft lot`
                : 'lot size not on file'}
            </p>
            {/* Watching is offered on EVERY branch, including the blocked and
                no-coverage ones. A parcel that is not developable today is
                exactly the kind someone wants to hear about when its zoning
                moves, and hiding the control there would make the feature
                useless for the case it is most useful for. */}
            <div className="mt-5">
              <WatchParcelButton
                city={state.data.project.city}
                parcelId={state.data.parcel.parcelId}
                address={state.data.parcel.address}
                districtCode={state.data.parcel.districtCode}
                maxHeightFt={state.data.parcel.maxHeightFt}
                maxFAR={state.data.parcel.maxFAR}
                lotSqFt={state.data.parcel.lotSqFt}
                developable={state.data.developable ?? null}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>{PROJECT_TYPE_LABEL[state.data.project.projectType]}</Pill>
              <Pill>{state.data.project.use}</Pill>
              <Pill>{state.data.project.gfa.toLocaleString()} sq ft</Pill>
              {state.data.project.units ? <Pill>{state.data.project.units} units</Pill> : null}
              {state.data.project.funding === 'public' ? <Pill>Publicly funded</Pill> : null}
            </div>
          </header>

          {state.data.developable === false ? (
            <>
              <div className="mt-6">
                <div className="rounded-2xl border border-amber-600/30 bg-amber-50/70 p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                    {state.data.developableKind === 'no_coverage' ? 'Outside our coverage' : 'Not a developable site'}
                  </p>
                  <h2 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-piranha-charcoal">
                    {state.data.developableKind === 'no_coverage'
                      ? 'No zoning on file for this parcel.'
                      : 'You can’t build here.'}
                  </h2>
                  <p className="mt-4 leading-relaxed text-piranha-charcoal/75">
                    {state.data.developableNote}
                  </p>
                  <p className="mt-3 text-sm text-piranha-charcoal/55">
                    {state.data.developableKind === 'no_coverage'
                      ? 'Try a parcel inside a covered city.'
                      : 'Cost and timeline do not apply to this parcel. Pick a private lot for a full analysis.'}
                  </p>
                  <Link
                    to={`/map?city=${state.data.project.city}`}
                    className="mt-6 inline-flex rounded-full border border-piranha-charcoal/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70 transition-colors hover:border-piranha-charcoal/40"
                  >
                    ← Try another parcel
                  </Link>
                </div>
              </div>

              <div className="print-hide mt-6">
                <MiniMap lat={state.data.project.lat} lng={state.data.project.lng} />
              </div>

              <div className="mt-12 space-y-14">
                <ReportSection n="01" title="The site" kicker="What the public record says about the parcel.">
                  <SiteFacts parcel={state.data.parcel} city={state.data.project.city} />
                </ReportSection>
                {hasExisting(state.data.parcel.existing) && (
                  <ReportSection n="02" title="What’s here today" kicker="What the record shows on the parcel.">
                    <ExistingStructure existing={state.data.parcel.existing} />
                  </ReportSection>
                )}
              </div>
            </>
          ) : (
            <>
              {state.data.advisory && (
                <Reveal className="mt-8">
                  <div className="rounded-2xl border border-amber-600/30 bg-amber-50/70 p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                      Heads up — likely not a development site
                    </p>
                    <p className="mt-3 leading-relaxed text-piranha-charcoal/80">
                      {state.data.advisory.note}
                    </p>
                  </div>
                </Reveal>
              )}

              {/* WO-8.4 — instant-report provenance banner. When the report was
                  reached via the panel's "Instant report" action (auto=1), tell
                  the visitor the spec was inferred from the parcel's own limits
                  and link them to the wizard to refine it. Print-hidden. */}
              {params.get('auto') === '1' && (
                <Reveal className="mt-8">
                  <Link
                    to={`/start?${refineParams}`}
                    className="print-hide group flex items-center justify-between gap-4 rounded-xl border border-piranha-gold/40 bg-piranha-gold/10 px-5 py-4 text-sm text-piranha-charcoal/80 transition-colors hover:border-piranha-gold/70"
                  >
                    <span>
                      <span className="font-semibold">Built from this parcel’s own limits.</span>{' '}
                      We picked a reasonable default project — refine the assumptions.
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-burgundy transition-transform group-hover:translate-x-0.5"
                    >
                      Refine →
                    </span>
                  </Link>
                </Reveal>
              )}

              {/* The verdict is the hero of this page — render it immediately
                  (NOT inside a scroll-reveal) so the headline is the first thing
                  a visitor sees above the fold, never a blank card. */}
              <div className="mt-6">
                <VerdictBanner
                  overall={state.data.feasibility.overall}
                  envelopeKnown={state.data.feasibility.envelopeKnown}
                  city={state.data.project.city}
                />
              </div>

              {/* The parcel map now sits BELOW the verdict — context, not the
                  opener. */}
              <div className="print-hide mt-6">
                <MiniMap lat={state.data.project.lat} lng={state.data.project.lng} />
              </div>

              {/* WO-8.2 — the loud band. Renders right after the verdict and
                  before the estimates; self-hides when no card has real data. */}
              <Reveal className="mt-6">
                <RealityCheck result={state.data} />
              </Reveal>

              <Reveal className="mt-8">
                <KeyMetrics
                  costs={state.data.costs}
                  timeline={state.data.timeline}
                  hurdles={state.data.hurdles}
                  lotSqFt={state.data.parcel.lotSqFt}
                  indeterminate={state.data.feasibility.overall === 'INDETERMINATE'}
                />
              </Reveal>

              <Reveal className="mt-6">
                <EmailReport
                  address={state.data.parcel.address}
                  city={state.data.project.city}
                  verdict={state.data.feasibility.overall}
                />
              </Reveal>

              {state.data.narrative && (
                <Reveal className="mt-8">
                  <NarrativeSection narrative={state.data.narrative} />
                </Reveal>
              )}

              <div className="mt-16 space-y-14">
                <ReportSection
                  n="01"
                  title="The reasoning"
                  kicker="How the proposal measures against each zoning limit."
                >
                  <FeasibilityChecklist checks={state.data.feasibility.checks} />
                </ReportSection>

                <ReportSection
                  n="02"
                  title="Beyond zoning, the red tape"
                  kicker="The approvals your project triggers, and what each one adds."
                >
                  <HurdlesSection hurdles={state.data.hurdles} />
                </ReportSection>

                <ReportSection
                  n="03"
                  title="What it costs"
                  kicker="Construction, soft costs, and permits. A rough order of magnitude, and it does not include land."
                >
                  <CostBreakdown
                    costs={state.data.costs}
                    gfa={state.data.project.gfa}
                    units={state.data.project.units}
                    demolitionRequired={state.data.hurdles.some((h) => h.category === 'demolition')}
                  />
                </ReportSection>

                <ReportSection
                  n="04"
                  title="From design to move-in"
                  kicker="The full life-cycle: architectural design, permits, site prep, and construction."
                >
                  <Timeline
                    timeline={state.data.timeline}
                    indeterminate={state.data.feasibility.overall === 'INDETERMINATE'}
                  />
                </ReportSection>

                <ReportSection n="05" title="The site" kicker="What the public record says about the parcel.">
                  <SiteFacts parcel={state.data.parcel} city={state.data.project.city} />
                </ReportSection>

                {hasExisting(state.data.parcel.existing) && (
                  <ReportSection
                    n="06"
                    title="What’s here today"
                    kicker="The existing structure, and what it takes to clear it."
                  >
                    <ExistingStructure existing={state.data.parcel.existing} />
                  </ReportSection>
                )}
              </div>

              <div className="print-hide mt-16">
                <div className="rounded-xl border border-piranha-charcoal/15 bg-white/40">
                  <button
                    type="button"
                    onClick={() => setAskOpen((o) => !o)}
                    aria-expanded={askOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span>
                      <span className="block font-serif text-xl tracking-tight text-piranha-charcoal">
                        Ask about this report
                      </span>
                      <span className="mt-0.5 block text-sm text-piranha-charcoal/55">
                        Variances, special permits, what a step actually means — ask in plain English.
                      </span>
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`shrink-0 text-piranha-charcoal/50 transition-transform ${askOpen ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {/* Mount AskAssistant lazily — only when the disclosure is opened —
                      so the result page doesn't carry its state for every visit. */}
                  {askOpen && (
                    <div className="border-t border-piranha-charcoal/10 p-3">
                      <AskAssistant placeholder="e.g. What's a variance and how long does one take?" />
                    </div>
                  )}
                </div>
              </div>

              <div className="print-hide mt-12">
                <NextSteps city={state.data.project.city} />
              </div>
            </>
          )}

          {/* The cost side of a deal. Built from the analysis already in hand —
              no second request, because the arithmetic needs nothing but numbers
              the report already carries plus three the user supplies. */}
          <div className="print-hide mt-12">
            <ProForma
              estimate={{ costs: state.data.costs, timeline: { months: state.data.timeline.months } }}
              units={state.data.project.units ?? null}
              gfaSqFt={state.data.project.gfa}
            />
          </div>

          {/* The inverse query. Placed AFTER the report rather than beside the
              inputs, because it answers a question the report provokes: the
              reader has just been told what their project needs, and the natural
              next one is "what would it take to get what I actually want".
              Offered on every branch — a parcel whose current answer is "no"
              is exactly where someone wants to know what changes it. */}
          <div className="print-hide mt-12">
            <WhatWouldItTake
              city={state.data.project.city}
              lat={state.data.project.lat}
              lng={state.data.project.lng}
            />
          </div>

          <div className="mt-8 space-y-6">
            <AssumptionsDisclosure assumptions={state.data.assumptions} />
            <p className="text-sm text-piranha-charcoal/60">
              Want to see how every number is calculated?{' '}
              <Link className="text-piranha-burgundy underline underline-offset-2" to="/math">
                Read the methodology
              </Link>
              .
            </p>
            <SourceLinks sources={state.data.sources} />
            {state.data.disclaimers.length > 0 && (
              <footer className="space-y-1 border-t border-piranha-charcoal/10 pt-5 text-xs leading-relaxed text-piranha-charcoal/50">
                {state.data.disclaimers.map((d, i) => (
                  <p key={i}>{d}</p>
                ))}
              </footer>
            )}
          </div>

          {/* Brand footer — prints on the PDF export. */}
          <div className="print-only mt-12 flex items-center justify-between border-t border-piranha-charcoal/15 pt-5">
            <LouisburgMark />
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-piranha-charcoal/45">
              A Louisburg Strategies brand
            </span>
          </div>
        </>
      )}

      {/* Unconditional print disclaimer — renders on the PDF for EVERY state
          (loaded, error/blocked, no-coverage), so no printed report can leave
          without it (WO-4.2). */}
      <p className="print-only mt-10 border-t border-piranha-charcoal/15 pt-4 text-[0.6rem] leading-relaxed text-piranha-charcoal/50">
        Estimates only — not legal, engineering, or financial advice. Construction cost excludes
        land and financing. Generated from public records — verify with the city.
        thepiranhaproject.com
      </p>
    </div>
  )
}
