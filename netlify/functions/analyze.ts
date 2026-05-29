import type { Handler, HandlerEvent } from '@netlify/functions'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use } from '../../src/types/analysis'
import { USES } from '../../src/types/analysis'
import { getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
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
  const narrative = buildNarrative(parcel, project, feasibility, estimate)

  const result: AnalysisResult = {
    parcel: { address: parcel.address, parcelId: parcel.parcelId, districtCode: parcel.zoning.districtCode },
    project,
    feasibility: { overall: feasibility.overall, checks: feasibility.checks },
    costs: estimate.costs,
    timeline: estimate.timeline,
    narrative,
    assumptions: assumptionsSummary(),
    disclaimers: DISCLAIMERS,
    generatedAt: new Date().toISOString(),
  }

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(result),
  }
}
