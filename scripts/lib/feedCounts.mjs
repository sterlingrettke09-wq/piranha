// Feed row-count instrumentation, shared by scripts/permits/*.mjs and
// scripts/relief/*.mjs.
//
// Every extraction script records, at extraction time, the row count of the feed
// it read. The full rationale — and the definition of the two counts — lives with
// the type in netlify/functions/lib/feedCounts.ts, which is the schema this
// module emits. Read that first; this file is the mechanism.
//
// ── Three rules this module encodes as STRUCTURE ────────────────────────────
//
// 1. YOU CANNOT RECORD ONE COUNT WITHOUT THE OTHER. `feedCounts()` requires both
//    `totals` and `cohortRows`. A record carrying only "12,345 rows" — the shape
//    nashville.mjs's header comment has, where the reader cannot tell whether it
//    is the whole layer or the script's own pull — is not constructible here.
//
// 2. A FAILED PROBE IS A NULL WITH A REASON, NEVER A NUMBER. `probeFeedTotal()`
//    catches everything and returns `{ totalRows: null, unavailable }`. It never
//    returns 0 on failure and never lets a count failure abort a run that would
//    otherwise have produced a legitimate figure: the instrumentation must not
//    be able to break the pipeline it instruments (rule 5, and its corollary
//    that a failed fetch must not silently become a substantive answer).
//
// 3. THE PROBE USES THE SCRIPT'S OWN CLIENT. `probeFeedTotal` takes a callback
//    rather than doing its own fetching, so the count comes back through the
//    same transport, error handling and auth as the rows themselves. A count
//    fetched by a private helper would measure the helper (rule 11 — measure the
//    pipeline, not your probe).
//
// ── Halt paths ──────────────────────────────────────────────────────────────
// Several scripts refuse to write by design (sf, chicago, la, nyc, seattle,
// milwaukee, boston, dc, minneapolis, dallas). The feed count is exactly what a
// future investigator wants FROM a script that refuses — "was there nothing to
// find, or has the feed changed?" — so `logFeedTotals()` is called as soon as the
// totals are probed, upstream of every gate, and the line is emitted whether the
// run goes on to write, to warn, or to throw.
//
// Log lines carry a fixed prefix so a run log can be grepped years later.

/** Fixed prefix on every line this module prints. Grep target; do not change. */
export const FEED_LOG_PREFIX = '[feed-count]'

/** Today, UTC, as YYYY-MM-DD. */
export function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isCount = (v) => Number.isInteger(v) && v >= 0

/**
 * Run a count probe for one endpoint, best-effort.
 *
 * @param {string} endpoint  what is being counted — a resource id, layer URL or
 *        table name, stable enough that a future check can re-probe it.
 * @param {() => Promise<unknown>} probe  performs the count using the CALLING
 *        SCRIPT'S OWN client, and returns the row count.
 * @returns {Promise<{endpoint: string, totalRows: number|null, unavailable?: string}>}
 */
export async function probeFeedTotal(endpoint, probe) {
  if (!isNonEmptyString(endpoint)) {
    throw new Error('probeFeedTotal: `endpoint` must be a non-empty string naming what is counted.')
  }
  let raw
  try {
    raw = await probe()
  } catch (err) {
    return {
      endpoint,
      totalRows: null,
      unavailable: `count probe threw: ${err?.message ?? String(err)}`,
    }
  }
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (!isCount(n)) {
    // Not a count. Recorded as an unknown rather than coerced — a coerced 0 would
    // read as "the feed emptied", which is a finding, not a gap.
    return {
      endpoint,
      totalRows: null,
      unavailable: `count probe returned ${JSON.stringify(raw)}, which is not a row count`,
    }
  }
  return { endpoint, totalRows: n }
}

/**
 * Print the feed totals. Call this the moment they are probed — BEFORE any gate,
 * halt or write — so a refusing run still records them.
 *
 * @param {Array<{endpoint: string, totalRows: number|null, unavailable?: string}>} totals
 */
export function logFeedTotals(totals) {
  for (const t of totals ?? []) {
    if (t.totalRows == null) {
      console.warn(`  ${FEED_LOG_PREFIX} ${t.endpoint}: feed total UNAVAILABLE — ${t.unavailable}`)
    } else {
      console.log(`  ${FEED_LOG_PREFIX} ${t.endpoint}: ${t.totalRows} rows in the whole feed`)
    }
  }
}

/**
 * Print the cohort count. Scripts that halt before writing call this at the point
 * the cohort is known, so the halt path records both counts rather than one.
 *
 * @param {number} cohortRows rows passing the script's own window and filters
 * @param {string} what a short description of that selector
 */
export function logCohortRows(cohortRows, what) {
  console.log(`  ${FEED_LOG_PREFIX} cohort: ${cohortRows} rows (${what})`)
}

/**
 * THE ONE DEFINITION OF A VALID `feed` BLOCK. Throws with the specific failure.
 *
 * Exported so the artifact itself can be checked against the same rules the
 * writer enforces, rather than against a second copy of them that can drift —
 * netlify/functions/lib/*.test.ts runs this over every `feed` block committed in
 * permitStats.json and reliefStats.json.
 *
 * @param {unknown} record the candidate block
 * @param {string} [where] context for the error message, e.g. `permitStats.austin`
 */
export function assertFeedCounts(record, where = 'feed') {
  if (record == null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${where}: expected an object; got ${JSON.stringify(record)}`)
  }
  const { totals, cohortRows, basis, observedAt } = record
  if (!Array.isArray(totals) || totals.length === 0) {
    throw new Error(
      `${where}.totals must be a non-empty array — one entry per endpoint the script read. ` +
        'A script that read two feeds records two entries; a sum across endpoints cannot be ' +
        'diffed against either of them.',
    )
  }
  const seen = new Set()
  for (const t of totals) {
    if (!t || typeof t !== 'object' || !isNonEmptyString(t.endpoint)) {
      throw new Error(`${where}.totals: every entry needs a non-empty \`endpoint\`; got ${JSON.stringify(t)}`)
    }
    if (seen.has(t.endpoint)) {
      throw new Error(
        `${where}.totals: duplicate endpoint ${JSON.stringify(t.endpoint)} — two entries for one ` +
          'endpoint make the diff ambiguous.',
      )
    }
    seen.add(t.endpoint)
    if (t.totalRows === null) {
      if (!isNonEmptyString(t.unavailable)) {
        throw new Error(
          `${where}.totals: ${t.endpoint} has totalRows: null with no \`unavailable\` reason. A ` +
            'missing count must say why it is missing, or it is indistinguishable from a lookup ' +
            'nobody ran.',
        )
      }
    } else if (!isCount(t.totalRows)) {
      throw new Error(
        `${where}.totals: ${t.endpoint} totalRows must be a non-negative integer or null; got ` +
          `${JSON.stringify(t.totalRows)}`,
      )
    }
  }
  if (!isCount(cohortRows)) {
    throw new Error(
      `${where}.cohortRows must be a non-negative integer; got ${JSON.stringify(cohortRows)}. ` +
        'It is required alongside the feed total: recording one without the other produces a ' +
        'number whose referent a future reader cannot recover.',
    )
  }
  if (!isNonEmptyString(basis)) {
    throw new Error(
      `${where}.basis must say what the two counts mean for this script — which selector the ` +
        'cohort passed, and anything about the total a differ needs to know.',
    )
  }
  if (typeof observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) {
    throw new Error(`${where}.observedAt must be YYYY-MM-DD; got ${JSON.stringify(observedAt)}`)
  }
}

/**
 * Build the `feed` block written into permitStats.json / reliefStats.json.
 *
 * THROWS on a malformed record. It runs on the write path, so a throw here stops
 * a bad shape from reaching the artifact — and every argument is a literal in the
 * calling script, so a throw is a programming error surfaced on the first run
 * rather than a live-data condition.
 *
 * @param {object} args
 * @param {Array<{endpoint: string, totalRows: number|null, unavailable?: string}>} args.totals
 *        one entry per endpoint read; from `probeFeedTotal`.
 * @param {number} args.cohortRows rows passing this script's window and filters.
 * @param {string} args.basis what the two counts mean for this script.
 * @param {string} [args.observedAt] ISO date; defaults to today (UTC).
 * @returns {{observedAt: string, totals: object[], cohortRows: number, basis: string}}
 */
export function feedCounts({ totals, cohortRows, basis, observedAt = todayStamp() }) {
  assertFeedCounts({ totals, cohortRows, basis, observedAt }, 'feedCounts')

  const record = {
    observedAt,
    totals: totals.map((t) =>
      t.totalRows === null
        ? { endpoint: t.endpoint, totalRows: null, unavailable: t.unavailable }
        : { endpoint: t.endpoint, totalRows: t.totalRows },
    ),
    cohortRows,
    basis: basis.trim(),
  }
  logCohortRows(cohortRows, 'window + filters, recorded in the artifact')
  return record
}
