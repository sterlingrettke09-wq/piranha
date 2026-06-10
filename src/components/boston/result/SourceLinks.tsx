import { COST_DATA_VINTAGE } from '../../../config/estimates'

const LABELS: Record<string, string> = {
  zoning: 'Zoning',
  parcels: 'Parcels',
  historic: 'Historic districts',
  flood: 'FEMA flood',
}

export function SourceLinks({ sources }: { sources: Record<string, string> }) {
  const entries = Object.entries(sources ?? {}).filter(([, url]) => /^https?:\/\//.test(url))
  return (
    <section className="space-y-2 border-t border-piranha-charcoal/10 pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-piranha-charcoal/50">
        Data sources
      </h4>
      {entries.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {entries.map(([key, url]) => (
            <li key={key}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-piranha-burgundy hover:underline"
              >
                {LABELS[key] ?? key} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      {/* Data provenance (WO-4.5). Vintage pulled from estimates.ts so it can't
          drift from the cost tables. Print-visible. */}
      <p className="text-xs leading-relaxed text-piranha-charcoal/45">
        Parcel &amp; zoning data fetched live from public records · Cost tables: {COST_DATA_VINTAGE}
      </p>
    </section>
  )
}
