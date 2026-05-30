import type { AnalysisResult } from '../../../types/analysis'

type Existing = NonNullable<AnalysisResult['parcel']['existing']>

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wider text-piranha-charcoal/50">{label}</dt>
      <dd className="text-piranha-charcoal">{value}</dd>
    </div>
  )
}

export function ExistingStructure({ existing }: { existing: Existing | undefined }) {
  if (!existing) return null

  const facts: { label: string; value: string }[] = []
  if (existing.landUse) facts.push({ label: 'Current use', value: existing.landUse })
  if (existing.yearBuilt) facts.push({ label: 'Year built', value: String(existing.yearBuilt) })
  if (existing.stories) facts.push({ label: 'Floors', value: String(existing.stories) })
  if (existing.units) facts.push({ label: 'Units', value: existing.units.toLocaleString() })
  if (existing.buildingAreaSqFt)
    facts.push({ label: 'Building area', value: `${existing.buildingAreaSqFt.toLocaleString()} sq ft` })
  if (existing.numBuildings && existing.numBuildings > 1)
    facts.push({ label: 'Buildings', value: String(existing.numBuildings) })

  // Nothing meaningful on file (e.g. vacant lot with no record) — don't show an empty card.
  if (facts.length === 0) return null

  const vacant = /vacant/i.test(existing.landUse ?? '')

  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">What’s here today</h3>
      {vacant ? (
        <p className="rounded-lg border border-piranha-charcoal/10 p-5 text-piranha-charcoal/80">
          The city records this parcel as <span className="font-semibold">vacant land</span> — a blank slate.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-piranha-charcoal/10 p-5 sm:grid-cols-3">
          {facts.map((f) => (
            <Fact key={f.label} label={f.label} value={f.value} />
          ))}
        </dl>
      )}
    </section>
  )
}
