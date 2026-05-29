import { getCity } from '../../../config/cities'

export function NextSteps({ city }: { city: string }) {
  const c = getCity(city)
  return (
    <section className="rounded-xl border border-piranha-charcoal/15 bg-piranha-burgundy/5 p-5">
      <h3 className="font-serif text-xl tracking-tight text-piranha-charcoal">What’s next</h3>
      <p className="mt-2 text-sm leading-relaxed text-piranha-charcoal/75">
        These are estimates from public data. To take a real next step — confirm the
        zoning, file for permits or relief, and verify fees — start with the city.
      </p>
      <a
        href={c.permitUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block font-medium text-piranha-burgundy hover:underline"
      >
        {c.permitName} ↗
      </a>
    </section>
  )
}
