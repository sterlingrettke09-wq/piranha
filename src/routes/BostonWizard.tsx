import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useParcelInfo } from '../hooks/useParcelInfo'
import { USES, PROJECT_TYPES, FUNDING_TYPES, type Use, type ProjectType, type Funding } from '../types/analysis'
import { WizardProgress } from '../components/boston/wizard/WizardProgress'
import { ParcelContextHeader } from '../components/boston/wizard/ParcelContextHeader'
import { StepType } from '../components/boston/wizard/StepType'
import { StepUse } from '../components/boston/wizard/StepUse'
import { StepSize } from '../components/boston/wizard/StepSize'
import { StepHeight } from '../components/boston/wizard/StepHeight'

const STEP_LABELS = ['Project', 'Use', 'Size', 'Height']
const TOTAL_STEPS = STEP_LABELS.length

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
  const [funding, setFunding] = useState<Funding>(() => {
    const f = params.get('funding')
    return f && (FUNDING_TYPES as string[]).includes(f) ? (f as Funding) : 'private'
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
      <div className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
          Define your project
        </p>
        <h1 className="mt-5 font-serif text-[clamp(2rem,4.5vw,3rem)] leading-[1.06] tracking-tight text-piranha-charcoal">
          Pick a parcel to begin.
        </h1>
        <p className="mt-4 leading-relaxed text-piranha-charcoal/70">
          An analysis starts from a location.{' '}
          <Link className="text-piranha-burgundy underline underline-offset-2" to="/map">
            Open the map
          </Link>{' '}
          and choose an address or drop a pin.
        </p>
      </div>
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
    p.set('funding', funding)
    p.set('lat', String(lat))
    p.set('lng', String(lng))
    p.set('use', use as Use)
    p.set('gfa', String(gfaNum))
    if (units !== '') p.set('units', String(Number(units)))
    if (stories !== '') p.set('stories', String(Number(stories)))
    if (heightFt !== '') p.set('heightFt', String(Number(heightFt)))
    navigate(`/result?${p.toString()}`)
  }

  const parcelStatus =
    parcelState.status === 'loaded'
      ? 'loaded'
      : parcelState.status === 'error'
        ? 'error'
        : 'loading'

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <div className="space-y-10">
        <ParcelContextHeader
          status={parcelStatus}
          parcel={parcelState.status === 'loaded' ? parcelState.data : undefined}
        />
        <WizardProgress step={step} labels={STEP_LABELS} />

        <div key={step} className="tpp-fade-in">
          {step === 1 && (
            <StepType
              value={projectType}
              onChange={(t) => setProjectType(t)}
              funding={funding}
              onFunding={(f) => setFunding(f)}
            />
          )}
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

        <div className="flex items-center justify-between border-t border-piranha-charcoal/10 pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-piranha-charcoal/60 transition-colors hover:text-piranha-charcoal disabled:pointer-events-none disabled:opacity-0"
          >
            ← Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="group inline-flex items-center gap-3 rounded-full bg-piranha-burgundy px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-bone transition-colors hover:bg-piranha-charcoal disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
                →
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={goResult}
              disabled={!canSubmit}
              className="group inline-flex items-center gap-3 rounded-full bg-piranha-burgundy px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-bone transition-colors hover:bg-piranha-charcoal disabled:cursor-not-allowed disabled:opacity-40"
            >
              See the report
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
                →
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
