interface Props {
  step: number // 1-based
  total: number
}

export function WizardProgress({ step, total }: Props) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-piranha-burgundy' : 'bg-piranha-charcoal/15'}`}
        />
      ))}
    </div>
  )
}
