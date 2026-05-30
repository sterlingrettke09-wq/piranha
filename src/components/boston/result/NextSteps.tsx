import { getCity } from '../../../config/cities'

export function NextSteps({ city }: { city: string }) {
  const c = getCity(city)
  return (
    <div className="rounded-2xl bg-[#1a1412] p-8 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-gold">
        Where to go from here
      </p>
      <h3 className="mt-4 max-w-lg font-serif text-2xl leading-tight tracking-tight text-piranha-bone sm:text-3xl">
        Turn the estimate into a real next step.
      </h3>
      <p className="mt-4 max-w-xl leading-relaxed text-piranha-bone/65">
        These figures come from public data. To act on them, confirm the zoning, file for permits
        or relief, and verify the fees with the city directly.
      </p>
      <a
        href={c.permitUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-7 inline-flex items-center gap-3 rounded-full border border-piranha-bone/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-piranha-bone transition-colors hover:bg-piranha-bone hover:text-piranha-charcoal"
      >
        <span>{c.permitName}</span>
        <span
          aria-hidden
          className="transition-transform duration-300 ease-out group-hover:translate-x-1.5"
        >
          ↗
        </span>
      </a>
    </div>
  )
}
