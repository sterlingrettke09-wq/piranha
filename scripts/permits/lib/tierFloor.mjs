// The per-tier publication floor, and the RECORD that makes every application of
// it visible in the committed artifact.
//
// ── Why this file exists ────────────────────────────────────────────────────
// Seven city scripts each had their own copy of
//
//     if (arr.length < 30) { console.warn(...); continue }
//
// which dropped a thin tier from `byTier` and left NO TRACE in
// permitStats.json. Reading the artifact you could not tell
//
//   · Denver — breakdown computed, `multi` withheld because its sample was
//     under the floor, so the city aggregate is a population that barely
//     contains the tier at all; from
//   · NYC / Philadelphia — no breakdown ever computed, an aggregate that
//     genuinely spans all three tiers and for which the aggregate IS the answer.
//
// Both rendered as "no byTier entry for this tier", and `measuredFor()` served
// the aggregate in both cases. For Denver that meant a duplex query was answered
// from a population of 3,505 single-family houses, 628 apartment buildings, the
// untiered residential rows and the whole commercial layer. That is evidence
// rule 5: a known absence and a missing lookup must not render the same.
//
// So the floor now lives in ONE place and it EMITS. Suppression cannot happen
// without producing `tierBreakdown.suppressed[tier]` with the n that was
// suppressed, because both come out of the same function call (rule 14 — convert
// a caught error into an impossible state, not a comment).
//
// Consumed by netlify/functions/lib/timeline.ts (`measuredFor` fails closed for
// a suppressed tier) and asserted by netlify/functions/lib/timeline.test.ts,
// which requires every city × tier in the artifact to be measured, covered by an
// unattempted breakdown, or explicitly marked suppressed.

/** A per-tier median under this many rows is not published. */
export const MIN_PUBLISHABLE_TIER_N = 30

/**
 * Apply the publication floor to a `{ tier: number[] }` map of durations.
 *
 * @param {Record<string, number[]>} byTier  tier -> raw duration samples
 * @param {(rows: number[]) => object} buildStats  turns a kept tier's rows into
 *        its `{ medianMonths, p80Months, n, vintage }` block (city-specific:
 *        each script owns its own quantile/vintage code)
 * @returns {{ tiers: object, tierBreakdown: object }} `tiers` goes to
 *        `byTier` in the artifact; `tierBreakdown` goes beside it and states
 *        that the breakdown was attempted plus every tier withheld and why.
 */
export function splitTiersAtFloor(byTier, buildStats) {
  const tiers = {}
  const suppressed = {}
  for (const [tier, rows] of Object.entries(byTier)) {
    if (rows.length < MIN_PUBLISHABLE_TIER_N) {
      // Emit, don't just warn. The console line is for the operator; the
      // `suppressed` entry is what survives into the artifact.
      console.warn(
        `  tier ${tier}: n=${rows.length} < ${MIN_PUBLISHABLE_TIER_N} — SUPPRESSED (recorded in ` +
          `tierBreakdown.suppressed.${tier}; measuredFor() will return undefined for it, NOT the aggregate)`,
      )
      suppressed[tier] = {
        n: rows.length,
        reason: `n=${rows.length} is below minPublishableN. The city aggregate is NOT a substitute: it is a different population.`,
      }
      continue
    }
    rows.sort((x, y) => x - y)
    tiers[tier] = buildStats(rows)
  }
  return {
    tiers,
    tierBreakdown: {
      attempted: true,
      minPublishableN: MIN_PUBLISHABLE_TIER_N,
      ...(Object.keys(suppressed).length ? { suppressed } : {}),
    },
  }
}

/**
 * The record for a city whose script computes NO tier split at all. Its
 * aggregate spans every tier, so serving the aggregate for any tier is the
 * disclosed, defensible answer — the opposite of a suppressed tier.
 *
 * @param {string} reason  what in this city's feed makes a tier split absent
 *        (not attempted / not possible). State the property of the query or
 *        schema, not a hope about the data.
 */
export function noTierBreakdown(reason) {
  return { attempted: false, reason }
}
