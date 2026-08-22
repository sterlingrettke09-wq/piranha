import type { AnalysisResult } from '../../../types/analysis'
import { PARKING_RULES } from '../../../config/parkingRules'
// ⚠️ PURE FUNCTIONS IN THEIR OWN MODULE, not exported from this component file.
// They need to be unit-testable — a source-grep asserting a ternary's SHAPE is
// what pinned the previous structure and had to be argued past to improve it
// (rule 15). Exporting them from a .tsx would also trip react-refresh.
import { maxFarValue, maxHeightValue, maxFloorAreaRows } from './siteFactValues'

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

export function SiteFacts({ parcel, city }: { parcel: Parcel; city: string }) {
  const parking = PARKING_RULES[city]
  const facts: { label: string; value: string; note?: string | null; accent?: 'positive' }[] = [
    { label: 'Zoning district', value: parcel.districtCode || '—' },
    {
      label: 'Lot size',
      value: parcel.lotSqFt ? `${parcel.lotSqFt.toLocaleString()} sq ft` : 'Not on file',
    },
    ...maxFloorAreaRows(parcel),
    { label: 'Max FAR', ...maxFarValue(parcel) },
    {
      // ⚠️ FOUR STATES, THE SAME FOUR AS FAR ABOVE. This read
      // `maxHeightFt != null ? ... : 'Not in public data'` — two states — while
      // FAR next to it had four. So a district whose code imposes NO height
      // limit, a fact Atlanta, Dallas and Charlotte each resolve with a
      // citation, rendered as "Not in public data": the tool disclaiming
      // knowledge it demonstrably has, on sixteen Atlanta subareas alone.
      //
      // `heightUnconstrained` was added to the type on 2026-08-19 to express
      // exactly this and reached the client without a render path. The field
      // existing is not the same as the distinction arriving on screen.
      label: 'Max height',
      ...maxHeightValue(parcel),
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
