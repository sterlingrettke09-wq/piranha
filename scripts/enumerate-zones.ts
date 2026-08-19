// CLI for the enumeration sweep. The library half — used by tests, by the
// parser-domain sweep and by parcel-weight.ts — is scripts/lib/zoneEnumeration.ts,
// which has no top-level effects. Nothing here is importable on purpose.
//
//   npx vite-node scripts/enumerate-zones.ts --verify-fields
//   npx vite-node scripts/enumerate-zones.ts --enumerate [--city=slug]

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ZONE_SOURCES, ENUMERABLE } from './zoneRegistry'
import { enumerate, verifyField, fixturePath } from './lib/zoneEnumeration'

const FIXTURES = join(resolve(__dirname, '..'), 'scripts/__fixtures__/zoneEnumerations')

async function main() {
  const argv = process.argv.slice(2)
  const only = argv.find((a) => a.startsWith('--city='))?.split('=')[1]
  const targets = only ? ENUMERABLE.filter((z) => z.city === only) : ENUMERABLE

  if (targets.length === 0) {
    console.error(`[zones] no enumerable city matched${only ? ` --city=${only}` : ''} — refusing to report over an empty set`)
    process.exitCode = 1
    return
  }

  if (argv.includes('--verify-fields')) {
    console.log('[zones] confirming each declared field against the LIVE layer.')
    console.log('[zones] A pass here means the registry still points at something real —')
    console.log('[zones] it says nothing about whether the values are right.\n')
    let bad = 0
    for (const z of targets) {
      const r = await verifyField(z)
      if (!r.ok) bad++
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${z.city.padEnd(13)} ${z.field.padEnd(16)} ${r.detail}`)
    }
    console.log(`\n[zones] ${targets.length} checked · ${bad} failing`)
    if (bad) process.exitCode = 1
    return
  }

  if (argv.includes('--enumerate')) {
    mkdirSync(FIXTURES, { recursive: true })
    let failed = 0
    for (const z of targets) {
      try {
        const e = await enumerate(z)
        writeFileSync(fixturePath(z.city), JSON.stringify(e, null, 2) + '\n')
        console.log(
          `${e.truncated ? 'PART' : 'OK  '} ${z.city.padEnd(13)} ${String(e.codes.length).padStart(5)} distinct${e.truncated ? '  ⚠️ TRUNCATED — service had more' : ''}`,
        )
      } catch (e) {
        failed++
        console.log(`FAIL ${z.city.padEnd(13)} ${String((e as Error).message).slice(0, 90)}`)
      }
    }
    console.log(`\n[zones] ${targets.length} attempted · ${failed} failed · fixtures in scripts/__fixtures__/zoneEnumerations`)
    if (failed) process.exitCode = 1
    return
  }

  console.log('usage: enumerate-zones.ts [--verify-fields | --enumerate] [--city=slug]')
  console.log(`registry: ${ZONE_SOURCES.length} cities, ${ENUMERABLE.length} enumerable`)
}

void main()
