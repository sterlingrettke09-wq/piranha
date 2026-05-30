import type { ProjectType, Funding } from '../../../types/analysis'

interface Props {
  value: ProjectType | null
  onChange: (t: ProjectType) => void
  funding: Funding
  onFunding: (f: Funding) => void
}

const OPTIONS: { value: ProjectType; label: string; hint: string }[] = [
  { value: 'new', label: 'New construction', hint: 'Build something new on the lot' },
  { value: 'addition', label: 'Addition / renovation', hint: 'Expand or substantially alter an existing building' },
  { value: 'adu', label: 'Accessory dwelling unit', hint: 'A secondary unit — in-law, backyard cottage, basement' },
  { value: 'change_of_use', label: 'Change of use', hint: 'Convert a building to a different use' },
]

const FUNDING: { value: Funding; label: string; hint: string }[] = [
  { value: 'private', label: 'Privately funded', hint: 'Your own capital or private financing' },
  { value: 'public', label: 'Public / subsidized', hint: 'Public funds, tax credits, bonds, or city land' },
]

export function StepType({ value, onChange, funding, onFunding }: Props) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="font-serif text-2xl tracking-tight">What are you doing?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                value === o.value
                  ? 'border-piranha-burgundy bg-piranha-burgundy/5'
                  : 'border-piranha-charcoal/15 hover:border-piranha-charcoal/40'
              }`}
            >
              <span className="block font-semibold text-piranha-charcoal">{o.label}</span>
              <span className="block text-sm text-piranha-charcoal/60">{o.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wider text-piranha-charcoal/60">
          How is it funded?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {FUNDING.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onFunding(o.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                funding === o.value
                  ? 'border-piranha-burgundy bg-piranha-burgundy/5'
                  : 'border-piranha-charcoal/15 hover:border-piranha-charcoal/40'
              }`}
            >
              <span className="block font-semibold text-piranha-charcoal">{o.label}</span>
              <span className="block text-sm text-piranha-charcoal/60">{o.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
