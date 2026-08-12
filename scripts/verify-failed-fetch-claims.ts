// Before/after harness for the two "a failed fetch publishes a CLAIM" defects:
//
//   S2  Denver — the EHA market-area layer fails, and the report publishes a
//       commercial affordable-housing fee at the Typical rate, inside the
//       total, labelled "(Typical market)".
//   S3  Miami  — the HISTORIC layer fails, and the report publishes
//       "No tenant relocation or replacement-housing requirement", an ABSENCE,
//       plus a note asserting "This parcel is not in a designated historic
//       district".
//
// REAL ENTRY POINT (CLAUDE.md rule 11). Every row below goes through the ACTUAL
// `netlify/functions/analyze.ts` handler with the query string the result page
// builds, against LIVE upstream services. Exactly one layer is perturbed per
// run — `globalThis.fetch` throws for URLs containing one substring and is
// otherwise untouched — so the diff against the control run is the layer, not
// the harness.
//
//   npx vite-node scripts/verify-failed-fetch-claims.ts --out=FILE
//
// Delete this file if the harness is not wanted in the repo; the tests it
// motivated (denver.test.ts, miami-hurdles, cost.test.ts) are the permanent
// record.

import { writeFileSync } from 'node:fs'
import { handler } from '../netlify/functions/analyze'
import type { AnalysisResult } from '../src/types/analysis'

interface Case {
  id: string
  city: string
  lat: number
  lng: number
  label: string
  /** Query the result page would build. */
  q: Record<string, string>
  /** URL substring to fault. Undefined = the control run. */
  fail?: string
}

const DENVER_HIGH = { city: 'denver', lat: 39.75, lng: -104.995, label: 'D-C Union Station, EHA High' }
const DENVER_TYPICAL = { city: 'denver', lat: 39.7605, lng: -104.984, label: 'I-MX-5 RiNo, EHA Typical' }
const MIAMI_SMALL = { city: 'miami', lat: 25.7359, lng: -80.2405, label: 'T4-L Coral Way, 2-unit rental' }
const MIAMI_BIG = { city: 'miami', lat: 25.8003, lng: -80.2, label: 'T5-O, 289-unit rental' }
const SEATTLE = { city: 'seattle', lat: 47.6205, lng: -122.3212, label: 'Capitol Hill' }
const BOSTON = { city: 'boston', lat: 42.3541, lng: -71.0704, label: 'control city (no fee area)' }

const commercial = (gfa: number) => ({ use: 'commercial', gfa: String(gfa), projectType: 'new', funding: 'private' })
const teardown = (gfa: number) => ({ use: 'residential', gfa: String(gfa), units: '12', projectType: 'new', funding: 'private' })

const CASES: Case[] = [
  { id: 'denver-high/control', ...DENVER_HIGH, q: commercial(100_000) },
  { id: 'denver-high/EHA-FAIL', ...DENVER_HIGH, q: commercial(100_000), fail: 'EHA_WebService' },
  { id: 'denver-typical/control', ...DENVER_TYPICAL, q: commercial(100_000) },
  { id: 'denver-typical/EHA-FAIL', ...DENVER_TYPICAL, q: commercial(100_000), fail: 'EHA_WebService' },
  { id: 'miami-small/control', ...MIAMI_SMALL, q: teardown(8_000) },
  { id: 'miami-small/HIST-FAIL', ...MIAMI_SMALL, q: teardown(8_000), fail: 'HEP/MapServer/4' },
  { id: 'miami-big/control', ...MIAMI_BIG, q: teardown(60_000) },
  { id: 'miami-big/HIST-FAIL', ...MIAMI_BIG, q: teardown(60_000), fail: 'HEP/MapServer/4' },
  { id: 'seattle/control', ...SEATTLE, q: teardown(40_000) },
  { id: 'seattle/MHA-FAIL', ...SEATTLE, q: teardown(40_000), fail: 'MHA_Fee_Areas_1' },
  // Controls: a city with neither layer, and a run that faults a substring no
  // provider uses — both must be identical to their plain control.
  { id: 'boston/control', ...BOSTON, q: teardown(40_000) },
  { id: 'boston/EHA-FAIL(no-op)', ...BOSTON, q: teardown(40_000), fail: 'EHA_WebService' },
]

interface Out {
  id: string
  city: string
  label: string
  /** How many requests the fault substring actually routed. 0 on a perturbed
   *  row means the probe measured nothing (rule 20). */
  hits: number
  status: number | null
  verdict: string | null
  impact: number | null
  total: number | null
  months: number | null
  /** Disclaimers mentioning a fee — the claim S2 publishes. */
  feeNotes: string[]
  /** Hurdle labels whose text touches historic status — the claim S3 publishes. */
  historicRows: string[]
  /** Does any hurdle text state the parcel is NOT in a historic district? */
  assertsNotHistoric: boolean
  err?: string
}

let ipSeq = 0

async function once(c: Case): Promise<Out> {
  const base: Out = {
    id: c.id, city: c.city, label: c.label, hits: 0, status: null, verdict: null,
    impact: null, total: null, months: null, feeNotes: [], historicRows: [], assertsNotHistoric: false,
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
    base.impact = body.costs.impact
    base.total = body.costs.total
    base.months = body.timeline.months
    base.feeNotes = (body.disclaimers ?? []).filter((d) => /fee|linkage|MHA/i.test(d))
    base.historicRows = (body.hurdles ?? [])
      .filter((h) => /historic|archaeolog|tenant relocation/i.test(`${h.label} ${h.note}`))
      .map((h) => h.label)
    base.assertsNotHistoric = (body.hurdles ?? []).some((h) =>
      /not in a designated historic district|outside a designated historic district/i.test(h.note),
    )
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
    const key = (o: Out) =>
      [o.status, o.verdict, o.impact, o.total, o.months, o.assertsNotHistoric, o.feeNotes.join('|'), o.historicRows.join('|')].join('¦')
    if (key(a) !== key(b)) a.err = `UNSTABLE: ${key(a)} vs ${key(b)}`
    rows.push(a)
    console.log(
      `${a.id.padEnd(26)} hits=${String(a.hits).padStart(2)} ${String(a.verdict).padEnd(14)} ` +
        `impact=$${String(a.impact).padStart(9)} total=$${String(a.total).padStart(11)} ${String(a.months).padStart(3)}mo ` +
        `notHistoric=${a.assertsNotHistoric ? 'YES' : 'no '} ${a.err ?? ''}`,
    )
    for (const n of a.feeNotes) console.log(`    fee: ${n}`)
    for (const h of a.historicRows) console.log(`    row: ${h}`)
    await sleep(400)
  }
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
