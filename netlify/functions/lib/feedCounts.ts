// The row counts a pipeline observed in its SOURCE FEED at extraction time.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// On 2026-08-09 the question "did the 2026-08-06 extract batch degrade the way
// NYC's had?" required knowing, per city, whether the feed had GROWN or SHRUNK
// since extraction. Exactly one script had recorded a feed row count at
// extraction time — `scripts/permits/nashville.mjs`, in a hand-written header
// COMMENT — and that single line is what made the question answerable in one
// pass. Every other city forced a re-derivation.
//
// That comment was a lucky survival, not a design. A comment is compared to
// nothing, goes stale silently, and — as nashville's does — can leave the reader
// unable to tell WHICH count it recorded. So the count lives here instead, in
// the artifact beside the vintage, where a future check can diff it
// automatically (rule 14: a structure beats a comment).
//
// ── The two counts, and why conflating them would make the record useless ────
// They answer different questions:
//
//   totals[].totalRows — every row the ENDPOINT holds, unfiltered. This is the
//     grew-vs-shrank number. It is comparable across time without knowing
//     anything about the script's filters, which is precisely what a future
//     investigator lacks.
//
//   cohortRows — rows surviving the script's own window and filters: the
//     population the published figure is drawn from. Close to the published `n`
//     but NOT equal — `n` is what remains after the per-row quality gates
//     (unparseable dates, negative durations, absurd outliers).
//
// A feed can grow while a cohort shrinks (a widened window, a tightened
// allowlist) and vice versa. One number cannot carry both readings.
//
// ── Optional by design; NEVER backfilled ────────────────────────────────────
// `feed` is optional on every entry, and an entry written before this
// instrumentation existed correctly has none. Those are NOT backfilled: a count
// taken today is not the count at that extract's vintage, and writing it as if
// it were is the provenance error this project keeps correcting. An unpopulated
// entry is valid and visibly unpopulated — the absence says "this run predates
// the instrumentation", which is true, rather than asserting a number that isn't.

/** One endpoint's unfiltered row count at extraction time. */
export interface FeedEndpointTotal {
  /** Which endpoint this counts. Stable enough to re-probe from: a resource id,
   *  a layer URL, or a table name. Scripts reading two feeds emit two entries
   *  (Denver's residential + commercial layers; Philadelphia's Carto permits
   *  table + the eCLIPSE application layer), because a sum across endpoints
   *  cannot be diffed against either of them. */
  endpoint: string
  /** Every row the endpoint holds with NO filter applied, or `null` when the
   *  count probe itself failed. Null is an UNKNOWN, never a guess, and never a
   *  zero — a failed probe must not silently become a substantive answer
   *  (rule 5). `unavailable` then says what went wrong. */
  totalRows: number | null
  /** Required whenever `totalRows` is null: why the probe produced no count. */
  unavailable?: string
}

/** Feed row counts recorded by a pipeline at extraction time. */
export interface FeedCounts {
  /** ISO date (UTC) the counts were observed — the same run that produced the
   *  sibling `vintage`. Present so a reader never has to infer the observation
   *  date from the vintage prose. */
  observedAt: string
  /** One entry per endpoint the script read. Never empty. */
  totals: FeedEndpointTotal[]
  /** Rows surviving the script's own window and filters. See the header. */
  cohortRows: number
  /** What the two counts mean FOR THIS SCRIPT, in words: which selector the
   *  cohort passed, and anything about the total a differ needs to know. The
   *  field names fix the question; this fixes the referent. */
  basis: string
}
