import { useParcelInfo } from '../../hooks/useParcelInfo'
import { ParcelPanelContent } from './ParcelPanelContent'

interface PanelProps {
  selected: { lat: number; lng: number } | null
  city: string
  /** Base64-encoded AnalysisInput of a first parcel. When present, the panel CTA
   *  switches to "Compare with this parcel" instead of "Start full analysis". */
  cmp?: string | null
  /** The address the geocoder returned for the search that produced `selected`,
   *  when a search produced it. Undefined for a map click. */
  searchedAddress?: string
}

export function ParcelPanel({ selected, city, cmp, searchedAddress }: PanelProps) {
  const state = useParcelInfo(selected ? { ...selected, city } : null)

  return (
    <aside className="h-full overflow-y-auto rounded-b-none rounded-t-none border border-t-0 border-piranha-charcoal/10 bg-piranha-bone/95 shadow-[0_20px_60px_-20px_rgba(26,26,26,0.45)] backdrop-blur-sm md:rounded-2xl md:border-t">
      {state.status === 'idle' && <ParcelPanelContent status="idle" />}
      {state.status === 'loading' && <ParcelPanelContent status="loading" />}
      {state.status === 'loaded' && (
        <ParcelPanelContent
          status="loaded"
          data={state.data}
          city={city}
          cmp={cmp}
          searchedAddress={searchedAddress}
        />
      )}
      {state.status === 'error' && (
        <ParcelPanelContent status="error" error={state.error} onRetry={state.retry} />
      )}
    </aside>
  )
}
