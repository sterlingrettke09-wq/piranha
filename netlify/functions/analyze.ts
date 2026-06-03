import type { Handler, HandlerEvent } from '@netlify/functions'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use, ProjectType, Funding } from '../../src/types/analysis'
import { USES, PROJECT_TYPES, FUNDING_TYPES } from '../../src/types/analysis'
import { getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
import { assessDevelopability } from '../../src/lib/developability'
import { assessSiteAdvisory } from '../../src/lib/siteFlags'
import { assessHurdles } from './lib/hurdles'
import { estimateCost } from './lib/cost'
import { resolveTimeline } from './lib/timeline'
import { buildNarrative } from './lib/narrative'
import { assumptionsSummary } from './lib/assumptions'
import {
  avgUnitGrossSqFt,
  ftPerStory,
  reliefAddMonthsByCity as RELIEF_ADD,
  reliefAddMonthsFallback as RELIEF_FALLBACK,
} from '../../src/config/estimates'
import { logSearch } from './lib/searchLog'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const DISCLAIMERS = [
  'Estimates only. Not legal, engineering, or financial advice.',
  'Construction cost only — excludes land, financing, and tax credits or other incentives.',
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

export const handler: Handler = async (event: HandlerEvent) => {
  const q = event.queryStringParameters ?? {}
  const city = q.city ?? 'boston'
  const projectType: ProjectType = PROJECT_TYPES.includes(q.projectType as ProjectType)
    ? (q.projectType as ProjectType)
    : 'new'
  const funding: Funding = FUNDING_TYPES.includes(q.funding as Funding) ? (q.funding as Funding) : 'private'
  const lat = Number(q.lat)
  const lng = Number(q.lng)
  const use = q.use as Use
  const gfa = Number(q.gfa)

  if (!USES.includes(use) || !Number.isFinite(gfa) || gfa <= 0) {
    return fail('BAD_INPUT', 'Missing or invalid project inputs (use, gfa).', 400)
  }

  // getParcelInfo validates the per-city bounding box (returns OUT_OF_BBOX).
  const parcelResult = await getParcelInfo(city, lat, lng)
  if (!parcelResult.ok) {
    return fail(parcelResult.code, parcelResult.message, parcelResult.status)
  }
  const parcel = parcelResult.info

  const project: AnalysisInput = {
    parcelId: parcel.parcelId,
    city,
    projectType,
    funding,
    lat,
    lng,
    use,
    gfa,
    units: num(q.units),
    stories: num(q.stories),
    heightFt: num(q.heightFt),
  }

  const developability = assessDevelopability({
    districtCode: parcel.zoning.districtCode,
    landUse: parcel.existing?.landUse ?? null,
    ownerPublic: parcel.existing?.ownerPublic ?? false,
  })
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
  const hurdles = assessHurdles(city, parcel, project)

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
  const estimate = estimateCost(project, feasibility, { demolitionSqFt, feeArea: parcel.overlays.feeArea })
  const timelineInfo = resolveTimeline(city, project, feasibility, hasExistingBuilding, demolitionSqFt)
  const timeline = { months: timelineInfo.months, path: timelineInfo.path, tier: timelineInfo.tier }

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
  const monthsIn = (cats: Set<string>, combine: (a: number, b: number) => number, seed: number) =>
    hurdles
      .filter((h) => cats.has(h.category) && typeof h.addsMonths === 'number')
      .reduce((m, h) => combine(m, h.addsMonths ?? 0), seed)
  const spine = feasibility.path === 'variance' ? RELIEF_ADD[city] ?? RELIEF_FALLBACK : 0
  const entitlementMax = monthsIn(ENTITLEMENT_CATS, Math.max, 0)
  const parallelSum = monthsIn(PARALLEL_CATS, (a, b) => a + b, 0)
  const discretionaryMonths = Math.min(24, Math.max(spine, entitlementMax) + parallelSum)
  if (timeline.path !== 'prohibited' && timeline.months > 0) timeline.months += discretionaryMonths

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
    hurdles,
    costs: estimate.costs,
    timeline,
    narrative,
    assumptions: assumptionsSummary(city, project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / ftPerStory(use)) : null)),
    sources: parcel.sources,
    disclaimers: [
      ...DISCLAIMERS,
      ...(city === 'austin'
        ? ['Austin zoning reflects the city’s 2019 published layer and may not include recent reforms (e.g. the 2023–24 HOME changes). Verify current zoning with the City of Austin.']
        : []),
      ...(estimate.impactNote ? [estimate.impactNote] : []),
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
    use: project.use,
    projectType: project.projectType,
    gfa: project.gfa,
    units: project.units,
    verdict: result.feasibility.overall,
    months: result.timeline.months,
  })

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(result),
  }
}
