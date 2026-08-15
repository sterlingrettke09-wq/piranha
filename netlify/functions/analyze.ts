import type { JsonHandler } from './lib/handlerType'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use, ProjectType, Funding } from '../../src/types/analysis'
import { USES, PROJECT_TYPES, FUNDING_TYPES } from '../../src/types/analysis'
import { cacheControlFor, getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
import { assessDevelopability } from '../../src/lib/developability'
import { assessSiteAdvisory, assessCivicHardBlock } from '../../src/lib/siteFlags'
import { assessHurdles } from './lib/hurdles'
import { estimateCost } from './lib/cost'
import { resolveTimeline } from './lib/timeline'
import { reliefOddsFor } from './lib/relief'
import { buildNarrative } from './lib/narrative'
import { assumptionsSummary } from './lib/assumptions'
import {
  avgUnitGrossSqFt,
  ftPerStory,
  reliefAddMonthsByCity as RELIEF_ADD,
  reliefAddMonthsFallback as RELIEF_FALLBACK,
} from '../../src/config/estimates'
import { logSearch } from './lib/searchLog'
import { clientIp, rateLimited } from './lib/guard'
import { quantizeCoord } from '../../src/lib/coords'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// Soft per-IP rate limit on cache misses. Each miss fans out to several
// upstream ArcGIS queries (plus a Mapbox reverse-geocode), so an abuser
// varying lat/lng to defeat the CDN cache burns real upstream quota.
const RATE = { name: 'analyze', windowMs: 60_000, max: 20 } as const

// Sanity bounds on project inputs. Anything past these isn't a real project;
// rejecting (not clamping) keeps garbage out of the search log and avoids
// running the cost/timeline math on absurd numbers. 4M sf ≈ the largest
// single-building programs in the US; 120 stories > any US building.
const MAX_GFA = 4_000_000
const MAX_UNITS = 5_000
const MAX_STORIES = 120
const MAX_HEIGHT_FT = 1_600

const DISCLAIMERS = [
  'Estimates only. Not legal, engineering, or financial advice.',
  'Construction cost only — excludes land, financing, and tax credits or other incentives.',
  // Site preparation is excluded by construction, not by oversight: the cost
  // model has no sitework term at all. Without this line the total READS as a
  // complete construction cost, and the user forms a belief the figure does not
  // support. That is the one failure mode worse than a wrong number — every
  // other known gap here is either labelled or does not move the total.
  'Excludes site preparation — excavation, grading, soil remediation, retaining walls, and utility connections. These vary too much by site to estimate from public data and can be a significant share of a real budget.',
  // The base $/sf rates carry no verified derivation. Saying so is not optional
  // while the same report corrects a FAR disclosure: disclosing one limitation
  // and not the other is inconsistent in the direction that flatters the tool.
  'Base construction rates are internal estimates with unverified provenance, scaled by RSMeans 2021 city cost indices. Independent industry figures for market-grade buildings run higher. Treat the total as a rough floor.',
  // The hurdle list is the "Regulation" half of what this tool is for, and its
  // coverage is uneven: city-specific mandates are encoded for most but not all
  // cities (the authoritative list is CITIES_WITH_SPECIFIC_HURDLES, kept in sync
  // by a test that reads the `city === '…'` branches out of hurdles.ts —
  // Raleigh is the current exception),
  // the rest get the generic set. Undisclosed, that makes an unencoded city read
  // as a less-regulated city — a coverage artifact presented as a finding about
  // the world, in the direction that flatters. Compare marks the count too.
  'The regulatory requirements listed are not exhaustive, and coverage varies by city. City-specific mandates (inclusionary housing, large-project review) are encoded for some cities and not others, so treat the list as a floor rather than a complete account of what a city requires.',
  'Verify zoning, fees, and permitting with the city before relying on these figures.',
]

const fail = (code: AnalysisError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies AnalysisError),
})

const num = (v: string | undefined): number | undefined => {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export const handler: JsonHandler = async (event) => {
  if (rateLimited(clientIp(event.headers ?? {}), RATE)) {
    return fail('RATE_LIMITED', 'Too many requests — please wait a moment and try again.', 429)
  }

  const q = event.queryStringParameters ?? {}
  const city = q.city ?? 'boston'
  const projectType: ProjectType = PROJECT_TYPES.includes(q.projectType as ProjectType)
    ? (q.projectType as ProjectType)
    : 'new'
  const funding: Funding = FUNDING_TYPES.includes(q.funding as Funding) ? (q.funding as Funding) : 'private'
  const lat = quantizeCoord(Number(q.lat))
  const lng = quantizeCoord(Number(q.lng))
  const use = q.use as Use
  const gfa = Number(q.gfa)

  if (!USES.includes(use) || !Number.isFinite(gfa) || gfa <= 0) {
    return fail('BAD_INPUT', 'Missing or invalid project inputs (use, gfa).', 400)
  }
  const units = num(q.units)
  const stories = num(q.stories)
  const heightFt = num(q.heightFt)
  if (
    gfa > MAX_GFA ||
    (units != null && (units <= 0 || units > MAX_UNITS)) ||
    (stories != null && (stories <= 0 || stories > MAX_STORIES)) ||
    (heightFt != null && (heightFt <= 0 || heightFt > MAX_HEIGHT_FT))
  ) {
    return fail('BAD_INPUT', 'One or more project inputs are out of range.', 400)
  }

  // getParcelInfo validates the per-city bounding box (returns OUT_OF_BBOX).
  const parcelResult = await getParcelInfo(city, lat, lng)
  if (!parcelResult.ok) {
    return fail(parcelResult.code, parcelResult.message, parcelResult.status)
  }
  const parcel = parcelResult.info

  // ⚠️ DERIVED SERVER-SIDE, DELIBERATELY. `gfaBasis` records where the parcel's
  // size LIMIT came from, and three fail-closed guards read it:
  //   · feasibility.ts — withholds the verdict (INDETERMINATE, not AS_OF_RIGHT)
  //   · hurdles.ts     — downgrades size-triggered hurdles to 'info'
  //   · assumptions.ts — surfaces the "ASSUMED, not a code limit" disclosure
  //
  // All three were DEAD IN PRODUCTION until 2026-08-06. `buildDefaultSpec` sets
  // gfaBasis client-side, but `toQuery()` in src/hooks/useAnalysis.ts never
  // serialized it, so `project.gfaBasis` was `undefined` on every real request
  // and every guard returned at its first line. Measured at the HTTP entry
  // point: Minneapolis and Nashville were returning **AS_OF_RIGHT off a
  // `lot × 1.0` placeholder** — precisely the claim those guards exist to
  // prevent — while docs/NULL-INVENTORY.md described the withholding as shipped
  // behaviour. The unit tests passed throughout because they called the
  // functions directly (rule 11, again).
  //
  // Deriving it here rather than accepting a query param is the stronger fix: it
  // cannot be omitted by a caller, and a user who edits `gfa` upward on a parcel
  // whose FAR never resolved still gets the verdict withheld — which is the
  // point. The client's own value is now redundant, not load-bearing.
  const env = parcel.envelope
  const gfaBasis: AnalysisInput['gfaBasis'] =
    env?.maxFloorAreaSqFt != null && env.maxFloorAreaSqFt > 0
      ? 'envelope'
      : env?.farBasis === 'unconstrained'
        ? 'assumed-unconstrained'
        : env?.farBasis === 'planned-development'
          ? 'assumed-planned-development'
          : 'assumed-far-1.0'

  const project: AnalysisInput = {
    parcelId: parcel.parcelId,
    city,
    projectType,
    funding,
    lat,
    lng,
    use,
    gfa,
    gfaBasis,
    units,
    stories,
    heightFt,
  }

  let developability = assessDevelopability({
    districtCode: parcel.zoning.districtCode,
    landUse: parcel.existing?.landUse ?? null,
    ownerPublic: parcel.existing?.ownerPublic ?? false,
  })
  // Curated location hard-block for civic/public sites (city halls, capitols,
  // courthouses, marquee parks, airports) whose parcel data carries no public
  // signal. Only applied when the data-driven gate didn't already block.
  if (developability.developable) {
    const civic = assessCivicHardBlock({ city, lat, lng })
    if (civic) {
      developability = {
        developable: false,
        kind: 'public',
        reason: `This location is within ${civic.label}, a civic or public site that isn’t open to private development.`,
      }
    }
  }
  // Soft flag for stadiums / arenas / hospitals / campuses / museums — the
  // analysis still runs, but the UI warns the parcel is rarely buildable.
  const advisory = assessSiteAdvisory({
    city,
    districtCode: parcel.zoning.districtCode,
    landUse: parcel.existing?.landUse ?? null,
    lat,
    lng,
  })
  const feasibility = assessFeasibility(parcel, project)
  const hurdles = assessHurdles(city, parcel, project, { path: feasibility.path })

  // Full life-cycle timeline (design → permits → site prep → construction → move-in),
  // by city and building type. A demolition hurdle means there's a building to clear,
  // which the new-construction baseline already accounts for.
  const hasExistingBuilding = hurdles.some((h) => h.category === 'demolition')

  // New construction on a parcel with a building means tearing it down first —
  // cost that, not $0. Prefer the recorded building area; fall back to an
  // estimate from unit count. When a teardown is required but we can't size it,
  // demolitionSqFt stays null and the narrative says it's not included (no
  // silent $0). Cities that carry no existing-structure data get a different
  // caveat (see narrative): the estimate assumes a cleared site.
  const exb = parcel.existing?.buildingAreaSqFt
  const exu = parcel.existing?.units
  const demolitionSqFt =
    project.projectType === 'new' && hasExistingBuilding
      ? exb && exb > 0
        ? exb
        : exu && exu > 0
          ? exu * avgUnitGrossSqFt
          : null
      : null
  const estimate = estimateCost(project, feasibility, { demolitionSqFt, overlays: parcel.overlays })
  const timelineInfo = resolveTimeline(city, project, feasibility, hasExistingBuilding, demolitionSqFt)
  const timeline = {
    months: timelineInfo.months,
    path: timelineInfo.path,
    tier: timelineInfo.tier,
    measured: timelineInfo.measured,
    // Carried so the result page can say "not measured for this size" rather
    // than dropping the measured card without explanation.
    measuredTierWithheld: timelineInfo.measuredTierWithheld,
  }

  // Discretionary/entitlement delay, computed ONCE here to avoid double-counting.
  // The discretionary review processes are NESTED, not additive: environmental
  // review (CEQA/CEQR/SEPA) runs inside the entitlement, and the per-city variance
  // adder already represents "what discretionary review costs in this city." So we
  // take the MAX of the per-city spine and the longest triggered entitlement
  // hurdle (review/environmental/historic) — not their sum — and only ADD the
  // genuinely-parallel processes (public funding / prevailing-wage). Capped at 24
  // months, since even worst-case stacked entitlement tops out around there.
  const ENTITLEMENT_CATS = new Set(['review', 'environmental', 'historic'])
  const PARALLEL_CATS = new Set(['labor'])
  const spine = feasibility.path === 'variance' ? RELIEF_ADD[city] ?? RELIEF_FALLBACK : 0
  const entMonths = hurdles
    .filter((h) => ENTITLEMENT_CATS.has(h.category) && !h.serial && typeof h.addsMonths === 'number')
    .map((h) => h.addsMonths as number)
  const entitlementMax = entMonths.reduce((a, b) => Math.max(a, b), 0)
  const entitlementSum = entMonths.reduce((a, b) => a + b, 0)
  // Nested-with-partial-overlap: the longest process governs; the others
  // contribute HALF their months (they overlap the spine but rarely perfectly —
  // pure max() meant historic + environmental + large-project review on one
  // site never stacked at all, contradicting the published methodology).
  const nested = Math.max(spine, entitlementMax) + 0.5 * (entitlementSum - entitlementMax)
  // Genuinely serial processes (e.g. a Coastal Development Permit) and
  // parallel-but-additive ones (public-funding/prevailing-wage) add in full.
  const serialSum = hurdles
    .filter((h) => h.serial && typeof h.addsMonths === 'number')
    .reduce((a, h) => a + (h.addsMonths ?? 0), 0)
  const parallelSum = hurdles
    .filter((h) => PARALLEL_CATS.has(h.category) && typeof h.addsMonths === 'number')
    .reduce((a, h) => a + (h.addsMonths ?? 0), 0)
  const uncapped = Math.round(nested + serialSum + parallelSum)
  const discretionaryMonths = Math.min(24, uncapped)
  if (timeline.path !== 'prohibited' && timeline.months > 0) timeline.months += discretionaryMonths
  // Say when the cap bound — a silently-clamped worst case reads as confidence.
  const capBound = uncapped > 24 && timeline.path !== 'prohibited' && timeline.months > 0

  const narrative = buildNarrative(parcel, project, feasibility, estimate, {
    timelineMonths: timeline.months,
    includesDemolition: timelineInfo.includesDemolition,
    envelopeKnown: feasibility.envelopeKnown,
  })

  const result: AnalysisResult = {
    parcel: {
      address: parcel.address,
      parcelId: parcel.parcelId,
      districtCode: parcel.zoning.districtCode,
      lotSqFt: parcel.lot.sizeSqFt,
      allowedUses: parcel.zoning.allowedUses,
      maxFAR: parcel.zoning.maxFAR,
      maxHeightFt: parcel.zoning.maxHeightFt,
      floodZone: parcel.overlays.floodZone,
      historicDistrict: parcel.overlays.historicDistrict,
      envelope: parcel.envelope,
      existing: parcel.existing,
    },
    project,
    developable: developability.developable,
    developableNote: developability.reason,
    developableKind: developability.kind,
    advisory,
    feasibility: { overall: feasibility.overall, checks: feasibility.checks, envelopeKnown: feasibility.envelopeKnown },
    // Historical board grant rate for variance-type relief, attached only when
    // the verdict needs relief. Context for a NEEDS_RELIEF result, never a
    // per-project prediction; absent when the city has no trustworthy figure.
    ...(feasibility.path === 'variance' ? { reliefOdds: reliefOddsFor(city) } : {}),
    hurdles,
    costs: estimate.costs,
    timeline,
    narrative,
    assumptions: assumptionsSummary(
      city,
      project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / ftPerStory(use)) : null),
      project.gfaBasis,
    ),
    sources: parcel.sources,
    disclaimers: [
      ...DISCLAIMERS,
      ...(city === 'austin'
        ? ['Austin zoning reflects the city’s 2019 published layer and may not include recent reforms (e.g. the 2023–24 HOME changes). Verify current zoning with the City of Austin.']
        : []),
      ...(estimate.impactNote ? [estimate.impactNote] : []),
      ...(capBound
        ? ['Entitlement time was capped at 24 months in this estimate; heavily contested projects can exceed it.']
        : []),
    ],
    generatedAt: new Date().toISOString(),
  }

  // A non-developable parcel (public land / outside coverage) has no meaningful
  // cost or timeline — zero them so the JSON matches what the UI shows (the
  // "can't build / outside coverage" message), instead of emitting a confident
  // teardown estimate for, say, Central Park.
  if (!developability.developable) {
    result.costs = { hard: 0, soft: 0, permit: 0, demolition: 0, impact: 0, total: 0, currency: 'USD' }
    result.timeline = { months: 0, path: 'prohibited', tier: timeline.tier }
    result.hurdles = []
    result.feasibility = { overall: 'INDETERMINATE', checks: [], envelopeKnown: false }
    result.narrative = developability.reason ?? ''
  } else if (result.feasibility.overall === 'PROHIBITED') {
    // A prohibited project can't be built as proposed, so a confident construction
    // cost (e.g. a multimillion-dollar teardown of a building you're told you
    // can't replace) is misleading next to the 0-month "no viable path" timeline.
    // Zero the cost but keep the hurdles + narrative that explain WHY it's barred.
    result.costs = { hard: 0, soft: 0, permit: 0, demolition: 0, impact: 0, total: 0, currency: 'USD' }
  }

  // Private intent log (owner-only, via /admin). Never blocks the response.
  await logSearch({
    ts: result.generatedAt,
    city,
    address: parcel.address,
    // ⚠️ WITHOUT THIS THE TWO PATHS ARE NOT SEPARABLE. log-search.ts stamps
    // `kind: 'lookup'` for a map search or click; this path left it undefined,
    // so a full analysis could only be told apart from a lookup by noticing
    // that `verdict` happened to be present. Every other field this call writes
    // was already here — the log is populated, it just could not answer "how
    // many people ran an analysis" without an inference.
    kind: 'analysis',
    use: project.use,
    projectType: project.projectType,
    gfa: project.gfa,
    units: project.units,
    verdict: result.feasibility.overall,
    months: result.timeline.months,
  })

  return {
    statusCode: 200,
    // A verdict computed from a degraded parcel read (zoning/geocode upstream
    // failed) caches briefly instead of for a day. See cacheControlFor.
    headers: { ...JSON_HEADERS, 'Cache-Control': cacheControlFor(parcel) },
    body: JSON.stringify(result),
  }
}
