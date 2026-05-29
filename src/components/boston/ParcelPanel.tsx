import { useParcelInfo } from '../../hooks/useParcelInfo'
import { ParcelPanelContent } from './ParcelPanelContent'

interface PanelProps {
  selected: { lat: number; lng: number } | null
  city: string
}

export function ParcelPanel({ selected, city }: PanelProps) {
  const state = useParcelInfo(selected ? { ...selected, city } : null)

  return (
    <aside className="bg-piranha-bone border-l border-piranha-charcoal/10 h-full overflow-y-auto">
      {state.status === 'idle' && <ParcelPanelContent status="idle" />}
      {state.status === 'loading' && <ParcelPanelContent status="loading" />}
      {state.status === 'loaded' && <ParcelPanelContent status="loaded" data={state.data} city={city} />}
      {state.status === 'error' && (
        <ParcelPanelContent status="error" error={state.error} onRetry={state.retry} />
      )}
    </aside>
  )
}
