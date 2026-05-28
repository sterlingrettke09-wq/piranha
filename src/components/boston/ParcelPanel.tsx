import { useParcelInfo } from '../../hooks/useParcelInfo'
import { ParcelPanelContent } from './ParcelPanelContent'

interface PanelProps {
  selected: { lat: number; lng: number } | null
}

export function ParcelPanel({ selected }: PanelProps) {
  const state = useParcelInfo(selected)

  return (
    <aside className="bg-piranha-bone border-l border-piranha-charcoal/10 h-full overflow-y-auto">
      {state.status === 'idle' && <ParcelPanelContent status="idle" />}
      {state.status === 'loading' && <ParcelPanelContent status="loading" />}
      {state.status === 'loaded' && <ParcelPanelContent status="loaded" data={state.data} />}
      {state.status === 'error' && (
        <ParcelPanelContent status="error" error={state.error} onRetry={state.retry} />
      )}
    </aside>
  )
}
