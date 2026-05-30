import type { Use } from '../../../types/analysis'
import { OptionCard } from './OptionCard'

interface Props {
  value: Use | null
  onChange: (use: Use) => void
}

const OPTIONS: { value: Use; label: string; hint: string }[] = [
  { value: 'residential', label: 'Residential', hint: 'Housing: apartments, condos, multifamily' },
  { value: 'commercial', label: 'Commercial', hint: 'Retail, office, hospitality' },
  { value: 'mixed', label: 'Mixed-use', hint: 'Residential over ground-floor commercial' },
  { value: 'institutional', label: 'Institutional', hint: 'Civic, educational, healthcare' },
]

export function StepUse({ value, onChange }: Props) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-serif text-2xl tracking-tight text-piranha-charcoal">
        What kind of project?
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
  )
}
