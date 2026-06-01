/** True if the city's cinematic intro has already played this browser session.
 *  The dashboard reads this to decide whether to mount its map immediately or
 *  wait for the intro to hand off. Kept in its own module so both the intro
 *  component and the dashboard can import it without tripping fast-refresh. */
export function introSeen(slug: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return !!window.sessionStorage.getItem(`tpp_city_${slug}`)
  } catch {
    return false
  }
}
