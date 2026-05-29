import type { AnalysisResult } from '../../../types/analysis'

type Parcel = AnalysisResult['parcel']

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wider text-piranha-charcoal/50">{label}</dt>
      <dd className="text-piranha-charcoal">{value}</dd>
    </div>
  )
}

export function SiteFacts({ parcel }: { parcel: Parcel }) {
  const facts: { label: string; value: string }[] = [
    { label: 'Zoning district', value: parcel.districtCode || '—' },
    { label: 'Lot size', value: parcel.lotSqFt ? `${parcel.lotSqFt.toLocaleString()} sq ft` : 'Not on file' },
    { label: 'Max FAR', value: parcel.maxFAR != null ? parcel.maxFAR.toFixed(2) : 'Not in public data' },
    { label: 'Max height', value: parcel.maxHeightFt != null ? `${parcel.maxHeightFt} ft` : 'Not in public data' },
    { label: 'Allowed uses', value: parcel.allowedUses?.join(', ') ?? 'Not derivable' },
    { label: 'Flood zone', value: parcel.floodZone || 'None mapped' },
  ]
  if (parcel.historicDistrict) facts.push({ label: 'Historic district', value: parcel.historicDistrict })

  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">The site</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-piranha-charcoal/10 p-5 sm:grid-cols-3">
        {facts.map((f) => (
          <Fact key={f.label} label={f.label} value={f.value} />
        ))}
      </dl>
    </section>
  )
}
