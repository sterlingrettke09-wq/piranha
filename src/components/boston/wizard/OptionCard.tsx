interface Props {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}

/** Selectable card used across the wizard's choice steps. */
export function OptionCard({ label, hint, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex items-start justify-between gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
        selected
          ? 'border-piranha-burgundy bg-piranha-burgundy/[0.04] ring-1 ring-piranha-burgundy/25'
          : 'border-piranha-charcoal/12 bg-white/50 hover:border-piranha-charcoal/30 hover:bg-white'
      }`}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-piranha-charcoal">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-piranha-charcoal/60">{hint}</span>
      </span>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
          selected
            ? 'border-piranha-burgundy bg-piranha-burgundy text-piranha-bone'
            : 'border-piranha-charcoal/25 text-transparent group-hover:border-piranha-charcoal/40'
        }`}
        aria-hidden
      >
        ✓
      </span>
    </button>
  )
}
