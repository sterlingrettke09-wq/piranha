import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addWatch, type AddWatchInput } from '../lib/watchlistClient'

// "Watch this parcel", from a report.
//
// ⚠️ THE INTERESTING STATE IS `not-watchable`, AND IT IS NOT AN ERROR.
//
// 7.1% of Dallas parcels carry no identifier in the county's records — 3,660 rows
// whose ACCT is the literal string 'MULTIPLE' (condominium footprints), plus
// ~31,700 blank or null. A watchlist is keyed on the parcel, so those genuinely
// cannot be watched, and the honest response is to say that about the PARCEL
// rather than to show a failure about the request. The server answers 200 with a
// reason for exactly this purpose; rendering it in red next to "something went
// wrong" would be false and would send the reader looking for a fault.

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'watching' }
  | { kind: 'already' }
  | { kind: 'not-watchable'; detail: string }
  | { kind: 'signed-out' }
  | { kind: 'problem'; detail: string }

export interface WatchParcelButtonProps {
  city: string
  parcelId: string | null
  address: string | null
  districtCode: string | null
  maxHeightFt: number | null
  maxFAR: number | null
  lotSqFt: number | null
  developable: boolean | null
  spec?: AddWatchInput['spec']
}

export function WatchParcelButton(p: WatchParcelButtonProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function save() {
    setState({ kind: 'saving' })
    const r = await addWatch({
      city: p.city,
      parcelId: p.parcelId,
      address: p.address,
      // The snapshot is the whole point: without the prior answer there is
      // nothing to diff a later one against. `null` here means "not resolved",
      // never zero, and the diff relies on that distinction.
      snapshot: {
        districtCode: p.districtCode,
        maxHeightFt: p.maxHeightFt,
        maxFAR: p.maxFAR,
        lotSqFt: p.lotSqFt,
        developable: p.developable,
      },
      ...(p.spec ? { spec: p.spec } : {}),
    })
    if (r.kind === 'added') setState({ kind: 'watching' })
    else if (r.kind === 'already-watching') setState({ kind: 'already' })
    else if (r.kind === 'not-watchable') setState({ kind: 'not-watchable', detail: r.detail })
    else if (r.kind === 'signed-out') setState({ kind: 'signed-out' })
    else setState({ kind: 'problem', detail: r.detail })
  }

  if (state.kind === 'watching' || state.kind === 'already') {
    return (
      <p className="text-sm text-piranha-charcoal/65">
        {state.kind === 'already' ? 'Already on your watchlist.' : 'Added to your watchlist.'}{' '}
        <Link to="/watchlist" className="text-piranha-burgundy underline underline-offset-4">
          View it
        </Link>
      </p>
    )
  }

  if (state.kind === 'not-watchable') {
    // Neutral, not red: this is a fact about the parcel's records.
    return (
      <p className="max-w-prose text-sm text-piranha-charcoal/60">{state.detail}</p>
    )
  }

  if (state.kind === 'signed-out') {
    return (
      <p className="text-sm text-piranha-charcoal/65">
        <Link to="/watchlist" className="text-piranha-burgundy underline underline-offset-4">
          Sign in
        </Link>{' '}
        to watch this parcel. No password — we email you a link.
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={state.kind === 'saving'}
        className="rounded-xl border border-piranha-charcoal/15 px-4 py-2 text-sm text-piranha-charcoal/75 transition hover:border-piranha-burgundy/40 hover:text-piranha-burgundy disabled:opacity-50"
      >
        {state.kind === 'saving' ? 'Saving…' : 'Watch this parcel'}
      </button>
      {state.kind === 'problem' ? (
        <p className="mt-2 text-sm text-piranha-burgundy">{state.detail}</p>
      ) : null}
    </div>
  )
}
