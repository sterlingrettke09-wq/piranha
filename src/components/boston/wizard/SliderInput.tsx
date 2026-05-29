interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step: number
  unit?: string
  help?: string
}

// Big live readout + brand-styled range slider + exact number entry.
export function SliderInput({ label, value, onChange, min, max, step, unit, help }: Props) {
  const n = value === '' ? NaN : Number(value)
  const has = Number.isFinite(n)
  const display = has ? n.toLocaleString() : '—'
  const sliderVal = has ? Math.min(max, Math.max(min, n)) : min

  return (
    <div className="rounded-xl border border-piranha-charcoal/10 bg-white/60 p-5">
      <div className="flex items-end justify-between gap-4">
        <span className="text-sm font-medium uppercase tracking-wider text-piranha-charcoal/60">
          {label}
        </span>
        <span className="font-serif text-3xl leading-none tracking-tight text-piranha-charcoal tabular-nums">
          {display}
          {unit && <span className="ml-1.5 text-base font-normal text-piranha-charcoal/45">{unit}</span>}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderVal}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-piranha-charcoal/10 accent-piranha-burgundy"
      />

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-md border border-piranha-charcoal/20 bg-white px-3 py-1.5 text-sm text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none"
        />
        <span className="text-xs text-piranha-charcoal/45">type exact, or drag the slider</span>
      </div>

      {help && <p className="mt-2 text-xs text-piranha-charcoal/50">{help}</p>}
    </div>
  )
}
