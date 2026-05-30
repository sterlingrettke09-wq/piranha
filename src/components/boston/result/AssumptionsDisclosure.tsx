export function AssumptionsDisclosure({ assumptions }: { assumptions: Record<string, string> }) {
  const entries = Object.entries(assumptions)
  if (entries.length === 0) return null
  return (
    <details className="group rounded-2xl border border-piranha-charcoal/10 bg-white/40 px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/70">
        Assumptions behind these numbers
        <span className="font-serif text-xl text-piranha-gold transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <dl className="mt-5 space-y-3 text-sm">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-6 border-t border-piranha-charcoal/10 pt-3 first:border-0 first:pt-0"
          >
            <dt className="text-piranha-charcoal/55">{k}</dt>
            <dd className="text-right text-piranha-charcoal/85">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
