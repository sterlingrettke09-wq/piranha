// WHICH SOURCES ARE STABLE ENOUGH TO DIFF — the precondition for any alert.
//
// ── WHY THIS GATES THE ALERT LAYER ──────────────────────────────────────────
//
// A diff is only meaningful if a re-run is reproducible, and reproducibility is
// a property of the SOURCE, not of the system. Two measurements in this repo
// settle that it varies:
//
//   NYC permits (Socrata w9ak-ipjd)  4,394 → 1,040 → 8,103 across three extracts
//                                    of one unchanged query. Non-monotonic, both
//                                    directions, an order of magnitude. A
//                                    server-side count(*) matched the rows the
//                                    fetch returned, so it is not paging — the
//                                    population moved upstream.
//   Austin permits, same script      11,534 → 11,650 over twelve days: +1.0%,
//                                    monotonic, medians unmoved.
//
// So the instability is a property of one feed, not of Socrata, and an alert
// built on the first would fire on noise while an alert built on the second
// would not. Nothing here may alert on a source until it has been observed
// holding still.
//
// ── THE EXPECTED DIRECTION IS DECLARED BEFORE THE MEASUREMENT ───────────────
//
// This is the half that gives the test power, and it is taken straight from the
// Austin/NYC comparison: a fixed `applied >= 2022-01-01` window over an
// append-mostly feed CAN ONLY GROW, so growth confirms and any decrease refutes.
// Without that prior, +1.0% and −76% are both merely "different" and the check
// decides nothing. Every source below therefore declares what it should do
// before it is asked what it did.
//
// ── AND WHY THE DEFAULT IS `insufficient`, NOT `stable` ─────────────────────
//
// One observation is not evidence (rule 10) and two observations are one
// interval. A register that started every source at `stable` and demoted on
// failure would green-light the entire alert layer on the day it was written,
// which is rule 20 exactly: an empty result and a clean result must not render
// the same. Sources are `insufficient` until observed otherwise, and the alert
// layer must refuse them.

export type SourceKind = 'zoning-roster' | 'permit-feed' | 'parcel-fabric'

export interface SourceExpectation {
  id: string
  kind: SourceKind
  /** What the population should do between observations if the feed is healthy.
   *  Declared here, ahead of any measurement, so a result cannot be explained
   *  after the fact. */
  expected: 'append-mostly' | 'near-static'
  /** Why that is the expectation. A prior with no stated reason is a guess. */
  why: string
}

export interface Observation {
  /** ISO date. */
  on: string
  /** The population size at that date — rows, codes, features. */
  n: number
  /** Where this observation came from, so a reader can re-derive it. */
  from: string
  /** Identities added and removed since the previous observation, where the
   *  observation carries identities and not merely a count. A count alone cannot
   *  distinguish "one added, one removed" from "nothing happened". */
  added?: string[]
  removed?: string[]
}

export type StabilityClass =
  /** Observed holding still across at least one interval, in the declared
   *  direction. Diffable. */
  | 'stable'
  /** Observed NOT reproducing. Never diffable — an alert here fires on noise. */
  | 'unstable'
  /** Fewer than two observations, so nothing has been established either way.
   *  THE DEFAULT, and not a soft version of `stable`. */
  | 'insufficient'

/** ⚠️ WHAT AN INTERVAL CAN AND CANNOT DETECT, stated on every verdict.
 *
 *  A near-static source passing over two days is close to vacuous on its own —
 *  a zoning roster barely moves in two days whether the feed is sound or quietly
 *  serving a cached snapshot. What that interval CAN do is bounded and worth
 *  saying: NYC's feed moved by an order of magnitude in three days, so a two-day
 *  window would have caught NYC-class instability and nothing slower.
 *
 *  So `stable` over a short span means "not wobbling violently", never "safe to
 *  alert on indefinitely", and the difference is carried in the verdict rather
 *  than left for a reader to infer from `spanDays`. */
export type Evidence =
  /** Long enough only to catch the failure mode already observed here:
   *  order-of-magnitude movement within days. */
  | 'weak-short-interval'
  /** Spans enough time that slow drift would have shown up too. */
  | 'adequate'

/** Twelve days is the Austin interval — the one span in this repo over which a
 *  feed was watched and found to move by a stated, expected amount. It is used
 *  as the bar because it is a measurement, not a round number. */
export const ADEQUATE_SPAN_DAYS = 12

export interface Verdict {
  id: string
  klass: StabilityClass
  evidence: Evidence
  observations: number
  /** Days between first and last observation. One interval over two days says
   *  much less than one over twelve, and the number is reported rather than
   *  folded into the class. */
  spanDays: number
  detail: string
}

/** How much a near-static source may move between observations before it stops
 *  counting as holding still. Deliberately tight: a zoning roster gains a code
 *  when a rezoning is adopted, which is a handful a year, not a percentage. */
export const NEAR_STATIC_TOLERANCE = 0.01

export function classify(exp: SourceExpectation, obs: Observation[]): Verdict {
  const sorted = [...obs].sort((a, b) => a.on.localeCompare(b.on))
  const spanDays =
    sorted.length < 2
      ? 0
      : Math.round(
          (Date.parse(sorted[sorted.length - 1].on) - Date.parse(sorted[0].on)) / 86_400_000,
        )

  const evidence: Evidence = spanDays >= ADEQUATE_SPAN_DAYS ? 'adequate' : 'weak-short-interval'

  if (sorted.length < 2) {
    return {
      id: exp.id,
      klass: 'insufficient',
      evidence,
      observations: sorted.length,
      spanDays,
      detail:
        sorted.length === 0
          ? 'never observed'
          : 'observed once — one probe is not evidence, and a second is needed before anything may diff this',
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const delta = cur.n - prev.n
    const rel = prev.n === 0 ? 0 : Math.abs(delta) / prev.n

    if (exp.expected === 'append-mostly' && delta < 0) {
      // Direction, not magnitude. A population under a fixed lower bound cannot
      // shrink by acquiring new data, so ANY decrease refutes — this is what
      // caught NYC while +1.0% confirmed Austin.
      return {
        id: exp.id,
        klass: 'unstable',
        evidence,
        observations: sorted.length,
        spanDays,
        detail: `append-mostly source SHRANK ${prev.n} → ${cur.n} between ${prev.on} and ${cur.on}; a fixed window cannot lose rows by gaining data`,
      }
    }
    if (exp.expected === 'near-static' && rel > NEAR_STATIC_TOLERANCE) {
      return {
        id: exp.id,
        klass: 'unstable',
        evidence,
        observations: sorted.length,
        spanDays,
        detail: `near-static source moved ${prev.n} → ${cur.n} (${(100 * rel).toFixed(1)}%) between ${prev.on} and ${cur.on}`,
      }
    }
  }

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const churn = sorted
    .slice(1)
    .reduce((a, o) => a + (o.added?.length ?? 0) + (o.removed?.length ?? 0), 0)
  return {
    id: exp.id,
    klass: 'stable',
    evidence,
    observations: sorted.length,
    spanDays,
    detail: `${first.n} → ${last.n} over ${spanDays} day(s), ${sorted.length} observations, ${churn} identity change(s)`,
  }
}

/** The only function the alert layer should call. Refuses anything not observed
 *  stable — including, and especially, sources nobody has looked at twice.
 *
 *  `evidence` is deliberately NOT part of this test. A short interval is a real
 *  limit on what has been shown, but refusing every source until twelve days
 *  have passed would mean the register could never let anything through on the
 *  day it was written, and the honest response to weak evidence is to say so
 *  loudly and re-observe — not to encode a wait as a permanent refusal. Callers
 *  that want the stronger bar can read `evidence` themselves. */
export function diffable(v: Verdict): boolean {
  return v.klass === 'stable'
}
