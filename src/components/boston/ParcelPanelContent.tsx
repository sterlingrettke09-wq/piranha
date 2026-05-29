import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { ParcelInfo, ParcelError } from '../../types/parcel'

type Props =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ParcelInfo; city: string }
  | { status: 'error'; error: ParcelError; onRetry: () => void }

export function ParcelPanelContent(props: Props) {
  if (props.status === 'idle') {
    return (
      <div className="p-6 text-sm text-piranha-charcoal/70">
        Search an address or click the map to start.
      </div>
    )
  }

  if (props.status === 'loading') {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-6 bg-piranha-charcoal/10 w-3/4" />
        <div className="h-4 bg-piranha-charcoal/10 w-1/2" />
        <div className="h-32 bg-piranha-charcoal/5 mt-6" />
        <div className="h-10 bg-piranha-charcoal/10 mt-6" />
      </div>
    )
  }

  if (props.status === 'error') {
    const msg =
      props.error.code === 'NO_PARCEL'
        ? 'No parcel at this location — try a building.'
        : props.error.code === 'OUT_OF_BBOX'
          ? 'That address is outside Boston coverage.'
          : "Couldn't load parcel info."
    return (
      <div className="p-6 space-y-4 text-sm">
        <p className="font-semibold uppercase tracking-wider text-piranha-burgundy">
          {msg}
        </p>
        <p className="text-piranha-charcoal/70">{props.error.message}</p>
        <Button size="sm" onClick={props.onRetry}>Retry</Button>
      </div>
    )
  }

  const { data } = props
  return (
    <div className="p-6 space-y-6 text-sm">
      <header>
        <h2 className="font-serif text-2xl tracking-tight">{data.address}</h2>
        <p className="text-piranha-charcoal/60 text-xs mt-1">Parcel {data.parcelId}</p>
      </header>

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Zoning</h3>
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="burgundy">{data.zoning.districtCode}</Badge>
          {data.zoning.subdistrict && <Badge tone="bone">{data.zoning.subdistrict}</Badge>}
        </div>
        {data.zoning.article && (
          <p className="text-piranha-charcoal/70">{data.zoning.article}</p>
        )}
      </section>

      {(data.zoning.maxHeightFt || data.zoning.maxFAR) && (
        <section>
          <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Dimensional limits</h3>
          <dl className="grid grid-cols-2 gap-3">
            {data.zoning.maxHeightFt && (
              <div><dt className="text-piranha-charcoal/60 text-xs">Max height</dt><dd>{data.zoning.maxHeightFt} ft</dd></div>
            )}
            {data.zoning.maxFAR && (
              <div><dt className="text-piranha-charcoal/60 text-xs">Max FAR</dt><dd>{data.zoning.maxFAR}</dd></div>
            )}
          </dl>
        </section>
      )}

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Lot</h3>
        {data.lot.sizeSqFt ? <p>{data.lot.sizeSqFt.toLocaleString()} sq ft</p> : <p className="text-piranha-charcoal/60">Size unavailable</p>}
      </section>

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Overlays</h3>
        <div className="flex flex-wrap gap-2">
          {data.overlays.historicDistrict && <Badge tone="gold">Historic: {data.overlays.historicDistrict}</Badge>}
          {data.overlays.floodZone && <Badge tone="charcoal">Flood Zone {data.overlays.floodZone}</Badge>}
          {!data.overlays.historicDistrict && !data.overlays.floodZone && (
            <p className="text-piranha-charcoal/60 text-xs">No overlays apply</p>
          )}
        </div>
      </section>

      <Link
        to={`/boston/start?city=${encodeURIComponent(props.city)}&parcelId=${encodeURIComponent(data.parcelId)}&lat=${data.coordinates[1]}&lng=${data.coordinates[0]}`}
        className="block"
      >
        <Button size="lg" className="w-full">Start full analysis</Button>
      </Link>
    </div>
  )
}
