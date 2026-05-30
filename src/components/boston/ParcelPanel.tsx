import { useParcelInfo } from '../../hooks/useParcelInfo'
import { ParcelPanelContent } from './ParcelPanelContent'

interface PanelProps {
  selected: { lat: number; lng: number } | null
  city: string
}

export function ParcelPanel({ selected, city }: PanelProps) {
  const state = useParcelInfo(selected ? { ...selected, city } : null)

  return (
    <aside className="h-full overflow-y-auto rounded-2xl border border-piranha-charcoal/10 bg-piranha-bone/95 shadow-[0_20px_60px_-20px_rgba(26,26,26,0.45)] backdrop-blur-sm">
      {state.status === 'idle' && <ParcelPanelContent status="idle" />}
      {state.status === 'loading' && <ParcelPanelContent status="loading" />}
      {state.status === 'loaded' && <ParcelPanelContent status="loaded" data={state.data} city={city} />}
      {state.status === 'error' && (
        <ParcelPanelContent status="error" error={state.error} onRetry={state.retry} />
      )}
    </aside>
  )
}
