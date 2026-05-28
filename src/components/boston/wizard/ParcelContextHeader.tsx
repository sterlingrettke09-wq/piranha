import type { ParcelInfo } from '../../../types/parcel'

interface Props {
  status: 'loading' | 'loaded' | 'error'
  parcel?: ParcelInfo
}

export function ParcelContextHeader({ status, parcel }: Props) {
  if (status === 'loading') {
    return <div className="h-6 w-64 animate-pulse rounded bg-piranha-charcoal/10" />
  }
  if (status === 'error' || !parcel) {
    return <p className="text-sm text-piranha-charcoal/70">Parcel details unavailable — analysis uses the selected location.</p>
  }
  return (
    <div className="text-sm text-piranha-charcoal/80">
      Analyzing <span className="font-semibold text-piranha-charcoal">{parcel.address}</span>{' '}
      <span className="text-piranha-charcoal/60">· district {parcel.zoning.districtCode}</span>
    </div>
  )
}
