import type { Hurdle, HurdleStatus } from '../../../types/analysis'

// ⚠️ RANK, DON'T COLLAPSE. Eleven to thirteen rows arrive in engine order, which
// is the order they were computed in and carries no priority: a live parcel
// returned `info, info, required, info, required, required, likely, info…`. The
// rows were never at equal weight — each already renders a severity chip — but
// the LIST asserted an order it did not have, because an <ol> numbers them
// 01, 02, 03 and a reader takes a numbered list as ranked.
//
// The alternative was hiding the informational rows behind a disclosure. That is
// worse and it is worth writing down why: an 'info' row is not noise, it is a
// fact that did not rise to a requirement for THIS project — no citywide
// inclusionary requirement, impact fees that apply on a threshold, an
// administrative permitting path. Someone at 40 units needs to read exactly
// those, and a collapse puts the rows a large project depends on behind the
// interaction a large project's builder is least likely to perform.
//
// So: rank, keep every row on screen, and let the order do the work.
//
// `unchecked` sorts LAST and deliberately not by severity — it is a claim about
// this report rather than about the parcel (see the chip comment above), so
// slotting it between 'likely' and 'info' would make "we didn't look" read as a
// middling hazard. Last, visible, and still carrying its own chip.
export const RANK: Record<HurdleStatus, number> = { required: 0, likely: 1, info: 2, unchecked: 3 }

/** Stable within a rank: engine order among equals is meaningful (approvals come
 *  out roughly in sequence) and `sort` must not scramble it. Array.prototype.sort
 *  is spec-stable, and the index tiebreak makes that explicit rather than
 *  assumed. */
export function rankHurdles(hurdles: Hurdle[]): Hurdle[] {
  return hurdles
    .map((h, i) => ({ h, i }))
    .sort((a, b) => RANK[a.h.status] - RANK[b.h.status] || a.i - b.i)
    .map(({ h }) => h)
}
