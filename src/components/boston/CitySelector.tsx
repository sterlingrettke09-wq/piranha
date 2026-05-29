import { CITIES } from '../../config/cities'

interface Props {
  value: string
  onChange: (slug: string) => void
}

export function CitySelector({ value, onChange }: Props) {
  return (
    <div className="rounded-lg border border-piranha-charcoal/15 bg-piranha-bone/95 shadow-sm backdrop-blur">
      <label className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-piranha-charcoal/50">
          City
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent font-serif text-lg tracking-tight text-piranha-charcoal focus:outline-none"
          aria-label="Select a city"
        >
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
              {c.live ? '' : ' — coming soon'}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
