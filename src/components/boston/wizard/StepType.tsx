import type { ProjectType, Funding } from '../../../types/analysis'
import { OptionCard } from './OptionCard'

interface Props {
  value: ProjectType | null
  onChange: (t: ProjectType) => void
  funding: Funding
  onFunding: (f: Funding) => void
}

const OPTIONS: { value: ProjectType; label: string; hint: string }[] = [
  { value: 'new', label: 'New construction', hint: 'Build something new on the lot' },
  { value: 'addition', label: 'Addition / renovation', hint: 'Expand or substantially alter an existing building' },
  { value: 'adu', label: 'Accessory dwelling unit', hint: 'A secondary unit: in-law, backyard cottage, basement' },
  { value: 'change_of_use', label: 'Change of use', hint: 'Convert a building to a different use' },
]

const FUNDING: { value: Funding; label: string; hint: string }[] = [
  { value: 'private', label: 'Privately funded', hint: 'Your own capital or private financing' },
  { value: 'public', label: 'Public / subsidized', hint: 'Public funds, tax credits, bonds, or city land' },
]

export function StepType({ value, onChange, funding, onFunding }: Props) {
  return (
    <div className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="font-serif text-2xl tracking-tight text-piranha-charcoal">
          What are you doing?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              hint={o.hint}
              selected={value === o.value}
              onClick={() => onChange(o.value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-piranha-charcoal/55">
          How is it funded?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {FUNDING.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              hint={o.hint}
              selected={funding === o.value}
              onClick={() => onFunding(o.value)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
