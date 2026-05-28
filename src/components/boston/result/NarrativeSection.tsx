export function NarrativeSection({ narrative }: { narrative: string }) {
  return (
    <section className="space-y-2">
      <h3 className="font-serif text-xl tracking-tight">Summary</h3>
      <p className="whitespace-pre-line leading-relaxed text-piranha-charcoal/85">{narrative}</p>
    </section>
  )
}
