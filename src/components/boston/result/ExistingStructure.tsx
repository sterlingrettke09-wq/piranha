import type { AnalysisResult } from '../../../types/analysis'
import { hasExisting } from './existing'

type Existing = NonNullable<AnalysisResult['parcel']['existing']>

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">{label}</dt>
      <dd className="text-piranha-charcoal">{value}</dd>
    </div>
  )
}

export function ExistingStructure({ existing }: { existing: Existing | undefined }) {
  if (!existing || !hasExisting(existing)) return null

  const vacant = /vacant/i.test(existing.landUse ?? '')
  if (vacant) {
    return (
      <p className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 leading-relaxed text-piranha-charcoal/80">
        The city records this parcel as <span className="font-semibold">vacant land</span>. A blank
        slate, with no demolition to clear before building.
      </p>
    )
  }

  const facts: { label: string; value: string }[] = []
  if (existing.landUse) facts.push({ label: 'Current use', value: existing.landUse })
  if (existing.yearBuilt) facts.push({ label: 'Year built', value: String(existing.yearBuilt) })
  if (existing.stories) facts.push({ label: 'Floors', value: String(existing.stories) })
  if (existing.units) facts.push({ label: 'Units', value: existing.units.toLocaleString() })
  if (existing.buildingAreaSqFt)
    facts.push({ label: 'Building area', value: `${existing.buildingAreaSqFt.toLocaleString()} sq ft` })
  if (existing.numBuildings && existing.numBuildings > 1)
    facts.push({ label: 'Buildings', value: String(existing.numBuildings) })

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 sm:grid-cols-3">
      {facts.map((f) => (
        <Fact key={f.label} label={f.label} value={f.value} />
      ))}
    </dl>
  )
}
