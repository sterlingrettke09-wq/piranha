// Run the watchlist checker over every stored list.
//
//   npx vite-node scripts/watch-run.ts --dry     # decide and report, write nothing
//   npx vite-node scripts/watch-run.ts           # decide, report, persist
//
// ⚠️ THIS SENDS NOTHING, AND THAT IS THE CURRENT DESIGN RATHER THAN AN OVERSIGHT.
// Delivery is gated on the stability register being re-observed over a real
// interval (due 2026-08-26) and on this runner having been watched produce no
// false positives. Until then its output is a report, and a runner that mailed on
// its first run would assert exactly the confidence the register withholds.
//
// The diffable gate comes from `scripts/__fixtures__/sourceStability.json` via
// `lib/sourceStability.ts` — the runner does not decide which sources may be
// diffed, and must not.

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { runAll, summarise } from '../netlify/functions/lib/watchRunner'
import { classify, diffable, type Observation, type SourceExpectation } from './lib/sourceStability'

const REGISTER = join(resolve(__dirname, '..'), 'scripts/__fixtures__/sourceStability.json')

/** Which cities the register has observed holding still. A city absent from the
 *  register is NOT diffable — `insufficient` is the default and nobody has
 *  looked twice. */
function diffableCities(): Set<string> {
  if (!existsSync(REGISTER)) return new Set()
  const reg = JSON.parse(readFileSync(REGISTER, 'utf8')) as Record<
    string,
    { expectation: SourceExpectation; observations: Observation[] }
  >
  const out = new Set<string>()
  for (const [id, v] of Object.entries(reg)) {
    if (!id.startsWith('zoning-roster:')) continue
    if (diffable(classify(v.expectation, v.observations))) out.add(id.slice('zoning-roster:'.length))
  }
  return out
}

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry')
  const ok = diffableCities()
  // rule 20: running with an empty gate would suppress every row and print a
  // clean-looking report about nothing.
  if (ok.size === 0) {
    console.error('[watch] the stability register lists NO diffable city — refusing to run.')
    console.error('[watch] Seed it first: npx vite-node scripts/source-stability.ts --observe')
    process.exitCode = 1
    return
  }
  console.log(`[watch] ${ok.size} city/cities are diffable per the register: ${[...ok].sort().join(', ')}`)
  console.log(`[watch] ${dryRun ? 'DRY RUN — nothing will be written.' : 'Rows will be updated.'}`)
  console.log('[watch] Nothing is sent either way; delivery is gated on the 2026-08-26 re-observation.\n')

  const report = await runAll({ diffableFor: (c) => ok.has(c), dryRun })
  console.log(summarise(report))

  for (const a of report.alerts) {
    console.log(`\n  ${a.city}/${a.parcelId}`)
    for (const e of a.outcome.alertable) console.log(`    ${JSON.stringify(e)}`)
  }
  const bySuppression = new Map<string, number>()
  for (const r of report.results) {
    if (r.outcome.suppressed == null) continue
    const k = r.outcome.suppressed.slice(0, 60)
    bySuppression.set(k, (bySuppression.get(k) ?? 0) + 1)
  }
  if (bySuppression.size) {
    console.log('\n  Suppressed, and why:')
    for (const [why, n] of [...bySuppression].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${why}…`)
    }
  }
  for (const e of report.errors) console.log(`  ERROR ${e}`)
  if (report.errors.length) process.exitCode = 1
}

void main()
