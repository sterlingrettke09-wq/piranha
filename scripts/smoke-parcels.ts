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
//   npx vite-node scripts/smoke-parcels.ts --rates    # phase 4 only (reuses rows)
//   npx vite-node scripts/smoke-parcels.ts            # all four
//
// Flags: --per=N (parcels per city, default 25) --cities=a,b --out=DIR
//
// NOT included, deliberately: logSearch (a Netlify Blobs write — a side effect,
// not a computation) and the Mapbox reverse geocode where no token is
// configured. Both are named in the report rather than silently skipped.
//
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 (added 2026-08-12) — THE COMMITTED RATE ARTIFACT
//
// This run measured what `docs/NULL-INVENTORY.md` and the /math coverage matrix
// were both getting wrong: the inventory probes ONE hand-picked parcel per city
// and its verdict was being read as a statement about the city. Denver's golden
// parcel is `G-MU-5`, a current form-based DZC district that resolves; the
// sample drew `R-2` / `O-1` / `I-B` / `H-1-A`, former Chapter 59 codes that fall
// through. Denver withheld a verdict on 4 of the 6 developable parcels it
// answered for, and rendered in both places exactly like Chicago, which withheld
// none. That is not a reporting bug — it is n=1 doing what n=1 always does.
//
// So this phase reduces `rows.json` to a per-city PARTITION of the sample and
// writes it to `netlify/functions/lib/data/envelopeSample.json`, alongside
// permitStats.json and reliefStats.json — the committed artifacts the app reads.
// The matrix and the inventory then DERIVE their envelope claim from a measured
// rate instead of from a boolean `live` flag.
//
// COUNTS ARE STORED, RATES ARE NOT. A stored `0.33` is a second source of truth
// that can disagree with its own numerator; the share is computed where it is
// read (`src/config/envelopeSample.ts`). The buckets must also PARTITION the
// sample — `assertPartition` throws otherwise — because a parcel landing outside
// every bucket would shrink a denominator silently, and a rate whose denominator
// quietly drops the hard cases is the flattering-measurement failure this file
// exists to catch.
//
// The live run is NOT part of `npm test`: it hits 23 municipal GIS services and
// takes about an hour. The committed artifact is what ships, exactly as with the
// permit pipelines.

import { interiorPoint, type Ring } from '../netlify/functions/lib/interiorPoint'
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Aliased: this file's own `CITIES` is the set of parcel layers below. The
// registry is what the artifact must be complete against.
import { CITIES as REGISTRY_CITIES } from '../src/config/cities'

import type { AnalysisInput, AnalysisResult, Funding, ProjectType } from '../src/types/analysis'
import { getParcelInfo } from '../netlify/functions/lib/parcel'
import { buildDefaultSpec } from '../src/lib/defaultSpec'
import { deriveGfaBasis } from '../src/lib/gfaBasis'
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
  // NULL, not undefined: the sampler must be able to tell "this parcel produced
  // no construction cost because no rate covers its product" from "this field
  // was never populated". Collapsing them would make a coverage gap look like a
  // sampler bug, or worse, the reverse.
  costTotal?: number | null
  costHard?: number | null
  costImpact?: number | null
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
  // THE SAME derivation the live handler uses, not a copy of it. This block was
  // a copy, and when a fourth farBasis landed the copy kept mapping LA to
  // 'assumed-far-1.0' — so the sampler would have measured every LA parcel as a
  // GAP while the product called it something else entirely. Measuring a
  // reimplementation of the pipeline measures the reimplementation (rule 11).
  const gfaBasis: AnalysisInput['gfaBasis'] = deriveGfaBasis(env)

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
    outcome:
      gfaBasis === 'envelope'
        ? 'RESOLVED'
        : gfaBasis === 'assumed-unconstrained'
          ? 'UNCONSTRAINED'
          : gfaBasis === 'assumed-planned-development'
            ? 'PLANNED_DEVELOPMENT'
            : gfaBasis === 'assumed-basis-unavailable'
              ? 'BASIS_UNAVAILABLE'
              : 'GAP',
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
  const ok =
    r.outcome === 'RESOLVED' ||
    r.outcome === 'UNCONSTRAINED' ||
    r.outcome === 'BASIS_UNAVAILABLE' ||
    r.outcome === 'GAP'
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
// Phase 4 — reduce the run to the committed rate artifact.
// ─────────────────────────────────────────────────────────────────────────────

/** Where the artifact lands, relative to the repo root. Alongside the other two
 *  committed measurement artifacts the app imports. */
export const ENVELOPE_SAMPLE_PATH = 'netlify/functions/lib/data/envelopeSample.json'

/** One city's sample, as a partition of the parcels attempted for it.
 *
 *  Every field is a COUNT. The share is derived where it is read, so there is
 *  exactly one place a rate can come from and it cannot drift from its own
 *  numerator. */
export interface CityEnvelopeSample {
  /** Parcels drawn from this city's own parcel layer and pushed through the
   *  pipeline. The top of the funnel — every other field is a subset. */
  attempted: number

  // ── Non-answers. Excluded from the denominator, printed anyway. ──
  //
  // Rule 5: these are not envelope failures and must not be counted as any. But
  // they are also not nothing — they shrink `developable`, and a rate off a
  // denominator of 9 is a different claim from the same rate off 25. Las Vegas
  // attempted 25 and answered 9.
  /** The sampler drew a parcel the runtime city gate then rejected — the layer
   *  is regional, the bbox is not. A fact about the SAMPLER, not the city. */
  outOfCity: number
  /** The point resolved to no parcel at all. */
  noParcel: number
  /** The provider or an upstream service failed the call. */
  upstreamError: number
  /** Three isolated attempts threw. */
  exception: number
  /** The parcel resolved and `buildDefaultSpec` declined — an answer about the
   *  parcel (too small for the smallest default program), not a gap. */
  noSpec: number

  // ── Answered. ──
  /** Answered, and `assessDevelopability` said no — public land, a civic hard
   *  block, a barred land use. analyze.ts zeroes these, so they measure the
   *  block rather than the city's regulatory encoding (the recorded San Diego /
   *  San Jose probe failure) and are excluded from the denominator. */
  nonDevelopable: number
  /** THE DENOMINATOR: answered, and developable. The population the envelope
   *  claim is actually about. */
  developable: number

  // ── The denominator, split four ways.
  //    resolved + unconstrained + plannedDevelopment + basisUnavailable
  //      + gap === developable. ──
  /** `gfaBasis: 'envelope'` — a district FAR or height came back from published
   *  data and sized the envelope. */
  resolved: number
  /** `gfaBasis: 'assumed-unconstrained'` — the code affirmatively imposes no
   *  FAR here. An ANSWER, not a gap (rule 5), so it counts as resolved. */
  unconstrained: number
  /** `gfaBasis: 'assumed-planned-development'` — the parcel is in a district
   *  whose standards come from its own ordinance rather than a district table.
   *  A limit EXISTS and is not in any table, so this is NOT a failure to look.
   *  Deliberately NOT counted as resolved either: no envelope was produced.
   *  It is broken out so the gap figure stops overstating how much is unread. */
  plannedDevelopment: number
  /** `gfaBasis: 'assumed-basis-unavailable'` — the district's FAR IS published
   *  and the area the code applies it to is not obtainable, so no envelope can
   *  be computed from it. LA: § 12.21.1 A.1 states every ratio against Buildable
   *  Area, the lot minus its required yards, and the required front yard is the
   *  PREVAILING setback — the average of the front yards already built on the
   *  street. Nothing we fetch carries it.
   *
   *  Like `plannedDevelopment`: NOT resolved (no envelope was produced) and NOT
   *  a gap (somebody looked, and the answer is that it cannot be applied).
   *  Folding it into `gap` was the first thing this bucket's absence did — it
   *  reported LA at 0% EXPLAINED, i.e. "nobody has looked at this city", which
   *  is the rule 5 collapse one level up in the instrument. */
  basisUnavailable: number
  /** `gfaBasis: 'assumed-far-1.0'` — nothing resolved and the pipeline fell
   *  through to an assumed FAR. The verdict is withheld. */
  gap: number
  /** Of the developable parcels, how many ended INDETERMINATE. Tracked
   *  separately from `gap` because they are NOT the same set: Miami's sample has
   *  10 gaps and 9 indeterminates — one gap parcel came back PROHIBITED, which
   *  is a verdict, not a withheld one. */
  indeterminate: number
  /** The date the run that produced these counts finished. Per city, so a
   *  partial re-run of one city does not restamp the other 22. */
  sampledOn: string
}

export interface EnvelopeSampleArtifact {
  /** How it was made, so the next reader does not have to guess the entry point. */
  source: string
  cities: Record<string, CityEnvelopeSample>
}

/** The buckets must cover every attempted parcel exactly once.
 *
 *  Without this, an outcome string nobody anticipated falls out of the partition
 *  and lands nowhere: `attempted` still reads 25, `developable` quietly drops to
 *  9, and the share goes UP because the hard cases left the denominator. That is
 *  the exact shape of a measurement that flatters (rule 18), so it is a throw
 *  rather than a warning. */
function assertPartition(city: string, s: CityEnvelopeSample): void {
  const counted =
    s.outOfCity + s.noParcel + s.upstreamError + s.exception + s.noSpec + s.nonDevelopable + s.developable
  if (counted !== s.attempted)
    throw new Error(`envelope sample: ${city} attempted ${s.attempted} but ${counted} were bucketed — an outcome the partition does not cover`)
  const split = s.resolved + s.unconstrained + s.plannedDevelopment + s.basisUnavailable + s.gap
  if (split !== s.developable)
    throw new Error(
      `envelope sample: ${city} has ${s.developable} developable but ${split} in resolved/unconstrained/plannedDevelopment/basisUnavailable/gap`,
    )
}

/** Reduce raw run rows to the per-city partition. Pure — the aggregation is the
 *  part worth testing, and it must be testable without a live run. */
export function aggregateEnvelopeSample(rows: RunRow[], sampledOn: string): Record<string, CityEnvelopeSample> {
  const out: Record<string, CityEnvelopeSample> = {}
  for (const city of [...new Set(rows.map((r) => r.city))].sort()) {
    const rs = rows.filter((r) => r.city === city)
    // Every outcome that means "the pipeline answered for this parcel" must be
    // listed here, or it silently leaves the denominator: `attempted` still
    // reads 25 while `developable` drops, and the share goes UP because a hard
    // case left the bottom of the fraction. Adding PLANNED_DEVELOPMENT to the
    // partition without adding it here did exactly that, and assertPartition
    // threw on the very first live run — which is the only reason it is not in
    // the committed artifact.
    const answered = rs.filter(
      (r) =>
        r.outcome === 'RESOLVED' ||
        r.outcome === 'UNCONSTRAINED' ||
        r.outcome === 'PLANNED_DEVELOPMENT' ||
        // The pipeline ANSWERED for this parcel — it produced a published FAR
        // and established that the area it applies to is unobtainable. Omitting
        // it here would drop the parcel out of the DENOMINATOR, which is the
        // Dallas defect from 2026-08-12 exactly: the share went UP because the
        // parcel left the bottom of the fraction.
        r.outcome === 'BASIS_UNAVAILABLE' ||
        r.outcome === 'GAP',
    )
    const dev = answered.filter((r) => r.developable === true)
    const s: CityEnvelopeSample = {
      attempted: rs.length,
      outOfCity: rs.filter((r) => r.outcome === 'PARCEL_OUT_OF_BBOX').length,
      noParcel: rs.filter((r) => r.outcome === 'PARCEL_NO_PARCEL').length,
      upstreamError: rs.filter(
        (r) => r.outcome.startsWith('PARCEL_') && r.outcome !== 'PARCEL_OUT_OF_BBOX' && r.outcome !== 'PARCEL_NO_PARCEL',
      ).length,
      exception: rs.filter((r) => r.outcome === 'EXCEPTION').length,
      noSpec: rs.filter((r) => r.outcome === 'NO_SPEC').length,
      nonDevelopable: answered.length - dev.length,
      developable: dev.length,
      resolved: dev.filter((r) => r.outcome === 'RESOLVED').length,
      unconstrained: dev.filter((r) => r.outcome === 'UNCONSTRAINED').length,
      plannedDevelopment: dev.filter((r) => r.outcome === 'PLANNED_DEVELOPMENT').length,
      basisUnavailable: dev.filter((r) => r.outcome === 'BASIS_UNAVAILABLE').length,
      gap: dev.filter((r) => r.outcome === 'GAP').length,
      indeterminate: dev.filter((r) => r.verdict === 'INDETERMINATE').length,
      sampledOn,
    }
    assertPartition(city, s)
    out[city] = s
  }
  return out
}

/** Merge a run's cities over whatever the artifact already held.
 *
 *  A partial run (`--cities=denver`) must update Denver and leave the other 22
 *  alone — but each surviving entry keeps its OWN `sampledOn`, so the artifact
 *  can never present a stale city as freshly measured. This is why the date is
 *  per city and not a single file-level stamp. */
export function mergeEnvelopeSample(
  prior: Record<string, CityEnvelopeSample>,
  fresh: Record<string, CityEnvelopeSample>,
): Record<string, CityEnvelopeSample> {
  const merged = { ...prior, ...fresh }
  return Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]))
}

/** Rule 20 on the artifact itself: it must not be publishable by finding
 *  nothing. Refuses to write when the run measured no parcels, when a live city
 *  has no entry at all, or when an entry has an empty denominator — an
 *  unsampled city is not a resolving one, and a `0/0` that renders as a blank is
 *  indistinguishable from a healthy city.
 *
 *  Returns the messages rather than throwing on the first, so one run reports
 *  every hole instead of one. */
export function envelopeSampleFaults(cities: Record<string, CityEnvelopeSample>): string[] {
  const faults: string[] = []
  const live = REGISTRY_CITIES.filter((c) => c.live).map((c) => c.slug)
  if (Object.keys(cities).length === 0) faults.push('the artifact is EMPTY — nothing was measured; do not commit it')
  for (const slug of live) {
    const s = cities[slug]
    if (!s) {
      faults.push(`${slug} is live and has NO entry — run the sampler for it; an unsampled city is not a clean one`)
      continue
    }
    if (s.attempted === 0) faults.push(`${slug} attempted 0 parcels — an empty sample must not read as coverage`)
    else if (s.developable === 0)
      faults.push(
        `${slug} answered 0 developable parcels of ${s.attempted} attempted — there is no denominator, so there is no rate`,
      )
  }
  for (const slug of Object.keys(cities))
    if (!live.includes(slug)) faults.push(`${slug} carries a sample but is not a live registry city`)
  // The sampler's own coverage, which is invisible from the rows: a city with no
  // parcel layer here is never sampled, so it can never appear as a fault above.
  for (const slug of live)
    if (!PARCEL_LAYERS[slug]) faults.push(`${slug} is live but has no parcel layer in this script — it cannot be sampled at all`)
  return faults
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
  const outDir = flag('out') ?? '/tmp/smoke-parcels'
  const per = Number(flag('per') ?? 25)
  const only = flag('cities')?.split(',').filter(Boolean)
  const cities = only?.length ? only : CITIES
  const phases = ['--sample', '--run', '--report', '--rates'].filter((p) => argv.includes(p))
  const doSample = phases.length === 0 || phases.includes('--sample')
  const doRun = phases.length === 0 || phases.includes('--run')
  const doReport = phases.length === 0 || phases.includes('--report')
  const doRates = phases.length === 0 || phases.includes('--rates')
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

  if (doRates) {
    const rows: RunRow[] = JSON.parse(readFileSync(rowsPath, 'utf8'))
    if (!rows.length) throw new Error('rates: zero rows — nothing was measured')
    // The run's own completion time, taken from the file the counts come from.
    // Not `new Date()`: re-reducing an old rows.json a week later would restamp
    // every city as freshly measured, which is the stale-entry failure the null
    // inventory's per-row timestamps exist to prevent.
    const sampledOn = statSync(rowsPath).mtime.toISOString().slice(0, 10)
    const fresh = aggregateEnvelopeSample(rows, sampledOn)
    const prior: Record<string, CityEnvelopeSample> = existsSync(ENVELOPE_SAMPLE_PATH)
      ? (JSON.parse(readFileSync(ENVELOPE_SAMPLE_PATH, 'utf8')) as EnvelopeSampleArtifact).cities
      : {}
    const merged = mergeEnvelopeSample(prior, fresh)

    // Refuse to WRITE a hollow artifact rather than write it and warn. The file
    // is committed and read by the coverage matrix; a warning scrolls past and
    // the file ships.
    const faults = envelopeSampleFaults(merged)
    if (faults.length) {
      console.error(`\n[rates] REFUSING TO WRITE — ${faults.length} fault(s):`)
      for (const f of faults) console.error(`  · ${f}`)
      process.exitCode = 1
      return
    }

    const artifact: EnvelopeSampleArtifact = {
      source:
        'scripts/smoke-parcels.ts --rates, reduced from a live multi-parcel run over each city\'s own parcel layer. Counts only; shares are derived in src/config/envelopeSample.ts.',
      cities: merged,
    }
    writeFileSync(ENVELOPE_SAMPLE_PATH, JSON.stringify(artifact, null, 2) + '\n')
    const totals = Object.values(merged).reduce(
      (a, s) => ({ n: a.n + s.developable, ok: a.ok + s.resolved + s.unconstrained }),
      { n: 0, ok: 0 },
    )
    console.log(
      `[rates] wrote ${ENVELOPE_SAMPLE_PATH} — ${Object.keys(merged).length} cities, ${totals.ok}/${totals.n} developable parcels resolved an envelope`,
    )
  }
}

// Importing this module (the colocated test does) must not fire a 575-parcel
// live run. Same guard, and the same reasoning, as `null-inventory.ts`: it FAILS
// OPEN — it runs unless it can see it is under Vitest — because an
// is-this-the-entry-point check silently no-ops under any runner whose `argv[1]`
// it does not recognise, and a measurement tool that quietly does nothing is the
// exact failure this file exists to prevent.
if (process.env.VITEST == null)
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
