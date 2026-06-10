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
  const pct = max > min ? ((sliderVal - min) / (max - min)) * 100 : 0

  // Stepper buttons (WO-8.5c). Step by the slider's own step; clamp to [min,max].
  // An empty/NaN field starts from `min` so the first tap lands on a real value.
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const stepBy = (dir: -1 | 1) => {
    const base = has ? n : min
    onChange(String(clamp(base + dir * step)))
  }
  const atMin = has && n <= min
  const atMax = has && n >= max
  // 44px touch targets on all sizes; visually subordinate on desktop (sm:smaller).
  const stepBtn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-piranha-charcoal/20 text-xl leading-none text-piranha-charcoal/70 transition-colors hover:border-piranha-burgundy hover:text-piranha-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-piranha-gold disabled:cursor-not-allowed disabled:opacity-35 sm:h-9 sm:w-9 sm:text-base'

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

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
          className={stepBtn}
        >
          <span aria-hidden>−</span>
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderVal}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
          className="tpp-range w-full"
        />
        <button
          type="button"
          onClick={() => stepBy(1)}
          disabled={atMax}
          aria-label={`Increase ${label}`}
          className={stepBtn}
        >
          <span aria-hidden>+</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-md border border-piranha-charcoal/20 bg-white px-3 py-1.5 text-sm text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none"
        />
        <span className="text-xs text-piranha-charcoal/45">type exact, drag, or use ± </span>
      </div>

      {help && <p className="mt-2 text-xs text-piranha-charcoal/50">{help}</p>}
    </div>
  )
}
