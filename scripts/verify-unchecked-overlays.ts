// Before/after harness for S4: "a failed OPTIONAL overlay read silently REMOVES
// requirements".
//
// The defect. `hurdles.ts` reads `overlays.historicDistrict` / `coastalZone` /
// `floodZone` as booleans. Each is `X | null`, and null collapses two facts —
// the layer answered and nothing covers this parcel (an ANSWER), or the layer
// did not answer (a GAP). On the GAP the hurdle the layer would have produced
// simply does not appear, and the months it carries leave the timeline with it.
// Nothing in the response says a check was skipped, so the report reads exactly
// like a parcel that is genuinely clear (CLAUDE.md rule 18).
//
// REAL ENTRY POINT (CLAUDE.md rule 11). Every row goes through the ACTUAL
// `netlify/functions/analyze.ts` handler with the query string the result page
// builds, against LIVE upstream services. Exactly one layer is perturbed per
// run — `globalThis.fetch` throws for URLs containing one substring, everything
// else is untouched — so the diff against the control is the layer, not the
// harness.
//
//   npx vite-node scripts/verify-unchecked-overlays.ts --out=FILE
//
// Delete this file if the harness is not wanted; `uncheckedOverlays.test.ts` is
// the permanent, offline record of the same invariant.

import { writeFileSync } from 'node:fs'
import { handler } from '../netlify/functions/analyze'
import type { AnalysisResult } from '../src/types/analysis'

interface Case {
  id: string
  city: string
  lat: number
  lng: number
  label: string
  q: Record<string, string>
  /** URL substring to fault. Undefined = the control run. */
  fail?: string
}

// Parcels probed live 2026-08-12 and chosen so the OVERLAY is what moves. Each
// pair differs only in the overlay under test; none is on a no-net-loss teardown
// (a PROHIBITED verdict zeroes the timeline and would mask the months).
//
// LA — 1126 Abbot Kinney Blvd, Venice (C2-1-O-CA, a parking lot). Inside the
// California Coastal Zone, so the Coastal Development Permit fires: `serial:
// true, addsMonths: 9`, and serial hurdles add IN FULL at analyze.ts:245.
const LA_COASTAL = { city: 'la', lat: 33.9915, lng: -118.4695, label: 'Venice, Abbot Kinney — inside the Coastal Zone' }
// LA — 765 Irolo St, Koreatown (C2-1). Well inland: the control that proves the
// fix does NOT fire where the layer answered "no coastal zone here".
const LA_INLAND = { city: 'la', lat: 34.0578, lng: -118.3009, label: 'Koreatown, Irolo St — outside the Coastal Zone' }
// Boston — 26 Exeter St, Back Bay (B-3-65, a restaurant). In the Back Bay
// Architectural District with a building standing, so the run reaches BOTH the
// historic hurdle's months and feasibility.ts:223's teardown NEEDS_RELIEF check.
const BOS_HISTORIC = { city: 'boston', lat: 42.3505, lng: -71.08, label: 'Back Bay, Exeter St — designated district' }
// Boston — 13 Downer Ct, Dorchester (3F-5000). Outside any designated district.
const BOS_PLAIN = { city: 'boston', lat: 42.31, lng: -71.065, label: 'Dorchester, Downer Ct — no designated district' }

const COASTAL = 'Coastal_Zone_Polygon'
const BOS_HIST = 'Historic_Districts_BLC'
const FEMA = 'NFHL/MapServer/28'

const commercial = (gfa: number) => ({
  use: 'commercial',
  gfa: String(gfa),
  projectType: 'new',
  funding: 'private',
})

const CASES: Case[] = [
  { id: 'la-coastal/control', ...LA_COASTAL, q: commercial(4_000) },
  { id: 'la-coastal/COASTAL-FAIL', ...LA_COASTAL, q: commercial(4_000), fail: COASTAL },
  { id: 'la-inland/control', ...LA_INLAND, q: commercial(4_000) },
  { id: 'la-inland/COASTAL-FAIL', ...LA_INLAND, q: commercial(4_000), fail: COASTAL },
  { id: 'boston-hist/control', ...BOS_HISTORIC, q: commercial(20_000) },
  { id: 'boston-hist/HIST-FAIL', ...BOS_HISTORIC, q: commercial(20_000), fail: BOS_HIST },
  { id: 'boston-plain/control', ...BOS_PLAIN, q: commercial(20_000) },
  { id: 'boston-plain/HIST-FAIL', ...BOS_PLAIN, q: commercial(20_000), fail: BOS_HIST },
  { id: 'boston-plain/FEMA-FAIL', ...BOS_PLAIN, q: commercial(20_000), fail: FEMA },
  // A fault substring no provider's URL contains: the run must be identical to
  // its control, or the harness is moving something by itself.
  { id: 'boston-plain/NOOP-FAIL', ...BOS_PLAIN, q: commercial(20_000), fail: 'EHA_WebService' },
]

interface Out {
  id: string
  city: string
  label: string
  /** How many requests the fault substring actually routed. 0 on a perturbed
   *  row means the probe measured nothing (CLAUDE.md rule 20). */
  hits: number
  status: number | null
  verdict: string | null
  months: number | null
  hurdleCount: number | null
  /** Every hurdle label, so a row that VANISHES is visible rather than inferred
   *  from a count. */
  labels: string[]
  /** Rows that disclose a check we could not perform. */
  unchecked: string[]
  err?: string
}

let ipSeq = 0

async function once(c: Case): Promise<Out> {
  const base: Out = {
    id: c.id, city: c.city, label: c.label, hits: 0, status: null, verdict: null,
    months: null, hurdleCount: null, labels: [], unchecked: [],
  }
  const real = globalThis.fetch
  let hits = 0
  if (c.fail != null) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes(c.fail!)) {
        hits++
        throw new Error('probe: transport failure')
      }
      return real(input as RequestInfo, init)
    }) as typeof fetch
  }
  try {
    // A distinct client IP per call: the handler rate-limits 20/min per IP, and
    // a table of RATE_LIMITED rows would be the instrument measuring itself.
    const ip = `198.51.100.${(ipSeq++ % 250) + 1}`
    const q = { city: c.city, parcelId: 'harness', lat: String(c.lat), lng: String(c.lng), ...c.q }
    const res = await handler({ queryStringParameters: q, headers: { 'x-forwarded-for': ip } } as never)
    base.hits = hits
    base.status = res.statusCode
    const body = JSON.parse(res.body) as AnalysisResult & { code?: string; message?: string }
    if (res.statusCode !== 200) return { ...base, err: `${body.code}: ${body.message}` }
    base.verdict = body.feasibility.overall
    base.months = body.timeline.months
    base.hurdleCount = (body.hurdles ?? []).length
    base.labels = (body.hurdles ?? []).map((h) => h.label)
    base.unchecked = (body.hurdles ?? []).filter((h) => h.status === 'unchecked').map((h) => h.label)
    return base
  } finally {
    globalThis.fetch = real
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1]
  const rows: Out[] = []
  for (const c of CASES) {
    // Rule 10: two isolated passes. A row that disagrees with itself is marked,
    // not reported.
    const a = await once(c)
    await sleep(400)
    const b = await once(c)
    const key = (o: Out) => [o.status, o.verdict, o.months, o.labels.join('|')].join('¦')
    if (key(a) !== key(b)) a.err = `UNSTABLE: ${key(a)} vs ${key(b)}`
    rows.push(a)
    console.log(
      `${a.id.padEnd(28)} hits=${String(a.hits).padStart(2)} ${String(a.verdict).padEnd(13)} ` +
        `${String(a.months).padStart(3)}mo  hurdles=${String(a.hurdleCount).padStart(2)}  ${a.err ?? ''}`,
    )
    for (const l of a.labels) console.log(`      · ${l}`)
    await sleep(400)
  }
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
