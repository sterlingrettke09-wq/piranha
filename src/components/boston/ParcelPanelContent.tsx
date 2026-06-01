import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { ParcelInfo, ParcelError } from '../../types/parcel'

type Props =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ParcelInfo; city: string }
  | { status: 'error'; error: ParcelError; onRetry: () => void }

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-piranha-charcoal/45">
      {children}
    </h3>
  )
}

function Pill({ children, tone = 'burgundy' }: { children: ReactNode; tone?: 'burgundy' | 'gold' | 'charcoal' | 'outline' }) {
  const cls = {
    burgundy: 'bg-piranha-burgundy text-piranha-bone',
    gold: 'bg-piranha-gold/20 text-piranha-charcoal',
    charcoal: 'bg-piranha-charcoal text-piranha-bone',
    outline: 'border border-piranha-charcoal/25 text-piranha-charcoal/75',
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  )
}

export function ParcelPanelContent(props: Props) {
  if (props.status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
        <img
          src="/logo/piranha-fish-burgundy.png"
          alt=""
          aria-hidden
          className="mb-6 w-12 opacity-80"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-piranha-burgundy">
          Pick a parcel
        </p>
        <p className="mt-3 max-w-[15rem] text-sm leading-relaxed text-piranha-charcoal/65">
          Search an address or click anywhere on the map to pull its zoning and property record.
        </p>
      </div>
    )
  }

  if (props.status === 'loading') {
    return (
      <div className="animate-pulse space-y-4 p-7">
        <div className="h-3 w-16 rounded bg-piranha-charcoal/10" />
        <div className="h-7 w-3/4 rounded bg-piranha-charcoal/10" />
        <div className="h-px w-full bg-piranha-charcoal/10" />
        <div className="h-20 rounded-xl bg-piranha-charcoal/[0.06]" />
        <div className="h-20 rounded-xl bg-piranha-charcoal/[0.06]" />
        <div className="h-12 rounded-full bg-piranha-charcoal/10" />
      </div>
    )
  }

  if (props.status === 'error') {
    const msg =
      props.error.code === 'NO_PARCEL'
        ? 'No parcel at this location.'
        : props.error.code === 'OUT_OF_BBOX'
          ? 'That address is outside coverage.'
          : 'Couldn’t load parcel info.'
    return (
      <div className="space-y-4 p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-piranha-burgundy">
          {msg}
        </p>
        <p className="text-sm leading-relaxed text-piranha-charcoal/65">
          {props.error.code === 'NO_PARCEL' ? 'Try clicking directly on a building.' : props.error.message}
        </p>
        <button
          type="button"
          onClick={props.onRetry}
          className="rounded-full border border-piranha-charcoal/25 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-piranha-charcoal/75 transition-colors hover:border-piranha-charcoal/45"
        >
          Retry
        </button>
      </div>
    )
  }

  const { data } = props
  const hasLimits = data.zoning.maxHeightFt || data.zoning.maxFAR
  const hasExisting =
    data.existing &&
    (data.existing.landUse ||
      data.existing.yearBuilt ||
      data.existing.buildingAreaSqFt ||
      data.existing.units)
  const env = data.envelope
  const hasEnvelope = !!env && (env.maxFloorAreaSqFt != null || env.maxHeightFt != null || env.maxUnits != null)

  return (
    <div className="p-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-piranha-burgundy">
          Parcel
        </p>
        <h2 className="mt-2 font-serif text-2xl leading-tight tracking-tight text-piranha-charcoal">
          {data.address}
        </h2>
        {data.parcelId && (
          <p className="mt-1.5 text-xs text-piranha-charcoal/50">ID {data.parcelId}</p>
        )}
      </header>

      <div className="mt-6 space-y-6 border-t border-piranha-charcoal/10 pt-6">
        {hasEnvelope && env && (
          <section className="space-y-2 rounded-xl border border-piranha-burgundy/20 bg-piranha-burgundy/[0.04] p-4">
            <Eyebrow>What you can build</Eyebrow>
            {env.maxFloorAreaSqFt != null && (
              <p className="text-piranha-charcoal">
                <span className="font-serif text-2xl tracking-tight tabular-nums">
                  {env.maxFloorAreaSqFt.toLocaleString()}
                </span>
                <span className="ml-1.5 text-sm text-piranha-charcoal/55">sq ft by right</span>
              </p>
            )}
            {(() => {
              const bits = [
                env.maxStories != null
                  ? `up to ${env.maxStories} stories`
                  : env.maxHeightFt != null
                    ? `up to ${env.maxHeightFt} ft`
                    : null,
                env.maxUnits != null ? `about ${env.maxUnits.toLocaleString()} units` : null,
              ].filter(Boolean)
              return bits.length > 0 ? (
                <p className="text-sm text-piranha-charcoal/70">{bits.join(' · ')}</p>
              ) : null
            })()}
            {env.allowedUses && env.allowedUses.length > 0 && (
              <p className="text-xs text-piranha-charcoal/55">Allowed: {env.allowedUses.join(', ')}</p>
            )}
            <p className="text-[11px] italic leading-snug text-piranha-charcoal/45">
              Maximum by-right envelope, estimated from zoning and lot size.
            </p>
          </section>
        )}

        <section className="space-y-2.5">
          <Eyebrow>Zoning</Eyebrow>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{data.zoning.districtCode}</Pill>
            {data.zoning.subdistrict && <Pill tone="outline">{data.zoning.subdistrict}</Pill>}
          </div>
          {data.zoning.article && (
            <p className="text-sm text-piranha-charcoal/65">{data.zoning.article}</p>
          )}
        </section>

        {hasLimits && (
          <section className="space-y-2.5">
            <Eyebrow>Dimensional limits</Eyebrow>
            <dl className="grid grid-cols-2 gap-4">
              {data.zoning.maxHeightFt && (
                <div>
                  <dt className="text-xs text-piranha-charcoal/50">Max height</dt>
                  <dd className="mt-0.5 font-serif text-xl tracking-tight text-piranha-charcoal tabular-nums">
                    {data.zoning.maxHeightFt}
                    <span className="ml-1 text-sm text-piranha-charcoal/45">ft</span>
                  </dd>
                </div>
              )}
              {data.zoning.maxFAR && (
                <div>
                  <dt className="text-xs text-piranha-charcoal/50">Max FAR</dt>
                  <dd className="mt-0.5 font-serif text-xl tracking-tight text-piranha-charcoal tabular-nums">
                    {data.zoning.maxFAR}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section className="space-y-2.5">
          <Eyebrow>Lot</Eyebrow>
          {data.lot.sizeSqFt ? (
            <p className="text-piranha-charcoal">
              <span className="font-serif text-xl tracking-tight tabular-nums">
                {data.lot.sizeSqFt.toLocaleString()}
              </span>
              <span className="ml-1.5 text-sm text-piranha-charcoal/55">sq ft</span>
            </p>
          ) : (
            <p className="text-sm text-piranha-charcoal/55">Size unavailable</p>
          )}
        </section>

        {data.assessedValue != null && (
          <section className="space-y-1.5">
            <Eyebrow>Assessed value</Eyebrow>
            <p className="text-piranha-charcoal">
              <span className="font-serif text-xl tracking-tight tabular-nums">
                ${data.assessedValue.toLocaleString()}
              </span>
            </p>
            <p className="text-[11px] italic leading-snug text-piranha-charcoal/45">
              City tax assessment, not a market appraisal.
            </p>
          </section>
        )}

        {hasExisting && (
          <section className="space-y-2.5">
            <Eyebrow>What’s here today</Eyebrow>
            {data.existing!.landUse && (
              <p className="text-piranha-charcoal">{data.existing!.landUse}</p>
            )}
            {(() => {
              const bits = [
                data.existing!.yearBuilt ? `Built ${data.existing!.yearBuilt}` : null,
                data.existing!.stories ? `${data.existing!.stories} floors` : null,
                data.existing!.units ? `${data.existing!.units.toLocaleString()} units` : null,
                data.existing!.buildingAreaSqFt
                  ? `${data.existing!.buildingAreaSqFt.toLocaleString()} sq ft`
                  : null,
              ].filter(Boolean)
              return bits.length > 0 ? (
                <p className="text-sm text-piranha-charcoal/60">{bits.join(' · ')}</p>
              ) : null
            })()}
          </section>
        )}

        <section className="space-y-2.5">
          <Eyebrow>Overlays</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {data.overlays.historicDistrict && (
              <Pill tone="gold">Historic: {data.overlays.historicDistrict}</Pill>
            )}
            {data.overlays.floodZone && <Pill tone="charcoal">Flood {data.overlays.floodZone}</Pill>}
            {!data.overlays.historicDistrict && !data.overlays.floodZone && (
              <p className="text-sm text-piranha-charcoal/55">None apply</p>
            )}
          </div>
        </section>
      </div>

      <Link
        to={`/start?city=${encodeURIComponent(props.city)}&parcelId=${encodeURIComponent(data.parcelId)}&lat=${data.coordinates[1]}&lng=${data.coordinates[0]}`}
        className="group mt-7 flex items-center justify-center gap-3 rounded-full bg-piranha-burgundy px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-piranha-bone transition-colors hover:bg-piranha-charcoal"
      >
        Start full analysis
        <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div>
  )
}
