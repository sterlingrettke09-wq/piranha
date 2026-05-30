import type { AnalysisResult } from '../../../types/analysis'

type Parcel = AnalysisResult['parcel']

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">{label}</dt>
      <dd className="text-piranha-charcoal">{value}</dd>
    </div>
  )
}

export function SiteFacts({ parcel }: { parcel: Parcel }) {
  const facts: { label: string; value: string }[] = [
    { label: 'Zoning district', value: parcel.districtCode || '—' },
    {
      label: 'Lot size',
      value: parcel.lotSqFt ? `${parcel.lotSqFt.toLocaleString()} sq ft` : 'Not on file',
    },
    { label: 'Max FAR', value: parcel.maxFAR != null ? parcel.maxFAR.toFixed(2) : 'Not in public data' },
    {
      label: 'Max height',
      value: parcel.maxHeightFt != null ? `${parcel.maxHeightFt} ft` : 'Not in public data',
    },
    { label: 'Allowed uses', value: parcel.allowedUses?.join(', ') ?? 'Not derivable' },
    { label: 'Flood zone', value: parcel.floodZone || 'None mapped' },
  ]
  if (parcel.historicDistrict) facts.push({ label: 'Historic district', value: parcel.historicDistrict })

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 sm:grid-cols-3">
      {facts.map((f) => (
        <Fact key={f.label} label={f.label} value={f.value} />
      ))}
    </dl>
  )
}
