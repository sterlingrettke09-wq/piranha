// The coverage matrix — city × dimension, as a product surface.
//
// "Boston has no measured permit time" is one of three different facts about
// the world, and only one of them is about us. This module makes the
// distinction structural:
//
//   PRESENCE IS DERIVED. Whether a (city, dimension) cell is filled is read
//   from the same source of truth the engine reads — lifecycleMonths keys,
//   PARKING_RULES keys, CITIES_WITH_SPECIFIC_HURDLES, cityCostIndex keys,
//   permitStats.json, reliefStats.json — so a filled cell can never go stale.
//   Nothing here re-types a coverage claim.
//
//   ABSENCE REASONS ARE FACTS. They cannot be derived, so they are recorded,
//   one per empty cell, each with a code and a one-line reason a user can
//   read. Every reason below is sourced from the standing records in
//   src/config/cities.ts, src/config/estimates.ts, scripts/relief/README.md
//   and the artifacts' own vintage strings — not re-derived from memory.
//
// The drift guard (coverage.test.ts) asserts every (city, dimension) is either
// derived-present or carries exactly one reason — never both, never neither.
// Landing new data for a city therefore FORCES deleting its stale reason, and
// adding a city without accounting for all seven dimensions fails the suite.
//
//   A FILLED CELL IS NOT A UNIFORM CLAIM (added 2026-08-12). Presence being
//   derived stopped a cell claiming coverage the product does not have. It did
//   NOT stop a cell claiming coverage is uniform when it is not: `envelope` was
//   derived from `CITIES[].live`, which says the provider is wired and nothing
//   about how often it answers. Over the 575-parcel live sample, Denver
//   resolved an envelope for 2 of the 6 developable parcels it answered for and
//   Chicago for 11 of 11 — and the matrix drew the same dot for both. The
//   envelope cell now carries a measured RATE, read from
//   `envelopeSample.json` (see ./envelopeSample.ts). Derived like everything
//   else here, so re-running the sampler moves the matrix and nobody can type a
//   number into it.

import { CITIES, CITIES_WITH_SPECIFIC_HURDLES } from './cities'
import { PARKING_RULES } from './parkingRules'
import { lifecycleMonths, cityCostIndex } from './estimates'
import { envelopeSample, type EnvelopeSample } from './envelopeSample'
// The SAME committed artifacts the analysis functions and the Red Tape Index
// read. Imported, never transcribed.
import permitStatsJson from '../../netlify/functions/lib/data/permitStats.json'
import reliefStatsJson from '../../netlify/functions/lib/data/reliefStats.json'

const PERMIT_STATS = permitStatsJson as Record<
  string,
  | {
      newConstruction?: { medianMonths: number; p80Months: number; n: number }
      tierBreakdown?: { attempted: boolean; suppressed?: Record<string, unknown> }
    }
  | undefined
>
const RELIEF_STATS = reliefStatsJson as Record<
  string,
  { variance?: { grantRate: number; n: number } } | undefined
>

export const COVERAGE_DIMENSIONS = [
  'envelope',
  'parking',
  'hurdles',
  'cost',
  'lifecycle',
  'permits',
  'relief',
] as const
export type CoverageDimension = (typeof COVERAGE_DIMENSIONS)[number]

/** Column labels + what a filled cell means, rendered on /math. */
export const DIMENSION_LABELS: Record<CoverageDimension, { label: string; means: string }> = {
  envelope: {
    label: 'Zoning envelope',
    means:
      'live district lookup — use, FAR, height — from the city’s own GIS, shown as the share of sampled developable parcels for which it actually resolved',
  },
  parking: { label: 'Parking rule', means: 'the parking ordinance was read, and the rule is stated in the city’s own words' },
  hurdles: { label: 'City-specific hurdles', means: 'city-specific approvals encoded beyond the generic floor' },
  cost: { label: 'Cost index', means: 'RSMeans city cost index, matched by ZIP group' },
  lifecycle: { label: 'Lifecycle months', means: 'a city-specific design-to-move-in duration' },
  permits: { label: 'Measured permit timing', means: 'empirical filing→issuance months from the city’s own permit records' },
  relief: { label: 'Relief grant rate', means: 'empirical board grant rate from the city’s own decision records' },
}

/**
 * Why an empty cell is empty. Exactly four codes, because "we don't have it"
 * is one of four different facts:
 *   'not-published' — the jurisdiction does not publish what this needs.
 *   'withdrawn'     — we published, measured, and took it down.
 *   'not-built'     — closable; we have not done the work.
 *   'conservative'  — we hold data and refuse to publish it.
 */
export type AbsenceCode = 'not-published' | 'withdrawn' | 'not-built' | 'conservative'

export interface AbsenceReason {
  code: AbsenceCode
  /** One line a user can read. A claim, checked against the city it lands on. */
  reason: string
}

/**
 * PRESENCE, derived per dimension from the engine's own sources of truth.
 * No hand-maintained list of filled cells exists anywhere in this file.
 */
export function isCovered(slug: string, dim: CoverageDimension): boolean {
  switch (dim) {
    case 'envelope':
      // Live means wired: provider + zoning module + dispatcher. A city cannot
      // be flipped live without them (the dispatcher has no fallback path).
      return CITIES.some((c) => c.slug === slug && c.live)
    case 'parking':
      return slug in PARKING_RULES
    case 'hurdles':
      return (CITIES_WITH_SPECIFIC_HURDLES as readonly string[]).includes(slug)
    case 'cost':
      return slug in cityCostIndex
    case 'lifecycle':
      return slug in lifecycleMonths
    case 'permits':
      return PERMIT_STATS[slug]?.newConstruction != null
    case 'relief':
      return RELIEF_STATS[slug]?.variance != null
  }
}

/**
 * Tiers a city measured and then refused to publish, read from the artifact's
 * own `tierBreakdown.suppressed` record — Denver's multi (2–4 unit) tier today.
 * DERIVED, so publishing the tier deletes the marker in the same commit that
 * lands the data. Rendered as a caveat on an otherwise-filled permits cell.
 */
export function suppressedPermitTiers(slug: string): string[] {
  return Object.keys(PERMIT_STATS[slug]?.tierBreakdown?.suppressed ?? {})
}

// ─── The absence record ────────────────────────────────────────────────────
//
// Sources, per dimension:
//   hurdles   — the CITIES_WITH_SPECIFIC_HURDLES notes in cities.ts.
//   lifecycle — the lifecycleMonths gap note in estimates.ts (one collective
//               record covering all eight cities identically).
//   permits   — the CITIES_WITH_MEASURED_PERMITS notes in cities.ts, which
//               carry each withdrawal's measured disqualifier.
//   relief    — scripts/relief/README.md's 2026-08 survey record, plus its
//               "Surveyed 2026-08-10" addendum covering Charlotte, Columbus,
//               Milwaukee and Atlanta.
//
// The withdrawn reasons are deliberately NOT one flattened sentence: six
// cities were withdrawn for six different measured disqualifiers, and the
// difference is the finding.

const LIFECYCLE_NOT_BUILT: AbsenceReason = {
  code: 'not-built',
  reason:
    'No city-specific lifecycle duration has been established, and copying a peer city’s number was refused as an invented figure. Reports use the national fallback and say so; the Red Tape Index omits the city rather than rank it on a guess.',
}

const RELIEF_SURVEY_PDF_ONLY: AbsenceReason = {
  code: 'not-published',
  reason:
    'Board outcomes exist only as PDFs and meeting agendas — no outcome dataset (2026-08 survey, re-verified against the live endpoints).',
}

// San Diego, San Jose and Nashville were classified together and the survey
// record does not attribute which limb applies to which city, so the reason
// carries the disjunction rather than inventing a per-city split.
const RELIEF_SURVEY_NO_OUTCOME_FIELD: AbsenceReason = {
  code: 'not-published',
  reason:
    'A dataset exists but no usable outcome does: the status domain carries no granted/denied value, or the field sits on the wrong board (2026-08 survey).',
}

// Milwaukee and Atlanta were surveyed 2026-08-10 and came back FEASIBLE, not
// absent — the boards' outcomes exist and were sampled. What stopped them is
// OUR dependency decision, so the cell is 'not-built' ("nobody built this"),
// never 'not-published', which would blame the jurisdiction for our own call.
// Shared, because unlike the six permit withdrawals the disqualifier here is
// literally the same one: the declined Accela scraping dependency.
const RELIEF_SURVEYED_SCRAPE_DECLINED: AbsenceReason = {
  code: 'not-built',
  reason:
    'Surveyed 2026-08-10 and found feasible, not absent: the board’s decisions carry real outcomes, but only inside an Accela Citizen Access portal that would have to be scraped. That dependency was declined — a markup change there returns wrong rows silently instead of erroring — so this is known data nobody has built, not data the city withholds.',
}

const RELIEF_NEVER_SURVEYED_AUG9: AbsenceReason = {
  code: 'not-built',
  reason:
    'Never surveyed for relief outcomes — this city went live 2026-08-09, after the relief survey ran. A gap, not an answer.',
}

export const ABSENCE_REASONS: Partial<
  Record<string, Partial<Record<CoverageDimension, AbsenceReason>>>
> = {
  boston: {
    permits: {
      code: 'not-published',
      reason:
        'Boston publishes no permit application date — the schema has no slot for one — so filing→issuance cannot be computed from its data.',
    },
  },
  nyc: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published 2026-08-06, withdrawn 2026-08-09: only 63.65% of in-window New Building filings carry an issue date — enough to identify the median, not the published p80 of 17.0 months. Even the matured 2022 cohort fails it.',
    },
  },
  chicago: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published, withdrawn 2026-08-05: 46% of the sample came from a 2022–23 cohort in which 51.6% and 31.2% of records were stamped applied==issued — a backfill artifact that roughly halved the median (clean 2024–25 cohorts give 1.71 months, not 1.0).',
    },
    relief: {
      code: 'not-published',
      reason: 'ZBA outcomes exist only as monthly resolution PDFs; there is no dataset.',
    },
  },
  sf: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published, withdrawn 2026-08-06: only 37.7% of new-construction filings since 2022 carry an issue date at extract, so the unconditional median does not exist — the 50th percentile lies past the last observation.',
    },
  },
  seattle: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published 2026-08-06, withdrawn 2026-08-09: the pipeline’s issued-only predicate hid 25.29% of filings, and the observed 74.71% share does not identify the published p80 of 10.0 months.',
    },
    relief: {
      code: 'not-published',
      reason:
        'The published dataset carries a decision date, but its status domain has no granted/denied value — outcomes live in Notice-of-Decision and Hearing Examiner PDFs.',
    },
  },
  dc: {
    permits: {
      code: 'not-published',
      reason:
        'DC publishes no true application date: CREATED_DATE is an ETL stamp, identical on every row, and no other intake field exists.',
    },
  },
  austin: {
    relief: {
      code: 'not-published',
      reason:
        'The board-of-adjustment table has outcomes but no sound time axis: status_date maxes out at 2019-06-20 across the whole table, with 2026 cases carrying 2019 stamps.',
    },
  },
  la: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published, withdrawn 2026-08-05: 45.4% of submitted filings carry no issue date, and only 64.1% of the matured 2022 cohort does — so the published p80 of 13.0 months lay beyond the observed range, a statistic that does not exist.',
    },
    relief: RELIEF_SURVEY_PDF_ONLY,
  },
  denver: {
    relief: RELIEF_SURVEY_PDF_ONLY,
  },
  minneapolis: {
    permits: {
      code: 'not-published',
      reason:
        'Minneapolis publishes no application date: completeDate lands after issueDate in 409 of 409 sampled records, so no intake stamp exists to measure from.',
    },
    relief: RELIEF_SURVEY_PDF_ONLY,
  },
  philadelphia: {
    relief: {
      code: 'not-published',
      reason:
        'The appeals table has the right schema, but its values have degraded to “Complete” — only ~3% of 2022+ rows carry a real disposition, and that 3% is not a random sample.',
    },
  },
  miami: {
    relief: RELIEF_SURVEY_PDF_ONLY,
  },
  sandiego: {
    permits: {
      code: 'withdrawn',
      reason:
        'Published, withdrawn 2026-08-05: the start stamp records when a permit was added to the permit system (median 14 days after intake, p90 181 days), so the published figure was never filing→permit.',
    },
    relief: RELIEF_SURVEY_NO_OUTCOME_FIELD,
  },
  sanjose: {
    permits: {
      code: 'not-published',
      reason:
        'San Jose publishes no application date: FINALDATE is the final-inspection date, and the schema has no intake slot.',
    },
    relief: RELIEF_SURVEY_NO_OUTCOME_FIELD,
  },
  nashville: {
    relief: RELIEF_SURVEY_NO_OUTCOME_FIELD,
  },
  raleigh: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    relief: RELIEF_SURVEY_PDF_ONLY,
  },
  milwaukee: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'conservative',
      reason:
        'Milwaukee’s residential pair measures cleanly, but the city files all 5+-unit multifamily as commercial permits whose use column is free text, so the apartment stratum cannot be enumerated; the sound residential pair stays unpublished pending a live re-run and a product decision.',
    },
    relief: RELIEF_SURVEYED_SCRAPE_DECLINED,
  },
  columbus: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'not-published',
      reason:
        'Columbus’s permits layer carries exactly two date fields — ISSUED_DT and a status stamp — and no intake date.',
    },
    relief: {
      code: 'not-published',
      reason:
        'Columbus publishes its Board of Zoning Adjustment variances as a map layer whose only status values are “passed” and “proposed” — 3,084 rows, with two sibling layers agreeing independently. Denied cases are absent rows rather than denied rows (8–32% of each year’s sequential case numbers never appear), so a computed grant rate would read 100% by construction.',
    },
  },
  charlotte: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'not-published',
      reason:
        'Charlotte publishes no building-permit dataset at all — established by enumerating the portal’s full 300-dataset catalogue, not by a failed guess.',
    },
    // relief: DERIVED-PRESENT since 2026-08-10 (reliefStats.json carries
    // charlotte.variance, 92.3% / n=155). Its stale 'not-built' reason was
    // deleted here in the same change; the drift guard is what forced it.
  },
  atlanta: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'not-published',
      reason:
        'Atlanta publishes an application date and no issue date: StatusDate equals issuance only for the 37.4% of permits still sitting at “Issued” — a survivorship-biased third, which is structural, not closable.',
    },
    relief: RELIEF_SURVEYED_SCRAPE_DECLINED,
  },
  dallas: {
    // hurdles: DERIVED-PRESENT since 2026-08-10. Chapter 51A was read and the
    // branch encoded, so the cell fills from CITIES_WITH_SPECIFIC_HURDLES and
    // carrying a reason here would be both — which the drift guard rejects.
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'conservative',
      reason:
        'The only feed with both dates is a frozen snapshot of the retired Posse system: 73.44% of gated 2022+ filings carry an issue date (apartment tier 47.76%), which identifies the median but not the published p80 — and the feed can never mature. The pipeline computes the figures and refuses to write them.',
    },
    relief: RELIEF_NEVER_SURVEYED_AUG9,
  },
  lasvegas: {
    // hurdles: DERIVED-PRESENT since 2026-08-10. Titles 19, 4, 14 and 20 were
    // read and the branch encoded, so the cell fills from
    // CITIES_WITH_SPECIFIC_HURDLES and carrying a reason here would be both —
    // which the drift guard rejects.
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'not-published',
      reason:
        'The open-data permits feed has no slot for an application date — ISSDTTM is the schema’s only date field — and the one internal layer carrying both dates measured unusable (~11.6× row duplication, misaligned columns).',
    },
    relief: RELIEF_NEVER_SURVEYED_AUG9,
  },
  phoenix: {
    lifecycle: LIFECYCLE_NOT_BUILT,
    permits: {
      code: 'not-published',
      reason:
        'Phoenix publishes no per-permit dataset at all: the portal’s sole building-permit package is annual counts (a HUD SOCDS export) — no dates, no rows. Established by enumerating the full 160-package catalogue.',
    },
    relief: RELIEF_NEVER_SURVEYED_AUG9,
  },
}

export type CoverageCell =
  | {
      covered: true
      suppressedTiers: string[]
      /**
       * How often a covered cell actually delivers, where that has been
       * measured. Present on `envelope` and null everywhere else.
       *
       * WHY A QUALIFIER AND NOT A REASON CODE. Denver's envelope IS wired —
       * provider, zoning module, dispatcher — and it resolves; it just resolves
       * for a third of the parcels sampled. An absence reason would claim the
       * cell is empty, which is false, and the drift guard would then demand
       * the reason be deleted the moment the cell is derived-present, which it
       * permanently is. A qualifier keeps the guard's XOR intact and still
       * stops a 33% city rendering identically to a 100% one — the thing the
       * matrix got wrong.
       *
       * DERIVED, not hand-entered: it is read from the committed 575-parcel
       * measurement, so it cannot be typed in and cannot go stale by being
       * forgotten. Re-running the sampler changes the matrix.
       */
      sample: EnvelopeSample | null
    }
  | ({ covered: false } & AbsenceReason)

/**
 * The one entry point the page renders from. Throws on a cell that is neither
 * derived-present nor explained — the same invariant the test enforces — so a
 * violation cannot render as a quietly blank cell.
 */
export function coverageCell(slug: string, dim: CoverageDimension): CoverageCell {
  const covered = isCovered(slug, dim)
  const reason = ABSENCE_REASONS[slug]?.[dim]
  if (covered && reason) {
    throw new Error(`${slug}/${dim} is derived-present but still carries a stale absence reason`)
  }
  if (covered) {
    return {
      covered: true,
      suppressedTiers: dim === 'permits' ? suppressedPermitTiers(slug) : [],
      sample: dim === 'envelope' ? envelopeSample(slug) : null,
    }
  }
  if (!reason) {
    throw new Error(`${slug}/${dim} is absent with no recorded reason`)
  }
  return { covered: false, ...reason }
}

/** Legend copy for the four codes, rendered verbatim on /math. */
export const ABSENCE_CODE_LEGEND: Record<AbsenceCode, { label: string; means: string }> = {
  'not-published': {
    label: 'Not published',
    means: 'the city does not publish the data this needs — a fact about the jurisdiction, not about us.',
  },
  withdrawn: {
    label: 'Withdrawn',
    means: 'we published a figure, measured a disqualifier, and took it down. The reason states what was measured.',
  },
  'not-built': {
    label: 'Not built',
    means: 'closable — the data or research plausibly exists and we have not done the work.',
  },
  conservative: {
    label: 'Held back',
    means: 'we hold measured data and refuse to publish it, because the part a user would rely on is not statistically sound.',
  },
}
