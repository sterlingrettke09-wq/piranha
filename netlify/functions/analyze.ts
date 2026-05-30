import type { Handler, HandlerEvent } from '@netlify/functions'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use, ProjectType } from '../../src/types/analysis'
import { USES, PROJECT_TYPES } from '../../src/types/analysis'
import { getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
import { assessHurdles } from './lib/hurdles'
import { estimateCost } from './lib/cost'
import { buildNarrative } from './lib/narrative'
import { assumptionsSummary } from './lib/assumptions'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const DISCLAIMERS = [
  'Estimates only — not legal, engineering, or financial advice.',
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
  const narrative = buildNarrative(parcel, project, feasibility, estimate)

  // Non-zoning hurdles add to the approval timeline.
  const hurdleMonths = hurdles.reduce((sum, h) => sum + (h.addsMonths ?? 0), 0)
  const timeline = {
    ...estimate.timeline,
    months: estimate.timeline.months > 0 ? estimate.timeline.months + hurdleMonths : estimate.timeline.months,
  }

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
    },
    project,
    feasibility: { overall: feasibility.overall, checks: feasibility.checks },
    hurdles,
    costs: estimate.costs,
    timeline,
    narrative,
    assumptions: assumptionsSummary(),
    sources: parcel.sources,
    disclaimers: DISCLAIMERS,
    generatedAt: new Date().toISOString(),
  }

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(result),
  }
}
