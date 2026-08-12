// Required upstream reads — the state split between "the service did not
// answer" and "the service answered, and there is nothing here."
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// Every provider in this repo fans its upstream fetches out through
// `Promise.allSettled` and then reads each one with the idiom
//
//     const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
//
// That line is the defect. It maps TWO different facts onto one value:
//
//   · the service answered and no polygon covers this point   — an ANSWER
//   · the service did not answer at all                       — a GAP
//
// and `null` then becomes `districtCode: 'Unknown'`, which
// `assessDevelopability` reads as `developable: false, kind: 'no_coverage'` and
// renders as *"It may sit in a neighboring city or unincorporated area that
// isn't in the zoning data we cover yet"* — a geographic assertion about a
// parcel, manufactured out of a timeout. `analyze.ts` then zeroes cost,
// timeline and hurdles, so the same parcel clicked twice yields a full report
// and then a confident statement that we do not cover it.
//
// Measured in Phoenix 2026-08-11: 7 of 20 answered parcels in a live batch came
// back `Unknown` while the city's zoning layer was slow, and the same golden
// parcel returned `R1-6` on 81 of 81 isolated calls once the service recovered.
// Nothing about the parcel changed. That is CLAUDE.md rule 5's corollary — a
// failed fetch must never silently become a substantive answer — and rule 18's
// shape, because the failure produced a plausible-looking result rather than a
// null anybody would interrogate.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE CONTRACT
//
// A read is REQUIRED when a caller would otherwise publish its absence as a
// fact about the world. Ask: *if this fetch fails, does the response still make
// a claim that depends on it?* If yes, it is required.
//
//   · Phoenix zoning is required — its absence renders as "no zoning covers
//     this parcel", which is a claim.
//   · Phoenix's historic layer is optional — its absence renders as
//     `historicDistrict: null`, which the UI shows as nothing at all.
//
// Callers must obey three rules:
//
//   1. WRAP every required fetch in `readRequired`. The return type is a union
//      with no `.value` on the failure arm, so the compiler will not let you
//      read through it without deciding what a failure means.
//
//   2. REFUSE, do not degrade. The only legal handling of `ok: false` is to
//      return `upstreamUnavailable(...)`. Do not substitute a default, do not
//      fall through to a verdict. `if (!aR.ok || !bR.ok) return
//      upstreamUnavailable(city, label, [aR, bR], t0)` narrows every read in
//      the list for the rest of the function, which is why it is one line.
//
//   3. SHARE one deadline. Pass the same `deadline` to every read in a request
//      so the retries cannot stack past the platform's wall clock (Netlify
//      kills a function at 10 s). `requestDeadline()` makes one.
//
// An OPTIONAL read needs none of this and should keep using `Promise.allSettled`
// — the whole point is that the two categories now look different in the source.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE RETRY IS AND IS NOT
//
// The retry is a bounded, backed-off second and third chance at a transport
// that has already been observed to be intermittently slow. It is NOT the fix,
// and it must never be mistaken for one: a retry that exhausts still has to
// refuse. `scripts/null-inventory.ts` retries up to 3× on `districtCode ===
// 'Unknown'`, which is exactly why a ~20% Phoenix failure rate was invisible to
// it — retrying without splitting the state hides the defect instead of fixing
// it.
import type { ParcelError } from '../../../src/types/parcel'
import type { ParcelResult } from './arcgis'

/** The refusal arm of ParcelResult, for callers that return one directly. */
export type ParcelRefusal = Extract<ParcelResult, { ok: false }>

export interface RequiredFailure {
  ok: false
  /** Short label for the dataset, used in logs and in the user-facing copy. */
  layer: string
  /** How many attempts were actually made (>= 1). Pinned by tests. */
  attempts: number
  elapsedMs: number
  error: unknown
}

export type RequiredRead<T> = { ok: true; layer: string; value: T; attempts: number } | RequiredFailure

export interface RequiredReadOptions {
  /** Epoch-ms wall-clock deadline shared across the whole request. */
  deadline?: number
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number
  /** Per-attempt timeout ceiling. Default 3000 ms. */
  attemptCapMs?: number
  /** Backoff before retry n (0-indexed). Default [200, 600] ms. */
  backoffMs?: readonly number[]
}

/** Total wall-clock budget for the required reads of one request.
 *  Netlify kills a function at 10 s. 7 s leaves room for a serial second hop
 *  (an assessor join, a geocode) and still refuses cleanly inside the wall. */
export const REQUIRED_BUDGET_MS = 7000

/** Do not start an attempt that cannot plausibly finish. */
const MIN_USEFUL_MS = 400

const DEFAULT_ATTEMPT_CAP_MS = 3000
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = [200, 600] as const

/** One shared deadline for a request. Pass the result to every `readRequired`. */
export const requestDeadline = (budgetMs: number = REQUIRED_BUDGET_MS): number => Date.now() + budgetMs

/**
 * Run a required upstream read with bounded retries against a shared deadline.
 *
 * `attempt` receives the timeout it may use, so the fetch helper's own
 * AbortController is bounded by the same budget rather than by its default.
 *
 * NEVER REJECTS. The failure is a value, because a rejected promise is what the
 * `allSettled` idiom above turns into `null` in one careless ternary.
 */
export async function readRequired<T>(
  layer: string,
  attempt: (timeoutMs: number) => Promise<T>,
  opts: RequiredReadOptions = {},
): Promise<RequiredRead<T>> {
  const t0 = Date.now()
  const deadline = opts.deadline ?? t0 + REQUIRED_BUDGET_MS
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const attemptCapMs = opts.attemptCapMs ?? DEFAULT_ATTEMPT_CAP_MS
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS

  const remaining = () => deadline - Date.now()
  let lastError: unknown = new Error(`${layer}: no attempt was made`)
  // COUNTED, never reconstructed. An earlier draft recomputed the attempt count
  // from the same bounds the loop uses, which is a second implementation of the
  // loop that can disagree with it — rule 11's shape inside one function. The
  // number a test pins has to be the number that happened.
  let attempts = 0

  for (let n = 0; n < maxAttempts; n++) {
    if (n > 0) {
      const wait = backoffMs[Math.min(n - 1, backoffMs.length - 1)]
      // Stop rather than start an attempt the budget cannot pay for. Without
      // this the last attempt runs on a sub-100 ms timeout and fails for a
      // reason that has nothing to do with the upstream.
      if (remaining() < wait + MIN_USEFUL_MS) break
      await new Promise((r) => setTimeout(r, wait))
    }
    attempts++
    try {
      const value = await attempt(Math.min(attemptCapMs, Math.max(MIN_USEFUL_MS, remaining())))
      return { ok: true, layer, value, attempts }
    } catch (err) {
      lastError = err
    }
  }

  return { ok: false, layer, attempts, elapsedMs: Date.now() - t0, error: lastError }
}

const describeLayers = (layers: readonly string[]): string => {
  if (layers.length === 0) return 'data'
  if (layers.length === 1) return `${layers[0]} data`
  return `${layers.slice(0, -1).join(', ')} and ${layers[layers.length - 1]} data`
}

/**
 * The refusal a caller returns when a required read failed.
 *
 * ⚠️ THE COPY IS PART OF THE FIX, not decoration around it. Three things it must
 * do, each of which the old behaviour got wrong:
 *
 *   · say the SERVICE failed, not that the parcel is unusual;
 *   · say the answer is UNKNOWN — positively, as a statement about our state of
 *     knowledge, so nothing here can be read as a result;
 *   · leave the answer unknown. A refusal carries no lot size, no district, no
 *     cost and no timeline — `analyze.ts` returns this straight through as an
 *     AnalysisError, so no zeroed report can be built from it.
 *
 * ⚠️ AND IT MUST NOT NAME THE CLAIM IT REPLACES. The first draft read *"it does
 * not mean the site is outside our coverage, unzoned, or undevelopable"* — a
 * denial that restates the false sentence, which is CLAUDE.md rule 21 exactly,
 * and the guard test written for this copy rejected it. A reader skimming an
 * error box sees "outside our coverage" and takes it as the finding; so does any
 * scanner. Assert what is true (we don't know) instead of listing what is not.
 *
 * `UPSTREAM_ERROR` is reused rather than invented. It already exists on
 * `ParcelError['code']` and `AnalysisError['code']`, already carries HTTP 502,
 * and already renders as an error state with a retry button in both places the
 * user can see it (`ParcelPanelContent` → "Couldn't load parcel info." +
 * message + Retry; `BostonResult` → "Couldn't run the analysis." + message +
 * Try again). A parallel state would have to be taught to both.
 */
export function upstreamUnavailable(
  city: string,
  cityLabel: string,
  reads: readonly RequiredRead<unknown>[],
  startedAt: number,
): ParcelRefusal {
  const failures = reads.filter((r): r is RequiredFailure => !r.ok)
  const layers = failures.map((f) => f.layer)
  console.log({
    event: 'parcel.upstream_fail',
    city,
    durationMs: Date.now() - startedAt,
    layers,
    attempts: failures.map((f) => f.attempts),
    error: failures.map((f) => String(f.error).slice(0, 200)),
  })
  return {
    ok: false,
    code: 'UPSTREAM_ERROR' satisfies ParcelError['code'],
    message:
      `We couldn’t reach the ${cityLabel} ${describeLayers(layers)} service, so we don’t know anything about this parcel right now. ` +
      `This is an outage on the data provider’s side, not a result — we have no reading on this site either way. Try again in a moment.`,
    status: 502,
  }
}
