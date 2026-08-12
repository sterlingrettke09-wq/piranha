// Before/after harness for the buildDefaultSpec GFA-clamp defect.
//
// REAL ENTRY POINT (rule 11). The user-facing chain is:
//   parcel panel → buildDefaultSpec → instantReportUrl → /result → /api/analyze
// so this script runs getParcelInfo → buildDefaultSpec → the ACTUAL
// `netlify/functions/analyze.ts` handler with the query string the panel would
// have built. Nothing downstream is re-implemented: the verdict, cost and
// timeline printed here are the ones the API returns.
//
//   npx vite-node scripts/verify-clamp.ts --out=FILE

import { writeFileSync } from 'node:fs'
import { getParcelInfo } from '../netlify/functions/lib/parcel'
import { buildDefaultSpec } from '../src/lib/defaultSpec'
import { handler } from '../netlify/functions/analyze'
import type { AnalysisResult } from '../src/types/analysis'

interface Case { city: string; lat: number; lng: number; label: string; group: string }

// Drawn from the smoke sample's rows.json. The four GFA_OVER_ENVELOPE parcels
// are the defect; every other group is a control that must NOT move.
const CASES: Case[] = [
  // ── the defect: proposal exceeded the envelope it was derived from ──
  { group: 'A. gfa > envelope', city: 'atlanta', lat: 33.706798, lng: -84.483104, label: 'RG-2 lot 870 / env 303' },
  { group: 'A. gfa > envelope', city: 'atlanta', lat: 33.803985, lng: -84.338567, label: 'C-1 lot 1030 / env 717' },
  { group: 'A. gfa > envelope', city: 'boston', lat: 42.282121, lng: -71.132137, label: '2F-5000 lot 775 / env 388' },
  { group: 'A. gfa > envelope', city: 'chicago', lat: 41.993957, lng: -87.748728, label: 'RS-3 lot 1062 / env 956' },
  // ── control: small envelopes that already fit; must be byte-identical ──
  { group: 'B. small envelope, no overage', city: 'boston', lat: 42.297282, lng: -71.11117, label: '3F-5000 env 1995' },
  { group: 'B. small envelope, no overage', city: 'chicago', lat: 41.825205, lng: -87.694277, label: 'RS-3 env 2817' },
  { group: 'B. small envelope, no overage', city: 'boston', lat: 42.336869, lng: -71.044468, label: 'MFR env 2218' },
  { group: 'B. small envelope, no overage', city: 'chicago', lat: 41.907901, lng: -87.66976, label: 'RT-4 env 2881' },
  { group: 'B. small envelope, no overage', city: 'boston', lat: 42.323063, lng: -71.075061, label: 'RH env 3555' },
  // ── control: NO envelope resolved — nothing to clamp against ──
  { group: 'C. no envelope (assumed-*)', city: 'sf', lat: 37.758892, lng: -122.494622, label: 'RH-1 lot 37, unconstrained' },
  { group: 'C. no envelope (assumed-*)', city: 'dc', lat: 38.851469, lng: -76.974398, label: 'R-2 lot 976, unconstrained' },
  { group: 'C. no envelope (assumed-*)', city: 'seattle', lat: 47.611783, lng: -122.283228, label: 'NR lot 1164, far-1.0' },
  { group: 'C. no envelope (assumed-*)', city: 'philadelphia', lat: 39.99299, lng: -75.13093, label: 'RSA-5, unconstrained' },
  { group: 'C. no envelope (assumed-*)', city: 'nashville', lat: 36.048705, lng: -86.850449, label: 'R10 lot 436, far-1.0' },
  // ── control: the CEILING, the separate question ──
  { group: 'D. ceiling (gfa = 200,000)', city: 'milwaukee', lat: 43.193711, lng: -88.06486, label: 'IL1 lot 624,389' },
  { group: 'D. ceiling (gfa = 200,000)', city: 'nyc', lat: 40.666452, lng: -74.011819, label: 'M3-1 env 6,255,670' },
  { group: 'D. ceiling (gfa = 200,000)', city: 'nyc', lat: 40.55689, lng: -73.92073, label: 'R4 env 12,253,428' },
  // ── control: ordinary mid-size parcels ──
  { group: 'E. ordinary', city: 'dc', lat: 38.898804, lng: -76.974336, label: 'MU-5A env 25,830' },
  { group: 'E. ordinary', city: 'boston', lat: 42.251549, lng: -71.122096, label: '1F-6000 env 36,028' },
]

interface Out {
  group: string; city: string; label: string; lat: number; lng: number
  lotSqFt: number | null; envelope: number | null; farBasis: string | null
  spec: 'declined' | 'built'; gfa: number | null; units: number | null; use: string | null
  gfaBasis: string | null; verdict: string | null; path: string | null
  cost: number | null; months: number | null; status: number | null; err?: string
}

let ipSeq = 0

async function once(c: Case): Promise<Out> {
  const base: Out = {
    group: c.group, city: c.city, label: c.label, lat: c.lat, lng: c.lng,
    lotSqFt: null, envelope: null, farBasis: null, spec: 'declined', gfa: null, units: null,
    use: null, gfaBasis: null, verdict: null, path: null, cost: null, months: null, status: null,
  }
  const pr = await getParcelInfo(c.city, c.lat, c.lng)
  if (!pr.ok) return { ...base, err: `PARCEL_${pr.code}` }
  const p = pr.info
  base.lotSqFt = p.lot.sizeSqFt
  base.envelope = p.envelope?.maxFloorAreaSqFt ?? null
  base.farBasis = p.envelope?.farBasis ?? null

  // Exactly what the parcel panel does.
  const spec = buildDefaultSpec(p, c.city)
  if (!spec) return base // no instant report offered; the panel shows "Start full analysis"
  base.spec = 'built'
  base.gfa = spec.gfa
  base.units = spec.units ?? null
  base.use = spec.use

  // Exactly the query string instantReportUrl() builds, through the real handler.
  const q: Record<string, string> = {
    city: spec.city, parcelId: spec.parcelId, lat: String(spec.lat), lng: String(spec.lng),
    use: spec.use, gfa: String(spec.gfa), projectType: spec.projectType, funding: spec.funding,
  }
  if (spec.units != null) q.units = String(spec.units)
  if (spec.stories != null) q.stories = String(spec.stories)
  if (spec.heightFt != null) q.heightFt = String(spec.heightFt)

  // A distinct client IP per call. The handler's per-IP rate limit (20/min) is
  // production behaviour for ONE visitor; 20 parcels from one harness would trip
  // it and every row would come back RATE_LIMITED instead of a verdict — the
  // instrument measuring itself rather than the pipeline (rule 11).
  const ip = `203.0.113.${(ipSeq++ % 250) + 1}`
  const res = await handler({ queryStringParameters: q, headers: { 'x-forwarded-for': ip } } as never)
  base.status = res.statusCode
  const body = JSON.parse(res.body) as AnalysisResult & { code?: string; message?: string }
  if (res.statusCode !== 200) return { ...base, err: `${body.code}: ${body.message}` }
  base.gfaBasis = body.project.gfaBasis ?? null
  base.verdict = body.feasibility.overall
  base.path = body.timeline.path
  base.cost = body.costs.total
  base.months = body.timeline.months
  return base
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1]
  const rows: Out[] = []
  for (const c of CASES) {
    // Rule 10: two isolated passes; a row that disagrees with itself is not
    // evidence of anything and is marked rather than reported.
    const a = await once(c)
    await sleep(400)
    const b = await once(c)
    const key = (o: Out) => [o.lotSqFt, o.envelope, o.spec, o.gfa, o.verdict, o.cost, o.months].join('|')
    if (key(a) !== key(b)) a.err = `UNSTABLE across two isolated probes: ${key(a)} vs ${key(b)}`
    rows.push(a)
    console.log(
      `${a.city.padEnd(13)} ${a.label.padEnd(34)} lot=${String(a.lotSqFt).padStart(9)} env=${String(a.envelope).padStart(10)} ` +
      `spec=${a.spec.padEnd(8)} gfa=${String(a.gfa).padStart(7)} ${String(a.verdict).padEnd(14)} ` +
      `$${String(a.cost).padStart(10)} ${String(a.months).padStart(3)}mo ${a.err ?? ''}`,
    )
    await sleep(400)
  }
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
