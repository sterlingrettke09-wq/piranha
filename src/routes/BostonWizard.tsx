import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { useParcelInfo } from '../hooks/useParcelInfo'
import { USES, PROJECT_TYPES, type Use, type ProjectType } from '../types/analysis'
import { WizardProgress } from '../components/boston/wizard/WizardProgress'
import { ParcelContextHeader } from '../components/boston/wizard/ParcelContextHeader'
import { StepType } from '../components/boston/wizard/StepType'
import { StepUse } from '../components/boston/wizard/StepUse'
import { StepSize } from '../components/boston/wizard/StepSize'
import { StepHeight } from '../components/boston/wizard/StepHeight'

const TOTAL_STEPS = 4

export default function BostonWizard() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const city = params.get('city') ?? 'boston'
  const parcelId = params.get('parcelId') ?? ''
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const hasLocation = parcelId !== '' && Number.isFinite(lat) && Number.isFinite(lng)

  const parcelArgs = useMemo(
    () => (hasLocation ? { lat, lng, city } : null),
    [hasLocation, lat, lng, city],
  )
  const parcelState = useParcelInfo(parcelArgs)

  // Pre-fill from the URL so the result page's "Edit inputs" link round-trips.
  const [step, setStep] = useState(1)
  const [projectType, setProjectType] = useState<ProjectType | null>(() => {
    const t = params.get('projectType')
    return t && (PROJECT_TYPES as string[]).includes(t) ? (t as ProjectType) : null
  })
  const [use, setUse] = useState<Use | null>(() => {
    const u = params.get('use')
    return u && (USES as string[]).includes(u) ? (u as Use) : null
  })
  const [gfa, setGfa] = useState(() => params.get('gfa') ?? '')
  const [units, setUnits] = useState(() => params.get('units') ?? '')
  const [stories, setStories] = useState(() => params.get('stories') ?? '')
  const [heightFt, setHeightFt] = useState(() => params.get('heightFt') ?? '')

  if (!hasLocation) {
    return (
      <PageContainer>
        <h1 className="font-serif text-4xl tracking-tight">Start an analysis</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          Pick a parcel from the{' '}
          <a className="text-piranha-burgundy underline" href="/boston">
            Boston map
          </a>{' '}
          to begin — we need a location to analyze.
        </p>
      </PageContainer>
    )
  }

  const gfaNum = Number(gfa)
  const canAdvanceSize = gfa !== '' && Number.isFinite(gfaNum) && gfaNum > 0
  const canSubmit = heightFt !== '' || stories !== ''
  const canAdvance =
    step === 1 ? projectType !== null : step === 2 ? use !== null : step === 3 ? canAdvanceSize : true

  function goResult() {
    const p = new URLSearchParams()
    p.set('city', city)
    p.set('parcelId', parcelId)
    p.set('projectType', projectType as ProjectType)
    p.set('lat', String(lat))
    p.set('lng', String(lng))
    p.set('use', use as Use)
    p.set('gfa', String(gfaNum))
    if (units !== '') p.set('units', String(Number(units)))
    if (stories !== '') p.set('stories', String(Number(stories)))
    if (heightFt !== '') p.set('heightFt', String(Number(heightFt)))
    navigate(`/boston/result?${p.toString()}`)
  }

  const parcelStatus =
    parcelState.status === 'loaded'
      ? 'loaded'
      : parcelState.status === 'error'
        ? 'error'
        : 'loading'

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-6">
        <ParcelContextHeader
          status={parcelStatus}
          parcel={parcelState.status === 'loaded' ? parcelState.data : undefined}
        />
        <WizardProgress step={step} total={TOTAL_STEPS} />

        <div key={step} className="tpp-fade-in">
          {step === 1 && <StepType value={projectType} onChange={(t) => setProjectType(t)} />}
          {step === 2 && <StepUse value={use} onChange={(u) => setUse(u)} />}
          {step === 3 && (
            <StepSize use={use} gfa={gfa} units={units} onGfa={setGfa} onUnits={setUnits} />
          )}
          {step === 4 && (
            <StepHeight
              stories={stories}
              heightFt={heightFt}
              onStories={setStories}
              onHeight={setHeightFt}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="rounded-md px-4 py-2 text-piranha-charcoal/70 disabled:opacity-40"
          >
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="rounded-md bg-piranha-burgundy px-5 py-2 font-medium text-piranha-bone disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={goResult}
              disabled={!canSubmit}
              className="rounded-md bg-piranha-burgundy px-5 py-2 font-medium text-piranha-bone disabled:opacity-40"
            >
              Analyze
            </button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
