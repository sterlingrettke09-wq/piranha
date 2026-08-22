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
function farBasisLabel(
  // Derived from the type rather than restated, so adding a basis is a compile
  // error here instead of a silent `default: null`.
  basis: NonNullable<Parcel['envelope']>['farBasis'] | undefined,
): string | null {
  switch (basis) {
    case 'residential':
      return '(residential FAR)'
    case 'mixed':
      return '(mixed-use FAR)'
    case 'district':
      return '(district FAR)'
    case 'planned-development':
      // Not a resolved figure and not a missing one — the binding number is in
      // the ordinance that created this district.
      return '(set by PD ordinance)'
    case 'basis-unavailable':
      // Unreachable in practice: this basis always carries a null floor area,
      // so the row that calls this never renders. Present so the switch stays
      // exhaustive and a future basis has to be decided rather than defaulted.
      return null
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
      : env?.farBasis === 'unconstrained'
        ? [
            {
              label: 'Max floor area',
              value: 'No FAR limit',
              note: 'governed by height, setbacks and lot coverage',
            },
          ]
        : env?.farBasis === 'planned-development'
          ? [
              {
                label: 'Max floor area',
                value: 'Set by PD ordinance',
                note: 'this district\u2019s limits are in its own ordinance, not a district table',
              },
            ]
          : env?.farBasis === 'basis-unavailable'
            ? [
                {
                  // The FAR itself still prints in the row below \u2014 it is known.
                  // What cannot be produced is the PRODUCT, because the code
                  // multiplies the ratio by buildable area rather than by the
                  // lot, and buildable area depends on the setbacks of
                  // neighbouring built lots. Saying "not in public data" here
                  // would be false: the limit is public and we have it.
                  label: 'Max floor area',
                  value: 'Not derivable from lot size',
                  note: 'the FAR applies to buildable area \u2014 the lot minus required yards \u2014 which depends on neighbouring setbacks and is not in any public layer',
                },
              ]
            : []),
    {
      label: 'Max FAR',
      // "The code imposes no FAR here" is an ANSWER; "Not in public data" is a
      // GAP. Printing the gap wording for an unconstrained district states the
      // wrong thing — it tells the reader we failed to look something up when
      // in fact we established the limit does not exist.
      value:
        parcel.maxFAR != null
          ? parcel.maxFAR.toFixed(2)
          : env?.farBasis === 'unconstrained'
            ? 'No FAR limit applies'
            : env?.farBasis === 'planned-development'
              ? 'Set by PD ordinance'
              : 'Not in public data',
    },
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
      value:
        parcel.maxHeightFt != null
          ? `${parcel.maxHeightFt} ft`
          : env?.heightBasis === 'unconstrained'
            ? 'No height limit applies'
            : env?.heightBasis === 'planned-development'
              ? 'Set by PD ordinance'
              : 'Not in public data',
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
