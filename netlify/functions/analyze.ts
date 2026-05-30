import type { Handler, HandlerEvent } from '@netlify/functions'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use, ProjectType, Funding } from '../../src/types/analysis'
import { USES, PROJECT_TYPES, FUNDING_TYPES } from '../../src/types/analysis'
import { getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
import { assessHurdles } from './lib/hurdles'
import { estimateCost } from './lib/cost'
import { resolveTimeline } from './lib/timeline'
import { buildNarrative } from './lib/narrative'
import { assumptionsSummary } from './lib/assumptions'
import { logSearch } from './lib/searchLog'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const DISCLAIMERS = [
  'Estimates only. Not legal, engineering, or financial advice.',
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

  const feasibility = assessFeasibility(parcel, project)
  const estimate = estimateCost(project, feasibility)
  const hurdles = assessHurdles(city, parcel, project)

  // Full life-cycle timeline (design → permits → site prep → construction → move-in),
  // by city and building type. A demolition hurdle means there's a building to clear,
  // which the new-construction baseline already accounts for.
  const hasExistingBuilding = hurdles.some((h) => h.category === 'demolition')
  const timelineInfo = resolveTimeline(city, project, feasibility, hasExistingBuilding)
  const timeline = { months: timelineInfo.months, path: timelineInfo.path, tier: timelineInfo.tier }

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
      existing: parcel.existing,
    },
    project,
    feasibility: { overall: feasibility.overall, checks: feasibility.checks, envelopeKnown: feasibility.envelopeKnown },
    hurdles,
    costs: estimate.costs,
    timeline,
    narrative,
    assumptions: assumptionsSummary(city, project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / 11) : null)),
    sources: parcel.sources,
    disclaimers: DISCLAIMERS,
    generatedAt: new Date().toISOString(),
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
    verdict: feasibility.overall,
    months: timeline.months,
  })

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(result),
  }
}
