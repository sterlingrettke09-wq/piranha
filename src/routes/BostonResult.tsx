import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAnalysis } from '../hooks/useAnalysis'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { USES, PROJECT_TYPES, FUNDING_TYPES, type AnalysisInput, type Use, type ProjectType, type Funding } from '../types/analysis'
import { Reveal } from '../components/Reveal'
import { VerdictBanner } from '../components/boston/result/VerdictBanner'
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

const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  new: 'New construction',
  addition: 'Addition / renovation',
  adu: 'Accessory dwelling unit',
  change_of_use: 'Change of use',
}

function parseInput(params: URLSearchParams): AnalysisInput | null {
  const city = params.get('city') ?? 'boston'
  const ptRaw = params.get('projectType')
  const projectType: ProjectType = ptRaw && (PROJECT_TYPES as string[]).includes(ptRaw) ? (ptRaw as ProjectType) : 'new'
  const fRaw = params.get('funding')
  const funding: Funding = fRaw && (FUNDING_TYPES as string[]).includes(fRaw) ? (fRaw as Funding) : 'private'
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
  useDocumentTitle(state.status === 'loaded' ? state.data.parcel.address : 'Feasibility report')

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
          <div className="h-5 w-48 animate-pulse rounded bg-piranha-charcoal/10" />
          <div className="h-12 w-3/4 animate-pulse rounded bg-piranha-charcoal/10" />
          <div className="h-64 animate-pulse rounded-2xl bg-piranha-charcoal/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-piranha-charcoal/5" />
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
                to={`/map?city=${state.data.project.city}&cmp=${encodeURIComponent(btoa(JSON.stringify(input)))}`}
                className="text-piranha-charcoal/60 transition-colors hover:text-piranha-burgundy"
              >
                Compare another parcel
              </Link>
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

          <Reveal className="mt-10">
            <header>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
                Feasibility report
              </p>
              <h1 className="mt-5 font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-tight text-piranha-charcoal">
                {state.data.parcel.address}
              </h1>
              <p className="mt-4 text-sm text-piranha-charcoal/55">
                Parcel {state.data.parcel.parcelId} · District {state.data.parcel.districtCode}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill>{PROJECT_TYPE_LABEL[state.data.project.projectType]}</Pill>
                <Pill>{state.data.project.use}</Pill>
                <Pill>{state.data.project.gfa.toLocaleString()} sq ft</Pill>
                {state.data.project.units ? <Pill>{state.data.project.units} units</Pill> : null}
                {state.data.project.funding === 'public' ? <Pill>Publicly funded</Pill> : null}
              </div>
            </header>
          </Reveal>

          <div className="print-hide mt-8">
            <MiniMap lat={state.data.project.lat} lng={state.data.project.lng} />
          </div>

          <Reveal className="mt-8">
            <KeyMetrics
              costs={state.data.costs}
              timeline={state.data.timeline}
              hurdles={state.data.hurdles}
            />
          </Reveal>

          <Reveal className="mt-8">
            <VerdictBanner
              overall={state.data.feasibility.overall}
              envelopeKnown={state.data.feasibility.envelopeKnown}
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
              />
            </ReportSection>

            <ReportSection
              n="04"
              title="From design to move-in"
              kicker="The full life-cycle: architectural design, permits, site prep, and construction."
            >
              <Timeline timeline={state.data.timeline} />
            </ReportSection>

            <ReportSection n="05" title="The site" kicker="What the public record says about the parcel.">
              <SiteFacts parcel={state.data.parcel} />
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
            <NextSteps city={state.data.project.city} />
          </div>

          <div className="mt-8 space-y-6">
            <AssumptionsDisclosure assumptions={state.data.assumptions} />
            <p className="text-sm text-piranha-charcoal/60">
              Want to see how every number is calculated? Read about our methodologies{' '}
              <Link className="text-piranha-burgundy underline underline-offset-2" to="/math">
                here
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
    </div>
  )
}
