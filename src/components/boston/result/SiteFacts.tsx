import type { AnalysisResult } from '../../../types/analysis'
import { PARKING_RULES } from '../../../config/parkingRules'

type Parcel = AnalysisResult['parcel']

function Fact({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: string
  note?: string | null
  /** 'positive' tints the value gold — used for parking-minimum tailwinds. */
  accent?: 'positive'
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.12em] text-piranha-charcoal/45">{label}</dt>
      <dd className={accent === 'positive' ? 'text-piranha-gold' : 'text-piranha-charcoal'}>
        {value}
        {note && <span className="ml-1.5 text-xs text-piranha-charcoal/45">{note}</span>}
      </dd>
    </div>
  )
}

// Labels which FAR drove the envelope's headline floor area, so the figure reads
// as use-specific rather than a single use-agnostic cap (WO-5.5).
function farBasisLabel(basis: 'residential' | 'mixed' | 'district' | null | undefined): string | null {
  switch (basis) {
    case 'residential':
      return '(residential FAR)'
    case 'mixed':
      return '(mixed-use FAR)'
    case 'district':
      return '(district FAR)'
    default:
      return null
  }
}

export function SiteFacts({ parcel, city }: { parcel: Parcel; city: string }) {
  const env = parcel.envelope
  const parking = PARKING_RULES[city]
  const facts: { label: string; value: string; note?: string | null; accent?: 'positive' }[] = [
    { label: 'Zoning district', value: parcel.districtCode || '—' },
    {
      label: 'Lot size',
      value: parcel.lotSqFt ? `${parcel.lotSqFt.toLocaleString()} sq ft` : 'Not on file',
    },
    ...(env && env.maxFloorAreaSqFt != null
      ? [
          {
            label: 'Max floor area',
            value: `${env.maxFloorAreaSqFt.toLocaleString()} sq ft`,
            note: farBasisLabel(env.farBasis),
          },
        ]
      : []),
    { label: 'Max FAR', value: parcel.maxFAR != null ? parcel.maxFAR.toFixed(2) : 'Not in public data' },
    {
      label: 'Max height',
      value: parcel.maxHeightFt != null ? `${parcel.maxHeightFt} ft` : 'Not in public data',
    },
    { label: 'Allowed uses', value: parcel.allowedUses?.join(', ') ?? 'Not derivable' },
    { label: 'Flood zone', value: parcel.floodZone || 'None mapped' },
  ]
  if (parcel.historicDistrict) facts.push({ label: 'Historic district', value: parcel.historicDistrict })
  if (parking) {
    facts.push({
      label: 'Parking minimums',
      value: parking.headline,
      note: parking.detail,
      accent: parking.status === 'abolished' ? 'positive' : undefined,
    })
  }

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 sm:grid-cols-3">
      {facts.map((f) => (
        <Fact key={f.label} label={f.label} value={f.value} note={f.note} accent={f.accent} />
      ))}
    </dl>
  )
}
