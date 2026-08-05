// Philadelphia dimensional limits.
//
// Unlike the other curated zoning modules (denver/chicago/nyc/seattle), Philadelphia
// PUBLISHES max height and max FAR — in the ZoningCodeCharacteristics table
// (services.arcgis.com/fLeGjb7u4uXqeF9q/.../ZoningCodeCharacteristics/FeatureServer/0),
// keyed on ZoningDist. It covers 36 of 39 live base districts (missing RSA-6,
// RTA-2, SP-CIV).
//
// The catch: both columns are FREE TEXT authored for humans, not numbers. Observed
// forms include conditional limits ("60 if abutting a Residential district;
// otherwise no limit"), percentages against a different denominator ("70% of Lot
// Area" = lot coverage, not FAR), bonus tiers, and whole paragraphs of prose.
//
// These parsers therefore follow the same rule as src/lib/developability.ts: return
// a number ONLY when the value is unambiguous. Everything else degrades to null, so
// the engine reports "not in public data" instead of inventing a limit a user could
// rely on. Under-reporting a limit is recoverable; fabricating one is not.

/** Phrases that make a value conditional — the number doesn't apply universally. */
const CONDITIONAL = /\bif\b|\botherwise\b|\bvaries\b|\bbased on\b|\bdetermined by\b|\bexcept\b|\bunless\b|\bsubject to\b/i

/** A percentage measured against a denominator we cannot apply to ONE parcel.
 *
 *  ⚠️ CORRECTED 2026-08-05. This previously also rejected `of lot area`, on the
 *  reasoning that it measured "something other than lot floor area". It does
 *  not — **that IS the FAR expression**. Philadelphia's Zoning Quick Guide
 *  (PCPC, Feb 2026) labels the RM district diagrams literally
 *  "FAR = 70% of Lot Area", "= 150% of Lot Area", "= 350% of Lot Area", under a
 *  row headed "Max. Height / FAR (Floor Area Ratio)". Floor area as a percentage
 *  of lot area is the definition of a floor-area ratio.
 *
 *  The rejection silently discarded the published FAR for RM-2 (0.70), RM-3
 *  (1.50) and RM-4 (3.50) — Philadelphia's higher-density residential
 *  districts — sending them to defaultSpec's FAR-1.0 fallback instead. RM-2 was
 *  therefore published at an assumed 1.0 against a code figure of 0.70, a 43%
 *  overstatement, in the direction that flatters the site.
 *
 *  `district area` and `excluding streets` stay rejected and are NOT the same
 *  thing: RMX-1/RMX-2 measure across a whole district, which cannot be applied
 *  to a single parcel. `lot coverage` stays rejected — footprint, not floor area. */
const OTHER_DENOMINATOR = /of\s+district\s+area|excluding\s+streets|lot\s+coverage/i

function clean(raw: string | null | undefined): string | null {
  if (raw == null) return null
  // Collapse the \r\n runs the source uses for in-cell line breaks.
  const s = String(raw).replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (/^(n\/?a|none|tbd|-+)$/i.test(s)) return null
  return s
}

/**
 * Max building height in FEET from Philadelphia's MaxHeight text.
 * Returns null for conditional, "no limit", prose, or missing values.
 */
export function parseMaxHeightFt(raw: string | null | undefined): number | null {
  const s = clean(raw)
  if (!s) return null
  // "no limit" is real information, but the ParcelInfo contract only carries
  // number | null, and null ("not in public data") is the safe rendering — it
  // makes the height check indeterminate rather than asserting a false cap.
  if (/no\s+limit/i.test(s)) return null
  if (CONDITIONAL.test(s)) return null
  // Accept "38", "38 ft.", "38 ft", "45 feet" — a leading number optionally
  // followed by a feet unit and nothing else meaningful.
  const m = /^(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|')?\.?$/i.exec(s)
  if (!m) return null
  const ft = Number(m[1])
  // Guard against malformed rows: Philadelphia's tallest by-right districts are
  // well under 1,000 ft, and 0 is never a real limit.
  if (!Number.isFinite(ft) || ft <= 0 || ft > 1000) return null
  return ft
}

/**
 * Max floor-area ratio from Philadelphia's MaxFAR text, which expresses FAR as a
 * percentage (1200% = FAR 12.0). Returns null when the percentage is measured
 * against a different denominator, or when the value is prose/conditional.
 *
 * When a bonus tier follows the base ("1200%; 1600% for certain lots..."), the
 * BASE figure wins — the bonus is not by-right, and the engine must never quote a
 * larger envelope than a user can build without extra approvals.
 */
export function parseMaxFAR(raw: string | null | undefined): number | null {
  const s = clean(raw)
  if (!s) return null
  if (OTHER_DENOMINATOR.test(s)) return null
  // Take the FIRST percentage only when the string LEADS with it; a leading word
  // means the number is qualified by prose we haven't modelled.
  const m = /^(\d+(?:\.\d+)?)\s*%/.exec(s)
  if (!m) return null
  const far = Number(m[1]) / 100
  // Sanity bounds: Philadelphia's densest by-right district is CMX-5 at FAR 12
  // (16 with the Center City bonus). Anything at or above 100 is a data error.
  if (!Number.isFinite(far) || far <= 0 || far > 100) return null
  return far
}
