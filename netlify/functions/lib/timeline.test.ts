import { describe, it, expect } from 'vitest'
import {
  resolveTimeline, buildingTier, measuredFor, measuredTierWithheldFor,
  entitlementFor, ENTITLEMENT_MEASURED_CITIES, ENTITLEMENT_WITHHELD_CITIES,
} from './timeline'
import type { Feasibility } from './feasibility'
import type { AnalysisInput } from '../../../src/types/analysis'
import { CITIES_WITH_MEASURED_PERMITS, hasMeasuredPermitTiming } from '../../../src/config/cities'
// @ts-expect-error — plain .mjs, no types. Imported from the WRITER on purpose:
// the artifact is checked against the same definition the extraction scripts
// enforce, not a second copy of it that can drift.
import { assertFeedCounts } from '../../../scripts/lib/feedCounts.mjs'

const project = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  city: 'boston',
  projectType: 'new',
  funding: 'private',
  parcelId: 'T1',
  lat: 42.34,
  lng: -71.07,
  use: 'commercial',
  gfa: 15_000,
  ...over,
})

// A real Feasibility, not `{ path } as Feasibility`. The cast was what let the
// nonexistent path 'by-right' sit at 19 call sites: `as` suppresses the shape
// check, and nothing typechecked this file to catch the argument itself.
// `overall` mirrors feasibility.ts's own path derivation, inverted.
const feas = (path: Feasibility['path']): Feasibility => ({
  overall: path === 'prohibited' ? 'PROHIBITED' : path === 'variance' ? 'NEEDS_RELIEF' : 'AS_OF_RIGHT',
  checks: [],
  path,
})

describe('buildingTier', () => {
  it('commercial and institutional are always apartment-tier', () => {
    expect(buildingTier(project({ use: 'commercial' }))).toBe('apartment')
    expect(buildingTier(project({ use: 'institutional' }))).toBe('apartment')
  })
  it('residential tiers by unit count; mixed defaults to multi', () => {
    expect(buildingTier(project({ use: 'residential', units: 1 }))).toBe('single')
    expect(buildingTier(project({ use: 'residential', units: 3 }))).toBe('multi')
    expect(buildingTier(project({ use: 'residential', units: 6 }))).toBe('apartment')
    expect(buildingTier(project({ use: 'mixed' }))).toBe('multi') // units default 3
  })
})

describe('resolveTimeline', () => {
  it('prohibited path → 0 months', () => {
    const t = resolveTimeline('boston', project(), feas('prohibited'), false)
    expect(t.months).toBe(0)
  })

  it('Boston apartment-tier new build on a cleared lot = the lifecycle baseline (44)', () => {
    const t = resolveTimeline('boston', project(), feas('as_of_right'), false)
    expect(t.months).toBe(44)
    expect(t.includesDemolition).toBe(false)
  })

  it('a teardown adds the per-city demolition phase (+3 in Boston)', () => {
    const t = resolveTimeline('boston', project(), feas('as_of_right'), true)
    expect(t.months).toBe(47)
    expect(t.includesDemolition).toBe(true)
  })

  it('large teardowns add scaled months above 50k sf', () => {
    // (150,000 − 50,000) / 100,000 × 3 = 3 extra
    const t = resolveTimeline('boston', project(), feas('as_of_right'), true, 150_000)
    expect(t.months).toBe(50)
  })

  it('the large-teardown adder caps at 18 months', () => {
    const t = resolveTimeline('boston', project(), feas('as_of_right'), true, 1_000_000)
    expect(t.months).toBe(44 + 3 + 18)
  })

  it('demolition months are NOT added for addition/renovation projects', () => {
    const t = resolveTimeline('boston', project({ projectType: 'addition', use: 'residential', units: 3 }), feas('as_of_right'), true)
    // boston multi 28 × 0.65 = 18.2 → 18; hasExistingBuilding true but projectType ≠ new
    expect(t.months).toBe(18)
    expect(t.includesDemolition).toBe(false)
  })

  it('unknown city falls back to the generic lifecycle table', () => {
    const t = resolveTimeline('atlantis', project(), feas('as_of_right'), false)
    expect(t.months).toBe(40) // fallback apartment tier
  })

  it('discretionary/variance time is NOT added here (analyze.ts owns it)', () => {
    const byRight = resolveTimeline('boston', project(), feas('as_of_right'), false)
    const variance = resolveTimeline('boston', project(), feas('variance'), false)
    expect(variance.months).toBe(byRight.months)
    expect(variance.path).toBe('variance')
  })
})

describe('measured permit timing', () => {
  // Six cities carry real data from their open portals (see scripts/permits) —
  // SF and Seattle, the two this comment used to name, have both since been
  // withdrawn. Assert SHAPE, not exact numbers — the figures refresh quarterly
  // and the test must survive a re-run of the pipeline.
  const expectMeasuredShape = (m: unknown) => {
    expect(m).toBeDefined()
    const v = m as { medianMonths: number; p80Months: number; n: number; vintage: string }
    expect(typeof v.medianMonths).toBe('number')
    expect(typeof v.p80Months).toBe('number')
    expect(v.p80Months).toBeGreaterThanOrEqual(v.medianMonths)
    expect(v.n).toBeGreaterThanOrEqual(30)
    expect(typeof v.vintage).toBe('string')
    expect(v.vintage.length).toBeGreaterThan(0)
  }

  it('a city present in permitStats → measured is populated for a new build', () => {
    const t = resolveTimeline('miami', project({ city: 'miami' }), feas('as_of_right'), false)
    expectMeasuredShape(t.measured)
  })

  // ⚠️ SF WITHDRAWN 2026-08-06 — only 37.7% of its new-construction filings carry
  // an issue date at extract, so an unconditional median time-to-issuance does not
  // exist: the 50th percentile is past the last observation. A floor label cannot
  // rescue an undefined statistic. Asserted so it cannot be reinstated by a stale
  // script. State the SHARE, not the FATE — the feed does not distinguish a
  // not-yet from a never, so "ever issue" is retracted phrasing (2026-08-08), and
  // the median is undefined under either reading.
  it('SF resolves to no measurement — most of its filings carry no issue date', () => {
    const t = resolveTimeline('sf', project({ city: 'sf' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
  })

  // ⚠️ SEATTLE WITHDRAWN 2026-08-09, hours after NYC, after shipping 5.7 mo /
  // p80 10.0 / n=4,996 from 2026-08-06. Measured 2026-08-09 by the
  // outcome-selection guard's own exemption rule (a known-defect exemption must
  // carry a measured share): seattle.mjs's cohort filter run against 76t5-zqzr
  // both ways gives 6,980 in-window applications, 5,215 with the
  // `issueddate IS NOT NULL` limb — the predicate hid 1,765 filings, observed
  // share 74.71%. That clears p50 and fails p80, so the published p80 of 10.0
  // was unidentified — LA's and NYC's shape, not SF's. The file's own RESULTS
  // block had recorded 74.1% beside the p80 it unidentifies; a recorded
  // limitation does not restrain a published number.
  //
  // THE MEDIAN IS NOT REPUBLISHED ALONE, for the Milwaukee reason: 5.7 at 74.71%
  // observed is conditional on issuance and no UI surface renders the condition
  // (`vintage` is never shown). Asserted so neither the pair nor a bare median
  // can be reinstated from a stale script.
  it('Seattle is withdrawn — its p80 is unidentified at 74.71% observed', () => {
    const t = resolveTimeline('seattle', project({ city: 'seattle' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
    // And it must not degrade into a "measured but withheld for this size" card —
    // Seattle's byTier went with the withdrawal (per-tier shares are only
    // BOUNDED, and no tier's lower bound clears p80).
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  // ⚠️ WITHDRAWN 2026-08-05. Chicago and LA were measured and published, then an
  // adversarial audit disqualified both. Chicago: 46% of the sample was a 2022-23
  // cohort stamped applied==issued (51.6% zero-day), roughly halving the median.
  // LA: 45.4% of the cohort carries no issue date at extract, so only 54.6% is
  // observed and the p80 of 13.0 months is undefined, not merely imprecise. These
  // assert the ABSENCE so the old figures cannot be silently reinstated from the
  // stale scripts.
  //
  // LA's shares are SOURCED (established 2026-08-09) to LADBS's SUBMITTED feed,
  // Socrata `gwh9-jnip`: `permit_type='Bldg-New'`, `submitted_date >= 2022-01-01`
  // gives 11,810 of 26,035 with no issue date (45.36%), observed 54.64%; the
  // matured 2022 cohort is 3,901/6,085 (64.11%). They are NOT measurable from
  // `pi9x-tg5x`, the ISSUED feed `scripts/permits/la.mjs` reads, where the share
  // is 100% by construction — a 2026-08-09 note calling the claim irreproducible
  // had probed that feed and has been withdrawn. Note which limb binds: at 54.64%
  // observed the p50 is identified and the p80 is not, so it is specifically the
  // p80 that fails, which is what the test below asserts the absence of.
  it('Chicago is withdrawn — a backfill artifact halved its median', () => {
    const t = resolveTimeline('chicago', project({ city: 'chicago' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('Austin (landed via austin.mjs) → measured is populated', () => {
    const t = resolveTimeline('austin', project({ city: 'austin' }), feas('as_of_right'), false)
    expectMeasuredShape(t.measured)
  })

  it('Los Angeles is withdrawn — only 54.6% of applications are observed, so its p80 is unidentified', () => {
    const t = resolveTimeline('la', project({ city: 'la' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
  })

  // ⚠️ NYC WITHDRAWN 2026-08-09, after shipping 8.3 mo / p80 17.0 / n=4,403 from
  // 2026-08-06. 8.3 was a CONDITIONAL median — time to issuance GIVEN issuance —
  // and the condition lived only in the `vintage` string, which
  // src/lib/realityCheck.ts never renders; the card said "Median filing→permit in
  // New York City". `scripts/permits/nyc.mjs` had recorded the disqualifier in its
  // own header (45% of initial New Building filings since 2022 with no issue date;
  // Kaplan-Meier over all 8,039 ≈ 15.9 months, ~2x the published figure) while its
  // `pull()` ended `AND first_permit_date IS NOT NULL` — a query that selects on
  // the outcome cannot measure how often the outcome occurs, so main() reproduced
  // 8.3 and could not see it. That predicate is gone and the script now halts.
  //
  // WHICH LIMB BINDS: measured 2026-08-09 through the script's own filters, 662 of
  // 1,040 in-window -I1 filings carry an issue date = 63.65%. That clears p50 and
  // fails p80, so it is specifically the published p80 of 17.0 that is
  // unidentified — LA's shape, not SF's. Per filing year 2022 71.4% / 2023 63.4% /
  // 2024 57.0% / 2025 46.8%, so no matured cohort rescues the p80 either.
  //
  // WITHDRAWING IS NOT PUBLISHING 15.9: that figure assumes something about the
  // non-issued filings which has not been adopted here. Asserted so neither the
  // old figure nor the KM one can be reinstated from a stale script.
  it('NYC is withdrawn — its p80 is unidentified at 63.65% observed, and 8.3 was conditional on issuance', () => {
    const t = resolveTimeline('nyc', project({ city: 'nyc' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
    // And it must not degrade into a "measured but withheld for this size" card —
    // that would claim NYC publishes timing by building size, which it never did.
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  it('a city absent from permitStats → measured is undefined', () => {
    // 'atlantis' is not a real city and will never be in the artifact.
    const t = resolveTimeline('atlantis', project({ city: 'atlantis' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
  })

  it('an addition/renovation never gets a measured permit line, even for a present city', () => {
    const t = resolveTimeline(
      'sf',
      project({ city: 'sf', projectType: 'addition', use: 'residential', units: 3 }),
      feas('as_of_right'),
      false,
    )
    expect(t.measured).toBeUndefined()
  })

  it('measured is carried through on the prohibited path too (UI gates on months, not measured)', () => {
    const t = resolveTimeline('miami', project({ city: 'miami' }), feas('prohibited'), false)
    expect(t.months).toBe(0)
    // present + new → measured still resolved; the component only renders it when months > 0.
    expectMeasuredShape(t.measured)
  })

  it('measuredFor mirrors the artifact: present cities resolve, unknown cities do not', () => {
    expect(measuredFor('miami')).toBeDefined()
    expect(measuredFor('atlantis')).toBeUndefined()
  })
})

// Rule 14: the coverage claim shown to users must be impossible to falsify by
// forgetting to update it. CITIES_WITH_MEASURED_PERMITS drives Compare's
// "estimated" marker; if another city is measured and the list is not updated,
// that city keeps being labelled an estimate — and the reverse omission would
// label an unmeasured city as measured, which is worse. That reverse omission is
// the one that bit: NYC's withdrawal has to remove it from BOTH the artifact and
// the list, and this test is what makes a half-done withdrawal fail loudly.
describe('the published measured-permit coverage list matches the data', () => {
  // ⚠️ WIDENED 2026-08-18. This compared the list against cities carrying a
  // `newConstruction` key, which read "has a city aggregate" as "is measured".
  // Those were the same set until Milwaukee, which publishes two tiers and
  // withholds the aggregate deliberately — so the old comparison would have
  // demanded Milwaukee be dropped from a list it belongs on. Fifth site of that
  // same proxy found in one change; the others were measuredTierWithheldFor,
  // coverage.ts, ledgerFigures' PermitEntry type and coverage.test.ts.
  it('equals exactly the cities publishing ANY measured figure, aggregate or tier', async () => {
    const stats = (await import('./data/permitStats.json')).default as Record<
      string,
      { newConstruction?: unknown; byTier?: Record<string, unknown> } | undefined
    >
    const measured = Object.entries(stats)
      .filter(([, v]) => v?.newConstruction || Object.keys(v?.byTier ?? {}).length > 0)
      .map(([k]) => k)
      .sort()
    expect(measured).toEqual([...CITIES_WITH_MEASURED_PERMITS].sort())
  })

  it('and the aggregate-less case is real, not hypothetical', () => {
    // Pins WHY the assertion above had to widen. If Milwaukee ever gains an
    // aggregate, this goes red and the reader lands on the reason rather than
    // finding a widened check with nothing left to justify it (rule 20 — a
    // check that can pass by finding nothing is not a check).
    expect(measuredFor('milwaukee', 'single')).toBeDefined()
    expect(measuredFor('milwaukee')).toBeUndefined()
  })

  // These four publish only issue-side dates. If one of them ever appears in
  // permitStats.json, either the city started publishing an application date
  // (good — update the list) or something substituted a wrong pair of dates.
  it.each(['boston', 'dc', 'minneapolis', 'sanjose'])(
    '%s has no measured timing — its city publishes no application date',
    (city) => {
      expect(hasMeasuredPermitTiming(city)).toBe(false)
    },
  )

  // NYC and Seattle are deliberately NOT in the list above, and the distinction
  // is the whole of rule 5. Those four cannot be measured; NYC and Seattle can
  // be, were, and their figures were WITHDRAWN 2026-08-09 because what each
  // measured was conditional on issuance and the condition was never rendered
  // (the published p80 was unidentified in both — 63.65% observed for NYC,
  // 74.71% for Seattle). Filing dates are present and clean in both feeds.
  // Grouping them with the no-application-date cities would turn a finding into
  // a missing lookup.
  it('NYC is unmeasured by WITHDRAWAL, not by a missing application date', () => {
    expect(hasMeasuredPermitTiming('nyc')).toBe(false)
  })
  it('Seattle is unmeasured by WITHDRAWAL, not by a missing application date', () => {
    expect(hasMeasuredPermitTiming('seattle')).toBe(false)
  })
})

// Austin's new-construction population is 77% single-family houses at 1.6 months
// and 13% apartment-tier at 8.6 — a 5x spread that a single 2.1-month city median
// hid completely. Someone testing a multifamily parcel was shown the
// single-family number. These pin the tier selection so that cannot come back.
describe('measuredFor prefers the tier-specific figure over the city aggregate', () => {
  it('an apartment-tier Austin project gets the apartment measurement, not the aggregate', () => {
    const agg = measuredFor('austin')
    const apt = measuredFor('austin', 'apartment')
    expect(apt).toBeDefined()
    expect(apt!.medianMonths).toBeGreaterThan(agg!.medianMonths)
    // The whole point: they must not be the same number.
    expect(apt!.medianMonths).not.toBe(agg!.medianMonths)
  })

  it('tiers are ordered single < multi < apartment', () => {
    const s = measuredFor('austin', 'single')!
    const m = measuredFor('austin', 'multi')!
    const a = measuredFor('austin', 'apartment')!
    expect(s.medianMonths).toBeLessThan(m.medianMonths)
    expect(m.medianMonths).toBeLessThan(a.medianMonths)
  })

  // A city with no breakdown must still resolve — the aggregate is the fallback,
  // not the default. Philadelphia's script computes no tier split at all, so its
  // aggregate spans all three tiers and answering with it is disclosed.
  it('falls back to the aggregate where no tier breakdown was ATTEMPTED', () => {
    expect(measuredFor('philadelphia', 'apartment')).toEqual(measuredFor('philadelphia'))
  })

  // ⚠️ THE FAIL-OPEN THIS FILE EXISTS TO PREVENT. Denver's `multi` tier was
  // computed and withheld for a thin sample, and the old fallback answered a
  // duplex query with the 4.5-month city aggregate — 3,505 single-family rows,
  // 628 apartment rows, the untiered residential rows and the whole commercial
  // layer, fewer than 30 of which are 2–4 unit buildings.
  it('a SUPPRESSED tier resolves to nothing — never to the city aggregate', () => {
    expect(measuredFor('denver', 'multi')).toBeUndefined()
    // The city itself is still measured, and its published tiers still resolve.
    expect(measuredFor('denver')).toBeDefined()
    expect(measuredFor('denver', 'single')).toBeDefined()
    expect(measuredFor('denver', 'apartment')).toBeDefined()
  })

  it('a Denver duplex gets no measured figure but a stated reason', () => {
    const t = resolveTimeline(
      'denver',
      project({ city: 'denver', use: 'residential', units: 2 }),
      feas('as_of_right'),
      false,
    )
    expect(t.tier).toBe('multi')
    expect(t.measured).toBeUndefined()
    // n was `null` from 2026-08-09 to 2026-08-10: the 2026-08-06 run logged the
    // suppressed count to a console and wrote nothing, so it was unrecoverable
    // FROM THAT RUN. A re-probe recovered it as 18 — still under the floor, so
    // the suppression was correct all along. The count changing does not change
    // the withholding, which is the property this test exists to pin.
    expect(t.measuredTierWithheld).toEqual({
      tier: 'multi',
      basis: 'thin-sample',
      n: 18,
      minPublishableN: 30,
    })
    // Narrowed on `basis`, not asserted past it: on the 'unenumerable' arm
    // there is no n and no floor to compare, and the union is what makes that
    // a compile error instead of a sentence about a sample that was never taken.
    const w = t.measuredTierWithheld!
    expect(w.basis).toBe('thin-sample')
    if (w.basis === 'thin-sample') expect(w.n!).toBeLessThan(w.minPublishableN)
  })

  it('a published tier carries no withheld record — the two are mutually exclusive', () => {
    const t = resolveTimeline(
      'denver',
      project({ city: 'denver', use: 'residential', units: 1 }),
      feas('as_of_right'),
      false,
    )
    expect(t.measured).toBeDefined()
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  it('an unmeasured city gets no withheld record either — that would imply a measurement', () => {
    const t = resolveTimeline('atlantis', project({ city: 'atlantis' }), feas('as_of_right'), false)
    expect(t.measured).toBeUndefined()
    expect(t.measuredTierWithheld).toBeUndefined()
  })

  it('an unknown city resolves to nothing under any tier', () => {
    expect(measuredFor('atlantis', 'apartment')).toBeUndefined()
  })

  // Every published tier figure must carry a real sample. The script omits any
  // tier under n=30 rather than publishing a thin median.
  it.each(['single', 'multi', 'apartment'] as const)('the %s tier carries n >= 30', (tier) => {
    expect(measuredFor('austin', tier)!.n).toBeGreaterThanOrEqual(30)
  })
})

// ── Rule 14: make the defect CLASS impossible, not just this instance ────────
// Denver's `multi` tier was suppressed for a thin sample and the suppression left
// no trace in permitStats.json, so nothing — not the type checker, not the suite,
// not a reader of the artifact — could tell it apart from a city that never
// computed a breakdown at all. Both rendered as "no byTier entry", and the
// aggregate was served for both.
//
// So every city × tier pair must now land in exactly one of three declared
// states. A future city that suppresses a tier silently fails HERE, in the suite,
// before it can serve an aggregate to a tier its population barely contains.
describe('every city × tier is measured, aggregate-covered, or explicitly suppressed', () => {
  const TIERS = ['single', 'multi', 'apartment'] as const

  type Entry = {
    newConstruction?: { n: number }
    byTier?: Partial<Record<(typeof TIERS)[number], { n: number }>>
    tierBreakdown?: {
      attempted: boolean
      minPublishableN?: number
      reason?: string
      suppressed?: Partial<Record<(typeof TIERS)[number], { n: number | null; reason: string }>>
    }
  }

  const load = async () =>
    (await import('./data/permitStats.json')).default as unknown as Record<string, Entry>

  it('every city declares whether a tier breakdown was attempted', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      expect(entry.tierBreakdown, `${city} must declare tierBreakdown`).toBeDefined()
      expect(typeof entry.tierBreakdown!.attempted, `${city}.tierBreakdown.attempted`).toBe('boolean')
    }
  })

  it('every tier of every city is measured, covered by an unattempted breakdown, or marked suppressed', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      const tb = entry.tierBreakdown!
      for (const tier of TIERS) {
        const state =
          entry.byTier?.[tier] ? 'measured'
          : !tb.attempted ? 'aggregate-covers-all-tiers'
          : tb.suppressed?.[tier] ? 'suppressed'
          : 'UNDECLARED'
        expect(
          state,
          `${city}.${tier} is undeclared: the breakdown was attempted, the tier is absent from ` +
            `byTier, and nothing in tierBreakdown.suppressed says why. Emit the suppression ` +
            `record (scripts/permits/lib/tierFloor.mjs) instead of dropping the tier silently.`,
        ).not.toBe('UNDECLARED')
      }
    }
  })

  it('a suppressed tier records a floor and a reason, and its n is a number or an explicit null', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      const tb = entry.tierBreakdown!
      for (const [tier, record] of Object.entries(tb.suppressed ?? {})) {
        expect(tb.minPublishableN, `${city}.${tier} suppressed without a floor`).toBeTypeOf('number')
        expect(record.reason.length, `${city}.${tier} suppressed without a reason`).toBeGreaterThan(0)
        // null means "never recorded" — an unknown, deliberately not filled in.
        if (record.n !== null) {
          expect(record.n, `${city}.${tier}`).toBeLessThan(tb.minPublishableN!)
        }
      }
    }
  })

  // The behavioural half: the declaration must actually govern what is served.
  it('measuredFor() serves the aggregate ONLY where no breakdown was attempted', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      for (const tier of TIERS) {
        const got = measuredFor(city, tier)
        if (entry.byTier?.[tier]) {
          expect(got, `${city}.${tier}`).toEqual(entry.byTier[tier])
        } else if (entry.tierBreakdown!.attempted) {
          expect(got, `${city}.${tier} must fail closed`).toBeUndefined()
        } else {
          expect(got, `${city}.${tier}`).toEqual(entry.newConstruction)
        }
      }
    }
  })

  // A withheld tier must be EXPLAINABLE to the user, not merely absent — the
  // result page renders "not measured for this size" off this record.
  it('every withheld tier produces a renderable reason', async () => {
    const stats = await load()
    for (const [city, entry] of Object.entries(stats)) {
      if (!entry.tierBreakdown!.attempted) continue
      for (const tier of TIERS) {
        if (entry.byTier?.[tier]) continue
        const withheld = measuredTierWithheldFor(city, tier)
        expect(withheld, `${city}.${tier}`).toBeDefined()
        // Every absence must state its KIND, and each kind must carry the
        // field its copy depends on — a floor for a counted tier, a reason for
        // an uncountable one. Neither arm may render the other's sentence.
        if (withheld!.basis === 'thin-sample') {
          expect(withheld!.minPublishableN).toBeGreaterThan(0)
        } else {
          expect(withheld!.reason.length, `${city}.${tier} reason`).toBeGreaterThan(20)
        }
      }
    }
  })
})

// ── Feed row counts: optional, never backfilled, never unlabelled ────────────
// Recorded at extraction time so a later "did this batch degrade?" question is
// answerable by a diff instead of a re-derivation. See
// netlify/functions/lib/feedCounts.ts for what the two counts mean and why the
// field is optional.
//
// The validator is imported from the WRITER (scripts/lib/feedCounts.mjs) rather
// than restated here. A second copy of the rules would drift from the one the
// scripts enforce, and then a block could be valid on one side of the boundary
// and invalid on the other — the shape of every defect this ledger records.
describe('feed row counts in the artifact', () => {
  type FeedBlock = { observedAt: string; cohortRows: number; totals: unknown[]; basis: string }
  type FeedEntry = { newConstruction?: { vintage: string }; feed?: FeedBlock }

  const loadFeeds = async () =>
    (await import('./data/permitStats.json')).default as unknown as Record<string, FeedEntry>

  // Not every entry has one, and that is correct rather than a gap to fill:
  // entries written before the instrumentation landed carry no `feed`, and
  // backfilling them with a count taken today would assert a number that was
  // never observed at that extract's vintage. An absent block says "this run
  // predates the counter" — which is true.
  it('the field is OPTIONAL — an entry without one is valid', async () => {
    const stats = await loadFeeds()
    expect(Object.keys(stats).length).toBeGreaterThan(0)
    for (const [city, entry] of Object.entries(stats)) {
      if (entry.feed === undefined) continue
      expect(typeof entry.feed, `${city}.feed`).toBe('object')
    }
  })

  it('every feed block present is well-formed by the writer’s own definition', async () => {
    const stats = await loadFeeds()
    for (const [city, entry] of Object.entries(stats)) {
      if (!entry.feed) continue
      expect(() => assertFeedCounts(entry.feed, `permitStats.${city}.feed`)).not.toThrow()
    }
  })

  // THE ANTI-BACKFILL GUARD, and it is the reason this test exists at all.
  //
  // A count taken today is not the count at an older extract's vintage, so a
  // `feed` block must have been written by the SAME run that produced the figure
  // beside it. That is checkable: the vintage carries "computed YYYY-MM-DD", and
  // observedAt must equal it. A block backfilled later fails here — which is what
  // makes "never backfilled" a structure rather than a note in a header (rule 14).
  it('observedAt matches the vintage’s compute date — a backfilled count fails here', async () => {
    const stats = await loadFeeds()
    for (const [city, entry] of Object.entries(stats)) {
      if (!entry.feed || !entry.newConstruction) continue
      const computed = /computed (\d{4}-\d{2}-\d{2})/.exec(entry.newConstruction.vintage)?.[1]
      expect(computed, `${city}.newConstruction.vintage must state a compute date`).toBeTruthy()
      expect(
        entry.feed.observedAt,
        `${city}.feed.observedAt (${entry.feed.observedAt}) must equal the vintage's compute ` +
          `date (${computed}). A count observed on a different day than the figure is a ` +
          `provenance claim about a run that did not make it.`,
      ).toBe(computed)
    }
  })
})

// ── MILWAUKEE: THE FIRST CITY TO PUBLISH TIERS AND NO AGGREGATE ─────────────
// Authorised 2026-08-18. Its 1-2 family pair is measured off a controlled
// vocabulary; its apartments are filed as commercial new construction where the
// use column is free text and cannot be separated at all. So it publishes two
// tiers and deliberately NO `newConstruction` — a houses-only median behind the
// key every other city uses for its whole new-construction population would be
// the same fail-open the tier guard exists to prevent, one level up.
describe('a city can publish tiers with no city aggregate', () => {
  it('milwaukee resolves its two tiers and refuses the third', () => {
    expect(measuredFor('milwaukee', 'single')?.n).toBe(262)
    expect(measuredFor('milwaukee', 'multi')?.n).toBe(83)
    expect(measuredFor('milwaukee', 'apartment')).toBeUndefined()
  })

  it('and an untiered request gets nothing rather than the houses-only figure', () => {
    // The load-bearing assertion. If a `newConstruction` key ever appears for
    // Milwaukee while the commercial side is unenumerable, this goes red — and
    // the thing it protects is that no caller can obtain a 1-2-family median
    // under a city-wide name.
    expect(measuredFor('milwaukee')).toBeUndefined()
  })

  it('the withheld apartment tier survives having no aggregate to hang off', () => {
    // `measuredTierWithheldFor` used to gate on `newConstruction` as its proxy
    // for "this city is measured", which would have made the explanation vanish
    // for the one city whose absence most needs explaining.
    const w = measuredTierWithheldFor('milwaukee', 'apartment')
    expect(w).toBeDefined()
    expect(w!.basis).toBe('unenumerable')
    if (w!.basis === 'unenumerable') {
      expect(w!.reason).toMatch(/free text/i)
      expect(w!.reason).toMatch(/5\+ units|apartment/i)
    }
  })
})

// Every suppression must carry the fields ITS OWN copy depends on, and neither
// arm may carry the other's. A thin-sample record with no n, or an unenumerable
// one with a floor, renders a sentence about a measurement that was not taken.
describe('suppression records are shaped by their basis', () => {
  it('across every city in the artifact', async () => {
    const stats = (await import('./data/permitStats.json')).default as unknown as Record<
      string,
      { tierBreakdown?: { suppressed?: Record<string, { n: number | null; reason: string; basis?: string }> } }
    >
    let checked = 0
    for (const [city, entry] of Object.entries(stats)) {
      for (const [tier, rec] of Object.entries(entry.tierBreakdown?.suppressed ?? {})) {
        checked++
        const basis = rec.basis ?? 'thin-sample'
        expect(['thin-sample', 'unenumerable'], `${city}.${tier}`).toContain(basis)
        if (basis === 'unenumerable') {
          expect(rec.n, `${city}.${tier}: an uncounted tier must not carry a count`).toBeNull()
          expect(rec.reason.length, `${city}.${tier}: reason is rendered, so it must say something`).toBeGreaterThan(40)
        } else {
          expect(typeof rec.n === 'number' || rec.n === null, `${city}.${tier}`).toBe(true)
        }
      }
    }
    // rule 20: an empty suppression inventory would make every assertion above
    // vacuously true, which is exactly how a check goes green by finding nothing.
    expect(checked, 'no suppressed tiers found at all — the scan or the artifact broke').toBeGreaterThanOrEqual(2)
  })
})

describe('⚠️ the entitlement leg — measured, and never a substitute', () => {
  const proj = (o: Partial<AnalysisInput> = {}): AnalysisInput =>
    ({
      city: 'sf',
      projectType: 'new',
      funding: 'private',
      parcelId: 'p',
      lat: 0,
      lng: 0,
      use: 'residential',
      gfa: 40000,
      units: 40,
      ...o,
    }) as AnalysisInput

  it('publishes the three verified cities, and only those', () => {
    expect([...ENTITLEMENT_MEASURED_CITIES]).toEqual(['la', 'sanjose', 'sf'])
    for (const [city, med, p80, n] of [
      ['sf', 18.0, 27.0, 90],
      ['sanjose', 15.3, 22.1, 52],
      ['la', 8.5, 19.5, 1325],
    ] as const) {
      const r = entitlementFor(city, proj({ city }))
      expect(r.kind, city).toBe('measured')
      if (r.kind !== 'measured') throw new Error('unreachable')
      expect(r.value.medianMonths, city).toBe(med)
      expect(r.value.p80Months, city).toBe(p80)
      expect(r.value.n, city).toBe(n)
    }
  })

  it('⚠️ San Diego is WITHHELD, not missing — and the reason is the data', () => {
    // n=15 under the n=30 floor, and 4.4 months against LA's 8.5 fails a
    // known-good comparison on its face. Both halves are recorded, because the
    // floor alone would not explain why the number is also implausible.
    const r = entitlementFor('sandiego', proj({ city: 'sandiego' }))
    expect(r.kind).toBe('absent')
    if (r.kind !== 'absent') throw new Error('unreachable')
    expect(r.why.basis).toBe('thin-sample')
    if (r.why.basis !== 'thin-sample') throw new Error('unreachable')
    expect(r.why.n).toBe(15)
    expect(r.why.minPublishableN).toBe(30)
    expect(r.why.detail).toMatch(/fails a known-good comparison/)
    // ⚠️ And it is kept as DATA, so "withheld" stays distinguishable from
    // "never had it" and the partition can be asserted (rule 29's corollary).
    expect([...ENTITLEMENT_WITHHELD_CITIES]).toEqual(['sandiego'])
  })

  it('⚠️ a non-California city reports NO SOURCE, about us and not about them', () => {
    for (const city of ['boston', 'nyc', 'chicago', 'austin']) {
      const r = entitlementFor(city, proj({ city }))
      expect(r.kind, city).toBe('absent')
      if (r.kind !== 'absent') throw new Error('unreachable')
      expect(r.why.basis, city).toBe('no-source')
      expect(r.why.detail, city).toMatch(/statement about our coverage, not about the city/)
    }
  })

  it('⚠️ a house in a measured city gets wrong-tier, not a multifamily number', () => {
    // The extract covers 5+ unit multifamily only. Serving it for a house would
    // answer a different question — the same failure the permit tiers already
    // fixed once, where a duplex was shown a single-family median.
    const r = entitlementFor('sf', proj({ units: 1 }))
    expect(r.kind).toBe('absent')
    if (r.kind !== 'absent') throw new Error('unreachable')
    expect(r.why.basis).toBe('wrong-tier')
    if (r.why.basis !== 'wrong-tier') throw new Error('unreachable')
    expect(r.why.tier).toBe('single')
  })

  it('⚠️ the CITY reason wins over the tier reason where both apply', () => {
    // A house in San Diego reports the thin sample, not the tier: the
    // city-level reason is the one that would still hold if the project changed.
    const r = entitlementFor('sandiego', proj({ city: 'sandiego', units: 1 }))
    expect(r.kind).toBe('absent')
    if (r.kind !== 'absent') throw new Error('unreachable')
    expect(r.why.basis).toBe('thin-sample')
  })

  it('⚠️ the coverage caveat is on every published figure, and is TRUE', () => {
    // rule 20: the claim "3 of 15" is checked against the data rather than
    // trusted, so it cannot drift as cities are added.
    for (const city of ENTITLEMENT_MEASURED_CITIES) {
      const r = entitlementFor(city, proj({ city }))
      if (r.kind !== 'measured') throw new Error('unreachable')
      expect(r.value.coverageCaveat, city).toMatch(/3 of the 15 ranked cities/)
      expect(r.value.source, city).toMatch(/HCD Housing Element Annual Progress Report/)
      expect(r.value.vintage, city).toMatch(/2026-08-14/)
    }
    expect(ENTITLEMENT_MEASURED_CITIES).toHaveLength(3)
  })

  it('⚠️ it is never summed with `measured`, and never replaces `months`', () => {
    // The two are different legs of one lifecycle and no source bounds their
    // overlap, so adding them would double-count it. And both are subsets of
    // `months` — swapping either in would replace a calibrated whole with a
    // measured fragment.
    const t = resolveTimeline('sf', proj(), { path: 'as_of_right' } as never, false)
    expect(t.entitlement?.medianMonths).toBe(18.0)
    expect(t.months).toBeGreaterThan(0)
    expect(t.months).not.toBe(18)
    if (t.measured) expect(t.months).not.toBe(t.measured.medianMonths + t.entitlement!.medianMonths)
  })

  it('⚠️ absence is ALWAYS explained — never a blank line', () => {
    // A missing entitlement figure reads as "no delay here", which is the
    // opposite of what an unmeasured city means. Every timeline carries one or
    // the other, and exactly one.
    for (const city of ['sf', 'la', 'sanjose', 'sandiego', 'boston', 'nyc']) {
      const t = resolveTimeline(city, proj({ city }), { path: 'as_of_right' } as never, false)
      const hasOne = (t.entitlement != null) !== (t.entitlementAbsent != null)
      expect(hasOne, city).toBe(true)
    }
  })

  it('attaches to new construction only', () => {
    // Application→entitlement is about getting a development approved, so an
    // addition or a change of use is outside the population.
    for (const pt of ['addition', 'change_of_use', 'adu'] as const) {
      const t = resolveTimeline('sf', proj({ projectType: pt }), { path: 'as_of_right' } as never, false)
      expect(t.entitlement, pt).toBeUndefined()
      expect(t.entitlementAbsent, pt).toBeUndefined()
    }
  })
})
