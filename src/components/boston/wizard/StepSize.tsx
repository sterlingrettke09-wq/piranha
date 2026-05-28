import type { Use } from '../../../types/analysis'

interface Props {
  use: Use | null
  gfa: string
  units: string
  onGfa: (v: string) => void
  onUnits: (v: string) => void
}

const inputClass =
  'w-full rounded-md border border-piranha-charcoal/20 bg-white px-3 py-2 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none'

export function StepSize({ use, gfa, units, onGfa, onUnits }: Props) {
  const showUnits = use === 'residential' || use === 'mixed'
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">How big?</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-piranha-charcoal">Gross floor area (sq ft)</span>
        <input type="number" inputMode="numeric" min={1} value={gfa} onChange={(e) => onGfa(e.target.value)} className={inputClass} placeholder="e.g. 15000" />
      </label>
      {showUnits && (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Number of units (optional)</span>
          <input type="number" inputMode="numeric" min={0} value={units} onChange={(e) => onUnits(e.target.value)} className={inputClass} placeholder="e.g. 12" />
        </label>
      )}
    </div>
  )
}
