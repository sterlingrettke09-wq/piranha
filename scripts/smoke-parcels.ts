// Multi-parcel LIVE smoke test across every covered city.
//
// WHY THIS EXISTS
// `scripts/null-inventory.ts` probes exactly ONE hand-picked parcel per city.
// That separates "resolves" from "falls back" and nothing else — every parcel in
// it was chosen because it works. This script samples parcels from each city's
// OWN parcel layer and pushes ~25 per city through the composition
// `netlify/functions/analyze.ts` performs, so the failure modes a real user hits
// (a district code with an unexpected suffix, a null lot size, a provider
// timing out, an envelope dividing by zero) have somewhere to show up.
//
// SAMPLING IS THE POINT. Hand-picked parcels are the ones that already work
// (rule 18: a plausible answer and a correct answer do not feel different, and
// the surviving errors are the ones that produced plausible output). The sampler
// grids each city's bbox and pulls one real parcel polygon per cell, then takes
// an INTERIOR point of that polygon — not the area centroid, which for a concave
// lot can land in the neighbour (the Charlotte failure recorded in
// null-inventory.ts).
//
// REAL ENTRY POINT, NOT A SHORTER PATH (rule 11). `runOne` below mirrors
// analyze.ts step for step: getParcelInfo (which computes the envelope) →
// buildDefaultSpec → the server-side gfaBasis derivation → assessDevelopability
// → assessCivicHardBlock → assessSiteAdvisory → assessFeasibility →
// assessHurdles → estimateCost → resolveTimeline → the discretionary-months
// arithmetic → buildNarrative → assumptionsSummary → the non-developable /
// prohibited zeroing. If it would change the answer to call a layer directly,
// calling the layer directly measures the layer.
//
//   npx vite-node scripts/smoke-parcels.ts --sample   # phase 1 only
//   npx vite-node scripts/smoke-parcels.ts --run      # phase 2 only (reuses samples)
//   npx vite-node scripts/smoke-parcels.ts            # both
//
// Flags: --per=N (parcels per city, default 25) --cities=a,b --out=DIR
//
// NOT included, deliberately: logSearch (a Netlify Blobs write — a side effect,
// not a computation) and the Mapbox reverse geocode where no token is
// configured. Both are named in the report rather than silently skipped.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { AnalysisInput, AnalysisResult, Funding, ProjectType } from '../src/types/analysis'
import { getParcelInfo } from '../netlify/functions/lib/parcel'
import { buildDefaultSpec } from '../src/lib/defaultSpec'
import { assessFeasibility } from '../netlify/functions/lib/feasibility'
import { assessDevelopability } from '../src/lib/developability'
import { assessSiteAdvisory, assessCivicHardBlock } from '../src/lib/siteFlags'
import { assessHurdles } from '../netlify/functions/lib/hurdles'
import { estimateCost } from '../netlify/functions/lib/cost'
import { resolveTimeline } from '../netlify/functions/lib/timeline'
import { reliefOddsFor } from '../netlify/functions/lib/relief'
import { buildNarrative } from '../netlify/functions/lib/narrative'
import { assumptionsSummary } from '../netlify/functions/lib/assumptions'
import {
  avgUnitGrossSqFt,
  ftPerStory,
  reliefAddMonthsByCity as RELIEF_ADD,
  reliefAddMonthsFallback as RELIEF_FALLBACK,
} from '../src/config/estimates'
import { quantizeCoord } from '../src/lib/coords'
import * as BB from '../src/types/parcel'

// ─────────────────────────────────────────────────────────────────────────────
// City parcel layers. Each URL is the SAME layer the city's provider reads its
// parcel geometry from (netlify/functions/lib/providers/*.ts), so the sample is
// drawn from the population the tool actually serves — not from a second source
// that might disagree about what a parcel is.
// ─────────────────────────────────────────────────────────────────────────────
const PARCEL_LAYERS: Record<string, string> = {
  boston: 'https://gis.bostonplans.org/hosting/rest/services/Parcels_24_detailed/FeatureServer/112',
  nyc: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0',
  chicago: 'https://gis.cookcountyil.gov/traditional/rest/services/parcelHistorical/MapServer/2025',
  sf: 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/23',
  seattle: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Parcel_Boundary/FeatureServer/0',
  dc: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land/MapServer/40',
  austin: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/EXTERNAL_tcad_parcel/FeatureServer/0',
  la: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0',
  denver: 'https://denvergov.org/maps/data/Zoning/MapServer/0',
  minneapolis: 'https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1',
  philadelphia: 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/DOR_Parcel/FeatureServer/0',
  miami: 'https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26',
  sandiego: 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0',
  sanjose: 'https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer/49',
  nashville: 'https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0',
  raleigh: 'https://maps.raleighnc.gov/arcgis/rest/services/Property/Property/MapServer/0',
  milwaukee: 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/property/parcels_mprop/MapServer/2',
  columbus: 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/5',
  charlotte: 'https://gis.charlottenc.gov/arcgis/rest/services/Accela/Accela/MapServer/16',
  atlanta: 'https://gis.atlantaga.gov/dpcd/rest/services/AdministrativeArea/TaxParcel/MapServer/0',
  dallas: 'https://gis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0',
  lasvegas: 'https://mapdata.lasvegasnevada.gov/clvgis/rest/services/AdministrativeBoundaries/Parcel_Info/MapServer/0',
  phoenix: 'https://maps.phoenix.gov/pub/rest/services/Public/COUNTY_PARCELS/MapServer/3',
}

/** The bbox the RUNTIME gate uses, imported rather than retyped — a retyped
 *  rectangle would sample a population the tool would reject. */
const BBOXES: Record<string, BB.Bbox> = {
  boston: BB.BOSTON_BBOX,
  nyc: BB.NYC_BBOX,
  chicago: BB.CHICAGO_BBOX,
  sf: BB.SF_BBOX,
  seattle: BB.SEATTLE_BBOX,
  dc: BB.DC_BBOX,
  austin: BB.AUSTIN_BBOX,
  la: BB.LA_BBOX,
  denver: BB.DENVER_BBOX,
  minneapolis: BB.MINNEAPOLIS_BBOX,
  philadelphia: BB.PHILADELPHIA_BBOX,
  miami: BB.MIAMI_BBOX,
  sandiego: BB.SAN_DIEGO_BBOX,
  sanjose: BB.SAN_JOSE_BBOX,
  nashville: BB.NASHVILLE_BBOX,
  raleigh: BB.RALEIGH_BBOX,
  milwaukee: BB.MILWAUKEE_BBOX,
  columbus: BB.COLUMBUS_BBOX,
  charlotte: BB.CHARLOTTE_BBOX,
  atlanta: BB.ATLANTA_BBOX,
  dallas: BB.DALLAS_BBOX,
  lasvegas: BB.LAS_VEGAS_BBOX,
  phoenix: BB.PHOENIX_BBOX,
}

const CITIES = Object.keys(PARCEL_LAYERS)

// ─────────────────────────────────────────────────────────────────────────────
// Geometry: an INTERIOR point of a polygon.
// ─────────────────────────────────────────────────────────────────────────────
type Ring = number[][]

function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]
  return a / 2
}

function areaCentroid(r: Ring): [number, number] | null {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]
    a += f
    cx += (r[j][0] + r[i][0]) * f
    cy += (r[j][1] + r[i][1]) * f
  }
  if (Math.abs(a) < 1e-14) return null
  return [cx / (3 * a), cy / (3 * a)]
}

function pointInRing(x: number, y: number, r: Ring): boolean {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Midpoint of the widest interior span on a horizontal scanline — always an
 *  interior point when one exists at that y. Used when the area centroid falls
 *  outside a concave lot (the recorded Charlotte failure: an area-weighted
 *  centroid landed in the neighbouring parcel and everything downstream still
 *  looked like a valid answer). */
function scanlineInterior(r: Ring, y: number): number | null {
  const xs: number[] = []
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
  }
  xs.sort((a, b) => a - b)
  let best: number | null = null
  let bestW = 0
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const w = xs[k + 1] - xs[k]
    if (w > bestW) {
      bestW = w
      best = (xs[k] + xs[k + 1]) / 2
    }
  }
  return best
}

/** An interior point of the polygon's largest ring, or null. Reports which
 *  method produced it: 'centroid' means the area centroid was already inside,
 *  'scanline' means it was not and the lot is concave enough to have fooled a
 *  centroid-only sampler. */
function interiorPoint(rings: Ring[]): { pt: [number, number]; via: 'centroid' | 'scanline' } | null {
  const usable = rings.filter((r) => r.length >= 4)
  if (!usable.length) return null
  const outer = usable.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a))
  const c = areaCentroid(outer)
  if (c && pointInRing(c[0], c[1], outer)) return { pt: c, via: 'centroid' }
  const ys = outer.map((p) => p[1])
  const lo = Math.min(...ys), hi = Math.max(...ys)
  for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = lo + (hi - lo) * t
    const x = scanlineInterior(outer, y)
    if (x != null && pointInRing(x, y, outer)) return { pt: [x, y], via: 'scanline' }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — sample the layer.
// ─────────────────────────────────────────────────────────────────────────────
export interface Sample {
  city: string
  lat: number
  lng: number
  cell: string
  /** Whether the point came from the area centroid or a scanline rescue —
   *  recorded so "how often is a parcel concave enough to fool a centroid?" is
   *  answerable from the artifact rather than re-derived. */
  via: 'centroid' | 'scanline'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function queryCell(
  url: string,
  env: { xmin: number; ymin: number; xmax: number; ymax: number },
  offset: number,
  timeoutMs = 25000,
  generalize = true,
): Promise<Array<{ geometry?: { rings?: Ring[] } }>> {
  const u = new URL((url.endsWith('/') ? url.slice(0, -1) : url) + '/query')
  u.searchParams.set('where', '1=1')
  // Only the four numbers. Spreading the caller's cell object here once leaked
  // its `id` key into the geometry JSON: 22 servers ignored the stray field and
  // SANDAG's parser threw a geometry NPE on every cell, so San Diego reported as
  // an unsamplable city when the defect was in the sampler (rule 11 — the
  // instrument, not the system).
  u.searchParams.set(
    'geometry',
    JSON.stringify({ xmin: env.xmin, ymin: env.ymin, xmax: env.xmax, ymax: env.ymax, spatialReference: { wkid: 4326 } }),
  )
  u.searchParams.set('geometryType', 'esriGeometryEnvelope')
  u.searchParams.set('inSR', '4326')
  u.searchParams.set('outSR', '4326')
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('outFields', '')
  u.searchParams.set('returnGeometry', 'true')
  // ~2 m — enough to drop vertices without moving an interior point off the lot.
  // SANDAG's hosted San Diego layer throws a server-side geometry NPE on this
  // parameter, so `generalize` turns it off; the caller retries once without it
  // rather than recording the city as unsamplable. (Full geometry is only more
  // faithful — the parameter is a payload optimisation, not a correctness one.)
  if (generalize) u.searchParams.set('maxAllowableOffset', '0.00002')
  u.searchParams.set('resultOffset', String(offset))
  u.searchParams.set('resultRecordCount', '1')
  u.searchParams.set('f', 'json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`sample HTTP ${res.status}`)
    const d = (await res.json()) as { error?: { message?: string }; features?: Array<{ geometry?: { rings?: Ring[] } }> }
    // ArcGIS reports failures as HTTP 200 with an error body — same trap
    // arcgis.ts guards. A sampler that read this as "no parcels" would report a
    // city as unsamplable when the query was simply malformed.
    if (d.error) throw new Error(`sample arcgis_error ${String(d.error.message).slice(0, 120)}`)
    return d.features ?? []
  } finally {
    clearTimeout(timer)
  }
}

async function sampleCity(city: string, target: number): Promise<{ samples: Sample[]; notes: string[] }> {
  const bb = BBOXES[city]
  const url = PARCEL_LAYERS[city]
  const notes: string[] = []
  const out: Sample[] = []
  // A grid, not a random scatter: "spread across the city" is the requirement,
  // and a uniform random draw over a bbox clusters wherever the layer is dense.
  const N = 7
  const cells: Array<{ xmin: number; ymin: number; xmax: number; ymax: number; id: string }> = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const xmin = bb.west + ((bb.east - bb.west) * i) / N
      const xmax = bb.west + ((bb.east - bb.west) * (i + 1)) / N
      const ymin = bb.south + ((bb.north - bb.south) * j) / N
      const ymax = bb.south + ((bb.north - bb.south) * (j + 1)) / N
      cells.push({ xmin, ymin, xmax, ymax, id: `${i},${j}` })
    }
  }
  // Deterministic shuffle so repeated runs sample the same cells in the same
  // order — a re-run that samples a different population cannot be compared to
  // the previous one.
  let seed = 1234567
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  cells.sort(() => rnd() - 0.5)

  // Learned per city on the first error, so the whole run doesn't pay a double
  // request: once a layer has rejected generalisation, stop asking for it.
  let generalize = true
  const cellQuery = async (cell: { xmin: number; ymin: number; xmax: number; ymax: number }, offset: number) => {
    try {
      return await queryCell(url, cell, offset, 25000, generalize)
    } catch (e) {
      if (!generalize) throw e
      generalize = false
      notes.push(`layer rejected maxAllowableOffset (${(e as Error).message.slice(0, 90)}); retrying with full geometry`)
      return await queryCell(url, cell, offset, 25000, false)
    }
  }

  const productive: typeof cells = []
  for (const cell of cells) {
    if (out.length >= target) break
    try {
      const feats = await cellQuery(cell, 0)
      const rings = feats[0]?.geometry?.rings
      if (!rings?.length) continue
      productive.push(cell)
      const p = interiorPoint(rings)
      if (!p) {
        notes.push(`cell ${cell.id}: polygon yielded no interior point`)
        continue
      }
      out.push({ city, lat: quantizeCoord(p.pt[1]), lng: quantizeCoord(p.pt[0]), cell: cell.id, via: p.via })
    } catch (e) {
      notes.push(`cell ${cell.id}: ${(e as Error).message}`)
    }
    await sleep(120)
  }

  // Second pass: deeper into the cells that had parcels, so a city whose bbox is
  // mostly water/another county still reaches the target.
  let off = 500
  while (out.length < target && productive.length && off < 40000) {
    for (const cell of productive) {
      if (out.length >= target) break
      try {
        const feats = await cellQuery(cell, off)
        const rings = feats[0]?.geometry?.rings
        if (!rings?.length) continue
        const p = interiorPoint(rings)
        if (!p) continue
        const lat = quantizeCoord(p.pt[1]), lng = quantizeCoord(p.pt[0])
        if (out.some((s) => s.lat === lat && s.lng === lng)) continue
        out.push({ city, lat, lng, cell: cell.id, via: p.via })
      } catch {
        /* a deep offset failing is not a finding about the city */
      }
      await sleep(120)
    }
    off *= 4
  }

  if (out.length < target) notes.push(`only ${out.length}/${target} sampled`)
  return { samples: out, notes }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — the pipeline, composed exactly as netlify/functions/analyze.ts does.
// ─────────────────────────────────────────────────────────────────────────────
export interface RunRow {
  city: string
  lat: number
  lng: number
  ms: number
  /** RESOLVED / UNCONSTRAINED / GAP describe the gfaBasis the pipeline derived;
   *  NO_SPEC, PARCEL_<code> and EXCEPTION are the non-answers. */
  outcome: string
  attempts: number
  /** The pipeline threw and then succeeded on an isolated retry — rule 10's
   *  case, recorded rather than reported as a defect. */
  transient?: boolean
  parcelId?: string
  address?: string
  districtCode?: string
  lotSqFt?: number | null
  farBasis?: string | null
  gfaBasis?: string
  verdict?: string
  path?: string
  envelopeKnown?: boolean
  developable?: boolean
  developableKind?: string | null
  advisory?: boolean
  maxFloorAreaSqFt?: number | null
  maxHeightFt?: number | null
  maxStories?: number | null
  maxFAR?: number | null
  gfa?: number
  units?: number | null
  use?: string
  costTotal?: number
  costHard?: number
  costImpact?: number
  timelineMonths?: number
  timelinePath?: string
  hurdleCount?: number
  narrativeLen?: number
  error?: string
  stack?: string
  errorPhase?: string
}

/** One parcel through the real composition. Throws are allowed to escape so the
 *  caller can retry in isolation and record the stack. */
async function runOne(city: string, latRaw: number, lngRaw: number): Promise<RunRow> {
  const t0 = Date.now()
  const lat = quantizeCoord(latRaw)
  const lng = quantizeCoord(lngRaw)
  const projectType: ProjectType = 'new'
  const funding: Funding = 'private'

  const parcelResult = await getParcelInfo(city, lat, lng)
  if (!parcelResult.ok) {
    return { city, lat, lng, ms: Date.now() - t0, outcome: `PARCEL_${parcelResult.code}`, attempts: 1, error: parcelResult.message }
  }
  const parcel = parcelResult.info

  // The client builds the spec from the parcel; analyze.ts then re-derives
  // gfaBasis server-side (the query string never carried it — see the comment in
  // analyze.ts). Both halves are exercised here for the same reason.
  const spec = buildDefaultSpec(parcel, city)
  if (!spec) {
    return {
      city, lat, lng, ms: Date.now() - t0, outcome: 'NO_SPEC', attempts: 1,
      parcelId: parcel.parcelId, address: parcel.address,
      districtCode: String(parcel.zoning.districtCode), lotSqFt: parcel.lot.sizeSqFt,
      farBasis: parcel.envelope?.farBasis ?? null,
      maxFloorAreaSqFt: parcel.envelope?.maxFloorAreaSqFt ?? null,
      maxFAR: parcel.zoning.maxFAR ?? null,
    }
  }

  const env = parcel.envelope
  const gfaBasis: AnalysisInput['gfaBasis'] =
    env?.maxFloorAreaSqFt != null && env.maxFloorAreaSqFt > 0
      ? 'envelope'
      : env?.farBasis === 'unconstrained'
        ? 'assumed-unconstrained'
        : 'assumed-far-1.0'

  const project: AnalysisInput = {
    parcelId: parcel.parcelId,
    city,
    projectType,
    funding,
    lat,
    lng,
    use: spec.use,
    gfa: spec.gfa,
    gfaBasis,
    units: spec.units,
    stories: spec.stories,
    heightFt: spec.heightFt,
  }

  let developability = assessDevelopability({
    districtCode: parcel.zoning.districtCode,
    landUse: parcel.existing?.landUse ?? null,
    ownerPublic: parcel.existing?.ownerPublic ?? false,
  })
  if (developability.developable) {
    const civic = assessCivicHardBlock({ city, lat, lng })
    if (civic) developability = { developable: false, kind: 'public', reason: `within ${civic.label}` }
  }
  const advisory = assessSiteAdvisory({
    city,
    districtCode: parcel.zoning.districtCode,
    landUse: parcel.existing?.landUse ?? null,
    lat,
    lng,
  })
  const feasibility = assessFeasibility(parcel, project)
  const hurdles = assessHurdles(city, parcel, project, { path: feasibility.path })
  const hasExistingBuilding = hurdles.some((h) => h.category === 'demolition')
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
  const timeline = { months: timelineInfo.months, path: timelineInfo.path, tier: timelineInfo.tier }

  const ENTITLEMENT_CATS = new Set(['review', 'environmental', 'historic'])
  const PARALLEL_CATS = new Set(['labor'])
  const spine = feasibility.path === 'variance' ? RELIEF_ADD[city] ?? RELIEF_FALLBACK : 0
  const entMonths = hurdles
    .filter((h) => ENTITLEMENT_CATS.has(h.category) && !h.serial && typeof h.addsMonths === 'number')
    .map((h) => h.addsMonths as number)
  const entitlementMax = entMonths.reduce((a, b) => Math.max(a, b), 0)
  const entitlementSum = entMonths.reduce((a, b) => a + b, 0)
  const nested = Math.max(spine, entitlementMax) + 0.5 * (entitlementSum - entitlementMax)
  const serialSum = hurdles.filter((h) => h.serial && typeof h.addsMonths === 'number').reduce((a, h) => a + (h.addsMonths ?? 0), 0)
  const parallelSum = hurdles.filter((h) => PARALLEL_CATS.has(h.category) && typeof h.addsMonths === 'number').reduce((a, h) => a + (h.addsMonths ?? 0), 0)
  const discretionaryMonths = Math.min(24, Math.round(nested + serialSum + parallelSum))
  if (timeline.path !== 'prohibited' && timeline.months > 0) timeline.months += discretionaryMonths

  const narrative = buildNarrative(parcel, project, feasibility, estimate, {
    timelineMonths: timeline.months,
    includesDemolition: timelineInfo.includesDemolition,
    envelopeKnown: feasibility.envelopeKnown,
  })
  // Exercised because they can throw, and a report the user reads is as much
  // part of the response as the number.
  assumptionsSummary(
    city,
    project.stories ?? (project.heightFt != null ? Math.round(project.heightFt / ftPerStory(project.use)) : null),
    project.gfaBasis,
  )
  if (feasibility.path === 'variance') reliefOddsFor(city)

  const result: Pick<AnalysisResult, 'costs' | 'timeline' | 'hurdles'> & { verdict: string } = {
    costs: estimate.costs,
    timeline,
    hurdles,
    verdict: feasibility.overall,
  }
  // analyze.ts's two zeroing branches — omitting them would report costs the
  // API never returns.
  if (!developability.developable) {
    result.costs = { hard: 0, soft: 0, permit: 0, demolition: 0, impact: 0, total: 0, currency: 'USD' }
    result.timeline = { months: 0, path: 'prohibited', tier: timeline.tier }
    result.hurdles = []
    result.verdict = 'INDETERMINATE'
  } else if (feasibility.overall === 'PROHIBITED') {
    result.costs = { hard: 0, soft: 0, permit: 0, demolition: 0, impact: 0, total: 0, currency: 'USD' }
  }

  return {
    city, lat, lng, ms: Date.now() - t0, attempts: 1,
    outcome: gfaBasis === 'envelope' ? 'RESOLVED' : gfaBasis === 'assumed-unconstrained' ? 'UNCONSTRAINED' : 'GAP',
    parcelId: parcel.parcelId,
    address: parcel.address,
    districtCode: String(parcel.zoning.districtCode),
    lotSqFt: parcel.lot.sizeSqFt,
    farBasis: env?.farBasis ?? null,
    gfaBasis,
    verdict: result.verdict,
    path: feasibility.path,
    envelopeKnown: feasibility.envelopeKnown,
    developable: developability.developable,
    developableKind: developability.kind ?? null,
    advisory: advisory != null,
    maxFloorAreaSqFt: env?.maxFloorAreaSqFt ?? null,
    maxHeightFt: env?.maxHeightFt ?? null,
    maxStories: env?.maxStories ?? null,
    maxFAR: parcel.zoning.maxFAR ?? null,
    gfa: project.gfa,
    units: project.units ?? null,
    use: project.use,
    costTotal: result.costs.total,
    costHard: result.costs.hard,
    costImpact: result.costs.impact,
    timelineMonths: result.timeline.months,
    timelinePath: result.timeline.path,
    hurdleCount: result.hurdles.length,
    narrativeLen: narrative.length,
  }
}

/** Rule 10: a transient failure under concurrent load is indistinguishable from
 *  a defect. Nothing is recorded as an exception until three isolated attempts
 *  have thrown — and a throw that later succeeds is kept, marked transient,
 *  because "how flaky is this under load" is itself a finding. */
async function runWithRetry(city: string, lat: number, lng: number): Promise<RunRow> {
  let first: { error: Error; phase: string } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await runOne(city, lat, lng)
      r.attempts = attempt
      if (first) {
        r.transient = true
        r.error = `recovered after throw: ${first.error.message}`
      }
      return r
    } catch (e) {
      const err = e as Error
      if (!first) first = { error: err, phase: 'pipeline' }
      if (attempt === 3) {
        return {
          city, lat, lng, ms: 0, outcome: 'EXCEPTION', attempts: attempt,
          error: err.message, stack: (err.stack ?? '').split('\n').slice(0, 8).join('\n'),
          errorPhase: 'pipeline',
        }
      }
      await sleep(900 * attempt)
    }
  }
  throw new Error('unreachable')
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — the report. Ranked by severity, and the suspicious-success section
// is checked UNCONDITIONALLY rather than in response to something looking odd:
// suspicion is exactly the signal that is missing in the dangerous cases
// (rule 18 — eight of eleven plausible permit numbers were wrong, and the one
// that looked suspicious was the one that got caught).
// ─────────────────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(0) + '%' : '—')
const quant = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] : 0)

/** Collapse a message to its root cause so one bug does not read as N bugs:
 *  strip URLs, ids and numbers that vary per parcel. */
function errorKey(msg: string): string {
  return msg
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b\d[\d.,]*\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

function isBadNum(v: unknown): boolean {
  return typeof v === 'number' && !Number.isFinite(v)
}

interface Suspicion { code: string; detail: string; row: RunRow }

function suspicions(r: RunRow): Suspicion[] {
  const out: Suspicion[] = []
  const ok = r.outcome === 'RESOLVED' || r.outcome === 'UNCONSTRAINED' || r.outcome === 'GAP'
  if (!ok) return out
  for (const [k, v] of Object.entries(r)) if (isBadNum(v)) out.push({ code: 'NAN', detail: `${k}=${String(v)}`, row: r })
  const prohibited = r.verdict === 'PROHIBITED' || r.timelinePath === 'prohibited' || r.developable === false
  if (!prohibited) {
    if ((r.costTotal ?? 0) <= 0) out.push({ code: 'COST_ZERO', detail: `total=${r.costTotal}`, row: r })
    if ((r.timelineMonths ?? 0) <= 0) out.push({ code: 'TIMELINE_ZERO', detail: `months=${r.timelineMonths} verdict=${r.verdict}`, row: r })
    if ((r.hurdleCount ?? 0) === 0) out.push({ code: 'NO_HURDLES', detail: `city has an encoded branch`, row: r })
  }
  if ((r.costTotal ?? 0) < 0 || (r.costHard ?? 0) < 0) out.push({ code: 'COST_NEGATIVE', detail: `total=${r.costTotal} hard=${r.costHard}`, row: r })
  // $/sf outside a band no real construction estimate lands in. Not a claim
  // about the right rate — a claim that these are not rates at all.
  if (r.gfa && r.costTotal && !prohibited) {
    const psf = r.costTotal / r.gfa
    if (psf < 50 || psf > 2000) out.push({ code: 'COST_PER_SF_ABSURD', detail: `$${psf.toFixed(0)}/sf on gfa ${r.gfa}`, row: r })
  }
  // The envelope claims more floor area than the lot × the published FAR.
  if (r.lotSqFt != null && r.lotSqFt > 0 && r.maxFAR != null && r.maxFAR > 0 && r.maxFloorAreaSqFt != null) {
    if (r.maxFloorAreaSqFt > r.lotSqFt * r.maxFAR * 1.02)
      out.push({ code: 'ENVELOPE_OVER_LOT', detail: `${r.maxFloorAreaSqFt} > ${r.lotSqFt}×${r.maxFAR}`, row: r })
  }
  // The default program exceeds the envelope it was derived from.
  if (r.maxFloorAreaSqFt != null && r.maxFloorAreaSqFt > 0 && r.gfa != null && r.gfa > r.maxFloorAreaSqFt * 1.001)
    out.push({ code: 'GFA_OVER_ENVELOPE', detail: `gfa ${r.gfa} > envelope ${r.maxFloorAreaSqFt}`, row: r })
  if (r.lotSqFt != null && r.lotSqFt > 0 && r.lotSqFt < 100)
    out.push({ code: 'LOT_TINY', detail: `lot=${r.lotSqFt} sq ft`, row: r })
  if (r.outcome === 'RESOLVED' && (r.lotSqFt == null || r.lotSqFt <= 0))
    out.push({ code: 'RESOLVED_NO_LOT', detail: `lot=${r.lotSqFt}`, row: r })
  if (r.districtCode === 'Unknown' && r.verdict === 'AS_OF_RIGHT')
    out.push({ code: 'ASOFRIGHT_UNKNOWN_DISTRICT', detail: `verdict on districtCode Unknown`, row: r })
  if (r.envelopeKnown === false && r.verdict === 'AS_OF_RIGHT')
    out.push({ code: 'ASOFRIGHT_NO_ENVELOPE', detail: `envelopeKnown=false`, row: r })
  if ((r.use === 'residential' || r.use === 'mixed') && (r.units ?? 0) <= 0)
    out.push({ code: 'ZERO_UNITS', detail: `use=${r.use} units=${r.units}`, row: r })
  if (r.maxStories != null && (r.maxStories <= 0 || r.maxStories > 120))
    out.push({ code: 'STORIES_ABSURD', detail: `maxStories=${r.maxStories}`, row: r })
  if (r.maxHeightFt != null && (r.maxHeightFt <= 0 || r.maxHeightFt > 1600))
    out.push({ code: 'HEIGHT_ABSURD', detail: `maxHeightFt=${r.maxHeightFt}`, row: r })
  if ((r.narrativeLen ?? 1) === 0) out.push({ code: 'EMPTY_NARRATIVE', detail: 'narrative is empty', row: r })
  return out
}

function report(rows: RunRow[], samples: Sample[]): string {
  const cities = [...new Set(rows.map((r) => r.city))].sort()
  const L: string[] = []
  L.push(`# Multi-parcel live smoke test — ${new Date().toISOString().slice(0, 16)}Z`)
  L.push('')
  L.push(`**${rows.length} parcels attempted across ${cities.length} cities**, sampled from each city's own parcel layer.`)
  L.push('')

  // ── 1. Exceptions ──
  const exc = rows.filter((r) => r.outcome === 'EXCEPTION')
  const transient = rows.filter((r) => r.transient)
  L.push(`## 1. Exceptions — ${exc.length} of ${rows.length} (${pct(exc.length, rows.length)})`)
  L.push('')
  L.push(`Recorded only after **three isolated attempts** threw (rule 10). ${transient.length} further parcels threw once and succeeded on retry — listed separately as transient.`)
  L.push('')
  const groups = new Map<string, RunRow[]>()
  for (const r of exc) {
    const k = errorKey(r.error ?? 'unknown')
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  if (!groups.size) L.push('_None._')
  for (const [k, rs] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const byCity = new Map<string, number>()
    for (const r of rs) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1)
    L.push(`### ${rs.length}× \`${k}\``)
    L.push(`cities: ${[...byCity].map(([c, n]) => `${c}×${n}`).join(', ')}`)
    L.push('```')
    L.push(rs[0].stack ?? '(no stack)')
    L.push('```')
    L.push(`example: ${rs[0].city} ${rs[0].lat},${rs[0].lng}`)
    L.push('')
  }
  if (transient.length) {
    const tg = new Map<string, number>()
    for (const r of transient) tg.set(`${r.city}: ${errorKey(r.error ?? '')}`, (tg.get(`${r.city}: ${errorKey(r.error ?? '')}`) ?? 0) + 1)
    L.push(`### Transient (threw, then recovered in isolation)`)
    for (const [k, n] of [...tg].sort((a, b) => b[1] - a[1])) L.push(`- ${n}× ${k}`)
    L.push('')
  }

  // ── 2. Suspicious successes ──
  const sus = rows.flatMap(suspicions)
  const susByCode = new Map<string, Suspicion[]>()
  for (const s of sus) susByCode.set(s.code, [...(susByCode.get(s.code) ?? []), s])
  L.push(`## 2. Suspicious successes — ${sus.length} findings on ${new Set(sus.map((s) => s.row.lat + ',' + s.row.lng)).size} parcels`)
  L.push('')
  L.push('Every check below runs on every answered parcel, unconditionally.')
  L.push('')
  if (!susByCode.size) L.push('_None._')
  for (const [code, ss] of [...susByCode].sort((a, b) => b[1].length - a[1].length)) {
    const byCity = new Map<string, number>()
    for (const s of ss) byCity.set(s.row.city, (byCity.get(s.row.city) ?? 0) + 1)
    L.push(`### ${code} — ${ss.length}`)
    L.push(`cities: ${[...byCity].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(', ')}`)
    for (const s of ss.slice(0, 4))
      L.push(`- \`${s.row.city}\` ${s.row.lat},${s.row.lng} \`${s.row.districtCode}\` — ${s.detail}`)
    if (ss.length > 4) L.push(`- …and ${ss.length - 4} more`)
    L.push('')
  }

  // ── 3. Per city ──
  L.push('## 3. Per city')
  L.push('')
  L.push('| city | n | RESOLVED | UNCONSTR | GAP | NO_SPEC | parcel-err | EXC | INDET | as-of-right | median ms | p90 ms | max ms |')
  L.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
  for (const c of cities) {
    const rs = rows.filter((r) => r.city === c)
    const n = rs.length
    const cnt = (f: (r: RunRow) => boolean) => rs.filter(f).length
    const answered = rs.filter((r) => r.verdict)
    const ms = rs.map((r) => r.ms).filter((m) => m > 0)
    L.push(
      `| ${c} | ${n} | ${cnt((r) => r.outcome === 'RESOLVED')} | ${cnt((r) => r.outcome === 'UNCONSTRAINED')} | ${cnt((r) => r.outcome === 'GAP')} | ${cnt((r) => r.outcome === 'NO_SPEC')} | ${cnt((r) => r.outcome.startsWith('PARCEL_'))} | ${cnt((r) => r.outcome === 'EXCEPTION')} | ${cnt((r) => r.verdict === 'INDETERMINATE')} (${pct(cnt((r) => r.verdict === 'INDETERMINATE'), answered.length)}) | ${cnt((r) => r.verdict === 'AS_OF_RIGHT')} | ${quant(ms, 0.5)} | ${quant(ms, 0.9)} | ${Math.max(0, ...ms)} |`,
    )
  }
  L.push('')

  // ── 4. Parcel-level non-answers ──
  const perr = new Map<string, number>()
  for (const r of rows.filter((r) => r.outcome.startsWith('PARCEL_') || r.outcome === 'NO_SPEC'))
    perr.set(`${r.city} ${r.outcome}`, (perr.get(`${r.city} ${r.outcome}`) ?? 0) + 1)
  L.push('## 4. Non-answers by kind')
  L.push('')
  for (const [k, n] of [...perr].sort((a, b) => b[1] - a[1])) L.push(`- ${n}× ${k}`)
  L.push('')

  // ── 5. Timing ──
  const allMs = rows.map((r) => r.ms).filter((m) => m > 0)
  L.push('## 5. Timing')
  L.push('')
  L.push(`median ${quant(allMs, 0.5)} ms · p90 ${quant(allMs, 0.9)} ms · p99 ${quant(allMs, 0.99)} ms · max ${Math.max(0, ...allMs)} ms`)
  L.push('')
  const slow = rows.filter((r) => r.ms > 10000)
  L.push(`**${slow.length} parcels took over 10 s** — the Netlify function wall clock.`)
  for (const r of slow.slice(0, 20)) L.push(`- ${r.city} ${r.lat},${r.lng} ${r.ms} ms → ${r.outcome}`)
  L.push('')

  // ── 6. District codes seen ──
  L.push('## 6. Districts observed (breadth of the sample)')
  L.push('')
  for (const c of cities) {
    const ds = [...new Set(rows.filter((r) => r.city === c && r.districtCode).map((r) => r.districtCode!))]
    L.push(`- **${c}** — ${ds.length} distinct: ${ds.slice(0, 14).join(', ')}${ds.length > 14 ? ' …' : ''}`)
  }
  L.push('')
  const scan = samples.filter((s) => s.via === 'scanline').length
  L.push(`_Sampling: ${samples.length} points, ${scan} of which needed a scanline interior point because the lot's area centroid fell outside its own polygon._`)
  return L.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
  const outDir = flag('out') ?? '/tmp/smoke-parcels'
  const per = Number(flag('per') ?? 25)
  const only = flag('cities')?.split(',').filter(Boolean)
  const cities = only?.length ? only : CITIES
  const phases = ['--sample', '--run', '--report'].filter((p) => argv.includes(p))
  const doSample = phases.length === 0 || phases.includes('--sample')
  const doRun = phases.length === 0 || phases.includes('--run')
  const doReport = phases.length === 0 || phases.includes('--report')
  mkdirSync(outDir, { recursive: true })
  const samplePath = join(outDir, 'samples.json')
  const rowsPath = join(outDir, 'rows.json')

  if (doSample) {
    console.log(`[sample] ${cities.length} cities × ${per}`)
    const all: Sample[] = existsSync(samplePath) && only ? JSON.parse(readFileSync(samplePath, 'utf8')) : []
    const kept = all.filter((s) => !cities.includes(s.city))
    // Four cities at a time: each cell query is one request to one host, and a
    // burst against a Cloudflare-fronted municipal GIS reads as an attack.
    const queue = [...cities]
    const workers = Array.from({ length: 4 }, async () => {
      for (;;) {
        const c = queue.shift()
        if (!c) return
        const t0 = Date.now()
        const { samples, notes } = await sampleCity(c, per)
        kept.push(...samples)
        console.log(`[sample] ${c}: ${samples.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s${notes.length ? ` · ${notes.slice(0, 3).join('; ')}` : ''}`)
      }
    })
    await Promise.all(workers)
    writeFileSync(samplePath, JSON.stringify(kept, null, 1))
    console.log(`[sample] wrote ${kept.length} → ${samplePath}`)
  }

  if (doRun) {
    const samples: Sample[] = JSON.parse(readFileSync(samplePath, 'utf8'))
    const todo = samples.filter((s) => cities.includes(s.city))
    console.log(`[run] ${todo.length} parcels`)
    const byCity = new Map<string, Sample[]>()
    for (const s of todo) (byCity.get(s.city) ?? byCity.set(s.city, []).get(s.city)!).push(s)
    const rows: RunRow[] = []
    const queue = [...byCity.keys()]
    // One request in flight per city, four cities at once, 250 ms between
    // parcels. A burst gets throttled and the throttling looks like a defect.
    const workers = Array.from({ length: 4 }, async () => {
      for (;;) {
        const c = queue.shift()
        if (!c) return
        const t0 = Date.now()
        for (const s of byCity.get(c)!) {
          const r = await runWithRetry(c, s.lat, s.lng)
          rows.push(r)
          await sleep(250)
        }
        console.log(`[run] ${c}: ${byCity.get(c)!.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      }
    })
    await Promise.all(workers)
    writeFileSync(rowsPath, JSON.stringify(rows, null, 1))
    console.log(`[run] wrote ${rows.length} → ${rowsPath}`)
  }

  if (doReport) {
    const rows: RunRow[] = JSON.parse(readFileSync(rowsPath, 'utf8'))
    const samples: Sample[] = JSON.parse(readFileSync(samplePath, 'utf8'))
    // A check that can pass by finding nothing is not a check (rule 20): refuse
    // to emit a report over an empty or partial run rather than print a clean
    // one that means "nothing was measured".
    if (!rows.length) throw new Error('report: zero rows — nothing was measured')
    const missing = CITIES.filter((c) => !rows.some((r) => r.city === c))
    if (missing.length && !only) throw new Error(`report: no rows for ${missing.join(', ')} — a city absent from the input set cannot be reported as clean`)
    const md = report(rows, samples)
    const p = join(outDir, 'REPORT.md')
    writeFileSync(p, md)
    console.log(`[report] wrote ${p}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
