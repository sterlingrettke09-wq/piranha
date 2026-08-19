// Is the pinned parcel-fabric floor still current?
//
//   npx vite-node scripts/verify-parcel-vintage.ts
//
// The runtime resolver reads Cook County's layer list on every warm instance, so
// production follows the newest tax year on its own. This exists for the OTHER
// half: the pinned floor in `parcelVintage.ts` is what a resolution failure falls
// back to, and a floor that is two years behind is a quietly wrong answer waiting
// for one bad metadata request.
//
// It also answers the question the runtime cannot: HAS the year rolled over? A
// rollover is not a bug, but it changes what every stored watchlist row was read
// against, and the checker has to treat that as its own state rather than as a
// parcel diff. This is the thing that says it happened.
//
// ⚠️ Exits non-zero when the live newest is ahead of the floor. That is a real
// failure — the intended response is to bump COOK_PINNED_YEAR / _LAYER_ID and to
// go and look at what a rollover means for existing rows, not to silence it.

import {
  COOK_PARCEL_SERVICE, COOK_PINNED_YEAR, COOK_PINNED_LAYER_ID, newestParcelLayer,
} from '../netlify/functions/lib/providers/parcelVintage'

async function main() {
  const res = await fetch(`${COOK_PARCEL_SERVICE}?f=json`, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    console.error(`[vintage] could not read the layer list — HTTP ${res.status}. NOT a pass: re-run.`)
    process.exitCode = 1
    return
  }
  const meta = (await res.json()) as { layers?: Array<{ id: number; name: string }>; error?: unknown }
  if (meta.error) {
    console.error(`[vintage] service answered 200 with an error envelope. NOT a pass: re-run.`)
    process.exitCode = 1
    return
  }
  const layers = meta.layers ?? []
  // rule 20: a check that can pass by finding nothing is not a check. An empty
  // or year-less list must go red, not report "floor is current".
  if (layers.length === 0) {
    console.error('[vintage] the service published no layers at all. Refusing to report the floor as current.')
    process.exitCode = 1
    return
  }
  const newest = newestParcelLayer(meta)
  if (newest == null) {
    console.error(`[vintage] ${layers.length} layers published, none year-labelled. The naming convention changed.`)
    process.exitCode = 1
    return
  }

  console.log(`[vintage] Cook County parcelHistorical: ${layers.length} layers published.`)
  console.log(`[vintage] newest year-labelled layer: "${newest.year}" at layer id ${newest.id}`)
  console.log(`[vintage] pinned floor in parcelVintage.ts: ${COOK_PINNED_YEAR} at layer id ${COOK_PINNED_LAYER_ID}`)

  if (newest.year > COOK_PINNED_YEAR) {
    console.error('')
    console.error(`[vintage] ⚠️ THE TAX YEAR HAS ROLLED OVER. ${COOK_PINNED_YEAR} → ${newest.year}.`)
    console.error('[vintage] Two things follow, and the second is the one that gets forgotten:')
    console.error(`[vintage]   1. Bump COOK_PINNED_YEAR to ${newest.year} and COOK_PINNED_LAYER_ID to ${newest.id}.`)
    console.error('[vintage]      ⚠️ The id is NOT the year — Cook County numbers 2000-2021 as ids 0-23.')
    console.error('[vintage]   2. Every watchlist row stored before now carries the OLD vintage. A row')
    console.error('[vintage]      whose parcel stops resolving against the new fabric has been')
    console.error('[vintage]      subdivided or merged — that is an alert worth sending, and it is NOT')
    console.error('[vintage]      the same as the parcel changing. The checker must compare vintages')
    console.error('[vintage]      before it compares snapshots.')
    process.exitCode = 1
    return
  }
  if (newest.year < COOK_PINNED_YEAR) {
    console.error(`[vintage] ⚠️ the floor is AHEAD of the service (${COOK_PINNED_YEAR} > ${newest.year}).`)
    console.error('[vintage] Either a layer was withdrawn or the floor was typed wrong. Neither is fine.')
    process.exitCode = 1
    return
  }
  console.log(`[vintage] floor is current. ${newest.year} is the newest published year.`)
}

void main()
