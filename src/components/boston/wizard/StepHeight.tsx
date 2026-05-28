interface Props {
  stories: string
  heightFt: string
  onStories: (v: string) => void
  onHeight: (v: string) => void
}

const inputClass =
  'w-full rounded-md border border-piranha-charcoal/20 bg-white px-3 py-2 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none'

export function StepHeight({ stories, heightFt, onStories, onHeight }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">How tall?</h2>
      <p className="text-sm text-piranha-charcoal/60">Enter height in feet, or stories, or both. Feet is used when provided.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Height (ft)</span>
          <input type="number" inputMode="numeric" min={0} value={heightFt} onChange={(e) => onHeight(e.target.value)} className={inputClass} placeholder="e.g. 55" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Stories</span>
          <input type="number" inputMode="numeric" min={0} value={stories} onChange={(e) => onStories(e.target.value)} className={inputClass} placeholder="e.g. 5" />
        </label>
      </div>
    </div>
  )
}
