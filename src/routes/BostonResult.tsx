import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { useAnalysis } from '../hooks/useAnalysis'
import { USES, PROJECT_TYPES, FUNDING_TYPES, type AnalysisInput, type Use, type ProjectType, type Funding } from '../types/analysis'
import { VerdictBanner } from '../components/boston/result/VerdictBanner'
import { MiniMap } from '../components/boston/result/MiniMap'
import { SiteFacts } from '../components/boston/result/SiteFacts'
import { ExistingStructure } from '../components/boston/result/ExistingStructure'
import { FeasibilityChecklist } from '../components/boston/result/FeasibilityChecklist'
import { HurdlesSection } from '../components/boston/result/HurdlesSection'
import { CostBreakdown } from '../components/boston/result/CostBreakdown'
import { Timeline } from '../components/boston/result/Timeline'
import { NarrativeSection } from '../components/boston/result/NarrativeSection'
import { AssumptionsDisclosure } from '../components/boston/result/AssumptionsDisclosure'
import { NextSteps } from '../components/boston/result/NextSteps'
import { SourceLinks } from '../components/boston/result/SourceLinks'

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

export default function BostonResult() {
  const [params] = useSearchParams()
  const input = useMemo(() => parseInput(params), [params])
  const state = useAnalysis(input)
  const [copied, setCopied] = useState(false)

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
      <PageContainer>
        <h1 className="font-serif text-4xl tracking-tight">Analysis</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          This link is missing the project details.{' '}
          <Link className="text-piranha-burgundy underline" to="/boston">
            Start from the map
          </Link>
          .
        </p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        {state.status === 'loading' && (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-piranha-charcoal/10" />
            <div className="h-40 animate-pulse rounded-lg bg-piranha-charcoal/5" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4 rounded-xl border border-rose-600/30 bg-rose-50 p-5">
            <h2 className="font-serif text-2xl tracking-tight text-rose-900">Couldn’t run the analysis</h2>
            <p className="text-sm text-rose-900/80">{state.error.message}</p>
            <button
              type="button"
              onClick={state.retry}
              className="rounded-md bg-piranha-burgundy px-4 py-2 text-sm font-medium text-piranha-bone"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === 'loaded' && (
          <>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link to="/boston" className="text-piranha-burgundy hover:underline">
                ← Back to map
              </Link>
              <Link
                to={`/boston/start?${params.toString()}`}
                className="text-piranha-burgundy hover:underline"
              >
                Edit inputs
              </Link>
              <button
                type="button"
                onClick={copyLink}
                className="ml-auto rounded-md border border-piranha-charcoal/20 px-3 py-1.5 font-medium text-piranha-charcoal hover:border-piranha-charcoal/40"
              >
                {copied ? 'Link copied' : 'Copy link'}
              </button>
            </nav>
            <header className="space-y-1">
              <h1 className="font-serif text-3xl tracking-tight">{state.data.parcel.address}</h1>
              <p className="text-sm text-piranha-charcoal/60">
                Parcel {state.data.parcel.parcelId} · district {state.data.parcel.districtCode}
              </p>
              <p className="text-sm font-medium text-piranha-charcoal/80">
                {PROJECT_TYPE_LABEL[state.data.project.projectType]} ·{' '}
                {state.data.project.use} · {state.data.project.gfa.toLocaleString()} sq ft
                {state.data.project.units ? ` · ${state.data.project.units} units` : ''}
                {state.data.project.funding === 'public' ? ' · publicly funded' : ''}
              </p>
            </header>
            <MiniMap lat={state.data.project.lat} lng={state.data.project.lng} />
            <VerdictBanner overall={state.data.feasibility.overall} />
            <NarrativeSection narrative={state.data.narrative} />
            <SiteFacts parcel={state.data.parcel} />
            <ExistingStructure existing={state.data.parcel.existing} />
            <FeasibilityChecklist checks={state.data.feasibility.checks} />
            <HurdlesSection hurdles={state.data.hurdles} />
            <CostBreakdown costs={state.data.costs} gfa={state.data.project.gfa} units={state.data.project.units} />
            <Timeline timeline={state.data.timeline} />
            <NextSteps city={state.data.project.city} />
            <AssumptionsDisclosure assumptions={state.data.assumptions} />
            <SourceLinks sources={state.data.sources} />
            {state.data.disclaimers.length > 0 && (
              <footer className="space-y-1 border-t border-piranha-charcoal/10 pt-4 text-xs text-piranha-charcoal/55">
                {state.data.disclaimers.map((d, i) => (
                  <p key={i}>{d}</p>
                ))}
              </footer>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
