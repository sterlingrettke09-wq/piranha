interface Props {
  step: number // 1-based
  labels: string[]
}

export function WizardProgress({ step, labels }: Props) {
  const total = labels.length
  const current = labels[step - 1] ?? ''
  return (
    <div className="space-y-3" aria-label={`Step ${step} of ${total}`}>
      <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-[0.18em]">
        <span className="text-piranha-burgundy tabular-nums">
          Step {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <span className="text-piranha-charcoal/55">{current}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i < step ? 'bg-piranha-burgundy' : 'bg-piranha-charcoal/12'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
