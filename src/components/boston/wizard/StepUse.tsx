import type { Use } from '../../../types/analysis'

interface Props {
  value: Use | null
  onChange: (use: Use) => void
}

const OPTIONS: { value: Use; label: string; hint: string }[] = [
  { value: 'residential', label: 'Residential', hint: 'Housing — apartments, condos, multifamily' },
  { value: 'commercial', label: 'Commercial', hint: 'Retail, office, hospitality' },
  { value: 'mixed', label: 'Mixed-use', hint: 'Residential over ground-floor commercial' },
  { value: 'institutional', label: 'Institutional', hint: 'Civic, educational, healthcare' },
]

export function StepUse({ value, onChange }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-serif text-2xl tracking-tight">What kind of project?</legend>
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
  )
}
