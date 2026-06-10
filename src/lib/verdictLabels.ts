import type { CheckStatus } from '../types/analysis'

// ---- Canonical verdict copy (WO-4.3) ----
// One source of truth for the four-status feasibility enum, consumed by the
// VerdictBanner, the Compare table, the Admin search log, and (for the
// per-dimension checklist) the FeasibilityChecklist. No route or component
// should define its own verdict strings — import from here instead.

/** Sentence the result page leads with, plus the supporting sub-line and the
 *  compact one-liner the Compare/Admin surfaces show. */
export interface VerdictLabel {
  /** Headline sentence on the result banner. */
  headline: string
  /** Supporting sub-line under the headline. */
  sub: string
  /** Compact one-liner for tables (Compare) and logs (Admin). */
  short: string
  /** Eyebrow / status word shown above the headline. */
  word: string
}

// "Verify with the city before acting on this." is appended to the banner
// sub-line for the two statuses where the verdict rests on heuristics the user
// should not act on blindly.
export const VERIFY_NOTE = 'Verify with the city before acting on this.'

export const VERDICT: Record<CheckStatus, VerdictLabel> = {
  AS_OF_RIGHT: {
    headline: 'You can likely build this.',
    sub: 'The proposal appears to fit the zoning here without needing special permission from the city.',
    short: 'Likely buildable',
    word: 'You can build it',
  },
  NEEDS_RELIEF: {
    headline: 'Buildable, with the city’s permission.',
    sub: `The proposal goes past at least one limit, so you’d have to ask the city to approve an exception first. ${VERIFY_NOTE}`,
    short: 'Needs city permission',
    word: 'Needs city permission',
  },
  PROHIBITED: {
    headline: 'This likely can’t be built as proposed.',
    sub: `The use or scale conflicts with the rules for this area in a way an exception is unlikely to fix. ${VERIFY_NOTE}`,
    short: 'Likely not allowed',
    word: 'Not allowed',
  },
  INDETERMINATE: {
    headline: 'We can’t tell from the public data.',
    sub: 'The records didn’t include the limits we’d need to judge one or more parts of this.',
    short: 'Can’t tell',
    word: 'Can’t tell',
  },
}

// Per-dimension checklist wording (FeasibilityChecklist). These describe the
// status of ONE limit (use / FAR / height / housing), not the overall verdict,
// so they keep their own terser vocabulary.
export const CHECKLIST_LABEL: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'Within limits',
  NEEDS_RELIEF: 'Over the limit',
  PROHIBITED: 'Conflict',
  INDETERMINATE: 'No data',
}
