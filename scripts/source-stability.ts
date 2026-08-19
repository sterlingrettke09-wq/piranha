// The stability register: which sources have been observed holding still, and
// therefore which the alert layer is allowed to diff.
//
//   npx vite-node scripts/source-stability.ts            # classify what is known
//   npx vite-node scripts/source-stability.ts --observe  # add today's observation
//
// Observations accumulate in scripts/__fixtures__/sourceStability.json. The file
// is committed, because the whole point is that a second run days later can be
// compared with the first — a register held in memory establishes nothing.
//
// ⚠️ THE ZONING OBSERVATIONS ARE SEEDED FROM MEASUREMENTS THAT ALREADY EXISTED,
// not re-derived. scripts/__fixtures__/zoneEnumerations/*.json carries a code
// roster per city captured 2026-08-17, and scripts/__fixtures__/parcelWeights/
// carries one captured 2026-08-19. Both are committed, both are dated, and both
// read the same layer and field. That is a real two-day interval available
// offline, and using it is the difference between a register that can classify
// something today and one that promises to in a week.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { readEnumeration } from './lib/zoneEnumeration'
import { readWeights, weightKey } from './lib/parcelWeights'
import { TARGETS } from './lib/parserDomains'
import { zoneSource } from './zoneRegistry'
import { classify, diffable, ADEQUATE_SPAN_DAYS, type Observation, type SourceExpectation } from './lib/sourceStability'

const FILE = join(resolve(__dirname, '..'), 'scripts/__fixtures__/sourceStability.json')

interface Register {
  [sourceId: string]: { expectation: SourceExpectation; observations: Observation[] }
}

/** Declared BEFORE any measurement, per the Austin/NYC lesson. */
function expectationFor(city: string): SourceExpectation {
  return {
    id: `zoning-roster:${city}`,
    kind: 'zoning-roster',
    expected: 'near-static',
    why:
      'A zoning code roster gains an entry when a rezoning is adopted and loses one when a district ' +
      'is repealed. Both are rare and countable — a handful a year, not a percentage — so any movement ' +
      'beyond a fraction of a percent between observations is the FEED moving, not the city.',
  }
}

/** The permit feeds, recorded from what the ledger already established rather
 *  than re-measured here. Both are real observations with dates. */
const PERMIT_SEED: Register = {
  'permit-feed:nyc': {
    expectation: {
      id: 'permit-feed:nyc',
      kind: 'permit-feed',
      expected: 'append-mostly',
      why:
        'A fixed `applied >= 2022-01-01` window over an append-mostly filing feed can only grow as ' +
        'permits are applied for and issued into it. Growth confirms; any decrease refutes.',
    },
    observations: [
      { on: '2026-08-06', n: 4394, from: 'scripts/permits/nyc.mjs, resource w9ak-ipjd, -I1 filings' },
      { on: '2026-08-09', n: 1040, from: 'same script, same query, same resource id' },
      { on: '2026-08-18', n: 8103, from: 'same script; server-side count(*) agreed with the rows fetched, so not paging' },
    ],
  },
  'permit-feed:austin': {
    expectation: {
      id: 'permit-feed:austin',
      kind: 'permit-feed',
      expected: 'append-mostly',
      why: 'Same fixed-window reasoning as NYC. Stated before the re-run, which is what gave it power.',
    },
    observations: [
      { on: '2026-08-06', n: 11534, from: 'scripts/permits/austin.mjs, newConstruction n' },
      { on: '2026-08-18', n: 11650, from: 'same script, same query; medians unmoved at 2.1 / 6.1' },
    ],
  },
}

function load(): Register {
  if (!existsSync(FILE)) return {}
  return JSON.parse(readFileSync(FILE, 'utf8')) as Register
}

function save(r: Register): void {
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(FILE, JSON.stringify(r, null, 2) + '\n')
}

/** The zoning roster for one city, at both committed vintages. Only cities whose
 *  sweep target reads the SAME layer and field as the registry are comparable —
 *  otherwise the two snapshots are of different columns and any difference
 *  between them says nothing about the source. */
function seedZoning(reg: Register): number {
  let seeded = 0
  for (const t of TARGETS) {
    const z = zoneSource(t.city)
    if (!z || z.layer !== t.url || z.field.toLowerCase() !== t.field.toLowerCase()) continue
    const e = readEnumeration(t.city)
    const w = readWeights(weightKey(t))
    if (!e || !w) continue

    const before = new Set(e.codes.map((c) => c.trim()))
    const after = new Set([...Object.keys(w.counts), ...w.confirmedZero])
    const id = `zoning-roster:${t.city}`
    const obs: Observation[] = [
      { on: e.capturedOn, n: before.size, from: `scripts/__fixtures__/zoneEnumerations/${t.city}.json` },
      {
        on: w.capturedOn,
        n: after.size,
        from: `scripts/__fixtures__/parcelWeights/${weightKey(t)}.json`,
        added: [...after].filter((x) => !before.has(x)).sort(),
        removed: [...before].filter((x) => !after.has(x)).sort(),
      },
    ]
    // Do not duplicate an observation already recorded for the same date.
    const existing = reg[id]?.observations ?? []
    const merged = [...existing]
    for (const o of obs) if (!merged.some((m) => m.on === o.on)) merged.push(o)
    reg[id] = { expectation: expectationFor(t.city), observations: merged }
    seeded++
  }
  return seeded
}

function report(reg: Register): void {
  const ids = Object.keys(reg).sort()
  // rule 20: classifying an empty register would print a clean page.
  if (ids.length === 0) {
    console.error('[stability] register is EMPTY — nothing has been observed. Refusing to report.')
    process.exitCode = 1
    return
  }
  console.log('[stability] Which sources have been observed holding still.')
  console.log('[stability] `insufficient` is the DEFAULT and is not a soft `stable` —')
  console.log('[stability] it means nobody has looked twice, and the alert layer must refuse it.\n')

  const rows = ids.map((id) => classify(reg[id].expectation, reg[id].observations))
  const order = { unstable: 0, insufficient: 1, stable: 2 } as const
  rows.sort((a, b) => order[a.klass] - order[b.klass] || a.id.localeCompare(b.id))

  for (const v of rows) {
    const mark = v.klass === 'stable' ? 'DIFFABLE  ' : v.klass === 'unstable' ? 'UNSTABLE  ' : 'INSUFFIC. '
    const ev = v.evidence === 'adequate' ? '     ' : ' weak'
    console.log(`  ${mark}${ev} ${v.id.padEnd(28)} ${String(v.observations)} obs / ${String(v.spanDays).padStart(2)}d  ${v.detail}`)
  }

  const n = (k: string) => rows.filter((r) => r.klass === k).length
  console.log(`\n  ${rows.length} sources · ${n('stable')} diffable · ${n('unstable')} unstable · ${n('insufficient')} insufficient`)
  console.log(`  Only the ${n('stable')} diffable sources may back an alert. The rest are not "probably fine".`)
  const worst = rows.filter((r) => r.klass === 'unstable')
  if (worst.length) {
    console.log('\n  Unstable, and why:')
    for (const v of worst) console.log(`    ${v.id} — ${v.detail}`)
  }
  const weak = rows.filter((r) => r.klass === 'stable' && r.evidence === 'weak-short-interval')
  if (weak.length) {
    console.log(`\n  ⚠️ ${weak.length} of the ${n('stable')} rest on an interval shorter than ${ADEQUATE_SPAN_DAYS} days.`)
    console.log('  A near-static source holding still for two days is close to vacuous on its own —')
    console.log('  a zoning roster barely moves in two days whether the feed is sound or quietly')
    console.log('  serving a cached snapshot. What that interval DOES rule out is the failure mode')
    console.log('  already seen here: NYC moved an order of magnitude in three days, so two days')
    console.log('  would have caught NYC-class wobble and nothing slower. Re-run this in a week.')
  }
  console.log(`\n  ${rows.filter(diffable).length} source(s) currently pass diffable().`)
}

function main() {
  const reg = load()
  if (process.argv.slice(2).includes('--observe')) {
    for (const [id, v] of Object.entries(PERMIT_SEED)) {
      const existing = reg[id]?.observations ?? []
      const merged = [...existing]
      for (const o of v.observations) if (!merged.some((m) => m.on === o.on)) merged.push(o)
      reg[id] = { expectation: v.expectation, observations: merged }
    }
    const seeded = seedZoning(reg)
    save(reg)
    console.log(`[stability] recorded ${seeded} zoning roster(s) and ${Object.keys(PERMIT_SEED).length} permit feed(s) → ${FILE}\n`)
  }
  report(reg)
}

main()
