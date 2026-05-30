import type { ParcelInfo } from '../../../types/parcel'

interface Props {
  status: 'loading' | 'loaded' | 'error'
  parcel?: ParcelInfo
}

export function ParcelContextHeader({ status, parcel }: Props) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-piranha-burgundy">
        Define your project
      </p>
      {status === 'loading' && (
        <div className="mt-5 h-9 w-72 max-w-full animate-pulse rounded bg-piranha-charcoal/10" />
      )}
      {(status === 'error' || !parcel) && status !== 'loading' && (
        <h1 className="mt-5 font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.08] tracking-tight text-piranha-charcoal">
          Tell us what you want to build.
        </h1>
      )}
      {status === 'loaded' && parcel && (
        <>
          <h1 className="mt-5 font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.08] tracking-tight text-piranha-charcoal">
            {parcel.address}
          </h1>
          <p className="mt-3 text-sm text-piranha-charcoal/55">
            District {parcel.zoning.districtCode}
            {parcel.parcelId ? ` · Parcel ${parcel.parcelId}` : ''}
          </p>
        </>
      )}
    </header>
  )
}
