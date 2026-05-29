import type { Use } from '../../../types/analysis'
import { SliderInput } from './SliderInput'

interface Props {
  use: Use | null
  gfa: string
  units: string
  onGfa: (v: string) => void
  onUnits: (v: string) => void
}

export function StepSize({ use, gfa, units, onGfa, onUnits }: Props) {
  const showUnits = use === 'residential' || use === 'mixed'
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl tracking-tight">How big?</h2>
      <SliderInput
        label="Gross floor area"
        value={gfa}
        onChange={onGfa}
        min={0}
        max={250000}
        step={1000}
        unit="sq ft"
        help="Total built area across all floors."
      />
      {showUnits && (
        <SliderInput
          label="Number of units"
          value={units}
          onChange={onUnits}
          min={0}
          max={300}
          step={1}
          unit="units"
          help="Optional — dwelling units in the project."
        />
      )}
    </div>
  )
}
