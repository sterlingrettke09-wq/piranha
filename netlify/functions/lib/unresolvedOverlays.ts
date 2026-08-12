// One construction site for `ParcelInfo['overlays'].unresolved`.
//
// WHY A HELPER AND NOT 23 HAND-WRITTEN SPREADS. Every provider ends with an
// `overlays: { … }` literal, and the mark has to be attached there, in 23 files,
// next to 23 differently-named settled results. Written by hand that is 23
// chances to invert a condition, and — the failure that actually matters —
// 23 places where the mark can be quietly dropped while the field it protects
// stays exactly as it was. `unresolvedOverlays` makes the mark one call with a
// named key, so `providers/failedFetchClaims.test.ts` has something uniform to
// pin and `grep unresolvedOverlays netlify/functions/lib/providers` is a
// complete inventory of who marks what.
//
// THE RULE FOR THE BOOLEAN, and it is not "did the fetch fail". A field is
// unresolved when it is EMPTY **and** at least one read that feeds it failed:
//
//     historic: historicDistrict == null && readFailed(histR)
//
// Both halves are load-bearing in opposite directions. Without `== null`, a
// provider whose field is fed by two layers (Miami's historic district +
// archaeological zone, Raleigh's -HOD-G + -HOD-S, Phoenix's named listing + the
// zoning HP suffix) would report a gap while holding a perfectly good answer
// from the sibling — CLAUDE.md rule 13, in the direction that costs
// availability. Without `readFailed`, every parcel in the city is marked and the
// disclosure becomes wallpaper — the direction that costs meaning, and the one
// `failedFetchClaims.test.ts`'s healthy-run control exists to catch.
import type { UnresolvedOverlay } from '../../../src/types/parcel'

/** A settled OPTIONAL read that did not answer. Rejection is the whole signal:
 *  `arcgis.ts` throws on a transport error, a non-200, AND on ArcGIS's
 *  200-with-`{"error":…}` body, so a fulfilled read really did answer. */
export const readFailed = (r: PromiseSettledResult<unknown>): boolean => r.status === 'rejected'

/**
 * Build the `unresolved` entry for an `overlays` literal. Spread it:
 *
 *     overlays: {
 *       historicDistrict,
 *       floodZone: …,
 *       ...unresolvedOverlays({
 *         historic: historicDistrict == null && readFailed(histR),
 *         flood: readFailed(floodR),
 *       }),
 *     }
 *
 * Returns `{}` — not `{ unresolved: [] }` — when nothing failed, so the healthy
 * response is byte-identical to what it was before this mechanism existed and
 * no cached or logged payload changes shape on a good day.
 */
export function unresolvedOverlays(
  marks: Partial<Record<UnresolvedOverlay, boolean>>,
): { unresolved?: readonly UnresolvedOverlay[] } {
  const failed = (Object.keys(marks) as UnresolvedOverlay[]).filter((k) => marks[k])
  return failed.length > 0 ? { unresolved: failed } : {}
}
