export function AssumptionsDisclosure({ assumptions }: { assumptions: Record<string, string> }) {
  const entries = Object.entries(assumptions)
  if (entries.length === 0) return null
  return (
    <details className="rounded-lg border border-piranha-charcoal/10 p-4">
      <summary className="cursor-pointer font-medium text-piranha-charcoal">Assumptions used</summary>
      <dl className="mt-3 space-y-2 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-piranha-charcoal/60">{k}</dt>
            <dd className="text-right text-piranha-charcoal/85">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
