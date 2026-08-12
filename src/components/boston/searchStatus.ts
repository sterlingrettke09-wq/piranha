// The two decisions the address search makes, pulled out of the component so
// they can be asserted (`searchStatus.test.ts`).
//
// Both were defects, and both are the kind that reverts silently: the bbox looks
// like an obvious scoping win until you measure what it does, and "these four
// states all show nothing" is invisible in a diff because there is no code to
// look at. Neither is testable inside a `.tsx` the suite does not render, so
// they live here instead.

/** What the last geocode attempt did. Each arm renders differently, which is
 *  the whole point of the type. */
export type Hop =
  | { kind: 'idle' }
  /** Query issued, nothing back yet. Below `SLOW_MS` this renders as idle on
   *  purpose — the median answer is 122 ms and a status line that flickers on
   *  every keystroke is noise, not information. */
  | { kind: 'searching' }
  /** Still nothing after `SLOW_MS`. The first point at which "a request is in
   *  flight" is worth saying out loud. */
  | { kind: 'slow' }
  | { kind: 'results' }
  /** The service ANSWERED and matched nothing. */
  | { kind: 'none' }
  /** The service did not answer — transport failure or a non-2xx status. */
  | { kind: 'failed' }
  /** Neither answer nor error inside the budget. Not the same as either. */
  | { kind: 'stalled' }

/** The Search Box API is not queried at all below three characters (the widget
 *  returns early), so a shorter value is not a pending search. */
export const MIN_QUERY = 3
/** When a pending query starts being worth mentioning. Suggest was measured at
 *  median 122 ms / p90 193 ms / max 371 ms over 230 round trips, so a healthy
 *  search is answered long before this and never shows it. */
export const SLOW_MS = 800
/** How long a query may go unanswered before the hang becomes visible. p99 for
 *  suggest was measured at 302 ms and max at 371 ms over the same 230 round
 *  trips, so this is ~13× the worst observed answer — long enough that a slow
 *  network never trips it, short enough to beat a user's patience. */
export const STALL_MS = 5000

/** Shown whenever there is nothing to report. */
export const IDLE_NOTE = 'Searches are logged anonymously to improve coverage.'

/**
 * The line under the search box.
 *
 * ⚠️ THE POINT OF THIS FUNCTION IS THAT ITS ARMS DIFFER. Before it existed,
 * `SearchBar` wired only `onRetrieve`, and *zero results*, *a rejected fetch*,
 * *an HTTP 500* and *a request that never settled* were pixel-identical — to
 * each other AND to a search that had not happened. No dropdown, no spinner, no
 * message, not even "we couldn't find that address"; the 500 additionally threw
 * an unhandled promise rejection nobody saw. That is CLAUDE.md rule 5 at the
 * geocode hop: a known absence and a failed read rendering the same.
 *
 * `searchStatus.test.ts` asserts the arms are pairwise DISTINCT, so collapsing
 * two of them back into one line fails rather than quietly regresses.
 */
export function statusFor(hop: Hop): string {
  switch (hop.kind) {
    case 'slow':
      return 'Searching…'
    case 'none':
      // An ANSWER: the service replied and matched nothing. Says what to do next.
      return 'No address matched that search. Check the spelling, or click the parcel on the map.'
    case 'failed':
      // A GAP: the service did not reply. Must not read as "no such address".
      return 'Address search is unavailable right now — this is a problem on our side, not a result. Map clicks still work.'
    case 'stalled':
      // Neither: nothing came back and nothing errored. A state defined by
      // nothing happening, which is why only a timer can detect it.
      return 'Address search is not responding. Try again in a moment, or click the parcel on the map.'
    case 'idle':
    case 'searching':
    case 'results':
      return IDLE_NOTE
  }
}

/**
 * Options for Mapbox's `<SearchBox>`.
 *
 * ⚠️ THERE IS NO `bbox`, AND ADDING ONE BACK IS A DEFECT, NOT A REFINEMENT.
 * There was one, scoped to the searched city, and it did the opposite of what
 * its name suggests: **Mapbox's bbox SUBSTITUTES, it does not filter.** Given an
 * address outside the box, the API does not return nothing — it returns a
 * DIFFERENT address inside the box, with no signal that it did.
 *
 * Measured 2026-08-12, the same query with and without the parameter:
 *
 *   "3600 S Las Vegas Blvd" (the Bellagio, in unincorporated Paradise)
 *        with bbox → 36.169232,-115.140758  — 6 km north, downtown, IN the city
 *     without bbox → 36.112548,-115.175987  — the Bellagio itself
 *   "25 Dorrance St, Providence RI" searched in Boston
 *        with bbox → 25 Dorrance Street, Charlestown MA
 *     without bbox → 25 Dorrance Street, Providence RI
 *   "202 C St, San Diego CA" searched in LA
 *        with bbox → 202 Avenue C, Redondo Beach CA
 *     without bbox → 202 C Street, San Diego CA
 *
 * The first published **AS_OF_RIGHT, T6-UC, 225,750 sf, $100.8M** for a parcel
 * six kilometres from the address that was typed, with the panel's address line
 * reading "Selected location" so nothing on screen contradicted it. Verified
 * again at the real UI before and after this change. No jurisdiction gate can
 * catch that one — the substituted point is legitimately inside the City of Las
 * Vegas.
 *
 * `proximity` does the ranking job the bbox was mistakenly trusted with, and it
 * is enough: for in-city queries the top hit is byte-identical with and without
 * the bbox (1 City Hall Sq Boston, 200 N Spring St LA, 2000 S Las Vegas Blvd).
 * The suggestion list is longer, which is the honest trade — it now contains
 * what the user typed.
 *
 * Scoping belongs downstream, where a real boundary exists: `getParcelInfo`'s
 * bbox check and the city's jurisdiction gate (netlify/functions/lib/
 * jurisdiction.ts). A bbox is a rectangle and a city is not.
 */
export function searchBoxOptions(center: readonly [number, number]) {
  return {
    country: 'us',
    proximity: { lng: center[0], lat: center[1] },
    types: 'address',
  } as const
}
